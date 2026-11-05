import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sys
import unittest
from fastapi.testclient import TestClient

from main import app
from database import fetch_one

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


class TestFastAPIBackend(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Dynamically discover a valid question_id and concept_id from DB
        q_row = fetch_one("SELECT question_id, concept_id FROM questions LIMIT 1")
        if q_row:
            cls.valid_question_id = q_row[0]
            cls.valid_concept_id = q_row[1]
        else:
            cls.valid_question_id = "Q3_C4"
            cls.valid_concept_id = "C4"

        c_row = fetch_one("SELECT concept_id FROM concepts LIMIT 1")
        if c_row:
            cls.valid_concept_id = c_row[0]

        cls.sample_student_id = "test_api_student_001"

    # Test 1: GET /health
    def test_01_health_endpoint(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data.get("status"), "ok")
        self.assertEqual(json_data.get("service"), "SamSukh LearnVerse API")
        assert_no_expected_answer(json_data)

    # Test 2: GET /question/{valid_question_id}
    def test_02_valid_question(self):
        response = client.get(f"/question/{self.valid_question_id}")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data.get("question_id"), self.valid_question_id)
        self.assertIn("question", json_data)
        self.assertIn("question_type", json_data)
        self.assertIn("hint", json_data)
        self.assertIn("difficulty", json_data)
        assert_no_expected_answer(json_data)

    # Test 3: GET /question/{invalid_question_id}
    def test_03_invalid_question(self):
        response = client.get("/question/NON_EXISTENT_Q999")
        self.assertEqual(response.status_code, 404)
        json_data = response.json()
        self.assertIn("detail", json_data)
        assert_no_expected_answer(json_data)

    # Test 4: GET /next-question/{student_id}
    def test_04_next_question(self):
        response = client.get(f"/next-question/{self.sample_student_id}")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data.get("student_id"), self.sample_student_id)
        self.assertIn("activity_type", json_data)
        self.assertIn("concept_id", json_data)
        self.assertIn("reason", json_data)
        assert_no_expected_answer(json_data)

    # Test 5: POST /answer with valid data
    def test_05_answer_valid(self):
        payload = {
            "student_id": self.sample_student_id,
            "question_id": self.valid_question_id,
            "student_answer": "test answer"
        }
        response = client.post("/answer", json=payload)
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data.get("student_id"), self.sample_student_id)
        self.assertEqual(json_data.get("question_id"), self.valid_question_id)
        self.assertIn("correctness", json_data)
        self.assertIn("feedback", json_data)
        self.assertIn("mastery", json_data)
        self.assertIn("next_activity", json_data)
        assert_no_expected_answer(json_data)

    # Test 6: POST /answer with invalid question ID
    def test_06_answer_invalid_question_id(self):
        payload = {
            "student_id": self.sample_student_id,
            "question_id": "INVALID_Q_9999",
            "student_answer": "some answer"
        }
        response = client.post("/answer", json=payload)
        self.assertEqual(response.status_code, 404)
        json_data = response.json()
        self.assertIn("detail", json_data)
        assert_no_expected_answer(json_data)

    # Test 7: POST /answer with empty answer
    def test_07_answer_empty_answer(self):
        payload = {
            "student_id": self.sample_student_id,
            "question_id": self.valid_question_id,
            "student_answer": ""
        }
        response = client.post("/answer", json=payload)
        # Empty student_answer triggers 400 Bad Request or 422 Unprocessable Entity
        self.assertIn(response.status_code, [400, 422])
        json_data = response.json()
        assert_no_expected_answer(json_data)

    # Test 8: GET /mastery/{student_id}/{concept_id}
    def test_08_mastery(self):
        response = client.get(f"/mastery/{self.sample_student_id}/{self.valid_concept_id}")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data.get("student_id"), self.sample_student_id)
        self.assertEqual(json_data.get("concept_id"), self.valid_concept_id)
        self.assertIn("accuracy", json_data)
        self.assertIn("status", json_data)
        assert_no_expected_answer(json_data)

    # Test 9: GET /weak-concepts/{student_id}
    def test_09_weak_concepts(self):
        response = client.get(f"/weak-concepts/{self.sample_student_id}")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data.get("student_id"), self.sample_student_id)
        self.assertIn("weak_concepts", json_data)
        self.assertIsInstance(json_data["weak_concepts"], list)
        assert_no_expected_answer(json_data)

    # Test 10: POST /speech-to-text
    def test_10_speech_to_text(self):
        payload = {
            "audio_input": "grin",
            "language": "en"
        }
        response = client.post("/speech-to-text", json=payload)
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertTrue(json_data.get("success"))
        self.assertEqual(json_data.get("text"), "grin")
        assert_no_expected_answer(json_data)

        # Test empty audio input handling
        empty_payload = {"audio_input": "", "language": "en"}
        empty_res = client.post("/speech-to-text", json=empty_payload)
        self.assertEqual(empty_res.status_code, 200)
        empty_json = empty_res.json()
        self.assertFalse(empty_json.get("success"))
        assert_no_expected_answer(empty_json)

    # Test 11: Exhaustive Security Check - expected_answer absent from all responses
    def test_11_exhaustive_security_check(self):
        endpoints = [
            ("GET", "/health", None),
            ("GET", f"/question/{self.valid_question_id}", None),
            ("GET", f"/next-question/{self.sample_student_id}", None),
            ("POST", "/answer", {"student_id": self.sample_student_id, "question_id": self.valid_question_id, "student_answer": "grin"}),
            ("GET", f"/mastery/{self.sample_student_id}/{self.valid_concept_id}", None),
            ("GET", f"/weak-concepts/{self.sample_student_id}", None),
            ("POST", "/speech-to-text", {"audio_input": "smile", "language": "en"}),
        ]
        for method, url, body in endpoints:
            if method == "GET":
                res = client.get(url)
            else:
                res = client.post(url, json=body)
            data = res.json()
            assert_no_expected_answer(data, f"{method} {url}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    unittest.main()
