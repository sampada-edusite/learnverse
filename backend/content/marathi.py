"""Marathi (मराठी) - Maharashtra State Board, Std 1 and Std 2.

Organised by the Balbharati early-literacy outcomes: स्वर, व्यंजने,
बाराखडी, word reading, अंक व संख्यानाम, vocabulary, and in Std 2
जोडाक्षरे, विरुद्धार्थी/समानार्थी शब्द, वचन, महिने and sentence completion.
"""
from . import marathi_data as M
from .builder import ConceptBuilder, SA, concept, lesson

SUBJECT = "Marathi"


def pick_others(rng, pool, answer, k=3):
    others = [p for p in pool if p != answer]
    rng.shuffle(others)
    return others[:k]


# ---------------- generators ----------------

def g_swar_identify(rng, diff):
    s = rng.choice(M.SWAR)
    if diff == "Hard":
        v = rng.choice(M.VYANJAN[:30])
        return {"text": f"'{s}' हा स्वर आहे की व्यंजन?", "answer": "स्वर", "distractors": ["व्यंजन"],
                "hint": "अ ते अः हे स्वर आहेत."} if rng.random() < 0.5 else {
            "text": f"'{v}' हा स्वर आहे की व्यंजन?", "answer": "व्यंजन", "distractors": ["स्वर"],
            "hint": "क ते ज्ञ ही व्यंजने आहेत."}
    return {"text": "खालीलपैकी स्वर कोणता?", "answer": s,
            "distractors": rng.sample(M.VYANJAN[:30], 3), "hint": "अ, आ, इ, ई ... हे स्वर आहेत."}


def g_swar_order(rng, diff):
    seq = rng.choice(M.SWAR_SEQUENCES)
    i = rng.randrange(len(seq) - 1)
    if diff == "Medium" and i > 0:
        return {"text": f"'{seq[i]}' च्या आधी कोणता स्वर येतो?", "answer": seq[i - 1],
                "distractors": pick_others(rng, M.SWAR, seq[i - 1]), "hint": "स्वरमाला मोठ्याने म्हणा."}
    spec = {"text": f"'{seq[i]}' नंतर कोणता स्वर येतो?", "answer": seq[i + 1],
            "hint": "स्वरमाला मोठ्याने म्हणा."}
    if diff == "Hard":
        spec["text"] = f"'{seq[i]}' नंतर येणारा स्वर लिहा."
        spec["qtype"] = SA
    else:
        spec["distractors"] = pick_others(rng, M.SWAR, seq[i + 1])
    return spec


def g_letter_word(rng, diff, letters):
    letter = rng.choice(letters)
    word, emoji = M.LETTER_WORDS[letter]
    pool = [w for l, (w, _) in M.LETTER_WORDS.items() if l != letter]
    if diff == "Hard" and emoji:
        return {"text": f"{emoji} या चित्राचे नाव कोणत्या अक्षराने सुरू होते?", "answer": letter,
                "distractors": pick_others(rng, [l for l in M.LETTER_WORDS if l in letters or l in M.VYANJAN], letter),
                "hint": f"चित्राचे नाव म्हणा: {word[0]}…"}
    return {"text": f"'{letter}' ने सुरू होणारा शब्द कोणता?", "answer": word,
            "distractors": pick_others(rng, pool, word), "hint": f"{emoji or ''} चित्र आठवा.".strip()}


def g_vyanjan_order(rng, diff, groups):
    group = rng.choice(groups)
    i = rng.randrange(len(group) - 1)
    pool = [v for g in groups for v in g]
    if diff == "Medium" and i > 0:
        return {"text": f"'{group[i]}' च्या आधी कोणते व्यंजन येते?", "answer": group[i - 1],
                "distractors": pick_others(rng, pool, group[i - 1]), "hint": "व्यंजनमाला क्रमाने म्हणा."}
    spec = {"text": f"'{group[i]}' नंतर कोणते व्यंजन येते?", "answer": group[i + 1],
            "hint": "व्यंजनमाला क्रमाने म्हणा."}
    if diff == "Hard":
        spec["text"] = f"'{group[i]}' नंतर येणारे व्यंजन लिहा."
        spec["qtype"] = SA
    else:
        spec["distractors"] = pick_others(rng, pool, group[i + 1])
    return spec


