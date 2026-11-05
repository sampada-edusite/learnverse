import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const STORAGE_KEY_API_URL = '@samsukh_api_url';

export const getBundlerHost = (): string | null => {
  try {
    const scriptURL: string = NativeModules?.SourceCode?.scriptURL || '';
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1]) {
        const host = match[1];
        if (host !== 'localhost' && host !== '127.0.0.1') {
          return host;
        }
      }
    }
  } catch {}
  return null;
};

// Default URL: auto-detect computer IP from Metro scriptURL, otherwise fallback based on platform
const detectedHost = getBundlerHost();
let currentApiUrl = detectedHost
  ? `http://${detectedHost}:8000`
  : Platform.OS === 'android'
  ? 'http://10.0.2.2:8000'
  : 'http://127.0.0.1:8000';

export const initApiUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
    if (saved && saved.trim()) {
      currentApiUrl = saved.trim();
    } else {
      const host = getBundlerHost();
      if (host) {
        currentApiUrl = `http://${host}:8000`;
      }
    }
  } catch (e) {
    console.error('Error loading API URL:', e);
  }
  return currentApiUrl;
};

export const getApiUrl = (): string => currentApiUrl;

export const setApiUrl = async (url: string): Promise<void> => {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  currentApiUrl = cleanUrl;
  try {
    await AsyncStorage.setItem(STORAGE_KEY_API_URL, cleanUrl);
  } catch (e) {
    console.error('Error saving API URL:', e);
  }
};

const STORAGE_KEY_UNLOCKED_GAMES = '@samsukh_unlocked_games_';

