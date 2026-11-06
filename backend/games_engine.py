"""Server-side educational game engine (Mathematics and Marathi).

Every game has 5 levels with rising difficulty. The server generates the
challenges, keeps the answers private, checks each answer, scores the round,
awards stars/coins/badges and unlocks the next level when a round earns at
least 2 stars.
"""
import json
import random
import uuid

from content import marathi_data as M
from database import execute_commit, fetch_dict, fetch_dicts, fetch_one, get_connection, now_utc
from game_progress import save_game_attempt

LEVELS = 5
CHALLENGES_PER_LEVEL = 8
MAX_TRIES = 3
POINTS_BY_TRY = {1: 100, 2: 75, 3: 50}
UNLOCK_STARS = 2
TIME_LIMITS = {1: 150, 2: 135, 3: 120, 4: 105, 5: 90}
OBJECTS = ["🍎", "⭐", "🎈", "🐟", "🌸", "🚗", "🍌", "⚽", "🐥", "🦋"]


class GameError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def stars_for(score):
    return 3 if score >= 80 else (2 if score >= 50 else 1)


def option_count(level):
    return 3 if level <= 2 else 4


def _options(rng, answer, pool, level):
    answer = str(answer)
    others = []
    for p in pool:
        p = str(p)
        if p != answer and p not in others:
            others.append(p)
    rng.shuffle(others)
    opts = [answer] + others[: option_count(level) - 1]
    rng.shuffle(opts)
    return opts


def _near(rng, n, low=0, spread=3):
    vals = [n + d for d in range(-spread, spread + 1) if d != 0 and n + d >= low]
    rng.shuffle(vals)
    return vals


# =====================================================================
# Mathematics generators: (rng, level) -> challenge dict
# =====================================================================

def gen_count(rng, level):
    lo, hi = [(1, 5), (1, 9), (5, 12), (10, 16), (12, 20)][level - 1]
    n = rng.randint(lo, hi)
    emoji = rng.choice(OBJECTS)
    return {"prompt": "How many can you count?", "prompt_local": "किती आहेत? मोजा.",
            "display": {"type": "emoji_grid", "emoji": emoji, "count": n},
            "answer": str(n), "options": _options(rng, n, _near(rng, n, 1), level),
            "hint": "Touch each picture once while counting."}


def gen_addition(rng, level):
    if level == 1:
        a = rng.randint(0, 4); b = rng.randint(1, 5 - a)
    elif level == 2:
        a = rng.randint(1, 8); b = rng.randint(1, 9 - a)
    elif level == 3:
        a = rng.randint(5, 15); b = rng.randint(2, 20 - a)
    elif level == 4:
        while True:
            a, b = rng.randint(10, 60), rng.randint(10, 39)
            if (a % 10) + (b % 10) < 10 and a + b < 100:
                break
    else:
        while True:
            a, b = rng.randint(15, 70), rng.randint(15, 29)
            if (a % 10) + (b % 10) >= 10 and a + b < 100:
                break
    s = a + b
    pool = _near(rng, s, 0) + ([s + 10, s - 10] if level >= 4 else [])
    return {"prompt": "Solve the sum", "prompt_local": "बेरीज करा",
            "display": {"type": "big_text", "text": f"{a} + {b} = ?"},
            "answer": str(s), "options": _options(rng, s, pool, level),
            "hint": "Add the ones first, then the tens." if level >= 4 else f"Start at {a} and count on {b}."}


def gen_subtraction(rng, level):
    if level == 1:
        a = rng.randint(2, 5); b = rng.randint(0, a)
    elif level == 2:
        a = rng.randint(4, 9); b = rng.randint(1, a)
    elif level == 3:
        a = rng.randint(11, 20); b = rng.randint(1, a - 1)
    elif level == 4:
        while True:
            a, b = rng.randint(30, 99), rng.randint(10, 29)
            if (a % 10) >= (b % 10):
                break
    else:
        while True:
            a, b = rng.randint(30, 99), rng.randint(11, 29)
            if (a % 10) < (b % 10):
                break
    d = a - b
    pool = _near(rng, d, 0) + ([d + 10] if level >= 4 else [])
    return {"prompt": "Take away", "prompt_local": "वजाबाकी करा",
            "display": {"type": "big_text", "text": f"{a} − {b} = ?"},
            "answer": str(d), "options": _options(rng, d, pool, level),
            "hint": "Borrow 1 ten if the ones are too small." if level == 5 else f"Start at {a} and count back {b}."}


