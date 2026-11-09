import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  return (
    <div className="fixed bottom-16 lg:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 28, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 bg-white rounded-2xl shadow-lg border border-slate-200 text-xs"
          >
            {toast.type === 'success' && (
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'error' && (
              <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'info' && (
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-200/70 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
            )}

            <div className="flex-1 font-medium text-slate-800 leading-relaxed pt-0.5">
              {toast.message}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-800 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Subtle auto-dismiss progress indicator */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4.5, ease: 'linear' }}
              style={{ transformOrigin: 'left' }}
              className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                toast.type === 'success'
                  ? 'bg-emerald-500/70'
                  : toast.type === 'error'
                  ? 'bg-rose-500/70'
                  : 'bg-[#2563EB]/70'
              }`}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
