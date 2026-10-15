import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isConfirming = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertTriangle className="h-6 w-6" />
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <p className="mb-6 text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            disabled={isConfirming}
          >
            {isConfirming ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