def gen_compare(rng, level):
    if level == 5:
        a, b = rng.randint(1, 9), rng.randint(1, 9)
        left_val, left = a + b, f"{a} + {b}"
        right_val = rng.choice([left_val, left_val + rng.choice([-2, -1, 1, 2])])
        right = str(right_val)
    else:
        hi = [9, 20, 50, 99][level - 1]
        left_val = rng.randint(0, hi)
        right_val = left_val if rng.random() < 0.15 else rng.randint(0, hi)
        left, right = str(left_val), str(right_val)
    sign = ">" if left_val > right_val else "<" if left_val < right_val else "="
    return {"prompt": "Which sign fits? The crocodile eats the bigger number!",
            "prompt_local": "योग्य चिन्ह निवडा",
            "display": {"type": "compare", "left": left, "right": right},
            "answer": sign, "options": [">", "<", "="],
            "hint": "> means 'is bigger than', < means 'is smaller than'."}


def gen_missing(rng, level):
    step, backwards = [(1, False), (1, True), (2, False), (rng.choice([5, 10]), False), (rng.choice([2, 3, 4, 5]), rng.random() < 0.5)][level - 1]
    start = rng.randint(1, 20 if step < 5 else 5) * (step if step >= 5 else 1)
    seq = [start + step * i for i in range(5)]
    if backwards:
        seq = seq[::-1]
    hole = rng.randint(1, 4)
    answer = seq[hole]
    items = [str(x) for x in seq]
    items[hole] = "?"
    pool = [answer + step, answer - step, answer + 1, answer - 1]
    return {"prompt": "Help the frog hop! Which number is missing?", "prompt_local": "गाळलेली संख्या कोणती?",
            "display": {"type": "sequence", "items": items},
            "answer": str(answer), "options": _options(rng, answer, [p for p in pool if p >= 0], level),
            "hint": f"The numbers {'go down' if backwards else 'go up'} by {step}."}


def gen_tables(rng, level):
    tables = [[2], [2, 10], [3, 5], [2, 3, 4, 5], [2, 3, 4, 5, 6, 10]][level - 1]
    t = rng.choice(tables)
    k = rng.randint(1, 10)
    p = t * k
    pool = [t * (k + 1), t * (k - 1) if k > 1 else t + 2, p + 1, p - 1, p + t + 1]
    return {"prompt": "Build the tower: multiply!", "prompt_local": "गुणाकार करा",
            "display": {"type": "big_text", "text": f"{t} × {k} = ?"},
            "answer": str(p), "options": _options(rng, p, [x for x in pool if x > 0], level),
            "hint": f"Count in {t}s, {k} times."}


# =====================================================================
# Marathi generators
# =====================================================================

def _pick(rng, pool, answer, k=6):
    others = [p for p in pool if p != answer]
    rng.shuffle(others)
    return others[:k]


