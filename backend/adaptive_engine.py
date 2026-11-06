"""Decide what a learner should do next.

Priority: weakest 'Needs Practice' concept, then weakest 'Learning' concept,
then the first concept not yet attempted ('introduce' for a brand-new learner,
'progress' once everything attempted is mastered).
"""
from database import fetch_all, fetch_dicts
from question_selector import get_question_for_mastery
from weak_concept_detector import concept_stats

REASONS = {
    "introduce": "Student has no previous attempts.",
    "Needs Practice": "Student needs more practice with this concept.",
    "Learning": "Student is learning this concept and needs additional practice.",
    "progress": "All current concepts are mastered.",
    "lesson_completed": "Awesome job! You have answered all available questions for this lesson!",
}


def scoped_lesson_ids(lesson_id=None, subject=None, class_level=None):
    """Lesson ids in scope, in curriculum order (None means 'all lessons')."""
    if not (lesson_id or subject or class_level):
        return None
    query, params = "SELECT lesson_id FROM lessons WHERE 1=1", []
    if lesson_id:
        query += " AND lesson_id = ?"
        params.append(lesson_id)
    if subject:
        query += " AND subject = ?"
        params.append(subject)
    if class_level:
        query += " AND class = ?"
        params.append(int(class_level))
    query += " ORDER BY sort_order"
    return [row[0] for row in fetch_all(query, params)]


def _concepts_in_scope(lesson_ids):
    if lesson_ids is None:
        return fetch_dicts("SELECT concept_id, name, lesson_id FROM concepts ORDER BY sort_order")
    if not lesson_ids:
        return []
    return fetch_dicts(
        f"SELECT concept_id, name, lesson_id FROM concepts WHERE lesson_id IN ({','.join('?' * len(lesson_ids))}) "
        "ORDER BY sort_order",
        list(lesson_ids),
    )


def get_next_activity(student_id, lesson_id=None, subject=None, class_level=None, exclude=None):
    lesson_ids = scoped_lesson_ids(lesson_id, subject, class_level)
    concepts = _concepts_in_scope(lesson_ids)
    names = {c["concept_id"]: c["name"] for c in concepts}
    stats = {s["concept_id"]: s for s in concept_stats(student_id, lesson_ids)}

    def by_weakness(status):
        items = [s for s in stats.values() if s["status"] == status]
        return sorted(items, key=lambda s: (s["accuracy"], s["sort_order"]))

    # Ordered list of (concept_id, mastery status, action, reason)
    plan = []
    for s in by_weakness("Needs Practice"):
        plan.append((s["concept_id"], "Needs Practice", "practice", REASONS["Needs Practice"]))
    for s in by_weakness("Learning"):
        plan.append((s["concept_id"], "Learning", "practice", REASONS["Learning"]))

    if not stats:
        fresh_action, fresh_reason = "introduce", REASONS["introduce"]
    else:
        fresh_action, fresh_reason = "progress", REASONS["progress"]
    unattempted = [c["concept_id"] for c in concepts if c["concept_id"] not in stats]
    mastered = sorted((s for s in stats.values() if s["status"] == "Mastered"),
                      key=lambda s: (s["accuracy"], s["sort_order"]))

    if not plan:
        for cid in unattempted:
            plan.append((cid, "No Practice", fresh_action, fresh_reason))
        for s in mastered:
            plan.append((s["concept_id"], "Mastered", fresh_action, fresh_reason))
    else:
        # When excluded questions exhaust the weak concepts, continue with the rest of the scope.
        for cid in unattempted:
            plan.append((cid, "No Practice", "progress", REASONS["progress"]))
        for s in mastered:
            plan.append((s["concept_id"], "Mastered", "progress", REASONS["progress"]))

    for concept_id, status, action, reason in plan:
        question = get_question_for_mastery(student_id, concept_id, status, exclude=exclude)
        if question:
            return {
                "student_id": student_id,
                "action": action,
                "concept_id": concept_id,
                "concept_name": names.get(concept_id) or stats.get(concept_id, {}).get("concept_name"),
                "mastery_status": status,
                "reason": reason,
                "question": question,
            }

    if exclude and plan:
        return {"student_id": student_id, "action": "lesson_completed", "concept_id": None,
                "concept_name": None, "mastery_status": None, "reason": REASONS["lesson_completed"],
                "question": None}
    return {"student_id": student_id, "action": fresh_action if not stats else "progress", "concept_id": None,
            "concept_name": None, "mastery_status": None, "reason": fresh_reason, "question": None}
