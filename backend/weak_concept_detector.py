"""Find the concepts a learner is struggling with."""
from database import fetch_all
from mastery_engine import status_for


def concept_stats(student_id, lesson_ids=None):
    """Per-concept attempt statistics for concepts the student has attempted."""
    query = """
        SELECT c.concept_id, c.name, c.lesson_id, COUNT(*) AS total, COALESCE(SUM(a.is_correct), 0) AS correct,
               c.sort_order
        FROM attempts a
        JOIN questions q ON q.question_id = a.question_id
        JOIN concepts c ON c.concept_id = q.concept_id
        WHERE a.student_id = ?
    """
    params = [student_id]
    if lesson_ids is not None:
        if not lesson_ids:
            return []
        query += f" AND c.lesson_id IN ({','.join('?' * len(lesson_ids))})"
        params += list(lesson_ids)
    query += " GROUP BY c.concept_id ORDER BY c.sort_order"
    stats = []
    for concept_id, name, lesson_id, total, correct, sort_order in fetch_all(query, params):
        accuracy = round(correct / total * 100, 1) if total else 0.0
        stats.append({
            "concept_id": concept_id,
            "concept_name": name,
            "lesson_id": lesson_id,
            "total_attempts": total,
            "correct_attempts": correct,
            "incorrect_attempts": total - correct,
            "accuracy": accuracy,
            "status": status_for(accuracy, total),
            "sort_order": sort_order,
        })
    return stats


def get_weak_concepts(student_id, lesson_ids=None):
    """Attempted concepts that are not yet Mastered, weakest first."""
    weak = [s for s in concept_stats(student_id, lesson_ids) if s["status"] in ("Needs Practice", "Learning")]
    weak.sort(key=lambda s: (s["accuracy"], s["sort_order"]))
    for s in weak:
        s.pop("sort_order", None)
    return weak