def gen_swar(rng, level):
    if level == 1:
        s = rng.choice(M.SWAR[:6])
        return {"prompt": "Find the vowel (स्वर)", "prompt_local": "स्वर ओळखा",
                "display": {"type": "big_text", "text": "स्वर कोणता?"}, "answer": s,
                "options": _options(rng, s, rng.sample(M.VYANJAN[:20], 4), level), "hint": "अ, आ, इ, ई, उ, ऊ…"}
    if level in (2, 3):
        seq = rng.choice(M.SWAR_SEQUENCES)
        i = rng.randrange(1, len(seq) - 1)
        nxt = level == 2
        answer = seq[i + 1] if nxt else seq[i - 1]
        return {"prompt": "Which vowel comes " + ("next?" if nxt else "before?"),
                "prompt_local": f"'{seq[i]}' " + ("नंतर कोणता स्वर?" if nxt else "च्या आधी कोणता स्वर?"),
                "display": {"type": "big_text", "text": f"{seq[i]} → ?" if nxt else f"? → {seq[i]}"},
                "answer": answer, "options": _options(rng, answer, _pick(rng, M.SWAR, answer), level),
                "hint": "स्वरमाला क्रमाने म्हणा."}
    vowels = [l for l in M.LETTER_WORDS if l in M.SWAR]
    letter = rng.choice(vowels)
    word, emoji = M.LETTER_WORDS[letter]
    if level == 4:
        return {"prompt": "Which letter does this picture's name start with?",
                "prompt_local": "चित्राचे नाव कोणत्या स्वराने सुरू होते?",
                "display": {"type": "emoji", "emoji": emoji}, "answer": letter,
                "options": _options(rng, letter, _pick(rng, M.SWAR, letter), level), "hint": f"{word[0]}…"}
    pool = [w for l, (w, _) in M.LETTER_WORDS.items() if l != letter]
    return {"prompt": f"Which word starts with '{letter}'?", "prompt_local": f"'{letter}' ने सुरू होणारा शब्द",
            "display": {"type": "big_text", "text": letter}, "answer": word,
            "options": _options(rng, word, _pick(rng, pool, word), level), "hint": f"{emoji} आठवा."}


def gen_vyanjan(rng, level):
    if level <= 3:
        groups = M.VYANJAN_GROUPS[:3] if level == 1 else M.VYANJAN_GROUPS[3:] if level == 2 else M.VYANJAN_GROUPS
        group = rng.choice(groups)
        i = rng.randrange(len(group) - 1)
        answer = group[i + 1]
        pool = [v for g in groups for v in g]
        return {"prompt": "Which consonant comes next on the train?",
                "prompt_local": f"'{group[i]}' नंतर कोणते व्यंजन?",
                "display": {"type": "sequence", "items": group[: i + 1] + ["?"]}, "answer": answer,
                "options": _options(rng, answer, _pick(rng, pool, answer), level), "hint": "व्यंजनमाला क्रमाने म्हणा."}
    consonants = [l for l in M.LETTER_WORDS if l in M.VYANJAN and M.LETTER_WORDS[l][1]]
    letter = rng.choice(consonants)
    word, emoji = M.LETTER_WORDS[letter]
    if level == 4:
        return {"prompt": "Which letter does this picture's name start with?",
                "prompt_local": "चित्राचे नाव कोणत्या अक्षराने सुरू होते?",
                "display": {"type": "emoji", "emoji": emoji}, "answer": letter,
                "options": _options(rng, letter, _pick(rng, consonants, letter), level), "hint": f"{word[0]}…"}
    pool = [M.LETTER_WORDS[l][0] for l in consonants if l != letter]
    return {"prompt": f"Which word starts with '{letter}'?", "prompt_local": f"'{letter}' ने सुरू होणारा शब्द",
            "display": {"type": "big_text", "text": letter}, "answer": word,
            "options": _options(rng, word, _pick(rng, pool, word), level), "hint": f"{emoji} आठवा."}


def gen_barakhadi(rng, level):
    slices = [slice(0, 3), slice(3, 5), slice(5, 7), slice(7, 11), slice(0, 11)]
    matras = M.MATRAS[slices[level - 1]]
    v = rng.choice(M.COMMON_VYANJAN)
    sign, name, vowel = rng.choice(matras)
    combined = v + sign
    forms = [v + s for s, _, _ in M.MATRAS] + [v]
    if level == 5 and rng.random() < 0.5:
        return {"prompt": "Which vowel sign (मात्रा) is used?", "prompt_local": f"'{combined}' मध्ये कोणती मात्रा?",
                "display": {"type": "big_text", "text": combined}, "answer": name,
                "options": _options(rng, name, _pick(rng, [n for _, n, _ in M.MATRAS], name), level),
                "hint": "अक्षर मोठ्याने म्हणा."}
    return {"prompt": "Join the letter and the vowel sign", "prompt_local": f"{v} + {vowel} = ?",
            "display": {"type": "big_text", "text": f"{v} + {sign} = ?"}, "answer": combined,
            "options": _options(rng, combined, _pick(rng, forms, combined), level),
            "hint": f"{v} ला '{name}' जोडा."}


