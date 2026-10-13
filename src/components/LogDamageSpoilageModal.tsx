import React, { useState, useMemo } from 'react';
import { X, PackageX, AlertOctagon, CheckCircle2, ShieldAlert, Sparkles, Building2 } from 'lucide-react';
import { Product, Branch, StaffMember, DamageSpoilageIncident } from '../types';
import { formatKes } from '../erpUtils';

interface LogDamageSpoilageModalProps {
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  preselectedProduct?: Product | null;
  initialProduct?: Product | null;
  onSaveIncident?: (incident: DamageSpoilageIncident) => Promise<void>;
  onLogIncident?: (incident: DamageSpoilageIncident) => Promise<void>;
  onClose: () => void;
}

const COMMON_DAMAGE_REASONS = [
  'Broken glass bottle during warehouse offloading',
  'Damaged / torn KRA Digital Excise Stamp',
  'Transit pallet crush / road transit impact',
  'Leaking bottle neck / compromised seal',
  'Forklift impact on carton case',
  'Carton moisture rupture / collapse',
];

const COMMON_SPOILAGE_REASONS = [
  'Curdled dairy content (Cream Liqueur emulsion failure)',
  'Cork taint / 2,4,6-Trichloroanisole (TCA) defect',
  'Excessive temperature oxidation / heat exposure',
  'Sediment precipitation & cloudiness in wine',
  'Expired product batch / passed shelf-life date',
  'Off-flavor / contaminated liquid batch',
];

export const LogDamageSpoilageModal: React.FC<LogDamageSpoilageModalProps> = ({
  currentUser,
  products,
  branches,
  preselectedProduct = null,
  initialProduct = null,
  onSaveIncident,
  onLogIncident,
  onClose,
}) => {
  const effectiveProduct = preselectedProduct || initialProduct;
  const [incidentType, setIncidentType] = useState<'DAMAGED' | 'SPOILED'>('DAMAGED');
  const [selectedProductId, setSelectedProductId] = useState<string>(effectiveProduct?.id || products[0]?.id || '');
  const [quantityBottles, setQuantityBottles] = useState<number>(1);
  const [targetBranchId, setTargetBranchId] = useState<string>(currentUser.branchId || branches[0]?.id || '');
  const [customReason, setCustomReason] = useState<string>('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>(COMMON_DAMAGE_REASONS[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchSku, setSearchSku] = useState('');

  // Selected Product details
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === targetBranchId) || branches[0],
    [branches, targetBranchId]
  );

  const unitCost = selectedProduct?.warehouseCostKes ?? selectedProduct?.baseLandedCost ?? Math.round((selectedProduct?.retailPriceKes || 3000) * 0.72);
  const calculatedLossValue = quantityBottles * unitCost;

  const filteredProductOptions = useMemo(() => {
    if (!searchSku.trim()) return products.slice(0, 40);
    const q = searchSku.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 40);
  }, [products, searchSku]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantityBottles <= 0) return;

    setIsSubmitting(true);
    const finalReason = customReason.trim() ? customReason.trim() : selectedPresetReason;

    const incident: DamageSpoilageIncident = {
      id: `inc-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      incidentType,
      quantityBottles: Number(quantityBottles),
      reason: finalReason,
      lossValueKes: calculatedLossValue,
      branchId: selectedBranch?.id || '',
      branchName: selectedBranch?.name || 'Main Depot',
      reportedBy: currentUser.name,
      reportedByRole: currentUser.role,
      status: 'QUARANTINED',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      const saveFn = onSaveIncident || onLogIncident;
      if (saveFn) {
        await saveFn(incident);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-[#0A006E]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-lg w-full h-full sm:h-auto overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#0A006E] p-5 text-white flex items-center justify-between relative overflow-hidden">
          <div className="silent-scanner-beam" />
          <div className="flex items-center gap-3 relative z-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
              incidentType === 'DAMAGED' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-[#0A006E]'
            }`}>
              <PackageX className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#FFDE00]">
                Inventory Loss & Quarantine Action
              </span>
              <h3 className="text-base font-montserrat font-black italic">
                Log Damaged or Spoiled Inventory
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Incident Type Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setIncidentType('DAMAGED');
                setSelectedPresetReason(COMMON_DAMAGE_REASONS[0]);
              }}
              className={`p-3 rounded-2xl border-2 font-montserrat font-black text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                incidentType === 'DAMAGED'
                  ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="text-sm">💥 Damaged Stock</span>
              <span className="text-[10px] font-normal text-slate-500">Broken bottles, seals, stamps</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIncidentType('SPOILED');
                setSelectedPresetReason(COMMON_SPOILAGE_REASONS[0]);
              }}
              className={`p-3 rounded-2xl border-2 font-montserrat font-black text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                incidentType === 'SPOILED'
                  ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="text-sm">⚠️ Spoiled Stock</span>
              <span className="text-[10px] font-normal text-slate-500">Curdled cream, corked, oxidized</span>
            </button>
          </div>

          {/* Product Selector */}
          <div className="space-y-1.5">
            <label className="font-montserrat font-black text-slate-800">
              Affected Liquor SKU & Item:
            </label>
            <input
              type="text"
              placeholder="Search SKU or product name..."
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs mb-1"
            />
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
            >
              {filteredProductOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name} ({p.volumeMl}ml) · On Hand: {p.totalBottles ?? 0} Btls
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-montserrat font-black text-slate-800">
                Quantity (Bottles):
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct?.totalBottles || 500}
                value={quantityBottles}
                onChange={(e) => setQuantityBottles(Math.max(1, Number(e.target.value)))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono-tabular font-black text-base text-slate-900"
              />
              <span className="text-[10px] text-slate-400">
                Available: {selectedProduct?.totalBottles ?? 0} bottles
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-montserrat font-black text-slate-800">
                Branch / Warehouse Depot:
              </label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.regionName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label className="font-montserrat font-black text-slate-800">
              Primary Cause / Defect Classification:
            </label>
            <select
              value={selectedPresetReason}
              onChange={(e) => setSelectedPresetReason(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
            >
              {(incidentType === 'DAMAGED' ? COMMON_DAMAGE_REASONS : COMMON_SPOILAGE_REASONS).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Or enter custom specific incident reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs mt-1"
            />
          </div>

          {/* Loss Valuation & Accounting Impact Notice */}
          <div className="bg-[#F0F2F0] p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-600">Calculated Write-Off Loss (At Cost):</span>
              <span className="font-mono-tabular font-black text-rose-700 text-base">
                {formatKes(calculatedLossValue)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Unit Cost: <strong>{formatKes(unitCost)}</strong> · Quarantined stock is immediately deducted from active saleable bottles in Retail POS & Wholesale POS, and recorded in the Accountant's live P&L loss ledger.
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1">
            <label className="font-montserrat font-bold text-slate-700 text-[11px]">
              Inspection & Auditor Notes (Optional):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Carrier claim filed with Bollore Logistics, driver signed incident slip..."
              className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-montserrat font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || quantityBottles <= 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-montserrat font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition disabled:opacity-50"
            >
              <PackageX className="w-4 h-4 text-white" />
              Quarantine & Deduct {quantityBottles} Bottles ({formatKes(calculatedLossValue)})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
