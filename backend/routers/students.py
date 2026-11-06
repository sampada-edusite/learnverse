"""Student accounts, progress, assignments and quizzes."""
from typing import Dict, Optional, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

import auth
import games_engine
import services
from database import fetch_dict, fetch_one

router = APIRouter(prefix="/students", tags=["students"])


def parse_class(value) -> int:
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if not digits or not 1 <= int(digits) <= 10:
        raise ValueError("Class must be between 1 and 10.")
    return int(digits)


class StudentRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    student_class: Union[int, str] = 1
    parent_mobile: str
    nickname: Optional[str] = Field(None, max_length=20)
    class_code: Optional[str] = Field(None, max_length=12)

    @field_validator("student_class")
    @classmethod
    def _cls(cls, v):
        return parse_class(v)


class StudentLogin(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    parent_mobile: str


class QuizSubmit(BaseModel):
    answers: Dict[str, str]


def require_student(student_id):
    row = services.get_student_row(student_id)
    if not row:
        raise HTTPException(status_code=404, detail="Student not found.")
    return row


@router.post("/register")
def register(body: StudentRegister):
    try:
        name = auth.clean_name(body.name)
        mobile = auth.normalize_mobile(body.parent_mobile)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))
    teacher_id = None
    if body.class_code and body.class_code.strip():
        t = fetch_dict("SELECT teacher_id FROM teachers WHERE class_code = ?", (body.class_code.strip().upper(),))
        if not t:
            raise HTTPException(status_code=404, detail="Class code not found. Please check with your teacher.")
        teacher_id = t["teacher_id"]
    existing = services.find_student(name, mobile)
    if existing:
        if teacher_id and not existing.get("teacher_id"):
            from database import execute_commit
            execute_commit("UPDATE students SET teacher_id = ? WHERE student_id = ?",
                           (teacher_id, existing["student_id"]))
            existing = services.get_student_row(existing["student_id"])
        return {"student": services.public_student(existing), "existing": True}
    nickname = (body.nickname or "").strip() or None
    row = services.create_student(name, body.student_class, mobile, nickname, teacher_id)
    return {"student": services.public_student(row), "existing": False}


@router.post("/login")
def login(body: StudentLogin):
    try:
        name = auth.clean_name(body.name)
        mobile = auth.normalize_mobile(body.parent_mobile)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))
    row = services.find_student(name, mobile)
    if not row:
        raise HTTPException(status_code=404, detail="We couldn't find you. Check the name and parent's mobile number.")
    return {"student": services.public_student(row)}


@router.get("/{student_id}")
def profile(student_id: str):
    row = require_student(student_id)
    return {"student": services.public_student(row), "badges": games_engine.student_badges(student_id),
            "streak_days": services.streak_days(student_id), "summary": services.student_summary(student_id)}


@router.get("/{student_id}/progress")
def progress(student_id: str, subject: Optional[str] = None, class_level: Optional[int] = None):
    return {"student_id": student_id, "subjects": services.subject_breakdown(student_id),
            "lessons": services.lesson_progress(student_id, subject, class_level) if subject else []}


@router.get("/{student_id}/assignments")
def assignments(student_id: str):
    require_student(student_id)
    items = services.student_assignments(student_id)
    return {"student_id": student_id, "assignments": items,
            "pending": sum(1 for a in items if a["status"] != "completed")}


def _assigned_quiz_ids(student_id):
    from database import fetch_all
    return {int(r[0]) for r in fetch_all(
        "SELECT a.ref_id FROM assignments a JOIN assignment_targets t ON t.assignment_id = a.assignment_id "
        "WHERE t.student_id = ? AND a.kind = 'quiz'", (student_id,))}


@router.get("/{student_id}/quizzes/{quiz_id}")
def get_quiz(student_id: str, quiz_id: int):
    require_student(student_id)
    if quiz_id not in _assigned_quiz_ids(student_id):
        raise HTTPException(status_code=403, detail="This quiz has not been assigned to you.")
    quiz = services.quiz_with_questions(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    last = fetch_one("SELECT score, max_score FROM quiz_submissions WHERE quiz_id = ? AND student_id = ? "
                     "ORDER BY submitted_at DESC LIMIT 1", (quiz_id, student_id))
    quiz["last_score"] = {"score": last[0], "max_score": last[1]} if last else None
    return quiz


@router.post("/{student_id}/quizzes/{quiz_id}/submit")
def submit_quiz(student_id: str, quiz_id: int, body: QuizSubmit):
    require_student(student_id)
    if quiz_id not in _assigned_quiz_ids(student_id):
        raise HTTPException(status_code=403, detail="This quiz has not been assigned to you.")
    try:
        return services.grade_quiz(quiz_id, student_id, body.answers)
    except services.ServiceError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))
