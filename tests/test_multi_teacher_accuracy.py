"""Tests: multiple teachers per student, activity-wise accuracy, automatic quiz question generation."""
import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
import homework_ai  # noqa: E402
from database import execute_commit, fetch_one, get_connection  # noqa: E402
from main import app  # noqa: E402
from test_teacher_platform import login_teacher, rand_mobile  # noqa: E402

client = TestClient(app)


def assign_quiz(H, lesson_id, kind, count=4):
    with mock.patch.object(homework_ai, "claude_configured", return_value=False):
        d = client.post("/teacher/homework/generate", headers=H, json={"lesson_id": lesson_id, "count": count, "kind": kind}).json()
    r = client.post("/teacher/homework/assign", headers=H, json={
        "lesson_id": lesson_id, "kind": kind, "title": d["title"], "time_limit_sec": d["time_limit_sec"], "questions": d["questions"]})
    assert r.status_code == 200, r.text
    return r.json()["quiz"]["quiz_id"], d


def answer_quiz(sid, quiz_id, draft, n_correct):
    quiz = client.get(f"/students/{sid}/quizzes/{quiz_id}").json()
    answers = {}
    for i, (q, d) in enumerate(zip(quiz["questions"], draft["questions"])):
        answers[str(q["id"])] = d["correct_answer"] if i < n_correct else next(o for o in d["options"] if o != d["correct_answer"])
    return client.post(f"/students/{sid}/quizzes/{quiz_id}/submit", json={"answers": answers}).json(), len(quiz["questions"])


class TestMultipleTeachers(unittest.TestCase):
    def test_same_student_in_two_classes_without_duplicates(self):
        HA, ta, _ = login_teacher("Multi Teacher A")
        HB, tb, _ = login_teacher("Multi Teacher B")
        mobile = rand_mobile()
        a = client.post("/teacher/students", headers=HA, json={"name": "Shared Kid", "student_class": 1, "parent_mobile": mobile, "roll_no": "7"})
        self.assertEqual(a.status_code, 200, a.text)
        b = client.post("/teacher/students", headers=HB, json={"name": "shared  kid", "student_class": 1, "parent_mobile": mobile, "roll_no": "21"})
        self.assertEqual(b.status_code, 200, b.text)  # previously 409 "already in another teacher's class"
        sid = a.json()["student"]["student_id"]
        self.assertEqual(b.json()["student"]["student_id"], sid)
        self.assertTrue(b.json()["existing"])
        self.assertEqual(fetch_one("SELECT COUNT(*) FROM students WHERE parent_mobile = ?", (mobile,))[0], 1)

        # each teacher sees the student, with their own roll number
        rolls = {}
        for H in (HA, HB):
            st = next(s for s in client.get("/teacher/students", headers=H).json()["students"] if s["student_id"] == sid)
            rolls[H["Authorization"]] = st["roll_no"]
        self.assertEqual(sorted(rolls.values()), ["21", "7"])

        # a third teacher's class code on the registration form links the same account
        HC, tc, _ = login_teacher("Multi Teacher C")
        r = client.post("/students/register", json={"name": "Shared Kid", "student_class": 1, "parent_mobile": mobile,
                                                    "class_code": tc["class_code"]}).json()
        self.assertTrue(r["existing"])
        self.assertEqual(r["student"]["student_id"], sid)
        self.assertEqual({t["teacher_id"] for t in r["student"]["teachers"]}, {ta["teacher_id"], tb["teacher_id"], tc["teacher_id"]})

        # assignments from different teachers reach the student, records stay teacher-wise
        qa, da = assign_quiz(HA, "M1.2", "quiz")
        qb, db = assign_quiz(HB, "MR1.1", "homework")
        items = client.get(f"/students/{sid}/assignments").json()["assignments"]
        self.assertEqual({i["teacher_name"] for i in items}, {"Multi Teacher A", "Multi Teacher B"})
        prog_a = client.get(f"/teacher/students/{sid}/progress", headers=HA).json()
        self.assertEqual({x["teacher_id"] for x in prog_a["assignments"]}, {ta["teacher_id"]})

        # removing from one class keeps the other classes and the student's history
        self.assertEqual(client.delete(f"/teacher/students/{sid}", headers=HA).status_code, 200)
        self.assertEqual(client.get(f"/teacher/students/{sid}/progress", headers=HA).status_code, 404)
        self.assertEqual(client.get(f"/teacher/students/{sid}/progress", headers=HB).status_code, 200)
        self.assertEqual(client.get(f"/students/{sid}").status_code, 200)

    def test_existing_single_teacher_links_are_preserved(self):
        H, t, _ = login_teacher("Legacy Teacher")
        sid = "stu_legacy" + rand_mobile()[-6:]
        execute_commit("INSERT INTO students (student_id, name, student_class, parent_mobile, teacher_id, created_at) "
                       "VALUES (?, 'Legacy Kid', 1, ?, ?, '2026-01-01 00:00:00')", (sid, rand_mobile(), t["teacher_id"]))
        execute_commit("DELETE FROM teacher_students WHERE student_id = ?", (sid,))  # as in a pre-migration database
        conn = get_connection()
        try:
            database._migrate(conn.cursor())
            conn.commit()
        finally:
            conn.close()
        self.assertTrue(fetch_one("SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?", (t["teacher_id"], sid)))
        self.assertIn(sid, [s["student_id"] for s in client.get("/teacher/students", headers=H).json()["students"]])


