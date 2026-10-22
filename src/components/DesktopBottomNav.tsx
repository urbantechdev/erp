/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Store,
  Briefcase,
  Package,
  Building2,
  MapPin,
  Users,
  FileText,
  ShieldCheck,
  UserPlus,
  Activity,
  ShoppingBag,
  LayoutGrid,
  X,
  Sparkles,
  ExternalLink,
  Maximize2,
  Minimize2,
  UtensilsCrossed,
  Truck,
  UserCircle,
  Search,
  Printer,
  Smartphone,
  CreditCard,
  Volume2,
  VolumeX,
  Coins,
  Shield,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { ERPModuleId, StaffMember, Branch, Product, TransactionDoc } from '../types';
import { formatKes, exportToCSV } from '../erpUtils';
import { isAudioMuted, toggleAudioMuted, playPosBeep } from '../utils/audioBeep';

interface DesktopBottomNavProps {
  activeModule: ERPModuleId;
  onSelectModule: (modId: ERPModuleId) => void;
  allowedModules: ERPModuleId[];
  currentUser: StaffMember;
  activeBranch?: Branch | null;
  products?: Product[];
  transactions?: TransactionDoc[];
  onOpenCustomerPortal?: () => void;
  onOpenAccessMatrix?: () => void;
  onOpenOnboardItems?: () => void;
  onOpenPhoneScanner?: () => void;
  onQuickPrintLastDoc?: () => void;
  onOpenPayslip?: () => void;
  onTriggerToast?: (type: 'success' | 'error', title: string, message: string) => void;
}

const MODULE_NAV_DEFINITIONS: Record<
  ERPModuleId,
  {
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  overview: { label: 'Executive Overview', shortLabel: 'Dashboard', icon: LayoutDashboard },
  retail_pos: { label: 'Retail Counter POS', shortLabel: 'Retail POS', icon: Store },
  sales_pos: { label: 'B2B Wholesale POS', shortLabel: 'Sales POS', icon: Briefcase },
  inventory: { label: 'Inventory (IPS/LPS)', shortLabel: 'Inventory', icon: Package },
  branches_transfers: { label: 'Branches & Transfers', shortLabel: 'Branches', icon: Building2 },
  geo_pricing: { label: 'Geo-Location Pricing', shortLabel: 'Geo-Price', icon: MapPin },
  partners: { label: 'Partners & Logistics', shortLabel: 'Partners', icon: Users },
  documents_credit: { label: 'Docs & Credit Notes', shortLabel: 'Docs', icon: FileText },
  compliance: { label: 'Regulatory & Excise', shortLabel: 'Compliance', icon: ShieldCheck },
  hr_rbac: { label: 'HR & Role Provisioning', shortLabel: 'HR & Roles', icon: UserPlus },
  payroll: { label: 'Staff Payroll & PAYE/NSSF', shortLabel: 'Payroll', icon: Coins },
  audit_security: { label: 'Security & Audit Logs', shortLabel: 'Security', icon: Activity },
  customer_portal: { label: 'Customer Online Store', shortLabel: 'Online Store', icon: ShoppingBag },
  outlets_restaurants: { label: 'Branch Outlets & Restaurants', shortLabel: 'Outlets', icon: UtensilsCrossed },
  external_customers: { label: 'External Customers', shortLabel: 'Customers', icon: UserCircle },
  delivery_management: { label: 'Delivery & Dispatch Operations', shortLabel: 'Deliveries', icon: Truck },
};