def gen_shabd_chitra(rng, level):
    pools = [M.ANIMALS, M.FRUITS, M.COLORS, M.BODY_PARTS + M.SIMPLE_WORDS,
             M.ANIMALS + M.FRUITS + M.MATRA_WORDS]
    pool = pools[level - 1]
    word, emoji = rng.choice(pool)
    words = list(dict.fromkeys(w for w, _ in pool))
    return {"prompt": "What is this called in Marathi?", "prompt_local": "हे काय आहे?",
            "display": {"type": "emoji", "emoji": emoji}, "answer": word,
            "options": _options(rng, word, _pick(rng, words, word), level), "hint": f"पहिले अक्षर: {word[0]}"}


def gen_ank(rng, level):
    if level == 1:
        n = rng.randint(1, 5)
        emoji = rng.choice(OBJECTS)
        md = M.to_marathi_digits(n)
        return {"prompt": "Count and pick the Marathi numeral", "prompt_local": "मोजा आणि अंक निवडा",
                "display": {"type": "emoji_grid", "emoji": emoji, "count": n}, "answer": md,
                "options": _options(rng, md, [M.to_marathi_digits(k) for k in range(1, 8) if k != n], level),
                "hint": "प्रत्येक चित्र मोजा."}
    ranges = {2: (1, 10), 3: (11, 20), 4: (21, 30)}
    if level in ranges:
        lo, hi = ranges[level]
        n = rng.randint(lo, hi)
    else:
        n = rng.choice([10, 20, 30, 40, 50, 60, 70, 80, 90, 100] + list(range(11, 31)))
    md, name = M.to_marathi_digits(n), M.NUMBER_NAMES[n]
    known = [k for k in M.NUMBER_NAMES if k > 0]
    near = sorted(known, key=lambda k: abs(k - n))[1:7]
    if rng.random() < 0.5:
        return {"prompt": "Which number name matches?", "prompt_local": f"'{md}' चे संख्यानाम",
                "display": {"type": "big_text", "text": md}, "answer": name,
                "options": _options(rng, name, [M.NUMBER_NAMES[k] for k in near], level), "hint": "मोठ्याने मोजा."}
    return {"prompt": "Which numeral matches the name?", "prompt_local": f"'{name}' म्हणजे कोणता अंक?",
            "display": {"type": "big_text", "text": name}, "answer": md,
            "options": _options(rng, md, [M.to_marathi_digits(k) for k in near], level), "hint": "मोठ्याने मोजा."}


def gen_shabd_khel(rng, level):
    kind = level if level <= 4 else rng.choice([1, 2, 3, 4, 5])
    if kind in (1, 2):
        pairs = M.OPPOSITES if kind == 1 else M.SYNONYMS
        a, b = rng.choice(pairs)
        if rng.random() < 0.5:
            a, b = b, a
        pool = [x for p in pairs for x in p if x not in (a, b)]
        label = "विरुद्धार्थी" if kind == 1 else "समानार्थी"
        return {"prompt": "Find the " + ("opposite" if kind == 1 else "word with the same meaning"),
                "prompt_local": f"'{a}' चा {label} शब्द", "display": {"type": "big_text", "text": a},
                "answer": b, "options": _options(rng, b, _pick(rng, pool, b), level), "hint": f"{label} शब्द आठवा."}
    if kind == 3:
        one, many = rng.choice(M.PLURALS)
        pool = [p for _, p in M.PLURALS if p != many]
        return {"prompt": "Make it plural (many)", "prompt_local": f"'{one}' चे अनेकवचन",
                "display": {"type": "big_text", "text": one}, "answer": many,
                "options": _options(rng, many, _pick(rng, pool, many), level), "hint": "अनेक वस्तू असतील तर…"}
    if kind == 4:
        text, ans, others = rng.choice(M.SENTENCES)
        return {"prompt": "Complete the sentence", "prompt_local": "वाक्य पूर्ण करा",
                "display": {"type": "big_text", "text": text}, "answer": ans,
                "options": _options(rng, ans, others, level), "hint": "वाक्य मोठ्याने वाचा."}
    parts, conj, word = rng.choice(M.CONJUNCTS)
    pool = [c for _, c, _ in M.CONJUNCTS if c != conj]
    return {"prompt": "Make the conjunct letter", "prompt_local": "जोडाक्षर तयार करा",
            "display": {"type": "big_text", "text": f"{parts} = ?"}, "answer": conj,
            "options": _options(rng, conj, _pick(rng, pool, conj), level), "hint": f"उदा. {word}"}


