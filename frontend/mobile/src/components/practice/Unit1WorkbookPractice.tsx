import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import {
  BookOpen,
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowRight,
  Check,
  RotateCcw,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  Gamepad2,
  Mic,
  MicOff,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { submitStudentAnswer, AnswerResponsePayload, unlockGameForStudent } from '../../config/api';
import { speakText, stopSpeech, setSpeechMuted, getSpeechMuted } from '../../utils/speechHelper';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export type WorkbookFormat =
  | 'listen_and_answer'
  | 'match_pairs'
  | 'fill_blank'
  | 'arrange_words'
  | 'picture_understanding'
  | 'put_events_in_order'
  | 'short_answer';

export interface WorkbookQuestion {
  id: string;
  dbQuestionId: string;
  conceptId: string;
  exerciseNumber: number;
  format: WorkbookFormat;
  title: string;
  instructions: string;
  questionText: string;
  audioPrompt: string;
  hint: string;
  explanation: string;
  expectedAnswer: string;
  // Specific data per format
  matchPairsData?: {
    left: { id: string; label: string; pairId: string }[];
    right: { id: string; label: string; pairId: string }[];
  };
  fillBlankData?: {
    sentenceBefore: string;
    sentenceAfter: string;
    tiles: string[];
  };
  arrangeWordsData?: {
    shuffledTiles: string[];
    targetSentence: string;
  };
  pictureData?: {
    imageType: 'grin_student' | 'bell_tower' | 'skipping_path';
    options: { id: string; label: string; isCorrect: boolean }[];
  };
  eventsOrderData?: {
    events: { id: string; text: string; correctOrder: number }[];
  };
  listenData?: {
    spokenText: string;
    options: { id: string; label: string; isCorrect: boolean }[];
  };
  shortAnswerData?: {
    wordBank: string[];
    placeholder: string;
  };
}

// 7 GENUINELY DIFFERENT WORKBOOK ACTIVITIES STRICTLY GROUNDED IN LESSON 1.1 "MY FIRST DAY"
export const UNIT1_WORKBOOK_QUESTIONS: WorkbookQuestion[] = [
  // 1. Match the Pairs
  {
    id: 'wb_1_match',
    dbQuestionId: 'Q7_L1.1_C2',
    conceptId: 'C2',
    exerciseNumber: 1,
    format: 'match_pairs',
    title: 'Exercise 1: Match the Action Words to Meanings',
    instructions: 'Tap a word on the left, then tap its matching meaning on the right!',
    questionText: 'Connect each word from the poem with what it means or does:',
    audioPrompt: 'Connect each action word from the poem to its matching meaning.',
    hint: 'Think about what Raju does on his first day: walk with his feet, grin with a big smile, and ring the bell!',
    explanation: 'Splendid! "Grin" means a big happy smile, "walk" is moving your feet, "bell" rings ding-dong, and "school" is our place to learn!',
    expectedAnswer: 'grin-smile,walk-feet,bell-rings,school-learn',
    matchPairsData: {
      left: [
        { id: 'l1', label: 'grin 😄', pairId: 'p_grin' },
        { id: 'l2', label: 'walk 🚶', pairId: 'p_walk' },
        { id: 'l3', label: 'bell 🔔', pairId: 'p_bell' },
        { id: 'l4', label: 'school 🏫', pairId: 'p_school' },
      ],
      right: [
        { id: 'r1', label: 'Big, happy smile 😊', pairId: 'p_grin' },
        { id: 'r2', label: 'Step with feet 👟', pairId: 'p_walk' },
        { id: 'r3', label: 'Rings ding-dong 🎶', pairId: 'p_bell' },
        { id: 'r4', label: 'Place where we learn 📚', pairId: 'p_school' },
      ],
    },
  },

  // 2. Fill in the Blank using Word Tiles
  {
    id: 'wb_2_fill',
    dbQuestionId: 'Q8_L1.1_C3',
    conceptId: 'C3',
    exerciseNumber: 2,
    format: 'fill_blank',
    title: 'Exercise 2: Complete the Notebook Sentence',
    instructions: 'Tap a word tile from the tray to snap it into the missing space!',
    questionText: 'Complete the poem line from Stanza 2:',
    audioPrompt: 'Complete the line: When the bell rings, I go blank.',
    hint: 'Look at Stanza 2: "When the bell rings, I go in!"',
    explanation: 'Great job! The poem line is: "When the bell rings, I go in."',
    expectedAnswer: 'in',
    fillBlankData: {
      sentenceBefore: 'When the bell rings, I go ',
      sentenceAfter: '.',
      tiles: ['in', 'out', 'far', 'sky'],
    },
  },

  // 3. Arrange the Words to form a sentence
  {
    id: 'wb_3_arrange',
    dbQuestionId: 'Q1_C1',
    conceptId: 'C1',
    exerciseNumber: 3,
    format: 'arrange_words',
    title: 'Exercise 3: Put Words in Sentence Order',
    instructions: 'Tap the shuffled tiles in the right order to form the poem sentence on the line:',
    questionText: 'Put the words in order to form Line 3 of Stanza 1:',
    audioPrompt: 'Put the words in order: I am going to school.',
    hint: 'Start with "I\'m", then what you are doing ("going"), then "to school"!',
    explanation: 'Perfect sentence! "I\'m going to school, like everyone!"',
    expectedAnswer: "I'm going to school",
    arrangeWordsData: {
      shuffledTiles: ['to', 'school', "I'm", 'going'],
      targetSentence: "I'm going to school",
    },
  },

  // 4. Picture Understanding
  {
    id: 'wb_4_picture',
    dbQuestionId: 'Q11_L1.1_C4',
    conceptId: 'C4',
    exerciseNumber: 4,
    format: 'picture_understanding',
    title: 'Exercise 4: Picture Reading & Understanding',
    instructions: 'Study the illustration below and answer what is happening in the picture!',
    questionText: 'Look at the happy student! The poem says: "See me walk, See me grin!" What does the word "grin" mean?',
    audioPrompt: 'Look at the student. What does the word grin mean?',
    hint: 'Look closely at Raju\'s face! His lips are stretched wide in a cheerful smile.',
    explanation: 'Correct! A grin is a wide, joyful smile showing how excited Raju is for Grade One!',
    expectedAnswer: 'A big smile',
    pictureData: {
      imageType: 'grin_student',
      options: [
        { id: 'pic_1', label: 'A big, joyful smile 😄', isCorrect: true },
        { id: 'pic_2', label: 'To shout loudly 📢', isCorrect: false },
        { id: 'pic_3', label: 'To cry softly 😢', isCorrect: false },
        { id: 'pic_4', label: 'To sleep quietly 😴', isCorrect: false },
      ],
    },
  },

  // 5. Put Events in Order
  {
    id: 'wb_5_events',
    dbQuestionId: 'Q9_L1.1_C3',
    conceptId: 'C3',
    exerciseNumber: 5,
    format: 'put_events_in_order',
    title: 'Exercise 5: Number the Daily School Events (1, 2, 3)',
    instructions: 'Tap the events in the order they happen in the poem: 1st, 2nd, then 3rd!',
    questionText: 'Arrange these 3 school routine steps in proper order:',
    audioPrompt: 'Arrange these three events in the order they happen in the poem.',
    hint: 'First you skip along the road, then the school bell rings, then you step inside the classroom!',
    explanation: 'Spot on! First Raju skips on the path, then the bell rings ding-dong, then he walks inside Grade One!',
    expectedAnswer: '2, 1, 3',
    eventsOrderData: {
      events: [
        { id: 'ev_1', text: 'The school bell rings ding-dong 🔔', correctOrder: 2 },
        { id: 'ev_2', text: 'Skipping and running on the path 🏃', correctOrder: 1 },
        { id: 'ev_3', text: 'Going inside the classroom 🚪', correctOrder: 3 },
      ],
    },
  },

  // 6. Listen and Answer (Spoken Audio Prompt)
  {
    id: 'wb_6_listen',
    dbQuestionId: 'Q3_C3',
    conceptId: 'C3',
    exerciseNumber: 6,
    format: 'listen_and_answer',
    title: 'Exercise 6: Listen & Answer Spoken Question',
    instructions: 'Listen to the audio question by tapping the speaker, then pick or speak the answer!',
    questionText: 'Listen to Raju: "Where is the child going with everyone?"',
    audioPrompt: 'Where is the child going with everyone? Listen to the poem: I am going to school like everyone.',
    hint: 'Listen carefully: "I\'m going to school, like everyone!"',
    explanation: 'Super hearing! The child is going to School like everyone!',
    expectedAnswer: 'School',
    listenData: {
      spokenText: 'Where is the child going with everyone? I am going to school like everyone.',
      options: [
        { id: 'opt_school', label: 'School 🏫', isCorrect: true },
        { id: 'opt_market', label: 'Market 🛒', isCorrect: false },
        { id: 'opt_park', label: 'Water Park 🏊', isCorrect: false },
        { id: 'opt_zoo', label: 'Forest Zoo 🦁', isCorrect: false },
      ],
    },
  },

  // 7. Short-Answer Practice (Interactive Word Bank)
  {
    id: 'wb_7_short',
    dbQuestionId: 'Q2_C3',
    conceptId: 'C3',
    exerciseNumber: 7,
    format: 'short_answer',
    title: 'Exercise 7: Short-Answer Practice',
    instructions: 'Tap a helper tile or type the answer on the notebook ruled line:',
    questionText: 'What grade is the child entering in the poem? ("I\'m in Grade ___!")',
    audioPrompt: 'What grade is the child entering in the poem?',
    hint: 'Look at the last line: "I\'m in Grade One! Hip, hip, hurray!"',
    explanation: 'Hip, hip, hurray! You are in Grade One!',
    expectedAnswer: 'Grade One',
    shortAnswerData: {
      wordBank: ['Grade One', 'Grade Two', 'Grade Three', 'KG'],
      placeholder: 'Type or tap Grade One...',
    },
  },
];

interface Unit1WorkbookPracticeProps {
  studentId?: string;
  studentName?: string;
  onClose?: () => void;
  onGameUnlocked?: (lessonId: string) => void;
  onOpenGame?: (game: any) => void;
}

export const Unit1WorkbookPractice: React.FC<Unit1WorkbookPracticeProps> = ({
  studentId = 'student_001',
  studentName = 'Learner',
  onClose,
  onGameUnlocked,
  onOpenGame,
}) => {
  const reduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(getSpeechMuted());
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    text: string;
    explanation: string;
    accuracy?: number;
  } | null>(null);

  // Completed tracking
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [isCompletedSession, setIsCompletedSession] = useState<boolean>(false);

  // State per question format
  // Format 1: Match pairs
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<{ [leftId: string]: string }>({});

  // Format 2: Fill in blank
  const [selectedBlankTile, setSelectedBlankTile] = useState<string | null>(null);

  // Format 3: Arrange words
  const [placedTiles, setPlacedTiles] = useState<string[]>([]);

  // Format 4: Picture understanding
  const [selectedPictureOption, setSelectedPictureOption] = useState<string | null>(null);

  // Format 5: Put events in order
  const [orderedEventIds, setOrderedEventIds] = useState<string[]>([]);

  // Format 6: Listen & answer
  const [selectedListenOption, setSelectedListenOption] = useState<string | null>(null);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);

  // Format 7: Short answer
  const [shortAnswerText, setShortAnswerText] = useState<string>('');

  const currentQ = UNIT1_WORKBOOK_QUESTIONS[currentIndex];

  // Auto-play question audio on exercise change if not muted
  useEffect(() => {
    // Reset local format states
    setSelectedLeft(null);
    setMatchedPairs({});
    setSelectedBlankTile(null);
    setPlacedTiles([]);
    setSelectedPictureOption(null);
    setOrderedEventIds([]);
    setSelectedListenOption(null);
    setShortAnswerText('');
    setShowHint(false);
    setFeedback(null);

    // Speak title & instruction
    if (!isMuted) {
      handlePlayAudio(currentQ.audioPrompt);
    }
    return () => {
      stopSpeech();
    };
  }, [currentIndex]);

  const handlePlayAudio = (textToSpeak: string) => {
    setIsPlayingAudio(true);
    speakText(textToSpeak, {
      onStart: () => setIsPlayingAudio(true),
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setSpeechMuted(nextMuted);
    if (nextMuted) {
      setIsPlayingAudio(false);
    }
  };

  // -------------------------------------------------------------
  // INTERACTION HANDLERS FOR EACH FORMAT
  // -------------------------------------------------------------

  // 1. Match Pairs
  const handleLeftTap = (leftId: string) => {
    setSelectedLeft(leftId);
  };

  const handleRightTap = (rightId: string) => {
    if (!selectedLeft) return;
    setMatchedPairs((prev) => ({
      ...prev,
      [selectedLeft]: rightId,
    }));
    setSelectedLeft(null);
  };

  const handleRemovePair = (leftId: string) => {
    setMatchedPairs((prev) => {
      const copy = { ...prev };
      delete copy[leftId];
      return copy;
    });
  };

  // 2. Fill Blank
  const handleTileSelect = (tile: string) => {
    setSelectedBlankTile(tile);
  };

  // 3. Arrange Words
  const handleTileClickToPlace = (tile: string) => {
    if (placedTiles.includes(tile)) return;
    setPlacedTiles((prev) => [...prev, tile]);
  };

  const handleRemovePlacedTile = (idx: number) => {
    setPlacedTiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // 4. Events Order
  const handleEventOrderToggle = (eventId: string) => {
    setOrderedEventIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      } else {
        return [...prev, eventId];
      }
    });
  };

  // 6. Voice Recognition Sim
  const handleMicSim = () => {
    if (isListeningMic) {
      setIsListeningMic(false);
      return;
    }
    setIsListeningMic(true);
    setTimeout(() => {
      setIsListeningMic(false);
      setSelectedListenOption('School');
    }, 1500);
  };

  // -------------------------------------------------------------
  // VALIDATE & SUBMIT WORKBOOK ANSWER
  // -------------------------------------------------------------
  const handleCheckAnswer = async () => {
    let studentAns = '';
    let isCorrectLocal = false;

    switch (currentQ.format) {
      case 'match_pairs': {
        const leftItems = currentQ.matchPairsData?.left || [];
        const rightItems = currentQ.matchPairsData?.right || [];
        // Check if all left items matched with their pairId partner
        let allCorrect = leftItems.length > 0 && Object.keys(matchedPairs).length === leftItems.length;
        leftItems.forEach((l) => {
          const matchedRightId = matchedPairs[l.id];
          const matchedRight = rightItems.find((r) => r.id === matchedRightId);
          if (!matchedRight || matchedRight.pairId !== l.pairId) {
            allCorrect = false;
          }
        });
        isCorrectLocal = allCorrect;
        studentAns = allCorrect ? currentQ.expectedAnswer : 'unmatched';
        break;
      }
      case 'fill_blank': {
        studentAns = (selectedBlankTile || '').trim().toLowerCase();
        isCorrectLocal = studentAns === currentQ.expectedAnswer.toLowerCase();
        break;
      }
      case 'arrange_words': {
        studentAns = placedTiles.join(' ').trim();
        isCorrectLocal =
          studentAns.toLowerCase() === currentQ.arrangeWordsData?.targetSentence.toLowerCase();
        break;
      }
      case 'picture_understanding': {
        const selectedOpt = currentQ.pictureData?.options.find(
          (o) => o.id === selectedPictureOption
        );
        isCorrectLocal = selectedOpt?.isCorrect ?? false;
        studentAns = selectedOpt?.label || '';
        break;
      }
      case 'put_events_in_order': {
        // Expected order: ev_2, ev_1, ev_3 (2, 1, 3)
        const expectedOrder = ['ev_2', 'ev_1', 'ev_3'];
        isCorrectLocal =
          orderedEventIds.length === 3 &&
          orderedEventIds.every((id, idx) => id === expectedOrder[idx]);
        studentAns = isCorrectLocal ? '2, 1, 3' : orderedEventIds.join(', ');
        break;
      }
      case 'listen_and_answer': {
        isCorrectLocal =
          (selectedListenOption || '').toLowerCase().includes('school');
        studentAns = selectedListenOption || '';
        break;
      }
      case 'short_answer': {
        const clean = shortAnswerText.trim().toLowerCase();
        isCorrectLocal =
          clean === 'grade one' || clean === 'one' || clean === 'grade 1' || clean === '1';
        studentAns = shortAnswerText.trim();
        break;
      }
    }

    setIsSubmitting(true);
    let backendAccuracy = 100;

    try {
      // Connect to real backend API and database mastery engine!
      const res: AnswerResponsePayload = await submitStudentAnswer(
        studentId,
        currentQ.dbQuestionId,
        isCorrectLocal ? currentQ.expectedAnswer : 'wrong_attempt',
        '1.1'
      );
      if (res.mastery?.accuracy) {
        backendAccuracy = res.mastery.accuracy;
      }
    } catch (e) {
      console.warn('Workbook submit fallback:', e);
    } finally {
      setIsSubmitting(false);
    }

    if (isCorrectLocal) {
      setFeedback({
        isCorrect: true,
        text: 'Page Answer Correct! ⭐',
        explanation: currentQ.explanation,
        accuracy: backendAccuracy,
      });
      setScores((prev) => [...prev, 100]);
      if (!isMuted) {
        handlePlayAudio(currentQ.explanation);
      }
    } else {
      setFeedback({
        isCorrect: false,
        text: 'Take Another Look! 💡',
        explanation: currentQ.hint || 'Review the poem line and try again.',
        accuracy: backendAccuracy,
      });
      setScores((prev) => [...prev, 0]);
      if (!isMuted) {
        handlePlayAudio('Take another look! Raju is here to help you.');
      }
    }
  };

  const handleNextPage = () => {
    const nextIdx = currentIndex + 1;
    setCompletedExercises((prev) => [...prev, currentQ.id]);

    if (nextIdx >= UNIT1_WORKBOOK_QUESTIONS.length) {
      // Workbook session completed! Unlock the game!
      setIsCompletedSession(true);
      unlockGameForStudent(studentId, '1.1');
      if (onGameUnlocked) {
        onGameUnlocked('1.1');
      }
      if (!isMuted) {
        handlePlayAudio('Hip, hip, hurray! You completed the Unit 1 Workbook! Now play the Adventure Game!');
      }
    } else {
      setCurrentIndex(nextIdx);
    }
  };

  const handleRestartWorkbook = () => {
    setCurrentIndex(0);
    setScores([]);
    setCompletedExercises([]);
    setIsCompletedSession(false);
  };

  // -------------------------------------------------------------
  // RENDER WORKBOOK COMPLETED CERTIFICATE
  // -------------------------------------------------------------
  if (isCompletedSession) {
    const correctCount = scores.filter((s) => s === 100).length;
    const finalScore = Math.round((correctCount / UNIT1_WORKBOOK_QUESTIONS.length) * 100);

    return (
      <View style={styles.workbookCard}>
        {/* Notebook Spiral Header */}
        <View style={styles.spiralHeader}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((ring) => (
            <View key={ring} style={styles.spiralRing} />
          ))}
        </View>

        <View style={styles.completionCertificate}>
          <View style={styles.trophyCircle}>
            <Award size={48} color="#D97706" />
          </View>

          <Text style={styles.certHeading}>Workbook Completed! 🎓</Text>
          <Text style={styles.certSubheading}>
            Unit 1 • Lesson 1.1: My First Day Workbook
          </Text>

          <View style={styles.scorePlaque}>
            <Text style={styles.scorePlaqueLabel}>STUDENT SCORE</Text>
            <Text style={styles.scorePlaqueValue}>{finalScore}%</Text>
            <Text style={styles.scorePlaqueSub}>
              {correctCount} of {UNIT1_WORKBOOK_QUESTIONS.length} Exercises Solved Accurately
            </Text>
          </View>

          <View style={styles.unlockBanner}>
            <View style={styles.unlockBannerIcon}>
              <Gamepad2 size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.unlockBannerTitle}>School Adventure Runner Unlocked! 🎮</Text>
              <Text style={styles.unlockBannerDesc}>
                Help Raju leap over the brook, cross rhyming stepping stones, unlock the school gate, and ring the Grade One bell!
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (onOpenGame) {
                onOpenGame(null); // Triggers main game container for 1.1
              }
            }}
            style={styles.launchGameBtn}
            activeOpacity={0.85}
          >
            <Sparkles size={20} color="#FFFFFF" />
            <Text style={styles.launchGameBtnText}>PLAY SCHOOL ADVENTURE RUNNER NOW! 🏃‍♂️🔔</Text>
          </TouchableOpacity>

          <View style={styles.certButtonsRow}>
            <TouchableOpacity onPress={handleRestartWorkbook} style={styles.reviewWorkbookBtn}>
              <RotateCcw size={16} color="#475569" />
              <Text style={styles.reviewWorkbookBtnText}>Review Workbook</Text>
            </TouchableOpacity>

            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.backLessonsBtn}>
                <ArrowRight size={16} color="#FFFFFF" />
                <Text style={styles.backLessonsBtnText}>Back to Lessons</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------
  // RENDER INTERACTIVE WORKBOOK PAGE
  // -------------------------------------------------------------
  return (
    <View style={styles.workbookCard}>
      {/* 1. Spiral Binder Margin Header */}
      <View style={styles.spiralHeader}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((ring) => (
          <View key={ring} style={styles.spiralRing} />
        ))}
      </View>

      {/* 2. Workbook Top Tool Bar (Notebook Lined) */}
      <View style={styles.workbookTopBar}>
        <View style={styles.workbookTagBox}>
          <BookOpen size={16} color="#1E3A8A" />
          <Text style={styles.workbookTagText}>
            CLASS 1 ENGLISH WORKBOOK • UNIT 1
          </Text>
        </View>

        <View style={styles.topActionsRow}>
          {/* Audio Speaker Button */}
          <TouchableOpacity
            onPress={() => handlePlayAudio(currentQ.audioPrompt)}
            style={[styles.audioBtn, isPlayingAudio && styles.audioBtnPlaying]}
            activeOpacity={0.8}
            accessibilityLabel="Read aloud"
          >
            <Volume2 size={16} color={isPlayingAudio ? '#FFFFFF' : '#1E3A8A'} />
            <Text style={[styles.audioBtnText, isPlayingAudio && { color: '#FFFFFF' }]}>
              {isPlayingAudio ? 'Reading...' : 'Listen 🔊'}
            </Text>
          </TouchableOpacity>

          {/* Mute/Unmute Toggle Button */}
          <TouchableOpacity
            onPress={handleToggleMute}
            style={styles.muteBtn}
            activeOpacity={0.8}
            accessibilityLabel="Toggle voice sound"
          >
            {isMuted ? (
              <VolumeX size={16} color="#DC2626" />
            ) : (
              <Volume2 size={16} color="#16A34A" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Page Number & Exercise Tracker */}
      <View style={styles.pageTrackerRow}>
        <Text style={styles.pageNumberText}>
          Page {currentIndex + 1} of {UNIT1_WORKBOOK_QUESTIONS.length}
        </Text>
        <View style={styles.pageDotsRow}>
          {UNIT1_WORKBOOK_QUESTIONS.map((q, idx) => {
            const isDone = completedExercises.includes(q.id);
            const isCur = idx === currentIndex;
            return (
              <View
                key={q.id}
                style={[
                  styles.pageDot,
                  isCur && styles.pageDotActive,
                  isDone && styles.pageDotDone,
                ]}
              >
                {isDone ? (
                  <Check size={8} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text style={[styles.pageDotText, isCur && styles.pageDotTextActive]}>
                    {idx + 1}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 4. Ruled Notebook Page Canvas */}
      <View style={styles.ruledNotebookPage}>
        {/* Red Margin Line */}
        <View style={styles.notebookRedMargin} />

        <View style={styles.pageContent}>
          {/* Exercise Title & Instructions */}
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseTitle}>{currentQ.title}</Text>
            <Text style={styles.exerciseInstructions}>{currentQ.instructions}</Text>
          </View>

          {/* Main Question Text on Ruled Notebook Line */}
          <View style={styles.ruledQuestionBox}>
            <Text style={styles.ruledQuestionText}>{currentQ.questionText}</Text>
          </View>

          {/* ========================================================
              FORMAT 1: MATCH THE PAIRS (TAP-TO-MATCH)
              ======================================================== */}
          {currentQ.format === 'match_pairs' && currentQ.matchPairsData && (
            <View style={styles.formatContainer}>
              <View style={styles.matchColumnsRow}>
                {/* Left Column */}
                <View style={styles.matchCol}>
                  <Text style={styles.matchColHeader}>POEM WORD</Text>
                  {currentQ.matchPairsData.left.map((item) => {
                    const isSelected = selectedLeft === item.id;
                    const isMatched = !!matchedPairs[item.id];
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleLeftTap(item.id)}
                        style={[
                          styles.matchChipLeft,
                          isSelected && styles.matchChipSelected,
                          isMatched && styles.matchChipMatched,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.matchChipLabel,
                            isSelected && styles.matchChipTextSelected,
                            isMatched && styles.matchChipTextMatched,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isMatched && (
                          <View style={styles.matchedCheckBadge}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Right Column */}
                <View style={styles.matchCol}>
                  <Text style={styles.matchColHeader}>MATCHING MEANING</Text>
                  {currentQ.matchPairsData.right.map((item) => {
                    // Check if any left item has matched to this right item
                    const matchedLeftKey = Object.keys(matchedPairs).find(
                      (k) => matchedPairs[k] === item.id
                    );
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleRightTap(item.id)}
                        style={[
                          styles.matchChipRight,
                          matchedLeftKey && styles.matchChipMatched,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.matchChipLabel,
                            matchedLeftKey && styles.matchChipTextMatched,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {matchedLeftKey && (
                          <View style={styles.matchedCheckBadge}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Matched Pairs Badges List */}
              {Object.keys(matchedPairs).length > 0 && (
                <View style={styles.matchedReviewBox}>
                  <Text style={styles.matchedReviewTitle}>Formed Connections:</Text>
                  <View style={styles.matchedBadgesWrap}>
                    {Object.entries(matchedPairs).map(([leftId, rightId]) => {
                      const lItem = currentQ.matchPairsData?.left.find((l) => l.id === leftId);
                      const rItem = currentQ.matchPairsData?.right.find((r) => r.id === rightId);
                      return (
                        <TouchableOpacity
                          key={leftId}
                          onPress={() => handleRemovePair(leftId)}
                          style={styles.matchedBadgeItem}
                        >
                          <Text style={styles.matchedBadgeText}>
                            {lItem?.label} ↔ {rItem?.label}
                          </Text>
                          <Text style={styles.removeBadgeCross}>×</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ========================================================
              FORMAT 2: FILL IN THE BLANK (WORD TILES)
              ======================================================== */}
          {currentQ.format === 'fill_blank' && currentQ.fillBlankData && (
            <View style={styles.formatContainer}>
              {/* Lined Notebook Sentence with Blank Box */}
              <View style={styles.fillSentenceLinedBox}>
                <Text style={styles.fillSentenceText}>
                  {currentQ.fillBlankData.sentenceBefore}
                </Text>
                <View
                  style={[
                    styles.blankSlotBox,
                    selectedBlankTile && styles.blankSlotFilled,
                  ]}
                >
                  <Text
                    style={[
                      styles.blankSlotText,
                      selectedBlankTile && styles.blankSlotTextFilled,
                    ]}
                  >
                    {selectedBlankTile || '____?____'}
                  </Text>
                </View>
                <Text style={styles.fillSentenceText}>
                  {currentQ.fillBlankData.sentenceAfter}
                </Text>
              </View>

              <Text style={styles.trayLabel}>Word Tile Tray (Tap to place):</Text>
              <View style={styles.tilesTray}>
                {currentQ.fillBlankData.tiles.map((tile) => {
                  const isSelected = selectedBlankTile === tile;
                  return (
                    <TouchableOpacity
                      key={tile}
                      onPress={() => handleTileSelect(tile)}
                      style={[styles.wordTileBtn, isSelected && styles.wordTileBtnSelected]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.wordTileText,
                          isSelected && styles.wordTileTextSelected,
                        ]}
                      >
                        {tile}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ========================================================
              FORMAT 3: ARRANGE THE WORDS (SENTENCE TILES)
              ======================================================== */}
          {currentQ.format === 'arrange_words' && currentQ.arrangeWordsData && (
            <View style={styles.formatContainer}>
              <Text style={styles.ruledWritingLabel}>Workbook Writing Line:</Text>
              <View style={styles.ruledWritingLineBox}>
                {placedTiles.length === 0 ? (
                  <Text style={styles.emptyLinePlaceholder}>
                    (Tap word tiles below in order to build the sentence...)
                  </Text>
                ) : (
                  <View style={styles.placedTilesRow}>
                    {placedTiles.map((tile, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => handleRemovePlacedTile(idx)}
                        style={styles.placedTilePill}
                      >
                        <Text style={styles.placedTileText}>{tile}</Text>
                        <Text style={styles.placedTileClose}>×</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text style={styles.trayLabel}>Available Shuffled Tiles:</Text>
              <View style={styles.tilesTray}>
                {currentQ.arrangeWordsData.shuffledTiles.map((tile, idx) => {
                  const isPlaced = placedTiles.includes(tile);
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleTileClickToPlace(tile)}
                      disabled={isPlaced}
                      style={[styles.wordTileBtn, isPlaced && styles.wordTileDisabled]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.wordTileText,
                          isPlaced && styles.wordTileTextDisabled,
                        ]}
                      >
                        {tile}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ========================================================
              FORMAT 4: PICTURE UNDERSTANDING
              ======================================================== */}
          {currentQ.format === 'picture_understanding' && currentQ.pictureData && (
            <View style={styles.formatContainer}>
              {/* Textbook Illustration of Grinning Student */}
              <View style={styles.pictureIllustrationCard}>
                <Svg width="100" height="90" viewBox="0 0 100 90">
                  {/* Background halo */}
                  <Circle cx="50" cy="45" r="40" fill="#FEF3C7" />
                  {/* Student Face */}
                  <Circle cx="50" cy="42" r="26" fill="#FBBF24" />
                  {/* Cheerful Hair */}
                  <Path d="M26 36 C 26 18, 74 18, 74 36 C 65 24, 35 24, 26 36 Z" fill="#78350F" />
                  {/* Eyes */}
                  <Circle cx="40" cy="38" r="3" fill="#451A03" />
                  <Circle cx="60" cy="38" r="3" fill="#451A03" />
                  {/* Big Wide Grin / Smile */}
                  <Path d="M35 48 Q 50 64, 65 48 Z" fill="#DC2626" />
                  <Path d="M38 48 Q 50 56, 62 48 Z" fill="#FFFFFF" />
                  {/* Rosy Cheeks */}
                  <Circle cx="33" cy="46" r="3.5" fill="#F87171" opacity="0.8" />
                  <Circle cx="67" cy="46" r="3.5" fill="#F87171" opacity="0.8" />
                </Svg>
                <Text style={styles.pictureCaption}>
                  “See me walk, See me grin! I'm going to school like everyone.”
                </Text>
              </View>

              <Text style={styles.trayLabel}>Choose the correct meaning:</Text>
              <View style={styles.pictureOptionsGrid}>
                {currentQ.pictureData.options.map((opt) => {
                  const isSelected = selectedPictureOption === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setSelectedPictureOption(opt.id)}
                      style={[
                        styles.pictureOptionCard,
                        isSelected && styles.pictureOptionSelected,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.pictureOptionText,
                          isSelected && styles.pictureOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.matchedCheckBadge}>
                          <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ========================================================
              FORMAT 5: PUT EVENTS IN ORDER
              ======================================================== */}
          {currentQ.format === 'put_events_in_order' && currentQ.eventsOrderData && (
            <View style={styles.formatContainer}>
              <Text style={styles.trayLabel}>
                Tap cards in order (1st, 2nd, 3rd) to arrange:
              </Text>

              <View style={styles.eventsCardsList}>
                {currentQ.eventsOrderData.events.map((ev) => {
                  const orderIndex = orderedEventIds.indexOf(ev.id);
                  const isSelected = orderIndex !== -1;
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      onPress={() => handleEventOrderToggle(ev.id)}
                      style={[
                        styles.eventCardItem,
                        isSelected && styles.eventCardItemSelected,
                      ]}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.eventOrderBadge,
                          isSelected && styles.eventOrderBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.eventOrderBadgeText,
                            isSelected && styles.eventOrderBadgeTextActive,
                          ]}
                        >
                          {isSelected ? `Step ${orderIndex + 1}` : 'Tap'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.eventCardText,
                          isSelected && styles.eventCardTextActive,
                        ]}
                      >
                        {ev.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ========================================================
              FORMAT 6: LISTEN AND ANSWER
              ======================================================== */}
          {currentQ.format === 'listen_and_answer' && currentQ.listenData && (
            <View style={styles.formatContainer}>
              <View style={styles.listenHeroCard}>
                <TouchableOpacity
                  onPress={() => handlePlayAudio(currentQ.listenData!.spokenText)}
                  style={styles.listenBigSpeakerBtn}
                >
                  <Volume2 size={28} color="#FFFFFF" />
                  <Text style={styles.listenBigSpeakerText}>Hear Raju Speak 🔊</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleMicSim}
                  style={[
                    styles.listenMicBtn,
                    isListeningMic && styles.listenMicBtnActive,
                  ]}
                >
                  {isListeningMic ? (
                    <MicOff size={22} color="#FFFFFF" />
                  ) : (
                    <Mic size={22} color="#1E3A8A" />
                  )}
                  <Text
                    style={[
                      styles.listenMicText,
                      isListeningMic && { color: '#FFFFFF' },
                    ]}
                  >
                    {isListeningMic ? 'Listening...' : 'Or Say Aloud 🎙️'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.trayLabel}>Or select the answer card:</Text>
              <View style={styles.pictureOptionsGrid}>
                {currentQ.listenData.options.map((opt) => {
                  const isSelected = selectedListenOption === opt.label;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => setSelectedListenOption(opt.label)}
                      style={[
                        styles.pictureOptionCard,
                        isSelected && styles.pictureOptionSelected,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.pictureOptionText,
                          isSelected && styles.pictureOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.matchedCheckBadge}>
                          <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ========================================================
              FORMAT 7: SHORT-ANSWER PRACTICE
              ======================================================== */}
          {currentQ.format === 'short_answer' && currentQ.shortAnswerData && (
            <View style={styles.formatContainer}>
              <Text style={styles.trayLabel}>Tap a word bank helper tile:</Text>
              <View style={styles.tilesTray}>
                {currentQ.shortAnswerData.wordBank.map((word) => (
                  <TouchableOpacity
                    key={word}
                    onPress={() => setShortAnswerText(word)}
                    style={[
                      styles.wordTileBtn,
                      shortAnswerText.toLowerCase() === word.toLowerCase() &&
                        styles.wordTileBtnSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.wordTileText}>{word}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.trayLabel, { marginTop: 14 }]}>
                Or write your answer in the notebook:
              </Text>
              <TextInput
                style={styles.notebookTextInput}
                value={shortAnswerText}
                onChangeText={setShortAnswerText}
                placeholder={currentQ.shortAnswerData.placeholder}
                placeholderTextColor="#94A3B8"
              />
            </View>
          )}

          {/* Hint Card Toggle */}
          <View style={styles.hintSectionRow}>
            <TouchableOpacity
              onPress={() => setShowHint(!showHint)}
              style={styles.hintToggleBtn}
              activeOpacity={0.8}
            >
              <HelpCircle size={15} color="#4338CA" />
              <Text style={styles.hintToggleText}>
                {showHint ? 'Hide Hint' : '💡 Ask for a Hint'}
              </Text>
            </TouchableOpacity>
          </View>

          {showHint && (
            <View style={styles.hintDisplayCard}>
              <Text style={styles.hintDisplayText}>{currentQ.hint}</Text>
            </View>
          )}

          {/* Result Feedback Stamp Card */}
          {feedback && (
            <View
              style={[
                styles.feedbackStampCard,
                feedback.isCorrect
                  ? styles.feedbackCorrectStamp
                  : styles.feedbackRetryStamp,
              ]}
            >
              <View style={styles.feedbackHeaderRow}>
                {feedback.isCorrect ? (
                  <CheckCircle2 size={24} color="#16A34A" />
                ) : (
                  <XCircle size={24} color="#D97706" />
                )}
                <Text
                  style={[
                    styles.feedbackTitleText,
                    feedback.isCorrect ? { color: '#15803D' } : { color: '#B45309' },
                  ]}
                >
                  {feedback.text}
                </Text>
              </View>
              <Text style={styles.feedbackExplanationText}>
                {feedback.explanation}
              </Text>

              {feedback.isCorrect && (
                <TouchableOpacity
                  onPress={handleNextPage}
                  style={styles.nextExerciseBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nextExerciseBtnText}>Next Workbook Page</Text>
                  <ArrowRight size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Bottom Action Button (Check Answer) */}
          {!feedback?.isCorrect && (
            <TouchableOpacity
              onPress={handleCheckAnswer}
              disabled={isSubmitting}
              style={[styles.checkAnswerBtn, isSubmitting && { opacity: 0.7 }]}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.checkAnswerBtnText}>Check Workbook Page</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  workbookCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  spiralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  spiralRing: {
    width: 14,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
  },
  workbookTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#DBEAFE',
  },
  workbookTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workbookTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    letterSpacing: 0.5,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  audioBtnPlaying: {
    backgroundColor: '#2563EB',
  },
  audioBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  muteBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pageTrackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  pageDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageDotActive: {
    backgroundColor: '#2563EB',
  },
  pageDotDone: {
    backgroundColor: '#16A34A',
  },
  pageDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  pageDotTextActive: {
    color: '#FFFFFF',
  },
  ruledNotebookPage: {
    position: 'relative',
    backgroundColor: '#FAFAF9',
    minHeight: 460,
    paddingBottom: 20,
  },
  notebookRedMargin: {
    position: 'absolute',
    left: 28,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FCA5A5',
    zIndex: 1,
  },
  pageContent: {
    paddingLeft: 42,
    paddingRight: 16,
    paddingTop: 16,
    zIndex: 2,
  },
  exerciseHeader: {
    marginBottom: 10,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  exerciseInstructions: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  ruledQuestionBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    marginVertical: 10,
  },
  ruledQuestionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 22,
  },
  formatContainer: {
    marginVertical: 10,
  },
  matchColumnsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  matchCol: {
    flex: 1,
  },
  matchColHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  matchChipLeft: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchChipRight: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchChipSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
    transform: [{ scale: 1.02 }],
  },
  matchChipMatched: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  matchChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  matchChipTextSelected: {
    color: '#1D4ED8',
  },
  matchChipTextMatched: {
    color: '#15803D',
  },
  matchedCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchedReviewBox: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  matchedReviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  matchedBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  matchedBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  matchedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  removeBadgeCross: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  fillSentenceLinedBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  fillSentenceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  blankSlotBox: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginHorizontal: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  blankSlotFilled: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  blankSlotText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
  },
  blankSlotTextFilled: {
    color: '#1D4ED8',
  },
  trayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  tilesTray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordTileBtn: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wordTileBtnSelected: {
    backgroundColor: '#FDE047',
    borderColor: '#D97706',
    transform: [{ scale: 1.05 }],
  },
  wordTileDisabled: {
    opacity: 0.35,
  },
  wordTileText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350F',
  },
  wordTileTextSelected: {
    color: '#451A03',
  },
  wordTileTextDisabled: {
    color: '#94A3B8',
  },
  ruledWritingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  ruledWritingLineBox: {
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderBottomWidth: 3,
    borderBottomColor: '#3B82F6',
    padding: 8,
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyLinePlaceholder: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  placedTilesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  placedTilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  placedTileText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  placedTileClose: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  pictureIllustrationCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  pictureCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pictureOptionsGrid: {
    gap: 8,
  },
  pictureOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  pictureOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderLeftWidth: 5,
  },
  pictureOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  pictureOptionTextSelected: {
    color: '#1D4ED8',
  },
  eventsCardsList: {
    gap: 8,
  },
  eventCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  eventCardItemSelected: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  eventOrderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  eventOrderBadgeActive: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  eventOrderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  eventOrderBadgeTextActive: {
    color: '#FFFFFF',
  },
  eventCardText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  eventCardTextActive: {
    color: '#15803D',
  },
  listenHeroCard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  listenBigSpeakerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
  },
  listenBigSpeakerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  listenMicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#A5B4FC',
  },
  listenMicBtnActive: {
    backgroundColor: '#4338CA',
  },
  listenMicText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  notebookTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderBottomWidth: 3,
    borderBottomColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  hintSectionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 10,
  },
  hintToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  hintToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  hintDisplayCard: {
    backgroundColor: '#EEF2FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 4,
  },
  hintDisplayText: {
    fontSize: 12,
    color: '#3730A3',
    lineHeight: 18,
  },
  feedbackStampCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 14,
  },
  feedbackCorrectStamp: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  feedbackRetryStamp: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  feedbackTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  feedbackExplanationText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 10,
  },
  nextExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 10,
  },
  nextExerciseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  checkAnswerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  checkAnswerBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  completionCertificate: {
    padding: 20,
    alignItems: 'center',
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    borderWidth: 3,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  certHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  certSubheading: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    textAlign: 'center',
  },
  scorePlaque: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  scorePlaqueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  scorePlaqueValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#16A34A',
    marginVertical: 2,
  },
  scorePlaqueSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF5FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D8B4FE',
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  unlockBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7E22CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#581C87',
    marginBottom: 2,
  },
  unlockBannerDesc: {
    fontSize: 11,
    color: '#6B21A8',
    lineHeight: 15,
  },
  launchGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7E22CE',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#581C87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  launchGameBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  certButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  reviewWorkbookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reviewWorkbookBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  backLessonsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
  },
  backLessonsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
