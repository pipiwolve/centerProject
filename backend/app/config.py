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


def _dedupe_paths(paths: list[Path]) -> list[Path]:
    unique_paths: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        resolved = str(path.resolve(strict=False))
        if resolved in seen:
            continue
        seen.add(resolved)
        unique_paths.append(path)
    return unique_paths


def _knowledge_root_score(root: Path) -> int:
    manifest_dir = root / "generated" / "manifests"
    tracked_paths = [
        root / "raw",
        manifest_dir / "chunks.jsonl",
        manifest_dir / "faq.jsonl",
        manifest_dir / "eval.jsonl",
        manifest_dir / "ingest-report.json",
    ]
    return sum(path.exists() for path in tracked_paths)


def _resolve_knowledge_root(project_root: Path, backend_root: Path) -> Path:
    default_root = project_root / "knowledge"
    base_candidates = _dedupe_paths(
        [
            project_root,
            backend_root,
            backend_root.parent,
            Path.cwd(),
            Path.cwd().parent,
        ]
    )
    direct_candidates = _dedupe_paths([base / "knowledge" for base in base_candidates] + [default_root])

    best_root = default_root
    best_score = _knowledge_root_score(default_root)
    for candidate in direct_candidates:
        score = _knowledge_root_score(candidate)
        if score > best_score:
            best_root = candidate
            best_score = score

    if best_score > 0:
        return best_root

    for search_root in base_candidates:
        if not search_root.exists():
            continue
        for manifest_dir in search_root.rglob("knowledge/generated/manifests"):
            candidate = manifest_dir.parent.parent
            score = _knowledge_root_score(candidate)
            if score > best_score:
                best_root = candidate
                best_score = score

    return best_root


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
    bailian_app_id: str
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
    def eval_report_path(self) -> Path:
        return self.manifest_dir / "eval-report.json"

    @property
    def sync_report_path(self) -> Path:
        return self.manifest_dir / "bailian-sync.json"

    @property
    def bailian_import_checklist_path(self) -> Path:
        return self.manifest_dir / "bailian-import-checklist.md"

    @property
    def deployment_target(self) -> str:
        return "vercel" if os.getenv("VERCEL_ENV", "").strip() in {"preview", "production"} else "local"

    @property
    def read_only_runtime(self) -> bool:
        return self.deployment_target == "vercel"

    @property
    def bailian_app_configured(self) -> bool:
        return bool(self.dashscope_api_key and self.bailian_app_id)

    @property
    def ingest_enabled(self) -> bool:
        return not self.read_only_runtime

    @property
    def ingest_artifacts_ready(self) -> bool:
        tracked_paths = [
            self.chunk_manifest_path,
            self.faq_manifest_path,
            self.eval_manifest_path,
            self.ingest_report_path,
        ]
        return all(path.exists() for path in tracked_paths)

    @classmethod
    def load(cls, backend_root: Path | None = None) -> "AppConfig":
        resolved_backend_root = backend_root or Path(__file__).resolve().parents[1]
        project_root = resolved_backend_root.parent
        load_dotenv(project_root / ".env")

        knowledge_root = _resolve_knowledge_root(project_root, resolved_backend_root)
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
            bailian_app_id=os.getenv("BAILIAN_APP_ID", ""),
            backend_host=os.getenv("BACKEND_HOST", "127.0.0.1"),
            backend_port=int(os.getenv("BACKEND_PORT", "8000")),
            enable_cloud_sync=_env_flag("ENABLE_CLOUD_SYNC", False),
            cloud_access_key_id=os.getenv("ALIBABA_CLOUD_ACCESS_KEY_ID", ""),
            cloud_access_key_secret=os.getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET", ""),
            workspace_id=os.getenv("DASHSCOPE_WORKSPACE_ID", ""),
            bailian_endpoint=os.getenv("BAILIAN_ENDPOINT", "bailian.cn-beijing.aliyuncs.com"),
            docs_kb_id=os.getenv("BAILIAN_DOCS_KB_ID", ""),
            faq_kb_id=os.getenv("BAILIAN_FAQ_KB_ID") or "",
        )
