import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Package,
  Sparkles,
  X,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  Building2,
  Layers,
  RefreshCw,
  AlertCircle,
  Wine,
} from 'lucide-react';
import { Product, Branch, StaffMember } from '../types';
import { ProductImage } from './ProductImage';
import { PhoneBarcodeScannerModal } from './PhoneBarcodeScannerModal';
import { formatKes } from '../erpUtils';
import { playPosBeep, triggerScanHaptic } from '../utils/audioBeep';

interface OnboardItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  onActivateProductStock: (
    productId: string,
    branchId: string,
    quantityToAdd: number
  ) => Promise<{ success: boolean; message: string; updatedProduct?: Product }>;
  onShowSuccessFeedback?: (title: string, message: string) => void;
  onShowErrorFeedback?: (title: string, message: string) => void;
}

export const OnboardItemsModal: React.FC<OnboardItemsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  products,
  branches,
  onActivateProductStock,
  onShowSuccessFeedback,
  onShowErrorFeedback,
}) => {
  // Target Branch: default to Branch Manager's assigned branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (currentUser.branchId) return currentUser.branchId;
    return branches[0]?.id || 'br-hq-001';
  });

  const targetBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  // Brand and search filter
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(12);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [recentActivations, setRecentActivations] = useState<
    {
      id: string;
      productName: string;
      quantity: number;
      costIncrease: number;
      time: string;
    }[]
  >([]);

  // Unique brands list extracted from catalog
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const b = p.brand || p.name.split(' ')[0] || 'VAAIRO';
      if (b) set.add(b);
    });
    return Array.from(set).sort();
  }, [products]);

  // Current selected product object
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Filtered products list based on Brand & Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedBrand !== 'All') {
        const pBrand = p.brand || p.name.split(' ')[0] || '';
        if (pBrand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesBarcode = (p.barcode || '').includes(q) || (p.caseBarcode || '').includes(q);
        const matchesBrand = (p.brand || '').toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesBarcode && !matchesBrand) return false;
      }
      return true;
    });
  }, [products, selectedBrand, searchQuery]);

  // Current branch asset valuation
  const currentBranchAssets = useMemo(() => {
    let total = 0;
    products.forEach((p) => {
      if (p.branchStockSummary) {
        try {
          const map = JSON.parse(p.branchStockSummary);
          const count = map[selectedBranchId] || 0;
          const unitCost = p.warehouseCostKes ?? p.baseLandedCost ?? 2000;
          total += count * unitCost;
        } catch {}
      }
    });
    return total;
  }, [products, selectedBranchId]);

  // Helper to match and autofill product by scanned barcode
  const handleMatchBarcode = (codeToMatch: string): { success: boolean; product?: Product; message?: string } => {
    const trimmed = codeToMatch.trim();
    if (!trimmed) return { success: false, message: 'Empty barcode.' };

    // Search by exact barcode, caseBarcode, SKU, or numeric match
    const match = products.find((p) => {
      if (p.barcode && p.barcode.replace(/[^0-9]/g, '') === trimmed.replace(/[^0-9]/g, '')) return true;
      if (p.caseBarcode && p.caseBarcode.replace(/[^0-9]/g, '') === trimmed.replace(/[^0-9]/g, '')) return true;
      if (p.sku.toLowerCase() === trimmed.toLowerCase()) return true;
      if (p.barcode === trimmed || p.caseBarcode === trimmed) return true;
      return false;
    }) || products.find((p) => p.name.toLowerCase().includes(trimmed.toLowerCase()));

    if (match) {
      setSelectedProductId(match.id);
      setScannedBarcode(match.barcode || trimmed);
      if (match.brand) {
        setSelectedBrand(match.brand);
      }
      // If product has packSize or default 12
      const defQty = match.bottlesPerCase || match.packSize || 12;
      setQuantity(defQty);
      playPosBeep('success');
      triggerScanHaptic();
      return { success: true, product: match };
    } else {
      playPosBeep('error');
      return { success: false, message: `Barcode "${trimmed}" not matched to any registered item.` };
    }
  };

  // Barcode scanned from phone camera scanner
  const handleCameraBarcodeScanned = (code: string) => {
    const result = handleMatchBarcode(code);
    if (result && result.success && result.product) {
      setIsCameraScannerOpen(false);
      return { success: true, product: result.product };
    }
    return { success: false, message: result?.message || 'Barcode not matched' };
  };

  // Execution: Activate stock and increase branch assets
  const handleActivateStock = async () => {
    if (!selectedProduct) {
      onShowErrorFeedback?.('Select an Item', 'Please select or scan an item before activating stock.');
      return;
    }
    if (quantity <= 0) {
      onShowErrorFeedback?.('Invalid Quantity', 'Please set a quantity greater than zero (e.g. 12 bottles).');
      return;
    }

    setIsActivating(true);
    try {
      const result = await onActivateProductStock(
        selectedProduct.id,
        selectedBranchId,
        quantity
      );

      if (result.success) {
        playPosBeep('success');
        triggerScanHaptic();

        const unitCost = selectedProduct.warehouseCostKes ?? selectedProduct.baseLandedCost ?? 2000;
        const totalCostAdded = quantity * unitCost;

        setRecentActivations((prev) => [
          {
            id: `${Date.now()}`,
            productName: selectedProduct.name,
            quantity,
            costIncrease: totalCostAdded,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.slice(0, 9),
        ]);

        onShowSuccessFeedback?.(
          'Stock Activated Successfully!',
          `Activated ${quantity} bottles of ${selectedProduct.name} on stock. Branch assets increased by ${formatKes(totalCostAdded)}.`
        );
      } else {
        onShowErrorFeedback?.('Activation Issue', result.message || 'Failed to activate stock.');
      }
    } catch (err: any) {
      console.error('Stock activation error:', err);
      let errorMsg = 'Error activating stock in database.';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          errorMsg = parsed.error || err.message;
        } catch {
          errorMsg = err.message;
        }
      }
      onShowErrorFeedback?.('System Error', errorMsg);
    } finally {
      setIsActivating(false);
    }
  };

  if (!isOpen) return null;

  const unitCost = selectedProduct
    ? (selectedProduct.warehouseCostKes ?? selectedProduct.baseLandedCost ?? 2000)
    : 0;
  const assetIncrease = quantity * unitCost;

  // Current stock in branch for selected item
  let currentStockInBranch = 0;
  if (selectedProduct && selectedProduct.branchStockSummary) {
    try {
      const bMap = JSON.parse(selectedProduct.branchStockSummary);
      currentStockInBranch = bMap[selectedBranchId] || 0;
    } catch {}
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-y-auto"
      >
        <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-[#0A006E] text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-[#FFDE00] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md border-2 border-white shrink-0">
                <Barcode className="w-6 h-6 stroke-[2.4]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-montserrat font-black italic text-white tracking-tight">
                    ONBOARD ITEMS &amp; ACTIVATE STOCK
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-[#34D186] text-[#0A006E]">
                    Branch Manager
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Scan barcodes to match items, activate available stock, and increase branch asset valuation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-[#FFDE00] hover:text-[#0A006E] text-white flex items-center justify-center cursor-pointer transition active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Subheader: Branch Selector & Live Asset Banner */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#0A006E] shrink-0" />
              <div>
                <span className="text-[10px] font-montserrat font-bold text-slate-500 uppercase tracking-wider block">
                  Active Operational Branch
                </span>
                <select
                  disabled={currentUser.role === 'Branch Manager'}
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="font-montserrat font-black text-sm text-[#0A006E] bg-transparent border-none p-0 cursor-pointer focus:outline-none"
                >
                  {(currentUser.role === 'Branch Manager'
                    ? branches.filter(
                        (b) =>
                          b.id === currentUser.branchId ||
                          b.name === currentUser.branchName
                      )
                    : branches
                  ).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <TrendingUp className="w-4 h-4 text-[#1E9E60]" />
              <span className="text-xs font-semibold text-slate-600">Branch Stock Assets:</span>
              <span className="font-montserrat font-bold text-sm text-[#0A006E] font-mono-tabular">
                {formatKes(currentBranchAssets)}
              </span>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Action Bar: Mobile Camera Scanner + Manual Barcode Input */}
            <div className="bg-[#0A006E]/5 border-2 border-[#0A006E]/20 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#0A006E]" />
                  Step 1: Scan Barcode with Phone Camera or Enter Code
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Autofills &amp; Matches Selected Item</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Mobile Camera Scanner Button */}
                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="sm:col-span-5 w-full py-3 px-4 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl font-montserrat font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-md transition active:scale-95"
                >
                  <Camera className="w-5 h-5 stroke-[2.4]" />
                  <span>Open Mobile Barcode Scanner</span>
                </button>

                {/* Manual Barcode Lookup Field */}
                <div className="sm:col-span-7 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={scannedBarcode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setScannedBarcode(val);
                        if (val.trim().length >= 8) {
                          handleMatchBarcode(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleMatchBarcode(scannedBarcode);
                        }
                      }}
                      placeholder="Scan or type barcode (e.g. 5000267014203)..."
                      className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl font-mono-tabular font-bold text-sm text-slate-800 focus:border-[#0A006E] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMatchBarcode(scannedBarcode)}
                    className="px-4 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs hover:bg-[#060046] transition cursor-pointer"
                  >
                    Match Item
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Select Brand & Item */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
                  <Wine className="w-4 h-4 text-[#0A006E]" />
                  Step 2: Select Brand &amp; Product ({filteredProducts.length} Available)
                </span>
              </div>

              {/* Brand Selection Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedBrand('All')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedBrand === 'All'
                      ? 'bg-[#0A006E] text-[#FFDE00]'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Brands
                </button>
                {availableBrands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBrand(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedBrand.toLowerCase() === b.toLowerCase()
                        ? 'bg-[#FFDE00] text-[#0A006E] border-2 border-[#0A006E]'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              {/* Search + Product Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, volume, SKU..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-8">
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedProductId(id);
                      const prod = products.find((p) => p.id === id);
                      if (prod && prod.barcode) {
                        setScannedBarcode(prod.barcode);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:border-[#0A006E] focus:outline-none"
                  >
                    <option value="">-- Choose Item to Onboard &amp; Activate --</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · Barcode: {p.barcode || 'N/A'} · Landed: KES {(p.warehouseCostKes ?? p.baseLandedCost ?? 2000).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Selected Product Card & Quantity Set */}
            {selectedProduct && (
              <div className="bg-white border-2 border-[#0A006E] rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ProductImage
                      product={{
                        ...selectedProduct,
                        category: selectedProduct.category === 'LPS' ? 'LPS' : 'IPS',
                      }}
                      size="lg"
                      className="rounded-xl shadow-xs shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-[#FFDE00] text-[#0A006E]">
                          {selectedProduct.brand || 'VAAIRO'}
                        </span>
                        <span className="text-xs font-mono-tabular font-bold text-slate-500">
                          SKU: {selectedProduct.sku}
                        </span>
                        <span className="text-xs font-mono-tabular font-bold text-slate-500">
                          Barcode: {selectedProduct.barcode || 'Generated'}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-montserrat font-black text-slate-900 truncate mt-1">
                        {selectedProduct.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                        <span>Landed Cost: <strong className="font-mono-tabular text-[#0A006E]">{formatKes(unitCost)}</strong></span>
                        <span>·</span>
                        <span>Current Branch Stock: <strong className="font-mono-tabular text-[#1E9E60]">{currentStockInBranch} Btls</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#34D186]/15 border border-[#34D186] rounded-xl px-3 py-1.5 text-right shrink-0">
                    <span className="text-[10px] font-bold text-[#1E9E60] uppercase block">Product Status</span>
                    <span className="text-xs font-montserrat font-black text-[#0A006E]">
                      {currentStockInBranch > 0 ? 'Active in Stock' : 'Pending Activation'}
                    </span>
                  </div>
                </div>

                {/* Step 3: Quantity to Activate & Real-time Asset Increase */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-6 space-y-2">
                    <label className="text-xs font-montserrat font-bold text-slate-800 block">
                      Quantity to Activate on Stock (Bottles / Units) *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-32 px-3 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono-tabular font-black text-lg text-[#0A006E] text-center focus:border-[#0A006E] focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuantity(6)}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-montserrat font-bold cursor-pointer"
                        >
                          6 Btls
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantity(12)}
                          className="px-2.5 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-lg text-xs font-montserrat font-bold cursor-pointer border border-[#0A006E]/30"
                        >
                          12 (1 Case)
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantity(24)}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-montserrat font-bold cursor-pointer"
                        >
                          24 (2 Cases)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-6 bg-[#0A006E] text-white rounded-xl p-3.5 flex items-center justify-between shadow-md">
                    <div>
                      <span className="text-[10px] font-montserrat font-bold text-[#FFDE00] uppercase tracking-wider block">
                        Branch Stock Asset Value Increase
                      </span>
                      <div className="text-xl sm:text-2xl font-montserrat font-black text-white font-mono-tabular mt-0.5">
                        +{formatKes(assetIncrease)}
                      </div>
                      <span className="text-[10px] text-slate-300">
                        {quantity} bottles × {formatKes(unitCost)} unit cost
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isActivating}
                      onClick={handleActivateStock}
                      className="px-4 py-3 bg-[#FFDE00] hover:bg-amber-400 active:scale-95 text-[#0A006E] rounded-xl font-montserrat font-black text-xs sm:text-sm shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 text-[#0A006E]" />
                      <span>{isActivating ? 'Activating...' : 'Activate Stock'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Log of Recently Activated Items */}
            {recentActivations.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-montserrat font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1E9E60]" />
                    Recently Activated in {targetBranch?.name}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Session Register</span>
                </div>

                <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                  {recentActivations.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-montserrat font-bold text-slate-900 block truncate max-w-xs sm:max-w-md">
                          {item.productName}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Activated {item.quantity} bottles at {item.time}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-montserrat font-bold text-[#1E9E60] font-mono-tabular block">
                          +{formatKes(item.costIncrease)}
                        </span>
                        <span className="text-[10px] text-slate-400">Branch Asset Added</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-100 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              VAAIRO Stock Governance · Real-Time Branch Asset Activation
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#0A006E] text-white hover:bg-[#060046] rounded-xl font-montserrat font-bold text-xs cursor-pointer transition"
            >
              Done &amp; Return
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Barcode Scanner Camera Modal */}
      {isCameraScannerOpen && (
        <PhoneBarcodeScannerModal
          isOpen={isCameraScannerOpen}
          onClose={() => setIsCameraScannerOpen(false)}
          onBarcodeScanned={handleCameraBarcodeScanned}
        />
      )}
    </>
  );
};
