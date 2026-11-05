import { Platform } from 'react-native';

let audioCtx: any = null;
let bgmAudioElement: any = null;
let bgmGainNode: any = null;
let bgmSynthInterval: any = null;
let isMusicMutedGlobal = false;
let isSfxMutedGlobal = false;
let isBgmPlaying = false;
let isBgmDucked = false;

// Audio Context Singleton with user-gesture auto-resume
export const getContext = () => {
  if (typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioCtx) {
        audioCtx = new AudioCtx();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return audioCtx;
    }
  }
  return null;
};

// Explicit initialization on first user interaction (Start Game button)
export const initAudioOnUserGesture = () => {
  try {
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (e) {
    // Graceful
  }
};

export const setMusicMuted = (muted: boolean) => {
  isMusicMutedGlobal = muted;
  if (muted) {
    pauseBackgroundMusic();
  } else if (isBgmPlaying) {
    resumeBackgroundMusic();
  }
};

export const getMusicMuted = (): boolean => isMusicMutedGlobal;

export const setSfxMuted = (muted: boolean) => {
  isSfxMutedGlobal = muted;
};

export const getSfxMuted = (): boolean => isSfxMutedGlobal;

// ---------------------------------------------------------------------------
// BACKGROUND MUSIC ENGINE (Dual: HTML5 Audio asset + Web Audio synthesizer fallback)
// ---------------------------------------------------------------------------

const BGM_BASE_VOLUME = 0.28;
const BGM_DUCKED_VOLUME = 0.08;

export const duckBackgroundMusic = (duck: boolean) => {
  isBgmDucked = duck;
  const targetVol = isMusicMutedGlobal ? 0 : duck ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME;

  if (bgmAudioElement) {
    try {
      bgmAudioElement.volume = targetVol;
    } catch (e) {}
  }
  if (bgmGainNode && audioCtx) {
    try {
      const now = audioCtx.currentTime;
      bgmGainNode.gain.cancelScheduledValues(now);
      bgmGainNode.gain.linearRampToValueAtTime(targetVol, now + 0.2);
    } catch (e) {}
  }
};

/**
 * Start cheerful background music.
 * Tries the generated WAV asset first; if not loadable or blocked, seamlessly falls back
 * to the procedural Web Audio pentatonic chime synthesizer.
 */
export const startBackgroundMusic = () => {
  if (isMusicMutedGlobal) return;
  isBgmPlaying = true;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    try {
      if (!bgmAudioElement) {
        // Load the generated cheerful adventure WAV loop
        // In Expo Web, static assets from frontend/mobile/assets are served or fall back to procedural
        bgmAudioElement = new Audio(require('../../assets/audio/school_adventure_bgm.wav'));
        bgmAudioElement.loop = true;
        bgmAudioElement.volume = isBgmDucked ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME;
      }
      const playPromise = bgmAudioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((err: any) => {
          console.warn('Audio asset playback fallback to procedural synth:', err.message);
          startProceduralSynthBgm();
        });
      }
      return;
    } catch (e) {
      // Audio element failed or not supported in environment -> start procedural synth
      startProceduralSynthBgm();
      return;
    }
  }

  // Non-web or fallback
  startProceduralSynthBgm();
};

export const pauseBackgroundMusic = () => {
  if (bgmAudioElement) {
    try {
      bgmAudioElement.pause();
    } catch (e) {}
  }
  stopProceduralSynthBgm();
};

export const resumeBackgroundMusic = () => {
  if (isMusicMutedGlobal) return;
  if (bgmAudioElement) {
    try {
      bgmAudioElement.play().catch(() => {
        startProceduralSynthBgm();
      });
      return;
    } catch (e) {}
  }
  startProceduralSynthBgm();
};

export const stopBackgroundMusic = () => {
  isBgmPlaying = false;
  if (bgmAudioElement) {
    try {
      bgmAudioElement.pause();
      bgmAudioElement.currentTime = 0;
    } catch (e) {}
  }
  stopProceduralSynthBgm();
};

// Procedural Web Audio Synthesizer Loop (Gentle Marimba / Chimes)
const PENTATONIC_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const BASS_ROOTS = [130.81, 164.81, 174.61, 196.0]; // C, E, F, G

const startProceduralSynthBgm = () => {
  if (bgmSynthInterval) return;
  const ctx = getContext();
  if (!ctx) return;

  if (!bgmGainNode) {
    bgmGainNode = ctx.createGain();
    bgmGainNode.gain.setValueAtTime(isBgmDucked ? BGM_DUCKED_VOLUME : BGM_BASE_VOLUME, ctx.currentTime);
    bgmGainNode.connect(ctx.destination);
  }

  let step = 0;
  const bpm = 108;
  const intervalMs = (60 / bpm) * 500; // eighth notes

  bgmSynthInterval = setInterval(() => {
    if (isMusicMutedGlobal || !isBgmPlaying) return;
    try {
      const now = ctx.currentTime;

      // Bass note every 8 steps
      if (step % 8 === 0) {
        const rootFreq = BASS_ROOTS[Math.floor(step / 8) % BASS_ROOTS.length];
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(rootFreq, now);
        bassGain.gain.setValueAtTime(0.18, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        bassOsc.connect(bassGain);
        bassGain.connect(bgmGainNode);
        bassOsc.start(now);
        bassOsc.stop(now + 1.25);
      }

      // Melody note
      if (step % 2 === 0 || step % 3 === 0) {
        const noteIdx = (step * 3) % PENTATONIC_SCALE.length;
        const noteFreq = PENTATONIC_SCALE[noteIdx];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
        osc.connect(gain);
        gain.connect(bgmGainNode);
        osc.start(now);
        osc.stop(now + 0.38);
      }

      step = (step + 1) % 32;
    } catch (e) {}
  }, intervalMs);
};

const stopProceduralSynthBgm = () => {
  if (bgmSynthInterval) {
    clearInterval(bgmSynthInterval);
    bgmSynthInterval = null;
  }
};

// ---------------------------------------------------------------------------
// SHORT SOUND EFFECTS (Web Audio API Synthesizer)
// ---------------------------------------------------------------------------

// 1. Jump Sound (Cheerful upward sweep)
export const playJumpSound = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {
    // Graceful fallback
  }
};

// 2. Star Collect Sound (Twinkling arpeggio)
export const playStarCollectSound = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.005, startTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  } catch (e) {
    // Graceful fallback
  }
};

// 3. Golden Bell Ringing Sound (Resonant Ding-Dong)
export const playBellRingSound = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Ding (high resonant chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.65);

    // Dong (deeper warm chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const dongTime = now + 0.35;
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, dongTime); // A4
    gain2.gain.setValueAtTime(0.35, dongTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, dongTime + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(dongTime);
    osc2.stop(dongTime + 0.85);
  } catch (e) {
    // Graceful fallback
  }
};

// 4. Water Splash Sound (Soft wave ripple)
export const playWaterSplashSound = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    // Graceful fallback
  }
};

// 5. Success Fanfare (Level Completed)
export const playCelebrationFanfare = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chords = [
      { freq: 440, delay: 0 },
      { freq: 554.37, delay: 0.1 },
      { freq: 659.25, delay: 0.2 },
      { freq: 880, delay: 0.3 },
    ];

    chords.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + delay;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch (e) {
    // Graceful fallback
  }
};

// 6. Gentle Retry Chime (Warm low hum, never harsh)
export const playGentleRetrySound = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.25);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    // Graceful fallback
  }
};

// 7. Click / Button tap sound
export const playTapSound = () => {
  if (isSfxMutedGlobal) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch (e) {
    // Graceful fallback
  }
};
