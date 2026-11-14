"""Decide what a learner should do next.

Primary path (ML): a trained learner model (see backend/ml/) predicts the probability that the
learner answers each candidate question correctly and how ready they are for each concept; the
recommender picks the least-ready concept on the learner's curriculum frontier and the question
closest to the target success rate. Mastery status/tracking (mastery_engine) is unchanged and
still reported with every recommendation.

Fallback (rules, the original engine): used only when no valid model artifact is available.
Priority: weakest 'Needs Practice' concept, then weakest 'Learning' concept,
then the first concept not yet attempted ('introduce' for a brand-new learner,
'progress' once everything attempted is mastered).
"""
import time

from database import fetch_all, fetch_dict, fetch_dicts
from get_question import to_student_payload
from ml.curriculum import load_attempts, load_concepts, load_questions
from ml.features import LearnerState, parse_time
from ml.model import get_model
from ml.recommender import choose_activity
from question_selector import get_question_for_mastery
from weak_concept_detector import concept_stats

REASONS = {
    "introduce": "Student has no previous attempts.",
    "Needs Practice": "Student needs more practice with this concept.",
    "Learning": "Student is learning this concept and needs additional practice.",
    "progress": "All current concepts are mastered.",
    "lesson_completed": "Awesome job! You have answered all available questions for this lesson!",
    "ml_review": "The learning model predicts this skill needs a little more practice.",
    "ml_new_skill": "The learning model predicts you are ready for a new skill.",
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


def learner_state(student_id):
    """Replay a learner's stored attempts into the model's running state."""
    questions = load_questions()
    state = LearnerState()
    for row in load_attempts(student_id):
        meta = questions.get(row["question_id"])
        if meta:
            state.update(meta, row["is_correct"], when=parse_time(row["attempt_time"]))
    return state


def _question_payload(question_id):
    row = fetch_dict(
        "SELECT q.question_id, q.concept_id, q.question, q.question_type, q.options, q.hint, q.difficulty, "
        "q.solving_video_url, q.solving_video_title, c.lesson_id FROM questions q "
        "JOIN concepts c ON c.concept_id = q.concept_id WHERE q.question_id = ?",
        (question_id,),
    )
    return to_student_payload(row)


def _ml_next_activity(model, student_id, lesson_ids, exclude):
    all_concepts = load_concepts()
    if lesson_ids is None:
        concepts = list(all_concepts.values())
    else:
        scope = set(lesson_ids)
        concepts = [c for c in all_concepts.values() if c["lesson_id"] in scope]
    questions_by_concept = {}
    for q in load_questions().values():
        questions_by_concept.setdefault(q["concept_id"], []).append(q)
    for qs in questions_by_concept.values():
        qs.sort(key=lambda q: (q["sort_order"], q["question_id"]))

    stats = {s["concept_id"]: s for s in concept_stats(student_id, lesson_ids)}
    state = learner_state(student_id)
    choice = choose_activity(model, state, concepts, questions_by_concept, exclude=exclude, now=time.time())

    if choice is None:
        if exclude and concepts:
            return {"student_id": student_id, "action": "lesson_completed", "concept_id": None,
                    "concept_name": None, "mastery_status": None, "reason": REASONS["lesson_completed"],
                    "question": None}
        action = "progress" if stats else "introduce"
        return {"student_id": student_id, "action": action, "concept_id": None, "concept_name": None,
                "mastery_status": None, "reason": REASONS[action], "question": None}

    # The model decides WHAT to do next; the action label and reason follow the existing mastery
    # tracking (mastery_engine) so the app never contradicts the mastery badges it shows.
    cid = choice["concept_id"]
    status = stats[cid]["status"] if cid in stats else "No Practice"
    any_weak = any(s["status"] in ("Needs Practice", "Learning") for s in stats.values())
    if choice["kind"] == "introduce":
        kind, reason = "introduce", REASONS["introduce"]
    elif status in ("Needs Practice", "Learning"):
        kind, reason = "practice", REASONS[status]
    elif any_weak:
        kind = "progress"
        reason = REASONS["ml_new_skill"] if status == "No Practice" else REASONS["ml_review"]
    else:
        kind, reason = "progress", REASONS["progress"]

    return {
        "student_id": student_id,
        "action": kind,
        "concept_id": cid,
        "concept_name": all_concepts.get(cid, {}).get("name"),
        "mastery_status": status,
        "reason": reason,
        "question": _question_payload(choice["question"]["question_id"]),
        "recommendation": {
            "engine": "ml",
            "model_version": model.version,
            "model_data_source": model.data_source,
            "concept_readiness": round(choice["readiness"], 3),
            "predicted_success": round(choice["predicted_success"], 3),
        },
    }


def get_next_activity(student_id, lesson_id=None, subject=None, class_level=None, exclude=None):
    lesson_ids = scoped_lesson_ids(lesson_id, subject, class_level)
    model = get_model()
    if model is not None:
        return _ml_next_activity(model, student_id, lesson_ids, exclude)
    return _rule_based_next_activity(student_id, lesson_ids, exclude)


def _rule_based_next_activity(student_id, lesson_ids, exclude):
    """The original rule engine, kept as a safety fallback when no model artifact is present."""
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
