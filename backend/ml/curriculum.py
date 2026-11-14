"""Read-only access to curriculum metadata and attempt history for the ML pipeline."""
from __future__ import annotations

import json

from database import fetch_dicts

_QUESTION_SQL = """
    SELECT q.question_id, q.concept_id, q.difficulty, q.question_type, q.options, q.sort_order,
           c.lesson_id, c.sort_order AS concept_order, l.subject, l.class
    FROM questions q
    JOIN concepts c ON c.concept_id = q.concept_id
    JOIN lessons l ON l.lesson_id = c.lesson_id
"""

_cache = {}


def _question_meta(row):
    options = row.get("options")
    if isinstance(options, str):
        try:
            options = json.loads(options)
        except ValueError:
            options = None
    n_options = len(options) if row.get("question_type") == "Multiple Choice" and options else 0
    return {
        "question_id": row["question_id"],
        "concept_id": row["concept_id"],
        "lesson_id": row["lesson_id"],
        "subject": row["subject"],
        "class": row["class"],
        "difficulty": row["difficulty"] or "Easy",
        "question_type": row["question_type"],
        "n_options": n_options,
        "sort_order": row.get("sort_order") or 0,
        "concept_order": row.get("concept_order") or 0,
    }


def load_questions(refresh=False):
    """question_id -> metadata for every question (cached; content only changes at startup)."""
    if refresh or "questions" not in _cache:
        _cache["questions"] = {r["question_id"]: _question_meta(r) for r in fetch_dicts(_QUESTION_SQL)}
    return _cache["questions"]


def load_concepts(refresh=False):
    """concept_id -> metadata, plus curriculum order."""
    if refresh or "concepts" not in _cache:
        rows = fetch_dicts(
            "SELECT c.concept_id, c.name, c.lesson_id, c.difficulty, c.sort_order, l.subject, l.class, "
            "l.sort_order AS lesson_order FROM concepts c JOIN lessons l ON l.lesson_id = c.lesson_id "
            "ORDER BY l.sort_order, c.sort_order"
        )
        _cache["concepts"] = {r["concept_id"]: r for r in rows}
    return _cache["concepts"]


def load_attempts(student_id=None):
    """Attempt history in time order (optionally for one learner)."""
    sql = "SELECT student_id, question_id, is_correct, attempt_time FROM attempts"
    params = []
    if student_id is not None:
        sql += " WHERE student_id = ?"
        params.append(student_id)
    sql += " ORDER BY student_id, attempt_time, attempt_id"
    return fetch_dicts(sql, params)
