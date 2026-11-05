import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import {
  Bell,
  Volume2,
  VolumeX,
  Music,
  Sparkles,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  ArrowLeft,
  X,
} from 'lucide-react-native';
import { GameChallenge, GameOption } from '../types';
import { Colors } from '../../../theme/colors';
import { CartoonStudentBuddy } from '../CartoonStudentBuddy';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  speakText,
  stopSpeech,
  setSpeechMuted,
  getSpeechMuted,
  isSpeechSupported,
} from '../../../utils/speechHelper';
import {
  playJumpSound,
  playStarCollectSound,
  playBellRingSound,
  playWaterSplashSound,
  playCelebrationFanfare,
  playGentleRetrySound,
  playTapSound,
  startBackgroundMusic,
  stopBackgroundMusic,
  pauseBackgroundMusic,
  resumeBackgroundMusic,
  setMusicMuted,
  getMusicMuted,
  setSfxMuted,
  getSfxMuted,
  initAudioOnUserGesture,
} from '../../../utils/soundEffects';
import {
  toggleFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
} from '../../../utils/fullscreenHelper';

interface SchoolBellRunGameProps {
  challenge: GameChallenge;
  currentStepIndex: number;
  totalSteps: number;
  onSelectOption: (option: GameOption) => void;
  selectedOptionId: string | null;
  isResolved: boolean;
  disabled?: boolean;
  onClose?: () => void;
  onRestart?: () => void;
  starsEarned?: number;
  score?: number;
  onNext?: () => void;
  isLastChallenge?: boolean;
}

export const WAYPOINTS = [
  { id: 'wp_1', label: 'Home Yard', icon: '🏡', detail: 'See me skip & run' },
  { id: 'wp_2', label: 'Rhyme Brook', icon: '💧', detail: 'Rhyme stepping stones' },
  { id: 'wp_3', label: 'School Gate', icon: '🌳', detail: 'See me walk & grin' },
  { id: 'wp_4', label: 'Grade One!', icon: '🔔', detail: 'Ding-Dong Bell!' },
];

