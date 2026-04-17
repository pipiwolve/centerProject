from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any

from .bailian_application import BailianApplicationService
from .config import AppConfig
from .utils import build_step_markdown, clean_runtime_markdown


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
        answer_text = self._normalize_answer_block(app_result.text, app_result.sources)
        sections = self._extract_sections(answer_text, app_result.sources)
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
                "source_count": len(app_result.sources),
            },
            "debug": debug,
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

    def _normalize_answer_block(self, answer: str, sources: list[dict[str, Any]]) -> str:
        cleaned_answer = clean_runtime_markdown(answer)
        if "### 适用判断" in cleaned_answer:
            if "### 参考来源" not in cleaned_answer:
                cleaned_answer = cleaned_answer.rstrip() + "\n\n### 参考来源\n" + self._build_reference_section(sources)
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
                self._build_reference_section(sources),
            ]
        )

    def _extract_sections(self, answer: str, sources: list[dict[str, Any]]) -> dict[str, str]:
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
            sections["参考来源"] = self._build_reference_section(sources)

        if not sections["操作步骤"]:
            sections["操作步骤"] = self._build_step_section(sources)

        if not sections["参考来源"]:
            sections["参考来源"] = self._build_reference_section(sources)

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

    def _build_reference_section(self, sources: list[dict[str, Any]]) -> str:
        if not sources:
            return "- 本次回答未返回可展示引用。"

        references = []
        for source in sources:
            label = source.get("citation_label") or source.get("reference_id") or "引用"
            title = source.get("title") or source.get("doc_name") or "未命名资料"
            uri = source.get("source_uri") or source.get("source_path") or ""
            references.append(f"- {label} · {title}" + (f" / {uri}" if uri else ""))
        return "\n".join(references)