export async function getUnlockedGamesForStudent(studentId: string = 'student_001'): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEY_UNLOCKED_GAMES}${studentId}`);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {
    console.error('Error fetching unlocked games:', e);
  }
  return [];
}

export async function isGameUnlockedForStudent(studentId: string = 'student_001', lessonId: string): Promise<boolean> {
  const list = await getUnlockedGamesForStudent(studentId);
  return list.includes(lessonId);
}

export async function unlockGameForStudent(studentId: string = 'student_001', lessonId: string): Promise<string[]> {
  try {
    const currentList = await getUnlockedGamesForStudent(studentId);
    if (!currentList.includes(lessonId)) {
      const updated = [...currentList, lessonId];
      await AsyncStorage.setItem(`${STORAGE_KEY_UNLOCKED_GAMES}${studentId}`, JSON.stringify(updated));
      return updated;
    }
    return currentList;
  } catch (e) {
    console.error('Error saving unlocked game:', e);
    return [];
  }
}

export async function toggleGameUnlockForStudent(studentId: string = 'student_001', lessonId: string): Promise<boolean> {
  try {
    const currentList = await getUnlockedGamesForStudent(studentId);
    let updated: string[];
    let nowUnlocked: boolean;
    if (currentList.includes(lessonId)) {
      updated = currentList.filter(id => id !== lessonId);
      nowUnlocked = false;
    } else {
      updated = [...currentList, lessonId];
      nowUnlocked = true;
    }
    await AsyncStorage.setItem(`${STORAGE_KEY_UNLOCKED_GAMES}${studentId}`, JSON.stringify(updated));
    return nowUnlocked;
  } catch (e) {
    console.error('Error toggling game unlock:', e);
    return false;
  }
}

export interface ConceptItem {
  concept_id: string;
  name: string;
  objective: string;
  difficulty: string;
  question_count: number;
}

export interface LessonItem {
  lesson_id: string;
  class: number;
  subject: string;
  lesson_name: string;
  concepts: ConceptItem[];
  working_video_url?: string;
  working_video_title?: string;
}

export interface QuestionPayload {
  question_id: string;
  concept_id?: string;
  lesson_id?: string;
  question: string;
  question_type: string;
  options?: string[];
  hint?: string;
  difficulty: string;
  solving_video_url?: string;
  solving_video_title?: string;
}

export interface NextActivityResponse {
  student_id: string;
  activity_type: string;
  concept_id?: string;
  reason?: string;
  question?: QuestionPayload | null;
}

export interface AnswerResponsePayload {
  student_id: string;
  question_id: string;
  correctness: boolean;
  is_correct: boolean;
  feedback: string;
  mastery?: {
    accuracy: number;
    status: string;
  };
  next_activity?: {
    activity_type: string;
    concept_id?: string;
    question?: QuestionPayload;
  };
}

export interface WeakConcept {
  concept_id: string;
  concept_name: string;
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  accuracy: number;
  status: string;
}

export interface DashboardSummary {
  student_id: string;
  total_attempts: number;
  correct_attempts: number;
  overall_accuracy: number;
  weak_concepts_count: number;
  weak_concepts: WeakConcept[];
  next_activity?: NextActivityResponse;
  total_lessons: number;
}

// ----------------------------------------------------
// Fallback Data for Expo Mobile scanner offline support
// ----------------------------------------------------
export const FALLBACK_LESSONS: LessonItem[] = [
  {
    lesson_id: '1.1',
    class: 1,
    subject: 'English',
    lesson_name: 'My First Day',
    working_video_url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    working_video_title: 'My First Day — Animated Rhyme & Story Working Video',
    concepts: [
      { concept_id: 'C1', name: 'Action Words', objective: 'Identify movement verbs from the poem', difficulty: 'Easy', question_count: 3 },
      { concept_id: 'C2', name: 'Rhyming Words', objective: 'Pair rhyming words in poem', difficulty: 'Medium', question_count: 3 },
      { concept_id: 'C3', name: 'School Routine', objective: 'Understand school sequence & bell', difficulty: 'Easy', question_count: 3 },
      { concept_id: 'C4', name: 'Sight Words', objective: 'Recognize core vocabulary words', difficulty: 'Easy', question_count: 3 },
    ],
  },
  {
    lesson_id: '1.2',
    class: 1,
    subject: 'English',
    lesson_name: 'Clap Your Hands',
    working_video_url: 'https://www.youtube-nocookie.com/embed/tWe93wO0VmE',
    working_video_title: 'Clap Your Hands — Action Rhyme & Body Parts Working Video',
    concepts: [
      { concept_id: 'L1.2_C1', name: 'Number-Action Association', objective: 'Match numbers 1 to 5 with movements', difficulty: 'Easy', question_count: 3 },
      { concept_id: 'L1.2_C2', name: 'Body Parts & Actions', objective: 'Identify action verbs with body parts', difficulty: 'Easy', question_count: 3 },
      { concept_id: 'L1.2_C3', name: 'Rhyming Pairs', objective: 'Identify ending rhyming words', difficulty: 'Medium', question_count: 3 },
    ],
  },
  {
    lesson_id: '1.3',
    class: 1,
    subject: 'English',
    lesson_name: 'I Know My Alphabet',
    working_video_url: 'https://www.youtube-nocookie.com/embed/yZ8xMwVVZ2U',
    working_video_title: 'Alphabet Phonics & Letter Sounds Working Video',
    concepts: [
      { concept_id: 'L1.3_C1', name: 'Letter Recognition', objective: 'Identify capital & small letters A to Z', difficulty: 'Easy', question_count: 3 },
      { concept_id: 'L1.3_C2', name: 'Phonics & Letter Sounds', objective: 'Associate initial letter sounds with pictures', difficulty: 'Medium', question_count: 3 },
    ],
  },
  {
    lesson_id: '1.4',
    class: 1,
    subject: 'English',
    lesson_name: 'Let Us Read',
    working_video_url: 'https://www.youtube-nocookie.com/embed/UVHqQJATjKY',
    working_video_title: 'Sight Words & Word Families Solving Video',
    concepts: [
      { concept_id: 'L1.4_C1', name: 'Two-Letter Blends', objective: 'Read 2-letter sight words', difficulty: 'Easy', question_count: 3 },
    ],
  },
  {
    lesson_id: '1.5',
    class: 1,
    subject: 'English',
    lesson_name: 'Fun with Special Letters',
    working_video_url: 'https://www.youtube-nocookie.com/embed/9IoNM9nEpv4',
    working_video_title: 'Vowels Song (A, E, I, O, U) Working Video',
    concepts: [
      { concept_id: 'L1.5_C1', name: 'Vowels Identification', objective: 'Identify 5 vowel letters A, E, I, O, U', difficulty: 'Medium', question_count: 3 },
    ],
  },
  {
    lesson_id: '1.6',
    class: 1,
    subject: 'English',
    lesson_name: 'The Rainbow',
    working_video_url: 'https://www.youtube-nocookie.com/embed/EiYEy0rJm50',
    working_video_title: 'The Rainbow Colors & Sky Poem Working Video',
    concepts: [
      { concept_id: 'L1.6_C1', name: 'Rainbow Colors', objective: 'Identify 7 rainbow colors in sky', difficulty: 'Easy', question_count: 3 },
    ],
  },
];

export const FALLBACK_QUESTIONS: QuestionPayload[] = [
  // Lesson 1.1 Questions
  {
    question_id: 'Q1_C1',
    concept_id: 'C1',
    lesson_id: '1.1',
    question: "What action is paired with 'walk' in the second stanza? ('See me walk, See me ___')",
    question_type: 'Multiple Choice',
    options: ['grin', 'run', 'jump', 'sleep'],
    hint: 'It means to smile broadly.',
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    solving_video_title: 'Solving Video: Action Words (walk & grin)',
  },
  {
    question_id: 'Q2_C1',
    concept_id: 'C1',
    lesson_id: '1.1',
    question: 'Which two actions are mentioned in the first line and second line of the poem?',
    question_type: 'Short Answer',
    hint: 'They are fast movements shown on the path (skip, run).',
    difficulty: 'Medium',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    solving_video_title: 'Solving Video: Action Words (skip & run)',
  },
  {
    question_id: 'Q3_C1',
    concept_id: 'C1',
    lesson_id: '1.1',
    question: "Read aloud the action word that begins with the letter 'j' in the poem.",
    question_type: 'Voice Answer',
    hint: "Starts with 'j'. (jump)",
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    solving_video_title: 'Solving Video: Voice Pronunciation for Jump',
  },
  {
    question_id: 'Q1_C2',
    concept_id: 'C2',
    lesson_id: '1.1',
    question: "Which word in the poem rhymes with 'play'?",
    question_type: 'Multiple Choice',
    options: ['hurray', 'bell', 'grin', 'run'],
    hint: "It ends with the same sound as 'play' and Grade One.",
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    solving_video_title: 'Solving Video: Rhyming Words (play & hurray)',
  },
  {
    question_id: 'Q2_C2',
    concept_id: 'C2',
    lesson_id: '1.1',
    question: "Complete the rhyming pair from the poem: 'grin' and '___'.",
    question_type: 'Short Answer',
    hint: "'When the bell rings, I go ___.'",
    difficulty: 'Medium',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    solving_video_title: 'Solving Video: Rhyming Pairs (grin & in)',
  },
  {
    question_id: 'Q3_C2',
    concept_id: 'C2',
    lesson_id: '1.1',
    question: "Say aloud the word that rhymes with 'run' in stanza one.",
    question_type: 'Voice Answer',
    hint: "'I'm going to school like ___.'",
    difficulty: 'Medium',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    solving_video_title: 'Solving Video: Voice Solution (run & everyone)',
  },

  // Lesson 1.2 Questions
  {
    question_id: 'Q1_L1.2_C1',
    concept_id: 'L1.2_C1',
    lesson_id: '1.2',
    question: "What action should you do when the rhyme says 'one'?",
    question_type: 'Multiple Choice',
    options: ['Clap your hands and jump up once', 'Nod your head and buckle your shoe', 'Turn around and dive', 'Sit down quietly'],
    hint: 'It is the first action in the poem.',
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    solving_video_title: 'Solving Video: Lesson 1.2 Action Matching',
  },
  {
    question_id: 'Q2_L1.2_C1',
    concept_id: 'L1.2_C1',
    lesson_id: '1.2',
    question: "What do you do when the rhyme says 'two'?",
    question_type: 'Short Answer',
    hint: 'It involves moving your head and fixing footwear (Nod head & buckle shoe).',
    difficulty: 'Medium',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    solving_video_title: 'Solving Video: Action for number two',
  },
  {
    question_id: 'Q1_L1.2_C2',
    concept_id: 'L1.2_C2',
    lesson_id: '1.2',
    question: 'What body part do you touch when you stamp your foot?',
    question_type: 'Multiple Choice',
    options: ['knee', 'hands', 'ears', 'eyes'],
    hint: 'It is part of your leg.',
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    solving_video_title: 'Solving Video: Body Parts & Actions',
  },

  // Lesson 1.3 Questions
  {
    question_id: 'Q1_L1.3_C1',
    concept_id: 'L1.3_C1',
    lesson_id: '1.3',
    question: "Which small letter matches with capital letter 'B'?",
    question_type: 'Multiple Choice',
    options: ['b', 'd', 'p', 'q'],
    hint: 'It is written right beside capital B.',
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/75p-N9YKqNo',
    solving_video_title: 'Solving Video: Capital & Small Alphabet Match',
  },
  {
    question_id: 'Q2_L1.3_C1',
    concept_id: 'L1.3_C1',
    lesson_id: '1.3',
    question: "Which letter pair comes right after 'Kk'?",
    question_type: 'Short Answer',
    hint: 'Shown with a lemon picture (Ll).',
    difficulty: 'Medium',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/75p-N9YKqNo',
    solving_video_title: 'Solving Video: Phonics Order Ll',
  },

  // Lesson 1.4 Questions
  {
    question_id: 'Q1_L1.4_C1',
    concept_id: 'L1.4_C1',
    lesson_id: '1.4',
    question: "Which 2-letter word is spelled 'a-t'?",
    question_type: 'Multiple Choice',
    options: ['at', 'in', 'on', 'up'],
    hint: 'It starts with letter a.',
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/BELlZKpi1Zs',
    solving_video_title: 'Solving Video: 2-Letter Sight Words',
  },

  // Lesson 1.5 Questions
  {
    question_id: 'Q1_L1.5_C1',
    concept_id: 'L1.5_C1',
    lesson_id: '1.5',
    question: 'Which group contains the 5 special vowel letters?',
    question_type: 'Multiple Choice',
    options: ['a, e, i, o, u', 'b, c, d, f, g', 'x, y, z', 'p, q, r, s, t'],
    hint: 'They are the special musical letters of the alphabet.',
    difficulty: 'Medium',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/arQn_aON0-0',
    solving_video_title: 'Solving Video: The 5 Vowels (A E I O U)',
  },

  // Lesson 1.6 Questions
  {
    question_id: 'Q1_L1.6_C1',
    concept_id: 'L1.6_C1',
    lesson_id: '1.6',
    question: 'How many colors appear in the rainbow high in the sky?',
    question_type: 'Multiple Choice',
    options: ['7 colors', '3 colors', '10 colors', '5 colors'],
    hint: 'Violet, Indigo, Blue, Green, Yellow, Orange, Red.',
    difficulty: 'Easy',
    solving_video_url: 'https://www.youtube-nocookie.com/embed/tRNy2i75tCc',
    solving_video_title: 'Solving Video: Rainbow Colors in Sky',
  },
];

let fallbackQuestionIndex = 0;

// Fetch helper with timeout for instant response on Expo mobile scanner
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 3500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// 1. Fetch lessons
export async function getLessons(): Promise<LessonItem[]> {
  try {
    const baseUrl = getApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/lessons`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.lessons && data.lessons.length > 0 ? data.lessons : FALLBACK_LESSONS;
  } catch (err) {
    console.warn('Expo API offline fallback activated for getLessons:', err);
    return FALLBACK_LESSONS;
  }
}

