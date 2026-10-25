import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 bg-white rounded-xl shadow-lg border border-[#EAECF0] text-xs transition-all duration-200 animate-in slide-in-from-bottom-2"
        >
          {toast.type === 'success' && (
            <div className="w-6 h-6 rounded-md bg-[#ECFDF3] text-[#16A36A] flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {toast.type === 'error' && (
            <div className="w-6 h-6 rounded-md bg-[#FEF3F2] text-[#D64545] flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          {toast.type === 'info' && (
            <div className="w-6 h-6 rounded-md bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1 font-medium text-[#262626] leading-relaxed pt-0.5">
            {toast.message}
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-[#98A2B3] hover:text-[#262626] transition-colors p-1 rounded-md hover:bg-[#F2F4F7]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
