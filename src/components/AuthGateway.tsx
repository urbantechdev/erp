import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Calculator,
  KeyRound,
  ShoppingBag,
  Delete,
  Wine,
  ArrowLeft,
  UserPlus,
  Briefcase,
  Building2,
  Package,
  Store,
  Users,
  UserCheck,
  Clock,
  Sparkles,
  Keyboard,
} from 'lucide-react';
import { StaffMember, StaffRole } from '../types';
import { AnimatedErrorPromptIcon } from './AnimatedFeedback';

interface AuthGatewayProps {
  staffList: StaffMember[];
  onGoogleLogin: (targetRole: 'Admin' | 'Accountant') => Promise<void>;
  onPinLogin: (pin: string, selectedRole?: StaffRole, selectedStaffId?: string) => Promise<void>;
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
  staffList,
  onGoogleLogin,
  onPinLogin,
  onOpenCustomerPortal,
  authError,
  isSubmitting,
}) => {
  const [selectedBox, setSelectedBox] = useState<'Admin' | 'Accountant' | 'Staff'>('Admin');
  const [screenView, setScreenView] = useState<'boxes' | 'departments' | 'users' | 'pin'>('boxes');
  const [selectedDepartment, setSelectedDepartment] = useState<StaffRole | null>(null);
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null);
  const [pinDigits, setPinDigits] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus hidden input whenever entering the PIN screen
  useEffect(() => {
    if (screenView === 'pin') {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
        setIsInputFocused(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsInputFocused(false);
    }
  }, [screenView]);

  const handleOpenStaffDepartments = () => {
    setSelectedBox('Staff');
    setSelectedDepartment(null);
    setSelectedUser(null);
    setPinDigits('');
    setScreenView('departments');
  };

  const handleSelectDepartment = (role: StaffRole) => {
    setSelectedDepartment(role);
    setSelectedUser(null);
    setPinDigits('');
    setScreenView('users');
  };

  const handleSelectUser = (user: StaffMember) => {
    setSelectedUser(user);
    setPinDigits('');
    setScreenView('pin');
  };

  const handleBypassToPin = () => {
    setSelectedUser(null);
    setPinDigits('');
    setScreenView('pin');
  };

  const handleDigitPress = (digit: string) => {
    setPinDigits((prev) => {
      if (prev.length < 6) {
        const next = prev + digit;
        if (next.length === 6) {
          onPinLogin(next, selectedDepartment || undefined, selectedUser?.id || undefined);
        }
        return next;
      }
      return prev;
    });
  };

  const handleBackspace = () => {
    setPinDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPinDigits('');
    pinInputRef.current?.focus();
  };

  // Physical keyboard listener for 0-9 digits, Backspace, Delete, and Enter
  useEffect(() => {
    if (screenView !== 'pin') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if typing in another input element
      if (
        e.target instanceof HTMLInputElement &&
        e.target !== pinInputRef.current
      ) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pinDigits.length === 6 && !isSubmitting) {
          onPinLogin(
            pinDigits,
            selectedDepartment || undefined,
            selectedUser?.id || undefined
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenView, pinDigits, isSubmitting, selectedDepartment, selectedUser, onPinLogin]);

  const activeDeptMeta = STAFF_DEPARTMENTS.find((d) => d.role === selectedDepartment);

  // Filter existing active staff members for the selected department
  const departmentUsers = useMemo(() => {
    if (!selectedDepartment) return [];
    return staffList.filter(
      (s) => s.role === selectedDepartment && s.status === 'Active'
    );
  }, [staffList, selectedDepartment]);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* VAAIRO Deep Navy Header with Curved Single-Wave Bottom Edge */}
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

        {/* VIEW 2: ON-SCREEN STAFF DEPARTMENTS GRID */}
        {screenView === 'departments' && (
          <div className="max-w-5xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setScreenView('boxes')}
                className="px-4 py-2.5 rounded-2xl bg-[#F0F2F0] hover:bg-[#FFDE00] border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Back to Login
              </button>
              <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
                SELECT DEPARTMENT
              </h2>
              <div className="w-20" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-7">
              {STAFF_DEPARTMENTS.map((dept) => {
                const DeptIcon = dept.icon;
                const count = staffList.filter((s) => s.role === dept.role && s.status === 'Active').length;
                return (
                  <div
                    key={dept.role}
                    onClick={() => handleSelectDepartment(dept.role)}
                    className={`group aspect-square rounded-3xl p-6 ${dept.cardBg} ${dept.cardBorder} border-3 flex flex-col items-center justify-center gap-4 text-center cursor-pointer relative overflow-hidden transition-all duration-300 hover:-translate-y-2.5 hover:scale-[1.03] shadow-lg hover:shadow-2xl`}
                  >
                    <div
                      className={`w-18 h-18 sm:w-22 sm:h-22 rounded-3xl ${dept.badgeBg} ${dept.badgeText} flex items-center justify-center border-2 border-white shadow-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10`}
                    >
                      <DeptIcon className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.2]" />
                    </div>
                    <div className="relative z-10">
                      <h3
                        className={`text-base sm:text-lg font-montserrat font-black italic tracking-tight ${dept.titleText} leading-tight`}
                      >
                        {dept.title}
                      </h3>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-bold ${
                        dept.badgeBg === 'bg-[#FFDE00]' ? 'bg-white/20 text-white' : 'bg-[#0A006E]/15 text-[#0A006E]'
                      }`}>
                        {count} Staff Member{count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: ON-SCREEN EXISTING USER SELECTION FOR CHOSEN DEPARTMENT */}
        {screenView === 'users' && selectedDepartment && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <button
                type="button"
                onClick={() => setScreenView('departments')}
                className="px-4 py-2.5 rounded-2xl bg-[#F0F2F0] hover:bg-[#FFDE00] border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Departments
              </button>

              <div className="text-center">
                <span className="text-[10px] font-montserrat font-black text-slate-500 uppercase tracking-widest block">
                  STAFF SELECTION
                </span>
                <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
                  {activeDeptMeta?.title || selectedDepartment}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleBypassToPin}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-[#0A006E] font-montserrat font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Enter PIN without selecting a specific profile"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Direct PIN
              </button>
            </div>

            {departmentUsers.length === 0 ? (
              <div className="bg-[#F0F2F0] border-2 border-slate-300 rounded-3xl p-8 sm:p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center mx-auto shadow-md">
                  <Users className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-montserrat font-black text-[#0A006E]">
                    No Active {selectedDepartment} Staff Found
                  </h3>
                  <p className="text-xs text-slate-600">
                    No active staff accounts have been provisioned for the{' '}
                    <strong>{selectedDepartment}</strong> department yet.
                  </p>
                  <p className="text-[11px] text-slate-500 pt-2">
                    Sign in as <strong>Admin</strong> via Google to create HR, then HR provisions staff in the HR & Role Provisioning module.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBypassToPin}
                    className="px-4 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md"
                  >
                    Enter 6-Digit PIN Directly
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreenView('departments')}
                    className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer"
                  >
                    Back to Departments
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-montserrat font-bold text-slate-600">
                  Select your name from the {departmentUsers.length} active staff member{departmentUsers.length === 1 ? '' : 's'} below to continue to the PIN terminal:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departmentUsers.map((user) => {
                    const initials = user.name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0].toUpperCase())
                      .join('');

                    return (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="group bg-[#F0F2F0] hover:bg-[#FFDE00]/25 border-2 border-slate-300 hover:border-[#0A006E] rounded-3xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-sm flex items-center justify-center shrink-0 border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                              {initials || 'ST'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-montserrat font-black text-slate-900 text-base truncate group-hover:text-[#0A006E]">
                                {user.name}
                              </h4>
                              <div className="flex items-center gap-1 text-xs text-slate-600 truncate mt-0.5">
                                <Building2 className="w-3.5 h-3.5 shrink-0 text-[#0A006E]" />
                                <span className="truncate">{user.branchName}</span>
                              </div>
                            </div>
                          </div>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/40 shrink-0">
                            Active
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleDateString()
                              : 'Ready'}
                          </span>
                          <span className="font-montserrat font-black text-[#0A006E] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                            Enter PIN →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: ON-SCREEN 6-DIGIT PIN WINDOW (Imported from LIQOUR Design) */}
        {screenView === 'pin' && (
          <div className="max-w-md mx-auto w-full bg-[#F0F2F0] border-2 border-[#0A006E] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-300 pb-4">
              <button
                type="button"
                onClick={() => {
                  setPinDigits('');
                  if (selectedDepartment) {
                    setScreenView('users');
                  } else {
                    setScreenView('departments');
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFDE00] border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                {selectedDepartment ? 'Staff List' : 'Departments'}
              </button>

              <div className="text-right">
                <div className="text-[10px] font-montserrat font-black text-slate-500 uppercase tracking-wider">
                  ENTER 6-DIGIT PIN
                </div>
                <h3 className="text-base sm:text-lg font-montserrat font-black italic text-[#0A006E]">
                  {selectedUser ? selectedUser.name : activeDeptMeta?.title || selectedDepartment}
                </h3>
              </div>
            </div>

            {/* Selected User Header Banner if a user was picked */}
            {selectedUser && (
              <div className="bg-white border-2 border-[#0A006E]/20 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-montserrat font-black text-[#0A006E] truncate">
                      {selectedUser.name}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate font-mono">
                      {selectedUser.role} · {selectedUser.branchName}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setPinDigits('');
                    setScreenView('users');
                  }}
                  className="px-2.5 py-1 text-[11px] font-montserrat font-bold text-[#0A006E] bg-slate-100 hover:bg-[#FFDE00] rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Switch
                </button>
              </div>
            )}

            {/* Hidden accessible input that captures mobile soft keyboard & desktop keyboard typing */}
            <input
              ref={pinInputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinDigits}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPinDigits(cleaned);
                if (cleaned.length === 6) {
                  onPinLogin(
                    cleaned,
                    selectedDepartment || undefined,
                    selectedUser?.id || undefined
                  );
                }
              }}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              className="sr-only"
              aria-label="6-Digit Staff Security PIN Input"
            />

            {/* Curved High-Visibility 6-Digit PIN Display Box (LIQOUR Terminal Spec) */}
            <div
              onClick={() => {
                pinInputRef.current?.focus();
                setIsInputFocused(true);
              }}
              className={`p-5 sm:p-6 rounded-[28px] bg-slate-900 border transition-all cursor-text space-y-3 shadow-inner ${
                isInputFocused
                  ? 'border-[#FFDE00] ring-4 ring-[#FFDE00]/30'
                  : 'border-[#0A006E]/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-montserrat font-bold text-slate-300 px-1">
                <span className="uppercase tracking-wider text-[#FFDE00] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#FFDE00]" />
                  Enter 6-Digit Security PIN
                </span>
                <span className="font-mono text-white text-xs">{pinDigits.length} / 6 Digits</span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-3 py-1">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const filled = idx < pinDigits.length;
                  const isCurrent = idx === pinDigits.length;
                  return (
                    <div
                      key={idx}
                      className={`h-16 sm:h-20 rounded-2xl flex items-center justify-center font-mono font-black border-2 transition-all select-none ${
                        filled
                          ? 'border-[#FFDE00] bg-[#FFDE00] text-[#0A006E] shadow-md scale-105'
                          : isCurrent
                          ? 'border-[#FFDE00] bg-white/15 text-white ring-4 ring-[#FFDE00]/40 scale-102'
                          : 'border-slate-700 bg-slate-800 text-slate-500'
                      }`}
                    >
                      {filled ? (
                        <span className="text-3xl sm:text-4xl font-black text-[#0A006E] leading-none">
                          ●
                        </span>
                      ) : isCurrent ? (
                        <span className="w-2 h-7 sm:h-8 bg-[#FFDE00] animate-pulse rounded-full" />
                      ) : (
                        ''
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Keyboard typing active banner */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-montserrat font-semibold pt-1 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Keyboard className="w-3.5 h-3.5 text-[#FFDE00]" />
                  <span>Physical Keyboard active (0–9)</span>
                </span>
                <span className="text-slate-400 font-mono">Press Enter to Unlock</span>
              </div>

              {/* Quick Auto-Fill PIN Helpers for Authorized Department Access */}
              {selectedDepartment === 'POS' && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPinDigits('123456');
                      onPinLogin('123456', selectedDepartment, selectedUser?.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDE00]/20 hover:bg-[#FFDE00]/30 text-[#FFDE00] border border-[#FFDE00]/40 text-[11px] font-montserrat font-black cursor-pointer transition"
                  >
                    <span>Counter Cashier PIN: 123456 (Tap to Auto-Fill)</span>
                  </button>
                </div>
              )}
              {selectedDepartment === 'AFFILIATES' && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPinDigits('654321');
                      onPinLogin('654321', selectedDepartment, selectedUser?.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDE00]/20 hover:bg-[#FFDE00]/30 text-[#FFDE00] border border-[#FFDE00]/40 text-[11px] font-montserrat font-black cursor-pointer transition"
                  >
                    <span>Sales Rep PIN: 654321 (Tap to Auto-Fill)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Soft-Curved Numeric Keypad (Imported from LIQOUR Design) */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  className="py-4 sm:py-5 rounded-[22px] font-montserrat font-black text-2xl sm:text-3xl border transition active:scale-95 shadow-xs bg-slate-100/90 hover:bg-[#0A006E] text-slate-900 hover:text-[#FFDE00] border-slate-200/80 hover:border-[#0A006E] flex items-center justify-center select-none cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-4 sm:py-5 rounded-[22px] font-montserrat font-black text-xs sm:text-sm uppercase border transition active:scale-95 bg-red-50/90 hover:bg-red-100 text-red-700 border-red-200/80 flex items-center justify-center select-none cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="py-4 sm:py-5 rounded-[22px] font-montserrat font-black text-2xl sm:text-3xl border transition active:scale-95 shadow-xs bg-slate-100/90 hover:bg-[#0A006E] text-slate-900 hover:text-[#FFDE00] border-slate-200/80 hover:border-[#0A006E] flex items-center justify-center select-none cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-4 sm:py-5 rounded-[22px] font-montserrat font-black border transition active:scale-95 bg-slate-100/90 hover:bg-slate-200 text-slate-700 border-slate-200/80 flex items-center justify-center cursor-pointer select-none"
                aria-label="Backspace"
              >
                <Delete className="w-6 h-6 stroke-[2.5]" />
              </button>
            </div>

            <button
              type="button"
              disabled={pinDigits.length !== 6 || isSubmitting}
              onClick={() =>
                onPinLogin(
                  pinDigits,
                  selectedDepartment || undefined,
                  selectedUser?.id || undefined
                )
              }
              className="w-full py-4 px-4 bg-[#34D186] hover:bg-[#28B873] border-2 border-[#0A006E] disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-sm sm:text-base rounded-2xl transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-2"
            >
              {isSubmitting
                ? 'Verifying PIN...'
                : selectedUser
                ? `Unlock as ${selectedUser.name}`
                : `Unlock ${activeDeptMeta?.title || 'Terminal'}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
