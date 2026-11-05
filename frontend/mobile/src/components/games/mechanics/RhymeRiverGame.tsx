import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Volume2, Sparkles } from 'lucide-react-native';
import { GameChallenge, GameOption } from '../types';
import { Colors } from '../../../theme/colors';

interface RhymeRiverGameProps {
  challenge: GameChallenge;
  onSelectOption: (option: GameOption) => void;
  selectedOptionId: string | null;
  isResolved: boolean;
  disabled?: boolean;
}

export const RhymeRiverGame: React.FC<RhymeRiverGameProps> = ({
  challenge,
  onSelectOption,
  selectedOptionId,
  isResolved,
  disabled = false,
}) => {
  // Floating animations for bubbles
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;

  // Pulse animation for target word
  const targetPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Gentle floating loop for bubbles
    const createFloating = (anim: Animated.Value, delay: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: -8,
            duration: duration,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const float1 = createFloating(floatAnim1, 0, 1600);
    const float2 = createFloating(floatAnim2, 300, 1800);
    const float3 = createFloating(floatAnim3, 600, 1500);

    float1.start();
    float2.start();
    float3.start();

    // Target pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(targetPulse, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(targetPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      float1.stop();
      float2.stop();
      float3.stop();
    };
  }, []);

  const getFloatAnim = (index: number) => {
    if (index === 0) return floatAnim1;
    if (index === 1) return floatAnim2;
    return floatAnim3;
  };

  return (
    <View style={styles.container}>
      {/* River Scenery Board */}
      <View style={styles.riverBoard}>
        {/* River Ripples Header */}
        <View style={styles.riverSkyRow}>
          <Text style={styles.riverSkyEmoji}>🌊 🐸 💧 🌸 💧</Text>
        </View>

        {/* Target Word Golden Lilypad */}
        <View style={styles.targetSection}>
          <Text style={styles.promptSubtext}>{challenge.promptText}</Text>

          <Animated.View style={[styles.goldenLilypad, { transform: [{ scale: targetPulse }] }]}>
            <View style={styles.targetIconRow}>
              <Text style={styles.targetVisualEmoji}>{challenge.targetVisual || '🌟'}</Text>
              <Text style={styles.targetWordText}>{challenge.targetWord}</Text>
              <View style={styles.audioBadge}>
                <Volume2 size={18} color="#2B124C" />
              </View>
            </View>
          </Animated.View>
        </View>

        {/* River Stream Divider */}
        <View style={styles.waterStream}>
          <Text style={styles.waterWavesText}>~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~</Text>
          <Text style={styles.instructionBubble}>
            {challenge.targetWord ? `Find the bubble matching "${challenge.targetWord}"! 👇` : 'Tap the matching bubble below! 👇'}
          </Text>
        </View>

        {/* Floating Lilypad Word Bubbles */}
        <View style={styles.bubblesGrid}>
          {challenge.options.map((option: GameOption, index: number) => {
            const isSelected = selectedOptionId === option.id;
            const floatAnim = getFloatAnim(index);

            let bubbleStyle = styles.bubbleDefault;
            if (isSelected) {
              bubbleStyle = option.isCorrect ? styles.bubbleCorrect : styles.bubbleIncorrect;
            }

            return (
              <Animated.View
                key={option.id}
                style={[
                  styles.bubbleWrapper,
                  { transform: [{ translateY: floatAnim }] },
                ]}
              >
                <TouchableOpacity
                  onPress={() => onSelectOption(option)}
                  disabled={disabled}
                  activeOpacity={0.8}
                  style={[styles.bubbleBtn, bubbleStyle]}
                >
                  {/* Floating Bubble Top Specular Highlight */}
                  <View style={styles.bubbleShine} />

                  <Text style={styles.optionEmoji}>{option.visual || '🎈'}</Text>
                  <Text style={styles.optionText}>{option.text}</Text>

                  {isResolved && option.isCorrect && (
                    <View style={styles.correctStarBadge}>
                      <Sparkles size={14} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
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
    alignItems: 'center',
  },
  riverBoard: {
    width: '100%',
    backgroundColor: '#E0F7FA',
    borderRadius: 30,
    padding: 16,
    paddingVertical: 20,
    borderWidth: 3,
    borderColor: '#80DEEA',
    gap: 16,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  riverSkyRow: {
    alignItems: 'center',
    marginBottom: -4,
  },
  riverSkyEmoji: {
    fontSize: 22,
    letterSpacing: 8,
  },
  targetSection: {
    alignItems: 'center',
    gap: 6,
  },
  promptSubtext: {
    fontSize: 15,
    fontWeight: '800',
    color: '#006064',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goldenLilypad: {
    backgroundColor: '#FFF9C4',
    borderWidth: 3,
    borderColor: '#FBC02D',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#F57F17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  targetIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  targetVisualEmoji: {
    fontSize: 28,
  },
  targetWordText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#2B124C',
    letterSpacing: 2,
  },
  audioBadge: {
    backgroundColor: '#FFE082',
    padding: 6,
    borderRadius: 50,
  },
  waterStream: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  waterWavesText: {
    color: '#4DD0E1',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  instructionBubble: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00838F',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bubblesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 8,
  },
  bubbleWrapper: {
    width: '46%',
    maxWidth: 160,
  },
  bubbleBtn: {
    minHeight: 110,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    position: 'relative',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 3,
  },
  bubbleDefault: {
    backgroundColor: '#FFFFFF',
    borderColor: '#4DD0E1',
  },
  bubbleCorrect: {
    backgroundColor: '#C8E6C9',
    borderColor: '#2E7D32',
  },
  bubbleIncorrect: {
    backgroundColor: '#FFCDD2',
    borderColor: '#C2185B',
  },
  bubbleShine: {
    position: 'absolute',
    top: 8,
    left: 14,
    width: 22,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 10,
    transform: [{ rotate: '-25deg' }],
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#190019',
    letterSpacing: 1,
    textAlign: 'center',
  },
  correctStarBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#2E7D32',
    padding: 5,
    borderRadius: 50,
  },
});
