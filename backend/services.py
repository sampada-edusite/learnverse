"""Shared domain services: students, progress, assignments, quizzes, analytics."""
import json
import secrets
from datetime import datetime, timedelta, timezone

from answer_checker import check_answer
from database import execute_commit, fetch_all, fetch_dict, fetch_dicts, fetch_one, get_connection, now_utc
from mastery_engine import status_for

ASSIGNMENT_KINDS = ("lesson", "quiz", "game")
DEFAULT_LESSON_TARGET = 5


class ServiceError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# ----------------------------------------------------------------- students

def public_student(row):
    if not row:
        return None
    teacher = None
    if row.get("teacher_id"):
        t = fetch_dict("SELECT teacher_id, name, school FROM teachers WHERE teacher_id = ?", (row["teacher_id"],))
        teacher = t
    return {
        "student_id": row["student_id"],
        "name": row["name"],
        "nickname": row.get("nickname"),
        "student_class": row["student_class"],
        "parent_mobile_masked": mask_mobile(row.get("parent_mobile")),
        "roll_no": row.get("roll_no"),
        "coins": row.get("coins", 0),
        "teacher": teacher,
        "created_at": row.get("created_at"),
        "last_active": row.get("last_active"),
    }


def mask_mobile(mobile):
    if not mobile:
        return None
    return f"{mobile[:2]}******{mobile[-2:]}"


def get_student_row(student_id):
    return fetch_dict("SELECT * FROM students WHERE student_id = ?", (student_id,))


def new_student_id():
    while True:
        sid = "stu_" + secrets.token_hex(5)
        if not fetch_one("SELECT 1 FROM students WHERE student_id = ?", (sid,)):
            return sid


def create_student(name, student_class, parent_mobile, nickname=None, teacher_id=None, roll_no=None):
    sid = new_student_id()
    execute_commit(
        "INSERT INTO students (student_id, name, nickname, student_class, parent_mobile, roll_no, teacher_id, "
        "created_at, last_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
        (sid, name, nickname, student_class, parent_mobile, roll_no, teacher_id, now_utc()),
    )
    return get_student_row(sid)


def find_student(name, parent_mobile):
    rows = fetch_dicts("SELECT * FROM students WHERE parent_mobile = ?", (parent_mobile,))
    key = " ".join(name.split()).casefold()
    for r in rows:
        if " ".join(r["name"].split()).casefold() == key:
            return r
    return None


# ----------------------------------------------------------------- progress

def lesson_progress(student_id, subject=None, class_level=None):
    query = "SELECT lesson_id, class, subject, chapter_no, lesson_name, lesson_name_local, description FROM lessons WHERE 1=1"
    params = []
    if subject:
        query += " AND subject = ?"
        params.append(subject)
    if class_level:
        query += " AND class = ?"
        params.append(int(class_level))
    query += " ORDER BY sort_order"
    lessons = fetch_dicts(query, params)
    if not lessons:
        return []
    ids = [l["lesson_id"] for l in lessons]
    marks = ",".join("?" * len(ids))
    concept_rows = fetch_dicts(
        f"""
        SELECT c.concept_id, c.lesson_id, c.name,
               (SELECT COUNT(*) FROM questions q WHERE q.concept_id = c.concept_id) AS question_count,
               (SELECT COUNT(*) FROM attempts a JOIN questions q ON q.question_id = a.question_id
                 WHERE a.student_id = ? AND q.concept_id = c.concept_id) AS total,
               (SELECT COALESCE(SUM(a.is_correct), 0) FROM attempts a JOIN questions q ON q.question_id = a.question_id
                 WHERE a.student_id = ? AND q.concept_id = c.concept_id) AS correct
        FROM concepts c WHERE c.lesson_id IN ({marks}) ORDER BY c.sort_order
        """,
        [student_id, student_id] + ids,
    )
    by_lesson = {}
    for c in concept_rows:
        acc = round(c["correct"] / c["total"] * 100, 1) if c["total"] else 0.0
        c["accuracy"] = acc
        c["status"] = status_for(acc, c["total"])
        by_lesson.setdefault(c["lesson_id"], []).append(c)
    out = []
    for l in lessons:
        cs = by_lesson.get(l["lesson_id"], [])
        total = sum(c["total"] for c in cs)
        correct = sum(c["correct"] for c in cs)
        mastered = sum(1 for c in cs if c["status"] == "Mastered")
        out.append({
            **l,
            "concepts": [{"concept_id": c["concept_id"], "name": c["name"], "status": c["status"],
                          "accuracy": c["accuracy"], "attempts": c["total"], "question_count": c["question_count"]}
                         for c in cs],
            "concept_count": len(cs),
            "mastered_concepts": mastered,
            "attempts": total,
            "accuracy": round(correct / total * 100, 1) if total else 0.0,
            "progress": round(mastered / len(cs), 3) if cs else 0.0,
        })
    return out


