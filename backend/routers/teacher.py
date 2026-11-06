"""Teacher dashboard API: students, assignments, quizzes and analytics (authenticated)."""
import random
from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

import auth
import games_engine
import services
from database import execute_commit, fetch_all, fetch_dict, fetch_dicts, get_connection, now_utc
from routers.auth_routes import current_teacher, teacher_public
from routers.students import parse_class

router = APIRouter(prefix="/teacher", tags=["teacher"])


class StudentIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    student_class: Union[int, str] = 1
    parent_mobile: str
    nickname: Optional[str] = Field(None, max_length=20)
    roll_no: Optional[str] = Field(None, max_length=10)

    @field_validator("student_class")
    @classmethod
    def _cls(cls, v):
        return parse_class(v)


class AssignmentIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    kind: Literal["lesson", "quiz", "game"]
    ref_id: str
    level: Optional[int] = Field(None, ge=1, le=games_engine.LEVELS)
    target_count: Optional[int] = Field(None, ge=1, le=50)
    instructions: Optional[str] = Field(None, max_length=500)
    due_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    student_ids: List[str] = []


class QuizQuestionIn(BaseModel):
    question: str = Field(..., min_length=2, max_length=300)
    options: List[str] = Field(..., min_length=2, max_length=6)
    correct_answer: str
    points: int = Field(1, ge=1, le=10)


class QuizIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    subject: Literal["English", "Mathematics", "Marathi"]
    student_class: int = Field(1, ge=1, le=10)
    time_limit_sec: Optional[int] = Field(None, ge=30, le=3600)
    questions: List[QuizQuestionIn] = Field(..., min_length=1, max_length=50)


class QuizGenerate(BaseModel):
    lesson_id: str
    count: int = Field(5, ge=1, le=20)


def _err(exc):
    return HTTPException(status_code=exc.status, detail=str(exc))


def own_student(teacher, student_id):
    row = fetch_dict("SELECT * FROM students WHERE student_id = ? AND teacher_id = ?",
                     (student_id, teacher["teacher_id"]))
    if not row:
        raise HTTPException(status_code=404, detail="Student not found in your class.")
    return row


# ----------------------------------------------------------------- overview & catalog

@router.get("/overview")
def overview(teacher=Depends(current_teacher)):
    return {"teacher": teacher_public(teacher), "analytics": services.teacher_analytics(teacher["teacher_id"])}


@router.get("/catalog")
def catalog(teacher=Depends(current_teacher)):
    lessons = fetch_dicts("SELECT lesson_id, class, subject, chapter_no, lesson_name, lesson_name_local "
                          "FROM lessons ORDER BY sort_order")
    quizzes = fetch_dicts("SELECT quiz_id, title, subject, student_class FROM quizzes WHERE teacher_id = ? "
                          "ORDER BY created_at DESC", (teacher["teacher_id"],))
    return {"lessons": lessons, "games": games_engine.catalog(), "quizzes": quizzes,
            "levels": games_engine.LEVELS}


# ----------------------------------------------------------------- students

@router.get("/students")
def list_students(teacher=Depends(current_teacher)):
    rows = fetch_dicts("SELECT * FROM students WHERE teacher_id = ? ORDER BY student_class, roll_no, name",
                       (teacher["teacher_id"],))
    out = []
    for r in rows:
        item = services.public_student(r)
        item["parent_mobile"] = r["parent_mobile"]
        item["summary"] = services.student_summary(r["student_id"])
        out.append(item)
    return {"students": out, "class_code": teacher["class_code"]}


@router.post("/students")
def add_student(body: StudentIn, teacher=Depends(current_teacher)):
    try:
        name = auth.clean_name(body.name)
        mobile = auth.normalize_mobile(body.parent_mobile)
    except auth.AuthError as exc:
        raise _err(exc)
    existing = services.find_student(name, mobile)
    if existing:
        if existing.get("teacher_id") and existing["teacher_id"] != teacher["teacher_id"]:
            raise HTTPException(status_code=409, detail="This student is already in another teacher's class.")
        execute_commit("UPDATE students SET teacher_id = ?, student_class = ?, roll_no = COALESCE(?, roll_no) "
                       "WHERE student_id = ?",
                       (teacher["teacher_id"], body.student_class, body.roll_no, existing["student_id"]))
        row = services.get_student_row(existing["student_id"])
    else:
        row = services.create_student(name, body.student_class, mobile, (body.nickname or "").strip() or None,
                                      teacher["teacher_id"], (body.roll_no or "").strip() or None)
    item = services.public_student(row)
    item["parent_mobile"] = row["parent_mobile"]
    return {"student": item}


