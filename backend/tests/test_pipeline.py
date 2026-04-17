import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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


def test_backend_routes_support_local_and_vercel_service_prefixes() -> None:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    KnowledgePipeline(config).ingest(sync_cloud=False)
    client = create_app(config).test_client()

    for path in ("/health", "/api/health", "/sources", "/api/sources"):
        response = client.get(path)
        assert response.status_code == 200

    for path in ("/chat", "/api/chat"):
        response = client.post(path, json={"query": "植鞣革手柄发黑了怎么清理？", "session_id": "route-test"})
        assert response.status_code == 200