def subject_breakdown(student_id):
    rows = fetch_dicts(
        """
        SELECT l.subject, COUNT(a.attempt_id) AS attempts, COALESCE(SUM(a.is_correct), 0) AS correct
        FROM attempts a JOIN questions q ON q.question_id = a.question_id
        JOIN concepts c ON c.concept_id = q.concept_id JOIN lessons l ON l.lesson_id = c.lesson_id
        WHERE a.student_id = ? GROUP BY l.subject
        """,
        (student_id,),
    )
    stats = {r["subject"]: r for r in rows}
    out = []
    for subject in ("English", "Mathematics", "Marathi"):
        r = stats.get(subject, {"attempts": 0, "correct": 0})
        lessons = lesson_progress(student_id, subject)
        concepts = sum(l["concept_count"] for l in lessons)
        mastered = sum(l["mastered_concepts"] for l in lessons)
        out.append({
            "subject": subject,
            "attempts": r["attempts"],
            "accuracy": round(r["correct"] / r["attempts"] * 100, 1) if r["attempts"] else 0.0,
            "lessons": len(lessons),
            "concepts": concepts,
            "mastered_concepts": mastered,
            "progress": round(mastered / concepts, 3) if concepts else 0.0,
        })
    return out


def recent_activity_days(student_id, days=7):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    rows = fetch_all(
        "SELECT DISTINCT substr(attempt_time, 1, 10) FROM attempts WHERE student_id = ? AND attempt_time >= ? "
        "UNION SELECT DISTINCT substr(created_at, 1, 10) FROM game_attempts WHERE student_id = ? AND created_at >= ?",
        (student_id, since, student_id, since),
    )
    return sorted({r[0] for r in rows})


def streak_days(student_id):
    rows = fetch_all(
        "SELECT DISTINCT substr(attempt_time, 1, 10) FROM attempts WHERE student_id = ? "
        "UNION SELECT DISTINCT substr(created_at, 1, 10) FROM game_attempts WHERE student_id = ?",
        (student_id, student_id),
    )
    days = {r[0] for r in rows}
    streak, day = 0, datetime.now(timezone.utc).date()
    if day.isoformat() not in days:
        day -= timedelta(days=1)
    while day.isoformat() in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


# ----------------------------------------------------------------- assignments

def _assignment_progress(a, student_id):
    created = a["created_at"]
    if a["kind"] == "quiz":
        sub = fetch_dict(
            "SELECT score, max_score, submitted_at FROM quiz_submissions WHERE quiz_id = ? AND student_id = ? "
            "AND submitted_at >= ? ORDER BY score DESC LIMIT 1",
            (int(a["ref_id"]), student_id, created),
        )
        if sub:
            return 1.0, f"Scored {sub['score']}/{sub['max_score']}", sub["submitted_at"]
        return 0.0, "Not attempted yet", None
    if a["kind"] == "game":
        level = a.get("level") or 1
        row = fetch_dict(
            "SELECT MAX(stars) AS stars, MAX(created_at) AS at FROM game_attempts "
            "WHERE student_id = ? AND game_id = ? AND COALESCE(level, 1) >= ? AND created_at >= ?",
            (student_id, a["ref_id"], level, created),
        )
        if row and row["stars"]:
            return 1.0, f"Played level {level}+ — {row['stars']}★", row["at"]
        return 0.0, f"Play level {level}", None
    target = a.get("target_count") or DEFAULT_LESSON_TARGET
    row = fetch_dict(
        """
        SELECT COUNT(*) AS n, MAX(a.attempt_time) AS at FROM attempts a
        JOIN questions q ON q.question_id = a.question_id JOIN concepts c ON c.concept_id = q.concept_id
        WHERE a.student_id = ? AND c.lesson_id = ? AND a.attempt_time >= ? AND COALESCE(a.source, 'practice') != 'quiz'
        """,
        (student_id, a["ref_id"], created),
    )
    n = row["n"] if row else 0
    return min(n / target, 1.0), f"{min(n, target)}/{target} questions practised", row["at"] if n >= target else None


