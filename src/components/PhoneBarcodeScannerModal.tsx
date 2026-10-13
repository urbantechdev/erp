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
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
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

  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  // Handle barcode scanned from camera stream
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

  // Initialize camera scanner when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (scannerInstance && isScanning && !isStoppingRef.current) {
        isStoppingRef.current = true;
        scannerInstance
          .stop()
          .then(() => {
            scannerInstance.clear();
            setIsScanning(false);
            setScannerInstance(null);
            isStoppingRef.current = false;
          })
          .catch(() => {
            isStoppingRef.current = false;
          });
      }
      return;
    }

    let activeScanner: Html5Qrcode | null = null;
    let isCancelled = false;

    const startScanner = async () => {
      setErrorMessage(null);
      try {
        // Enumerate devices
        const devices = await Html5Qrcode.getCameras().catch(() => []);
        if (!isCancelled && devices && devices.length > 0) {
          setAvailableCameras(devices);
          if (!selectedCameraId) {
            // Prefer back / environment camera
            const backCam = devices.find(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('environment')
            );
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          }
        }

        const elementId = 'phone-barcode-video-canvas';
        const container = document.getElementById(elementId);
        if (!container) return;

        activeScanner = new Html5Qrcode(elementId);
        setScannerInstance(activeScanner);

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

        const cameraChoice = selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: 'environment' };

        await activeScanner.start(
          cameraChoice,
          config,
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
            // standard frame-by-frame non-match; ignored
          }
        );

        if (!isCancelled) {
          setIsScanning(true);
          // Check for torch capability
          try {
            const capabilities = activeScanner.getRunningTrackCapabilities();
            if (capabilities && 'torch' in capabilities) {
              setHasTorch(true);
            }
          } catch {
            setHasTorch(false);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Camera access denied or not available. Please allow camera permissions.';
          setErrorMessage(msg);
          setIsScanning(false);
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (activeScanner && !isStoppingRef.current) {
        isStoppingRef.current = true;
        activeScanner
          .stop()
          .then(() => {
            activeScanner?.clear();
            isStoppingRef.current = false;
          })
          .catch(() => {
            isStoppingRef.current = false;
          });
      }
    };
  }, [isOpen, selectedCameraId, handleDecodedText]);

  // Toggle Torch / Flashlight
  const handleToggleTorch = async () => {
    if (!scannerInstance || !isScanning) return;
    try {
      const next = !torchOn;
      await scannerInstance.applyVideoConstraints({
        advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[],
      });
      setTorchOn(next);
    } catch {
      setHasTorch(false);
    }
  };

  // Switch camera
  const handleSwitchCamera = () => {
    if (availableCameras.length <= 1) return;
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex].id);
  };

  const handleToggleSound = () => {
    const next = toggleAudioMuted();
    setSoundMuted(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-5">
      <div className="bg-slate-900 border-0 sm:border-2 border-[#0A006E] rounded-none sm:rounded-3xl max-w-none sm:max-w-lg w-full h-full sm:h-auto overflow-hidden shadow-2xl flex flex-col sm:max-h-[92vh]">
        {/* Header Bar */}
        <div className="bg-[#0A006E] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-bold shadow-xs">
              <Camera className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                Phone & Camera Barcode Scanner
              </h3>
              <span className="text-[11px] text-slate-200">
                Point camera at bottle EAN-13, UPC, or case barcode
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          {/* html5-qrcode video target */}
          <div
            id="phone-barcode-video-canvas"
            className="w-full h-full min-h-[280px] max-h-[380px] overflow-hidden"
          />

          {/* Aiming Reticle Overlay with Animated Scanning Laser Beam */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 sm:w-72 h-44 sm:h-48 border-2 border-[#FFDE00]/90 rounded-2xl shadow-[0_0_24px_rgba(255,222,0,0.4)]">
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

          {/* Camera Error Prompt */}
          {errorMessage && (
            <div className="absolute inset-x-4 p-4 rounded-2xl bg-red-950/90 border border-red-500 text-white text-xs space-y-2 text-center">
              <div className="flex items-center justify-center gap-2 text-red-300 font-bold">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span>Camera Notice</span>
              </div>
              <p className="text-slate-200">{errorMessage}</p>
              <p className="text-[11px] text-slate-400">
                You can also use a desktop USB barcode scanner, Bluetooth handheld scanner, or the
                Quick-Scan input field on the dashboard.
              </p>
            </div>
          )}

          {/* Floating Camera Controls Top Right */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition shadow-md ${
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
                className="w-9 h-9 rounded-xl bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition shadow-md"
                title="Switch Camera (Front / Rear)"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSound}
              className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition shadow-md ${
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-montserrat font-bold bg-[#0A006E]/90 text-white border border-white/20 shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Scanned: <strong>{sessionScanCount}</strong>
            </span>
          </div>
        </div>

        {/* Live Scan Result Banner */}
        {lastScannedResult && (
          <div
            className={`px-4 py-3 border-t text-xs flex items-center justify-between gap-3 ${
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

        {/* Footer / Controls Bar */}
        <div className="bg-slate-900 px-5 py-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(e) => setContinuousMode(e.target.checked)}
              className="rounded text-[#0A006E] focus:ring-[#FFDE00] h-4 w-4"
            />
            <span>Continuous Scan Mode (rapid scan multiple bottles)</span>
          </label>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
          >
            Done Scanning ({sessionScanCount} Added)
          </button>
        </div>
      </div>
    </div>
  );
};
