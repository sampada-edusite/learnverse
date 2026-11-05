import os, sys
import unittest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from answer_checker import check_answer, normalize_answer, strip_option_label


class TestAnswerChecker(unittest.TestCase):

    def test_direct_case_insensitive_match(self):
        self.assertTrue(check_answer("Apple", "apple"))
        self.assertTrue(check_answer("apple", "Apple"))
        self.assertFalse(check_answer("Ball", "Apple"))

    def test_option_label_stripping(self):
        # When child selects MCQ with option letter
        self.assertTrue(check_answer("A) walk", "walk"))
        self.assertTrue(check_answer("A. grin", "grin"))
        self.assertTrue(check_answer("(B) jump", "jump"))
        self.assertTrue(check_answer("Option C: skip", "skip"))
        self.assertTrue(check_answer("A - bell", "bell"))
        self.assertTrue(check_answer("walk", "A) walk"))

    def test_option_letter_matching(self):
        options = ["grin", "jump", "run", "skip"]
        # Option A is grin
        self.assertTrue(check_answer("A", "grin", options=options))
        # Option B is jump
        self.assertTrue(check_answer("B", "jump", options=options))
        self.assertFalse(check_answer("B", "grin", options=options))

    def test_comma_and_set_matching(self):
        # Order independence for multi-item answers
        self.assertTrue(check_answer("run, skip", "skip, run"))
        self.assertTrue(check_answer("skip and run", "skip, run"))
        self.assertTrue(check_answer("run and skip", "skip, run"))

    def test_number_word_equivalence(self):
        self.assertTrue(check_answer("Grade 1", "Grade One"))
        self.assertTrue(check_answer("Grade One", "Grade 1"))
        self.assertTrue(check_answer("one", "1"))
        self.assertTrue(check_answer("1", "one"))
        self.assertTrue(check_answer("five", "5"))

    def test_parenthetical_candidates(self):
        # Primary school syllabus format: 5 (a, e, i, o, u)
        self.assertTrue(check_answer("5", "5 (a, e, i, o, u)"))
        self.assertTrue(check_answer("a, e, i, o, u", "5 (a, e, i, o, u)"))
        self.assertTrue(check_answer("small letter", "The child with the card having the same sound (small letter)"))

    def test_true_false_aliases(self):
        self.assertTrue(check_answer("t", "True"))
        self.assertTrue(check_answer("true", "True"))
        self.assertTrue(check_answer("f", "False"))
        self.assertTrue(check_answer("false", "False"))
        self.assertTrue(check_answer("yes", "True"))

    def test_leading_articles_tolerance(self):
        self.assertTrue(check_answer("the bell rings", "The bell rings"))
        self.assertTrue(check_answer("bell rings", "The bell rings"))
        self.assertTrue(check_answer("The bell rings", "bell rings"))

    def test_voice_spoken_sentence_containment(self):
        # When child speaks via microphone: "it is jump" or "I think grin"
        self.assertTrue(check_answer("it is jump", "jump"))
        self.assertTrue(check_answer("the word is grin", "grin"))
        self.assertFalse(check_answer("sleep soundly", "jump"))


if __name__ == "__main__":
    unittest.main()