# =====================================================================
# Catalog
# =====================================================================

GAMES = [
    {"game_id": "math_count_tap", "subject": "Mathematics", "title": "Count & Tap", "title_local": "मोजा आणि टॅप करा",
     "icon": "🍎", "color": "#FF6B6B", "student_class": 1, "lesson_id": "M1.2",
     "description": "Count the pictures and tap the right number.", "skill": "Counting 1–20", "generator": gen_count},
    {"game_id": "math_addition_express", "subject": "Mathematics", "title": "Addition Express",
     "title_local": "बेरीज एक्सप्रेस", "icon": "🚂", "color": "#4CC9F0", "student_class": 1, "lesson_id": "M1.4",
     "description": "Solve sums to keep the train moving.", "skill": "Addition up to 99", "generator": gen_addition},
    {"game_id": "math_subtraction_safari", "subject": "Mathematics", "title": "Subtraction Safari",
     "title_local": "वजाबाकी सफारी", "icon": "🦁", "color": "#FF9234", "student_class": 1, "lesson_id": "M1.5",
     "description": "Take away and find what's left on safari.", "skill": "Subtraction up to 99",
     "generator": gen_subtraction},
    {"game_id": "math_compare_croc", "subject": "Mathematics", "title": "Crocodile Compare",
     "title_local": "मगरीची तुलना", "icon": "🐊", "color": "#06D6A0", "student_class": 1, "lesson_id": "M1.7",
     "description": "Choose >, < or = — the crocodile eats the bigger number.", "skill": "Comparing numbers",
     "generator": gen_compare},
    {"game_id": "math_number_hop", "subject": "Mathematics", "title": "Number Line Hop",
     "title_local": "संख्या उडी", "icon": "🐸", "color": "#6C5CE7", "student_class": 1, "lesson_id": "M1.9",
     "description": "Find the missing number in the pattern.", "skill": "Number patterns & skip counting",
     "generator": gen_missing},
    {"game_id": "math_tables_tower", "subject": "Mathematics", "title": "Times Table Tower",
     "title_local": "पाढे मनोरा", "icon": "🏰", "color": "#F59E0B", "student_class": 2, "lesson_id": "M2.5",
     "description": "Multiply to build the tallest tower.", "skill": "Tables of 2–10", "generator": gen_tables},
    {"game_id": "mr_swar_pari", "subject": "Marathi", "title": "स्वर परी", "title_local": "Vowel Fairy",
     "icon": "🧚", "color": "#C084FC", "student_class": 1, "lesson_id": "MR1.1",
     "description": "स्वर ओळखा आणि क्रम लावा.", "skill": "स्वर (अ ते अः)", "generator": gen_swar},
    {"game_id": "mr_vyanjan_train", "subject": "Marathi", "title": "व्यंजन रेल्वे", "title_local": "Consonant Train",
     "icon": "🚃", "color": "#4CC9F0", "student_class": 1, "lesson_id": "MR1.2",
     "description": "व्यंजनांचे डबे योग्य क्रमाने जोडा.", "skill": "व्यंजने (क ते ज्ञ)", "generator": gen_vyanjan},
    {"game_id": "mr_barakhadi_bazaar", "subject": "Marathi", "title": "बाराखडी बाजार",
     "title_local": "Barakhadi Bazaar", "icon": "🛍️", "color": "#FF9234", "student_class": 1, "lesson_id": "MR1.3",
     "description": "व्यंजन आणि मात्रा जोडून अक्षर तयार करा.", "skill": "बाराखडी", "generator": gen_barakhadi},
    {"game_id": "mr_shabd_chitra", "subject": "Marathi", "title": "शब्द-चित्र जोडी",
     "title_local": "Word & Picture Match", "icon": "🖼️", "color": "#06D6A0", "student_class": 1,
     "lesson_id": "MR1.6", "description": "चित्र पाहा आणि योग्य मराठी शब्द निवडा.", "skill": "शब्दसंग्रह",
     "generator": gen_shabd_chitra},
    {"game_id": "mr_ank_mela", "subject": "Marathi", "title": "अंक मेळा", "title_local": "Number Fair",
     "icon": "🎡", "color": "#FF6B6B", "student_class": 1, "lesson_id": "MR1.5",
     "description": "मराठी अंक आणि संख्यानामे जुळवा.", "skill": "अंक व संख्यानाम", "generator": gen_ank},
    {"game_id": "mr_shabd_khel", "subject": "Marathi", "title": "शब्दांचा खेळ", "title_local": "Word Play",
     "icon": "🧩", "color": "#6C5CE7", "student_class": 2, "lesson_id": "MR2.2",
     "description": "विरुद्धार्थी, समानार्थी, वचन आणि जोडाक्षरे.", "skill": "शब्दज्ञान", "generator": gen_shabd_khel},
]
GAMES_BY_ID = {g["game_id"]: g for g in GAMES}

