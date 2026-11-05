import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import Svg, {
  Circle,
  Path,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Colors } from '../../theme/colors';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface CartoonStudentBuddyProps {
  speechText?: string;
  isCelebrating?: boolean;
  isThinking?: boolean;
  stepIndex?: number;
  onPress?: () => void;
  size?: 'compact' | 'regular' | 'large';
  showSpeech?: boolean;
}

export const CartoonStudentBuddy: React.FC<CartoonStudentBuddyProps> = ({
  speechText = "Let's leap to school together! 🎒",
  isCelebrating = false,
  isThinking = false,
  stepIndex,
  onPress,
  size = 'regular',
  showSpeech = true,
}) => {
  const reduceMotion = useReducedMotion();

  const bobAnim = useRef(new Animated.Value(0)).current;
  const jumpAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  // 1. Welcome entrance bounce on mount
  useEffect(() => {
    if (reduceMotion) return;

    Animated.sequence([
      Animated.delay(100),
      Animated.spring(jumpAnim, {
        toValue: -14,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(jumpAnim, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion]);

  // 2. Idle gentle bobbing & waving loop (skipped if reduced motion is preferred)
  useEffect(() => {
    if (reduceMotion) {
      bobAnim.setValue(0);
      waveAnim.setValue(0);
      return;
    }

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: -4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    bobLoop.start();

    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: -8,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    waveLoop.start();

    return () => {
      bobLoop.stop();
      waveLoop.stop();
    };
  }, [reduceMotion]);

  // 3. Celebratory leap when student answers correctly
  useEffect(() => {
    if (isCelebrating) {
      if (!reduceMotion) {
        Animated.sequence([
          Animated.spring(jumpAnim, {
            toValue: -22,
            friction: 4,
            tension: 65,
            useNativeDriver: true,
          }),
          Animated.spring(jumpAnim, {
            toValue: 0,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();

        sparkleAnim.setValue(0);
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [isCelebrating, reduceMotion]);

  // 4. Progressing to the next challenge: cheerful stepping hop!
  useEffect(() => {
    if (reduceMotion || stepIndex === undefined || stepIndex === 0) return;

    Animated.sequence([
      Animated.spring(jumpAnim, {
        toValue: -16,
        friction: 4,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.spring(jumpAnim, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stepIndex, reduceMotion]);

  // Dimension scaling
  const dimensions =
    size === 'compact'
      ? { width: 56, height: 68, svgSize: 64, speechMax: 180 }
      : size === 'large'
      ? { width: 90, height: 110, svgSize: 104, speechMax: 260 }
      : { width: 72, height: 86, svgSize: 82, speechMax: 220 };

  const waveRotation = waveAnim.interpolate({
    inputRange: [-8, 8],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={styles.wrapper}
    >
      <View style={styles.characterRow}>
        {/* Animated Character Avatar */}
        <Animated.View
          style={[
            styles.characterBox,
            {
              width: dimensions.width,
              height: dimensions.height,
              transform: [{ translateY: Animated.add(bobAnim, jumpAnim) }],
            },
          ]}
        >
          <Svg
            width={dimensions.svgSize}
            height={dimensions.svgSize}
            viewBox="0 0 100 100"
            fill="none"
          >
            <Defs>
              <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FFE0B2" />
                <Stop offset="100%" stopColor="#FFCC80" />
              </LinearGradient>
              <LinearGradient id="uniformGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#3F51B5" />
                <Stop offset="100%" stopColor="#283593" />
              </LinearGradient>
              <LinearGradient id="backpackGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FF7043" />
                <Stop offset="100%" stopColor="#E64A19" />
              </LinearGradient>
            </Defs>

            {/* School Backpack Peeking Behind */}
            <Rect x="20" y="44" width="16" height="30" rx="8" fill="url(#backpackGrad)" />
            <Path d="M22 50 C 18 56, 18 64, 22 70" stroke="#FFAB91" strokeWidth="3" strokeLinecap="round" />

            {/* Boy Body - School Uniform Shirt & Collar */}
            <Rect x="28" y="52" width="44" height="36" rx="10" fill="url(#uniformGrad)" />
            {/* White Shirt Collar */}
            <Path d="M42 52 L50 62 L36 56 Z" fill="#FFFFFF" />
            <Path d="M58 52 L50 62 L64 56 Z" fill="#FFFFFF" />
            {/* Red School Tie */}
            <Path d="M48 62 L52 62 L53 76 L50 79 L47 76 Z" fill="#E53935" />

            {/* Head & Neck */}
            <Rect x="44" y="42" width="12" height="12" fill="url(#skinGrad)" rx="3" />
            <Circle cx="50" cy="32" r="22" fill="url(#skinGrad)" />

            {/* Cheerful Hair */}
            <Path
              d="M28 28 C 28 14, 44 10, 56 12 C 68 14, 73 22, 73 28 C 73 28, 68 20, 54 18 C 40 16, 32 24, 28 28 Z"
              fill="#3E2723"
            />
            {/* Side Curls & Ears */}
            <Circle cx="28" cy="34" r="5" fill="url(#skinGrad)" />
            <Circle cx="72" cy="34" r="5" fill="url(#skinGrad)" />
            <Path d="M30 20 C 33 24, 38 24, 40 20" stroke="#3E2723" strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* Expressive Face */}
            {/* Friendly Bright Eyes */}
            <Circle cx="42" cy="31" r="3.5" fill="#1A1A2E" />
            <Circle cx="43" cy="30" r="1.2" fill="#FFFFFF" />
            <Circle cx="58" cy="31" r="3.5" fill="#1A1A2E" />
            <Circle cx="59" cy="30" r="1.2" fill="#FFFFFF" />

            {/* Rosy Cheeks */}
            <Circle cx="37" cy="36" r="3.5" fill="#FF8A80" opacity="0.6" />
            <Circle cx="63" cy="36" r="3.5" fill="#FF8A80" opacity="0.6" />

            {/* Happy Smile */}
            {isCelebrating ? (
              // Open joyful laugh
              <Path d="M44 38 Q 50 46, 56 38 Z" fill="#C62828" stroke="#8E0000" strokeWidth="1" />
            ) : (
              // Warm friendly smile
              <Path d="M44 38 Q 50 44, 56 38" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            )}

            {/* Cheerful Eyebrows */}
            <Path d="M38 25 Q 42 23, 46 25" stroke="#3E2723" strokeWidth="2" strokeLinecap="round" fill="none" />
            <Path d="M54 25 Q 58 23, 62 25" stroke="#3E2723" strokeWidth="2" strokeLinecap="round" fill="none" />

            {/* Waving Arm / Hand */}
            <Path d="M68 56 Q 78 52, 80 44" stroke="url(#skinGrad)" strokeWidth="7" strokeLinecap="round" fill="none" />
            <Circle cx="81" cy="42" r="4.5" fill="url(#skinGrad)" />

            {/* Left Hand Holding Strap */}
            <Circle cx="26" cy="62" r="4" fill="url(#skinGrad)" />
          </Svg>

          {/* Floating celebratory star bursts */}
          {isCelebrating && (
            <Animated.View
              style={[
                styles.floatingSparkle,
                {
                  opacity: sparkleAnim.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: sparkleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -32],
                      }),
                    },
                    {
                      scale: sparkleAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.6, 1.3, 0.9],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.celebrateSparkleText}>⭐</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Friendly Speech Bubble */}
        {showSpeech && speechText ? (
          <View style={[styles.speechBubble, { maxWidth: dimensions.speechMax }]}>
            {/* Bubble Tail Pointer */}
            <View style={styles.bubbleTail} />
            <Text style={styles.speechText} numberOfLines={3}>
              {speechText}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  characterBox: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingSparkle: {
    position: 'absolute',
    top: -12,
    right: -6,
    zIndex: 10,
  },
  celebrateSparkleText: {
    fontSize: 20,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: Colors.gameWarmYellow,
    shadowColor: Colors.gameWarmYellowDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: '40%',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: 6,
    borderRightWidth: 8,
    borderBottomWidth: 6,
    borderLeftWidth: 0,
    borderTopColor: 'transparent',
    borderRightColor: Colors.gameWarmYellow,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  speechText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2B124C',
    lineHeight: 18,
  },
});
