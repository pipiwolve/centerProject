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


@dataclass(slots=True)
class CaseImage:
    id: str
    case_id: str
    file_path: str
    url_path: str
    mime_type: str
    original_name: str
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class VisionAnalysis:
    id: str
    case_id: str
    materials: list[str] = field(default_factory=list)
    damage_types: list[str] = field(default_factory=list)
    affected_parts: list[str] = field(default_factory=list)
    photo_quality: str = "insufficient"
    risk_level: str = "low"
    missing_views: list[str] = field(default_factory=list)
    summary: str = ""
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CaseMessage:
    id: str
    case_id: str
    role: str
    content: str
    answer: str = ""
    sections: dict[str, str] = field(default_factory=dict)
    sources: list[dict[str, Any]] = field(default_factory=list)
    retrieval_trace: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CarePlanItem:
    id: str
    case_id: str
    step_type: str
    title: str
    instruction: str
    caution: str = ""
    status: str = "pending"
    sort_order: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CaseFeedback:
    id: str
    case_id: str
    message_id: str
    helpful: bool = False
    resolved: bool = False
    needs_repair: bool = False
    unclear_step: str = ""
    note: str = ""
    created_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CaseFeedbackSummary:
    count: int = 0
    helpful_count: int = 0
    resolved_count: int = 0
    needs_repair_count: int = 0
    latest_note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CaseSummary:
    id: str
    title: str
    status: str
    description: str
    cover_image_path: str
    cover_image_url: str
    risk_level: str
    source_mode: str
    created_at: str
    updated_at: str
    image_count: int = 0
    completed_plan_count: int = 0
    total_plan_count: int = 0
    latest_message_at: str = ""
    latest_user_message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CaseDetail:
    id: str
    title: str
    status: str
    description: str
    cover_image_path: str
    cover_image_url: str
    risk_level: str
    source_mode: str
    created_at: str
    updated_at: str
    images: list[CaseImage] = field(default_factory=list)
    vision_analysis: VisionAnalysis | None = None
    messages: list[CaseMessage] = field(default_factory=list)
    care_plan: list[CarePlanItem] = field(default_factory=list)
    feedback: list[CaseFeedback] = field(default_factory=list)
    feedback_summary: CaseFeedbackSummary = field(default_factory=CaseFeedbackSummary)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        return payload
