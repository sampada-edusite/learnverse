import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from weak_concept_detector import get_weak_concepts
from mastery_engine import DB_NAME

# Force UTF-8 standard output encoding for Windows compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def setup_test_data():
    """Inserts temporary attempt data for specific test student scenarios."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    # 1. High accuracy student (100% on C1 -> Mastered)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_high_acc', 'Q1_C1', 'grin', 1),
               ('test_high_acc', 'Q2_C1', 'skip, run', 1)
    """)

    # 2. Low accuracy student (25% on C2 -> Needs Practice)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES ('test_low_acc', 'Q1_C2', 'hurray', 1),
               ('test_low_acc', 'Q2_C2', 'wrong1', 0),
               ('test_low_acc', 'Q3_C2', 'wrong2', 0),
               ('test_low_acc', 'Q1_C2', 'wrong3', 0)
    """)

    # 3. Multiple concepts student (C3: 25% Needs Practice, C2: 75% Learning, C1: 100% Mastered)
    cursor.execute("""
        INSERT INTO attempts (student_id, question_id, student_answer, is_correct)
        VALUES 
            -- C3: 1 correct out of 4 (25% - Needs Practice)
            ('test_multi_acc', 'Q1_C3', 'The bell rings', 1),
            ('test_multi_acc', 'Q2_C3', 'wrong', 0),
            ('test_multi_acc', 'Q3_C3', 'wrong', 0),
            ('test_multi_acc', 'Q1_C3', 'wrong', 0),

            -- C2: 3 correct out of 4 (75% - Learning)
            ('test_multi_acc', 'Q1_C2', 'hurray', 1),
            ('test_multi_acc', 'Q2_C2', 'in', 1),
            ('test_multi_acc', 'Q3_C2', 'everyone', 1),
            ('test_multi_acc', 'Q1_C2', 'wrong', 0),

            -- C1: 2 correct out of 2 (100% - Mastered)
            ('test_multi_acc', 'Q1_C1', 'grin', 1),
            ('test_multi_acc', 'Q2_C1', 'skip, run', 1)
    """)

    connection.commit()
    connection.close()


def cleanup_test_data():
    """Removes temporary test student rows from attempts table."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()

    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_%'")
    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING WEAK CONCEPT DETECTOR TESTS")
    print("==================================================")

    setup_test_data()

    try:
        # TEST 1: Existing student_001 (correct and incorrect attempts)
        print("\n--- Test 1: Student with mixed attempts (student_001) ---")
        weak_001 = get_weak_concepts("student_001")
        print(f"Found {len(weak_001)} weak concept(s).")
        for item in weak_001:
            print(f"Concept: {item['concept_id']}")
            print(f"Name: {item['concept_name']}")
            print(f"Accuracy: {item['accuracy']}%")
            print(f"Status: {item['status']}")
            print("-" * 30)

        # TEST 2: Student with no attempts
        print("\n--- Test 2: Student with no attempts ---")
        weak_none = get_weak_concepts("test_no_attempts")
        print(f"Weak concepts count: {len(weak_none)}")
        assert len(weak_none) == 0, "Expected 0 weak concepts for student with no attempts"
        print("✅ PASS: No weak concepts returned for unpracticed student.")

        # TEST 3: Student with high accuracy (Mastered)
        print("\n--- Test 3: Concept with high accuracy (Mastered) ---")
        weak_high = get_weak_concepts("test_high_acc")
        print(f"Weak concepts count: {len(weak_high)}")
        assert len(weak_high) == 0, "Expected 0 weak concepts for Mastered concepts"
        print("✅ PASS: Mastered concepts excluded from weak concept list.")

        # TEST 4: Student with low accuracy (Needs Practice)
        print("\n--- Test 4: Concept with low accuracy (Needs Practice) ---")
        weak_low = get_weak_concepts("test_low_acc")
        print(f"Weak concepts count: {len(weak_low)}")
        assert len(weak_low) == 1, "Expected 1 weak concept for low accuracy student"
        assert weak_low[0]["concept_id"] == "C2"
        assert weak_low[0]["accuracy"] == 25.0
        assert weak_low[0]["status"] == "Needs Practice"
        print("✅ PASS: Correctly identified low accuracy concept C2.")

        # TEST 5: Multiple concepts with different accuracy & sorting order
        print("\n--- Test 5: Multiple concepts sorting order ---")
        weak_multi = get_weak_concepts("test_multi_acc")
        print(f"Weak concepts count: {len(weak_multi)}")
        assert len(weak_multi) == 2, "Expected 2 weak concepts (C3 and C2)"
        
        # Verify order: 25.0% (C3) before 75.0% (C2)
        assert weak_multi[0]["concept_id"] == "C3" and weak_multi[0]["accuracy"] == 25.0
        assert weak_multi[1]["concept_id"] == "C2" and weak_multi[1]["accuracy"] == 75.0
        print("✅ PASS: Weak concepts properly sorted from weakest to strongest.")

        print("\n==================================================")
        print("===== WEAK CONCEPTS FOR SAMPLE STUDENT (student_001) =====")
        print("==================================================")
        for c in weak_001:
            print(f"\nConcept: {c['concept_id']}")
            print(f"Name: {c['concept_name']}")
            print(f"Total Attempts: {c['total_attempts']}")
            print(f"Correct Attempts: {c['correct_attempts']}")
            print(f"Incorrect Attempts: {c['incorrect_attempts']}")
            print(f"Accuracy: {c['accuracy']}%")
            print(f"Status: {c['status']}")
            print("==================================================")

        print("\n🎉 ALL WEAK CONCEPT DETECTOR TESTS PASSED SUCCESSFULLY!")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_tests()
