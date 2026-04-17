from __future__ import annotations

import argparse
import uuid
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

from .chat_service import LeatherChatService
from .config import AppConfig
from .eval_service import EvalService
from .knowledge_pipeline import KnowledgePipeline
from .utils import read_json


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
