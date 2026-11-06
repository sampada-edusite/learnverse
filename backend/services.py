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
        WHERE a.student_id = ? AND c.lesson_id = ? AND a.attempt_time >= ?
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
        r = fetch_dict("SELECT title, subject FROM quizzes WHERE quiz_id = ?", (int(ref_id),))
        return f"Quiz · {r['title']}" if r else f"Quiz #{ref_id}"
    from games_engine import GAMES_BY_ID
    g = GAMES_BY_ID.get(ref_id)
    return f"Game · {g['title']}" if g else ref_id


def assignment_for_student(a, student_id):
    progress, detail, completed_at = _assignment_progress(a, student_id)
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
        "completed_at": completed_at,
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
    qs = fetch_dicts("SELECT id, position, question, options, correct_answer, points FROM quiz_questions "
                     "WHERE quiz_id = ? ORDER BY position", (quiz_id,))
    questions = []
    for q in qs:
        item = {"id": q["id"], "position": q["position"], "question": q["question"],
                "options": json.loads(q["options"]), "points": q["points"]}
        if include_answers:
            item["correct_answer"] = q["correct_answer"]
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
                "INSERT INTO quizzes (teacher_id, title, subject, student_class, time_limit_sec, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (teacher_id, data["title"], data["subject"], data["student_class"], data.get("time_limit_sec"),
                 now_utc()),
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
                "INSERT INTO quiz_questions (quiz_id, position, question, options, correct_answer, points) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (quiz_id, pos, q["question"].strip(), json.dumps(q["options"], ensure_ascii=False),
                 str(q["correct_answer"]).strip(), q.get("points") or 1),
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
    return {"quiz_id": quiz_id, "title": quiz["title"], "score": score, "max_score": quiz["max_score"],
            "percentage": round(score / quiz["max_score"] * 100) if quiz["max_score"] else 0, "results": results}


# ----------------------------------------------------------------- analytics

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
