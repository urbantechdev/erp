// Web Audio API Sound Synthesizer & Haptic Vibration Utility
// Zero external assets required, instant zero-latency feedback across all devices

let audioCtx: AudioContext | null = null;
let isSoundMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function isAudioMuted(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('vaairo_pos_sound_muted');
    if (stored !== null) isSoundMuted = stored === 'true';
  }
  return isSoundMuted;
}

export function toggleAudioMuted(): boolean {
  isSoundMuted = !isSoundMuted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('vaairo_pos_sound_muted', String(isSoundMuted));
  }
  return isSoundMuted;
}

export function setAudioMuted(muted: boolean): void {
  isSoundMuted = muted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('vaairo_pos_sound_muted', String(isSoundMuted));
  }
}

/**
 * Modern, crisp tactile micro-click sound for buttons, tabs, and interactive UI.
 * Subtle, pleasant, non-fatiguing.
 */
export function playClickSound(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Transient click impulse (high to mid pitch drop)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1400, now);
    osc1.frequency.exponentialRampToValueAtTime(320, now + 0.016);

    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.02);

    // Subtle crisp high-frequency snap
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(3200, now);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 0.009);

    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.012);
  } catch {
    // AudioContext blocked or restricted
  }
}

/**
 * Harmonious, rewarding multi-tone ascending chime for approvals, saves, scans, and positive feedback.
 */
export function playSuccessSound(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Note 2: E5 (659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.07);
    gain2.gain.setValueAtTime(0.24, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.27);

    // Note 3: G5 (783.99 Hz) with higher harmonic shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(783.99, now + 0.14);
    gain3.gain.setValueAtTime(0.28, now + 0.14);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.14);
    osc3.stop(now + 0.45);

    // High bell shimmer: C6 (1046.5 Hz)
    const osc4 = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(1046.5, now + 0.18);
    gain4.gain.setValueAtTime(0.12, now + 0.18);
    gain4.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc4.connect(gain4);
    gain4.connect(ctx.destination);
    osc4.start(now + 0.18);
    osc4.stop(now + 0.48);
  } catch {
    // AudioContext blocked
  }
}

/**
 * Distinct, unmistakable warning/rejection sound for errors, invalid actions, and alerts.
 */
export function playErrorSound(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Tone 1: Low-mid warning tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(950, now);

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(330, now);
    osc1.frequency.exponentialRampToValueAtTime(260, now + 0.11);

    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Tone 2: Descending heavy low tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(750, now + 0.11);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(210, now + 0.11);
    osc2.frequency.exponentialRampToValueAtTime(140, now + 0.28);

    gain2.gain.setValueAtTime(0.32, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.32);

    triggerScanHaptic(60);
  } catch {
    // AudioContext blocked
  }
}

/**
 * Double laser chirp for master case / multi-bottle batch operations.
 */
export function playCaseScanSound(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2400, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.06);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3600, now + 0.08);
    gain2.gain.setValueAtTime(0.28, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.14);
  } catch {
    // AudioContext blocked
  }
}

/**
 * Universal POS & ERP audio dispatcher maintaining backward compatibility.
 */
export function playPosBeep(type: 'success' | 'case' | 'error' | 'click' = 'success'): void {
  if (type === 'click') {
    playClickSound();
  } else if (type === 'success') {
    playSuccessSound();
  } else if (type === 'error') {
    playErrorSound();
  } else if (type === 'case') {
    playCaseScanSound();
  }
}

export function triggerScanHaptic(durationMs = 45): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore if not supported
  }
}

/**
 * Initializes global click audio feedback across the application.
 * Automatically triggers pleasant micro-clicks on buttons, tabs, links, and switches.
 * Includes throttling and mute check.
 */
let globalClickListenerInitialized = false;

export function initGlobalClickSound(): () => void {
  if (typeof window === 'undefined' || globalClickListenerInitialized) {
    return () => {};
  }
  globalClickListenerInitialized = true;

  let lastClickTime = 0;

  const handleClick = (e: MouseEvent) => {
    if (isAudioMuted()) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Detect clickable interactive element
    const interactiveEl = target.closest(
      'button, [role="button"], a, input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select, .cursor-pointer, [data-sound="click"]'
    );

    if (!interactiveEl) return;
    if (interactiveEl.getAttribute('data-no-click-sound') === 'true') return;

    const now = Date.now();
    // Throttle clicks within 35ms to avoid overlapping audio distortion
    if (now - lastClickTime < 35) return;
    lastClickTime = now;

    playClickSound();
  };

  window.addEventListener('click', handleClick, { capture: true, passive: true });

  return () => {
    window.removeEventListener('click', handleClick, { capture: true });
    globalClickListenerInitialized = false;
  };
}
