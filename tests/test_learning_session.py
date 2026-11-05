import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from learning_session import start_session, submit_answer
from mastery_engine import DB_NAME, calculate_mastery
from recovery_engine import get_recovery_activity

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def contains_expected_answer(obj):
    """Recursively checks if the key 'expected_answer' exists anywhere in obj."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "expected_answer":
                return True
            if contains_expected_answer(v):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if contains_expected_answer(item):
                return True
    return False


def setup_test_data():
    """Removes any previous test attempt records."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_session_%'")
    connection.commit()
    connection.close()


def cleanup_test_data():
    """Cleans up temporary test attempt records."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_session_%'")
    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING LEARNING SESSION ENGINE TESTS")
    print("==================================================")

    setup_test_data()

    try:
        # --------------------------------------------------
        # TEST 1: Start session for student with no previous attempts
        # --------------------------------------------------
        print("\n--- Test 1: Start session for student with no previous attempts ---")
        student_new = "test_session_new"
        res1 = start_session(student_new)

        print(f"Session started: {res1.get('session_started')} | Activity: {res1.get('activity_type')}")
        assert res1["session_started"] is True, "Expected session_started to be True"
        assert res1["activity_type"] == "introduce", f"Expected 'introduce', got '{res1['activity_type']}'"
        assert res1["question"] is not None, "Expected first question for new student"
        assert not contains_expected_answer(res1), "expected_answer exposed in start_session payload!"
        print("✅ PASS: Start session successfully returned valid first activity and question.")

        # --------------------------------------------------
        # TEST 2: Submit a correct answer
        # --------------------------------------------------
        print("\n--- Test 2: Submit a correct answer ---")
        student_correct = "test_session_correct"
        # Q1_C1 expected answer is 'grin'
        res2 = submit_answer(student_correct, "Q1_C1", "grin")

        print(f"Is Correct: {res2.get('is_correct')} | Feedback: {res2.get('feedback')}")
        assert res2["is_correct"] is True, "Expected is_correct to be True"
        assert res2["feedback"] == "Correct! Well done."
        assert res2["mastery"] is not None
        assert res2["mastery"]["accuracy"] == 100.0

        # Verify attempt saved in SQLite database
        connection = sqlite3.connect(DB_NAME)
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM attempts WHERE student_id = ? AND is_correct = 1", (student_correct,))
        count = cursor.fetchone()[0]
        connection.close()
        assert count == 1, f"Expected 1 saved attempt in DB, got {count}"
        assert not contains_expected_answer(res2), "expected_answer exposed in submit_answer payload!"
        print("✅ PASS: Correct answer verified, saved to DB, and mastery updated.")

        # --------------------------------------------------
        # TEST 3: Submit an incorrect answer
        # --------------------------------------------------
        print("\n--- Test 3: Submit an incorrect answer ---")
        student_incorrect = "test_session_incorrect"
        # Q1_C1 expected answer is 'grin', submit wrong answer 'laugh'
        res3 = submit_answer(student_incorrect, "Q1_C1", "laugh")

        print(f"Is Correct: {res3.get('is_correct')} | Feedback: {res3.get('feedback')}")
        assert res3["is_correct"] is False, "Expected is_correct to be False"
        assert res3["feedback"] == "Not quite. Let's practice this concept again."
        assert res3["mastery"] is not None
        assert res3["mastery"]["accuracy"] == 0.0

        # Verify attempt saved in DB
        connection = sqlite3.connect(DB_NAME)
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM attempts WHERE student_id = ? AND is_correct = 0", (student_incorrect,))
        count = cursor.fetchone()[0]
        connection.close()
        assert count == 1, f"Expected 1 saved attempt in DB, got {count}"
        assert not contains_expected_answer(res3), "expected_answer exposed in submit_answer payload!"
        print("✅ PASS: Incorrect answer verified, saved to DB, and mastery updated.")

        # --------------------------------------------------
        # TEST 4: Repeated incorrect answers (Recovery Trigger)
        # --------------------------------------------------
        print("\n--- Test 4: Repeated incorrect answers (Recovery trigger) ---")
        student_recovery = "test_session_rec"
        submit_answer(student_recovery, "Q1_C1", "wrong1")
        res4 = submit_answer(student_recovery, "Q2_C1", "wrong2")

        print(f"Next Activity Type: {res4['next_activity'].get('activity_type')} | Concept: {res4['next_activity'].get('concept_id')}")
        assert res4["next_activity"] is not None
        assert res4["next_activity"]["activity_type"] == "recovery", f"Expected recovery activity type, got {res4['next_activity']['activity_type']}"
        assert not contains_expected_answer(res4), "expected_answer exposed in recovery payload!"
        print("✅ PASS: Recovery engine triggered after repeated incorrect answers.")

        # --------------------------------------------------
        # TEST 5: Correct answer after previous incorrect attempts
        # --------------------------------------------------
        print("\n--- Test 5: Correct answer after previous incorrect attempts ---")
        student_improve = "test_session_improve"
        # 1st attempt: wrong (accuracy 0%)
        sub1 = submit_answer(student_improve, "Q1_C1", "wrong")
        assert sub1["mastery"]["accuracy"] == 0.0

        # 2nd attempt: correct (accuracy 50%)
        sub2 = submit_answer(student_improve, "Q2_C1", "skip, run")
        assert sub2["mastery"]["accuracy"] == 50.0
        assert sub2["mastery"]["status"] == "Learning"
        assert not contains_expected_answer(sub2)
        print(f"Updated Accuracy: {sub2['mastery']['accuracy']}% | Status: {sub2['mastery']['status']}")
        print("✅ PASS: Mastery accuracy updated correctly upon subsequent successful answer.")

        # --------------------------------------------------
        # TEST 6: Invalid question ID
        # --------------------------------------------------
        print("\n--- Test 6: Invalid question ID ---")
        res6 = submit_answer("test_session_student", "INVALID_Q_ID_999", "answer")
        print(f"Feedback: {res6.get('feedback')}")
        assert res6["is_correct"] is False
        assert "not found" in res6["feedback"].lower() or "invalid" in res6["feedback"].lower()
        assert res6["next_activity"] is None
        assert not contains_expected_answer(res6)
        print("✅ PASS: Handled invalid question ID safely without crash.")

        # --------------------------------------------------
        # TEST 7: Empty student answer
        # --------------------------------------------------
        print("\n--- Test 7: Empty student answer ---")
        res7_empty = submit_answer("test_session_student", "Q1_C1", "")
        res7_none = submit_answer("test_session_student", "Q1_C1", None)

        assert res7_empty["is_correct"] is False
        assert res7_none["is_correct"] is False
        assert not contains_expected_answer(res7_empty)
        assert not contains_expected_answer(res7_none)
        print("✅ PASS: Empty and None student answers handled safely.")

        # --------------------------------------------------
        # TEST 8: Selected next question belongs to correct concept
        # --------------------------------------------------
        print("\n--- Test 8: Selected next question belongs to correct concept ---")
        res8 = start_session(student_new)
        next_q = res8.get("question")
        if next_q:
            assert next_q["concept_id"] == res8["concept_id"], f"Question concept_id {next_q['concept_id']} mismatch with activity concept_id {res8['concept_id']}"
            print(f"Verified question concept ({next_q['concept_id']}) matches session concept ({res8['concept_id']}).")
        assert not contains_expected_answer(res8)
        print("✅ PASS: Next question belongs to correct concept.")

        # --------------------------------------------------
        # TEST 9: Expected answer is NOT present anywhere in returned results
        # --------------------------------------------------
        print("\n--- Test 9: Recursive expected_answer protection check ---")
        responses = [
            start_session("student_001"),
            start_session("new_student_xyz"),
            submit_answer("student_001", "Q1_C1", "grin"),
            submit_answer("student_001", "Q1_C1", "wrong_answer"),
            submit_answer("test_session_rec", "Q2_C1", "wrong2"),
            res1, res2, res3, res4, res6, res7_empty
        ]
        for idx, resp in enumerate(responses, 1):
            assert not contains_expected_answer(resp), f"expected_answer key found in response index {idx}!"
        print("✅ PASS: Confirmed 'expected_answer' is 100% absent from all student-facing payloads.")

        # --------------------------------------------------
        # TEST 10: Complete mini learning flow
        # --------------------------------------------------
        print("\n--- Test 10: Complete mini learning flow ---")
        student_flow = "test_session_flow_user"

        # Step A: Start session
        s1 = start_session(student_flow)
        assert s1["session_started"] is True
        q1 = s1["question"]
        assert q1 is not None

        # Step B: Submit answer to first question
        q1_id = q1["question_id"]
        sub_res1 = submit_answer(student_flow, q1_id, "incorrect_test_ans")
        assert sub_res1["is_correct"] is False
        assert sub_res1["mastery"]["status"] in ["Needs Practice", "Learning"]

        # Step C: Obtain next activity from submission response
        next_act = sub_res1.get("next_activity")
        assert next_act is not None
        assert next_act.get("question") is not None

        print("Full flow completed successfully:")
        print(f"1. Session started -> Question {q1_id}")
        print(f"2. Answer submitted -> is_correct: {sub_res1['is_correct']}, Feedback: '{sub_res1['feedback']}'")
        print(f"3. Mastery updated -> {sub_res1['mastery']}")
        print(f"4. Next activity -> {next_act['activity_type']} ({next_act['question']['question_id']})")
        print("✅ PASS: Mini learning flow executed successfully.")

        print("\n==================================================")
        print("🎉 ALL LEARNING SESSION ENGINE TESTS PASSED!")
        print("==================================================")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_tests()
