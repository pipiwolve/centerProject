from __future__ import annotations

from pathlib import Path
from typing import Any

from langchain_core.documents import Document

from .config import AppConfig
from .utils import clean_runtime_markdown, excerpt_text, read_jsonl, tokenize_search_text


class LocalKnowledgeIndex:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self._cache: dict[str, Any] = {"chunks": [], "faq": [], "report": {}, "stamp": None}

    def retrieve(self, query: str, top_k: int = 5) -> list[Document]:
        self._refresh_cache()
        query_tokens = set(tokenize_search_text(query))
        scored: list[tuple[float, dict[str, Any]]] = []

        for faq in self._cache["faq"]:
            answer_text = clean_runtime_markdown(faq.get("answer", ""))
            text = f"{faq['question']} {answer_text}"
            score = self._score_text(text, query_tokens)
            if score > 0:
                scored.append((score + 0.25, {**faq, "answer": answer_text, "source_type": "faq"}))

        for chunk in self._cache["chunks"]:
            runtime_content = clean_runtime_markdown(chunk.get("content", ""))
            score = self._score_text(runtime_content, query_tokens)
            if score > 0:
                scored.append((score, {**chunk, "content": runtime_content, "source_type": "docs"}))

        scored.sort(key=lambda item: item[0], reverse=True)
        documents: list[Document] = []
        for score, item in scored[:top_k]:
            page_content = item.get("answer") or item.get("content", "")
            metadata = {
                "score": round(score, 4),
                "title": item.get("title", ""),
                "source_id": item.get("source_id", ""),
                "source_type": item.get("source_type", "docs"),
                "excerpt": excerpt_text(page_content, title=item.get("title", ""), strip_title=True),
                **item.get("metadata", {}),
            }
            documents.append(Document(page_content=page_content, metadata=metadata))
        return documents

    def sources_summary(self) -> dict[str, Any]:
        self._refresh_cache()
        report = self._cache["report"]
        return {
            "report": report,
            "faq_count": len(self._cache["faq"]),
            "chunk_count": len(self._cache["chunks"]),
            "source_count": report.get("source_count", 0),
        }

    def _refresh_cache(self) -> None:
        tracked_paths = [
            self.config.chunk_manifest_path,
            self.config.faq_manifest_path,
            self.config.ingest_report_path,
        ]
        stamp = tuple(path.stat().st_mtime if path.exists() else 0 for path in tracked_paths)
        if self._cache["stamp"] == stamp:
            return
        self._cache["chunks"] = read_jsonl(self.config.chunk_manifest_path)
        self._cache["faq"] = read_jsonl(self.config.faq_manifest_path)
        self._cache["report"] = {}
        if self.config.ingest_report_path.exists():
            import json

            self._cache["report"] = json.loads(self.config.ingest_report_path.read_text(encoding="utf-8"))
        self._cache["stamp"] = stamp

    def _score_text(self, text: str, query_tokens: set[str]) -> float:
        if not query_tokens:
            return 0.0
        text_tokens = tokenize_search_text(text)
        if not text_tokens:
            return 0.0
        overlap = sum(1 for token in text_tokens if token in query_tokens)
        coverage = overlap / max(len(query_tokens), 1)
        density = overlap / max(len(text_tokens), 1)
        return coverage * 0.8 + density * 0.2
