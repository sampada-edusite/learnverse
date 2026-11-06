"""Helpers for building generated curriculum content."""
import random

MCQ, SA = "Multiple Choice", "Short Answer"
DIFFICULTIES = ("Easy", "Medium", "Hard")


class ConceptBuilder:
    """Collects questions for one concept, avoiding duplicate question texts."""

    def __init__(self, concept_id: str):
        self.concept_id = concept_id
        self.rng = random.Random(concept_id)
        self.questions = []
        self._seen = set()

    def add(self, text, answer, difficulty, distractors=None, hint=None, qtype=None):
        if (text, str(answer)) in self._seen:
            return False
        answer = str(answer)
        options = None
        if distractors is not None:
            unique = []
            for d in distractors:
                d = str(d)
                if d != answer and d not in unique:
                    unique.append(d)
            if len(unique) >= 1:
                options = [answer] + unique[:3]
                self.rng.shuffle(options)
        if qtype is None:
            qtype = MCQ if options else SA
        self._seen.add((text, answer))
        n = len(self.questions) + 1
        self.questions.append({
            "question_id": f"Q{n}_{self.concept_id}",
            "concept_id": self.concept_id,
            "question": text,
            "question_type": qtype,
            "expected_answer": answer,
            "hint": hint,
            "difficulty": difficulty,
            "options": options if qtype == MCQ else None,
        })
        return True

    def fill(self, generator, per_difficulty=2, max_tries=60):
        """Call generator(rng, difficulty) -> dict(text, answer, distractors, hint, qtype) until filled."""
        for diff in DIFFICULTIES:
            added, tries = 0, 0
            while added < per_difficulty and tries < max_tries:
                tries += 1
                spec = generator(self.rng, diff)
                if spec and self.add(spec["text"], spec["answer"], diff, spec.get("distractors"),
                                     spec.get("hint"), spec.get("qtype")):
                    added += 1
        return self

    def from_bank(self, bank):
        """bank: list of (difficulty, text, answer, distractors, hint)."""
        for diff, text, answer, distractors, hint in bank:
            self.add(text, answer, diff, distractors, hint)
        return self


def near_numbers(rng, n, low=0, high=None, count=3, spread=3):
    """Plausible wrong answers close to n."""
    out = []
    candidates = [n + d for d in range(-spread, spread + 1) if d != 0]
    rng.shuffle(candidates)
    for c in candidates:
        if c >= low and (high is None or c <= high) and c not in out:
            out.append(c)
        if len(out) == count:
            break
    k = spread + 1
    while len(out) < count:
        c = n + k
        if c not in out and c != n and c >= low:
            out.append(c)
        k += 1
    return out


def lesson(lesson_id, cls, subject, chapter_no, name, local_name, description, unit=None):
    return {"lesson_id": lesson_id, "class": cls, "subject": subject, "unit": unit or f"Std {cls}",
            "chapter_no": chapter_no, "lesson_name": name, "lesson_name_local": local_name,
            "description": description}


def concept(concept_id, lesson_id, name, objective, difficulty="Easy"):
    return {"concept_id": concept_id, "lesson_id": lesson_id, "name": name, "objective": objective,
            "prerequisite": None, "difficulty": difficulty}