def assignment_ref_title(kind, ref_id):
    if kind == "lesson":
        r = fetch_dict("SELECT lesson_name, subject, class FROM lessons WHERE lesson_id = ?", (ref_id,))
        return f"{r['subject']} · {r['lesson_name']}" if r else ref_id
    if kind == "quiz":
        r = fetch_dict("SELECT title, subject, quiz_type FROM quizzes WHERE quiz_id = ?", (int(ref_id),))
        label = "Homework" if r and r.get("quiz_type") == "homework" else "Quiz"
        return f"{label} · {r['title']}" if r else f"Quiz #{ref_id}"
    from games_engine import GAMES_BY_ID
    g = GAMES_BY_ID.get(ref_id)
    return f"Game · {g['title']}" if g else ref_id


def _assignment_score(a, student_id):
    """Score for an assignment: {"earned", "possible", "percent", "label"} or None if not attempted."""
    created = a["created_at"]
    if a["kind"] == "quiz":
        sub = fetch_dict(
            "SELECT score, max_score FROM quiz_submissions WHERE quiz_id = ? AND student_id = ? "
            "AND submitted_at >= ? ORDER BY score DESC LIMIT 1",
            (int(a["ref_id"]), student_id, created),
        )
        if not sub or not sub["max_score"]:
            return None
        pct = round(sub["score"] / sub["max_score"] * 100)
        return {"earned": sub["score"], "possible": sub["max_score"], "percent": pct,
                "label": f"{sub['score']}/{sub['max_score']} ({pct}%)"}
    if a["kind"] == "game":
        level = a.get("level") or 1
        row = fetch_dict(
            "SELECT MAX(stars) AS stars, MAX(score) AS score FROM game_attempts "
            "WHERE student_id = ? AND game_id = ? AND COALESCE(level, 1) >= ? AND created_at >= ?",
            (student_id, a["ref_id"], level, created),
        )
        if not row or row["stars"] is None:
            return None
        pct = round(row["stars"] / 3 * 100)
        return {"earned": row["stars"], "possible": 3, "percent": pct,
                "label": f"{row['stars']}★ · best score {row['score']}"}
    row = fetch_dict(
        """
        SELECT COUNT(*) AS n, COALESCE(SUM(a.is_correct), 0) AS k FROM attempts a
        JOIN questions q ON q.question_id = a.question_id JOIN concepts c ON c.concept_id = q.concept_id
        WHERE a.student_id = ? AND c.lesson_id = ? AND a.attempt_time >= ? AND COALESCE(a.source, 'practice') != 'quiz'
        """,
        (student_id, a["ref_id"], created),
    )
    if not row or not row["n"]:
        return None
    pct = round(row["k"] / row["n"] * 100)
    return {"earned": row["k"], "possible": row["n"], "percent": pct, "label": f"{row['k']}/{row['n']} correct ({pct}%)"}


def assignment_for_student(a, student_id):
    progress, detail, completed_at = _assignment_progress(a, student_id)
    score = _assignment_score(a, student_id)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if progress >= 1.0:
        status = "completed"
    elif a.get("due_date") and a["due_date"] < today:
        status = "overdue"
    else:
        status = "pending"
    return {
        "assignment_id": a["assignment_id"], "title": a["title"], "kind": a["kind"], "ref_id": a["ref_id"],
        "ref_title": assignment_ref_title(a["kind"], a["ref_id"]), "level": a.get("level"),
        "target_count": a.get("target_count"), "instructions": a.get("instructions"), "due_date": a.get("due_date"),
        "created_at": a["created_at"], "status": status, "progress": round(progress, 3), "detail": detail,
        "completed_at": completed_at, "score": score,
    }


