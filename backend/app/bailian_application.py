from __future__ import annotations

import json
import re
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any

from .config import AppConfig
from .types import ChatSourceHit
from .utils import clean_runtime_markdown, excerpt_text

try:  # pragma: no cover - depends on optional third-party package import
    from dashscope import Application
except Exception:  # pragma: no cover
    Application = None


OBSERVATION_SPLIT_RE = re.compile(r"(?=切片\s*\d+)")
OBSERVATION_SCORE_RE = re.compile(r"(\d{1,3})%\s*相似度")
URL_RE = re.compile(r"https?://\S+")


@dataclass(slots=True)
class BailianObservationHit:
    content: str
    title: str = ""
    score: float = 0.0
    source_uri: str = ""
    doc_name: str = ""


@dataclass(slots=True)
class BailianApplicationResult:
    text: str
    session_id: str
    sources: list[dict[str, Any]]
    raw_doc_references: list[dict[str, Any]]
    raw_thoughts: list[dict[str, Any]]


class BailianApplicationService:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def call(self, query: str, session_id: str) -> BailianApplicationResult:
        if Application is None:
            raise RuntimeError("dashscope SDK 未正确安装，无法调用百炼应用。")
        if not self.config.dashscope_api_key:
            raise RuntimeError("缺少 DASHSCOPE_API_KEY，当前无法调用百炼应用。")
        if not self.config.bailian_app_id:
            raise RuntimeError("缺少 BAILIAN_APP_ID，当前无法调用百炼应用。")

        response = Application.call(
            app_id=self.config.bailian_app_id,
            prompt=query,
            session_id=session_id,
            workspace=self.config.workspace_id or None,
            api_key=self.config.dashscope_api_key,
            has_thoughts=True,
            doc_reference_type="simple",
        )

        if getattr(response, "status_code", None) != HTTPStatus.OK:
            code = getattr(response, "code", "") or "unknown_error"
            message = getattr(response, "message", "") or "百炼应用调用失败。"
            raise RuntimeError(f"{code}: {message}")

        output = getattr(response, "output", None)
        if output is None:
            raise RuntimeError("百炼应用返回结果缺少 output 字段。")

        text = (getattr(output, "text", None) or "").strip()
        thoughts = [self._to_dict(thought) for thought in (getattr(output, "thoughts", None) or [])]
        doc_references = [
            self._to_dict(reference) for reference in (getattr(output, "doc_references", None) or [])
        ]

        if not text:
            text = self._extract_text_from_thoughts(thoughts)

        sources = self._build_sources(doc_references, thoughts)
        return BailianApplicationResult(
            text=text,
            session_id=(getattr(output, "session_id", None) or session_id),
            sources=sources,
            raw_doc_references=doc_references,
            raw_thoughts=thoughts,
        )

    def _build_sources(
        self,
        doc_references: list[dict[str, Any]],
        thoughts: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        observation_hits = self._extract_observation_hits(thoughts)
        used_observation_keys: set[str] = set()
        sources: list[dict[str, Any]] = []

        for index, reference in enumerate(doc_references, start=1):
            title = (
                reference.get("title")
                or reference.get("doc_name")
                or reference.get("doc_id")
                or f"百炼引用 {index}"
            )
            snippet = clean_runtime_markdown(reference.get("text", ""), title=title, strip_title=True)
            matched_hits = self._match_observations(reference, observation_hits)
            retrieval_chunks: list[str] = []
            for hit in matched_hits:
                key = self._normalize_text(hit.content)
                if key:
                    used_observation_keys.add(key)
                if hit.content and hit.content not in retrieval_chunks:
                    retrieval_chunks.append(hit.content)

            content_parts = [snippet] if snippet else []
            content_parts.extend(chunk for chunk in retrieval_chunks if chunk and chunk not in content_parts)
            content = "\n\n".join(content_parts).strip() or "百炼返回了引用信息，但没有更多可展开的切片内容。"
            preview_source = snippet or (retrieval_chunks[0] if retrieval_chunks else content)
            score = next((hit.score for hit in matched_hits if hit.score > 0), 0.0)

            sources.append(
                ChatSourceHit(
                    title=title,
                    source_type="bailian_reference",
                    source_path=reference.get("doc_name") or reference.get("doc_id") or title,
                    score=round(score, 4),
                    preview=excerpt_text(preview_source, 180),
                    content=content,
                    excerpt=excerpt_text(preview_source, 180),
                    reference_id=f"ref-{index}",
                    citation_label=f"引用 {index}",
                    source_uri=reference.get("doc_url") or reference.get("doc_id") or reference.get("index_id") or "",
                    hit_type="reference",
                    snippet=preview_source,
                    doc_id=reference.get("doc_id", ""),
                    doc_name=reference.get("doc_name", ""),
                    page_numbers=self._normalize_page_numbers(reference.get("page_number")),
                    retrieval_chunks=retrieval_chunks,
                ).to_dict()
            )

        unmatched_hits = [
            hit
            for hit in observation_hits
            if self._normalize_text(hit.content) not in used_observation_keys
        ]
        for index, hit in enumerate(unmatched_hits, start=1):
            if not hit.content:
                continue
            title = hit.title or hit.doc_name or f"召回切片 {index}"
            preview = excerpt_text(hit.content, 180)
            sources.append(
                ChatSourceHit(
                    title=title,
                    source_type="bailian_chunk",
                    source_path=hit.doc_name or title,
                    score=round(hit.score, 4),
                    preview=preview,
                    content=hit.content,
                    excerpt=preview,
                    reference_id=f"chunk-{index}",
                    citation_label=f"切片 {index}",
                    source_uri=hit.source_uri,
                    hit_type="chunk",
                    snippet=hit.content,
                ).to_dict()
            )

        deduped: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for source in sources:
            key = (
                source.get("reference_id", ""),
                self._normalize_text(source.get("content", "")),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(source)
        return deduped

    def _match_observations(
        self,
        reference: dict[str, Any],
        observation_hits: list[BailianObservationHit],
    ) -> list[BailianObservationHit]:
        keywords = [
            self._normalize_text(reference.get("title", "")),
            self._normalize_text(reference.get("doc_name", "")),
            self._normalize_text(reference.get("doc_id", "")),
        ]
        keywords = [keyword for keyword in keywords if keyword]
        if not keywords:
            return []

        matches: list[BailianObservationHit] = []
        for hit in observation_hits:
            haystack = " ".join(
                filter(
                    None,
                    [
                        self._normalize_text(hit.title),
                        self._normalize_text(hit.doc_name),
                        self._normalize_text(hit.source_uri),
                        self._normalize_text(hit.content),
                    ],
                )
            )
            if any(keyword in haystack for keyword in keywords):
                matches.append(hit)
        return matches

    def _extract_observation_hits(self, thoughts: list[dict[str, Any]]) -> list[BailianObservationHit]:
        hits: list[BailianObservationHit] = []
        for index, thought in enumerate(thoughts, start=1):
            observation = thought.get("observation")
            if not observation:
                continue
            hits.extend(self._parse_observation(observation, index))
        return hits

    def _parse_observation(self, observation: Any, thought_index: int) -> list[BailianObservationHit]:
        if isinstance(observation, (list, dict)):
            return self._extract_hits_from_structured_observation(observation, thought_index)

        raw = str(observation or "").strip()
        if not raw:
            return []

        unwrapped = self._strip_code_fence(raw)
        try:
            parsed = json.loads(unwrapped)
        except Exception:
            parsed = None
        if parsed is not None:
            return self._extract_hits_from_structured_observation(parsed, thought_index)

        blocks: list[str] = []
        if "切片" in raw:
            blocks = [block.strip() for block in OBSERVATION_SPLIT_RE.split(raw) if block.strip()]
        if not blocks:
            blocks = [block.strip() for block in re.split(r"\n{2,}", raw) if block.strip()]
        if not blocks:
            blocks = [raw]

        hits: list[BailianObservationHit] = []
        for block_index, block in enumerate(blocks, start=1):
            score_match = OBSERVATION_SCORE_RE.search(block)
            score = round(float(score_match.group(1)) / 100, 4) if score_match else 0.0
            title_match = re.match(r"^(切片\s*\d+)", block)
            title = title_match.group(1) if title_match else f"召回切片 {thought_index}-{block_index}"
            content = self._strip_observation_prefix(block)
            source_uri_match = URL_RE.search(block)
            hits.append(
                BailianObservationHit(
                    title=title,
                    content=clean_runtime_markdown(content),
                    score=score,
                    source_uri=source_uri_match.group(0) if source_uri_match else "",
                )
            )
        return [hit for hit in hits if hit.content]

    def _extract_hits_from_structured_observation(
        self,
        payload: Any,
        thought_index: int,
    ) -> list[BailianObservationHit]:
        hits: list[BailianObservationHit] = []

        def walk(node: Any) -> None:
            if isinstance(node, list):
                for item in node:
                    walk(item)
                return

            if not isinstance(node, dict):
                return

            content = ""
            for key in ("text", "content", "snippet", "chunk", "passage", "observation"):
                value = node.get(key)
                if isinstance(value, str) and value.strip():
                    content = value.strip()
                    break

            if content:
                score_raw = node.get("score") or node.get("similarity") or node.get("relevance_score") or 0.0
                try:
                    score = float(score_raw)
                except Exception:
                    score = 0.0
                hits.append(
                    BailianObservationHit(
                        title=str(node.get("title") or node.get("doc_name") or f"召回切片 {thought_index}"),
                        content=clean_runtime_markdown(content),
                        score=score if score <= 1 else round(score / 100, 4),
                        source_uri=str(node.get("doc_url") or node.get("source_uri") or node.get("doc_id") or ""),
                        doc_name=str(node.get("doc_name") or node.get("title") or ""),
                    )
                )

            for value in node.values():
                if isinstance(value, (dict, list)):
                    walk(value)

        walk(payload)
        return [hit for hit in hits if hit.content]

    def _extract_text_from_thoughts(self, thoughts: list[dict[str, Any]]) -> str:
        for thought in reversed(thoughts):
            response_text = str(thought.get("response") or "").strip()
            if response_text:
                return response_text
        return ""

    def _strip_code_fence(self, value: str) -> str:
        stripped = value.strip()
        if stripped.startswith("```") and stripped.endswith("```"):
            lines = stripped.splitlines()
            return "\n".join(lines[1:-1]).strip()
        return stripped

    def _strip_observation_prefix(self, value: str) -> str:
        text = value.strip()
        text = re.sub(r"^切片\s*\d+\s*", "", text)
        text = re.sub(r"^\d+\s*字符\s*", "", text)
        text = OBSERVATION_SCORE_RE.sub("", text, count=1)
        return text.strip(" ：:-")

    def _normalize_text(self, value: str) -> str:
        return re.sub(r"\s+", " ", str(value or "")).strip().lower()

    def _normalize_page_numbers(self, value: Any) -> list[int]:
        if isinstance(value, int):
            return [value]
        if isinstance(value, list):
            normalized: list[int] = []
            for item in value:
                try:
                    normalized.append(int(item))
                except Exception:
                    continue
            return normalized
        if isinstance(value, str) and value.strip():
            parts = re.split(r"[,\s]+", value.strip())
            normalized = []
            for part in parts:
                try:
                    normalized.append(int(part))
                except Exception:
                    continue
            return normalized
        return []

    def _to_dict(self, value: Any) -> dict[str, Any]:
        if hasattr(value, "__dict__"):
            return {
                key: self._serialize_nested(item)
                for key, item in vars(value).items()
                if not key.startswith("_")
            }
        if hasattr(value, "items"):
            return {key: self._serialize_nested(item) for key, item in dict(value).items()}
        return {}

    def _serialize_nested(self, value: Any) -> Any:
        if isinstance(value, list):
            return [self._serialize_nested(item) for item in value]
        if hasattr(value, "__dict__"):
            return {
                key: self._serialize_nested(item)
                for key, item in vars(value).items()
                if not key.startswith("_")
            }
        if hasattr(value, "items"):
            return {key: self._serialize_nested(item) for key, item in dict(value).items()}
        return value
