"""Tests for resume points, history, assignment scores and the AI homework builder."""
import json
import os
import sys
import types
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient  # noqa: E402

import homework_ai  # noqa: E402
from database import execute_commit, fetch_one  # noqa: E402
from main import app  # noqa: E402
from test_teacher_platform import login_teacher, rand_mobile  # noqa: E402

client = TestClient(app)


def new_student(class_code=None, cls=1):
    r = client.post("/students/register", json={"name": "Test Resume Kid", "student_class": cls,
                                               "parent_mobile": rand_mobile(), "class_code": class_code})
    assert r.status_code == 200, r.text
    return r.json()["student"]["student_id"]


class TestResumeAndHistory(unittest.TestCase):
    def test_resume_roundtrip_and_validation(self):
        sid = new_student()
        key = "lesson:M1.2"
        self.assertIsNone(client.get(f"/students/{sid}/resume/{key}").json()["item"])
        state = {"exclude": ["Q1", "Q2"], "roundCount": 2, "roundCorrect": 1}
        r = client.put(f"/students/{sid}/resume/{key}", json={"state": state, "label": "Maths · Numbers"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(client.get(f"/students/{sid}/resume/{key}").json()["item"]["state"], state)
        client.put(f"/students/{sid}/resume/quiz:12", json={"state": {"index": 3}})
        items = client.get(f"/students/{sid}/resume").json()["items"]
        self.assertEqual({i["key"] for i in items}, {key, "quiz:12"})
        self.assertEqual(client.delete(f"/students/{sid}/resume/{key}").status_code, 200)
        self.assertIsNone(client.get(f"/students/{sid}/resume/{key}").json()["item"])
        # validation
        self.assertEqual(client.put(f"/students/{sid}/resume/BAD KEY", json={"state": {}}).status_code, 422)
        big = {"x": "a" * 20000}
        self.assertEqual(client.put(f"/students/{sid}/resume/lesson:M1.3", json={"state": big}).status_code, 413)
        self.assertEqual(client.get("/students/stu_does_not_exist/resume").status_code, 404)

    def test_history_lists_answers(self):
        sid = new_student()
        client.post("/answer", json={"student_id": sid, "question_id": "Q1_C2", "student_answer": "hurray"})
        h = client.get(f"/students/{sid}/history").json()
        self.assertEqual(len(h["answers"]), 1)
        self.assertEqual(h["answers"][0]["question_id"], "Q1_C2")
        self.assertIn("quizzes", h)
        self.assertIn("games", h)

    @classmethod
    def tearDownClass(cls):
        execute_commit("DELETE FROM resume_state WHERE student_id IN (SELECT student_id FROM students WHERE name = 'Test Resume Kid')")


class TestHomeworkAndScores(unittest.TestCase):
    def setUp(self):
        self.H, self.teacher, _ = login_teacher("Test Homework Teacher")
        self.sid = new_student(self.teacher["class_code"])

    def test_generate_bank_engine_and_assign_with_scores(self):
        with mock.patch.object(homework_ai, "claude_configured", return_value=False):
            r = client.post("/teacher/homework/generate", json={"lesson_id": "M1.2", "count": 6}, headers=self.H)
        self.assertEqual(r.status_code, 200, r.text)
        draft = r.json()
        self.assertEqual(draft["engine"], "ml-bank")
        self.assertGreaterEqual(len(draft["questions"]), 3)
        for q in draft["questions"]:
            self.assertIn(q["correct_answer"], q["options"])
        self.assertTrue(draft["focus_concepts"])
        readiness = [c["readiness"] for c in draft["focus_concepts"]]
        self.assertEqual(readiness, sorted(readiness), "weakest concepts first")

        body = {"lesson_id": "M1.2", "title": draft["title"], "instructions": draft["instructions"],
                "due_date": draft["due_date"], "questions": draft["questions"], "add_practice": True, "practice_target": 2}
        r = client.post("/teacher/homework/assign", json=body, headers=self.H)
        self.assertEqual(r.status_code, 200, r.text)
        out = r.json()
        quiz_id = out["quiz"]["quiz_id"]
        self.assertIsNotNone(out["practice"])

        # student takes the quiz: one right answer, rest wrong
        quiz = client.get(f"/students/{self.sid}/quizzes/{quiz_id}").json()
        answers = {str(q["id"]): q["options"][0] for q in quiz["questions"]}
        client.post(f"/students/{self.sid}/quizzes/{quiz_id}/submit", json={"answers": answers})
        items = client.get(f"/students/{self.sid}/assignments").json()["assignments"]
        hw = next(a for a in items if a["kind"] == "quiz")
        self.assertIsNotNone(hw["score"])
        self.assertEqual(hw["score"]["possible"], len(quiz["questions"]))
        practice = next(a for a in items if a["kind"] == "lesson")
        self.assertIsNone(practice["score"])  # not attempted yet

        nq = client.get(f"/next-question/{self.sid}", params={"lesson_id": "M1.2"}).json()
        client.post("/answer", json={"student_id": self.sid, "question_id": nq["question"]["question_id"],
                                     "student_answer": "zzz", "lesson_id": "M1.2"})
        items = client.get(f"/students/{self.sid}/assignments").json()["assignments"]
        practice = next(a for a in items if a["kind"] == "lesson")
        self.assertEqual(practice["score"]["possible"], 1)
        self.assertEqual(practice["score"]["percent"], 0)

        listing = client.get("/teacher/assignments", headers=self.H).json()["assignments"]
        hw_row = next(a for a in listing if a["kind"] == "quiz" and a["ref_id"] == str(quiz_id))
        self.assertEqual(hw_row["scored"], 1)
        self.assertIsNotNone(hw_row["average_score"])

    def test_claude_engine_validates_output(self):
        payload = {"title": "Numbers fun", "instructions": "Choose the right answer.", "questions": [
            {"question": "How many apples? 🍎🍎🍎", "options": ["2", "3", "4"], "correct_answer": "3",
             "concept": "Counting", "difficulty": "Easy"},
            {"question": "Broken: answer not in options", "options": ["1", "2"], "correct_answer": "9",
             "concept": "Counting", "difficulty": "Easy"},
        ]}
        fake_response = types.SimpleNamespace(stop_reason="end_turn",
                                              content=[types.SimpleNamespace(type="text", text=json.dumps(payload))])
        captured = {}

        class FakeClient:
            def __init__(self, **kw):
                self.beta = types.SimpleNamespace(messages=types.SimpleNamespace(create=self._create))

            def _create(self, **kwargs):
                captured.update(kwargs)
                return fake_response

        import anthropic
        with mock.patch.object(homework_ai, "claude_configured", return_value=True), \
                mock.patch.object(anthropic, "Anthropic", FakeClient):
            draft = client.post("/teacher/homework/generate", json={"lesson_id": "M1.2", "count": 4}, headers=self.H).json()
        self.assertEqual(draft["engine"], "claude")
        self.assertEqual(draft["title"], "Numbers fun")
        self.assertEqual(draft["questions"][0]["question"], "How many apples? 🍎🍎🍎")
        self.assertNotIn("Broken: answer not in options", [q["question"] for q in draft["questions"]])
        self.assertEqual(len(draft["questions"]), 4, "topped up from the question bank")
        self.assertEqual(captured["model"], "claude-opus-5-5")
        self.assertEqual(captured["output_config"]["format"]["type"], "json_schema")
        self.assertEqual(captured["fallbacks"], "default")

    def test_claude_refusal_falls_back_to_bank(self):
        refused = types.SimpleNamespace(stop_reason="refusal", content=[])

        class FakeClient:
            def __init__(self, **kw):
                self.beta = types.SimpleNamespace(messages=types.SimpleNamespace(create=lambda **k: refused))

        import anthropic
        with mock.patch.object(homework_ai, "claude_configured", return_value=True), \
                mock.patch.object(anthropic, "Anthropic", FakeClient):
            draft = client.post("/teacher/homework/generate", json={"lesson_id": "M1.2", "count": 4}, headers=self.H).json()
        self.assertEqual(draft["engine"], "ml-bank")
        self.assertIn("declined", draft["note"])
        self.assertEqual(len(draft["questions"]), 4)

    def test_requires_teacher_auth(self):
        self.assertEqual(client.post("/teacher/homework/generate", json={"lesson_id": "M1.2"}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