BADGES = {
    "first_game": {"title": "First Game!", "icon": "🎉", "description": "Finished your first game round."},
    "perfect_score": {"title": "Perfect 100", "icon": "💯", "description": "Scored 100 in a game round."},
    "level_master": {"title": "Level Master", "icon": "🏆", "description": "Cleared level 5 of a game."},
    "math_explorer": {"title": "Maths Explorer", "icon": "🔢", "description": "Played every Maths game."},
    "marathi_explorer": {"title": "मराठी शोधक", "icon": "🪔", "description": "Played every Marathi game."},
    "star_collector": {"title": "Star Collector", "icon": "🌟", "description": "Collected 25 game stars."},
}


def public_game(game):
    return {k: v for k, v in game.items() if k != "generator"}


# =====================================================================
# Progress
# =====================================================================

def level_progress(student_id, game_id):
    rows = fetch_dicts("SELECT level, best_score, stars, plays FROM game_progress WHERE student_id = ? AND game_id = ?",
                       (student_id, game_id))
    by_level = {r["level"]: r for r in rows}
    levels, unlocked = [], True
    for lvl in range(1, LEVELS + 1):
        r = by_level.get(lvl, {"best_score": 0, "stars": 0, "plays": 0})
        levels.append({"level": lvl, "unlocked": unlocked, "best_score": r["best_score"], "stars": r["stars"],
                       "plays": r["plays"]})
        unlocked = r["stars"] >= UNLOCK_STARS
    return levels


def catalog(student_id=None, subject=None):
    out = []
    for game in GAMES:
        if subject and game["subject"] != subject:
            continue
        item = public_game(game)
        item["levels_count"] = LEVELS
        if student_id:
            levels = level_progress(student_id, game["game_id"])
            item["levels"] = levels
            item["total_stars"] = sum(l["stars"] for l in levels)
            item["highest_unlocked"] = max(l["level"] for l in levels if l["unlocked"])
        out.append(item)
    return out


def student_badges(student_id):
    rows = fetch_dicts("SELECT badge_id, earned_at FROM student_rewards WHERE student_id = ? ORDER BY earned_at",
                       (student_id,))
    return [{"badge_id": r["badge_id"], "earned_at": r["earned_at"], **BADGES.get(r["badge_id"], {})} for r in rows]


# =====================================================================
# Sessions
# =====================================================================

