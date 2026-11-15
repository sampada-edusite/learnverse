"""AI homework builder for teachers (chapter-wise).

Two engines, chosen automatically:

* "claude"  - when ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is set on the server, Claude writes
  new multiple-choice questions for the chapter, focused on the concepts the class is weakest in.
  Every question is validated (one correct answer that is exactly one of the options) and the
  teacher reviews the draft before anything is assigned.
* "ml-bank" - otherwise (or if the API call fails / is declined), questions are selected from the
  chapter's existing, answer-checked question bank using the trained learner model: concepts
  the class is least ready for come first, and within each concept the question whose predicted
  class success is closest to the target success rate is picked.

Both engines use the same class analysis (per-concept readiness averaged over the teacher's students).
"""
from __future__ import annotations

import json
import logging
import os
import random
from datetime import datetime, timedelta, timezone

from database import fetch_dict, fetch_dicts

log = logging.getLogger("learnverse.homework")

CLAUDE_MODEL = os.environ.get("LEARNVERSE_AI_MODEL", "claude-opus-5-5")
TARGET_SUCCESS = 0.70
NEEDS_HELP_READINESS = 0.60

HOMEWORK_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "instructions": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "correct_answer": {"type": "string"},
                    "concept": {"type": "string"},
                    "difficulty": {"type": "string", "enum": ["Easy", "Medium", "Hard"]},
                },
                "required": ["question", "options", "correct_answer", "concept", "difficulty"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "instructions", "questions"],
    "additionalProperties": False,
}


def claude_configured() -> bool:
    if os.environ.get("LEARNVERSE_AI_HOMEWORK", "").lower() == "off":
        return False
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


# ----------------------------------------------------------------- class analysis

def _lesson(lesson_id):
    return fetch_dict("SELECT lesson_id, lesson_name, lesson_name_local, subject, class, description FROM lessons "
                      "WHERE lesson_id = ?", (lesson_id,))


def class_analysis(teacher_id, lesson_id, concept_ids=None):
    """Per-concept readiness for the teacher's class, plus students who need help in this chapter/topic."""
    from adaptive_engine import learner_state
    from ml.curriculum import load_concepts
    from ml.model import get_model
    from ml.recommender import concept_readiness
    from ml.features import LearnerState

    concepts = [c for c in load_concepts().values() if c["lesson_id"] == lesson_id
                and (not concept_ids or c["concept_id"] in concept_ids)]
    students = fetch_dicts("SELECT student_id, name FROM students WHERE teacher_id = ? ORDER BY name", (teacher_id,))
    model = get_model()
    if model is None or not concepts:
        return {"concepts": [{"concept_id": c["concept_id"], "name": c["name"], "readiness": None} for c in concepts],
                "students_needing_help": [], "model": None, "states": {}}

    states = {s["student_id"]: learner_state(s["student_id"]) for s in students}
    per_concept = []
    for c in concepts:
        values = [concept_readiness(model, st, c) for st in states.values()] or [concept_readiness(model, LearnerState(), c)]
        per_concept.append({"concept_id": c["concept_id"], "name": c["name"], "readiness": round(sum(values) / len(values), 3)})
    per_concept.sort(key=lambda c: c["readiness"])

    needing = []
    for s in students:
        st = states[s["student_id"]]
        r = [concept_readiness(model, st, c) for c in concepts]
        low = min(r) if r else 1.0
        if low < NEEDS_HELP_READINESS:
            needing.append({"student_id": s["student_id"], "name": s["name"], "lowest_readiness": round(low, 3)})
    needing.sort(key=lambda s: s["lowest_readiness"])
    return {"concepts": per_concept, "students_needing_help": needing, "model": model, "states": states}


# ----------------------------------------------------------------- validation

def _clean_question(q):
    text = " ".join(str(q.get("question", "")).split())[:300]
    opts, seen = [], set()
    for o in q.get("options") or []:
        o = " ".join(str(o).split())[:120]
        if o and o.lower() not in seen:
            seen.add(o.lower())
            opts.append(o)
    opts = opts[:6]
    answer = " ".join(str(q.get("correct_answer", "")).split())
    match = next((o for o in opts if o == answer), None) or next((o for o in opts if o.lower() == answer.lower()), None)
    if len(text) < 2 or len(opts) < 2 or match is None:
        return None
    return {"question": text, "options": opts, "correct_answer": match, "points": 1,
            "concept": q.get("concept"), "difficulty": q.get("difficulty") if q.get("difficulty") in ("Easy", "Medium", "Hard") else None,
            "question_id": q.get("question_id"), "concept_id": q.get("concept_id")}


