"""Teacher registration and login with mobile OTP verification."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

import auth
import sms
from database import execute_commit, fetch_dict, now_utc

router = APIRouter(prefix="/auth/teacher", tags=["teacher-auth"])


class OtpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    mobile: str
    purpose: Literal["register", "login"]
    school: Optional[str] = Field(None, max_length=120)


class OtpVerify(BaseModel):
    mobile: str
    purpose: Literal["register", "login"]
    code: str = Field(..., min_length=4, max_length=8)


def teacher_public(row):
    return {"teacher_id": row["teacher_id"], "name": row["name"], "mobile": row["mobile"],
            "school": row.get("school"), "class_code": row.get("class_code"), "created_at": row.get("created_at")}


def _auth_error(exc: auth.AuthError):
    return HTTPException(status_code=exc.status, detail=str(exc))


def bearer_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please log in as a teacher.")
    return authorization.split(" ", 1)[1].strip()


def current_teacher(token: str = Depends(bearer_token)):
    session = auth.resolve_token(token)
    if not session or session["user_type"] != "teacher":
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")
    teacher = fetch_dict("SELECT * FROM teachers WHERE teacher_id = ?", (session["user_id"],))
    if not teacher:
        raise HTTPException(status_code=401, detail="Teacher account not found.")
    return teacher


@router.post("/request-otp")
def request_otp(body: OtpRequest):
    try:
        name = auth.clean_name(body.name)
        mobile = auth.normalize_mobile(body.mobile)
        existing = fetch_dict("SELECT * FROM teachers WHERE mobile = ?", (mobile,))
        if body.purpose == "register" and existing:
            raise auth.AuthError("This mobile number is already registered. Please log in instead.", 409)
        if body.purpose == "login":
            if not existing or not auth.names_match(existing["name"], name):
                raise auth.AuthError("No teacher account matches this name and mobile number.", 404)
        if auth.environment() == "production" and not sms.is_real_provider():
            raise auth.AuthError("SMS service is not configured on the server.", 503)
        code = auth.create_otp(mobile, body.purpose, {"name": name, "school": (body.school or "").strip() or None})
        try:
            sms.send_sms(mobile, f"{code} is your LearnVerse verification code. It expires in "
                                 f"{auth.OTP_TTL_MINUTES} minutes. Do not share it.")
        except sms.SmsError as exc:
            raise auth.AuthError(str(exc), 502)
    except auth.AuthError as exc:
        raise _auth_error(exc)

    response = {"sent": True, "mobile_masked": f"+91 {mobile[:2]}******{mobile[-2:]}",
                "expires_in_sec": auth.OTP_TTL_MINUTES * 60}
    if auth.environment() != "production" and not sms.is_real_provider():
        response["dev_otp"] = code
        response["dev_note"] = "Development mode: no SMS gateway configured, so the code is shown here."
    return response


@router.post("/verify-otp")
def verify_otp(body: OtpVerify):
    try:
        mobile = auth.normalize_mobile(body.mobile)
        payload = auth.consume_otp(mobile, body.purpose, body.code)
        if body.purpose == "register":
            if fetch_dict("SELECT 1 AS x FROM teachers WHERE mobile = ?", (mobile,)):
                raise auth.AuthError("This mobile number is already registered.", 409)
            teacher_id = "tch_" + auth.secrets.token_hex(5)
            execute_commit(
                "INSERT INTO teachers (teacher_id, name, mobile, school, class_code, created_at, last_login) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (teacher_id, payload["name"], mobile, payload.get("school"), auth.generate_class_code(), now_utc(),
                 now_utc()),
            )
        teacher = fetch_dict("SELECT * FROM teachers WHERE mobile = ?", (mobile,))
        if not teacher:
            raise auth.AuthError("Teacher account not found.", 404)
        execute_commit("UPDATE teachers SET last_login = ? WHERE teacher_id = ?", (now_utc(), teacher["teacher_id"]))
        token = auth.issue_token("teacher", teacher["teacher_id"])
    except auth.AuthError as exc:
        raise _auth_error(exc)
    return {"token": token, "teacher": teacher_public(teacher)}


@router.get("/me")
def me(teacher=Depends(current_teacher)):
    return {"teacher": teacher_public(teacher)}


@router.post("/logout")
def logout(token: str = Depends(bearer_token)):
    auth.revoke_token(token)
    return {"logged_out": True}
