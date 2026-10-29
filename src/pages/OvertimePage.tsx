import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Plus,
  Shield,
  Edit2,
  Calendar,
  History,
  X,
} from 'lucide-react';
import { OvertimeRecord, Employee } from '../types.js';
import { api } from '../lib/api.js';
import {
  formatRupiah,
  formatDateID,
  getTodayDateString,
  splitHoursMinutes,
  calculateOvertimePayFromHoursMinutes,
  formatOvertimeDuration,
} from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';

interface OvertimePageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

export const OvertimePage: React.FC<OvertimePageProps> = ({ showToast, onDataChanged }) => {
  const { isAdmin } = useAuth();
  const [overtimeList, setOvertimeList] = useState<OvertimeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal State for new overtime
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    date: getTodayDateString(),
    employeeId: '',
    startTime: '16:00',
    endTime: '17:30',
    durationHours: 1,
    durationMinutes: 30,
    notes: '',
  });

  // Modal for audit history
  const [auditModalItem, setAuditModalItem] = useState<OvertimeRecord | null>(null);

  // Modal for correction
  const [editingItem, setEditingItem] = useState<OvertimeRecord | null>(null);
  const [correctDurationHours, setCorrectDurationHours] = useState<number>(1);
  const [correctDurationMinutes, setCorrectDurationMinutes] = useState<number>(0);
  const [correctStatus, setCorrectStatus] = useState<OvertimeRecord['status']>('Disetujui');
  const [correctNotes, setCorrectNotes] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ots, emps] = await Promise.all([api.getOvertime(), api.getEmployees()]);
      setOvertimeList(ots);
      setEmployees(emps);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data lembur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const syncDurationFromTimes = (start: string, end: string) => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
    let diffMins = eh * 60 + em - (sh * 60 + sm);
    if (diffMins < 0) diffMins += 24 * 60;
    if (diffMins <= 0) return null;
    return {
      durationHours: Math.floor(diffMins / 60),
      durationMinutes: diffMins % 60,
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      showToast('error', 'Pilih karyawan.');
      return;
    }
    const dHours = Math.max(0, Math.floor(Number(form.durationHours) || 0));
    const dMins = Math.max(0, Math.min(59, Math.round(Number(form.durationMinutes) || 0)));
    const totalMins = dHours * 60 + dMins;
    if (totalMins <= 0) {
      showToast('error', 'Durasi lembur (jam/menit) harus lebih dari 0.');
      return;
    }

    try {
      await api.createOvertime({
        date: form.date,
        employeeId: form.employeeId,
        startTime: form.startTime,
        endTime: form.endTime,
        hours: Number((totalMins / 60).toFixed(4)),
        durationHours: dHours,
        durationMinutes: dMins,
        notes: form.notes,
      });
      showToast('success', 'Catatan lembur baru berhasil disimpan.');
      setIsModalOpen(false);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengajukan lembur');
    }
  };

  const handleApprove = async (id: string) => {
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang berhak menyetujui lembur.');
      return;
    }
    try {
      await api.updateOvertimeStatus(id, 'Disetujui');
      showToast('success', 'Lembur berhasil disetujui.');
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyetujui lembur');
    }
  };

  const handleReject = async (id: string) => {
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang berhak menolak lembur.');
      return;
    }
    try {
      await api.updateOvertimeStatus(id, 'Ditolak');
      showToast('info', 'Lembur telah ditolak.');
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menolak lembur');
    }
  };

  const openCorrectionModal = (ot: OvertimeRecord) => {
    const hm = splitHoursMinutes(ot.hours);
    setEditingItem(ot);
    setCorrectDurationHours(hm.hours);
    setCorrectDurationMinutes(hm.minutes);
    setCorrectStatus(ot.status);
    setCorrectNotes(ot.notes || '');
  };

  const handleSaveCorrection = async () => {
    if (!editingItem) return;
    const dHours = Math.max(0, Math.floor(Number(correctDurationHours) || 0));
    const dMins = Math.max(0, Math.min(59, Math.round(Number(correctDurationMinutes) || 0)));
    const decHours = Number(((dHours * 60 + dMins) / 60).toFixed(4));
    try {
      await api.updateOvertimeStatus(
        editingItem.id,
        correctStatus,
        decHours,
        correctNotes,
        dHours,
        dMins
      );
      showToast('success', 'Koreksi durasi & upah lembur berhasil disimpan.');
      setEditingItem(null);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengoreksi lembur');
    }
  };

  const filtered = overtimeList.filter((ot) => {
    const matchesSearch =
      ot.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      ot.notes?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalHoursApproved = Number(
    overtimeList
      .filter((o) => o.status === 'Disetujui')
      .reduce((sum, o) => sum + o.hours, 0)
      .toFixed(4)
  );

  const totalPayApproved = overtimeList
    .filter((o) => o.status === 'Disetujui')
    .reduce((sum, o) => sum + o.totalPay, 0);

  const selectedCreateEmp = employees.find((e) => e.id === form.employeeId);
  const createPreviewPay = selectedCreateEmp
    ? calculateOvertimePayFromHoursMinutes(form.durationHours, form.durationMinutes, selectedCreateEmp.overtimeHourlyWage)
    : 0;

  const correctionPreviewPay = editingItem
    ? calculateOvertimePayFromHoursMinutes(
        correctDurationHours,
        correctDurationMinutes,
        editingItem.hourlyRateSnapshot
      )
    : 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#4693FD] text-xs font-semibold tracking-tight">
              PT. Asta Brata Matahari Terbit
            </span>
            <span className="text-[#D0D5DD]">·</span>
            <span className="text-xs text-[#667085] font-medium font-mono">
              Total Disetujui: {formatOvertimeDuration(totalHoursApproved)} ({formatRupiah(totalPayApproved)})
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Pencatatan & Persetujuan Lembur (Jam & Menit)
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Upah lembur dihitung proporsional berdasarkan durasi aktual jam dan menit × tarif lembur per jam tanpa pembulatan durasi.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setForm({
                date: getTodayDateString(),
                employeeId: employees[0]?.id || '',
                startTime: '16:00',
                endTime: '17:30',
                durationHours: 1,
                durationMinutes: 30,
                notes: '',
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Lembur Baru</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
          />
        </div>

        <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0] w-full md:w-auto">
          {['all', 'Menunggu persetujuan', 'Disetujui', 'Ditolak'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                statusFilter === s ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              {s === 'all' ? 'Semua Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Overtime Table */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Waktu Lembur</th>
                <th className="py-3 px-4">Durasi Aktual</th>
                <th className="py-3 px-4">Tarif / Jam</th>
                <th className="py-3 px-4">Total Upah</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4 text-center">Aksi / Persetujuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#667085]">
                    Memuat data lembur...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#667085]">
                    Belum ada catatan lembur sesuai filter.
                  </td>
                </tr>
              ) : (
                filtered.map((ot) => (
                  <tr key={ot.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                      {formatDateID(ot.date)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">{ot.employeeName}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {ot.employeeRole === 'Mandor' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9F5FF] text-[#7F56D9] border border-[#E9D7FE]">
                          Mandor
                        </span>
                      )}
                      {ot.employeeRole === 'Tukang' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF5FF] text-[#4693FD] border border-[#D1E9FF]">
                          Tukang
                        </span>
                      )}
                      {(ot.employeeRole === 'Helper' || ot.employeeRole === 'Kenek') && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF7EC] text-[#D99A23] border border-[#FEDF89]">
                          Helper
                        </span>
                      )}
                      {ot.employeeRole === 'Driver' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF9] text-[#0E9384] border border-[#99F6E0]">
                          Driver
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#667085] whitespace-nowrap">
                      {ot.startTime} - {ot.endTime || 'Selesai'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap">
                      {formatOvertimeDuration(ot.hours)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap tabular-nums">
                      {formatRupiah(ot.hourlyRateSnapshot)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#262626] whitespace-nowrap tabular-nums">
                      {formatRupiah(ot.totalPay)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          ot.status === 'Disetujui'
                            ? 'bg-[#ECFDF3] text-[#16A36A]'
                            : ot.status === 'Menunggu persetujuan'
                            ? 'bg-[#FEF7EC] text-[#D99A23]'
                            : 'bg-[#FEF3F2] text-[#D64545]'
                        }`}
                      >
                        {ot.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-[#667085]">{ot.notes || '-'}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {isAdmin && ot.status === 'Menunggu persetujuan' && (
                          <>
                            <button
                              onClick={() => handleApprove(ot.id)}
                              className="px-2 py-1 bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#16A36A] font-medium rounded text-xs transition-colors"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleReject(ot.id)}
                              className="px-2 py-1 bg-[#FEF3F2] hover:bg-[#FECDCA] text-[#D64545] font-medium rounded text-xs transition-colors"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => openCorrectionModal(ot)}
                            className="p-1 text-[#667085] hover:text-[#262626] hover:bg-[#F2F4F7] rounded"
                            title="Koreksi durasi jam & menit lembur"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {ot.auditTrail && ot.auditTrail.length > 0 && (
                          <button
                            onClick={() => setAuditModalItem(ot)}
                            className="p-1 text-[#4693FD] hover:bg-[#EFF5FF] rounded"
                            title="Lihat riwayat persetujuan"
                          >
                            <History className="w-3.5 h-3.5" />
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

      {/* Add Overtime Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <h3 className="font-semibold text-sm">Catat Lembur Karyawan Baru</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Tanggal Lembur *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Karyawan *</label>
                  <select
                    required
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => {
                      const nextStart = e.target.value;
                      const calc = syncDurationFromTimes(nextStart, form.endTime);
                      setForm({
                        ...form,
                        startTime: nextStart,
                        ...(calc || {}),
                      });
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => {
                      const nextEnd = e.target.value;
                      const calc = syncDurationFromTimes(form.startTime, nextEnd);
                      setForm({
                        ...form,
                        endTime: nextEnd,
                        ...(calc || {}),
                      });
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-2.5">
                <label className="block font-medium text-[#344054]">
                  Durasi Lembur Aktual (Jam & Menit) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] text-[#667085] mb-1">Jam (0 - 15)</span>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      step={1}
                      required
                      value={form.durationHours}
                      onChange={(e) =>
                        setForm({ ...form, durationHours: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#667085] mb-1">Menit (0 - 59)</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      step={1}
                      required
                      value={form.durationMinutes}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          durationMinutes: Math.max(0, Math.min(59, Math.round(Number(e.target.value) || 0))),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[#667085]">Pilih Cepat:</span>
                  {[
                    { label: '1 Jam', h: 1, m: 0 },
                    { label: '1j 30m', h: 1, m: 30 },
                    { label: '2 Jam', h: 2, m: 0 },
                    { label: '2j 30m', h: 2, m: 30 },
                    { label: '3 Jam', h: 3, m: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setForm({ ...form, durationHours: preset.h, durationMinutes: preset.m })}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                        form.durationHours === preset.h && form.durationMinutes === preset.m
                          ? 'bg-[#4693FD] text-white border-[#4693FD]'
                          : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedCreateEmp && (
                <div className="p-3 bg-[#EFF8FF] border border-[#B2DDFF] rounded-lg flex items-center justify-between text-xs text-[#175CD3]">
                  <div>
                    <div className="font-medium">Estimasi Upah Lembur ({selectedCreateEmp.role})</div>
                    <div className="text-[11px] opacity-85">
                      {form.durationHours} jam {form.durationMinutes} menit × {formatRupiah(selectedCreateEmp.overtimeHourlyWage)}/jam
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-sm text-[#1849A9]">
                    {formatRupiah(createPreviewPay)}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  Keterangan Pekerjaan Lembur
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pengecoran plat lantai 2 hingga malam..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                  Simpan Lembur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <h3 className="font-semibold text-sm">Koreksi Durasi & Status Lembur</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#667085]">
                Karyawan: <span className="font-semibold text-[#262626]">{editingItem.employeeName}</span> ({formatDateID(editingItem.date)})
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Jam Lembur</label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    step={1}
                    value={correctDurationHours}
                    onChange={(e) => setCorrectDurationHours(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Menit Lembur (0-59)</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    step={1}
                    value={correctDurationMinutes}
                    onChange={(e) =>
                      setCorrectDurationMinutes(Math.max(0, Math.min(59, Math.round(Number(e.target.value) || 0))))
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#667085]">Menit Cepat:</span>
                {[0, 15, 30, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCorrectDurationMinutes(m)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                      correctDurationMinutes === m
                        ? 'bg-[#4693FD] text-white border-[#4693FD]'
                        : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    {m} mnt
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Status Persetujuan</label>
                <select
                  value={correctStatus}
                  onChange={(e) => setCorrectStatus(e.target.value as OvertimeRecord['status'])}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="Disetujui">Disetujui</option>
                  <option value="Menunggu persetujuan">Menunggu persetujuan</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>

              <div className="p-3 bg-[#EFF8FF] border border-[#B2DDFF] rounded-lg flex items-center justify-between text-[#175CD3]">
                <span>
                  Upah Lembur ({correctDurationHours}j {correctDurationMinutes}m × {formatRupiah(editingItem.hourlyRateSnapshot)}):
                </span>
                <span className="font-mono font-semibold text-[#1849A9]">{formatRupiah(correctionPreviewPay)}</span>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Alasan / Catatan Koreksi</label>
                <textarea
                  rows={2}
                  value={correctNotes}
                  onChange={(e) => setCorrectNotes(e.target.value)}
                  placeholder="Catatan alasan perubahan jam lembur..."
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>
              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveCorrection}
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  Simpan Koreksi
                </button>
              </div>
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
                <h3 className="font-semibold text-sm">Riwayat Audit Lembur</h3>
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