def student_assignments(student_id):
    rows = fetch_dicts(
        "SELECT a.* FROM assignments a JOIN assignment_targets t ON t.assignment_id = a.assignment_id "
        "WHERE t.student_id = ? ORDER BY COALESCE(a.due_date, '9999') ASC, a.created_at DESC",
        (student_id,),
    )
    return [assignment_for_student(a, student_id) for a in rows]


# ----------------------------------------------------------------- quizzes

def quiz_with_questions(quiz_id, include_answers=False):
    quiz = fetch_dict("SELECT * FROM quizzes WHERE quiz_id = ?", (quiz_id,))
    if not quiz:
        return None
    qs = fetch_dicts("SELECT id, position, question, options, correct_answer, points, source_question_id, concept_id "
                     "FROM quiz_questions WHERE quiz_id = ? ORDER BY position", (quiz_id,))
    questions = []
    for q in qs:
        item = {"id": q["id"], "position": q["position"], "question": q["question"],
                "options": json.loads(q["options"]), "points": q["points"], "concept_id": q.get("concept_id")}
        if include_answers:
            item["correct_answer"] = q["correct_answer"]
            item["source_question_id"] = q.get("source_question_id")
        questions.append(item)
    quiz["questions"] = questions
    quiz["max_score"] = sum(q["points"] for q in qs)
    return quiz


def save_quiz(teacher_id, data, quiz_id=None):
    questions = data["questions"]
    if not questions:
        raise ServiceError("Add at least one question.", 422)
    for i, q in enumerate(questions, 1):
        opts = [str(o).strip() for o in q["options"] if str(o).strip()]
        if len(opts) < 2:
            raise ServiceError(f"Question {i} needs at least 2 options.", 422)
        if len(set(opts)) != len(opts):
            raise ServiceError(f"Question {i} has duplicate options.", 422)
        if str(q["correct_answer"]).strip() not in opts:
            raise ServiceError(f"Question {i}: the correct answer must be one of the options.", 422)
        q["options"] = opts
    connection = get_connection()
    try:
        cur = connection.cursor()
        if quiz_id is None:
            cur.execute(
                "INSERT INTO quizzes (teacher_id, title, subject, student_class, time_limit_sec, quiz_type, lesson_id, "
                "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (teacher_id, data["title"], data["subject"], data["student_class"], data.get("time_limit_sec"),
                 data.get("quiz_type") or "quiz", data.get("lesson_id"), now_utc()),
            )
            quiz_id = cur.lastrowid
        else:
            cur.execute("UPDATE quizzes SET title = ?, subject = ?, student_class = ?, time_limit_sec = ? "
                        "WHERE quiz_id = ? AND teacher_id = ?",
                        (data["title"], data["subject"], data["student_class"], data.get("time_limit_sec"),
                         quiz_id, teacher_id))
            cur.execute("DELETE FROM quiz_questions WHERE quiz_id = ?", (quiz_id,))
        for pos, q in enumerate(questions, 1):
            cur.execute(
                "INSERT INTO quiz_questions (quiz_id, position, question, options, correct_answer, points, "
                "source_question_id, concept_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (quiz_id, pos, q["question"].strip(), json.dumps(q["options"], ensure_ascii=False),
                 str(q["correct_answer"]).strip(), q.get("points") or 1, q.get("question_id"), q.get("concept_id")),
            )
        connection.commit()
    finally:
        connection.close()
    return quiz_with_questions(quiz_id, include_answers=True)


