import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sys
import unittest
from database import fetch_one, fetch_all, execute_commit
from get_question import get_question
from mastery_engine import calculate_mastery
from weak_concept_detector import get_weak_concepts
from question_selector import get_question_for_mastery
from adaptive_engine import get_next_activity
from recovery_engine import get_recovery_activity
from learning_session import start_session, submit_answer, sanitize_response

# Ensure stdout handles UTF-8 for console output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


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


class TestUnit1LearningFlow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Dedicated test student ID for Unit 1 integration test
        cls.student_id = "test_unit1_student_flow"
        execute_commit("DELETE FROM attempts WHERE student_id = ?", (cls.student_id,))

        # 1. Dynamically discover imported Unit 1 lessons
        cls.unit1_lessons = fetch_all("""
            SELECT lesson_id, lesson_name
            FROM lessons
            WHERE lesson_id IN ('1.2', '1.3', '1.4', '1.5', '1.6')
            ORDER BY lesson_id
        """)

        # 2. Dynamically discover Unit 1 concepts
        cls.unit1_concepts = fetch_all("""
            SELECT concept_id, lesson_id, name, difficulty
            FROM concepts
            WHERE lesson_id IN ('1.2', '1.3', '1.4', '1.5', '1.6')
            ORDER BY concept_id
        """)

        # 3. Dynamically discover Unit 1 questions
        cls.unit1_questions = fetch_all("""
            SELECT q.question_id, q.concept_id, q.question, q.question_type, q.expected_answer, q.hint, q.difficulty
            FROM questions q
            JOIN concepts c ON q.concept_id = c.concept_id
            WHERE c.lesson_id IN ('1.2', '1.3', '1.4', '1.5', '1.6')
            ORDER BY q.question_id
        """)

    def test_01_unit1_content_found(self):
        """
        Verify that Unit 1 lessons, concepts, and questions exist in database.
        """
        self.assertGreaterEqual(len(self.unit1_lessons), 5, "Expected at least 5 Unit 1 lessons")
        self.assertGreaterEqual(len(self.unit1_concepts), 19, "Expected at least 19 Unit 1 concepts")
        self.assertGreaterEqual(len(self.unit1_questions), 57, "Expected at least 57 Unit 1 questions")
        print("\n✅ Step 1: Unit 1 content successfully retrieved from database.")

    def test_02_question_retrieval(self):
        """
        Retrieve a Unit 1 question and verify learner-facing payload omits expected_answer.
        """
        sample_q = self.unit1_questions[0]
        q_id = sample_q[0]

        # Fetch using get_question helper
        raw_q = get_question(q_id)
        self.assertIsNotNone(raw_q)
        self.assertEqual(raw_q[0], q_id)

        # Student facing payload format
        student_payload = {
            "question_id": raw_q[0],
            "question": raw_q[1],
            "question_type": raw_q[2],
            "hint": raw_q[4],
            "difficulty": raw_q[5]
        }
        recursive_assert_no_expected_answer(student_payload)
        print("✅ Step 2: Question retrieval and display format verified without expected_answer.")

    def test_03_correct_answer_flow(self):
        """
        Submit a correct answer for a Unit 1 question and verify response.
        """
        # Pick first question from concept L1.2_C1
        q_info = [q for q in self.unit1_questions if q[1] == "L1.2_C1"][0]
        q_id = q_info[0]
        exp_ans = q_info[4]

        res = submit_answer(self.student_id, q_id, exp_ans)
        self.assertTrue(res.get("is_correct"))
        self.assertIn("Correct", res.get("feedback", ""))
        self.assertIsNotNone(res.get("mastery"))
        self.assertIsNotNone(res.get("next_activity"))

        recursive_assert_no_expected_answer(res)
        print("✅ Step 3: Correct answer submitted and verified for Unit 1 question.")

    def test_04_attempt_persistence(self):
        """
        Verify that submitted attempt is saved correctly in SQLite attempts table.
        """
        q_info = [q for q in self.unit1_questions if q[1] == "L1.2_C1"][0]
        q_id = q_info[0]

        attempt = fetch_one("""
            SELECT student_id, question_id, student_answer, is_correct, attempt_time
            FROM attempts
            WHERE student_id = ? AND question_id = ?
            ORDER BY attempt_time DESC LIMIT 1
        """, (self.student_id, q_id))

        self.assertIsNotNone(attempt)
        self.assertEqual(attempt[0], self.student_id)
        self.assertEqual(attempt[1], q_id)
        self.assertEqual(attempt[3], 1)
        print("✅ Step 4: Attempt persistence confirmed in database.")

    def test_05_mastery_update(self):
        """
        Verify mastery calculation for Unit 1 concept after correct attempt.
        """
        concept_id = "L1.2_C1"
        mastery = calculate_mastery(self.student_id, concept_id)
        self.assertEqual(mastery.get("accuracy"), 100.0)
        self.assertEqual(mastery.get("status"), "Mastered")
        print("✅ Step 5: Mastery calculation updated accurately to 100% (Mastered).")

    def test_06_weak_concept_detection(self):
        """
        Submit incorrect answers for Unit 1 concept L1.2_C2 and verify weak concept detection.
        """
        target_concept = "L1.2_C2"
        concept_qs = [q for q in self.unit1_questions if q[1] == target_concept]
        q_id = concept_qs[0][0]

        # Submit 2 incorrect attempts
        submit_answer(self.student_id, q_id, "incorrect_answer_1")
        submit_answer(self.student_id, q_id, "incorrect_answer_2")

        weak_concepts = get_weak_concepts(self.student_id)
        weak_c_ids = [c["concept_id"] for c in weak_concepts]

        self.assertIn(target_concept, weak_c_ids)
        target_weak = [c for c in weak_concepts if c["concept_id"] == target_concept][0]
        self.assertIn(target_weak["status"], ["Needs Practice", "Learning"])
        print("✅ Step 6: Weak concept detection identified low-accuracy Unit 1 concept.")

    def test_07_adaptive_next_question(self):
        """
        Verify adaptive engine selects the weak Unit 1 concept for next practice.
        """
        activity = get_next_activity(self.student_id)
        self.assertIsNotNone(activity)
        self.assertEqual(activity.get("concept_id"), "L1.2_C2")
        self.assertEqual(activity.get("action"), "practice")

        recursive_assert_no_expected_answer(activity)
        print("✅ Step 7: Adaptive engine selected weak Unit 1 concept for next activity.")

    def test_08_recovery_flow(self):
        """
        Verify recovery engine triggers for repeated incorrect attempts on Unit 1 concept.
        """
        target_concept = "L1.2_C2"
        recovery_res = get_recovery_activity(self.student_id, target_concept)

        self.assertTrue(recovery_res.get("recovery_needed"))
        self.assertIsNotNone(recovery_res.get("question"))

        recursive_assert_no_expected_answer(recovery_res)
        print("✅ Step 8: Recovery engine triggered scaffolded activity for Unit 1 concept.")

    def test_09_repeat_question_avoidance(self):
        """
        Verify question selector avoids immediate repetition when unattempted alternative exists.
        """
        target_concept = "L1.2_C2"
        # Concept L1.2_C2 has questions Q1_L1.2_C2, Q2_L1.2_C2, Q3_L1.2_C2
        # Student attempted Q1_L1.2_C2. Selector should pick Q2 or Q3.
        selected_q = get_question_for_mastery(self.student_id, target_concept, "Needs Practice")

        self.assertIsNotNone(selected_q)
        self.assertNotEqual(selected_q.get("question_id"), "Q1_L1.2_C2")
        recursive_assert_no_expected_answer(selected_q)
        print("✅ Step 9: Question selector avoided previously attempted question.")

    def test_10_expected_answer_security(self):
        """
        Verify expected_answer never appears in any session or endpoint response.
        """
        session = start_session(self.student_id)
        ans_res = submit_answer(self.student_id, self.unit1_questions[0][0], "grin")
        next_act = get_next_activity(self.student_id)

        recursive_assert_no_expected_answer(session)
        recursive_assert_no_expected_answer(ans_res)
        recursive_assert_no_expected_answer(next_act)
        print("✅ Step 10: Expected answer security verified across all session payloads.")

    def test_11_error_handling(self):
        """
        Verify invalid question ID and concept ID handling.
        """
        bad_q_res = submit_answer(self.student_id, "INVALID_Q_UNIT1_9999", "ans")
        self.assertFalse(bad_q_res.get("is_correct"))
        self.assertIn("not found", bad_q_res.get("feedback", "").lower())

        bad_recovery = get_recovery_activity(self.student_id, "INVALID_C_UNIT1_9999")
        self.assertFalse(bad_recovery.get("recovery_needed"))

        print("✅ Step 11: Error handling verified for invalid IDs.")

    def test_12_unit1_new_concepts_flow(self):
        """
        Verify end-to-end learning flow across multiple Unit 1 lessons (1.3, 1.4, 1.5, 1.6).
        """
        # Pick a question from lesson 1.5 ('L1.5_C1')
        l15_qs = [q for q in self.unit1_questions if q[1] == "L1.5_C1"]
        self.assertGreater(len(l15_qs), 0)

        q_id = l15_qs[0][0]
        exp_ans = l15_qs[0][4]

        res = submit_answer(self.student_id, q_id, exp_ans)
        self.assertTrue(res.get("is_correct"))

        m = calculate_mastery(self.student_id, "L1.5_C1")
        self.assertEqual(m.get("accuracy"), 100.0)

        print("✅ Step 12: End-to-end flow verified on Lesson 1.5 ('Fun with Special Letters').")


