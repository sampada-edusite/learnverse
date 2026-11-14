"""Synthetic learner simulator.

WHY THIS EXISTS: a freshly installed LearnVerse database has (almost) no answer history, and
no production data was available while building this. To still train and *evaluate* a model,
we simulate learners on the real curriculum (the actual 97 concepts / 515 questions, their
difficulty labels, question types and option counts).

The simulator's hidden model is intentionally different from the features the ML model sees:
each learner has a latent ability, a learning speed and a forgetting rate; every concept and
question has a hidden difficulty; multiple-choice questions can be guessed; correct answers
come from an item-response curve. The ML model only sees answer history, so it must *infer*
ability and knowledge - which is the real-world problem.

Results on simulated data show the pipeline works; they are not evidence about real children.
Retrain on real attempts (see ml/README.md) once enough exist.
"""
from __future__ import annotations

import math
import random

DIFF_SHIFT = {"Easy": -0.75, "Medium": 0.0, "Hard": 0.75}
SUBJECT_SHIFT = {"English": -0.1, "Mathematics": 0.0, "Marathi": 0.2}
T0 = 1767225600.0  # 2026-01-01 00:00:00 UTC
GAP_SD = 0.8  # spread of individual concept gaps; makes a learner's own concept history informative


def _sigmoid(z):
    return 1.0 / (1.0 + math.exp(-z))


class World:
    """Hidden difficulties for the real curriculum (fixed by seed)."""

    def __init__(self, questions, concepts, seed=7):
        rng = random.Random(seed)
        self.questions = questions
        self.concepts = concepts
        self.concept_b = {}
        for cid, c in concepts.items():
            b = DIFF_SHIFT.get(c.get("difficulty") or "Easy", 0.0) * 0.8
            b += 0.45 if int(c.get("class") or 1) == 2 else 0.0
            b += SUBJECT_SHIFT.get(c.get("subject"), 0.0)
            self.concept_b[cid] = b + rng.gauss(0, 0.45)
        self.question_d = {qid: DIFF_SHIFT.get(q["difficulty"], 0.0) + rng.gauss(0, 0.25)
                           for qid, q in questions.items()}
        self.by_concept = {}
        for q in questions.values():
            self.by_concept.setdefault(q["concept_id"], []).append(q)
        for qs in self.by_concept.values():
            qs.sort(key=lambda q: (q["sort_order"], q["question_id"]))
        self.by_lesson = {}
        for c in concepts.values():
            self.by_lesson.setdefault(c["lesson_id"], []).append(c)


class SimLearner:
    def __init__(self, world: World, rng: random.Random, student_class=None):
        self.w = world
        self.rng = rng
        self.theta = rng.gauss(0, 1.0)
        self.speed = math.exp(rng.gauss(math.log(0.35), 0.4))
        self.tau = math.exp(rng.gauss(math.log(96.0), 0.6))   # forgetting time constant, hours
        self.slip = rng.uniform(0.03, 0.12)
        self.student_class = student_class or rng.choice((1, 2))
        self.growth = {}
        self.practice_n = {}
        self.last_t = {}
        self.seen = set()
        self.gap = {}  # learner-specific knowledge offset per concept (individual gaps / strengths)
        self.gap_seed = rng.randrange(1 << 30)

    def _effective_growth(self, cid, t):
        g = self.growth.get(cid, 0.0)
        last = self.last_t.get(cid)
        if g == 0.0 or last is None:
            return g
        gap_h = max(t - last, 0.0) / 3600.0
        return g * (0.55 + 0.45 * math.exp(-gap_h / self.tau))

    def true_p(self, q, t):
        cid = q["concept_id"]
        if cid not in self.gap:
            self.gap[cid] = random.Random(f"{self.gap_seed}:{cid}").gauss(0, GAP_SD)
        skill = self.theta - self.w.concept_b[cid] + self.gap[cid] + self._effective_growth(cid, t)
        if q["question_id"] in self.seen:
            skill += 0.35
        guess = 1.0 / q["n_options"] if q["n_options"] >= 2 else 0.02
        return guess + (1 - guess - self.slip) * _sigmoid(1.7 * (skill - self.w.question_d[q["question_id"]]))

    def answer(self, q, t):
        correct = self.rng.random() < self.true_p(q, t)
        cid = q["concept_id"]
        n = self.practice_n.get(cid, 0)
        consolidated = self._effective_growth(cid, t)
        gain = self.speed * (0.7 if correct else 1.0) * math.exp(-0.12 * n)
        self.growth[cid] = consolidated + gain
        self.practice_n[cid] = n + 1
        self.last_t[cid] = t
        # small transfer to sibling concepts in the same lesson
        for sib in self.w.by_lesson.get(q["lesson_id"], ()):
            sid = sib["concept_id"]
            if sid != cid:
                self.growth[sid] = self._effective_growth(sid, t) + 0.12 * gain
                self.last_t.setdefault(sid, t)
        self.seen.add(q["question_id"])
        return correct

    def expected_score(self, question_list, t):
        """Post-test: mean true P(correct) on the given questions, without learning."""
        saved = set(self.seen)
        self.seen = set()
        try:
            return sum(self.true_p(q, t) for q in question_list) / max(len(question_list), 1)
        finally:
            self.seen = saved


