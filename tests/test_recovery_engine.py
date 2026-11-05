import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from recovery_engine import get_recovery_activity
from mastery_engine import DB_NAME

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def setup_test_environment():
    """Inserts temporary test concepts, questions, and attempt data."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    # Create temporary concept with NO questions
    cursor.execute("""
        INSERT INTO concepts (concept_id, lesson_id, name, objective, prerequisite, difficulty)
        VALUES ('TEST_REC_EMPTY', '1.1', 'Empty Recovery Concept', 'Test no questions', NULL, 'Easy'),
               ('TEST_REC_SINGLE', '1.1', 'Single Question Concept', 'Test all attempted fallback', NULL, 'Easy')
    """)

    # Single question for TEST_REC_SINGLE
    cursor.execute("""
        INSERT INTO questions (question_id, concept_id, question, question_type, expected_answer, hint, difficulty)
        VALUES ('TEST_Q_SINGLE', 'TEST_REC_SINGLE', 'Single test question', 'Short Answer', 'ans', 'hint text', 'Easy')
    """)

    # 1. Student with Needs Practice concept (25% accuracy on C2)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_rec_np', 'Q1_C2', 'hurray', 1),
               ('test_rec_np', 'Q2_C2', 'wrong1', 0),
               ('test_rec_np', 'Q3_C2', 'wrong2', 0),
               ('test_rec_np', 'Q1_C2', 'wrong3', 0)
    """)

    # 2. Student with repeated incorrect attempts on C4 (Learning overall, but last 2 attempts wrong)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_rec_repeat', 'Q1_C4', 'see', 1),
               ('test_rec_repeat', 'Q2_C4', 'look', 1),
               ('test_rec_repeat', 'Q1_C4', 'wrong1', 0),
               ('test_rec_repeat', 'Q1_C4', 'wrong2', 0)
    """)

    # 3. Student with high accuracy (100% on C1)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_rec_high', 'Q1_C1', 'grin', 1),
               ('test_rec_high', 'Q2_C1', 'skip, run', 1)
    """)

    # 4. Student who attempted Q1_C1 previously, but Q3_C1 is unattempted
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_rec_avoid', 'Q1_C1', 'wrong1', 0),
               ('test_rec_avoid', 'Q1_C1', 'wrong2', 0)
    """)

    # 5. Student attempting TEST_REC_SINGLE where all questions are attempted
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_rec_all_attempted', 'TEST_Q_SINGLE', 'wrong1', 0),
               ('test_rec_all_attempted', 'TEST_Q_SINGLE', 'wrong2', 0)
    """)

    # 6. Student attempting TEST_REC_EMPTY (Needs Practice) where no questions exist
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_rec_empty_student', 'Q1_C1', 'wrong1', 0),
               ('test_rec_empty_student', 'Q1_C1', 'wrong2', 0)
    """)

    connection.commit()
    connection.close()


def cleanup_test_environment():
    """Removes temporary test concepts, questions, and attempt data."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_rec_%'")
    cursor.execute("DELETE FROM questions WHERE question_id LIKE 'TEST_%'")
    cursor.execute("DELETE FROM concepts WHERE concept_id LIKE 'TEST_%'")

    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING RECOVERY ENGINE TESTS")
    print("==================================================")

    setup_test_environment()

    try:
        # TEST 1: Student with Needs Practice concept
        print("\n--- TEST 1: Student with Needs Practice concept ---")
        res1 = get_recovery_activity("test_rec_np", "C2")
        print(f"Recovery Needed: {res1['recovery_needed']} | Reason: {res1['reason']}")
        assert res1["recovery_needed"] is True, "Expected recovery_needed = True for Needs Practice concept"
        assert "below the mastery threshold" in res1["reason"] or "repeated incorrect" in res1["reason"]
        print("✅ PASS: Correctly identified recovery needed for Needs Practice concept.")

        # TEST 2: Student with repeated incorrect attempts
        print("\n--- TEST 2: Student with repeated incorrect attempts ---")
        res2 = get_recovery_activity("test_rec_repeat", "C4")
        print(f"Recovery Needed: {res2['recovery_needed']} | Type: {res2.get('recovery_type')} | Reason: {res2['reason']}")
        assert res2["recovery_needed"] is True, "Expected recovery_needed = True for repeated failures"
        assert res2["recovery_type"] == "hint_support", f"Expected recovery_type 'hint_support', got '{res2.get('recovery_type')}'"
        print("✅ PASS: Correctly triggered Level 2 hint_support recovery for repeated failures.")

        # TEST 3: Student with no attempts
        print("\n--- TEST 3: Student with no attempts ---")
        res3 = get_recovery_activity("test_rec_new_student", "C1")
        print(f"Recovery Needed: {res3['recovery_needed']} | Reason: {res3['reason']}")
        assert res3["recovery_needed"] is False, "Expected recovery_needed = False for unattempted concept"
        assert "not been attempted yet" in res3["reason"]
        print("✅ PASS: Correctly returned recovery_needed = False for unattempted concept.")

        # TEST 4: Student with good/high accuracy
        print("\n--- TEST 4: Student with good/high accuracy ---")
        res4 = get_recovery_activity("test_rec_high", "C1")
        print(f"Recovery Needed: {res4['recovery_needed']} | Reason: {res4['reason']}")
        assert res4["recovery_needed"] is False, "Expected recovery_needed = False for high accuracy student"
        print("✅ PASS: Correctly returned recovery_needed = False for high accuracy student.")

        # TEST 5: Recovery selects an Easy question when available
        print("\n--- TEST 5: Recovery selects an Easy question ---")
        assert res1["question"] is not None
        assert res1["question"]["difficulty"] == "Easy", f"Expected Easy question, got {res1['question']['difficulty']}"
        print("✅ PASS: Recovery question selected has Easy difficulty.")

        # TEST 6: Selected question belongs to requested concept
        print("\n--- TEST 6: Question belongs to requested concept ---")
        assert res1["question"]["concept_id"] == "C2"
        assert res2["question"]["concept_id"] == "C4"
        print("✅ PASS: Selected question concept_id matches requested concept.")

        # TEST 7: expected_answer is NOT present anywhere in returned result
        print("\n--- TEST 7: Ensure expected_answer is NOT exposed ---")
        for res in [res1, res2, res3, res4]:
            assert "expected_answer" not in res
            if res.get("question"):
                assert "expected_answer" not in res["question"]
        print("✅ PASS: expected_answer is strictly hidden from returned dictionary.")

        # TEST 8: Previously attempted question is avoided when alternative exists
        print("\n--- TEST 8: Previously attempted question avoidance ---")
        # test_rec_avoid attempted Q1_C1 previously. Q3_C1 (Easy) is available unattempted.
        res8 = get_recovery_activity("test_rec_avoid", "C1")
        print(f"Selected Question ID: {res8['question']['question_id']} (Attempted Q1_C1 previously)")
        assert res8["question"]["question_id"] != "Q1_C1", "Should avoid previously attempted Q1_C1 when unattempted question is available"
        print("✅ PASS: Avoided previously attempted question Q1_C1.")

        # TEST 9: Invalid concept ID handled safely
        print("\n--- TEST 9: Invalid concept ID ---")
        res9 = get_recovery_activity("test_rec_np", "INVALID_CONCEPT_999")
        print(f"Recovery Needed: {res9['recovery_needed']} | Reason: {res9['reason']}")
        assert res9["recovery_needed"] is False
        assert "Invalid concept ID" in res9["reason"]
        print("✅ PASS: Invalid concept ID handled safely without crashing.")

        # TEST 10: Concept with no questions handled safely
        print("\n--- TEST 10: Concept with no questions ---")
        res10 = get_recovery_activity("test_rec_empty_student", "TEST_REC_EMPTY")
        print(f"Recovery Needed: {res10['recovery_needed']} | Reason: {res10['reason']} | Question: {res10['question']}")
        assert res10["question"] is None
        print("✅ PASS: Concept with no questions handled safely (returns question: None).")

        # TEST 11: All available questions already attempted (fallback behavior)
        print("\n--- TEST 11: All available questions already attempted ---")
        res11 = get_recovery_activity("test_rec_all_attempted", "TEST_REC_SINGLE")
        print(f"Recovery Needed: {res11['recovery_needed']} | Selected Question: {res11['question']['question_id']}")
        assert res11["recovery_needed"] is True
        assert res11["question"] is not None
        assert res11["question"]["question_id"] == "TEST_Q_SINGLE"
        print("✅ PASS: Handled fallback successfully when all questions had been attempted.")

        print("\n==================================================")
        print("🎉 ALL 11 RECOVERY ENGINE TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        cleanup_test_environment()


if __name__ == "__main__":
    run_tests()
