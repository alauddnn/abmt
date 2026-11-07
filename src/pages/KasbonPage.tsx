import React, { useState, useEffect, useRef } from 'react';
import {
  Wallet,
  AlertCircle,
  CheckCircle2,
  Plus,
  Search,
  History,
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  ChevronRight,
  Building2,
  User,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { KasbonRecord, Employee, Project, ProjectAssignment } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';

interface KasbonPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

export const KasbonPage: React.FC<KasbonPageProps> = ({ showToast, onDataChanged }) => {
  const { isAdmin, isOwner, user, token } = useAuth();

  const [kasbonList, setKasbonList] = useState<KasbonRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projectAssignmentsMap, setProjectAssignmentsMap] = useState<Record<string, ProjectAssignment[]>>({});
  const [loading, setLoading] = useState(true);

  // View Mode: Daftar Transaksi vs Riwayat Per Karyawan
  const [viewMode, setViewMode] = useState<'transactions' | 'employees'>('transactions');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Create Kasbon Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingKasbon, setSubmittingKasbon] = useState(false);
  const [kasbonForm, setKasbonForm] = useState({
    projectId: '',
    employeeId: '',
    requestDate: getTodayDateString(),
    amount: '',
    reason: '',
    adminNotes: '',
    status: 'Disetujui',
  });
  const [selectedPhoto, setSelectedPhoto] = useState<{
    fileName: string;
    dataBase64: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  const [photoInputError, setPhotoInputError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Payment / Pelunasan Modal State
  const [kasbonToPay, setKasbonToPay] = useState<KasbonRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: getTodayDateString(),
    paymentMethod: 'Tunai',
    notes: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Detail & Riwayat Kasbon Modal
  const [detailKasbon, setDetailKasbon] = useState<KasbonRecord | null>(null);

  // Delete Kasbon Modal
  const [kasbonToDelete, setKasbonToDelete] = useState<KasbonRecord | null>(null);
  const [deletingKasbon, setDeletingKasbon] = useState(false);

  // Photo Lightbox State
  const [viewingProofKasbon, setViewingProofKasbon] = useState<KasbonRecord | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState(false);

  const getKasbonPhotoViewUrl = (attachmentId: string, download: boolean = false) => {
    const params = new URLSearchParams();
    const storedToken = token || localStorage.getItem('kms_token');
    if (storedToken) {
      params.set('token', storedToken);
    }
    const role = user?.role || (isAdmin ? 'admin' : isOwner ? 'owner' : 'admin');
    const name = user?.name || (role === 'admin' ? 'Administrator Proyek' : 'Owner');
    params.set('role', role);
    params.set('userName', name);
    if (download) {
      params.set('download', 'true');
    }
    const qs = params.toString();
    return `/api/projects/kasbon/attachments/${attachmentId}/view${qs ? `?${qs}` : ''}`;
  };

  useEffect(() => {
    if (viewingProofKasbon) {
      setPhotoLoading(true);
      setPhotoLoadError(false);
      setIsZoomed(false);
    }
  }, [viewingProofKasbon]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kbs, projs, emps] = await Promise.all([
        api.getKasbon(),
        api.getProjects(),
        api.getEmployees(),
      ]);
      setKasbonList(kbs);
      setProjects(projs);
      setEmployees(emps);

      // Load project assignments for each project so we can filter employees by project
      const assignMap: Record<string, ProjectAssignment[]> = {};
      await Promise.all(
        projs.map(async (p) => {
          try {
            const asgs = await api.getProjectAssignments(p.id);
            assignMap[p.id] = asgs;
          } catch {
            assignMap[p.id] = [];
          }
        })
      );
      setProjectAssignmentsMap(assignMap);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data kasbon karyawan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateModal = () => {
    if (!isAdmin) return;
    const defaultProjId = projects[0]?.id || '';
    const projAsgs = defaultProjId ? projectAssignmentsMap[defaultProjId] || [] : [];
    const defaultEmpId =
      projAsgs.find((a) => a.status === 'active' && a.employeeStatus !== 'inactive')?.employeeId ||
      employees.find((e) => e.status === 'active')?.id ||
      '';

    setKasbonForm({
      projectId: defaultProjId,
      employeeId: defaultEmpId,
      requestDate: getTodayDateString(),
      amount: '',
      reason: '',
      adminNotes: '',
      status: 'Disetujui',
    });
    setSelectedPhoto(null);
    setPhotoInputError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsAddModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoInputError('Format file harus berupa gambar (JPG, PNG, atau WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoInputError('Ukuran file maksimal 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedPhoto({
        fileName: file.name,
        dataBase64: reader.result as string,
        fileSize: file.size,
        mimeType: file.type,
      });
      setPhotoInputError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!kasbonForm.projectId) {
      showToast('error', 'Pilih proyek terlebih dahulu.');
      return;
    }
    if (!kasbonForm.employeeId) {
      showToast('error', 'Pilih karyawan yang mengajukan kasbon.');
      return;
    }
    const numAmount = Math.round(Number(kasbonForm.amount || 0));
    if (!numAmount || numAmount <= 0) {
      showToast('error', 'Nominal kasbon harus lebih besar dari Rp0.');
      return;
    }
    if (!kasbonForm.reason.trim()) {
      showToast('error', 'Alasan pengajuan kasbon wajib diisi.');
      return;
    }

    setSubmittingKasbon(true);
    try {
      const attachments = selectedPhoto
        ? [
            {
              fileName: selectedPhoto.fileName,
              dataBase64: selectedPhoto.dataBase64,
              fileSize: selectedPhoto.fileSize,
              mimeType: selectedPhoto.mimeType,
            },
          ]
        : [];

      await api.applyKasbon({
        projectId: kasbonForm.projectId,
        employeeId: kasbonForm.employeeId,
        requestDate: kasbonForm.requestDate,
        amount: numAmount,
        reason: kasbonForm.reason.trim(),
        adminNotes: kasbonForm.adminNotes.trim(),
        status: kasbonForm.status,
        attachments,
      });

      showToast('success', `Pengajuan kasbon sebesar ${formatRupiah(numAmount)} berhasil disimpan.`);
      setIsAddModalOpen(false);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan pengajuan kasbon');
    } finally {
      setSubmittingKasbon(false);
    }
  };

  const handleOpenPayModal = (kb: KasbonRecord) => {
    if (!isAdmin) return;
    setKasbonToPay(kb);
    setPaymentForm({
      amount: String(kb.remainingAmount || 0),
      paymentDate: getTodayDateString(),
      paymentMethod: 'Tunai',
      notes: '',
    });
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !kasbonToPay) return;

    const payAmount = Math.round(Number(paymentForm.amount || 0));
    if (!payAmount || payAmount <= 0) {
      showToast('error', 'Nominal pembayaran harus lebih besar dari Rp0.');
      return;
    }
    if (payAmount > kasbonToPay.remainingAmount) {
      showToast('error', `Nominal pembayaran melebihi sisa kasbon (${formatRupiah(kasbonToPay.remainingAmount)}).`);
      return;
    }

    setSubmittingPayment(true);
    try {
      const updated = await api.payKasbon(kasbonToPay.id, {
        amount: payAmount,
        paymentDate: paymentForm.paymentDate || getTodayDateString(),
        paymentMethod: paymentForm.paymentMethod || 'Tunai',
        notes: paymentForm.notes,
      });

      showToast(
        'success',
        `Pembayaran kasbon ${kasbonToPay.employeeName} sebesar ${formatRupiah(payAmount)} berhasil dicatat. Sisa: ${formatRupiah(updated.remainingAmount)}`
      );
      setKasbonToPay(null);
      if (detailKasbon && detailKasbon.id === updated.id) {
        setDetailKasbon(updated);
      }
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mencatat pembayaran kasbon');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleStatusChange = async (kb: KasbonRecord, action: 'approve' | 'reject') => {
    if (!isAdmin) return;
    try {
      const updated = await api.updateKasbonStatus(
        kb.id,
        action,
        action === 'reject' ? 'Ditolak oleh Administrator' : undefined
      );
      showToast('success', `Status kasbon ${kb.kasbonNumber} diperbarui menjadi ${updated.status}.`);
      if (detailKasbon && detailKasbon.id === updated.id) {
        setDetailKasbon(updated);
      }
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memperbarui status kasbon');
    }
  };

  const handleConfirmDelete = async () => {
    if (!isAdmin || !kasbonToDelete) return;
    setDeletingKasbon(true);
    try {
      await api.deleteKasbon(kasbonToDelete.id);
      showToast('success', `Kasbon ${kasbonToDelete.kasbonNumber} berhasil dihapus.`);
      setKasbonToDelete(null);
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus data kasbon');
    } finally {
      setDeletingKasbon(false);
    }
  };

  // Filtered Kasbon List
  const filteredKasbons = kasbonList.filter((kb) => {
    if (projectFilter !== 'ALL' && kb.projectId !== projectFilter) {
      return false;
    }
    if (employeeFilter !== 'ALL' && kb.employeeId !== employeeFilter) {
      return false;
    }
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'BELUM_LUNAS') {
        if (kb.status !== 'Disetujui' && kb.status !== 'Dipotong sebagian') return false;
      } else if (kb.status !== statusFilter) {
        return false;
      }
    }
    if (startDateFilter && kb.requestDate < startDateFilter) {
      return false;
    }
    if (endDateFilter && kb.requestDate > endDateFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matchName = kb.employeeName.toLowerCase().includes(q);
      const matchNum = kb.kasbonNumber.toLowerCase().includes(q);
      const matchReason = (kb.reason || '').toLowerCase().includes(q);
      const matchProj = (kb.projectName || '').toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchReason && !matchProj) return false;
    }
    return true;
  });

  // Summary Metrics based on active filter (excluding rejected)
  const validKasbons = filteredKasbons.filter((k) => k.status !== 'Ditolak');
  const totalKasbon = validKasbons.reduce((sum, k) => sum + Number(k.amount || 0), 0);
  const totalPembayaran = validKasbons.reduce((sum, k) => sum + Number(k.deductedAmount || 0), 0);
  const sisaKasbon = validKasbons.reduce((sum, k) => sum + Number(k.remainingAmount || 0), 0);

  // Group per employee for Riwayat Kasbon Masing-Masing Karyawan
  const employeeSummaryMap = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      employeeRole: string;
      projectNames: Set<string>;
      totalKasbon: number;
      totalPaid: number;
      totalRemaining: number;
      records: KasbonRecord[];
    }
  >();

  filteredKasbons.forEach((kb) => {
    const existing = employeeSummaryMap.get(kb.employeeId) || {
      employeeId: kb.employeeId,
      employeeName: kb.employeeName,
      employeeRole: kb.employeeRole,
      projectNames: new Set<string>(),
      totalKasbon: 0,
      totalPaid: 0,
      totalRemaining: 0,
      records: [],
    };
    if (kb.projectName) existing.projectNames.add(kb.projectName);
    if (kb.status !== 'Ditolak') {
      existing.totalKasbon += Number(kb.amount || 0);
      existing.totalPaid += Number(kb.deductedAmount || 0);
      existing.totalRemaining += Number(kb.remainingAmount || 0);
    }
    existing.records.push(kb);
    employeeSummaryMap.set(kb.employeeId, existing);
  });

  const employeeSummaries = Array.from(employeeSummaryMap.values()).sort(
    (a, b) => b.totalRemaining - a.totalRemaining || b.totalKasbon - a.totalKasbon
  );

  // Available employees when a project is selected in the Add Kasbon modal
  const modalProjectAssignments = kasbonForm.projectId
    ? (projectAssignmentsMap[kasbonForm.projectId] || []).filter(
        (a) => a.status === 'active' && a.employeeStatus !== 'inactive'
      )
    : [];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#4693FD] text-xs font-semibold tracking-tight">
              PT. ASTA BRATA MATAHARI TERBIT
            </span>
            <span className="text-[#D0D5DD]">·</span>
            <span className="text-xs text-[#667085] font-medium">Modul Mandiri Kasbon Karyawan</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1D2939] tracking-tight mt-1">
            Kasbon Karyawan Proyek
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Kelola pengajuan kasbon berdasarkan proyek dan karyawan, bukti pendukung, pencatatan pelunasan manual, serta riwayat kasbon masing-masing karyawan.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Pengajuan Kasbon</span>
          </button>
        )}
      </div>

      {/* 3 Kartu Ringkasan Utama: Total Kasbon, Total Pembayaran, Sisa Kasbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Total Kasbon</span>
            <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#1D2939] mt-2 tabular-nums">
            {formatRupiah(totalKasbon)}
          </p>
          <span className="text-[11px] text-[#667085] mt-1 block">
            {validKasbons.length} pengajuan kasbon tercatat
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Total Pembayaran / Pelunasan</span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF3] text-[#12B76A] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#027A48] mt-2 tabular-nums">
            {formatRupiah(totalPembayaran)}
          </p>
          <span className="text-[11px] text-[#667085] mt-1 block">
            Akumulasi pembayaran kasbon karyawan
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Sisa Kasbon</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3F2] text-[#F04438] flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-[#B42318] mt-2 tabular-nums">
            {formatRupiah(sisaKasbon)}
          </p>
          <span className="text-[11px] text-[#667085] mt-1 block">
            Sisa kasbon yang belum dilunasi
          </span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
        {/* Top Bar with View Switch */}
        <div className="p-4 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1D2939]">Data & Riwayat Kasbon Karyawan</h2>
            <p className="text-xs text-[#667085]">
              Filter berdasarkan proyek, nama karyawan, rentang tanggal, atau status pelunasan
            </p>
          </div>

          <div className="inline-flex bg-[#F2F4F7] p-1 rounded-xl border border-[#EAECF0] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('transactions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'transactions'
                  ? 'bg-white text-[#155EEF] shadow-2xs'
                  : 'text-[#667085] hover:text-[#1D2939]'
              }`}
            >
              Daftar Kasbon ({filteredKasbons.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('employees')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'employees'
                  ? 'bg-white text-[#155EEF] shadow-2xs'
                  : 'text-[#667085] hover:text-[#1D2939]'
              }`}
            >
              Riwayat Per Karyawan ({employeeSummaries.length})
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-[#F9FAFB] border-b border-[#EAECF0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-[#667085] mb-1">Cari Nama / No. Kasbon</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#98A2B3] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama, nomor, alasan..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#667085] mb-1">Filter Proyek</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
            >
              <option value="ALL">Semua Proyek</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#667085] mb-1">Filter Karyawan</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
            >
              <option value="ALL">Semua Karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#667085] mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#667085] mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#667085] mb-1">Status</label>
            <div className="flex items-center gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
              >
                <option value="ALL">Semua Status</option>
                <option value="BELUM_LUNAS">Belum Lunas (Aktif)</option>
                <option value="Disetujui">Disetujui (Belum Dibayar)</option>
                <option value="Dipotong sebagian">Dibayar Sebagian</option>
                <option value="Lunas">Lunas</option>
                <option value="Menunggu persetujuan">Menunggu Persetujuan</option>
                <option value="Ditolak">Ditolak</option>
              </select>
              {(searchQuery ||
                projectFilter !== 'ALL' ||
                employeeFilter !== 'ALL' ||
                statusFilter !== 'ALL' ||
                startDateFilter ||
                endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setProjectFilter('ALL');
                    setEmployeeFilter('ALL');
                    setStatusFilter('ALL');
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  className="px-2 py-1.5 bg-white hover:bg-[#F2F4F7] text-[#475467] border border-[#D0D5DD] rounded-lg text-[11px] font-semibold shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content: Transactions Table or Employee History */}
        {viewMode === 'transactions' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                  <th className="py-3 px-4">No. Kasbon</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Proyek</th>
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4 text-right">Total Kasbon</th>
                  <th className="py-3 px-4 text-right">Total Pembayaran</th>
                  <th className="py-3 px-4 text-right">Sisa Kasbon</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Bukti</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-[#667085]">
                      Memuat data kasbon...
                    </td>
                  </tr>
                ) : filteredKasbons.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-[#667085]">
                      Belum ada data kasbon yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredKasbons.map((kb) => {
                    const projObj = projects.find((p) => p.id === kb.projectId);
                    const pName = kb.projectName || projObj?.name || 'Proyek Umum';
                    const pCode = kb.projectCode || projObj?.code || '';

                    return (
                      <tr key={kb.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#4693FD] whitespace-nowrap">
                          {kb.kasbonNumber}
                        </td>
                        <td className="py-3 px-4 text-[#667085] whitespace-nowrap">
                          {formatDateID(kb.requestDate)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2F4F7] text-[#344054] font-medium text-[11px]">
                            <Building2 className="w-3 h-3 text-[#667085]" />
                            <span>{pName}</span>
                            {pCode && <span className="font-mono text-[#667085]">({pCode})</span>}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#1D2939] block">{kb.employeeName}</span>
                          <span className="text-[11px] text-[#667085] font-mono">
                            {kb.employeeId} · {kb.employeeRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[#1D2939] whitespace-nowrap">
                          {formatRupiah(kb.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[#027A48] whitespace-nowrap">
                          {formatRupiah(kb.deductedAmount || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#B42318] whitespace-nowrap">
                          {formatRupiah(kb.remainingAmount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              kb.status === 'Disetujui'
                                ? 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]'
                                : kb.status === 'Lunas'
                                ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                                : kb.status === 'Dipotong sebagian'
                                ? 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                                : kb.status === 'Ditolak'
                                ? 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {kb.status === 'Dipotong sebagian' ? 'Dibayar Sebagian' : kb.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {(kb.attachments && kb.attachments.length > 0) || kb.attachmentFilePath ? (
                            <button
                              type="button"
                              onClick={() => setViewingProofKasbon(kb)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] border border-[#D0E2FF] text-xs font-semibold transition-colors"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Lihat Bukti</span>
                            </button>
                          ) : (
                            <span className="text-[#98A2B3] text-[11px]">Tanpa Bukti</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[180px] truncate text-[#667085]" title={kb.reason}>
                          {kb.reason}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {isAdmin && kb.status === 'Menunggu persetujuan' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(kb, 'approve')}
                                  className="px-2 py-1 bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#027A48] border border-[#A6F4C5] rounded-lg text-[11px] font-semibold"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(kb, 'reject')}
                                  className="px-2 py-1 bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#B42318] border border-[#FECDCA] rounded-lg text-[11px] font-semibold"
                                >
                                  Tolak
                                </button>
                              </>
                            )}

                            {isAdmin && kb.remainingAmount > 0 && kb.status !== 'Ditolak' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPayModal(kb)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#027A48] border border-[#A6F4C5] rounded-lg text-[11px] font-semibold"
                                title="Catat Pembayaran / Pelunasan Manual"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>Bayar</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDetailKasbon(kb)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F9FAFB] text-[#344054] border border-[#D0D5DD] rounded-lg text-[11px] font-semibold"
                            >
                              <History className="w-3 h-3" />
                              <span>Riwayat</span>
                            </button>

                            {isAdmin && kb.deductedAmount === 0 && (
                              <button
                                type="button"
                                onClick={() => setKasbonToDelete(kb)}
                                className="p-1 text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2] rounded-lg transition-colors"
                                title="Hapus Kasbon"
                              >
                                <Trash2 className="w-4 h-4" />
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
        ) : (
          /* Riwayat Kasbon Masing-Masing Karyawan */
          <div className="p-4 space-y-3">
            {employeeSummaries.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#667085]">
                Belum ada riwayat kasbon karyawan sesuai filter.
              </div>
            ) : (
              employeeSummaries.map((empSum) => {
                const isExpanded = expandedEmployeeId === empSum.employeeId;
                return (
                  <div
                    key={empSum.employeeId}
                    className="border border-[#EAECF0] rounded-xl overflow-hidden bg-white"
                  >
                    <div
                      onClick={() => setExpandedEmployeeId(isExpanded ? null : empSum.employeeId)}
                      className="p-4 bg-[#F9FAFB] hover:bg-[#F2F4F7] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <User className="w-4 h-4 text-[#4693FD]" />
                          <span className="font-bold text-sm text-[#1D2939]">{empSum.employeeName}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-[#D0D5DD] rounded text-[#475467]">
                            {empSum.employeeId} · {empSum.employeeRole}
                          </span>
                          {Array.from(empSum.projectNames).map((pn) => (
                            <span
                              key={pn}
                              className="text-[11px] px-2 py-0.5 bg-[#EFF5FF] text-[#155EEF] rounded font-medium"
                            >
                              {pn}
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-[#667085]">
                          {empSum.records.length} catatan pengajuan kasbon
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-5 text-xs">
                        <div>
                          <span className="text-[#667085] block text-[10px]">Total Kasbon</span>
                          <span className="font-mono font-semibold text-[#1D2939]">
                            {formatRupiah(empSum.totalKasbon)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#667085] block text-[10px]">Total Pembayaran</span>
                          <span className="font-mono font-semibold text-[#027A48]">
                            {formatRupiah(empSum.totalPaid)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#667085] block text-[10px]">Sisa Kasbon</span>
                          <span className="font-mono font-bold text-[#B42318]">
                            {formatRupiah(empSum.totalRemaining)}
                          </span>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#667085] transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-[#EAECF0] bg-white overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[#F9FAFB] text-[#475467] border-b border-[#EAECF0]">
                              <th className="py-2 px-3">No. Kasbon</th>
                              <th className="py-2 px-3">Tanggal</th>
                              <th className="py-2 px-3">Proyek</th>
                              <th className="py-2 px-3">Alasan</th>
                              <th className="py-2 px-3 text-right">Total Kasbon</th>
                              <th className="py-2 px-3 text-right">Terbayar</th>
                              <th className="py-2 px-3 text-right">Sisa</th>
                              <th className="py-2 px-3 text-center">Status</th>
                              <th className="py-2 px-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAECF0]">
                            {empSum.records.map((kb) => (
                              <tr key={kb.id} className="hover:bg-[#F9FAFB]">
                                <td className="py-2.5 px-3 font-mono font-medium text-[#4693FD]">
                                  {kb.kasbonNumber}
                                </td>
                                <td className="py-2.5 px-3 text-[#667085]">{formatDateID(kb.requestDate)}</td>
                                <td className="py-2.5 px-3 text-[#344054]">
                                  {kb.projectName || projects.find((p) => p.id === kb.projectId)?.name || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-[#344054]">{kb.reason}</td>
                                <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(kb.amount)}</td>
                                <td className="py-2.5 px-3 text-right font-mono text-[#027A48]">
                                  {formatRupiah(kb.deductedAmount || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-[#B42318]">
                                  {formatRupiah(kb.remainingAmount)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F2F4F7] text-[#344054]">
                                    {kb.status === 'Dipotong sebagian' ? 'Dibayar Sebagian' : kb.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="inline-flex items-center gap-1.5">
                                    {isAdmin && kb.remainingAmount > 0 && kb.status !== 'Ditolak' && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenPayModal(kb)}
                                        className="px-2 py-1 bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5] rounded text-[11px] font-semibold"
                                      >
                                        Bayar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setDetailKasbon(kb)}
                                      className="px-2 py-1 bg-white text-[#344054] border border-[#D0D5DD] rounded text-[11px] font-semibold"
                                    >
                                      Detail & Riwayat
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: INPUT PENGAJUAN KASBON BARU */}
      {isAdmin && isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-[#EAECF0] overflow-hidden my-8">
            <div className="px-5 py-4 bg-[#F8F9FA] border-b border-[#EAECF0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EFF5FF] text-[#155EEF] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1D2939]">Input Pengajuan Kasbon Karyawan</h3>
                  <p className="text-[11px] text-[#667085]">Pilih proyek, karyawan, nominal, alasan, dan bukti pendukung</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={submittingKasbon}
                className="text-[#667085] hover:text-[#1D2939] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {/* 1. Pilih Proyek */}
              <div>
                <label className="block font-semibold text-[#344054] mb-1.5">
                  Pilih Proyek <span className="text-[#D92D20]">*</span>
                </label>
                <select
                  required
                  value={kasbonForm.projectId}
                  onChange={(e) => {
                    const nextProjId = e.target.value;
                    const asgs = (projectAssignmentsMap[nextProjId] || []).filter(
                      (a) => a.status === 'active' && a.employeeStatus !== 'inactive'
                    );
                    setKasbonForm({
                      ...kasbonForm,
                      projectId: nextProjId,
                      employeeId: asgs[0]?.employeeId || '',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs font-medium text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="">-- Pilih Proyek --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} — {p.location}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Pilih Karyawan */}
              <div>
                <label className="block font-semibold text-[#344054] mb-1.5">
                  Pilih Karyawan <span className="text-[#D92D20]">*</span>
                </label>
                <select
                  required
                  value={kasbonForm.employeeId}
                  onChange={(e) => setKasbonForm({ ...kasbonForm, employeeId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs font-medium text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {modalProjectAssignments.length > 0
                    ? modalProjectAssignments.map((asg) => (
                        <option key={asg.employeeId} value={asg.employeeId}>
                          [{asg.employeeId}] {asg.employeeName} — {asg.roleInProject || asg.employeeRole}
                        </option>
                      ))
                    : employees
                        .filter((e) => e.status === 'active')
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            [{e.id}] {e.name} — {e.role}
                          </option>
                        ))}
                </select>
              </div>

              {/* 3. Tanggal & Nominal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">
                    Tanggal Pengajuan <span className="text-[#D92D20]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={kasbonForm.requestDate}
                    onChange={(e) => setKasbonForm({ ...kasbonForm, requestDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">
                    Nominal Kasbon (Rp) <span className="text-[#D92D20]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="any"
                    required
                    placeholder="Contoh: 300000"
                    value={kasbonForm.amount}
                    onChange={(e) => setKasbonForm({ ...kasbonForm, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl font-mono font-bold text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                  {Number(kasbonForm.amount) > 0 && (
                    <span className="text-[11px] font-mono text-[#4693FD] font-semibold mt-1 block">
                      {formatRupiah(Number(kasbonForm.amount))}
                    </span>
                  )}
                </div>
              </div>

              {/* 4. Alasan Kasbon */}
              <div>
                <label className="block font-semibold text-[#344054] mb-1.5">
                  Alasan Pengajuan Kasbon <span className="text-[#D92D20]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kebutuhan keluarga mendesak / Biaya berobat..."
                  value={kasbonForm.reason}
                  onChange={(e) => setKasbonForm({ ...kasbonForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[
                    'Kebutuhan keluarga mendesak',
                    'Biaya berobat / beli obat',
                    'Keperluan anak sekolah',
                    'Ongkos transportasi darurat',
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setKasbonForm({ ...kasbonForm, reason: sug })}
                      className="px-2 py-0.5 rounded-md bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#344054] text-[10px] font-medium"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Bukti Pendukung */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[#344054]">
                    Bukti Pendukung / Foto <span className="text-[#667085] font-normal">(Opsional)</span>
                  </label>
                  <span className="text-[10px] text-[#667085]">Maks. 5 MB · JPG, PNG, WebP</span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />

                {selectedPhoto ? (
                  <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={selectedPhoto.dataBase64}
                        alt="Pratinjau Bukti"
                        className="w-14 h-14 object-cover rounded-lg border border-[#D0D5DD] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-[#1D2939] truncate">{selectedPhoto.fileName}</p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#ECFDF3] text-[#027A48] text-[10px] font-medium">
                          ✓ Siap disimpan ke Supabase Storage
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhoto(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1.5 text-[#D92D20] hover:bg-[#FEF3F2] rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 border-2 border-dashed border-[#D0D5DD] hover:border-[#4693FD] bg-[#F8F9FA] hover:bg-[#EFF8FF] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-[#4693FD]" />
                    <span className="text-xs font-semibold text-[#344054]">
                      Upload Foto Bukti Kasbon / Transfer
                    </span>
                    <span className="text-[10px] text-[#667085]">Klik untuk memilih gambar</span>
                  </button>
                )}

                {photoInputError && (
                  <p className="text-[11px] text-[#D92D20] mt-1">{photoInputError}</p>
                )}
              </div>

              {/* 6. Catatan Admin */}
              <div>
                <label className="block font-semibold text-[#344054] mb-1.5">
                  Catatan Tambahan <span className="text-[#667085] font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Catatan kesepakatan pelunasan..."
                  value={kasbonForm.adminNotes}
                  onChange={(e) => setKasbonForm({ ...kasbonForm, adminNotes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submittingKasbon}
                  className="px-4 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] font-semibold rounded-xl border border-[#D0D5DD] text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingKasbon}
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white font-semibold rounded-xl text-xs shadow-xs disabled:opacity-50"
                >
                  {submittingKasbon ? 'Menyimpan...' : 'Simpan Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PENCATATAN PEMBAYARAN / PELUNASAN MANUAL */}
      {isAdmin && kasbonToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ECFDF3] text-[#027A48] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1D2939]">Catat Pembayaran / Pelunasan Kasbon</h3>
                  <p className="text-[11px] text-[#667085]">
                    {kasbonToPay.kasbonNumber} · {kasbonToPay.employeeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKasbonToPay(null)}
                disabled={submittingPayment}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Total Kasbon:</span>
                  <span className="font-mono font-semibold text-[#1D2939]">{formatRupiah(kasbonToPay.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Total Sudah Dibayar:</span>
                  <span className="font-mono font-semibold text-[#027A48]">
                    {formatRupiah(kasbonToPay.deductedAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#EAECF0]">
                  <span className="font-semibold text-[#344054]">Sisa Kasbon Saat Ini:</span>
                  <span className="font-mono font-bold text-sm text-[#B42318]">
                    {formatRupiah(kasbonToPay.remainingAmount)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[#344054]">
                    Nominal Pembayaran (Rp) <span className="text-[#D92D20]">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: String(Math.round(kasbonToPay.remainingAmount / 2)),
                        })
                      }
                      className="px-2 py-0.5 bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#344054] rounded text-[10px] font-semibold"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentForm({
                          ...paymentForm,
                          amount: String(kasbonToPay.remainingAmount),
                        })
                      }
                      className="px-2 py-0.5 bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#027A48] border border-[#A6F4C5] rounded text-[10px] font-semibold"
                    >
                      Lunasi Penuh
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max={kasbonToPay.remainingAmount}
                  step="any"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl font-mono font-bold text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">Tanggal Bayar *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">Metode Bayar *</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939]"
                  >
                    <option value="Tunai">Tunai / Kas Lapangan</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="E-Wallet">E-Wallet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1.5">Catatan Pelunasan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Cicilan ke-1 atau pelunasan tunai..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setKasbonToPay(null)}
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-[#12B76A] hover:bg-[#027A48] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {submittingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DETAIL & RIWAYAT PEMBAYARAN KASBON */}
      {detailKasbon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-[#EAECF0] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#F8F9FA]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#155EEF] bg-[#EFF5FF] px-2 py-0.5 rounded border border-[#D0E2FF]">
                    {detailKasbon.kasbonNumber}
                  </span>
                  <h3 className="text-base font-bold text-[#1D2939]">{detailKasbon.employeeName}</h3>
                </div>
                <p className="text-xs text-[#667085] mt-0.5">
                  ID: {detailKasbon.employeeId} · Jabatan: {detailKasbon.employeeRole} · Proyek:{' '}
                  {detailKasbon.projectName ||
                    projects.find((p) => p.id === detailKasbon.projectId)?.name ||
                    '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailKasbon(null)}
                className="p-1.5 text-[#667085] hover:text-[#1D2939] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Total Kasbon</span>
                  <span className="text-base font-bold font-mono text-[#1D2939] mt-0.5 block">
                    {formatRupiah(detailKasbon.amount)}
                  </span>
                </div>
                <div className="p-3 bg-[#ECFDF3] rounded-xl border border-[#A6F4C5]">
                  <span className="text-[#027A48] block">Total Pembayaran</span>
                  <span className="text-base font-bold font-mono text-[#027A48] mt-0.5 block">
                    {formatRupiah(detailKasbon.deductedAmount || 0)}
                  </span>
                </div>
                <div className="p-3 bg-[#FEF3F2] rounded-xl border border-[#FECDCA]">
                  <span className="text-[#B42318] block">Sisa Kasbon</span>
                  <span className="text-base font-bold font-mono text-[#B42318] mt-0.5 block">
                    {formatRupiah(detailKasbon.remainingAmount)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#EAECF0] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Tanggal Pengajuan:</span>
                  <span className="font-semibold text-[#1D2939]">{formatDateID(detailKasbon.requestDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Alasan Pengajuan:</span>
                  <span className="font-semibold text-[#1D2939]">{detailKasbon.reason}</span>
                </div>
                {detailKasbon.adminNotes && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Catatan Admin:</span>
                    <span className="text-[#344054]">{detailKasbon.adminNotes}</span>
                  </div>
                )}
              </div>

              {/* Riwayat Pembayaran Manual */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[#1D2939]">Riwayat Pembayaran / Pelunasan Manual</h4>
                  {isAdmin && detailKasbon.remainingAmount > 0 && detailKasbon.status !== 'Ditolak' && (
                    <button
                      type="button"
                      onClick={() => handleOpenPayModal(detailKasbon)}
                      className="px-2.5 py-1 bg-[#12B76A] hover:bg-[#027A48] text-white rounded-lg text-[11px] font-semibold"
                    >
                      + Catat Pembayaran
                    </button>
                  )}
                </div>

                {!detailKasbon.payments || detailKasbon.payments.length === 0 ? (
                  <div className="p-4 text-center bg-[#F9FAFB] rounded-xl border border-[#EAECF0] text-[#667085]">
                    Belum ada catatan pembayaran manual pada kasbon ini.
                  </div>
                ) : (
                  <div className="border border-[#EAECF0] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#F9FAFB] text-[#475467] border-b border-[#EAECF0]">
                          <th className="py-2 px-3">No. Pembayaran</th>
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3">Metode</th>
                          <th className="py-2 px-3 text-right">Nominal</th>
                          <th className="py-2 px-3">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECF0]">
                        {detailKasbon.payments.map((pay) => (
                          <tr key={pay.id}>
                            <td className="py-2 px-3 font-mono text-[11px] text-[#4693FD]">{pay.paymentNumber}</td>
                            <td className="py-2 px-3 text-[#475467]">{formatDateID(pay.paymentDate)}</td>
                            <td className="py-2 px-3 font-medium text-[#1D2939]">{pay.paymentMethod}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-[#027A48]">
                              {formatRupiah(pay.amount)}
                            </td>
                            <td className="py-2 px-3 text-[#667085]">{pay.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Jejak Audit */}
              {detailKasbon.auditTrail && detailKasbon.auditTrail.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-[#1D2939]">Log Aktivitas Kasbon</h4>
                  <div className="bg-[#F9FAFB] rounded-xl border border-[#EAECF0] p-3 space-y-2 max-h-40 overflow-y-auto">
                    {detailKasbon.auditTrail.map((log, idx) => (
                      <div key={idx} className="text-[11px] border-b border-[#EAECF0] last:border-0 pb-1.5 last:pb-0">
                        <span className="font-semibold text-[#1D2939]">{log.user}</span>{' '}
                        <span className="text-[#667085]">({formatDateID(log.timestamp.slice(0, 10))}):</span>{' '}
                        <span className="text-[#344054]">{log.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-[#F9FAFB] border-t border-[#EAECF0] flex justify-end">
              <button
                type="button"
                onClick={() => setDetailKasbon(null)}
                className="px-4 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KONFIRMASI HAPUS KASBON */}
      {isAdmin && kasbonToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden">
            <div className="p-5 bg-[#FEF3F2] border-b border-[#FECDCA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FEE4E2] text-[#D92D20] flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#912018]">Hapus Data Kasbon?</h3>
                  <p className="text-[11px] text-[#B42318]">{kasbonToDelete.kasbonNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKasbonToDelete(null)}
                disabled={deletingKasbon}
                className="p-1 text-[#912018] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#344054]">
                Anda yakin ingin menghapus pengajuan kasbon <strong>{kasbonToDelete.employeeName}</strong> sebesar{' '}
                <strong className="font-mono">{formatRupiah(kasbonToDelete.amount)}</strong>?
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#EAECF0]">
                <button
                  type="button"
                  onClick={() => setKasbonToDelete(null)}
                  disabled={deletingKasbon}
                  className="px-4 py-2 bg-white border border-[#D0D5DD] rounded-xl text-xs font-semibold text-[#344054]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingKasbon}
                  className="px-4 py-2 bg-[#D92D20] hover:bg-[#B42318] text-white rounded-xl text-xs font-semibold"
                >
                  {deletingKasbon ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: LIGHTBOX BUKTI FOTO KASBON */}
      {viewingProofKasbon && (() => {
        const photoAttachment =
          viewingProofKasbon.attachments && viewingProofKasbon.attachments.length > 0
            ? viewingProofKasbon.attachments[0]
            : {
                id: viewingProofKasbon.id,
                fileName: viewingProofKasbon.attachmentFileName || `bukti_${viewingProofKasbon.kasbonNumber}.jpg`,
                fileSize: viewingProofKasbon.attachmentFileSize || 0,
                mimeType: viewingProofKasbon.attachmentMimeType || 'image/jpeg',
              };

        return (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-[#0F172A] rounded-2xl max-w-4xl w-full border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              <div className="px-5 py-3.5 bg-[#1E293B] border-b border-white/10 flex items-center justify-between">
                <div className="text-xs text-white">
                  <span className="font-mono font-bold text-[#4693FD]">{viewingProofKasbon.kasbonNumber}</span> ·{' '}
                  <span className="font-semibold">{viewingProofKasbon.employeeName}</span> ({formatRupiah(viewingProofKasbon.amount)})
                </div>
                <button
                  type="button"
                  onClick={() => setViewingProofKasbon(null)}
                  className="p-1 text-white/70 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative p-4 bg-[#0F172A] flex items-center justify-center overflow-auto flex-1 min-h-[320px]">
                {photoLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs">
                    Memuat bukti foto...
                  </div>
                )}
                {photoLoadError ? (
                  <div className="text-center text-white text-xs space-y-2 p-6">
                    <AlertCircle className="w-8 h-8 text-[#FDA29B] mx-auto" />
                    <p>Gagal memuat pratinjau gambar.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoLoading(true);
                        setPhotoLoadError(false);
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Coba Lagi</span>
                    </button>
                  </div>
                ) : (
                  <img
                    src={getKasbonPhotoViewUrl(photoAttachment.id)}
                    alt={photoAttachment.fileName}
                    className={`max-w-full max-h-[65vh] object-contain rounded-lg transition-transform ${
                      isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                    }`}
                    onLoad={() => setPhotoLoading(false)}
                    onError={() => {
                      setPhotoLoading(false);
                      setPhotoLoadError(true);
                    }}
                    onClick={() => setIsZoomed(!isZoomed)}
                  />
                )}
              </div>

              <div className="px-5 py-3 bg-[#1E293B] border-t border-white/10 flex items-center justify-between text-xs text-white">
                <span className="truncate">{photoAttachment.fileName}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="px-3 py-1.5 bg-[#334155] hover:bg-[#475569] rounded-lg inline-flex items-center gap-1"
                  >
                    {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                    <span>{isZoomed ? 'Perkecil' : 'Perbesar'}</span>
                  </button>
                  <a
                    href={getKasbonPhotoViewUrl(photoAttachment.id, true)}
                    download={photoAttachment.fileName}
                    className="px-3 py-1.5 bg-[#4693FD] hover:bg-[#1849A9] rounded-lg inline-flex items-center gap-1 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
