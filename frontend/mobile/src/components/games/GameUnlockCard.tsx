import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  Gamepad2,
  Lock,
  Unlock,
  Sparkles,
  Trophy,
  ArrowRight,
  Star,
  CheckCircle,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { GameDefinition } from './types';

interface GameUnlockCardProps {
  lessonId: string;
  lessonTitle: string;
  practiceScore?: number; // e.g. 100 or 80
  questionsAnsweredCount?: number;
  isUnlocked: boolean;
  game: GameDefinition;
  onPlayGame: () => void;
  onContinueReview?: () => void;
  onStartPractice?: () => void;
  onClose?: () => void;
}

export const GameUnlockCard: React.FC<GameUnlockCardProps> = ({
  lessonId,
  lessonTitle,
  practiceScore = 100,
  questionsAnsweredCount = 5,
  isUnlocked = true,
  game,
  onPlayGame,
  onContinueReview,
  onStartPractice,
  onClose,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (isUnlocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();

      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [isUnlocked]);

  return (
    <View style={styles.cardContainer}>
      {/* Top Test Summary Header */}
      <View style={isUnlocked ? styles.testSummaryHeader : styles.testSummaryLockedHeader}>
        <View style={styles.testBadge}>
          {isUnlocked ? (
            <>
              <CheckCircle size={16} color="#2E7D32" />
              <Text style={styles.testBadgeText}>Practice Test Completed!</Text>
            </>
          ) : (
            <>
              <Lock size={16} color="#854F6C" />
              <Text style={styles.testBadgeLockedText}>Practice Test Required</Text>
            </>
          )}
        </View>
        <Text style={isUnlocked ? styles.testScoreText : styles.testScoreLockedText}>
          {isUnlocked
            ? `Score: ${practiceScore}% (${questionsAnsweredCount} Questions Answered)`
            : 'Locked Milestone 🔒'}
        </Text>
      </View>

      {/* Colourful Game Card */}
      <View style={[styles.gameCard, { borderColor: isUnlocked ? '#80DEEA' : '#DFB6B2' }]}>
        {/* Game Badge Header */}
        <View style={styles.gameCardHeader}>
          <View style={styles.lessonTagRow}>
            <Text style={styles.lessonTagText}>Lesson {lessonId}</Text>
            <Text style={styles.lessonTitleText} numberOfLines={1}>{lessonTitle}</Text>
          </View>

          {/* Locked / Unlocked Pill */}
          <Animated.View
            style={[
              styles.lockPill,
              isUnlocked ? styles.unlockedPill : styles.lockedPill,
              { transform: [{ scale: badgeScale }] },
            ]}
          >
            {isUnlocked ? (
              <>
                <Unlock size={14} color="#1B5E20" />
                <Text style={styles.unlockedPillText}>UNLOCKED! 🔓</Text>
              </>
            ) : (
              <>
                <Lock size={14} color="#546E7A" />
                <Text style={styles.lockedPillText}>LOCKED 🔒</Text>
              </>
            )}
          </Animated.View>
        </View>

        {/* Mascot & Game Banner */}
        <View style={styles.bannerRow}>
          <View style={styles.mascotCircle}>
            <Text style={styles.mascotEmojiText}>{game.mascotEmoji}</Text>
          </View>

          <View style={styles.bannerInfo}>
            <View style={styles.subjectRow}>
              <Sparkles size={14} color={Colors.primary} />
              <Text style={styles.subjectText}>{game.subject} MINI-GAME</Text>
            </View>
            <Text style={styles.gameTitleText}>{game.title}</Text>
            <Text style={styles.conceptNameText}>Concept: {game.conceptName}</Text>
          </View>
        </View>

        {/* Objective Pill */}
        <View style={styles.objectiveBox}>
          <Text style={styles.objectiveText}>🎯 {game.objective}</Text>
        </View>

        {/* Reward Stars Preview */}
        <View style={styles.rewardPreviewRow}>
          <Trophy size={16} color="#F57F17" />
          <Text style={styles.rewardPreviewText}>Win up to 3 Golden Stars:</Text>
          <View style={styles.starsRow}>
            <Star size={16} color="#FFB300" fill="#FFB300" />
            <Star size={16} color="#FFB300" fill="#FFB300" />
            <Star size={16} color="#FFB300" fill="#FFB300" />
          </View>
        </View>

        {/* Action Button: Play Game (if unlocked) or Start Practice (if locked) */}
        {isUnlocked ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
            <TouchableOpacity
              onPress={onPlayGame}
              style={styles.playGameBtn}
              activeOpacity={0.85}
            >
              <Gamepad2 size={24} color="#FFFFFF" />
              <Text style={styles.playGameBtnText}>PLAY CONCEPT GAME NOW! 🎮</Text>
              <ArrowRight size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.lockedNoticeBox}>
            <View style={styles.lockedNoticeRow}>
              <Lock size={18} color="#78909C" />
              <Text style={styles.lockedNoticeText}>
                Complete the Lesson {lessonId} practice test to unlock this educational game!
              </Text>
            </View>

            {onStartPractice && (
              <TouchableOpacity
                onPress={onStartPractice}
                style={styles.startPracticeLockBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.startPracticeLockBtnText}>Start Practice Test to Unlock 📝</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {onContinueReview && (
          <TouchableOpacity
            onPress={onContinueReview}
            style={styles.continueReviewBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.continueReviewText}>Back to Lesson Review 📖</Text>
          </TouchableOpacity>
        )}

        {onClose && !onContinueReview && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.continueReviewBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.continueReviewText}>Close Preview ✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    gap: 12,
  },
  testSummaryHeader: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#A5D6A7',
  },
  testBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1B5E20',
  },
  testScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
  },
  gameCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    borderWidth: 3,
    gap: 14,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  gameCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lessonTagRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lessonTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lessonTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    flex: 1,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 50,
  },
  unlockedPill: {
    backgroundColor: '#C8E6C9',
  },
  lockedPill: {
    backgroundColor: '#ECEFF1',
  },
  unlockedPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1B5E20',
  },
  lockedPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#546E7A',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F7F3F8',
    padding: 14,
    borderRadius: 22,
  },
  mascotCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DFB6B2',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mascotEmojiText: {
    fontSize: 34,
  },
  bannerInfo: {
    flex: 1,
    gap: 2,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  gameTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  conceptNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  objectiveBox: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFF176',
  },
  objectiveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7F5200',
  },
  rewardPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  rewardPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#522B5B',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  playGameBtn: {
    width: '100%',
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 50,
    borderBottomWidth: 5,
    borderColor: '#047857',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  playGameBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  testSummaryLockedHeader: {
    backgroundColor: '#FDF2F4',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#DFB6B2',
  },
  testBadgeLockedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#854F6C',
  },
  testScoreLockedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854F6C',
  },
  lockedNoticeBox: {
    backgroundColor: '#FDF2F4',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DFB6B2',
    gap: 12,
    alignItems: 'center',
  },
  lockedNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#522B5B',
    flex: 1,
    lineHeight: 18,
  },
  startPracticeLockBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 50,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  startPracticeLockBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  continueReviewBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  continueReviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
