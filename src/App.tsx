import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { CompanyProvider, useCompany } from './context/CompanyContext.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { MobileNav } from './components/MobileNav.js';
import { ToastContainer, ToastMessage } from './components/Toast.js';
import { TestCasesModal } from './components/TestCasesModal.js';

import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { EmployeesPage } from './pages/EmployeesPage.js';
import { AttendancePage } from './pages/AttendancePage.js';
import { OvertimePage } from './pages/OvertimePage.js';
import { KasbonPage } from './pages/KasbonPage.js';
import { PayrollPage } from './pages/PayrollPage.js';
import { ExpensesPage } from './pages/ExpensesPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';

function MainLayout() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const { settings } = useCompany();
  const { user } = useAuth();

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDataChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard Utama',
    projects: 'Manajemen Proyek',
    reports: 'Laporan & Rekap Keuangan (A-M)',
    payroll: 'Gaji 2 Mingguan',
    expenses: 'Biaya Owner & Asisten',
    settings: 'Pengaturan Perusahaan',
    'audit-logs': 'Pengguna & Keamanan',
    employees: 'Manajemen Data Karyawan',
    attendance: 'Absensi & Gaji Harian',
    overtime: 'Pencatatan & Persetujuan Lembur',
    kasbon: 'Sistem Kasbon Karyawan',
  };

  const pageCategories: Record<string, string> = {
    dashboard: 'Overview',
    projects: 'Operasional',
    reports: 'Operasional',
    payroll: 'Keuangan',
    expenses: 'Keuangan',
    settings: 'Pengaturan',
    'audit-logs': 'Pengaturan',
    employees: 'Operasional',
    attendance: 'Operasional',
    overtime: 'Operasional',
    kasbon: 'Operasional',
  };

  return (
    <div className="flex min-h-screen bg-[#F3F5F7] font-sans text-[#344054]">
      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenTestCases={() => setIsTestModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleMobileMenu={() => setIsMobileNavOpen(true)}
          title={pageTitles[currentTab] || 'Manajemen Operasional'}
          category={pageCategories[currentTab] || 'Operasional'}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentTab}
              onOpenTestCases={() => setIsTestModalOpen(true)}
              refreshTrigger={refreshTrigger}
            />
          )}

          {currentTab === 'projects' && (
            <ProjectsPage showToast={showToast} />
          )}

          {currentTab === 'employees' && (
            <EmployeesPage showToast={showToast} />
          )}

          {currentTab === 'attendance' && (
            <AttendancePage
              showToast={showToast}
              onDataChanged={handleDataChanged}
            />
          )}

          {currentTab === 'overtime' && (
            <OvertimePage
              showToast={showToast}
              onDataChanged={handleDataChanged}
            />
          )}

          {currentTab === 'kasbon' && (
            <KasbonPage
              showToast={showToast}
              onDataChanged={handleDataChanged}
            />
          )}

          {currentTab === 'payroll' && (
            <PayrollPage
              showToast={showToast}
              onDataChanged={handleDataChanged}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesPage
              showToast={showToast}
              onDataChanged={handleDataChanged}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage showToast={showToast} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage showToast={showToast} onNavigate={setCurrentTab} />
          )}

          {currentTab === 'audit-logs' && (
            <AuditLogPage showToast={showToast} />
          )}
        </main>
      </div>

      {/* Mobile Drawer & Bottom Navigation */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenTestCases={() => setIsTestModalOpen(true)}
      />

      {/* Global Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* 8 Test Cases Verification Modal (Section 16) */}
      <TestCasesModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onDataChanged={handleDataChanged}
      />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <AppContent />
      </CompanyProvider>
    </AuthProvider>
  );
}
