import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../theme/colors';
import {
  getNextQuestion,
  submitStudentAnswer,
  NextActivityResponse,
  AnswerResponsePayload,
  unlockGameForStudent,
  isGameUnlockedForStudent,
} from '../config/api';
import { GameUnlockCard } from './games/GameUnlockCard';
import { GameContainer } from './games/GameContainer';
import { getGameForLesson } from './games/mockGameData';
import { CartoonStudentBuddy } from './games/CartoonStudentBuddy';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Unit1WorkbookPractice } from './practice/Unit1WorkbookPractice';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Award,
  Mic,
  MicOff,
  Volume2,
  Check,
  Tv,
  X,
} from 'lucide-react-native';

const QUESTION_SOLVING_VIDEOS: Record<string, { url: string; title: string; desc: string }> = {
  'Q1_C1': {
    url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    title: 'Solving Video: Action Words (walk & grin)',
    desc: 'Watch step-by-step how movement verbs are identified in the poem!',
  },
  'Q2_C1': {
    url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    title: 'Solving Video: Action Words (skip & run)',
    desc: 'See how fast movements skip and run are paired in lines 1 and 2.',
  },
  'Q3_C1': {
    url: 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
    title: 'Solving Video: Voice Pronunciation for Jump',
    desc: 'Listen to the correct pronunciation and voice input practice for jump.',
  },
  'Q1_C2': {
    url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    title: 'Solving Video: Rhyming Words (play & hurray)',
    desc: 'Learn how rhyming words have matching ending sounds!',
  },
  'Q2_C2': {
    url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    title: 'Solving Video: Rhyming Pairs (grin & in)',
    desc: 'Step-by-step explanation of completing rhyming word blanks.',
  },
  'Q3_C2': {
    url: 'https://www.youtube-nocookie.com/embed/C3c8fzbsfOE',
    title: 'Solving Video: Voice Solution (run & everyone)',
    desc: 'Watch how run and everyone rhyme together in stanza one.',
  },
  'Q1_C3': {
    url: 'https://www.youtube-nocookie.com/embed/75p-N9YKqNo',
    title: 'Solving Video: School Routine & Bell',
    desc: 'Understand the chronological sequence before entering the classroom.',
  },
  'Q2_C3': {
    url: 'https://www.youtube-nocookie.com/embed/75p-N9YKqNo',
    title: 'Solving Video: Grade One Routine',
    desc: 'Watch the animated story of entering Grade One.',
  },
  'Q3_C3': {
    url: 'https://www.youtube-nocookie.com/embed/75p-N9YKqNo',
    title: 'Solving Video: Going to School Place Name',
    desc: 'Voice answer guide for saying School aloud.',
  },
  'Q1_C4': {
    url: 'https://www.youtube-nocookie.com/embed/BELlZKpi1Zs',
    title: 'Solving Video: Sight Word Bell',
    desc: 'Visual association of sight word bell from the Look and Say box.',
  },
  'Q2_C4': {
    url: 'https://www.youtube-nocookie.com/embed/BELlZKpi1Zs',
    title: 'Solving Video: Spelling Grin',
    desc: 'Letter-by-letter breakdown of g-r-i-n.',
  },
  'Q3_C4': {
    url: 'https://www.youtube-nocookie.com/embed/BELlZKpi1Zs',
    title: 'Solving Video: Voice Reading Hurray',
    desc: 'Audio-visual guide for cheer sight word hurray.',
  },
};

const OPTION_EMOJIS: Record<string, string> = {
  jump: '🦘',
  run: '🏃',
  skip: '🦘',
  play: '🎉',
  hurray: '🥳',
  grin: '😄',
  smile: '😊',
  bell: '🔔',
  school: '🏫',
  book: '📖',
  tree: '🌳',
  walk: '🚶',
  in: '🚪',
  out: '🏃',
  far: '🚗',
  ball: '⚽',
  bird: '🐦',
  sleep: '😴',
  sit: '🪑',
};