def start_game(student_id, game_id, level, seed=None):
    game = GAMES_BY_ID.get(game_id)
    if not game:
        raise GameError("Game not found.", 404)
    if not student_id or not str(student_id).strip():
        raise GameError("student_id is required.")
    if level < 1 or level > LEVELS:
        raise GameError(f"Level must be between 1 and {LEVELS}.")
    levels = level_progress(student_id, game_id)
    if not levels[level - 1]["unlocked"]:
        raise GameError(f"Level {level} is locked. Earn {UNLOCK_STARS} stars on level {level - 1} to unlock it.", 403)

    rng = random.Random(seed)
    challenges, seen = [], set()
    tries = 0
    while len(challenges) < CHALLENGES_PER_LEVEL and tries < CHALLENGES_PER_LEVEL * 20:
        tries += 1
        ch = game["generator"](rng, level)
        key = (json.dumps(ch["display"], ensure_ascii=False, sort_keys=True), ch["answer"])
        if key in seen:
            continue
        seen.add(key)
        ch["challenge_id"] = f"c{len(challenges) + 1}"
        challenges.append(ch)

    session_id = uuid.uuid4().hex
    state = {c["challenge_id"]: {"attempts": 0, "resolved": False, "correct": False, "points": 0, "answers": []}
             for c in challenges}
    execute_commit(
        "INSERT INTO game_sessions (session_id, student_id, game_id, level, challenges, state, started_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (session_id, student_id, game_id, level, json.dumps(challenges, ensure_ascii=False), json.dumps(state),
         now_utc()),
    )
    return {
        "session_id": session_id,
        "game": public_game(game),
        "level": level,
        "time_limit_sec": TIME_LIMITS[level],
        "max_tries": MAX_TRIES,
        "challenges": [{k: v for k, v in c.items() if k != "answer"} for c in challenges],
    }


def _load_session(session_id):
    row = fetch_dict("SELECT * FROM game_sessions WHERE session_id = ?", (session_id,))
    if not row:
        raise GameError("Game session not found.", 404)
    row["challenges"] = json.loads(row["challenges"])
    row["state"] = json.loads(row["state"])
    return row


def answer_challenge(session_id, challenge_id, answer):
    session = _load_session(session_id)
    if session["finished"]:
        raise GameError("This game round is already finished.", 409)
    challenge = next((c for c in session["challenges"] if c["challenge_id"] == challenge_id), None)
    if not challenge:
        raise GameError("Challenge not found in this session.", 404)
    st = session["state"][challenge_id]
    if st["resolved"]:
        raise GameError("This challenge is already finished.", 409)
    if answer is None or not str(answer).strip():
        raise GameError("Please choose an answer.")

    st["attempts"] += 1
    st["answers"].append(str(answer))
    correct = str(answer).strip() == str(challenge["answer"]).strip()
    if correct:
        st.update(resolved=True, correct=True, points=POINTS_BY_TRY.get(st["attempts"], 50))
    elif st["attempts"] >= MAX_TRIES:
        st.update(resolved=True, correct=False, points=0)
    execute_commit("UPDATE game_sessions SET state = ? WHERE session_id = ?",
                   (json.dumps(session["state"]), session_id))
    resolved_all = all(s["resolved"] for s in session["state"].values())
    return {
        "challenge_id": challenge_id,
        "correct": correct,
        "attempts": st["attempts"],
        "tries_left": 0 if st["resolved"] else MAX_TRIES - st["attempts"],
        "resolved": st["resolved"],
        "points": st["points"],
        "correct_answer": challenge["answer"] if st["resolved"] else None,
        "feedback": ("Shabbas! Correct!" if correct else
                     ("Good try! Here is the right answer." if st["resolved"] else "Oops! Try again.")),
        "hint": challenge.get("hint") if not correct and not st["resolved"] else None,
        "round_complete": resolved_all,
    }


def _award_badge(cursor, student_id, badge_id, earned):
    cursor.execute("INSERT OR IGNORE INTO student_rewards (student_id, badge_id, earned_at) VALUES (?, ?, ?)",
                   (student_id, badge_id, now_utc()))
    if cursor.rowcount:
        earned.append({"badge_id": badge_id, **BADGES[badge_id]})


