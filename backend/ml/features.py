"""Feature engineering shared by training and live inference.

One function (`question_features`) turns "what we know about a learner right now" plus
"a candidate question" into a numeric vector. Training replays every attempt in order and
calls it with the state *before* that attempt (so there is no look-ahead leakage); the
live recommender calls it with the learner's current state. Using the same code path for
both is what keeps offline evaluation honest.

Pure Python on purpose: the backend needs no numpy/scikit-learn at runtime.
"""
from __future__ import annotations

import math
from collections import deque
from datetime import datetime

DIFFICULTIES = ("Easy", "Medium", "Hard")
SUBJECTS = ("English", "Mathematics", "Marathi")
RECENT_WINDOW = 3
MAX_GAP_HOURS = 24 * 30

FEATURE_NAMES = [
    "concept_attempts_log",        # log(1 + attempts on this concept)
    "concept_acc_smoothed",        # (correct + 1) / (attempts + 2)
    "concept_wrong_log",           # log(1 + wrong answers on this concept)
    "concept_last_result",         # +1 last answer right, -1 wrong, 0 none
    "concept_recent_acc",          # smoothed accuracy over the last 3 concept attempts
    "concept_streak",              # signed run length of identical results, clipped to +-5, /5
    "concept_evidence_acc",        # centred accuracy weighted by amount of evidence
    "student_acc_smoothed",        # overall accuracy across all concepts, smoothed
    "student_attempts_log",        # log(1 + all attempts)
    "lesson_acc_smoothed",         # accuracy on sibling concepts in the same lesson
    "diff_easy", "diff_medium", "diff_hard",
    "is_mcq",                      # multiple choice (guessable)
    "guess_rate",                  # 1 / number of options for MCQ, else 0
    "question_seen",               # learner has answered this exact question before
    "question_last_result",        # +1 / -1 / 0 for that exact question
    "subj_english", "subj_maths", "subj_marathi",
    "class_2",                     # Std 2 content
    "concept_prior_logit",         # population difficulty of the concept (learned in training)
    "hours_since_concept_log",     # log(1 + hours since last practice of this concept)
]


def parse_time(value):
    """Parse SQLite 'YYYY-MM-DD HH:MM:SS' timestamps; None when absent/unparseable."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return datetime.strptime(str(value)[:19], "%Y-%m-%d %H:%M:%S").timestamp()
    except ValueError:
        return None


def _logit(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


class LearnerState:
    """Running summary of one learner's answer history, updated attempt by attempt."""

    __slots__ = ("concepts", "questions", "lessons", "total", "correct")

    def __init__(self):
        self.concepts = {}   # concept_id -> [attempts, correct, deque(recent), last_time, streak]
        self.questions = {}  # question_id -> last result (bool)
        self.lessons = {}    # lesson_id -> [attempts, correct]
        self.total = 0
        self.correct = 0

    def concept_attempts(self, concept_id):
        c = self.concepts.get(concept_id)
        return c[0] if c else 0

    def update(self, question_meta, is_correct, when=None):
        is_correct = bool(is_correct)
        cid = question_meta["concept_id"]
        c = self.concepts.get(cid)
        if c is None:
            c = [0, 0, deque(maxlen=RECENT_WINDOW), None, 0]
            self.concepts[cid] = c
        c[0] += 1
        c[1] += int(is_correct)
        c[2].append(int(is_correct))
        if when is not None:
            c[3] = when
        if c[4] == 0 or (c[4] > 0) != is_correct:
            c[4] = 1 if is_correct else -1
        else:
            c[4] += 1 if is_correct else -1
        self.questions[question_meta["question_id"]] = is_correct
        lid = question_meta.get("lesson_id")
        if lid:
            l = self.lessons.setdefault(lid, [0, 0])
            l[0] += 1
            l[1] += int(is_correct)
        self.total += 1
        self.correct += int(is_correct)


def question_features(state: LearnerState, q: dict, now=None, concept_priors=None, global_prior=0.65):
    """Feature vector (list of floats, ordered as FEATURE_NAMES) for answering `q` now."""
    c = state.concepts.get(q["concept_id"])
    n, k = (c[0], c[1]) if c else (0, 0)
    recent = list(c[2]) if c else []
    last_time = c[3] if c else None
    streak = c[4] if c else 0

    acc = (k + 1) / (n + 2)
    recent_acc = (sum(recent) + 0.5) / (len(recent) + 1)
    last_result = 0.0 if not recent else (1.0 if recent[-1] else -1.0)
    student_acc = (state.correct + 2) / (state.total + 3)

    # Accuracy on the *other* concepts in this lesson: a learner who is good at sibling skills
    # is likely to manage a new one.
    l = state.lessons.get(q.get("lesson_id"), [0, 0])
    sib_n, sib_k = l[0] - n, l[1] - k
    lesson_acc = (sib_k + 1) / (sib_n + 2) if sib_n > 0 else student_acc

    diff = q.get("difficulty") or "Easy"
    is_mcq = 1.0 if q.get("n_options", 0) >= 2 else 0.0
    guess = 1.0 / q["n_options"] if is_mcq else 0.0

    seen = q["question_id"] in state.questions
    q_last = 0.0 if not seen else (1.0 if state.questions[q["question_id"]] else -1.0)

    subject = q.get("subject") or "English"
    prior = (concept_priors or {}).get(q["concept_id"], global_prior)

    if last_time is not None and now is not None:
        gap_h = min(max((now - last_time) / 3600.0, 0.0), MAX_GAP_HOURS)
        gap = math.log1p(gap_h)
    else:
        gap = 0.0

    return [
        math.log1p(n),
        acc,
        math.log1p(n - k),
        last_result,
        recent_acc,
        max(-5, min(5, streak)) / 5.0,
        (acc - 0.5) * math.log1p(n),
        student_acc,
        math.log1p(state.total),
        lesson_acc,
        1.0 if diff == "Easy" else 0.0,
        1.0 if diff == "Medium" else 0.0,
        1.0 if diff == "Hard" else 0.0,
        is_mcq,
        guess,
        1.0 if seen else 0.0,
        q_last,
        1.0 if subject == "English" else 0.0,
        1.0 if subject == "Mathematics" else 0.0,
        1.0 if subject == "Marathi" else 0.0,
        1.0 if int(q.get("class") or 1) == 2 else 0.0,
        _logit(prior),
        gap,
    ]


def reference_question(concept_meta: dict):
    """A virtual 'Medium, non-guessable, unseen' question used to read off concept readiness."""
    return {
        "question_id": f"__ref__{concept_meta['concept_id']}",
        "concept_id": concept_meta["concept_id"],
        "lesson_id": concept_meta.get("lesson_id"),
        "subject": concept_meta.get("subject"),
        "class": concept_meta.get("class"),
        "difficulty": "Medium",
        "n_options": 0,
    }
