import React, { useState, useEffect, useRef } from 'react';
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
  Trash2,
  Layers,
  ArrowRight,
  X,
  Wallet,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  HardHat,
  Truck,
} from 'lucide-react';
import { Attendance, Employee, EmployeeRole } from '../types.js';
import { api } from '../lib/api.js';
import {
  formatRupiah,
  formatDateID,
  getTodayDateString,
  calculateBasicPayByStatus,
  splitHoursMinutes,
  calculateOvertimePayFromHoursMinutes,
  calculateOvertimePayFromDecimal,
  formatOvertimeDuration,
  isDriverRole,
} from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

const avatarPalettes = [
  'bg-[#DCE7F9] text-[#1E293B]',
  'bg-[#F9E2D2] text-[#1E293B]',
  'bg-[#EDE3DA] text-[#1E293B]',
  'bg-[#D9EFE6] text-[#1E293B]',
  'bg-[#E5EEDF] text-[#1E293B]',
];

const getInitials = (name: string) => {
  const cleaned = (name || 'Karyawan').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
};

interface AttendancePageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ showToast, onDataChanged }) => {
  const { user, token, isAdmin, isOwner } = useAuth();
  const { settings } = useCompany();

  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [filterRole, setFilterRole] = useState<'all' | 'Mandor' | 'Tukang' | 'Helper' | 'Driver'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Single Modal State (Create & Edit with Integrated Kasbon)
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingAtt, setEditingAtt] = useState<Attendance | null>(null);
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleForm, setSingleForm] = useState({
    date: getTodayDateString(),
    employeeId: '',
    status: 'Hadir' as Attendance['status'],
    checkIn: '08:00',
    checkOut: '16:00',
    durationHours: 0,
    durationMinutes: 0,
    notes: '',
    hasKasbon: false,
    kasbonId: '',
    kasbonAmount: '',
    kasbonNotes: '',
    existingKasbonAttachmentId: '',
    existingKasbonAttachmentFileName: '',
    removeKasbonPhoto: false,
  });
  const [selectedKasbonPhoto, setSelectedKasbonPhoto] = useState<{
    fileName: string;
    dataBase64: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  const [kasbonPhotoError, setKasbonPhotoError] = useState<string | null>(null);
  const kasbonFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation Modal State
  const [attToDelete, setAttToDelete] = useState<Attendance | null>(null);
  const [deletingAtt, setDeletingAtt] = useState(false);
  const [deleteAttError, setDeleteAttError] = useState<string | null>(null);

  // Bulk Input Modal (For entering all active employees quickly)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState<string>(getTodayDateString());
  const [bulkEntries, setBulkEntries] = useState<
    Array<{
      employeeId: string;
      name: string;
      role: EmployeeRole | string;
      dailyWage: number;
      overtimeHourlyWage: number;
      status: Attendance['status'];
      durationHours: number;
      durationMinutes: number;
      notes: string;
    }>
  >([]);

  const getKasbonPhotoViewUrl = (attachmentId: string) => {
    const params = new URLSearchParams();
    const storedToken = token || localStorage.getItem('kms_token');
    if (storedToken) {
      params.set('token', storedToken);
    }
    const role = user?.role || (isAdmin ? 'admin' : isOwner ? 'owner' : 'admin');
    const name = user?.name || (role === 'admin' ? 'Administrator Proyek' : 'Owner');
    params.set('role', role);
    params.set('userName', name);
    const qs = params.toString();
    return `/api/projects/kasbon/attachments/${attachmentId}/view${qs ? `?${qs}` : ''}`;
  };

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
      const hm = splitHoursMinutes(att.overtimeHours || 0);
      const hasLinkedKasbon = Boolean(att.kasbonId || (att.kasbonAmount && att.kasbonAmount > 0));
      const existingAttachment =
        att.kasbonAttachments && att.kasbonAttachments.length > 0
          ? att.kasbonAttachments[0]
          : att.kasbonAttachmentFilePath && att.kasbonId
          ? { id: att.kasbonId, fileName: `bukti_${att.kasbonNumber || 'kasbon'}.jpg` }
          : null;

      setEditingAtt(att);
      setSingleForm({
        date: att.date,
        employeeId: att.employeeId,
        status: att.status,
        checkIn: att.checkIn || settings?.workHourStart || '08:00',
        checkOut: att.checkOut || (att.status === 'Setengah Hari' ? '12:00' : settings?.workHourEnd || '16:00'),
        durationHours: hm.hours,
        durationMinutes: hm.minutes,
        notes: att.notes || '',
        hasKasbon: hasLinkedKasbon,
        kasbonId: att.kasbonId || '',
        kasbonAmount: hasLinkedKasbon && att.kasbonAmount ? String(att.kasbonAmount) : '',
        kasbonNotes: att.kasbonNotes || '',
        existingKasbonAttachmentId: existingAttachment ? existingAttachment.id : '',
        existingKasbonAttachmentFileName: existingAttachment ? existingAttachment.fileName : '',
        removeKasbonPhoto: false,
      });
    } else {
      setEditingAtt(null);
      const firstActiveEmp = employees.find((e) => e.status === 'active');
      setSingleForm({
        date: selectedDate || getTodayDateString(),
        employeeId: firstActiveEmp?.id || '',
        status: 'Hadir',
        checkIn: settings?.workHourStart || '08:00',
        checkOut: settings?.workHourEnd || '16:00',
        durationHours: 0,
        durationMinutes: 0,
        notes: '',
        hasKasbon: false,
        kasbonId: '',
        kasbonAmount: '',
        kasbonNotes: '',
        existingKasbonAttachmentId: '',
        existingKasbonAttachmentFileName: '',
        removeKasbonPhoto: false,
      });
    }
    setSelectedKasbonPhoto(null);
    setKasbonPhotoError(null);
    if (kasbonFileInputRef.current) {
      kasbonFileInputRef.current.value = '';
    }
    setIsSingleModalOpen(true);
  };

  const handleKasbonPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setKasbonPhotoError('Format file harus berupa gambar (JPG, JPEG, PNG, atau WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setKasbonPhotoError(`Ukuran file (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedKasbonPhoto({
        fileName: file.name,
        dataBase64: reader.result as string,
        fileSize: file.size,
        mimeType: file.type,
      });
      setKasbonPhotoError(null);
      setSingleForm((prev) => ({ ...prev, removeKasbonPhoto: false }));
    };
    reader.onerror = () => {
      setKasbonPhotoError('Gagal membaca file gambar');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveKasbonPhoto = () => {
    setSelectedKasbonPhoto(null);
    setKasbonPhotoError(null);
    if (kasbonFileInputRef.current) {
      kasbonFileInputRef.current.value = '';
    }
    if (singleForm.existingKasbonAttachmentId) {
      setSingleForm((prev) => ({
        ...prev,
        existingKasbonAttachmentId: '',
        existingKasbonAttachmentFileName: '',
        removeKasbonPhoto: true,
      }));
    }
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const isWorking = singleForm.status === 'Hadir' || singleForm.status === 'Setengah Hari';
    const dHours = isWorking ? Math.max(0, Math.floor(Number(singleForm.durationHours) || 0)) : 0;
    const dMins = isWorking ? Math.max(0, Math.min(59, Math.round(Number(singleForm.durationMinutes) || 0))) : 0;
    const decHours = Number(((dHours * 60 + dMins) / 60).toFixed(4));

    setSavingSingle(true);
    try {
      const payload = {
        date: singleForm.date,
        employeeId: singleForm.employeeId,
        status: singleForm.status,
        checkIn: singleForm.checkIn,
        checkOut: singleForm.checkOut,
        overtimeHours: decHours,
        durationHours: dHours,
        durationMinutes: dMins,
        notes: singleForm.notes,
      };

      if (editingAtt) {
        await api.updateAttendance(editingAtt.id, payload);
        showToast('success', 'Catatan absensi & upah berhasil diperbarui.');
      } else {
        await api.recordAttendance(payload);
        showToast('success', 'Absensi berhasil dicatat.');
      }
      setIsSingleModalOpen(false);
      setEditingAtt(null);
      setSelectedKasbonPhoto(null);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan absensi');
    } finally {
      setSavingSingle(false);
    }
  };

  const openBulkModal = () => {
    const targetDate = selectedDate || getTodayDateString();
    setBulkDate(targetDate);

    const activeEmps = employees.filter((e) => e.status === 'active');
    const existingOnDate = attendanceList.filter((a) => a.date === targetDate);

    const entries = activeEmps.map((emp) => {
      const match = existingOnDate.find((a) => a.employeeId === emp.id);
      const hm = splitHoursMinutes(match ? match.overtimeHours : 0);
      return {
        employeeId: emp.id,
        name: emp.name,
        role: emp.role,
        dailyWage: emp.dailyWage,
        overtimeHourlyWage: emp.overtimeHourlyWage,
        status: match ? match.status : ('Hadir' as Attendance['status']),
        durationHours: hm.hours,
        durationMinutes: hm.minutes,
        notes: match ? match.notes : '',
      };
    });

    setBulkEntries(entries);
    setIsBulkModalOpen(true);
  };

  const handleBulkStatusChange = (index: number, status: Attendance['status']) => {
    setBulkEntries((prev) => {
      const next = [...prev];
      const isWorking = status === 'Hadir' || status === 'Setengah Hari';
      next[index] = {
        ...next[index],
        status,
        durationHours: isWorking ? next[index].durationHours : 0,
        durationMinutes: isWorking ? next[index].durationMinutes : 0,
      };
      return next;
    });
  };

  const handleBulkDurationChange = (index: number, field: 'durationHours' | 'durationMinutes', val: number) => {
    setBulkEntries((prev) => {
      const next = [...prev];
      if (field === 'durationHours') {
        next[index] = { ...next[index], durationHours: Math.max(0, Math.floor(val || 0)) };
      } else {
        next[index] = { ...next[index], durationMinutes: Math.max(0, Math.min(59, Math.round(val || 0))) };
      }
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
      const records = bulkEntries.map((e) => {
        const isWorking = e.status === 'Hadir' || e.status === 'Setengah Hari';
        const dH = isWorking ? Math.max(0, Math.floor(Number(e.durationHours) || 0)) : 0;
        const dM = isWorking ? Math.max(0, Math.min(59, Math.round(Number(e.durationMinutes) || 0))) : 0;
        return {
          employeeId: e.employeeId,
          status: e.status,
          checkIn: settings?.workHourStart || '08:00',
          checkOut: e.status === 'Setengah Hari' ? '12:00' : settings?.workHourEnd || '16:00',
          overtimeHours: Number(((dH * 60 + dM) / 60).toFixed(4)),
          durationHours: dH,
          durationMinutes: dM,
          notes: e.notes,
        };
      });

      await api.createBulkAttendance(bulkDate, records);

      showToast('success', `Berhasil mencatat absensi massal untuk ${records.length} karyawan pada ${formatDateID(bulkDate)}.`);
      setIsBulkModalOpen(false);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan absensi massal');
    }
  };

  const openDeleteModal = (att: Attendance) => {
    if (!isAdmin) return;
    setDeleteAttError(null);
    setAttToDelete(att);
  };

  const handleConfirmDelete = async () => {
    if (!isAdmin || !attToDelete) return;
    setDeletingAtt(true);
    setDeleteAttError(null);
    try {
      const res = await api.deleteAttendance(attToDelete.id, attToDelete.projectId);
      showToast(
        'success',
        res.message || `Data absensi ${attToDelete.employeeName} (${formatDateID(attToDelete.date)}) berhasil dihapus.`
      );
      setAttToDelete(null);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      const errMsg = err.message || 'Gagal menghapus data absensi';
      setDeleteAttError(errMsg);
      showToast('error', errMsg);
    } finally {
      setDeletingAtt(false);
    }
  };

  const filteredAttendance = attendanceList.filter((a) => {
    const matchesDate = !selectedDate || a.date === selectedDate;
    const matchesRole =
      filterRole === 'all' ||
      a.employeeRole === filterRole ||
      (filterRole === 'Helper' && a.employeeRole === 'Kenek');
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const empObj = employees.find((e) => e.id === a.employeeId);
      const empNik = (empObj?.nik || '').toLowerCase();
      const matchName = (a.employeeName || '').toLowerCase().includes(q);
      const matchId = (a.employeeId || '').toLowerCase().includes(q);
      const matchRole = (a.employeeRole || '').toLowerCase().includes(q);
      const matchNotes = (a.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !empNik.includes(q) && !matchRole && !matchNotes) {
        return false;
      }
    }
    return matchesDate && matchesRole && matchesStatus;
  });

  // Calculate summary metrics on current filtered view
  const totalHadirPenuh = filteredAttendance.filter((a) => a.status === 'Hadir').length;
  const totalSetengahHari = filteredAttendance.filter((a) => a.status === 'Setengah Hari').length;
  const totalTidakHadir = filteredAttendance.filter(
    (a) => a.status !== 'Hadir' && a.status !== 'Setengah Hari'
  ).length;

  // Live preview for Single Modal
  const selectedSingleEmp =
    employees.find((e) => e.id === singleForm.employeeId) ||
    (editingAtt
      ? {
          name: editingAtt.employeeName,
          role: editingAtt.employeeRole,
          dailyWage: editingAtt.dailyWageSnapshot,
          overtimeHourlyWage: editingAtt.overtimeWageSnapshot,
        }
      : undefined);

  const previewBasicPay = selectedSingleEmp
    ? calculateBasicPayByStatus(singleForm.status, selectedSingleEmp.dailyWage)
    : 0;
  const previewOtPay =
    selectedSingleEmp && (singleForm.status === 'Hadir' || singleForm.status === 'Setengah Hari')
      ? calculateOvertimePayFromHoursMinutes(
          singleForm.durationHours,
          singleForm.durationMinutes,
          selectedSingleEmp.overtimeHourlyWage
        )
      : 0;

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Data Absensi Karyawan</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                {filteredAttendance.length} Presensi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kelola kehadiran harian penuh, setengah hari, dan durasi lembur aktual karyawan langsung dengan sinkronisasi master perusahaan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 text-xs mr-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E1F3EA] text-[#166534] font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                {totalHadirPenuh} Hadir
              </span>
              {totalSetengahHari > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF8FF] text-[#175CD3] font-medium text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                  {totalSetengahHari} Setengah Hari
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#475569] font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                {totalTidakHadir} Tidak Hadir
              </span>
            </div>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={openBulkModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition-colors"
                >
                  <Layers className="w-4 h-4 text-[#2563EB]" />
                  <span>Absensi Massal</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSingleModal()}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Catat Kehadiran</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, ID, NIK, peran, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Jabatan:</span>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
              >
                <option value="all">Semua Jabatan</option>
                <option value="Mandor">Mandor</option>
                <option value="Tukang">Tukang</option>
                <option value="Helper">Helper</option>
                <option value="Driver">Driver</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
              >
                <option value="all">Semua Status</option>
                <option value="Hadir">Hadir (Penuh)</option>
                <option value="Setengah Hari">Setengah Hari (50%)</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
                <option value="Libur">Libur</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-xs text-[#2563EB] hover:underline font-medium px-1"
                >
                  Semua Tanggal
                </button>
              )}
            </div>

            {(searchQuery || filterRole !== 'all' || filterStatus !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterRole('all');
                  setFilterStatus('all');
                }}
                className="text-xs text-[#2563EB] hover:underline font-medium px-1.5"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Directory-Style Attendance Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <tbody className="divide-y divide-slate-200/75 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Memuat catatan absensi...
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <AlertTriangle className="w-6 h-6 text-[#D99A23] mx-auto mb-1.5" />
                    <p className="font-medium text-slate-800">Belum Ada Data Absensi</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedDate
                        ? `Tidak ada absensi pada tanggal ${formatDateID(selectedDate)}. Klik tombol "Absensi Massal" untuk mencatat sekaligus.`
                        : 'Belum ada absensi yang dicatat dalam sistem.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((a, idx) => {
                  const empObj = employees.find((e) => e.id === a.employeeId);
                  const roleName = a.employeeRole === 'Kenek' ? 'Helper' : a.employeeRole || 'Tukang';
                  const isDriver = isDriverRole(roleName);
                  const avatarClass = avatarPalettes[idx % avatarPalettes.length];

                  const rolePillStyle =
                    roleName === 'Mandor'
                      ? 'bg-[#EDE6DF] text-[#44403C]'
                      : roleName === 'Tukang'
                      ? 'bg-[#E1EBF9] text-[#284B80]'
                      : roleName === 'Driver'
                      ? 'bg-[#E3EEDF] text-[#335426]'
                      : 'bg-[#DCEFE9] text-[#1D5647]';

                  const rowBasicPay = calculateBasicPayByStatus(a.status, a.dailyWageSnapshot);
                  const statusPill =
                    a.status === 'Hadir'
                      ? {
                          bg: 'bg-[#E1F3EA] text-[#166534]',
                          dot: 'bg-[#15803D]',
                          label: 'Hadir',
                        }
                      : a.status === 'Setengah Hari'
                      ? {
                          bg: 'bg-[#EFF8FF] text-[#175CD3]',
                          dot: 'bg-[#2563EB]',
                          label: 'Setengah Hari (½)',
                        }
                      : a.status === 'Izin' || a.status === 'Sakit'
                      ? {
                          bg: 'bg-[#FEF6EE] text-[#B54708]',
                          dot: 'bg-[#D97706]',
                          label: a.status,
                        }
                      : {
                          bg: 'bg-[#FEF3F2] text-[#B42318]',
                          dot: 'bg-[#DC2626]',
                          label: a.status,
                        };

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Column 1: Avatar + Name + Subtitle */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-tight shrink-0 ${avatarClass}`}
                          >
                            {getInitials(a.employeeName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-[13.5px] leading-snug">
                              {a.employeeName}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span>{roleName}</span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-slate-500">{a.employeeId}</span>
                              {empObj?.nik && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-slate-400">NIK: {empObj.nik}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Role Badge with Icon */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${rolePillStyle}`}
                        >
                          {isDriver ? (
                            <Truck className="w-3.5 h-3.5 opacity-80" />
                          ) : (
                            <HardHat className="w-3.5 h-3.5 opacity-80" />
                          )}
                          <span>{roleName}</span>
                        </span>
                      </td>

                      {/* Column 3: Location Dot + Notes */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-[#D97706]" />
                          <span className="text-xs font-medium text-slate-700">
                            {a.projectName || 'Proyek Lapangan'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-4 mt-0.5 max-w-[180px] truncate">
                          {a.notes || '-'}
                        </div>
                      </td>

                      {/* Column 4: Wages Stack */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-700 font-mono tabular-nums">
                          {formatRupiah(rowBasicPay)} / hari
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                          {a.overtimeHours > 0
                            ? `Lembur: ${formatOvertimeDuration(a.overtimeHours)}`
                            : isDriver
                            ? 'Tanpa lembur'
                            : `Lembur: ${formatRupiah(a.overtimeWageSnapshot)}/jam`}
                        </div>
                      </td>

                      {/* Column 5: Date & Work Hours */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-700 tabular-nums">
                          {formatDateID(a.date)}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                          {a.status === 'Hadir' || a.status === 'Setengah Hari'
                            ? `${a.checkIn} - ${a.checkOut}`
                            : 'Tidak hadir'}
                        </div>
                      </td>

                      {/* Column 6: Status Pill */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusPill.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`} />
                          <span>{statusPill.label}</span>
                        </span>
                      </td>

                      {/* Column 7: Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        {isAdmin ? (
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              onClick={() => openSingleModal(a)}
                              className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Data Absensi"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(a)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Data Absensi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Hanya Lihat</span>
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

      {/* Single Attendance Modal (Create & Edit with Integrated Kasbon) */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="glass-modal kms-modal-md bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[600px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 sm:px-6 py-4 bg-slate-50 text-[#262626] border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-sm">
                {editingAtt ? `Edit Absensi: ${editingAtt.employeeName}` : 'Catat Kehadiran Karyawan'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                disabled={savingSingle}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingle} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={singleForm.date}
                    onChange={(e) => setSingleForm({ ...singleForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Pilih Karyawan *</label>
                  <select
                    value={singleForm.employeeId}
                    onChange={(e) => setSingleForm({ ...singleForm, employeeId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    {employees
                      .filter((emp) => emp.status === 'active' || (editingAtt && emp.id === editingAtt.employeeId))
                      .map((emp) => (
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
                  onChange={(e) => {
                    const nextStatus = e.target.value as Attendance['status'];
                    setSingleForm({
                      ...singleForm,
                      status: nextStatus,
                      checkOut:
                        nextStatus === 'Setengah Hari'
                          ? '12:00'
                          : settings?.workHourEnd || '16:00',
                    });
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="Hadir">Hadir (Upah Harian Penuh 100%)</option>
                  <option value="Setengah Hari">Setengah Hari (Upah 50% / ÷ 2)</option>
                  <option value="Izin">Izin (Tidak Digaji)</option>
                  <option value="Sakit">Sakit (Tidak Digaji)</option>
                  <option value="Libur">Libur (Tidak Digaji)</option>
                  <option value="Tidak Hadir">Tidak Hadir / Alpa (Tidak Digaji)</option>
                </select>
              </div>

              {(singleForm.status === 'Hadir' || singleForm.status === 'Setengah Hari') && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <label className="block font-medium text-[#344054] mb-1">Jam Pulang</label>
                      <input
                        type="time"
                        value={singleForm.checkOut}
                        onChange={(e) => setSingleForm({ ...singleForm, checkOut: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-2.5">
                    <label className="block font-medium text-[#344054]">
                      Durasi Lembur Aktual (Jam & Menit)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] text-[#667085] mb-1">Jam (0 - 15)</span>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          step={1}
                          value={singleForm.durationHours}
                          onChange={(e) =>
                            setSingleForm({ ...singleForm, durationHours: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
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
                          value={singleForm.durationMinutes}
                          onChange={(e) =>
                            setSingleForm({
                              ...singleForm,
                              durationMinutes: Math.max(0, Math.min(59, Math.round(Number(e.target.value) || 0))),
                            })
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
                          onClick={() => setSingleForm({ ...singleForm, durationMinutes: m })}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                            singleForm.durationMinutes === m
                              ? 'bg-[#4693FD] text-white border-[#4693FD]'
                              : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                          }`}
                        >
                          {m} mnt
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Live Calculation Box */}
              {selectedSingleEmp && (
                <div className="p-3 bg-[#EFF8FF] border border-[#B2DDFF] rounded-lg space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-[#175CD3]">
                    <span>
                      Upah Kehadiran ({singleForm.status === 'Hadir' ? '100% Penuh' : singleForm.status === 'Setengah Hari' ? '50% Setengah Hari' : '0%'}):
                    </span>
                    <span className="font-mono font-semibold">{formatRupiah(previewBasicPay)}</span>
                  </div>
                  {(singleForm.durationHours > 0 || singleForm.durationMinutes > 0) &&
                    (singleForm.status === 'Hadir' || singleForm.status === 'Setengah Hari') && (
                      <div className="flex items-center justify-between text-[#175CD3]">
                        <span>
                          Upah Lembur ({singleForm.durationHours}j {singleForm.durationMinutes}m × {formatRupiah(selectedSingleEmp.overtimeHourlyWage)}/jam):
                        </span>
                        <span className="font-mono font-semibold">{formatRupiah(previewOtPay)}</span>
                      </div>
                    )}
                  <div className="pt-1 border-t border-[#B2DDFF] flex items-center justify-between font-semibold text-[#1849A9]">
                    <span>Total Upah Harian:</span>
                    <span className="font-mono text-xs">{formatRupiah(previewBasicPay + previewOtPay)}</span>
                  </div>
                </div>
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
              </div>

              <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  disabled={savingSingle}
                  className="px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSingle}
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
                >
                  {savingSingle ? 'Menyimpan...' : editingAtt ? 'Simpan Perubahan' : 'Simpan Presensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Attendance Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="glass-modal kms-modal-lg bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[800px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 sm:px-6 py-4 bg-slate-50 text-[#262626] border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-sm">Absensi Massal Karyawan ({bulkEntries.length} Karyawan)</h3>
                <p className="text-[11px] text-[#667085]">
                  Pilih status kehadiran (Hadir Penuh, Setengah Hari, Izin, dll.) dan durasi lembur (Jam & Menit)
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-[#EAECF0]">
                <Calendar className="w-4 h-4 text-[#4693FD]" />
                <label className="text-xs font-medium text-[#344054]">Pilih Tanggal Absensi:</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="overflow-x-auto border border-[#EAECF0] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0] z-10">
                    <tr>
                      <th className="py-2.5 px-3">Nama Karyawan</th>
                      <th className="py-2.5 px-3">Jabatan</th>
                      <th className="py-2.5 px-3">Status Kehadiran</th>
                      <th className="py-2.5 px-3">Upah Kehadiran</th>
                      <th className="py-2.5 px-3">Lembur (Jam & Menit)</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECF0]">
                    {bulkEntries.map((item, idx) => {
                      const isWorking = item.status === 'Hadir' || item.status === 'Setengah Hari';
                      const basicPay = calculateBasicPayByStatus(item.status, item.dailyWage);
                      return (
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
                              <option value="Hadir">Hadir (100%)</option>
                              <option value="Setengah Hari">Setengah Hari (50%)</option>
                              <option value="Izin">Izin</option>
                              <option value="Sakit">Sakit</option>
                              <option value="Libur">Libur</option>
                              <option value="Tidak Hadir">Tidak Hadir</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-[#262626] whitespace-nowrap">
                            {formatRupiah(basicPay)}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={15}
                                step={1}
                                disabled={!isWorking}
                                value={item.durationHours}
                                onChange={(e) => handleBulkDurationChange(idx, 'durationHours', Number(e.target.value))}
                                className="w-14 bg-white border border-[#D0D5DD] rounded px-1.5 py-1 text-xs font-mono disabled:bg-[#F2F4F7]"
                                title="Jam lembur"
                              />
                              <span className="text-[11px] text-[#667085]">j</span>
                              <input
                                type="number"
                                min={0}
                                max={59}
                                step={1}
                                disabled={!isWorking}
                                value={item.durationMinutes}
                                onChange={(e) => handleBulkDurationChange(idx, 'durationMinutes', Number(e.target.value))}
                                className="w-14 bg-white border border-[#D0D5DD] rounded px-1.5 py-1 text-xs font-mono disabled:bg-[#F2F4F7]"
                                title="Menit lembur"
                              />
                              <span className="text-[11px] text-[#667085]">m</span>
                            </div>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
              <span className="text-xs text-[#667085]">
                {bulkEntries.filter((e) => e.status === 'Hadir').length} hadir penuh,{' '}
                {bulkEntries.filter((e) => e.status === 'Setengah Hari').length} setengah hari dari {bulkEntries.length} karyawan.
              </span>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveBulk}
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                >
                  Simpan Absensi Massal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Attendance Confirmation Modal */}
      {isAdmin && attToDelete && (() => {
        const hasActiveKasbon = Boolean(
          attToDelete.kasbonAmount &&
            attToDelete.kasbonAmount > 0 &&
            attToDelete.kasbonStatus !== 'Ditolak'
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px]">
            <div className="glass-modal kms-modal-sm bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[420px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-4 sm:p-5 bg-rose-50 border-b border-rose-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEE4E2] text-[#D92D20] flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#912018]">Hapus Data Absensi?</h3>
                    <p className="text-[11px] text-[#B42318]">
                      Konfirmasi penghapusan catatan kehadiran karyawan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttToDelete(null);
                    setDeleteAttError(null);
                  }}
                  disabled={deletingAtt}
                  className="text-[#912018]/70 hover:text-[#912018] p-1 rounded-lg hover:bg-[#FEE4E2] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] space-y-2 text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#667085]">Nama Karyawan:</span>
                    <span className="font-semibold text-[#1D2939]">
                      {attToDelete.employeeName} ({attToDelete.employeeRole})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#667085]">Tanggal Absensi:</span>
                    <span className="font-mono font-semibold text-[#1D2939]">
                      {formatDateID(attToDelete.date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#667085]">Proyek:</span>
                    <span className="font-semibold text-[#155EEF]">
                      {attToDelete.projectName || attToDelete.projectId || 'Proyek Umum'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-t border-[#EAECF0] pt-2">
                    <span className="text-[#667085]">Status & Total Harian:</span>
                    <span className="font-mono font-bold text-[#1D2939]">
                      {attToDelete.status} · {formatRupiah(attToDelete.totalDailyPay || 0)}
                    </span>
                  </div>
                  {hasActiveKasbon && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-[#667085]">Kasbon Terkait:</span>
                      <span className="font-mono font-bold text-[#6941C6]">
                        {formatRupiah(attToDelete.kasbonAmount || 0)} ({attToDelete.kasbonStatus || 'Disetujui'})
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#FFFAEB] border border-[#FEDF89] rounded-xl text-xs text-[#B54708] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#F79009]" />
                    <span>Peringatan Dampak Penghapusan</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Penghapusan data absensi ini dapat memengaruhi perhitungan rekap gaji dua mingguan, jam lembur harian terkait, serta statistik kehadiran proyek.
                  </p>
                </div>

                {hasActiveKasbon && !deleteAttError && (
                  <div className="p-3.5 bg-[#EFF8FF] border border-[#B2DDFF] rounded-xl text-xs text-[#175CD3] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#155EEF]" />
                      <span>Informasi Kasbon Terkait</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#1849A9]">
                      Absensi ini memiliki transaksi kasbon terkait sebesar <strong className="font-bold">{formatRupiah(attToDelete.kasbonAmount || 0)}</strong> ({attToDelete.kasbonStatus || 'Disetujui'}). Menghapus absensi ini akan otomatis menghapus catatan kasbon dan lembur pada hari ini.
                    </p>
                  </div>
                )}

                {deleteAttError && (
                  <div className="p-3.5 bg-[#FEF3F2] border border-[#FECDCA] rounded-xl text-xs text-[#B42318] space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#D92D20]" />
                      <span>Penghapusan Ditolak</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {deleteAttError}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAttToDelete(null);
                    setDeleteAttError(null);
                  }}
                  disabled={deletingAtt}
                  className="px-4 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingAtt}
                  className="px-4 py-2 bg-[#D92D20] hover:bg-[#B42318] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                >
                  {deletingAtt ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
