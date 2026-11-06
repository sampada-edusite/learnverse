"""Tolerant answer checking for young learners.

Handles option labels ("A) walk"), option letters, order-independent lists,
number words (English and Marathi), Devanagari digits, true/false aliases,
leading articles, parenthetical alternatives and short spoken sentences.
"""
import re
import unicodedata

NUMBER_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12",
    "thirteen": "13", "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
    "eighteen": "18", "nineteen": "19", "twenty": "20", "first": "1",
    # Marathi number names
    "शून्य": "0", "एक": "1", "दोन": "2", "तीन": "3", "चार": "4", "पाच": "5", "सहा": "6", "सात": "7",
    "आठ": "8", "नऊ": "9", "दहा": "10", "अकरा": "11", "बारा": "12", "तेरा": "13", "चौदा": "14",
    "पंधरा": "15", "सोळा": "16", "सतरा": "17", "अठरा": "18", "एकोणीस": "19", "वीस": "20",
}
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
TRUE_ALIASES = {"true", "t", "yes", "y", "correct", "right", "हो", "बरोबर", "होय"}
FALSE_ALIASES = {"false", "f", "no", "n", "wrong", "incorrect", "नाही", "चूक"}
ARTICLES = ("the", "a", "an")

_LABEL_PATTERNS = [
    re.compile(r"^\s*option\s+([a-d1-4])\s*[\.\)\:\-]?\s*", re.IGNORECASE),
    re.compile(r"^\s*\(([a-d1-4])\)\s*", re.IGNORECASE),
    re.compile(r"^\s*([a-d])\s*(?:[\.\:\-]\s+|\)\s*)", re.IGNORECASE),
]
# Connector words must be whitespace-delimited: \b is unreliable around Devanagari vowel signs.
_LIST_SPLIT = re.compile(r"\s*[,&/]\s*|\s+(?:and|आणि|व)\s+", re.IGNORECASE)


def strip_option_label(text):
    """Remove a leading MCQ label such as 'A)', '(B)', 'Option C:' or 'A -'."""
    if text is None:
        return ""
    text = str(text)
    for pattern in _LABEL_PATTERNS:
        match = pattern.match(text)
        if match and text[match.end():].strip():
            return text[match.end():].strip()
    return text.strip()


def _remove_punctuation(text):
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        out.append(" " if cat[0] in ("P", "S") else ch)
    return "".join(out)


def normalize_answer(text):
    """Lowercase, strip labels/punctuation/leading articles, map number words to digits."""
    if text is None:
        return ""
    text = unicodedata.normalize("NFC", str(text)).strip().lower()
    text = text.translate(DEVANAGARI_DIGITS)
    text = strip_option_label(text)
    text = _remove_punctuation(text)
    tokens = text.split()
    while len(tokens) > 1 and tokens[0] in ARTICLES:
        tokens = tokens[1:]
    tokens = [NUMBER_WORDS.get(tok, tok) for tok in tokens]
    return " ".join(tokens)


def _candidates(expected):
    """The full expected answer plus the parts inside/outside parentheses."""
    expected = strip_option_label(expected)
    cands = [expected]
    inner = re.findall(r"\(([^)]*)\)", expected)
    outer = re.sub(r"\([^)]*\)", " ", expected).strip()
    if inner:
        if outer:
            cands.append(outer)
        cands.extend(i for i in inner if i.strip())
    return cands


def _items(text):
    return {normalize_answer(part) for part in _LIST_SPLIT.split(text) if normalize_answer(part)}


def _contains_sequence(haystack, needle):
    n = len(needle)
    return any(haystack[i:i + n] == needle for i in range(len(haystack) - n + 1))


def _matches(student, expected, options):
    ns, ne = normalize_answer(student), normalize_answer(expected)

    # Symbol-only answers such as '<', '>' or emoji patterns.
    if not ne:
        return str(student).strip() == str(expected).strip() and bool(str(expected).strip())
    if not ns:
        return False
    if ns == ne:
        return True
    if ne in TRUE_ALIASES:
        return ns in TRUE_ALIASES
    if ne in FALSE_ALIASES:
        return ns in FALSE_ALIASES

    expected_items = _items(expected)
    if len(expected_items) > 1 and _items(student) == expected_items:
        return True

    # Numbers must match exactly.
    if ne.replace(" ", "").isdigit():
        return False

    # Spoken sentence containing the answer ("it is jump").
    s_tokens, e_tokens = ns.split(), ne.split()
    if len(ne) >= 2 and len(s_tokens) <= len(e_tokens) + 4 and _contains_sequence(s_tokens, e_tokens):
        if options:
            for opt in options:
                no = normalize_answer(opt)
                if no and no != ne and _contains_sequence(s_tokens, no.split()):
                    return False
        return True
    return False


def check_answer(student_answer, expected_answer, options=None):
    """Return True when the learner's answer should be accepted."""
    if student_answer is None or expected_answer is None:
        return False
    student = str(student_answer).strip()
    if not student:
        return False

    # A bare option letter ("B") refers to that option, unless it is itself an option.
    if options:
        normalized_options = [normalize_answer(o) for o in options]
        letter = student.strip("()., ").upper()
        if (len(letter) == 1 and letter in "ABCD" and normalize_answer(student) not in normalized_options):
            idx = "ABCD".index(letter)
            if idx < len(options):
                student = str(options[idx])

    for candidate in _candidates(str(expected_answer)):
        if _matches(student, candidate, options):
            return True
    return False