# ----------------------------------------------------------------- engines

def _bank_questions(lesson_id, count, analysis, exclude_texts=(), concept_ids=None):
    rows = fetch_dicts(
        "SELECT q.question_id, q.concept_id, q.question, q.options, q.expected_answer, q.difficulty, c.name AS concept_name "
        "FROM questions q JOIN concepts c ON c.concept_id = q.concept_id "
        "WHERE c.lesson_id = ? AND q.options IS NOT NULL ORDER BY q.sort_order", (lesson_id,))
    rows = [r for r in rows if r["question"] not in set(exclude_texts)
            and (not concept_ids or r["concept_id"] in concept_ids)]
    model = analysis.get("model")
    by_concept = {}
    for r in rows:
        by_concept.setdefault(r["concept_id"], []).append(r)

    picked = []
    if model is not None:
        from ml.curriculum import load_questions
        meta = load_questions()
        states = list(analysis["states"].values())
        from ml.features import LearnerState
        if not states:
            states = [LearnerState()]

        def class_success(r):
            m = meta.get(r["question_id"])
            return sum(model.predict(st, m) for st in states) / len(states) if m else 0.5

        order = [c["concept_id"] for c in analysis["concepts"] if c["concept_id"] in by_concept]
        pools = {cid: sorted(by_concept[cid], key=lambda r: abs(class_success(r) - TARGET_SUCCESS)) for cid in order}
        while len(picked) < count and any(pools.values()):
            for cid in order:  # round-robin, least-ready concept first
                if pools[cid] and len(picked) < count:
                    picked.append(pools[cid].pop(0))
    else:
        random.shuffle(rows)
        picked = rows[:count]

    out = []
    for r in picked:
        q = _clean_question({"question": r["question"], "options": json.loads(r["options"]),
                             "correct_answer": r["expected_answer"], "concept": r["concept_name"],
                             "difficulty": r["difficulty"], "question_id": r["question_id"],
                             "concept_id": r["concept_id"]})
        if q:
            out.append(q)
    return out


