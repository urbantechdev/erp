import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install, isInIframe } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA or inside AI Studio iframe, hide the button
  if (isInstalled || isInIframe) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-[#FFDE00] hover:bg-amber-400 px-4 py-2 text-xs font-montserrat font-black text-[#0A006E] shadow-sm transition"
      >
        <Download className="w-4 h-4" />
        Install App
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border-2 border-[#0A006E] px-4 py-2 text-xs font-montserrat font-black text-[#0A006E] hover:bg-slate-50 transition"
        >
          <Download className="w-4 h-4" />
          Install App
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border-2 border-[#0A006E]">
              <h3 className="text-lg font-montserrat font-black text-[#0A006E]">Install on iPhone</h3>
              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-[#0A006E] py-3 text-xs font-montserrat font-black text-[#FFDE00] hover:bg-[#070050] transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
