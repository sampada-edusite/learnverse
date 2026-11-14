/**
 * Voice answer input: a microphone button + status line that fill an existing answer field with
 * real speech-to-text. The field stays a normal, editable text input.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { stopSpeech } from '../utils/speechHelper';
import {
  VOICE_ERROR_MESSAGES,
  VoiceErrorCode,
  VoiceLang,
  VoiceState,
  startRecognition,
  voiceUnavailableReason,
} from '../utils/speechRecognition';

const useNative = Platform.OS !== 'web';

export interface VoiceInputController {
  state: VoiceState;
  error: VoiceErrorCode | null;
  lang: VoiceLang;
  setLang: (l: VoiceLang) => void;
  toggle: () => void;
  stop: () => void;
  active: boolean;
}

/** Drives one recognition session at a time and reports recognised text via onText. */
export function useVoiceInput(opts: { lang: VoiceLang; onText: (text: string, isFinal: boolean) => void }): VoiceInputController {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const [lang, setLang] = useState<VoiceLang>(opts.lang);
  const stopRef = useRef<(() => void) | null>(null);
  const onTextRef = useRef(opts.onText);
  const mounted = useRef(true);
  onTextRef.current = opts.onText;

  useEffect(() => setLang(opts.lang), [opts.lang]);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopRef.current?.();
    };
  }, []);

  const toggle = useCallback(async () => {
    if (state !== 'idle') {
      if (state === 'listening' || state === 'processing') setState('processing');
      stop();
      return;
    }
    setError(null);
    stopSpeech(); // never let the app's read-aloud voice be recognised as the answer
    stopRef.current = await startRecognition({
      lang,
      onState: (s) => mounted.current && setState(s),
      onText: (t, f) => mounted.current && onTextRef.current(t, f),
      onError: (code) => mounted.current && setError(code),
    });
  }, [lang, state, stop]);

  return { state, error, lang, setLang, toggle, stop, active: state !== 'idle' };
}

// ------------------------------------------------------------------ mic button

export const VoiceMicButton: React.FC<{
  voice: VoiceInputController;
  size?: number;
  disabled?: boolean;
  color?: string;
}> = ({ voice, size = 52, disabled, color = Colors.primary }) => {
  const reduce = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const listening = voice.state === 'listening';
  const busy = voice.state === 'requesting' || voice.state === 'processing';

  useEffect(() => {
    if (!listening || reduce) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: useNative })
    );
    loop.start();
    return () => loop.stop();
  }, [listening, reduce, pulse]);

  const ring = (delay: number) => ({
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45 - delay * 0.15, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7 + delay * 0.3] }) }],
  });

  const bg = listening ? Colors.recording : color;
  const label = listening ? 'Stop listening' : busy ? 'Voice input is busy' : 'Speak your answer';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {listening ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, ring(0)]} />
          <Animated.View pointerEvents="none" style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, ring(1)]} />
        </>
      ) : null}
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Pressable
          onPress={voice.toggle}
          disabled={disabled || voice.state === 'requesting'}
          onPressIn={() => !reduce && Animated.spring(press, { toValue: 0.9, useNativeDriver: useNative, speed: 40 }).start()}
          onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: useNative, speed: 20, bounciness: 10 }).start()}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: !!disabled, busy }}
          style={({ hovered }: any) => [
            styles.mic,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
            hovered && !disabled ? styles.micHover : null,
            disabled ? { opacity: 0.45 } : null,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : listening ? (
            <Square size={size * 0.34} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Mic size={size * 0.44} color="#FFFFFF" />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
};

// ------------------------------------------------------------------ status line

const SoundWave: React.FC = () => {
  const reduce = useReducedMotion();
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (reduce) return;
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 260 + i * 70, useNativeDriver: useNative }),
          Animated.timing(b, { toValue: 0.3, duration: 260 + i * 70, useNativeDriver: useNative }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars, reduce]);
  return (
    <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no">
      {bars.map((b, i) => (
        <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: b }] }]} />
      ))}
    </View>
  );
};

export const VoiceStatus: React.FC<{
  voice: VoiceInputController;
  allowLanguageSwitch?: boolean;
  idleHint?: string;
}> = ({ voice, allowLanguageSwitch = true, idleHint }) => {
  const unavailable = voiceUnavailableReason();
  let content: React.ReactNode = null;
  if (voice.error) {
    content = <Text style={[styles.statusText, styles.errorText]}>{VOICE_ERROR_MESSAGES[voice.error]}</Text>;
  } else if (voice.state === 'requesting') {
    content = <Text style={styles.statusText}>Allow the microphone to start…</Text>;
  } else if (voice.state === 'listening') {
    content = (
      <View style={styles.inline}>
        <SoundWave />
        <Text style={[styles.statusText, { color: Colors.recording }]}>
          {voice.lang === 'mr' ? 'ऐकत आहे… बोला' : 'Listening… speak now'}
        </Text>
      </View>
    );
  } else if (voice.state === 'processing') {
    content = <Text style={styles.statusText}>{voice.lang === 'mr' ? 'समजून घेत आहे…' : 'Understanding what you said…'}</Text>;
  } else if (idleHint && !unavailable) {
    content = <Text style={styles.statusText}>{idleHint}</Text>;
  }

  return (
    <View style={styles.statusRow} accessibilityLiveRegion="polite">
      <View style={{ flex: 1 }}>{content}</View>
      {allowLanguageSwitch && !unavailable ? (
        <View style={styles.langSwitch} accessibilityRole="radiogroup" accessibilityLabel="Voice language">
          {(['en', 'mr'] as VoiceLang[]).map((l) => (
            <Pressable
              key={l}
              onPress={() => voice.setLang(l)}
              disabled={voice.active}
              accessibilityRole="radio"
              accessibilityState={{ checked: voice.lang === l }}
              style={[styles.langChip, voice.lang === l && styles.langChipOn]}
            >
              <Text style={[styles.langText, voice.lang === l && styles.langTextOn]}>{l === 'en' ? 'EN' : 'मराठी'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
  mic: {
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 16px rgba(124, 92, 252, 0.35)', transition: 'transform 160ms ease, box-shadow 160ms ease', cursor: 'pointer' } as any)
      : { shadowColor: '#7C5CFC', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 }),
  },
  micHover: Platform.OS === 'web' ? ({ transform: [{ translateY: -2 }], boxShadow: '0 10px 22px rgba(124, 92, 252, 0.45)' } as any) : {},
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26, marginTop: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  errorText: { color: Colors.dangerText },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 18 },
  waveBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: Colors.recording },
  langSwitch: { flexDirection: 'row', backgroundColor: Colors.primaryUltraLight, borderRadius: 999, padding: 3 },
  langChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  langChipOn: { backgroundColor: Colors.primary },
  langText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  langTextOn: { color: '#FFFFFF' },
});
