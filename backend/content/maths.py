"""Mathematics (गणित) - Maharashtra State Board, Std 1 and Std 2.

Chapters follow the Std 1-2 Balbharati mathematics learning outcomes
(numbers, addition/subtraction, shapes, patterns, measurement, time, money,
and multiplication/sharing in Std 2). Every numeric answer is computed.
"""
from .builder import ConceptBuilder, SA, concept, lesson, near_numbers

SUBJECT = "Mathematics"
OBJECTS = ["🍎", "⭐", "🎈", "🐟", "🌸", "🚗", "🍌", "⚽", "🐥", "✏️"]
OBJECT_NAMES = {"🍎": "apples", "⭐": "stars", "🎈": "balloons", "🐟": "fish", "🌸": "flowers",
                "🚗": "cars", "🍌": "bananas", "⚽": "balls", "🐥": "chicks", "✏️": "pencils"}

ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
             "October", "November", "December"]


def number_name(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n == 100:
        return "one hundred"
    t, o = divmod(n, 10)
    return TENS[t] + ("" if o == 0 else "-" + ONES[o])


def rng_range(diff, easy, medium, hard):
    return {"Easy": easy, "Medium": medium, "Hard": hard}[diff]


# ---------------- generators ----------------

def g_count(rng, diff, ranges=((1, 5), (4, 7), (6, 9))):
    lo, hi = rng_range(diff, *ranges)
    n = rng.randint(lo, hi)
    obj = rng.choice(OBJECTS)
    return {"text": f"Count the {OBJECT_NAMES[obj]}: {obj * n}", "answer": n,
            "distractors": near_numbers(rng, n, low=1), "hint": "Touch each one as you count."}


def g_number_name(rng, diff):
    n = rng.randint(*rng_range(diff, (1, 3), (4, 6), (7, 9)))
    if diff == "Hard":
        return {"text": f"Write the number for the word '{ONES[n]}'.", "answer": n, "qtype": SA,
                "hint": "Count on your fingers."}
    return {"text": f"Which number is '{ONES[n]}'?", "answer": n,
            "distractors": near_numbers(rng, n, low=1, high=9), "hint": "Say the numbers 1 to 9 aloud."}


def g_before_after(rng, diff, low=1, high=9):
    n = rng.randint(low + 1, high - 1)
    if diff == "Easy":
        return {"text": f"Which number comes just after {n}?", "answer": n + 1,
                "distractors": near_numbers(rng, n + 1, low=0), "hint": "Add one more."}
    if diff == "Medium":
        return {"text": f"Which number comes just before {n}?", "answer": n - 1,
                "distractors": near_numbers(rng, n - 1, low=0), "hint": "Take one away."}
    return {"text": f"Which number comes between {n - 1} and {n + 1}?", "answer": n, "qtype": SA,
            "hint": "It is one more than the first number."}


def g_add_pictures(rng, diff):
    top = rng_range(diff, 5, 7, 9)
    a = rng.randint(1, top - 1)
    b = rng.randint(1, top - a)
    obj = rng.choice(OBJECTS)
    return {"text": f"{obj * a}  and  {obj * b}  — how many {OBJECT_NAMES[obj]} altogether?", "answer": a + b,
            "distractors": near_numbers(rng, a + b, low=1), "hint": "Count all of them together."}


def g_add_facts(rng, diff, tops=(5, 7, 9)):
    top = rng_range(diff, *tops)
    a = rng.randint(0 if diff == "Hard" else 1, top - 1)
    b = rng.randint(1, top - a)
    if diff == "Hard":
        return {"text": f"{a} + {b} = ?", "answer": a + b, "qtype": SA, "hint": f"Start at {a} and count on {b}."}
    return {"text": f"{a} + {b} = ?", "answer": a + b, "distractors": near_numbers(rng, a + b, low=0),
            "hint": f"Start at {a} and count on {b}."}


def g_sub_pictures(rng, diff):
    top = rng_range(diff, 5, 7, 9)
    a = rng.randint(2, top)
    b = rng.randint(1, a - 1)
    obj = rng.choice(["🎈", "🐥", "🍎", "🐟", "⭐"])
    verbs = {"🎈": ("fly away", "flies away"), "🐥": ("run away", "runs away"), "🍎": ("are eaten", "is eaten"),
             "🐟": ("swim away", "swims away"), "⭐": ("fade away", "fades away")}
    verb = verbs[obj][1] if b == 1 else verbs[obj][0]
    return {"text": f"There are {a} {OBJECT_NAMES[obj]} {obj * a}. {b} {verb}. How many are left?",
            "answer": a - b, "distractors": near_numbers(rng, a - b, low=0), "hint": "Cross out the ones that go."}


def g_sub_facts(rng, diff, tops=(5, 7, 9)):
    top = rng_range(diff, *tops)
    a = rng.randint(1, top)
    b = rng.randint(0, a)
    spec = {"text": f"{a} − {b} = ?", "answer": a - b, "hint": f"Start at {a} and count back {b}."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = near_numbers(rng, a - b, low=0)
    return spec


def g_teens_place(rng, diff):
    n = rng.randint(11, 19)
    t, o = divmod(n, 10)
    if diff == "Easy":
        return {"text": f"1 ten and {o} ones make which number?", "answer": n,
                "distractors": near_numbers(rng, n, low=10), "hint": "10 + ones."}
    if diff == "Medium":
        return {"text": f"How many ones are there in {n} after taking one ten?", "answer": o,
                "distractors": near_numbers(rng, o, low=0, high=10), "hint": f"{n} = 10 + ?"}
    return {"text": f"Write the number: 10 + {o} = ?", "answer": n, "qtype": SA, "hint": "One ten and some ones."}


def g_count_tens(rng, diff):
    if diff == "Easy":
        k = rng.randint(1, 6)
        seq = [10 * i for i in range(k, k + 3)]
        return {"text": f"Count in tens: {seq[0]}, {seq[1]}, {seq[2]}, ___", "answer": seq[2] + 10,
                "distractors": [seq[2] + 1, seq[2] + 5, seq[2] + 20], "hint": "Add 10 each time."}
    if diff == "Medium":
        k = rng.randint(1, 9)
        return {"text": f"How many tens make {10 * k}?", "answer": k,
                "distractors": near_numbers(rng, k, low=1, high=10), "hint": "Count in tens."}
    k = rng.randint(2, 9)
    return {"text": f"Write the missing number: {10 * (k - 1)}, ___, {10 * (k + 1)}", "answer": 10 * k,
            "qtype": SA, "hint": "Tens go up by 10."}


def g_tens_ones(rng, diff, low=21, high=99):
    n = rng.randint(low, high)
    t, o = divmod(n, 10)
    if diff == "Easy":
        return {"text": f"{t} tens and {o} ones = ?", "answer": n,
                "distractors": [o * 10 + t if o else n + 10, n + 1, n - 10], "hint": "Tens first, then ones."}
    if diff == "Medium":
        return {"text": f"How many tens are there in {n}?", "answer": t,
                "distractors": [o, t + 1, max(t - 1, 0)], "hint": "Look at the left digit."}
    return {"text": f"Write the number that has {t} tens and {o} ones.", "answer": n, "qtype": SA,
            "hint": f"{t} tens = {t * 10}."}


def g_compare(rng, diff):
    hi = rng_range(diff, 20, 60, 99)
    a, b = rng.sample(range(1, hi + 1), 2)
    if diff == "Easy":
        return {"text": f"Which number is bigger: {a} or {b}?", "answer": max(a, b),
                "distractors": [min(a, b)], "hint": "The bigger number comes later when counting."}
    if diff == "Medium":
        return {"text": f"Which number is smaller: {a} or {b}?", "answer": min(a, b),
                "distractors": [max(a, b)], "hint": "Compare the tens digit first."}
    if rng.random() < 0.2:
        b = a
    sign = ">" if a > b else "<" if a < b else "="
    return {"text": f"Choose the correct sign: {a} ___ {b}", "answer": sign,
            "distractors": [s for s in [">", "<", "="] if s != sign],
            "hint": "> means bigger than, < means smaller than."}


def g_word_add(rng, diff, top=20):
    a = rng.randint(3, top // 2)
    b = rng.randint(2, top - a)
    who = rng.choice(["Riya", "Aarav", "Sai", "Meera", "Om"])
    obj = rng.choice(["marbles", "stickers", "pencils", "mangoes"])
    return {"text": f"{who} has {a} {obj}. Mother gives {b} more. How many {obj} does {who} have now?",
            "answer": a + b, "qtype": SA, "hint": "'More' means add."}


def g_word_sub(rng, diff, top=20):
    a = rng.randint(top // 2, top)
    b = rng.randint(1, a - 1)
    who = rng.choice(["Riya", "Aarav", "Sai", "Meera", "Om"])
    obj = rng.choice(["laddoos", "balloons", "chocolates", "flowers"])
    return {"text": f"{who} had {a} {obj} and gave away {b}. How many {obj} are left?",
            "answer": a - b, "qtype": SA, "hint": "'Gave away' means subtract."}


def g_number_pattern(rng, diff, steps=((1, 2), (2, 5), (5, 10))):
    step = rng.choice(rng_range(diff, *steps))
    start = rng.randint(1, 10) * (step if step >= 5 else 1)
    seq = [start + step * i for i in range(4)]
    backwards = diff == "Hard" and rng.random() < 0.5
    if backwards:
        seq = seq[::-1]
    nxt = seq[-1] + (-step if backwards else step)
    spec = {"text": f"What comes next? {', '.join(map(str, seq))}, ___", "answer": nxt,
            "hint": f"The numbers {'go down' if backwards else 'go up'} by {step}."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = [nxt + step, nxt - 1, nxt + 1]
    return spec


SHAPE_SETS = [["🔴", "🔵"], ["🟢", "🟡"], ["⭐", "🌙"], ["🔺", "🟦"], ["🍎", "🍌"]]


def g_picture_pattern(rng, diff):
    if diff == "Easy":
        unit = rng.choice(SHAPE_SETS)
    elif diff == "Medium":
        a, b = rng.choice(SHAPE_SETS)
        unit = [a, a, b]
    else:
        a, b = rng.choice(SHAPE_SETS)
        c = rng.choice([s for pair in SHAPE_SETS for s in pair if s not in (a, b)])
        unit = [a, b, c]
    shown = (unit * 4)[: len(unit) * 2 + 1]
    answer = unit[len(shown) % len(unit)]
    others = [s for s in set(unit) if s != answer] + [rng.choice(["🟣", "🟤", "⚫"])]
    return {"text": f"What comes next in the pattern? {' '.join(shown)} ___", "answer": answer,
            "distractors": others, "hint": "Find the part that repeats."}


def g_days(rng, diff):
    i = rng.randrange(7)
    if diff == "Easy":
        return {"text": f"Which day comes after {DAYS_EN[i]}?", "answer": DAYS_EN[(i + 1) % 7],
                "distractors": [DAYS_EN[(i + 2) % 7], DAYS_EN[(i - 1) % 7], DAYS_EN[(i + 3) % 7]],
                "hint": "Say the days of the week in order."}
    if diff == "Medium":
        return {"text": f"Which day comes before {DAYS_EN[i]}?", "answer": DAYS_EN[(i - 1) % 7],
                "distractors": [DAYS_EN[(i + 1) % 7], DAYS_EN[(i - 2) % 7], DAYS_EN[(i + 2) % 7]],
                "hint": "Go one day back."}
    return {"text": "How many days are there in a week?", "answer": 7, "qtype": SA,
            "hint": "Sunday to Saturday."} if rng.random() < 0.5 else {
        "text": f"Today is {DAYS_EN[i]}. What day will it be the day after tomorrow?",
        "answer": DAYS_EN[(i + 2) % 7],
        "distractors": [DAYS_EN[(i + 1) % 7], DAYS_EN[(i + 3) % 7], DAYS_EN[(i - 1) % 7]],
        "hint": "Count two days forward."}


def g_money_add(rng, diff, values=(1, 2, 5, 10)):
    if diff == "Easy":
        a, b = rng.choice(values[:3]), rng.choice(values[:3])
    elif diff == "Medium":
        a, b = rng.choice(values), rng.choice(values)
    else:
        a, b = rng.choice([5, 10, 20]), rng.choice(values)
    spec = {"text": f"₹{a} + ₹{b} = ? (in rupees)", "answer": a + b, "hint": "Add the rupees."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = near_numbers(rng, a + b, low=1)
    return spec


def g_place_value(rng, diff):
    n = rng.randint(21, 99)
    t, o = divmod(n, 10)
    if o == 0:
        o, n = 1, n + 1
    if diff == "Easy":
        return {"text": f"Which digit is in the tens place in {n}?", "answer": t,
                "distractors": [o, t + 1, max(t - 1, 1)], "hint": "The tens digit is on the left."}
    if diff == "Medium":
        return {"text": f"Which digit is in the ones place in {n}?", "answer": o,
                "distractors": [t, o + 1, max(o - 1, 0)], "hint": "The ones digit is on the right."}
    return {"text": f"What is the value of the digit {t} in {n}?", "answer": t * 10, "qtype": SA,
            "hint": f"{t} tens = ?"}


def g_expanded(rng, diff):
    n = rng.randint(21, 99)
    t, o = divmod(n, 10)
    if o == 0:
        o, n = 3, n + 3
    if diff == "Easy":
        return {"text": f"{t * 10} + {o} = ?", "answer": n, "distractors": [n + 10, n - 1, o * 10 + t],
                "hint": "Join tens and ones."}
    if diff == "Medium":
        return {"text": f"{n} = {t * 10} + ___", "answer": o, "distractors": [t, o + 1, t * 10],
                "hint": "What is left after the tens?"}
    return {"text": f"{n} = ___ + {o}", "answer": t * 10, "qtype": SA, "hint": "Write the tens part."}


def g_number_words(rng, diff):
    n = rng.randint(*rng_range(diff, (11, 20), (21, 60), (61, 99)))
    if diff == "Hard":
        return {"text": f"Write the number for '{number_name(n)}'.", "answer": n, "qtype": SA,
                "hint": "Tens word first, then ones."}
    return {"text": f"Which number is '{number_name(n)}'?", "answer": n,
            "distractors": near_numbers(rng, n, low=10, high=99, spread=11), "hint": "Read the tens word first."}


def g_greatest(rng, diff):
    nums = rng.sample(range(10, 100), 3 if diff != "Hard" else 4)
    if diff == "Medium":
        return {"text": f"Which is the smallest number? {', '.join(map(str, nums))}", "answer": min(nums),
                "distractors": [x for x in nums if x != min(nums)], "hint": "Compare tens first."}
    return {"text": f"Which is the greatest number? {', '.join(map(str, nums))}", "answer": max(nums),
            "distractors": [x for x in nums if x != max(nums)], "hint": "Compare tens first."}


def g_between(rng, diff):
    n = rng.randint(12, 98)
    if diff == "Easy":
        return {"text": f"Which number comes between {n - 1} and {n + 1}?", "answer": n,
                "distractors": [n - 2, n + 2, n + 10], "hint": "One more than the first."}
    if diff == "Medium":
        return {"text": f"Count backwards: {n + 2}, {n + 1}, ___", "answer": n,
                "distractors": [n + 3, n - 1, n + 1], "hint": "Each number is one less."}
    return {"text": f"Write the number that is 10 more than {n - 10}.", "answer": n, "qtype": SA,
            "hint": "Add one ten."}


def g_add_2digit(rng, diff, carry=False):
    while True:
        a, b = rng.randint(10, 79), rng.randint(10, 49)
        if a + b > 99:
            continue
        has_carry = (a % 10) + (b % 10) >= 10
        if has_carry == carry:
            break
    spec = {"text": f"{a} + {b} = ?", "answer": a + b,
            "hint": "Add the ones first" + (", then carry 1 ten." if carry else ", then the tens.")}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = [a + b + 10, a + b - 10, a + b + 1] if carry else near_numbers(rng, a + b, spread=11)
    return spec


def g_sub_2digit(rng, diff, borrow=False):
    while True:
        a, b = rng.randint(20, 99), rng.randint(10, 89)
        if b >= a:
            continue
        has_borrow = (a % 10) < (b % 10)
        if has_borrow == borrow:
            break
    spec = {"text": f"{a} − {b} = ?", "answer": a - b,
            "hint": "Subtract the ones first" + (" — borrow 1 ten if needed." if borrow else ".")}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = [a - b + 10, a - b - 1, a - b + 1] if borrow else near_numbers(rng, a - b, low=0, spread=11)
    return spec


def g_repeated_add(rng, diff):
    n = rng.randint(2, 5)
    k = rng.randint(2, rng_range(diff, 3, 4, 5))
    if diff == "Easy":
        return {"text": f"{' + '.join([str(n)] * k)} = ?", "answer": n * k,
                "distractors": near_numbers(rng, n * k, low=1), "hint": f"Add {n} again and again."}
    if diff == "Medium":
        return {"text": f"{' + '.join([str(n)] * k)} = {n} × ___", "answer": k,
                "distractors": near_numbers(rng, k, low=1, high=10), "hint": f"How many times is {n} added?"}
    obj = rng.choice(OBJECTS)
    return {"text": f"There are {k} groups with {n} {OBJECT_NAMES[obj]} {obj * n} in each. How many in all?",
            "answer": n * k, "qtype": SA, "hint": f"{k} × {n}"}


def g_tables(rng, diff):
    table = rng.choice(rng_range(diff, [2, 10], [3, 5], [4, 5]))
    k = rng.randint(1, 10)
    spec = {"text": f"{table} × {k} = ?", "answer": table * k, "hint": f"Say the table of {table}."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = [table * (k + 1), table * max(k - 1, 1) if k > 1 else table + 1, table * k + 1]
    return spec


def g_sharing(rng, diff):
    kids = rng.randint(2, rng_range(diff, 3, 4, 5))
    each = rng.randint(2, rng_range(diff, 3, 5, 6))
    total = kids * each
    obj = rng.choice(["laddoos", "biscuits", "pencils", "flowers"])
    spec = {"text": f"{total} {obj} are shared equally among {kids} children. How many does each child get?",
            "answer": each, "hint": f"Make {kids} equal groups."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = near_numbers(rng, each, low=1)
    return spec


def g_clock(rng, diff):
    h = rng.randint(1, 12)
    if diff == "Easy":
        return {"text": f"The short hand points to {h} and the long hand points to 12. What time is it?",
                "answer": f"{h} o'clock", "distractors": [f"12 o'clock", f"half past {h}", f"{h % 12 + 1} o'clock"],
                "hint": "Long hand at 12 means o'clock."}
    if diff == "Medium":
        return {"text": f"The long hand points to 6 and the short hand is just after {h}. What time is it?",
                "answer": f"half past {h}", "distractors": [f"{h} o'clock", f"half past {h % 12 + 1}", f"6 o'clock"],
                "hint": "Long hand at 6 means half past."}
    return {"text": f"It is {h} o'clock now. What time will it be after 2 hours?", "answer": f"{(h + 1) % 12 + 1} o'clock",
            "distractors": [f"{h % 12 + 1} o'clock", f"{(h + 2) % 12 + 1} o'clock", f"half past {h}"],
            "hint": "Move the short hand forward 2 numbers."}


def g_months(rng, diff):
    i = rng.randrange(12)
    if diff == "Easy":
        return {"text": f"Which month comes after {MONTHS_EN[i]}?", "answer": MONTHS_EN[(i + 1) % 12],
                "distractors": [MONTHS_EN[(i + 2) % 12], MONTHS_EN[(i - 1) % 12], MONTHS_EN[(i + 3) % 12]],
                "hint": "Say the months in order."}
    if diff == "Medium":
        return {"text": f"Which month comes before {MONTHS_EN[i]}?", "answer": MONTHS_EN[(i - 1) % 12],
                "distractors": [MONTHS_EN[(i + 1) % 12], MONTHS_EN[(i - 2) % 12], MONTHS_EN[(i + 2) % 12]],
                "hint": "Go one month back."}
    return rng.choice([
        {"text": "How many months are there in a year?", "answer": 12, "qtype": SA, "hint": "January to December."},
        {"text": "Which is the first month of the year?", "answer": "January",
         "distractors": ["December", "March", "June"], "hint": "New Year's Day is in it."},
        {"text": "Which is the last month of the year?", "answer": "December",
         "distractors": ["January", "November", "October"], "hint": "It comes after November."},
    ])


def g_change(rng, diff):
    have = rng.choice(rng_range(diff, [10, 20], [20, 50], [50, 100]))
    cost = rng.randint(1, have - 1)
    item = rng.choice(["a pencil box", "a ball", "a storybook", "a kite"])
    spec = {"text": f"You have ₹{have}. You buy {item} for ₹{cost}. How many rupees are left?",
            "answer": have - cost, "hint": "Subtract the cost from what you have."}
    if diff == "Hard":
        spec["qtype"] = SA
    else:
        spec["distractors"] = near_numbers(rng, have - cost, low=0)
    return spec


def g_skip(rng, diff):
    return g_number_pattern(rng, diff, steps=((2,), (5,), (10, 5, 2)))


def g_add_20(rng, diff):
    if diff == "Hard":
        return g_word_add(rng, diff, top=20)
    return g_add_facts(rng, diff, tops=(12, 16, 20))


def g_sub_20(rng, diff):
    if diff == "Hard":
        return g_word_sub(rng, diff, top=20)
    return g_sub_facts(rng, diff, tops=(12, 16, 20))


# ---------------- fixed banks ----------------

BANK_SIZES = [
    ("Easy", "Which is bigger?", "🐘 Elephant", ["🐜 Ant", "🐭 Mouse", "🐝 Bee"], "Think about how big each animal is."),
    ("Easy", "Which is smaller?", "🐜 Ant", ["🐘 Elephant", "🐄 Cow", "🐎 Horse"], "It can sit on a leaf."),
    ("Medium", "Which is taller?", "🦒 Giraffe", ["🐕 Dog", "🐈 Cat", "🐇 Rabbit"], "It eats leaves from tall trees."),
    ("Medium", "Which is the shortest?", "🖍️ Crayon", ["🌴 Palm tree", "🏢 Building", "🦒 Giraffe"], "It fits in your hand."),
    ("Hard", "Which of these is the biggest?", "🚌 Bus", ["🚲 Cycle", "⚽ Ball", "🍎 Apple"], "Many people can sit inside it."),
    ("Hard", "Which of these is the smallest?", "🫘 Bean", ["🍉 Watermelon", "🎃 Pumpkin", "🍍 Pineapple"], "It is a tiny seed."),
]
BANK_SHAPES = [
    ("Easy", "A coin looks like which shape?", "circle", ["square", "triangle", "rectangle"], "It is round."),
    ("Easy", "How many sides does a triangle have?", "3", ["4", "2", "5"], "Tri means three."),
    ("Medium", "A carrom board looks like which shape?", "square", ["circle", "triangle", "oval"], "All four sides are equal."),
    ("Medium", "Which shape has no corners?", "circle", ["square", "triangle", "rectangle"], "It is round all over."),
    ("Hard", "How many corners does a rectangle have?", "4", ["3", "5", "0"], "Count the corners of a door."),
    ("Hard", "A door looks like which shape?", "rectangle", ["circle", "triangle", "square"], "Two long sides and two short sides."),
]
BANK_ZERO = [
    ("Easy", "There are 3 birds on a tree. All 3 fly away. How many birds are left?", "0", ["1", "3", "2"], "None are left."),
    ("Easy", "Which number means 'nothing'?", "0", ["1", "10", "9"], "An empty basket has this many."),
    ("Medium", "5 − 5 = ?", "0", ["5", "1", "10"], "Take away everything."),
    ("Medium", "4 + 0 = ?", "4", ["0", "40", "5"], "Adding zero changes nothing."),
    ("Hard", "Which number comes just before 1?", "0", ["2", "10", "9"], "Count back from 1."),
    ("Hard", "0 + 7 = ?", "7", ["0", "70", "8"], "Adding zero changes nothing."),
]
BANK_TEN = [
    ("Easy", "9 + 1 = ?", "10", ["8", "11", "19"], "One more than nine."),
    ("Easy", f"Count the stars: {'⭐' * 10}", "10", ["9", "11", "8"], "Count carefully."),
    ("Medium", "How many fingers are there on both your hands?", "10", ["5", "8", "12"], "5 on each hand."),
    ("Medium", "Which number comes just after 9?", "10", ["8", "11", "90"], "It has two digits."),
    ("Hard", "10 − 1 = ?", "9", ["11", "10", "0"], "One less than ten."),
    ("Hard", "5 + 5 = ?", "10", ["55", "9", "11"], "Two full hands."),
]
BANK_MEASURE_1 = [
    ("Easy", "Which is longer?", "🚂 Train", ["🚗 Car", "🚲 Cycle", "🛴 Scooter"], "It has many coaches."),
    ("Easy", "Which is heavier?", "🐘 Elephant", ["🐈 Cat", "🐦 Bird", "🐟 Fish"], "It is very big."),
    ("Medium", "Which is lighter?", "🪶 Feather", ["🧱 Brick", "🪨 Stone", "📚 Books"], "The wind can blow it away."),
    ("Medium", "Which holds more water?", "🪣 Bucket", ["🥛 Glass", "🥄 Spoon", "☕ Cup"], "It is used to carry water for a bath."),
    ("Hard", "Which is the shortest?", "📎 Paper clip", ["✏️ Pencil", "📏 Ruler", "🪥 Toothbrush"], "It holds papers together."),
    ("Hard", "Which is the heaviest?", "🛺 Rickshaw", ["⚽ Ball", "🎒 School bag", "🍎 Apple"], "It can carry people."),
]
BANK_PARTS_OF_DAY = [
    ("Easy", "When do we see the sun rise?", "morning", ["night", "evening", "afternoon"], "It is the start of the day."),
    ("Easy", "When do we see the moon and stars?", "night", ["morning", "afternoon", "noon"], "It is dark outside."),
    ("Medium", "When do we usually eat lunch?", "afternoon", ["night", "early morning", "midnight"], "It is after school's first half."),
    ("Medium", "When does the sun set?", "evening", ["morning", "noon", "midnight"], "Birds fly back to their nests."),
    ("Hard", "Which comes first in a day?", "morning", ["afternoon", "evening", "night"], "We wake up then."),
    ("Hard", "Which comes after evening?", "night", ["morning", "afternoon", "noon"], "Time to sleep."),
]
BANK_LENGTH_2 = [
    ("Easy", "Which unit would you use to measure the length of a pencil?", "centimetre", ["kilogram", "litre", "rupee"], "A small unit of length."),
    ("Easy", "Which tool do we use to measure length?", "ruler", ["clock", "weighing scale", "bucket"], "It has numbers along its edge."),
    ("Medium", "1 metre = ___ centimetres", "100", ["10", "1000", "50"], "A metre is a long length."),
    ("Medium", "Which unit would you use to measure the length of a classroom?", "metre", ["centimetre", "litre", "gram"], "A big unit of length."),
    ("Hard", "A ribbon is 8 cm long. Another is 5 cm long. How much longer is the first ribbon (in cm)?", "3", ["13", "8", "5"], "Subtract the lengths."),
    ("Hard", "Two sticks of 20 cm each are placed end to end. What is the total length in cm?", "40", ["20", "30", "400"], "Add the lengths."),
]
BANK_WEIGHT_2 = [
    ("Easy", "Which unit is used to measure milk?", "litre", ["kilogram", "metre", "centimetre"], "Liquids are measured in it."),
    ("Easy", "Which unit is used to measure rice?", "kilogram", ["litre", "metre", "hour"], "We buy it by weight."),
    ("Medium", "1 kilogram = ___ grams", "1000", ["100", "10", "500"], "A thousand small units."),
    ("Medium", "Which tool do we use to weigh vegetables?", "weighing scale", ["ruler", "clock", "thermometer"], "Shopkeepers use it."),
    ("Hard", "A bag has 3 kg of potatoes and another has 4 kg. How many kg in all?", "7", ["1", "12", "34"], "Add the weights."),
    ("Hard", "A bottle has 2 litres of water. You drink 1 litre. How many litres are left?", "1", ["3", "2", "0"], "Subtract."),
]
BANK_SHAPES_2 = [
    ("Easy", "How many sides does a square have?", "4", ["3", "5", "6"], "Count the sides of a carrom board."),
    ("Easy", "Which shape is like a ball?", "sphere", ["cube", "cone", "cylinder"], "It is round all around."),
    ("Medium", "Which shape is like a dice?", "cube", ["sphere", "cone", "cylinder"], "It has 6 square faces."),
    ("Medium", "Which shape is like an ice-cream cone?", "cone", ["cube", "sphere", "cuboid"], "It has a pointed tip."),
    ("Hard", "How many corners does a triangle have?", "3", ["4", "2", "0"], "Same as its sides."),
    ("Hard", "A gas cylinder looks like which shape?", "cylinder", ["cone", "cube", "sphere"], "It has two round flat faces."),
]


def build():
    lessons, concepts, questions = [], [], []

    def chapter(lid, cls, no, name, local, desc, concept_specs):
        lessons.append(lesson(lid, cls, SUBJECT, no, name, local, desc))
        for idx, (name_c, obj, diff, source) in enumerate(concept_specs, start=1):
            cid = f"{lid}_C{idx}"
            concepts.append(concept(cid, lid, name_c, obj, diff))
            b = ConceptBuilder(cid)
            if callable(source):
                b.fill(source)
            else:
                b.from_bank(source)
            questions.extend(b.questions)

    # ---------- Std 1 ----------
    chapter("M1.1", 1, 1, "Shapes and Sizes", "आकार व आकारमान", "Big and small, tall and short, and shapes around us.", [
        ("Big and Small", "Compare sizes of familiar objects", "Easy", BANK_SIZES),
        ("Shapes Around Us", "Identify circle, triangle, square and rectangle", "Easy", BANK_SHAPES),
    ])
    chapter("M1.2", 1, 2, "Numbers 1 to 9", "१ ते ९ संख्या", "Counting, reading and ordering numbers up to 9.", [
        ("Counting Objects", "Count up to 9 objects", "Easy", g_count),
        ("Number Names", "Match number names with numerals", "Easy", g_number_name),
        ("Before and After", "Find numbers before, after and between", "Medium", g_before_after),
    ])
    chapter("M1.3", 1, 3, "Zero and Ten", "शून्य व दहा", "Understanding 0 as nothing and 10 as one ten.", [
        ("Zero", "Understand zero as 'nothing'", "Easy", BANK_ZERO),
        ("Ten", "Make and count ten", "Easy", BANK_TEN),
    ])
    chapter("M1.4", 1, 4, "Addition up to 9", "बेरीज", "Putting groups together to find the total.", [
        ("Adding with Pictures", "Add two groups of objects", "Easy", g_add_pictures),
        ("Addition Facts", "Add numbers with sum up to 9", "Medium", g_add_facts),
    ])
    chapter("M1.5", 1, 5, "Subtraction up to 9", "वजाबाकी", "Taking away and finding how many are left.", [
        ("Taking Away", "Subtract using pictures", "Easy", g_sub_pictures),
        ("Subtraction Facts", "Subtract numbers within 9", "Medium", g_sub_facts),
    ])
    chapter("M1.6", 1, 6, "Numbers 11 to 20", "११ ते २० संख्या", "One ten and some ones.", [
        ("Tens and Ones (11-20)", "Make numbers using one ten and ones", "Easy", g_teens_place),
        ("Number Order to 20", "Find numbers before, after and between up to 20", "Medium",
         lambda r, d: g_before_after(r, d, 10, 20)),
    ])
    chapter("M1.7", 1, 7, "Numbers up to 100", "१०० पर्यंत संख्या", "Counting in tens, tens and ones, and comparing.", [
        ("Counting in Tens", "Count forward in tens up to 100", "Easy", g_count_tens),
        ("Tens and Ones", "Read numbers as tens and ones", "Medium", g_tens_ones),
        ("Comparing Numbers", "Compare numbers using bigger, smaller, > and <", "Medium", g_compare),
    ])
    chapter("M1.8", 1, 8, "Addition and Subtraction up to 20", "२० पर्यंत बेरीज-वजाबाकी", "Facts and word problems up to 20.", [
        ("Adding up to 20", "Add numbers with totals up to 20", "Medium", g_add_20),
        ("Subtracting within 20", "Subtract numbers within 20", "Medium", g_sub_20),
    ])
    chapter("M1.9", 1, 9, "Patterns", "आकृतिबंध", "Finding what comes next.", [
        ("Picture Patterns", "Continue repeating picture patterns", "Easy", g_picture_pattern),
        ("Number Patterns", "Continue number patterns", "Medium", g_number_pattern),
    ])
    chapter("M1.10", 1, 10, "Measurement", "मापन", "Comparing length, weight and capacity.", [
        ("Long, Heavy and Full", "Compare length, weight and capacity", "Easy", BANK_MEASURE_1),
    ])
    chapter("M1.11", 1, 11, "Time", "वेळ", "Days of the week and parts of the day.", [
        ("Days of the Week", "Know the order of the days of the week", "Easy", g_days),
        ("Parts of the Day", "Morning, afternoon, evening and night", "Easy", BANK_PARTS_OF_DAY),
    ])
    chapter("M1.12", 1, 12, "Money", "पैसे", "Coins and notes up to ₹20.", [
        ("Coins and Notes", "Add small amounts of money", "Medium", g_money_add),
    ])

    # ---------- Std 2 ----------
    chapter("M2.1", 2, 1, "Numbers up to 100", "१०० पर्यंतच्या संख्या", "Place value, expanded form and number names.", [
        ("Place Value", "Identify tens and ones digits", "Easy", g_place_value),
        ("Expanded Form", "Write numbers as tens + ones", "Medium", g_expanded),
        ("Number Names", "Read and write number names up to 99", "Medium", g_number_words),
    ])
    chapter("M2.2", 2, 2, "Comparing and Ordering", "तुलना व क्रम", "Greatest, smallest, and number order.", [
        ("Greatest and Smallest", "Find the greatest and smallest number", "Easy", g_greatest),
        ("Number Order", "Before, after, between and counting back", "Medium", g_between),
    ])
    chapter("M2.3", 2, 3, "Addition", "बेरीज", "Adding two-digit numbers.", [
        ("Adding without Carrying", "Add two-digit numbers without carrying", "Easy",
         lambda r, d: g_add_2digit(r, d, carry=False)),
        ("Adding with Carrying", "Add two-digit numbers with carrying", "Medium",
         lambda r, d: g_add_2digit(r, d, carry=True)),
        ("Addition Word Problems", "Solve 'more' story problems", "Medium",
         lambda r, d: g_word_add(r, d, top=99)),
    ])
    chapter("M2.4", 2, 4, "Subtraction", "वजाबाकी", "Subtracting two-digit numbers.", [
        ("Subtracting without Borrowing", "Subtract without borrowing", "Easy",
         lambda r, d: g_sub_2digit(r, d, borrow=False)),
        ("Subtracting with Borrowing", "Subtract with borrowing", "Medium",
         lambda r, d: g_sub_2digit(r, d, borrow=True)),
        ("Subtraction Word Problems", "Solve 'left' story problems", "Medium",
         lambda r, d: g_word_sub(r, d, top=99)),
    ])
    chapter("M2.5", 2, 5, "Multiplication", "गुणाकार", "Repeated addition and tables of 2, 3, 4, 5 and 10.", [
        ("Repeated Addition", "See multiplication as equal groups", "Easy", g_repeated_add),
        ("Multiplication Tables", "Recall tables of 2, 3, 4, 5 and 10", "Medium", g_tables),
    ])
    chapter("M2.6", 2, 6, "Equal Sharing", "समान वाटणी", "Sharing things equally.", [
        ("Sharing Equally", "Share objects equally among groups", "Medium", g_sharing),
    ])
    chapter("M2.7", 2, 7, "Measurement", "मापन", "Length in cm and m; weight in kg; capacity in litres.", [
        ("Length", "Measure length in centimetres and metres", "Easy", BANK_LENGTH_2),
        ("Weight and Capacity", "Use kilograms and litres", "Medium", BANK_WEIGHT_2),
    ])
    chapter("M2.8", 2, 8, "Time", "वेळ", "Reading the clock and months of the year.", [
        ("Reading the Clock", "Read o'clock and half past", "Medium", g_clock),
        ("Months of the Year", "Know the order of the months", "Easy", g_months),
    ])
    chapter("M2.9", 2, 9, "Money", "पैसे", "Adding money and finding change.", [
        ("Adding Money", "Add rupee amounts", "Easy", lambda r, d: g_money_add(r, d, values=(5, 10, 20, 50))),
        ("Finding Change", "Find money left after buying", "Medium", g_change),
    ])
    chapter("M2.10", 2, 10, "Shapes and Patterns", "आकार व आकृतिबंध", "Solid shapes, sides and corners, skip counting.", [
        ("Shapes", "Know sides, corners and solid shapes", "Easy", BANK_SHAPES_2),
        ("Skip Counting", "Count in 2s, 5s and 10s", "Medium", g_skip),
    ])

    return lessons, concepts, questions
