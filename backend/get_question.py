"""Question lookup helpers."""
import json

from database import fetch_dict, fetch_one


def get_question(question_id):
    """Return (question_id, question, question_type, expected_answer, hint, difficulty) or None."""
    return fetch_one(
        "SELECT question_id, question, question_type, expected_answer, hint, difficulty "
        "FROM questions WHERE question_id = ?",
        (question_id,),
    )


def get_question_record(question_id):
    """Full question row (including expected_answer) for server-side use only."""
    row = fetch_dict(
        """
        SELECT q.*, c.lesson_id, c.name AS concept_name, l.subject
        FROM questions q
        LEFT JOIN concepts c ON c.concept_id = q.concept_id
        LEFT JOIN lessons l ON l.lesson_id = c.lesson_id
        WHERE q.question_id = ?
        """,
        (question_id,),
    )
    if row:
        row["options"] = json.loads(row["options"]) if row.get("options") else None
    return row


def to_student_payload(row):
    """Learner-facing question dict. Never includes the expected answer."""
    if not row:
        return None
    options = row.get("options")
    if isinstance(options, str):
        options = json.loads(options)
    return {
        "question_id": row["question_id"],
        "concept_id": row["concept_id"],
        "lesson_id": row.get("lesson_id"),
        "question": row["question"],
        "question_type": row["question_type"],
        "options": options,
        "hint": row.get("hint"),
        "difficulty": row.get("difficulty"),
        "solving_video_url": row.get("solving_video_url"),
        "solving_video_title": row.get("solving_video_title"),
    }
