/**
 * Real speech-to-text for answer inputs (English + Marathi).
 *
 * - Web: the browser's Web Speech API (Chrome, Edge, Safari). Needs https or localhost.
 * - Android / iOS: expo-speech-recognition (native recogniser). Requires a development or
 *   production build; in Expo Go the native module is absent and voice input reports
 *   "unsupported" instead of crashing.
 */
import { Platform } from 'react-native';

export type VoiceLang = 'en' | 'mr';
export type VoiceState = 'idle' | 'requesting' | 'listening' | 'processing';
export type VoiceErrorCode =
  | 'unsupported'
  | 'insecure'
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'language-not-supported'
  | 'busy'
  | 'unknown';

export const VOICE_LOCALES: Record<VoiceLang, string> = { en: 'en-IN', mr: 'mr-IN' };

export const VOICE_ERROR_MESSAGES: Record<VoiceErrorCode, string> = {
  unsupported:
    Platform.OS === 'web'
      ? "Voice typing isn't available in this browser. Please use Chrome or Edge, or type your answer."
      : 'Voice typing needs the installed LearnVerse app (it does not work inside Expo Go). Please type your answer.',
  insecure: 'Voice typing needs a secure (https) page. Please type your answer.',
  'not-allowed': 'Microphone permission is off. Please allow the microphone, then tap the mic again.',
  'no-speech': "I didn't hear anything. Tap the mic and speak a little louder.",
  'audio-capture': 'No microphone was found. Please check your microphone.',
  network: 'Voice typing needs an internet connection. Please check it, or type your answer.',
  'language-not-supported': 'This device cannot recognise that language yet. Try the other language or type.',
  busy: 'The microphone is busy. Please try again in a moment.',
  unknown: 'Something went wrong with voice typing. Please try again or type your answer.',
};

export interface RecognitionHandlers {
  lang: VoiceLang;
  onState: (s: VoiceState) => void;
  onText: (text: string, isFinal: boolean) => void;
  onError: (code: VoiceErrorCode) => void;
}

/** Remove trailing sentence punctuation recognisers like to add ("Five." -> "Five"). */
export const cleanTranscript = (text: string) =>
  text.replace(/\s+/g, ' ').trim().replace(/[.!?।]+$/u, '').trim();

const mapError = (code: string | undefined): VoiceErrorCode => {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed';
    case 'no-speech':
    case 'speech-timeout':
      return 'no-speech';
    case 'audio-capture':
      return 'audio-capture';
    case 'network':
      return 'network';
    case 'language-not-supported':
      return 'language-not-supported';
    case 'busy':
      return 'busy';
    default:
      return 'unknown';
  }
};

// ------------------------------------------------------------------ native module (lazy)

let nativeModule: any | null | undefined;
const getNativeModule = () => {
  if (nativeModule !== undefined) return nativeModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule ?? null;
  } catch {
    nativeModule = null; // Expo Go / missing native build
  }
  return nativeModule;
};

const getWebRecognitionCtor = (): any => {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

/** null when voice input can be used, otherwise the reason it cannot. */
export const voiceUnavailableReason = (): VoiceErrorCode | null => {
  if (Platform.OS === 'web') {
    if (!getWebRecognitionCtor()) return 'unsupported';
    if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure';
    return null;
  }
  const mod = getNativeModule();
  if (!mod) return 'unsupported';
  try {
    return mod.isRecognitionAvailable() ? null : 'unsupported';
  } catch {
    return 'unsupported';
  }
};

// ------------------------------------------------------------------ start / stop

/** Starts one recognition session. Resolves to a stop() function. */
export async function startRecognition(h: RecognitionHandlers): Promise<() => void> {
  const unavailable = voiceUnavailableReason();
  if (unavailable) {
    h.onError(unavailable);
    h.onState('idle');
    return () => {};
  }
  return Platform.OS === 'web' ? startWeb(h) : startNative(h);
}

async function startWeb(h: RecognitionHandlers): Promise<() => void> {
  h.onState('requesting');
  try {
    const status = await (navigator as any)?.permissions?.query?.({ name: 'microphone' });
    if (status?.state === 'denied') {
      h.onError('not-allowed');
      h.onState('idle');
      return () => {};
    }
  } catch {
    // Permissions API not available (Safari/Firefox) - the browser will prompt on start().
  }

  const Ctor = getWebRecognitionCtor();
  const rec = new Ctor();
  rec.lang = VOICE_LOCALES[h.lang];
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let gotFinal = false;
  let failed = false;
  let latest = '';
  let stopped = false;

  rec.onstart = () => h.onState('listening');
  rec.onspeechend = () => h.onState('processing');
  rec.onresult = (event: any) => {
    let text = '';
    let isFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0]?.transcript ?? '';
      if (event.results[i].isFinal) isFinal = true;
    }
    latest = cleanTranscript(text);
    if (latest) h.onText(latest, isFinal);
    if (isFinal) gotFinal = true;
  };
  rec.onerror = (event: any) => {
    if (event?.error === 'aborted') return;
    failed = true;
    h.onError(mapError(event?.error));
  };
  rec.onend = () => {
    if (!gotFinal && !failed) {
      if (latest) h.onText(latest, true);
      else if (!stopped) h.onError('no-speech');
    }
    h.onState('idle');
  };

  try {
    rec.start();
  } catch {
    h.onError('busy');
    h.onState('idle');
    return () => {};
  }
  return () => {
    stopped = true;
    try {
      rec.stop();
    } catch {}
  };
}

async function startNative(h: RecognitionHandlers): Promise<() => void> {
  const mod = getNativeModule();
  h.onState('requesting');
  try {
    const perm = await mod.requestPermissionsAsync();
    if (!perm?.granted) {
      h.onError('not-allowed');
      h.onState('idle');
      return () => {};
    }
  } catch {
    h.onError('not-allowed');
    h.onState('idle');
    return () => {};
  }

  let gotFinal = false;
  let failed = false;
  let latest = '';
  let stopped = false;
  const subs: { remove: () => void }[] = [];
  const cleanup = () => {
    while (subs.length) {
      try {
        subs.pop()!.remove();
      } catch {}
    }
  };

  subs.push(mod.addListener('start', () => h.onState('listening')));
  subs.push(mod.addListener('speechend', () => h.onState('processing')));
  subs.push(
    mod.addListener('result', (ev: any) => {
      latest = cleanTranscript(ev?.results?.[0]?.transcript ?? '');
      if (latest) h.onText(latest, !!ev?.isFinal);
      if (ev?.isFinal) gotFinal = true;
    })
  );
  subs.push(
    mod.addListener('error', (ev: any) => {
      if (ev?.error === 'aborted') return;
      failed = true;
      h.onError(mapError(ev?.error));
    })
  );
  subs.push(
    mod.addListener('end', () => {
      if (!gotFinal && !failed) {
        if (latest) h.onText(latest, true);
        else if (!stopped) h.onError('no-speech');
      }
      h.onState('idle');
      cleanup();
    })
  );

  try {
    mod.start({
      lang: VOICE_LOCALES[h.lang],
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      addsPunctuation: false,
    });
  } catch {
    cleanup();
    h.onError('busy');
    h.onState('idle');
    return () => {};
  }
  return () => {
    stopped = true;
    try {
      mod.stop();
    } catch {}
  };
}
