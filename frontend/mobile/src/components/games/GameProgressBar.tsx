import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Star, Sparkles, Check, Flag } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GameProgressBarProps {
  currentChallengeIndex: number;
  totalChallenges: number;
  starsEarned: number;
  colorTheme?: {
    primary: string;
    accent: string;
  };
}

export const GameProgressBar: React.FC<GameProgressBarProps> = ({
  currentChallengeIndex,
  totalChallenges,
  starsEarned,
  colorTheme,
}) => {
  const reduceMotion = useReducedMotion();
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const starScale = useRef(new Animated.Value(1)).current;

  const currentStep = Math.min(currentChallengeIndex + 1, totalChallenges);
  const targetPercent = (currentStep / totalChallenges) * 100;

  useEffect(() => {
    if (reduceMotion) {
      animatedProgress.setValue(targetPercent);
      return;
    }
    Animated.spring(animatedProgress, {
      toValue: targetPercent,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [targetPercent, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    // Pulse stars when a star is earned
    Animated.sequence([
      Animated.timing(starScale, { toValue: 1.35, duration: 200, useNativeDriver: true }),
      Animated.timing(starScale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [starsEarned, reduceMotion]);

  const progressInterpolate = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const barColor = colorTheme?.primary || Colors.gamePurple;

  return (
    <View style={styles.container}>
      {/* Top Header Row with Challenge Count & Star Rating */}
      <View style={styles.headerRow}>
        {/* Step Badge */}
        <View style={styles.challengeBadge}>
          <Sparkles size={16} color={Colors.gameWarmYellowDark} />
          <Text style={styles.challengeBadgeText}>
            Step {currentStep} of {totalChallenges}
          </Text>
        </View>

        {/* Live Stars Tracker */}
        <Animated.View style={[styles.starsTracker, { transform: [{ scale: starScale }] }]}>
          <Text style={styles.starsScoreLabel}>Stars:</Text>
          {[1, 2, 3].map((starIdx) => {
            const isFilled = starsEarned >= starIdx;
            return (
              <View key={starIdx} style={styles.starItem}>
                <Star
                  size={22}
                  color={isFilled ? '#F59E0B' : '#E2E8F0'}
                  fill={isFilled ? '#FBBF24' : '#F1F5F9'}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>

      {/* Playful Animated Stepping-Stones Progress Track */}
      <View style={styles.trackContainer}>
        {/* Background Track */}
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fillBar,
              {
                width: progressInterpolate,
                backgroundColor: Colors.gameWarmYellow,
              },
            ]}
          />
        </View>

        {/* Stepping Stone Nodes along the Track */}
        <View style={styles.nodesOverlay}>
          {Array.from({ length: totalChallenges }).map((_, idx) => {
            const isCurrent = idx === currentChallengeIndex;
            const isPassed = idx < currentStep;
            const isLast = idx === totalChallenges - 1;

            return (
              <View
                key={idx}
                style={[
                  styles.nodeCircle,
                  isCurrent && styles.nodeCurrent,
                  isPassed && styles.nodePassed,
                ]}
              >
                {isPassed && !isCurrent ? (
                  <Check size={12} color="#FFFFFF" strokeWidth={3.5} />
                ) : isLast ? (
                  <Flag size={12} color={isCurrent ? '#FFFFFF' : '#78350F'} />
                ) : (
                  <Text
                    style={[
                      styles.nodeNumber,
                      (isCurrent || isPassed) && styles.nodeNumberActive,
                    ]}
                  >
                    {idx + 1}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 6,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FEF3C7',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  challengeBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#78350F',
  },
  starsTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FEF3C7',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  starsScoreLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#78350F',
    marginRight: 2,
  },
  starItem: {
    padding: 1,
  },
  trackContainer: {
    width: '100%',
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  fillBar: {
    height: '100%',
    borderRadius: 10,
  },
  nodesOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeCircle: {
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
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  nodeCurrent: {
    backgroundColor: '#06D6A0',
    borderColor: '#059669',
    transform: [{ scale: 1.25 }],
  },
  nodePassed: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  nodeNumber: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
  },
  nodeNumberActive: {
    color: '#FFFFFF',
  },
});
