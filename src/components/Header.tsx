/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wine,
  Menu,
  X,
  Globe,
  ShieldCheck,
  User,
  Lock,
  Smartphone,
  ShoppingBag,
  Sparkles,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Building2,
  Layers,
} from 'lucide-react';
import { StaffMember, ERPModuleId, Branch } from '../types';
import { isAudioMuted, toggleAudioMuted, playPosBeep } from '../utils/audioBeep';
import { PWAInstallButton } from './common/PWAInstallButton';

export interface HeaderProps {
  /** Mode: 'authenticated' for active ERP session, 'gateway' for login portal */
  variant?: 'authenticated' | 'gateway';
  /** Click on VAAIRO logo */
  onHomeClick?: () => void;
  /** Authenticated user details */
  currentUser?: StaffMember;
  /** Active module ID */
  activeModule?: ERPModuleId;
  /** Handler to select ERP module */
  onSelectModule?: (modId: ERPModuleId) => void;
  /** Handler to open RBAC access matrix modal */
  onOpenAccessMatrix?: () => void;
  /** Handler to open user profile modal */
  onOpenUserProfile?: () => void;
  /** Handler to sign out / lock terminal */
  onLogout?: () => void;
  /** Mobile drawer toggle in authenticated mode */
  mobileDrawerOpen?: boolean;
  onToggleMobileDrawer?: () => void;
  /** Handheld phone scanner handler */
  onOpenPhoneScanner?: () => void;
  /** Handler to open customer website/storefront */
  onOpenCustomerPortal?: () => void;
  /** Branches list for distribution network drawer info */
  branches?: Branch[];
  /** Total staff list count */
  totalStaffCount?: number;
  /** Handler to open Hybrid & Cross-Platform Native Wrappers modal */
  onOpenNativeWrappers?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  variant = 'authenticated',
  onHomeClick,
  currentUser,
  activeModule,
  onSelectModule,
  onOpenAccessMatrix,
  onOpenUserProfile,
  onLogout,
  mobileDrawerOpen = false,
  onToggleMobileDrawer,
  onOpenPhoneScanner,
  onOpenCustomerPortal,
  branches = [],
  totalStaffCount = 0,
  onOpenNativeWrappers,
}) => {
  // Gateway drawer state & utilities
  const [isGatewayDrawerOpen, setIsGatewayDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => isAudioMuted());

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
    }
  };

  const handleReplaySplash = () => {
    setIsGatewayDrawerOpen(false);
    window.dispatchEvent(new CustomEvent('vaairo-replay-splash'));
  };

  const handleCustomerWebsiteClick = () => {
    if (onOpenCustomerPortal) {
      onOpenCustomerPortal();
    } else if (onSelectModule) {
      if (activeModule === 'customer_portal') {
        onSelectModule('overview');
      } else {
        onSelectModule('customer_portal');
      }
    }
  };

  return (
    <>
      {/* VAAIRO Signature Deep Navy Header (2x Height) with Curved Single-Wave Bottom Edge */}
      <header className="sticky top-0 z-30 pt-5 pb-12 px-4 sm:px-6 bg-[#0A006E] text-white flex items-center justify-between gap-4 sm:gap-8 relative overflow-hidden shadow-lg">
        {/* Animated silent scanner sweep across header */}
        <div className="silent-scanner-beam" />

        {/* Zone 1: VAAIRO Wordmark & Wine Brand Icon */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (onHomeClick) {
              onHomeClick();
            } else if (onSelectModule) {
              onSelectModule('overview');
            }
          }}
          className="flex items-center gap-3 sm:gap-3.5 relative z-10 whitespace-nowrap shrink-0 group cursor-pointer"
        >
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white text-[#0A006E] flex items-center justify-center shadow-md border-2 border-white group-hover:scale-105 transition-transform duration-200">
            <Wine className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
          </div>
          <span className="font-montserrat font-black italic text-2xl sm:text-3xl lg:text-4xl tracking-tighter text-white">
            VAAIRO{' '}
            <span className="bg-[#FFDE00] text-[#0A006E] not-italic text-xs sm:text-sm font-black px-2.5 py-0.5 rounded-xl ml-1.5 align-middle shadow-xs">
              ERP
            </span>
          </span>
        </a>

        {/* Zone 2: Navigation & Action Controls */}
        {variant === 'authenticated' ? (
          <>
            {/* Mobile Header: Customer Website + Hamburger Button */}
            <div className="flex sm:hidden items-center gap-2 shrink-0 relative z-10">
              {/* Customer Website Icon Button (just before hamburger) */}
              <button
                type="button"
                onClick={handleCustomerWebsiteClick}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md active:scale-95 ${
                  activeModule === 'customer_portal'
                    ? 'bg-[#FFDE00] text-[#0A006E] border-white'
                    : 'bg-white text-[#0A006E] hover:bg-[#FFDE00] border-white'
                }`}
                title="Customer Website / Online Storefront"
                aria-label="Customer Website / Online Storefront"
              >
                <Globe className="w-5 h-5 stroke-[2.2]" />
              </button>

              <button
                type="button"
                onClick={onToggleMobileDrawer}
                className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white text-[#0A006E] border-2 border-white shadow-md cursor-pointer transition active:scale-95"
                title={mobileDrawerOpen ? 'Close Menu' : 'Open Navigation Menu'}
                aria-label={mobileDrawerOpen ? 'Close Menu' : 'Open Navigation Menu'}
              >
                {mobileDrawerOpen ? (
                  <X className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  <Menu className="w-6 h-6 stroke-[2.5]" />
                )}
              </button>
            </div>

            {/* Desktop Header: Header Right Action Icons (White Background) */}
            <div className="hidden sm:flex items-center gap-2.5 sm:gap-3.5 shrink-0 relative z-10">
              {/* 1. Customer Website icon */}
              <button
                type="button"
                onClick={handleCustomerWebsiteClick}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group ${
                  activeModule === 'customer_portal'
                    ? 'bg-[#FFDE00] text-[#0A006E] border-white'
                    : 'bg-white text-[#0A006E] hover:bg-[#FFDE00] border-white'
                }`}
                title="Customer Website / Online Storefront"
                aria-label="Customer Website / Online Storefront"
              >
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2] group-hover:rotate-12 transition-transform" />
                <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                  Customer Website
                </span>
              </button>

              {/* 1.5 Target Access Model Matrix button */}
              {onOpenAccessMatrix && (
                <button
                  type="button"
                  onClick={onOpenAccessMatrix}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 border-white"
                  title="Target Access Model & 8-Role RBAC Boundaries"
                  aria-label="Target Access Model & RBAC Boundaries"
                >
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />
                  <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                    Access Model (8 Roles)
                  </span>
                </button>
              )}

              {/* 2. User icon */}
              {currentUser && onOpenUserProfile && (
                <button
                  type="button"
                  onClick={onOpenUserProfile}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-white text-[#0A006E] hover:bg-slate-100 border-white"
                  title={`${currentUser.name} (${currentUser.role})`}
                  aria-label="User Profile"
                >
                  <User className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                  <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                    {currentUser.name} ({currentUser.role})
                  </span>
                </button>
              )}

              {/* 3. Lock icon */}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-white text-[#0A006E] hover:text-rose-600 hover:bg-rose-50 border-white"
                  title="Lock Terminal / Sign Out"
                  aria-label="Lock Terminal / Sign Out"
                >
                  <Lock className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                  <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                    Lock Terminal
                  </span>
                </button>
              )}

              {/* Install PWA Button */}
              <PWAInstallButton />
            </div>
          </>
        ) : (
          /* Gateway mode: Customer Website & Utilities Hamburger */
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 relative z-10">
            {onOpenCustomerPortal && (
              <button
                type="button"
                onClick={onOpenCustomerPortal}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white hover:bg-[#FFDE00] text-[#0A006E] border-2 border-white shadow-md transition-all cursor-pointer flex items-center justify-center active:scale-95 relative group"
                title="Customer Website & Online Storefront"
                aria-label="Customer Website & Online Storefront"
              >
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3] text-[#0A006E] group-hover:rotate-12 transition-transform" />
                <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                  Customer Website
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsGatewayDrawerOpen((prev) => !prev)}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white hover:bg-slate-100 text-[#0A006E] border-2 border-white shadow-md transition-all cursor-pointer flex items-center justify-center active:scale-95"
              title={isGatewayDrawerOpen ? 'Close Menu' : 'Open Portal Features Menu'}
              aria-label={isGatewayDrawerOpen ? 'Close Menu' : 'Open Portal Features Menu'}
            >
              {isGatewayDrawerOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />
              )}
            </button>

            {/* Install PWA Button (Hidden on Mobile) */}
            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>
          </div>
        )}

        {/* Single Smooth Curved Wave Bottom Edge with Gold Stroke */}
        <svg
          className="absolute bottom-0 left-0 w-full h-9 sm:h-11 pointer-events-none block"
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

      {/* Gateway Slide-Out Drawer / Modal from urbantechdev/erp */}
      {variant === 'gateway' && isGatewayDrawerOpen && (
        <div
          onClick={() => setIsGatewayDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-end sm:p-6 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:w-96 sm:rounded-3xl h-full sm:h-auto sm:max-h-[90vh] shadow-2xl border-l-0 sm:border-2 border-[#0A006E] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="p-5 bg-[#0A006E] text-white flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-[#0A006E] flex items-center justify-center font-black">
                  <Wine className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black italic text-base text-white">
                    VAAIRO <span className="bg-[#FFDE00] text-[#0A006E] not-italic text-xs font-black px-2 py-0.5 rounded-lg ml-1">ERP</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 font-montserrat">
                    Portal Utilities &amp; Features
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGatewayDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
                aria-label="Close Menu"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-4 overflow-y-auto space-y-3 font-montserrat">
              {/* Feature 1: Phone Barcode Scanner */}
              {onOpenPhoneScanner && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGatewayDrawerOpen(false);
                    onOpenPhoneScanner();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border-2 border-amber-300 text-left flex items-start gap-3 transition cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Smartphone className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-[#0A006E] flex items-center justify-between">
                      <span>Phone Barcode Scanner</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] uppercase">
                        Handheld
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
                      Connect your phone camera to scan physical bottle barcodes directly into register.
                    </p>
                  </div>
                </button>
              )}

              {/* Feature 2: Customer Online Storefront Portal */}
              {onOpenCustomerPortal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGatewayDrawerOpen(false);
                    onOpenCustomerPortal();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 text-left flex items-start gap-3 transition cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-emerald-950 flex items-center justify-between">
                      <span>Customer Online Store</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-700 text-white uppercase">
                        Storefront
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
                      Browse public catalog, direct customer retail ordering & delivery.
                    </p>
                  </div>
                </button>
              )}

              {/* Feature 2.5: Hybrid & Cross-Platform Native Wrappers */}
              {onOpenNativeWrappers && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGatewayDrawerOpen(false);
                    onOpenNativeWrappers();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-purple-50 hover:bg-purple-100 border-2 border-purple-300 text-left flex items-start gap-3 transition cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-purple-950 flex items-center justify-between">
                      <span>Native Wrappers (APK / iOS / Desktop)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-800 text-white uppercase">
                        Hybrid
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
                      Capacitor Android APK, iOS Xcode, and Electron/Tauri desktop packages.
                    </p>
                  </div>
                </button>
              )}

              {/* Feature 3: Replay Brand Splash Intro Animation */}
              <button
                type="button"
                onClick={handleReplaySplash}
                className="w-full p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-left flex items-start gap-3 transition cursor-pointer group shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 stroke-[2.3]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-[#0A006E]">
                    Replay Brand Splash Screen
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
                    Replay the signature VAAIRO ERP animated startup screen.
                  </p>
                </div>
              </button>

              {/* Feature 4: Fullscreen Toggle */}
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-start gap-3 transition cursor-pointer group shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5 stroke-[2.3]" />
                  ) : (
                    <Maximize2 className="w-5 h-5 stroke-[2.3]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-900 flex items-center justify-between">
                    <span>Fullscreen Display Mode</span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {isFullscreen ? 'Active' : 'Windowed'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
                    Maximize window for kiosk terminals, tablets, and POS registers.
                  </p>
                </div>
              </button>

              {/* Feature 5: Sound Beeps Toggle */}
              <button
                type="button"
                onClick={handleToggleSound}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-start gap-3 transition cursor-pointer group shadow-2xs"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform ${
                    soundMuted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {soundMuted ? (
                    <VolumeX className="w-5 h-5 stroke-[2.3]" />
                  ) : (
                    <Volume2 className="w-5 h-5 stroke-[2.3]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-slate-900 flex items-center justify-between">
                    <span>Terminal Audio Feedback</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        soundMuted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {soundMuted ? 'Muted' : 'Sound ON'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug pt-0.5">
                    {soundMuted
                      ? 'Terminal beeps are muted for silent environments.'
                      : 'Audio beeps sound on successful barcode and PIN scans.'}
                  </p>
                </div>
              </button>

              {/* Section: Operational Network Info */}
              <div className="p-3.5 rounded-2xl bg-[#0A006E]/5 border border-[#0A006E]/15 text-xs space-y-1.5 text-slate-700">
                <div className="flex items-center gap-2 font-black text-[#0A006E] text-[11px] uppercase tracking-wider">
                  <Building2 className="w-4 h-4 text-[#0A006E]" />
                  <span>Distribution Hub &amp; Network</span>
                </div>
                <div className="text-[11px] font-semibold text-slate-800">
                  Main Depot: {branches[0]?.name || 'Nairobi West & Parklands (HQ)'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Network: {branches.length || 1} Operational Hubs · {totalStaffCount || 12} Registered Personnel
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between font-montserrat text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Vaairo Spirits ERP v2.4</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Systems Nominal
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
