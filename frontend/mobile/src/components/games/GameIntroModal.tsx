import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Play, Sparkles, X, Check, Award, ArrowLeft } from 'lucide-react-native';
import { GameDefinition } from './types';
import { Colors } from '../../theme/colors';
import { CartoonStudentBuddy } from './CartoonStudentBuddy';

import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GameIntroModalProps {
  visible: boolean;
  game: GameDefinition;
  onStart: () => void;
  onClose: () => void;
}

export const GameIntroModal: React.FC<GameIntroModalProps> = ({
  game,
  onStart,
  onClose,
}) => {
  const reduceMotion = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#F0FDF4' }]}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.8}>
              <ArrowLeft size={22} color="#582C84" />
            </TouchableOpacity>

            <View style={[styles.subjectPill, { backgroundColor: '#DCFCE7' }]}>
              <Sparkles size={14} color="#059669" />
              <Text style={[styles.subjectPillText, { color: '#059669' }]}>
                {game.subject} CONCEPT GAME
              </Text>
            </View>
          </View>

          {/* Big Friendly Cartoon Mascot Illustration */}
          <View style={styles.mascotHeroContainer}>
            {game.mechanic === 'SCHOOL_BELL_RUN' ? (
              <CartoonStudentBuddy
                size="large"
                speechText="Welcome to Grade One! Let's leap across the garden trail to school! 🎒"
                showSpeech={false}
              />
            ) : (
              <View style={[styles.mascotCircleOuter, { borderColor: game.theme.accent }]}>
                <View style={[styles.mascotCircleInner, { backgroundColor: game.theme.lightBg }]}>
                  <Text style={styles.mascotEmojiLarge}>{game.mascotEmoji}</Text>
                </View>
              </View>
            )}
            <Text style={styles.mascotGreeting}>
              Hello Learner! I'm {game.mascotName}!
            </Text>
          </View>

          {/* Game Title & Concept Card */}
          <View style={styles.introCard}>
            <Text style={styles.gameTitle}>{game.title}</Text>
            <Text style={styles.gameSubtitle}>{game.subtitle}</Text>

            <View style={styles.conceptTagRow}>
              <Award size={16} color={game.theme.primary} />
              <Text style={styles.conceptTagText}>
                Maharashtra Board Concept: <Text style={styles.boldText}>{game.conceptName}</Text>
              </Text>
            </View>

            {/* How to Play Instructions */}
            <View style={styles.instructionsSection}>
              <Text style={styles.instructionsHeader}>How to Play:</Text>
              <View style={styles.instructionsList}>
                {game.instructions.map((step, idx) => (
                  <View key={idx} style={styles.instructionItem}>
                    <View style={[styles.stepNumberBadge, { backgroundColor: game.theme.primary }]}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Star Reward Promise Box */}
            <View style={styles.rewardBox}>
              <Text style={styles.rewardBoxText}>
                🏆 Complete all {game.challenges.length} challenges to earn 3 Golden Stars!
              </Text>
            </View>

            {/* Start Playing Button */}
            <TouchableOpacity
              onPress={onStart}
              style={styles.startBtn}
              activeOpacity={0.85}
            >
              <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.startBtnText}>START PLAYING NOW! 🚀</Text>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
  },
  subjectPillText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mascotHeroContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  mascotCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    padding: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  mascotCircleInner: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmojiLarge: {
    fontSize: 60,
  },
  mascotGreeting: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    gap: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  gameSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  conceptTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8F4F9',
    padding: 10,
    borderRadius: 16,
  },
  conceptTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  boldText: {
    fontWeight: '900',
    color: Colors.text,
  },
  instructionsSection: {
    gap: 12,
    paddingTop: 4,
  },
  instructionsHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  instructionsList: {
    gap: 10,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#37474F',
    flex: 1,
    lineHeight: 20,
  },
  rewardBox: {
    backgroundColor: '#FFFDE7',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFF59D',
    alignItems: 'center',
  },
  rewardBoxText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F57F17',
    textAlign: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#059669',
    paddingVertical: 18,
    borderRadius: 50,
    borderBottomWidth: 5,
    borderColor: '#047857',
    marginTop: 6,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
