# SamSukh LearnVerse

An adaptive learning platform for primary-school children (Maharashtra State Board, Std 1–2), with a teacher dashboard.

- **Students** practise English, Mathematics (गणित) and Marathi (मराठी) with questions that adapt to their mastery, play 12 educational games, earn coins, stars and badges, and complete homework and quizzes.
- **Teachers** sign in with name + mobile number (OTP-verified), manage their class, assign chapter practice / quizzes / game levels, build auto-graded quizzes, and follow class and per-student progress.

| Part | Tech |
|---|---|
| App (`frontend/mobile`) | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript — runs on Android, iOS and the web |
| API (`backend`) | Python 3.10+ · FastAPI · SQLite |
| Tests (`tests`) | pytest / unittest — engines, API, auth, games, curriculum |

---

## Quick start

### 1. Backend (port 8000)

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

On first start the SQLite database (`backend/learnverse.db`) is created and all curriculum content is seeded. Interactive API docs: <http://localhost:8000/docs>.

### 2. App

```bash
cd frontend/mobile
npm install
npx expo start          # press w for web, or scan the QR code with Expo Go
```

- **Web:** the app talks to `http://127.0.0.1:8000` automatically.
- **Phone (Expo Go):** the app uses your computer's IP from the Expo dev server, so phone and computer must be on the same Wi-Fi. Change the address any time from the **server icon** (Settings) in the app.

### 3. Try it

1. Welcome → **I'm a Teacher** → *Create account* → enter name + mobile → **Send OTP**. In development the code is shown on screen (no SMS gateway needed).
2. Note your **class code** on the Overview tab, then add students or share the code.
3. In another browser window: **Let's Start** → register a student with that class code.
4. As the teacher create a quiz (*Quizzes → New quiz → Draft questions from a chapter*) and assign it (*Homework → New*).
5. As the student open **Homework**, take the quiz, practise a Maths chapter and play a game — then watch the teacher dashboard update.

---

## Features

### Students
- **Dashboard** — next recommended skill, accuracy, questions answered, games, badges, coins, daily streak, per-subject progress, homework to do, weak skills.
- **English Unit 1** — the original six lessons with working/solving videos, workbook practice and the *School Bell Run* game (unchanged).
- **Mathematics & Marathi** — Std 1 and Std 2 chapters → skills (concepts) → adaptive practice rounds with hints, instant feedback and mastery status; each chapter links to its game.
- **Games** — 6 Maths + 6 Marathi games, 5 levels each, timer, 3 tries per challenge, hints, scoring, stars, coins, badges; earning ★★ unlocks the next level.
- **Homework & quizzes** — assignments from the teacher with status/progress; timed, auto-graded quizzes with answer review.
- Works offline for English Unit 1 (built-in fallback content); other features need the server.

### Teachers
- **Secure sign-in:** name + mobile → 6-digit OTP (5-minute expiry, hashed, rate-limited) → bearer token (30 days).
- **Overview:** students, active this week, average accuracy, quiz average, game rounds, 14-day activity chart, accuracy by subject, skills that need attention, student table.
- **Students:** add / edit / remove (history is kept), search, full per-student report (subjects, weak skills, homework, quiz results, games, recent answers).
- **Homework:** assign chapter practice (N questions), a quiz, or a game level to the whole class or chosen students, with due dates; completion is tracked automatically.
- **Quizzes:** write multiple-choice questions or draft them from any chapter's question bank, set points and time limit, see submissions and averages.

### Learning engine (Python)
`answer_checker` (tolerant matching: option letters, number words incl. Marathi, Devanagari digits, true/false, spoken sentences) → `mastery_engine` (≥80% Mastered, ≥50% Learning) → `weak_concept_detector` → `question_selector` (difficulty by mastery, avoids repeats) → `adaptive_engine` (introduce / practice / progress) → `recovery_engine` (easier question or hint support after repeated mistakes) → `learning_session`. Expected answers are never sent to the app.

---

## Curriculum

| Subject | Std 1 | Std 2 |
|---|---|---|
| English | Unit 1: 6 lessons, 23 skills | — |
| Mathematics | 12 chapters: shapes & sizes, numbers 1–9, zero & ten, addition & subtraction up to 9, 11–20, up to 100, ±20, patterns, measurement, time, money | 10 chapters: place value, comparing, 2-digit addition & subtraction (carry/borrow), multiplication & tables, equal sharing, measurement, clock & months, money, shapes & skip counting |
| Marathi | 8 chapters: स्वर, व्यंजने, बाराखडी, शब्द वाचन, अंक व संख्यानाम, शब्दसंग्रह, मी व माझे कुटुंब, आठवड्याचे वार | 7 chapters: जोडाक्षरे, विरुद्धार्थी, समानार्थी, एकवचन-अनेकवचन, मराठी महिने, संख्यानाम २१–१००, वाक्य पूर्ण करा |

