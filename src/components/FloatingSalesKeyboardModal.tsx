/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Keyboard,
  X,
  Delete,
  Space,
  Check,
  ArrowUp,
  Sparkles,
  Hash,
  RotateCcw,
  Banknote,
  PhoneCall,
  Search,
  Zap,
  Package,
  Plus,
  ShoppingCart,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Product } from '../types';
import { formatKes } from '../erpUtils';
import { playPosBeep, triggerScanHaptic } from '../utils/audioBeep';

export interface FloatingSalesKeyboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  onDeleteChar?: () => void;
  onSubmit?: () => void;
  initialMode?: 'qwerty' | 'numeric';
  activeFieldName?: string;
  targetElement?: HTMLInputElement | HTMLTextAreaElement | null;
  products?: Product[];
  onSelectProduct?: (product: Product, unitMode?: 'Bottle' | 'Case') => void;
  onAutofillText?: (text: string) => void;
}

export const FloatingSalesKeyboardModal: React.FC<FloatingSalesKeyboardModalProps> = ({
  isOpen,
  onClose,
  onInsertText,
  onDeleteChar,
  onSubmit,
  initialMode = 'qwerty',
  activeFieldName,
  targetElement,
  products = [],
  onSelectProduct,
  onAutofillText,
}) => {
  const [mode, setMode] = useState<'qwerty' | 'numeric'>(initialMode);
  const [isUpperCase, setIsUpperCase] = useState(false);
  const [activeInputValue, setActiveInputValue] = useState<string>('');
  const [autofillQuery, setAutofillQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [isAutofillExpanded, setIsAutofillExpanded] = useState<boolean>(true);
  const internalTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Sync mode whenever initialMode changes
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Keep track of the active target input element and current value
  useEffect(() => {
    if (targetElement) {
      internalTargetRef.current = targetElement;
      setActiveInputValue(targetElement.value || '');
    }
  }, [targetElement]);

  // Sync active input value whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const input = active as HTMLInputElement | HTMLTextAreaElement;
        internalTargetRef.current = input;
        setActiveInputValue(input.value || '');
      } else if (targetElement) {
        setActiveInputValue(targetElement.value || '');
      }
    }
  }, [isOpen, targetElement]);

  const getTargetInput = (): HTMLInputElement | HTMLTextAreaElement | null => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const input = active as HTMLInputElement | HTMLTextAreaElement;
      internalTargetRef.current = input;
      return input;
    }
    if (targetElement && document.body.contains(targetElement)) {
      return targetElement;
    }
    if (internalTargetRef.current && document.body.contains(internalTargetRef.current)) {
      return internalTargetRef.current;
    }
    return null;
  };

  const dispatchNativeInput = (
    el: HTMLInputElement | HTMLTextAreaElement,
    newVal: string,
    cursorOffset: number
  ) => {
    const isInput = el.tagName === 'INPUT';
    const prototype = isInput
      ? window.HTMLInputElement.prototype
      : window.HTMLTextAreaElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(el, newVal);
    } else {
      el.value = newVal;
    }

    try {
      el.focus();
      el.setSelectionRange(cursorOffset, cursorOffset);
    } catch (_) {
      // Ignore selection errors on non-text input types
    }

    // Trigger synthetic React change & input events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    setActiveInputValue(newVal);
  };

  const handleKeyPress = (char: string) => {
    playPosBeep('click');
    triggerScanHaptic();
    const val = isUpperCase ? char.toUpperCase() : char.toLowerCase();

    const inputEl = getTargetInput();
    if (inputEl) {
      const start = inputEl.selectionStart ?? inputEl.value.length;
      const end = inputEl.selectionEnd ?? inputEl.value.length;
      const currentVal = inputEl.value || '';
      const newVal = currentVal.slice(0, start) + val + currentVal.slice(end);
      const newCursor = start + val.length;

      dispatchNativeInput(inputEl, newVal, newCursor);
    }

    if (onInsertText) {
      onInsertText(val);
    }
  };

  const handleBackspace = () => {
    playPosBeep('error');
    triggerScanHaptic();

    const inputEl = getTargetInput();
    if (inputEl) {
      const start = inputEl.selectionStart ?? inputEl.value.length;
      const end = inputEl.selectionEnd ?? inputEl.value.length;
      const currentVal = inputEl.value || '';

      if (start > 0 || end > start) {
        const delStart = end > start ? start : Math.max(0, start - 1);
        const newVal = currentVal.slice(0, delStart) + currentVal.slice(end);
        dispatchNativeInput(inputEl, newVal, delStart);
      }
    }

    if (onDeleteChar) {
      onDeleteChar();
    }
  };

  const handleClearAll = () => {
    playPosBeep('error');
    triggerScanHaptic();

    const inputEl = getTargetInput();
    if (inputEl) {
      dispatchNativeInput(inputEl, '', 0);
    }
    setAutofillQuery('');
  };

  const handleSpace = () => {
    handleKeyPress(' ');
  };

  const handleEnter = () => {
    playPosBeep('success');
    triggerScanHaptic();

    const inputEl = getTargetInput();
    if (inputEl) {
      const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
      const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true });
      inputEl.dispatchEvent(enterDown);
      inputEl.dispatchEvent(enterUp);
    }

    if (onSubmit) {
      onSubmit();
    } else {
      onClose();
    }
  };

  // Product Autofill Action: Autofills product name into active field
  const handleAutofillProduct = (product: Product) => {
    playPosBeep('success');
    triggerScanHaptic();

    const inputEl = getTargetInput();
    if (inputEl) {
      dispatchNativeInput(inputEl, product.name, product.name.length);
    }

    if (onAutofillText) {
      onAutofillText(product.name);
    }
  };

  // Direct quick-add to sales cart from the autofill strip
  const handleQuickAddProduct = (
    product: Product,
    unitMode: 'Bottle' | 'Case',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    playPosBeep('success');
    triggerScanHaptic();

    if (onSelectProduct) {
      onSelectProduct(product, unitMode);
    }
  };

  // Search query for autofill matches: either manually typed in autofill search or derived from active input
  const effectiveSearchQuery = (autofillQuery || activeInputValue || '').trim().toLowerCase();

  // Filtered autofill products matching search query and category
  const autofillProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    let pool = products;
    if (selectedCategoryFilter !== 'ALL') {
      pool = pool.filter(
        (p) =>
          p.subCategory === selectedCategoryFilter ||
          (p.category && p.category.toLowerCase().includes(selectedCategoryFilter.toLowerCase()))
      );
    }

    if (!effectiveSearchQuery) {
      // Show top 8 quick recommendations
      return pool.slice(0, 8);
    }

    return pool
      .filter((p) => {
        const matchName = p.name.toLowerCase().includes(effectiveSearchQuery);
        const matchBrand = (p.brand || '').toLowerCase().includes(effectiveSearchQuery);
        const matchSub = (p.subCategory || '').toLowerCase().includes(effectiveSearchQuery);
        const matchCat = (p.category || '').toLowerCase().includes(effectiveSearchQuery);
        const matchSku = p.sku.toLowerCase().includes(effectiveSearchQuery);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(effectiveSearchQuery);
        return matchName || matchBrand || matchSub || matchCat || matchSku || matchBarcode;
      })
      .slice(0, 10);
  }, [products, effectiveSearchQuery, selectedCategoryFilter]);

  // Categories for quick autofill tabs
  const autofillCategories = ['ALL', 'Whisky', 'Gin', 'Vodka', 'Wine', 'Beer', 'Rum'];

  const qwertyNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  const qwertyRow1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const qwertyRow2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];
  const qwertyRow3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '@', '/'];

  const numericKeys = [
    ['7', '8', '9', '⌫'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '-'],
    ['0', '00', '.', 'Clear'],
  ];

  const quickKesPresets = ['100', '200', '500', '1000', '2000', '5000'];
  const quickPrefixes = ['+254', '07', '01'];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 p-1 sm:p-2.5 flex justify-center pointer-events-none transition-none"
      style={{ animationDuration: '0s' }}
    >
      <div className="floating-sales-keyboard-container bg-[#E5E7EB] border-t-2 border-slate-300 shadow-[0_-12px_45px_rgba(0,0,0,0.25)] rounded-t-3xl w-full max-w-6xl xl:max-w-7xl mx-auto p-2.5 sm:p-4 text-slate-900 pointer-events-auto space-y-2.5 transition-none">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-300 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-white text-[#0A006E] border border-slate-300 rounded-xl font-black shadow-xs shrink-0">
              <Keyboard className="w-5 h-5 text-[#0A006E]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider block">
                  Virtual Sales POS Keypad
                </span>
                {activeFieldName && (
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded-md text-[11px] font-mono font-bold text-slate-800 truncate max-w-xs shadow-2xs">
                    Target: {activeFieldName}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-slate-600 block truncate">
                Bold touch keys · Autofill search recommendations available below
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Autofill Strip Visibility */}
            {products.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsAutofillExpanded(!isAutofillExpanded)}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-[#0A006E] border border-slate-300 rounded-lg text-xs font-montserrat font-bold cursor-pointer transition shadow-2xs flex items-center gap-1"
                title="Toggle Product Autofill Recommendations"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="hidden sm:inline">Autofill</span>
                {isAutofillExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            )}

            {/* Mode Switcher */}
            <div className="flex bg-slate-300/80 p-0.5 rounded-xl border border-slate-300">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode('qwerty')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-montserrat font-black cursor-pointer transition ${
                  mode === 'qwerty'
                    ? 'bg-white text-[#0A006E] shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                ABC QWERTY
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode('numeric')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-montserrat font-black cursor-pointer transition flex items-center gap-1 ${
                  mode === 'numeric'
                    ? 'bg-white text-[#0A006E] shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>123 Numpad</span>
              </button>
            </div>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClose}
              title="Close Virtual Keypad"
              className="p-2 bg-slate-300/60 hover:bg-slate-300 text-slate-700 hover:text-slate-900 rounded-xl cursor-pointer transition"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PRODUCT AUTOFILL SEARCH STRIP                                      */}
        {/* ------------------------------------------------------------------ */}
        {products.length > 0 && isAutofillExpanded && (
          <div className="bg-white/90 border border-slate-300 rounded-2xl p-2 sm:p-2.5 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Product Autofill Search
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                  {autofillProducts.length} match{autofillProducts.length === 1 ? '' : 'es'}
                </span>
                {effectiveSearchQuery && (
                  <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">
                    Filtering for &ldquo;<span className="text-[#0A006E] font-bold">{effectiveSearchQuery}</span>&rdquo;
                  </span>
                )}
              </div>

              {/* Quick Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {autofillCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-montserrat font-bold cursor-pointer transition shrink-0 ${
                      selectedCategoryFilter === cat
                        ? 'bg-[#0A006E] text-[#FFDE00]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Autofill Product Cards */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {autofillProducts.length === 0 ? (
                <div className="w-full py-3 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span>No products match &ldquo;{effectiveSearchQuery}&rdquo; in this branch depot.</span>
                  {effectiveSearchQuery && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearAll}
                      className="text-xs font-montserrat font-bold text-[#0A006E] underline cursor-pointer ml-1"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                autofillProducts.map((prod) => {
                  const price =
                    prod.wholesalePriceKes ||
                    prod.baseWholesalePrice ||
                    prod.retailPriceKes ||
                    prod.baseRetailPrice ||
                    0;

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleAutofillProduct(prod)}
                      className="bg-white hover:bg-emerald-50/70 border border-slate-300 hover:border-emerald-400 rounded-xl p-2 shrink-0 w-56 sm:w-64 shadow-2xs cursor-pointer transition active:scale-98 flex flex-col justify-between group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <h6 className="text-xs font-montserrat font-black text-slate-900 group-hover:text-[#0A006E] line-clamp-1">
                            {prod.name}
                          </h6>
                          <span className="text-[11px] font-mono font-black text-[#1E9E60] shrink-0">
                            {formatKes(price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          <span>{prod.subCategory || prod.category || 'Liquor'}</span>
                          <span>·</span>
                          <span>{prod.volumeMl ? `${prod.volumeMl}ml` : 'Bottle'}</span>
                          {prod.packSize && prod.packSize > 1 && (
                            <>
                              <span>·</span>
                              <span>Case of {prod.packSize}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAutofillProduct(prod);
                          }}
                          className="flex-1 py-1 px-1.5 bg-slate-100 hover:bg-[#0A006E] text-slate-800 hover:text-white rounded-lg text-[10px] font-montserrat font-black flex items-center justify-center gap-1 cursor-pointer transition"
                          title="Autofill this product name into the active input"
                        >
                          <ArrowDownRight className="w-3 h-3" />
                          <span>Autofill</span>
                        </button>

                        {onSelectProduct && (
                          <>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => handleQuickAddProduct(prod, 'Bottle', e)}
                              className="py-1 px-2 bg-emerald-100 hover:bg-[#34D186] text-emerald-900 rounded-lg text-[10px] font-montserrat font-black flex items-center justify-center gap-0.5 cursor-pointer transition"
                              title="Directly add 1 bottle to cart"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Bottle</span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => handleQuickAddProduct(prod, 'Case', e)}
                              className="py-1 px-2 bg-amber-100 hover:bg-[#FFDE00] text-amber-900 rounded-lg text-[10px] font-montserrat font-black flex items-center justify-center gap-0.5 cursor-pointer transition"
                              title="Directly add 1 case to cart"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Case</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* KEYBOARD LAYOUT: BOLD LETTERS & WIDE TOUCH KEYS                     */}
        {/* ------------------------------------------------------------------ */}
        {mode === 'qwerty' ? (
          /* WIDE QWERTY KEYBOARD WITH BOLD LETTERS */
          <div className="space-y-1 sm:space-y-1.5 w-full">
            {/* Top Numeric Row */}
            <div className="flex justify-center gap-1 sm:gap-1.5 w-full">
              {qwertyNumbers.map((char) => (
                <button
                  key={char}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeyPress(char)}
                  className="flex-1 min-w-[24px] sm:min-w-[38px] py-2 sm:py-2.5 bg-slate-100 hover:bg-white active:bg-slate-200 text-slate-950 border border-slate-300 shadow-2xs rounded-xl font-montserrat font-black text-xs sm:text-base cursor-pointer transition active:scale-95 flex items-center justify-center select-none"
                >
                  {char}
                </button>
              ))}
            </div>

            {/* QWERTY Row 1 */}
            <div className="flex justify-center gap-1 sm:gap-1.5 w-full">
              {qwertyRow1.map((char) => (
                <button
                  key={char}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeyPress(char)}
                  className="flex-1 min-w-[28px] sm:min-w-[42px] max-w-[88px] py-2.5 sm:py-3.5 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-950 border border-slate-300 shadow-2xs rounded-xl font-montserrat font-black text-sm sm:text-lg md:text-xl cursor-pointer transition active:scale-95 flex items-center justify-center select-none tracking-wide"
                >
                  {isUpperCase ? char.toUpperCase() : char.toUpperCase()}
                </button>
              ))}
            </div>

            {/* QWERTY Row 2 */}
            <div className="flex justify-center gap-1 sm:gap-1.5 w-full px-2 sm:px-4">
              {qwertyRow2.map((char) => (
                <button
                  key={char}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeyPress(char)}
                  className="flex-1 min-w-[28px] sm:min-w-[42px] max-w-[88px] py-2.5 sm:py-3.5 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-950 border border-slate-300 shadow-2xs rounded-xl font-montserrat font-black text-sm sm:text-lg md:text-xl cursor-pointer transition active:scale-95 flex items-center justify-center select-none tracking-wide"
                >
                  {isUpperCase ? char.toUpperCase() : char.toUpperCase()}
                </button>
              ))}
            </div>

            {/* QWERTY Row 3 */}
            <div className="flex justify-center gap-1 sm:gap-1.5 w-full">
              {qwertyRow3.map((char) => (
                <button
                  key={char}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeyPress(char)}
                  className="flex-1 min-w-[28px] sm:min-w-[42px] max-w-[88px] py-2.5 sm:py-3.5 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-950 border border-slate-300 shadow-2xs rounded-xl font-montserrat font-black text-sm sm:text-lg md:text-xl cursor-pointer transition active:scale-95 flex items-center justify-center select-none tracking-wide"
                >
                  {char === ',' || char === '.' || char === '@' || char === '/'
                    ? char
                    : char.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Bottom QWERTY Action Row */}
            <div className="flex gap-1.5 sm:gap-2 pt-1 w-full">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsUpperCase(!isUpperCase)}
                className={`px-3 sm:px-5 py-3 rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer transition flex items-center justify-center gap-1.5 shrink-0 ${
                  isUpperCase
                    ? 'bg-[#0A006E] text-[#FFDE00] border-2 border-[#0A006E] shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-950 border border-slate-300 shadow-2xs'
                }`}
              >
                <ArrowUp className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">CAPS</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode('numeric')}
                className="px-3 sm:px-4 py-3 bg-white hover:bg-slate-50 text-slate-950 border border-slate-300 rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
              >
                <span>123</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSpace}
                className="flex-1 py-3 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-950 border border-slate-300 shadow-2xs rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer transition flex items-center justify-center gap-2"
              >
                <Space className="w-4 h-4 text-slate-600 stroke-[2.5]" />
                <span>SPACE</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearAll}
                title="Clear all text in current field"
                className="px-3 sm:px-4 py-3 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-300 rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer transition shadow-2xs shrink-0 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CLEAR</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleBackspace}
                title="Backspace"
                className="px-3 sm:px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer transition shadow-2xs shrink-0 flex items-center justify-center gap-1"
              >
                <Delete className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">BACK</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleEnter}
                className="px-4 sm:px-7 py-3 bg-[#34D186] hover:bg-[#28B873] active:bg-[#1E9E60] text-[#0A006E] border border-emerald-400 rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer transition shadow-xs shrink-0 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>DONE</span>
              </button>
            </div>
          </div>
        ) : (
          /* WIDE ENTERPRISE NUMERIC / POS CASH KEYPAD WITH BOLD FIGURES */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
            {/* Primary Numpad: 7 Columns */}
            <div className="md:col-span-7 space-y-1.5">
              {numericKeys.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {row.map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (btn === '⌫') {
                          handleBackspace();
                        } else if (btn === 'Clear') {
                          handleClearAll();
                        } else {
                          handleKeyPress(btn);
                        }
                      }}
                      className={`py-3 sm:py-3.5 rounded-xl font-montserrat font-black cursor-pointer shadow-2xs transition active:scale-95 flex items-center justify-center select-none ${
                        btn === '⌫'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-base sm:text-xl'
                          : btn === 'Clear'
                          ? 'bg-slate-100 hover:bg-rose-50 text-slate-800 border border-slate-300 text-xs sm:text-sm'
                          : ['+', '-'].includes(btn)
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-lg sm:text-2xl'
                          : 'bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-950 border border-slate-300 text-xl sm:text-2xl md:text-3xl'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Quick POS Sales Presets & Tender Shortcuts: 5 Columns */}
            <div className="md:col-span-5 bg-white border border-slate-300 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between space-y-2 shadow-2xs">
              <div>
                <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1 mb-1.5">
                  <Banknote className="w-3.5 h-3.5 text-[#1E9E60]" /> Quick Cash &amp; Tender (KES):
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {quickKesPresets.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleClearAll();
                        handleKeyPress(amount);
                      }}
                      className="py-2 bg-slate-50 hover:bg-emerald-50 text-slate-950 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs sm:text-sm font-mono font-black cursor-pointer transition shadow-2xs active:scale-95 text-center"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1 mb-1">
                  <PhoneCall className="w-3.5 h-3.5 text-blue-600" /> Phone &amp; Quantity:
                </span>
                <div className="flex gap-1.5">
                  {quickPrefixes.map((pfx) => (
                    <button
                      key={pfx}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleKeyPress(pfx)}
                      className="flex-1 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-950 hover:text-blue-900 border border-slate-200 rounded-lg text-xs font-mono font-black cursor-pointer transition shadow-2xs"
                    >
                      {pfx}
                    </button>
                  ))}
                  {['+1', '+5', '+10'].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleKeyPress(qty.replace('+', ''))}
                      className="flex-1 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-950 hover:text-amber-950 border border-slate-200 rounded-lg text-xs font-mono font-black cursor-pointer transition shadow-2xs"
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setMode('qwerty')}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-950 border border-slate-300 rounded-xl text-xs font-montserrat font-black cursor-pointer transition"
                >
                  ABC Letters
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleEnter}
                  className="flex-2 py-2.5 bg-[#34D186] hover:bg-[#28B873] active:bg-[#1E9E60] text-[#0A006E] border border-emerald-400 rounded-xl text-xs sm:text-sm font-montserrat font-black cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>DONE / ENTER</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Sales Rep Shortcuts Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-300 text-[11px] text-slate-700">
          <span className="flex items-center gap-1 font-montserrat font-black text-[#0A006E] shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Instant Sales Tags:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {[
              'VIP',
              'Cash',
              'M-Pesa',
              'Retail',
              'Wholesale',
              'Walk-in',
              'Bar & Lounge',
              '@gmail.com',
            ].map((tag) => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleKeyPress(tag)}
                className="px-2.5 py-1 bg-white hover:bg-[#FFDE00] hover:text-[#0A006E] text-slate-950 border border-slate-300 rounded-lg font-montserrat font-black transition cursor-pointer shadow-2xs active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