class TestActivityAccuracy(unittest.TestCase):
    def test_separate_and_overall_accuracy(self):
        H, t, _ = login_teacher("Accuracy Teacher")
        H2, t2, _ = login_teacher("Other Accuracy Teacher")
        sid = client.post("/students/register", json={"name": "Accuracy Kid", "student_class": 1, "parent_mobile": rand_mobile(),
                                                      "class_code": t["class_code"]}).json()["student"]["student_id"]
        client.post("/students/register", json={"name": "Accuracy Kid", "student_class": 1, "parent_mobile": "x"})  # ignored
        # practice: 3 answers, 1 correct (Q1_C2 expects 'hurray')
        client.post("/answer", json={"student_id": sid, "question_id": "Q1_C2", "student_answer": "hurray"})
        client.post("/answer", json={"student_id": sid, "question_id": "Q2_C2", "student_answer": "zzz"})
        client.post("/answer", json={"student_id": sid, "question_id": "Q3_C2", "student_answer": "zzz"})
        hw, dhw = assign_quiz(H, "M1.2", "homework", 4)
        qz, dqz = assign_quiz(H, "M1.2", "quiz", 4)
        ts, dts = assign_quiz(H, "M1.2", "test", 5)
        res_hw, n_hw = answer_quiz(sid, hw, dhw, 3)
        res_qz, n_qz = answer_quiz(sid, qz, dqz, 1)
        res_ts, n_ts = answer_quiz(sid, ts, dts, 5)

        perf = client.get(f"/students/{sid}/performance").json()
        acts = {a["type"]: a for a in perf["activities"] if a["type"] != "practice"}
        for kind, n, correct in (("homework", n_hw, 3), ("quiz", n_qz, 1), ("test", n_ts, 5)):
            a = acts[kind]
            self.assertEqual((a["correct"], a["incorrect"], a["total"]), (correct, n - correct, n), kind)
            self.assertEqual(a["accuracy"], round(correct / n * 100, 1))
            self.assertEqual(a["marks"]["possible"], n)
        practice = [a for a in perf["activities"] if a["type"] == "practice"]
        self.assertEqual(len(practice), 1)
        self.assertEqual((practice[0]["correct"], practice[0]["incorrect"], practice[0]["total"]), (1, 2, 3))
        total = n_hw + n_qz + n_ts + 3
        correct = 3 + 1 + 5 + 1
        self.assertEqual(perf["overall"]["total"], total)
        self.assertEqual(perf["overall"]["correct"], correct)
        self.assertEqual(perf["overall"]["accuracy"], round(correct / total * 100, 1))
        self.assertEqual(perf["by_type"]["test"]["accuracy"], 100.0)
        self.assertTrue(client.get(f"/students/{sid}/assignments").json()["assignments"][0]["ref_title"].split(" · ")[0] in ("Homework", "Quiz", "Test"))

        # teacher view: this teacher's activities; another teacher sees nothing from teacher 1
        tv = client.get(f"/teacher/students/{sid}/performance", headers=H).json()
        self.assertEqual(len([a for a in tv["activities"] if a["type"] != "practice"]), 3)
        client.post("/teacher/students", headers=H2, json={"name": "Accuracy Kid", "student_class": 1,
                                                          "parent_mobile": client.get(f"/teacher/students/{sid}/progress", headers=H).json()["student"]["parent_mobile"]})
        tv2 = client.get(f"/teacher/students/{sid}/performance", headers=H2).json()
        self.assertEqual([a for a in tv2["activities"] if a["type"] != "practice"], [])
        self.assertEqual(client.get(f"/teacher/students/{sid}/performance", headers=login_teacher("Stranger Teacher")[0]).status_code, 404)

    def test_old_submission_without_counts_is_regraded(self):
        H, t, _ = login_teacher("Regrade Teacher")
        sid = client.post("/students/register", json={"name": "Regrade Kid", "student_class": 1, "parent_mobile": rand_mobile(),
                                                      "class_code": t["class_code"]}).json()["student"]["student_id"]
        qz, d = assign_quiz(H, "M1.2", "quiz", 4)
        answer_quiz(sid, qz, d, 2)
        execute_commit("UPDATE quiz_submissions SET correct_count = NULL, total_questions = NULL WHERE student_id = ?", (sid,))
        a = next(x for x in client.get(f"/students/{sid}/performance").json()["activities"] if x["type"] == "quiz")
        self.assertEqual((a["correct"], a["total"]), (2, 4))


