"""Maharashtra Board curriculum content and the Maths/Marathi game engine."""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from fastapi.testclient import TestClient  # noqa: E402

import games_engine  # noqa: E402
from answer_checker import check_answer  # noqa: E402
from content import get_all_content  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


def new_student():
    mobile = "8" + "".join(random.choice("0123456789") for _ in range(9))
    r = client.post("/students/register", json={"name": "Gamer", "student_class": 1, "parent_mobile": mobile})
    return r.json()["student"]["student_id"]


class TestCurriculum(unittest.TestCase):

    def test_content_integrity(self):
        lessons, concepts, questions = get_all_content()
        subjects = {l["subject"] for l in lessons}
        self.assertEqual(subjects, {"English", "Mathematics", "Marathi"})
        for subject in ("Mathematics", "Marathi"):
            classes = {l["class"] for l in lessons if l["subject"] == subject}
            self.assertEqual(classes, {1, 2}, subject)
        lesson_ids = {l["lesson_id"] for l in lessons}
        concept_ids = {c["concept_id"] for c in concepts}
        self.assertTrue(all(c["lesson_id"] in lesson_ids for c in concepts))
        self.assertEqual(len({q["question_id"] for q in questions}), len(questions))
        per_concept = {}
        for q in questions:
            self.assertIn(q["concept_id"], concept_ids)
            per_concept[q["concept_id"]] = per_concept.get(q["concept_id"], 0) + 1
            if q["options"]:
                self.assertIn(q["expected_answer"], q["options"], q["question_id"])
                self.assertEqual(len(set(q["options"])), len(q["options"]), q["question_id"])
            # the answer key must satisfy the checker
            self.assertTrue(check_answer(q["expected_answer"], q["expected_answer"], q["options"]), q["question_id"])
        self.assertTrue(all(per_concept.get(c, 0) >= 3 for c in concept_ids))

    def test_maths_answers_are_correct(self):
        _, _, questions = get_all_content()
        checked = 0
        for q in questions:
            text = q["question"]
            if q["concept_id"].startswith("M") and text.endswith("= ?") and ("+" in text or "−" in text or "×" in text):
                expr = text[:-3].replace("−", "-").replace("×", "*")
                if all(ch in "0123456789+-* " for ch in expr):
                    self.assertEqual(str(eval(expr)), q["expected_answer"], text)
                    checked += 1
        self.assertGreater(checked, 30)

    def test_marathi_answer_checking(self):
        self.assertTrue(check_answer("१२", "१२"))
        self.assertTrue(check_answer("12", "१२"))
        self.assertTrue(check_answer("बारा", "12"))
        self.assertTrue(check_answer("वाघ", "वाघ"))
        self.assertFalse(check_answer("वाघ", "गाय"))
        self.assertTrue(check_answer("<", "<"))
        self.assertFalse(check_answer(">", "<"))

    def test_lessons_api_filters(self):
        data = client.get("/lessons?subject=Marathi&class_level=1").json()["lessons"]
        self.assertTrue(data and all(l["subject"] == "Marathi" and l["class"] == 1 for l in data))
        self.assertEqual(client.get("/subjects").status_code, 200)
        detail = client.get("/lessons/M1.4").json()
        self.assertTrue(any(g["game_id"] == "math_addition_express" for g in detail["games"]))
        self.assertEqual(client.get("/lessons/NOPE").status_code, 404)

    def test_scoped_practice_never_repeats_and_completes(self):
        sid = new_student()
        seen = []
        for _ in range(200):
            exclude = ",".join(seen)
            nq = client.get(f"/next-question/{sid}?lesson_id=MR1.8&exclude={exclude}").json()
            if nq["activity_type"] == "lesson_completed":
                break
            qid = nq["question"]["question_id"]
            self.assertNotIn(qid, seen)
            self.assertTrue(qid.endswith("MR1.8_C1"))
            seen.append(qid)
            client.post("/answer", json={"student_id": sid, "question_id": qid, "student_answer": "x",
                                         "lesson_id": "MR1.8"})
        self.assertEqual(nq["activity_type"], "lesson_completed")


