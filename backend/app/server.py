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
from .retriever import LocalKnowledgeIndex


def create_app(config: AppConfig | None = None) -> Flask:
    app_config = config or AppConfig.load()
    app = Flask(__name__)
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:3000", "http://localhost:3000", "*"]}},
    )

    index = LocalKnowledgeIndex(app_config)
    pipeline = KnowledgePipeline(app_config)
    chat_service = LeatherChatService(app_config, index)
    eval_service = EvalService(app_config, chat_service)

    def json_error(message: str, status_code: int = 500, exc: Exception | None = None) -> tuple[Any, int]:
        payload: dict[str, Any] = {"error": message}
        if exc is not None and not app_config.read_only_runtime:
            payload["detail"] = str(exc)
        return jsonify(payload), status_code

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
                "retrieval_mode": "local_langchain",
                "target_docs_kb_id": app_config.docs_kb_id,
                "target_faq_kb_id": app_config.faq_kb_id,
                "deployment_target": app_config.deployment_target,
                "read_only_runtime": app_config.read_only_runtime,
                "ingest_enabled": app_config.ingest_enabled,
                "ingest_artifacts_ready": app_config.ingest_artifacts_ready,
            }
        )

    @app.get("/sources")
    @app.get("/api/sources")
    def sources() -> Any:
        summary = index.sources_summary()
        return jsonify(summary)

    @app.post("/ingest/run")
    @app.post("/api/ingest/run")
    def ingest_run() -> Any:
        if not app_config.ingest_enabled:
            return json_error(
                "当前 Vercel 运行时为只读模式，请先在本地执行 ./scripts/ingest.sh 并提交 knowledge/generated/manifests 后再重新部署。",
                status_code=409,
            )
        payload = request.get_json(silent=True) or {}
        sync_cloud = bool(payload.get("sync_cloud", False))
        try:
            report = pipeline.ingest(sync_cloud=sync_cloud)
        except Exception as exc:
            return json_error("重新 ingest 失败，请检查资料格式或后端日志。", exc=exc)
        return jsonify(report)

    @app.get("/ingest/status")
    @app.get("/api/ingest/status")
    def ingest_status() -> Any:
        summary = index.sources_summary()
        return jsonify(summary.get("report", {}))

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
    index = LocalKnowledgeIndex(config)
    chat_service = LeatherChatService(config, index)
    eval_service = EvalService(config, chat_service)

    if args.command == "ingest":
        report = pipeline.ingest(sync_cloud=args.sync_cloud)
        print(report)
        return
    if args.command == "eval":
        print(eval_service.run())
        return
    app.run(host=config.backend_host, port=config.backend_port, debug=False)
