"""Curriculum content registry.

Bump CONTENT_VERSION whenever content changes; the database re-seeds
(upserts) lessons, concepts and questions on the next start.
"""
from . import english_unit1, maths, marathi

CONTENT_VERSION = "2026.11.05.1"

SUBJECTS = [
    {"subject": "English", "title": "English", "title_local": "इंग्रजी", "icon": "📖",
     "description": "Unit 1 rhymes, phonics and reading"},
    {"subject": "Mathematics", "title": "Mathematics", "title_local": "गणित", "icon": "🔢",
     "description": "Numbers, operations, shapes, time and money"},
    {"subject": "Marathi", "title": "Marathi", "title_local": "मराठी", "icon": "🪔",
     "description": "स्वर, व्यंजने, बाराखडी, शब्द आणि वाक्ये"},
]


def get_all_content():
    lessons, concepts, questions = [], [], []
    for module in (english_unit1, maths, marathi):
        l, c, q = module.build()
        lessons += l
        concepts += c
        questions += q
    return lessons, concepts, questions
