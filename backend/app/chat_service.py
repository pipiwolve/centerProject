from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from .bailian_application import BailianApplicationResult, BailianApplicationService
from .config import AppConfig
from .utils import build_step_markdown, clean_runtime_markdown, excerpt_text


SECTION_ORDER = [
    "适用判断",
    "所需工具",
    "操作步骤",
    "注意事项",
    "何时送修",
    "参考来源",
]


@dataclass(slots=True)
class QueryAnalysis:
    original_query: str
    rewritten_query: str
    materials: list[str]
    damage_types: list[str]
    risk_level: str
    notes: str

    def to_summary(self) -> str:
        return json.dumps(
            {
                "materials": self.materials,
                "damage_types": self.damage_types,
                "risk_level": self.risk_level,
                "notes": self.notes,
            },
            ensure_ascii=False,
        )


class LeatherChatService:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.bailian_app = BailianApplicationService(config)

    def chat(self, query: str, session_id: str | None = None, debug: bool = False) -> dict[str, Any]:
        started_at = time.perf_counter()
        analysis = self._analyze_query(query)
        requested_session_id = session_id or str(uuid.uuid4())
        app_result = self.bailian_app.call(query=query, session_id=requested_session_id)
        source_diagnostics = self._build_source_diagnostics(app_result)
        answer_text = self._normalize_answer_block(
            app_result.text,
            app_result.sources,
            source_hint=source_diagnostics["source_hint"],
        )
        sections = self._extract_sections(
            answer_text,
            app_result.sources,
            source_hint=source_diagnostics["source_hint"],
        )
        latency_ms = round((time.perf_counter() - started_at) * 1000, 2)

        return {
            "session_id": app_result.session_id or requested_session_id,
            "rewritten_query": analysis.rewritten_query,
            "risk_level": analysis.risk_level,
            "answer": answer_text,
            "sections": sections,
            "sources": app_result.sources,
            "latency_ms": latency_ms,
            "retrieval_trace": {
                "analysis": {
                    "materials": analysis.materials,
                    "damage_types": analysis.damage_types,
                    "risk_level": analysis.risk_level,
                    "notes": analysis.notes,
                },
                **source_diagnostics,
            },
            "debug": debug,
        }

    def chat_with_context(
        self,
        query: str,
        session_id: str | None = None,
        debug: bool = False,
        vision_analysis: dict[str, Any] | None = None,
        case_history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        started_at = time.perf_counter()
        analysis = self._analyze_query(query)
        requested_session_id = session_id or str(uuid.uuid4())
        contextual_query = self._build_contextual_query(query, vision_analysis, case_history or [])
        app_result = self.bailian_app.call(query=contextual_query, session_id=requested_session_id)
        source_diagnostics = self._build_source_diagnostics(app_result)
        answer_text = self._normalize_answer_block(
            app_result.text,
            app_result.sources,
            source_hint=source_diagnostics["source_hint"],
        )
        sections = self._extract_sections(
            answer_text,
            app_result.sources,
            source_hint=source_diagnostics["source_hint"],
        )
        latency_ms = round((time.perf_counter() - started_at) * 1000, 2)

        retrieval_trace = {
            "analysis": {
                "materials": analysis.materials,
                "damage_types": analysis.damage_types,
                "risk_level": analysis.risk_level,
                "notes": analysis.notes,
            },
            **source_diagnostics,
        }
        if vision_analysis:
            retrieval_trace["vision_analysis"] = {
                "materials": vision_analysis.get("materials", []),
                "damage_types": vision_analysis.get("damage_types", []),
                "affected_parts": vision_analysis.get("affected_parts", []),
                "photo_quality": vision_analysis.get("photo_quality", ""),
                "risk_level": vision_analysis.get("risk_level", ""),
                "missing_views": vision_analysis.get("missing_views", []),
                "summary": vision_analysis.get("summary", ""),
            }

        return {
            "session_id": app_result.session_id or requested_session_id,
            "rewritten_query": analysis.rewritten_query,
            "risk_level": self._merge_risk_levels(analysis.risk_level, vision_analysis),
            "answer": answer_text,
            "sections": sections,
            "sources": app_result.sources,
            "latency_ms": latency_ms,
            "retrieval_trace": retrieval_trace,
            "debug": debug,
        }

    def _build_source_diagnostics(self, app_result: BailianApplicationResult) -> dict[str, Any]:
        raw_doc_reference_count = len(app_result.raw_doc_references)
        raw_thought_count = len(app_result.raw_thoughts)
        workflow_message_present = bool(app_result.raw_workflow_message)
        source_count = len(app_result.sources)
        source_status = "available"
        source_hint = ""

        if source_count > 0:
            source_hint = "已返回百炼可展示引用与召回切片。"
        elif raw_doc_reference_count > 0:
            source_status = "reference_parse_miss"
            source_hint = (
                "百炼本次返回了 doc_references，但当前服务没有成功解析成可展示来源。"
                " 请检查百炼返回字段结构是否发生变化。"
            )
        elif raw_thought_count > 0:
            source_status = "thoughts_without_sources"
            source_hint = (
                "百炼本次返回了 thoughts，但没有解析出可展示切片。"
                " 若这是智能体应用，请确认已开启“展示回答来源”并重新发布；"
                " 若这是工作流应用，则需要按节点实际输出结构补充引用解析。"
            )
        elif workflow_message_present:
            source_status = "workflow_without_sources"
            source_hint = (
                "百炼本次返回了工作流节点消息，但没有返回可展示的 doc_references / thoughts。"
                " 如果希望前端展示命中来源，需要在应用侧输出可追溯引用，或改用开启“展示回答来源”的智能体检索配置。"
            )
        else:
            source_status = "no_source_metadata"
            source_hint = (
                "百炼应用本次没有返回可展示引用。"
                " 若正文已明显使用知识库内容，通常表示回答用了 RAG，但应用侧没有返回 doc_references。"
                " 可在百炼控制台开启“展示回答来源”并重新发布应用。"
            )

        return {
            "source_count": source_count,
            "raw_doc_reference_count": raw_doc_reference_count,
            "raw_thought_count": raw_thought_count,
            "workflow_message_present": workflow_message_present,
            "source_status": source_status,
            "source_hint": source_hint,
        }

    def _analyze_query(self, query: str) -> QueryAnalysis:
        materials = []
        damage_types = []
        lowered = query.lower()

        for keyword, aliases in {
            "植鞣革": ["植鞣革", "手柄", "本色皮"],
            "小羊皮": ["小羊皮", "羊皮"],
            "翻毛皮": ["翻毛皮", "反绒皮", "磨砂皮"],
            "漆皮": ["漆皮"],
            "五金": ["五金", "拉链"],
        }.items():
            if any(alias in lowered or alias in query for alias in aliases):
                materials.append(keyword)

        for keyword, aliases in {
            "发黑污渍": ["发黑", "变黑", "污渍"],
            "干裂发硬": ["干裂", "发硬", "淋雨"],
            "划痕": ["划痕", "刮痕"],
            "边油开裂": ["边油", "脱落", "裂开"],
            "锈蚀卡顿": ["不顺滑", "生锈", "卡住"],
            "霉变": ["发霉", "白毛", "霉斑"],
            "油渍": ["油渍", "油污", "油点"],
        }.items():
            if any(alias in lowered or alias in query for alias in aliases):
                damage_types.append(keyword)

        risk_level = (
            "high"
            if any(term in query for term in ["掉色", "开裂", "破洞", "霉", "渗色"])
            else "medium" if damage_types else "low"
        )
        note_parts = []
        if materials:
            note_parts.append(f"已识别材质：{', '.join(materials)}")
        if damage_types:
            note_parts.append(f"已识别问题：{', '.join(damage_types)}")
        if not note_parts:
            note_parts.append("建议优先确认皮革材质、受损程度和是否有染色/霉变。")

        rewritten_parts = [query.strip()]
        if materials:
            rewritten_parts.append("材质=" + ",".join(materials))
        if damage_types:
            rewritten_parts.append("问题=" + ",".join(damage_types))

        return QueryAnalysis(
            original_query=query,
            rewritten_query="；".join(rewritten_parts),
            materials=materials,
            damage_types=damage_types,
            risk_level=risk_level,
            notes="；".join(note_parts),
        )

    def _build_contextual_query(
        self,
        query: str,
        vision_analysis: dict[str, Any] | None,
        case_history: list[dict[str, Any]],
    ) -> str:
        context_parts = [
            "你是面向皮具护理场景的专业助手，请输出六段式结果：适用判断、所需工具、操作步骤、注意事项、何时送修、参考来源。",
            "请优先给出保守、安全、可执行的家庭级建议；若风险较高，请明确提示送修。",
        ]

        if vision_analysis:
            context_parts.append(
                "图像初判："
                + json.dumps(
                    {
                        "materials": vision_analysis.get("materials", []),
                        "damage_types": vision_analysis.get("damage_types", []),
                        "affected_parts": vision_analysis.get("affected_parts", []),
                        "photo_quality": vision_analysis.get("photo_quality", ""),
                        "risk_level": vision_analysis.get("risk_level", ""),
                        "missing_views": vision_analysis.get("missing_views", []),
                        "summary": vision_analysis.get("summary", ""),
                    },
                    ensure_ascii=False,
                )
            )

        if case_history:
            history_lines = []
            for item in case_history[-6:]:
                role = "用户" if item.get("role") == "user" else "助手"
                content = item.get("content") or item.get("answer") or ""
                if not content:
                    continue
                history_lines.append(f"{role}：{excerpt_text(content, 120)}")
            if history_lines:
                context_parts.append("最近对话：\n" + "\n".join(history_lines))

        context_parts.append(f"当前问题：{query.strip()}")
        return "\n\n".join(part for part in context_parts if part).strip()

    def _merge_risk_levels(self, text_risk: str, vision_analysis: dict[str, Any] | None) -> str:
        levels = {"low": 1, "medium": 2, "high": 3}
        if not vision_analysis:
            return text_risk
        vision_risk = str(vision_analysis.get("risk_level") or "").strip().lower()
        return vision_risk if levels.get(vision_risk, 0) >= levels.get(text_risk, 0) else text_risk

    def _normalize_answer_block(
        self,
        answer: str,
        sources: list[dict[str, Any]],
        source_hint: str = "",
    ) -> str:
        cleaned_answer = clean_runtime_markdown(answer)
        if "### 适用判断" in cleaned_answer:
            reference_section = self._build_reference_section(sources, source_hint)
            if "### 参考来源" in cleaned_answer:
                cleaned_answer = re.sub(
                    r"###\s*参考来源\s*\n(.*?)(?=\n###|\Z)",
                    "### 参考来源\n" + reference_section + "\n",
                    cleaned_answer,
                    flags=re.S,
                ).strip()
            else:
                cleaned_answer = cleaned_answer.rstrip() + "\n\n### 参考来源\n" + reference_section
            return cleaned_answer

        tools = ""
        steps = cleaned_answer
        warnings = "先做局部测试，避免用力摩擦、暴晒和使用强溶剂。"
        if "【所需工具】" in cleaned_answer:
            parts = cleaned_answer.split("【所需工具】", 1)[1]
            tools = parts.split("【操作逻辑】", 1)[0].strip()
        if "【操作逻辑】" in cleaned_answer:
            steps = cleaned_answer.split("【操作逻辑】", 1)[1].split("【关键注意事项】", 1)[0].strip()
        if "【关键注意事项】" in cleaned_answer:
            warnings = cleaned_answer.split("【关键注意事项】", 1)[1].strip()

        if not tools:
            tools = "请准备软布、对应材质专用护理用品，并优先在不显眼处小范围测试。"

        return "\n".join(
            [
                "### 适用判断",
                cleaned_answer or "请结合百炼命中的资料判断材质和受损范围，再执行护理步骤。",
                "",
                "### 所需工具",
                clean_runtime_markdown(tools),
                "",
                "### 操作步骤",
                build_step_markdown(steps) or self._build_step_section(sources),
                "",
                "### 注意事项",
                clean_runtime_markdown(warnings),
                "",
                "### 何时送修",
                "若处理后掉色加重、皮面起壳、结构松散或反复发霉，应停止继续操作并送修。",
                "",
                "### 参考来源",
                self._build_reference_section(sources, source_hint),
            ]
        )

    def _extract_sections(
        self,
        answer: str,
        sources: list[dict[str, Any]],
        source_hint: str = "",
    ) -> dict[str, str]:
        sections = {name: "" for name in SECTION_ORDER}
        pattern = re.compile(r"###\s*(.+?)\n(.*?)(?=\n###|\Z)", re.S)
        for title, body in pattern.findall(answer):
            normalized_title = title.strip()
            if normalized_title in sections:
                cleaned_body = clean_runtime_markdown(body)
                sections[normalized_title] = (
                    build_step_markdown(cleaned_body)
                    if normalized_title == "操作步骤"
                    else cleaned_body
                )

        if not any(sections.values()):
            sections["适用判断"] = "请结合百炼命中的资料判断材质和受损范围，再执行护理步骤。"
            sections["操作步骤"] = self._build_step_section(sources)
            sections["参考来源"] = self._build_reference_section(sources, source_hint)

        if not sections["操作步骤"]:
            sections["操作步骤"] = self._build_step_section(sources)

        if not sections["参考来源"]:
            sections["参考来源"] = self._build_reference_section(sources, source_hint)

        if not sections["何时送修"]:
            sections["何时送修"] = "若出现大面积掉色、结构损坏、反复霉变或处理后明显加重，应尽快送修。"

        if not sections["注意事项"]:
            sections["注意事项"] = "先做小范围测试，避免暴晒、强溶剂和高温加热。"

        return sections

    def _build_step_section(self, sources: list[dict[str, Any]]) -> str:
        for source in sources:
            content_candidates = []
            if source.get("retrieval_chunks"):
                content_candidates.extend(source.get("retrieval_chunks", []))
            if source.get("content"):
                content_candidates.append(source["content"])
            for candidate in content_candidates:
                step_markdown = build_step_markdown(candidate)
                if step_markdown:
                    return step_markdown
        return "1. 先确认材质、受损范围和是否需要送修。\n2. 在不显眼处小范围测试后，再逐步处理。"

    def _build_reference_section(self, sources: list[dict[str, Any]], source_hint: str = "") -> str:
        if not sources:
            return source_hint or "本次回答未返回可展示引用。"

        references = []
        for source in sources:
            label = source.get("citation_label") or source.get("reference_id") or "引用"
            title = source.get("title") or source.get("doc_name") or "未命名资料"
            locator = self._compact_source_locator(source)
            references.append(f"- {label} · {title}" + (f"（来源：{locator}）" if locator else ""))
        return "\n".join(references)

    def _compact_source_locator(self, source: dict[str, Any]) -> str:
        doc_name = str(source.get("doc_name") or "").strip()
        if doc_name:
            return self._truncate_middle(doc_name, 42)

        source_path = str(source.get("source_path") or "").strip()
        if source_path:
            basename = source_path.rsplit("/", 1)[-1].strip() or source_path
            if basename and basename != source.get("title"):
                return self._truncate_middle(basename, 42)

        raw_uri = str(source.get("source_uri") or "").strip()
        if not raw_uri:
            return ""

        try:
            parsed = urlparse(raw_uri)
            path_parts = [part for part in parsed.path.split("/") if part]
            filename = path_parts[-1] if path_parts else ""
            if filename:
                return self._truncate_middle(filename, 42)
            if parsed.netloc:
                return self._truncate_middle(parsed.netloc, 42)
        except Exception:
            pass

        return self._truncate_middle(raw_uri.split("?", 1)[0], 42)

    def _truncate_middle(self, value: str, limit: int = 42) -> str:
        text = str(value or "").strip()
        if len(text) <= limit:
            return text
        keep = max((limit - 1) // 2, 8)
        return text[:keep] + "…" + text[-keep:]
