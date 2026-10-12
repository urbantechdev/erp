import React, { useState } from 'react';
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
  Calendar,
} from 'lucide-react';
import { ERPModuleId, StaffMember } from '../types';

interface DesktopBottomNavProps {
  activeModule: ERPModuleId;
  onSelectModule: (modId: ERPModuleId) => void;
  allowedModules: ERPModuleId[];
  currentUser: StaffMember;
  onOpenCustomerPortal?: () => void;
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
  audit_security: { label: 'Security & Audit Logs', shortLabel: 'Security', icon: Activity },
  customer_portal: { label: 'Customer Online Store', shortLabel: 'Online Store', icon: ShoppingBag },
};

export const DesktopBottomNav: React.FC<DesktopBottomNavProps> = ({
  activeModule,
  onSelectModule,
  allowedModules,
  currentUser,
  onOpenCustomerPortal,
}) => {
  const [isMobileModulesSheetOpen, setIsMobileModulesSheetOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

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

  const handleReplaySplash = () => {
    setIsMobileModulesSheetOpen(false);
    window.dispatchEvent(new CustomEvent('vaairo-replay-splash'));
  };

  const visibleNavItems = allowedModules.map((id) => ({
    id,
    ...MODULE_NAV_DEFINITIONS[id],
  }));

  // Primary slots for Mobile 5-slot bottom bar
  const slot1Item = visibleNavItems.find((i) => i.id === 'overview') || visibleNavItems[0];
  const slot2Item =
    visibleNavItems.find((i) => i.id === 'inventory' && i.id !== slot1Item?.id) ||
    visibleNavItems.find((i) => i.id !== slot1Item?.id && i.id !== 'retail_pos' && i.id !== 'sales_pos');

  const centerItem =
    visibleNavItems.find((i) => i.id === 'retail_pos') ||
    visibleNavItems.find((i) => i.id === 'sales_pos') ||
    visibleNavItems[0];

  const slot4Item =
    visibleNavItems.find(
      (i) =>
        (i.id === 'hr_rbac' || i.id === 'branches_transfers' || i.id === 'documents_credit') &&
        i.id !== slot1Item?.id &&
        i.id !== slot2Item?.id &&
        i.id !== centerItem?.id
    ) ||
    visibleNavItems.find(
      (i) =>
        i.id !== slot1Item?.id &&
        i.id !== slot2Item?.id &&
        i.id !== centerItem?.id
    );

  const isSecondaryModuleActive = ![
    slot1Item?.id,
    slot2Item?.id,
    centerItem?.id,
    slot4Item?.id,
  ].includes(activeModule);

  const handleMobileSelect = (modId: ERPModuleId) => {
    setIsMobileModulesSheetOpen(false);
    onSelectModule(modId);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      {/* =====================================================================
          MOBILE ERP APP BOTTOM NAVIGATION BAR (< md) — CURVED SINGLE WAVE TOP EDGE
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
            {/* White wave body seamlessly curving the top edge of the bottom nav */}
            <path
              d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z"
              fill="#ffffff"
            />
            {/* Golden Yellow Single Wave Crest Stroke */}
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
          {/* Slot 1 */}
          {slot1Item && (
            <button
              type="button"
              onClick={() => handleMobileSelect(slot1Item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeModule === slot1Item.id ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              {React.createElement(slot1Item.icon, {
                className: `w-5 h-5 ${activeModule === slot1Item.id ? 'text-[#0A006E]' : 'text-slate-400'}`,
              })}
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                {slot1Item.shortLabel}
              </span>
            </button>
          )}

          {/* Slot 2 */}
          {slot2Item && (
            <button
              type="button"
              onClick={() => handleMobileSelect(slot2Item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeModule === slot2Item.id ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              {React.createElement(slot2Item.icon, {
                className: `w-5 h-5 ${activeModule === slot2Item.id ? 'text-[#0A006E]' : 'text-slate-400'}`,
              })}
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                {slot2Item.shortLabel}
              </span>
            </button>
          )}

          {/* Slot 3: Center Elevated Action Tab (POS Terminal) */}
          <div className="flex flex-col items-center justify-center relative">
            <button
              type="button"
              onClick={() => handleMobileSelect(centerItem?.id || 'retail_pos')}
              aria-label={`Open ${centerItem?.label || 'POS Terminal'}`}
              className={`relative w-13 h-13 -mt-4 rounded-full border-2 border-[#FFDE00] ring-4 ring-white shadow-[0_-4px_16px_rgba(10,0,110,0.4)] flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 cursor-pointer ${
                activeModule === (centerItem?.id || 'retail_pos')
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-gradient-to-tr from-[#0A006E] to-[#1E3A8A] text-white'
              }`}
            >
              {centerItem &&
                React.createElement(centerItem.icon, {
                  className: 'w-5 h-5 text-[#FFDE00]',
                })}
              <span className="text-[8px] font-montserrat font-black uppercase tracking-wider text-white leading-none truncate max-w-[44px]">
                POS
              </span>
            </button>
          </div>

          {/* Slot 4 */}
          {slot4Item && (
            <button
              type="button"
              onClick={() => handleMobileSelect(slot4Item.id)}
              className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer ${
                activeModule === slot4Item.id ? 'text-[#0A006E]' : 'text-slate-500 hover:text-[#0A006E]'
              }`}
            >
              {React.createElement(slot4Item.icon, {
                className: `w-5 h-5 ${activeModule === slot4Item.id ? 'text-[#0A006E]' : 'text-slate-400'}`,
              })}
              <span className="text-[10px] font-montserrat font-bold truncate max-w-[64px]">
                {slot4Item.shortLabel}
              </span>
            </button>
          )}

          {/* Slot 5: All ERP Modules Bottom Sheet Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileModulesSheetOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center gap-1 h-full transition cursor-pointer relative ${
              isMobileModulesSheetOpen || isSecondaryModuleActive
                ? 'text-[#0A006E]'
                : 'text-slate-500 hover:text-[#0A006E]'
            }`}
          >
            <LayoutGrid
              className={`w-5 h-5 ${
                isMobileModulesSheetOpen || isSecondaryModuleActive ? 'text-[#0A006E]' : 'text-slate-400'
              }`}
            />
            <span className="text-[10px] font-montserrat font-bold">
              {isMobileModulesSheetOpen ? 'Close' : 'Modules'}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile ERP Modules Bottom Sheet (< md) */}
      {isMobileModulesSheetOpen && (
        <div
          onClick={() => setIsMobileModulesSheetOpen(false)}
          className="md:hidden fixed inset-0 z-[47] bg-black/65 backdrop-blur-xs flex flex-col justify-end pb-[6.5rem] animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl max-h-[74vh] flex flex-col overflow-hidden border-t-4 border-[#FFDE00] shadow-2xl"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-montserrat font-black italic text-sm text-[#0A006E]">
                  VAAIRO ERP Mobile Modules ({visibleNavItems.length})
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
                    onClick={() => handleMobileSelect(item.id)}
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

      {/* =====================================================================
          DESKTOP BOTTOM NAVIGATION BAR (md+) — CURVED SINGLE WAVE TOP EDGE
          ===================================================================== */}
      <nav
        aria-label="Desktop ERP Bottom Navigation"
        className="hidden md:flex relative sticky bottom-0 z-30 bg-white px-3 sm:px-6 h-24 min-h-[6rem] items-center justify-center shadow-[0_-8px_24px_rgba(10,0,110,0.08)]"
      >
        {/* Single Wave Design at the top edge */}
        <div className="absolute left-0 right-0 -top-8 sm:-top-10 w-full leading-none pointer-events-none z-30">
          <svg
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            className="w-full h-8 sm:h-10 block drop-shadow-[0_-5px_10px_rgba(10,0,110,0.08)]"
          >
            {/* White wave body matching bottom nav */}
            <path
              d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z"
              fill="#ffffff"
            />
            {/* Golden Yellow Wave Stroke */}
            <path
              d="M0,22 C340,68 760,2 1200,54"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="w-full max-w-[96rem] mx-auto flex items-center justify-between gap-3 relative z-20">
          {/* Navigation Tabs Strip */}
          <div className="flex items-center space-x-1.5 lg:space-x-2 overflow-x-auto scrollbar-none py-1 min-w-0">
            {visibleNavItems.map((item) => {
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id)}
                  className={`flex items-center space-x-1.5 px-3 lg:px-3.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#0A006E] text-white shadow-md ring-2 ring-[#FFDE00]'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-[#FFDE00]' : 'text-slate-400'}`}>
                    {React.createElement(item.icon, {
                      className: 'w-4 h-4 sm:w-5 sm:h-5',
                    })}
                  </span>
                  <span className="whitespace-nowrap">{item.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Right Pinned Utility Actions */}
          <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-slate-200">
            {/* Replay Splash Screen Action */}
            <button
              type="button"
              onClick={handleReplaySplash}
              title="Replay Brand Splash Screen Animation"
              aria-label="Replay Splash Screen"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="hidden xl:inline">Splash</span>
            </button>

            {/* Customer Online Store Portal Launcher */}
            {onOpenCustomerPortal && (
              <button
                type="button"
                onClick={onOpenCustomerPortal}
                title="Launch Customer Online Order Portal"
                aria-label="Customer Online Store"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-300 text-xs font-montserrat font-bold transition cursor-pointer shadow-2xs"
              >
                <ShoppingBag className="w-4 h-4 text-[#1E9E60] shrink-0" />
                <span className="hidden xl:inline">Online Store</span>
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label="Toggle Fullscreen"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0 cursor-pointer border border-slate-200"
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
    </>
  );
};