def g_barakhadi(rng, diff, matra_slice):
    matras = M.MATRAS[matra_slice]
    v = rng.choice(M.COMMON_VYANJAN)
    sign, name, vowel = rng.choice(matras)
    combined = v + sign
    all_forms = [v + s for s, _, _ in M.MATRAS] + [v]
    if diff == "Easy":
        return {"text": f"{v} + {name} ( {sign} ) = ?", "answer": combined,
                "distractors": pick_others(rng, all_forms, combined), "hint": f"{v} ला '{name}' जोडा."}
    if diff == "Medium":
        return {"text": f"'{combined}' मध्ये कोणती मात्रा आहे?", "answer": name,
                "distractors": pick_others(rng, [n for _, n, _ in M.MATRAS], name),
                "hint": f"'{combined}' मोठ्याने म्हणा."}
    return {"text": f"{v} + {vowel} = ?", "answer": combined,
            "distractors": pick_others(rng, all_forms, combined), "hint": f"{v} चा उच्चार '{vowel}' सोबत करा."}


def g_picture_word(rng, diff, pool):
    word, emoji = rng.choice(pool)
    words = [w for w, _ in pool]
    if diff == "Hard":
        return {"text": f"{emoji} या चित्राचे नाव लिहा.", "answer": word, "qtype": SA,
                "hint": f"पहिले अक्षर: {word[0]}"}
    return {"text": f"{emoji} हे काय आहे?", "answer": word, "distractors": pick_others(rng, words, word),
            "hint": f"पहिले अक्षर: {word[0]}"}


def g_ank_identify(rng, diff, low=1, high=10):
    n = rng.randint(low, high)
    md = M.to_marathi_digits(n)
    names = [M.NUMBER_NAMES[k] for k in range(low, high + 1)]
    if diff == "Hard":
        return {"text": f"'{M.NUMBER_NAMES[n]}' ही संख्या अंकात लिहा.", "answer": md, "qtype": SA,
                "hint": "मराठी किंवा इंग्रजी अंक लिहू शकता."}
    if diff == "Medium":
        return {"text": f"'{M.NUMBER_NAMES[n]}' हे संख्यानाम कोणत्या अंकाचे आहे?", "answer": md,
                "distractors": [M.to_marathi_digits(k) for k in pick_others(rng, list(range(low, high + 1)), n)],
                "hint": "बोटांवर मोजा."}
    return {"text": f"'{md}' हा अंक वाचा. याचे नाव काय?", "answer": M.NUMBER_NAMES[n],
            "distractors": pick_others(rng, names, M.NUMBER_NAMES[n]), "hint": "एक, दोन, तीन… मोजा."}


def g_ank_count(rng, diff):
    n = rng.randint(*{"Easy": (1, 5), "Medium": (4, 8), "Hard": (6, 10)}[diff])
    word, emoji = rng.choice(M.FRUITS[:5] + M.ANIMALS[:6])
    md = M.to_marathi_digits(n)
    return {"text": f"मोजा: {emoji * n}  किती आहेत?", "answer": md,
            "distractors": [M.to_marathi_digits(k) for k in pick_others(rng, [x for x in range(1, 11) if abs(x - n) <= 3], n)],
            "hint": "प्रत्येक चित्राला बोट लावून मोजा."}


