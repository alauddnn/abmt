import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Clock,
  Wallet,
  CreditCard,
  Receipt,
  FileBarChart,
  Settings,
  ShieldCheck,
  Building2,
  FolderKanban,
  LogOut,
  Shield,
  Briefcase,
} from 'lucide-react';
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
        { id: 'reports', label: 'Laporan & Rekap', icon: FileBarChart },
      ],
    },
    {
      group: 'KEUANGAN',
      items: [
        { id: 'payroll', label: 'Gaji 2 Mingguan', icon: CreditCard },
        { id: 'expenses', label: 'Biaya Owner & Asisten', icon: Receipt },
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
    <aside className="hidden lg:flex lg:flex-col w-[240px] bg-white border-r border-[#EAECF0] text-[#344054] min-h-screen shrink-0 select-none">
      {/* Brand & Company Header */}
      <div className="h-16 px-4 border-b border-[#EAECF0] flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white border border-[#EAECF0] p-0.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
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
          <h1
            className="text-xs font-semibold text-[#262626] leading-tight truncate"
            title={settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
          >
            {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
          </h1>
          <p className="text-[11px] text-[#667085] truncate mt-0.5">
            Sistem Operasional
          </p>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {menuGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            <p className="px-2.5 pb-1 text-[11px] font-semibold text-[#667085] tracking-wider uppercase">
              {group.group}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left ${
                    isActive
                      ? 'bg-[#EFF5FF] text-[#4693FD] font-medium'
                      : 'text-[#344054] hover:bg-[#F9FAFB] hover:text-[#1D2939] font-normal'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#4693FD]' : 'text-[#667085]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-[#EAECF0] bg-[#F9FAFB]/50 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 ${
              isAdmin
                ? 'bg-[#EFF5FF] text-[#4693FD] border-[#D0E2FF]'
                : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
            }`}
          >
            {isAdmin ? 'AD' : 'OW'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#262626] truncate leading-tight">
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
          </div>
        </div>

        <button
          onClick={logout}
          className="p-1.5 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded-md transition-colors"
          title="Keluar dari akun"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
