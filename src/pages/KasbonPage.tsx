import React, { useState, useEffect } from 'react';
import {
  Wallet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  ShieldAlert,
  Calendar,
  History,
  Info,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { KasbonRecord, Employee } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString, getDaysDifference } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

interface KasbonPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

export const KasbonPage: React.FC<KasbonPageProps> = ({ showToast, onDataChanged }) => {
  const { isAdmin } = useAuth();
  const { settings } = useCompany();

  const [kasbonList, setKasbonList] = useState<KasbonRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // New Kasbon Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    requestDate: getTodayDateString(),
    amount: 200000,
    reason: '',
    targetPaymentPeriod: '',
    adminNotes: '',
  });

  // Rejection / Approval Modal
  const [selectedKasbon, setSelectedKasbon] = useState<KasbonRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Audit modal
  const [auditModalItem, setAuditModalItem] = useState<KasbonRecord | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kbs, emps] = await Promise.all([api.getKasbon(), api.getEmployees()]);
      setKasbonList(kbs);
      setEmployees(emps);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data kasbon');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
    setForm({
      employeeId: employees[0]?.id || '',
      requestDate: getTodayDateString(),
      amount: 200000,
      reason: '',
      targetPaymentPeriod: '',
      adminNotes: '',
    });
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      showToast('error', 'Pilih karyawan.');
      return;
    }
    if (form.amount <= 0) {
      showToast('error', 'Nominal kasbon harus lebih dari 0.');
      return;
    }
    if (!form.reason.trim()) {
      showToast('error', 'Alasan pengajuan kasbon wajib diisi.');
      return;
    }

    try {
      await api.createKasbon({
        employeeId: form.employeeId,
        requestDate: form.requestDate,
        amount: Number(form.amount),
        reason: form.reason,
        targetPaymentPeriod: form.targetPaymentPeriod,
        adminNotes: form.adminNotes,
      });
      showToast('success', 'Permohonan kasbon baru berhasil diajukan.');
      setIsModalOpen(false);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengajukan kasbon');
    }
  };

  const openApproveDialog = (kb: KasbonRecord) => {
    setSelectedKasbon(kb);
    setActionType('approve');
  };

  const openRejectDialog = (kb: KasbonRecord) => {
    setSelectedKasbon(kb);
    setActionType('reject');
    setRejectionReason('');
  };

  const handleConfirmAction = async () => {
    if (!selectedKasbon || !actionType) return;
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang berhak memproses permohonan kasbon.');
      return;
    }

    try {
      if (actionType === 'approve') {
        await api.updateKasbonStatus(selectedKasbon.id, 'approve');
        showToast('success', `Kasbon ${selectedKasbon.kasbonNumber} berhasil disetujui.`);
      } else {
        if (!rejectionReason.trim()) {
          showToast('error', 'Alasan penolakan wajib diisi.');
          return;
        }
        await api.updateKasbonStatus(selectedKasbon.id, 'reject', rejectionReason);
        showToast('info', `Kasbon ${selectedKasbon.kasbonNumber} telah ditolak.`);
      }
      setSelectedKasbon(null);
      setActionType(null);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memproses permohonan kasbon');
    }
  };

  const filtered = kasbonList.filter((k) => {
    const matchesSearch =
      k.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      k.kasbonNumber.toLowerCase().includes(search.toLowerCase()) ||
      k.reason.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || k.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPiutangKasbon = kasbonList
    .filter((k) => (k.status === 'Disetujui' || k.status === 'Dipotong sebagian') && k.remainingAmount > 0)
    .reduce((sum, k) => sum + k.remainingAmount, 0);

  const totalKasbonDipotong = kasbonList.reduce((sum, k) => sum + k.deductedAmount, 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#4693FD] text-xs font-semibold tracking-tight">
              PT. Asta Brata Matahari Terbit
            </span>
            <span className="text-[#D0D5DD]">·</span>
            <span className="text-xs text-[#667085] font-medium font-mono">
              Piutang Kasbon Aktif: {formatRupiah(totalPiutangKasbon)}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Sistem Kasbon & Pinjaman Karyawan
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Verifikasi masa kerja otomatis: Karyawan hanya dapat disetujui setelah bekerja minimal 7 hari kalender.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Kasbon Baru</span>
          </button>
        )}
      </div>

      {/* Highlights summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
          <span className="text-xs font-medium text-[#667085]">Sisa Kasbon Aktif (Piutang Perusahaan)</span>
          <p className="text-2xl font-semibold text-[#262626] tracking-tight mt-1 tabular-nums">{formatRupiah(totalPiutangKasbon)}</p>
          <span className="text-[11px] text-[#667085] mt-0.5 block">Dipotong bertahap pada slip gaji 2-mingguan</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
          <span className="text-xs font-medium text-[#667085]">Total Kasbon yang Sudah Dilunasi</span>
          <p className="text-2xl font-semibold text-[#16A36A] tracking-tight mt-1 tabular-nums">{formatRupiah(totalKasbonDipotong)}</p>
          <span className="text-[11px] text-[#667085] mt-0.5 block">Telah dipotong dari pembayaran gaji periode sebelumnya</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#4693FD] uppercase tracking-wider">Aturan Keamanan Kasbon</span>
            <p className="text-xs text-[#667085] mt-1 leading-relaxed">
              Verifikasi masa kerja mencegah pinjaman bagi pekerja yang baru bergabung &lt; 7 hari.
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center shrink-0 ml-3">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama atau nomor kasbon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
          />
        </div>

        <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0] overflow-x-auto w-full md:w-auto">
          {['all', 'Menunggu persetujuan', 'Disetujui', 'Dipotong sebagian', 'Lunas', 'Ditolak'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 font-medium rounded-md whitespace-nowrap transition-colors ${
                statusFilter === s ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              {s === 'all' ? 'Semua Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Kasbon Table */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                <th className="py-3 px-4">No. Kasbon</th>
                <th className="py-3 px-4">Tanggal Pengajuan</th>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Masa Kerja Saat Pengajuan</th>
                <th className="py-3 px-4 font-mono">Pinjaman</th>
                <th className="py-3 px-4 font-mono">Sisa Saldo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Alasan & Catatan</th>
                <th className="py-3 px-4 text-center">Aksi / Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#667085]">
                    Memuat data kasbon...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#667085]">
                    Belum ada data kasbon sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map((kb) => {
                  const tenureDays = kb.employeeStartDate ? getDaysDifference(kb.employeeStartDate, kb.requestDate) : 0;
                  const isEligible = kb.isEligible ?? (tenureDays >= 7);

                  return (
                    <tr key={kb.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap">
                        {kb.kasbonNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                        {formatDateID(kb.requestDate)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">
                        {kb.employeeName}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            kb.employeeRole === 'Tukang'
                              ? 'bg-[#EFF5FF] text-[#4693FD]'
                              : 'bg-[#FEF7EC] text-[#D99A23]'
                          }`}
                        >
                          {kb.employeeRole}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            isEligible
                              ? 'bg-[#ECFDF3] text-[#16A36A]'
                              : 'bg-[#FEF3F2] text-[#D64545]'
                          }`}
                        >
                          {isEligible ? (
                            <CheckCircle2 className="w-3 h-3 text-[#16A36A]" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-[#D64545]" />
                          )}
                          {tenureDays} Hari {isEligible ? '(Memenuhi Syarat)' : '(< 7 Hari)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap tabular-nums">
                        {formatRupiah(kb.amount)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#D99A23] whitespace-nowrap tabular-nums">
                        {formatRupiah(kb.remainingAmount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            kb.status === 'Disetujui' || kb.status === 'Lunas'
                              ? 'bg-[#ECFDF3] text-[#16A36A]'
                              : kb.status === 'Menunggu persetujuan'
                              ? 'bg-[#FEF7EC] text-[#D99A23]'
                              : kb.status === 'Dipotong sebagian'
                              ? 'bg-[#EFF5FF] text-[#4693FD]'
                              : 'bg-[#FEF3F2] text-[#D64545]'
                          }`}
                        >
                          {kb.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[#667085]">
                        <p className="font-medium text-[#262626] truncate">{kb.reason}</p>
                        {kb.rejectionReason && (
                          <p className="text-[#D64545] text-[11px] truncate">Ditolak: {kb.rejectionReason}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {isAdmin && kb.status === 'Menunggu persetujuan' && (
                            <>
                              <button
                                onClick={() => openApproveDialog(kb)}
                                className="px-2 py-1 bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#16A36A] font-medium rounded text-xs transition-colors"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => openRejectDialog(kb)}
                                className="px-2 py-1 bg-[#FEF3F2] hover:bg-[#FECDCA] text-[#D64545] font-medium rounded text-xs transition-colors"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {kb.auditTrail && kb.auditTrail.length > 0 && (
                            <button
                              onClick={() => setAuditModalItem(kb)}
                              className="p-1 text-[#4693FD] hover:bg-[#EFF5FF] rounded"
                              title="Riwayat persetujuan & pemotongan kasbon"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Kasbon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Ajukan Kasbon Karyawan Baru</h3>
                <p className="text-[11px] text-[#667085]">Syarat wajib minimal telah bekerja 7 hari</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#344054] mb-1">Pilih Karyawan *</label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map((e) => {
                    const days = getDaysDifference(e.startDate, form.requestDate);
                    const eligible = days >= 7;
                    return (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role}) - Masa kerja: {days} hari {eligible ? '✓' : '(Baru bergabung)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Tanggal Pengajuan *</label>
                  <input
                    type="date"
                    required
                    value={form.requestDate}
                    onChange={(e) => setForm({ ...form, requestDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Nominal Pinjaman (IDR) *</label>
                  <input
                    type="number"
                    step={10000}
                    min={10000}
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Alasan Pengajuan Kasbon *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Keperluan darurat keluarga atau biaya berobat..."
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  Rencana Pemotongan Gaji (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dipotong penuh pada gaji periode 1-15 Oktober"
                  value={form.targetPaymentPeriod}
                  onChange={(e) => setForm({ ...form, targetPaymentPeriod: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  Ajukan Kasbon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval or Rejection Dialog */}
      {selectedKasbon && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {actionType === 'approve' ? 'Konfirmasi Persetujuan Kasbon' : 'Penolakan Permohonan Kasbon'}
              </h3>
              <button
                onClick={() => {
                  setSelectedKasbon(null);
                  setActionType(null);
                }}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {(() => {
                const selTenureDays = selectedKasbon.employeeStartDate
                  ? getDaysDifference(selectedKasbon.employeeStartDate, selectedKasbon.requestDate)
                  : 0;
                const selEligible = selectedKasbon.isEligible ?? (selTenureDays >= 7);

                return (
                  <>
                    <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
                      <p className="text-[#667085]">
                        Karyawan: <span className="font-semibold text-[#262626]">{selectedKasbon.employeeName}</span> ({selectedKasbon.employeeRole})
                      </p>
                      <p className="text-[#667085] mt-1">
                        Nominal: <span className="font-semibold text-[#262626] font-mono">{formatRupiah(selectedKasbon.amount)}</span>
                      </p>
                      <p className="text-[#667085] mt-1">
                        Masa Kerja: <span className="font-semibold text-[#262626]">{selTenureDays} hari</span>
                      </p>
                      <p className="text-[#667085] mt-1">
                        Alasan: <span className="font-medium text-[#262626]">{selectedKasbon.reason}</span>
                      </p>
                    </div>

                    {actionType === 'approve' ? (
                      !selEligible ? (
                        <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-lg text-[#D64545] flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">Peringatan Validasi Masa Kerja!</p>
                            <p className="mt-0.5">
                              Karyawan baru bekerja {selTenureDays} hari (&lt; 7 hari). Aturan perusahaan tidak mengizinkan persetujuan kasbon bagi pekerja baru.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[#667085]">
                          Karyawan telah memenuhi syarat masa kerja minimal 7 hari ({selTenureDays} hari). Setujui pencairan kasbon ini?
                        </p>
                      )
                    ) : (
                      <div>
                        <label className="block font-medium text-[#344054] mb-1">
                          Alasan Penolakan Kasbon *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Contoh: Belum memenuhi syarat masa kerja minimal 1 minggu..."
                          className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                        />
                      </div>
                    )}

                    <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKasbon(null);
                          setActionType(null);
                        }}
                        className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAction}
                        disabled={actionType === 'approve' && !selEligible}
                        className={`px-4 py-1.5 text-white font-medium rounded-lg text-xs shadow-xs transition-colors disabled:opacity-40 ${
                          actionType === 'approve'
                            ? 'bg-[#16A36A] hover:bg-[#138a59]'
                            : 'bg-[#D64545] hover:bg-[#b93838]'
                        }`}
                      >
                        {actionType === 'approve' ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {auditModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#4693FD]" />
                <h3 className="font-semibold text-sm">Riwayat Kasbon & Pemotongan Gaji</h3>
              </div>
              <button
                onClick={() => setAuditModalItem(null)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto space-y-2 text-xs">
              {auditModalItem.auditTrail?.map((trail, idx) => (
                <div key={idx} className="p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
                  <div className="flex items-center justify-between text-[#667085] text-[11px]">
                    <span className="font-medium text-[#262626]">{trail.user}</span>
                    <span>{formatDateID(trail.timestamp.split('T')[0])}</span>
                  </div>
                  <p className="mt-1 text-[#344054]">{trail.action}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 bg-[#F9FAFB] border-t border-[#EAECF0] text-right">
              <button
                onClick={() => setAuditModalItem(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