class TestQuizGeneration(unittest.TestCase):
    def test_short_answers_become_mcq_and_results_saved(self):
        H, t, _ = login_teacher("Generator Teacher")
        qs = client.post("/teacher/quizzes/generate", headers=H, json={"lesson_id": "M2.4", "count": 18}).json()["questions"]
        self.assertEqual(len({q["question"] for q in qs}), len(qs), "no duplicate questions")
        for q in qs:
            self.assertIn(q["correct_answer"], q["options"])
            self.assertGreaterEqual(len(q["options"]), 3)
            self.assertEqual(len(set(q["options"])), len(q["options"]))
            self.assertTrue(q["question_id"] and q["concept_id"])
        types = {fetch_one("SELECT question_type FROM questions WHERE question_id = ?", (q["question_id"],))[0] for q in qs}
        self.assertIn("Short Answer", types, "short-answer syllabus questions are turned into quiz questions")

        # saving through the Quizzes tab keeps the syllabus link, so answers/attempts/results are saved
        r = client.post("/teacher/quizzes", headers=H, json={"title": "Subtraction check", "subject": "Mathematics",
                                                              "student_class": 2, "questions": qs[:4]})
        self.assertEqual(r.status_code, 200, r.text)
        quiz_id = r.json()["quiz"]["quiz_id"]
        sid = client.post("/students/register", json={"name": "Generator Kid", "student_class": 2, "parent_mobile": rand_mobile(),
                                                      "class_code": t["class_code"]}).json()["student"]["student_id"]
        client.post("/teacher/assignments", headers=H, json={"title": "Subtraction check", "kind": "quiz", "ref_id": str(quiz_id)})
        quiz = client.get(f"/students/{sid}/quizzes/{quiz_id}").json()
        res = client.post(f"/students/{sid}/quizzes/{quiz_id}/submit",
                          json={"answers": {str(q["id"]): d["correct_answer"] for q, d in zip(quiz["questions"], qs[:4])}}).json()
        self.assertEqual((res["correct_count"], res["total_questions"], res["accuracy"]), (4, 4, 100.0))
        self.assertEqual(res["attempts_recorded"], 4)
        row = fetch_one("SELECT correct_count, total_questions, answers FROM quiz_submissions WHERE student_id = ?", (sid,))
        self.assertEqual(row[:2], (4, 4))
        self.assertEqual(len(json.loads(row[2])), 4)

    def test_avoids_repeating_questions_already_used(self):
        H, t, _ = login_teacher("Repeat Teacher")
        client.post("/teacher/students", headers=H, json={"name": "Repeat Kid", "student_class": 2, "parent_mobile": rand_mobile()})
        first, _d = assign_quiz(H, "M2.4", "quiz", 6)
        used = {r[0] for r in database.fetch_all("SELECT source_question_id FROM quiz_questions WHERE quiz_id = ?", (first,))}
        again = client.post("/teacher/quizzes/generate", headers=H, json={"lesson_id": "M2.4", "count": 6}).json()["questions"]
        self.assertFalse(used & {q["question_id"] for q in again}, "new quiz uses questions not given before")


if __name__ == "__main__":
    unittest.main()
