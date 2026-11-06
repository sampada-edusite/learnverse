"""SamSukh LearnVerse API.

Run:  uvicorn main:app --host 0.0.0.0 --port 8000   (from the backend/ folder)
"""
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import games_engine
import services
from adaptive_engine import get_next_activity
from content import SUBJECTS
from database import fetch_all, fetch_dict, fetch_dicts, fetch_one
from game_progress import get_game_attempts, save_game_attempt
from get_question import get_question_record, to_student_payload
from learning_session import sanitize_response, submit_answer, submit_speech_answer
from mastery_engine import calculate_mastery
from routers import auth_routes, games, students, teacher
from speech_to_text import speech_to_text
from weak_concept_detector import get_weak_concepts

app = FastAPI(title="SamSukh LearnVerse API", version="2.0.0",
              description="Adaptive learning, Maharashtra Board curriculum, games and teacher dashboard.")

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(students.router)
app.include_router(teacher.router)
app.include_router(games.router)


# ----------------------------------------------------------------- models

class AnswerRequest(BaseModel):
    student_id: str = Field(..., min_length=1)
    question_id: str = Field(..., min_length=1)
    student_answer: str
    lesson_id: Optional[str] = None
    exclude: Optional[List[str]] = None


class SpeechRequest(BaseModel):
    audio_input: Optional[str] = None
    language: str = "en"


class SpeechAnswerRequest(BaseModel):
    student_id: str
    question_id: str
    audio_input: Optional[str] = None
    language: str = "en"
    lesson_id: Optional[str] = None


class ChallengeDetail(BaseModel):
    challenge_index: int = 0
    question_id: Optional[str] = None
    concept_id: Optional[str] = None
    student_answer: Optional[str] = None
    is_correct: bool = False
    attempts_count: int = 1


class GameAttemptRequest(BaseModel):
    student_id: str
    game_id: str = Field(..., min_length=1)
    lesson_id: Optional[str] = None
    level: int = Field(1, ge=1, le=10)
    score: int = Field(..., ge=0, le=100)
    stars: int = Field(..., ge=1, le=3)
    completed_challenges: int = Field(..., ge=0)
    total_challenges: int = Field(..., ge=0)
    is_completed: bool = True
    challenges: Optional[List[ChallengeDetail]] = None
    record_mastery: bool = False


# ----------------------------------------------------------------- health & curriculum

@app.get("/health")
def health():
    return {"status": "ok", "service": "SamSukh LearnVerse API", "version": app.version}


@app.get("/subjects")
def subjects():
    out = []
    for s in SUBJECTS:
        classes = [r[0] for r in fetch_all("SELECT DISTINCT class FROM lessons WHERE subject = ? ORDER BY class",
                                           (s["subject"],))]
        lessons = fetch_one("SELECT COUNT(*) FROM lessons WHERE subject = ?", (s["subject"],))[0]
        games_count = sum(1 for g in games_engine.GAMES if g["subject"] == s["subject"])
        out.append({**s, "classes": classes, "lesson_count": lessons, "game_count": games_count})
    return {"subjects": out, "board": "Maharashtra State Board (Balbharati)"}


def _lessons_payload(subject=None, class_level=None):
    query = "SELECT * FROM lessons WHERE 1=1"
    params = []
    if subject:
        query += " AND subject = ?"
        params.append(subject)
    if class_level:
        query += " AND class = ?"
        params.append(class_level)
    query += " ORDER BY sort_order"
    lessons = fetch_dicts(query, params)
    concepts = fetch_dicts(
        "SELECT c.concept_id, c.lesson_id, c.name, c.objective, c.difficulty, "
        "(SELECT COUNT(*) FROM questions q WHERE q.concept_id = c.concept_id) AS question_count "
        "FROM concepts c ORDER BY c.sort_order")
    by_lesson = {}
    for c in concepts:
        by_lesson.setdefault(c.pop("lesson_id"), []).append(c)
    return [{
        "lesson_id": l["lesson_id"], "class": l["class"], "subject": l["subject"], "unit": l.get("unit"),
        "chapter_no": l.get("chapter_no"), "lesson_name": l["lesson_name"],
        "lesson_name_local": l.get("lesson_name_local"), "description": l.get("description"),
        "working_video_url": l.get("working_video_url"), "working_video_title": l.get("working_video_title"),
        "concepts": by_lesson.get(l["lesson_id"], []),
    } for l in lessons]


@app.get("/lessons")
def lessons(subject: Optional[str] = None, class_level: Optional[int] = Query(None, ge=1, le=10)):
    return {"lessons": _lessons_payload(subject, class_level)}


@app.get("/lessons/{lesson_id}")
def lesson_detail(lesson_id: str):
    items = [l for l in _lessons_payload() if l["lesson_id"] == lesson_id]
    if not items:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    lesson = items[0]
    lesson["games"] = [games_engine.public_game(g) for g in games_engine.GAMES if g["lesson_id"] == lesson_id]
    return lesson


