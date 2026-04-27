from __future__ import annotations

import re
import uuid
from typing import Any

from .types import CarePlanItem, VisionAnalysis


ORDERED_STEP_RE = re.compile(r"^\s*\d+[.)]\s+(.+)$", re.M)


class CarePlanBuilder:
    def build(
        self,
        *,
        case_id: str,
        vision_analysis: VisionAnalysis,
        chat_response: dict[str, Any],
    ) -> list[CarePlanItem]:
        sections = chat_response.get("sections", {})
        cautions = str(sections.get("注意事项") or "").strip()
        repair_boundary = str(sections.get("何时送修") or "").strip()
        materials = "、".join(vision_analysis.materials) or "当前皮具"
        damage_types = "、".join(vision_analysis.damage_types) or "可见问题"

        items: list[CarePlanItem] = []
        sort_order = 1

        if vision_analysis.photo_quality == "insufficient" or vision_analysis.missing_views:
            missing_views = "、".join(vision_analysis.missing_views) or "正面、局部近景、受损边缘"
            items.append(
                self._build_item(
                    case_id=case_id,
                    sort_order=sort_order,
                    step_type="capture",
                    title="先补拍关键视角",
                    instruction=f"当前图片不足以稳定判断，请补拍 {missing_views}，并保持自然光、近景清晰和问题部位完整入镜。",
                    caution="补拍前先不要继续重度处理，以免影响后续判断。",
                )
            )
            sort_order += 1

        items.append(
            self._build_item(
                case_id=case_id,
                sort_order=sort_order,
                step_type="prepare",
                title="先做适用判断与局部测试",
                instruction=(
                    f"基于当前初判，先把 {materials} 上的 {damage_types} 限定在可见范围内，"
                    "在不显眼处做一次局部测试，再决定是否继续整面处理。"
                ),
                caution=cautions or "避免一上来就大面积湿擦、上油或强力摩擦。",
            )
        )
        sort_order += 1

        raw_steps = self._extract_steps(str(sections.get("操作步骤") or ""))
        for raw_step in raw_steps[:3]:
            items.append(
                self._build_item(
                    case_id=case_id,
                    sort_order=sort_order,
                    step_type="care",
                    title=f"执行护理步骤 {sort_order - 1}",
                    instruction=raw_step,
                    caution=cautions,
                )
            )
            sort_order += 1

        items.append(
            self._build_item(
                case_id=case_id,
                sort_order=sort_order,
                step_type="observe",
                title="处理后静置观察",
                instruction="护理完成后先静置观察颜色、手感、边缘和五金变化，24 小时内不要叠加更多产品。",
                caution=cautions or "若出现发白、掉色扩散、发硬或异味加重，应立即停止。",
            )
        )
        sort_order += 1

        items.append(
            self._build_item(
                case_id=case_id,
                sort_order=sort_order,
                step_type="repair",
                title="确认是否需要送修",
                instruction=repair_boundary or "若出现结构损坏、反复霉变、明显掉色或处理后加重，应转为送修。",
                caution="一旦进入送修判断，不要继续反复试错。",
            )
        )

        return items

    def _extract_steps(self, content: str) -> list[str]:
        matches = [match.group(1).strip() for match in ORDERED_STEP_RE.finditer(content) if match.group(1).strip()]
        if matches:
            return matches

        sentences = [part.strip(" \n\t-。") for part in re.split(r"[。\n]", content) if part.strip()]
        return [sentence for sentence in sentences if len(sentence) >= 6][:3]

    def _build_item(
        self,
        *,
        case_id: str,
        sort_order: int,
        step_type: str,
        title: str,
        instruction: str,
        caution: str,
    ) -> CarePlanItem:
        return CarePlanItem(
            id=f"plan-{uuid.uuid4()}",
            case_id=case_id,
            step_type=step_type,
            title=title,
            instruction=instruction,
            caution=caution,
            status="pending",
            sort_order=sort_order,
        )
