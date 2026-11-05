import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from adaptive_engine import get_next_activity
from mastery_engine import DB_NAME

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def setup_test_data():
    """Inserts temporary attempt data for specific test student scenarios."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    # 1. Student with Needs Practice concept (C2 accuracy 25%: 1 correct out of 4)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_adaptive_np', 'Q1_C2', 'hurray', 1),
               ('test_adaptive_np', 'Q2_C2', 'wrong1', 0),
               ('test_adaptive_np', 'Q3_C2', 'wrong2', 0),
               ('test_adaptive_np', 'Q1_C2', 'wrong3', 0)
    """)

    # 2. Student with Learning concept (C4 accuracy 75%: 3 correct out of 4)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_adaptive_learning', 'Q1_C4', 'see', 1),
               ('test_adaptive_learning', 'Q2_C4', 'look', 1),
               ('test_adaptive_learning', 'Q3_C4', 'say', 1),
               ('test_adaptive_learning', 'Q1_C4', 'wrong', 0)
    """)

    # 3. Multiple weak concepts student:
    # C3: 1/4 = 25% (Needs Practice)
    # C2: 3/4 = 75% (Learning)
    # C1: 2/2 = 100% (Mastered)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES 
            ('test_adaptive_multi', 'Q1_C3', 'The bell rings', 1),
            ('test_adaptive_multi', 'Q2_C3', 'wrong', 0),
            ('test_adaptive_multi', 'Q3_C3', 'wrong', 0),
            ('test_adaptive_multi', 'Q1_C3', 'wrong', 0),

            ('test_adaptive_multi', 'Q1_C2', 'hurray', 1),
            ('test_adaptive_multi', 'Q2_C2', 'in', 1),
            ('test_adaptive_multi', 'Q3_C2', 'everyone', 1),
            ('test_adaptive_multi', 'Q1_C2', 'wrong', 0),

            ('test_adaptive_multi', 'Q1_C1', 'grin', 1),
            ('test_adaptive_multi', 'Q2_C1', 'skip, run', 1)
    """)

    # 4. Student with ALL concepts mastered (100% on C1, C2, C3, C4)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES 
            ('test_adaptive_all_mastered', 'Q1_C1', 'grin', 1),
            ('test_adaptive_all_mastered', 'Q2_C1', 'skip, run', 1),
            ('test_adaptive_all_mastered', 'Q1_C2', 'hurray', 1),
            ('test_adaptive_all_mastered', 'Q2_C2', 'in', 1),
            ('test_adaptive_all_mastered', 'Q1_C3', 'The bell rings', 1),
            ('test_adaptive_all_mastered', 'Q2_C3', 'The dog barks', 1),
            ('test_adaptive_all_mastered', 'Q1_C4', 'see', 1),
            ('test_adaptive_all_mastered', 'Q2_C4', 'look', 1)
    """)

    connection.commit()
    connection.close()


def cleanup_test_data():
    """Removes temporary test student rows from attempts table."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_adaptive_%'")

    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING ADAPTIVE LEARNING ENGINE TESTS")
    print("==================================================")

    setup_test_data()

    try:
        # TEST 1: Student with a Needs Practice concept
        print("\n--- Test 1: Student with a Needs Practice concept ---")
        res1 = get_next_activity("test_adaptive_np")
        print(f"Selected Concept: {res1.get('concept_id')} | Action: {res1.get('action')}")
        assert res1["action"] == "practice", f"Expected action 'practice', got '{res1['action']}'"
        assert res1["concept_id"] == "C2"
        assert res1["reason"] == "Student needs more practice with this concept."
        assert "question" in res1 and res1["question"] is not None
        assert res1["question"]["difficulty"] == "Easy", f"Expected Easy question for Needs Practice, got {res1['question']['difficulty']}"
        print("✅ PASS: Correctly handled Needs Practice concept with Easy question.")

        # TEST 2: Student with a Learning concept
        print("\n--- Test 2: Student with a Learning concept ---")
        res2 = get_next_activity("test_adaptive_learning")
        print(f"Selected Concept: {res2.get('concept_id')} | Action: {res2.get('action')}")
        assert res2["action"] == "practice", f"Expected action 'practice', got '{res2['action']}'"
        assert res2["concept_id"] == "C4"
        assert res2["reason"] == "Student is learning this concept and needs additional practice."
        assert "question" in res2 and res2["question"] is not None
        assert res2["question"]["difficulty"] in ["Easy", "Medium"], f"Expected Easy/Medium difficulty, got {res2['question']['difficulty']}"
        print("✅ PASS: Correctly handled Learning concept with Easy/Medium question.")

        # TEST 3: Student with no attempts
        print("\n--- Test 3: Student with no attempts ---")
        res3 = get_next_activity("test_no_attempts_new")
        print(f"Action: {res3.get('action')} | Reason: {res3.get('reason')}")
        assert res3["action"] == "introduce", f"Expected action 'introduce', got '{res3['action']}'"
        assert res3["reason"] == "Student has no previous attempts."
        assert "question" in res3 and res3["question"] is not None
        assert res3["question"]["difficulty"] == "Easy"
        print("✅ PASS: Correctly handled student with no attempts (action = introduce).")

        # TEST 4: Multiple weak concepts (selects lowest accuracy first)
        print("\n--- Test 4: Multiple weak concepts priority & lowest accuracy selection ---")
        res4 = get_next_activity("test_adaptive_multi")
        print(f"Selected Concept: {res4.get('concept_id')} (C3=25% Needs Practice, C2=75% Learning)")
        assert res4["concept_id"] == "C3", f"Expected C3 (lowest accuracy 25%), got {res4['concept_id']}"
        assert res4["action"] == "practice"
        assert res4["reason"] == "Student needs more practice with this concept."
        print("✅ PASS: Selected concept C3 (lowest accuracy Needs Practice concept).")

        # TEST 5: Mastered concept status handling
        print("\n--- Test 5: Mastered concept ---")
        # In test_adaptive_multi, C1 is 100% Mastered, C3 & C2 are weak.
        # But for test_adaptive_all_mastered, C1 is evaluated as Mastered.
        # We verify that if a concept is Mastered, the engine correctly recognizes mastery.
        res5 = get_next_activity("test_adaptive_all_mastered")
        assert res5["action"] == "progress"
        print("✅ PASS: Mastered status correctly recognized.")

        # TEST 6: All concepts mastered
        print("\n--- Test 6: All concepts mastered ---")
        res6 = get_next_activity("test_adaptive_all_mastered")
        print(f"Action: {res6.get('action')} | Reason: {res6.get('reason')}")
        assert res6["action"] == "progress", f"Expected action 'progress', got '{res6['action']}'"
        assert res6["reason"] == "All current concepts are mastered."
        print("✅ PASS: Handled all concepts mastered case without crash.")

        # TEST 7: Invalid / Nonexistent student
        print("\n--- Test 7: Invalid/nonexistent student ---")
        res7 = get_next_activity("nonexistent_student_99999")
        print(f"Action: {res7.get('action')} | Reason: {res7.get('reason')}")
        assert res7["action"] == "introduce"
        assert res7["reason"] == "Student has no previous attempts."
        print("✅ PASS: Gracefully handled invalid/nonexistent student.")

        # TEST 8: Ensure expected_answer is NOT returned
        print("\n--- Test 8: Ensure expected_answer is NOT exposed ---")
        for res in [res1, res2, res3, res4, res7]:
            assert "expected_answer" not in res, "expected_answer found in top level dict!"
            if "question" in res and res["question"]:
                assert "expected_answer" not in res["question"], "expected_answer found in question dict!"
        print("✅ PASS: Confirmed expected_answer is NOT exposed in any response payload.")

        # TEST 9: Ensure selected question belongs to selected concept
        print("\n--- Test 9: Ensure selected question belongs to selected concept ---")
        for res in [res1, res2, res3, res4]:
            q = res.get("question")
            assert q is not None, "Question should not be None"
            assert q["concept_id"] == res["concept_id"], f"Question concept_id {q['concept_id']} mismatch with selected concept {res['concept_id']}"
        print("✅ PASS: Verified question concept_id matches selected concept.")

        # TEST 10: Ensure selected question follows difficulty preference
        print("\n--- Test 10: Ensure selected question follows difficulty preference ---")
        assert res1["question"]["difficulty"] == "Easy", "Needs Practice concept must select Easy question"
        assert res2["question"]["difficulty"] in ["Easy", "Medium"], "Learning concept must select Easy/Medium question"
        assert res3["question"]["difficulty"] == "Easy", "Introduce action must select Easy question"
        print("✅ PASS: Question difficulty follows specified preference rules.")

        # Sample student output display matching exact requirement
        sample_res = get_next_activity("student_001")
        print("\n==================================================")
        print("===== ADAPTIVE ENGINE TEST =====")
        print("==================================================")
        print(f"\nStudent: {sample_res.get('student_id')}")
        print(f"\nSelected Concept:\n{sample_res.get('concept_id', 'N/A')}")
        print(f"\nConcept:\n{sample_res.get('concept_name', 'N/A')}")
        print(f"\nAction:\n{sample_res.get('action')}")
        print(f"\nReason:\n{sample_res.get('reason')}")

        q_sample = sample_res.get("question")
        if q_sample:
            print(f"\nSelected Question:\n{q_sample.get('question')}")
            print(f"\nDifficulty:\n{q_sample.get('difficulty')}")
            has_exp = "expected_answer" in q_sample or "expected_answer" in sample_res
            print(f"\nExpected Answer Exposed:\n{'YES' if has_exp else 'NO'}")
        else:
            print("\nSelected Question:\nNone")
            print("\nDifficulty:\nN/A")
            print("\nExpected Answer Exposed:\nNO")

        print("\n==================================================")
        print("🎉 ALL ADAPTIVE LEARNING ENGINE TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_tests()
