import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Calendar,
  Users,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  Filter,
  AlertTriangle,
  Edit2,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import { Attendance, Employee, EmployeeRole } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

interface AttendancePageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ showToast, onDataChanged }) => {
  const { isAdmin, user } = useAuth();
  const { settings } = useCompany();

  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [filterRole, setFilterRole] = useState<'all' | 'Mandor' | 'Tukang' | 'Helper' | 'Driver'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Single Modal State
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingAtt, setEditingAtt] = useState<Attendance | null>(null);
  const [singleForm, setSingleForm] = useState({
    date: getTodayDateString(),
    employeeId: '',
    status: 'Hadir' as Attendance['status'],
    checkIn: '08:00',
    checkOut: '16:00',
    overtimeHours: 0,
    notes: '',
  });

  // Bulk Input Modal (For entering all active employees quickly)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState<string>(getTodayDateString());
  const [bulkEntries, setBulkEntries] = useState<
    Array<{
      employeeId: string;
      name: string;
      role: EmployeeRole | string;
      status: Attendance['status'];
      overtimeHours: number;
      notes: string;
    }>
  >([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [atts, emps] = await Promise.all([api.getAttendance(), api.getEmployees()]);
      setAttendanceList(atts);
      setEmployees(emps);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data absensi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openSingleModal = (att?: Attendance) => {
    if (att) {
      setEditingAtt(att);
      setSingleForm({
        date: att.date,
        employeeId: att.employeeId,
        status: att.status,
        checkIn: att.checkIn,
        checkOut: att.checkOut,
        overtimeHours: att.overtimeHours,
        notes: att.notes || '',
      });
    } else {
      setEditingAtt(null);
      setSingleForm({
        date: selectedDate || getTodayDateString(),
        employeeId: employees[0]?.id || '',
        status: 'Hadir',
        checkIn: settings?.workHourStart || '08:00',
        checkOut: settings?.workHourEnd || '16:00',
        overtimeHours: 0,
        notes: '',
      });
    }
    setIsSingleModalOpen(true);
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAtt) {
        await api.updateAttendance(editingAtt.id, {
          status: singleForm.status,
          checkIn: singleForm.checkIn,
          checkOut: singleForm.checkOut,
          overtimeHours: Number(singleForm.overtimeHours) || 0,
          notes: singleForm.notes,
        });
        showToast('success', 'Catatan absensi berhasil diperbarui.');
      } else {
        await api.createAttendance({
          date: singleForm.date,
          employeeId: singleForm.employeeId,
          status: singleForm.status,
          checkIn: singleForm.checkIn,
          checkOut: singleForm.checkOut,
          overtimeHours: Number(singleForm.overtimeHours) || 0,
          notes: singleForm.notes,
        });
        showToast('success', 'Absensi berhasil dicatat.');
      }
      setIsSingleModalOpen(false);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan absensi');
    }
  };

  const openBulkModal = () => {
    const targetDate = selectedDate || getTodayDateString();
    setBulkDate(targetDate);

    // Populate active employees with default "Hadir"
    const activeEmps = employees.filter((e) => e.status === 'active');
    const existingOnDate = attendanceList.filter((a) => a.date === targetDate);

    const entries = activeEmps.map((emp) => {
      const match = existingOnDate.find((a) => a.employeeId === emp.id);
      return {
        employeeId: emp.id,
        name: emp.name,
        role: emp.role,
        status: match ? match.status : ('Hadir' as Attendance['status']),
        overtimeHours: match ? match.overtimeHours : 0,
        notes: match ? match.notes : '',
      };
    });

    setBulkEntries(entries);
    setIsBulkModalOpen(true);
  };

  const handleBulkStatusChange = (index: number, status: Attendance['status']) => {
    setBulkEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status };
      return next;
    });
  };

  const handleBulkOvertimeChange = (index: number, hours: number) => {
    setBulkEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], overtimeHours: Math.max(0, hours) };
      return next;
    });
  };

  const handleBulkNotesChange = (index: number, notes: string) => {
    setBulkEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], notes };
      return next;
    });
  };

  const handleSaveBulk = async () => {
    try {
      const records = bulkEntries.map((e) => ({
        employeeId: e.employeeId,
        status: e.status,
        checkIn: settings?.workHourStart || '08:00',
        checkOut: settings?.workHourEnd || '16:00',
        overtimeHours: Number(e.overtimeHours) || 0,
        notes: e.notes,
      }));

      await api.createBulkAttendance(bulkDate, records);

      showToast('success', `Berhasil mencatat absensi massal untuk ${records.length} karyawan pada ${formatDateID(bulkDate)}.`);
      setIsBulkModalOpen(false);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan absensi massal');
    }
  };

  const filteredAttendance = attendanceList.filter((a) => {
    const matchesDate = !selectedDate || a.date === selectedDate;
    const matchesRole =
      filterRole === 'all' ||
      a.employeeRole === filterRole ||
      (filterRole === 'Helper' && a.employeeRole === 'Kenek');
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesDate && matchesRole && matchesStatus;
  });

  // Calculate summary metrics on current filtered view
  const totalHadir = filteredAttendance.filter((a) => a.status === 'Hadir').length;
  const totalLemburHours = filteredAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
  const totalDailyPay = filteredAttendance.reduce((sum, a) => sum + (a.totalDailyPay || 0), 0);

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
              {totalHadir} Hadir | {totalLemburHours} Jam Lembur ({formatRupiah(totalDailyPay)})
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Absensi & Gaji Harian Karyawan
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Pencatatan kehadiran seluruh personil (Mandor, Tukang, Helper, Driver), jam lembur, serta perhitungan gaji harian otomatis.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={openBulkModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-medium rounded-lg border border-[#D0D5DD] shadow-xs transition-colors"
              title="Catat seluruh karyawan aktif sekaligus untuk tanggal terpilih"
            >
              <Layers className="w-4 h-4 text-[#4693FD]" />
              <span>Absensi Massal Karyawan</span>
            </button>
            <button
              onClick={() => openSingleModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Input Tunggal</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#667085]" />
            <label className="text-xs font-medium text-[#344054]">Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-xs text-[#4693FD] hover:underline"
              >
                Lihat Semua
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0]">
            <button
              onClick={() => setFilterRole('all')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                filterRole === 'all' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Semua ({attendanceList.length})
            </button>
            <button
              onClick={() => setFilterRole('Mandor')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                filterRole === 'Mandor' ? 'bg-white text-[#7F56D9] shadow-xs' : 'text-[#667085] hover:text-[#7F56D9]'
              }`}
            >
              Mandor
            </button>
            <button
              onClick={() => setFilterRole('Tukang')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                filterRole === 'Tukang' ? 'bg-white text-[#4693FD] shadow-xs' : 'text-[#667085] hover:text-[#4693FD]'
              }`}
            >
              Tukang
            </button>
            <button
              onClick={() => setFilterRole('Helper')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                filterRole === 'Helper' ? 'bg-white text-[#D99A23] shadow-xs' : 'text-[#667085] hover:text-[#D99A23]'
              }`}
            >
              Helper
            </button>
            <button
              onClick={() => setFilterRole('Driver')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                filterRole === 'Driver' ? 'bg-white text-[#0E9384] shadow-xs' : 'text-[#667085] hover:text-[#0E9384]'
              }`}
            >
              Driver
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
            >
              <option value="all">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Libur">Libur</option>
              <option value="Tidak Hadir">Tidak Hadir</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-[#667085]">
          Menampilkan <span className="font-semibold text-[#262626]">{filteredAttendance.length}</span> catatan
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Nama Karyawan</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Kehadiran</th>
                <th className="py-3 px-4">Jam Kerja</th>
                <th className="py-3 px-4">Lembur</th>
                <th className="py-3 px-4">Gaji Pokok</th>
                <th className="py-3 px-4">Upah Lembur</th>
                <th className="py-3 px-4">Total Harian</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-[#667085]">
                    Memuat catatan absensi...
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center">
                    <AlertTriangle className="w-6 h-6 text-[#D99A23] mx-auto mb-1.5" />
                    <p className="font-medium text-[#262626]">Belum Ada Data Absensi</p>
                    <p className="text-xs text-[#667085] mt-0.5">
                      {selectedDate
                        ? `Tidak ada absensi pada tanggal ${formatDateID(selectedDate)}. Klik tombol "Absensi Massal" untuk mencatat sekaligus.`
                        : 'Belum ada absensi yang dicatat dalam sistem.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((a) => (
                  <tr key={a.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                      {formatDateID(a.date)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">{a.employeeName}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {a.employeeRole === 'Mandor' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9F5FF] text-[#7F56D9] border border-[#E9D7FE]">
                          Mandor
                        </span>
                      )}
                      {a.employeeRole === 'Tukang' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF5FF] text-[#4693FD] border border-[#D1E9FF]">
                          Tukang
                        </span>
                      )}
                      {(a.employeeRole === 'Helper' || a.employeeRole === 'Kenek') && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF7EC] text-[#D99A23] border border-[#FEDF89]">
                          Helper
                        </span>
                      )}
                      {a.employeeRole === 'Driver' && (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF9] text-[#0E9384] border border-[#99F6E0]">
                          Driver
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          a.status === 'Hadir'
                            ? 'bg-[#ECFDF3] text-[#16A36A]'
                            : a.status === 'Izin' || a.status === 'Sakit'
                            ? 'bg-[#FEF7EC] text-[#D99A23]'
                            : 'bg-[#FEF3F2] text-[#D64545]'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#667085] whitespace-nowrap">
                      {a.status === 'Hadir' ? `${a.checkIn} - ${a.checkOut}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#262626] whitespace-nowrap">
                      {a.overtimeHours > 0 ? (
                        <span className="font-medium text-[#4693FD]">{a.overtimeHours} Jam</span>
                      ) : (
                        <span className="text-[#98A2B3]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#262626] whitespace-nowrap tabular-nums">
                      {formatRupiah(a.dailyWageSnapshot)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap tabular-nums">
                      {formatRupiah(a.overtimeWageSnapshot * a.overtimeHours)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#262626] whitespace-nowrap tabular-nums">
                      {formatRupiah(a.totalDailyPay)}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-[#667085]">
                      {a.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isAdmin ? (
                        <button
                          onClick={() => openSingleModal(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-md border border-[#D0D5DD] transition-colors text-xs"
                        >
                          <Edit2 className="w-3 h-3 text-[#667085]" />
                          Koreksi
                        </button>
                      ) : (
                        <span className="text-[#98A2B3] text-[11px]">Hanya Admin</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Attendance Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingAtt ? `Koreksi Absensi: ${editingAtt.employeeName}` : 'Input Absensi Karyawan'}
              </h3>
              <button
                onClick={() => setIsSingleModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingle} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    disabled={!!editingAtt}
                    value={singleForm.date}
                    onChange={(e) => setSingleForm({ ...singleForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Karyawan *</label>
                  <select
                    disabled={!!editingAtt}
                    value={singleForm.employeeId}
                    onChange={(e) => setSingleForm({ ...singleForm, employeeId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Status Kehadiran *</label>
                <select
                  value={singleForm.status}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, status: e.target.value as Attendance['status'] })
                  }
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="Hadir">Hadir (Gaji Penuh)</option>
                  <option value="Izin">Izin (Tidak Digaji)</option>
                  <option value="Sakit">Sakit (Tidak Digaji)</option>
                  <option value="Libur">Libur (Tidak Digaji)</option>
                  <option value="Tidak Hadir">Tidak Hadir / Alpa (Tidak Digaji)</option>
                </select>
              </div>

              {singleForm.status === 'Hadir' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[#344054] mb-1">Jam Masuk</label>
                      <input
                        type="time"
                        value={singleForm.checkIn}
                        onChange={(e) => setSingleForm({ ...singleForm, checkIn: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-[#344054] mb-1">Jam Pulang Normal</label>
                      <input
                        type="time"
                        value={singleForm.checkOut}
                        onChange={(e) => setSingleForm({ ...singleForm, checkOut: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[#344054] mb-1">
                      Jam Lembur (Jam di luar 08.00–16.00)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={12}
                      value={singleForm.overtimeHours}
                      onChange={(e) =>
                        setSingleForm({ ...singleForm, overtimeHours: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                    />
                    <p className="text-[11px] text-[#667085] mt-1">
                      Lembur otomatis dibuatkan tiket permohonan untuk persetujuan Admin.
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block font-medium text-[#344054] mb-1">Catatan / Keterangan</label>
                <textarea
                  rows={2}
                  value={singleForm.notes}
                  onChange={(e) => setSingleForm({ ...singleForm, notes: e.target.value })}
                  placeholder="Catatan pengerjaan atau alasan izin..."
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  {editingAtt ? 'Simpan Koreksi' : 'Catat Absensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Attendance Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Absensi Massal Karyawan Proyek (10 Karyawan)</h3>
                <p className="text-[11px] text-[#667085]">Catat status seluruh tenaga kerja secara serentak</p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#EAECF0]">
                <Calendar className="w-4 h-4 text-[#4693FD]" />
                <label className="text-xs font-medium text-[#344054]">Pilih Tanggal Absensi:</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="overflow-x-auto max-h-[50vh] border border-[#EAECF0] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0] z-10">
                    <tr>
                      <th className="py-2.5 px-3">Nama Karyawan</th>
                      <th className="py-2.5 px-3">Jabatan</th>
                      <th className="py-2.5 px-3">Status Kehadiran</th>
                      <th className="py-2.5 px-3">Jam Lembur</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECF0]">
                    {bulkEntries.map((item, idx) => (
                      <tr key={item.employeeId} className="hover:bg-[#F9FAFB]">
                        <td className="py-2 px-3 font-medium text-[#262626] whitespace-nowrap">{item.name}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {item.role === 'Mandor' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9F5FF] text-[#7F56D9] border border-[#E9D7FE]">
                              Mandor
                            </span>
                          )}
                          {item.role === 'Tukang' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF5FF] text-[#4693FD] border border-[#D1E9FF]">
                              Tukang
                            </span>
                          )}
                          {(item.role === 'Helper' || item.role === 'Kenek') && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF7EC] text-[#D99A23] border border-[#FEDF89]">
                              Helper
                            </span>
                          )}
                          {item.role === 'Driver' && (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF9] text-[#0E9384] border border-[#99F6E0]">
                              Driver
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleBulkStatusChange(idx, e.target.value as Attendance['status'])
                            }
                            className="bg-white border border-[#D0D5DD] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#4693FD]"
                          >
                            <option value="Hadir">Hadir</option>
                            <option value="Izin">Izin</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Libur">Libur</option>
                            <option value="Tidak Hadir">Tidak Hadir</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step={0.5}
                            min={0}
                            disabled={item.status !== 'Hadir'}
                            value={item.overtimeHours}
                            onChange={(e) => handleBulkOvertimeChange(idx, Number(e.target.value))}
                            className="w-20 bg-white border border-[#D0D5DD] rounded px-2 py-1 text-xs font-mono disabled:bg-[#F2F4F7]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Keterangan..."
                            value={item.notes}
                            onChange={(e) => handleBulkNotesChange(idx, e.target.value)}
                            className="w-full bg-white border border-[#D0D5DD] rounded px-2 py-1 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-between">
              <span className="text-xs text-[#667085]">
                {bulkEntries.filter((e) => e.status === 'Hadir').length} dari {bulkEntries.length} karyawan hadir.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveBulk}
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  Simpan Absensi Massal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
