import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Animated,
} from 'react-native';
import {
  ArrowLeft,
  HelpCircle,
  Sparkles,
  Volume2,
  X,
  RotateCcw,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GameDefinition, GameOption, GameAttemptResult } from './types';
import { generateUnit1GameSession } from './mockGameData';
import { GameProgressBar } from './GameProgressBar';
import { GameHintModal } from './GameHintModal';
import { GameFeedbackOverlay } from './GameFeedbackOverlay';
import { GameIntroModal } from './GameIntroModal';
import { GameCompletionScreen } from './GameCompletionScreen';
import { saveGameAttempt } from '../../config/api';
import { useReducedMotion } from '../../hooks/useReducedMotion';

import { SchoolBellRunGame } from './unit1/SchoolBellRunGame';
import { RhymeRiverGame } from './mechanics/RhymeRiverGame';
import { NumberTrainGame } from './mechanics/NumberTrainGame';
import { ShapeSorterGame } from './mechanics/ShapeSorterGame';
import { CategoryBasketsGame } from './mechanics/CategoryBasketsGame';

interface GameContainerProps {
  game: GameDefinition;
  visible: boolean;
  onClose: () => void;
  onFinish?: (result: GameAttemptResult) => void;
  studentId?: string;
  initialState?: 'INTRO' | 'PLAYING';
}

type GameFlowState = 'INTRO' | 'PLAYING' | 'FEEDBACK' | 'COMPLETED';