About 515 questions across 97 skills. Maths questions are generated by code, so every answer is computed. Marathi vocabulary lives in one reviewable file: `backend/content/marathi_data.py`.

> **Note on syllabus alignment:** since 2024 the Std 1 Balbharati book is an integrated, theme-based textbook, so its table of contents doesn't map one-to-one onto subject chapters. The chapters here follow the Std 1–2 mathematics and Marathi **learning outcomes** (topics and skills). Before classroom use, compare chapter titles and order against the official PDFs on [ebalbharati.in](https://books.ebalbharati.in/) and edit `backend/content/*.py`. Bump `CONTENT_VERSION` in `backend/content/__init__.py` and the database updates itself on the next start.

---

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `LEARNVERSE_ENV` | `development` | Set to `production` to stop showing OTPs in API responses (an SMS provider is then required). |
| `LEARNVERSE_SECRET` | auto-generated, stored in DB | HMAC key for OTP and token hashing. Set it explicitly in production. |
| `SMS_PROVIDER` | `console` | `console` prints OTPs to the server log; `twilio` sends real SMS. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | — | Required when `SMS_PROVIDER=twilio`. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins for the web app. |
| `LEARNVERSE_DB` | `backend/learnverse.db` | SQLite database path. |

---

## Tests

```bash
cd tests
python -m pytest -q          # API, integration, teacher platform, games & curriculum (59 tests)
python test_database.py      # script-style engine checks (likewise for the other test_*.py scripts)
```

The tests use the same SQLite database and clean up their own `test_*` records.

---

## API overview

| Area | Endpoints |
|---|---|
| Health & curriculum | `GET /health`, `GET /subjects`, `GET /lessons?subject=&class_level=`, `GET /lessons/{id}` |
| Adaptive practice | `GET /next-question/{student}?lesson_id=&exclude=`, `POST /answer`, `GET /question/{id}`, `GET /mastery/{student}/{concept}`, `GET /weak-concepts/{student}`, `POST /speech-to-text`, `POST /speech-answer`, `GET /dashboard-summary/{student}` |
| Students | `POST /students/register`, `POST /students/login`, `GET /students/{id}`, `GET /students/{id}/progress`, `GET /students/{id}/assignments`, `GET/POST /students/{id}/quizzes/{quiz}[/submit]` |
| Games | `GET /games`, `GET /games/{id}`, `POST /games/{id}/start`, `POST /games/sessions/{sid}/answer`, `POST /games/sessions/{sid}/finish`, `POST /game/save-attempt`, `GET /game/attempts/{student}` |
| Teacher auth | `POST /auth/teacher/request-otp`, `POST /auth/teacher/verify-otp`, `GET /auth/teacher/me`, `POST /auth/teacher/logout` |
| Teacher (Bearer token) | `GET /teacher/overview`, `GET /teacher/catalog`, `GET/POST/PUT/DELETE /teacher/students[/{id}]`, `GET /teacher/students/{id}/progress`, `GET/POST/DELETE /teacher/assignments[/{id}]`, `GET/POST/PUT/DELETE /teacher/quizzes[/{id}]`, `POST /teacher/quizzes/generate` |

---

## Project structure

```
backend/
  main.py                FastAPI app + learning/curriculum routes
  routers/               auth_routes, students, teacher, games
  database.py            schema, migrations, content seeding
  content/               english_unit1, maths, marathi, marathi_data, builder
  games_engine.py        12 games: generators, sessions, scoring, unlocks, rewards
  auth.py, sms.py        OTP + token auth, SMS providers
  services.py            progress, assignments, quizzes, analytics
  *_engine.py, answer_checker.py, learning_session.py, ...
frontend/mobile/
  App.tsx                navigation stack + session restore
  src/ui/                design system components (Screen, Card, Button, Tabs, Sheet, ...)
  src/theme/             colours and design tokens
  src/config/            api.ts (legacy + offline fallback), platformApi.ts (typed client)
  src/screens/           student screens; screens/teacher/ teacher dashboard
  src/components/        practice, games, shared components
tests/
```

## Known limitations

- Student sign-in uses name + parent's mobile number without an OTP, to keep it simple for young children. Student IDs are random and unguessable, and teacher data is protected by authentication.
- SQLite suits a single school server. For many concurrent schools, move to PostgreSQL behind the same `database.py` helpers.
- Speech-to-text uses the device's recogniser; the server-side provider is a pluggable placeholder.
- Marathi read-aloud depends on the device having a Marathi text-to-speech voice. English read-aloud works on all major browsers.
