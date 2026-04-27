from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from .care_plan import CarePlanBuilder
from .case_repository import CaseRepository
from .chat_service import LeatherChatService
from .config import AppConfig
from .types import CaseFeedback, CaseImage, CaseMessage, VisionAnalysis
from .utils import excerpt_text, slugify
from .vision_service import VisionService


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PLAN_STATUSES = {"pending", "completed", "skipped"}
ALLOWED_CASE_STATUSES = {"draft", "in_progress", "monitoring", "send_repair", "closed"}


class CaseService:
    def __init__(self, config: AppConfig, chat_service: LeatherChatService) -> None:
        self.config = config
        self.chat_service = chat_service
        self.repository = CaseRepository(config)
        self.vision_service = VisionService(config)
        self.care_plan_builder = CarePlanBuilder()

    def list_cases(self, *, status: str | None = None, risk_level: str | None = None) -> list[dict[str, Any]]:
        return [item.to_dict() for item in self.repository.list_cases(status=status, risk_level=risk_level)]

    def get_case_detail(self, case_id: str) -> dict[str, Any]:
        return self.repository.get_case_detail(case_id).to_dict()

    def create_case(
        self,
        *,
        description: str,
        title: str,
        image_files: list[FileStorage],
    ) -> dict[str, Any]:
        self._assert_case_workflow_enabled()
        cleaned_description = description.strip()
        if not cleaned_description and not image_files:
            raise ValueError("请至少提供问题描述或上传 1 张图片。")
        validated_images = self._validate_image_files(image_files)
        if not validated_images:
            raise ValueError("创建案例时至少需要上传 1 张图片。")

        case_id = str(uuid.uuid4())
        created_at = self._now()
        case_dir = self.config.runtime_case_upload_root / case_id
        saved_images = self._save_images(case_dir, case_id, validated_images, created_at)

        try:
            analysis = self.vision_service.analyze(
                case_id=case_id,
                description=cleaned_description,
                image_paths=[case_dir / image.file_path.rsplit("/", 1)[-1] for image in saved_images],
            )
            analysis.created_at = created_at
            chat_response = self.chat_service.chat_with_context(
                query=cleaned_description or "请根据图片中的皮具问题给出护理建议。",
                session_id=case_id,
                vision_analysis=analysis.to_dict(),
                case_history=[],
            )

            resolved_title = title.strip() or self._build_case_title(cleaned_description, analysis)
            case_status = self._derive_case_status(analysis.risk_level)
            plan_items = self.care_plan_builder.build(
                case_id=case_id,
                vision_analysis=analysis,
                chat_response=chat_response,
            )
            user_message, assistant_message = self._build_message_pair(
                case_id=case_id,
                prompt=cleaned_description,
                chat_response=chat_response,
                created_at=created_at,
            )

            self.repository.insert_case(
                case_id=case_id,
                title=resolved_title,
                status=case_status,
                description=cleaned_description,
                cover_image_path=saved_images[0].file_path,
                risk_level=analysis.risk_level,
                source_mode="bailian_app",
                created_at=created_at,
                updated_at=created_at,
            )
            self.repository.insert_case_images(saved_images)
            self.repository.upsert_vision_analysis(analysis)
            self.repository.insert_case_message(user_message)
            self.repository.insert_case_message(assistant_message)
            self.repository.replace_care_plan(case_id, plan_items)
        except Exception:
            shutil.rmtree(case_dir, ignore_errors=True)
            raise

        return self.get_case_detail(case_id)

    def append_message(self, *, case_id: str, content: str) -> dict[str, Any]:
        self._assert_case_workflow_enabled()
        prompt = content.strip()
        if not prompt:
            raise ValueError("追问内容不能为空。")

        case_detail = self.repository.get_case_detail(case_id)
        vision_analysis = case_detail.vision_analysis.to_dict() if case_detail.vision_analysis else None
        history = [message.to_dict() for message in self.repository.get_recent_case_messages(case_id, limit=6)]
        created_at = self._now()

        user_message = CaseMessage(
            id=f"msg-{uuid.uuid4()}",
            case_id=case_id,
            role="user",
            content=prompt,
            created_at=created_at,
        )
        self.repository.insert_case_message(user_message)

        chat_response = self.chat_service.chat_with_context(
            query=prompt,
            session_id=case_id,
            vision_analysis=vision_analysis,
            case_history=history,
        )
        assistant_message = CaseMessage(
            id=f"msg-{uuid.uuid4()}",
            case_id=case_id,
            role="assistant",
            content=chat_response.get("answer", ""),
            answer=chat_response.get("answer", ""),
            sections=chat_response.get("sections", {}),
            sources=chat_response.get("sources", []),
            retrieval_trace=chat_response.get("retrieval_trace", {}),
            created_at=created_at,
        )
        self.repository.insert_case_message(assistant_message)
        self.repository.update_case(
            case_id,
            updated_at=created_at,
            risk_level=self._max_risk_level(case_detail.risk_level, chat_response.get("risk_level", case_detail.risk_level)),
            status=self._merge_status(case_detail.status, chat_response.get("risk_level", case_detail.risk_level)),
        )
        return self.get_case_detail(case_id)

    def update_case(self, *, case_id: str, title: str | None = None, status: str | None = None) -> dict[str, Any]:
        self._assert_case_workflow_enabled()
        changes: dict[str, str] = {"updated_at": self._now()}
        if title is not None and title.strip():
            changes["title"] = title.strip()
        if status is not None:
            normalized_status = status.strip()
            if normalized_status not in ALLOWED_CASE_STATUSES:
                raise ValueError("不支持的案例状态。")
            changes["status"] = normalized_status
        self.repository.update_case(case_id, **changes)
        return self.get_case_detail(case_id)

    def update_plan_item(self, *, case_id: str, item_id: str, status: str) -> dict[str, Any]:
        self._assert_case_workflow_enabled()
        normalized_status = status.strip()
        if normalized_status not in ALLOWED_PLAN_STATUSES:
            raise ValueError("不支持的计划状态。")
        self.repository.update_plan_item_status(case_id, item_id, normalized_status)
        self.repository.update_case(case_id, updated_at=self._now())
        return self.get_case_detail(case_id)

    def add_feedback(
        self,
        *,
        case_id: str,
        message_id: str,
        helpful: bool,
        resolved: bool,
        needs_repair: bool,
        unclear_step: str,
        note: str,
    ) -> dict[str, Any]:
        self._assert_case_workflow_enabled()
        feedback = CaseFeedback(
            id=f"feedback-{uuid.uuid4()}",
            case_id=case_id,
            message_id=message_id,
            helpful=helpful,
            resolved=resolved,
            needs_repair=needs_repair,
            unclear_step=unclear_step.strip(),
            note=note.strip(),
            created_at=self._now(),
        )
        self.repository.insert_feedback(feedback)

        next_status = None
        if needs_repair:
            next_status = "send_repair"
        elif resolved:
            next_status = "closed"
        elif helpful:
            next_status = "monitoring"

        changes = {"updated_at": self._now()}
        if next_status:
            changes["status"] = next_status
        self.repository.update_case(case_id, **changes)
        return self.get_case_detail(case_id)

    def build_runtime_metrics(self) -> dict[str, Any]:
        return self.repository.build_runtime_metrics()

    def analyze_vision_case(self, *, description: str, image_paths: list[Path]) -> VisionAnalysis:
        analysis = self.vision_service.analyze(
            case_id=f"vision-eval-{uuid.uuid4()}",
            description=description,
            image_paths=image_paths,
        )
        analysis.created_at = self._now()
        return analysis

    def _save_images(
        self,
        case_dir: Path,
        case_id: str,
        image_files: Iterable[FileStorage],
        created_at: str,
    ) -> list[CaseImage]:
        case_dir.mkdir(parents=True, exist_ok=True)
        saved: list[CaseImage] = []

        for index, image in enumerate(image_files, start=1):
            original_name = secure_filename(image.filename or f"case-image-{index}.png") or f"case-image-{index}.png"
            suffix = Path(original_name).suffix.lower() or ".png"
            basename = slugify(Path(original_name).stem) or f"image-{index}"
            relative_path = Path("cases") / case_id / f"{index:02d}-{basename}{suffix}"
            target_path = self.config.runtime_upload_root / relative_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(target_path)

            saved.append(
                CaseImage(
                    id=f"image-{uuid.uuid4()}",
                    case_id=case_id,
                    file_path=relative_path.as_posix(),
                    url_path=f"/api/runtime/uploads/{relative_path.as_posix()}",
                    mime_type=image.mimetype or "image/png",
                    original_name=original_name,
                    created_at=created_at,
                )
            )

        return saved

    def _validate_image_files(self, image_files: list[FileStorage]) -> list[FileStorage]:
        files = [file for file in image_files if file and (file.filename or "").strip()]
        if len(files) > 3:
            raise ValueError("单次最多上传 3 张图片。")

        validated: list[FileStorage] = []
        for file in files:
            filename = file.filename or ""
            suffix = Path(filename).suffix.lower()
            if suffix not in ALLOWED_IMAGE_EXTENSIONS:
                raise ValueError("仅支持 JPG、PNG、WEBP 图片。")
            if file.mimetype and not file.mimetype.startswith("image/"):
                raise ValueError("仅支持图片类型上传。")
            validated.append(file)
        return validated

    def _build_case_title(self, description: str, analysis: VisionAnalysis) -> str:
        if analysis.materials or analysis.damage_types:
            parts = []
            if analysis.materials:
                parts.append(analysis.materials[0])
            if analysis.damage_types:
                parts.append(analysis.damage_types[0])
            if parts:
                return "".join(parts) + "护理案例"
        if description:
            return excerpt_text(description, limit=16) or "皮具护理案例"
        return "皮具护理案例"

    def _build_message_pair(
        self,
        *,
        case_id: str,
        prompt: str,
        chat_response: dict[str, Any],
        created_at: str,
    ) -> tuple[CaseMessage, CaseMessage]:
        user_message = CaseMessage(
            id=f"msg-{uuid.uuid4()}",
            case_id=case_id,
            role="user",
            content=prompt,
            created_at=created_at,
        )
        assistant_message = CaseMessage(
            id=f"msg-{uuid.uuid4()}",
            case_id=case_id,
            role="assistant",
            content=chat_response.get("answer", ""),
            answer=chat_response.get("answer", ""),
            sections=chat_response.get("sections", {}),
            sources=chat_response.get("sources", []),
            retrieval_trace=chat_response.get("retrieval_trace", {}),
            created_at=created_at,
        )
        return user_message, assistant_message

    def _assert_case_workflow_enabled(self) -> None:
        if not self.config.case_workflow_enabled:
            raise RuntimeError(self.config.case_workflow_reason)

    def _derive_case_status(self, risk_level: str) -> str:
        return "send_repair" if risk_level == "high" else "in_progress"

    def _merge_status(self, current_status: str, risk_level: str) -> str:
        if current_status == "closed":
            return current_status
        return "send_repair" if risk_level == "high" else current_status or "in_progress"

    def _max_risk_level(self, current: str, incoming: str) -> str:
        order = {"low": 1, "medium": 2, "high": 3}
        return incoming if order.get(incoming, 0) >= order.get(current, 0) else current

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()
