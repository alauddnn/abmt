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
  X,
  FolderKanban,
  LogOut,
  Shield,
  Briefcase,
} from 'lucide-react';
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
  onOpenTestCases,
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

  const handleSelect = (id: string) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden transition-opacity"
        />
      )}

      {/* Slide-out Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white text-[#344054] border-r border-[#EAECF0] transform transition-transform duration-200 ease-in-out lg:hidden flex flex-col shadow-xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 border-b border-[#EAECF0] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#EAECF0] p-0.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
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
              <p className="font-semibold text-xs text-[#262626] truncate">
                {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
              </p>
              <p className="text-[11px] text-[#667085]">Manajemen Operasional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#667085] hover:text-[#262626] rounded-md hover:bg-[#F2F4F7]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
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
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                      isActive
                        ? 'bg-[#EFF5FF] text-[#4693FD] font-medium'
                        : 'text-[#344054] hover:bg-[#F9FAFB] hover:text-[#1D2939]'
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

        <div className="p-3 border-t border-[#EAECF0] bg-[#F9FAFB]/60">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-full border flex items-center justify-center font-semibold text-[11px] shrink-0 ${
                  isAdmin
                    ? 'bg-[#EFF5FF] text-[#4693FD] border-[#D0E2FF]'
                    : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                }`}
              >
                {isAdmin ? 'AD' : 'OW'}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-[#262626] truncate">{user?.name}</p>
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
              className="p-1.5 text-[#667085] hover:text-[#D64545] rounded-md"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Bar on Mobile for convenient thumb usage */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#EAECF0] px-2 py-1 flex items-center justify-around shadow-sm">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            currentTab === 'dashboard' ? 'text-[#4693FD]' : 'text-[#667085]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="mt-0.5">Dasbor</span>
        </button>
        <button
          onClick={() => onSelectTab('projects')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            currentTab === 'projects' ? 'text-[#4693FD]' : 'text-[#667085]'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span className="mt-0.5">Proyek</span>
        </button>
        <button
          onClick={() => onSelectTab('reports')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            currentTab === 'reports' ? 'text-[#4693FD]' : 'text-[#667085]'
          }`}
        >
          <FileBarChart className="w-4 h-4" />
          <span className="mt-0.5">Laporan</span>
        </button>
        <button
          onClick={() => onSelectTab('payroll')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            currentTab === 'payroll' ? 'text-[#4693FD]' : 'text-[#667085]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span className="mt-0.5">Gaji</span>
        </button>
        <button
          onClick={() => onSelectTab('expenses')}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            currentTab === 'expenses' ? 'text-[#4693FD]' : 'text-[#667085]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span className="mt-0.5">Biaya</span>
        </button>
      </div>
    </>
  );
};
