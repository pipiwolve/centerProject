import sys
from http import HTTPStatus
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.bailian_application as bailian_module
from app.bailian_application import BailianApplicationService
from app.config import AppConfig
from app.server import create_app


class MockPayload:
    def __init__(self, **kwargs) -> None:
        self.__dict__.update(kwargs)


def build_config() -> AppConfig:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    config.dashscope_api_key = "test-key"
    config.bailian_app_id = "app-test"
    return config


def test_bailian_application_parses_references_and_recall_chunks() -> None:
    config = build_config()
    service = BailianApplicationService(config)

    class MockApplication:
        @staticmethod
        def call(**_: object) -> MockPayload:
            return MockPayload(
                status_code=HTTPStatus.OK,
                output=MockPayload(
                    text="翻毛皮油渍可以先做局部测试，再顺毛轻刷。",
                    session_id="session-1",
                    doc_references=[
                        MockPayload(
                            title="翻毛皮油渍处理",
                            doc_id="doc-1",
                            doc_name="20-suede-watermark-oil-routing.md",
                            doc_url="https://example.com/doc-1",
                            text="先吸附表面油分，避免来回擦拭。",
                            page_number=[2, 3],
                            index_id="kb-1",
                        )
                    ],
                    thoughts=[
                        MockPayload(
                            observation=[
                                {
                                    "doc_name": "20-suede-watermark-oil-routing.md",
                                    "title": "翻毛皮油渍处理",
                                    "text": "使用纸巾吸附油分，再用麂皮刷顺毛轻刷。",
                                    "score": 0.91,
                                    "doc_url": "https://example.com/doc-1",
                                },
                                {
                                    "doc_name": "31-low-risk-tools-matrix.md",
                                    "title": "低风险工具矩阵",
                                    "text": "翻毛皮优先使用麂皮刷和吸附纸，不建议直接上水。",
                                    "score": 0.86,
                                    "doc_url": "https://example.com/doc-2",
                                },
                            ]
                        )
                    ],
                ),
            )

    original_application = bailian_module.Application
    bailian_module.Application = MockApplication
    try:
        result = service.call("翻毛皮蹭到油渍还能自己处理吗？", "session-1")
    finally:
        bailian_module.Application = original_application

    assert result.text.startswith("翻毛皮油渍可以先做局部测试")
    assert len(result.sources) == 2

    reference = result.sources[0]
    assert reference["source_type"] == "bailian_reference"
    assert reference["citation_label"] == "引用 1"
    assert reference["source_uri"] == "https://example.com/doc-1"
    assert reference["page_numbers"] == [2, 3]
    assert reference["retrieval_chunks"] == ["使用纸巾吸附油分，再用麂皮刷顺毛轻刷。"]

    chunk = result.sources[1]
    assert chunk["source_type"] == "bailian_chunk"
    assert chunk["hit_type"] == "chunk"
    assert "低风险工具矩阵" in chunk["title"]


def test_chat_route_returns_friendly_error_when_app_id_missing() -> None:
    config = build_config()
    config.bailian_app_id = ""
    client = create_app(config).test_client()

    response = client.post("/api/chat", json={"query": "翻毛皮蹭到油渍还能自己处理吗？"})

    assert response.status_code == 500
    payload = response.get_json()
    assert payload["error"] == "问答生成失败，请检查 DashScope 配置或稍后重试。"
    assert "BAILIAN_APP_ID" in payload["detail"]


def test_cloud_mode_routes_return_summary_and_disabled_ingest() -> None:
    config = build_config()
    client = create_app(config).test_client()

    health = client.get("/api/health")
    assert health.status_code == 200
    health_payload = health.get_json()
    assert health_payload["retrieval_mode"] == "bailian_app"
    assert health_payload["source_backend"] == "bailian"
    assert health_payload["bailian_app_id"] == "app-test"

    summary = client.get("/api/sources")
    assert summary.status_code == 200
    summary_payload = summary.get_json()
    assert summary_payload["retrieval_mode"] == "bailian_app"
    assert summary_payload["report"]["mode_label"] == "百炼应用直连"

    ingest_run = client.post("/api/ingest/run")
    assert ingest_run.status_code == 409
    assert "百炼应用直连" in ingest_run.get_json()["error"]

    ingest_status = client.get("/api/ingest/status")
    assert ingest_status.status_code == 409
    assert "不再返回本地 manifests 状态" in ingest_status.get_json()["error"]