// 2. Fetch dashboard summary
export async function getDashboardSummary(studentId: string = 'student_001'): Promise<DashboardSummary | null> {
  try {
    const baseUrl = getApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/dashboard-summary/${encodeURIComponent(studentId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Expo API offline fallback activated for getDashboardSummary:', err);
    return {
      student_id: studentId,
      total_attempts: 12,
      correct_attempts: 10,
      overall_accuracy: 83.3,
      weak_concepts_count: 1,
      weak_concepts: [
        {
          concept_id: 'C2',
          concept_name: 'Rhyming Words',
          total_attempts: 4,
          correct_attempts: 2,
          incorrect_attempts: 2,
          accuracy: 50.0,
          status: 'Learning',
        },
      ],
      total_lessons: 6,
    };
  }
}

// 3. Get next question
// 3. Get next question with anti-repetition filter
export async function getNextQuestion(
  studentId: string = 'student_001',
  lessonId?: string,
  excludeQuestionIds: string[] = []
): Promise<NextActivityResponse | null> {
  try {
    const baseUrl = getApiUrl();
    const url = lessonId
      ? `${baseUrl}/next-question/${encodeURIComponent(studentId)}?lesson_id=${encodeURIComponent(lessonId)}`
      : `${baseUrl}/next-question/${encodeURIComponent(studentId)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.question && excludeQuestionIds.includes(data.question.question_id)) {
      const unattempted = FALLBACK_QUESTIONS.filter(
        (fq) => (!lessonId || fq.lesson_id === lessonId) && !excludeQuestionIds.includes(fq.question_id)
      );
      if (unattempted.length > 0) {
        return {
          student_id: studentId,
          activity_type: 'adaptive',
          concept_id: unattempted[0].concept_id,
          question: unattempted[0],
        };
      } else {
        return {
          student_id: studentId,
          activity_type: 'lesson_completed',
          reason: 'Awesome job! You have answered all available questions for this lesson!',
          question: null,
        };
      }
    }
    return data;
  } catch (err) {
    console.warn('Expo API offline fallback activated for getNextQuestion:', err);
    const unattempted = FALLBACK_QUESTIONS.filter((q) => {
      const matchLesson = !lessonId || q.lesson_id === lessonId || (lessonId === '1.1' && (!q.lesson_id || q.lesson_id === '1.1'));
      const notExcluded = !excludeQuestionIds.includes(q.question_id);
      return matchLesson && notExcluded;
    });

    if (unattempted.length === 0) {
      return {
        student_id: studentId,
        activity_type: 'lesson_completed',
        reason: 'Awesome job! You have answered all available questions for this lesson!',
        question: null,
      };
    }

    const q = unattempted[0];
    return {
      student_id: studentId,
      activity_type: 'adaptive',
      concept_id: q.concept_id,
      question: q,
    };
  }
}

// 4. Submit student answer
export async function submitStudentAnswer(
  studentId: string,
  questionId: string,
  studentAnswer: string,
  lessonId?: string
): Promise<AnswerResponsePayload> {
  try {
    const baseUrl = getApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        question_id: questionId,
        student_answer: studentAnswer,
        lesson_id: lessonId,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Failed to submit answer (HTTP ${res.status})`);
    }

    return await res.json();
  } catch (err: any) {
    console.warn('Expo API offline fallback activated for submitStudentAnswer:', err);

    const EXPECTED_MAP: Record<string, string> = {
      Q1_C1: 'grin',
      Q2_C1: 'skip, run',
      Q3_C1: 'jump',
      Q1_C2: 'hurray',
      Q2_C2: 'in',
      Q3_C2: 'everyone',
      Q1_C3: 'The bell rings',
      Q2_C3: 'Grade One',
      Q3_C3: 'School',
      Q1_C4: 'bell',
      Q2_C4: 'grin',
      Q3_C4: 'hurray',
      'Q1_L1.2_C1': 'Clap your hands and jump up once',
      'Q2_L1.2_C1': 'Nod your head and buckle your shoe',
      'Q3_L1.2_C1': 'five',
      'Q1_L1.2_C2': 'knee',
      'Q2_L1.2_C2': 'floor',
      'Q3_L1.2_C2': 'nod',
      'Q1_L1.2_C3': 'shoe',
      'Q2_L1.2_C3': 'floor',
      'Q3_L1.2_C3': 'dive',
      'Q1_L1.2_C4': 'Blink your eyes',
      'Q2_L1.2_C4': 'head',
      'Q3_L1.2_C4': 'buckle',
      'Q1_L1.3_C1': 'b',
      'Q1_L1.3_C2': 'Aeroplane',
      'Q1_L1.3_C3': 'The child with the card having the same sound (small letter)',
      'Q1_L1.3_C4': 'bed',
      'Q1_L1.4_C1': 'we',
      'Q1_L1.4_C2': 'can',
      'Q1_L1.4_C3': 'bat',
      'Q1_L1.4_C4': 'man - go',
      'Q1_L1.5_C1': '5 (a, e, i, o, u)',
      'Q1_L1.5_C2': 'u',
      'Q1_L1.5_C3': 'u',
      'Q1_L1.6_C1': 'Blue',
      'Q1_L1.6_C2': 'peeping out',
      'Q1_L1.6_C3': 'an',
      'Q1_L1.6_C4': 'It is a definite and unique thing in the world',
    };

    const cleanStr = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/^\s*option\s+[a-d1-4][\.\-\:\)]?\s*/i, '')
        .replace(/^\s*\(?[a-d1-4]\)?[\.\-\:\)]\s*/i, '')
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const targetQ = FALLBACK_QUESTIONS.find((item) => item.question_id === questionId);
    const expected = EXPECTED_MAP[questionId] || (targetQ?.options ? targetQ.options[0] : 'grin');

    const sNorm = cleanStr(studentAnswer);
    const eNorm = cleanStr(expected);

    // Number word equivalence
    const numMap: Record<string, string> = { '1': 'one', 'one': '1', 'first': '1', '2': 'two', 'two': '2', '5': '5', 'five': '5' };
    const sWithNum = sNorm.split(' ').map((w) => numMap[w] || w).join(' ');
    const eWithNum = eNorm.split(' ').map((w) => numMap[w] || w).join(' ');

    const isCorrect =
      sNorm === eNorm ||
      sWithNum === eWithNum ||
      (eNorm.length >= 3 && sNorm.includes(eNorm)) ||
      (sNorm.length >= 3 && eNorm.includes(sNorm));

    const nextQ = FALLBACK_QUESTIONS[(fallbackQuestionIndex + 1) % FALLBACK_QUESTIONS.length];

    return {
      student_id: studentId,
      question_id: questionId,
      correctness: isCorrect,
      is_correct: isCorrect,
      feedback: isCorrect
        ? `Great job! "${studentAnswer}" is correct!`
        : `Almost! The correct answer is "${expected}". Watch the solving video to see how it works!`,
      mastery: {
        accuracy: isCorrect ? 90.0 : 65.0,
        status: isCorrect ? 'Mastered' : 'Needs Practice',
      },
      next_activity: {
        activity_type: 'adaptive',
        concept_id: nextQ.concept_id,
        question: nextQ,
      },
    };
  }
}

