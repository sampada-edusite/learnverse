import { Platform } from 'react-native';
import { duckBackgroundMusic } from './soundEffects';

let isMutedGlobal = false;
let activeUtterance: any = null;
let cachedVoices: any[] = [];
let voicesLoaded = false;
let cancelTimeoutId: any = null;

// Initialize voices eagerly if in browser
if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
        voicesLoaded = true;
      }
    } catch (e) {}
  };

  loadVoices();
  if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export const isSpeechSupported = (): boolean => {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
};

export const setSpeechMuted = (muted: boolean) => {
  isMutedGlobal = muted;
  if (muted) {
    stopSpeech();
  }
};

export const getSpeechMuted = (): boolean => isMutedGlobal;

/**
 * Selects the warmest, most clear English voice available on the device/browser
 */
const selectBestVoice = (): any => {
  if (!cachedVoices || cachedVoices.length === 0) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    }
  }

  if (cachedVoices.length === 0) return null;

  // 1. Indian English voice (friendly, authentic pacing for MH Board)
  const indianVoice = cachedVoices.find(
    (v) =>
      v.lang === 'en-IN' ||
      v.lang === 'en_IN' ||
      (v.name && (v.name.includes('India') || v.name.includes('Hindi') || v.name.includes('Veena') || v.name.includes('Rishi')))
  );
  if (indianVoice) return indianVoice;

  // 2. Clear Natural / Google English voices
  const naturalVoice = cachedVoices.find(
    (v) =>
      (v.name && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira'))) &&
      v.lang && v.lang.startsWith('en')
  );
  if (naturalVoice) return naturalVoice;

  // 3. Any English voice
  const anyEnglish = cachedVoices.find((v) => v.lang && v.lang.startsWith('en'));
  if (anyEnglish) return anyEnglish;

  // 4. Default voice
  return cachedVoices.find((v) => v.default) || cachedVoices[0];
};

export const speakText = (
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
) => {
  if (isMutedGlobal) {
    if (options?.onEnd) options.onEnd();
    return;
  }

  if (!isSpeechSupported()) {
    // Graceful fallback for non-web environments
    if (options?.onStart) options.onStart();
    setTimeout(() => {
      if (options?.onEnd) options.onEnd();
    }, 1200);
    return;
  }

  try {
    if (cancelTimeoutId) {
      clearTimeout(cancelTimeoutId);
      cancelTimeoutId = null;
    }

    // Cancel ongoing speech to avoid overlapping narration
    window.speechSynthesis.cancel();
    duckBackgroundMusic(false);

    // Safety timeout: prevents Chromium issue #63882 where cancel immediately before speak drops utterance
    cancelTimeoutId = setTimeout(() => {
      try {
        // Resume synthesis if paused/suspended
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        activeUtterance = utterance; // Prevent garbage collection mid-speech

        utterance.rate = options?.rate ?? 0.88; // Gentle, clear tempo for primary school learners
        utterance.pitch = options?.pitch ?? 1.1; // Friendly, warm pitch

        const voice = selectBestVoice();
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || 'en-IN';
        } else {
          utterance.lang = 'en-IN';
        }

        utterance.onstart = () => {
          duckBackgroundMusic(true); // Lower BGM during speech
          if (options?.onStart) options.onStart();
        };

        const cleanupAndFinish = () => {
          duckBackgroundMusic(false); // Restore BGM volume
          activeUtterance = null;
          if (options?.onEnd) options.onEnd();
        };

        utterance.onend = () => {
          cleanupAndFinish();
        };

        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis utterance error:', e);
          duckBackgroundMusic(false);
          activeUtterance = null;
          if (options?.onError) options.onError(e);
          else if (options?.onEnd) options.onEnd();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Failed to speak utterance:', err);
        duckBackgroundMusic(false);
        activeUtterance = null;
        if (options?.onEnd) options.onEnd();
      }
    }, 45);
  } catch (e) {
    console.warn('SpeechSynthesis error:', e);
    duckBackgroundMusic(false);
    activeUtterance = null;
    if (options?.onEnd) options.onEnd();
  }
};

export const stopSpeech = () => {
  duckBackgroundMusic(false);
  activeUtterance = null;
  if (cancelTimeoutId) {
    clearTimeout(cancelTimeoutId);
    cancelTimeoutId = null;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
};
