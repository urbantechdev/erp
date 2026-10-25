/**
 * VAAIRO Spirits & Beverage ERP — Hybrid & Cross-Platform Native Wrapper Bridge
 * Provides cross-environment detection and hardware abstraction for:
 * - Standalone PWA
 * - Capacitor 6 (Android APK / iOS Swift)
 * - Electron (Windows / macOS Desktop)
 * - Tauri 2.0 (Rust Desktop Native)
 */

export type PlatformRuntime =
  | 'capacitor-android'
  | 'capacitor-ios'
  | 'electron'
  | 'tauri'
  | 'standalone-pwa'
  | 'browser-web';

interface NativeHardwareCapabilities {
  platform: PlatformRuntime;
  isNativeWrapper: boolean;
  hasCamera: boolean;
  hasHaptics: boolean;
  hasWakeLock: boolean;
  hasBluetooth: boolean;
  hasDirectPrinterBridge: boolean;
}

let wakeLockSentinel: any = null;

export function detectPlatformRuntime(): PlatformRuntime {
  if (typeof window === 'undefined') return 'browser-web';

  // 1. Check for Capacitor
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    const platform = cap.getPlatform();
    if (platform === 'android') return 'capacitor-android';
    if (platform === 'ios') return 'capacitor-ios';
  }

  // 2. Check for Electron
  if ((window as any).process && (window as any).process.type) {
    return 'electron';
  }
  if (navigator.userAgent.toLowerCase().includes('electron')) {
    return 'electron';
  }

  // 3. Check for Tauri
  if ((window as any).__TAURI__ || (window as any).__TAURI_METADATA__) {
    return 'tauri';
  }

  // 4. Check for Standalone PWA
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
  if (isStandalone) {
    return 'standalone-pwa';
  }

  return 'browser-web';
}

export function getNativeHardwareCapabilities(): NativeHardwareCapabilities {
  const platform = detectPlatformRuntime();
  const isNativeWrapper = platform !== 'browser-web';

  const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const hasHaptics = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const hasWakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const hasDirectPrinterBridge = platform === 'electron' || platform === 'tauri' || platform === 'capacitor-android';

  return {
    platform,
    isNativeWrapper,
    hasCamera,
    hasHaptics,
    hasWakeLock,
    hasBluetooth,
    hasDirectPrinterBridge,
  };
}

/**
 * Triggers hardware haptic vibration feedback.
 * Works natively on Android/iOS via Capacitor or via browser navigator.vibrate fallback.
 */
export function triggerNativeHaptic(pattern: 'light' | 'medium' | 'success' | 'error' = 'light'): boolean {
  if (typeof window === 'undefined') return false;

  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.Haptics) {
    try {
      if (pattern === 'success') {
        cap.Plugins.Haptics.notification({ type: 'SUCCESS' });
      } else if (pattern === 'error') {
        cap.Plugins.Haptics.notification({ type: 'ERROR' });
      } else {
        cap.Plugins.Haptics.impact({ style: pattern === 'medium' ? 'MEDIUM' : 'LIGHT' });
      }
      return true;
    } catch {
      // Fallback below
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (pattern === 'success') {
        navigator.vibrate([40, 60, 80]);
      } else if (pattern === 'error') {
        navigator.vibrate([100, 50, 100, 50, 150]);
      } else if (pattern === 'medium') {
        navigator.vibrate(60);
      } else {
        navigator.vibrate(30);
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Keeps POS counter screens awake without dimming.
 */
export async function setScreenWakeLock(enabled: boolean): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return false;

  try {
    if (enabled) {
      if (!wakeLockSentinel) {
        wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      }
      return true;
    } else {
      if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      }
      return true;
    }
  } catch (err) {
    console.warn('[NativeBridge] WakeLock error:', err);
    return false;
  }
}