def finish_game(session_id, time_taken_sec=None):
    session = _load_session(session_id)
    if session["finished"]:
        return json.loads(session["result"])

    game = GAMES_BY_ID[session["game_id"]]
    student_id, level = session["student_id"], session["level"]
    states = session["state"]
    total = len(session["challenges"])
    points = sum(s["points"] for s in states.values())
    score = round(points / (total * 100) * 100) if total else 0
    stars = stars_for(score)
    resolved = sum(1 for s in states.values() if s["resolved"])
    correct = sum(1 for s in states.values() if s["correct"])

    prev = fetch_dict("SELECT best_score, stars FROM game_progress WHERE student_id = ? AND game_id = ? AND level = ?",
                      (student_id, game["game_id"], level))
    new_best = prev is None or score > prev["best_score"]
    coins = stars * 5 + (10 if new_best and score > 0 else 0)

    details = []
    for idx, ch in enumerate(session["challenges"]):
        st = states[ch["challenge_id"]]
        details.append({"challenge_index": idx, "prompt": ch.get("prompt_local") or ch["prompt"],
                        "student_answer": st["answers"][-1] if st["answers"] else None,
                        "is_correct": st["correct"], "attempts_count": st["attempts"]})
    record = save_game_attempt(student_id, game["game_id"], lesson_id=game["lesson_id"], score=score, stars=stars,
                               completed_challenges=resolved, total_challenges=total,
                               is_completed=resolved == total, details=details, record_mastery=False, level=level)

    earned = []
    connection = get_connection()
    try:
        cur = connection.cursor()
        cur.execute(
            """
            INSERT INTO game_progress (student_id, game_id, level, best_score, stars, plays, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(student_id, game_id, level) DO UPDATE SET
                best_score = MAX(best_score, excluded.best_score), stars = MAX(stars, excluded.stars),
                plays = plays + 1, updated_at = excluded.updated_at
            """,
            (student_id, game["game_id"], level, score, stars, now_utc()),
        )
        cur.execute("UPDATE students SET coins = coins + ? WHERE student_id = ?", (coins, student_id))
        _award_badge(cur, student_id, "first_game", earned)
        if score == 100:
            _award_badge(cur, student_id, "perfect_score", earned)
        if level == LEVELS and stars >= UNLOCK_STARS:
            _award_badge(cur, student_id, "level_master", earned)
        cur.execute("SELECT DISTINCT game_id FROM game_progress WHERE student_id = ?", (student_id,))
        played = {r[0] for r in cur.fetchall()}
        for subject, badge in (("Mathematics", "math_explorer"), ("Marathi", "marathi_explorer")):
            if all(g["game_id"] in played for g in GAMES if g["subject"] == subject):
                _award_badge(cur, student_id, badge, earned)
        cur.execute("SELECT COALESCE(SUM(stars), 0) FROM game_progress WHERE student_id = ?", (student_id,))
        if cur.fetchone()[0] >= 25:
            _award_badge(cur, student_id, "star_collector", earned)
        connection.commit()
    finally:
        connection.close()

    levels = level_progress(student_id, game["game_id"])
    next_level = level + 1 if level < LEVELS else None
    result = {
        "session_id": session_id,
        "game_id": game["game_id"],
        "level": level,
        "score": score,
        "stars": stars,
        "correct": correct,
        "total": total,
        "coins_earned": coins,
        "new_best": new_best,
        "badges_earned": earned,
        "next_level": next_level,
        "next_level_unlocked": bool(next_level and levels[next_level - 1]["unlocked"]),
        "time_taken_sec": time_taken_sec,
        "game_attempt_id": record["game_attempt_id"],
        "levels": levels,
    }
    execute_commit("UPDATE game_sessions SET finished = 1, result = ? WHERE session_id = ?",
                   (json.dumps(result, ensure_ascii=False), session_id))
    return result


def total_coins(student_id):
    row = fetch_one("SELECT coins FROM students WHERE student_id = ?", (student_id,))
    return row[0] if row else 0
