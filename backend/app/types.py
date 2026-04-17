from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class SourceDocument:
    source_id: str
    source_path: str
    title: str
    content: str
    kind: str
    hash_value: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class KnowledgeChunk:
    chunk_id: str
    source_id: str
    title: str
    content: str
    excerpt: str
    metadata: dict[str, Any]
    score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class FaqEntry:
    faq_id: str
    question: str
    answer: str
    source_id: str
    title: str
    metadata: dict[str, Any]
    score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class EvalCase:
    case_id: str
    question: str
    expected_keywords: list[str]
    title: str
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SyncResult:
    status: str
    detail: str
    docs_kb_id: str = ""
    faq_kb_id: str = ""
    uploaded_files: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ChatSourceHit:
    title: str
    source_type: str
    source_path: str
    score: float = 0.0
    preview: str = ""
    content: str = ""
    excerpt: str = ""
    materials: list[str] = field(default_factory=list)
    damage_types: list[str] = field(default_factory=list)
    reference_id: str = ""
    citation_label: str = ""
    source_uri: str = ""
    hit_type: str = "reference"
    snippet: str = ""
    doc_id: str = ""
    doc_name: str = ""
    page_numbers: list[int] = field(default_factory=list)
    retrieval_chunks: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class IngestReport:
    generated_at: str
    source_count: int
    normalized_count: int
    chunk_count: int
    faq_count: int
    eval_count: int
    sources: list[dict[str, Any]]
    sync: dict[str, Any]
    manual_import: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
