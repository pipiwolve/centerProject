from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .chat_service import LeatherChatService
from .config import AppConfig
from .utils import read_jsonl


class EvalService:
    def __init__(self, config: AppConfig, chat_service: LeatherChatService) -> None:
        self.config = config
        self.chat_service = chat_service

    def run(self) -> dict[str, Any]:
        cases = read_jsonl(self.config.eval_manifest_path)
        results = []
        total_score = 0.0
        for case in cases:
            response = self.chat_service.chat(case["question"], debug=False)
            score = self._score_case(response["answer"], response["sections"], case.get("expected_keywords", []), response["sources"])
            total_score += score["overall"]
            results.append(
                {
                    "case_id": case["case_id"],
                    "question": case["question"],
                    "title": case["title"],
                    "expected_keywords": case.get("expected_keywords", []),
                    "score": score,
                    "latency_ms": response["latency_ms"],
                    "rewritten_query": response["rewritten_query"],
                    "sources": response["sources"],
                }
            )

        average = round(total_score / len(results), 2) if results else 0.0
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "case_count": len(results),
            "average_score": average,
            "cases": results,
        }

    def _score_case(
        self,
        answer: str,
        sections: dict[str, str],
        expected_keywords: list[str],
        sources: list[dict[str, Any]],
    ) -> dict[str, float]:
        lower_answer = answer.lower()
        keyword_hits = sum(1 for keyword in expected_keywords if keyword.lower() in lower_answer)
        keyword_score = round(min(5.0, keyword_hits / max(len(expected_keywords), 1) * 5), 2)
        structure_score = round(min(5.0, sum(1 for section in sections.values() if section.strip()) / 6 * 5), 2)
        source_score = 5.0 if sources else 1.0
        safety_score = 5.0 if any(token in answer for token in ["注意", "送修", "停止"]) else 2.5
        operability_score = 5.0 if any(token in answer for token in ["步骤", "工具", "先"]) else 2.5
        overall = round((keyword_score + structure_score + source_score + safety_score + operability_score) / 5, 2)
        return {
            "relevance": keyword_score,
            "completeness": structure_score,
            "sources": source_score,
            "safety": safety_score,
            "operability": operability_score,
            "overall": overall,
        }
