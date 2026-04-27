import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chat_service import LeatherChatService
from app.config import AppConfig
from app.server import create_app
from app.types import VisionAnalysis


PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00"
    b"\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
)


def build_config(tmp_path: Path) -> AppConfig:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    config.dashscope_api_key = "test-key"
    config.bailian_app_id = "app-test"
    config.dashscope_vision_model = "qwen-vl-test"
    config.runtime_root = tmp_path / "runtime"
    return config


def mock_chat_with_context(self: LeatherChatService, query: str, **_: object) -> dict:
    return {
        "session_id": "case-session",
        "rewritten_query": query,
        "risk_level": "medium",
        "answer": (
            "### 适用判断\n适合先做小范围测试。\n\n"
            "### 所需工具\n软布、麂皮刷。\n\n"
            "### 操作步骤\n1. 先做局部测试。\n2. 再顺着纹理轻柔处理。\n\n"
            "### 注意事项\n避免强力摩擦和大面积湿擦。\n\n"
            "### 何时送修\n若色差扩大或结构松动，应尽快送修。\n\n"
            "### 参考来源\n- 引用 1 · 测试资料"
        ),
        "sections": {
            "适用判断": "适合先做小范围测试。",
            "所需工具": "软布、麂皮刷。",
            "操作步骤": "1. 先做局部测试。\n2. 再顺着纹理轻柔处理。",
            "注意事项": "避免强力摩擦和大面积湿擦。",
            "何时送修": "若色差扩大或结构松动，应尽快送修。",
            "参考来源": "- 引用 1 · 测试资料",
        },
        "sources": [
            {
                "title": "测试资料",
                "source_type": "bailian_reference",
                "source_path": "knowledge/raw/test.md",
                "score": 0.98,
                "preview": "先做局部测试。",
                "content": "先做局部测试，再决定是否继续。",
                "excerpt": "先做局部测试。",
                "citation_label": "引用 1",
                "hit_type": "reference",
            }
        ],
        "latency_ms": 12.3,
        "retrieval_trace": {
            "analysis": {
                "materials": ["翻毛皮"],
                "damage_types": ["油渍"],
                "risk_level": "medium",
                "notes": "已识别材质：翻毛皮；已识别问题：油渍",
            },
            "source_count": 1,
            "source_hint": "已返回引用。",
        },
        "debug": False,
    }


def mock_vision_analyze(*_: object, case_id: str, description: str, image_paths: list[Path], **__: object) -> VisionAnalysis:
    return VisionAnalysis(
        id="vision-test",
        case_id=case_id,
        materials=["翻毛皮"],
        damage_types=["油渍"],
        affected_parts=["鞋头"],
        photo_quality="usable",
        risk_level="medium",
        missing_views=["侧面近景"],
        summary=f"已根据 {len(image_paths)} 张图片识别为翻毛皮鞋头油渍。",
        created_at="2026-04-22T00:00:00+00:00",
    )


def test_case_workflow_routes_support_create_followup_plan_and_feedback(tmp_path: Path, monkeypatch) -> None:
    config = build_config(tmp_path)
    monkeypatch.setattr("app.case_service.LeatherChatService.chat_with_context", mock_chat_with_context)
    monkeypatch.setattr("app.case_service.VisionService.analyze", mock_vision_analyze)

    client = create_app(config).test_client()

    response = client.post(
        "/api/cases",
        data={
            "title": "翻毛皮油渍案例",
            "description": "翻毛皮鞋头蹭到油渍，想判断还能不能自己处理。",
            "images": [(io.BytesIO(PNG_BYTES), "shoe.png")],
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["title"] == "翻毛皮油渍案例"
    assert payload["vision_analysis"]["materials"] == ["翻毛皮"]
    assert len(payload["messages"]) == 2
    assert payload["care_plan"]

    case_id = payload["id"]
    first_plan_id = payload["care_plan"][0]["id"]
    first_message_id = payload["messages"][-1]["id"]

    message_response = client.post(
        f"/api/cases/{case_id}/messages",
        json={"content": "如果已经先用纸巾吸过油，还需要继续处理吗？"},
    )
    assert message_response.status_code == 200
    message_payload = message_response.get_json()
    assert len(message_payload["messages"]) == 4

    plan_response = client.patch(
        f"/api/cases/{case_id}/plan-items/{first_plan_id}",
        json={"status": "completed"},
    )
    assert plan_response.status_code == 200
    assert plan_response.get_json()["care_plan"][0]["status"] == "completed"

    feedback_response = client.post(
        f"/api/cases/{case_id}/feedback",
        json={
            "message_id": first_message_id,
            "helpful": True,
            "resolved": False,
            "needs_repair": False,
            "note": "局部测试后没有继续扩大。",
        },
    )
    assert feedback_response.status_code == 200
    feedback_payload = feedback_response.get_json()
    assert feedback_payload["feedback_summary"]["count"] == 1
    assert feedback_payload["status"] == "monitoring"

    cases_response = client.get("/api/cases")
    assert cases_response.status_code == 200
    assert cases_response.get_json()["cases"][0]["title"] == "翻毛皮油渍案例"

    knowledge_response = client.get("/api/knowledge/summary")
    assert knowledge_response.status_code == 200
    knowledge_payload = knowledge_response.get_json()
    assert knowledge_payload["runtime_stats"]["total_case_count"] >= 1


def test_case_routes_reject_create_when_case_workflow_disabled(tmp_path: Path, monkeypatch) -> None:
    config = build_config(tmp_path)
    original_vercel_env = os.environ.get("VERCEL_ENV")
    os.environ["VERCEL_ENV"] = "production"
    try:
        client = create_app(config).test_client()
        response = client.post(
            "/api/cases",
            data={
                "description": "测试云端只读模式",
                "images": [(io.BytesIO(PNG_BYTES), "readonly.png")],
            },
            content_type="multipart/form-data",
        )
    finally:
        if original_vercel_env is None:
            os.environ.pop("VERCEL_ENV", None)
        else:
            os.environ["VERCEL_ENV"] = original_vercel_env

    assert response.status_code == 409
    assert "本地演示环境" in response.get_json()["error"]
