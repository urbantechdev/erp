import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  RotateCcw,
  Volume2,
  VolumeX,
  Plus,
  Upload,
  Sparkles,
  Smartphone,
  Keyboard,
  ExternalLink,
} from 'lucide-react';
import { playPosBeep, toggleAudioMuted, isAudioMuted } from '../utils/audioBeep';

interface PhoneBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => { success: boolean; message?: string };
  continuousMode?: boolean;
}

export const PhoneBarcodeScannerModal: React.FC<PhoneBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeScanned,
  continuousMode = true,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'photo' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>('');
  const [soundMuted, setSoundMuted] = useState(isAudioMuted());
  const [manualInput, setManualInput] = useState('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    productName?: string;
    price?: number;
    success: boolean;
    timestamp: number;
  } | null>(null);
  const [sessionScanCount, setSessionScanCount] = useState<number>(0);
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success debounce to prevent duplicate triggers
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const handleDecodedText = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const trimmed = decodedText.trim();
      if (!trimmed) return;

      // Debounce identical barcode within 1200ms
      if (trimmed === lastScannedCodeRef.current && now - lastScanTimeRef.current < 1200) {
        return;
      }

      lastScanTimeRef.current = now;
      lastScannedCodeRef.current = trimmed;

      const result = onBarcodeScanned(trimmed);

      if (result.success) {
        playPosBeep('success');
        setSessionScanCount((prev) => prev + 1);
        setLastScannedResult({
          code: trimmed,
          productName: result.message || 'Product Added',
          success: true,
          timestamp: now,
        });

        if (!continuousMode) {
          setTimeout(() => {
            onClose();
          }, 400);
        }
      } else {
        playPosBeep('error');
        setLastScannedResult({
          code: trimmed,
          productName: result.message || 'Product not recognized in catalog',
          success: false,
          timestamp: now,
        });
      }
    },
    [onBarcodeScanned, continuousMode, onClose]
  );

  // Stop camera helper
  const stopCurrentScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (scanner.isScanning) {
          await scanner.stop().catch(() => {});
        }
        scanner.clear();
      } catch {
        // Safe catch
      }
    }
    if (isMountedRef.current) {
      setIsScanning(false);
      setHasTorch(false);
      setTorchOn(false);
    }
  }, []);

  // Start camera helper
  const startScanner = useCallback(
    async (targetCameraId?: string) => {
      if (isStartingRef.current || !isOpen) return;
      isStartingRef.current = true;
      setErrorMessage(null);

      try {
        await stopCurrentScanner();

        // Check if mediaDevices exists
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error(
            'Live camera access is restricted in this browser context. You can use the "Snap Photo to Scan" button below which works on all mobile devices.'
          );
        }

        const elementId = 'phone-barcode-video-canvas';
        const container = document.getElementById(elementId);
        if (!container) {
          isStartingRef.current = false;
          return;
        }

        const scanner = new Html5Qrcode(elementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.min(Math.floor(minDim * 0.85), 320),
              height: Math.min(Math.floor(minDim * 0.55), 200),
            };
          },
          aspectRatio: 1.333333,
        };

        const cameraTarget = targetCameraId
          ? { deviceId: { exact: targetCameraId } }
          : { facingMode: 'environment' };

        try {
          await scanner.start(
            cameraTarget,
            config,
            (decodedText) => handleDecodedText(decodedText),
            () => {}
          );
        } catch (initialErr: unknown) {
          // Fallback if environment back-camera constraint failed (desktop/laptop with single user camera)
          if (!targetCameraId) {
            await scanner.start(
              { facingMode: 'user' },
              config,
              (decodedText) => handleDecodedText(decodedText),
              () => {}
            );
          } else {
            throw initialErr;
          }
        }

        if (isMountedRef.current) {
          setIsScanning(true);
          setCameraPermissionState('granted');
          if (targetCameraId) {
            setCurrentCameraId(targetCameraId);
          }

          // Check torch capability
          try {
            const capabilities = scanner.getRunningTrackCapabilities();
            if (capabilities && 'torch' in capabilities) {
              setHasTorch(true);
            } else {
              setHasTorch(false);
            }
          } catch {
            setHasTorch(false);
          }

          // Enumerate cameras in the background
          Html5Qrcode.getCameras()
            .then((devices) => {
              if (isMountedRef.current && devices && devices.length > 0) {
                setAvailableCameras(devices);
              }
            })
            .catch(() => {});
        }
      } catch (err: unknown) {
        console.warn('Camera start info:', err);
        if (isMountedRef.current) {
          const errObj = err as { name?: string; message?: string };
          setCameraPermissionState('denied');
          let msg =
            'Camera permission was blocked by your browser. Please tap the lock/settings icon in your address bar to allow Camera, or use "📸 Snap Photo to Scan" below.';

          if (
            errObj?.name === 'NotAllowedError' ||
            errObj?.name === 'PermissionDeniedError' ||
            errObj?.message?.toLowerCase().includes('permission') ||
            errObj?.message?.toLowerCase().includes('not allowed')
          ) {
            msg =
              'Browser permission blocked: Tap "Request Camera Permission" below or use the "📸 Snap Photo to Scan" button to scan with your phone camera directly.';
          } else if (errObj?.name === 'NotFoundError' || errObj?.name === 'DevicesNotFoundError') {
            msg = 'No camera found on this device. You can snap a photo or enter the barcode below.';
          } else if (errObj?.name === 'NotReadableError' || errObj?.name === 'TrackStartError') {
            msg = 'Camera is currently in use by another tab or application. Please close other camera apps and retry.';
          } else if (errObj?.message) {
            msg = errObj.message;
          }

          setErrorMessage(msg);
          setIsScanning(false);
        }
      } finally {
        isStartingRef.current = false;
      }
    },
    [handleDecodedText, isOpen, stopCurrentScanner]
  );

  // Initialize camera scanner when modal opens
  useEffect(() => {
    isMountedRef.current = true;

    if (!isOpen) {
      stopCurrentScanner();
      return () => {
        isMountedRef.current = false;
      };
    }

    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopCurrentScanner();
    };
  }, [isOpen, startScanner, stopCurrentScanner]);

  // Request explicit permission on user click gesture (bypasses iOS Safari gesture blocking)
  const handleExplicitRequestPermission = async () => {
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      }
      await startScanner();
    } catch {
      await startScanner();
    }
  };

  // Toggle Torch / Flashlight
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !isScanning) return;
    try {
      const next = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[],
      });
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  };

  // Switch camera (front / back)
  const handleSwitchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCam = availableCameras[nextIndex];
    if (nextCam) {
      await startScanner(nextCam.id);
    }
  };

  const handleToggleSound = () => {
    const next = toggleAudioMuted();
    setSoundMuted(next);
  };

  // Direct photo capture & decode fallback (100% reliable on phones via native OS camera file picker)
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileScanning(true);
    setErrorMessage(null);
    try {
      const tempElementId = 'phone-barcode-file-scan-temp';
      let tempContainer = document.getElementById(tempElementId);
      if (!tempContainer) {
        tempContainer = document.createElement('div');
        tempContainer.id = tempElementId;
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);
      }

      const fileScanner = new Html5Qrcode(tempElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();

      if (decodedText) {
        handleDecodedText(decodedText);
      }
    } catch {
      setErrorMessage(
        'Could not decode barcode from photo. Please position the barcode closer in good lighting, or type the code in the field below.'
      );
      playPosBeep('error');
    } finally {
      setIsFileScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Manual code submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedText(manualInput.trim());
    setManualInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-0 sm:border-2 border-[#0A006E] rounded-none sm:rounded-3xl max-w-none sm:max-w-lg w-full h-full sm:h-auto overflow-hidden shadow-2xl flex flex-col sm:max-h-[92vh]">
        {/* Header Bar */}
        <div className="bg-[#0A006E] text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-montserrat font-black text-sm tracking-tight text-[#FFDE00]">
                  Barcode Scanner Station
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-[#FFDE00]/20 text-[#FFDE00] border border-[#FFDE00]/30">
                  {isScanning ? 'LIVE' : 'READY'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Phone camera, photo capture, or desktop scanner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`p-2 rounded-xl text-xs font-montserrat font-bold transition cursor-pointer ${
                !soundMuted
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
              }`}
              title={soundMuted ? 'Unmute Beep Chime' : 'Mute Beep Chime'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-1 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'camera'
                  ? 'bg-[#FFDE00] text-[#0A006E] shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Camera</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('photo');
                fileInputRef.current?.click();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'photo'
                  ? 'bg-[#FFDE00] text-[#0A006E] shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Snap Photo (100% Reliable)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition ${
                activeTab === 'manual'
                  ? 'bg-[#FFDE00] text-[#0A006E] shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Type / USB</span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            EAN-13 · UPC · CODE-128
          </span>
        </div>

        {/* Video Viewport Area */}
        <div className="relative flex-1 bg-black min-h-[260px] max-h-[380px] flex items-center justify-center overflow-hidden">
          {/* Target Element for Html5Qrcode */}
          <div
            id="phone-barcode-video-canvas"
            className="w-full h-full min-h-[260px] max-h-[380px] overflow-hidden"
          />

          {/* Aiming Reticle Overlay with Animated Scanning Laser Beam */}
          {isScanning && !errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-60 sm:w-72 h-40 sm:h-48 border-2 border-[#FFDE00]/90 rounded-2xl shadow-[0_0_24px_rgba(255,222,0,0.4)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />

                {/* Sweeping Laser Line Animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-red-500 via-[#FFDE00] to-red-500 shadow-[0_0_12px_#FFDE00] animate-[bounce_2s_infinite]" />

                <div className="absolute bottom-2 inset-x-0 text-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-black/60 text-white backdrop-blur-xs">
                    <ScanLine className="w-3 h-3 text-[#FFDE00]" />
                    Align barcode inside frame
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notice & Actionable Options when Camera Needs Permission or is blocked */}
          {errorMessage && (
            <div className="absolute inset-x-4 p-4 rounded-2xl bg-slate-900/95 border-2 border-amber-400 text-white text-xs space-y-3 text-center shadow-2xl z-20">
              <div className="flex items-center justify-center gap-2 text-amber-300 font-bold">
                <Smartphone className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-sm font-montserrat font-black">Camera Scanner Helper</span>
              </div>
              <p className="text-slate-200 text-[11px] leading-relaxed max-w-sm mx-auto">
                {errorMessage}
              </p>

              {/* Action Buttons: Explicit Tap to Request Permission & Native Photo Capture */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExplicitRequestPermission}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  Grant / Retry Live Camera
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isFileScanning}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] border-2 border-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition active:scale-95"
                >
                  <Upload className="w-4 h-4 text-[#FFDE00]" />
                  {isFileScanning ? 'Scanning Photo...' : '📸 Snap Photo with Phone Camera'}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 pt-1">
                💡 Tip: The <strong>"Snap Photo"</strong> button launches your phone's native camera directly and bypasses all browser permission blocks.
              </p>
            </div>
          )}

          {/* Floating Camera Controls Top Right */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center cursor-pointer transition shadow-md ${
                  torchOn ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
                title="Toggle Torch / Flashlight"
              >
                {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
              </button>
            )}

            {availableCameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-montserrat font-bold flex items-center gap-1 cursor-pointer transition shadow-md"
                title="Switch Camera (Front/Back)"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            )}
          </div>

          {/* Session Scan Counter Top Left */}
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-montserrat font-bold bg-[#0A006E]/90 text-white border border-white/20 shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Scanned: <strong>{sessionScanCount}</strong>
            </span>
          </div>
        </div>

        {/* Hidden native photo capture input (supports native phone camera snap) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileScan}
          className="hidden"
        />

        {/* Live Scan Result Banner */}
        {lastScannedResult && (
          <div
            className={`px-4 py-2.5 border-t text-xs flex items-center justify-between gap-3 shrink-0 ${
              lastScannedResult.success
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-100'
                : 'bg-rose-950/80 border-rose-600 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {lastScannedResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-montserrat font-bold truncate">
                  {lastScannedResult.productName || lastScannedResult.code}
                </div>
                <div className="text-[10px] text-slate-300 font-mono-tabular">
                  Barcode: {lastScannedResult.code}
                  {lastScannedResult.price && ` · KES ${lastScannedResult.price.toLocaleString()}`}
                </div>
              </div>
            </div>

            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 shrink-0">
              {lastScannedResult.success ? 'Added to Cart' : 'Not Found'}
            </span>
          </div>
        )}

        {/* Quick Barcode Entry & Snap Row */}
        <form onSubmit={handleManualSubmit} className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type or paste barcode here (EAN-13, SKU, or custom code)..."
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-[#FFDE00] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-3.5 py-2 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1 cursor-pointer transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isFileScanning}
            className="px-3 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] border border-[#FFDE00]/40 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
            title="Snap photo with phone camera or upload"
          >
            <Camera className="w-3.5 h-3.5 text-[#FFDE00]" />
            Snap Photo
          </button>
        </form>

        {/* Footer / Controls Bar */}
        <div className="bg-slate-900 px-4 sm:px-5 py-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] text-slate-300 font-medium">
            Desktop USB laser guns &amp; Bluetooth scanners work anytime without opening this modal.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition"
            >
              📸 Native Camera
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-montserrat font-black bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] cursor-pointer transition"
            >
              Done Scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
