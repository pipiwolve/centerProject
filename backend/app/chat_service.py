from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any

from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableLambda
from langchain_core.runnables.history import RunnableWithMessageHistory

from .config import AppConfig
from .retriever import LocalKnowledgeIndex
from .utils import excerpt_text

try:  # pragma: no cover - depends on optional cloud credentials
    from langchain_community.chat_models import ChatTongyi
except Exception:  # pragma: no cover
    ChatTongyi = None


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
    def __init__(self, config: AppConfig, index: LocalKnowledgeIndex) -> None:
        self.config = config
        self.index = index
        self.histories: dict[str, InMemoryChatMessageHistory] = {}
        self.llm = self._build_llm()
        self._rag_chain = self._build_rag_chain() if self.llm else None

    def chat(self, query: str, session_id: str | None = None, debug: bool = False) -> dict[str, Any]:
        started_at = time.perf_counter()
        session = session_id or str(uuid.uuid4())
        analysis = self._analyze_query(query)
        retrieved_docs = self.index.retrieve(analysis.rewritten_query, top_k=5)

        if self._rag_chain:
            payload = {
                "input": analysis.rewritten_query,
                "analysis_summary": analysis.to_summary(),
            }
            result = self._rag_chain.invoke(
                payload,
                config={"configurable": {"session_id": session}},
            )
            answer_text = result.get("answer", "")
            context_docs = result.get("context", retrieved_docs)
        else:
            answer_text = self._compose_answer_offline(query, analysis, retrieved_docs)
            context_docs = retrieved_docs
            self._store_latest_exchange(session, query, answer_text)

        sections = self._extract_sections(answer_text, context_docs)
        sources = [self._document_to_source(doc) for doc in context_docs]
        latency_ms = round((time.perf_counter() - started_at) * 1000, 2)

        return {
            "session_id": session,
            "rewritten_query": analysis.rewritten_query,
            "risk_level": analysis.risk_level,
            "answer": answer_text,
            "sections": sections,
            "sources": sources,
            "latency_ms": latency_ms,
            "retrieval_trace": {
                "analysis": {
                    "materials": analysis.materials,
                    "damage_types": analysis.damage_types,
                    "risk_level": analysis.risk_level,
                    "notes": analysis.notes,
                },
                "source_count": len(sources),
            },
            "debug": debug,
        }

    def _build_llm(self) -> Any | None:
        if not self.config.dashscope_api_key or ChatTongyi is None:
            return None
        try:  # pragma: no cover - depends on cloud credentials
            return ChatTongyi(
                api_key=self.config.dashscope_api_key,
                model=self.config.dashscope_model_name,
                streaming=False,
            )
        except Exception:
            return None

    def _build_rag_chain(self) -> RunnableWithMessageHistory | None:
        retriever_runnable = RunnableLambda(lambda input_query: self.index.retrieve(input_query, top_k=5))

        contextualize_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "你是皮具养护问答助手的查询改写器。"
                    "结合历史对话，将当前问题改写成适合检索的独立问题。"
                    "只返回改写后的问题，不要解释。",
                ),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

        history_aware_retriever = create_history_aware_retriever(
            self.llm,
            retriever_runnable,
            contextualize_prompt,
        )

        answer_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "你是一名严谨的手工皮具养护顾问。"
                    "请仅根据检索到的资料作答，不要编造。"
                    "若资料不足，请明确说明信息不足。"
                    "严格使用以下 Markdown 小标题输出："
                    "### 适用判断\n### 所需工具\n### 操作步骤\n### 注意事项\n### 何时送修\n### 参考来源。\n"
                    "分析摘要：{analysis_summary}",
                ),
                MessagesPlaceholder("chat_history"),
                ("human", "用户问题：{input}\n\n检索资料：\n{context}"),
            ]
        )

        question_answer_chain = create_stuff_documents_chain(self.llm, answer_prompt)
        rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)

        return RunnableWithMessageHistory(
            rag_chain,
            self._get_session_history,
            input_messages_key="input",
            history_messages_key="chat_history",
            output_messages_key="answer",
        )

    def _get_session_history(self, session_id: str) -> InMemoryChatMessageHistory:
        if session_id not in self.histories:
            self.histories[session_id] = InMemoryChatMessageHistory()
        return self.histories[session_id]

    def _store_latest_exchange(self, session_id: str, user_query: str, answer_text: str) -> None:
        history = self._get_session_history(session_id)
        history.add_message(HumanMessage(content=user_query))
        history.add_message(AIMessage(content=answer_text))

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
        }.items():
            if any(alias in lowered or alias in query for alias in aliases):
                damage_types.append(keyword)

        risk_level = "high" if any(term in query for term in ["掉色", "开裂", "破洞", "霉"]) else "medium" if damage_types else "low"
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

    def _compose_answer_offline(self, original_query: str, analysis: QueryAnalysis, docs: list[Document]) -> str:
        faq_doc = next((doc for doc in docs if doc.metadata.get("source_type") == "faq"), None)
        if faq_doc:
            return self._normalize_answer_block(faq_doc.page_content, docs)

        merged_context = "\n".join(f"- {doc.metadata.get('title', '')}: {excerpt_text(doc.page_content, 220)}" for doc in docs[:3])
        if not merged_context:
            merged_context = "当前本地知识库中未找到足够资料，建议补充更具体的材质、颜色和受损情况。"

        return "\n".join(
            [
                "### 适用判断",
                f"基于当前检索结果，问题“{original_query}”属于{analysis.risk_level}风险场景。若存在大面积掉色、结构损坏或霉变扩散，应优先送修。",
                "",
                "### 所需工具",
                "建议准备软布、中性清洁用品、对应材质护理剂，以及用于测试的小面积试擦区域。",
                "",
                "### 操作步骤",
                merged_context,
                "",
                "### 注意事项",
                "先做小范围测试，避免暴晒、强溶剂和高温加热；若材质无法确认，不要直接上油或补色。",
                "",
                "### 何时送修",
                "出现破洞、严重串色、结构塌陷、霉菌反复或处理后情况加重时，应停止自行处理并送专业门店。",
                "",
                "### 参考来源",
                "\n".join(
                    f"- {doc.metadata.get('title', '未命名资料')} / {doc.metadata.get('source_path', '')}"
                    for doc in docs[:4]
                )
                or "- 本地知识库暂无命中",
            ]
        )

    def _normalize_answer_block(self, answer: str, docs: list[Document]) -> str:
        if "### 适用判断" in answer:
            if "### 参考来源" not in answer:
                answer = answer.rstrip() + "\n\n### 参考来源\n" + "\n".join(
                    f"- {doc.metadata.get('title', '未命名资料')} / {doc.metadata.get('source_path', '')}"
                    for doc in docs[:3]
                )
            return answer

        tools = ""
        steps = answer
        warnings = "先做局部测试，避免用力摩擦、暴晒和使用强溶剂。"
        if "【所需工具】" in answer:
            parts = answer.split("【所需工具】", 1)[1]
            tools = parts.split("【操作逻辑】", 1)[0].strip()
        if "【操作逻辑】" in answer:
            steps = answer.split("【操作逻辑】", 1)[1].split("【关键注意事项】", 1)[0].strip()
        if "【关键注意事项】" in answer:
            warnings = answer.split("【关键注意事项】", 1)[1].strip()

        references = "\n".join(
            f"- {doc.metadata.get('title', '未命名资料')} / {doc.metadata.get('source_path', '')}"
            for doc in docs[:3]
        )
        return "\n".join(
            [
                "### 适用判断",
                "以下方案适用于当前命中的典型场景，如皮面已经破损见底、染色扩散或霉变严重，请优先送修。",
                "",
                "### 所需工具",
                tools or "请准备软布、对应材质专用护理用品和小范围测试工具。",
                "",
                "### 操作步骤",
                steps,
                "",
                "### 注意事项",
                warnings,
                "",
                "### 何时送修",
                "若处理后掉色加重、皮面起壳、结构松散或反复发霉，应停止继续操作并送修。",
                "",
                "### 参考来源",
                references,
            ]
        )

    def _extract_sections(self, answer: str, docs: list[Document]) -> dict[str, str]:
        sections = {name: "" for name in SECTION_ORDER}
        pattern = re.compile(r"###\s*(.+?)\n(.*?)(?=\n###|\Z)", re.S)
        for title, body in pattern.findall(answer):
            normalized_title = title.strip()
            if normalized_title in sections:
                sections[normalized_title] = body.strip()

        if not any(sections.values()):
            sections["适用判断"] = "请结合命中的资料判断材质和受损范围，再执行护理步骤。"
            sections["操作步骤"] = answer.strip()
            sections["参考来源"] = "\n".join(
                f"- {doc.metadata.get('title', '')} / {doc.metadata.get('source_path', '')}"
                for doc in docs[:3]
            )
        return sections

    def _document_to_source(self, document: Document) -> dict[str, Any]:
        return {
            "title": document.metadata.get("title", "未命名资料"),
            "source_type": document.metadata.get("source_type", "docs"),
            "source_path": document.metadata.get("source_path", ""),
            "score": document.metadata.get("score", 0.0),
            "excerpt": excerpt_text(document.page_content, 180),
            "materials": document.metadata.get("materials", []),
            "damage_types": document.metadata.get("damage_types", []),
        }