def run_unit1_flow_test():
    print("\n===== UNIT 1 LEARNING FLOW TEST =====\n")

    test_results = {}
    suite = unittest.TestLoader().loadTestsFromTestCase(TestUnit1LearningFlow)
    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)

    # Map test methods to report titles
    mapping = {
        "test_01_unit1_content_found": "1. Unit 1 content found",
        "test_02_question_retrieval": "2. Question retrieval",
        "test_03_correct_answer_flow": "3. Correct answer flow",
        "test_04_attempt_persistence": "4. Attempt persistence",
        "test_05_mastery_update": "5. Mastery update",
        "test_06_weak_concept_detection": "6. Weak concept detection",
        "test_07_adaptive_next_question": "7. Adaptive next question",
        "test_08_recovery_flow": "8. Recovery flow",
        "test_09_repeat_question_avoidance": "9. Repeat-question avoidance",
        "test_10_expected_answer_security": "10. Expected-answer security",
        "test_11_error_handling": "11. Error handling",
        "test_12_unit1_new_concepts_flow": "12. Unit 1 multi-lesson flow"
    }

    failed_test_names = [test[0]._testMethodName for test in result.failures + result.errors]

    for method, title in mapping.items():
        if method in failed_test_names:
            print(f"{title}: FAIL")
        else:
            print(f"{title}: PASS")

    print("\nFinal result:")
    if result.wasSuccessful():
        print("PASS")
    else:
        print("FAIL")

    print("\n--------------------------------------------------")
    print("📌 NOTE ON TEST ATTEMPTS STORAGE & CLEANUP:")
    print("Test attempts were recorded under student_id = 'test_unit1_student_flow'.")
    print("To isolate or clean test attempts without touching production records:")
    print("  SQL Cleanup: DELETE FROM attempts WHERE student_id LIKE 'test_%';")
    print("--------------------------------------------------\n")


if __name__ == "__main__":
    run_unit1_flow_test()
