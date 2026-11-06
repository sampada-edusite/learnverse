"""Record a single attempt (kept for scripts that grade answers directly)."""
from answer_checker import check_answer
from database import execute_commit, now_utc


def save_attempt(student_id, question_id, student_answer, expected_answer, source="practice"):
    is_correct = check_answer(student_answer, expected_answer)
    execute_commit(
        "INSERT INTO attempts (student_id, question_id, student_answer, is_correct, attempt_time, source) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (student_id, question_id, student_answer, 1 if is_correct else 0, now_utc(), source),
    )
    print(f"Attempt saved for {student_id} on {question_id}: {'correct' if is_correct else 'incorrect'}")
    return is_correct
