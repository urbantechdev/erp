/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Smartphone,
  Keyboard,
  Upload,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowLeft,
  Store,
  DollarSign,
} from 'lucide-react';
import { Product, Branch, GeoRegion } from '../types';
import { playPosBeep, triggerScanHaptic, isAudioMuted, toggleAudioMuted } from '../utils/audioBeep';
import { calculateGeoPrice, formatKes } from '../erpUtils';
import {
  syncPosCartToFirestore,
  subscribeToActivePosCart,
  PosCartItem,
} from '../utils/posCartSync';

interface PhoneScannerCompanionProps {
  products: Product[];
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  branchId?: string;
  branches: Branch[];
  regions: GeoRegion[];
  onClose?: () => void;
  isStandaloneMobile?: boolean;
}

export const PhoneScannerCompanion: React.FC<PhoneScannerCompanionProps> = ({
  products,
  staffId,
  staffName,
  staffEmail,
  staffRole,
  branchId,
  branches,
  regions,
  onClose,
  isStandaloneMobile = false,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'photo' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundMuted, setSoundMuted] = useState(isAudioMuted());
  const [manualInput, setManualInput] = useState('');
  const [sessionScanCount, setSessionScanCount] = useState<number>(0);
  const [isFileScanning, setIsFileScanning] = useState(false);

  // Synced Cart State from Firestore
  const [remoteCart, setRemoteCart] = useState<PosCartItem[]>([]);
  const [remoteActivatedProductIds, setRemoteActivatedProductIds] = useState<string[]>([]);
  const [remoteGrandTotal, setRemoteGrandTotal] = useState<number>(0);
  const cartRef = useRef<PosCartItem[]>([]);
  const grandTotalRef = useRef<number>(0);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    code: string;
    productName: string;
    price: number;
    success: boolean;
    timestamp: number;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const activeRegion = regions[0];

  // Subscribe to real-time cart state for this cashier account
  useEffect(() => {
    const unsub = subscribeToActivePosCart(staffId || staffEmail, (data) => {
      setRemoteCart(data.cart);
      cartRef.current = data.cart;
      setRemoteActivatedProductIds(data.activatedProductIds);
      setRemoteGrandTotal(data.grandTotal);
      grandTotalRef.current = data.grandTotal;
    });
    return () => unsub();
  }, [staffId, staffEmail]);

  // Handle a detected barcode from camera, photo, or manual entry
  const handleBarcodeDecoded = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();
      if (code === lastScannedCodeRef.current && now - lastScanTimeRef.current < 1200) {
        return;
      }
      lastScanTimeRef.current = now;
      lastScannedCodeRef.current = code;

      const digitsOnly = code.replace(/\D/g, '');

      // 1. Find product in catalog
      let matched = products.find(
        (p) =>
          (p.barcode && p.barcode.trim() === code) ||
          (p.caseBarcode && p.caseBarcode.trim() === code) ||
          (p.sku && p.sku.toLowerCase() === code.toLowerCase())
      );

      let isCaseScan = false;
      if (matched && matched.caseBarcode && matched.caseBarcode.trim() === code) {
        isCaseScan = true;
      }

      if (!matched && digitsOnly) {
        matched = products.find((p) => {
          const pCase = p.caseBarcode ? p.caseBarcode.replace(/\D/g, '') : '';
          const pBottle = p.barcode ? p.barcode.replace(/\D/g, '') : '';
          if (pCase && (pCase === digitsOnly || pCase.endsWith(digitsOnly) || digitsOnly.endsWith(pCase))) {
            isCaseScan = true;
            return true;
          }
          if (pBottle) {
            if (pBottle === digitsOnly) return true;
            if (pBottle.padStart(13, '0') === digitsOnly.padStart(13, '0')) return true;
          }
          return false;
        });
      }

      if (!matched) {
        playPosBeep('error');
        setLastScannedFeedback({
          code,
          productName: `Barcode "${code}" not found in catalog`,
          price: 0,
          success: false,
          timestamp: now,
        });
        return;
      }

      // Calculate unit price and line totals
      const targetUnit: 'Bottle' | 'Case' = isCaseScan ? 'Case' : 'Bottle';
      const geoPrice = calculateGeoPrice(matched, activeRegion, 'retail');
      const unitPrice = targetUnit === 'Case' ? geoPrice.casePrice : geoPrice.unitBottlePrice;

      playPosBeep(isCaseScan ? 'case' : 'success');
      triggerScanHaptic();
      setSessionScanCount((prev) => prev + 1);

      // Build updated cart using latest accumulated ref
      const currentCart = [...cartRef.current];
      const existingIdx = currentCart.findIndex(
        (it) => it.product?.id === matched!.id && it.unitMode === targetUnit && it.kind === 'bonded_product'
      );

      let updatedCart: PosCartItem[];
      if (existingIdx >= 0) {
        const existing = currentCart[existingIdx];
        currentCart[existingIdx] = {
          ...existing,
          quantityUnits: existing.quantityUnits + 1,
        };
        updatedCart = currentCart;
      } else {
        updatedCart = [
          ...currentCart,
          {
            id: `scan-${matched.id}-${Date.now()}`,
            kind: 'bonded_product',
            product: matched,
            unitMode: targetUnit,
            quantityUnits: 1,
            unitPrice,
            name: matched.name,
            category: matched.category,
          },
        ];
      }

      const updatedActivatedIds = remoteActivatedProductIds.includes(matched.id)
        ? remoteActivatedProductIds
        : [matched.id, ...remoteActivatedProductIds];

      // Calculate totals
      let subtotal = 0;
      let totalUnits = 0;
      for (const item of updatedCart) {
        totalUnits += item.quantityUnits;
        subtotal += Math.round(item.unitPrice * item.quantityUnits);
      }
      const taxRate = activeRegion?.regionalTaxRate ?? 0.16;
      const exciseAndTax = Math.round(subtotal * taxRate);
      const grandTotal = subtotal + exciseAndTax;

      // Update local refs and state immediately for zero-delay UX
      cartRef.current = updatedCart;
      grandTotalRef.current = grandTotal;
      setRemoteCart(updatedCart);
      setRemoteGrandTotal(grandTotal);

      // Update feedback
      setLastScannedFeedback({
        code,
        productName: matched.name,
        price: unitPrice,
        success: true,
        timestamp: now,
      });

      // Synchronize immediately to Firestore for desktop cashier!
      await syncPosCartToFirestore({
        staffId: staffId || 'staff_cashier',
        staffName: staffName || 'Cashier',
        staffEmail: staffEmail || '',
        staffRole: staffRole || 'Counter Cashier',
        branchId: branchId || '',
        cart: updatedCart,
        activatedProductIds: updatedActivatedIds,
        totalUnits,
        subtotal,
        exciseAndTax,
        grandTotal,
        lastScannedBarcode: code,
        lastScannedProductName: matched.name,
        lastScannedUnitMode: targetUnit,
        sourceDevice: 'phone',
      });
    },
    [products, remoteCart, remoteActivatedProductIds, activeRegion, staffId, staffName, staffEmail, staffRole, branchId]
  );

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const sc = scannerRef.current;
        scannerRef.current = null;
        if (sc.isScanning) {
          await sc.stop().catch(() => {});
        }
        sc.clear();
      } catch {}
    }
    if (isMountedRef.current) {
      setIsScanning(false);
      setHasTorch(false);
      setTorchOn(false);
    }
  }, []);

  // Start camera helper
  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setErrorMessage(null);

    try {
      await stopCamera();

      const elementId = 'phone-companion-camera-canvas';
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

      try {
        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decoded) => handleBarcodeDecoded(decoded),
          () => {}
        );
      } catch {
        // Fallback for laptops or single-camera devices
        await scanner.start(
          { facingMode: 'user' },
          config,
          (decoded) => handleBarcodeDecoded(decoded),
          () => {}
        );
      }

      if (isMountedRef.current) {
        setIsScanning(true);
        try {
          const caps = scanner.getRunningTrackCapabilities();
          if (caps && 'torch' in caps) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMessage(
          'Live camera access is restricted or in use. Use "📸 Snap Photo to Scan" or type below to send to desktop cashier.'
        );
        setIsScanning(false);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [handleBarcodeDecoded, stopCamera]);

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      startCamera();
    }, 150);
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const toggleTorch = async () => {
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

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileScanning(true);
    setErrorMessage(null);
    try {
      const tempId = 'phone-companion-file-scan-temp';
      let temp = document.getElementById(tempId);
      if (!temp) {
        temp = document.createElement('div');
        temp.id = tempId;
        temp.style.display = 'none';
        document.body.appendChild(temp);
      }
      const fileScanner = new Html5Qrcode(tempId, {
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
      const decoded = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      if (decoded) {
        handleBarcodeDecoded(decoded);
      }
    } catch {
      playPosBeep('error');
      setErrorMessage('Could not decode barcode from photo. Position closer with good lighting.');
    } finally {
      setIsFileScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalCartUnits = remoteCart.reduce((sum, it) => sum + it.quantityUnits, 0);

  // Real sample barcodes for instant testing
  const testSampleBarcodes = products.filter((p) => Boolean(p.barcode)).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 text-white flex flex-col h-full overflow-hidden">
      {/* Top Header: Account Link & Live Sync Status */}
      <div className="bg-[#0A006E] px-4 py-3 border-b-2 border-[#FFDE00] flex items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer mr-1"
              title="Close Phone Scanner"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shrink-0 shadow-xs">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="font-montserrat font-black text-xs sm:text-sm text-[#FFDE00] truncate">
                Phone Barcode Scanner Station
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-emerald-500 text-slate-950 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                LIVE SYNC
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              Cashier: <strong className="text-white">{staffName}</strong> ({staffRole})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = toggleAudioMuted();
              setSoundMuted(next);
            }}
            className={`p-2 rounded-xl text-xs font-montserrat font-bold transition cursor-pointer ${
              !soundMuted
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
            title="Toggle Sound"
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Cashier Live Cart Banner at Top */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs shrink-0 font-mono-tabular">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Desktop Cart:</span>
          <span className="px-2 py-0.5 rounded-md bg-[#0A006E] text-[#FFDE00] font-bold">
            {totalCartUnits} unit{totalCartUnits === 1 ? '' : 's'}
          </span>
          <span className="text-slate-400">({remoteCart.length} lines)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Total:</span>
          <span className="font-montserrat font-black text-emerald-400 text-sm">
            {formatKes(remoteGrandTotal)}
          </span>
        </div>
      </div>

      {/* Camera Viewport Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[220px]">
        <div id="phone-companion-camera-canvas" className="w-full h-full min-h-[220px] overflow-hidden" />

        {/* Aiming Reticle with Sweeping Laser Line */}
        {isScanning && !errorMessage && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-64 sm:w-72 h-40 sm:h-48 border-2 border-[#FFDE00] rounded-2xl shadow-[0_0_24px_rgba(255,222,0,0.5)]">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-red-500 via-[#FFDE00] to-red-500 shadow-[0_0_12px_#FFDE00] animate-[bounce_1.8s_infinite]" />
              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-black/70 text-white backdrop-blur-xs">
                  <ScanLine className="w-3 h-3 text-[#FFDE00]" />
                  Aim bottle barcode inside frame
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Torch Button Floating Top Right */}
        {hasTorch && (
          <div className="absolute top-3 right-3 z-20">
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition shadow-md ${
                torchOn ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-black/60 text-white'
              }`}
            >
              {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Scan Count Badge Floating Top Left */}
        <div className="absolute top-3 left-3 z-20">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-montserrat font-bold bg-[#0A006E]/90 text-white border border-white/20 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Phone Scans: <strong>{sessionScanCount}</strong>
          </span>
        </div>

        {/* Fallback Error or Permission helper */}
        {errorMessage && (
          <div className="absolute inset-x-4 p-4 rounded-2xl bg-slate-900/95 border-2 border-amber-400 text-white text-xs space-y-3 text-center shadow-2xl z-20">
            <div className="flex items-center justify-center gap-2 text-amber-300 font-bold">
              <Smartphone className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Camera Helper</span>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed max-w-sm mx-auto">
              {errorMessage}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 bg-[#FFDE00] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] border border-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Snap Photo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input for Native Camera Snap */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />

      {/* Live Scan Result Toast */}
      {lastScannedFeedback && (
        <div
          className={`px-4 py-2.5 border-t text-xs flex items-center justify-between gap-3 shrink-0 animate-fade-in ${
            lastScannedFeedback.success
              ? 'bg-emerald-950 border-emerald-600 text-emerald-100'
              : 'bg-rose-950 border-rose-600 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {lastScannedFeedback.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-montserrat font-bold truncate">
                {lastScannedFeedback.productName}
              </div>
              <div className="text-[10px] text-slate-300 font-mono-tabular">
                Barcode: {lastScannedFeedback.code}
                {lastScannedFeedback.price > 0 && ` · ${formatKes(lastScannedFeedback.price)}`}
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 shrink-0 text-emerald-300">
            {lastScannedFeedback.success ? '⚡ Beamed to Desktop' : 'Not Found'}
          </span>
        </div>
      )}

      {/* Manual Input / USB Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualInput.trim()) {
            handleBarcodeDecoded(manualInput.trim());
            setManualInput('');
          }
        }}
        className="bg-slate-950 px-3 py-2 border-t border-slate-800 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Type or paste EAN barcode to beam to desktop..."
          className="flex-1 bg-slate-900 border border-slate-700 focus:border-[#FFDE00] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!manualInput.trim()}
          className="px-3 py-2 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs rounded-xl cursor-pointer"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isFileScanning}
          className="px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          Photo
        </button>
      </form>

      {/* Quick Test Barcode Buttons for Real Catalog Bottles */}
      <div className="bg-slate-900 px-3 py-2 border-t border-slate-800 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#FFDE00]" />
            Quick Test:
          </span>
          {testSampleBarcodes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleBarcodeDecoded(item.barcode!)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-montserrat font-semibold border border-slate-700 cursor-pointer flex items-center gap-1"
            >
              <span>{item.name.split(' ')[0]}</span>
              <span className="text-[#FFDE00] font-mono">({item.barcode?.slice(-4)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Floating Bottom Bar: Cart Total & Done button */}
      <div className="bg-[#0A006E] px-4 py-3 border-t-2 border-[#FFDE00] flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="text-[10px] text-[#FFDE00] uppercase font-bold tracking-wider">
            Live Cashier Cart Total
          </div>
          <div className="text-base sm:text-lg font-montserrat font-black text-white font-mono-tabular">
            {formatKes(remoteGrandTotal)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] font-montserrat font-black text-xs cursor-pointer shadow-md"
            >
              Return to POS
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
