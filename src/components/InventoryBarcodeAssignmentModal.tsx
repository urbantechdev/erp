import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Barcode,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Search,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Check,
  Package,
  Layers,
  Flashlight,
  FlashlightOff,
  Keyboard,
} from 'lucide-react';
import { Product, StaffMember } from '../types';
import { ProductImage } from './ProductImage';
import { formatKes } from '../erpUtils';
import { playPosBeep, triggerScanHaptic, toggleAudioMuted, isAudioMuted } from '../utils/audioBeep';

interface InventoryBarcodeAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProductId?: string;
  currentUser: StaffMember;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
}

export const InventoryBarcodeAssignmentModal: React.FC<InventoryBarcodeAssignmentModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProductId,
  currentUser,
  onUpdateProduct,
}) => {

  // Selected product to link barcode to
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    if (initialProductId) return initialProductId;
    const firstAwaiting = products.find((p) => !p.hasRealBarcode);
    return firstAwaiting ? firstAwaiting.id : products[0]?.id || '';
  });

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  const awaitingCount = useMemo(() => products.filter((p) => !p.hasRealBarcode).length, [products]);
  const registeredCount = useMemo(() => products.filter((p) => Boolean(p.hasRealBarcode)).length, [products]);

  // Product search in dropdown / picker
  const [productSearch, setProductSearch] = useState('');
  const [filterOnlyAwaiting, setFilterOnlyAwaiting] = useState(true);

  const eligibleProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => {
      if (filterOnlyAwaiting && p.hasRealBarcode) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q)
      );
    });
  }, [products, filterOnlyAwaiting, productSearch]);

  // Scanner UI States
  const [activeTab, setActiveTab] = useState<'camera' | 'gun' | 'manual' | 'photo'>('camera');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [gunInput, setGunInput] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [locallyAssignedBarcodes, setLocallyAssignedBarcodes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Audio & Camera controls
  const [soundMuted, setSoundMuted] = useState(isAudioMuted());
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);
  const gunInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for duplicate barcode in catalog
  const duplicateCollision = useMemo(() => {
    const code = scannedCode.trim();
    if (!code || !selectedProduct) return null;
    return (
      products.find(
        (p) => p.id !== selectedProduct.id && p.hasRealBarcode && p.barcode && p.barcode.trim() === code
      ) || null
    );
  }, [products, scannedCode, selectedProduct]);

  // Handle newly detected barcode string
  const handleBarcodeDetected = useCallback(
    (rawCode: string) => {
      const clean = rawCode.trim();
      if (!clean) return;

      playPosBeep('success');
      triggerScanHaptic();
      setScannedCode(clean);

      // Check collision
      const collision = products.find(
        (p) => p.id !== selectedProduct?.id && p.hasRealBarcode && p.barcode && p.barcode.trim() === clean
      );

      if (collision) {
        setStatusMessage({
          type: 'warning',
          text: `Barcode "${clean}" is already assigned to "${collision.name}" (${collision.sku}). Scanning duplicate real barcodes is blocked.`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Real barcode "${clean}" captured! Ready to register.`,
        });
      }
    },
    [products, selectedProduct]
  );

  // Auto focus gun input when in gun mode
  useEffect(() => {
    if (activeTab === 'gun') {
      const timer = setTimeout(() => {
        gunInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Clean camera initialization & shutdown
  const stopCameraScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('Camera stop warning:', e);
      }
    }
    setIsCameraScanning(false);
    setTorchOn(false);
  }, []);

  const startCameraScanner = useCallback(
    async (cameraId?: string) => {
      if (isStartingRef.current || !isMountedRef.current) return;
      isStartingRef.current = true;
      setStatusMessage(null);

      try {
        await stopCameraScanner();

        const qrContainer = document.getElementById('inventory-camera-viewfinder');
        if (!qrContainer) {
          isStartingRef.current = false;
          return;
        }

        const scanner = new Html5Qrcode('inventory-camera-viewfinder', {
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

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setStatusMessage({
            type: 'error',
            text: 'No camera hardware detected on this device. Please use Laser Gun or Manual Digits mode.',
          });
          isStartingRef.current = false;
          return;
        }

        setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));

        let chosenId = cameraId;
        if (!chosenId) {
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          chosenId = backCam ? backCam.id : devices[devices.length - 1].id;
        }
        setCurrentCameraId(chosenId);

        await scanner.start(
          chosenId,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(viewfinderWidth * 0.85);
              const height = Math.floor(viewfinderHeight * 0.6);
              return { width: Math.max(width, 240), height: Math.max(height, 160) };
            },
            aspectRatio: 1.3333,
          },
          (decodedText) => {
            handleBarcodeDetected(decodedText);
          },
          () => {
            // frame pass
          }
        );

        setIsCameraScanning(true);

        try {
          // Check torch capability
          const capabilities = (scanner as any).getRunningTrackCapabilities?.();
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
        } catch {
          // torch check fallback
        }
      } catch (err: any) {
        console.error('Camera start failed:', err);
        setStatusMessage({
          type: 'error',
          text: 'Camera access denied or busy. You can use the Desktop Gun or Manual Digits tabs.',
        });
      } finally {
        isStartingRef.current = false;
      }
    },
    [handleBarcodeDetected, stopCameraScanner]
  );

  // Effect to manage camera lifecycle per tab
  useEffect(() => {
    isMountedRef.current = true;
    if (activeTab === 'camera') {
      const timer = setTimeout(() => {
        startCameraScanner();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }

    return () => {
      isMountedRef.current = false;
      stopCameraScanner();
    };
  }, [activeTab, startCameraScanner, stopCameraScanner]);

  // Photo file upload decoding
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    try {
      const html5Qr = new Html5Qrcode('inventory-photo-temp-reader', { verbose: false });
      const result = await html5Qr.scanFile(file, true);
      html5Qr.clear();
      handleBarcodeDetected(result);
    } catch (err) {
      playPosBeep('error');
      setStatusMessage({
        type: 'error',
        text: 'Could not decode barcode from image. Ensure label is well-lit, sharp, and unwrinkled.',
      });
    }
  };

  // Submit and save real barcode to product
  const handleSaveBarcode = async () => {
    if (!selectedProduct) return;
    let clean = scannedCode.trim();
    if (!clean && activeTab === 'manual' && manualInput.trim()) {
      clean = manualInput.trim();
    } else if (!clean && activeTab === 'gun' && gunInput.trim()) {
      clean = gunInput.trim();
    }

    if (!clean) {
      setStatusMessage({ type: 'error', text: 'Please scan or enter a real barcode first.' });
      return;
    }

    if (duplicateCollision) {
      setStatusMessage({
        type: 'error',
        text: `Cannot save: Barcode is already used by ${duplicateCollision.name} (${duplicateCollision.sku}).`,
      });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onUpdateProduct(selectedProduct.id, {
        barcode: clean,
        hasRealBarcode: true,
        barcodeVerificationStatus: 'APPROVED_MASTER',
        barcodeRegisteredAt: new Date().toISOString(),
        barcodeRegisteredBy: currentUser.name,
        barcodeRegisteredByRole: currentUser.role,
      });

      // Optimistically record the assigned barcode
      setLocallyAssignedBarcodes((prev) => ({
        ...prev,
        [selectedProduct.id]: clean,
      }));

      playPosBeep('success');
      setStatusMessage({
        type: 'success',
        text: `Successfully registered real barcode ${clean} to "${selectedProduct.name}"!`,
      });

      // Clear scanned code for next bottle
      setScannedCode('');
      setGunInput('');
      setManualInput('');

      // Auto-advance to next product awaiting real barcode if available
      const nextAwaiting = products.find(
        (p) => p.id !== selectedProduct.id && !p.hasRealBarcode && !locallyAssignedBarcodes[p.id]
      );
      if (nextAwaiting) {
        setTimeout(() => {
          setSelectedProductId(nextAwaiting.id);
          setStatusMessage({
            type: 'success',
            text: `Advanced to next bottle awaiting barcode: "${nextAwaiting.name}".`,
          });
        }, 800);
      }
    } catch (err: any) {
      console.error('Barcode save error:', err);
      let errorMsg = 'Failed to save real barcode to database.';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          errorMsg = parsed.error || err.message;
        } catch {
          errorMsg = err.message;
        }
      }
      setStatusMessage({
        type: 'error',
        text: errorMsg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-none sm:max-w-3xl h-full sm:h-auto bg-white rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl overflow-hidden my-0 sm:my-auto sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0A006E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md shrink-0">
              <Barcode className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-black text-sm text-[#FFDE00]">
                  Scan & Register Real Product Barcode
                </h3>
                <span className="px-2 py-0.5 bg-[#FFDE00]/20 text-[#FFDE00] border border-[#FFDE00]/40 rounded-full text-[10px] font-montserrat font-black uppercase tracking-wider">
                  Inventory Controller Master Station
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                All fake barcodes have been removed. Scan the physical bottle to register its real barcode for Retail POS checkout.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = toggleAudioMuted();
                setSoundMuted(next);
              }}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              title={soundMuted ? 'Unmute Scan Beep' : 'Mute Scan Beep'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Target Product Selection Card */}
          <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0A006E]" />
                <span className="font-montserrat font-black text-slate-900 text-xs uppercase tracking-wider">
                  Target Product Bottle
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-bold">
                  {awaitingCount} Awaiting Barcode
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-bold">
                  {registeredCount} Verified Real
                </span>
              </div>
            </div>

            {/* Product Switcher Dropdown & Search */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              <div className="sm:col-span-8 relative">
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setScannedCode('');
                    setStatusMessage(null);
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-montserrat font-bold text-slate-900 cursor-pointer text-xs"
                >
                  {eligibleProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.hasRealBarcode ? '✓ [REAL BARCODE] ' : '⚠️ [NO BARCODE] '}
                      {p.name} ({p.sku}) · {formatKes(p.retailPriceKes || p.baseRetailPrice || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterOnlyAwaiting((prev) => !prev)}
                  className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-montserrat font-bold transition cursor-pointer border ${
                    filterOnlyAwaiting
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {filterOnlyAwaiting ? 'Showing Awaiting Only' : 'Show All SKUs'}
                </button>
              </div>
            </div>

            {/* Active Selected Product Mini-Card */}
            {selectedProduct && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductImage
                    product={{
                      ...selectedProduct,
                      category: selectedProduct.category === 'LPS' ? 'LPS' : 'IPS',
                    }}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="font-montserrat font-black text-slate-900 text-xs truncate">
                      {selectedProduct.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-tabular">
                      SKU: <span className="font-bold text-[#0A006E]">{selectedProduct.sku}</span> · {selectedProduct.category} · {selectedProduct.volumeMl}ml
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {(selectedProduct.hasRealBarcode && selectedProduct.barcode) || locallyAssignedBarcodes[selectedProduct.id] ? (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-mono-tabular font-bold text-[11px]">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Current: {locallyAssignedBarcodes[selectedProduct.id] || selectedProduct.barcode}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-montserrat font-bold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      No Barcode Linked
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scanner Mode Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'camera', label: 'Phone / Device Camera', icon: Camera },
              { id: 'gun', label: 'Desktop Laser Gun / Bluetooth', icon: Barcode },
              { id: 'manual', label: 'Type Barcode Digits', icon: Keyboard },
              { id: 'photo', label: 'Upload Barcode Photo', icon: Upload },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 rounded-xl font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: Camera Scanner Viewfinder */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative w-full aspect-4/3 max-w-md mx-auto bg-slate-950 rounded-2xl overflow-hidden border-2 border-[#0A006E] shadow-inner">
                <div id="inventory-camera-viewfinder" className="w-full h-full" />

                {/* Overlay Aim Guide */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full h-44 border-2 border-[#FFDE00] rounded-xl relative shadow-[0_0_20px_rgba(255,222,0,0.3)]">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                    <div className="absolute bottom-2 inset-x-0 text-center text-[10px] font-montserrat font-black text-[#FFDE00] drop-shadow">
                      Center bottle barcode within frame
                    </div>
                  </div>
                </div>

                {/* Torch / Camera Switch controls */}
                <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                  {availableCameras.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextIndex =
                          (availableCameras.findIndex((c) => c.id === currentCameraId) + 1) %
                          availableCameras.length;
                        startCameraScanner(availableCameras[nextIndex].id);
                      }}
                      className="p-2 bg-slate-900/80 text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                      title="Switch camera"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-center text-[11px] text-slate-500 font-medium">
                Align the real bottle barcode (EAN-13, UPC-A, Code-128). Audio chime confirms successful scan.
              </p>
            </div>
          )}

          {/* TAB 2: Desktop Laser Gun / Bluetooth Scanner */}
          {activeTab === 'gun' && (
            <div className="p-6 bg-slate-50 border-2 border-dashed border-[#0A006E]/40 rounded-2xl text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center mx-auto shadow-md">
                <Barcode className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="font-montserrat font-black text-sm text-[#0A006E]">
                  Desktop Laser Gun / Bluetooth Scanner Active
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Point your handheld USB or Bluetooth laser scanner at the bottle's real barcode and pull the trigger.
                </p>
              </div>

              <div className="max-w-md mx-auto relative">
                <ScanLine className="w-5 h-5 text-[#0A006E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={gunInputRef}
                  type="text"
                  value={gunInput}
                  onChange={(e) => setGunInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeDetected(gunInput);
                    }
                  }}
                  placeholder="Listening for laser gun scan (or type code & press Enter)..."
                  className="w-full pl-11 pr-24 py-3 bg-white border-2 border-[#0A006E] rounded-xl font-mono-tabular font-bold text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-[#0A006E]/10"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeDetected(gunInput)}
                  disabled={!gunInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#FFDE00] text-[#0A006E] font-montserrat font-black rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Accept
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Type Barcode Digits */}
          {activeTab === 'manual' && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label className="font-montserrat font-bold text-slate-700 block">
                Type Real Barcode Digits (EAN-13, UPC-A, or Manufacturer Code)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeDetected(manualInput);
                    }
                  }}
                  placeholder="e.g. 5000267014005"
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeDetected(manualInput)}
                  disabled={!manualInput.trim()}
                  className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] font-montserrat font-black rounded-xl cursor-pointer disabled:opacity-40"
                >
                  Verify Digits
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Photo File Upload */}
          {activeTab === 'photo' && (
            <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3">
              <div id="inventory-photo-temp-reader" className="hidden" />
              <Upload className="w-8 h-8 text-[#0A006E] mx-auto" />
              <div className="font-montserrat font-bold text-slate-800 text-xs">
                Upload Bottle Photo with Visible Barcode
              </div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Select a sharp, clear photo of the bottle's barcode from your device photo gallery or file picker.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs rounded-xl cursor-pointer shadow-md"
              >
                Choose Photo from Gallery
              </button>
            </div>
          )}

          {/* Result & Confirmation Section */}
          <div className="p-4 bg-emerald-50/70 border-2 border-emerald-400 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-montserrat font-black text-[#0A006E] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Scanned Real Barcode Preview
              </span>
              {scannedCode && (
                <button
                  type="button"
                  onClick={() => setScannedCode('')}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer text-[11px] font-bold"
                >
                  Clear Code
                </button>
              )}
            </div>

            {scannedCode ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-300">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Scanned Digits
                  </div>
                  <div className="font-mono-tabular font-black text-xl text-[#0A006E] tracking-wider">
                    {scannedCode}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                    Length: {scannedCode.length} digits · Ready to link to {selectedProduct?.name}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveBarcode}
                  disabled={isSaving || Boolean(duplicateCollision)}
                  className="px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition shrink-0"
                >
                  <ShieldCheck className="w-4 h-4 text-[#0A006E]" />
                  {isSaving ? 'Registering...' : 'Save & Link Real Barcode'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-white/60 border border-dashed border-emerald-300 rounded-xl text-center text-slate-500">
                Awaiting barcode scan. Point camera, scan with laser gun, or enter digits above.
              </div>
            )}
          </div>

          {/* Status Feedback Toast/Alert */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 font-montserrat font-bold text-xs ${
                statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              {statusMessage.type === 'error' || statusMessage.type === 'warning' ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Logged in: <span className="font-bold text-slate-800">{currentUser.name}</span> ({currentUser.role})
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-montserrat font-bold rounded-xl text-xs hover:bg-slate-100 cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
