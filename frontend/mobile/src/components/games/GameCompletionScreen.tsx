import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  Star,
  Trophy,
  RotateCcw,
  ArrowRight,
  Award,
} from 'lucide-react-native';
import { GameAttemptResult, GameDefinition } from './types';
import { Colors } from '../../theme/colors';
import { CartoonStudentBuddy } from './CartoonStudentBuddy';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GameCompletionScreenProps {
  game: GameDefinition;
  result: GameAttemptResult;
  onPlayAgain: () => void;
  onContinueLearning: () => void;
}

export const GameCompletionScreen: React.FC<GameCompletionScreenProps> = ({
  game,
  result,
  onPlayAgain,
  onContinueLearning,
}) => {
  const reduceMotion = useReducedMotion();

  // Staggered star animations & trophy
  const starAnim1 = useRef(new Animated.Value(0)).current;
  const starAnim2 = useRef(new Animated.Value(0)).current;
  const starAnim3 = useRef(new Animated.Value(0)).current;
  const trophyScale = useRef(new Animated.Value(0.5)).current;
  const badgeSlide = useRef(new Animated.Value(30)).current;

  // Ringing bell swing & sound wave expansion animations
  const bellSwingAnim = useRef(new Animated.Value(0)).current;
  const bellRippleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (reduceMotion) {
      trophyScale.setValue(1);
      badgeSlide.setValue(0);
      starAnim1.setValue(1);
      starAnim2.setValue(1);
      starAnim3.setValue(1);
      return;
    }

    // Trophy zoom in
    Animated.spring(trophyScale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Slide in badge
    Animated.timing(badgeSlide, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Ringing golden school bell swing & sound wave loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(bellSwingAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(bellSwingAnim, { toValue: -1, duration: 220, useNativeDriver: true }),
        Animated.timing(bellSwingAnim, { toValue: 0.5, duration: 180, useNativeDriver: true }),
        Animated.timing(bellSwingAnim, { toValue: -0.5, duration: 180, useNativeDriver: true }),
        Animated.timing(bellSwingAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.delay(400),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bellRippleAnim, { toValue: 1.35, duration: 600, useNativeDriver: true }),
        Animated.timing(bellRippleAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      ])
    ).start();

    // Staggered star bounce in
    const starAnims = [starAnim1, starAnim2, starAnim3];
    starAnims.forEach((anim, index) => {
      if (index < result.starsEarned) {
        Animated.sequence([
          Animated.delay(200 + index * 250),
          Animated.spring(anim, {
            toValue: 1,
            friction: 4,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  }, [result.starsEarned, reduceMotion]);

  const getEncouragement = () => {
    if (game.mechanic === 'SCHOOL_BELL_RUN') {
      if (result.starsEarned === 3) {
        return {
          title: 'Grade One Champion! 🔔🎒',
          body: 'Hooray! You helped Raju reach school on time, rang the golden bell, and mastered your Unit 1 action and rhyming words!',
          badge: '🎖️ Grade One Rhyme Champion',
        };
      }
      return {
        title: 'Super School Explorer! 🌟',
        body: 'Great job helping Raju along the school trail! Keep practicing to ring the bell with 3 golden stars!',
        badge: '🎖️ Grade One Explorer',
      };
    }

    if (result.starsEarned === 3) {
      return {
        title: 'Outstanding Concept Champion! 🏆',
        body: 'You solved every challenge with top-notch accuracy and mastered this lesson concept!',
        badge: 'Maharashtra Board Star Master',
      };
    }
    if (result.starsEarned === 2) {
      return {
        title: 'Great Effort & Learning! 🌟',
        body: 'You completed all challenges and showed wonderful progress in this concept!',
        badge: 'Skilled Concept Explorer',
      };
    }
    return {
      title: 'Good Job Practicing! 💪',
      body: 'Every game play makes your brain stronger. Keep exploring and you will win 3 stars!',
      badge: 'Brave Learning Adventurer',
    };
  };

  const praise = getEncouragement();

  const bellRotate = bellSwingAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-22deg', '0deg', '22deg'],
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Celebration Trophy & Ringing Golden School Bell */}
        <Animated.View style={[styles.trophyWrapper, { transform: [{ scale: trophyScale }] }]}>
          <View style={styles.trophyHalo}>
            <Text style={styles.confettiPuff}>🎉 ✨ 🎊 🔔 🌟 🎉</Text>
            <View style={styles.trophyBadge}>
              {game.mechanic === 'SCHOOL_BELL_RUN' ? (
                <View style={styles.goldenBellBox}>
                  {/* Sound Wave Expansion Ripple */}
                  <Animated.View
                    style={[
                      styles.bellSoundRipple,
                      {
                        transform: [{ scale: bellRippleAnim }],
                        opacity: bellRippleAnim.interpolate({
                          inputRange: [0.85, 1.1, 1.35],
                          outputRange: [0.7, 0.35, 0],
                        }),
                      },
                    ]}
                  />
                  <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
                    <Text style={{ fontSize: 56 }}>🔔</Text>
                  </Animated.View>
                </View>
              ) : (
                <Trophy size={64} color="#D97706" />
              )}
            </View>
          </View>
        </Animated.View>

        {/* 3 Animated Golden Stars */}
        <View style={styles.starsRow}>
          {[starAnim1, starAnim2, starAnim3].map((anim, idx) => {
            const isEarned = idx < result.starsEarned;
            return (
              <Animated.View
                key={idx}
                style={[
                  styles.starContainer,
                  idx === 1 && styles.centerStarMargin,
                  {
                    transform: [
                      { scale: isEarned ? anim : 0.8 },
                      {
                        rotate: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['-30deg', '0deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Star
                  size={idx === 1 ? 62 : 48}
                  color={isEarned ? '#F59E0B' : '#CBD5E1'}
                  fill={isEarned ? '#FBBF24' : '#F1F5F9'}
                />
              </Animated.View>
            );
          })}
        </View>

        {/* Celebratory Card */}
        <Animated.View
          style={[
            styles.celebrationCard,
            { transform: [{ translateY: badgeSlide }] },
          ]}
        >
          {/* Animated Student Buddy cheering */}
          <View style={styles.mascotSpeechRow}>
            <CartoonStudentBuddy
              size="compact"
              isCelebrating={true}
              showSpeech={false}
            />
            <View style={styles.speechBubble}>
              <Text style={styles.mascotSpeechText}>
                "{game.mascotName} is cheering for you! You did an amazing job on {game.title}!"
              </Text>
            </View>
          </View>

          <Text style={styles.praiseTitle}>{praise.title}</Text>
          <Text style={styles.praiseBody}>{praise.body}</Text>

          {/* Stats Badge Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {result.correctCount}/{result.totalChallenges}
              </Text>
              <Text style={styles.statLabel}>Challenges Done</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#059669' }]}>
                {result.scorePercentage}%
              </Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#D97706' }]}>
                {result.starsEarned} / 3
              </Text>
              <Text style={styles.statLabel}>Golden Stars</Text>
            </View>
          </View>

          {/* Maharashtra Certificate Pill */}
          <View style={styles.certPill}>
            <Award size={20} color="#78350F" />
            <Text style={styles.certPillText}>{praise.badge}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={onPlayAgain}
              style={styles.playAgainBtn}
              activeOpacity={0.85}
            >
              <RotateCcw size={20} color="#582C84" />
              <Text style={styles.playAgainBtnText}>
                Play Again 🔄
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onContinueLearning}
              style={styles.continueBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue Learning 🚀</Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  trophyWrapper: {
    alignItems: 'center',
  },
  trophyHalo: {
    alignItems: 'center',
    gap: 8,
  },
  confettiPuff: {
    fontSize: 24,
    letterSpacing: 6,
  },
  trophyBadge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  goldenBellBox: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellSoundRipple: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(254, 243, 199, 0.45)',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginVertical: 4,
  },
  starContainer: {
    padding: 4,
  },
  centerStarMargin: {
    marginTop: -18,
  },
  celebrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 22,
    gap: 16,
    width: '100%',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  mascotSpeechRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 22,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  speechBubble: {
    flex: 1,
  },
  mascotSpeechText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    lineHeight: 18,
  },
  praiseTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
  },
  praiseBody: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
    paddingVertical: 6,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#582C84',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'center',
  },
  certPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  certPillText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#78350F',
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginTop: 6,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 50,
    backgroundColor: '#059669',
    borderBottomWidth: 4,
    borderColor: '#047857',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  playAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderBottomWidth: 4,
  },
  playAgainBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#582C84',
  },
});
