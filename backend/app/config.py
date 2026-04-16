from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class AppConfig:
    project_root: Path
    backend_root: Path
    frontend_root: Path
    knowledge_root: Path
    raw_dir: Path
    normalized_dir: Path
    chunks_dir: Path
    faq_dir: Path
    eval_dir: Path
    manifest_dir: Path
    qa_seed_path: Path
    design_system_path: Path
    dashscope_api_key: str
    dashscope_model_name: str
    dashscope_base_url: str
    backend_host: str
    backend_port: int
    enable_cloud_sync: bool
    cloud_access_key_id: str
    cloud_access_key_secret: str
    workspace_id: str
    bailian_endpoint: str
    docs_kb_id: str
    faq_kb_id: str
    parser_name: str = "DASHSCOPE_DOCMIND"
    category_id: str = "default"
    source_type: str = "DATA_CENTER_FILE"
    sink_type: str = "BUILT_IN"

    @property
    def generated_docs_bundle(self) -> Path:
        return self.faq_dir.parent / "docs_kb_bundle.md"

    @property
    def generated_faq_bundle(self) -> Path:
        return self.faq_dir / "faq_kb_bundle.md"

    @property
    def chunk_manifest_path(self) -> Path:
        return self.manifest_dir / "chunks.jsonl"

    @property
    def faq_manifest_path(self) -> Path:
        return self.manifest_dir / "faq.jsonl"

    @property
    def eval_manifest_path(self) -> Path:
        return self.manifest_dir / "eval.jsonl"

    @property
    def ingest_report_path(self) -> Path:
        return self.manifest_dir / "ingest-report.json"

    @property
    def sync_report_path(self) -> Path:
        return self.manifest_dir / "bailian-sync.json"

    @property
    def bailian_import_checklist_path(self) -> Path:
        return self.manifest_dir / "bailian-import-checklist.md"

    @classmethod
    def load(cls, backend_root: Path | None = None) -> "AppConfig":
        resolved_backend_root = backend_root or Path(__file__).resolve().parents[1]
        project_root = resolved_backend_root.parent
        load_dotenv(project_root / ".env")

        knowledge_root = project_root / "knowledge"
        generated_root = knowledge_root / "generated"
        processed_root = knowledge_root / "processed"
        manifest_root = generated_root / "manifests"

        return cls(
            project_root=project_root,
            backend_root=resolved_backend_root,
            frontend_root=project_root / "frontend",
            knowledge_root=knowledge_root,
            raw_dir=knowledge_root / "raw",
            normalized_dir=processed_root / "normalized",
            chunks_dir=processed_root / "chunks",
            faq_dir=generated_root / "faq",
            eval_dir=generated_root / "eval",
            manifest_dir=manifest_root,
            qa_seed_path=project_root / "QA_dataset" / "leather_repair_qa.md",
            design_system_path=project_root / "design-system" / "leather-care-rag-assistant" / "MASTER.md",
            dashscope_api_key=os.getenv("DASHSCOPE_API_KEY", ""),
            dashscope_model_name=os.getenv("DASHSCOPE_MODEL_NAME", "qwen-plus"),
            dashscope_base_url=os.getenv(
                "DASHSCOPE_BASE_URL",
                "https://dashscope.aliyuncs.com/compatible-mode/v1",
            ),
            backend_host=os.getenv("BACKEND_HOST", "127.0.0.1"),
            backend_port=int(os.getenv("BACKEND_PORT", "8000")),
            enable_cloud_sync=_env_flag("ENABLE_CLOUD_SYNC", False),
            cloud_access_key_id=os.getenv("ALIBABA_CLOUD_ACCESS_KEY_ID", ""),
            cloud_access_key_secret=os.getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET", ""),
            workspace_id=os.getenv("DASHSCOPE_WORKSPACE_ID", ""),
            bailian_endpoint=os.getenv("BAILIAN_ENDPOINT", "bailian.cn-beijing.aliyuncs.com"),
            docs_kb_id=os.getenv("BAILIAN_DOCS_KB_ID") or "zwb68dlfs9",
            faq_kb_id=os.getenv("BAILIAN_FAQ_KB_ID") or "",
        )
