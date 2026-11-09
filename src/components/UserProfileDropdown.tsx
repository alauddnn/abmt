import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  User,
  LogOut,
  Camera,
  ChevronRight,
  Shield,
  Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';

interface UserProfileDropdownProps {
  onSelectTab: (tab: string) => void;
  onOpenProfileModal: () => void;
  align?: 'top-right' | 'bottom-left' | 'top-left';
  trigger: (props: {
    isOpen: boolean;
    toggle: () => void;
    avatarUrl?: string;
    name: string;
    initials: string;
    isAdmin: boolean;
  }) => React.ReactNode;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  onSelectTab,
  onOpenProfileModal,
  align = 'top-right',
  trigger,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { user, isAdmin, logout } = useAuth();

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        close();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getInitials = (n?: string) => {
    if (!n) return isAdmin ? 'AD' : 'OW';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const displayName = user?.name || (isAdmin ? 'Administrator Proyek' : 'Owner');
  const initials = getInitials(displayName);

  // Position alignment styling
  const alignmentClasses =
    align === 'top-right'
      ? 'top-full right-0 mt-2'
      : align === 'bottom-left'
      ? 'bottom-full left-0 mb-2'
      : 'top-full left-0 mt-2';

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {trigger({
        isOpen,
        toggle,
        avatarUrl: user?.avatarUrl,
        name: displayName,
        initials,
        isAdmin,
      })}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: align === 'bottom-left' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: align === 'bottom-left' ? 6 : -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute ${alignmentClasses} w-72 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-slate-700 select-none overflow-hidden`}
          >
            {/* User Header Summary */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-3">
              <div className="relative shrink-0">
                <div
                  className={`w-11 h-11 rounded-full border flex items-center justify-center font-bold text-sm overflow-hidden ${
                    isAdmin
                      ? 'bg-[#EFF5FF] text-[#2563EB] border-blue-200'
                      : 'bg-[#FEF6EE] text-[#B54708] border-amber-200'
                  }`}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate leading-snug">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {user?.email || (user?.username ? `@${user.username}` : '')}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#155EEF] bg-[#EFF5FF] px-1.5 py-0.5 rounded-md border border-blue-100">
                      <Shield className="w-2.5 h-2.5" />
                      ADMIN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B54708] bg-[#FEF6EE] px-1.5 py-0.5 rounded-md border border-amber-100">
                      <Briefcase className="w-2.5 h-2.5" />
                      OWNER (BACA)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Action: Edit Profile & Photo */}
            <div className="p-1.5 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenProfileModal();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB]">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <span>Ubah Foto & Profil</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* System Settings Relocated From Sidebar */}
            <div className="p-1.5 border-b border-slate-100">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Pengaturan Sistem
              </div>

              <button
                type="button"
                onClick={() => {
                  close();
                  onSelectTab('settings');
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <span>Pengaturan Perusahaan</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  onSelectTab('audit-logs');
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span>Pengguna & Keamanan</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Logout */}
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  close();
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <LogOut className="w-3.5 h-3.5" />
                </div>
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