@router.put("/students/{student_id}")
def update_student(student_id: str, body: StudentIn, teacher=Depends(current_teacher)):
    own_student(teacher, student_id)
    try:
        name = auth.clean_name(body.name)
        mobile = auth.normalize_mobile(body.parent_mobile)
    except auth.AuthError as exc:
        raise _err(exc)
    execute_commit(
        "UPDATE students SET name = ?, student_class = ?, parent_mobile = ?, nickname = ?, roll_no = ? "
        "WHERE student_id = ?",
        (name, body.student_class, mobile, (body.nickname or "").strip() or None,
         (body.roll_no or "").strip() or None, student_id),
    )
    row = services.get_student_row(student_id)
    item = services.public_student(row)
    item["parent_mobile"] = row["parent_mobile"]
    return {"student": item}


@router.delete("/students/{student_id}")
def remove_student(student_id: str, teacher=Depends(current_teacher)):
    """Removes the student from this class. The child's own learning history is kept."""
    own_student(teacher, student_id)
    connection = get_connection()
    try:
        cur = connection.cursor()
        cur.execute("UPDATE students SET teacher_id = NULL WHERE student_id = ?", (student_id,))
        cur.execute("DELETE FROM assignment_targets WHERE student_id = ? AND assignment_id IN "
                    "(SELECT assignment_id FROM assignments WHERE teacher_id = ?)", (student_id, teacher["teacher_id"]))
        connection.commit()
    finally:
        connection.close()
    return {"removed": True}


@router.get("/students/{student_id}/progress")
def student_progress(student_id: str, teacher=Depends(current_teacher)):
    row = own_student(teacher, student_id)
    from weak_concept_detector import get_weak_concepts
    from game_progress import get_game_attempts
    lessons = {s: services.lesson_progress(student_id, s) for s in ("English", "Mathematics", "Marathi")}
    quiz_results = fetch_dicts(
        "SELECT s.quiz_id, q.title, s.score, s.max_score, s.submitted_at FROM quiz_submissions s "
        "JOIN quizzes q ON q.quiz_id = s.quiz_id WHERE s.student_id = ? AND q.teacher_id = ? "
        "ORDER BY s.submitted_at DESC LIMIT 20", (student_id, teacher["teacher_id"]))
    recent = fetch_dicts(
        "SELECT a.question_id, q.question, a.student_answer, a.is_correct, a.attempt_time, c.name AS concept_name "
        "FROM attempts a JOIN questions q ON q.question_id = a.question_id "
        "JOIN concepts c ON c.concept_id = q.concept_id WHERE a.student_id = ? "
        "ORDER BY a.attempt_time DESC, a.attempt_id DESC LIMIT 15", (student_id,))
    student = services.public_student(row)
    student["parent_mobile"] = row["parent_mobile"]
    return {
        "student": student,
        "summary": services.student_summary(student_id),
        "streak_days": services.streak_days(student_id),
        "subjects": services.subject_breakdown(student_id),
        "lessons": lessons,
        "weak_concepts": get_weak_concepts(student_id)[:10],
        "games": [g for g in games_engine.catalog(student_id) if g["total_stars"] > 0],
        "recent_games": get_game_attempts(student_id, limit=10),
        "quiz_results": quiz_results,
        "recent_attempts": recent,
        "assignments": services.student_assignments(student_id),
        "badges": games_engine.student_badges(student_id),
    }


# ----------------------------------------------------------------- assignments

