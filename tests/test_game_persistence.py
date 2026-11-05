import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from fastapi.testclient import TestClient
from main import app
from database import fetch_one, execute_commit
from mastery_engine import calculate_mastery
from game_progress import save_game_attempt, get_game_attempts

client = TestClient(app)


def assert_no_expected_answer(data, path="root"):
    """
    Recursively asserts that 'expected_answer' key never appears in any dict or list response.
    """
    if isinstance(data, dict):
        for k, v in data.items():
            assert k != "expected_answer", f"Security violation: 'expected_answer' key found at path '{path}.{k}'"
            assert_no_expected_answer(v, f"{path}.{k}")
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            assert_no_expected_answer(item, f"{path}[{idx}]")


class TestGamePersistence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.test_student = "test_game_student_999"
        # Clean any prior attempts for test student
        execute_commit("DELETE FROM game_attempts WHERE student_id = ?", (cls.test_student,))
        execute_commit("DELETE FROM attempts WHERE student_id = ?", (cls.test_student,))

    def test_01_save_game_attempt_validation(self):
        """
        Verify validation rules for saving game attempts.
        """
        # Empty student_id
        res = client.post("/game/save-attempt", json={
            "student_id": "",
            "game_id": "unit1_school_bell_run",
            "score": 100,
            "stars": 3,
            "completed_challenges": 4,
            "total_challenges": 4
        })
        self.assertEqual(res.status_code, 400)

        # Invalid score > 100
        res = client.post("/game/save-attempt", json={
            "student_id": self.test_student,
            "game_id": "unit1_school_bell_run",
            "score": 150,
            "stars": 3,
            "completed_challenges": 4,
            "total_challenges": 4
        })
        self.assertEqual(res.status_code, 422)  # Pydantic validation error

        # Invalid stars < 1
        res = client.post("/game/save-attempt", json={
            "student_id": self.test_student,
            "game_id": "unit1_school_bell_run",
            "score": 80,
            "stars": 0,
            "completed_challenges": 4,
            "total_challenges": 4
        })
        self.assertEqual(res.status_code, 422)

    def test_02_save_game_attempt_success(self):
        """
        Verify saving a valid Unit 1 game attempt with challenge breakdown.
        """
        payload = {
            "student_id": self.test_student,
            "game_id": "unit1_school_bell_run",
            "lesson_id": "1.1",
            "score": 94,
            "stars": 3,
            "completed_challenges": 4,
            "total_challenges": 4,
            "is_completed": True,
            "challenges": [
                {
                    "challenge_index": 0,
                    "question_id": "Q3_C1",
                    "concept_id": "C1",
                    "student_answer": "jump",
                    "is_correct": True,
                    "attempts_count": 1
                },
                {
                    "challenge_index": 1,
                    "question_id": "Q1_C2",
                    "concept_id": "C2",
                    "student_answer": "hurray",
                    "is_correct": True,
                    "attempts_count": 2
                },
                {
                    "challenge_index": 2,
                    "question_id": "Q2_C2",
                    "concept_id": "C2",
                    "student_answer": "in",
                    "is_correct": True,
                    "attempts_count": 1
                },
                {
                    "challenge_index": 3,
                    "question_id": "Q1_C4",
                    "concept_id": "C4",
                    "student_answer": "bell",
                    "is_correct": True,
                    "attempts_count": 1
                }
            ],
            "record_mastery": True
        }

        res = client.post("/game/save-attempt", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("student_id"), self.test_student)
        self.assertEqual(data.get("game_id"), "unit1_school_bell_run")
        self.assertEqual(data.get("score"), 94)
        self.assertEqual(data.get("stars"), 3)
        self.assertEqual(data.get("completed_challenges"), 4)
        self.assertTrue(data.get("is_completed"))
        self.assertIsNotNone(data.get("created_at"))
        self.assertGreaterEqual(data.get("mastery_attempts_recorded", 0), 1)
        assert_no_expected_answer(data)

    def test_03_get_game_attempts(self):
        """
        Verify retrieving game attempts for the student.
        """
        res = client.get(f"/game/attempts/{self.test_student}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("student_id"), self.test_student)
        attempts = data.get("attempts", [])
        self.assertGreaterEqual(len(attempts), 1)
        latest = attempts[0]
        self.assertEqual(latest.get("game_id"), "unit1_school_bell_run")
        self.assertEqual(latest.get("score"), 94)
        self.assertEqual(latest.get("stars"), 3)
        self.assertEqual(latest.get("completed_challenges"), 4)
        assert_no_expected_answer(data)

    def test_04_mastery_engine_integration_without_overwriting(self):
        """
        Verify that game challenge attempts feed into mastery calculation
        strictly via established scoring rules without overwriting prior attempts.
        """
        # Concept C1 should now have attempts from the game attempt
        mastery_c1 = calculate_mastery(self.test_student, "C1")
        self.assertGreater(mastery_c1["accuracy"], 0)
        self.assertIn(mastery_c1["status"], ["Mastered", "Learning"])

        # Concept C2 should now have 2 attempts from the game attempt
        mastery_c2 = calculate_mastery(self.test_student, "C2")
        self.assertGreater(mastery_c2["accuracy"], 0)

        # Record another attempt and confirm previous attempts were preserved (cumulative count increases)
        prior_count = fetch_one("SELECT COUNT(*) FROM attempts WHERE student_id = ?", (self.test_student,))[0]
        self.assertGreater(prior_count, 0)

        save_game_attempt(
            student_id=self.test_student,
            game_id="unit1_school_bell_run",
            lesson_id="1.1",
            score=100,
            stars=3,
            completed_challenges=4,
            total_challenges=4,
            is_completed=True,
            details=[{"question_id": "Q3_C1", "student_answer": "jump", "is_correct": True}],
            record_mastery=True
        )

        new_count = fetch_one("SELECT COUNT(*) FROM attempts WHERE student_id = ?", (self.test_student,))[0]
        self.assertEqual(new_count, prior_count + 1, "New attempt must append without overwriting prior progress")


if __name__ == "__main__":
    unittest.main()
