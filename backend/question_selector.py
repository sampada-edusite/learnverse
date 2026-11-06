"""Choose the next question for a concept based on mastery status."""
from database import fetch_all, fetch_dicts, fetch_one
from get_question import to_student_payload

PREFERRED_DIFFICULTY = {
    "Needs Practice": ["Easy"],
    "No Practice": ["Easy"],
    "Learning": ["Medium", "Easy"],
    "Mastered": ["Medium", "Hard"],
}


def _concept_questions(concept_id):
    return fetch_dicts(
        """
        SELECT q.question_id, q.concept_id, q.question, q.question_type, q.options, q.hint, q.difficulty,
               q.solving_video_url, q.solving_video_title, c.lesson_id
        FROM questions q JOIN concepts c ON c.concept_id = q.concept_id
        WHERE q.concept_id = ?
        ORDER BY q.sort_order, q.question_id
        """,
        (concept_id,),
    )


def get_questions_by_concept(concept_id):
    return [to_student_payload(row) for row in _concept_questions(concept_id)]


def get_question_for_mastery(student_id, concept_id, status, exclude=None):
    """Pick a question for the concept.

    Order of preference: unattempted questions at the preferred difficulty, unattempted
    questions at any difficulty, then previously attempted questions (preferred first).
    Questions in `exclude` (e.g. already answered this session) are never returned.
    Returns None for an unknown concept or a concept without questions.
    """
    if not fetch_one("SELECT 1 FROM concepts WHERE concept_id = ?", (concept_id,)):
        return None
    exclude = set(exclude or [])
    questions = [q for q in _concept_questions(concept_id) if q["question_id"] not in exclude]
    if not questions:
        return None

    attempted = {row[0] for row in fetch_all(
        "SELECT DISTINCT question_id FROM attempts WHERE student_id = ?", (student_id,))}
    preferred = PREFERRED_DIFFICULTY.get(status, ["Easy"])

    def rank(q):
        pref_index = preferred.index(q["difficulty"]) if q["difficulty"] in preferred else len(preferred)
        return (q["question_id"] in attempted, pref_index >= len(preferred), pref_index, q.get("sort_order", 0))

    unattempted = [q for q in questions if q["question_id"] not in attempted]
    pool = unattempted if unattempted else questions
    best = min(pool, key=rank)
    return to_student_payload(best)
