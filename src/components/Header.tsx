import React from 'react';
import { Menu, ChevronRight, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';

import { UserProfileDropdown } from './UserProfileDropdown.js';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  title: string;
  category?: string;
  onSelectTab: (tab: string) => void;
  onOpenProfileModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  title,
  category = 'Operasional',
  onSelectTab,
  onOpenProfileModal,
}) => {
  const { user, isAdmin, logout } = useAuth();

  const now = new Date();
  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 h-16 shrink-0 transition-colors shadow-2xs">
      <div className="h-full px-4 sm:px-6 lg:px-10 max-w-[1440px] mx-auto flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle, Animated Breadcrumb & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${category}-${title}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <span>{category}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-700 font-medium truncate">{title}</span>
              </div>
              {/* Page title for mobile/desktop */}
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight truncate">
                {title}
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Date, Profile Dropdown & Logout */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Current Date */}
          <span className="hidden md:inline-block text-xs text-slate-500 font-medium tabular-nums">
            {formattedDate}
          </span>

          <span className="hidden md:inline-block h-4 w-[1px] bg-slate-200" />

          {/* User Profile Avatar with Popup Menu */}
          <UserProfileDropdown
            onSelectTab={onSelectTab}
            onOpenProfileModal={onOpenProfileModal}
            align="top-right"
            trigger={({ toggle, avatarUrl, initials, name }) => (
              <button
                type="button"
                onClick={toggle}
                className="flex items-center gap-2 pl-0.5 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group"
                title={`${name} - Klik untuk menu profil & pengaturan`}
                aria-label="Menu Profil"
              >
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold overflow-hidden transition-transform duration-200 group-hover:scale-105 shadow-2xs ${
                    isAdmin
                      ? 'bg-[#EFF5FF] text-[#2563EB] border-[#D0E2FF]'
                      : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
              </button>
            )}
          />

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl border border-slate-200/90 hover:border-rose-200 transition-all cursor-pointer"
            title="Keluar dari akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