export const GameContainer: React.FC<GameContainerProps> = ({
  game,
  visible,
  onClose,
  onFinish,
  studentId = 'student_001',
  initialState = 'PLAYING',
}) => {
  const [activeGame, setActiveGame] = useState<GameDefinition>(game);
  const [playedChallengeIds, setPlayedChallengeIds] = useState<string[]>([]);
  const [flowState, setFlowState] = useState<GameFlowState>(initialState);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isResolved, setIsResolved] = useState<boolean>(false);
  const [feedbackState, setFeedbackState] = useState<{
    visible: boolean;
    isCorrect: boolean;
    message: string;
  }>({
    visible: false,
    isCorrect: false,
    message: '',
  });
  const [hintVisible, setHintVisible] = useState<boolean>(false);

  // Scoring and metrics
  const [correctFirstTryCount, setCorrectFirstTryCount] = useState<number>(0);
  const [retriesUsed, setRetriesUsed] = useState<number>(0);
  const [currentAttemptsForChallenge, setCurrentAttemptsForChallenge] = useState<number>(0);
  const [challengePoints, setChallengePoints] = useState<Record<string, number>>({});
  const [starsEarned, setStarsEarned] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [completionResult, setCompletionResult] = useState<GameAttemptResult | null>(null);
  const [isProcessingAnswer, setIsProcessingAnswer] = useState<boolean>(false);

  const reduceMotion = useReducedMotion();
  const contentFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      contentFadeAnim.setValue(1);
      return;
    }
    contentFadeAnim.setValue(0);
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentChallengeIndex, flowState, reduceMotion]);

  // Reset when a new game is opened
  useEffect(() => {
    if (visible) {
      setActiveGame(game);
      setFlowState(initialState);
      setCurrentChallengeIndex(0);
      setSelectedOptionId(null);
      setIsResolved(false);
      setFeedbackState({ visible: false, isCorrect: false, message: '' });
      setHintVisible(false);
      setCorrectFirstTryCount(0);
      setRetriesUsed(0);
      setCurrentAttemptsForChallenge(0);
      setChallengePoints({});
      setStarsEarned(0);
      setStartTime(Date.now());
      setCompletionResult(null);
      setIsProcessingAnswer(false);
    }
  }, [visible, game.id, initialState]);

  const currentChallenge = activeGame.challenges[currentChallengeIndex] || activeGame.challenges[0];
  const isLastChallenge = currentChallengeIndex === activeGame.challenges.length - 1;

  const handleStartPlaying = () => {
    setFlowState('PLAYING');
    setStartTime(Date.now());
  };

  const handleSelectOption = (option: GameOption) => {
    // 1. Guard against clicks if challenge is already resolved or currently processing
    if (isResolved || isProcessingAnswer) return;

    // 2. Guard against tapping the same already selected incorrect option repeatedly
    if (selectedOptionId === option.id && feedbackState.visible && !feedbackState.isCorrect) {
      return;
    }

    setIsProcessingAnswer(true);
    setSelectedOptionId(option.id);

    const isFirstAttempt = currentAttemptsForChallenge === 0;

    if (option.isCorrect) {
      setIsResolved(true);

      // Define point scoring rules: 100 on 1st try, 75 on 2nd try, 50 on 3rd+ try
      let earnedPoints = 100;
      if (currentAttemptsForChallenge === 1) {
        earnedPoints = 75;
      } else if (currentAttemptsForChallenge >= 2) {
        earnedPoints = 50;
      }

      if (isFirstAttempt) {
        setCorrectFirstTryCount((prev) => prev + 1);
      }

      const updatedPoints = {
        ...challengePoints,
        [currentChallenge.id]: earnedPoints,
      };
      setChallengePoints(updatedPoints);

      // Dynamic live stars calculation:
      const solvedCount = Object.keys(updatedPoints).length;
      let liveStars = 1;
      if (solvedCount >= 2 && solvedCount < activeGame.challenges.length) {
        liveStars = 2;
      } else if (solvedCount === activeGame.challenges.length) {
        const totalPointsSum = Object.values(updatedPoints).reduce((a, b) => a + b, 0);
        const maxPoints = activeGame.challenges.length * 100;
        const accuracyPct = Math.round((totalPointsSum / maxPoints) * 100);
        if (accuracyPct >= 80) liveStars = 3;
        else if (accuracyPct >= 50) liveStars = 2;
        else liveStars = 1;
      }
      setStarsEarned(liveStars);

      setFeedbackState({
        visible: true,
        isCorrect: true,
        message: currentChallenge.correctExplanation,
      });

      setIsProcessingAnswer(false);
    } else {
      setRetriesUsed((prev) => prev + 1);
      setCurrentAttemptsForChallenge((prev) => prev + 1);

      setFeedbackState({
        visible: true,
        isCorrect: false,
        message: option.feedbackHint || 'Oops, not quite! Listen carefully to the poem lines and try again. You can do it! 🌟',
      });

      setIsProcessingAnswer(false);
    }
  };

  const handleNextChallenge = () => {
    setFeedbackState({ visible: false, isCorrect: false, message: '' });
    setSelectedOptionId(null);
    setIsResolved(false);
    setCurrentAttemptsForChallenge(0);
    setIsProcessingAnswer(false);

    if (isLastChallenge) {
      // Calculate final results using actual dynamic scoring rules
      const total = activeGame.challenges.length;
      const totalPointsSum = Object.values(challengePoints).reduce((a, b) => a + b, 0);
      const maxPoints = total * 100;
      const finalAccuracy = Math.min(100, Math.max(0, Math.round((totalPointsSum / maxPoints) * 100)));

      let finalStars = 1;
      if (finalAccuracy >= 80) finalStars = 3;
      else if (finalAccuracy >= 50) finalStars = 2;

      const result: GameAttemptResult = {
        gameId: activeGame.id,
        lessonId: activeGame.lessonId,
        totalChallenges: total,
        correctCount: correctFirstTryCount,
        retriesUsed,
        starsEarned: finalStars,
        scorePercentage: finalAccuracy,
        timeSpentSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
      };

      // Persist game attempt to backend and local storage
      const challengesPayload = activeGame.challenges.map((ch, idx) => {
        let qId = ch.questionId;
        let cId = ch.conceptId;
        let expectedWord = ch.options.find((o) => o.isCorrect)?.text.toLowerCase() || '';
        if (!qId) {
          if (idx === 0) { qId = 'Q3_C1'; cId = 'C1'; expectedWord = 'jump'; }
          else if (idx === 1) { qId = 'Q1_C2'; cId = 'C2'; expectedWord = 'hurray'; }
          else if (idx === 2) { qId = 'Q2_C2'; cId = 'C2'; expectedWord = 'in'; }
          else if (idx === 3) { qId = 'Q1_C4'; cId = 'C4'; expectedWord = 'bell'; }
        }

        return {
          challenge_index: idx,
          question_id: qId,
          concept_id: cId,
          student_answer: expectedWord,
          is_correct: true,
          attempts_count: 1,
        };
      });

      saveGameAttempt({
        student_id: studentId || 'student_001',
        game_id: activeGame.id,
        lesson_id: activeGame.lessonId,
        score: finalAccuracy,
        stars: finalStars,
        completed_challenges: total,
        total_challenges: total,
        is_completed: true,
        challenges: challengesPayload,
        record_mastery: true,
      }).catch((e) => console.warn('Could not persist game attempt:', e));

      setCompletionResult(result);
      setFlowState('COMPLETED');
      if (onFinish) {
        onFinish(result);
      }
    } else {
      setCurrentChallengeIndex((prev) => prev + 1);
    }
  };

  const handleRetryChallenge = () => {
    setFeedbackState({ visible: false, isCorrect: false, message: '' });
    setSelectedOptionId(null);
    setIsResolved(false);
    setIsProcessingAnswer(false);
  };

  const handlePlayAgain = () => {
    if (activeGame.lessonId === '1.1') {
      const currentIds = activeGame.challenges.map((c) => c.id);
      const updatedPlayed = [...playedChallengeIds, ...currentIds].slice(-16);
      setPlayedChallengeIds(updatedPlayed);
      const freshGame = generateUnit1GameSession(updatedPlayed);
      setActiveGame(freshGame);
    }
    setCurrentChallengeIndex(0);
    setSelectedOptionId(null);
    setIsResolved(false);
    setFeedbackState({ visible: false, isCorrect: false, message: '' });
    setCorrectFirstTryCount(0);
    setRetriesUsed(0);
    setCurrentAttemptsForChallenge(0);
    setChallengePoints({});
    setStarsEarned(0);
    setStartTime(Date.now());
    setCompletionResult(null);
    setIsProcessingAnswer(false);
    setFlowState('PLAYING');
  };

  // Render appropriate game board according to mechanic
  const renderGameBoard = () => {
    switch (activeGame.mechanic) {
      case 'SCHOOL_BELL_RUN':
        return (
          <SchoolBellRunGame
            challenge={currentChallenge}
            currentStepIndex={currentChallengeIndex}
            totalSteps={activeGame.challenges.length}
            onSelectOption={handleSelectOption}
            selectedOptionId={selectedOptionId}
            isResolved={isResolved}
            disabled={feedbackState.visible && feedbackState.isCorrect}
            onClose={onClose}
            onRestart={handlePlayAgain}
            starsEarned={starsEarned}
            score={
              Math.round(
                (Object.values(challengePoints).reduce((a, b) => a + b, 0) /
                  (activeGame.challenges.length * 100)) *
                  100
              ) || 100
            }
            onNext={handleNextChallenge}
            isLastChallenge={isLastChallenge}
          />
        );
      case 'RHYME_RIVER':
        return (
          <RhymeRiverGame
            challenge={currentChallenge}
            onSelectOption={handleSelectOption}
            selectedOptionId={selectedOptionId}
            isResolved={isResolved}
            disabled={feedbackState.visible && feedbackState.isCorrect}
          />
        );
      case 'NUMBER_TRAIN':
        return (
          <NumberTrainGame
            challenge={currentChallenge}
            onSelectOption={handleSelectOption}
            selectedOptionId={selectedOptionId}
            isResolved={isResolved}
            disabled={feedbackState.visible && feedbackState.isCorrect}
          />
        );
      case 'SHAPE_SORTER':
        return (
          <ShapeSorterGame
            challenge={currentChallenge}
            onSelectOption={handleSelectOption}
            selectedOptionId={selectedOptionId}
            isResolved={isResolved}
            disabled={feedbackState.visible && feedbackState.isCorrect}
          />
        );
      case 'CATEGORY_BASKET':
        return (
          <CategoryBasketsGame
            challenge={currentChallenge}
            onSelectOption={handleSelectOption}
            selectedOptionId={selectedOptionId}
            isResolved={isResolved}
            disabled={feedbackState.visible && feedbackState.isCorrect}
          />
        );
      default:
        return (
          <SchoolBellRunGame
            challenge={currentChallenge}
            currentStepIndex={currentChallengeIndex}
            totalSteps={game.challenges.length}
            onSelectOption={handleSelectOption}
            selectedOptionId={selectedOptionId}
            isResolved={isResolved}
          />
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      {/* State 1: Game Introduction Screen */}
      {flowState === 'INTRO' && (
        <GameIntroModal
          visible={true}
          game={game}
          onStart={handleStartPlaying}
          onClose={onClose}
        />
      )}

      {/* State 4: Game Completion Screen */}
      {flowState === 'COMPLETED' && completionResult && (
        <GameCompletionScreen
          game={game}
          result={completionResult}
          onPlayAgain={handlePlayAgain}
          onContinueLearning={onClose}
        />
      )}

      {/* State 2 & 3: Gameplay Board & Active Feedback */}
      {(flowState === 'PLAYING' || flowState === 'FEEDBACK') && (
        game.mechanic === 'SCHOOL_BELL_RUN' ? (
          <SafeAreaView style={[styles.safeArea, { backgroundColor: '#BAE6FD' }]}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, padding: 8, maxWidth: 900, width: '100%', alignSelf: 'center' }}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ width: '100%', opacity: contentFadeAnim }}>
                {renderGameBoard()}
              </Animated.View>
            </ScrollView>

            {/* Supportive Animated Feedback Overlay */}
            <GameFeedbackOverlay
              visible={feedbackState.visible}
              isCorrect={feedbackState.isCorrect}
              message={feedbackState.message}
              onNext={handleNextChallenge}
              onRetry={handleRetryChallenge}
              isLastChallenge={isLastChallenge}
            />
          </SafeAreaView>
        ) : (
          <SafeAreaView style={[styles.safeArea, { backgroundColor: '#F0FDF4' }]}>
            {/* Top Gameplay Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <X size={22} color="#582C84" />
              </TouchableOpacity>

              <View style={styles.mascotTitleBox}>
                <View style={styles.mascotEmojiPill}>
                  <Text style={styles.mascotSmallEmoji}>{game.mascotEmoji}</Text>
                </View>
                <Text style={styles.topGameTitle} numberOfLines={1}>{game.title}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setFlowState('INTRO')}
                  style={styles.rulesBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rulesBtnText}>Rules ℹ️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setHintVisible(true)}
                  style={styles.hintBtn}
                  activeOpacity={0.8}
                >
                  <HelpCircle size={18} color="#D97706" />
                  <Text style={styles.hintBtnText}>Hint</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Progress Tracker with Stepping Stones & Stars */}
            <View style={styles.progressBarWrapper}>
              <GameProgressBar
                currentChallengeIndex={currentChallengeIndex}
                totalChallenges={game.challenges.length}
                starsEarned={starsEarned}
                colorTheme={{
                  primary: Colors.gamePurple,
                  accent: Colors.gameWarmYellow,
                }}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Dynamic Game Board with Smooth Challenge Transition */}
              <Animated.View style={{ width: '100%', opacity: contentFadeAnim }}>
                {renderGameBoard()}
              </Animated.View>
            </ScrollView>

            {/* Hint Dialog Modal */}
            <GameHintModal
              visible={hintVisible}
              hintText={currentChallenge.hintText}
              mascotEmoji={game.mascotEmoji}
              mascotName={game.mascotName}
              onClose={() => setHintVisible(false)}
              accentColor={game.theme.primary}
            />

            {/* Supportive Animated Feedback Overlay */}
            <GameFeedbackOverlay
              visible={feedbackState.visible}
              isCorrect={feedbackState.isCorrect}
              message={feedbackState.message}
              onNext={handleNextChallenge}
              onRetry={handleRetryChallenge}
              isLastChallenge={isLastChallenge}
            />
          </SafeAreaView>
        )
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mascotTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  mascotEmojiPill: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  mascotSmallEmoji: {
    fontSize: 20,
  },
  topGameTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderBottomWidth: 3,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  hintBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#78350F',
  },
  rulesBtn: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  rulesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  progressBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110, // padding for feedback overlay
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
});
