import os
import sys
from http import HTTPStatus
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.bailian_application as bailian_module
from app.config import AppConfig
from app.knowledge_pipeline import KnowledgePipeline
from app.server import create_app
from app.utils import build_step_markdown, clean_runtime_markdown, read_jsonl


def test_clean_runtime_markdown_removes_frontmatter_noise() -> None:
    raw = """# 五金、边油与肩带边缘维护

- source_path: knowledge/raw/03-hardware-edge-paint.md
- material: 五金
- damage_type: 发黑污渍, 边油开裂
- risk_level: medium

# 五金、边油与肩带边缘维护

拉链不顺滑时，应先确认是否有灰尘堆积。
"""

    cleaned = clean_runtime_markdown(raw)
    assert "source_path" not in cleaned
    assert "damage_type" not in cleaned
    assert cleaned.count("# 五金、边油与肩带边缘维护") == 1


def test_build_step_markdown_returns_numbered_steps() -> None:
    raw = """# 五金、边油与肩带边缘维护

## 五金拉链

拉链不顺滑时，应先确认是否有灰尘、纤维或氧化层堆积。可先做皮面保护，再用金属抛光产品轻拭拉头或齿位。

## 边油维护

边油修补通常遵循打磨、打底、薄涂、多层、自然干燥的流程。每一层都要彻底干透后再继续。

## 风险提示

若肩带已经出现真皮层开裂，应交由专业门店处理。
"""

    steps = build_step_markdown(raw)
    assert steps.startswith("1. ")
    assert "2. " in steps
    assert "风险提示" not in steps


def test_pipeline_generates_manifests() -> None:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    pipeline = KnowledgePipeline(config)
    report = pipeline.ingest(sync_cloud=False)
    assert report["chunk_count"] >= 1
    assert config.chunk_manifest_path.exists()
    assert config.faq_manifest_path.exists()

    chunk_items = read_jsonl(config.chunk_manifest_path)
    faq_items = read_jsonl(config.faq_manifest_path)
    assert chunk_items
    assert faq_items
    assert "source_path:" not in chunk_items[0]["content"]
    assert "damage_type:" not in chunk_items[0]["content"]
    generated_faq = next(item for item in faq_items if item["source_id"] != "seed-faq")
    assert "### 操作步骤" in generated_faq["answer"]
    assert "source_path:" not in generated_faq["answer"]


def test_app_config_falls_back_to_service_local_knowledge_manifests(tmp_path: Path, monkeypatch) -> None:
    backend_root = tmp_path / "backend"
    (backend_root / "app").mkdir(parents=True)

    manifest_dir = backend_root / "knowledge" / "generated" / "manifests"
    manifest_dir.mkdir(parents=True)
    (manifest_dir / "chunks.jsonl").write_text("{}\n", encoding="utf-8")
    (manifest_dir / "faq.jsonl").write_text("{}\n", encoding="utf-8")
    (manifest_dir / "eval.jsonl").write_text("{}\n", encoding="utf-8")
    (manifest_dir / "ingest-report.json").write_text("{}", encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    config = AppConfig.load(backend_root)

    assert config.manifest_dir == manifest_dir
    assert config.ingest_artifacts_ready is True


def test_backend_routes_support_local_and_vercel_service_prefixes() -> None:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    KnowledgePipeline(config).ingest(sync_cloud=False)
    config.dashscope_api_key = "test-key"
    config.bailian_app_id = "app-test"

    class MockPayload:
        def __init__(self, **kwargs) -> None:
            self.__dict__.update(kwargs)

    class MockApplication:
        @staticmethod
        def call(**_: object) -> MockPayload:
            return MockPayload(
                status_code=HTTPStatus.OK,
                output=MockPayload(
                    text=(
                        "### 适用判断\n适合先做局部测试。\n\n"
                        "### 所需工具\n软布、麂皮刷。\n\n"
                        "### 操作步骤\n1. 先吸附浮油。\n2. 再用专用清洁剂轻刷。\n\n"
                        "### 注意事项\n避免大面积浸湿。\n\n"
                        "### 何时送修\n若油圈扩大请送修。"
                    ),
                    session_id="route-test",
                    doc_references=[
                        MockPayload(
                            title="翻毛皮油渍处理",
                            doc_id="doc-1",
                            doc_name="20-suede-watermark-oil-routing.md",
                            doc_url="https://example.com/doc-1",
                            text="翻毛皮遇到油渍时，应先吸附表面油分。",
                            page_number=[2],
                            index_id="kb-1",
                        )
                    ],
                    thoughts=[
                        MockPayload(
                            observation=[
                                {
                                    "doc_name": "20-suede-watermark-oil-routing.md",
                                    "title": "翻毛皮油渍处理",
                                    "text": "先用纸巾吸附油分，再用麂皮刷顺毛轻刷。",
                                    "score": 0.93,
                                    "doc_url": "https://example.com/doc-1",
                                }
                            ]
                        )
                    ],
                ),
            )

    original_application = bailian_module.Application
    bailian_module.Application = MockApplication
    client = create_app(config).test_client()
    try:
        for path in ("/health", "/api/health", "/sources", "/api/sources"):
            response = client.get(path)
            assert response.status_code == 200

        for path in ("/chat", "/api/chat"):
            response = client.post(path, json={"query": "翻毛皮蹭到油渍还能自己处理吗？", "session_id": "route-test"})
            assert response.status_code == 200
            payload = response.get_json()
            assert payload["session_id"] == "route-test"
            assert payload["sources"]
            assert payload["sources"][0]["citation_label"] == "引用 1"
            assert payload["sources"][0]["retrieval_chunks"]

        for path in ("/eval/run", "/api/eval/run"):
            response = client.post(path, json={})
            assert response.status_code == 200
            payload = response.get_json()
            assert payload["mode"] == "live"
            assert payload["live_run_enabled"] is True
            assert payload["case_count"] >= 1
            assert payload["cases"][0]["status"] == "completed"
    finally:
        bailian_module.Application = original_application


def test_backend_knowledge_summary_and_cloud_eval_preview() -> None:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    KnowledgePipeline(config).ingest(sync_cloud=False)

    original_vercel_env = os.environ.get("VERCEL_ENV")
    os.environ["VERCEL_ENV"] = "production"
    try:
        client = create_app(config).test_client()

        response = client.get("/api/knowledge/summary")
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["source_count"] >= 1
        assert payload["chunk_count"] >= 1
        assert payload["documents"]
        assert payload["faq_examples"]
        assert payload["eval_cases"]

        eval_response = client.post("/api/eval/run", json={})
        assert eval_response.status_code == 200
        report = eval_response.get_json()
        assert report["mode"] == "preview"
        assert report["live_run_enabled"] is False
        assert report["average_score"] is None
        assert report["cases"][0]["status"] == "preview"
    finally:
        if original_vercel_env is None:
            os.environ.pop("VERCEL_ENV", None)
        else:
            os.environ["VERCEL_ENV"] = original_vercel_env
