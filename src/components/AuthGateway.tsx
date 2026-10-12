import React, { useState } from 'react';
import {
  ShieldCheck,
  Calculator,
  KeyRound,
  ShoppingBag,
  Delete,
  AlertCircle,
  Wine,
  ArrowLeft,
  UserPlus,
  Briefcase,
  Building2,
  Package,
  Store,
  Users,
} from 'lucide-react';
import { StaffMember, StaffRole } from '../types';
import { AnimatedErrorPromptIcon } from './AnimatedFeedback';

interface AuthGatewayProps {
  staffList: StaffMember[];
  onGoogleLogin: (targetRole: 'Admin' | 'Accountant') => Promise<void>;
  onPinLogin: (pin: string, selectedRole?: StaffRole) => Promise<void>;
  onOpenCustomerPortal: () => void;
  authError: string | null;
  isSubmitting: boolean;
}

const STAFF_DEPARTMENTS: {
  role: StaffRole;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  cardBg: string;
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
  titleText: string;
}[] = [
  {
    role: 'HR',
    title: 'HR DEPARTMENT',
    icon: UserPlus,
    cardBg: 'bg-[#0A006E]',
    cardBorder: 'border-[#0A006E] hover:border-[#FFDE00]',
    badgeBg: 'bg-[#FFDE00]',
    badgeText: 'text-[#0A006E]',
    titleText: 'text-white',
  },
  {
    role: 'Sales Manager',
    title: 'SALES MANAGER',
    icon: Briefcase,
    cardBg: 'bg-[#FFDE00]',
    cardBorder: 'border-amber-400 hover:border-[#0A006E]',
    badgeBg: 'bg-[#0A006E]',
    badgeText: 'text-[#FFDE00]',
    titleText: 'text-[#0A006E]',
  },
  {
    role: 'Branch Manager',
    title: 'BRANCH MANAGER',
    icon: Building2,
    cardBg: 'bg-[#F0F2F0]',
    cardBorder: 'border-slate-300 hover:border-[#34D186]',
    badgeBg: 'bg-[#34D186]',
    badgeText: 'text-[#0A006E]',
    titleText: 'text-[#0A006E]',
  },
  {
    role: 'Inventory Controller',
    title: 'INVENTORY CONTROLLER',
    icon: Package,
    cardBg: 'bg-[#0A006E]',
    cardBorder: 'border-[#0A006E] hover:border-[#FFDE00]',
    badgeBg: 'bg-[#FFDE00]',
    badgeText: 'text-[#0A006E]',
    titleText: 'text-white',
  },
  {
    role: 'Counter Cashier',
    title: 'COUNTER CASHIER',
    icon: Store,
    cardBg: 'bg-[#FFDE00]',
    cardBorder: 'border-amber-400 hover:border-[#0A006E]',
    badgeBg: 'bg-[#0A006E]',
    badgeText: 'text-[#FFDE00]',
    titleText: 'text-[#0A006E]',
  },
  {
    role: 'Affiliate Sales Representative',
    title: 'AFFILIATE SALES REP',
    icon: Users,
    cardBg: 'bg-[#F0F2F0]',
    cardBorder: 'border-slate-300 hover:border-[#34D186]',
    badgeBg: 'bg-[#34D186]',
    badgeText: 'text-[#0A006E]',
    titleText: 'text-[#0A006E]',
  },
];

