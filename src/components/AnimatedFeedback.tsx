import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const AnimatedSuccessTickIcon: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
}) => {
  const dim =
    size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
  const svgDim =
    size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <span className="absolute inset-0 rounded-full bg-[#34D186]/45 animate-ping" />
      <div
        className={`relative ${dim} rounded-full bg-[#34D186] border-2 border-[#0A006E] flex items-center justify-center shadow-lg animate-success-pop`}
      >
        <svg
          className={`${svgDim} text-[#0A006E]`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="animate-check-stroke" d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    </div>
  );
};

export const AnimatedErrorPromptIcon: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
}) => {
  const dim =
    size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
  const svgDim =
    size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
      <div
        className={`relative ${dim} rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-lg animate-error-shake`}
      >
        <svg
          className={`${svgDim} text-white`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    </div>
  );
};

export interface StatusFeedbackToastProps {
  status: {
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null;
  onDismiss: () => void;
}

export const StatusFeedbackToast: React.FC<StatusFeedbackToastProps> = ({
  status,
  onDismiss,
}) => {
  if (!status) return null;

  const isSuccess = status.type === 'success';

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [status, onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={onDismiss}
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 pointer-events-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl min-w-[280px] max-w-sm sm:max-w-md w-full border-2 transition-all feedback-dialog ${
          isSuccess
            ? 'bg-white border-[#34D186] text-slate-900 animate-success-pop shadow-emerald-950/20'
            : 'bg-white border-red-600 text-slate-900 animate-error-shake shadow-rose-950/20'
        }`}
      >
        {/* Animated Center Icon (Success Tick / Error Prompt) */}
        <div className="mb-4">
          {isSuccess ? (
            <AnimatedSuccessTickIcon size="lg" />
          ) : (
            <AnimatedErrorPromptIcon size="lg" />
          )}
        </div>

        {/* Title in Montserrat Bold */}
        <h3
          className={`font-montserrat font-black text-xl sm:text-2xl tracking-tight ${
            isSuccess ? 'text-[#1E9E60]' : 'text-red-700'
          }`}
        >
          {status.title}
        </h3>

        {/* Message */}
        <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-700 max-w-xs leading-relaxed">
          {status.message}
        </p>

        {/* Action Button */}
        <button
          type="button"
          onClick={onDismiss}
          className={`mt-6 px-7 py-2.5 rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition ${
            isSuccess
              ? 'bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00]'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
