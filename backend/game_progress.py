"""Persist game results and feed curriculum-linked challenges into mastery."""
import json

from database import execute_commit, fetch_dicts, fetch_one, get_connection, now_utc


def _row_to_record(row):
    details = row.get("details")
    return {
        "game_attempt_id": row["game_attempt_id"],
        "student_id": row["student_id"],
        "game_id": row["game_id"],
        "lesson_id": row.get("lesson_id"),
        "level": row.get("level") or 1,
        "score": row["score"],
        "stars": row["stars"],
        "completed_challenges": row["completed_challenges"],
        "total_challenges": row["total_challenges"],
        "is_completed": bool(row["is_completed"]),
        "details": json.loads(details) if details else None,
        "created_at": row["created_at"],
    }


def save_game_attempt(student_id, game_id, lesson_id=None, score=0, stars=1, completed_challenges=0,
                      total_challenges=0, is_completed=True, details=None, record_mastery=False, level=1):
    """Save a game result. Challenges that reference curriculum questions are appended to the
    attempts table (never overwriting earlier attempts) when record_mastery is True."""
    created_at = now_utc()
    connection = get_connection()
    mastery_recorded = 0
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO game_attempts (student_id, game_id, lesson_id, level, score, stars, completed_challenges,
                                       total_challenges, is_completed, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (student_id, game_id, lesson_id, level, score, stars, completed_challenges, total_challenges,
             1 if is_completed else 0, json.dumps(details, ensure_ascii=False) if details is not None else None,
             created_at),
        )
        attempt_id = cursor.lastrowid
        if record_mastery and details:
            for challenge in details:
                qid = challenge.get("question_id")
                if not qid:
                    continue
                cursor.execute("SELECT 1 FROM questions WHERE question_id = ?", (qid,))
                if not cursor.fetchone():
                    continue
                cursor.execute(
                    "INSERT INTO attempts (student_id, question_id, student_answer, is_correct, attempt_time, source) "
                    "VALUES (?, ?, ?, ?, ?, 'game')",
                    (student_id, qid, challenge.get("student_answer"), 1 if challenge.get("is_correct") else 0,
                     created_at),
                )
                mastery_recorded += 1
        connection.commit()
    finally:
        connection.close()

    execute_commit("UPDATE students SET last_active = ? WHERE student_id = ?", (created_at, student_id))
    row = fetch_dicts("SELECT * FROM game_attempts WHERE game_attempt_id = ?", (attempt_id,))[0]
    record = _row_to_record(row)
    record["mastery_attempts_recorded"] = mastery_recorded
    return record


def get_game_attempts(student_id, game_id=None, limit=50):
    query, params = "SELECT * FROM game_attempts WHERE student_id = ?", [student_id]
    if game_id:
        query += " AND game_id = ?"
        params.append(game_id)
    query += " ORDER BY created_at DESC, game_attempt_id DESC LIMIT ?"
    params.append(limit)
    return [_row_to_record(r) for r in fetch_dicts(query, params)]


def count_game_attempts(student_id):
    return fetch_one("SELECT COUNT(*) FROM game_attempts WHERE student_id = ?", (student_id,))[0]