export const DesktopBottomNav: React.FC<DesktopBottomNavProps> = ({
  activeModule,
  onSelectModule,
  allowedModules,
  currentUser,
  activeBranch,
  products = [],
  transactions = [],
  onOpenCustomerPortal,
  onOpenAccessMatrix,
  onOpenOnboardItems,
  onOpenPhoneScanner,
  onQuickPrintLastDoc,
  onOpenPayslip,
  onTriggerToast,
}) => {
  const [isMobileModulesSheetOpen, setIsMobileModulesSheetOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => isAudioMuted());
  const [isQuickSkuSearchOpen, setIsQuickSkuSearchOpen] = useState(false);
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [isDrawerFloatOpen, setIsDrawerFloatOpen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      if (typeof document !== 'undefined') {
        setIsFullscreen(Boolean(document.fullscreenElement));
      }
    };
    handleFsChange();
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Browser permissions fallback
    }
  };

  const handleToggleSound = () => {
    const nextState = toggleAudioMuted();
    setSoundMuted(nextState);
    if (!nextState) {
      playPosBeep('success');
      onTriggerToast?.('success', 'Audio Enabled', 'Barcode scan and POS sound alerts are now active.');
    } else {
      onTriggerToast?.('success', 'Audio Muted', 'Terminal sound beeps are muted for silent operation.');
    }
  };

  const handleReplaySplash = () => {
    setIsMobileModulesSheetOpen(false);
    window.dispatchEvent(new CustomEvent('vaairo-replay-splash'));
  };

  // Filter today's transactions for quick financial snapshot
  const todayTransactions = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return transactions.filter((tx) => tx.createdAt?.startsWith(todayStr));
  }, [transactions]);

  const todayMetrics = useMemo(() => {
    let gross = 0;
    let cash = 0;
    let mpesa = 0;
    let card = 0;
    let orders = 0;

    todayTransactions.forEach((tx) => {
      if (tx.docType === 'Receipt' || tx.docType === 'Invoice' || tx.docType === 'Online Order') {
        gross += tx.totalAmount || 0;
        orders++;
        const meth = (tx.paymentMethod || '').toLowerCase();
        if (meth.includes('cash')) cash += tx.totalAmount || 0;
        else if (meth.includes('mpesa') || meth.includes('m-pesa')) mpesa += tx.totalAmount || 0;
        else card += tx.totalAmount || 0;
      }
    });

    return { gross, cash, mpesa, card, orders };
  }, [todayTransactions]);

  // Filter today's transactions specifically for this logged-in user
  const userTodayTransactions = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const userName = (currentUser.name || '').toLowerCase().trim();
    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const userId = (currentUser.id || '').toLowerCase().trim();

    return transactions.filter((tx) => {
      if (!tx.createdAt?.startsWith(todayStr)) return false;
      const createdBy = (tx.createdBy || '').toLowerCase().trim();
      const affCode = (tx.affiliateCode || '').toLowerCase().trim();
      return (
        (userName && createdBy === userName) ||
        (userEmail && createdBy === userEmail) ||
        (userId && (createdBy === userId || affCode === userId || affCode.includes(userId)))
      );
    });
  }, [transactions, currentUser]);

  const userTodayMetrics = useMemo(() => {
    let gross = 0;
    let orders = 0;

    userTodayTransactions.forEach((tx) => {
      if (tx.docType === 'Receipt' || tx.docType === 'Invoice' || tx.docType === 'Online Order') {
        gross += tx.totalAmount || 0;
        orders++;
      }
    });

    return { gross, orders };
  }, [userTodayTransactions]);

  // Quick SKU search results
  const filteredSkus = useMemo(() => {
    if (!skuSearchQuery.trim()) return products.slice(0, 12);
    const q = skuSearchQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      )
      .slice(0, 24);
  }, [products, skuSearchQuery]);

  const handleExportTodayCsv = () => {
    if (todayTransactions.length === 0) {
      onTriggerToast?.('error', 'No Sales Today', 'No sales transactions recorded for today yet.');
      return;
    }
    exportToCSV(
      `Daily_Sales_Audit_${new Date().toISOString().slice(0, 10)}`,
      ['Doc Number', 'Type', 'Channel', 'Branch', 'Customer', 'Payment Method', 'Amount (KES)', 'Status', 'Timestamp'],
      todayTransactions.map((tx) => [
        tx.docNumber,
        tx.docType,
        tx.channel,
        tx.branchName,
        tx.customerName,
        tx.paymentMethod,
        Math.round(tx.totalAmount).toString(),
        tx.status,
        tx.createdAt,
      ])
    );
    onTriggerToast?.('success', 'Report Exported', 'Daily sales audit manifest downloaded as CSV.');
  };

  const visibleNavItems = allowedModules.map((id) => ({
    id,
    ...MODULE_NAV_DEFINITIONS[id],
  }));

  const userRole = currentUser.role;

  return (
    <>
      {/* =====================================================================
          MOBILE ERP APP BOTTOM NAVIGATION BAR (< md) — CURVED WAVE TOP EDGE
          ===================================================================== */}
      <nav
        aria-label="Mobile ERP Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-[48] bg-white shadow-[0_-8px_28px_rgba(10,0,110,0.18)] select-none"
      >
        {/* Single Wave Design at the top edge of Mobile Bottom Nav */}
        <div className="absolute left-0 right-0 -top-6 w-full leading-none pointer-events-none z-30">
          <svg
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            className="w-full h-6 block drop-shadow-[0_-5px_10px_rgba(10,0,110,0.10)]"
          >
            <path d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z" fill="#ffffff" />
            <path
              d="M0,22 C340,68 760,2 1200,54"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Mobile Ergonomic 5-Slot Action Bar */}
        <div className="relative z-30 grid grid-cols-5 h-16 items-center px-1">
          {/* Slot 1: Role Primary Cockpit */}
          <button
            type="button"
            onClick={() => {
              onSelectModule('overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
              activeModule === 'overview' ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
            }`}
          >
            <LayoutDashboard
              className={`w-5 h-5 ${activeModule === 'overview' ? 'text-[#0A006E]' : 'text-slate-400'}`}
            />
            <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">Overview</span>
          </button>

          {/* Slot 2: Rapid SKU Search */}
          <button
            type="button"
            onClick={() => setIsQuickSkuSearchOpen(true)}
            className="flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer text-slate-500 hover:text-[#0A006E]"
          >
            <Search className="w-5 h-5 text-slate-400 hover:text-[#0A006E]" />
            <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">Price Check</span>
          </button>

          {/* Slot 3: Elevated Center Action - Wireless Phone Scanner Companion */}
          <div className="flex flex-col items-center justify-center relative">
            <button
              type="button"
              onClick={() => {
                if (onOpenPhoneScanner) {
                  onOpenPhoneScanner();
                } else {
                  onSelectModule('retail_pos');
                }
              }}
              aria-label="Handheld Wireless Scanner"
              className="relative w-13 h-13 -mt-4 rounded-full border-2 border-[#FFDE00] ring-4 ring-white shadow-[0_-4px_16px_rgba(10,0,110,0.4)] flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 cursor-pointer bg-gradient-to-tr from-[#0A006E] to-[#1E3A8A] text-white"
            >
              <Smartphone className="w-5 h-5 text-[#FFDE00]" />
              <span className="text-[8px] font-montserrat font-black uppercase tracking-wider text-white leading-none">
                Scan
              </span>
            </button>
          </div>

          {/* Slot 4: Role-Specific Action (Access Matrix for Admin, Drawer for Cashier) */}
          {userRole === 'Admin' ? (
            <button
              type="button"
              onClick={() => onOpenAccessMatrix?.()}
              className="flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer text-[#0A006E]"
            >
              <Shield className="w-5 h-5 text-[#0A006E]" />
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">8-Roles</span>
            </button>
          ) : userRole === 'Counter Cashier' ? (
            <button
              type="button"
              onClick={() => setIsDrawerFloatOpen(true)}
              className="flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer text-[#0A006E]"
            >
              <Coins className="w-5 h-5 text-[#0A006E]" />
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">Float</span>
            </button>
          ) : userRole === 'Accountant' ? (
            <button
              type="button"
              onClick={handleExportTodayCsv}
              className="flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer text-[#0A006E]"
            >
              <FileSpreadsheet className="w-5 h-5 text-[#0A006E]" />
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">Export</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onQuickPrintLastDoc?.()}
              className="flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer text-[#0A006E]"
            >
              <Receipt className="w-5 h-5 text-[#0A006E]" />
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">Reprint</span>
            </button>
          )}

          {/* Slot 5: Full Modules Drawer Sheet */}
          <button
            type="button"
            onClick={() => setIsMobileModulesSheetOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer relative ${
              isMobileModulesSheetOpen ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
            }`}
          >
            <LayoutGrid className="w-5 h-5 text-slate-400" />
            <span className="text-[10px] font-montserrat font-bold">
              {isMobileModulesSheetOpen ? 'Close' : 'Menu'}
            </span>
          </button>
        </div>
      </nav>

      {/* =====================================================================
          DESKTOP DOCK NAVIGATION BAR (md+) — CURVED WAVE TOP EDGE
          SHOWS UNIQUE ROLE-SPECIFIC COMMAND CONTROLS (NO DUPLICATE SIDEBAR)
          ===================================================================== */}
      <nav
        aria-label="Desktop ERP Operational Dock"
        className="hidden md:flex relative sticky bottom-0 z-30 bg-white px-4 sm:px-6 h-20 min-h-[5rem] items-center justify-between shadow-[0_-8px_24px_rgba(10,0,110,0.08)] select-none"
      >
        {/* Single Wave Design at the top edge */}
        <div className="absolute left-0 right-0 -top-8 sm:-top-9 w-full leading-none pointer-events-none z-30">
          <svg
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            className="w-full h-8 sm:h-9 block drop-shadow-[0_-5px_10px_rgba(10,0,110,0.08)]"
          >
            <path d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z" fill="#ffffff" />
            <path
              d="M0,22 C340,68 760,2 1200,54"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="w-full max-w-[100rem] mx-auto flex items-center justify-between gap-4 relative z-20">
          {/* Left: Role Operational Badge & Live Branch Status */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Logged-In User Total Sale Today */}
            <div
              title={`Total sales entered today by ${currentUser.name}`}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A006E] text-white border-2 border-[#FFDE00] text-xs font-montserrat shadow-xs"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#FFDE00] shrink-0" />
              <span>
                My Sales Today:{' '}
                <strong className="font-mono-tabular font-black text-[#FFDE00]">
                  {formatKes(userTodayMetrics.gross)}
                </strong>{' '}
                <span className="text-[10px] text-white/80 font-mono">
                  ({userTodayMetrics.orders})
                </span>
              </span>
            </div>

            {/* Quick Live Figures Chip (Total Branch / Daily Register) */}
            <button
              type="button"
              onClick={() => setIsDrawerFloatOpen(true)}
              title="Click to view total daily register totals"
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-montserrat transition cursor-pointer shadow-2xs"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                Branch Today: <strong className="font-mono-tabular font-bold text-slate-900">{formatKes(todayMetrics.gross)}</strong> ({todayMetrics.orders})
              </span>
            </button>
          </div>

          {/* Center: UNIQUE ROLE-TAILORED ACTION BUTTONS (NO DUPLICATION OF SIDE MENU!) */}
          <div className="flex items-center gap-2 lg:gap-2.5 overflow-x-auto scrollbar-none py-1">
            {/* 1. ADMIN EXCLUSIVE UNIQUE BUTTONS */}
            {userRole === 'Admin' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAccessMatrix?.()}
                  title="Statutory 8-Role Access Model Permissions Matrix"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#0A006E] border-2 border-[#0A006E]/30 text-xs font-montserrat font-black transition cursor-pointer shadow-2xs hover:border-[#0A006E]"
                >
                  <Shield className="w-4 h-4 text-[#0A006E] shrink-0" />
                  <span className="whitespace-nowrap">Access Matrix</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenOnboardItems?.()}
                  title="Activate new SKU stock & batch allocations"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border-2 border-emerald-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Layers className="w-4 h-4 text-[#1E9E60] shrink-0" />
                  <span className="whitespace-nowrap">Stock Inward</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPhoneScanner?.()}
                  title="Connect smartphone as wireless barcode scanner"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Smartphone className="w-4 h-4 text-violet-700 shrink-0" />
                  <span className="whitespace-nowrap">Phone Scanner</span>
                </button>

                <button
                  type="button"
                  onClick={() => onQuickPrintLastDoc?.()}
                  title="Reprint the latest fiscal receipt or invoice"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Receipt className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="whitespace-nowrap">Last Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDrawerFloatOpen(true)}
                  title="View drawer float and cash/mpesa/card split"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Coins className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="whitespace-nowrap">Drawer Float</span>
                </button>
              </>
            )}

            {/* 2. COUNTER CASHIER UNIQUE BUTTONS */}
            {userRole === 'Counter Cashier' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenPhoneScanner?.()}
                  title="Pair your phone camera to scan bottle barcodes straight into POS"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#150099] text-[#FFDE00] border-2 border-[#FFDE00] text-xs font-montserrat font-black transition cursor-pointer shadow-md"
                >
                  <Smartphone className="w-4 h-4 text-[#FFDE00] shrink-0" />
                  <span className="whitespace-nowrap">Phone Scanner</span>
                </button>

                <button
                  type="button"
                  onClick={() => onQuickPrintLastDoc?.()}
                  title="Reprint the most recent customer sale receipt"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-[#1E9E60] shrink-0" />
                  <span className="whitespace-nowrap">Reprint Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDrawerFloatOpen(true)}
                  title="Check cash drop & payment reconciliation"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Coins className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="whitespace-nowrap">Cash Float</span>
                </button>
              </>
            )}

            {/* 3. INVENTORY CONTROLLER & BRANCH MANAGER UNIQUE BUTTONS */}
            {(userRole === 'Inventory Controller' || userRole === 'Branch Manager') && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenOnboardItems?.()}
                  title="Activate received inventory consignments"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border-2 border-emerald-300 text-xs font-montserrat font-black transition cursor-pointer shadow-2xs"
                >
                  <Layers className="w-4 h-4 text-[#1E9E60] shrink-0" />
                  <span className="whitespace-nowrap">Stock Inward</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPhoneScanner?.()}
                  title="Open barcode auditor camera companion"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Smartphone className="w-4 h-4 text-violet-700 shrink-0" />
                  <span className="whitespace-nowrap">Audit Scanner</span>
                </button>

                <button
                  type="button"
                  onClick={() => onQuickPrintLastDoc?.()}
                  title="Reprint last dispatch or invoice manifest"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Receipt className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="whitespace-nowrap">Last Manifest</span>
                </button>
              </>
            )}

            {/* 4. ACCOUNTANT UNIQUE BUTTONS */}
            {userRole === 'Accountant' && (
              <>
                <button
                  type="button"
                  onClick={() => onQuickPrintLastDoc?.()}
                  title="Preview latest commercial invoice or credit note"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#0A006E] border border-indigo-200 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Receipt className="w-4 h-4 text-[#0A006E] shrink-0" />
                  <span className="whitespace-nowrap">Last Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTodayCsv}
                  title="Export today's fiscal transactions to CSV"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#1E9E60] shrink-0" />
                  <span className="whitespace-nowrap">Export Daily CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDrawerFloatOpen(true)}
                  title="Settlement audit across Cash, M-Pesa & Card"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Coins className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="whitespace-nowrap">Settlements</span>
                </button>
              </>
            )}

            {/* 5. HR UNIQUE BUTTONS */}
            {userRole === 'HR' && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectModule('hr_rbac')}
                  title="Add new staff member"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#0A006E] border border-indigo-200 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <UserPlus className="w-4 h-4 text-[#0A006E] shrink-0" />
                  <span className="whitespace-nowrap">Add Staff</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPayslip?.()}
                  title="View your official thermal payslip"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-[#1E9E60] shrink-0" />
                  <span className="whitespace-nowrap">Thermal Payslip</span>
                </button>
              </>
            )}

            {/* 6. SALES MANAGER / AFFILIATE UNIQUE BUTTONS */}
            {(userRole === 'Sales Manager' || userRole === 'Affiliate Sales Representative') && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenPhoneScanner?.()}
                  title="Handheld bottle scanner"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Smartphone className="w-4 h-4 text-violet-700 shrink-0" />
                  <span className="whitespace-nowrap">Phone Scanner</span>
                </button>

                <button
                  type="button"
                  onClick={() => onQuickPrintLastDoc?.()}
                  title="Reprint last invoice"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
                >
                  <Receipt className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="whitespace-nowrap">Last Doc</span>
                </button>
              </>
            )}

            {/* UNIVERSAL SHARED BUTTON: QUICK PRICE & STOCK VERIFICATION */}
            <button
              type="button"
              onClick={() => setIsQuickSkuSearchOpen(true)}
              title="Quickly search any SKU price, taxes & bottle stock"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
            >
              <Search className="w-4 h-4 text-blue-700 shrink-0" />
              <span className="whitespace-nowrap">Price Check</span>
            </button>
          </div>

          {/* Right: Pinned System Utilities */}
          <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-slate-200">
            {/* Customer Online Store Portal Launcher */}
            {onOpenCustomerPortal && (
              <button
                type="button"
                onClick={onOpenCustomerPortal}
                title="Launch Customer Online Storefront Preview"
                aria-label="Customer Online Store"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
              >
                <ShoppingBag className="w-4 h-4 text-[#1E9E60] shrink-0" />
                <span className="hidden xl:inline">Storefront</span>
              </button>
            )}

            {/* Audio Mute / Unmute Button */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundMuted ? 'Unmute Terminal Audio' : 'Mute Terminal Audio'}
              aria-label="Toggle Sound"
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition cursor-pointer border ${
                soundMuted
                  ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Replay Splash Screen Action */}
            <button
              type="button"
              onClick={handleReplaySplash}
              title="Replay Brand Splash Screen Animation"
              aria-label="Replay Splash Screen"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label="Toggle Fullscreen"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-slate-700" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Powered by urbantechdev branding */}
            <div className="hidden 2xl:flex items-center pl-1 shrink-0">
              <a
                href="https://urbantechdev.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-[#0A006E] transition shadow-2xs group"
                title="Powered by urbantechdev"
              >
                <span className="text-[11px] font-medium">
                  Powered by <strong className="font-montserrat font-bold text-slate-800 group-hover:text-[#0A006E]">urbantechdev</strong>
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#0A006E]" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* =====================================================================
          QUICK SKU PRICE & STOCK CHECK MODAL / POPOVER
          ===================================================================== */}
      {isQuickSkuSearchOpen && (
        <div
          onClick={() => setIsQuickSkuSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border-2 border-[#0A006E] shadow-2xl animate-in zoom-in-95"
          >
            {/* Header */}
            <div className="p-4 bg-[#0A006E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-[#FFDE00]" />
                <h3 className="font-montserrat font-black text-sm text-[#FFDE00]">
                  Instant SKU Price & Stock Lookup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickSkuSearchOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  placeholder="Search by bottle name, SKU, brand, or barcode..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-200 focus:border-[#0A006E] rounded-xl text-sm font-montserrat font-semibold outline-none transition"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-montserrat pt-2 px-1">
                <span>Showing {filteredSkus.length} matched SKUs</span>
                <span>Active Branch: {activeBranch?.name || 'All'}</span>
              </div>
            </div>

            {/* Results List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
              {filteredSkus.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-montserrat">
                  <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold">No matching liquor products found</p>
                  <p className="text-xs">Try a different name, keyword, or barcode number.</p>
                </div>
              ) : (
                filteredSkus.map((prod) => (
                  <div key={prod.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {prod.sku}
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 px-1.5 py-0.5 rounded bg-amber-50">
                          {prod.category}
                        </span>
                        {prod.barcode && (
                          <span className="text-[10px] font-mono-tabular text-slate-400 hidden sm:inline">
                            EAN: {prod.barcode}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-montserrat font-bold text-slate-900 truncate pt-0.5">
                        {prod.name}
                      </div>
                      <div className="text-xs text-slate-500 font-montserrat">
                        Volume: {prod.volumeMl}ml · Pack: {prod.packSize || 12} bottles · Origin: {prod.countryOfOrigin || 'Imported'}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono-tabular font-black text-[#0A006E]">
                        Retail: {formatKes(prod.retailPriceKes || prod.baseRetailPrice || 0)}
                      </div>
                      <div className="text-xs font-mono-tabular text-slate-600">
                        Wholesale: {formatKes(prod.wholesalePriceKes || prod.baseWholesalePrice || 0)}
                      </div>
                      <div className="text-[11px] font-montserrat font-bold text-emerald-700">
                        Stock: {prod.totalBottles ?? 0} bottles
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-montserrat text-slate-500">
              <span>Press ESC or click close to dismiss</span>
              <button
                type="button"
                onClick={() => setIsQuickSkuSearchOpen(false)}
                className="px-4 py-1.5 bg-[#0A006E] text-white rounded-xl font-bold cursor-pointer hover:bg-[#150099] transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRAWER FLOAT & SHIFT RECONCILIATION SUMMARY MODAL
          ===================================================================== */}
      {isDrawerFloatOpen && (
        <div
          onClick={() => setIsDrawerFloatOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border-2 border-[#0A006E] shadow-2xl animate-in zoom-in-95"
          >
            {/* Header */}
            <div className="p-4 bg-[#0A006E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#FFDE00]" />
                <h3 className="font-montserrat font-black text-sm text-[#FFDE00]">
                  Register Drawer & Shift Reconciliation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerFloatOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 font-montserrat">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-xs font-black uppercase text-amber-800 tracking-wider">
                  Today's Cumulative Sales Volume
                </div>
                <div className="text-2xl font-mono-tabular font-black text-[#0A006E] pt-1">
                  {formatKes(todayMetrics.gross)}
                </div>
                <div className="text-xs text-amber-900 font-semibold pt-0.5">
                  Across {todayMetrics.orders} completed sale transactions
                </div>
              </div>

              {/* Payment Split Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-[10px] font-black uppercase text-slate-500">Cash Float</div>
                  <div className="text-sm font-mono-tabular font-bold text-slate-900 pt-1">
                    {formatKes(todayMetrics.cash)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[10px] font-black uppercase text-emerald-700">M-Pesa C2B</div>
                  <div className="text-sm font-mono-tabular font-bold text-emerald-900 pt-1">
                    {formatKes(todayMetrics.mpesa)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                  <div className="text-[10px] font-black uppercase text-blue-700">Card / Bank</div>
                  <div className="text-sm font-mono-tabular font-bold text-blue-900 pt-1">
                    {formatKes(todayMetrics.card)}
                  </div>
                </div>
              </div>

              {/* Branch and Session Context */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div><strong>Cashier:</strong> {currentUser.name} ({currentUser.role})</div>
                <div><strong>Branch:</strong> {activeBranch?.name || currentUser.branchName}</div>
                <div><strong>Fiscal Date:</strong> {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleExportTodayCsv}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Shift CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerFloatOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#150099] text-white text-xs font-black transition cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile ERP Modules Bottom Sheet (< md) */}
      {isMobileModulesSheetOpen && (
        <div
          onClick={() => setIsMobileModulesSheetOpen(false)}
          className="md:hidden fixed inset-0 z-[47] bg-black/65 backdrop-blur-xs flex flex-col justify-end animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-none sm:rounded-t-3xl h-full sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden border-t-0 sm:border-t-4 border-[#FFDE00] shadow-2xl"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-montserrat font-black italic text-sm text-[#0A006E]">
                  ERP Module Directory ({visibleNavItems.length})
                </h3>
                <p className="text-[10px] text-slate-500">
                  {currentUser.role} · {currentUser.branchName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileModulesSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                aria-label="Close Modules Sheet"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-3 gap-2.5">
              {visibleNavItems.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setIsMobileModulesSheetOpen(false);
                      onSelectModule(item.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
                      isActive
                        ? 'bg-[#0A006E] text-white border-[#0A006E] ring-2 ring-[#FFDE00]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className={isActive ? 'text-[#FFDE00]' : 'text-[#0A006E]'}>
                      {React.createElement(item.icon, { className: 'w-5 h-5' })}
                    </span>
                    <span className="text-[11px] font-montserrat font-bold leading-tight truncate max-w-full">
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}

              {onOpenCustomerPortal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileModulesSheetOpen(false);
                    onOpenCustomerPortal();
                  }}
                  className="p-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-[#1E9E60] flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5 text-[#1E9E60]" />
                  <span className="text-[11px] font-montserrat font-bold leading-tight">Online Store</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReplaySplash}
                className="p-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span className="text-[11px] font-montserrat font-bold leading-tight">Splash Screen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
