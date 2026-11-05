import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
import sqlite3
import sys
from speech_to_text import speech_to_text, PlaceholderSpeechToTextProvider
from learning_session import submit_speech_answer
from mastery_engine import DB_NAME

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def contains_expected_answer(obj):
    """Recursively checks if 'expected_answer' key is present in obj."""
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
    """Cleans up temporary attempt data for test student IDs."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_stt_%'")
    connection.commit()
    connection.close()


def cleanup_test_data():
    """Removes temporary attempt data created during tests."""
    connection = sqlite3.connect(DB_NAME)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM attempts WHERE student_id LIKE 'test_stt_%'")
    connection.commit()
    connection.close()


def run_tests():
    print("==================================================")
    print("RUNNING SPEECH-TO-TEXT INTERFACE TESTS")
    print("==================================================")

    setup_test_data()

    try:
        # --------------------------------------------------
        # TEST 1: Valid text/mock speech input
        # --------------------------------------------------
        print("\n--- Test 1: Valid mock speech input ---")
        res1 = speech_to_text("grin", language="en")
        print(f"Success: {res1.get('success')} | Text: '{res1.get('text')}' | Provider: {res1.get('provider')}")
        assert res1["success"] is True, "Expected success to be True"
        assert res1["text"] == "grin", f"Expected text 'grin', got '{res1['text']}'"
        assert res1["language"] == "en"
        assert res1["provider"] == "placeholder"
        print("✅ PASS: Valid mock speech input recognized successfully.")

        # --------------------------------------------------
        # TEST 2: Empty input
        # --------------------------------------------------
        print("\n--- Test 2: Empty audio input handling ---")
        res2_none = speech_to_text(None, language="en")
        res2_empty = speech_to_text("", language="en")
        res2_whitespace = speech_to_text("   ", language="en")

        assert res2_none["success"] is False, "Expected None input to fail"
        assert res2_empty["success"] is False, "Expected empty string to fail"
        assert res2_whitespace["success"] is False, "Expected whitespace string to fail"
        assert "error" in res2_none
        print(f"Error output: {res2_none.get('error')}")
        print("✅ PASS: Empty and None speech inputs handled safely.")

        # --------------------------------------------------
        # TEST 3: Unsupported language
        # --------------------------------------------------
        print("\n--- Test 3: Unsupported language handling ---")
        res3 = speech_to_text("grin", language="fr")
        print(f"Success: {res3.get('success')} | Error: {res3.get('error')}")
        assert res3["success"] is False, "Expected unsupported language to return success=False"
        assert "Unsupported language" in res3["error"]
        print("✅ PASS: Unsupported language handled safely without crash.")

        # --------------------------------------------------
        # TEST 4: Speech conversion integrated with learning_session
        # --------------------------------------------------
        print("\n--- Test 4: Integration with submit_speech_answer ---")
        student_stt = "test_stt_student_01"
        # Submit correct mock speech for Q1_C1 (expected: 'grin')
        res4 = submit_speech_answer(student_stt, "Q1_C1", "grin", language="en")

        print(f"Speech Success: {res4.get('speech_success')} | Recognized Text: '{res4.get('recognized_text')}'")
        assert res4["speech_success"] is True, "Expected speech_success to be True"
        assert res4["recognized_text"] == "grin"
        assert res4["learning_result"] is not None
        assert res4["learning_result"]["is_correct"] is True
        assert res4["learning_result"]["feedback"] == "Correct! Well done."

        # Verify attempt saved in DB
        connection = sqlite3.connect(DB_NAME)
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM attempts WHERE student_id = ? AND is_correct = 1", (student_stt,))
        count = cursor.fetchone()[0]
        connection.close()
        assert count == 1, f"Expected 1 attempt recorded in DB, got {count}"
        print("✅ PASS: Speech answer successfully integrated into learning session and persisted.")

        # --------------------------------------------------
        # TEST 5: Invalid question ID in speech submission
        # --------------------------------------------------
        print("\n--- Test 5: Invalid question ID in speech submission ---")
        res5 = submit_speech_answer("test_stt_student_01", "INVALID_Q_ID_999", "grin")
        print(f"Speech Success: {res5.get('speech_success')} | Learning Feedback: {res5['learning_result'].get('feedback')}")
        assert res5["speech_success"] is True
        assert res5["learning_result"]["is_correct"] is False
        assert "not found" in res5["learning_result"]["feedback"].lower()
        print("✅ PASS: Invalid question ID handled gracefully by submit_speech_answer.")

        # --------------------------------------------------
        # TEST 6: Verify expected_answer is NEVER exposed
        # --------------------------------------------------
        print("\n--- Test 6: Verify expected_answer is strictly hidden ---")
        responses = [
            res1, res2_none, res3, res4, res5,
            submit_speech_answer("test_stt_student_02", "Q1_C1", "wrong_speech_ans"),
            submit_speech_answer("test_stt_student_03", "Q1_C2", "", language="en"),
            submit_speech_answer("test_stt_student_04", "Q1_C3", "bell", language="invalid_lang")
        ]
        for idx, resp in enumerate(responses, 1):
            assert not contains_expected_answer(resp), f"expected_answer found in response payload index {idx}!"
        print("✅ PASS: Confirmed 'expected_answer' is 100% hidden in all speech interface payloads.")

        print("\n==================================================")
        print("🎉 ALL SPEECH-TO-TEXT INTERFACE TESTS PASSED!")
        print("==================================================")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_tests()
