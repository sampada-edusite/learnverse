# LearnVerse ML recommendation model

This folder replaces the rule-based "what next?" logic with a trained model. Mastery tracking
(`mastery_engine.py`, 80% / 50% thresholds) and all progress data are unchanged; the model only
decides **which concept and which question** a learner gets next.

> **Important limitation.** When this was built the database held only 2 real answer attempts,
> so the shipped model (`artifacts/learner_model.json`, version `20261114142159-simulated`) was
> trained on **simulated learners** working through the real curriculum. The numbers below show
> the pipeline works and beats the old rules *inside the simulation*; they are **not** evidence
> about real children. Retrain on real data (see "Retraining") once enough attempts exist.

## What the model predicts

For a learner and a candidate question, the model predicts **P(learner answers correctly)**. It is
a logistic regression (knowledge-tracing style, similar in spirit to Performance Factors
Analysis) over 23 features computed from the learner's history *before* the question:

| Group | Features |
|---|---|
| This concept | attempts, smoothed accuracy, wrong answers, last result, last-3 accuracy, streak, evidence-weighted accuracy, hours since last practice |
| This learner overall | smoothed overall accuracy, total attempts, accuracy on sibling concepts in the lesson |
| This question | Easy / Medium / Hard, multiple choice, guess rate (1/options), seen before, last result on it |
| Content | subject, Std 1/2, learned population difficulty of the concept |

Feature code lives in `features.py` and is shared by training and live inference, so the two
cannot drift apart. Inference is pure Python (a dot product); the API needs no extra packages.

## How recommendations are made (`recommender.py`)

1. **Concept readiness** = predicted P(correct) on a reference Medium, non-guessable question of
   that concept.
2. A brand-new learner starts with the first concept and an Easy question (cold start).
3. Otherwise every practised concept competes with the next unpractised concept in curriculum
   order; the **least ready** one is chosen.
4. Within that concept, the unseen question whose predicted success is closest to **70%** is served.
5. The action label / reason shown to the child still comes from the existing mastery status.

If the model file is missing or invalid, `adaptive_engine.py` falls back to the original rule
engine automatically. `GET /ml/status` shows which engine is active; `GET /next-question/...` and
`POST /answer` responses now include an extra `recommendation` object (engine, model version,
readiness, predicted success). Existing fields are unchanged.

## Training data

`train.py --source auto` uses real attempts from the `attempts` table when there are at least
**5,000 attempts from 50 learners** (unit-test fixtures `test_*` are ignored); otherwise it uses
the simulator in `simulate.py`.

The simulator gives every virtual learner a hidden ability, learning speed, forgetting rate, slip
rate and **individual strengths/gaps per concept**; every concept and question gets a hidden
difficulty seeded from its real label; multiple-choice questions can be guessed. Practice choices
mix weakest-first, random and curriculum-order behaviour so the data isn't produced by one policy.
The model never sees the hidden values, only answer history.

Shipped run: 600 simulated learners, 96,020 attempts, positive rate 71.4%. Learners (not
attempts) were split 70/15/15 into train/validation/test so no learner appears in two splits.
The regularisation strength C was picked on validation log loss (C = 0.03), then the model was
refit on train+validation and evaluated **once** on the 90 held-out test learners (14,766 answers).

## Evaluation (held-out simulated learners)

| Model | AUC | Log loss | Brier | Accuracy | ECE |
|---|---|---|---|---|---|
| **Logistic regression (deployed)** | **0.764** | **0.512** | **0.168** | **0.757** | **0.017** |
| Gradient boosting (comparison only) | 0.765 | 0.509 | 0.167 | 0.759 | 0.006 |
| Old rule signal (concept accuracy so far) | 0.673 | 0.614 | 0.213 | 0.678 | 0.129 |
| Question difficulty/type only | 0.644 | 0.582 | 0.197 | 0.709 | 0.023 |
| Global average | 0.500 | 0.611 | 0.210 | 0.700 | 0.017 |

Gradient boosting is only marginally better, so the simpler logistic regression is deployed:
no runtime dependencies, transparent weights, well calibrated. The pure-Python inference was
checked against scikit-learn (max difference 3e-16).

Largest standardised weights: overall accuracy (+0.60), practice on the concept (+0.51), concept
population difficulty (+0.36), Hard question (−0.34), Easy question (+0.27), wrong answers on the
concept (−0.25).

### Policy simulation (does it recommend better?)

300 fresh simulated learners (seed not used for tuning), each given 10 practice questions in one
lesson by each policy (same learner, same lesson; paired). Score = expected post-test score on all
questions of that lesson.

| Policy | Mean learning gain | Practice success rate |
|---|---|---|
| **ML (deployed)** | **0.170 ± 0.006** | 66.2% |
| Original rules | 0.164 ± 0.005 | 69.8% |
| Random questions | 0.170 ± 0.006 | 66.4% |

ML minus rules: **+0.006 ± 0.001**, better for 66% of learners. **Honest reading:** the ML policy
beats the original rules by a small but statistically clear margin, and **ties** random selection
in this simulation (with only ~12 questions per lesson, spreading practice widely already works
well). The simulator does not model motivation or frustration, which is why the policy targets a
70% success rate instead of the slightly higher-gain lower targets seen during tuning.

Tuning notes: an earlier "weak concepts first" variant using the same model gained only +0.003
over the rules; the least-ready strategy was adopted because it did clearly better. Tuning used
simulation seed 99; the reported numbers use an untouched seed.

### Known behaviour changes vs the old rules

* A learner with 3/4 correct on an easy concept may be moved on to the next concept (the model
  judges them ready) instead of being kept on it because 75% < 80%.
* Between two weak concepts the model may pick the one with the higher raw accuracy if that
  concept is much harder in general (e.g. Rhyming Words), because the predicted chance of
  success there is lower.
* After repeated wrong answers, the existing recovery engine (easier question + hint) still runs
  first, exactly as before.

Three assertions in `tests/test_adaptive_engine.py` and `tests/test_unit1_learning_flow.py` that
hard-coded the old thresholds now check the ML invariant instead (the chosen concept is rated at
most as ready as the one the rule would have picked). With the model removed they still check the
original rule behaviour, and both modes pass.

## Retraining

```bash
cd backend
python -m pip install -r ml/requirements-train.txt
python -m ml.train                  # auto: real data if enough, else simulated
python -m ml.train --source real    # refuse to train unless enough real data exists
```

The script only reads the database. It writes `artifacts/learner_model.json` and
`artifacts/evaluation.json`; the running API picks up a new model file automatically. Compare the
new `evaluation.json` with the table above before keeping a retrained model.
