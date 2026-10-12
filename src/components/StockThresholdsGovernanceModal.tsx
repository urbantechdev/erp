import React, { useState } from 'react';
import { X, Sliders, ShieldCheck, AlertTriangle, PackageX, Sparkles, Save } from 'lucide-react';
import { InventoryThresholdSettings } from '../types';

interface StockThresholdsGovernanceModalProps {
  currentSettings: InventoryThresholdSettings;
  onSaveSettings: (newSettings: InventoryThresholdSettings) => void;
  onClose: () => void;
}

export const StockThresholdsGovernanceModal: React.FC<StockThresholdsGovernanceModalProps> = ({
  currentSettings,
  onSaveSettings,
  onClose,
}) => {
  const [deadStockDays, setDeadStockDays] = useState<number>(currentSettings.defaultDeadStockDays);
  const [expiryWarningDays, setExpiryWarningDays] = useState<number>(currentSettings.defaultExpiryWarningDays);
  const [maxDamagePct, setMaxDamagePct] = useState<number>(currentSettings.defaultMaxDamagePct);
  const [maxSpoilagePct, setMaxSpoilagePct] = useState<number>(currentSettings.defaultMaxSpoilagePct);
  const [minSafetyStock, setMinSafetyStock] = useState<number>(currentSettings.defaultMinSafetyStock);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onSaveSettings({
      defaultDeadStockDays: Number(deadStockDays),
      defaultExpiryWarningDays: Number(expiryWarningDays),
      defaultMaxDamagePct: Number(maxDamagePct),
      defaultMaxSpoilagePct: Number(maxSpoilagePct),
      defaultMinSafetyStock: Number(minSafetyStock),
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A006E]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A006E] p-5 text-white flex items-center justify-between relative overflow-hidden">
          <div className="silent-scanner-beam" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md">
              <Sliders className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#FFDE00]">
                Inventory Manager Control Panel
              </span>
              <h3 className="text-base font-montserrat font-black italic">
                Stock Health & Threshold Governance
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
          <p className="text-slate-600">
            Configure system-wide thresholds for identifying dead inventory, batch expiry warnings, damaged bottle limits, and spoilage allowances.
          </p>

          {/* 1. Dead Stock Threshold */}
          <div className="bg-[#F0F2F0] p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-montserrat font-black text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Dead Stock Inactivity Threshold (Days)
              </label>
              <span className="font-mono-tabular font-black text-[#0A006E] text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                {deadStockDays} Days
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Number of days with zero sales or stock movements before a liquor SKU is flagged as Dead Stock / Stagnant Capital in the inventory and accounting ledger.
            </p>
            <input
              type="range"
              min="30"
              max="180"
              step="15"
              value={deadStockDays}
              onChange={(e) => setDeadStockDays(Number(e.target.value))}
              className="w-full accent-[#0A006E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>30 Days (Fast)</span>
              <span>60 Days</span>
              <span>90 Days (Standard)</span>
              <span>120 Days</span>
              <span>180 Days</span>
            </div>
          </div>

          {/* 2. Expiry Warning Threshold */}
          <div className="bg-[#F0F2F0] p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-montserrat font-black text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Batch Expiry Alert Threshold (Days)
              </label>
              <span className="font-mono-tabular font-black text-[#0A006E] text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                {expiryWarningDays} Days
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Days prior to batch expiry to trigger warning banners (vital for cream liqueurs like Baileys/Amarula, wines, ciders, and beers).
            </p>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={expiryWarningDays}
              onChange={(e) => setExpiryWarningDays(Number(e.target.value))}
              className="w-full accent-[#0A006E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>15 Days</span>
              <span>30 Days</span>
              <span>60 Days (Recommended)</span>
              <span>90 Days</span>
              <span>120 Days</span>
            </div>
          </div>

          {/* 3. Damage & Spoilage Tolerance Percentages */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F0F2F0] p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
              <label className="font-montserrat font-bold text-slate-800 text-[11px] flex items-center gap-1">
                <PackageX className="w-3.5 h-3.5 text-rose-600" />
                Max Damage Tolerance (%)
              </label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={maxDamagePct}
                onChange={(e) => setMaxDamagePct(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900"
              />
              <p className="text-[10px] text-slate-400">
                Alert triggered if broken bottles exceed this % of stock.
              </p>
            </div>

            <div className="bg-[#F0F2F0] p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
              <label className="font-montserrat font-bold text-slate-800 text-[11px] flex items-center gap-1">
                <PackageX className="w-3.5 h-3.5 text-amber-600" />
                Max Spoilage Tolerance (%)
              </label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={maxSpoilagePct}
                onChange={(e) => setMaxSpoilagePct(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900"
              />
              <p className="text-[10px] text-slate-400">
                Alert triggered if curdled/corked items exceed this %.
              </p>
            </div>
          </div>

          {/* 4. Safety Stock Reorder Buffer */}
          <div className="bg-[#F0F2F0] p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
            <label className="font-montserrat font-bold text-slate-800 text-[11px]">
              Default Safety Reorder Buffer (Bottles)
            </label>
            <input
              type="number"
              min="6"
              max="240"
              step="6"
              value={minSafetyStock}
              onChange={(e) => setMinSafetyStock(Number(e.target.value))}
              className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900"
            />
            <p className="text-[10px] text-slate-400">
              Minimum buffer before triggering low-stock reorder warnings.
            </p>
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
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition"
            >
              <Save className="w-4 h-4 text-[#FFDE00]" />
              Save Governance Thresholds
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
