"""Build the dataset, train, evaluate and export the LearnVerse learner model.

Usage (from the backend folder, training deps installed: pip install -r ml/requirements-train.txt):

    python -m ml.train                 # auto: real attempts if there are enough, else simulated
    python -m ml.train --source real   # force real data (fails if too little)
    python -m ml.train --source simulated

Outputs ml/artifacts/learner_model.json (used by the API) and ml/artifacts/evaluation.json.
Nothing in the database is modified: attempts are only read.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.curriculum import load_attempts, load_concepts, load_questions  # noqa: E402
from ml.features import FEATURE_NAMES, LearnerState, parse_time, question_features  # noqa: E402
from ml.model import ARTIFACT_DIR, LearnerModel  # noqa: E402
from ml.recommender import choose_activity  # noqa: E402
from ml.simulate import SimLearner, World, generate_attempts, rule_policy_choice  # noqa: E402

MIN_REAL_ATTEMPTS = 5000
MIN_REAL_STUDENTS = 50
PRIOR_STRENGTH = 10.0
SEED = 2026


# ----------------------------------------------------------------------------- data

def real_rows(questions):
    rows = []
    for r in load_attempts():
        if str(r["student_id"]).startswith("test_"):
            continue  # unit-test fixtures
        if r["question_id"] not in questions:
            continue
        rows.append({"student_id": r["student_id"], "question_id": r["question_id"],
                     "is_correct": int(r["is_correct"]), "t": parse_time(r["attempt_time"])})
    return rows


def split_students(rows, seed=SEED, val=0.15, test=0.15):
    students = sorted({r["student_id"] for r in rows})
    random.Random(seed).shuffle(students)
    n = len(students)
    n_test, n_val = int(n * test), int(n * val)
    return (set(students[n_test + n_val:]), set(students[n_test:n_test + n_val]), set(students[:n_test]))


def concept_priors(rows, questions, students):
    totals = {}
    for r in rows:
        if r["student_id"] in students:
            cid = questions[r["question_id"]]["concept_id"]
            n, k = totals.get(cid, (0, 0))
            totals[cid] = (n + 1, k + r["is_correct"])
    all_n = sum(n for n, _ in totals.values())
    global_p = sum(k for _, k in totals.values()) / all_n if all_n else 0.65
    priors = {cid: (k + PRIOR_STRENGTH * global_p) / (n + PRIOR_STRENGTH) for cid, (n, k) in totals.items()}
    return priors, global_p


def build_features(rows, questions, priors, global_p):
    """Replay each learner's history; features use only the state *before* each attempt."""
    by_student = {}
    for r in rows:
        by_student.setdefault(r["student_id"], []).append(r)
    X, y, groups, rule_signal = [], [], [], []
    for sid in sorted(by_student):
        state = LearnerState()
        for r in sorted(by_student[sid], key=lambda r: (r["t"] or 0)):
            q = questions[r["question_id"]]
            X.append(question_features(state, q, now=r["t"], concept_priors=priors, global_prior=global_p))
            c = state.concepts.get(q["concept_id"])
            rule_signal.append((c[1] + 1) / (c[0] + 2) if c else 0.5)  # what the old rules looked at
            y.append(r["is_correct"])
            groups.append(sid)
            state.update(q, r["is_correct"], when=r["t"])
    return np.array(X, dtype=float), np.array(y, dtype=int), np.array(groups), np.array(rule_signal)


# ----------------------------------------------------------------------------- metrics

def ece(y, p, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    total, err = len(y), 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi) if hi < 1 else (p >= lo) & (p <= hi)
        if m.any():
            err += m.sum() / total * abs(p[m].mean() - y[m].mean())
    return err


