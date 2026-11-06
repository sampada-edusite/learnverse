"""Educational games API (Maths and Marathi), backed by games_engine."""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import games_engine

router = APIRouter(prefix="/games", tags=["games"])


class StartBody(BaseModel):
    student_id: str = Field(..., min_length=1)
    level: int = Field(1, ge=1, le=games_engine.LEVELS)


class AnswerBody(BaseModel):
    challenge_id: str
    answer: str


class FinishBody(BaseModel):
    time_taken_sec: Optional[int] = Field(None, ge=0, le=7200)


def _err(exc: games_engine.GameError):
    return HTTPException(status_code=exc.status, detail=str(exc))


@router.get("")
def list_games(student_id: Optional[str] = None, subject: Optional[str] = None):
    return {"games": games_engine.catalog(student_id, subject), "levels": games_engine.LEVELS,
            "badges": games_engine.student_badges(student_id) if student_id else [],
            "coins": games_engine.total_coins(student_id) if student_id else 0}


@router.get("/{game_id}")
def game_detail(game_id: str, student_id: Optional[str] = None):
    game = games_engine.GAMES_BY_ID.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    item = games_engine.public_game(game)
    if student_id:
        item["levels"] = games_engine.level_progress(student_id, game_id)
    return item


@router.post("/{game_id}/start")
def start(game_id: str, body: StartBody):
    try:
        return games_engine.start_game(body.student_id, game_id, body.level)
    except games_engine.GameError as exc:
        raise _err(exc)


@router.post("/sessions/{session_id}/answer")
def answer(session_id: str, body: AnswerBody):
    try:
        return games_engine.answer_challenge(session_id, body.challenge_id, body.answer)
    except games_engine.GameError as exc:
        raise _err(exc)


@router.post("/sessions/{session_id}/finish")
def finish(session_id: str, body: FinishBody = FinishBody()):
    try:
        return games_engine.finish_game(session_id, body.time_taken_sec)
    except games_engine.GameError as exc:
        raise _err(exc)
