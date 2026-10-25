import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Monitor,
  Apple,
  Terminal,
  Download,
  Check,
  Copy,
  Vibrate,
  Sun,
  Printer,
  ShieldCheck,
  Layers,
  Sparkles,
  Cpu,
  Wifi,
} from 'lucide-react';
import {
  detectPlatformRuntime,
  getNativeHardwareCapabilities,
  triggerNativeHaptic,
  setScreenWakeLock,
  PlatformRuntime,
} from '../utils/nativeWrapperBridge';

interface HybridNativeWrappersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HybridNativeWrappersModal: React.FC<HybridNativeWrappersModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop' | 'diagnostics'>('android');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [hardwareCaps, setHardwareCaps] = useState(() => getNativeHardwareCapabilities());
  const [hapticTriggered, setHapticTriggered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHardwareCaps(getNativeHardwareCapabilities());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestHaptic = (pattern: 'light' | 'medium' | 'success' | 'error') => {
    const success = triggerNativeHaptic(pattern);
    setHapticTriggered(true);
    setTimeout(() => setHapticTriggered(false), 800);
  };

  const handleToggleWakeLock = async () => {
    const nextState = !wakeLockActive;
    const ok = await setScreenWakeLock(nextState);
    if (ok || !nextState) {
      setWakeLockActive(nextState);
    }
  };

  const downloadFile = (filename: string, content: string, type: string = 'text/javascript') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const capacitorConfigText = `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vaairo.erp',
  appName: 'VAAIRO Spirits & Beverage ERP',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#0A006E',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0A006E',
      androidSplashResourceName: 'splash',
      showSpinner: true,
      spinnerColor: '#FFDE00',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A006E',
    },
  },
};

export default config;`;

  const electronMainText = `const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0A006E',
    title: 'VAAIRO Spirits & Beverage ERP — Enterprise Terminal',
    icon: path.join(__dirname, 'public', 'apple-touch-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border-2 border-[#0A006E] shadow-2xl animate-in zoom-in-95 font-montserrat"
      >
        {/* Header */}
        <div className="bg-[#0A006E] text-white p-5 sm:p-6 border-b-4 border-[#FFDE00] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md shrink-0">
              <Layers className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-montserrat font-black italic text-lg sm:text-xl text-white">
                  Hybrid &amp; Cross-Platform Native Wrappers
                </h2>
                <span className="bg-[#FFDE00] text-[#0A006E] text-[10px] font-black px-2 py-0.5 rounded-full uppercase not-italic">
                  Capacitor • Electron • Tauri
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Generate native app binaries, APK manifests, and hardware bridges for POS terminals
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-5 pt-3 border-b border-slate-200 bg-slate-50 text-xs overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'android'
                ? 'bg-white border-[#0A006E] text-[#0A006E] font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Android (Capacitor 6 APK)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'ios'
                ? 'bg-white border-[#0A006E] text-[#0A006E] font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Apple className="w-4 h-4 text-slate-800" />
            <span>iOS (Xcode &amp; Swift)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('desktop')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'desktop'
                ? 'bg-white border-[#0A006E] text-[#0A006E] font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>Desktop (Electron &amp; Tauri)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-2.5 rounded-t-xl font-bold transition flex items-center gap-2 cursor-pointer border-b-2 -mb-[2px] ${
              activeTab === 'diagnostics'
                ? 'bg-white border-[#0A006E] text-[#0A006E] font-black shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-600" />
            <span>Hardware Bridge Diagnostics</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* TAB 1: ANDROID CAPACITOR */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-sm text-emerald-950 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    Android APK / AAB Native Package
                  </h4>
                  <p className="text-emerald-800 text-xs mt-1">
                    Packages the complete VAAIRO ERP with high-speed CameraX barcode scanning, KRA offline queueing, and direct ESC/POS Bluetooth thermal printing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadFile('capacitor.config.ts', capacitorConfigText)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Config</span>
                </button>
              </div>

              {/* Build Commands Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span>3-Step Android Build CLI Commands</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `npm install @capacitor/core @capacitor/cli @capacitor/android\nnpx cap add android\nnpm run build\nnpx cap sync\ncd android && ./gradlew assembleRelease`,
                        'android-cli'
                      )
                    }
                    className="text-[#0A006E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'android-cli' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'android-cli' ? 'Copied' : 'Copy All'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] space-y-1.5 overflow-x-auto shadow-inner">
                  <div className="text-slate-500"># 1. Install Capacitor Native Engine</div>
                  <div>npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                  <div className="text-slate-500 pt-1"># 2. Add Android Platform &amp; Sync Build Artifacts</div>
                  <div>npx cap add android</div>
                  <div>npm run build &amp;&amp; npx cap sync</div>
                  <div className="text-slate-500 pt-1"># 3. Compile Standalone Android APK</div>
                  <div>cd android &amp;&amp; ./gradlew assembleRelease</div>
                </div>
              </div>

              {/* Native Android Features Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-black text-slate-900">App ID / Package</div>
                  <div className="font-mono text-slate-600">com.vaairo.erp</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-black text-slate-900">Minimum SDK</div>
                  <div className="font-mono text-slate-600">Android 7.0+ (API 24)</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-black text-slate-900">Hardware Scanners</div>
                  <div className="text-emerald-700 font-semibold">Sunmi, Honeywell, Zebra</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IOS XCODE */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-sm text-slate-950 flex items-center gap-2">
                    <Apple className="w-4 h-4 text-slate-900" />
                    iOS Native App (Xcode / Swift Engine)
                  </h4>
                  <p className="text-slate-700 text-xs mt-1">
                    Native CocoaPods bridge with Apple App Store review readiness, secure Keychain PIN storage, and Bluetooth printer discovery.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span>iOS CLI Build Commands</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `npm install @capacitor/core @capacitor/cli @capacitor/ios\nnpm run build\nnpx cap add ios\nnpx cap open ios`,
                        'ios-cli'
                      )
                    }
                    className="text-[#0A006E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'ios-cli' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'ios-cli' ? 'Copied' : 'Copy All'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] space-y-1.5 overflow-x-auto shadow-inner">
                  <div className="text-slate-500"># 1. Install iOS Capacitor Runtime</div>
                  <div>npm install @capacitor/core @capacitor/cli @capacitor/ios</div>
                  <div className="text-slate-500 pt-1"># 2. Build Web Production Bundle &amp; Add iOS Project</div>
                  <div>npm run build</div>
                  <div>npx cap add ios &amp;&amp; npx cap sync</div>
                  <div className="text-slate-500 pt-1"># 3. Open in Xcode for Simulator / TestFlight Archive</div>
                  <div>npx cap open ios</div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <div className="font-black text-xs">Info.plist Camera Privacy Required</div>
                <p className="text-[11px]">
                  When packaging for iOS, ensure <code>NSCameraUsageDescription</code> is declared in <code>Info.plist</code> so retail cashiers can scan barcodes.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: DESKTOP ELECTRON & TAURI */}
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-sm text-blue-950 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-700" />
                    Desktop Enterprise Native Wrappers (Windows, macOS, Linux)
                  </h4>
                  <p className="text-blue-800 text-xs mt-1">
                    Run VAAIRO ERP as a dedicated desktop workstation app with direct USB receipt printer support and cash drawer release.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadFile('electron-main.cjs', electronMainText)}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Electron Script</span>
                </button>
              </div>

              {/* Electron vs Tauri Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs">Option A: Electron</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">Standard</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Includes bundled Chromium. Supports Node.js direct hardware access to USB ESC/POS thermal printers.
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[10px]">
                    npx electron electron-main.cjs
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-xs">Option B: Tauri 2.0</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Ultra-Light (&lt;10MB)</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Built on Rust and OS native WebView. 90% lighter RAM footprint, perfect for low-power POS cash counter computers.
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[10px]">
                    npm install -D @tauri-apps/cli &amp;&amp; npx tauri dev
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & HARDWARE BENCH */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F0F2F0] border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-sm text-[#0A006E]">Active Runtime &amp; Device Bridge</h4>
                    <p className="text-slate-600 text-xs">
                      Live detection of current host container, hardware sensors, and native wrappers
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#0A006E] text-[#FFDE00] font-mono text-xs font-black uppercase">
                    {hardwareCaps.platform}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">Camera Scan</div>
                    <div className={`font-black text-xs mt-0.5 ${hardwareCaps.hasCamera ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hardwareCaps.hasCamera ? 'Available' : 'Unavailable'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">Device Haptics</div>
                    <div className={`font-black text-xs mt-0.5 ${hardwareCaps.hasHaptics ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hardwareCaps.hasHaptics ? 'Supported' : 'No Motor'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">Screen WakeLock</div>
                    <div className={`font-black text-xs mt-0.5 ${hardwareCaps.hasWakeLock ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hardwareCaps.hasWakeLock ? 'Supported' : 'Unsupported'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold">Web Bluetooth</div>
                    <div className={`font-black text-xs mt-0.5 ${hardwareCaps.hasBluetooth ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hardwareCaps.hasBluetooth ? 'Ready' : 'Restricted'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Hardware Test Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Haptic Tester */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                    <Vibrate className={`w-4 h-4 text-[#0A006E] ${hapticTriggered ? 'animate-bounce' : ''}`} />
                    <span>Test Hardware Vibration Motor</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Triggers native haptic pulse (used when scanning a bottle barcode or completing an M-Pesa sale).
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestHaptic('light')}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
                    >
                      Light Pulse
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestHaptic('success')}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer shadow-2xs"
                    >
                      Success Vibe
                    </button>
                  </div>
                </div>

                {/* Wake Lock Tester */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                    <Sun className={`w-4 h-4 ${wakeLockActive ? 'text-amber-500 animate-spin-slow' : 'text-slate-400'}`} />
                    <span>POS Terminal Always-Awake Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Prevents the cash counter screen from turning off or locking during active store trading hours.
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleWakeLock}
                    className={`w-full py-2 rounded-xl font-bold transition cursor-pointer shadow-2xs ${
                      wakeLockActive
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {wakeLockActive ? 'Screen Lock Active (Always On)' : 'Engage Screen Wake Lock'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>KRA eTIMS &amp; ESC/POS direct printer bridge compatible</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs shadow-md transition cursor-pointer"
          >
            Close Wrapper Hub
          </button>
        </div>
      </div>
    </div>
  );
};