# ----------------------------------------------------------------- adaptive learning

@app.get("/question/{question_id}")
def question(question_id: str):
    record = get_question_record(question_id)
    if not record:
        raise HTTPException(status_code=404, detail="Question not found.")
    return to_student_payload(record)


@app.get("/next-question/{student_id}")
def next_question(student_id: str, lesson_id: Optional[str] = None, subject: Optional[str] = None,
                  exclude: Optional[str] = None):
    excluded = [e for e in (exclude or "").split(",") if e]
    activity = get_next_activity(student_id, lesson_id=lesson_id, subject=subject, exclude=excluded)
    return sanitize_response({
        "student_id": student_id,
        "activity_type": activity["action"],
        "concept_id": activity.get("concept_id"),
        "concept_name": activity.get("concept_name"),
        "reason": activity.get("reason"),
        "question": activity.get("question"),
    })


@app.post("/answer")
def answer(body: AnswerRequest):
    if not body.student_answer or not body.student_answer.strip():
        raise HTTPException(status_code=400, detail="student_answer must not be empty.")
    if not get_question_record(body.question_id):
        raise HTTPException(status_code=404, detail="Question not found.")
    return submit_answer(body.student_id, body.question_id, body.student_answer, lesson_id=body.lesson_id,
                         exclude=body.exclude)


@app.get("/mastery/{student_id}/{concept_id}")
def mastery(student_id: str, concept_id: str):
    if not fetch_dict("SELECT 1 AS x FROM concepts WHERE concept_id = ?", (concept_id,)):
        raise HTTPException(status_code=404, detail="Concept not found.")
    return calculate_mastery(student_id, concept_id)


@app.get("/weak-concepts/{student_id}")
def weak_concepts(student_id: str):
    return {"student_id": student_id, "weak_concepts": get_weak_concepts(student_id)}


@app.post("/speech-to-text")
def stt(body: SpeechRequest):
    return speech_to_text(body.audio_input, language=body.language)


@app.post("/speech-answer")
def speech_answer(body: SpeechAnswerRequest):
    return submit_speech_answer(body.student_id, body.question_id, body.audio_input, body.language, body.lesson_id)


@app.get("/dashboard-summary/{student_id}")
def dashboard_summary(student_id: str):
    row = fetch_one("SELECT COUNT(*), COALESCE(SUM(is_correct), 0) FROM attempts WHERE student_id = ?",
                    (student_id,))
    total, correct = row[0], row[1]
    weak = get_weak_concepts(student_id)
    activity = get_next_activity(student_id)
    student = services.get_student_row(student_id)
    assignments = services.student_assignments(student_id) if student else []
    return sanitize_response({
        "student_id": student_id,
        "total_attempts": total,
        "correct_attempts": correct,
        "overall_accuracy": round(correct / total * 100, 1) if total else 0.0,
        "weak_concepts_count": len(weak),
        "weak_concepts": weak[:5],
        "next_activity": {"student_id": student_id, "activity_type": activity["action"],
                          "concept_id": activity.get("concept_id"), "concept_name": activity.get("concept_name"),
                          "reason": activity.get("reason"), "question": activity.get("question")},
        "total_lessons": fetch_one("SELECT COUNT(*) FROM lessons")[0],
        "subjects": services.subject_breakdown(student_id),
        "coins": student["coins"] if student else 0,
        "streak_days": services.streak_days(student_id),
        "badges": games_engine.student_badges(student_id),
        "pending_assignments": [a for a in assignments if a["status"] != "completed"][:5],
        "games_played": fetch_one("SELECT COUNT(*) FROM game_attempts WHERE student_id = ?", (student_id,))[0],
    })


# ----------------------------------------------------------------- game persistence (English Unit 1 game)

@app.post("/game/save-attempt")
def game_save_attempt(body: GameAttemptRequest):
    if not body.student_id.strip():
        raise HTTPException(status_code=400, detail="student_id must not be empty.")
    if body.completed_challenges > body.total_challenges:
        raise HTTPException(status_code=400, detail="completed_challenges cannot exceed total_challenges.")
    details = [c.model_dump() for c in body.challenges] if body.challenges else None
    record = save_game_attempt(body.student_id, body.game_id, lesson_id=body.lesson_id, score=body.score,
                               stars=body.stars, completed_challenges=body.completed_challenges,
                               total_challenges=body.total_challenges, is_completed=body.is_completed,
                               details=details, record_mastery=body.record_mastery, level=body.level)
    return sanitize_response({"success": True, **record})


@app.get("/game/attempts/{student_id}")
def game_attempts(student_id: str, game_id: Optional[str] = None):
    return sanitize_response({"student_id": student_id, "attempts": get_game_attempts(student_id, game_id)})