const MCQ_COLOR_PILLS = [
  { bg: '#FFF9C4', border: '#FBC02D', text: '#78350F' },
  { bg: '#E0F2FE', border: '#38BDF8', text: '#0369A1' },
  { bg: '#FCE7F3', border: '#F472B6', text: '#9D174D' },
  { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },
];

interface PracticeSessionProps {
  studentId?: string;
  studentName?: string;
  lessonId?: string;
  onClose?: () => void;
  onGameUnlocked?: (lessonId: string) => void;
  onOpenGame?: (game: any) => void;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({
  studentId = 'student_001',
  studentName = 'Learner',
  lessonId = '1.1',
  onClose,
  onGameUnlocked,
  onOpenGame,
}) => {
  const [activity, setActivity] = useState<NextActivityResponse | null>(null);
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [lastResult, setLastResult] = useState<AnswerResponsePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [videoModalVisible, setVideoModalVisible] = useState<boolean>(false);
  const [gameModalVisible, setGameModalVisible] = useState<boolean>(false);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [submittedCount, setSubmittedCount] = useState<number>(0);
  const [correctSubmissionsCount, setCorrectSubmissionsCount] = useState<number>(0);
  const [isGameUnlocked, setIsGameUnlocked] = useState<boolean>(false);
  const [isPlayingQuestionAudio, setIsPlayingQuestionAudio] = useState<boolean>(false);
  const reduceMotion = useReducedMotion();
  const mcqScales = useRef<{ [key: number]: Animated.Value }>({}).current;

  const handleMcqPressIn = (idx: number) => {
    if (reduceMotion) return;
    if (!mcqScales[idx]) {
      mcqScales[idx] = new Animated.Value(1);
    }
    Animated.spring(mcqScales[idx], { toValue: 0.95, useNativeDriver: true }).start();
  };

  const handleMcqPressOut = (idx: number) => {
    if (reduceMotion) return;
    if (mcqScales[idx]) {
      Animated.spring(mcqScales[idx], { toValue: 1, friction: 4, tension: 45, useNativeDriver: true }).start();
    }
  };

  const handleQuestionAudioPress = () => {
    setIsPlayingQuestionAudio(true);
    setTimeout(() => {
      setIsPlayingQuestionAudio(false);
    }, 1400);
  };

  useEffect(() => {
    // Check initial unlock state from persistent storage
    if (lessonId) {
      isGameUnlockedForStudent(studentId, lessonId).then((unlocked) => {
        setIsGameUnlocked(unlocked);
      });
    }
  }, [studentId, lessonId]);

  // When practice completes, automatically unlock the mini-game!
  useEffect(() => {
    const isCompleted = activity?.activity_type === 'lesson_completed' || !activity?.question;
    if (isCompleted && !isLoading) {
      const activeLesson = lessonId || '1.1';
      setIsGameUnlocked(true);
      unlockGameForStudent(studentId, activeLesson).then(() => {
        if (onGameUnlocked) {
          onGameUnlocked(activeLesson);
        }
      });
    }
  }, [activity?.activity_type, activity?.question, isLoading, lessonId, studentId]);

  const handlePlayGame = () => {
    const activeLesson = lessonId || '1.1';
    const g = getGameForLesson(activeLesson);
    if (onOpenGame) {
      onOpenGame(g);
    } else {
      setGameModalVisible(true);
    }
  };

  const loadNextQuestion = async (excludes: string[] = answeredIds) => {
    setIsLoading(true);
    setError('');
    setLastResult(null);
    setStudentAnswer('');
    setShowHint(false);
    setIsListening(false);

    // After 3 questions in a practice session, complete the practice test session
    if (excludes.length >= 3) {
      setActivity({
        student_id: studentId,
        activity_type: 'lesson_completed',
        reason: 'Awesome job! You completed all practice test questions for this lesson!',
        question: null,
      });
      setIsLoading(false);
      return;
    }

    const data = await getNextQuestion(studentId, lessonId, excludes);
    if (data) {
      setActivity(data);
    } else {
      setError('No available questions for this session.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setAnsweredIds([]);
    loadNextQuestion([]);
  }, [studentId, lessonId]);

  const handleMicClick = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      if (!studentAnswer) {
        const defaultSpeech = activity?.question?.question_id === 'Q3_C1' ? 'jump' : 'grin';
        setStudentAnswer(defaultSpeech);
      }
    }, 1500);
  };

  const handleSubmit = async () => {
    if (!studentAnswer.trim() || !activity?.question) return;

    const currentQId = activity.question.question_id;
    const updatedExcludes = [...answeredIds, currentQId];
    setAnsweredIds(updatedExcludes);

    setIsSubmitting(true);
    setError('');

    try {
      const result = await submitStudentAnswer(
        studentId,
        currentQId,
        studentAnswer.trim(),
        lessonId
      );
      setLastResult(result);
      setSubmittedCount((prev) => prev + 1);
      if (result.is_correct) {
        setCorrectSubmissionsCount((prev) => prev + 1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    loadNextQuestion(answeredIds);
  };

  const handleRestartLesson = () => {
    setAnsweredIds([]);
    setSubmittedCount(0);
    setCorrectSubmissionsCount(0);
    loadNextQuestion([]);
  };

  const q = activity?.question;
  const isVoiceAnswer = q?.question_type === 'Voice Answer';
  const isMCQ = q?.question_type === 'Multiple Choice' && q?.options && q.options.length > 0;

  const currentSolvingVideo = q
    ? QUESTION_SOLVING_VIDEOS[q.question_id] || {
        url: q.solving_video_url || 'https://www.youtube-nocookie.com/embed/CFrHNjV5yIs',
        title: q.solving_video_title || `Solving Video for Question #${q.question_id}`,
        desc: 'Watch step-by-step video solution and explanation for this concept!',
      }
    : null;

  const renderVideoPlayer = (url: string) => {
    if (Platform.OS === 'web') {
      return (
        <iframe
          src={url}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return (
      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
      />
    );
  };

  if (lessonId === '1.1') {
    return (
      <Unit1WorkbookPractice
        studentId={studentId}
        studentName={studentName}
        onClose={onClose}
        onGameUnlocked={onGameUnlocked}
        onOpenGame={onOpenGame}
      />
    );
  }

  return (
    <View style={styles.card}>
      {/* Header Badges */}
      <View style={styles.headerRow}>
        <View style={styles.activityBadge}>
          <BookOpen size={14} color={Colors.primary} />
          <Text style={styles.activityBadgeText}>
            {activity?.activity_type === 'recovery'
              ? 'Scaffolded Recovery'
              : activity?.activity_type === 'introduce'
              ? 'New Concept Intro'
              : 'Adaptive Practice'}
          </Text>
        </View>

        {q?.difficulty && (
          <View
            style={[
              styles.diffBadge,
              q.difficulty === 'Easy'
                ? styles.diffEasy
                : q.difficulty === 'Medium'
                ? styles.diffMedium
                : styles.diffHard,
            ]}
          >
            <Text
              style={[
                styles.diffBadgeText,
                q.difficulty === 'Easy'
                  ? styles.diffEasyText
                  : q.difficulty === 'Medium'
                  ? styles.diffMediumText
                  : styles.diffHardText,
              ]}
            >
              {q.difficulty}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <CartoonStudentBuddy
            size="regular"
            speechText="Connecting to SamSukh Adaptive Engine... 🎒✨"
            showSpeech={true}
          />
          <ActivityIndicator size="large" color="#582C84" style={{ marginTop: 12 }} />
          <Text style={styles.loadingText}>Loading Maharashtra Board Question...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <XCircle size={48} color={Colors.danger} />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity onPress={() => loadNextQuestion()} style={styles.retryBtn}>
            <RotateCcw size={16} color="#ffffff" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : lastResult ? (
        /* Result Screen */
        <View style={styles.resultContainer}>
          {lastResult.is_correct ? (
            <View style={styles.resultHeader}>
              <CartoonStudentBuddy
                size="compact"
                isCelebrating={true}
                speechText="You got it right! Awesome work! ⭐"
                showSpeech={true}
              />
              <View style={[styles.resultIconCircle, styles.iconSuccess]}>
                <CheckCircle2 size={40} color={Colors.success} />
              </View>
              <Text style={styles.correctTitle}>Correct! Great Job! 🎉</Text>
              <Text style={styles.feedbackText}>{lastResult.feedback}</Text>
            </View>
          ) : (
            <View style={styles.resultHeader}>
              <CartoonStudentBuddy
                size="compact"
                isCelebrating={false}
                speechText="Don't worry! Watch the solving video or try again! 💪"
                showSpeech={true}
              />
              <View style={[styles.resultIconCircle, styles.iconWarning]}>
                <XCircle size={40} color={Colors.warning} />
              </View>
              <Text style={styles.incorrectTitle}>Keep Trying! 💪</Text>
              <Text style={styles.feedbackText}>{lastResult.feedback}</Text>

              {/* Watch Solving Video button on wrong answer */}
              <TouchableOpacity
                onPress={() => setVideoModalVisible(true)}
                style={styles.watchSolvingBtn}
                activeOpacity={0.85}
              >
                <Tv size={18} color="#ffffff" />
                <Text style={styles.watchSolvingBtnText}>Watch Solving Video Solution 🎬</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mastery Metrics */}
          {lastResult.mastery && (
            <View style={styles.masteryBox}>
              <View style={styles.masteryLabelRow}>
                <Award size={18} color={Colors.primary} />
                <Text style={styles.masteryLabel}>Concept Mastery</Text>
              </View>
              <View style={styles.masteryValueRow}>
                <Text style={styles.masteryAccuracy}>{lastResult.mastery.accuracy}%</Text>
                <Text style={styles.masteryStatus}>({lastResult.mastery.status})</Text>
              </View>
            </View>
          )}

          <TouchableOpacity onPress={handleNext} style={styles.nextBtn} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Next Question</Text>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      ) : activity?.activity_type === 'lesson_completed' || !q ? (
        /* Lesson Completed Screen */
        <View style={styles.resultContainer}>
          <View style={[styles.resultIconCircle, styles.iconSuccess]}>
            <Award size={48} color={Colors.success} />
          </View>
          <Text style={styles.completedTitle}>Lesson Completed! 🎉</Text>
          <Text style={styles.completedSubtitle}>
            {activity?.reason || 'Awesome work! You answered all questions for this lesson.'}
          </Text>

          {/* Educational Concept Mini-Game Unlock Card */}
          <View style={{ width: '100%', marginVertical: 8 }}>
            <GameUnlockCard
              lessonId={lessonId || '1.1'}
              lessonTitle={activity?.reason || 'Lesson Practice'}
              practiceScore={
                submittedCount > 0
                  ? Math.round((correctSubmissionsCount / submittedCount) * 100)
                  : 100
              }
              questionsAnsweredCount={submittedCount > 0 ? submittedCount : answeredIds.length}
              isUnlocked={true}
              game={getGameForLesson(lessonId || '1.1')}
              onPlayGame={handlePlayGame}
              onContinueReview={onClose}
            />
          </View>

          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.nextBtn} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Back to Lessons List</Text>
              <ArrowRight size={20} color="#ffffff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleRestartLesson} style={styles.replayBtn} activeOpacity={0.85}>
            <RotateCcw size={18} color={Colors.primary} />
            <Text style={styles.replayBtnText}>Practice Lesson Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Question Form Screen */
        <View style={styles.questionContainer}>
          {/* Animated Stepping-Stones Progress Bar */}
          <View style={styles.practiceProgressTrack}>
            <View style={styles.practiceTrackBar}>
              <View
                style={[
                  styles.practiceTrackFill,
                  { width: `${Math.min(100, ((answeredIds.length + 1) / 3) * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.practiceNodesRow}>
              {[1, 2, 3].map((stepNum) => {
                const isDone = answeredIds.length >= stepNum;
                const isCurrent = answeredIds.length + 1 === stepNum;
                return (
                  <View
                    key={stepNum}
                    style={[
                      styles.practiceNode,
                      isCurrent && styles.practiceNodeActive,
                      isDone && styles.practiceNodeDone,
                    ]}
                  >
                    {isDone ? (
                      <Check size={12} color="#FFFFFF" strokeWidth={3.5} />
                    ) : (
                      <Text
                        style={[
                          styles.practiceNodeText,
                          isCurrent && styles.practiceNodeTextActive,
                        ]}
                      >
                        Q{stepNum}
                      </Text>
                    )}
                  </View>
                );
              })}
              <View style={[styles.practiceNode, styles.gameUnlockNode]}>
                <Text style={{ fontSize: 13 }}>🎮</Text>
              </View>
            </View>
          </View>

          {/* Friendly Animated Student Character Companion */}
          <View style={styles.studentCompanionRow}>
            <CartoonStudentBuddy
              size="compact"
              speechText={
                q.hint
                  ? "Take your time! Raju is cheering for you! 🌟"
                  : "Listen to the words and pick the best one! 🎒"
              }
              showSpeech={true}
            />
          </View>

          {/* Question Card Box with Speaker Button */}
          <View style={styles.questionBox}>
            <View style={styles.questionBoxHeader}>
              <Text style={styles.questionIdText}>Question #{q.question_id}</Text>
              <TouchableOpacity
                onPress={handleQuestionAudioPress}
                style={[
                  styles.questionSpeakerBtn,
                  isPlayingQuestionAudio && styles.questionSpeakerBtnPlaying,
                ]}
                activeOpacity={0.8}
              >
                <Volume2
                  size={16}
                  color={isPlayingQuestionAudio ? '#FFFFFF' : '#78350F'}
                />
                <Text
                  style={[
                    styles.questionSpeakerText,
                    isPlayingQuestionAudio && { color: '#FFFFFF' },
                  ]}
                >
                  {isPlayingQuestionAudio ? 'Reading... 🔊' : 'Hear Question 🔊'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.questionText}>{q.question}</Text>
            <Text style={styles.questionTypeText}>
              Type: <Text style={styles.boldText}>{q.question_type}</Text>
            </Text>
          </View>

          {/* Hint & Solving Video Toolbar */}
          <View style={styles.toolsRow}>
            {q.hint && (
              <TouchableOpacity
                onPress={() => setShowHint(!showHint)}
                style={styles.hintToggleBtn}
              >
                <HelpCircle size={16} color={Colors.primary} />
                <Text style={styles.hintToggleText}>
                  {showHint ? 'Hide Hint' : 'Need a Hint?'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setVideoModalVisible(true)}
              style={styles.solvingVideoToggleBtn}
            >
              <Tv size={16} color={Colors.primary} />
              <Text style={styles.solvingVideoToggleText}>Watch Solving Video</Text>
            </TouchableOpacity>
          </View>

          {showHint && q.hint && (
            <View style={styles.hintContentBox}>
              <Text style={styles.hintText}>💡 <Text style={{ fontWeight: '800' }}>Hint:</Text> {q.hint}</Text>
            </View>
          )}

          {/* Voice Answer UI */}
          {isVoiceAnswer ? (
            <View style={styles.voiceContainer}>
              <TouchableOpacity
                onPress={handleMicClick}
                style={[styles.micBtn, isListening && styles.micBtnListening]}
                activeOpacity={0.8}
              >
                {isListening ? (
                  <MicOff size={36} color="#ffffff" />
                ) : (
                  <Mic size={36} color="#ffffff" />
                )}
              </TouchableOpacity>

              <Text style={styles.micStatusText}>
                {isListening ? '🎙️ Listening to your voice...' : 'Tap Mic & Speak your answer aloud'}
              </Text>

              {studentAnswer ? (
                <View style={styles.recognizedBox}>
                  <Text style={styles.recognizedText}>Recognized: "{studentAnswer}"</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || !studentAnswer.trim()}
                style={[
                  styles.submitActionBtn,
                  (isSubmitting || !studentAnswer.trim()) && styles.disabledBtn,
                ]}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Volume2 size={20} color="#ffffff" />
                    <Text style={styles.submitActionText}>Submit Voice Answer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : isMCQ ? (
            /* Multiple Choice UI with Large Rounded Answer Cards */
            <View style={styles.mcqContainer}>
              <Text style={styles.selectLabel}>Select one option:</Text>

              <View style={styles.mcqGrid}>
                {q.options!.map((option, idx) => {
                  const cleanedOpt = option.replace(/^\s*\(?[A-Da-d1-4]\)?[\.\-\:\)]\s*/, '').trim();
                  const isSelected =
                    studentAnswer.toLowerCase() === cleanedOpt.toLowerCase() ||
                    studentAnswer.toLowerCase() === option.toLowerCase();
                  const emoji = OPTION_EMOJIS[cleanedOpt.toLowerCase()] || '✨';
                  const pillTheme = MCQ_COLOR_PILLS[idx % MCQ_COLOR_PILLS.length];

                  if (!mcqScales[idx]) {
                    mcqScales[idx] = new Animated.Value(1);
                  }

                  return (
                    <Animated.View
                      key={idx}
                      style={{ transform: [{ scale: mcqScales[idx] }] }}
                    >
                      <TouchableOpacity
                        onPress={() => setStudentAnswer(cleanedOpt)}
                        onPressIn={() => handleMcqPressIn(idx)}
                        onPressOut={() => handleMcqPressOut(idx)}
                        style={[
                          styles.mcqOptionCard,
                          { backgroundColor: pillTheme.bg, borderColor: pillTheme.border },
                          isSelected && styles.mcqOptionSelected,
                        ]}
                        activeOpacity={0.85}
                      >
                        <View style={styles.mcqOptionLeft}>
                          <View style={styles.mcqEmojiBox}>
                            <Text style={styles.mcqEmojiText}>{emoji}</Text>
                          </View>
                          <Text
                            style={[
                              styles.mcqOptionText,
                              { color: pillTheme.text },
                              isSelected && styles.mcqTextSelected,
                            ]}
                          >
                            {cleanedOpt}
                          </Text>
                        </View>

                        {isSelected ? (
                          <View style={styles.mcqCheckPill}>
                            <Check size={18} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        ) : (
                          <View style={styles.mcqEmptyCircle} />
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || !studentAnswer.trim()}
                style={[
                  styles.submitActionBtn,
                  (isSubmitting || !studentAnswer.trim()) && styles.disabledBtn,
                ]}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Sparkles size={20} color="#ffffff" />
                    <Text style={styles.submitActionText}>Submit Choice</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* Short Answer Text Input UI */
            <View style={styles.textInputContainer}>
              <TextInput
                value={studentAnswer}
                onChangeText={setStudentAnswer}
                placeholder="Type your answer here..."
                placeholderTextColor={Colors.textMuted}
                style={styles.textInput}
              />

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || !studentAnswer.trim()}
                style={[
                  styles.submitActionBtn,
                  (isSubmitting || !studentAnswer.trim()) && styles.disabledBtn,
                ]}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Sparkles size={20} color="#ffffff" />
                    <Text style={styles.submitActionText}>Submit Answer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Question Solving Video Modal */}
      {currentSolvingVideo && (
        <Modal
          visible={videoModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setVideoModalVisible(false)}
        >
          <View style={styles.videoModalOverlay}>
            <View style={styles.videoModalContent}>
              <View style={styles.videoModalHeader}>
                <View style={styles.videoModalTitleRow}>
                  <Tv size={20} color={Colors.primary} />
                  <Text style={styles.videoModalTitle} numberOfLines={1}>
                    {currentSolvingVideo.title}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setVideoModalVisible(false)}
                  style={styles.videoModalCloseBtn}
                >
                  <X size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.videoModalDesc}>{currentSolvingVideo.desc}</Text>

              <View style={styles.videoModalPlayerBox}>
                {renderVideoPlayer(currentSolvingVideo.url)}
              </View>

              <TouchableOpacity
                onPress={() => setVideoModalVisible(false)}
                style={styles.videoModalDoneBtn}
              >
                <Text style={styles.videoModalDoneText}>Got it! Back to Question</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Concept Mini-Game Modal Controller */}
      <GameContainer
        game={getGameForLesson(lessonId || '1.1')}
        visible={gameModalVisible}
        studentId={studentId}
        onClose={() => setGameModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  diffEasy: { backgroundColor: Colors.successLight },
  diffMedium: { backgroundColor: Colors.warningLight },
  diffHard: { backgroundColor: Colors.dangerLight },
  diffBadgeText: { fontSize: 11, fontWeight: '800' },
  diffEasyText: { color: Colors.successText },
  diffMediumText: { color: Colors.warningText },
  diffHardText: { color: Colors.dangerText },
  centerContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dangerText,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 16,
  },
  resultHeader: {
    alignItems: 'center',
    gap: 8,
  },
  resultIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSuccess: { backgroundColor: Colors.successLight },
  iconWarning: { backgroundColor: Colors.warningLight },
  correctTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
  },
  incorrectTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.accent,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  completedSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  watchSolvingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    marginTop: 6,
  },
  watchSolvingBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  masteryBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  masteryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  masteryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  masteryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  masteryAccuracy: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
  masteryStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  nextBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 50,
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  practiceProgressTrack: {
    width: '100%',
    paddingVertical: 6,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 4,
  },
  practiceTrackBar: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  practiceTrackFill: {
    height: '100%',
    backgroundColor: '#FFD166',
    borderRadius: 8,
  },
  practiceNodesRow: {
    position: 'absolute',
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  practiceNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  practiceNodeActive: {
    backgroundColor: '#06D6A0',
    borderColor: '#059669',
    transform: [{ scale: 1.2 }],
  },
  practiceNodeDone: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  gameUnlockNode: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  practiceNodeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
  },
  practiceNodeTextActive: {
    color: '#FFFFFF',
  },
  studentCompanionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  questionContainer: {
    gap: 14,
  },
  questionBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 22,
    padding: 18,
    gap: 8,
    borderWidth: 2,
    borderColor: '#FDE68A',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  questionBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionSpeakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  questionSpeakerBtnPlaying: {
    backgroundColor: '#FF6B6B',
    borderColor: '#E04848',
  },
  questionSpeakerText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#78350F',
  },
  questionIdText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    lineHeight: 25,
  },
  questionTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  boldText: {
    fontWeight: '900',
    color: '#582C84',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  hintToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  hintToggleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#78350F',
  },
  solvingVideoToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  solvingVideoToggleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6B21A8',
  },
  hintContentBox: {
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  hintText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350F',
    lineHeight: 20,
  },
  voiceContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#582C84',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#582C84',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#EDE7F6',
  },
  micBtnListening: {
    backgroundColor: '#E11D48',
    borderColor: '#FFE4E6',
  },
  micStatusText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  recognizedBox: {
    width: '100%',
    backgroundColor: '#F3E8FF',
    padding: 12,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E9D5FF',
  },
  recognizedText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#582C84',
  },
  mcqContainer: {
    gap: 10,
  },
  selectLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  mcqGrid: {
    gap: 10,
  },
  mcqOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mcqOptionSelected: {
    borderColor: '#059669',
    backgroundColor: '#059669',
    borderBottomWidth: 5,
  },
  mcqOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mcqEmojiBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  mcqEmojiText: {
    fontSize: 20,
  },
  mcqOptionText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mcqTextSelected: {
    color: '#FFFFFF',
  },
  mcqCheckPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mcqEmptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  textInputContainer: {
    gap: 12,
  },
  textInput: {
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  submitActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 50,
    marginTop: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  submitActionText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(25, 0, 25, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  videoModalContent: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  videoModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  videoModalCloseBtn: {
    padding: 4,
  },
  videoModalDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  videoModalPlayerBox: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  videoModalDoneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  videoModalDoneText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    marginTop: 8,
  },
  replayBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
});

