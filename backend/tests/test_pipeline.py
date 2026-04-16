import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import AppConfig
from app.knowledge_pipeline import KnowledgePipeline


def test_pipeline_generates_manifests() -> None:
    config = AppConfig.load(Path(__file__).resolve().parents[1])
    pipeline = KnowledgePipeline(config)
    report = pipeline.ingest(sync_cloud=False)
    assert report["chunk_count"] >= 1
    assert config.chunk_manifest_path.exists()
    assert config.faq_manifest_path.exists()