export const AuthGateway: React.FC<AuthGatewayProps> = ({
  onGoogleLogin,
  onPinLogin,
  onOpenCustomerPortal,
  authError,
  isSubmitting,
}) => {
  const [selectedBox, setSelectedBox] = useState<'Admin' | 'Accountant' | 'Staff'>('Admin');
  const [screenView, setScreenView] = useState<'boxes' | 'departments' | 'pin'>('boxes');
  const [selectedDepartment, setSelectedDepartment] = useState<StaffRole | null>(null);
  const [pinDigits, setPinDigits] = useState<string>('');

  const handleOpenStaffDepartments = () => {
    setSelectedBox('Staff');
    setSelectedDepartment(null);
    setPinDigits('');
    setScreenView('departments');
  };

  const handleSelectDepartment = (role: StaffRole) => {
    setSelectedDepartment(role);
    setPinDigits('');
    setScreenView('pin');
  };

  const handleDigitPress = (digit: string) => {
    if (pinDigits.length < 6) {
      const next = pinDigits + digit;
      setPinDigits(next);
      if (next.length === 6) {
        onPinLogin(next, selectedDepartment || undefined);
      }
    }
  };

  const handleBackspace = () => {
    setPinDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinDigits('');
  };

  const activeDeptMeta = STAFF_DEPARTMENTS.find((d) => d.role === selectedDepartment);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* VAAIRO Deep Navy Header (2x Height) with Curved Single-Wave Bottom Edge */}
      <header className="relative bg-[#0A006E] text-white sticky top-0 z-40 pt-6 pb-14 px-6 sm:px-8 flex items-center justify-between gap-8 overflow-hidden shadow-lg">
        <div className="silent-scanner-beam" />
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setScreenView('boxes');
          }}
          className="flex items-center gap-4 relative z-10 whitespace-nowrap shrink-0"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-lg border-2 border-white">
            <Wine className="w-7 h-7 stroke-[2.5]" />
          </div>
          <span className="font-montserrat font-black italic text-3xl sm:text-4xl lg:text-5xl tracking-tighter text-white">
            VAAIRO{' '}
            <span className="text-[#FFDE00] not-italic text-sm sm:text-base font-black px-2.5 py-1 bg-white/10 rounded-xl ml-1.5 align-middle">
              ERP
            </span>
          </span>
        </a>

        <div className="flex items-center gap-3 shrink-0 relative z-10">
          <button
            onClick={onOpenCustomerPortal}
            className="px-4 py-2.5 text-xs font-montserrat font-black text-[#0A006E] bg-[#FFDE00] hover:bg-amber-400 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <ShoppingBag className="w-4 h-4" />
            Customer Online Order Portal
          </button>
        </div>

        {/* Single Smooth Curved Wave Bottom Edge */}
        <svg
          className="absolute bottom-0 left-0 w-full h-10 sm:h-12 pointer-events-none block"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,25 C480,85 960,-15 1440,45 L1440,80 L0,80 Z"
            fill="#FFFFFF"
          />
          <path
            d="M0,25 C480,85 960,-15 1440,45"
            fill="none"
            stroke="#FFDE00"
            strokeWidth="5"
          />
        </svg>
      </header>

      {/* On-Screen Login Canvas */}
      <main className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {authError && (
          <div className="max-w-5xl mx-auto w-full p-4 rounded-2xl bg-red-50 border-2 border-red-500 text-sm text-red-950 flex items-center gap-3.5 font-montserrat font-bold animate-error-shake shadow-lg">
            <AnimatedErrorPromptIcon size="md" />
            <span>{authError}</span>
          </div>
        )}

        {/* VIEW 1: THREE 2X SQUARE LOGIN BOXES (ADMIN | ACCOUNTS | STAFFS) */}
        {screenView === 'boxes' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 max-w-5xl mx-auto w-full items-center">
            {/* BOX 1: ADMIN (2x Square) */}
            <div
              onClick={() => {
                setSelectedBox('Admin');
                onGoogleLogin('Admin');
              }}
              className={`group aspect-square rounded-3xl p-8 flex flex-col items-center justify-center gap-6 text-center cursor-pointer border-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-3 hover:scale-[1.04] hover:shadow-[0_28px_56px_-12px_rgba(10,0,110,0.5)] ${
                selectedBox === 'Admin'
                  ? 'bg-[#0A006E] text-white border-[#FFDE00] shadow-2xl ring-4 ring-[#FFDE00]/40'
                  : 'bg-[#0A006E] text-white border-[#0A006E] hover:border-[#FFDE00]'
              }`}
            >
              <div className="silent-scanner-beam" />
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-xl border-3 border-white shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10">
                <ShieldCheck className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tight text-white relative z-10">
                ADMIN
              </h2>
            </div>

            {/* BOX 2: ACCOUNTS (2x Square) */}
            <div
              onClick={() => {
                setSelectedBox('Accountant');
                onGoogleLogin('Accountant');
              }}
              className={`group aspect-square rounded-3xl p-8 flex flex-col items-center justify-center gap-6 text-center cursor-pointer border-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-3 hover:scale-[1.04] hover:shadow-[0_28px_56px_-12px_rgba(255,222,0,0.6)] ${
                selectedBox === 'Accountant'
                  ? 'bg-[#FFDE00] text-[#0A006E] border-[#0A006E] shadow-2xl ring-4 ring-[#0A006E]/30'
                  : 'bg-[#FFDE00] text-[#0A006E] border-amber-400 hover:border-[#0A006E]'
              }`}
            >
              <div className="silent-scanner-beam-dark" />
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xl border-3 border-white shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 relative z-10">
                <Calculator className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tight text-[#0A006E] relative z-10">
                ACCOUNTS
              </h2>
            </div>

            {/* BOX 3: STAFFS (2x Square - Tapping switches on-screen to Departments) */}
            <div
              onClick={handleOpenStaffDepartments}
              className={`group aspect-square rounded-3xl p-8 flex flex-col items-center justify-center gap-6 text-center cursor-pointer border-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-3 hover:scale-[1.04] hover:shadow-[0_28px_56px_-12px_rgba(52,209,134,0.5)] ${
                selectedBox === 'Staff'
                  ? 'bg-[#F0F2F0] text-slate-900 border-[#34D186] shadow-2xl ring-4 ring-[#34D186]/35'
                  : 'bg-[#F0F2F0] text-slate-900 border-slate-300 hover:border-[#0A006E] hover:bg-emerald-50/40'
              }`}
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#34D186] text-[#0A006E] flex items-center justify-center shadow-xl border-3 border-[#0A006E] shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10">
                <KeyRound className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tight text-[#0A006E] relative z-10">
                STAFFS
              </h2>
            </div>
          </div>
        )}

        {/* VIEW 2: ON-SCREEN STAFF DEPARTMENTS GRID (No Popup) */}
        {screenView === 'departments' && (
          <div className="max-w-5xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setScreenView('boxes')}
                className="px-4 py-2.5 rounded-2xl bg-[#F0F2F0] hover:bg-[#FFDE00] border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Back
              </button>
              <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
                SELECT DEPARTMENT
              </h2>
              <div className="w-20" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-7">
              {STAFF_DEPARTMENTS.map((dept) => {
                const DeptIcon = dept.icon;
                return (
                  <div
                    key={dept.role}
                    onClick={() => handleSelectDepartment(dept.role)}
                    className={`group aspect-square rounded-3xl p-6 ${dept.cardBg} ${dept.cardBorder} border-3 flex flex-col items-center justify-center gap-5 text-center cursor-pointer relative overflow-hidden transition-all duration-300 hover:-translate-y-2.5 hover:scale-[1.03] shadow-lg hover:shadow-2xl`}
                  >
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl ${dept.badgeBg} ${dept.badgeText} flex items-center justify-center border-2 border-white shadow-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10`}
                    >
                      <DeptIcon className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.2]" />
                    </div>
                    <h3
                      className={`text-base sm:text-xl font-montserrat font-black italic tracking-tight ${dept.titleText} relative z-10 leading-tight`}
                    >
                      {dept.title}
                    </h3>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: ON-SCREEN 6-DIGIT PIN WINDOW FOR SELECTED DEPARTMENT (No Popup) */}
        {screenView === 'pin' && (
          <div className="max-w-md mx-auto w-full bg-[#F0F2F0] border-2 border-[#0A006E] rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-300 pb-4">
              <button
                type="button"
                onClick={() => {
                  setPinDigits('');
                  setScreenView('departments');
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFDE00] border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Departments
              </button>

              <div className="text-right">
                <div className="text-[10px] font-montserrat font-black text-slate-500 uppercase tracking-wider">
                  ENTER 6-DIGIT PIN
                </div>
                <h3 className="text-base sm:text-lg font-montserrat font-black italic text-[#0A006E]">
                  {activeDeptMeta?.title || selectedDepartment}
                </h3>
              </div>
            </div>

            {/* 6-Digit Visual Display */}
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = idx < pinDigits.length;
                return (
                  <div
                    key={idx}
                    className={`h-12 rounded-xl border-2 flex items-center justify-center font-mono-tabular text-lg font-bold transition-all ${
                      filled
                        ? 'border-[#0A006E] bg-[#FFDE00] text-[#0A006E]'
                        : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {filled ? '•' : ''}
                  </div>
                );
              })}
            </div>

            {/* Tactile 6-Digit PIN Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  className="min-h-[48px] rounded-xl bg-white hover:bg-[#FFDE00] active:bg-amber-400 border border-slate-200 text-base font-bold font-mono-tabular text-[#0A006E] transition-colors cursor-pointer shadow-2xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="min-h-[48px] rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-montserrat font-black text-slate-700 transition-colors cursor-pointer"
              >
                CLR
              </button>
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="min-h-[48px] rounded-xl bg-white hover:bg-[#FFDE00] active:bg-amber-400 border border-slate-200 text-base font-bold font-mono-tabular text-[#0A006E] transition-colors cursor-pointer shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="min-h-[48px] rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                aria-label="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              disabled={pinDigits.length !== 6 || isSubmitting}
              onClick={() => onPinLogin(pinDigits, selectedDepartment || undefined)}
              className="w-full min-h-[48px] py-3 px-4 bg-[#34D186] hover:bg-[#28B873] border-2 border-[#0A006E] disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-sm rounded-xl transition-colors cursor-pointer shadow-md"
            >
              {isSubmitting ? 'Verifying PIN...' : `Unlock ${activeDeptMeta?.title}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
