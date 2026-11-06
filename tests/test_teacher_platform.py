"""Teacher platform: OTP auth, student management, assignments, quizzes, analytics."""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from fastapi.testclient import TestClient  # noqa: E402

from database import execute_commit, fetch_one  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def rand_mobile():
    return "9" + "".join(random.choice("0123456789") for _ in range(9))


def login_teacher(name="Test Teacher", school="ZP School"):
    mobile = rand_mobile()
    r = client.post("/auth/teacher/request-otp", json={"name": name, "mobile": mobile, "purpose": "register",
                                                       "school": school})
    assert r.status_code == 200, r.text
    otp = r.json()["dev_otp"]
    r = client.post("/auth/teacher/verify-otp", json={"mobile": mobile, "purpose": "register", "code": otp})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["teacher"], mobile


class TestTeacherAuth(unittest.TestCase):

    def test_register_login_logout(self):
        headers, teacher, mobile = login_teacher("Sunita Patil")
        self.assertTrue(teacher["teacher_id"].startswith("tch_"))
        self.assertEqual(len(teacher["class_code"]), 6)

        # Registering the same mobile again is rejected
        r = client.post("/auth/teacher/request-otp",
                        json={"name": "Sunita Patil", "mobile": mobile, "purpose": "register"})
        self.assertEqual(r.status_code, 409)

        # Login needs the matching name
        r = client.post("/auth/teacher/request-otp", json={"name": "Someone Else", "mobile": mobile, "purpose": "login"})
        self.assertEqual(r.status_code, 404)
        r = client.post("/auth/teacher/request-otp", json={"name": "sunita  patil", "mobile": mobile, "purpose": "login"})
        self.assertEqual(r.status_code, 200)
        otp = r.json()["dev_otp"]

        # Wrong OTP is rejected, correct one works once
        bad = "000000" if otp != "000000" else "111111"
        r = client.post("/auth/teacher/verify-otp", json={"mobile": mobile, "purpose": "login", "code": bad})
        self.assertEqual(r.status_code, 401)
        r = client.post("/auth/teacher/verify-otp", json={"mobile": mobile, "purpose": "login", "code": otp})
        self.assertEqual(r.status_code, 200)
        r = client.post("/auth/teacher/verify-otp", json={"mobile": mobile, "purpose": "login", "code": otp})
        self.assertEqual(r.status_code, 400)

        self.assertEqual(client.get("/auth/teacher/me", headers=headers).status_code, 200)
        self.assertEqual(client.post("/auth/teacher/logout", headers=headers).status_code, 200)
        self.assertEqual(client.get("/auth/teacher/me", headers=headers).status_code, 401)

    def test_validation_and_auth_required(self):
        r = client.post("/auth/teacher/request-otp", json={"name": "Asha", "mobile": "12345", "purpose": "register"})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(client.get("/teacher/students").status_code, 401)
        self.assertEqual(client.get("/teacher/students", headers={"Authorization": "Bearer nope"}).status_code, 401)

    def test_otp_attempt_limit(self):
        mobile = rand_mobile()
        r = client.post("/auth/teacher/request-otp", json={"name": "Ravi More", "mobile": mobile, "purpose": "register"})
        otp = r.json()["dev_otp"]
        bad = "000000" if otp != "000000" else "111111"
        for _ in range(5):
            client.post("/auth/teacher/verify-otp", json={"mobile": mobile, "purpose": "register", "code": bad})
        r = client.post("/auth/teacher/verify-otp", json={"mobile": mobile, "purpose": "register", "code": otp})
        self.assertIn(r.status_code, (400, 429))


