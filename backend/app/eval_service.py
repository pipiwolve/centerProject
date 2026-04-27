from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .case_service import CaseService
from .chat_service import LeatherChatService
from .config import AppConfig
from .utils import read_json, read_jsonl


ALLOWED_SUITES = {"text", "vision", "all"}


class EvalService:
    def __init__(self, config: AppConfig, chat_service: LeatherChatService, case_service: CaseService | None = None) -> None:
        self.config = config
        self.chat_service = chat_service
        self.case_service = case_service

    def run(self, suite: str = "all") -> dict[str, Any]:
        selected_suite = suite if suite in ALLOWED_SUITES else "all"
        suite_reports: list[dict[str, Any]] = []

        if selected_suite in {"text", "all"}:
            suite_reports.append(self._run_text_suite())
        if selected_suite in {"vision", "all"}:
            suite_reports.append(self._run_vision_suite())

        return self._compose_report(
            selected_suite=selected_suite,
            suite_reports=suite_reports,
            mode="live",
            live_run_enabled=True,
        )

    def load_cached_report(self, suite: str = "all") -> dict[str, Any] | None:
        cached = read_json(self.config.eval_report_path, {})
        if not isinstance(cached, dict) or not cached:
            return None

        if cached.get("suites"):
            suites = cached.get("suites", [])
            if not isinstance(suites, list):
                return None
            selected_suite = suite if suite in ALLOWED_SUITES else cached.get("selected_suite", "all")
            filtered_suites = self._filter_suites(suites, selected_suite)
            return self._compose_report(
                selected_suite=selected_suite,
                suite_reports=filtered_suites,
                mode="preview",
                live_run_enabled=False,
                generated_at=cached.get("generated_at"),
                note_prefix=cached.get("note"),
            )

        cases = cached.get("cases")
        if not isinstance(cases, list):
            return None

        selected_suite = suite if suite in ALLOWED_SUITES else "text"
        text_suite = {
            "suite": "text",
            "label": "文本问答评测",
            "case_count": cached.get("case_count", len(cases)),
            "average_score": cached.get("average_score"),
            "note": cached.get("note") or "当前展示的是最近一次离线生成的评测快照。",
            "cases": cases,
        }
        suite_reports = [text_suite] if selected_suite in {"text", "all"} else []
        if selected_suite in {"vision", "all"}:
            suite_reports.append(
                self._build_vision_preview_suite("当前没有可复用的视觉评测快照，这里仅展示视觉评测集。")
            )
        return self._compose_report(
            selected_suite=selected_suite,
            suite_reports=suite_reports,
            mode="preview",
            live_run_enabled=False,
            generated_at=cached.get("generated_at"),
        )

    def build_preview_report(self, note: str, suite: str = "all") -> dict[str, Any]:
        selected_suite = suite if suite in ALLOWED_SUITES else "all"
        suite_reports: list[dict[str, Any]] = []
        if selected_suite in {"text", "all"}:
            suite_reports.append(
                self._build_text_preview_suite(
                    "当前是预览模式。为了避免批量调用文本问答接口导致超时，这里展示离线文本评测集。"
                )
            )
        if selected_suite in {"vision", "all"}:
            suite_reports.append(
                self._build_vision_preview_suite(
                    "当前是预览模式。为了避免在线调用视觉模型，这里展示图像诊断评测集。"
                )
            )

        return self._compose_report(
            selected_suite=selected_suite,
            suite_reports=suite_reports,
            mode="preview",
            live_run_enabled=False,
            note_prefix=note,
        )

    def _run_text_suite(self) -> dict[str, Any]:
        cases = read_jsonl(self.config.eval_manifest_path)
        results = []
        total_score = 0.0
        for case in cases:
            response = self.chat_service.chat(case["question"], debug=False)
            score = self._score_text_case(
                response["answer"],
                response["sections"],
                case.get("expected_keywords", []),
                response["sources"],
            )
            total_score += score["overall"]
            results.append(
                {
                    "suite": "text",
                    "case_id": case["case_id"],
                    "question": case["question"],
                    "title": case["title"],
                    "expected_keywords": case.get("expected_keywords", []),
                    "score": score,
                    "latency_ms": response["latency_ms"],
                    "rewritten_query": response["rewritten_query"],
                    "sources": response["sources"],
                    "status": "completed",
                }
            )

        average = round(total_score / len(results), 2) if results else None
        return {
            "suite": "text",
            "label": "文本问答评测",
            "case_count": len(results),
            "average_score": average,
            "note": "当前结果为实时文本评测，逐题调用的是当前问答服务。",
            "cases": results,
        }

    def _run_vision_suite(self) -> dict[str, Any]:
        if self.case_service is None:
            return self._build_vision_preview_suite("当前运行时未接入 CaseService，视觉评测改为展示评测集。")
        if not self.config.vision_model_configured:
            return self._build_vision_preview_suite("当前未配置视觉模型，视觉评测改为展示评测集。")

        cases = read_jsonl(self.config.vision_eval_manifest_path)
        results = []
        total_score = 0.0

        for case in cases:
            image_paths = [self.config.project_root / str(path) for path in case.get("image_paths", [])]
            analysis = self.case_service.analyze_vision_case(
                description=str(case.get("description") or case.get("question") or ""),
                image_paths=image_paths,
            )
            score = self._score_vision_case(
                analysis=analysis.to_dict(),
                expected_materials=case.get("expected_materials", []),
                expected_damage_types=case.get("expected_damage_types", []),
                expected_parts=case.get("expected_parts", []),
                expected_risk_level=str(case.get("expected_risk_level") or "low"),
            )
            total_score += score["overall"]
            results.append(
                {
                    "suite": "vision",
                    "case_id": case["case_id"],
                    "question": case.get("question") or case.get("description", ""),
                    "title": case.get("title", ""),
                    "expected_keywords": case.get("expected_damage_types", []),
                    "score": score,
                    "latency_ms": None,
                    "rewritten_query": analysis.summary,
                    "sources": [],
                    "status": "completed",
                    "vision_analysis": analysis.to_dict(),
                }
            )

        average = round(total_score / len(results), 2) if results else None
        return {
            "suite": "vision",
            "label": "图像诊断评测",
            "case_count": len(results),
            "average_score": average,
            "note": "当前结果为实时图像诊断评测，逐题调用的是视觉模型结构化初判。",
            "cases": results,
        }

    def _build_text_preview_suite(self, note: str) -> dict[str, Any]:
        cases = read_jsonl(self.config.eval_manifest_path)
        preview_cases = [
            {
                "suite": "text",
                "case_id": case["case_id"],
                "question": case["question"],
                "title": case["title"],
                "expected_keywords": case.get("expected_keywords", []),
                "score": None,
                "latency_ms": None,
                "rewritten_query": case["question"],
                "sources": [],
                "status": "preview",
            }
            for case in cases
        ]
        return {
            "suite": "text",
            "label": "文本问答评测",
            "case_count": len(preview_cases),
            "average_score": None,
            "note": note,
            "cases": preview_cases,
        }

    def _build_vision_preview_suite(self, note: str) -> dict[str, Any]:
        cases = read_jsonl(self.config.vision_eval_manifest_path)
        preview_cases = [
            {
                "suite": "vision",
                "case_id": case["case_id"],
                "question": case.get("question") or case.get("description", ""),
                "title": case.get("title", ""),
                "expected_keywords": case.get("expected_damage_types", []),
                "score": None,
                "latency_ms": None,
                "rewritten_query": case.get("description", ""),
                "sources": [],
                "status": "preview",
                "vision_analysis": None,
            }
            for case in cases
        ]
        return {
            "suite": "vision",
            "label": "图像诊断评测",
            "case_count": len(preview_cases),
            "average_score": None,
            "note": note,
            "cases": preview_cases,
        }

    def _compose_report(
        self,
        *,
        selected_suite: str,
        suite_reports: list[dict[str, Any]],
        mode: str,
        live_run_enabled: bool,
        generated_at: str | None = None,
        note_prefix: str | None = None,
    ) -> dict[str, Any]:
        filtered_suites = self._filter_suites(suite_reports, selected_suite)
        cases: list[dict[str, Any]] = []
        overall_scores: list[float] = []
        notes: list[str] = [note_prefix] if note_prefix else []

        for suite in filtered_suites:
            notes.append(str(suite.get("note") or ""))
            suite_cases = suite.get("cases", [])
            if isinstance(suite_cases, list):
                cases.extend(suite_cases)
            average_score = suite.get("average_score")
            if isinstance(average_score, (int, float)):
                overall_scores.append(float(average_score))

        deduped_notes = [note for note in dict.fromkeys(note for note in notes if note)]
        average_score = round(sum(overall_scores) / len(overall_scores), 2) if overall_scores else None
        return {
            "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
            "selected_suite": selected_suite,
            "case_count": len(cases),
            "average_score": average_score,
            "mode": mode,
            "live_run_enabled": live_run_enabled,
            "note": " ".join(deduped_notes).strip(),
            "cases": cases,
            "suites": filtered_suites,
        }

    def _filter_suites(self, suite_reports: list[dict[str, Any]], selected_suite: str) -> list[dict[str, Any]]:
        if selected_suite == "all":
            return suite_reports
        return [suite for suite in suite_reports if suite.get("suite") == selected_suite]

    def _score_text_case(
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

    def _score_vision_case(
        self,
        *,
        analysis: dict[str, Any],
        expected_materials: list[str],
        expected_damage_types: list[str],
        expected_parts: list[str],
        expected_risk_level: str,
    ) -> dict[str, float]:
        material_score = self._match_score(analysis.get("materials", []), expected_materials)
        damage_score = self._match_score(analysis.get("damage_types", []), expected_damage_types)
        part_score = self._match_score(analysis.get("affected_parts", []), expected_parts)
        risk_score = 5.0 if str(analysis.get("risk_level") or "") == expected_risk_level else 2.5
        quality_score = 5.0 if str(analysis.get("photo_quality") or "") != "insufficient" else 2.5
        overall = round((material_score + damage_score + part_score + risk_score + quality_score) / 5, 2)
        return {
            "materials": material_score,
            "damage_types": damage_score,
            "affected_parts": part_score,
            "risk_level": risk_score,
            "photo_quality": quality_score,
            "overall": overall,
        }

    def _match_score(self, actual: list[str], expected: list[str]) -> float:
        if not expected:
            return 5.0
        actual_set = {str(item).strip().lower() for item in actual if str(item).strip()}
        expected_set = {str(item).strip().lower() for item in expected if str(item).strip()}
        if not expected_set:
            return 5.0
        hits = len(actual_set & expected_set)
        return round(min(5.0, hits / len(expected_set) * 5), 2)
