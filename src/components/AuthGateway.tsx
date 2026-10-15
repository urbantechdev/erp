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
  Lock,
  Zap,
  Loader2,
  MapPin,
  ChevronRight,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { StaffMember, StaffRole, Branch } from '../types';
import { AnimatedErrorPromptIcon } from './AnimatedFeedback';

interface AuthGatewayProps {
  staffList: StaffMember[];
  branches?: Branch[];
  onGoogleLogin: (targetRole: 'Admin' | 'Accountant') => Promise<void>;
  onPinLogin: (pin: string, selectedRole?: StaffRole, selectedStaffId?: string) => Promise<void>;
  onOpenCustomerPortal: () => void;
  onOpenPhoneScanner?: () => void;
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
  branches = [],
  onGoogleLogin,
  onPinLogin,
  onOpenCustomerPortal,
  onOpenPhoneScanner,
  authError,
  isSubmitting,
}) => {
  const [selectedBox, setSelectedBox] = useState<'Admin' | 'Accountant' | 'Staff'>('Admin');
  const [screenView, setScreenView] = useState<'boxes' | 'departments' | 'branches' | 'users' | 'pin'>('boxes');
  const [selectedDepartment, setSelectedDepartment] = useState<StaffRole | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null);
  const [pinDigits, setPinDigits] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedPinRef = useRef<string>('');

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
      lastSubmittedPinRef.current = '';
    }
  }, [screenView]);

  // Safely trigger verification in the effect phase (after render) once 6 digits are entered
  useEffect(() => {
    if (
      screenView === 'pin' &&
      pinDigits.length === 6 &&
      !isSubmitting &&
      lastSubmittedPinRef.current !== pinDigits
    ) {
      lastSubmittedPinRef.current = pinDigits;
      onPinLogin(
        pinDigits,
        selectedDepartment || undefined,
        selectedUser?.id || undefined
      );
    } else if (pinDigits.length < 6) {
      lastSubmittedPinRef.current = '';
    }
  }, [screenView, pinDigits, isSubmitting, selectedDepartment, selectedUser, onPinLogin]);

  const handleOpenStaffDepartments = () => {
    setSelectedBox('Staff');
    setSelectedDepartment(null);
    setSelectedBranchId(null);
    setSelectedBranchName(null);
    setSelectedUser(null);
    lastSubmittedPinRef.current = '';
    setPinDigits('');
    setScreenView('departments');
  };

  const handleSelectDepartment = (role: StaffRole) => {
    setSelectedDepartment(role);
    setSelectedBranchId(null);
    setSelectedBranchName(null);
    setSelectedUser(null);
    lastSubmittedPinRef.current = '';
    setPinDigits('');
    setScreenView('branches');
  };

  const handleSelectBranch = (branchId: string, branchName: string) => {
    setSelectedBranchId(branchId);
    setSelectedBranchName(branchName);
    setSelectedUser(null);
    lastSubmittedPinRef.current = '';
    setPinDigits('');
    setScreenView('users');
  };

  const handleSelectUser = (user: StaffMember) => {
    setSelectedUser(user);
    lastSubmittedPinRef.current = '';
    setPinDigits('');
    setScreenView('pin');
    setTimeout(() => {
      pinInputRef.current?.focus();
      setIsInputFocused(true);
    }, 50);
  };

  const handleBypassToPin = () => {
    setSelectedUser(null);
    lastSubmittedPinRef.current = '';
    setPinDigits('');
    setScreenView('pin');
    setTimeout(() => {
      pinInputRef.current?.focus();
      setIsInputFocused(true);
    }, 50);
  };

  const handleDigitPress = (digit: string) => {
    if (isSubmitting) return;
    setPinDigits((prev) => (prev.length < 6 ? prev + digit : prev));
  };

  const handleBackspace = () => {
    lastSubmittedPinRef.current = '';
    setPinDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    lastSubmittedPinRef.current = '';
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
          lastSubmittedPinRef.current = pinDigits;
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

  // List of branches available for selection in the chosen department
  const departmentBranches = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; regionName?: string; code?: string; isMain?: boolean; count: number }
    >();

    // 1. Add all operational genuine branches (excluding purged dummy branches)
    branches.forEach((b) => {
      const code = (b.code || '').toUpperCase();
      const name = (b.name || '').toLowerCase();
      const isDummy =
        code === 'BR-LWR-003' ||
        code === 'BR-SUB-002' ||
        name.includes('lower basin') ||
        name.includes('northgate suburban');

      if (b.status !== 'Closed' && !isDummy) {
        map.set(b.id, {
          id: b.id,
          name: b.name,
          regionName: b.regionName,
          code: b.code,
          isMain: Boolean(b.isMain || code === 'BR-HQ-001' || name.includes('hq')),
          count: 0,
        });
      }
    });

    // 2. Count staff in this department for each branch, and add any missing branches from staff records
    staffList.forEach((s) => {
      if (s.role === selectedDepartment && s.status === 'Active') {
        const branchKey = s.branchId || s.branchName;
        if (!branchKey) return;
        const sBranchName = (s.branchName || '').toLowerCase();
        if (
          sBranchName.includes('lower basin') ||
          sBranchName.includes('northgate suburban')
        ) {
          return; // Ignore dummy branch references on staff
        }

        if (map.has(s.branchId)) {
          map.get(s.branchId)!.count += 1;
        } else if (map.has(branchKey)) {
          map.get(branchKey)!.count += 1;
        } else {
          map.set(branchKey, {
            id: s.branchId || branchKey,
            name: s.branchName || 'HQ - Main Branch',
            regionName: undefined,
            code: undefined,
            isMain: false,
            count: 1,
          });
        }
      }
    });

    // Fallback if no branches registered yet
    if (map.size === 0) {
      map.set('br-hq-001', {
        id: 'br-hq-001',
        name: 'HQ - Main Branch',
        regionName: 'Metropolitan CBD & High-Street Zone',
        code: 'BR-HQ-001',
        isMain: true,
        count: 0,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      // Keep HQ / Main branch at top, then sort by staff count
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return b.count - a.count;
    });
  }, [branches, staffList, selectedDepartment]);

  // Total active staff count in this department across all branches
  const totalDepartmentStaffCount = useMemo(() => {
    if (!selectedDepartment) return 0;
    return staffList.filter((s) => s.role === selectedDepartment && s.status === 'Active').length;
  }, [staffList, selectedDepartment]);

  // Filter existing active staff members for the selected department AND selected branch
  const departmentUsers = useMemo(() => {
    if (!selectedDepartment) return [];
    return staffList.filter((s) => {
      if (s.role !== selectedDepartment || s.status !== 'Active') return false;
      if (!selectedBranchId || selectedBranchId === 'all') return true;
      return s.branchId === selectedBranchId || s.branchName === selectedBranchName;
    });
  }, [staffList, selectedDepartment, selectedBranchId, selectedBranchName]);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* VAAIRO Deep Navy Header with Curved Single-Wave Bottom Edge */}
      <header className="relative bg-[#0A006E] text-white sticky top-0 z-40 pt-5 sm:pt-6 pb-12 sm:pb-14 px-4 sm:px-8 flex items-center justify-between gap-4 sm:gap-8 overflow-hidden shadow-lg">
        <div className="silent-scanner-beam" />
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setScreenView('boxes');
          }}
          className="flex items-center gap-3 sm:gap-4 relative z-10 whitespace-nowrap shrink-0"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white text-[#0A006E] flex items-center justify-center shadow-lg border-2 border-white">
            <Wine className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
          </div>
          <span className="font-montserrat font-black italic text-2xl sm:text-4xl lg:text-5xl tracking-tighter text-white">
            VAAIRO{' '}
            <span className="text-[#FFDE00] not-italic text-xs sm:text-base font-black px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/10 rounded-xl ml-1 sm:ml-1.5 align-middle">
              ERP
            </span>
          </span>
        </a>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 relative z-10">
          {onOpenPhoneScanner && (
            <button
              type="button"
              onClick={onOpenPhoneScanner}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-white shadow-md transition-all cursor-pointer flex items-center justify-center active:scale-95 text-xs font-montserrat font-black"
              title="📱 Launch Phone Barcode Scanner Station"
              aria-label="Launch Phone Barcode Scanner Station"
            >
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCustomerPortal}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white hover:bg-slate-100 text-[#0A006E] border-2 border-white shadow-md transition-all cursor-pointer flex items-center justify-center active:scale-95 text-xs font-montserrat font-black"
            title="Customer Online Order Portal"
            aria-label="Customer Online Order Portal"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
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
            <div className="flex flex-col items-center">
              <div
                onClick={() => {
                  if (isSubmitting) return;
                  setSelectedBox('Admin');
                  onGoogleLogin('Admin');
                }}
                className={`w-full group aspect-square rounded-3xl p-8 flex flex-col items-center justify-center gap-6 text-center cursor-pointer border-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-3 hover:scale-[1.04] hover:shadow-[0_28px_56px_-12px_rgba(10,0,110,0.5)] ${
                  selectedBox === 'Admin'
                    ? 'bg-[#0A006E] text-white border-[#FFDE00] shadow-2xl ring-4 ring-[#FFDE00]/40'
                    : 'bg-[#0A006E] text-white border-[#0A006E] hover:border-[#FFDE00]'
                } ${isSubmitting && selectedBox === 'Admin' ? 'opacity-80 pointer-events-none' : ''}`}
              >
                <div className="silent-scanner-beam" />
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-xl border-3 border-white shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10">
                  {isSubmitting && selectedBox === 'Admin' ? (
                    <Loader2 className="w-12 h-12 sm:w-14 sm:h-14 animate-spin text-[#0A006E]" />
                  ) : (
                    <ShieldCheck className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
                  )}
                </div>
                <div className="relative z-10">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tight text-white">
                    ADMIN
                  </h2>
                </div>
              </div>
            </div>

            {/* BOX 2: ACCOUNTS (2x Square) */}
            <div className="flex flex-col items-center">
              <div
                onClick={() => {
                  if (isSubmitting) return;
                  setSelectedBox('Accountant');
                  onGoogleLogin('Accountant');
                }}
                className={`w-full group aspect-square rounded-3xl p-8 flex flex-col items-center justify-center gap-6 text-center cursor-pointer border-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-3 hover:scale-[1.04] hover:shadow-[0_28px_56px_-12px_rgba(255,222,0,0.6)] ${
                  selectedBox === 'Accountant'
                    ? 'bg-[#FFDE00] text-[#0A006E] border-[#0A006E] shadow-2xl ring-4 ring-[#0A006E]/30'
                    : 'bg-[#FFDE00] text-[#0A006E] border-amber-400 hover:border-[#0A006E]'
                } ${isSubmitting && selectedBox === 'Accountant' ? 'opacity-80 pointer-events-none' : ''}`}
              >
                <div className="silent-scanner-beam-dark" />
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xl border-3 border-white shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 relative z-10">
                  {isSubmitting && selectedBox === 'Accountant' ? (
                    <Loader2 className="w-12 h-12 sm:w-14 sm:h-14 animate-spin text-[#FFDE00]" />
                  ) : (
                    <Calculator className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
                  )}
                </div>
                <div className="relative z-10">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tight text-[#0A006E]">
                    ACCOUNTS
                  </h2>
                </div>
              </div>
            </div>

            {/* BOX 3: STAFFS (2x Square - Tapping switches on-screen to Departments) */}
            <div className="flex flex-col items-center">
              <div
                onClick={handleOpenStaffDepartments}
                className={`w-full group aspect-square rounded-3xl p-8 flex flex-col items-center justify-center gap-6 text-center cursor-pointer border-3 relative overflow-hidden transition-all duration-300 hover:-translate-y-3 hover:scale-[1.04] hover:shadow-[0_28px_56px_-12px_rgba(52,209,134,0.5)] ${
                  selectedBox === 'Staff'
                    ? 'bg-[#F0F2F0] text-slate-900 border-[#34D186] shadow-2xl ring-4 ring-[#34D186]/35'
                    : 'bg-[#F0F2F0] text-slate-900 border-slate-300 hover:border-[#0A006E] hover:bg-emerald-50/40'
                }`}
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#34D186] text-[#0A006E] flex items-center justify-center shadow-xl border-3 border-[#0A006E] shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 relative z-10">
                  <KeyRound className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tight text-[#0A006E]">
                    STAFFS
                  </h2>
                </div>
              </div>
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

        {/* VIEW 2.5: ON-SCREEN BRANCH SELECTION FOR CHOSEN DEPARTMENT */}
        {screenView === 'branches' && selectedDepartment && (
          <div className="max-w-5xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <button
                type="button"
                onClick={() => setScreenView('departments')}
                className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-[#0A006E] font-montserrat font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Departments
              </button>

              <div className="text-center">
                <span className="text-[10px] font-montserrat font-bold text-slate-500 uppercase tracking-widest block">
                  STEP 2 OF 3 · SELECT BRANCH STATION
                </span>
                <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
                  {activeDeptMeta?.title || selectedDepartment}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleBypassToPin}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[#0A006E] font-montserrat font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Direct PIN entry"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Direct PIN
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs font-montserrat font-semibold text-slate-600">
                  Select your operational branch to view staff assigned to this station:
                </p>
                <span className="text-xs font-montserrat font-bold text-[#0A006E]">
                  {totalDepartmentStaffCount} Active {selectedDepartment} Staff Systemwide
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* All Branches Option */}
                <div
                  onClick={() => handleSelectBranch('all', 'All Operational Branches')}
                  className="group bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-[#0A006E] rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-[#0A006E] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Users className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <div>
                        <h4 className="font-montserrat font-bold text-slate-900 text-base group-hover:text-[#0A006E]">
                          All Branches
                        </h4>
                        <span className="text-xs text-slate-500 font-medium">
                          Roster across all stations
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0A006E]/10 text-[#0A006E]">
                      All
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-montserrat font-bold text-[#0A006E]">
                    <span>{totalDepartmentStaffCount} Staff Total</span>
                    <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      View All →
                    </span>
                  </div>
                </div>

                {/* Individual Operational Branches */}
                {departmentBranches.map((branch) => (
                  <div
                    key={branch.id}
                    onClick={() => handleSelectBranch(branch.id, branch.name)}
                    className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#0A006E] rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-[#0A006E] text-[#0A006E] group-hover:text-white flex items-center justify-center shrink-0 shadow-xs transition-colors">
                          <Building2 className="w-6 h-6 stroke-[2.2]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-montserrat font-bold text-slate-900 text-base truncate group-hover:text-[#0A006E]">
                            {branch.name}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-slate-500 truncate mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{branch.regionName || branch.code || 'Active Station'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {branch.isMain && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFDE00] text-[#0A006E] border border-amber-300 shadow-2xs">
                            <Building2 className="w-2.5 h-2.5" />
                            HQ · MAIN BRANCH
                          </span>
                        )}
                        {branch.count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            {branch.count} Staff
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 shrink-0">
                            0 Staff
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-montserrat font-bold text-[#0A006E]">
                      <span className="text-slate-500 font-mono text-[11px]">
                        {branch.code || 'Branch'}
                      </span>
                      <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Select Branch →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: ON-SCREEN EXISTING USER SELECTION FOR CHOSEN DEPARTMENT & BRANCH */}
        {screenView === 'users' && selectedDepartment && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <button
                type="button"
                onClick={() => setScreenView('branches')}
                className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-[#0A006E] font-montserrat font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Branches
              </button>

              <div className="text-center">
                <span className="text-[10px] font-montserrat font-bold text-slate-500 uppercase tracking-widest block">
                  STEP 3 OF 3 · SELECT YOUR NAME
                </span>
                <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
                  {activeDeptMeta?.title || selectedDepartment}
                </h2>
                {selectedBranchName && (
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-montserrat font-bold bg-[#0A006E]/10 text-[#0A006E]">
                      <MapPin className="w-3 h-3 text-[#0A006E]" />
                      <span>{selectedBranchName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setScreenView('branches')}
                      className="text-[11px] font-montserrat font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Change Branch
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleBypassToPin}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[#0A006E] font-montserrat font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Enter PIN without selecting a specific profile"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Direct PIN
              </button>
            </div>

            {departmentUsers.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-10 text-center space-y-4 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-xs">
                  <Users className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-montserrat font-black text-slate-900">
                    No Active {selectedDepartment} Staff at this Branch
                  </h3>
                  <p className="text-xs text-slate-600">
                    No active staff accounts for <strong>{selectedDepartment}</strong> are currently provisioned under{' '}
                    <strong>{selectedBranchName || 'this branch'}</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setScreenView('branches')}
                    className="px-4 py-2.5 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer shadow-xs hover:bg-[#070050] transition"
                  >
                    Select Different Branch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBranch('all', 'All Operational Branches')}
                    className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer hover:bg-slate-100 transition"
                  >
                    View All Branches
                  </button>
                  <button
                    type="button"
                    onClick={handleBypassToPin}
                    className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer hover:bg-slate-200 transition"
                  >
                    Enter PIN Directly
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-montserrat font-semibold text-slate-600">
                  Select your name from the {departmentUsers.length} staff member{departmentUsers.length === 1 ? '' : 's'} at <strong>{selectedBranchName || 'this branch'}</strong>:
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
                        className="group bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#0A006E] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-[#0A006E] text-white font-montserrat font-black text-sm flex items-center justify-center shrink-0 border border-slate-200 shadow-xs group-hover:scale-105 transition-transform">
                              {initials || 'ST'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-montserrat font-bold text-slate-900 text-sm sm:text-base truncate group-hover:text-[#0A006E]">
                                {user.name}
                              </h4>
                              <div className="flex items-center gap-1 text-xs text-slate-500 truncate mt-0.5">
                                <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                <span className="truncate">{user.branchName}</span>
                              </div>
                            </div>
                          </div>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Active
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {user.lastLoginAt
                              ? new Date(user.lastLoginAt).toLocaleDateString()
                              : 'Ready'}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="font-montserrat font-bold text-[#0A006E] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs">
                              Enter PIN →
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: ENHANCED, SIMPLE & FAST PIN LOGIN WINDOW (WIDE LANDSCAPE LAYOUT) */}
        {screenView === 'pin' && (
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            {/* Top Navigation & Context */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  lastSubmittedPinRef.current = '';
                  setPinDigits('');
                  if (selectedDepartment) {
                    setScreenView('users');
                  } else {
                    setScreenView('departments');
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-montserrat font-semibold text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{selectedDepartment ? 'Back to Staff List' : 'Back to Departments'}</span>
              </button>

              <div className="flex items-center gap-2 text-xs font-montserrat font-bold text-slate-500">
                <Lock className="w-4 h-4 text-[#0A006E]" />
                <span className="uppercase tracking-wider">Staff PIN Terminal</span>
              </div>
            </div>

            {/* Hidden Input capturing physical keyboard & mobile soft keypad */}
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
              }}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              className="sr-only"
              aria-label="6-Digit Staff Security PIN Input"
            />

            {/* Landscape Wide Two-Column Presentation (Width is noticeably wider than height) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Left Column (5 of 12 cols): Staff Profile, PIN Indicators & Fast Actions */}
              <div className="md:col-span-5 space-y-4">
                {/* Staff Profile Card */}
                {selectedUser ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#0A006E] text-white font-montserrat font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {selectedUser.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0].toUpperCase())
                          .join('') || 'ST'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-montserrat font-bold text-slate-900 truncate flex items-center gap-2">
                          <span>{selectedUser.name}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Active Account" />
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                          {selectedUser.role} · {selectedUser.branchName}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        lastSubmittedPinRef.current = '';
                        setPinDigits('');
                        setScreenView('users');
                      }}
                      className="px-2.5 py-1 text-xs font-montserrat font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Switch
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-montserrat font-semibold text-slate-500 uppercase tracking-wide">
                        Department Terminal
                      </div>
                      <div className="text-sm font-montserrat font-bold text-slate-900">
                        {activeDeptMeta?.title || selectedDepartment || 'All Departments'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        lastSubmittedPinRef.current = '';
                        setPinDigits('');
                        setScreenView('departments');
                      }}
                      className="px-2.5 py-1 text-xs font-montserrat font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}


                {/* 6-Digit PIN Indicators Display */}
                <div
                  onClick={() => {
                    pinInputRef.current?.focus();
                    setIsInputFocused(true);
                  }}
                  className={`p-4 rounded-2xl bg-slate-50 border transition-all cursor-text space-y-3 ${
                    isInputFocused
                      ? 'border-[#0A006E] ring-2 ring-[#0A006E]/15'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-montserrat font-semibold text-slate-600 px-1">
                    <span>Security PIN Status</span>
                    <span className="font-mono text-slate-500">{pinDigits.length} / 6 Digits</span>
                  </div>

                  {/* 6 Clean Indicators: Uniform, Monochromatic Navy/Slate, No Mixed Rainbow Colors */}
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-1.5">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const filled = idx < pinDigits.length;
                      const isCurrent = idx === pinDigits.length;
                      return (
                        <div
                          key={idx}
                          className={`w-10 h-12 sm:w-11 sm:h-13 rounded-xl flex items-center justify-center font-mono font-bold text-lg border transition-all select-none ${
                            filled
                              ? 'border-[#0A006E] bg-[#0A006E] text-white shadow-xs scale-102'
                              : isCurrent
                              ? 'border-[#0A006E] bg-white ring-2 ring-[#0A006E]/20 text-[#0A006E]'
                              : 'border-slate-200 bg-white text-slate-300'
                          }`}
                        >
                          {filled ? (
                            <span className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs" />
                          ) : isCurrent ? (
                            <span className="w-1.5 h-5 bg-[#0A006E] animate-pulse rounded-full" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-montserrat pt-1 border-t border-slate-200/80">
                    <span className="flex items-center gap-1.5">
                      <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                      <span>Physical keyboard (0–9)</span>
                    </span>
                    <span className="text-slate-400 font-medium">Auto-submits on 6th digit</span>
                  </div>
                </div>

                {/* Inline Authentication Error with Quick Clear */}
                {authError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2 font-montserrat font-medium">
                    <div className="flex items-center gap-2 min-w-0">
                      <AnimatedErrorPromptIcon size="sm" />
                      <span className="truncate">{authError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2 py-0.5 rounded text-[11px] font-bold text-red-700 hover:bg-red-100 underline cursor-pointer shrink-0"
                    >
                      Clear PIN
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column (7 of 12 cols): Keypad & Primary Unlock Button */}
              <div className="md:col-span-7 space-y-4">
                {/* Clean, Uniform Numeric Keypad (Single Slate Theme, No Jarring Red or Yellow) */}
                <div className="grid grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleDigitPress(digit)}
                      className="py-3 sm:py-3.5 rounded-xl font-montserrat font-bold text-xl sm:text-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-200 transition active:scale-95 shadow-2xs flex items-center justify-center select-none cursor-pointer"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-3 sm:py-3.5 rounded-xl font-montserrat font-semibold text-xs sm:text-sm uppercase bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 transition active:scale-95 flex items-center justify-center select-none cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDigitPress('0')}
                    className="py-3 sm:py-3.5 rounded-xl font-montserrat font-bold text-xl sm:text-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-800 border border-slate-200 transition active:scale-95 shadow-2xs flex items-center justify-center select-none cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-3 sm:py-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 transition active:scale-95 flex items-center justify-center cursor-pointer select-none"
                    aria-label="Backspace"
                  >
                    <Delete className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>

                {/* Clean Primary Unlock Button (Unified Brand Navy) */}
                <button
                  type="button"
                  disabled={pinDigits.length !== 6 || isSubmitting}
                  onClick={() => {
                    if (pinDigits.length === 6 && !isSubmitting) {
                      lastSubmittedPinRef.current = pinDigits;
                      onPinLogin(
                        pinDigits,
                        selectedDepartment || undefined,
                        selectedUser?.id || undefined
                      );
                    }
                  }}
                  className="w-full py-3.5 px-4 bg-[#0A006E] hover:bg-[#070050] disabled:opacity-40 text-white font-montserrat font-bold text-sm sm:text-base rounded-xl transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying PIN...</span>
                    </>
                  ) : selectedUser ? (
                    <>
                      <Lock className="w-4 h-4 text-white" />
                      <span>Unlock as {selectedUser.name}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-white" />
                      <span>Unlock {activeDeptMeta?.title || 'Terminal'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Signature Curved Single-Wave Footer */}
      <footer className="relative bg-[#0A006E] text-white pt-8 sm:pt-10 pb-6 px-4 sm:px-8 mt-auto shrink-0 shadow-2xl">
        {/* Single Smooth Curved Wave Top Edge */}
        <svg
          className="absolute top-0 left-0 w-full h-7 sm:h-9 -translate-y-[96%] pointer-events-none block overflow-visible"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,55 C480,-5 960,95 1440,35 L1440,80 L0,80 Z"
            fill="#0A006E"
          />
          <path
            d="M0,55 C480,-5 960,95 1440,35"
            fill="none"
            stroke="#FFDE00"
            strokeWidth="5"
          />
        </svg>

        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 text-[#FFDE00] flex items-center justify-center border border-white/20">
              <Wine className="w-4 h-4" />
            </div>
            <div>
              <span className="font-montserrat font-black italic text-sm tracking-tight text-white">
                VAAIRO <span className="text-[#FFDE00] not-italic text-[10px] font-bold">ERP SYSTEM</span>
              </span>
              <p className="text-[11px] text-slate-300">
                Enterprise Cloud Commerce &amp; Beverage Distribution Terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-200 font-montserrat">
            <span className="font-medium text-slate-300">Powered by</span>
            <a
              href="https://urbantechdev.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFDE00] hover:bg-[#FFE833] text-[#0A006E] font-black transition-all shadow-sm hover:shadow active:scale-95 group cursor-pointer"
            >
              <span>urbantechdev</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
