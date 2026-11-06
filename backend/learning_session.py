"""Learning session flow: start, submit answers, adapt, recover."""
from adaptive_engine import get_next_activity
from answer_checker import check_answer
from database import execute_commit, now_utc
from get_question import get_question_record
from mastery_engine import calculate_mastery
from recovery_engine import get_recovery_activity
from speech_to_text import speech_to_text

CORRECT_FEEDBACK = "Correct! Well done."
INCORRECT_FEEDBACK = "Not quite. Let's practice this concept again."


def sanitize_response(obj):
    """Recursively remove any expected_answer keys from a payload."""
    if isinstance(obj, dict):
        return {k: sanitize_response(v) for k, v in obj.items() if k != "expected_answer"}
    if isinstance(obj, list):
        return [sanitize_response(v) for v in obj]
    return obj


def _activity_payload(activity):
    return {
        "activity_type": activity["action"],
        "concept_id": activity.get("concept_id"),
        "concept_name": activity.get("concept_name"),
        "reason": activity.get("reason"),
        "question": activity.get("question"),
    }


def touch_student(student_id):
    execute_commit("UPDATE students SET last_active = ? WHERE student_id = ?", (now_utc(), student_id))


def start_session(student_id, lesson_id=None, subject=None, exclude=None):
    activity = get_next_activity(student_id, lesson_id=lesson_id, subject=subject, exclude=exclude)
    return sanitize_response({
        "student_id": student_id,
        "session_started": True,
        **_activity_payload(activity),
    })


def submit_answer(student_id, question_id, student_answer, lesson_id=None, exclude=None, source="practice"):
    record = get_question_record(question_id)
    if not record:
        return sanitize_response({
            "student_id": student_id, "question_id": question_id, "is_correct": False, "correctness": False,
            "feedback": "Question not found. Please check the question ID.", "mastery": None,
            "next_activity": None,
        })

    if student_answer is None or not str(student_answer).strip():
        return sanitize_response({
            "student_id": student_id, "question_id": question_id, "is_correct": False, "correctness": False,
            "feedback": "Please give an answer before submitting.",
            "mastery": calculate_mastery(student_id, record["concept_id"]), "next_activity": None,
        })

    is_correct = check_answer(student_answer, record["expected_answer"], record.get("options"))
    execute_commit(
        "INSERT INTO attempts (student_id, question_id, student_answer, is_correct, attempt_time, source) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (student_id, question_id, str(student_answer), 1 if is_correct else 0, now_utc(), source),
    )
    touch_student(student_id)
    mastery = calculate_mastery(student_id, record["concept_id"])

    next_activity = None
    if not is_correct:
        recovery = get_recovery_activity(student_id, record["concept_id"])
        if recovery["recovery_needed"] and recovery["question"]:
            next_activity = {
                "activity_type": "recovery",
                "concept_id": record["concept_id"],
                "concept_name": recovery.get("concept_name"),
                "reason": recovery["reason"],
                "recovery_type": recovery["recovery_type"],
                "hint": recovery.get("hint"),
                "question": recovery["question"],
            }
    if next_activity is None:
        next_activity = _activity_payload(get_next_activity(student_id, lesson_id=lesson_id, exclude=exclude))

    return sanitize_response({
        "student_id": student_id,
        "question_id": question_id,
        "concept_id": record["concept_id"],
        "is_correct": is_correct,
        "correctness": is_correct,
        "feedback": CORRECT_FEEDBACK if is_correct else INCORRECT_FEEDBACK,
        "mastery": mastery,
        "next_activity": next_activity,
    })


def submit_speech_answer(student_id, question_id, audio_input, language="en", lesson_id=None):
    speech = speech_to_text(audio_input, language=language)
    if not speech["success"]:
        return sanitize_response({"speech_success": False, "recognized_text": None, "error": speech.get("error"),
                                  "learning_result": None})
    result = submit_answer(student_id, question_id, speech["text"], lesson_id=lesson_id, source="voice")
    return sanitize_response({"speech_success": True, "recognized_text": speech["text"], "learning_result": result})
