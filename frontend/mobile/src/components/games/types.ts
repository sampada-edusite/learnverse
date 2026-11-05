export type GameSubject = 'LANGUAGE' | 'MATHEMATICS' | 'SHAPES' | 'EVS';

export type GameMechanic =
  | 'SCHOOL_BELL_RUN'  // Unit 1: School Bell Run & Rhyme Adventure
  | 'RHYME_RIVER'      // Language: Matching rhyming water lilies / bubbles
  | 'NUMBER_TRAIN'     // Mathematics: Number sequencing & counting carriages
  | 'SHAPE_SORTER'     // Shapes: Sorting everyday objects into geometric shapes
  | 'CATEGORY_BASKET'; // EVS & Science: Categorizing items into labeled baskets

export interface GameOption {
  id: string;
  text: string;
  visual?: string; // Emoji, icon key, or visual cue
  isCorrect: boolean;
  feedbackHint?: string;
}

export interface GameChallenge {
  id: string;
  promptText: string;
  targetVisual?: string;
  targetWord?: string;
  options: GameOption[];
  hintText: string;
  correctExplanation: string;
  questionId?: string;
  conceptId?: string;
  challengeType?: 'ACTION_LEAP' | 'RHYME_STONES' | 'ROUTINE_KEY_ARRANGE' | 'BELL_ROPE_PULL';
}

export interface GameColorTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  cardBg: string;
  lightBg: string;
}

export interface GameDefinition {
  id: string;
  lessonId: string;
  lessonTitle: string;
  conceptId: string;
  conceptName: string;
  title: string;
  subtitle: string;
  subject: GameSubject;
  mechanic: GameMechanic;
  mascotEmoji: string;
  mascotName: string;
  instructions: string[];
  objective: string;
  challenges: GameChallenge[];
  theme: GameColorTheme;
}

export interface GameAttemptResult {
  gameId: string;
  lessonId: string;
  totalChallenges: number;
  correctCount: number;
  retriesUsed: number;
  starsEarned: number; // 1, 2, or 3 stars
  scorePercentage: number;
  timeSpentSeconds: number;
}
