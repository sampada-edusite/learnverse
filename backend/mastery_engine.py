"""Concept mastery from a learner's attempt history.

Status thresholds: >= 80% Mastered, >= 50% Learning, otherwise Needs Practice.
A concept with no attempts is 'No Practice'.
"""
from database import DB_NAME, fetch_one  # noqa: F401  (DB_NAME re-exported for tests/tools)

MASTERED_THRESHOLD = 80.0
LEARNING_THRESHOLD = 50.0


def status_for(accuracy, total_attempts):
    if total_attempts == 0:
        return "No Practice"
    if accuracy >= MASTERED_THRESHOLD:
        return "Mastered"
    if accuracy >= LEARNING_THRESHOLD:
        return "Learning"
    return "Needs Practice"


def calculate_mastery(student_id, concept_id):
    row = fetch_one(
        """
        SELECT COUNT(*), COALESCE(SUM(a.is_correct), 0)
        FROM attempts a
        JOIN questions q ON q.question_id = a.question_id
        WHERE a.student_id = ? AND q.concept_id = ?
        """,
        (student_id, concept_id),
    )
    total, correct = (row[0] or 0), (row[1] or 0)
    accuracy = round(correct / total * 100, 1) if total else 0.0
    return {
        "student_id": student_id,
        "concept_id": concept_id,
        "total_attempts": total,
        "correct_attempts": correct,
        "accuracy": accuracy,
        "status": status_for(accuracy, total),
    }