def metrics(y, p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {"auc": round(float(roc_auc_score(y, p)), 4), "log_loss": round(float(log_loss(y, p)), 4),
            "brier": round(float(brier_score_loss(y, p)), 4),
            "accuracy": round(float(accuracy_score(y, p >= 0.5)), 4), "ece": round(float(ece(y, p)), 4),
            "n": int(len(y))}


# ----------------------------------------------------------------------------- policy simulation

def policy_simulation(model, world, n_learners=300, budget=10, seed=31337):  # seed 99 was used for policy tuning
    """Paired comparison on fresh simulated learners: same learner, same lesson, three policies."""
    rng = random.Random(seed)
    lessons = [lid for lid, cs in world.by_lesson.items()
               if sum(len(world.by_concept.get(c["concept_id"], [])) for c in cs) >= budget and len(cs) >= 2]
    results = {"ml": [], "rules": [], "random": []}
    for i in range(n_learners):
        learner_seed = rng.randrange(1 << 30)
        lid = rng.choice(lessons)
        concepts = sorted(world.by_lesson[lid], key=lambda c: c.get("sort_order", 0))
        qbc = {c["concept_id"]: world.by_concept.get(c["concept_id"], []) for c in concepts}
        lesson_qs = [q for qs in qbc.values() for q in qs]
        for policy in results:
            learner = SimLearner(world, random.Random(learner_seed))
            prng = random.Random(learner_seed ^ 0x5F5F)
            t = 1790000000.0
            pre = learner.expected_score(lesson_qs, t)
            state, hist, exclude, correct_n = LearnerState(), {}, set(), 0
            for _ in range(budget):
                if policy == "ml":
                    choice = choose_activity(model, state, concepts, qbc, exclude=exclude, now=t)
                    q = choice["question"] if choice else None
                elif policy == "rules":
                    q = rule_policy_choice(hist, learner.seen, concepts, qbc, exclude)
                else:
                    pool = [q for q in lesson_qs if q["question_id"] not in exclude]
                    q = prng.choice(pool) if pool else None
                if q is None:
                    break
                ok = learner.answer(q, t)
                correct_n += int(ok)
                state.update(q, ok, when=t)
                n, k = hist.get(q["concept_id"], (0, 0))
                hist[q["concept_id"]] = (n + 1, k + int(ok))
                exclude.add(q["question_id"])
                t += 60
            post = learner.expected_score(lesson_qs, t + 3600)
            results[policy].append({"gain": post - pre, "post": post, "practice_success": correct_n / budget})
    summary = {}
    for policy, rs in results.items():
        g = np.array([r["gain"] for r in rs])
        summary[policy] = {
            "mean_post_test": round(float(np.mean([r["post"] for r in rs])), 4),
            "mean_gain": round(float(g.mean()), 4),
            "gain_std_err": round(float(g.std(ddof=1) / math.sqrt(len(g))), 4),
            "mean_practice_success": round(float(np.mean([r["practice_success"] for r in rs])), 4),
        }
    diff = np.array([a["gain"] - b["gain"] for a, b in zip(results["ml"], results["rules"])])
    summary["ml_minus_rules_gain"] = {"mean": round(float(diff.mean()), 4),
                                      "std_err": round(float(diff.std(ddof=1) / math.sqrt(len(diff))), 4),
                                      "ml_better_share": round(float((diff > 0).mean()), 4)}
    summary["setup"] = {"learners": n_learners, "questions_per_learner": budget, "policies": list(results)}
    return summary


# ----------------------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["auto", "real", "simulated"], default="auto")
    ap.add_argument("--students", type=int, default=600, help="simulated learners")
    ap.add_argument("--policy-learners", type=int, default=300)
    ap.add_argument("--out", default=ARTIFACT_DIR)
    args = ap.parse_args(argv)
    started = time.time()

    questions, concepts = load_questions(), load_concepts()
    world = World(questions, concepts)
    real = real_rows(questions)
    real_students = len({r["student_id"] for r in real})
    enough_real = len(real) >= MIN_REAL_ATTEMPTS and real_students >= MIN_REAL_STUDENTS
    if args.source == "real" and not enough_real:
        sys.exit(f"Only {len(real)} real attempts from {real_students} learners; need "
                 f">= {MIN_REAL_ATTEMPTS} attempts and >= {MIN_REAL_STUDENTS} learners.")
    source = "real" if args.source == "real" or (args.source == "auto" and enough_real) else "simulated"
    rows = real if source == "real" else generate_attempts(world, n_students=args.students)
    print(f"Data source: {source}  ({len(rows)} attempts, {len({r['student_id'] for r in rows})} learners; "
          f"real attempts available: {len(real)} from {real_students} learners)")

    train_s, val_s, test_s = split_students(rows)
    priors, global_p = concept_priors(rows, questions, train_s | val_s)
    X, y, groups, rule_sig = build_features(rows, questions, priors, global_p)
    tr, va, te = np.isin(groups, list(train_s)), np.isin(groups, list(val_s)), np.isin(groups, list(test_s))
    print(f"Rows  train={tr.sum()}  val={va.sum()}  test={te.sum()}  positive rate={y.mean():.3f}")

    # model selection on the validation learners
    scaler = StandardScaler().fit(X[tr])
    best_c, best_ll = None, float("inf")
    selection = {}
    for c in (0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0, 30.0):
        lr = LogisticRegression(C=c, max_iter=2000).fit(scaler.transform(X[tr]), y[tr])
        ll = log_loss(y[va], lr.predict_proba(scaler.transform(X[va]))[:, 1])
        selection[str(c)] = round(float(ll), 5)
        if ll < best_ll:
            best_c, best_ll = c, ll
    print(f"Selected C={best_c} (val log loss {best_ll:.4f})")

    # final fit on train+val, evaluate once on held-out test learners
    fit = tr | va
    scaler = StandardScaler().fit(X[fit])
    lr = LogisticRegression(C=best_c, max_iter=2000).fit(scaler.transform(X[fit]), y[fit])
    p_lr = lr.predict_proba(scaler.transform(X[te]))[:, 1]

    hgb = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=31,
                                         random_state=SEED).fit(X[fit], y[fit])
    p_hgb = hgb.predict_proba(X[te])[:, 1]

    diff_cols = [FEATURE_NAMES.index(n) for n in ("diff_easy", "diff_medium", "diff_hard", "is_mcq", "guess_rate")]
    item_only = LogisticRegression(max_iter=2000).fit(X[fit][:, diff_cols], y[fit])
    p_item = item_only.predict_proba(X[te][:, diff_cols])[:, 1]

    evaluation = {
        "logistic_regression (deployed)": metrics(y[te], p_lr),
        "gradient_boosting (comparison)": metrics(y[te], p_hgb),
        "baseline: old rule signal (concept accuracy so far)": metrics(y[te], rule_sig[te]),
        "baseline: question difficulty/type only": metrics(y[te], p_item),
        "baseline: global average": metrics(y[te], np.full(te.sum(), y[fit].mean())),
    }
    print("\nHeld-out test learners:")
    for name, m in evaluation.items():
        print(f"  {name:52s} AUC={m['auc']:.4f}  logloss={m['log_loss']:.4f}  brier={m['brier']:.4f}  "
              f"acc={m['accuracy']:.4f}  ECE={m['ece']:.4f}")

    version = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{source}"
    artifact = {
        "version": version,
        "algorithm": "logistic_regression",
        "data_source": source,
        "feature_names": FEATURE_NAMES,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "coef": lr.coef_[0].tolist(),
        "intercept": float(lr.intercept_[0]),
        "C": best_c,
        "concept_priors": {k: round(v, 5) for k, v in priors.items()},
        "global_prior": round(global_p, 5),
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "training_rows": int(fit.sum()),
        "test_metrics": evaluation["logistic_regression (deployed)"],
    }

    model = LearnerModel(artifact)
    # sanity: pure-Python inference must match scikit-learn
    check = np.array([model.predict_vector(x) for x in X[te][:500]])
    max_abs = float(np.max(np.abs(check - p_lr[:500])))
    assert max_abs < 1e-9, f"pure-Python inference mismatch: {max_abs}"

    print("\nPolicy simulation (fresh simulated learners, paired)...")
    policy = policy_simulation(model, world, n_learners=args.policy_learners)
    for k in ("ml", "rules", "random"):
        print(f"  {k:7s} post-test={policy[k]['mean_post_test']:.4f}  gain={policy[k]['mean_gain']:.4f} "
              f"(+-{policy[k]['gain_std_err']:.4f})  practice success={policy[k]['mean_practice_success']:.3f}")
    d = policy["ml_minus_rules_gain"]
    print(f"  ML - rules gain: {d['mean']:+.4f} (+-{d['std_err']:.4f}); ML better for {d['ml_better_share']:.0%} of learners")

    weights = sorted(zip(FEATURE_NAMES, lr.coef_[0]), key=lambda kv: -abs(kv[1]))
    report = {
        "version": version,
        "data_source": source,
        "data": {"attempts": len(rows), "learners": len({r["student_id"] for r in rows}),
                 "real_attempts_available": len(real), "real_learners_available": real_students,
                 "min_real_attempts_required": MIN_REAL_ATTEMPTS, "min_real_learners_required": MIN_REAL_STUDENTS,
                 "split_by_learner": {"train": len(train_s), "val": len(val_s), "test": len(test_s)},
                 "rows": {"train": int(tr.sum()), "val": int(va.sum()), "test": int(te.sum())},
                 "positive_rate": round(float(y.mean()), 4)},
        "model_selection_val_log_loss_by_C": selection,
        "selected_C": best_c,
        "test_metrics": evaluation,
        "inference_check_max_abs_diff": max_abs,
        "standardised_coefficients": {k: round(float(v), 4) for k, v in weights},
        "policy_simulation": policy,
        "runtime_sec": round(time.time() - started, 1),
    }
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "learner_model.json"), "w", encoding="utf-8") as fh:
        json.dump(artifact, fh, indent=1)
    with open(os.path.join(args.out, "evaluation.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)
    print(f"\nSaved model {version} to {args.out} in {report['runtime_sec']}s")


if __name__ == "__main__":
    main()
