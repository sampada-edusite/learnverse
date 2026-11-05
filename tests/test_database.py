import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from database import get_connection, fetch_one, fetch_all, DB_NAME
from get_question import get_question
from mastery_engine import calculate_mastery
from question_selector import get_question_for_mastery
from learning_session import start_session, submit_answer

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def contains_expected_answer(obj):
    """Recursively checks if 'expected_answer' key exists in obj."""
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
    """Cleans up any test attempt records."""
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_db_%'")
    connection.commit()
    connection.close()


def cleanup_test_data():
    """Cleans up temporary test attempt records."""
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_db_%'")
    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING DATABASE ARCHITECTURE CLEANUP TESTS")
    print("==================================================")

    setup_test_data()

    try:
        # --------------------------------------------------
        # TEST 1: database.py can connect successfully
        # --------------------------------------------------
        print("\n--- Test 1: database.py connection ---")
        conn = get_connection()
        assert conn is not None, "Failed to obtain database connection"
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        res1 = cursor.fetchone()
        conn.close()
        assert res1 == (1,), f"Expected (1,), got {res1}"
        print("✅ PASS: get_connection() connected successfully.")

        # --------------------------------------------------
        # TEST 2: lessons table can be queried
        # --------------------------------------------------
        print("\n--- Test 2: Query lessons table ---")
        lessons = fetch_all("SELECT lesson_id, lesson_name FROM lessons")
        assert lessons is not None and len(lessons) > 0, "No rows returned from lessons table!"
        print(f"Lessons count: {len(lessons)} | Sample lesson: {lessons[0]}")
        print("✅ PASS: Successfully queried lessons table.")

        # --------------------------------------------------
        # TEST 3: concepts table can be queried
        # --------------------------------------------------
        print("\n--- Test 3: Query concepts table ---")
        concepts = fetch_all("SELECT concept_id, name FROM concepts")
        assert concepts is not None and len(concepts) > 0, "No rows returned from concepts table!"
        print(f"Concepts count: {len(concepts)} | Sample concept: {concepts[0]}")
        print("✅ PASS: Successfully queried concepts table.")

        # --------------------------------------------------
        # TEST 4: questions table can be queried
        # --------------------------------------------------
        print("\n--- Test 4: Query questions table ---")
        questions = fetch_all("SELECT question_id, question, expected_answer FROM questions")
        assert questions is not None and len(questions) > 0, "No rows returned from questions table!"
        print(f"Questions count: {len(questions)} | Sample question ID: {questions[0][0]}")
        print("✅ PASS: Successfully queried questions table.")

        # --------------------------------------------------
        # TEST 5: attempts table can be queried
        # --------------------------------------------------
        print("\n--- Test 5: Query attempts table ---")
        attempts_count = fetch_one("SELECT COUNT(*) FROM attempts")
        assert attempts_count is not None, "Failed to query attempts table!"
        print(f"Current attempts count in database: {attempts_count[0]}")
        print("✅ PASS: Successfully queried attempts table.")

        # --------------------------------------------------
        # TEST 6: Existing get_question functionality still works
        # --------------------------------------------------
        print("\n--- Test 6: get_question integration ---")
        q = get_question("Q1_C1")
        assert q is not None, "Failed to retrieve question Q1_C1"
        assert q[0] == "Q1_C1"
        assert q[3] == "grin"
        print(f"Question Q1_C1 retrieved: '{q[1]}' | Expected: '{q[3]}'")
        print("✅ PASS: get_question functionality works cleanly.")

        # --------------------------------------------------
        # TEST 7: Existing mastery_engine functionality still works
        # --------------------------------------------------
        print("\n--- Test 7: mastery_engine integration ---")
        m = calculate_mastery("test_db_student", "C1")
        assert m is not None
        assert "accuracy" in m and "status" in m
        assert m["status"] == "No Practice"
        print(f"Mastery result for unpracticed student: {m}")
        print("✅ PASS: calculate_mastery functionality works cleanly.")

        # --------------------------------------------------
        # TEST 8: Existing question_selector functionality still works
        # --------------------------------------------------
        print("\n--- Test 8: question_selector integration ---")
        qs = get_question_for_mastery("test_db_student", "C1", "Learning")
        assert qs is not None, "Failed to select question for C1"
        assert qs["concept_id"] == "C1"
        assert "expected_answer" not in qs
        print(f"Selected question ID: {qs['question_id']} | Difficulty: {qs['difficulty']}")
        print("✅ PASS: get_question_for_mastery functionality works cleanly.")

        # --------------------------------------------------
        # TEST 9: Existing learning_session functionality still works
        # --------------------------------------------------
        print("\n--- Test 9: learning_session integration ---")
        student_test = "test_db_session_user"
        s = start_session(student_test)
        assert s["session_started"] is True
        assert s["question"] is not None
        assert not contains_expected_answer(s)

        q_id = s["question"]["question_id"]
        sub = submit_answer(student_test, q_id, "test_answer")
        assert sub["is_correct"] in [True, False]
        assert sub["mastery"] is not None
        assert not contains_expected_answer(sub)
        print(f"Session start & answer submission succeeded! Correct: {sub['is_correct']}")
        print("✅ PASS: learning_session functionality works cleanly.")

        print("\n==================================================")
        print("🎉 ALL DATABASE ARCHITECTURE TESTS PASSED!")
        print("==================================================")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_tests()
