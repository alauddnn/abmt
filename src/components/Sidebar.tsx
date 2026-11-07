import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  FolderKanban,
  LogOut,
  Shield,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompany } from '../context/CompanyContext.js';
import { useAuth } from '../context/AuthContext.js';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenTestCases?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { settings } = useCompany();
  const { user, isAdmin, logout } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kms_sidebar_collapsed', String(isCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [isCollapsed]);

  const menuGroups: MenuGroup[] = [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
      ],
    },
    {
      group: 'OPERASIONAL',
      items: [
        { id: 'projects', label: 'Manajemen Proyek', icon: FolderKanban },
      ],
    },
    {
      group: 'KEUANGAN',
      items: [
        { id: 'expenses', label: 'Biaya Operasional', icon: Receipt },
      ],
    },
    {
      group: 'PENGATURAN',
      items: [
        { id: 'settings', label: 'Pengaturan Perusahaan', icon: Settings },
        { id: 'audit-logs', label: 'Pengguna & Keamanan', icon: ShieldCheck },
      ],
    },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 76 : 252 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="hidden lg:flex lg:flex-col bg-white border-r border-slate-200/90 text-slate-700 min-h-screen shrink-0 select-none relative z-30 shadow-[1px_0_3px_rgba(15,23,42,0.02)]"
    >
      {/* Brand & Company Header + Collapse Toggle */}
      <div
        className={`h-16 border-b border-slate-200/80 flex items-center ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        } gap-2.5`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden transition-transform duration-200 hover:scale-105">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-10-25_at_22.19.45-removebg-preview_fcf12665.png"
              alt={settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== `${window.location.origin}/logo.png`) {
                  target.src = '/logo.png';
                }
              }}
            />
          </div>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="brand-text"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden min-w-0"
              >
                <h1
                  className="text-xs font-semibold text-slate-900 leading-tight truncate"
                  title={settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
                >
                  {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
                </h1>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  Sistem Operasional
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Ciutkan Sidebar"
            aria-label="Ciutkan Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand Button when collapsed */}
      {isCollapsed && (
        <div className="pt-3 px-3 flex justify-center">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="w-full py-2 flex items-center justify-center text-slate-400 hover:text-[#2563EB] hover:bg-blue-50/70 rounded-xl transition-colors cursor-pointer"
            title="Perluas Sidebar"
            aria-label="Perluas Sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto overflow-x-hidden">
        {menuGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            <div className="h-5 flex items-center px-2.5">
              {!isCollapsed ? (
                <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase truncate">
                  {group.group}
                </p>
              ) : (
                <div className="w-full h-[1px] bg-slate-100" />
              )}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative w-full flex items-center ${
                    isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5'
                  } rounded-xl text-[13px] transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'text-[#2563EB] font-semibold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {/* Animated Active Indicator Background & Left Bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 34,
                      }}
                      className="absolute inset-0 bg-[#EFF5FF] border border-blue-200/60 rounded-xl z-0"
                    >
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#2563EB] rounded-r-full" />
                    </motion.div>
                  )}

                  {/* Subtle Hover Pill for Inactive Items */}
                  {!isActive && (
                    <span className="absolute inset-0 rounded-xl bg-slate-100/0 group-hover:bg-slate-100/80 transition-colors duration-150 z-0" />
                  )}

                  <Icon
                    className={`w-4 h-4 shrink-0 relative z-10 transition-transform duration-200 ${
                      isActive
                        ? 'text-[#2563EB] scale-105'
                        : 'text-slate-500 group-hover:text-slate-800 group-hover:translate-x-0.5'
                    }`}
                  />

                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -4 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className="truncate relative z-10 group-hover:translate-x-0.5 transition-transform duration-200"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Profile Footer */}
      <div
        className={`p-3 border-t border-slate-200/80 bg-slate-50/60 flex items-center ${
          isCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between gap-2.5'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 transition-transform duration-200 hover:scale-105 ${
              isAdmin
                ? 'bg-[#EFF5FF] text-[#2563EB] border-[#D0E2FF]'
                : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
            }`}
            title={user?.name || (isAdmin ? 'Administrator' : 'Owner')}
          >
            {isAdmin ? 'AD' : 'OW'}
          </div>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.16 }}
                className="min-w-0"
              >
                <p className="text-xs font-semibold text-slate-900 truncate leading-tight">
                  {user?.name || (isAdmin ? 'Administrator' : 'Owner')}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#155EEF]">
                      <Shield className="w-2.5 h-2.5" />
                      ADMIN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#B54708]">
                      <Briefcase className="w-2.5 h-2.5" />
                      OWNER (BACA)
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={logout}
          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          title="Keluar dari akun"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </motion.aside>
  );
};