def g_family(rng, diff):
    q, a = rng.choice(M.FAMILY)
    spec = {"text": q, "answer": a, "hint": "घरातील नाती आठवा."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = pick_others(rng, M.FAMILY_WORDS, a)
    return spec


def g_days(rng, diff):
    i = rng.randrange(7)
    if diff == "Easy":
        return {"text": f"{M.DAYS[i]} नंतर कोणता वार येतो?", "answer": M.DAYS[(i + 1) % 7],
                "distractors": pick_others(rng, M.DAYS, M.DAYS[(i + 1) % 7]), "hint": "वार क्रमाने म्हणा."}
    if diff == "Medium":
        return {"text": f"{M.DAYS[i]} च्या आधी कोणता वार येतो?", "answer": M.DAYS[(i - 1) % 7],
                "distractors": pick_others(rng, M.DAYS, M.DAYS[(i - 1) % 7]), "hint": "एक दिवस मागे जा."}
    return rng.choice([
        {"text": "आठवड्यात एकूण किती वार असतात?", "answer": "७", "qtype": SA, "hint": "रविवार ते शनिवार."},
        {"text": f"आज {M.DAYS[i]} आहे. परवा कोणता वार असेल?", "answer": M.DAYS[(i + 2) % 7],
         "distractors": pick_others(rng, M.DAYS, M.DAYS[(i + 2) % 7]), "hint": "दोन दिवस पुढे मोजा."},
    ])


def g_conjunct(rng, diff):
    parts, conj, word = rng.choice(M.CONJUNCTS)
    conjs = [c for _, c, _ in M.CONJUNCTS]
    if diff == "Easy":
        return {"text": f"{parts} = ?", "answer": conj, "distractors": pick_others(rng, conjs, conj),
                "hint": "पहिले अक्षर अर्धे लिहा."}
    if diff == "Medium":
        return {"text": f"'{word}' या शब्दातील जोडाक्षर कोणते?", "answer": conj,
                "distractors": pick_others(rng, conjs, conj), "hint": "अर्धे अक्षर शोधा."}
    return {"text": f"{parts} = ? (जोडाक्षर लिहा)", "answer": conj, "qtype": SA, "hint": "पहिले अक्षर अर्धे."}


def g_pair(rng, diff, pairs, ask, ask_hard, hint):
    a, b = rng.choice(pairs)
    if rng.random() < 0.5:
        a, b = b, a
    pool = [x for p in pairs for x in p]
    if diff == "Hard":
        return {"text": ask_hard.format(a), "answer": b, "qtype": SA, "hint": hint}
    return {"text": ask.format(a), "answer": b, "distractors": pick_others(rng, [p for p in pool if p != a], b),
            "hint": hint}


def g_plural(rng, diff):
    one, many = rng.choice(M.PLURALS)
    pool = [p for _, p in M.PLURALS] + [s for s, _ in M.PLURALS]
    if diff == "Medium":
        return {"text": f"'{many}' चे एकवचन कोणते?", "answer": one,
                "distractors": pick_others(rng, [s for s, _ in M.PLURALS], one), "hint": "एकच वस्तू असेल तर…"}
    spec = {"text": f"'{one}' चे अनेकवचन कोणते?", "answer": many, "hint": "अनेक वस्तू असतील तर…"}
    if diff == "Hard":
        spec["text"] = f"'{one}' चे अनेकवचन लिहा."
        spec["qtype"] = SA
    else:
        spec["distractors"] = pick_others(rng, [p for p in pool if p != one], many)
    return spec


def g_months(rng, diff):
    i = rng.randrange(12)
    if diff == "Easy":
        return {"text": f"{M.MONTHS[i]} नंतर कोणता महिना येतो?", "answer": M.MONTHS[(i + 1) % 12],
                "distractors": pick_others(rng, M.MONTHS, M.MONTHS[(i + 1) % 12]), "hint": "महिने क्रमाने म्हणा."}
    if diff == "Medium":
        return {"text": f"{M.MONTHS[i]} च्या आधी कोणता महिना येतो?", "answer": M.MONTHS[(i - 1) % 12],
                "distractors": pick_others(rng, M.MONTHS, M.MONTHS[(i - 1) % 12]), "hint": "एक महिना मागे जा."}
    return rng.choice([
        {"text": "मराठी वर्षाचा पहिला महिना कोणता?", "answer": "चैत्र",
         "distractors": ["फाल्गुन", "श्रावण", "कार्तिक"], "hint": "गुढीपाडवा याच महिन्यात येतो."},
        {"text": "मराठी वर्षात एकूण किती महिने असतात?", "answer": "१२", "qtype": SA, "hint": "चैत्र ते फाल्गुन."},
        {"text": "मराठी वर्षाचा शेवटचा महिना कोणता?", "answer": "फाल्गुन",
         "distractors": ["चैत्र", "माघ", "पौष"], "hint": "होळी याच महिन्यात येते."},
    ])


def g_names_21_30(rng, diff):
    n = rng.randint(21, 30)
    names = [M.NUMBER_NAMES[k] for k in range(21, 31)]
    if diff == "Hard":
        return {"text": f"'{M.NUMBER_NAMES[n]}' ही संख्या अंकात लिहा.", "answer": M.to_marathi_digits(n),
                "qtype": SA, "hint": "वीस आणि काही."}
    if diff == "Medium":
        return {"text": f"'{M.NUMBER_NAMES[n]}' म्हणजे कोणती संख्या?", "answer": M.to_marathi_digits(n),
                "distractors": [M.to_marathi_digits(k) for k in pick_others(rng, list(range(21, 31)), n)],
                "hint": "वीस आणि काही."}
    return {"text": f"'{M.to_marathi_digits(n)}' चे संख्यानाम कोणते?", "answer": M.NUMBER_NAMES[n],
            "distractors": pick_others(rng, names, M.NUMBER_NAMES[n]), "hint": "वीसच्या पुढे मोजा."}


def g_tens_names(rng, diff):
    n = rng.choice([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    names = [M.NUMBER_NAMES[k] for k in (10, 20, 30, 40, 50, 60, 70, 80, 90, 100)]
    if diff == "Hard":
        return {"text": f"'{M.NUMBER_NAMES[n]}' ही संख्या अंकात लिहा.", "answer": M.to_marathi_digits(n),
                "qtype": SA, "hint": "दशकात मोजा."}
    if diff == "Medium":
        return {"text": f"'{M.NUMBER_NAMES[n]}' म्हणजे कोणती संख्या?", "answer": M.to_marathi_digits(n),
                "distractors": [M.to_marathi_digits(k) for k in pick_others(rng, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], n)],
                "hint": "दहा, वीस, तीस…"}
    return {"text": f"'{M.to_marathi_digits(n)}' चे संख्यानाम कोणते?", "answer": M.NUMBER_NAMES[n],
            "distractors": pick_others(rng, names, M.NUMBER_NAMES[n]), "hint": "दहा, वीस, तीस…"}


def bank_sentences():
    out = []
    for i, (text, ans, others) in enumerate(M.SENTENCES):
        diff = ("Easy", "Medium", "Hard")[min(i // 3, 2)]
        out.append((diff, f"वाक्य पूर्ण करा: {text}", ans, others, "वाक्य मोठ्याने वाचा."))
    return out


def build():
    lessons, concepts, questions = [], [], []

    def chapter(lid, cls, no, name_mr, name_en, desc, concept_specs):
        lessons.append(lesson(lid, cls, SUBJECT, no, name_mr, name_en, desc))
        for idx, (name_c, obj, diff, source) in enumerate(concept_specs, start=1):
            cid = f"{lid}_C{idx}"
            concepts.append(concept(cid, lid, name_c, obj, diff))
            b = ConceptBuilder(cid)
            if callable(source):
                b.fill(source)
            else:
                b.from_bank(source)
            questions.extend(b.questions)

    first_letters = list(M.LETTER_WORDS)

    # ---------- Std 1 ----------
    chapter("MR1.1", 1, 1, "स्वर", "Vowels", "अ ते अः स्वरांची ओळख व क्रम.", [
        ("स्वर ओळख", "स्वर व व्यंजन यांतील फरक ओळखणे", "Easy", g_swar_identify),
        ("स्वरांचा क्रम", "स्वरमालेचा क्रम सांगणे", "Easy", g_swar_order),
        ("स्वरापासून शब्द", "स्वराने सुरू होणारे शब्द ओळखणे", "Medium",
         lambda r, d: g_letter_word(r, d, [l for l in first_letters if l in M.SWAR])),
    ])
    chapter("MR1.2", 1, 2, "व्यंजने", "Consonants", "क ते ज्ञ व्यंजनांची ओळख.", [
        ("व्यंजनांचा क्रम (क ते न)", "क ते न व्यंजनांचा क्रम", "Easy",
         lambda r, d: g_vyanjan_order(r, d, M.VYANJAN_GROUPS[:4])),
        ("व्यंजनांचा क्रम (प ते ळ)", "प ते ळ व्यंजनांचा क्रम", "Medium",
         lambda r, d: g_vyanjan_order(r, d, M.VYANJAN_GROUPS[4:])),
        ("अक्षरावरून शब्द", "व्यंजनाने सुरू होणारे शब्द ओळखणे", "Easy",
         lambda r, d: g_letter_word(r, d, [l for l in first_letters if l in M.VYANJAN])),
    ])
    chapter("MR1.3", 1, 3, "बाराखडी", "Barakhadi", "व्यंजनांना मात्रा जोडून अक्षरे तयार करणे.", [
        ("काना व वेलांटी", "ा, ि, ी मात्रा जोडणे", "Easy", lambda r, d: g_barakhadi(r, d, slice(0, 3))),
        ("उकार व मात्रा", "ु, ू, े, ै मात्रा जोडणे", "Medium", lambda r, d: g_barakhadi(r, d, slice(3, 7))),
        ("काना-मात्रा व अनुस्वार", "ो, ौ, ं, ः जोडणे", "Medium", lambda r, d: g_barakhadi(r, d, slice(7, 11))),
    ])
    chapter("MR1.4", 1, 4, "शब्द वाचन", "Reading Words", "चित्र पाहून सोपे शब्द वाचणे.", [
        ("बिनमात्रांचे शब्द", "मात्रा नसलेले शब्द वाचणे", "Easy", lambda r, d: g_picture_word(r, d, M.SIMPLE_WORDS)),
        ("मात्रांचे शब्द", "मात्रा असलेले शब्द वाचणे", "Medium", lambda r, d: g_picture_word(r, d, M.MATRA_WORDS)),
    ])
    chapter("MR1.5", 1, 5, "अंक व संख्यानाम", "Numbers 1-20", "मराठी अंक १ ते २० आणि संख्यानामे.", [
        ("अंक ओळख (१ ते १०)", "मराठी अंक वाचणे", "Easy", lambda r, d: g_ank_identify(r, d, 1, 10)),
        ("संख्यानाम (११ ते २०)", "संख्यानामे व अंक जुळवणे", "Medium", lambda r, d: g_ank_identify(r, d, 11, 20)),
        ("मोजणी", "चित्रे मोजून संख्या सांगणे", "Easy", g_ank_count),
    ])
    chapter("MR1.6", 1, 6, "शब्दसंग्रह", "Vocabulary", "रंग, फळे आणि प्राणी-पक्षी यांची नावे.", [
        ("रंग", "रंगांची नावे ओळखणे", "Easy", lambda r, d: g_picture_word(r, d, M.COLORS)),
        ("फळे", "फळांची नावे ओळखणे", "Easy", lambda r, d: g_picture_word(r, d, M.FRUITS)),
        ("प्राणी व पक्षी", "प्राणी-पक्ष्यांची नावे ओळखणे", "Easy", lambda r, d: g_picture_word(r, d, M.ANIMALS)),
    ])
    chapter("MR1.7", 1, 7, "मी व माझे कुटुंब", "Me and My Family", "कुटुंबातील नाती आणि शरीराचे अवयव.", [
        ("कुटुंबातील नाती", "नात्यांची नावे सांगणे", "Medium", g_family),
        ("शरीराचे अवयव", "अवयवांची नावे ओळखणे", "Easy", lambda r, d: g_picture_word(r, d, M.BODY_PARTS)),
    ])
    chapter("MR1.8", 1, 8, "आठवड्याचे वार", "Days of the Week", "सात वारांची नावे व क्रम.", [
        ("वारांचा क्रम", "वार क्रमाने सांगणे", "Easy", g_days),
    ])

    # ---------- Std 2 ----------
    chapter("MR2.1", 2, 1, "जोडाक्षरे", "Conjunct Letters", "क्ष, ज्ञ, त्र, श्र यांसारखी जोडाक्षरे.", [
        ("जोडाक्षरे", "जोडाक्षरे तयार करणे व ओळखणे", "Medium", g_conjunct),
    ])
    chapter("MR2.2", 2, 2, "विरुद्धार्थी शब्द", "Opposites", "उलट अर्थाचे शब्द.", [
        ("विरुद्धार्थी शब्द", "विरुद्ध अर्थाचे शब्द सांगणे", "Easy",
         lambda r, d: g_pair(r, d, M.OPPOSITES, "'{}' या शब्दाचा विरुद्धार्थी शब्द कोणता?",
                             "'{}' या शब्दाचा विरुद्धार्थी शब्द लिहा.", "उलट अर्थ विचार करा.")),
    ])
    chapter("MR2.3", 2, 3, "समानार्थी शब्द", "Synonyms", "सारख्या अर्थाचे शब्द.", [
        ("समानार्थी शब्द", "समान अर्थाचे शब्द सांगणे", "Medium",
         lambda r, d: g_pair(r, d, M.SYNONYMS, "'{}' या शब्दाचा समानार्थी शब्द कोणता?",
                             "'{}' या शब्दाचा समानार्थी शब्द लिहा.", "त्याच अर्थाचा दुसरा शब्द.")),
    ])
    chapter("MR2.4", 2, 4, "एकवचन-अनेकवचन", "Singular and Plural", "एक आणि अनेक वस्तूंसाठी शब्द.", [
        ("वचन बदला", "एकवचन व अनेकवचन ओळखणे", "Medium", g_plural),
    ])
    chapter("MR2.5", 2, 5, "मराठी महिने", "Marathi Months", "चैत्र ते फाल्गुन बारा महिने.", [
        ("महिन्यांचा क्रम", "मराठी महिने क्रमाने सांगणे", "Medium", g_months),
    ])
    chapter("MR2.6", 2, 6, "संख्यानाम २१ ते १००", "Number Names 21-100", "२१ ते ३० संख्यानामे आणि दशक.", [
        ("संख्यानाम (२१ ते ३०)", "२१ ते ३० संख्यानामे", "Medium", g_names_21_30),
        ("दशक", "दहा, वीस … शंभर", "Easy", g_tens_names),
    ])
    chapter("MR2.7", 2, 7, "वाक्य पूर्ण करा", "Complete the Sentence", "योग्य शब्द वापरून वाक्य पूर्ण करणे.", [
        ("वाक्यपूर्ती", "वाक्यात योग्य शब्द भरणे", "Medium", bank_sentences()),
    ])

    return lessons, concepts, questions
