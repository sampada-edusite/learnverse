import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from mastery_engine import calculate_mastery


student_id = "student_001"
concept_id = "C2"

result = calculate_mastery(
    student_id,
    concept_id
)

print("\n===== MASTERY RESULT =====\n")

print("Student:", student_id)
print("Concept:", concept_id)
print("Accuracy:", result["accuracy"], "%")
print("Status:", result["status"])