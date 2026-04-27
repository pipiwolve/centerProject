from __future__ import annotations

import json
import re
import uuid
from http import HTTPStatus
from pathlib import Path
from typing import Any

from .config import AppConfig
from .types import VisionAnalysis

try:  # pragma: no cover - optional third-party import
    from dashscope import MultiModalConversation
except Exception:  # pragma: no cover
    MultiModalConversation = None


JSON_BLOCK_RE = re.compile(r"\{.*\}", re.S)


class VisionService:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def analyze(self, *, case_id: str, description: str, image_paths: list[Path]) -> VisionAnalysis:
        if MultiModalConversation is None:
            raise RuntimeError("dashscope SDK 未正确安装，无法调用图片诊断。")
        if not self.config.dashscope_api_key:
            raise RuntimeError("缺少 DASHSCOPE_API_KEY，当前无法调用图片诊断。")
        if not self.config.dashscope_vision_model:
            raise RuntimeError("缺少 DASHSCOPE_VISION_MODEL，当前无法调用图片诊断。")
        if not image_paths:
            raise RuntimeError("图片诊断至少需要 1 张图片。")

        messages = self._build_messages(description=description, image_paths=image_paths)
        response = MultiModalConversation.call(
            model=self.config.dashscope_vision_model,
            messages=messages,
            api_key=self.config.dashscope_api_key,
            workspace=self.config.workspace_id or None,
        )

        if getattr(response, "status_code", None) != HTTPStatus.OK:
            code = getattr(response, "code", "") or "unknown_error"
            message = getattr(response, "message", "") or "图片诊断调用失败。"
            raise RuntimeError(f"{code}: {message}")

        payload = self._parse_payload(self._extract_text(response))
        return VisionAnalysis(
            id=f"vision-{uuid.uuid4()}",
            case_id=case_id,
            materials=self._normalize_list(payload.get("materials")),
            damage_types=self._normalize_list(payload.get("damage_types")),
            affected_parts=self._normalize_list(payload.get("affected_parts")),
            photo_quality=self._normalize_photo_quality(payload.get("photo_quality")),
            risk_level=self._normalize_risk_level(payload.get("risk_level")),
            missing_views=self._normalize_list(payload.get("missing_views")),
            summary=str(payload.get("summary") or "已完成图片初判，请结合文本建议继续确认材质与风险。").strip(),
        )

    def _build_messages(self, *, description: str, image_paths: list[Path]) -> list[dict[str, Any]]:
        system_prompt = (
            "你是皮具护理场景的图像诊断助手。"
            "请根据用户上传的皮具图片和描述，输出一个 JSON 对象，不要输出 Markdown，不要附加解释。"
            "字段必须严格包含："
            'materials(string[]), damage_types(string[]), affected_parts(string[]), '
            'photo_quality("good"|"usable"|"insufficient"), '
            'risk_level("low"|"medium"|"high"), missing_views(string[]), summary(string)。'
            "如果无法确认，就返回保守推断并把缺失视角写入 missing_views。"
            "summary 用中文简明描述当前可见问题、风险边界和是否建议补拍。"
        )

        user_content: list[dict[str, Any]] = []
        for image_path in image_paths:
            user_content.append({"image": str(image_path)})
        user_content.append(
            {
                "text": (
                    "用户描述如下：\n"
                    f"{description or '未提供额外文字描述。'}\n\n"
                    "请仅返回 JSON。"
                )
            }
        )

        return [
            {"role": "system", "content": [{"text": system_prompt}]},
            {"role": "user", "content": user_content},
        ]

    def _extract_text(self, response: Any) -> str:
        output = getattr(response, "output", None)
        if output is None:
            raise RuntimeError("图片诊断返回缺少 output 字段。")

        direct_text = getattr(output, "text", None)
        if isinstance(direct_text, str) and direct_text.strip():
            return direct_text.strip()

        choices = getattr(output, "choices", None) or []
        if choices:
            first_choice = choices[0]
            message = getattr(first_choice, "message", None) or (
                first_choice.get("message") if isinstance(first_choice, dict) else None
            )
            content = getattr(message, "content", None) or (message.get("content") if isinstance(message, dict) else None)
            if isinstance(content, str) and content.strip():
                return content.strip()
            if isinstance(content, list):
                chunks: list[str] = []
                for item in content:
                    if isinstance(item, dict) and item.get("text"):
                        chunks.append(str(item["text"]))
                    elif isinstance(item, str):
                        chunks.append(item)
                if chunks:
                    return "\n".join(chunks).strip()

        raise RuntimeError("图片诊断未返回可解析文本。")

    def _parse_payload(self, raw_text: str) -> dict[str, Any]:
        candidate = raw_text.strip()
        if candidate.startswith("```"):
            candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", candidate, flags=re.S).strip()

        try:
            payload = json.loads(candidate)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            pass

        match = JSON_BLOCK_RE.search(candidate)
        if match:
            try:
                payload = json.loads(match.group(0))
                if isinstance(payload, dict):
                    return payload
            except json.JSONDecodeError:
                pass

        raise RuntimeError("图片诊断结果不是有效 JSON，请检查视觉模型输出。")

    def _normalize_list(self, value: Any) -> list[str]:
        if isinstance(value, list):
            result = [str(item).strip() for item in value if str(item).strip()]
        elif isinstance(value, str) and value.strip():
            result = [item.strip() for item in re.split(r"[，,、/]", value) if item.strip()]
        else:
            result = []

        seen: set[str] = set()
        normalized: list[str] = []
        for item in result:
            if item in seen:
                continue
            seen.add(item)
            normalized.append(item)
        return normalized[:8]

    def _normalize_photo_quality(self, value: Any) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"good", "usable", "insufficient"}:
            return normalized
        if "清晰" in normalized or "完整" in normalized:
            return "good"
        if "一般" in normalized or "可用" in normalized:
            return "usable"
        return "insufficient"

    def _normalize_risk_level(self, value: Any) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"low", "medium", "high"}:
            return normalized
        if any(token in normalized for token in ["高", "严重", "送修"]):
            return "high"
        if any(token in normalized for token in ["中", "谨慎"]):
            return "medium"
        return "low"
