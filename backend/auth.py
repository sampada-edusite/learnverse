"""Teacher authentication: name + mobile number verified with a one-time password.

- OTPs are 6 digits, stored only as an HMAC hash, valid for 5 minutes,
  allow 5 wrong guesses, and at most 5 OTP requests per mobile per hour.
- Successful verification issues a random bearer token (stored hashed) valid for 30 days.
- In development (LEARNVERSE_ENV != 'production') with the console SMS provider, the OTP is
  also returned in the API response so the app can be tested without an SMS gateway.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from database import execute_commit, fetch_dict, fetch_one, get_connection, now_utc

OTP_TTL_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
OTP_MAX_PER_HOUR = 5
TOKEN_TTL_DAYS = 30
FMT = "%Y-%m-%d %H:%M:%S"


class AuthError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def environment():
    return os.environ.get("LEARNVERSE_ENV", "development").lower()


_SECRET_CACHE = None


def _secret():
    global _SECRET_CACHE
    if _SECRET_CACHE:
        return _SECRET_CACHE
    env_secret = os.environ.get("LEARNVERSE_SECRET")
    if env_secret:
        _SECRET_CACHE = env_secret.encode()
        return _SECRET_CACHE
    row = fetch_one("SELECT value FROM meta WHERE key = 'auth_secret'")
    if not row:
        execute_commit("INSERT OR IGNORE INTO meta (key, value) VALUES ('auth_secret', ?)", (secrets.token_hex(32),))
        row = fetch_one("SELECT value FROM meta WHERE key = 'auth_secret'")
    _SECRET_CACHE = row[0].encode()
    return _SECRET_CACHE


def _hash(value: str) -> str:
    return hmac.new(_secret(), value.encode(), hashlib.sha256).hexdigest()


def _ts(delta: timedelta) -> str:
    return (datetime.now(timezone.utc) + delta).strftime(FMT)


def normalize_mobile(mobile) -> str:
    digits = re.sub(r"\D", "", str(mobile or ""))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise AuthError("Enter a valid 10-digit Indian mobile number.", 422)
    return digits


def clean_name(name) -> str:
    name = " ".join(str(name or "").split())
    if len(name) < 2 or len(name) > 60 or any(ch.isdigit() for ch in name):
        raise AuthError("Enter a valid name (2–60 letters).", 422)
    return name


def names_match(a: str, b: str) -> bool:
    return " ".join(a.split()).casefold() == " ".join(b.split()).casefold()


def create_otp(mobile: str, purpose: str, payload: dict) -> str:
    recent = fetch_one(
        "SELECT COUNT(*) FROM otp_requests WHERE mobile = ? AND created_at >= ?",
        (mobile, _ts(timedelta(hours=-1))),
    )[0]
    if recent >= OTP_MAX_PER_HOUR:
        raise AuthError("Too many OTP requests. Please wait an hour and try again.", 429)
    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = _hash(f"{mobile}:{purpose}:{code}")  # computed before opening the write transaction
    connection = get_connection()
    try:
        cur = connection.cursor()
        cur.execute("UPDATE otp_requests SET consumed = 1 WHERE mobile = ? AND purpose = ? AND consumed = 0",
                    (mobile, purpose))
        cur.execute(
            "INSERT INTO otp_requests (mobile, purpose, code_hash, payload, expires_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (mobile, purpose, code_hash, json.dumps(payload, ensure_ascii=False),
             _ts(timedelta(minutes=OTP_TTL_MINUTES)), now_utc()),
        )
        connection.commit()
    finally:
        connection.close()
    return code


def consume_otp(mobile: str, purpose: str, code: str) -> dict:
    row = fetch_dict(
        "SELECT * FROM otp_requests WHERE mobile = ? AND purpose = ? AND consumed = 0 ORDER BY id DESC LIMIT 1",
        (mobile, purpose),
    )
    if not row:
        raise AuthError("No active OTP. Please request a new code.", 400)
    if row["expires_at"] < now_utc():
        execute_commit("UPDATE otp_requests SET consumed = 1 WHERE id = ?", (row["id"],))
        raise AuthError("This OTP has expired. Please request a new code.", 400)
    if row["attempts"] >= OTP_MAX_ATTEMPTS:
        execute_commit("UPDATE otp_requests SET consumed = 1 WHERE id = ?", (row["id"],))
        raise AuthError("Too many wrong attempts. Please request a new code.", 429)
    code = re.sub(r"\D", "", str(code or ""))
    if not hmac.compare_digest(row["code_hash"], _hash(f"{mobile}:{purpose}:{code}")):
        execute_commit("UPDATE otp_requests SET attempts = attempts + 1 WHERE id = ?", (row["id"],))
        left = OTP_MAX_ATTEMPTS - row["attempts"] - 1
        raise AuthError(f"Incorrect OTP. {left} attempt{'s' if left != 1 else ''} left.", 401)
    execute_commit("UPDATE otp_requests SET consumed = 1 WHERE id = ?", (row["id"],))
    return json.loads(row["payload"] or "{}")


def issue_token(user_type: str, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    execute_commit(
        "INSERT INTO auth_tokens (token_hash, user_type, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (_hash(token), user_type, user_id, _ts(timedelta(days=TOKEN_TTL_DAYS)), now_utc()),
    )
    return token


def resolve_token(token: str):
    if not token:
        return None
    row = fetch_dict("SELECT user_type, user_id, expires_at FROM auth_tokens WHERE token_hash = ?", (_hash(token),))
    if not row or row["expires_at"] < now_utc():
        return None
    return row


def revoke_token(token: str):
    execute_commit("DELETE FROM auth_tokens WHERE token_hash = ?", (_hash(token),))


def generate_class_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if not fetch_one("SELECT 1 FROM teachers WHERE class_code = ?", (code,)):
            return code