// 5. Fetch weak concepts
export async function getWeakConcepts(studentId: string = 'student_001'): Promise<WeakConcept[]> {
  try {
    const baseUrl = getApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/weak-concepts/${encodeURIComponent(studentId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.weak_concepts || [];
  } catch (err) {
    console.warn('Expo API offline fallback activated for getWeakConcepts:', err);
    return [
      {
        concept_id: 'C2',
        concept_name: 'Rhyming Words',
        total_attempts: 4,
        correct_attempts: 2,
        incorrect_attempts: 2,
        accuracy: 50.0,
        status: 'Learning',
      },
    ];
  }
}

// 6. Game Attempts Persistence & Mastery Integration
export interface ChallengeDetailPayload {
  challenge_index: number;
  question_id?: string;
  concept_id?: string;
  student_answer?: string;
  is_correct: boolean;
  attempts_count: number;
}

export interface GameAttemptPayload {
  student_id: string;
  game_id: string;
  lesson_id?: string;
  score: number;
  stars: number;
  completed_challenges: number;
  total_challenges: number;
  is_completed?: boolean;
  challenges?: ChallengeDetailPayload[];
  record_mastery?: boolean;
}

export interface GameAttemptRecord {
  game_attempt_id: number;
  student_id: string;
  game_id: string;
  lesson_id: string;
  score: number;
  stars: number;
  completed_challenges: number;
  total_challenges: number;
  is_completed: boolean;
  details?: any;
  created_at: string;
  mastery_attempts_recorded?: number;
}

const STORAGE_KEY_GAME_ATTEMPTS = '@samsukh_game_attempts_';

async function cacheLocalGameAttempt(studentId: string, record: GameAttemptRecord): Promise<void> {
  try {
    const key = `${STORAGE_KEY_GAME_ATTEMPTS}${studentId}`;
    const raw = await AsyncStorage.getItem(key);
    const list: GameAttemptRecord[] = raw ? JSON.parse(raw) : [];
    list.unshift(record);
    await AsyncStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.error('Error caching game attempt locally:', e);
  }
}

export async function saveGameAttempt(payload: GameAttemptPayload): Promise<GameAttemptRecord> {
  const fallbackRecord: GameAttemptRecord = {
    game_attempt_id: Date.now(),
    student_id: payload.student_id,
    game_id: payload.game_id,
    lesson_id: payload.lesson_id || '1.1',
    score: payload.score,
    stars: payload.stars,
    completed_challenges: payload.completed_challenges,
    total_challenges: payload.total_challenges,
    is_completed: payload.is_completed ?? true,
    details: payload.challenges,
    created_at: new Date().toISOString(),
  };

  try {
    const baseUrl = getApiUrl();
    const res = await fetchWithTimeout(`${baseUrl}/game/save-attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      await cacheLocalGameAttempt(payload.student_id, data);
      return data;
    }
  } catch (err) {
    console.warn('Backend saveGameAttempt offline or unavailable, saving to local cache:', err);
  }

  await cacheLocalGameAttempt(payload.student_id, fallbackRecord);
  return fallbackRecord;
}

export async function getGameAttempts(
  studentId: string = 'student_001',
  gameId?: string
): Promise<GameAttemptRecord[]> {
  try {
    const baseUrl = getApiUrl();
    const url = gameId
      ? `${baseUrl}/game/attempts/${encodeURIComponent(studentId)}?game_id=${encodeURIComponent(gameId)}`
      : `${baseUrl}/game/attempts/${encodeURIComponent(studentId)}`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.attempts)) return data.attempts;
    }
  } catch (err) {
    console.warn('Backend getGameAttempts offline, reading from local cache:', err);
  }

  try {
    const key = `${STORAGE_KEY_GAME_ATTEMPTS}${studentId}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const list: GameAttemptRecord[] = JSON.parse(raw);
      if (gameId) return list.filter((a) => a.game_id === gameId);
      return list;
    }
  } catch (e) {
    console.error('Error reading local game attempts:', e);
  }
  return [];
}

