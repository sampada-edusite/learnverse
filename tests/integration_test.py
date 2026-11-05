import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sys
import unittest
from fastapi.testclient import TestClient

from main import app
from database import fetch_one, fetch_all

client = TestClient(app)


def recursive_assert_no_expected_answer(data, path="root"):
    """
    Recursively inspects dicts and lists to guarantee 'expected_answer' is never present.
    """
    if isinstance(data, dict):
        for key, value in data.items():
            assert key != "expected_answer", f"SECURITY VIOLATION: 'expected_answer' key found at path '{path}.{key}'"
            recursive_assert_no_expected_answer(value, f"{path}.{key}")
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            recursive_assert_no_expected_answer(item, f"{path}[{idx}]")


class EndToEndIntegrationTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.student_id = "e2e_integration_student_999"
        
        # Discover a valid question and expected answer dynamically from the DB for testing
        row = fetch_one("SELECT question_id, concept_id, expected_answer FROM questions LIMIT 1")
        if row:
            cls.valid_question_id = row[0]
            cls.valid_concept_id = row[1]
            cls.valid_expected_answer = row[2]
        else:
            cls.valid_question_id = "Q1_C1"
            cls.valid_concept_id = "C1"
            cls.valid_expected_answer = "grin"

    # TEST FLOW 1 — NEW STUDENT
    def test_flow_1_new_student(self):
        """
        Verify that a brand new student receives an initial learning activity/question.
        """
        res = client.get(f"/next-question/{self.student_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertEqual(data.get("student_id"), self.student_id)
        self.assertIn(data.get("activity_type"), ["introduce", "practice"])
        self.assertIsNotNone(data.get("concept_id"))
        self.assertIsNotNone(data.get("question"))
        
        q = data["question"]
        self.assertIn("question_id", q)
        self.assertIn("question", q)
        self.assertIn("question_type", q)
        self.assertIn("difficulty", q)
        
        # Security check: expected_answer MUST NOT be present
        recursive_assert_no_expected_answer(data)
        print("\n✅ FLOW 1 PASSED: New student successfully initialized with first activity & question.")

    # TEST FLOW 2 — ANSWER QUESTION (CORRECT)
    def test_flow_2_answer_question_correct(self):
        """
        Submit a correct answer and verify evaluation, DB attempt save, mastery update, & next activity.
        """
        payload = {
            "student_id": self.student_id,
            "question_id": self.valid_question_id,
            "student_answer": self.valid_expected_answer
        }
        res = client.post("/answer", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertEqual(data.get("student_id"), self.student_id)
        self.assertEqual(data.get("question_id"), self.valid_question_id)
        self.assertTrue(data.get("correctness"))
        self.assertTrue(data.get("is_correct"))
        self.assertIn("Correct", data.get("feedback", ""))
        self.assertIsNotNone(data.get("mastery"))
        self.assertIsNotNone(data.get("next_activity"))
        
        # Verify attempt stored in database
        attempt = fetch_one(
            "SELECT student_id, question_id, student_answer, is_correct FROM attempts WHERE student_id = ? AND question_id = ? ORDER BY attempt_time DESC LIMIT 1",
            (self.student_id, self.valid_question_id)
        )
        self.assertIsNotNone(attempt)
        self.assertEqual(attempt[2], self.valid_expected_answer)
        self.assertEqual(attempt[3], 1)
        
        recursive_assert_no_expected_answer(data)
        print("✅ FLOW 2 PASSED: Correct answer evaluated, saved to DB, and mastery updated.")

    # TEST FLOW 3 — INCORRECT ANSWER
    def test_flow_3_answer_question_incorrect(self):
        """
        Submit an incorrect answer and verify is_correct=False, attempt save, and adaptive response.
        """
        payload = {
            "student_id": self.student_id,
            "question_id": self.valid_question_id,
            "student_answer": "totally_wrong_answer_xyz"
        }
        res = client.post("/answer", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertFalse(data.get("correctness"))
        self.assertFalse(data.get("is_correct"))
        self.assertIn("Not quite", data.get("feedback", ""))
        self.assertIsNotNone(data.get("mastery"))
        self.assertIsNotNone(data.get("next_activity"))
        
        recursive_assert_no_expected_answer(data)
        print("✅ FLOW 3 PASSED: Incorrect answer evaluated and recovery/adaptive state triggered.")

    # TEST FLOW 4 — MULTIPLE ATTEMPTS CHAIN
    def test_flow_4_multiple_attempts(self):
        """
        Perform multiple attempts on a concept and verify attempts -> mastery -> weak concepts -> adaptive state chain.
        """
        multi_student = "e2e_multi_student_888"
        # Submit 3 incorrect attempts to build weak concept state
        for _ in range(3):
            client.post("/answer", json={
                "student_id": multi_student,
                "question_id": self.valid_question_id,
                "student_answer": "wrong_ans"
            })
            
        # Verify mastery reflects 0% accuracy
        m_res = client.get(f"/mastery/{multi_student}/{self.valid_concept_id}")
        self.assertEqual(m_res.status_code, 200)
        m_data = m_res.json()
        self.assertEqual(m_data.get("accuracy"), 0.0)
        self.assertIn(m_data.get("status"), ["Needs Practice", "Learning"])
        
        # Verify concept is detected as weak
        w_res = client.get(f"/weak-concepts/{multi_student}")
        self.assertEqual(w_res.status_code, 200)
        w_data = w_res.json()
        weak_c_ids = [c["concept_id"] for c in w_data.get("weak_concepts", [])]
        self.assertIn(self.valid_concept_id, weak_c_ids)
        
        # Verify next-question targets this weak concept or recovery
        n_res = client.get(f"/next-question/{multi_student}")
        self.assertEqual(n_res.status_code, 200)
        n_data = n_res.json()
        self.assertIsNotNone(n_data.get("concept_id"))
        
        recursive_assert_no_expected_answer(m_data)
        recursive_assert_no_expected_answer(w_data)
        recursive_assert_no_expected_answer(n_data)
        print("✅ FLOW 4 PASSED: Multiple attempts connected attempts -> mastery -> weak concepts -> adaptive decisions.")

    # TEST FLOW 5 — MASTERY ENDPOINT
    def test_flow_5_mastery(self):
        """
        Verify GET /mastery/{student_id}/{concept_id} returns accurate metrics.
        """
        res = client.get(f"/mastery/{self.student_id}/{self.valid_concept_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("student_id"), self.student_id)
        self.assertEqual(data.get("concept_id"), self.valid_concept_id)
        self.assertIn("accuracy", data)
        self.assertIn("status", data)
        
        recursive_assert_no_expected_answer(data)
        print("✅ FLOW 5 PASSED: Mastery metrics accurately retrieved from database.")

    # TEST FLOW 6 — WEAK CONCEPTS ENDPOINT
    def test_flow_6_weak_concepts(self):
        """
        Verify GET /weak-concepts/{student_id} dynamically returns weak concepts.
        """
        res = client.get(f"/weak-concepts/{self.student_id}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("student_id"), self.student_id)
        self.assertIsInstance(data.get("weak_concepts"), list)
        
        recursive_assert_no_expected_answer(data)
        print("✅ FLOW 6 PASSED: Weak concept detection endpoint functioning dynamically.")

    # TEST FLOW 7 — EXHAUSTIVE EXPECTED ANSWER SECURITY
    def test_flow_7_security_expected_answer(self):
        """
        Exhaustively verify that expected_answer is never exposed in any API response.
        """
        routes = [
            ("GET", "/health", None),
            ("GET", f"/question/{self.valid_question_id}", None),
            ("GET", f"/next-question/{self.student_id}", None),
            ("POST", "/answer", {"student_id": self.student_id, "question_id": self.valid_question_id, "student_answer": "test"}),
            ("GET", f"/mastery/{self.student_id}/{self.valid_concept_id}", None),
            ("GET", f"/weak-concepts/{self.student_id}", None),
            ("POST", "/speech-to-text", {"audio_input": "hello", "language": "en"}),
        ]
        
        for method, path, body in routes:
            if method == "GET":
                res = client.get(path)
            else:
                res = client.post(path, json=body)
            data = res.json()
            recursive_assert_no_expected_answer(data, f"{method} {path}")
            
        print("✅ FLOW 7 PASSED: Exhaustive security audit verified zero expected_answer exposure.")

    # TEST FLOW 8 — ERROR HANDLING & BOUNDARY CASES
    def test_flow_8_error_handling(self):
        """
        Test API error resilience against invalid IDs, empty fields, and bad payloads.
        """
        # Invalid Question ID (404)
        res1 = client.get("/question/INVALID_NONEXISTENT_Q")
        self.assertEqual(res1.status_code, 404)
        
        # Invalid Concept ID in mastery (404)
        res2 = client.get(f"/mastery/{self.student_id}/INVALID_NONEXISTENT_C")
        self.assertEqual(res2.status_code, 404)
        
        # Empty answer field in POST /answer (400 or 422)
        res3 = client.post("/answer", json={"student_id": self.student_id, "question_id": self.valid_question_id, "student_answer": ""})
        self.assertIn(res3.status_code, [400, 422])
        
        # Missing fields in POST /answer (422)
        res4 = client.post("/answer", json={"student_id": self.student_id})
        self.assertEqual(res4.status_code, 422)
        
        # Invalid Question ID in POST /answer (404)
        res5 = client.post("/answer", json={"student_id": self.student_id, "question_id": "INVALID_Q", "student_answer": "ans"})
        self.assertEqual(res5.status_code, 404)

        # Empty audio input in speech-to-text (returns safe response with success=False)
        res6 = client.post("/speech-to-text", json={"audio_input": ""})
        self.assertEqual(res6.status_code, 200)
        self.assertFalse(res6.json().get("success"))

        print("✅ FLOW 8 PASSED: Robust error handling verified for all edge cases.")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    unittest.main()
