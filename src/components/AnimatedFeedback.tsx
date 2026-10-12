import React from 'react';
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

  return (
    <div className="fixed top-24 right-4 sm:right-6 z-50 max-w-md w-full pointer-events-auto">
      <div
        className={`rounded-2xl p-4 border-2 shadow-2xl flex items-center gap-3.5 transition-all ${
          isSuccess
            ? 'bg-white border-[#34D186] text-[#0A006E] animate-success-pop'
            : 'bg-red-50 border-red-600 text-red-950 animate-error-shake'
        }`}
      >
        {isSuccess ? (
          <AnimatedSuccessTickIcon size="md" />
        ) : (
          <AnimatedErrorPromptIcon size="md" />
        )}

        <div className="flex-1 min-w-0">
          <div className="text-xs font-montserrat font-black uppercase tracking-wider">
            {status.title}
          </div>
          <div className="text-xs font-semibold text-slate-700 mt-0.5 leading-snug">
            {status.message}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
