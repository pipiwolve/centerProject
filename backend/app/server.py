from __future__ import annotations

import argparse
import uuid
from collections import Counter
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

from .chat_service import LeatherChatService
from .config import AppConfig
from .eval_service import EvalService
from .knowledge_pipeline import KnowledgePipeline
from .utils import excerpt_text, read_json, read_jsonl


def create_app(config: AppConfig | None = None) -> Flask:
    app_config = config or AppConfig.load()
    app = Flask(__name__)
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:3000", "http://localhost:3000", "*"]}},
    )

    chat_service = LeatherChatService(app_config)
    eval_service = EvalService(app_config, chat_service)

    def json_error(message: str, status_code: int = 500, exc: Exception | None = None) -> tuple[Any, int]:
        payload: dict[str, Any] = {"error": message}
        if exc is not None and not app_config.read_only_runtime:
            payload["detail"] = str(exc)
        return jsonify(payload), status_code

    def build_cloud_summary() -> dict[str, Any]:
        sync_report = read_json(app_config.sync_report_path, {})
        return {
            "retrieval_mode": "bailian_app",
            "source_backend": "bailian",
            "bailian_app_id": app_config.bailian_app_id,
            "target_docs_kb_id": app_config.docs_kb_id,
            "target_faq_kb_id": app_config.faq_kb_id,
            "deployment_target": app_config.deployment_target,
            "read_only_runtime": app_config.read_only_runtime,
            "app_configured": app_config.bailian_app_configured,
            "workspace_configured": bool(app_config.workspace_id),
            "cloud_model_enabled": bool(app_config.dashscope_api_key),
            "cloud_sync_enabled": app_config.enable_cloud_sync,
            "report": {
                "summary": "线上问答来源已切换为百炼应用真实命中结果，来源抽屉展示 doc_references 与召回切片。",
                "mode_label": "百炼应用直连",
                "source_backend": "bailian",
                "last_sync_status": sync_report.get("status", "idle"),
                "sync_detail": sync_report.get("detail", "当前未执行自动同步，知识库以百炼应用绑定结果为准。"),
                "disabled_operations": ["ingest_api"],
            },
        }

    def build_rag_summary() -> dict[str, Any]:
        ingest_report = read_json(app_config.ingest_report_path, {})
        chunk_items = read_jsonl(app_config.chunk_manifest_path)
        faq_items = read_jsonl(app_config.faq_manifest_path)
        eval_items = read_jsonl(app_config.eval_manifest_path)
        source_items = ingest_report.get("sources", []) if isinstance(ingest_report, dict) else []

        material_counter: Counter[str] = Counter()
        damage_counter: Counter[str] = Counter()
        document_cards: list[dict[str, Any]] = []
        high_risk_count = 0

        for source in source_items:
            metadata = source.get("metadata") or {}
            materials = [str(item) for item in metadata.get("materials", []) if item]
            damage_types = [str(item) for item in metadata.get("damage_types", []) if item]
            risk_level = str(metadata.get("risk_level") or "unknown")

            material_counter.update(materials)
            damage_counter.update(damage_types)
            if risk_level.lower() == "high" or "高" in risk_level:
                high_risk_count += 1

            if len(document_cards) >= 10:
                continue

            document_cards.append(
                {
                    "source_id": source.get("source_id", ""),
                    "title": source.get("title") or metadata.get("source_name") or "未命名资料",
                    "source_path": source.get("source_path", ""),
                    "materials": materials,
                    "damage_types": damage_types,
                    "risk_level": risk_level,
                    "excerpt": excerpt_text(
                        source.get("content", ""),
                        limit=200,
                        title=source.get("title"),
                        strip_title=True,
                    ),
                }
            )

        faq_examples = []
        for item in faq_items[:6]:
            metadata = item.get("metadata") or {}
            faq_examples.append(
                {
                    "faq_id": item.get("faq_id", ""),
                    "question": item.get("question", ""),
                    "title": item.get("title", ""),
                    "materials": [str(value) for value in metadata.get("materials", []) if value],
                    "damage_types": [str(value) for value in metadata.get("damage_types", []) if value],
                }
            )

        eval_cases = []
        for item in eval_items[:6]:
            eval_cases.append(
                {
                    "case_id": item.get("case_id", ""),
                    "question": item.get("question", ""),
                    "title": item.get("title", ""),
                    "expected_keywords": item.get("expected_keywords", []),
                }
            )

        top_materials = [{"name": name, "count": count} for name, count in material_counter.most_common(8)]
        top_damage_types = [{"name": name, "count": count} for name, count in damage_counter.most_common(8)]

        return {
            "generated_at": ingest_report.get("generated_at"),
            "source_count": ingest_report.get("source_count", len(source_items)),
            "chunk_count": ingest_report.get("chunk_count", len(chunk_items)),
            "faq_count": ingest_report.get("faq_count", len(faq_items)),
            "eval_count": ingest_report.get("eval_count", len(eval_items)),
            "material_count": len(material_counter),
            "damage_type_count": len(damage_counter),
            "high_risk_count": high_risk_count,
            "top_materials": top_materials,
            "top_damage_types": top_damage_types,
            "documents": document_cards,
            "faq_examples": faq_examples,
            "eval_cases": eval_cases,
        }

    @app.get("/health")
    @app.get("/api/health")
    def health() -> Any:
        return jsonify(
            {
                "status": "ok",
                "backend": "flask",
                "host": app_config.backend_host,
                "port": app_config.backend_port,
                "cloud_model_enabled": bool(app_config.dashscope_api_key),
                "cloud_sync_enabled": app_config.enable_cloud_sync,
                "retrieval_mode": "bailian_app",
                "source_backend": "bailian",
                "bailian_app_id": app_config.bailian_app_id,
                "target_docs_kb_id": app_config.docs_kb_id,
                "target_faq_kb_id": app_config.faq_kb_id,
                "deployment_target": app_config.deployment_target,
                "read_only_runtime": app_config.read_only_runtime,
                "ingest_enabled": app_config.ingest_enabled,
                "ingest_artifacts_ready": app_config.ingest_artifacts_ready,
                "bailian_app_configured": app_config.bailian_app_configured,
            }
        )

    @app.get("/sources")
    @app.get("/api/sources")
    def sources() -> Any:
        return jsonify(build_cloud_summary())

    @app.get("/knowledge/summary")
    @app.get("/api/knowledge/summary")
    def knowledge_summary() -> Any:
        return jsonify(build_rag_summary())

    @app.post("/ingest/run")
    @app.post("/api/ingest/run")
    def ingest_run() -> Any:
        return json_error(
            "线上运行已切换为百炼应用直连，/api/ingest/run 不再提供运行时重建。请使用本地脚本准备资料，并在百炼应用中维护知识库绑定。",
            status_code=409,
        )

    @app.get("/ingest/status")
    @app.get("/api/ingest/status")
    def ingest_status() -> Any:
        return json_error(
            "线上运行已切换为百炼应用直连，/api/ingest/status 不再返回本地 manifests 状态。",
            status_code=409,
        )

    @app.post("/chat")
    @app.post("/api/chat")
    def chat() -> Any:
        payload = request.get_json(silent=True) or {}
        query = (payload.get("query") or "").strip()
        if not query:
            return jsonify({"error": "query is required"}), 400
        session_id = payload.get("session_id") or str(uuid.uuid4())
        try:
            response = chat_service.chat(
                query=query,
                session_id=session_id,
                debug=bool(payload.get("debug", False)),
            )
        except Exception as exc:
            return json_error("问答生成失败，请检查 DashScope 配置或稍后重试。", exc=exc)
        return jsonify(response)

    @app.post("/eval/run")
    @app.post("/api/eval/run")
    def eval_run() -> Any:
        if app_config.read_only_runtime:
            cached_report = eval_service.load_cached_report()
            if cached_report is not None:
                return jsonify(cached_report)
            return jsonify(
                eval_service.build_preview_report(
                    "当前是云端只读运行时。为了避免批量调用 12 次问答接口导致超时或失效，这里改为展示离线评测集；如需重新跑分，请在本地执行 `python manage.py eval`。"
                )
            )
        try:
            return jsonify(eval_service.run())
        except Exception as exc:
            return json_error("评测运行失败，请确认知识库产物已生成。", exc=exc)

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Leather care RAG assistant backend")
    parser.add_argument("command", nargs="?", default="serve", choices=["serve", "ingest", "eval"])
    parser.add_argument("--sync-cloud", action="store_true", dest="sync_cloud")
    args = parser.parse_args()

    config = AppConfig.load()
    app = create_app(config)
    pipeline = KnowledgePipeline(config)
    chat_service = LeatherChatService(config)
    eval_service = EvalService(config, chat_service)

    if args.command == "ingest":
        report = pipeline.ingest(sync_cloud=args.sync_cloud)
        print(report)
        return
    if args.command == "eval":
        print(eval_service.run())
        return
    app.run(host=config.backend_host, port=config.backend_port, debug=False)