def _validate_ref(teacher, kind, ref_id):
    if kind == "lesson" and not fetch_dict("SELECT 1 AS x FROM lessons WHERE lesson_id = ?", (ref_id,)):
        raise HTTPException(status_code=422, detail="Unknown lesson.")
    if kind == "quiz":
        if not ref_id.isdigit() or not fetch_dict("SELECT 1 AS x FROM quizzes WHERE quiz_id = ? AND teacher_id = ?",
                                                  (int(ref_id), teacher["teacher_id"])):
            raise HTTPException(status_code=422, detail="Unknown quiz.")
    if kind == "game" and ref_id not in games_engine.GAMES_BY_ID:
        raise HTTPException(status_code=422, detail="Unknown game.")


@router.get("/assignments")
def list_assignments(teacher=Depends(current_teacher)):
    rows = fetch_dicts("SELECT * FROM assignments WHERE teacher_id = ? ORDER BY created_at DESC",
                       (teacher["teacher_id"],))
    out = []
    for a in rows:
        targets = [r[0] for r in fetch_all("SELECT student_id FROM assignment_targets WHERE assignment_id = ?",
                                           (a["assignment_id"],))]
        statuses = [services.assignment_for_student(a, sid)["status"] for sid in targets]
        out.append({**a, "ref_title": services.assignment_ref_title(a["kind"], a["ref_id"]),
                    "assigned": len(targets), "completed": statuses.count("completed"),
                    "overdue": statuses.count("overdue")})
    return {"assignments": out}


@router.post("/assignments")
def create_assignment(body: AssignmentIn, teacher=Depends(current_teacher)):
    _validate_ref(teacher, body.kind, body.ref_id)
    my_students = {r[0] for r in fetch_all("SELECT student_id FROM students WHERE teacher_id = ?",
                                           (teacher["teacher_id"],))}
    targets = set(body.student_ids) if body.student_ids else my_students
    if not targets:
        raise HTTPException(status_code=422, detail="Add students to your class before creating assignments.")
    if not targets <= my_students:
        raise HTTPException(status_code=422, detail="Some selected students are not in your class.")
    connection = get_connection()
    try:
        cur = connection.cursor()
        cur.execute(
            "INSERT INTO assignments (teacher_id, title, kind, ref_id, level, target_count, instructions, due_date, "
            "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (teacher["teacher_id"], body.title.strip(), body.kind, body.ref_id,
             body.level if body.kind == "game" else None,
             (body.target_count or services.DEFAULT_LESSON_TARGET) if body.kind == "lesson" else None,
             (body.instructions or "").strip() or None, body.due_date, now_utc()),
        )
        aid = cur.lastrowid
        cur.executemany("INSERT INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)",
                        [(aid, sid) for sid in sorted(targets)])
        connection.commit()
    finally:
        connection.close()
    return {"assignment": fetch_dict("SELECT * FROM assignments WHERE assignment_id = ?", (aid,)),
            "assigned": len(targets)}


@router.get("/assignments/{assignment_id}")
def assignment_detail(assignment_id: int, teacher=Depends(current_teacher)):
    a = fetch_dict("SELECT * FROM assignments WHERE assignment_id = ? AND teacher_id = ?",
                   (assignment_id, teacher["teacher_id"]))
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    rows = fetch_dicts("SELECT s.student_id, s.name, s.roll_no FROM assignment_targets t "
                       "JOIN students s ON s.student_id = t.student_id WHERE t.assignment_id = ? ORDER BY s.name",
                       (assignment_id,))
    students = [{**r, **{k: v for k, v in services.assignment_for_student(a, r["student_id"]).items()
                         if k in ("status", "progress", "detail", "completed_at")}} for r in rows]
    return {"assignment": {**a, "ref_title": services.assignment_ref_title(a["kind"], a["ref_id"])},
            "students": students}


@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, teacher=Depends(current_teacher)):
    a = fetch_dict("SELECT 1 AS x FROM assignments WHERE assignment_id = ? AND teacher_id = ?",
                   (assignment_id, teacher["teacher_id"]))
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    execute_commit("DELETE FROM assignment_targets WHERE assignment_id = ?", (assignment_id,))
    execute_commit("DELETE FROM assignments WHERE assignment_id = ?", (assignment_id,))
    return {"deleted": True}


