"""Tests for the trained ML recommendation model (backend/ml)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient  # noqa: E402

from adaptive_engine import get_next_activity  # noqa: E402
from database import execute_commit, fetch_all  # noqa: E402
from main import app  # noqa: E402
from ml.curriculum import load_concepts, load_questions  # noqa: E402
from ml.features import FEATURE_NAMES, LearnerState, question_features, reference_question  # noqa: E402
from ml.model import get_model, model_status  # noqa: E402
from ml.recommender import TARGET_SUCCESS, choose_activity, concept_readiness  # noqa: E402

STUDENT = "test_ml_student"


class TestMLRecommender(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = get_model()
        cls.questions = load_questions()
        cls.concepts = load_concepts()

    @classmethod
    def tearDownClass(cls):
        execute_commit("DELETE FROM attempts WHERE student_id LIKE 'test_ml_%'")

    def test_artifact_loaded(self):
        status = model_status()
        self.assertTrue(status["loaded"], status)
        self.assertEqual(len(self.model.coef), len(FEATURE_NAMES))

    def test_features_use_only_past(self):
        """The feature vector for an attempt must not change when that attempt is recorded later."""
        q = self.questions["Q1_C2"]
        state = LearnerState()
        before = question_features(state, q)
        self.assertEqual(before, question_features(LearnerState(), q))
        state.update(q, True)
        self.assertNotEqual(before, question_features(state, q))

    def test_predictions_adapt_to_performance(self):
        concept = self.concepts["M1.2_C1"] if "M1.2_C1" in self.concepts else next(iter(self.concepts.values()))
        qs = [q for q in self.questions.values() if q["concept_id"] == concept["concept_id"]]
        strong, weak = LearnerState(), LearnerState()
        for q in qs[:4]:
            strong.update(q, True)
            weak.update(q, False)
        r_strong = concept_readiness(self.model, strong, concept)
        r_weak = concept_readiness(self.model, weak, concept)
        r_new = concept_readiness(self.model, LearnerState(), concept)
        self.assertGreater(r_strong, r_new)
        self.assertGreater(r_new, r_weak)

    def test_harder_questions_predicted_harder(self):
        state = LearnerState()
        base = reference_question(next(iter(self.concepts.values())))
        easy = self.model.predict(state, {**base, "difficulty": "Easy"})
        hard = self.model.predict(state, {**base, "difficulty": "Hard"})
        self.assertGreater(easy, hard)

    def test_question_choice_targets_success_rate(self):
        concepts = [c for c in self.concepts.values() if c["lesson_id"] == "1.1"]
        qbc = {}
        for q in self.questions.values():
            qbc.setdefault(q["concept_id"], []).append(q)
        state = LearnerState()
        state.update(self.questions["Q1_C1"], True)
        choice = choose_activity(self.model, state, concepts, qbc)
        self.assertIsNotNone(choice)
        pool = [q for q in qbc[choice["concept_id"]] if q["question_id"] not in state.questions]
        best_gap = min(abs(self.model.predict(state, q) - TARGET_SUCCESS) for q in pool)
        self.assertAlmostEqual(abs(choice["predicted_success"] - TARGET_SUCCESS), best_gap, places=9)

    def test_engine_uses_model_and_keeps_payload(self):
        execute_commit("DELETE FROM attempts WHERE student_id = ?", (STUDENT,))
        execute_commit("INSERT INTO attempts (student_id, question_id, student_answer, is_correct) "
                       "VALUES (?, 'Q1_C2', 'x', 0), (?, 'Q2_C2', 'y', 0)", (STUDENT, STUDENT))
        activity = get_next_activity(STUDENT)
        self.assertEqual(activity["recommendation"]["engine"], "ml")
        for key in ("student_id", "action", "concept_id", "concept_name", "mastery_status", "reason", "question"):
            self.assertIn(key, activity)
        self.assertNotIn("expected_answer", activity["question"])
        self.assertEqual(activity["question"]["concept_id"], activity["concept_id"])
        rows = fetch_all("SELECT COUNT(*) FROM attempts WHERE student_id = ?", (STUDENT,))
        self.assertEqual(rows[0][0], 2, "recommending must not write attempts")

    def test_api_status_and_next_question(self):
        client = TestClient(app)
        self.assertEqual(client.get("/ml/status").json()["engine"], "ml")
        data = client.get(f"/next-question/{STUDENT}").json()
        self.assertEqual(data["recommendation"]["engine"], "ml")
        self.assertIn(data["activity_type"], ("introduce", "practice", "progress"))


if __name__ == "__main__":
    unittest.main()
