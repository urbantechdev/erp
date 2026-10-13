import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Volume2,
  VolumeX,
  RotateCcw,
  Upload,
  Plus,
} from 'lucide-react';
import { Product } from '../types';
import { playPosBeep, triggerScanHaptic, isAudioMuted, toggleAudioMuted } from '../utils/audioBeep';

interface PhoneBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => { success: boolean; product?: Product; message?: string };
}

export const PhoneBarcodeScannerModal: React.FC<PhoneBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onBarcodeScanned,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    productName?: string;
    price?: number;
    success: boolean;
    timestamp: number;
  } | null>(null);
  const [sessionScanCount, setSessionScanCount] = useState<number>(0);
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isAudioMuted());
  const [manualInput, setManualInput] = useState<string>('');
  const [isFileScanning, setIsFileScanning] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle barcode scanned from camera stream, snapshot, or manual input
  const handleDecodedText = useCallback(
    (decodedText: string) => {
      const trimmed = decodedText.trim();
      if (!trimmed) return;

      const now = Date.now();
      // Debounce: prevent same code scanning repeatedly in under 1200ms
      if (lastScannedCodeRef.current === trimmed && now - lastScannedTimeRef.current < 1200) {
        return;
      }

      lastScannedCodeRef.current = trimmed;
      lastScannedTimeRef.current = now;

      // Delegate lookup and adding to parent
      const result = onBarcodeScanned(trimmed);

      if (result.success) {
        playPosBeep('success');
        triggerScanHaptic();
        setSessionScanCount((prev) => prev + 1);
        setLastScannedResult({
          code: trimmed,
          productName: result.product?.name,
          price: result.product?.retailPriceKes ?? result.product?.baseRetailPrice,
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
        // Ensure previous scanner stopped
        await stopCurrentScanner();

        // Check for secure context and mediaDevices availability
        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
          throw new Error(
            'Camera video stream requires a secure HTTPS connection. Please use HTTPS or tap "Snap Photo / Upload" below.'
          );
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error(
            'Live camera access is not supported by this browser environment. You can snap a photo or enter the barcode below.'
          );
        }

        const elementId = 'phone-barcode-video-canvas';
        const container = document.getElementById(elementId);
        if (!container) {
          isStartingRef.current = false;
          return;
        }

        const scanner = new Html5Qrcode(elementId);
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
          // Fallback if environment back-camera constraint failed (e.g., desktop/laptop with single user camera)
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

          // Enumerate cameras in the background without disturbing the running stream
          Html5Qrcode.getCameras()
            .then((devices) => {
              if (isMountedRef.current && devices && devices.length > 0) {
                setAvailableCameras(devices);
              }
            })
            .catch(() => {});
        }
      } catch (err: unknown) {
        console.warn('Camera start error:', err);
        if (isMountedRef.current) {
          const errObj = err as { name?: string; message?: string };
          let msg = 'Camera access denied or not available. Please allow camera permissions.';

          if (
            errObj?.name === 'NotAllowedError' ||
            errObj?.name === 'PermissionDeniedError' ||
            errObj?.message?.toLowerCase().includes('permission') ||
            errObj?.message?.toLowerCase().includes('not allowed')
          ) {
            msg =
              'Camera permission was blocked by your browser. Please tap the lock/settings icon in your browser address bar to allow Camera access, then tap "Retry Camera" below.';
          } else if (errObj?.name === 'NotFoundError' || errObj?.name === 'DevicesNotFoundError') {
            msg = 'No camera hardware found on this device. You can snap a photo or enter the barcode below.';
          } else if (errObj?.name === 'NotReadableError' || errObj?.name === 'TrackStartError') {
            msg = 'Camera is currently in use by another tab or app. Please close other camera apps and retry.';
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

      const fileScanner = new Html5Qrcode(tempElementId);
      const decodedText = await fileScanner.scanFile(file, false);
      fileScanner.clear();

      if (decodedText) {
        handleDecodedText(decodedText);
      }
    } catch {
      setErrorMessage(
        'Could not detect a clear barcode in the captured photo. Please make sure the barcode is well-lit and in focus, or enter the code manually below.'
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
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-bold shadow-xs shrink-0">
              <Camera className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-montserrat font-black text-sm sm:text-base text-white tracking-tight truncate">
                Barcode Scanner Station
              </h3>
              <span className="text-[10px] sm:text-[11px] text-slate-200 block truncate">
                Scan bottle EAN-13, UPC, or case barcode
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition shrink-0"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center min-h-[260px] sm:min-h-[300px] overflow-hidden">
          {/* html5-qrcode video target */}
          <div
            id="phone-barcode-video-canvas"
            className="w-full h-full min-h-[260px] max-h-[360px] overflow-hidden"
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

          {/* Camera Notice & Actionable Options */}
          {errorMessage && (
            <div className="absolute inset-x-4 p-4 rounded-2xl bg-slate-900/95 border-2 border-amber-400 text-white text-xs space-y-3 text-center shadow-2xl z-20">
              <div className="flex items-center justify-center gap-2 text-amber-300 font-bold">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-sm font-montserrat font-black">Camera Notice</span>
              </div>
              <p className="text-slate-200 text-[11px] leading-relaxed max-w-sm mx-auto">{errorMessage}</p>

              {/* Action Buttons: Retry Camera & Native Photo Capture */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="w-full sm:w-auto px-4 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Camera
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isFileScanning}
                  className="w-full sm:w-auto px-4 py-2 bg-[#0A006E] hover:bg-[#070050] text-white border border-[#FFDE00]/40 rounded-xl text-xs font-montserrat font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
                >
                  <Upload className="w-4 h-4 text-[#FFDE00]" />
                  {isFileScanning ? 'Scanning Photo...' : '📸 Snap Photo to Scan'}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 pt-1">
                Desktop USB scanners and Bluetooth handheld guns also work seamlessly anytime.
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
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition shadow-md"
                title="Switch Camera (Front / Rear)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSound}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center cursor-pointer transition shadow-md ${
                !soundMuted
                  ? 'bg-black/60 text-[#FFDE00] hover:bg-black/80'
                  : 'bg-rose-900/80 text-rose-200'
              }`}
              title={soundMuted ? 'Sound Muted' : 'Sound Enabled'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
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

        {/* Quick Manual Code Entry Row in Modal */}
        <form onSubmit={handleManualSubmit} className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type or paste barcode here..."
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-[#FFDE00] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-3 py-1.5 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1 cursor-pointer transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isFileScanning}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-montserrat font-semibold flex items-center gap-1 cursor-pointer transition shrink-0"
            title="Snap photo with phone camera or upload"
          >
            <Upload className="w-3.5 h-3.5 text-[#FFDE00]" />
            Snap
          </button>
        </form>

        {/* Footer / Controls Bar */}
        <div className="bg-slate-900 px-4 sm:px-5 py-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(e) => setContinuousMode(e.target.checked)}
              className="rounded text-[#0A006E] focus:ring-[#FFDE00] h-4 w-4"
            />
            <span>Continuous Scan Mode (rapid scan)</span>
          </label>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
          >
            Done ({sessionScanCount} Added)
          </button>
        </div>
      </div>
    </div>
  );
};
