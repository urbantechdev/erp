// Web Audio API POS Chime Synthesizer & Haptic Vibration Utility
// Zero external assets required, instant zero-latency feedback across all devices

let audioCtx: AudioContext | null = null;
let isSoundMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

export function playPosBeep(type: 'success' | 'case' | 'error' = 'success'): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'success') {
      // Classic high-pitch supermarket / POS scanner confirmation chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1950, now);
      osc.frequency.exponentialRampToValueAtTime(2450, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'case') {
      // Double chirp for master case scans
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1800, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.07);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2400, now + 0.09);
      gain2.gain.setValueAtTime(0.35, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.17);
    } else {
      // Low dual-tone buzzer for scan error / item not found
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.2);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch {
    // AudioContext blocked or restricted by browser
  }
}

export function triggerScanHaptic(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(45);
    }
  } catch {
    // Ignore if not supported
  }
}