def _claude_questions(lesson, count, analysis):
    """Returns (questions, title, instructions) or raises RuntimeError with a short reason."""
    import anthropic

    focus = [c for c in analysis["concepts"]][:4]
    examples = fetch_dicts(
        "SELECT q.question, q.options, q.expected_answer, q.difficulty FROM questions q JOIN concepts c "
        "ON c.concept_id = q.concept_id WHERE c.lesson_id = ? AND q.options IS NOT NULL ORDER BY q.sort_order LIMIT 4",
        (lesson["lesson_id"],))
    language_rule = {
        "Marathi": "Write every question and every option in simple Marathi (Devanagari script).",
        "Mathematics": "Write in very simple English. Use digits for numbers. Keep numbers within the chapter's range.",
        "English": "Write in very simple English suitable for a first English textbook.",
    }.get(lesson["subject"], "Write in very simple language.")

    system = (
        "You write homework for Maharashtra State Board primary school children (Std 1-2). "
        "Questions must be short, clear, kind, culturally familiar to children in Maharashtra, and answerable "
        "from the chapter's learning outcomes. Each question is multiple choice with 3 or 4 options and exactly "
        "one correct option; correct_answer must be copied exactly from the options. No trick questions, no "
        "negatives like 'which is NOT', no images or audio references."
    )
    concept_lines = "\n".join(
        f"- {c['name']}" + (f" (class readiness {round(c['readiness'] * 100)}%)" if c.get("readiness") is not None else "")
        for c in focus) or "- (all concepts of the chapter)"
    example_lines = "\n".join(
        f"- {e['question']} | options: {', '.join(json.loads(e['options']))} | answer: {e['expected_answer']} ({e['difficulty']})"
        for e in examples)
    prompt = (
        f"Chapter: {lesson['lesson_name']}" + (f" ({lesson['lesson_name_local']})" if lesson.get("lesson_name_local") else "")
        + f"\nSubject: {lesson['subject']}, Std {lesson['class']}\n"
        + (f"About the chapter: {lesson['description']}\n" if lesson.get("description") else "")
        + f"\nFocus on these concepts, weakest first:\n{concept_lines}\n"
        + (f"\nExamples of the level and style used in this app:\n{example_lines}\n" if example_lines else "")
        + f"\nWrite {count} new homework questions (mix of Easy and Medium, a few Hard only if the class readiness is "
        "above 70%), a short friendly title, and one or two lines of instructions for the child.\n"
        + language_rule
    )

    client = anthropic.Anthropic(timeout=90.0, max_retries=2)
    try:
        response = client.beta.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": HOMEWORK_SCHEMA}},
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.AuthenticationError:
        raise RuntimeError("the Anthropic API key was rejected")
    except anthropic.RateLimitError:
        raise RuntimeError("the AI service is busy (rate limited)")
    except anthropic.APIStatusError as exc:
        raise RuntimeError(f"the AI service returned an error ({exc.status_code})")
    except anthropic.APIConnectionError:
        raise RuntimeError("the AI service could not be reached")

    if response.stop_reason == "refusal":
        raise RuntimeError("the AI service declined this request")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("the AI response was cut off")
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        data = json.loads(text)
    except ValueError:
        raise RuntimeError("the AI response was not valid JSON")
    by_name = {c["name"].strip().lower(): c["concept_id"] for c in analysis["concepts"]}
    for q in data.get("questions", []):
        q["concept_id"] = by_name.get(str(q.get("concept", "")).strip().lower())
    questions = [q for q in (_clean_question(q) for q in data.get("questions", [])) if q][:count]
    if not questions:
        raise RuntimeError("the AI response had no usable questions")
    return questions, data.get("title"), data.get("instructions")


# ----------------------------------------------------------------- public API

def generate_homework(teacher_id, lesson_id, count=8, concept_ids=None, kind="homework"):
    lesson = _lesson(lesson_id)
    if not lesson:
        raise LookupError("Lesson not found.")
    concept_ids = [c for c in (concept_ids or []) if c]
    analysis = class_analysis(teacher_id, lesson_id, concept_ids)
    if concept_ids and not analysis["concepts"]:
        raise LookupError("Topic not found in this chapter.")
    engine, note, title, instructions = "ml-bank", None, None, None
    questions = []

    if claude_configured():
        try:
            questions, title, instructions = _claude_questions(lesson, count, analysis)
            engine = "claude"
        except RuntimeError as exc:
            note = f"AI writing was unavailable ({exc}); questions were chosen from the chapter's question bank instead."
            log.warning("Claude homework generation failed: %s", exc)
    if len(questions) < count:
        questions += _bank_questions(lesson_id, count - len(questions), analysis,
                                     exclude_texts=[q["question"] for q in questions], concept_ids=concept_ids)

    due = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    name = lesson["lesson_name_local"] or lesson["lesson_name"]
    if len(analysis["concepts"]) == 1:
        name = f"{name} · {analysis['concepts'][0]['name']}"
    label = "Quiz" if kind == "quiz" else "Homework"
    return {
        "kind": "quiz" if kind == "quiz" else "homework",
        "time_limit_sec": min(max(len(questions), 1) * 60, 1800) if kind == "quiz" else None,
        "topics": [{"concept_id": c["concept_id"], "name": c["name"]} for c in analysis["concepts"]],
        "engine": engine,
        "model": CLAUDE_MODEL if engine == "claude" else (analysis["model"].version if analysis["model"] else None),
        "note": note,
        "lesson": {k: lesson[k] for k in ("lesson_id", "lesson_name", "lesson_name_local", "subject", "class")},
        "title": (title or f"{label} · {name}")[:100],
        "instructions": (instructions or "Read each question carefully and choose the best answer.")[:500],
        "due_date": due,
        "questions": questions,
        "focus_concepts": [{k: c[k] for k in ("concept_id", "name", "readiness")} for c in analysis["concepts"]],
        "students_needing_help": analysis["students_needing_help"],
        "practice_target": 5,
    }
