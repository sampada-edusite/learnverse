/**
 * Typed client for the LearnVerse platform API (students, teachers, games, quizzes).
 * All calls go to the configured backend (see ServerSettingsModal / config/api.ts).
 */
import { getApiUrl } from './api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const NETWORK_MESSAGE =
  "Can't reach the LearnVerse server. Check that the backend is running and the server address in Settings is correct.";

export async function apiRequest<T = any>(
  path: string,
  opts: { method?: string; body?: any; token?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiError(NETWORK_MESSAGE, 0);
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    let msg = `Request failed (HTTP ${res.status})`;
    const detail = data?.detail;
    if (typeof detail === 'string') msg = detail;
    else if (Array.isArray(detail) && detail[0]?.msg) msg = String(detail[0].msg).replace(/^Value error, /, '');
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const errorMessage = (e: any) => (e instanceof ApiError ? e.message : e?.message || 'Something went wrong.');

// ------------------------------------------------------------------ types

export interface Student {
  student_id: string;
  name: string;
  nickname?: string | null;
  student_class: number;
  parent_mobile_masked?: string | null;
  parent_mobile?: string;
  roll_no?: string | null;
  coins: number;
  teacher?: { teacher_id: string; name: string; school?: string | null } | null;
  last_active?: string | null;
  summary?: StudentSummary;
}

export interface StudentSummary {
  attempts: number;
  correct: number;
  accuracy: number;
  last_practice?: string | null;
  games_played: number;
  game_stars: number;
  mastered_concepts: number;
}

export interface Teacher {
  teacher_id: string;
  name: string;
  mobile: string;
  school?: string | null;
  class_code: string;
}

export interface Badge { badge_id: string; title: string; icon: string; description: string; earned_at?: string }

export interface SubjectStat {
  subject: string;
  attempts: number;
  accuracy: number;
  lessons: number;
  concepts: number;
  mastered_concepts: number;
  progress: number;
}

export interface Assignment {
  assignment_id: number;
  title: string;
  kind: 'lesson' | 'quiz' | 'game';
  ref_id: string;
  ref_title: string;
  level?: number | null;
  target_count?: number | null;
  instructions?: string | null;
  due_date?: string | null;
  status: 'pending' | 'completed' | 'overdue';
  progress: number;
  detail: string;
  score?: AssignmentScore | null;
  teacher_name?: string | null;
}

export interface ActivityResult {
  activity_id: string;
  type: 'practice' | 'homework' | 'quiz' | 'test';
  title: string;
  subject: string;
  date: string;
  teacher_name?: string | null;
  correct: number;
  incorrect: number;
  total: number;
  marks: { earned: number; possible: number };
  accuracy: number;
}

export interface ActivitySummary { activities: number; correct: number; incorrect: number; total: number; marks: { earned: number; possible: number }; accuracy: number }

export interface Performance {
  student_id: string;
  overall: ActivitySummary;
  by_type: Record<'practice' | 'homework' | 'quiz' | 'test', ActivitySummary>;
  activities: ActivityResult[];
}

export interface AssignmentScore { earned: number; possible: number; percent: number; label: string }

export interface ResumeItem { key: string; label?: string | null; state: any; updated_at: string }

export interface StudentHistory {
  answers: { at: string; question: string; student_answer: string; is_correct: boolean; lesson_name: string; subject: string; concept_name: string; source?: string }[];
  quizzes: { at: string; quiz_id: number; title: string; subject: string; score: number; max_score: number }[];
  games: { at: string; game_id: string; level: number; score: number; stars: number }[];
}

export interface HomeworkQuestion { question: string; options: string[]; correct_answer: string; points?: number; concept?: string | null; difficulty?: string | null; question_id?: string | null; concept_id?: string | null }

export interface HomeworkDraft {
  engine: 'claude' | 'ml-bank';
  kind: 'homework' | 'quiz' | 'test';
  time_limit_sec?: number | null;
  topics: { concept_id: string; name: string }[];
  model?: string | null;
  note?: string | null;
  lesson: { lesson_id: string; lesson_name: string; lesson_name_local?: string | null; subject: string; class: number };
  title: string;
  instructions: string;
  due_date: string;
  questions: HomeworkQuestion[];
  focus_concepts: { concept_id: string; name: string; readiness: number | null }[];
  students_needing_help: { student_id: string; name: string; lowest_readiness: number }[];
  practice_target: number;
}

export interface ConceptProgress { concept_id: string; name: string; status: string; accuracy: number; attempts: number; question_count: number }

export interface LessonProgress {
  lesson_id: string;
  class: number;
  subject: string;
  chapter_no: number;
  lesson_name: string;
  lesson_name_local?: string | null;
  description?: string | null;
  concepts: ConceptProgress[];
  concept_count: number;
  mastered_concepts: number;
  attempts: number;
  accuracy: number;
  progress: number;
}

export interface GameLevel { level: number; unlocked: boolean; best_score: number; stars: number; plays: number }

export interface GameInfo {
  game_id: string;
  subject: string;
  title: string;
  title_local: string;
  icon: string;
  color: string;
  student_class: number;
  lesson_id: string;
  description: string;
  skill: string;
  levels?: GameLevel[];
  total_stars?: number;
  highest_unlocked?: number;
}

export interface GameChallenge {
  challenge_id: string;
  prompt: string;
  prompt_local?: string;
  display: { type: 'emoji_grid' | 'big_text' | 'compare' | 'sequence' | 'emoji'; [k: string]: any };
  options: string[];
  hint?: string;
}

export interface GameSession {
  session_id: string;
  game: GameInfo;
  level: number;
  time_limit_sec: number;
  max_tries: number;
  challenges: GameChallenge[];
}

export interface GameAnswerResult {
  challenge_id: string;
  correct: boolean;
  attempts: number;
  tries_left: number;
  resolved: boolean;
  points: number;
  correct_answer: string | null;
  feedback: string;
  hint: string | null;
  round_complete: boolean;
}

export interface GameResult {
  score: number;
  stars: number;
  correct: number;
  total: number;
  coins_earned: number;
  new_best: boolean;
  badges_earned: Badge[];
  next_level: number | null;
  next_level_unlocked: boolean;
  level: number;
  levels: GameLevel[];
}

export interface QuizQuestion { id?: number; question: string; options: string[]; correct_answer?: string; points: number }
export interface Quiz {
  quiz_id: number;
  title: string;
  subject: string;
  student_class: number;
  time_limit_sec?: number | null;
  questions: QuizQuestion[];
  max_score: number;
  question_count?: number;
  submissions?: any;
  average?: number | null;
  last_score?: { score: number; max_score: number } | null;
}

// ------------------------------------------------------------------ students

export const StudentApi = {
  register: (body: { name: string; student_class: number; parent_mobile: string; nickname?: string; class_code?: string }) =>
    apiRequest<{ student: Student; existing: boolean }>('/students/register', { body }),
  login: (body: { name: string; parent_mobile: string }) => apiRequest<{ student: Student }>('/students/login', { body }),
  profile: (id: string) =>
    apiRequest<{ student: Student; badges: Badge[]; streak_days: number; summary: StudentSummary }>(`/students/${encodeURIComponent(id)}`),
  progress: (id: string, subject?: string, classLevel?: number) =>
    apiRequest<{ subjects: SubjectStat[]; lessons: LessonProgress[] }>(
      `/students/${encodeURIComponent(id)}/progress${subject ? `?subject=${encodeURIComponent(subject)}${classLevel ? `&class_level=${classLevel}` : ''}` : ''}`
    ),
  assignments: (id: string) =>
    apiRequest<{ assignments: Assignment[]; pending: number }>(`/students/${encodeURIComponent(id)}/assignments`),
  quiz: (id: string, quizId: number) => apiRequest<Quiz>(`/students/${encodeURIComponent(id)}/quizzes/${quizId}`),
  submitQuiz: (id: string, quizId: number, answers: Record<string, string>) =>
    apiRequest<{ score: number; max_score: number; percentage: number; results: any[] }>(
      `/students/${encodeURIComponent(id)}/quizzes/${quizId}/submit`, { body: { answers } }),
  dashboard: (id: string) => apiRequest<any>(`/dashboard-summary/${encodeURIComponent(id)}`),
};

// ------------------------------------------------------------------ practice

/** Separate accuracy for each homework, quiz, test and practice session, plus overall. */
export const PerformanceApi = {
  mine: (studentId: string) => apiRequest<Performance>(`/students/${encodeURIComponent(studentId)}/performance`),
};

/** Where a learner stopped, so they can continue later on any device. */
export const ResumeApi = {
  list: (studentId: string) => apiRequest<{ items: ResumeItem[] }>(`/students/${encodeURIComponent(studentId)}/resume`),
  get: (studentId: string, key: string) =>
    apiRequest<{ item: ResumeItem | null }>(`/students/${encodeURIComponent(studentId)}/resume/${encodeURIComponent(key)}`),
  save: (studentId: string, key: string, state: any, label?: string) =>
    apiRequest<{ item: ResumeItem }>(`/students/${encodeURIComponent(studentId)}/resume/${encodeURIComponent(key)}`,
      { method: 'PUT', body: { state, label } }),
  clear: (studentId: string, key: string) =>
    apiRequest<{ cleared: boolean }>(`/students/${encodeURIComponent(studentId)}/resume/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  history: (studentId: string, limit = 20) =>
    apiRequest<StudentHistory>(`/students/${encodeURIComponent(studentId)}/history?limit=${limit}`),
};

export const PracticeApi = {
  next: (studentId: string, lessonId: string, exclude: string[]) =>
    apiRequest<any>(`/next-question/${encodeURIComponent(studentId)}?lesson_id=${encodeURIComponent(lessonId)}&exclude=${encodeURIComponent(exclude.join(','))}`),
  answer: (studentId: string, questionId: string, answer: string, lessonId: string, exclude: string[]) =>
    apiRequest<any>('/answer', { body: { student_id: studentId, question_id: questionId, student_answer: answer, lesson_id: lessonId, exclude } }),
  lesson: (lessonId: string) => apiRequest<any>(`/lessons/${encodeURIComponent(lessonId)}`),
};

// ------------------------------------------------------------------ games

export const GameApi = {
  list: (studentId?: string, subject?: string) => {
    const q = [studentId ? `student_id=${encodeURIComponent(studentId)}` : '', subject ? `subject=${encodeURIComponent(subject)}` : '']
      .filter(Boolean).join('&');
    return apiRequest<{ games: GameInfo[]; badges: Badge[]; coins: number; levels: number }>(`/games${q ? `?${q}` : ''}`);
  },
  start: (gameId: string, studentId: string, level: number) =>
    apiRequest<GameSession>(`/games/${gameId}/start`, { body: { student_id: studentId, level } }),
  answer: (sessionId: string, challengeId: string, answer: string) =>
    apiRequest<GameAnswerResult>(`/games/sessions/${sessionId}/answer`, { body: { challenge_id: challengeId, answer } }),
  finish: (sessionId: string, timeTaken?: number) =>
    apiRequest<GameResult>(`/games/sessions/${sessionId}/finish`, { body: { time_taken_sec: timeTaken } }),
};

// ------------------------------------------------------------------ teachers

export const TeacherAuthApi = {
  requestOtp: (body: { name: string; mobile: string; purpose: 'register' | 'login'; school?: string }) =>
    apiRequest<{ sent: boolean; mobile_masked: string; expires_in_sec: number; dev_otp?: string; dev_note?: string }>(
      '/auth/teacher/request-otp', { body }),
  verifyOtp: (body: { mobile: string; purpose: 'register' | 'login'; code: string }) =>
    apiRequest<{ token: string; teacher: Teacher }>('/auth/teacher/verify-otp', { body }),
  me: (token: string) => apiRequest<{ teacher: Teacher }>('/auth/teacher/me', { token }),
  logout: (token: string) => apiRequest('/auth/teacher/logout', { method: 'POST', token }),
};

export const HomeworkApi = {
  engine: (t: string) => apiRequest<{ engine: 'claude' | 'ml-bank'; model?: string | null }>('/teacher/homework/engine', { token: t }),
  generate: (t: string, lessonId: string, count: number, conceptIds: string[] = [], kind: 'homework' | 'quiz' | 'test' = 'homework') =>
    apiRequest<HomeworkDraft>('/teacher/homework/generate', {
      token: t, body: { lesson_id: lessonId, count, concept_ids: conceptIds, kind }, timeoutMs: 120000 }),
  assign: (t: string, body: {
    lesson_id: string; kind?: 'homework' | 'quiz' | 'test'; title: string; instructions?: string; due_date?: string; time_limit_sec?: number | null;
    questions: HomeworkQuestion[]; student_ids?: string[]; add_practice?: boolean; practice_target?: number; practice_student_ids?: string[];
  }) => apiRequest<{ quiz: any; homework: any; practice: any }>('/teacher/homework/assign', { token: t, body }),
};

export const TeacherApi = {
  overview: (t: string) => apiRequest<{ teacher: Teacher; analytics: any }>('/teacher/overview', { token: t }),
  catalog: (t: string) => apiRequest<{ lessons: any[]; games: GameInfo[]; quizzes: any[]; levels: number }>('/teacher/catalog', { token: t }),
  students: (t: string) => apiRequest<{ students: Student[]; class_code: string }>('/teacher/students', { token: t }),
  addStudent: (t: string, body: any) => apiRequest<{ student: Student }>('/teacher/students', { token: t, body }),
  updateStudent: (t: string, id: string, body: any) =>
    apiRequest<{ student: Student }>(`/teacher/students/${id}`, { token: t, body, method: 'PUT' }),
  removeStudent: (t: string, id: string) => apiRequest(`/teacher/students/${id}`, { token: t, method: 'DELETE' }),
  studentProgress: (t: string, id: string) => apiRequest<any>(`/teacher/students/${id}/progress`, { token: t }),
  studentPerformance: (t: string, id: string) => apiRequest<Performance>(`/teacher/students/${id}/performance`, { token: t }),
  assignments: (t: string) => apiRequest<{ assignments: any[] }>('/teacher/assignments', { token: t }),
  assignment: (t: string, id: number) => apiRequest<any>(`/teacher/assignments/${id}`, { token: t }),
  createAssignment: (t: string, body: any) => apiRequest<any>('/teacher/assignments', { token: t, body }),
  deleteAssignment: (t: string, id: number) => apiRequest(`/teacher/assignments/${id}`, { token: t, method: 'DELETE' }),
  quizzes: (t: string) => apiRequest<{ quizzes: Quiz[] }>('/teacher/quizzes', { token: t }),
  quiz: (t: string, id: number) => apiRequest<{ quiz: Quiz & { submissions: any[] } }>(`/teacher/quizzes/${id}`, { token: t }),
  createQuiz: (t: string, body: any) => apiRequest<{ quiz: Quiz }>('/teacher/quizzes', { token: t, body }),
  updateQuiz: (t: string, id: number, body: any) => apiRequest<{ quiz: Quiz }>(`/teacher/quizzes/${id}`, { token: t, body, method: 'PUT' }),
  deleteQuiz: (t: string, id: number) => apiRequest(`/teacher/quizzes/${id}`, { token: t, method: 'DELETE' }),
  generateQuiz: (t: string, lessonId: string, count: number) =>
    apiRequest<{ questions: QuizQuestion[] }>('/teacher/quizzes/generate', { token: t, body: { lesson_id: lessonId, count } }),
};