def grade_quiz(quiz_id, student_id, answers):
    quiz = quiz_with_questions(quiz_id, include_answers=True)
    if not quiz:
        raise ServiceError("Quiz not found.", 404)
    results, score = [], 0
    for q in quiz["questions"]:
        given = answers.get(str(q["id"])) if isinstance(answers, dict) else None
        correct = bool(given) and check_answer(given, q["correct_answer"], q["options"])
        if correct:
            score += q["points"]
        results.append({"id": q["id"], "question": q["question"], "your_answer": given,
                        "correct_answer": q["correct_answer"], "is_correct": correct, "points": q["points"]})
    execute_commit(
        "INSERT INTO quiz_submissions (quiz_id, student_id, score, max_score, answers, submitted_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (quiz_id, student_id, score, quiz["max_score"], json.dumps(answers, ensure_ascii=False), now_utc()),
    )
    execute_commit("UPDATE students SET last_active = ?, coins = coins + ? WHERE student_id = ?",
                   (now_utc(), score, student_id))
    performance = _record_quiz_performance(student_id, quiz, results)
    return {"quiz_id": quiz_id, "title": quiz["title"], "score": score, "max_score": quiz["max_score"],
            "percentage": round(score / quiz["max_score"] * 100) if quiz["max_score"] else 0, "results": results,
            **performance}


def _record_quiz_performance(student_id, quiz, results):
    """Accuracy = correct answers / total questions x 100. Answers to questions that come from the
    curriculum question bank are also saved as attempts, so chapter-wise mastery and weak concepts update."""
    from mastery_engine import calculate_mastery
    from weak_concept_detector import get_weak_concepts

    by_id = {q["id"]: q for q in quiz["questions"]}
    total = len(results)
    correct_count = sum(1 for r in results if r["is_correct"])
    when = now_utc()
    bank_ids = {row[0] for row in fetch_all(
        "SELECT question_id FROM questions WHERE question_id IN ({})".format(",".join("?" * len(by_id)) or "''"),
        [q.get("source_question_id") for q in by_id.values()]
    )} if by_id else set()

    rows = []
    for r in results:
        qid = by_id[r["id"]].get("source_question_id")
        if qid in bank_ids:
            rows.append((student_id, qid, r["your_answer"] or "", 1 if r["is_correct"] else 0, when))
    if rows:
        connection = get_connection()
        try:
            cur = connection.cursor()
            cur.executemany("INSERT INTO attempts (student_id, question_id, student_answer, is_correct, attempt_time, "
                            "source) VALUES (?, ?, ?, ?, ?, 'quiz')", rows)
            connection.commit()
        finally:
            connection.close()

    per_concept = {}
    for r in results:
        cid = by_id[r["id"]].get("concept_id")
        if not cid:
            continue
        c = per_concept.setdefault(cid, {"correct": 0, "total": 0})
        c["total"] += 1
        c["correct"] += 1 if r["is_correct"] else 0
    names = {row["concept_id"]: row for row in fetch_dicts(
        "SELECT c.concept_id, c.name, c.lesson_id, l.lesson_name FROM concepts c JOIN lessons l ON l.lesson_id = c.lesson_id "
        "WHERE c.concept_id IN ({})".format(",".join("?" * len(per_concept)) or "''"), list(per_concept))} if per_concept else {}
    concept_results = []
    for cid, c in per_concept.items():
        mastery = calculate_mastery(student_id, cid)
        concept_results.append({
            "concept_id": cid, "concept_name": names.get(cid, {}).get("name", cid),
            "correct": c["correct"], "total": c["total"],
            "accuracy": round(c["correct"] / c["total"] * 100) if c["total"] else 0,
            "mastery_status": mastery["status"], "mastery_accuracy": mastery["accuracy"],
        })
    lesson_ids = sorted({n["lesson_id"] for n in names.values()})
    weak = get_weak_concepts(student_id, lesson_ids) if lesson_ids else []
    return {
        "correct_count": correct_count,
        "total_questions": total,
        "accuracy": round(correct_count / total * 100, 1) if total else 0.0,
        "attempts_recorded": len(rows),
        "concept_results": concept_results,
        "weak_concepts": [{"concept_id": w["concept_id"], "concept_name": w["concept_name"], "accuracy": w["accuracy"],
                           "status": w["status"]} for w in weak],
    }


# ----------------------------------------------------------------- analytics

# ----------------------------------------------------------------- resume points & history

RESUME_MAX_BYTES = 16_000


def save_resume(student_id, key, state, label=None):
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(payload.encode("utf-8")) > RESUME_MAX_BYTES:
        raise ServiceError("Saved progress is too large.", 413)
    execute_commit(
        "INSERT INTO resume_state (student_id, key, label, state, updated_at) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(student_id, key) DO UPDATE SET label = excluded.label, state = excluded.state, "
        "updated_at = excluded.updated_at",
        (student_id, key, (label or "")[:120] or None, payload, now_utc()),
    )
    return get_resume(student_id, key)


