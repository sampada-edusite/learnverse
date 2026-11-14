"""Turn model predictions into the next learning activity.

Two quantities come from the trained model:

* concept readiness - predicted P(correct) on a reference Medium, non-guessable question of the
  concept. It is the model's estimate of how well the learner knows the concept *now*, taking
  recency, streaks, forgetting, sibling-skill performance and population difficulty into account
  (not just raw accuracy).
* question success  - predicted P(correct) for each concrete candidate question.

Policy (default strategy "least_ready"):
1. A brand-new learner is introduced to the first concept in curriculum order.
2. Otherwise every practised concept competes with the next unpractised concept in curriculum
   order (the "frontier"); the one with the LOWEST predicted readiness is chosen. The model's
   readiness for an unpractised concept comes from the learner's overall and same-lesson
   performance plus the concept's learned population difficulty, so new material is introduced
   as soon as the model expects it to be more useful than more practice on a known weakness.
   Concepts below MASTERY_READINESS are labelled "practice", others "progress".
3. Inside the chosen concept, the unseen question whose predicted success is closest to
   TARGET_SUCCESS is served ("desirable difficulty": hard enough to learn from, easy enough
   to keep a young child motivated).

The legacy "weak_first" strategy (finish weak concepts before new ones, using model readiness)
is kept for comparison. In the offline policy simulation least_ready gave a clearly larger
learning gain than both weak_first and the original rule engine; see ml/README.md.

`choose_activity` is pure (no database access) so the same code runs in the API and in the
offline policy simulation in `ml/train.py`.
"""
from __future__ import annotations

from .features import reference_question

TARGET_SUCCESS = 0.70
MASTERY_READINESS = 0.80
FRONTIER_NEW = 1


def concept_readiness(model, state, concept_meta, now=None):
    return model.predict(state, reference_question(concept_meta), now=now)


def choose_activity(model, state, concepts, questions_by_concept, exclude=None, now=None, strategy="least_ready"):
    """Pick (concept, question) for a learner.

    concepts: ordered list of concept metadata dicts in scope (curriculum order).
    questions_by_concept: concept_id -> list of question metadata dicts.
    Returns a dict or None when nothing is available.
    """
    exclude = set(exclude or ())
    readiness = {c["concept_id"]: concept_readiness(model, state, c, now) for c in concepts}

    attempted = [c for c in concepts if state.concept_attempts(c["concept_id"]) > 0]
    new = [c for c in concepts if state.concept_attempts(c["concept_id"]) == 0]
    weak = sorted((c for c in attempted if readiness[c["concept_id"]] < MASTERY_READINESS),
                  key=lambda c: readiness[c["concept_id"]])
    ready = sorted((c for c in attempted if readiness[c["concept_id"]] >= MASTERY_READINESS),
                   key=lambda c: readiness[c["concept_id"]])

    if strategy == "least_ready" and attempted:
        # Compete practised concepts against the next unpractised one(s) in curriculum order,
        # least ready first; the rest of the scope follows so the session can always continue.
        frontier = new[:FRONTIER_NEW]
        ordered = sorted(attempted + frontier, key=lambda c: readiness[c["concept_id"]])
        plan = [(c, "practice" if c in weak else "progress") for c in ordered]
        plan += [(c, "progress") for c in new[FRONTIER_NEW:]]
    elif weak:
        plan = [(c, "practice") for c in weak] + [(c, "progress") for c in new + ready]
    elif attempted:
        plan = [(c, "progress") for c in new + ready]
    else:
        plan = [(c, "introduce") for c in new]

    for concept, kind in plan:
        cid = concept["concept_id"]
        candidates = [q for q in questions_by_concept.get(cid, ()) if q["question_id"] not in exclude]
        if not candidates:
            continue
        unseen = [q for q in candidates if q["question_id"] not in state.questions]
        pool = unseen or candidates
        if kind == "introduce":
            # Cold start: with no history the model cannot personalise yet, so a child's very
            # first question is always an Easy one (the model still ranks among them).
            pool = [q for q in pool if q.get("difficulty") == "Easy"] or pool
        scored = []
        for q in pool:
            p = model.predict(state, q, now=now)
            scored.append((abs(p - TARGET_SUCCESS), q.get("sort_order", 0), q["question_id"], p, q))
        _, _, _, p, best = min(scored, key=lambda s: s[:3])
        return {
            "concept_id": cid,
            "kind": kind,
            "readiness": readiness[cid],
            "predicted_success": p,
            "question": best,
            "had_weak": bool(weak),
            "any_attempted": bool(attempted),
        }
    return None
