import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { CheckCircle2, RotateCcw, ArrowRight, Sparkles, Heart } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GameFeedbackOverlayProps {
  visible: boolean;
  isCorrect: boolean;
  message: string;
  onNext: () => void;
  onRetry: () => void;
  isLastChallenge?: boolean;
}

export const GameFeedbackOverlay: React.FC<GameFeedbackOverlayProps> = ({
  visible,
  isCorrect,
  message,
  onNext,
  onRetry,
  isLastChallenge = false,
}) => {
  const reduceMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(45)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        scaleAnim.setValue(1);
        slideAnim.setValue(0);
        opacityAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 7,
            tension: 45,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      scaleAnim.setValue(0.9);
      slideAnim.setValue(45);
      opacityAnim.setValue(0);
    }
  }, [visible, reduceMotion]);

  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <Animated.View
        style={[
          styles.bannerCard,
          isCorrect ? styles.correctCard : styles.incorrectCard,
          {
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Feedback Icon Header */}
        <View
          style={[
            styles.iconCircle,
            isCorrect ? styles.iconCorrectCircle : styles.iconIncorrectCircle,
          ]}
        >
          {isCorrect ? (
            <CheckCircle2 size={38} color="#059669" />
          ) : (
            <Heart size={38} color="#E11D48" />
          )}
        </View>

        {/* Feedback Title */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            {isCorrect && <Sparkles size={20} color="#059669" />}
            <Text
              style={[
                styles.titleText,
                isCorrect ? styles.correctTitle : styles.incorrectTitle,
              ]}
            >
              {isCorrect ? 'Splendid Job! 🌟' : 'Almost There! 💪'}
            </Text>
            {isCorrect && <Sparkles size={20} color="#059669" />}
          </View>

          <Text style={styles.messageText}>{message}</Text>
        </View>

        {/* Big Tactile Action Button */}
        <View style={styles.actionsRow}>
          {isCorrect ? (
            <TouchableOpacity
              onPress={onNext}
              style={[styles.actionBtn, styles.nextBtn]}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>
                {isLastChallenge ? 'See Your Star Rewards! 🏆' : 'Next Challenge ➔'}
              </Text>
              <ArrowRight size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onRetry}
              style={[styles.actionBtn, styles.retryBtn]}
              activeOpacity={0.85}
            >
              <RotateCcw size={20} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Try Again With Love! 🔄</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    bottom: 14,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 999,
  },
  bannerCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 26,
    padding: 18,
    alignItems: 'center',
    gap: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 2.5,
  },
  correctCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  incorrectCard: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCorrectCircle: {
    backgroundColor: '#D1FAE5',
  },
  iconIncorrectCircle: {
    backgroundColor: '#FFE4E6',
  },
  textContainer: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
  },
  correctTitle: {
    color: '#065F46',
  },
  incorrectTitle: {
    color: '#9F1239',
  },
  messageText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  actionsRow: {
    width: '100%',
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 50,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    borderBottomWidth: 4,
  },
  nextBtn: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  retryBtn: {
    backgroundColor: '#E11D48',
    borderColor: '#BE123C',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