def get_resume(student_id, key):
    row = fetch_dict("SELECT key, label, state, updated_at FROM resume_state WHERE student_id = ? AND key = ?",
                     (student_id, key))
    if not row:
        return None
    row["state"] = json.loads(row["state"])
    return row


def list_resume(student_id, limit=5):
    rows = fetch_dicts("SELECT key, label, state, updated_at FROM resume_state WHERE student_id = ? "
                       "ORDER BY updated_at DESC LIMIT ?", (student_id, limit))
    for r in rows:
        r["state"] = json.loads(r["state"])
    return rows


def clear_resume(student_id, key):
    execute_commit("DELETE FROM resume_state WHERE student_id = ? AND key = ?", (student_id, key))


def student_history(student_id, limit=30):
    """Recent answers, quiz results and game rounds, newest first (read-only)."""
    answers = fetch_dicts(
        """
        SELECT a.attempt_time AS at, a.question_id, q.question, a.student_answer, a.is_correct, a.source,
               c.name AS concept_name, l.lesson_id, l.lesson_name, l.subject
        FROM attempts a JOIN questions q ON q.question_id = a.question_id
        JOIN concepts c ON c.concept_id = q.concept_id JOIN lessons l ON l.lesson_id = c.lesson_id
        WHERE a.student_id = ? ORDER BY a.attempt_time DESC, a.attempt_id DESC LIMIT ?
        """,
        (student_id, limit),
    )
    quizzes = fetch_dicts(
        "SELECT s.submitted_at AS at, s.quiz_id, q.title, q.subject, s.score, s.max_score FROM quiz_submissions s "
        "JOIN quizzes q ON q.quiz_id = s.quiz_id WHERE s.student_id = ? ORDER BY s.submitted_at DESC LIMIT ?",
        (student_id, limit),
    )
    games = fetch_dicts(
        "SELECT created_at AS at, game_id, level, score, stars, completed_challenges, total_challenges "
        "FROM game_attempts WHERE student_id = ? ORDER BY created_at DESC LIMIT ?",
        (student_id, limit),
    )
    for a in answers:
        a["is_correct"] = bool(a["is_correct"])
    return {"answers": answers, "quizzes": quizzes, "games": games}


def student_summary(student_id):
    row = fetch_one(
        "SELECT COUNT(*), COALESCE(SUM(is_correct), 0), MAX(attempt_time) FROM attempts WHERE student_id = ?",
        (student_id,),
    )
    games = fetch_one("SELECT COUNT(*), COALESCE(SUM(stars), 0) FROM game_attempts WHERE student_id = ?",
                      (student_id,))
    mastered = fetch_one(
        """
        SELECT COUNT(*) FROM (
            SELECT q.concept_id, SUM(a.is_correct) * 100.0 / COUNT(*) AS acc FROM attempts a
            JOIN questions q ON q.question_id = a.question_id WHERE a.student_id = ? GROUP BY q.concept_id
        ) WHERE acc >= 80
        """,
        (student_id,),
    )[0]
    total, correct = row[0], row[1]
    return {
        "attempts": total,
        "correct": correct,
        "accuracy": round(correct / total * 100, 1) if total else 0.0,
        "last_practice": row[2],
        "games_played": games[0],
        "game_stars": games[1],
        "mastered_concepts": mastered,
    }


