import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from question_selector import get_questions_by_concept, get_question_for_mastery
from mastery_engine import DB_NAME

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def setup_test_environment():
    """Inserts temporary test concepts, questions, and attempts for test cases."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    # Create temporary concept with ONLY Medium questions to test fallback
    cursor.execute("""
        INSERT INTO concepts (concept_id, lesson_id, name, objective, prerequisite, difficulty)
        VALUES ('TEST_C_MED_ONLY', '1.1', 'Medium Only Concept', 'Test fallback', NULL, 'Medium'),
               ('TEST_C_EMPTY', '1.1', 'Empty Concept', 'Test no questions', NULL, 'Easy')
    """)

    # Question for Medium Only Concept
    cursor.execute("""
        INSERT INTO questions (question_id, concept_id, question, question_type, expected_answer, hint, difficulty)
        VALUES ('TEST_Q_MED', 'TEST_C_MED_ONLY', 'Medium difficulty test question', 'Short Answer', 'ans', 'hint', 'Medium')
    """)

    # Attempts for avoidance test
    # Student 'test_qs_student' has already attempted Q1_C1 (Easy)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_qs_student', 'Q1_C1', 'grin', 1)
    """)

    connection.commit()
    connection.close()


def cleanup_test_environment():
    """Removes temporary test concepts, questions, and attempts."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_%'")
    cursor.execute("DELETE FROM questions WHERE question_id LIKE 'TEST_%'")
    cursor.execute("DELETE FROM concepts WHERE concept_id LIKE 'TEST_%'")

    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING QUESTION SELECTOR TESTS")
    print("==================================================")

    setup_test_environment()

    try:
        # TEST 1: Easy question selection
        print("\n--- Test 1: Easy question selection ---")
        q_easy = get_question_for_mastery("test_student_new", "C1", "Needs Practice")
        print(f"Selected Question ID: {q_easy['question_id']} | Difficulty: {q_easy['difficulty']}")
        assert q_easy is not None, "Failed to select question for C1"
        assert q_easy["difficulty"] == "Easy", f"Expected Easy difficulty, got {q_easy['difficulty']}"
        assert "expected_answer" not in q_easy, "expected_answer should NOT be present in student-facing return dict"
        print("✅ PASS: Correctly selected Easy question and omitted expected_answer.")

        # TEST 2: Medium question selection
        print("\n--- Test 2: Medium question selection ---")
        q_med = get_question_for_mastery("test_student_new", "C2", "Mastered")
        print(f"Selected Question ID: {q_med['question_id']} | Difficulty: {q_med['difficulty']}")
        assert q_med is not None, "Failed to select question for C2"
        assert q_med["difficulty"] in ["Medium", "Hard"], f"Expected Medium/Hard difficulty, got {q_med['difficulty']}"
        assert "expected_answer" not in q_med, "expected_answer should NOT be present"
        print("✅ PASS: Correctly selected Medium question for Mastered status.")

        # TEST 3: Previously attempted question avoidance
        print("\n--- Test 3: Previously attempted question avoidance ---")
        # 'test_qs_student' attempted Q1_C1 (Easy). Q3_C1 (Easy) is unattempted.
        q_avoid = get_question_for_mastery("test_qs_student", "C1", "Needs Practice")
        print(f"Selected Question ID: {q_avoid['question_id']} (Attempted Q1_C1 previously)")
        assert q_avoid["question_id"] != "Q1_C1", "Should avoid previously attempted Q1_C1 when Q3_C1 is available"
        assert q_avoid["question_id"] == "Q3_C1", f"Expected unattempted Q3_C1, got {q_avoid['question_id']}"
        print("✅ PASS: Avoided previously attempted question Q1_C1 and picked unattempted Q3_C1.")

        # TEST 4: Fallback when preferred difficulty doesn't exist
        print("\n--- Test 4: Fallback when preferred difficulty doesn't exist ---")
        # TEST_C_MED_ONLY has ONLY a Medium question. Preferred difficulty for 'Needs Practice' is Easy.
        q_fallback = get_question_for_mastery("test_student_new", "TEST_C_MED_ONLY", "Needs Practice")
        print(f"Selected Question ID: {q_fallback['question_id']} | Difficulty: {q_fallback['difficulty']}")
        assert q_fallback is not None, "Should not return None when questions exist"
        assert q_fallback["question_id"] == "TEST_Q_MED", "Should fallback to available Medium question"
        print("✅ PASS: Fallback successfully returned available Medium question when no Easy question existed.")

        # TEST 5: Invalid concept ID
        print("\n--- Test 5: Invalid concept ID ---")
        q_invalid = get_question_for_mastery("test_student_new", "INVALID_CONCEPT_999", "Learning")
        assert q_invalid is None, f"Expected None for invalid concept ID, got {q_invalid}"
        print("✅ PASS: Correctly returned None for invalid concept ID.")

        # TEST 6: Concept with no questions
        print("\n--- Test 6: Concept with no questions ---")
        q_empty = get_question_for_mastery("test_student_new", "TEST_C_EMPTY", "Learning")
        assert q_empty is None, f"Expected None for concept with no questions, got {q_empty}"
        print("✅ PASS: Correctly returned None for concept with no questions.")

        # Additional Test: get_questions_by_concept helper check
        print("\n--- Additional Test: get_questions_by_concept helper ---")
        c1_questions = get_questions_by_concept("C1")
        assert len(c1_questions) == 3, f"Expected 3 questions for C1, got {len(c1_questions)}"
        print("✅ PASS: get_questions_by_concept correctly returned all concept questions.")

        print("\n==================================================")
        print("🎉 ALL QUESTION SELECTOR TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        cleanup_test_environment()


if __name__ == "__main__":
    run_tests()
