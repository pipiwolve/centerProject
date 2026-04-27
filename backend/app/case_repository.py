from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .config import AppConfig
from .types import (
    CaseDetail,
    CaseFeedback,
    CaseFeedbackSummary,
    CaseImage,
    CaseMessage,
    CarePlanItem,
    CaseSummary,
    VisionAnalysis,
)
from .utils import ensure_parent


class CaseRepository:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.enabled = not config.read_only_runtime
        if not self.enabled:
            return
        ensure_parent(config.runtime_db_path)
        config.runtime_case_upload_root.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.config.runtime_db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _init_db(self) -> None:
        with self.connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    description TEXT NOT NULL,
                    cover_image_path TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    source_mode TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS case_images (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS vision_analyses (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    materials TEXT NOT NULL,
                    damage_types TEXT NOT NULL,
                    affected_parts TEXT NOT NULL,
                    photo_quality TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    missing_views TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS case_messages (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    sections_json TEXT NOT NULL,
                    sources_json TEXT NOT NULL,
                    retrieval_trace_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS care_plan_items (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    step_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    instruction TEXT NOT NULL,
                    caution TEXT NOT NULL,
                    status TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS case_feedback (
                    id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL,
                    message_id TEXT NOT NULL,
                    helpful INTEGER NOT NULL DEFAULT 0,
                    resolved INTEGER NOT NULL DEFAULT 0,
                    needs_repair INTEGER NOT NULL DEFAULT 0,
                    unclear_step TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(case_id) REFERENCES cases(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
                CREATE INDEX IF NOT EXISTS idx_cases_risk_level ON cases(risk_level);
                CREATE INDEX IF NOT EXISTS idx_case_images_case_id ON case_images(case_id);
                CREATE INDEX IF NOT EXISTS idx_vision_analyses_case_id ON vision_analyses(case_id);
                CREATE INDEX IF NOT EXISTS idx_case_messages_case_id ON case_messages(case_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_care_plan_items_case_id ON care_plan_items(case_id, sort_order);
                CREATE INDEX IF NOT EXISTS idx_case_feedback_case_id ON case_feedback(case_id, created_at);
                """
            )

    def insert_case(
        self,
        *,
        case_id: str,
        title: str,
        status: str,
        description: str,
        cover_image_path: str,
        risk_level: str,
        source_mode: str,
        created_at: str,
        updated_at: str,
    ) -> None:
        if not self.enabled:
            return
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO cases (
                    id, title, status, description, cover_image_path, risk_level, source_mode, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case_id,
                    title,
                    status,
                    description,
                    cover_image_path,
                    risk_level,
                    source_mode,
                    created_at,
                    updated_at,
                ),
            )

    def insert_case_images(self, images: list[CaseImage]) -> None:
        if not self.enabled or not images:
            return
        with self.connection() as connection:
            connection.executemany(
                """
                INSERT INTO case_images (id, case_id, file_path, mime_type, original_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item.id,
                        item.case_id,
                        item.file_path,
                        item.mime_type,
                        item.original_name,
                        item.created_at,
                    )
                    for item in images
                ],
            )

    def upsert_vision_analysis(self, analysis: VisionAnalysis) -> None:
        if not self.enabled:
            return
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO vision_analyses (
                    id, case_id, materials, damage_types, affected_parts, photo_quality, risk_level, missing_views, summary, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    materials = excluded.materials,
                    damage_types = excluded.damage_types,
                    affected_parts = excluded.affected_parts,
                    photo_quality = excluded.photo_quality,
                    risk_level = excluded.risk_level,
                    missing_views = excluded.missing_views,
                    summary = excluded.summary,
                    created_at = excluded.created_at
                """,
                (
                    analysis.id,
                    analysis.case_id,
                    self._json(analysis.materials),
                    self._json(analysis.damage_types),
                    self._json(analysis.affected_parts),
                    analysis.photo_quality,
                    analysis.risk_level,
                    self._json(analysis.missing_views),
                    analysis.summary,
                    analysis.created_at,
                ),
            )

    def insert_case_message(self, message: CaseMessage) -> None:
        if not self.enabled:
            return
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO case_messages (
                    id, case_id, role, content, answer, sections_json, sources_json, retrieval_trace_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    message.id,
                    message.case_id,
                    message.role,
                    message.content,
                    message.answer,
                    self._json(message.sections),
                    self._json(message.sources),
                    self._json(message.retrieval_trace),
                    message.created_at,
                ),
            )

    def replace_care_plan(self, case_id: str, items: list[CarePlanItem]) -> None:
        if not self.enabled:
            return
        with self.connection() as connection:
            connection.execute("DELETE FROM care_plan_items WHERE case_id = ?", (case_id,))
            connection.executemany(
                """
                INSERT INTO care_plan_items (
                    id, case_id, step_type, title, instruction, caution, status, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item.id,
                        item.case_id,
                        item.step_type,
                        item.title,
                        item.instruction,
                        item.caution,
                        item.status,
                        item.sort_order,
                    )
                    for item in items
                ],
            )

    def update_case(self, case_id: str, **changes: str) -> None:
        if not self.enabled:
            raise KeyError(case_id)
        if not changes:
            return
        allowed = {"title", "status", "risk_level", "updated_at"}
        fields = [(name, value) for name, value in changes.items() if name in allowed]
        if not fields:
            return

        assignments = ", ".join(f"{name} = ?" for name, _ in fields)
        values = [value for _, value in fields]
        values.append(case_id)
        with self.connection() as connection:
            cursor = connection.execute(f"UPDATE cases SET {assignments} WHERE id = ?", values)
            if cursor.rowcount == 0:
                raise KeyError(case_id)

    def update_plan_item_status(self, case_id: str, item_id: str, status: str) -> None:
        if not self.enabled:
            raise KeyError(item_id)
        with self.connection() as connection:
            cursor = connection.execute(
                """
                UPDATE care_plan_items
                SET status = ?
                WHERE id = ? AND case_id = ?
                """,
                (status, item_id, case_id),
            )
            if cursor.rowcount == 0:
                raise KeyError(item_id)

    def insert_feedback(self, feedback: CaseFeedback) -> None:
        if not self.enabled:
            return
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO case_feedback (
                    id, case_id, message_id, helpful, resolved, needs_repair, unclear_step, note, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    feedback.id,
                    feedback.case_id,
                    feedback.message_id,
                    int(feedback.helpful),
                    int(feedback.resolved),
                    int(feedback.needs_repair),
                    feedback.unclear_step,
                    feedback.note,
                    feedback.created_at,
                ),
            )

    def list_cases(self, status: str | None = None, risk_level: str | None = None) -> list[CaseSummary]:
        if not self.enabled:
            return []
        clauses: list[str] = []
        values: list[str] = []
        if status:
            clauses.append("c.status = ?")
            values.append(status)
        if risk_level:
            clauses.append("c.risk_level = ?")
            values.append(risk_level)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        query = f"""
            SELECT
                c.*,
                COUNT(DISTINCT ci.id) AS image_count,
                SUM(CASE WHEN cp.status = 'completed' THEN 1 ELSE 0 END) AS completed_plan_count,
                COUNT(DISTINCT cp.id) AS total_plan_count,
                (
                    SELECT MAX(created_at)
                    FROM case_messages
                    WHERE case_id = c.id
                ) AS latest_message_at,
                (
                    SELECT content
                    FROM case_messages
                    WHERE case_id = c.id AND role = 'user'
                    ORDER BY created_at DESC
                    LIMIT 1
                ) AS latest_user_message
            FROM cases c
            LEFT JOIN case_images ci ON ci.case_id = c.id
            LEFT JOIN care_plan_items cp ON cp.case_id = c.id
            {where}
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        """

        with self.connection() as connection:
            rows = connection.execute(query, values).fetchall()
        return [self._row_to_case_summary(row) for row in rows]

    def get_case_detail(self, case_id: str) -> CaseDetail:
        if not self.enabled:
            raise KeyError(case_id)
        with self.connection() as connection:
            case_row = connection.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
            if case_row is None:
                raise KeyError(case_id)

            image_rows = connection.execute(
                "SELECT * FROM case_images WHERE case_id = ? ORDER BY created_at ASC", (case_id,)
            ).fetchall()
            analysis_row = connection.execute(
                """
                SELECT * FROM vision_analyses
                WHERE case_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (case_id,),
            ).fetchone()
            message_rows = connection.execute(
                "SELECT * FROM case_messages WHERE case_id = ? ORDER BY created_at ASC", (case_id,)
            ).fetchall()
            plan_rows = connection.execute(
                "SELECT * FROM care_plan_items WHERE case_id = ? ORDER BY sort_order ASC", (case_id,)
            ).fetchall()
            feedback_rows = connection.execute(
                "SELECT * FROM case_feedback WHERE case_id = ? ORDER BY created_at DESC", (case_id,)
            ).fetchall()

        images = [self._row_to_case_image(row) for row in image_rows]
        feedback = [self._row_to_feedback(row) for row in feedback_rows]
        feedback_summary = CaseFeedbackSummary(
            count=len(feedback),
            helpful_count=sum(1 for item in feedback if item.helpful),
            resolved_count=sum(1 for item in feedback if item.resolved),
            needs_repair_count=sum(1 for item in feedback if item.needs_repair),
            latest_note=next((item.note for item in feedback if item.note), ""),
        )

        return CaseDetail(
            id=case_row["id"],
            title=case_row["title"],
            status=case_row["status"],
            description=case_row["description"],
            cover_image_path=case_row["cover_image_path"],
            cover_image_url=self._build_url_path(case_row["cover_image_path"]),
            risk_level=case_row["risk_level"],
            source_mode=case_row["source_mode"],
            created_at=case_row["created_at"],
            updated_at=case_row["updated_at"],
            images=images,
            vision_analysis=self._row_to_vision_analysis(analysis_row) if analysis_row is not None else None,
            messages=[self._row_to_case_message(row) for row in message_rows],
            care_plan=[self._row_to_care_plan_item(row) for row in plan_rows],
            feedback=feedback,
            feedback_summary=feedback_summary,
        )

    def get_latest_vision_analysis(self, case_id: str) -> VisionAnalysis | None:
        if not self.enabled:
            return None
        with self.connection() as connection:
            row = connection.execute(
                """
                SELECT * FROM vision_analyses
                WHERE case_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (case_id,),
            ).fetchone()
        return self._row_to_vision_analysis(row) if row is not None else None

    def get_recent_case_messages(self, case_id: str, limit: int = 6) -> list[CaseMessage]:
        if not self.enabled:
            return []
        with self.connection() as connection:
            rows = connection.execute(
                """
                SELECT * FROM case_messages
                WHERE case_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (case_id, limit),
            ).fetchall()
        return [self._row_to_case_message(row) for row in reversed(rows)]

    def build_runtime_metrics(self) -> dict[str, Any]:
        if not self.enabled:
            return {
                "total_case_count": 0,
                "high_risk_case_count": 0,
                "no_source_answer_count": 0,
                "insufficient_photo_case_count": 0,
                "insufficient_photo_ratio": 0.0,
                "top_damage_types": [],
                "top_repair_triggers": [],
            }
        with self.connection() as connection:
            total_cases = connection.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
            high_risk_cases = connection.execute(
                "SELECT COUNT(*) FROM cases WHERE risk_level = 'high'"
            ).fetchone()[0]
            no_source_answers = connection.execute(
                """
                SELECT COUNT(*)
                FROM case_messages
                WHERE role = 'assistant' AND (sources_json = '[]' OR sources_json = '')
                """
            ).fetchone()[0]
            insufficient_photo_cases = connection.execute(
                """
                SELECT COUNT(*)
                FROM vision_analyses
                WHERE photo_quality = 'insufficient'
                """
            ).fetchone()[0]
            damage_rows = connection.execute(
                "SELECT damage_types FROM vision_analyses ORDER BY created_at DESC"
            ).fetchall()
            repair_rows = connection.execute(
                """
                SELECT v.damage_types
                FROM vision_analyses v
                INNER JOIN cases c ON c.id = v.case_id
                WHERE c.status = 'send_repair' OR c.risk_level = 'high'
                """
            ).fetchall()

        return {
            "total_case_count": total_cases,
            "high_risk_case_count": high_risk_cases,
            "no_source_answer_count": no_source_answers,
            "insufficient_photo_case_count": insufficient_photo_cases,
            "insufficient_photo_ratio": round(insufficient_photo_cases / total_cases, 2) if total_cases else 0.0,
            "top_damage_types": self._aggregate_json_list_rows(damage_rows, limit=6),
            "top_repair_triggers": self._aggregate_json_list_rows(repair_rows, limit=6),
        }

    def _row_to_case_summary(self, row: sqlite3.Row) -> CaseSummary:
        return CaseSummary(
            id=row["id"],
            title=row["title"],
            status=row["status"],
            description=row["description"],
            cover_image_path=row["cover_image_path"],
            cover_image_url=self._build_url_path(row["cover_image_path"]),
            risk_level=row["risk_level"],
            source_mode=row["source_mode"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            image_count=int(row["image_count"] or 0),
            completed_plan_count=int(row["completed_plan_count"] or 0),
            total_plan_count=int(row["total_plan_count"] or 0),
            latest_message_at=row["latest_message_at"] or "",
            latest_user_message=row["latest_user_message"] or "",
        )

    def _row_to_case_image(self, row: sqlite3.Row) -> CaseImage:
        return CaseImage(
            id=row["id"],
            case_id=row["case_id"],
            file_path=row["file_path"],
            url_path=self._build_url_path(row["file_path"]),
            mime_type=row["mime_type"],
            original_name=row["original_name"],
            created_at=row["created_at"],
        )

    def _row_to_vision_analysis(self, row: sqlite3.Row) -> VisionAnalysis:
        return VisionAnalysis(
            id=row["id"],
            case_id=row["case_id"],
            materials=self._loads(row["materials"], []),
            damage_types=self._loads(row["damage_types"], []),
            affected_parts=self._loads(row["affected_parts"], []),
            photo_quality=row["photo_quality"],
            risk_level=row["risk_level"],
            missing_views=self._loads(row["missing_views"], []),
            summary=row["summary"],
            created_at=row["created_at"],
        )

    def _row_to_case_message(self, row: sqlite3.Row) -> CaseMessage:
        return CaseMessage(
            id=row["id"],
            case_id=row["case_id"],
            role=row["role"],
            content=row["content"],
            answer=row["answer"],
            sections=self._loads(row["sections_json"], {}),
            sources=self._loads(row["sources_json"], []),
            retrieval_trace=self._loads(row["retrieval_trace_json"], {}),
            created_at=row["created_at"],
        )

    def _row_to_care_plan_item(self, row: sqlite3.Row) -> CarePlanItem:
        return CarePlanItem(
            id=row["id"],
            case_id=row["case_id"],
            step_type=row["step_type"],
            title=row["title"],
            instruction=row["instruction"],
            caution=row["caution"],
            status=row["status"],
            sort_order=int(row["sort_order"]),
        )

    def _row_to_feedback(self, row: sqlite3.Row) -> CaseFeedback:
        return CaseFeedback(
            id=row["id"],
            case_id=row["case_id"],
            message_id=row["message_id"],
            helpful=bool(row["helpful"]),
            resolved=bool(row["resolved"]),
            needs_repair=bool(row["needs_repair"]),
            unclear_step=row["unclear_step"],
            note=row["note"],
            created_at=row["created_at"],
        )

    def _build_url_path(self, file_path: str | Path) -> str:
        relative = Path(file_path).as_posix().lstrip("/")
        return f"/api/runtime/uploads/{relative}"

    def _json(self, payload: Any) -> str:
        return json.dumps(payload, ensure_ascii=False)

    def _loads(self, payload: str, default: Any) -> Any:
        if not payload:
            return default
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return default

    def _aggregate_json_list_rows(self, rows: list[sqlite3.Row], limit: int = 6) -> list[dict[str, Any]]:
        counter: dict[str, int] = {}
        for row in rows:
            values = self._loads(next(iter(row)), [])
            if not isinstance(values, list):
                continue
            for raw_value in values:
                value = str(raw_value or "").strip()
                if not value:
                    continue
                counter[value] = counter.get(value, 0) + 1

        return [
            {"name": name, "count": count}
            for name, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))[:limit]
        ]
