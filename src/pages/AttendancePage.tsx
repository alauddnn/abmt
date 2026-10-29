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
  Layers,
  ArrowRight,
  X,
  Wallet,
  Upload,
  Image as ImageIcon,
  AlertCircle,
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
} from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

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
      setSingleForm({
        date: selectedDate || getTodayDateString(),
        employeeId: employees[0]?.id || '',
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
    const numKasbonAmount = Number(singleForm.kasbonAmount || 0);
    if (singleForm.hasKasbon) {
      if (!numKasbonAmount || numKasbonAmount <= 0 || isNaN(numKasbonAmount)) {
        showToast('error', 'Nominal kasbon wajib diisi dan harus lebih besar dari Rp0.');
        return;
      }
    }

    const isWorking = singleForm.status === 'Hadir' || singleForm.status === 'Setengah Hari';
    const dHours = isWorking ? Math.max(0, Math.floor(Number(singleForm.durationHours) || 0)) : 0;
    const dMins = isWorking ? Math.max(0, Math.min(59, Math.round(Number(singleForm.durationMinutes) || 0))) : 0;
    const decHours = Number(((dHours * 60 + dMins) / 60).toFixed(4));

    const kasbonAttachments =
      singleForm.hasKasbon && selectedKasbonPhoto
        ? [
            {
              fileName: selectedKasbonPhoto.fileName,
              dataBase64: selectedKasbonPhoto.dataBase64,
              fileSize: selectedKasbonPhoto.fileSize,
              mimeType: selectedKasbonPhoto.mimeType,
            },
          ]
        : [];

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
        hasKasbon: singleForm.hasKasbon,
        kasbonId: singleForm.kasbonId || undefined,
        kasbonAmount: singleForm.hasKasbon ? numKasbonAmount : 0,
        kasbonNotes: singleForm.hasKasbon ? singleForm.kasbonNotes : '',
        kasbonAttachments,
        removeKasbonPhoto: singleForm.removeKasbonPhoto,
      };

      if (editingAtt) {
        await api.updateAttendance(editingAtt.id, payload);
        showToast(
          'success',
          singleForm.hasKasbon
            ? `Perubahan absensi dan kasbon (${formatRupiah(numKasbonAmount)}) berhasil disimpan.`
            : 'Catatan absensi & upah berhasil diperbarui.'
        );
      } else {
        await api.createAttendance(payload);
        showToast(
          'success',
          singleForm.hasKasbon
            ? `Absensi dan pengajuan kasbon (${formatRupiah(numKasbonAmount)}) berhasil dicatat.`
            : 'Absensi berhasil dicatat.'
        );
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
  const totalHadirPenuh = filteredAttendance.filter((a) => a.status === 'Hadir').length;
  const totalSetengahHari = filteredAttendance.filter((a) => a.status === 'Setengah Hari').length;
  const totalLemburHours = Number(filteredAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0).toFixed(2));
  const totalDailyPay = filteredAttendance.reduce((sum, a) => sum + (a.totalDailyPay || 0), 0);

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
              {totalHadirPenuh} Hadir Penuh | {totalSetengahHari} Setengah Hari | {formatOvertimeDuration(totalLemburHours)} Lembur ({formatRupiah(totalDailyPay)})
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Absensi & Gaji Harian Karyawan
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Pencatatan kehadiran harian penuh (100%), setengah hari (50%), durasi lembur aktual (jam & menit), serta kasbon terintegrasi.
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
              <option value="Hadir">Hadir (Penuh)</option>
              <option value="Setengah Hari">Setengah Hari (50%)</option>
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
                <th className="py-3 px-4">Durasi Lembur</th>
                <th className="py-3 px-4">Tarif Harian</th>
                <th className="py-3 px-4">Upah Kehadiran</th>
                <th className="py-3 px-4">Upah Lembur</th>
                <th className="py-3 px-4">Total Harian</th>
                <th className="py-3 px-4">Kasbon</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-[#667085]">
                    Memuat catatan absensi...
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center">
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
                filteredAttendance.map((a) => {
                  const rowBasicPay = calculateBasicPayByStatus(a.status, a.dailyWageSnapshot);
                  const rowOtPay = calculateOvertimePayFromDecimal(a.overtimeHours, a.overtimeWageSnapshot);
                  return (
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
                              : a.status === 'Setengah Hari'
                              ? 'bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF]'
                              : a.status === 'Izin' || a.status === 'Sakit'
                              ? 'bg-[#FEF7EC] text-[#D99A23]'
                              : 'bg-[#FEF3F2] text-[#D64545]'
                          }`}
                        >
                          {a.status === 'Setengah Hari' ? 'Setengah Hari (50%)' : a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#667085] whitespace-nowrap">
                        {a.status === 'Hadir' || a.status === 'Setengah Hari' ? `${a.checkIn} - ${a.checkOut}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#262626] whitespace-nowrap">
                        {a.overtimeHours > 0 ? (
                          <span className="font-medium text-[#4693FD]">{formatOvertimeDuration(a.overtimeHours)}</span>
                        ) : (
                          <span className="text-[#98A2B3]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap tabular-nums">
                        {formatRupiah(a.dailyWageSnapshot)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap tabular-nums">
                        {formatRupiah(rowBasicPay)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap tabular-nums">
                        {formatRupiah(rowOtPay)}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#262626] whitespace-nowrap tabular-nums">
                        {formatRupiah(a.totalDailyPay)}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap tabular-nums">
                        {a.kasbonAmount && a.kasbonAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F9F5FF] text-[#6941C6] border border-[#E9D7FE] text-[11px] font-semibold">
                            {formatRupiah(a.kasbonAmount)}
                          </span>
                        ) : (
                          <span className="text-[#98A2B3]">-</span>
                        )}
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
                            Edit
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

      {/* Single Attendance Modal (Create & Edit with Integrated Kasbon) */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingAtt ? `Edit Absensi: ${editingAtt.employeeName}` : 'Catat Kehadiran Karyawan'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                disabled={savingSingle}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSingle} className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
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

              {/* Bagian Pengajuan Kasbon Terintegrasi */}
              <div className="pt-3 border-t border-[#EAECF0] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#6941C6]" />
                      <span>Pengajuan Kasbon</span>
                    </h4>
                    <p className="text-[11px] text-[#667085]">
                      Karyawan penerima kasbon otomatis mengikuti karyawan pada form absensi
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-[#F2F4F7] p-1 rounded-lg border border-[#D0D5DD]">
                    <button
                      type="button"
                      onClick={() => setSingleForm({ ...singleForm, hasKasbon: false })}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        !singleForm.hasKasbon
                          ? 'bg-white text-[#1D2939] shadow-2xs'
                          : 'text-[#667085] hover:text-[#1D2939]'
                      }`}
                    >
                      Tidak
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleForm({ ...singleForm, hasKasbon: true })}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        singleForm.hasKasbon
                          ? 'bg-[#6941C6] text-white shadow-2xs'
                          : 'text-[#667085] hover:text-[#1D2939]'
                      }`}
                    >
                      Ya
                    </button>
                  </div>
                </div>

                {singleForm.hasKasbon && (
                  <div className="p-3.5 bg-[#F9F5FF]/60 rounded-xl border border-[#E9D7FE] space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-[#344054] block mb-1">
                        Nominal Kasbon (Rp) <span className="text-[#D92D20]">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Masukkan nominal kasbon (contoh: 300000)"
                        value={singleForm.kasbonAmount}
                        onChange={(e) => setSingleForm({ ...singleForm, kasbonAmount: e.target.value })}
                        required={singleForm.hasKasbon}
                        className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-bold text-[#1D2939] focus:outline-none focus:border-[#6941C6]"
                      />
                      {Number(singleForm.kasbonAmount) > 0 && (
                        <span className="text-[11px] font-mono font-semibold text-[#6941C6] mt-1 block">
                          {formatRupiah(Number(singleForm.kasbonAmount))}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#344054] block mb-1">
                        Keterangan Kasbon
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Kebutuhan keluarga mendesak..."
                        value={singleForm.kasbonNotes}
                        onChange={(e) => setSingleForm({ ...singleForm, kasbonNotes: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#6941C6]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[#344054]">
                          Upload Bukti Kasbon <span className="text-[#667085] font-normal">(Opsional)</span>
                        </label>
                        <span className="text-[10px] text-[#667085]">Maks. 5 MB · JPG, PNG, WebP</span>
                      </div>

                      <input
                        type="file"
                        ref={kasbonFileInputRef}
                        accept="image/*"
                        onChange={handleKasbonPhotoChange}
                        className="hidden"
                      />

                      {selectedKasbonPhoto ? (
                        <div className="p-2.5 bg-white rounded-xl border border-[#D0D5DD] space-y-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={selectedKasbonPhoto.dataBase64}
                              alt="Pratinjau Bukti Kasbon"
                              className="w-16 h-16 object-cover rounded-lg border border-[#EAECF0] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#1D2939] truncate">
                                {selectedKasbonPhoto.fileName}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#ECFDF3] text-[#027A48] text-[10px] font-medium">
                                ✓ Pratinjau foto baru
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-[#F2F4F7]">
                            <button
                              type="button"
                              onClick={() => kasbonFileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-[#F8F9FA] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Ganti Foto
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveKasbonPhoto}
                              className="px-2.5 py-1 bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Hapus Foto
                            </button>
                          </div>
                        </div>
                      ) : singleForm.existingKasbonAttachmentId && !singleForm.removeKasbonPhoto ? (
                        <div className="p-2.5 bg-white rounded-xl border border-[#D0D5DD] space-y-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={getKasbonPhotoViewUrl(singleForm.existingKasbonAttachmentId)}
                              alt="Bukti Kasbon Tersimpan"
                              className="w-16 h-16 object-cover rounded-lg border border-[#EAECF0] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#1D2939] truncate">
                                {singleForm.existingKasbonAttachmentFileName || 'Bukti Kasbon Tersimpan'}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#EFF5FF] text-[#155EEF] text-[10px] font-medium">
                                Tersimpan di Supabase Storage
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-[#F2F4F7]">
                            <button
                              type="button"
                              onClick={() => kasbonFileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-[#F8F9FA] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Ganti Foto
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveKasbonPhoto}
                              className="px-2.5 py-1 bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Hapus Foto
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => kasbonFileInputRef.current?.click()}
                          className="w-full py-3.5 border-2 border-dashed border-[#D0D5DD] hover:border-[#6941C6] bg-white hover:bg-[#F9F5FF] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-[#6941C6]" />
                          <span className="text-xs font-semibold text-[#344054]">
                            Upload Foto Bukti Transfer / Pembayaran Kasbon
                          </span>
                          <span className="text-[10px] text-[#667085]">Klik untuk memilih foto bukti</span>
                        </button>
                      )}

                      {kasbonPhotoError && (
                        <div className="mt-1.5 p-2 bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] rounded-lg text-[11px] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{kasbonPhotoError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  disabled={savingSingle}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSingle}
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Absensi Massal Karyawan ({bulkEntries.length} Karyawan)</h3>
                <p className="text-[11px] text-[#667085]">
                  Pilih status kehadiran (Hadir Penuh, Setengah Hari, Izin, dll.) dan durasi lembur (Jam & Menit)
                </p>
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

            <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-between">
              <span className="text-xs text-[#667085]">
                {bulkEntries.filter((e) => e.status === 'Hadir').length} hadir penuh,{' '}
                {bulkEntries.filter((e) => e.status === 'Setengah Hari').length} setengah hari dari {bulkEntries.length} karyawan.
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
