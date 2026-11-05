import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from save_attempt import save_attempt

print("\n===== TEST STUDENT ATTEMPT =====\n")

student_id = "student_001"
question_id = "q1"

student_answer = "Apple"
expected_answer = "apple"

save_attempt(
    student_id,
    question_id,
    student_answer,
    expected_answer
)