export const SchoolBellRunGame: React.FC<SchoolBellRunGameProps> = ({
  challenge,
  currentStepIndex,
  totalSteps,
  onSelectOption,
  selectedOptionId,
  isResolved,
  disabled = false,
  onClose,
  onRestart,
  starsEarned = 1,
  score = 100,
  onNext,
  isLastChallenge = false,
}) => {
  const reduceMotion = useReducedMotion();

  // 1. Audio State Management
  const [hasStartedGame, setHasStartedGame] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(getSpeechMuted());
  const [isBgmOn, setIsBgmOn] = useState<boolean>(!getMusicMuted());
  const [isSfxOn, setIsSfxOn] = useState<boolean>(!getSfxMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSpeakingNarration, setIsSpeakingNarration] = useState<boolean>(false);
  const [keyboardFocusedIndex, setKeyboardFocusedIndex] = useState<number>(0);
  const [showTutorial, setShowTutorial] = useState<boolean>(true);

  // 2. Animated Values for Character & Physical Movement
  const charBounce = useRef(new Animated.Value(0)).current;
  const charJumpArc = useRef(new Animated.Value(0)).current;
  const charPositionX = useRef(new Animated.Value(0)).current;
  const waypointPops = useRef(WAYPOINTS.map(() => new Animated.Value(1))).current;

  // 3. Parallax Environmental Animations
  const cloudDrift1 = useRef(new Animated.Value(0)).current;
  const cloudDrift2 = useRef(new Animated.Value(0)).current;
  const sunGlow = useRef(new Animated.Value(1)).current;
  const bellSwing = useRef(new Animated.Value(0)).current;
  const bellRipples = useRef(new Animated.Value(0)).current;

  // 4. Action Arena Interactions
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const optionScales = useRef<{ [key: string]: Animated.Value }>({}).current;
  const correctGlowAnim = useRef(new Animated.Value(0)).current;
  const floatingStarsAnim = useRef(new Animated.Value(0)).current;

  // Initialize option scale animated values safely
  if (challenge?.options) {
    challenge.options.forEach((opt) => {
      if (!optionScales[opt.id]) {
        optionScales[opt.id] = new Animated.Value(1);
      }
    });
  }

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      stopBackgroundMusic();
    };
  }, []);

  // Track Fullscreen state changes on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleFsChange = () => {
        setIsFullscreen(isFullscreenActive());
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFsChange);
      };
    }
  }, []);

  // Sync Raju's Position along the Cobblestone Road
  useEffect(() => {
    const targetProgress = Math.min(1, Math.max(0, currentStepIndex / (totalSteps - 1 || 3)));
    if (reduceMotion) {
      charPositionX.setValue(targetProgress);
    } else {
      Animated.spring(charPositionX, {
        toValue: targetProgress,
        friction: 6,
        tension: 35,
        useNativeDriver: false,
      }).start();

      if (waypointPops[currentStepIndex]) {
        Animated.sequence([
          Animated.spring(waypointPops[currentStepIndex], { toValue: 1.35, useNativeDriver: true }),
          Animated.spring(waypointPops[currentStepIndex], { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
      }
    }
  }, [currentStepIndex, totalSteps, reduceMotion]);

  // Environmental Loops (Clouds, Sun glow)
  useEffect(() => {
    if (reduceMotion) {
      charBounce.setValue(0);
      cloudDrift1.setValue(0);
      cloudDrift2.setValue(0);
      sunGlow.setValue(1);
      return;
    }

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(charBounce, { toValue: -6, duration: 550, useNativeDriver: true }),
        Animated.timing(charBounce, { toValue: 0, duration: 550, useNativeDriver: true }),
      ])
    );
    bounceLoop.start();

    const cloudLoop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(cloudDrift1, { toValue: 16, duration: 4200, useNativeDriver: true }),
        Animated.timing(cloudDrift1, { toValue: -16, duration: 4200, useNativeDriver: true }),
      ])
    );
    cloudLoop1.start();

    const cloudLoop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(cloudDrift2, { toValue: -12, duration: 6000, useNativeDriver: true }),
        Animated.timing(cloudDrift2, { toValue: 12, duration: 6000, useNativeDriver: true }),
      ])
    );
    cloudLoop2.start();

    const sunLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunGlow, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(sunGlow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    sunLoop.start();

    return () => {
      bounceLoop.stop();
      cloudLoop1.stop();
      cloudLoop2.stop();
      sunLoop.stop();
    };
  }, [reduceMotion]);

  // Dynamic Narration Generator for each Checkpoint & Challenge
  const getCheckpointVoicePrompt = useCallback(
    (stepIdx: number, ch: GameChallenge): string => {
      if (!ch) return 'Let us explore and learn!';
      const stageIntro =
        stepIdx === 0
          ? 'Checkpoint 1: Water Brook! '
          : stepIdx === 1
          ? 'Checkpoint 2: Rhyme Brook! '
          : stepIdx === 2
          ? 'Checkpoint 3: School Gate! '
          : 'Checkpoint 4: Grade One Belfry! ';
      return `${stageIntro}${ch.promptText}`;
    },
    []
  );

  // Play Narrator Voice with State Tracking
  const playNarratorVoice = useCallback(
    (textToSpeak: string) => {
      if (isVoiceMuted) return;
      setIsSpeakingNarration(true);
      speakText(textToSpeak, {
        rate: 0.88,
        pitch: 1.1,
        onStart: () => setIsSpeakingNarration(true),
        onEnd: () => setIsSpeakingNarration(false),
        onError: () => setIsSpeakingNarration(false),
      });
    },
    [isVoiceMuted]
  );

  // Read Prompt Aloud on Checkpoint Change
  useEffect(() => {
    if (hasStartedGame && !isPaused && !isResolved && challenge) {
      const clue = getCheckpointVoicePrompt(currentStepIndex, challenge);
      playNarratorVoice(clue);
    }
  }, [currentStepIndex, hasStartedGame, isPaused, challenge, getCheckpointVoicePrompt, playNarratorVoice]);

  // Action: Trigger Physical Character Jump Arc (Spacebar / Jump button)
  const executeCharacterJumpArc = () => {
    playJumpSound();
    if (reduceMotion) return;
    charJumpArc.setValue(0);
    Animated.sequence([
      Animated.timing(charJumpArc, { toValue: -48, duration: 240, useNativeDriver: true }),
      Animated.timing(charJumpArc, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  };

  // Correct Answer Celebration Effect
  useEffect(() => {
    if (isResolved) {
      if (currentStepIndex === 0) {
        executeCharacterJumpArc();
        playStarCollectSound();
        playNarratorVoice('Super jump! You crossed the brook! Let us keep moving!');
      } else if (currentStepIndex === 1) {
        playWaterSplashSound();
        playStarCollectSound();
        playNarratorVoice('Hooray! That is the rhyming stone! Fantastic!');
      } else if (currentStepIndex === 2) {
        playStarCollectSound();
        playNarratorVoice('The school gate is unlocked! You are almost at Grade One!');
      } else if (currentStepIndex === 3) {
        playBellRingSound();
        playCelebrationFanfare();
        playNarratorVoice('Ding-Dong! The school bell rings! Welcome to Grade One! You did it!');

        Animated.sequence([
          Animated.timing(bellSwing, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(bellSwing, { toValue: -1, duration: 160, useNativeDriver: true }),
          Animated.timing(bellSwing, { toValue: 0.6, duration: 140, useNativeDriver: true }),
          Animated.timing(bellSwing, { toValue: 0, duration: 140, useNativeDriver: true }),
        ]).start();

        bellRipples.setValue(0);
        Animated.timing(bellRipples, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      }

      if (!reduceMotion) {
        correctGlowAnim.setValue(0);
        Animated.sequence([
          Animated.timing(correctGlowAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(correctGlowAnim, { toValue: 0.7, duration: 400, useNativeDriver: true }),
        ]).start();

        floatingStarsAnim.setValue(0);
        Animated.timing(floatingStarsAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [isResolved, currentStepIndex, reduceMotion]);

  // Incorrect Answer: Non-punitive wobble & gentle hint chime
  useEffect(() => {
    if (selectedOptionId && !isResolved) {
      playGentleRetrySound();
      const hint = challenge.hintText || 'Listen closely to the rhyme and try another stone!';
      playNarratorVoice(`Almost there! ${hint}`);

      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
        ]).start();
      }
    }
  }, [selectedOptionId, isResolved, reduceMotion, challenge]);

  // Desktop Keyboard Controls: Space/Arrows/Enter/P/M/R
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Pause / Resume (P or Escape)
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        setIsPaused((prev) => {
          const next = !prev;
          if (next) pauseBackgroundMusic();
          else if (isBgmOn) resumeBackgroundMusic();
          return next;
        });
        playTapSound();
        return;
      }

      if (isPaused || !hasStartedGame || isResolved) return;

      // Mute / Unmute Voice (M)
      if (e.key === 'm' || e.key === 'M') {
        handleToggleVoice();
        return;
      }

      // Replay Voice Prompt (R)
      if (e.key === 'r' || e.key === 'R') {
        playNarratorVoice(getCheckpointVoicePrompt(currentStepIndex, challenge));
        return;
      }

      // Spacebar or Arrow Up: Jump / Select Focused Option
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        executeCharacterJumpArc();
        const focusedOpt = challenge.options[keyboardFocusedIndex] || challenge.options[0];
        if (focusedOpt) onSelectOption(focusedOpt);
        return;
      }

      // Arrow Left / Right: Cycle selection
      if (e.key === 'ArrowLeft') {
        playTapSound();
        setKeyboardFocusedIndex((prev) => (prev > 0 ? prev - 1 : challenge.options.length - 1));
      } else if (e.key === 'ArrowRight') {
        playTapSound();
        setKeyboardFocusedIndex((prev) => (prev < challenge.options.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Enter') {
        const focusedOpt = challenge.options[keyboardFocusedIndex] || challenge.options[0];
        if (focusedOpt) onSelectOption(focusedOpt);
      } else if (e.key === '1') {
        if (challenge.options[0]) onSelectOption(challenge.options[0]);
      } else if (e.key === '2') {
        if (challenge.options[1]) onSelectOption(challenge.options[1]);
      } else if (e.key === '3') {
        if (challenge.options[2]) onSelectOption(challenge.options[2]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isPaused,
    hasStartedGame,
    isResolved,
    currentStepIndex,
    challenge,
    keyboardFocusedIndex,
    isBgmOn,
    getCheckpointVoicePrompt,
    playNarratorVoice,
    onSelectOption,
  ]);

  // Audio Controls: Voice Narrator Toggle
  const handleToggleVoice = () => {
    const nextMuted = !isVoiceMuted;
    setIsVoiceMuted(nextMuted);
    setSpeechMuted(nextMuted);
    if (nextMuted) {
      stopSpeech();
      setIsSpeakingNarration(false);
    } else {
      playNarratorVoice('Voice narrator is turned on!');
    }
  };

  // Audio Controls: Background Music Toggle
  const handleToggleMusic = () => {
    playTapSound();
    const nextBgm = !isBgmOn;
    setIsBgmOn(nextBgm);
    setMusicMuted(!nextBgm);
    if (nextBgm) {
      resumeBackgroundMusic();
    } else {
      pauseBackgroundMusic();
    }
  };

  // Audio Controls: SFX Toggle
  const handleToggleSfx = () => {
    const nextSfx = !isSfxOn;
    setIsSfxOn(nextSfx);
    setSfxMuted(!nextSfx);
    if (nextSfx) playTapSound();
  };

  // Fullscreen Toggle
  const handleToggleFullscreen = async () => {
    playTapSound();
    const active = await toggleFullscreen();
    setIsFullscreen(active);
  };

  // Start Adventure (Satisfies browser audio autoplay policy upon user click)
  const handleStartAdventure = () => {
    playTapSound();
    initAudioOnUserGesture(); // Activate Web Audio Context on user gesture
    if (isBgmOn) {
      startBackgroundMusic(); // Start joyful background music loop
    }
    setHasStartedGame(true);
    setShowTutorial(false);
    playNarratorVoice(
      'Welcome to your school adventure! See me skip, see me run! Let us explore and learn together!'
    );
  };

  const bellRotation = bellSwing.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-25deg', '0deg', '25deg'],
  });

  return (
    <View style={styles.fullScreenCanvas}>
      {/* =========================================================================
          1. IMMERSIVE GAME HUD (Top Header Bar)
          Level Progress, Live Score & Stars, Music, Voice, Pause & Fullscreen
          ========================================================================= */}
      <View style={styles.gameHUD}>
        {/* Left: Exit & Pause Controls */}
        <View style={styles.hudLeftGroup}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.hudIconBtn} activeOpacity={0.8}>
              <ArrowLeft size={16} color="#1E293B" />
              <Text style={styles.hudBtnText}>Exit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              const next = !isPaused;
              setIsPaused(next);
              if (next) pauseBackgroundMusic();
              else if (isBgmOn) resumeBackgroundMusic();
              playTapSound();
            }}
            style={styles.hudIconBtn}
            activeOpacity={0.8}
          >
            {isPaused ? <Play size={16} color="#16A34A" /> : <Pause size={16} color="#475569" />}
            <Text style={styles.hudBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
        </View>

        {/* Center: Checkpoint Waypoint Pills */}
        <View style={styles.hudCenterGroup}>
          <View style={styles.checkpointPill}>
            <Text style={styles.checkpointPillLabel}>
              {currentStepIndex === 0
                ? '🏡 1. Home Yard'
                : currentStepIndex === 1
                ? '💧 2. Rhyme Brook'
                : currentStepIndex === 2
                ? '🌳 3. School Gate'
                : '🔔 4. Grade One!'}
            </Text>
          </View>
        </View>

        {/* Right: Stars, Music, Voice, Fullscreen */}
        <View style={styles.hudRightGroup}>
          {/* Animated Golden Stars */}
          <View style={styles.starsPill}>
            <Text style={styles.starsPillText}>⭐ {starsEarned}</Text>
          </View>

          {/* Background Music Toggle */}
          <TouchableOpacity
            onPress={handleToggleMusic}
            style={[styles.hudIconBtn, !isBgmOn && styles.hudMutedBtn]}
            activeOpacity={0.8}
            accessibilityLabel="Toggle Background Music"
          >
            <Music size={16} color={isBgmOn ? '#0284C7' : '#94A3B8'} />
            <Text style={[styles.hudBtnText, !isBgmOn && { color: '#94A3B8' }]}>
              {isBgmOn ? 'Music ON' : 'Music OFF'}
            </Text>
          </TouchableOpacity>

          {/* Voice Narrator Toggle */}
          <TouchableOpacity
            onPress={handleToggleVoice}
            style={[styles.hudIconBtn, isVoiceMuted && styles.hudMutedBtn]}
            activeOpacity={0.8}
            accessibilityLabel="Toggle Voice Narration"
          >
            {isVoiceMuted ? (
              <VolumeX size={16} color="#DC2626" />
            ) : (
              <Volume2 size={16} color={isSpeakingNarration ? '#2563EB' : '#16A34A'} />
            )}
            <Text style={[styles.hudBtnText, isVoiceMuted && { color: '#DC2626' }]}>
              {isVoiceMuted ? 'Muted' : 'Voice ON'}
            </Text>
          </TouchableOpacity>

          {/* Hear Instructions / Replay Button */}
          <TouchableOpacity
            onPress={() => playNarratorVoice(getCheckpointVoicePrompt(currentStepIndex, challenge))}
            style={[styles.hudIconBtn, isSpeakingNarration && styles.hudSpeakingActive]}
            activeOpacity={0.8}
          >
            <Text style={styles.hudBtnText}>🔊 Read</Text>
          </TouchableOpacity>

          {/* Fullscreen API Toggle on Web */}
          {isFullscreenSupported() && (
            <TouchableOpacity
              onPress={handleToggleFullscreen}
              style={styles.hudIconBtn}
              activeOpacity={0.8}
            >
              {isFullscreen ? (
                <Minimize2 size={16} color="#1E293B" />
              ) : (
                <Maximize2 size={16} color="#1E293B" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* =========================================================================
          2. CINEMATIC 2D CARTOON SCENERY
          Smiling Sun, Drifting Clouds, Schoolhouse, Brook & Stepping Stone Trail
          ========================================================================= */}
      <View style={styles.cartoonWorldCanvas}>
        {/* Morning Sky Layer with Cartoon Sun & Parallax Clouds */}
        <View style={styles.skyLayer}>
          {/* Smiling Cartoon Sun */}
          <Animated.View style={[styles.sunBox, { transform: [{ scale: sunGlow }] }]}>
            <Svg width="60" height="60" viewBox="0 0 60 60">
              <Defs>
                <LinearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#FFF176" />
                  <Stop offset="100%" stopColor="#F59E0B" />
                </LinearGradient>
              </Defs>
              <Circle cx="30" cy="30" r="26" fill="rgba(255, 238, 88, 0.3)" />
              <Circle cx="30" cy="30" r="20" fill="rgba(255, 213, 79, 0.5)" />
              <Circle cx="30" cy="30" r="16" fill="url(#sunGrad)" />
              <Circle cx="24" cy="28" r="1.8" fill="#78350F" />
              <Circle cx="36" cy="28" r="1.8" fill="#78350F" />
              <Path d="M25 32 Q 30 38, 35 32" stroke="#78350F" strokeWidth="2" strokeLinecap="round" fill="none" />
              <Circle cx="21" cy="31" r="1.8" fill="#FF8A80" opacity="0.8" />
              <Circle cx="39" cy="31" r="1.8" fill="#FF8A80" opacity="0.8" />
            </Svg>
          </Animated.View>

          {/* Drifting Clouds (Multi-layer parallax) */}
          <Animated.View style={[styles.cloudPuff1, { transform: [{ translateX: cloudDrift1 }] }]}>
            <Text style={{ fontSize: 28 }}>☁️</Text>
          </Animated.View>
          <Animated.View style={[styles.cloudPuff2, { transform: [{ translateX: cloudDrift2 }] }]}>
            <Text style={{ fontSize: 24 }}>☁️</Text>
          </Animated.View>

          {/* School Building with Bell Tower */}
          <View style={styles.schoolBuildingWrapper}>
            <Svg width="120" height="96" viewBox="0 0 110 92" fill="none">
              <Defs>
                <LinearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#EF4444" />
                  <Stop offset="100%" stopColor="#B91C1C" />
                </LinearGradient>
                <LinearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#FEF3C7" />
                  <Stop offset="100%" stopColor="#FDE68A" />
                </LinearGradient>
              </Defs>
              <Rect x="15" y="42" width="80" height="48" rx="4" fill="url(#wallGrad)" stroke="#D97706" strokeWidth="1.5" />
              <Path d="M10 42 L55 12 L100 42 Z" fill="url(#roofGrad)" stroke="#7F1D1D" strokeWidth="1.5" />
              <Rect x="46" y="6" width="18" height="24" fill="#D97706" rx="2" />
              <Path d="M42 6 L55 0 L68 6 Z" fill="#B91C1C" />
              <Circle cx="55" cy="18" r="6" fill="#FDE047" stroke="#854D0E" strokeWidth="1" />
              <Path d="M47 90 L47 68 C 47 62, 63 62, 63 68 L63 90 Z" fill="#854D0E" stroke="#582C84" strokeWidth="1.5" />
            </Svg>

            {/* Animated Golden School Bell */}
            <Animated.View
              style={[
                styles.goldenBellIcon,
                { transform: [{ rotate: bellRotation }] },
              ]}
            >
              <Bell size={18} color="#D97706" fill="#FBBF24" />
            </Animated.View>
          </View>
        </View>

        {/* Rolling Green Hills & Cobblestone Trail */}
        <View style={styles.trailGround}>
          <View style={styles.meadowFlowersBar}>
            <Text style={styles.meadowFloraText}>🌸 🌼 🌻 🌿 🌸 🌼 🌻 🌿 🌸 🌼</Text>
          </View>

          {/* Stepping-Stone Road */}
          <View style={styles.cobblestoneRoad}>
            <View style={styles.roadCenterLine} />

            {/* Waypoint Milestone Stones */}
            <View style={styles.waypointsRow}>
              {WAYPOINTS.map((wp, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                const popScale = waypointPops[idx] || new Animated.Value(1);

                return (
                  <View key={wp.id} style={styles.waypointItem}>
                    <Animated.View
                      style={[
                        styles.waypointStoneCircle,
                        isCurrent && styles.waypointStoneActive,
                        isPassed && styles.waypointStonePassed,
                        { transform: [{ scale: popScale }] },
                      ]}
                    >
                      <Text style={styles.waypointEmoji}>{wp.icon}</Text>
                      {isPassed && (
                        <View style={styles.stoneCheckPill}>
                          <Check size={10} color="#FFFFFF" strokeWidth={3.5} />
                        </View>
                      )}
                    </Animated.View>
                    <Text
                      style={[
                        styles.waypointNameText,
                        isCurrent && styles.waypointNameTextActive,
                      ]}
                    >
                      {wp.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Animated Student Character (Raju) advancing along the road */}
            <Animated.View
              style={[
                styles.rajuFigurine,
                {
                  left: charPositionX.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['4%', '82%'],
                  }),
                },
              ]}
            >
              <Animated.View
                style={{
                  transform: [
                    { translateY: Animated.add(charBounce, charJumpArc) },
                  ],
                  alignItems: 'center',
                }}
              >
                <CartoonStudentBuddy
                  size="compact"
                  showSpeech={false}
                  isCelebrating={isResolved}
                  stepIndex={currentStepIndex}
                />
                <View style={styles.rajuBadge}>
                  <Text style={styles.rajuBadgeText}>Raju 🎒</Text>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        </View>

        {/* Raju's Spoken Speech Bubble (Synchronized with Narrator) */}
        <View style={styles.narratorSpeechBar}>
          <Text style={styles.narratorSpeechText}>
            {isResolved
              ? '⭐ “Great job! Let’s leap ahead to school!” ⭐'
              : selectedOptionId && !isResolved
              ? '💡 “Almost there! Listen closely to the rhyme and try again!” 💡'
              : `🎒 Raju: "${challenge?.promptText || getCheckpointVoicePrompt(currentStepIndex, challenge)}"`}
          </Text>
        </View>
      </View>

      {/* =========================================================================
          3. FULL-SCREEN INTERACTIVE CHECKPOINT ARENA
          Checkpoint 1: Water Brook Leap Pad
          Checkpoint 2: Rhyme Brook Floating Lily Stepping Stones
          Checkpoint 3: School Gate Hanging Keys & Routine Ordering
          Checkpoint 4: Bell Tower Golden Rope Pull
          ========================================================================= */}
      <View style={styles.actionStageCard}>
        {/* Checkpoint Header Banner */}
        <View style={styles.stageTitleRow}>
          <View style={styles.stageBadge}>
            <Sparkles size={16} color="#7E22CE" />
            <Text style={styles.stageBadgeText}>
              {currentStepIndex === 0
                ? '🌊 CHECKPOINT 1: THE WATER BROOK OBSTACLE'
                : currentStepIndex === 1
                ? '💧 CHECKPOINT 2: RHYME BROOK STEPPING STONES'
                : currentStepIndex === 2
                ? '🏫 CHECKPOINT 3: UNLOCK THE SCHOOL GARDEN GATE'
                : '🔔 CHECKPOINT 4: RING THE GRADE ONE SCHOOL BELL'}
            </Text>
          </View>

          {/* Desktop Keyboard Control Hint Badge */}
          <View style={styles.desktopControlBadge}>
            <Text style={styles.desktopControlText}>⌨️ Space / Tap to Select</Text>
          </View>
        </View>

        {/* Question Prompt Text */}
        <Text style={styles.stagePromptText}>{challenge?.promptText}</Text>

        {/* Highlighted Clue Word Plaque with Audio Replay Button */}
        <View style={styles.clueHighlightRow}>
          <View style={styles.clueHighlightBox}>
            <Text style={styles.clueIcon}>{challenge?.targetVisual || '🌟'}</Text>
            <View>
              <Text style={styles.clueTag}>CLUE TARGET:</Text>
              <Text style={styles.clueTargetWord}>
                {challenge?.targetWord || 'GRADE ONE'}
              </Text>
            </View>
          </View>

          {/* Visible Hear Instructions / Replay Voice Button */}
          <TouchableOpacity
            onPress={() => playNarratorVoice(getCheckpointVoicePrompt(currentStepIndex, challenge))}
            style={[styles.replayVoicePill, isSpeakingNarration && styles.replayVoicePillActive]}
            activeOpacity={0.8}
          >
            <Volume2 size={16} color={isSpeakingNarration ? '#FFFFFF' : '#1D4ED8'} />
            <Text
              style={[
                styles.replayVoicePillText,
                isSpeakingNarration && { color: '#FFFFFF' },
              ]}
            >
              {isSpeakingNarration ? 'Speaking...' : '🔊 Hear Clue'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* =====================================================================
            CHECKPOINT 1: WATER BROOK LEAP PAD (ACTION RUNNER LEAP)
            ===================================================================== */}
        {currentStepIndex === 0 && (
          <View style={styles.runnerInteractiveBox}>
            <View style={styles.brookStreamBanner}>
              <Text style={styles.brookStreamBannerText}>
                〰️ 🌊 〰️ Gurgling Water Brook Stream 〰️ 🌊 〰️
              </Text>
              <Text style={styles.brookArcHint}>⤴️ Press SPACE or Tap to leap across the brook!</Text>
            </View>

            <View style={styles.leapButtonsRow}>
              {challenge.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = isResolved && option.isCorrect;
                const isIncorrect = isSelected && !option.isCorrect;
                const scaleVal = optionScales[option.id] || new Animated.Value(1);

                return (
                  <Animated.View
                    key={option.id}
                    style={[
                      { flex: 1 },
                      isIncorrect && { transform: [{ translateX: shakeAnim }] },
                      { transform: [{ scale: scaleVal }] },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => onSelectOption(option)}
                      disabled={disabled}
                      activeOpacity={0.85}
                      style={[
                        styles.mainJumpPadBtn,
                        isSelected && (option.isCorrect ? styles.btnCorrect : styles.btnIncorrect),
                        isCorrect && styles.btnGlowHighlight,
                      ]}
                    >
                      <Text style={styles.mainJumpEmoji}>{option.visual || '🦘'}</Text>
                      <Text style={styles.mainJumpText}>{option.text}</Text>
                      {isCorrect && (
                        <View style={styles.correctStarIcon}>
                          <Sparkles size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {/* =====================================================================
            CHECKPOINT 2: RHYME BROOK FLOATING LILY STEPPING STONES
            ===================================================================== */}
        {currentStepIndex === 1 && (
          <View style={styles.runnerInteractiveBox}>
            <View style={styles.riverStreamBanner}>
              <Text style={styles.riverStreamBannerText}>
                💧 🪷 〰️ Rhyme Brook Floating Water Crossing 〰️ 🪷 💧
              </Text>
              <Text style={styles.riverStreamSubText}>
                Tap the floating lily pad that rhymes with “{challenge.targetWord || 'PLAY'}”:
              </Text>
            </View>

            <View style={styles.stonesGridRow}>
              {challenge.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = isResolved && option.isCorrect;
                const isIncorrect = isSelected && !option.isCorrect;
                const scaleVal = optionScales[option.id] || new Animated.Value(1);

                return (
                  <Animated.View
                    key={option.id}
                    style={[
                      { flex: 1 },
                      isIncorrect && { transform: [{ translateX: shakeAnim }] },
                      { transform: [{ scale: scaleVal }] },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => onSelectOption(option)}
                      disabled={disabled}
                      activeOpacity={0.85}
                      style={[
                        styles.floatingLilyStoneBtn,
                        isSelected && (option.isCorrect ? styles.btnCorrect : styles.btnIncorrect),
                        isCorrect && styles.btnGlowHighlight,
                      ]}
                    >
                      <View style={styles.lilyRippleRing} />
                      <Text style={styles.lilyStoneEmoji}>{option.visual || '🪷'}</Text>
                      <Text style={styles.lilyStoneWord}>{option.text}</Text>
                      <Text style={styles.lilyStoneHint}>
                        {isCorrect ? '✨ Rhyme Match! ✨' : 'Lily Stone'}
                      </Text>
                      {isCorrect && (
                        <View style={styles.correctStarIcon}>
                          <Sparkles size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {/* =====================================================================
            CHECKPOINT 3: SCHOOL GARDEN GATE HANGING WORD KEYS & ROUTINE
            ===================================================================== */}
        {currentStepIndex === 2 && (
          <View style={styles.runnerInteractiveBox}>
            <View style={styles.gateBanner}>
              <Text style={styles.gateBannerText}>
                🚪 🏫 🔒 School Courtyard Gate Lock 🔒 🏫 🚪
              </Text>
              <Text style={styles.gateBannerSubText}>
                Pick the key or order to unlock the school gate:
              </Text>
            </View>

            <View style={styles.keysGridRow}>
              {challenge.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = isResolved && option.isCorrect;
                const isIncorrect = isSelected && !option.isCorrect;
                const scaleVal = optionScales[option.id] || new Animated.Value(1);

                return (
                  <Animated.View
                    key={option.id}
                    style={[
                      { flex: 1 },
                      isIncorrect && { transform: [{ translateX: shakeAnim }] },
                      { transform: [{ scale: scaleVal }] },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => onSelectOption(option)}
                      disabled={disabled}
                      activeOpacity={0.85}
                      style={[
                        styles.brassKeyTagBtn,
                        isSelected && (option.isCorrect ? styles.btnCorrect : styles.btnIncorrect),
                        isCorrect && styles.btnGlowHighlight,
                      ]}
                    >
                      <Text style={styles.keyTagEmoji}>{option.visual || '🗝️'}</Text>
                      <Text style={styles.keyTagWordText}>{option.text}</Text>
                      <Text style={styles.keyTagSubText}>
                        {isCorrect ? '✨ Gate Unlocked! ✨' : 'Gate Choice'}
                      </Text>
                      {isCorrect && (
                        <View style={styles.correctStarIcon}>
                          <Sparkles size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {/* =====================================================================
            CHECKPOINT 4: BELFRY BELL ROPE PULL (DING-DONG BELL)
            ===================================================================== */}
        {currentStepIndex === 3 && (
          <View style={styles.runnerInteractiveBox}>
            <View style={styles.belfryBanner}>
              <Text style={styles.belfryBannerText}>
                🔔 🎶 Grade One Belfry Tower 🎶 🔔
              </Text>
              <Text style={styles.belfryBannerSubText}>
                Pull the bell rope to ring the school bell ding-dong:
              </Text>
            </View>

            <View style={styles.ropesGridRow}>
              {challenge.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = isResolved && option.isCorrect;
                const isIncorrect = isSelected && !option.isCorrect;
                const scaleVal = optionScales[option.id] || new Animated.Value(1);

                return (
                  <Animated.View
                    key={option.id}
                    style={[
                      { flex: 1 },
                      isIncorrect && { transform: [{ translateX: shakeAnim }] },
                      { transform: [{ scale: scaleVal }] },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => onSelectOption(option)}
                      disabled={disabled}
                      activeOpacity={0.85}
                      style={[
                        styles.bellRopeHandleBtn,
                        isSelected && (option.isCorrect ? styles.btnCorrect : styles.btnIncorrect),
                        isCorrect && styles.btnGlowHighlight,
                      ]}
                    >
                      <View style={styles.ropeCordVisual} />
                      <Text style={styles.ropeHandleEmojiText}>{option.visual || '🔔'}</Text>
                      <Text style={styles.ropeHandleWordText}>{option.text}</Text>
                      <Text style={styles.ropeHandleSubText}>
                        {isCorrect ? 'DING-DONG! 🔔' : 'Pull Rope'}
                      </Text>
                      {isCorrect && (
                        <View style={styles.correctStarIcon}>
                          <Sparkles size={16} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {/* Floating Stars Shower on Correct Answer */}
        {isResolved && (
          <Animated.View
            style={[
              styles.celebrationStarsShower,
              {
                opacity: floatingStarsAnim.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateY: floatingStarsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -42],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.showerStarsText}>⭐ ✨ ⭐ HOORAY! ⭐ ✨ ⭐</Text>
          </Animated.View>
        )}
      </View>

      {/* =========================================================================
          4. START TUTORIAL MODAL OVERLAY (Shown before 1st challenge)
          ========================================================================= */}
      {showTutorial && (
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialCard}>
            <View style={styles.tutorialMascotBox}>
              <CartoonStudentBuddy size="regular" speechText="Let's reach school on time!" />
            </View>

            <Text style={styles.tutorialTitle}>School Adventure Runner! 🎒</Text>
            <Text style={styles.tutorialSubtitle}>
              Class 1 • Lesson 1.1: “My First Day”
            </Text>

            <View style={styles.controlsGuideBox}>
              <Text style={styles.controlsGuideHeader}>HOW TO PLAY & AUDIO CONTROLS:</Text>
              <Text style={styles.controlRowText}>
                ⌨️ <Text style={{ fontWeight: '800' }}>Spacebar / Tap:</Text> Leap over brooks and select answers!
              </Text>
              <Text style={styles.controlRowText}>
                🎵 <Text style={{ fontWeight: '800' }}>Cheerful Music:</Text> Starts automatically on Start Adventure!
              </Text>
              <Text style={styles.controlRowText}>
                🔊 <Text style={{ fontWeight: '800' }}>Voice Narrator:</Text> Reads instructions, questions, and clues aloud!
              </Text>
              <Text style={styles.controlRowText}>
                🔁 <Text style={{ fontWeight: '800' }}>Replay Voice:</Text> Press 'R' or tap 🔊 Hear Clue anytime!
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleStartAdventure}
              style={styles.startAdventureBtn}
              activeOpacity={0.85}
            >
              <Sparkles size={20} color="#FFFFFF" />
              <Text style={styles.startAdventureBtnText}>START ADVENTURE! 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* =========================================================================
          5. PAUSE MENU & AUDIO SETTINGS OVERLAY
          ========================================================================= */}
      {isPaused && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>Game Paused ⏸️</Text>
            <Text style={styles.pauseScoreSub}>
              Current Score: {score} PTS • Stars: {starsEarned} ⭐
            </Text>

            <TouchableOpacity
              onPress={() => {
                setIsPaused(false);
                if (isBgmOn) resumeBackgroundMusic();
              }}
              style={styles.pauseResumeBtn}
              activeOpacity={0.85}
            >
              <Play size={18} color="#FFFFFF" />
              <Text style={styles.pauseResumeBtnText}>Resume Adventure</Text>
            </TouchableOpacity>

            {/* Background Music Toggle */}
            <TouchableOpacity
              onPress={handleToggleMusic}
              style={styles.pauseSoundBtn}
              activeOpacity={0.85}
            >
              <Music size={18} color={isBgmOn ? '#0284C7' : '#94A3B8'} />
              <Text style={styles.pauseSoundBtnText}>
                {isBgmOn ? '🎵 Background Music: ON' : '🎵 Background Music: OFF'}
              </Text>
            </TouchableOpacity>

            {/* Voice Narrator Toggle */}
            <TouchableOpacity
              onPress={handleToggleVoice}
              style={styles.pauseSoundBtn}
              activeOpacity={0.85}
            >
              {isVoiceMuted ? (
                <VolumeX size={18} color="#DC2626" />
              ) : (
                <Volume2 size={18} color="#16A34A" />
              )}
              <Text style={styles.pauseSoundBtnText}>
                {isVoiceMuted ? '🗣️ Voice Narrator: MUTED' : '🗣️ Voice Narrator: ON'}
              </Text>
            </TouchableOpacity>

            {/* Sound Effects Toggle */}
            <TouchableOpacity
              onPress={handleToggleSfx}
              style={styles.pauseSoundBtn}
              activeOpacity={0.85}
            >
              <Bell size={18} color={isSfxOn ? '#16A34A' : '#94A3B8'} />
              <Text style={styles.pauseSoundBtnText}>
                {isSfxOn ? '🔔 Sound Effects: ON' : '🔔 Sound Effects: OFF'}
              </Text>
            </TouchableOpacity>

            {onRestart && (
              <TouchableOpacity
                onPress={() => {
                  setIsPaused(false);
                  if (isBgmOn) resumeBackgroundMusic();
                  onRestart();
                }}
                style={styles.pauseRestartBtn}
                activeOpacity={0.85}
              >
                <RotateCcw size={18} color="#475569" />
                <Text style={styles.pauseRestartBtnText}>Restart Checkpoints</Text>
              </TouchableOpacity>
            )}

            {onClose && (
              <TouchableOpacity
                onPress={onClose}
                style={styles.pauseExitBtn}
                activeOpacity={0.85}
              >
                <X size={18} color="#DC2626" />
                <Text style={styles.pauseExitBtnText}>Exit to Lessons</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenCanvas: {
    width: '100%',
    minHeight: 640,
    backgroundColor: '#E0F7FA',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#38BDF8',
    position: 'relative',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  gameHUD: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#BAE6FD',
    zIndex: 30,
    flexWrap: 'wrap',
    gap: 6,
  },
  hudLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudCenterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  hudMutedBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  hudSpeakingActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#60A5FA',
  },
  hudBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  checkpointPill: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D8B4FE',
  },
  checkpointPillLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6B21A8',
  },
  starsPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  starsPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
  },
  cartoonWorldCanvas: {
    width: '100%',
    backgroundColor: '#BAE6FD',
    overflow: 'hidden',
    position: 'relative',
    paddingTop: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#38A169',
  },
  skyLayer: {
    height: 120,
    position: 'relative',
    overflow: 'hidden',
  },
  sunBox: {
    position: 'absolute',
    top: 6,
    left: 14,
    zIndex: 1,
  },
  cloudPuff1: {
    position: 'absolute',
    top: 14,
    left: '30%',
    zIndex: 2,
  },
  cloudPuff2: {
    position: 'absolute',
    top: 32,
    right: '25%',
    zIndex: 2,
  },
  schoolBuildingWrapper: {
    position: 'absolute',
    right: 12,
    bottom: -4,
    zIndex: 3,
  },
  goldenBellIcon: {
    position: 'absolute',
    top: 12,
    left: 46,
    zIndex: 5,
  },
  trailGround: {
    backgroundColor: '#48BB78',
    paddingTop: 4,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  meadowFlowersBar: {
    alignItems: 'center',
    marginBottom: 6,
  },
  meadowFloraText: {
    fontSize: 13,
    letterSpacing: 4,
  },
  cobblestoneRoad: {
    backgroundColor: '#FEF3C7',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 3,
    borderColor: '#F59E0B',
    position: 'relative',
  },
  roadCenterLine: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: '#FDE68A',
    borderRadius: 2,
    zIndex: 0,
  },
  waypointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  waypointItem: {
    alignItems: 'center',
  },
  waypointStoneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  waypointStoneActive: {
    borderColor: '#7E22CE',
    backgroundColor: '#F3E8FF',
    transform: [{ scale: 1.15 }],
  },
  waypointStonePassed: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  waypointEmoji: {
    fontSize: 18,
  },
  stoneCheckPill: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10B981',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointNameText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 4,
  },
  waypointNameTextActive: {
    color: '#7E22CE',
    fontWeight: '900',
  },
  rajuFigurine: {
    position: 'absolute',
    top: -28,
    zIndex: 10,
    alignItems: 'center',
  },
  rajuBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: -4,
  },
  rajuBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  narratorSpeechBar: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E0E7FF',
    alignItems: 'center',
  },
  narratorSpeechText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  actionStageCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    margin: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  stageTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7E22CE',
  },
  desktopControlBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  desktopControlText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  stagePromptText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 10,
  },
  clueHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  clueHighlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  clueIcon: {
    fontSize: 22,
  },
  clueTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  clueTargetWord: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E3A8A',
  },
  replayVoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  replayVoicePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  replayVoicePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E40AF',
  },
  runnerInteractiveBox: {
    marginTop: 4,
  },
  brookStreamBanner: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    marginBottom: 12,
  },
  brookStreamBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  brookArcHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 2,
  },
  leapButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mainJumpPadBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mainJumpEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  mainJumpText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
  },
  riverStreamBanner: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    alignItems: 'center',
    marginBottom: 12,
  },
  riverStreamBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  riverStreamSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 2,
  },
  stonesGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  floatingLilyStoneBtn: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#86EFAC',
    position: 'relative',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  lilyRippleRing: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: -3,
    right: -3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  lilyStoneEmoji: {
    fontSize: 26,
    marginBottom: 2,
  },
  lilyStoneWord: {
    fontSize: 14,
    fontWeight: '900',
    color: '#14532D',
    textAlign: 'center',
  },
  lilyStoneHint: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 2,
  },
  gateBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    marginBottom: 12,
  },
  gateBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  gateBannerSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 2,
  },
  keysGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  brassKeyTagBtn: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  keyTagEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  keyTagWordText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#78350F',
    textAlign: 'center',
  },
  keyTagSubText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  belfryBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    marginBottom: 12,
  },
  belfryBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  belfryBannerSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 2,
  },
  ropesGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bellRopeHandleBtn: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FDBA74',
    position: 'relative',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  ropeCordVisual: {
    width: 3,
    height: 12,
    backgroundColor: '#C2410C',
    borderRadius: 1.5,
    marginBottom: 4,
  },
  ropeHandleEmojiText: {
    fontSize: 24,
    marginBottom: 2,
  },
  ropeHandleWordText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#7C2D12',
    textAlign: 'center',
  },
  ropeHandleSubText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
    marginTop: 2,
  },
  btnCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  btnIncorrect: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  btnGlowHighlight: {
    borderColor: '#10B981',
    borderWidth: 3.5,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  correctStarIcon: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#10B981',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationStarsShower: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  showerStarsText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    padding: 16,
  },
  tutorialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    maxWidth: 440,
    width: '100%',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#38BDF8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  tutorialMascotBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  tutorialSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 14,
    textAlign: 'center',
  },
  controlsGuideBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  controlsGuideHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  controlRowText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  startAdventureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#1D4ED8',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  startAdventureBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
    padding: 16,
  },
  pauseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    maxWidth: 380,
    width: '100%',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  pauseTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  pauseScoreSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  pauseResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
  },
  pauseResumeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  pauseSoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  pauseSoundBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  pauseRestartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  pauseRestartBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  pauseExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  pauseExitBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
});
