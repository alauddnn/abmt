import React from 'react';
import { Menu, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  title: string;
  category?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, title, category = 'Operasional' }) => {
  const { user, isAdmin, isOwner, logout } = useAuth();
  const { settings } = useCompany();

  const now = new Date();
  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#EAECF0] h-16 shrink-0">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle, Breadcrumb & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-1.5 text-[#667085] hover:text-[#262626] rounded-md hover:bg-[#F2F4F7] transition-colors"
            aria-label="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#667085]">
              <span>{category}</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#98A2B3]" />
              <span className="text-[#344054] font-medium truncate">{title}</span>
            </div>
            {/* Page title for mobile/desktop */}
            <h1 className="text-sm sm:text-base font-semibold text-[#262626] leading-tight truncate">
              {title}
            </h1>
          </div>
        </div>

        {/* Right: Date, Role Badge, Avatar & Logout */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Current Date */}
          <span className="hidden md:inline-block text-xs text-[#667085] font-medium">
            {formattedDate}
          </span>

          <span className="hidden md:inline-block text-[#EAECF0] h-4 w-[1px] bg-[#EAECF0]" />

          {/* Active Role Status Badge */}
          {isAdmin ? (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4693FD] animate-pulse" />
              ADMIN
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEF6EE] text-[#B54708] border border-[#F9DBAF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B54708]" />
              OWNER (BACA)
            </span>
          )}

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-1">
            <div
              className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${
                isAdmin
                  ? 'bg-[#EFF5FF] text-[#4693FD] border-[#D0E2FF]'
                  : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
              }`}
              title={`${user?.name || 'Pengguna'} (${isAdmin ? 'ADMIN' : 'OWNER'})`}
            >
              {isAdmin ? 'AD' : 'OW'}
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded-lg border border-[#D0D5DD] hover:border-[#FECDCA] transition-colors"
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