class TestTeacherWorkflow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.headers, cls.teacher, _ = login_teacher("Meena Kulkarni")
        cls.other_headers, _, _ = login_teacher("Other Teacher")

    def test_full_workflow(self):
        h = self.headers
        # --- add students
        r = client.post("/teacher/students", headers=h,
                        json={"name": "Aarav", "student_class": 1, "parent_mobile": rand_mobile(), "roll_no": "1"})
        self.assertEqual(r.status_code, 200, r.text)
        s1 = r.json()["student"]["student_id"]
        # student self-registers using the class code
        r = client.post("/students/register", json={"name": "Riya", "student_class": "1st",
                                                    "parent_mobile": rand_mobile(),
                                                    "class_code": self.teacher["class_code"]})
        self.assertEqual(r.status_code, 200, r.text)
        s2 = r.json()["student"]["student_id"]
        students = client.get("/teacher/students", headers=h).json()["students"]
        self.assertEqual({s["student_id"] for s in students}, {s1, s2})

        # other teachers cannot see these students
        self.assertEqual(client.get(f"/teacher/students/{s1}/progress", headers=self.other_headers).status_code, 404)

        # --- edit
        r = client.put(f"/teacher/students/{s1}", headers=h,
                       json={"name": "Aarav Shinde", "student_class": 1, "parent_mobile": students[0]["parent_mobile"]
                             if students[0]["student_id"] == s1 else students[1]["parent_mobile"], "roll_no": "2"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["student"]["name"], "Aarav Shinde")

        # --- quiz
        quiz_body = {"title": "Numbers quiz", "subject": "Mathematics", "student_class": 1, "questions": [
            {"question": "2 + 3 = ?", "options": ["4", "5", "6"], "correct_answer": "5"},
            {"question": "Which is bigger?", "options": ["12", "21"], "correct_answer": "21", "points": 2},
        ]}
        bad = dict(quiz_body, questions=[{"question": "x?", "options": ["a", "b"], "correct_answer": "c"}])
        self.assertEqual(client.post("/teacher/quizzes", headers=h, json=bad).status_code, 422)
        r = client.post("/teacher/quizzes", headers=h, json=quiz_body)
        self.assertEqual(r.status_code, 200, r.text)
        quiz_id = r.json()["quiz"]["quiz_id"]

        gen = client.post("/teacher/quizzes/generate", headers=h, json={"lesson_id": "M1.4", "count": 4})
        self.assertEqual(gen.status_code, 200)
        self.assertEqual(len(gen.json()["questions"]), 4)

        # quiz not assigned yet -> student cannot open it
        self.assertEqual(client.get(f"/students/{s1}/quizzes/{quiz_id}").status_code, 403)

        # --- assignments
        r = client.post("/teacher/assignments", headers=h, json={"title": "Addition practice", "kind": "lesson",
                                                                  "ref_id": "M1.4", "target_count": 2,
                                                                  "due_date": "2099-01-01"})
        self.assertEqual(r.status_code, 200, r.text)
        r = client.post("/teacher/assignments", headers=h, json={"title": "Weekly quiz", "kind": "quiz",
                                                                  "ref_id": str(quiz_id), "student_ids": [s1]})
        self.assertEqual(r.status_code, 200, r.text)
        r = client.post("/teacher/assignments", headers=h, json={"title": "Play Addition Express", "kind": "game",
                                                                  "ref_id": "math_addition_express", "level": 1})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(client.post("/teacher/assignments", headers=h,
                                     json={"title": "Bad", "kind": "game", "ref_id": "nope"}).status_code, 422)

        a = client.get(f"/students/{s1}/assignments").json()
        self.assertEqual(len(a["assignments"]), 3)
        self.assertEqual(a["pending"], 3)
        self.assertEqual(len(client.get(f"/students/{s2}/assignments").json()["assignments"]), 2)

        # complete the lesson assignment by practising
        for _ in range(2):
            nq = client.get(f"/next-question/{s1}?lesson_id=M1.4").json()
            client.post("/answer", json={"student_id": s1, "question_id": nq["question"]["question_id"],
                                         "student_answer": "7", "lesson_id": "M1.4"})
        # complete the quiz
        quiz = client.get(f"/students/{s1}/quizzes/{quiz_id}").json()
        self.assertNotIn("correct_answer", str(quiz))
        answers = {str(quiz["questions"][0]["id"]): "5", str(quiz["questions"][1]["id"]): "12"}
        res = client.post(f"/students/{s1}/quizzes/{quiz_id}/submit", json={"answers": answers}).json()
        self.assertEqual(res["score"], 1)
        self.assertEqual(res["max_score"], 3)
        # complete the game assignment
        start = client.post("/games/math_addition_express/start", json={"student_id": s1, "level": 1}).json()
        for ch in start["challenges"]:
            client.post(f"/games/sessions/{start['session_id']}/answer",
                        json={"challenge_id": ch["challenge_id"], "answer": ch["options"][0]})
        client.post(f"/games/sessions/{start['session_id']}/finish", json={})

        statuses = {x["kind"]: x["status"] for x in client.get(f"/students/{s1}/assignments").json()["assignments"]}
        self.assertEqual(statuses, {"lesson": "completed", "quiz": "completed", "game": "completed"})

        listing = client.get("/teacher/assignments", headers=h).json()["assignments"]
        lesson_a = [x for x in listing if x["kind"] == "lesson"][0]
        self.assertEqual(lesson_a["assigned"], 2)
        self.assertEqual(lesson_a["completed"], 1)
        detail = client.get(f"/teacher/assignments/{lesson_a['assignment_id']}", headers=h).json()
        self.assertEqual(len(detail["students"]), 2)

        # quiz cannot be deleted while assigned
        self.assertEqual(client.delete(f"/teacher/quizzes/{quiz_id}", headers=h).status_code, 409)

        # --- analytics & progress
        ov = client.get("/teacher/overview", headers=h).json()["analytics"]
        self.assertEqual(ov["total_students"], 2)
        self.assertGreaterEqual(ov["total_attempts"], 2)
        self.assertGreaterEqual(ov["games_played"], 1)
        self.assertEqual(len(ov["daily_activity"]), 14)
        self.assertIsNotNone(ov["quiz_average"])
        prog = client.get(f"/teacher/students/{s1}/progress", headers=h).json()
        self.assertEqual(prog["student"]["student_id"], s1)
        self.assertGreaterEqual(prog["summary"]["attempts"], 2)
        self.assertEqual(len(prog["quiz_results"]), 1)
        self.assertNotIn("expected_answer", str(prog))

        # --- remove student keeps their history
        self.assertEqual(client.delete(f"/teacher/students/{s2}", headers=h).status_code, 200)
        self.assertEqual(len(client.get("/teacher/students", headers=h).json()["students"]), 1)
        self.assertIsNotNone(fetch_one("SELECT 1 FROM students WHERE student_id = ?", (s2,)))


class TestStudentAccounts(unittest.TestCase):

    def test_register_and_login(self):
        mobile = rand_mobile()
        r = client.post("/students/register", json={"name": "Om", "student_class": 2, "parent_mobile": mobile,
                                                    "nickname": "Hero42"})
        self.assertEqual(r.status_code, 200)
        sid = r.json()["student"]["student_id"]
        self.assertFalse(r.json()["existing"])
        again = client.post("/students/register", json={"name": "om", "student_class": 2, "parent_mobile": mobile})
        self.assertTrue(again.json()["existing"])
        self.assertEqual(again.json()["student"]["student_id"], sid)
        self.assertEqual(client.post("/students/login", json={"name": "Om", "parent_mobile": mobile})
                         .json()["student"]["student_id"], sid)
        self.assertEqual(client.post("/students/login", json={"name": "Nobody", "parent_mobile": mobile}).status_code, 404)
        self.assertEqual(client.post("/students/register", json={"name": "Om", "student_class": 2,
                                                                 "parent_mobile": mobile,
                                                                 "class_code": "ZZZZZZ"}).status_code, 404)
        prof = client.get(f"/students/{sid}").json()
        self.assertEqual(prof["student"]["student_class"], 2)
        self.assertNotIn(mobile, str(prof))
        progress = client.get(f"/students/{sid}/progress?subject=Marathi&class_level=1").json()
        self.assertEqual(len(progress["subjects"]), 3)
        self.assertGreater(len(progress["lessons"]), 0)


if __name__ == "__main__":
    unittest.main()
