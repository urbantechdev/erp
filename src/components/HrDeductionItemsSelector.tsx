import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  DeductionCalcMode,
  DeductionCategory,
  HrDeductionCatalogItem,
  StaffDeductionItem,
} from '../types';
import {
  DEDUCTION_CATEGORIES,
  STANDARD_HR_DEDUCTION_CATALOG,
  buildDefaultStatutoryDeductionItems,
  createDeductionItemFromCatalog,
  recalculateDeductionItemsForSalary,
  summarizeDeductionItems,
} from '../utils/hrDeductions';

export interface HrDeductionItemsSelectorProps {
  basicSalary: number;
  items: StaffDeductionItem[];
  customCatalog?: HrDeductionCatalogItem[];
  onChange: (
    nextItems: StaffDeductionItem[],
    totalDeductionsKes: number,
    breakdownText: string
  ) => void;
  onSaveCustomCatalogItem?: (
    draft: Omit<HrDeductionCatalogItem, 'id' | 'createdAt'>
  ) => Promise<void> | void;
  compact?: boolean;
}

const CUSTOM_NEW_VALUE = '__CUSTOM_NEW_DEDUCTION__';

export const HrDeductionItemsSelector: React.FC<HrDeductionItemsSelectorProps> = ({
  basicSalary,
  items,
  customCatalog = [],
  onChange,
  onSaveCustomCatalogItem,
  compact = false,
}) => {
  const fullCatalog = useMemo<HrDeductionCatalogItem[]>(() => {
    const existingIds = new Set(STANDARD_HR_DEDUCTION_CATALOG.map((c) => c.id));
    const extras = customCatalog.filter((c) => !existingIds.has(c.id));
    return [...STANDARD_HR_DEDUCTION_CATALOG, ...extras];
  }, [customCatalog]);

  const groupedCatalog = useMemo(() => {
    return DEDUCTION_CATEGORIES.map((category) => ({
      category,
      entries: fullCatalog.filter((item) => item.category === category),
    })).filter((g) => g.entries.length > 0);
  }, [fullCatalog]);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(
    STANDARD_HR_DEDUCTION_CATALOG.find((c) => c.code === 'HELB')?.id ||
      STANDARD_HR_DEDUCTION_CATALOG[0].id
  );
  const [calcMode, setCalcMode] = useState<DeductionCalcMode>('FIXED');
  const [inputValue, setInputValue] = useState<number>(2500);
  const [frequency, setFrequency] = useState<'Recurring Monthly' | 'One-Off'>('Recurring Monthly');
  const [referenceNote, setReferenceNote] = useState<string>('');

  // Custom item fields when "+ Custom Deduction Item..." is chosen
  const [customName, setCustomName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<DeductionCategory>('Custom');
  const [saveToCatalog, setSaveToCatalog] = useState<boolean>(true);

  const selectedPreset = useMemo(
    () =>
      selectedCatalogId === CUSTOM_NEW_VALUE
        ? null
        : fullCatalog.find((c) => c.id === selectedCatalogId) || null,
    [fullCatalog, selectedCatalogId]
  );

  const commitNextItems = (rawItems: StaffDeductionItem[]) => {
    const recalculated = recalculateDeductionItemsForSalary(rawItems, basicSalary);
    const { totalDeductionsKes, breakdownText } = summarizeDeductionItems(recalculated);
    onChange(recalculated, totalDeductionsKes, breakdownText);
  };

  const handleSelectCatalogChange = (nextId: string) => {
    setSelectedCatalogId(nextId);
    if (nextId === CUSTOM_NEW_VALUE) {
      setCalcMode('FIXED');
      setInputValue(1500);
      setFrequency('Recurring Monthly');
      return;
    }
    const preset = fullCatalog.find((c) => c.id === nextId);
    if (preset) {
      setCalcMode(preset.defaultCalcMode);
      setInputValue(preset.defaultValue);
      setFrequency(preset.defaultFrequency);
    }
  };

  const handleAddSelectedDeduction = async () => {
    let targetPreset: HrDeductionCatalogItem;

    if (selectedCatalogId === CUSTOM_NEW_VALUE) {
      const trimmed = customName.trim();
      if (!trimmed) return;
      const generatedCode = trimmed
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'CUSTOM_ITEM';

      targetPreset = {
        id: `ded-custom-${Date.now()}`,
        code: generatedCode,
        name: trimmed,
        category: customCategory,
        defaultCalcMode: calcMode === 'STATUTORY_AUTO' ? 'FIXED' : calcMode,
        defaultValue: Number(inputValue) || 0,
        defaultFrequency: frequency,
        kraP10Mapping: 'POST_TAX',
        isSystemPreset: false,
        createdAt: new Date().toISOString(),
      };

      if (saveToCatalog && onSaveCustomCatalogItem) {
        await onSaveCustomCatalogItem({
          code: targetPreset.code,
          name: targetPreset.name,
          category: targetPreset.category,
          defaultCalcMode: targetPreset.defaultCalcMode,
          defaultValue: targetPreset.defaultValue,
          defaultFrequency: targetPreset.defaultFrequency,
          kraP10Mapping: 'POST_TAX',
          isSystemPreset: false,
        });
      }
    } else {
      if (!selectedPreset) return;
      targetPreset = selectedPreset;
    }

    const createdItem = createDeductionItemFromCatalog(targetPreset, basicSalary, {
      calcMode,
      rateOrValue: Number(inputValue) || 0,
      frequency,
      referenceNote,
    });

    // If this is one of the 4 singleton statutory items (PAYE, SHIF, NSSF, AHL), replace existing row rather than duplicating
    const singletonStatutory = ['PAYE', 'SHIF', 'NSSF', 'AHL'].includes(createdItem.code);
    const nextList = singletonStatutory
      ? [
          ...items.filter((existing) => existing.code !== createdItem.code),
          createdItem,
        ]
      : [...items, createdItem];

    commitNextItems(nextList);
    setReferenceNote('');
    if (selectedCatalogId === CUSTOM_NEW_VALUE) {
      setCustomName('');
    }
  };

  const handleQuickAddByCode = (code: string) => {
    const preset = fullCatalog.find((c) => c.code === code);
    if (!preset) return;
    setSelectedCatalogId(preset.id);
    setCalcMode(preset.defaultCalcMode);
    setInputValue(preset.defaultValue);
    setFrequency(preset.defaultFrequency);

    // If already added and singleton statutory, refresh it; otherwise append immediately
    const createdItem = createDeductionItemFromCatalog(preset, basicSalary);
    const singletonStatutory = ['PAYE', 'SHIF', 'NSSF', 'AHL'].includes(preset.code);
    if (singletonStatutory && items.some((i) => i.code === preset.code)) {
      commitNextItems(
        items.map((i) => (i.code === preset.code ? createdItem : i))
      );
      return;
    }
    commitNextItems([...items, createdItem]);
  };

  const handleApplyKraStatutoryPack = () => {
    const freshStatutory = buildDefaultStatutoryDeductionItems(basicSalary);
    const nonStatutory = items.filter(
      (i) => !['PAYE', 'SHIF', 'NSSF', 'AHL'].includes(i.code)
    );
    commitNextItems([...freshStatutory, ...nonStatutory]);
  };

  const handleUpdateRowAmount = (rowId: string, nextAmountKes: number) => {
    const cleanAmt = Math.max(0, Math.round(Number(nextAmountKes) || 0));
    const updated = items.map((item) =>
      item.id === rowId
        ? {
            ...item,
            calcMode: 'FIXED' as const,
            rateOrValue: cleanAmt,
            amountKes: cleanAmt,
          }
        : item
    );
    commitNextItems(updated);
  };

  const handleRestoreStatutoryAuto = (rowId: string) => {
    const updated = items.map((item) =>
      item.id === rowId
        ? {
            ...item,
            calcMode: 'STATUTORY_AUTO' as const,
          }
        : item
    );
    commitNextItems(updated);
  };

  const handleRemoveRow = (rowId: string) => {
    commitNextItems(items.filter((item) => item.id !== rowId));
  };

  const totalSelectedKes = useMemo(
    () => items.reduce((sum, i) => sum + Math.max(0, Math.round(i.amountKes || 0)), 0),
    [items]
  );

  const previewAddAmountKes = useMemo(() => {
    if (calcMode === 'STATUTORY_AUTO' && selectedPreset) {
      const sample = createDeductionItemFromCatalog(selectedPreset, basicSalary, {
        calcMode: 'STATUTORY_AUTO',
      });
      return sample.amountKes;
    }
    if (calcMode === 'PERCENTAGE') {
      return Math.max(0, Math.round(((Number(basicSalary) || 0) * (Number(inputValue) || 0)) / 100));
    }
    return Math.max(0, Math.round(Number(inputValue) || 0));
  }, [calcMode, selectedPreset, basicSalary, inputValue]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <div className="text-xs font-montserrat font-black text-[#0A006E]">
            Select &amp; Add Employee Deduction Items
          </div>
          <p className="text-[11px] text-slate-500">
            Choose statutory or voluntary HR deductions below and add them to compute net pay.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleApplyKraStatutoryPack}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#FFDE00] text-[#0A006E] border border-slate-300 rounded-xl text-[11px] font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <Calculator className="w-3.5 h-3.5 text-[#0A006E]" />
            Auto-Fill KRA Statutory
          </button>
          <div className="text-right pl-2 border-l border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">
              Total Deductions ({items.length})
            </div>
            <div className="text-sm font-montserrat font-black text-rose-600 font-mono-tabular tabular-nums">
              -KES {totalSelectedKes.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Quick-Add Common HR Deduction Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-montserrat font-bold text-slate-500 uppercase mr-1">
          Quick Add:
        </span>
        {[
          { code: 'HELB', label: '+ HELB Loan' },
          { code: 'SACCO_SAVINGS', label: '+ SACCO Shares' },
          { code: 'SALARY_ADVANCE', label: '+ Salary Advance' },
          { code: 'STAFF_LOAN', label: '+ Staff Loan' },
          { code: 'VOLUNTARY_PENSION', label: '+ Pension Top-Up' },
          { code: 'STAFF_WELFARE', label: '+ Welfare' },
          { code: 'SHORTAGE_RECOVERY', label: '+ Till Shortage' },
        ].map((chip) => (
          <button
            key={chip.code}
            type="button"
            onClick={() => handleQuickAddByCode(chip.code)}
            className="px-2.5 py-1 bg-slate-50 hover:bg-[#0A006E] hover:text-[#FFDE00] text-slate-700 border border-slate-200 rounded-lg text-[11px] font-montserrat font-bold cursor-pointer transition whitespace-nowrap"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Selector & Add Form Row */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
        <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-12'} gap-2.5 text-xs`}>
          {/* 1. Deduction Item Selector */}
          <div className={compact ? 'sm:col-span-2' : 'sm:col-span-5'}>
            <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
              Deduction Item
            </label>
            <select
              value={selectedCatalogId}
              onChange={(e) => handleSelectCatalogChange(e.target.value)}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-montserrat font-bold text-[#0A006E] text-xs"
            >
              {groupedCatalog.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="New / Custom Deduction">
                <option value={CUSTOM_NEW_VALUE}>+ Custom Deduction Item...</option>
              </optgroup>
            </select>
          </div>

          {/* 2. Calculation Basis */}
          <div className={compact ? '' : 'sm:col-span-2'}>
            <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
              Basis
            </label>
            <select
              value={calcMode}
              onChange={(e) => setCalcMode(e.target.value as DeductionCalcMode)}
              className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 text-xs"
            >
              <option value="FIXED">Fixed (KES)</option>
              <option value="PERCENTAGE">% of Basic</option>
              {selectedPreset &&
                ['PAYE', 'SHIF', 'NSSF', 'AHL'].includes(selectedPreset.code) && (
                  <option value="STATUTORY_AUTO">KRA Formula</option>
                )}
            </select>
          </div>

          {/* 3. Amount or % Value */}
          <div className={compact ? '' : 'sm:col-span-2'}>
            <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
              {calcMode === 'PERCENTAGE'
                ? 'Rate (%)'
                : calcMode === 'STATUTORY_AUTO'
                ? 'Auto (KES)'
                : 'Amount (KES)'}
            </label>
            {calcMode === 'STATUTORY_AUTO' ? (
              <div className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono-tabular tabular-nums font-bold text-slate-700 text-xs">
                {previewAddAmountKes.toLocaleString()}
              </div>
            ) : (
              <input
                type="number"
                min={0}
                step={calcMode === 'PERCENTAGE' ? '0.5' : '50'}
                value={inputValue}
                onChange={(e) => setInputValue(Number(e.target.value))}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono-tabular tabular-nums font-bold text-slate-900 text-xs"
              />
            )}
          </div>

          {/* 4. Cadence / Frequency */}
          <div className={compact ? 'sm:col-span-2' : 'sm:col-span-3'}>
            <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
              Schedule
            </label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as 'Recurring Monthly' | 'One-Off')
              }
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 text-xs"
            >
              <option value="Recurring Monthly">Recurring Monthly</option>
              <option value="One-Off">One-Off (This Run)</option>
            </select>
          </div>
        </div>

        {/* Custom Item Fields if Custom Selected */}
        {selectedCatalogId === CUSTOM_NEW_VALUE && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1 border-t border-slate-200 text-xs">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                Custom Deduction Name *
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Chama Contribution, Staff Meal Plan, Airtime Recovery"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as DeductionCategory)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              >
                {DEDUCTION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {onSaveCustomCatalogItem && (
              <div className="sm:col-span-3 flex items-end pb-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveToCatalog}
                    onChange={(e) => setSaveToCatalog(e.target.checked)}
                    className="rounded border-slate-300 text-[#0A006E]"
                  />
                  Save to HR Catalog
                </label>
              </div>
            )}
          </div>
        )}

        {/* Reference Note + Add Button Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <input
            type="text"
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            placeholder="Optional ref / account / installment note (e.g. HELB #4491, Month 2 of 6)"
            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
          />
          <button
            type="button"
            disabled={selectedCatalogId === CUSTOM_NEW_VALUE && !customName.trim()}
            onClick={handleAddSelectedDeduction}
            className="px-4 py-2 bg-[#0A006E] hover:bg-[#12009E] disabled:opacity-50 text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#FFDE00]" />
            Add Deduction (KES {previewAddAmountKes.toLocaleString()})
          </button>
        </div>
      </div>

      {/* Selected Deduction Items High-Density Table */}
      {items.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-5 text-center space-y-2">
          <div className="text-xs font-montserrat font-bold text-slate-700">
            No Deduction Items Selected for This Employee
          </div>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            Select a deduction item above and click <strong>Add Deduction</strong>, or load standard Kenyan statutory deductions automatically.
          </p>
          <button
            type="button"
            onClick={handleApplyKraStatutoryPack}
            className="px-3.5 py-1.5 bg-[#FFDE00] hover:bg-amber-400 border border-[#0A006E] text-[#0A006E] rounded-lg text-xs font-montserrat font-black inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            Add KRA Statutory Deductions
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-montserrat">
                <th className="py-2 px-3 font-bold">Selected Deduction Item</th>
                <th className="py-2 px-3 font-bold">Basis &amp; Schedule</th>
                <th className="py-2 px-3 font-bold text-right">Amount (KES)</th>
                <th className="py-2 px-2.5 font-bold text-right w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((item) => {
                const isStatutoryCode = ['PAYE', 'SHIF', 'NSSF', 'AHL'].includes(item.code);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3">
                      <div className="font-montserrat font-bold text-slate-900 leading-snug">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.category}
                        {item.referenceNote ? ` · Ref: ${item.referenceNote}` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-700">
                        {item.calcMode === 'STATUTORY_AUTO'
                          ? 'KRA Statutory Auto'
                          : item.calcMode === 'PERCENTAGE'
                          ? `${item.rateOrValue}% of Basic`
                          : 'Fixed Amount'}
                      </div>
                      <div className="text-slate-500">{item.frequency}</div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {isStatutoryCode && item.calcMode !== 'STATUTORY_AUTO' && (
                          <button
                            type="button"
                            onClick={() => handleRestoreStatutoryAuto(item.id)}
                            title="Restore automatic KRA statutory calculation"
                            className="p-1 text-slate-400 hover:text-[#0A006E] rounded cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                        <input
                          type="number"
                          min={0}
                          value={Math.round(item.amountKes)}
                          onChange={(e) => handleUpdateRowAmount(item.id, Number(e.target.value))}
                          className="w-28 px-2 py-1 text-right bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0A006E] rounded-lg font-mono-tabular tabular-nums font-bold text-rose-700 text-xs outline-none"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(item.id)}
                        title={`Remove ${item.name}`}
                        aria-label={`Remove ${item.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
