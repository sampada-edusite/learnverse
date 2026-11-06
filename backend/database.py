"""SQLite data layer for LearnVerse.

The database file lives next to this module (override with LEARNVERSE_DB).
Importing this module guarantees the schema exists and curriculum content
is seeded, so every engine and test can rely on the tables being present.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.environ.get("LEARNVERSE_DB", os.path.join(BASE_DIR, "learnverse.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS lessons (
    lesson_id TEXT PRIMARY KEY,
    class INTEGER NOT NULL DEFAULT 1,
    subject TEXT NOT NULL DEFAULT 'English',
    unit TEXT,
    chapter_no INTEGER,
    lesson_name TEXT NOT NULL,
    lesson_name_local TEXT,
    description TEXT,
    working_video_url TEXT,
    working_video_title TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS concepts (
    concept_id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    name TEXT NOT NULL,
    objective TEXT,
    prerequisite TEXT,
    difficulty TEXT DEFAULT 'Easy',
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
    question_id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'Short Answer',
    expected_answer TEXT NOT NULL,
    hint TEXT,
    difficulty TEXT DEFAULT 'Easy',
    options TEXT,
    visual TEXT,
    solving_video_url TEXT,
    solving_video_title TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
    attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    student_answer TEXT,
    is_correct INTEGER NOT NULL DEFAULT 0,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'practice'
);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);

CREATE TABLE IF NOT EXISTS game_attempts (
    game_attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    lesson_id TEXT,
    level INTEGER DEFAULT 1,
    score INTEGER NOT NULL,
    stars INTEGER NOT NULL,
    completed_challenges INTEGER NOT NULL,
    total_challenges INTEGER NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 1,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_game_attempts_student ON game_attempts(student_id);

CREATE TABLE IF NOT EXISTS teachers (
    teacher_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    school TEXT,
    class_code TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    student_class INTEGER NOT NULL DEFAULT 1,
    parent_mobile TEXT,
    roll_no TEXT,
    teacher_id TEXT,
    coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);

CREATE TABLE IF NOT EXISTS otp_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    payload TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash TEXT PRIMARY KEY,
    user_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    level INTEGER,
    target_count INTEGER,
    instructions TEXT,
    due_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignment_targets (
    assignment_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    student_class INTEGER NOT NULL DEFAULT 1,
    time_limit_sec INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
    submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    student_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    answers TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
    session_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    challenges TEXT NOT NULL,
    state TEXT NOT NULL,
    finished INTEGER NOT NULL DEFAULT 0,
    result TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_progress (
    student_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    best_score INTEGER NOT NULL DEFAULT 0,
    stars INTEGER NOT NULL DEFAULT 0,
    plays INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, game_id, level)
);

CREATE TABLE IF NOT EXISTS student_rewards (
    student_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, badge_id)
);
"""


def now_utc() -> str:
    """UTC timestamp in the same format SQLite's CURRENT_TIMESTAMP produces."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def get_connection() -> sqlite3.Connection:
    return sqlite3.connect(DB_NAME, timeout=30)


def fetch_one(query, params=()):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(query, params)
        return cursor.fetchone()
    finally:
        connection.close()


def fetch_all(query, params=()):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        connection.close()


def fetch_dicts(query, params=()):
    """Like fetch_all but returns a list of dicts keyed by column name."""
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        connection.close()


def fetch_dict(query, params=()):
    rows = fetch_dicts(query, params)
    return rows[0] if rows else None


def execute_commit(query, params=()):
    """Execute a write statement and return the new row id."""
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(query, params)
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def _migrate(cursor):
    """Add columns introduced after a database was first created."""
    def columns(table):
        cursor.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cursor.fetchall()}

    additions = {
        "lessons": {"unit": "TEXT", "chapter_no": "INTEGER", "lesson_name_local": "TEXT",
                    "description": "TEXT", "sort_order": "INTEGER DEFAULT 0"},
        "concepts": {"sort_order": "INTEGER DEFAULT 0"},
        "questions": {"options": "TEXT", "visual": "TEXT", "solving_video_url": "TEXT",
                      "solving_video_title": "TEXT", "sort_order": "INTEGER DEFAULT 0"},
        "attempts": {"source": "TEXT DEFAULT 'practice'"},
        "game_attempts": {"level": "INTEGER DEFAULT 1"},
    }
    for table, cols in additions.items():
        existing = columns(table)
        for col, decl in cols.items():
            if col not in existing:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def _seed_content(cursor):
    from content import CONTENT_VERSION, get_all_content

    cursor.execute("SELECT value FROM meta WHERE key = 'content_version'")
    row = cursor.fetchone()
    if row and row[0] == CONTENT_VERSION:
        return

    lessons, concepts, questions = get_all_content()
    for i, l in enumerate(lessons):
        cursor.execute(
            """
            INSERT INTO lessons (lesson_id, class, subject, unit, chapter_no, lesson_name, lesson_name_local,
                                 description, working_video_url, working_video_title, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(lesson_id) DO UPDATE SET
                class=excluded.class, subject=excluded.subject, unit=excluded.unit,
                chapter_no=excluded.chapter_no, lesson_name=excluded.lesson_name,
                lesson_name_local=excluded.lesson_name_local, description=excluded.description,
                working_video_url=excluded.working_video_url,
                working_video_title=excluded.working_video_title, sort_order=excluded.sort_order
            """,
            (l["lesson_id"], l["class"], l["subject"], l.get("unit"), l.get("chapter_no"), l["lesson_name"],
             l.get("lesson_name_local"), l.get("description"), l.get("working_video_url"),
             l.get("working_video_title"), i),
        )
    for i, c in enumerate(concepts):
        cursor.execute(
            """
            INSERT INTO concepts (concept_id, lesson_id, name, objective, prerequisite, difficulty, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(concept_id) DO UPDATE SET
                lesson_id=excluded.lesson_id, name=excluded.name, objective=excluded.objective,
                prerequisite=excluded.prerequisite, difficulty=excluded.difficulty, sort_order=excluded.sort_order
            """,
            (c["concept_id"], c["lesson_id"], c["name"], c.get("objective"), c.get("prerequisite"),
             c.get("difficulty", "Easy"), i),
        )
    for i, q in enumerate(questions):
        cursor.execute(
            """
            INSERT INTO questions (question_id, concept_id, question, question_type, expected_answer, hint,
                                   difficulty, options, visual, solving_video_url, solving_video_title, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(question_id) DO UPDATE SET
                concept_id=excluded.concept_id, question=excluded.question, question_type=excluded.question_type,
                expected_answer=excluded.expected_answer, hint=excluded.hint, difficulty=excluded.difficulty,
                options=excluded.options, visual=excluded.visual, solving_video_url=excluded.solving_video_url,
                solving_video_title=excluded.solving_video_title, sort_order=excluded.sort_order
            """,
            (q["question_id"], q["concept_id"], q["question"], q["question_type"], q["expected_answer"],
             q.get("hint"), q.get("difficulty", "Easy"),
             json.dumps(q["options"], ensure_ascii=False) if q.get("options") else None,
             q.get("visual"), q.get("solving_video_url"), q.get("solving_video_title"), i),
        )
    cursor.execute(
        "INSERT INTO meta (key, value) VALUES ('content_version', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (CONTENT_VERSION,),
    )


def init_db():
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.executescript(SCHEMA)
        _migrate(cursor)
        _seed_content(cursor)
        connection.commit()
    finally:
        connection.close()


init_db()