def teacher_analytics(teacher_id):
    students = fetch_dicts("SELECT * FROM students WHERE teacher_id = ? ORDER BY name", (teacher_id,))
    ids = [s["student_id"] for s in students]
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    per_student = []
    for s in students:
        summary = student_summary(s["student_id"])
        per_student.append({"student_id": s["student_id"], "name": s["name"], "student_class": s["student_class"],
                            "roll_no": s.get("roll_no"), "last_active": s.get("last_active"), **summary,
                            "active_this_week": bool(s.get("last_active") and s["last_active"] >= week_ago)})
    result = {
        "total_students": len(students),
        "active_this_week": sum(1 for p in per_student if p["active_this_week"]),
        "total_attempts": sum(p["attempts"] for p in per_student),
        "average_accuracy": (round(sum(p["accuracy"] for p in per_student if p["attempts"]) /
                                   sum(1 for p in per_student if p["attempts"]), 1)
                             if any(p["attempts"] for p in per_student) else None),
        "games_played": sum(p["games_played"] for p in per_student),
        "students": per_student,
        "subjects": [],
        "struggling_concepts": [],
        "daily_activity": [],
        "quiz_average": None,
    }
    if not ids:
        return result
    marks = ",".join("?" * len(ids))
    subj = fetch_dicts(
        f"""
        SELECT l.subject, COUNT(*) AS attempts, SUM(a.is_correct) AS correct, COUNT(DISTINCT a.student_id) AS learners
        FROM attempts a JOIN questions q ON q.question_id = a.question_id
        JOIN concepts c ON c.concept_id = q.concept_id JOIN lessons l ON l.lesson_id = c.lesson_id
        WHERE a.student_id IN ({marks}) GROUP BY l.subject
        """, ids)
    result["subjects"] = [{"subject": r["subject"], "attempts": r["attempts"], "learners": r["learners"],
                           "accuracy": round(r["correct"] / r["attempts"] * 100, 1)} for r in subj]
    concept_rows = fetch_dicts(
        f"""
        SELECT c.concept_id, c.name, l.subject, l.lesson_name, a.student_id,
               COUNT(*) AS n, SUM(a.is_correct) AS ok
        FROM attempts a JOIN questions q ON q.question_id = a.question_id
        JOIN concepts c ON c.concept_id = q.concept_id JOIN lessons l ON l.lesson_id = c.lesson_id
        WHERE a.student_id IN ({marks}) GROUP BY c.concept_id, a.student_id
        """, ids)
    agg = {}
    for r in concept_rows:
        item = agg.setdefault(r["concept_id"], {"concept_id": r["concept_id"], "concept_name": r["name"],
                                                "subject": r["subject"], "lesson_name": r["lesson_name"],
                                                "attempts": 0, "correct": 0, "struggling_students": 0,
                                                "learners": 0})
        item["attempts"] += r["n"]
        item["correct"] += r["ok"]
        item["learners"] += 1
        if r["ok"] * 100.0 / r["n"] < 50:
            item["struggling_students"] += 1
    concepts = []
    for item in agg.values():
        item["accuracy"] = round(item["correct"] / item["attempts"] * 100, 1)
        concepts.append(item)
    concepts.sort(key=lambda c: (-c["struggling_students"], c["accuracy"]))
    result["struggling_concepts"] = [c for c in concepts if c["accuracy"] < 80][:8]

    since = (datetime.now(timezone.utc) - timedelta(days=13)).strftime("%Y-%m-%d")
    daily = {r[0]: r[1] for r in fetch_all(
        f"SELECT substr(attempt_time, 1, 10) AS d, COUNT(*) FROM attempts WHERE student_id IN ({marks}) "
        f"AND attempt_time >= ? GROUP BY d", ids + [since])}
    games_daily = {r[0]: r[1] for r in fetch_all(
        f"SELECT substr(created_at, 1, 10) AS d, COUNT(*) FROM game_attempts WHERE student_id IN ({marks}) "
        f"AND created_at >= ? GROUP BY d", ids + [since])}
    start = datetime.now(timezone.utc).date() - timedelta(days=13)
    result["daily_activity"] = [
        {"date": (start + timedelta(days=i)).isoformat(),
         "attempts": daily.get((start + timedelta(days=i)).isoformat(), 0),
         "games": games_daily.get((start + timedelta(days=i)).isoformat(), 0)}
        for i in range(14)
    ]
    quiz = fetch_one(
        f"SELECT AVG(score * 100.0 / max_score) FROM quiz_submissions s JOIN quizzes q ON q.quiz_id = s.quiz_id "
        f"WHERE q.teacher_id = ? AND s.student_id IN ({marks}) AND s.max_score > 0", [teacher_id] + ids)
    result["quiz_average"] = round(quiz[0], 1) if quiz and quiz[0] is not None else None
    return result
