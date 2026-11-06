"""Scaffolded recovery when a learner struggles with a concept.

Level 1 (easier_question): accuracy below the mastery threshold -> an Easy question.
Level 2 (hint_support): the last two attempts were wrong -> an Easy question with its hint.
"""
from database import fetch_all, fetch_one
from mastery_engine import LEARNING_THRESHOLD, calculate_mastery
from question_selector import get_question_for_mastery


def _recent_results(student_id, concept_id, limit=2):
    rows = fetch_all(
        """
        SELECT a.is_correct FROM attempts a
        JOIN questions q ON q.question_id = a.question_id
        WHERE a.student_id = ? AND q.concept_id = ?
        ORDER BY a.attempt_time DESC, a.attempt_id DESC
        LIMIT ?
        """,
        (student_id, concept_id, limit),
    )
    return [bool(r[0]) for r in rows]


def get_recovery_activity(student_id, concept_id):
    concept = fetch_one("SELECT name FROM concepts WHERE concept_id = ?", (concept_id,))
    base = {"student_id": student_id, "concept_id": concept_id, "recovery_needed": False,
            "recovery_type": None, "question": None, "hint": None, "mastery": None}
    if not concept:
        return {**base, "reason": "Invalid concept ID: no such concept exists."}

    base["concept_name"] = concept[0]
    mastery = calculate_mastery(student_id, concept_id)
    base["mastery"] = mastery
    if mastery["total_attempts"] == 0:
        return {**base, "reason": "This concept has not been attempted yet."}

    recent = _recent_results(student_id, concept_id)
    if len(recent) >= 2 and not any(recent):
        recovery_type = "hint_support"
        reason = "The student made repeated incorrect attempts on this concept."
    elif mastery["accuracy"] < LEARNING_THRESHOLD:
        recovery_type = "easier_question"
        reason = "Accuracy is below the mastery threshold for this concept."
    else:
        return {**base, "reason": "The student is progressing well; no recovery needed."}

    question = get_question_for_mastery(student_id, concept_id, "Needs Practice")
    return {
        **base,
        "recovery_needed": True,
        "recovery_type": recovery_type,
        "reason": reason,
        "question": question,
        "hint": question.get("hint") if question and recovery_type == "hint_support" else None,
    }