class TestGameEngine(unittest.TestCase):

    def test_every_game_and_level_generates_valid_challenges(self):
        for game in games_engine.GAMES:
            for level in range(1, games_engine.LEVELS + 1):
                for seed in range(5):
                    rng = random.Random(seed)
                    for _ in range(12):
                        ch = game["generator"](rng, level)
                        self.assertIn(ch["answer"], ch["options"], (game["game_id"], level, ch))
                        self.assertEqual(len(set(ch["options"])), len(ch["options"]), (game["game_id"], ch))
                        self.assertGreaterEqual(len(ch["options"]), 2)
                        self.assertIn(ch["display"]["type"], {"emoji_grid", "big_text", "compare", "sequence", "emoji"})

    def test_math_answers_are_correct(self):
        rng = random.Random(1)
        for level in range(1, 6):
            for gen in (games_engine.gen_addition, games_engine.gen_subtraction, games_engine.gen_tables):
                ch = gen(rng, level)
                expr = ch["display"]["text"][:-3].replace("−", "-").replace("×", "*")
                self.assertEqual(str(eval(expr)), ch["answer"])
            ch = games_engine.gen_count(rng, level)
            self.assertEqual(str(ch["display"]["count"]), ch["answer"])

    def test_difficulty_progression(self):
        rng = random.Random(7)
        low = max(int(games_engine.gen_addition(rng, 1)["answer"]) for _ in range(30))
        high = min(int(games_engine.gen_addition(rng, 5)["answer"]) for _ in range(30))
        self.assertLessEqual(low, 5)
        self.assertGreater(high, 20)
        self.assertGreater(games_engine.TIME_LIMITS[1], games_engine.TIME_LIMITS[5])
        self.assertLess(games_engine.option_count(1), games_engine.option_count(5))

    def _play(self, sid, game_id, level, mode):
        start = client.post(f"/games/{game_id}/start", json={"student_id": sid, "level": level})
        self.assertEqual(start.status_code, 200, start.text)
        data = start.json()
        self.assertNotIn("'answer'", str(data["challenges"]))
        sess = data["session_id"]
        for ch in data["challenges"]:
            options = ch["options"]
            if mode == "perfect":
                # find the right answer by trying options; first correct counts
                for i, opt in enumerate(options):
                    r = client.post(f"/games/sessions/{sess}/answer", json={"challenge_id": ch["challenge_id"],
                                                                            "answer": opt}).json()
                    if r["resolved"]:
                        break
            else:
                for _ in range(3):
                    r = client.post(f"/games/sessions/{sess}/answer",
                                    json={"challenge_id": ch["challenge_id"], "answer": "__wrong__"}).json()
                self.assertTrue(r["resolved"])
                self.assertFalse(r["correct"])
                self.assertIsNotNone(r["correct_answer"])
        return client.post(f"/games/sessions/{sess}/finish", json={"time_taken_sec": 42}).json(), sess

    def test_play_score_unlock_rewards(self):
        sid = new_student()
        listing = client.get(f"/games?student_id={sid}&subject=Mathematics").json()
        g = [x for x in listing["games"] if x["game_id"] == "math_compare_croc"][0]
        self.assertTrue(g["levels"][0]["unlocked"])
        self.assertFalse(g["levels"][1]["unlocked"])
        self.assertEqual(client.post("/games/math_compare_croc/start",
                                     json={"student_id": sid, "level": 2}).status_code, 403)

        # all wrong: 0 score, 1 star, next level stays locked
        result, _ = self._play(sid, "math_compare_croc", 1, "wrong")
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["stars"], 1)
        self.assertFalse(result["next_level_unlocked"])

        # compare game has 3 options, so trying in order always resolves within 3 tries -> >= 50 per challenge
        result, sess = self._play(sid, "math_compare_croc", 1, "perfect")
        self.assertGreaterEqual(result["score"], 50)
        self.assertGreaterEqual(result["stars"], 2)
        self.assertTrue(result["next_level_unlocked"])
        self.assertGreater(result["coins_earned"], 0)
        self.assertIn("first_game", [b["badge_id"] for b in client.get(f"/students/{sid}").json()["badges"]])

        # finishing twice is idempotent; answering after finish is rejected
        again = client.post(f"/games/sessions/{sess}/finish", json={}).json()
        self.assertEqual(again["game_attempt_id"], result["game_attempt_id"])
        self.assertEqual(client.post(f"/games/sessions/{sess}/answer",
                                     json={"challenge_id": "c1", "answer": "<"}).status_code, 409)

        prog = client.get(f"/games/math_compare_croc?student_id={sid}").json()
        self.assertTrue(prog["levels"][1]["unlocked"])
        self.assertEqual(prog["levels"][0]["plays"], 2)
        self.assertEqual(client.post("/games/math_compare_croc/start",
                                     json={"student_id": sid, "level": 2}).status_code, 200)
        attempts = client.get(f"/game/attempts/{sid}?game_id=math_compare_croc").json()["attempts"]
        self.assertEqual(len(attempts), 2)

    def test_marathi_game_round(self):
        sid = new_student()
        result, _ = self._play(sid, "mr_barakhadi_bazaar", 1, "perfect")
        self.assertEqual(result["total"], games_engine.CHALLENGES_PER_LEVEL)
        self.assertEqual(client.post("/games/unknown/start", json={"student_id": sid, "level": 1}).status_code, 404)


if __name__ == "__main__":
    unittest.main()