# ----------------------------------------------------------------------------- data generation

def _observed_acc(hist, cid):
    n, k = hist.get(cid, (0, 0))
    return k / n if n else None


def generate_attempts(world: World, n_students=600, seed=11, min_attempts=60, max_attempts=260):
    """Simulated answer logs. Practice choices mix weakest-first, random and curriculum-order
    behaviour so the training data is not produced by a single policy."""
    rng = random.Random(seed)
    lessons_by_class = {}
    for lid, cs in world.by_lesson.items():
        lessons_by_class.setdefault(int(cs[0].get("class") or 1), []).append(lid)
    for lids in lessons_by_class.values():
        lids.sort(key=lambda lid: world.by_lesson[lid][0].get("lesson_order", 0))

    rows = []
    for s in range(n_students):
        learner = SimLearner(world, rng)
        sid = f"sim_{s:04d}"
        lessons = lessons_by_class.get(learner.student_class) or next(iter(lessons_by_class.values()))
        budget = rng.randint(min_attempts, max_attempts)
        t = T0 + rng.uniform(0, 30 * 86400)
        hist = {}
        li = 0
        done = 0
        while done < budget:
            if rng.random() < 0.3:
                lid = rng.choice(lessons)
            else:
                lid = lessons[li % len(lessons)]
                li += 1 if rng.random() < 0.5 else 0
            concepts = [c for c in world.by_lesson[lid] if world.by_concept.get(c["concept_id"])]
            if not concepts:
                continue
            for _ in range(rng.randint(5, 12)):
                r = rng.random()
                if r < 0.4:
                    attempted = [c for c in concepts if c["concept_id"] in hist]
                    concept = min(attempted, key=lambda c: _observed_acc(hist, c["concept_id"])) if attempted \
                        else concepts[0]
                elif r < 0.8:
                    concept = rng.choice(concepts)
                else:
                    concept = next((c for c in concepts if c["concept_id"] not in hist), rng.choice(concepts))
                qs = world.by_concept[concept["concept_id"]]
                unseen = [q for q in qs if q["question_id"] not in learner.seen]
                q = rng.choice(unseen if unseen and rng.random() < 0.7 else qs)
                correct = learner.answer(q, t)
                n, k = hist.get(q["concept_id"], (0, 0))
                hist[q["concept_id"]] = (n + 1, k + int(correct))
                rows.append({"student_id": sid, "question_id": q["question_id"], "is_correct": int(correct),
                             "t": t})
                t += rng.uniform(25, 110)
                done += 1
                if done >= budget:
                    break
            t += rng.expovariate(1 / (20 * 3600))
    return rows


# ----------------------------------------------------------------------------- rule-based replica

def rule_policy_choice(learner_hist, seen, concepts, questions_by_concept, exclude):
    """In-memory replica of the original rule-based engine (adaptive_engine + question_selector),
    used only as the baseline in the offline policy comparison."""
    preferred = {"Needs Practice": ["Easy"], "No Practice": ["Easy"], "Learning": ["Medium", "Easy"],
                 "Mastered": ["Medium", "Hard"]}

    def status(cid):
        n, k = learner_hist.get(cid, (0, 0))
        if n == 0:
            return "No Practice", 0.0
        acc = k / n * 100
        return ("Mastered" if acc >= 80 else "Learning" if acc >= 50 else "Needs Practice"), acc

    order = {c["concept_id"]: i for i, c in enumerate(concepts)}
    st = {c["concept_id"]: status(c["concept_id"]) for c in concepts}
    np_ = sorted((c for c in st if st[c][0] == "Needs Practice"), key=lambda c: (st[c][1], order[c]))
    le = sorted((c for c in st if st[c][0] == "Learning"), key=lambda c: (st[c][1], order[c]))
    un = [c["concept_id"] for c in concepts if st[c["concept_id"]][0] == "No Practice"]
    ma = sorted((c for c in st if st[c][0] == "Mastered"), key=lambda c: (st[c][1], order[c]))
    for cid in np_ + le + un + ma:
        qs = [q for q in questions_by_concept.get(cid, ()) if q["question_id"] not in exclude]
        if not qs:
            continue
        pref = preferred[st[cid][0]]

        def rank(q):
            pi = pref.index(q["difficulty"]) if q["difficulty"] in pref else len(pref)
            return (q["question_id"] in seen, pi >= len(pref), pi, q["sort_order"])

        unseen = [q for q in qs if q["question_id"] not in seen]
        return min(unseen or qs, key=rank)
    return None