# ----------------------------------------------------------------- quizzes

@router.get("/quizzes")
def list_quizzes(teacher=Depends(current_teacher)):
    rows = fetch_dicts(
        "SELECT q.*, (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.quiz_id) AS question_count, "
        "(SELECT COUNT(*) FROM quiz_submissions s WHERE s.quiz_id = q.quiz_id) AS submissions, "
        "(SELECT AVG(score * 100.0 / max_score) FROM quiz_submissions s WHERE s.quiz_id = q.quiz_id "
        " AND max_score > 0) AS average FROM quizzes q WHERE teacher_id = ? ORDER BY created_at DESC",
        (teacher["teacher_id"],))
    for r in rows:
        r["average"] = round(r["average"], 1) if r["average"] is not None else None
    return {"quizzes": rows}


@router.post("/quizzes")
def create_quiz(body: QuizIn, teacher=Depends(current_teacher)):
    try:
        return {"quiz": services.save_quiz(teacher["teacher_id"], body.model_dump())}
    except services.ServiceError as exc:
        raise _err(exc)


@router.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: int, teacher=Depends(current_teacher)):
    quiz = services.quiz_with_questions(quiz_id, include_answers=True)
    if not quiz or quiz["teacher_id"] != teacher["teacher_id"]:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    quiz["submissions"] = fetch_dicts(
        "SELECT s.submission_id, s.student_id, st.name, s.score, s.max_score, s.submitted_at FROM quiz_submissions s "
        "LEFT JOIN students st ON st.student_id = s.student_id WHERE s.quiz_id = ? ORDER BY s.submitted_at DESC",
        (quiz_id,))
    return {"quiz": quiz}


@router.put("/quizzes/{quiz_id}")
def update_quiz(quiz_id: int, body: QuizIn, teacher=Depends(current_teacher)):
    quiz = fetch_dict("SELECT teacher_id FROM quizzes WHERE quiz_id = ?", (quiz_id,))
    if not quiz or quiz["teacher_id"] != teacher["teacher_id"]:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    try:
        return {"quiz": services.save_quiz(teacher["teacher_id"], body.model_dump(), quiz_id=quiz_id)}
    except services.ServiceError as exc:
        raise _err(exc)


@router.delete("/quizzes/{quiz_id}")
def delete_quiz(quiz_id: int, teacher=Depends(current_teacher)):
    quiz = fetch_dict("SELECT teacher_id FROM quizzes WHERE quiz_id = ?", (quiz_id,))
    if not quiz or quiz["teacher_id"] != teacher["teacher_id"]:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    linked = fetch_dict("SELECT COUNT(*) AS n FROM assignments WHERE kind = 'quiz' AND ref_id = ?", (str(quiz_id),))
    if linked and linked["n"]:
        raise HTTPException(status_code=409, detail="Delete the assignments that use this quiz first.")
    execute_commit("DELETE FROM quiz_questions WHERE quiz_id = ?", (quiz_id,))
    execute_commit("DELETE FROM quizzes WHERE quiz_id = ?", (quiz_id,))
    return {"deleted": True}


@router.post("/quizzes/generate")
def generate_quiz_questions(body: QuizGenerate, teacher=Depends(current_teacher)):
    """Draft multiple-choice questions from a lesson's question bank for the teacher to review."""
    lesson = fetch_dict("SELECT lesson_id, lesson_name, subject, class FROM lessons WHERE lesson_id = ?",
                        (body.lesson_id,))
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    rows = fetch_dicts(
        "SELECT q.question, q.options, q.expected_answer FROM questions q JOIN concepts c ON c.concept_id = q.concept_id "
        "WHERE c.lesson_id = ? AND q.options IS NOT NULL", (body.lesson_id,))
    import json
    random.shuffle(rows)
    drafts = [{"question": r["question"], "options": json.loads(r["options"]), "correct_answer": r["expected_answer"],
               "points": 1} for r in rows[: body.count]]
    return {"lesson": lesson, "questions": drafts}
