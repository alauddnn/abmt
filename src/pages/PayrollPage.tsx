import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Calendar,
  Users,
  Search,
  CheckCircle,
  Printer,
  Ban,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingDown,
  X,
} from 'lucide-react';
import { SalaryPayment, Employee } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString, formatOvertimeDuration } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { SlipGajiModal } from '../components/SlipGajiModal.js';

interface PayrollPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

export const PayrollPage: React.FC<PayrollPageProps> = ({ showToast, onDataChanged }) => {
  const { isAdmin } = useAuth();

  // Bi-weekly cycle defaults: 1st-15th or 16th-end of month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const lastDayDate = new Date(year, month + 1, 0);
  const defaultStart = day <= 15
    ? `${year}-${String(month + 1).padStart(2, '0')}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-16`;

  const defaultEnd = day <= 15
    ? `${year}-${String(month + 1).padStart(2, '0')}-15`
    : `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

  const [periodStart, setPeriodStart] = useState<string>(defaultStart);
  const [periodEnd, setPeriodEnd] = useState<string>(defaultEnd);
  const [previewList, setPreviewList] = useState<any[]>([]);
  const [paymentsHistory, setPaymentsHistory] = useState<SalaryPayment[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Tabs: 'generate' or 'history'
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // Slip modal state
  const [selectedSlip, setSelectedSlip] = useState<SalaryPayment | null>(null);

  // Process payment dialog
  const [processingEmp, setProcessingEmp] = useState<any | null>(null);
  const [payForm, setPayForm] = useState({
    paymentDate: getTodayDateString(),
    paymentMethod: 'Transfer BCA' as SalaryPayment['paymentMethod'],
    referenceNumber: '',
    notes: '',
  });

  // Cancel dialog
  const [cancellingPayment, setCancellingPayment] = useState<SalaryPayment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadPreview = async () => {
    if (!periodStart || !periodEnd) return;
    setLoadingPreview(true);
    try {
      const data = await api.getPayrollPreview(periodStart, periodEnd);
      setPreviewList(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghitung kalkulasi gaji');
    } finally {
      setLoadingPreview(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.getSalaryPayments();
      setPaymentsHistory(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat riwayat pembayaran gaji');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [periodStart, periodEnd]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const openProcessDialog = (empCalc: any) => {
    if (empCalc.isPaid || empCalc.isAlreadyProcessed) {
      showToast('info', `Gaji ${empCalc.employeeName || empCalc.name} untuk periode ini sudah dibayarkan.`);
      return;
    }
    setProcessingEmp(empCalc);
    setPayForm({
      paymentDate: getTodayDateString(),
      paymentMethod: 'Transfer BCA',
      referenceNumber: '',
      notes: '',
    });
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processingEmp) return;
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang berhak memproses pembayaran gaji.');
      return;
    }

    try {
      const result = await api.processPayment({
        employeeId: processingEmp.employeeId,
        periodStart,
        periodEnd,
        paymentDate: payForm.paymentDate,
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber,
        totalWorkDays: processingEmp.totalWorkDays ?? processingEmp.workDays ?? 0,
        fullWorkDays: processingEmp.fullWorkDays ?? 0,
        halfWorkDays: processingEmp.halfWorkDays ?? 0,
        approvedOvertimeHours: processingEmp.approvedOvertimeHours ?? 0,
        totalBasicSalary: processingEmp.totalBasicSalary ?? processingEmp.basicSalary ?? 0,
        fullDaySalary: processingEmp.fullDaySalary ?? 0,
        halfDaySalary: processingEmp.halfDaySalary ?? 0,
        totalOvertimePay: processingEmp.totalOvertimePay ?? processingEmp.overtimePay ?? 0,
        grossSalary: processingEmp.grossSalary ?? 0,
        kasbonDeduction: processingEmp.proposedKasbonDeduction ?? 0,
        otherDeductions: 0,
        netSalary: processingEmp.netSalary ?? 0,
        notes: payForm.notes,
      });

      showToast('success', `Pembayaran gaji untuk ${processingEmp.employeeName || processingEmp.name} berhasil diproses.`);
      setProcessingEmp(null);
      fetchHistory();
      loadPreview();
      onDataChanged();

      // Automatically open printable slip
      setSelectedSlip(result);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memproses pembayaran gaji');
    }
  };

  const handleCancelPayment = async () => {
    if (!cancellingPayment) return;
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang berhak membatalkan pembayaran gaji.');
      return;
    }

    try {
      await api.cancelPayment(cancellingPayment.id, cancelReason);
      showToast('success', `Pembayaran ${cancellingPayment.paymentNumber} berhasil dibatalkan dan potongan kasbon dikembalikan.`);
      setCancellingPayment(null);
      setCancelReason('');
      fetchHistory();
      loadPreview();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal membatalkan pembayaran');
    }
  };

  const totalGrossInPreview = previewList.reduce((sum, item) => sum + item.grossSalary, 0);
  const totalNetInPreview = previewList.reduce((sum, item) => sum + item.netSalary, 0);
  const totalKasbonInPreview = previewList.reduce((sum, item) => sum + item.proposedKasbonDeduction, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#4693FD] text-xs font-semibold tracking-tight">
              PT. Asta Brata Matahari Terbit
            </span>
            <span className="text-[#D0D5DD]">·</span>
            <span className="text-xs text-[#667085] font-medium font-mono">
              Formula: Gaji Bersih = (Pokok + Lembur Disetujui) - Kasbon Disetujui
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Pembayaran Gaji Dua Mingguan
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Akumulasi hari kerja, lembur disetujui, pemotongan kasbon otomatis tanpa duplikasi, dan cetak slip gaji.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0] shrink-0">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'generate' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
            }`}
          >
            Kalkulasi & Pembayaran
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'history' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
            }`}
          >
            Riwayat Pembayaran ({paymentsHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'generate' ? (
        <>
          {/* Period Selector Card */}
          <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs text-[#262626]">Pilih Rentang Periode Dua Mingguan</h3>
                  <p className="text-[11px] text-[#667085]">Pilih rentang absensi kerja karyawan yang akan diproses penggajiannya</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#667085] font-medium">Dari:</span>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] font-mono focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#667085] font-medium">Sampai:</span>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] font-mono focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <button
                  onClick={loadPreview}
                  disabled={loadingPreview}
                  className="px-3.5 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
                >
                  {loadingPreview ? 'Menghitung...' : 'Hitung Ulang'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
              <span className="text-xs font-medium text-[#667085]">Total Gaji Kotor Periode Ini</span>
              <p className="text-2xl font-semibold text-[#262626] tracking-tight mt-1 tabular-nums">{formatRupiah(totalGrossInPreview)}</p>
              <span className="text-[11px] text-[#667085] mt-0.5 block">Akumulasi gaji pokok + seluruh lembur disetujui</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
              <span className="text-xs font-medium text-[#667085]">Total Pemotongan Kasbon</span>
              <p className="text-2xl font-semibold text-[#D64545] tracking-tight mt-1 tabular-nums">{formatRupiah(totalKasbonInPreview)}</p>
              <span className="text-[11px] text-[#667085] mt-0.5 block">Dipotong otomatis dari saldo kasbon karyawan yang aktif</span>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
              <span className="text-xs font-medium text-[#667085]">Total Gaji Bersih Diterima</span>
              <p className="text-2xl font-semibold text-[#16A36A] tracking-tight mt-1 tabular-nums">{formatRupiah(totalNetInPreview)}</p>
              <span className="text-[11px] text-[#667085] mt-0.5 block">Total kewajiban kas bersih yang dibayarkan perusahaan</span>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="p-4 bg-white border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-xs text-[#262626]">
                  Kalkulasi Penggajian Periode {formatDateID(periodStart)} s/d {formatDateID(periodEnd)}
                </h3>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  Rumus: Total Upah Kotor = Upah Harian Penuh + Upah Setengah Hari + Upah Lembur (Jam & Menit). Total Bersih = Kotor − Kasbon.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#EFF5FF] text-[#4693FD]">
                {previewList.length} Karyawan Aktif
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Jabatan</th>
                    <th className="py-3 px-4">Rincian Hari Kerja</th>
                    <th className="py-3 px-4">Durasi Lembur</th>
                    <th className="py-3 px-4 font-mono">Upah Harian Penuh</th>
                    <th className="py-3 px-4 font-mono">Upah ½ Hari</th>
                    <th className="py-3 px-4 font-mono">Upah Lembur</th>
                    <th className="py-3 px-4 font-mono">Total Kotor</th>
                    <th className="py-3 px-4 font-mono text-[#D64545]">Potongan Kasbon</th>
                    <th className="py-3 px-4 font-mono">Total Bersih</th>
                    <th className="py-3 px-4">Status Periode</th>
                    <th className="py-3 px-4 text-center">Aksi Pembayaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingPreview ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-[#667085]">
                        Menghitung rincian gaji karyawan...
                      </td>
                    </tr>
                  ) : previewList.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-[#667085]">
                        Tidak ada data kalkulasi untuk rentang periode ini.
                      </td>
                    </tr>
                  ) : (
                    previewList.map((emp) => {
                      const empName = emp.employeeName || emp.name;
                      const empRole = emp.employeeRole || emp.role;
                      const workDays = emp.totalWorkDays ?? emp.workDays ?? 0;
                      const fullDays = emp.fullWorkDays ?? Math.floor(workDays);
                      const halfDays = emp.halfWorkDays ?? (workDays % 1 !== 0 ? 1 : 0);
                      const basicSalary = emp.totalBasicSalary ?? emp.basicSalary ?? 0;
                      const fullSalary = emp.fullDaySalary ?? (halfDays === 0 ? basicSalary : 0);
                      const halfSalary = emp.halfDaySalary ?? 0;
                      const overtimePay = emp.totalOvertimePay ?? emp.overtimePay ?? 0;
                      const grossSalary = emp.grossSalary ?? (basicSalary + overtimePay);
                      const kasbonDed = emp.proposedKasbonDeduction ?? 0;
                      const netSalary = emp.netSalary ?? Math.max(0, grossSalary - kasbonDed);
                      const isPaid = emp.isPaid || emp.isAlreadyProcessed;

                      return (
                      <tr key={emp.employeeId} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">
                          {empName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {empRole === 'Mandor' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9F5FF] text-[#7F56D9] border border-[#E9D7FE]">
                              Mandor
                            </span>
                          )}
                          {empRole === 'Tukang' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF5FF] text-[#4693FD] border border-[#D1E9FF]">
                              Tukang
                            </span>
                          )}
                          {(empRole === 'Helper' || empRole === 'Kenek') && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF7EC] text-[#D99A23] border border-[#FEDF89]">
                              Helper
                            </span>
                          )}
                          {empRole === 'Driver' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF9] text-[#0E9384] border border-[#99F6E0]">
                              Driver
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#262626] whitespace-nowrap">
                          <div>{fullDays} Penuh{halfDays > 0 ? ` + ${halfDays} (½ Hari)` : ''}</div>
                          <div className="text-[10px] text-[#667085]">Total: {workDays} hari</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#262626] whitespace-nowrap">
                          {emp.approvedOvertimeHours > 0 ? (
                            <span className="font-medium text-[#4693FD]">{formatOvertimeDuration(emp.approvedOvertimeHours)}</span>
                          ) : (
                            <span className="text-[#98A2B3]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#262626] whitespace-nowrap tabular-nums">
                          {formatRupiah(fullSalary)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#175CD3] whitespace-nowrap tabular-nums">
                          {halfSalary > 0 ? formatRupiah(halfSalary) : <span className="text-[#98A2B3]">-</span>}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap tabular-nums">
                          {formatRupiah(overtimePay)}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap tabular-nums">
                          {formatRupiah(grossSalary)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#D64545] whitespace-nowrap tabular-nums">
                          {kasbonDed > 0 ? (
                            <span>- {formatRupiah(kasbonDed)}</span>
                          ) : (
                            <span className="text-[#98A2B3]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#16A36A] whitespace-nowrap tabular-nums">
                          {formatRupiah(netSalary)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              isPaid
                                ? 'bg-[#ECFDF3] text-[#16A36A]'
                                : 'bg-[#FEF7EC] text-[#D99A23]'
                            }`}
                          >
                            {isPaid ? 'Sudah Dibayar' : 'Belum Dibayar'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isPaid ? (
                            <button
                              onClick={() => {
                                const hist = paymentsHistory.find(
                                  (p) =>
                                    p.employeeId === emp.employeeId &&
                                    (p.periodStart?.split('T')[0] === periodStart) &&
                                    (p.periodEnd?.split('T')[0] === periodEnd) &&
                                    p.status === 'Sudah dibayar'
                                );
                                if (hist) setSelectedSlip(hist);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-md border border-[#D0D5DD] transition-colors text-xs"
                            >
                              <Printer className="w-3 h-3 text-[#4693FD]" />
                              Slip Gaji
                            </button>
                          ) : isAdmin ? (
                            <button
                              onClick={() => openProcessDialog(emp)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-md text-xs shadow-xs transition-colors"
                            >
                              <CreditCard className="w-3 h-3" />
                              Bayar Gaji
                            </button>
                          ) : (
                            <span className="text-[#98A2B3] text-[11px]">Hanya Lihat (Owner)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#EAECF0] flex items-center justify-between">
            <h3 className="font-semibold text-xs text-[#262626]">
              Riwayat Pembayaran Gaji Karyawan ({paymentsHistory.length} Transaksi)
            </h3>
            <span className="text-xs text-[#667085]">Tercatat dalam sistem akuntansi</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                  <th className="py-3 px-4">No. Pembayaran</th>
                  <th className="py-3 px-4">Tanggal Pembayaran</th>
                  <th className="py-3 px-4">Periode Gaji</th>
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4">Jabatan</th>
                  <th className="py-3 px-4 font-mono">Gaji Kotor</th>
                  <th className="py-3 px-4 font-mono text-[#D64545]">Potongan Kasbon</th>
                  <th className="py-3 px-4 font-mono">Gaji Bersih</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-[#667085]">
                      Memuat riwayat pembayaran...
                    </td>
                  </tr>
                ) : paymentsHistory.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-[#667085]">
                      Belum ada transaksi pembayaran gaji yang tercatat.
                    </td>
                  </tr>
                ) : (
                  paymentsHistory.map((pay) => (
                    <tr key={pay.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap">
                        {pay.paymentNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                        {formatDateID(pay.paymentDate)}
                      </td>
                      <td className="py-3 px-4 text-[#667085] whitespace-nowrap">
                        {formatDateID(pay.periodStart)} - {formatDateID(pay.periodEnd)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">{pay.employeeName}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {pay.employeeRole === 'Mandor' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9F5FF] text-[#7F56D9] border border-[#E9D7FE]">
                            Mandor
                          </span>
                        )}
                        {pay.employeeRole === 'Tukang' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF5FF] text-[#4693FD] border border-[#D1E9FF]">
                            Tukang
                          </span>
                        )}
                        {(pay.employeeRole === 'Helper' || pay.employeeRole === 'Kenek') && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF7EC] text-[#D99A23] border border-[#FEDF89]">
                            Helper
                          </span>
                        )}
                        {pay.employeeRole === 'Driver' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF9] text-[#0E9384] border border-[#99F6E0]">
                            Driver
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#262626] whitespace-nowrap tabular-nums">
                        {formatRupiah(pay.grossSalary)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#D64545] whitespace-nowrap tabular-nums">
                        {pay.kasbonDeduction > 0 ? `- ${formatRupiah(pay.kasbonDeduction)}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#16A36A] whitespace-nowrap tabular-nums">
                        {formatRupiah(pay.netSalary)}
                      </td>
                      <td className="py-3 px-4 text-[#667085] whitespace-nowrap">{pay.paymentMethod}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            pay.status === 'Sudah dibayar'
                              ? 'bg-[#ECFDF3] text-[#16A36A]'
                              : pay.status === 'Diproses'
                              ? 'bg-[#FEF7EC] text-[#D99A23]'
                              : 'bg-[#FEF3F2] text-[#D64545]'
                          }`}
                        >
                          {pay.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedSlip(pay)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-md border border-[#D0D5DD] transition-colors text-xs"
                          >
                            <Printer className="w-3 h-3 text-[#4693FD]" />
                            Slip
                          </button>
                          {isAdmin && pay.status === 'Sudah dibayar' && (
                            <button
                              onClick={() => {
                                setCancellingPayment(pay);
                                setCancelReason('');
                              }}
                              className="p-1 text-[#D64545] hover:bg-[#FEF3F2] rounded"
                              title="Batalkan pembayaran gaji & kembalikan kasbon"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process Payment Dialog */}
      {processingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Proses Pembayaran Gaji Karyawan</h3>
                <p className="text-[11px] text-[#667085]">
                  {processingEmp.employeeName || processingEmp.name} ({processingEmp.employeeRole || processingEmp.role})
                </p>
              </div>
              <button
                onClick={() => setProcessingEmp(null)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4 text-xs">
              {/* Financial Calculation Review */}
              <div className="p-3.5 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-2">
                <div className="flex items-center justify-between text-[#667085]">
                  <span>Upah Harian Penuh ({processingEmp.fullWorkDays ?? processingEmp.totalWorkDays ?? 0} hari):</span>
                  <span className="font-medium text-[#262626] font-mono tabular-nums">
                    {formatRupiah(processingEmp.fullDaySalary ?? processingEmp.totalBasicSalary ?? 0)}
                  </span>
                </div>
                {(processingEmp.halfWorkDays ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-[#175CD3]">
                    <span>Upah Setengah Hari ({processingEmp.halfWorkDays} × ½ hari):</span>
                    <span className="font-medium font-mono tabular-nums">
                      {formatRupiah(processingEmp.halfDaySalary ?? 0)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[#667085]">
                  <span>Upah Lembur ({formatOvertimeDuration(processingEmp.approvedOvertimeHours ?? 0)}):</span>
                  <span className="font-medium text-[#262626] font-mono tabular-nums">
                    {formatRupiah(processingEmp.totalOvertimePay ?? processingEmp.overtimePay ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#262626] font-medium pt-1 border-t border-[#EAECF0]">
                  <span>Total Upah Kotor:</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(processingEmp.grossSalary ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#D64545]">
                  <span>Potongan Kasbon Otomatis:</span>
                  <span className="font-medium font-mono tabular-nums">
                    - {formatRupiah(processingEmp.proposedKasbonDeduction ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EAECF0] font-semibold text-[#16A36A]">
                  <span className="uppercase text-[11px]">Total Upah Bersih Dibayarkan:</span>
                  <span className="text-sm font-mono tabular-nums">
                    {formatRupiah(processingEmp.netSalary ?? 0)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Tanggal Bayar *</label>
                  <input
                    type="date"
                    required
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Metode Pembayaran *</label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) =>
                      setPayForm({
                        ...payForm,
                        paymentMethod: e.target.value as SalaryPayment['paymentMethod'],
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="Transfer BCA">Transfer BCA</option>
                    <option value="Transfer Mandiri">Transfer Mandiri</option>
                    <option value="Transfer BRI">Transfer BRI</option>
                    <option value="Kas Tunai">Kas Tunai Proyek</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  Nomor Referensi Transaksi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: TRF-BCA-202610-091"
                  value={payForm.referenceNumber}
                  onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Catatan Pembayaran</label>
                <textarea
                  rows={2}
                  placeholder="Catatan pada slip pembayaran gaji..."
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setProcessingEmp(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  Konfirmasi & Cetak Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Payment Dialog */}
      {cancellingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <h3 className="font-semibold text-sm">Batalkan Pembayaran Gaji</h3>
              <button
                onClick={() => setCancellingPayment(null)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#667085]">
                Anda akan membatalkan pembayaran <span className="font-semibold text-[#262626]">{cancellingPayment.paymentNumber}</span> untuk <span className="font-semibold text-[#262626]">{cancellingPayment.employeeName}</span> sebesar <span className="font-semibold text-[#262626]">{formatRupiah(cancellingPayment.netSalary)}</span>.
              </p>
              <div className="p-3 bg-[#FEF7EC] rounded-lg border border-[#FEDF89] text-[#D99A23]">
                Potongan kasbon sebesar {formatRupiah(cancellingPayment.kasbonDeduction)} akan otomatis dikembalikan ke saldo kasbon aktif karyawan.
              </div>
              <div>
                <label className="block font-medium text-[#344054] mb-1">Alasan Pembatalan</label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Kesalahan input hari kerja atau revisi lembur..."
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>
              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancellingPayment(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCancelPayment}
                  className="px-4 py-1.5 bg-[#D64545] hover:bg-[#b93838] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  Konfirmasi Pembatalan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip Gaji Modal */}
      <SlipGajiModal payment={selectedSlip} onClose={() => setSelectedSlip(null)} />
    </div>
  );
};
