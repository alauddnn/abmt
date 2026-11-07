import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  X,
  FolderKanban,
  LogOut,
  Shield,
  Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCompany } from '../context/CompanyContext.js';
import { useAuth } from '../context/AuthContext.js';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
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

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
}) => {
  const { settings } = useCompany();
  const { isAdmin, user, logout } = useAuth();

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

  const bottomItems = [
    { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard },
    { id: 'projects', label: 'Proyek', icon: FolderKanban },
    { id: 'expenses', label: 'Biaya', icon: Receipt },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'audit-logs', label: 'Keamanan', icon: ShieldCheck },
  ];

  const handleSelect = (id: string) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
            />

            {/* Slide-out Drawer */}
            <motion.div
              key="mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white text-slate-700 border-r border-slate-200 lg:hidden flex flex-col shadow-2xl"
            >
              <div className="h-16 px-4 border-b border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
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
                  <div className="overflow-hidden min-w-0">
                    <p className="font-semibold text-xs text-slate-900 truncate">
                      {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
                    </p>
                    <p className="text-[11px] text-slate-500">Manajemen Operasional</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
                {menuGroups.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <p className="px-2.5 pb-1 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
                      {group.group}
                    </p>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.id)}
                          className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-colors text-left ${
                            isActive
                              ? 'bg-[#EFF5FF] text-[#2563EB] font-semibold'
                              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#2563EB] rounded-r-full" />
                          )}
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-[#2563EB]' : 'text-slate-500'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-200/80 bg-slate-50/60">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-semibold text-xs shrink-0 ${
                        isAdmin
                          ? 'bg-[#EFF5FF] text-[#2563EB] border-[#D0E2FF]'
                          : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                      }`}
                    >
                      {isAdmin ? 'AD' : 'OW'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{user?.name}</p>
                      <div className="flex items-center gap-1">
                        {isAdmin ? (
                          <span className="text-[10px] text-[#155EEF] font-semibold flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5" /> ADMIN
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#B54708] font-semibold flex items-center gap-0.5">
                            <Briefcase className="w-2.5 h-2.5" /> OWNER
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      logout();
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Keluar"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Bar on Mobile with Animated Active Indicator */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-1.5 flex items-center justify-around shadow-[0_-2px_10px_rgba(15,23,42,0.03)]">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#2563EB]' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-bottom-active-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 bg-[#EFF5FF] rounded-xl -z-10"
                />
              )}
              <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-105' : ''}`} />
              <span className="mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
