/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Keyboard,
  X,
  Delete,
  Space,
  Check,
  ArrowUp,
  Sparkles,
} from 'lucide-react';
import { playPosBeep, triggerScanHaptic } from '../utils/audioBeep';

interface FloatingSalesKeyboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  onDeleteChar?: () => void;
  onSubmit?: () => void;
}

export const FloatingSalesKeyboardModal: React.FC<FloatingSalesKeyboardModalProps> = ({
  isOpen,
  onClose,
  onInsertText,
  onDeleteChar,
  onSubmit,
}) => {
  const [mode, setMode] = useState<'qwerty' | 'numeric'>('qwerty');
  const [isUpperCase, setIsUpperCase] = useState(false);

  if (!isOpen) return null;

  const handleKeyPress = (char: string) => {
    playPosBeep('case');
    triggerScanHaptic();
    const val = isUpperCase ? char.toUpperCase() : char.toLowerCase();
    
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const inputEl = active as HTMLInputElement | HTMLTextAreaElement;
      const start = inputEl.selectionStart || inputEl.value.length;
      const end = inputEl.selectionEnd || inputEl.value.length;
      const newVal = inputEl.value.slice(0, start) + val + inputEl.value.slice(end);
      inputEl.value = newVal;
      inputEl.setSelectionRange(start + 1, start + 1);
      
      const event = new Event('input', { bubbles: true });
      inputEl.dispatchEvent(event);
    }

    if (onInsertText) {
      onInsertText(val);
    }
  };

  const handleBackspace = () => {
    playPosBeep('error');
    triggerScanHaptic();
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const inputEl = active as HTMLInputElement | HTMLTextAreaElement;
      const start = inputEl.selectionStart || inputEl.value.length;
      const end = inputEl.selectionEnd || inputEl.value.length;
      if (start > 0 || end > start) {
        const delStart = end > start ? start : start - 1;
        const newVal = inputEl.value.slice(0, delStart) + inputEl.value.slice(end);
        inputEl.value = newVal;
        inputEl.setSelectionRange(delStart, delStart);
        const event = new Event('input', { bubbles: true });
        inputEl.dispatchEvent(event);
      }
    }
    if (onDeleteChar) {
      onDeleteChar();
    }
  };

  const handleSpace = () => {
    handleKeyPress(' ');
  };

  const handleEnter = () => {
    playPosBeep('success');
    triggerScanHaptic();
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
      active.dispatchEvent(enterEvent);
    }
    if (onSubmit) {
      onSubmit();
    } else {
      onClose();
    }
  };

  const qwertyRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '@']
  ];

  const numericRows = [
    ['7', '8', '9', '+'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '×'],
    ['0', '.', '00', '⌫']
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-2 sm:p-4 flex justify-center animate-slide-up pointer-events-none">
      <div className="bg-[#0A006E]/95 backdrop-blur-md border-2 border-[#FFDE00] rounded-3xl shadow-2xl w-full max-w-2xl p-3 sm:p-4 text-white pointer-events-auto space-y-3">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/15 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#FFDE00] text-[#0A006E] rounded-xl font-bold">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-montserrat font-black text-[#FFDE00] uppercase tracking-wider block">
                Sales Rep Floating Keypad
              </span>
              <span className="text-xs font-semibold text-white/90">
                Tap keys to type directly into active field
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode switch */}
            <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/20">
              <button
                type="button"
                onClick={() => setMode('qwerty')}
                className={`px-3 py-1 rounded-lg text-xs font-montserrat font-bold cursor-pointer transition ${
                  mode === 'qwerty' ? 'bg-[#FFDE00] text-[#0A006E]' : 'text-white/70 hover:text-white'
                }`}
              >
                ABC
              </button>
              <button
                type="button"
                onClick={() => setMode('numeric')}
                className={`px-3 py-1 rounded-lg text-xs font-montserrat font-bold cursor-pointer transition ${
                  mode === 'numeric' ? 'bg-[#FFDE00] text-[#0A006E]' : 'text-white/70 hover:text-white'
                }`}
              >
                123
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Keyboard Layout */}
        {mode === 'qwerty' ? (
          <div className="space-y-1.5">
            {qwertyRows.map((row, rIdx) => (
              <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
                {row.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyPress(char)}
                    className="flex-1 py-2 sm:py-2.5 bg-white/10 hover:bg-[#FFDE00] hover:text-[#0A006E] text-white rounded-xl text-xs sm:text-sm font-montserrat font-bold cursor-pointer shadow-xs transition active:scale-95"
                  >
                    {isUpperCase && char.length === 1 ? char.toUpperCase() : char}
                  </button>
                ))}
              </div>
            ))}

            {/* Bottom QWERTY Row */}
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsUpperCase(!isUpperCase)}
                className={`px-3 py-2.5 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition flex items-center justify-center gap-1 ${
                  isUpperCase ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Shift</span>
              </button>

              <button
                type="button"
                onClick={handleSpace}
                className="flex-3 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <Space className="w-4 h-4" />
                <span>Space</span>
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="flex-1 py-2.5 bg-red-500/30 hover:bg-red-500 text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer transition flex items-center justify-center"
              >
                <Delete className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleEnter}
                className="flex-1.5 py-2.5 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer transition flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>OK</span>
              </button>
            </div>
          </div>
        ) : (
          /* Numeric / POS Keypad */
          <div className="space-y-1.5 max-w-sm mx-auto">
            {numericRows.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-4 gap-1.5">
                {row.map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === '⌫') {
                        handleBackspace();
                      } else {
                        handleKeyPress(btn);
                      }
                    }}
                    className={`py-3 rounded-xl text-sm sm:text-base font-montserrat font-black cursor-pointer shadow-xs transition active:scale-95 ${
                      btn === '⌫'
                        ? 'bg-red-500/30 hover:bg-red-500 text-white'
                        : ['+', '-', '×'].includes(btn)
                        ? 'bg-[#FFDE00]/20 hover:bg-[#FFDE00] text-[#FFDE00] hover:text-[#0A006E]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleKeyPress('07')}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono font-bold cursor-pointer"
              >
                +254 / 07...
              </button>
              <button
                type="button"
                onClick={handleEnter}
                className="flex-1 py-2.5 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer"
              >
                Enter / Done
              </button>
            </div>
          </div>
        )}

        {/* Quick Sales Rep Shortcuts */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-white/70">
          <span className="flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-[#FFDE00]" /> Quick Shortcuts:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {['VIP', 'Cash', 'M-Pesa', '@gmail.com', 'Bar', 'Lounge'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleKeyPress(tag)}
                className="px-2 py-0.5 bg-white/10 hover:bg-[#FFDE00] hover:text-[#0A006E] text-white rounded-md font-bold transition cursor-pointer"
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
