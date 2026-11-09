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
  Filter,
  HardHat,
  Truck,
  Eye,
  Check,
} from 'lucide-react';
import { KasbonRecord, Employee, Project, ProjectAssignment } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString, isDriverRole } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';

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

  // Section Tab: A. Kasbon Aktif vs B. Arsip Pelunasan
  const [sectionTab, setSectionTab] = useState<'active' | 'archive'>('active');

  // View Mode: Daftar Transaksi vs Riwayat Per Karyawan
  const [viewMode, setViewMode] = useState<'transactions' | 'employees'>('transactions');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
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
  const [payMode, setPayMode] = useState<'full' | 'partial'>('full');
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: getTodayDateString(),
    paymentMethod: 'Tunai',
    notes: '',
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Restore from Archive Modal State
  const [kasbonToRestore, setKasbonToRestore] = useState<KasbonRecord | null>(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoringKasbon, setRestoringKasbon] = useState(false);

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

  const handleOpenPayModal = (kb: KasbonRecord, mode: 'full' | 'partial' = 'full') => {
    if (!isAdmin) return;
    setKasbonToPay(kb);
    setPayMode(mode);
    setPaymentForm({
      amount: String(kb.remainingAmount || 0),
      paymentDate: getTodayDateString(),
      paymentMethod: 'Tunai',
      notes: mode === 'full' ? 'Pelunasan penuh kewajiban kasbon' : '',
    });
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !kasbonToPay) return;

    const payAmount =
      payMode === 'full'
        ? Math.round(Number(kasbonToPay.remainingAmount || 0))
        : Math.round(Number(paymentForm.amount || 0));

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
        notes:
          paymentForm.notes ||
          (payAmount >= kasbonToPay.remainingAmount ? 'Pelunasan kasbon penuh' : 'Cicilan pembayaran kasbon'),
      });

      if (updated.status === 'Lunas') {
        showToast(
          'success',
          `Kasbon ${kasbonToPay.employeeName} (${kasbonToPay.kasbonNumber}) resmi LUNAS sebesar ${formatRupiah(payAmount)} dan dipindahkan ke Arsip Pelunasan.`
        );
      } else {
        showToast(
          'success',
          `Pembayaran kasbon ${kasbonToPay.employeeName} sebesar ${formatRupiah(payAmount)} berhasil dicatat. Sisa kewajiban: ${formatRupiah(updated.remainingAmount)}`
        );
      }

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

  const handleOpenRestoreModal = (kb: KasbonRecord) => {
    if (!isAdmin) return;
    setKasbonToRestore(kb);
    setRestoreReason('');
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !kasbonToRestore) return;
    setRestoringKasbon(true);
    try {
      const updated = await api.restoreKasbon(
        kasbonToRestore.id,
        restoreReason.trim() || 'Dikeluarkan dari Arsip Pelunasan ke daftar Kasbon Aktif oleh Admin'
      );
      showToast(
        'success',
        `Kasbon ${kasbonToRestore.employeeName} (${kasbonToRestore.kasbonNumber}) berhasil dikeluarkan dari Arsip Pelunasan dan dikembalikan ke Kasbon Aktif.`
      );
      setKasbonToRestore(null);
      setRestoreReason('');
      if (detailKasbon && detailKasbon.id === updated.id) {
        setDetailKasbon(updated);
      }
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengeluarkan kasbon dari arsip');
    } finally {
      setRestoringKasbon(false);
    }
  };

  const handleArchiveKasbon = async (kb: KasbonRecord) => {
    if (!isAdmin) return;
    try {
      const updated = await api.archiveKasbon(kb.id);
      showToast('success', `Kasbon ${kb.kasbonNumber} dipindahkan ke Arsip Pelunasan.`);
      if (detailKasbon && detailKasbon.id === updated.id) {
        setDetailKasbon(updated);
      }
      fetchData();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mengarsipkan kasbon');
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

  // Partition Kasbon into A. Kasbon Aktif vs B. Arsip Pelunasan
  const isArchivedRecord = (kb: KasbonRecord) =>
    kb.status === 'Lunas' && kb.isArchived !== false;

  const allActiveKasbons = kasbonList.filter((kb) => !isArchivedRecord(kb));
  const allArchivedKasbons = kasbonList.filter((kb) => isArchivedRecord(kb));

  const baseListForTab = sectionTab === 'archive' ? allArchivedKasbons : allActiveKasbons;

  // Filtered Kasbon List
  const filteredKasbons = baseListForTab.filter((kb) => {
    if (projectFilter !== 'ALL' && kb.projectId !== projectFilter) {
      return false;
    }
    if (roleFilter !== 'ALL') {
      const roleNorm = kb.employeeRole === 'Kenek' ? 'Helper' : kb.employeeRole;
      if (roleNorm !== roleFilter) return false;
    }
    if (employeeFilter !== 'ALL' && kb.employeeId !== employeeFilter) {
      return false;
    }
    if (sectionTab === 'active' && statusFilter !== 'ALL') {
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
      const empObj = employees.find((e) => e.id === kb.employeeId);
      const empNik = (empObj?.nik || '').toLowerCase();
      const matchName = kb.employeeName.toLowerCase().includes(q);
      const matchNum = kb.kasbonNumber.toLowerCase().includes(q);
      const matchReason = (kb.reason || '').toLowerCase().includes(q);
      const matchProj = (kb.projectName || '').toLowerCase().includes(q);
      const matchId = (kb.employeeId || '').toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchReason && !matchProj && !matchId && !empNik.includes(q)) return false;
    }
    return true;
  });

  // Summary Metrics based on active filter (excluding rejected)
  const validKasbons = kasbonList.filter((k) => k.status !== 'Ditolak');
  const lunasCount = allArchivedKasbons.length;
  const belumLunasCount = validKasbons.filter((k) => !isArchivedRecord(k)).length;

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
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Data Kasbon Karyawan</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                {filteredKasbons.length} {sectionTab === 'archive' ? 'Arsip Lunas' : 'Kasbon Aktif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Kelola kewajiban kasbon aktif, konfirmasi pelunasan penuh, dan riwayat arsip pelunasan karyawan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 text-xs mr-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF8FF] text-[#175CD3] font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                {belumLunasCount} Kasbon Aktif
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E1F3EA] text-[#166534] font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                {lunasCount} Arsip Lunas
              </span>
            </div>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('transactions')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewMode === 'transactions'
                    ? 'bg-white text-[#155EEF] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Transaksi ({filteredKasbons.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('employees')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewMode === 'employees'
                    ? 'bg-white text-[#155EEF] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Per Karyawan ({employeeSummaries.length})
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Ajukan Kasbon</span>
              </button>
            )}
          </div>
        </div>

        {/* Two Main Sections Tab Bar: A. KASBON AKTIF vs B. ARSIP PELUNASAN */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSectionTab('active');
                setStatusFilter('ALL');
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                sectionTab === 'active'
                  ? 'bg-white text-[#155EEF] shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>A. Kasbon Aktif</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  sectionTab === 'active'
                    ? 'bg-[#EFF5FF] text-[#155EEF]'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {allActiveKasbons.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSectionTab('archive');
                setStatusFilter('ALL');
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                sectionTab === 'archive'
                  ? 'bg-white text-[#166534] shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>B. Arsip Pelunasan</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  sectionTab === 'archive'
                    ? 'bg-[#E1F3EA] text-[#166534]'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {allArchivedKasbons.length}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            {sectionTab === 'active' ? (
              <span>Menampilkan karyawan yang masih memiliki kewajiban kasbon aktif atau belum diarsipkan.</span>
            ) : (
              <span>Menampilkan arsip kasbon karyawan yang telah dilunasi sepenuhnya beserta riwayat pembayarannya.</span>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, ID, NIK, nomor kasbon, alasan..."
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
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
              >
                <option value="ALL">Semua Jabatan</option>
                <option value="Mandor">Mandor</option>
                <option value="Tukang">Tukang</option>
                <option value="Helper">Helper</option>
                <option value="Driver">Driver</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Proyek:</span>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
              >
                <option value="ALL">Semua Proyek</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {sectionTab === 'active' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="ALL">Semua Status Aktif</option>
                  <option value="BELUM_LUNAS">Belum Lunas</option>
                  <option value="Disetujui">Disetujui (Belum Cicil)</option>
                  <option value="Dipotong sebagian">Dibayar Sebagian</option>
                  <option value="Lunas">Dipulihkan dari Arsip (Lunas)</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>
            )}

            {(searchQuery ||
              projectFilter !== 'ALL' ||
              roleFilter !== 'ALL' ||
              employeeFilter !== 'ALL' ||
              statusFilter !== 'ALL' ||
              startDateFilter ||
              endDateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setProjectFilter('ALL');
                  setRoleFilter('ALL');
                  setEmployeeFilter('ALL');
                  setStatusFilter('ALL');
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="text-xs text-[#2563EB] hover:underline font-medium px-1.5"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Content: Transactions Table or Employee History (Bounded to max 10 visible rows with internal vertical scroll) */}
        {viewMode === 'transactions' ? (
          <div>
            <div className="overflow-x-auto max-h-[680px] overflow-y-auto overscroll-contain">
              <table className="w-full text-left text-xs border-collapse">
                <tbody className="divide-y divide-slate-200/75 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Memuat data kasbon...
                      </td>
                    </tr>
                  ) : filteredKasbons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        {sectionTab === 'archive'
                          ? 'Belum ada data kasbon pada Arsip Pelunasan.'
                          : 'Belum ada data kasbon aktif yang sesuai filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredKasbons.map((kb, idx) => {
                      const projObj = projects.find((p) => p.id === kb.projectId);
                      const empObj = employees.find((e) => e.id === kb.employeeId);
                      const pName = projObj?.location || kb.projectName || projObj?.name || 'Proyek Umum';
                      const roleName = kb.employeeRole === 'Kenek' ? 'Helper' : kb.employeeRole || 'Tukang';
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

                      const hasProof =
                        (kb.attachments && kb.attachments.length > 0) || Boolean(kb.attachmentFilePath);

                      const statusPill =
                        kb.status === 'Lunas'
                          ? {
                              bg: 'bg-[#E1F3EA] text-[#166534]',
                              dot: 'bg-[#15803D]',
                              label: kb.isArchived === false ? 'Lunas (Dipulihkan)' : 'Lunas',
                            }
                          : kb.status === 'Dipotong sebagian'
                          ? {
                              bg: 'bg-[#FEF6EE] text-[#B54708]',
                              dot: 'bg-[#D97706]',
                              label: 'Dibayar Sebagian',
                            }
                          : kb.status === 'Disetujui'
                          ? {
                              bg: 'bg-[#EFF8FF] text-[#175CD3]',
                              dot: 'bg-[#2563EB]',
                              label: 'Belum Lunas',
                            }
                          : kb.status === 'Ditolak'
                          ? {
                              bg: 'bg-[#FEF3F2] text-[#B42318]',
                              dot: 'bg-[#DC2626]',
                              label: 'Ditolak',
                            }
                          : {
                              bg: 'bg-[#F1F5F9] text-[#475569]',
                              dot: 'bg-[#94A3B8]',
                              label: kb.status,
                            };

                      return (
                        <tr key={kb.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* Column 1: Avatar + Name + Subtitle */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-tight shrink-0 ${avatarClass}`}
                              >
                                {getInitials(kb.employeeName)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 text-[13.5px] leading-snug">
                                  {kb.employeeName}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span>{roleName}</span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-slate-500">{kb.employeeId}</span>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-slate-400">
                                    {empObj?.nik ? `NIK: ${empObj.nik}` : kb.kasbonNumber}
                                  </span>
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

                          {/* Column 3: Project Dot + Reason */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0 bg-[#D97706]" />
                              <span className="text-xs font-medium text-slate-700">{pName}</span>
                            </div>
                            <div
                              className="text-[11px] text-slate-400 pl-4 mt-0.5 max-w-[180px] truncate"
                              title={kb.reason}
                            >
                              {kb.reason || '-'}
                            </div>
                          </td>

                          {/* Column 4: Financial Stack */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="text-xs font-medium text-slate-700 font-mono tabular-nums">
                              Pinjaman: {formatRupiah(kb.amount)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                              {sectionTab === 'archive' ? (
                                <span className="text-emerald-700 font-medium">
                                  Total Bayar: {formatRupiah(kb.deductedAmount || kb.amount)} · Sisa: Rp0
                                </span>
                              ) : (
                                <>
                                  Sisa: <span className="font-semibold text-rose-600">{formatRupiah(kb.remainingAmount)}</span>
                                  {kb.deductedAmount > 0 ? ` · Bayar: ${formatRupiah(kb.deductedAmount)}` : ''}
                                </>
                              )}
                            </div>
                          </td>

                          {/* Column 5: Date & Kasbon Number / Paid Off Date */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="text-xs font-medium text-slate-700 tabular-nums">
                              Pinjam: {formatDateID(kb.requestDate)}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                              {sectionTab === 'archive' && kb.paidOffDate
                                ? `Lunas: ${formatDateID(kb.paidOffDate)}`
                                : kb.kasbonNumber}
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
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {hasProof && (
                                <button
                                  type="button"
                                  onClick={() => setViewingProofKasbon(kb)}
                                  className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Lihat Bukti Foto Kasbon"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                              )}

                              {isAdmin && kb.status === 'Menunggu persetujuan' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(kb, 'approve')}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Setujui Kasbon"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(kb, 'reject')}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Tolak Kasbon"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {isAdmin && sectionTab === 'active' && kb.remainingAmount > 0 && kb.status !== 'Ditolak' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayModal(kb, 'full')}
                                    className="px-2.5 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-[11px] font-semibold transition-colors shadow-2xs"
                                    title="Konfirmasi Pelunasan Kasbon"
                                  >
                                    Pelunasan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayModal(kb, 'partial')}
                                    className="px-2.5 py-1 bg-[#EFF8FF] hover:bg-[#D1E9FF] text-[#175CD3] border border-[#B2DDFF] rounded-lg text-[11px] font-semibold transition-colors"
                                    title="Catat Cicilan / Pembayaran Sebagian"
                                  >
                                    Cicil
                                  </button>
                                </>
                              )}

                              {isAdmin && sectionTab === 'active' && kb.status === 'Lunas' && kb.isArchived === false && (
                                <button
                                  type="button"
                                  onClick={() => handleArchiveKasbon(kb)}
                                  className="px-2.5 py-1 bg-[#E1F3EA] hover:bg-[#D1FADF] text-[#166534] border border-[#A6F4C5] rounded-lg text-[11px] font-semibold transition-colors"
                                  title="Pindahkan Kembali ke Arsip Pelunasan"
                                >
                                  Arsipkan
                                </button>
                              )}

                              {isAdmin && sectionTab === 'archive' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRestoreModal(kb)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                                  title="Keluarkan dari Arsip Pelunasan kembali ke Kasbon Aktif"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Keluarkan dari Arsip</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDetailKasbon(kb)}
                                className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors"
                                title="Lihat Detail & Riwayat Pembayaran"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {isAdmin && sectionTab === 'active' && kb.deductedAmount === 0 && (
                                <button
                                  type="button"
                                  onClick={() => setKasbonToDelete(kb)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
            {filteredKasbons.length > 0 && (
              <div className="px-6 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Menampilkan <strong>{Math.min(filteredKasbons.length, 10)}</strong> baris terlihat dari total{' '}
                  <strong>{filteredKasbons.length}</strong> transaksi{' '}
                  {sectionTab === 'archive' ? 'Arsip Pelunasan' : 'Kasbon Aktif'}
                </span>
                {filteredKasbons.length > 10 && (
                  <span className="text-[#2563EB] font-medium">
                    Gunakan scroll vertikal di dalam tabel untuk melihat baris ke-11 dst.
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Riwayat Kasbon Masing-Masing Karyawan (Bounded to max 10 visible rows with internal vertical scroll) */
          <div>
            <div className="divide-y divide-slate-200/75 max-h-[680px] overflow-y-auto overscroll-contain">
              {employeeSummaries.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Belum ada riwayat kasbon karyawan sesuai filter.
                </div>
              ) : (
                employeeSummaries.map((empSum, idx) => {
                  const isExpanded = expandedEmployeeId === empSum.employeeId;
                  const empObj = employees.find((e) => e.id === empSum.employeeId);
                  const roleName = empSum.employeeRole === 'Kenek' ? 'Helper' : empSum.employeeRole || 'Tukang';
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

                  return (
                    <div key={empSum.employeeId} className="bg-white">
                      <div
                        onClick={() => setExpandedEmployeeId(isExpanded ? null : empSum.employeeId)}
                        className="py-4 px-6 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-tight shrink-0 ${avatarClass}`}
                          >
                            {getInitials(empSum.employeeName)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-[13.5px] leading-snug">
                              {empSum.employeeName}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span>{roleName}</span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-slate-500">{empSum.employeeId}</span>
                              {empObj?.nik && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="font-mono text-slate-400">NIK: {empObj.nik}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-xs">
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

                          <div>
                            <div className="text-xs font-medium text-slate-700 font-mono tabular-nums">
                              {formatRupiah(empSum.totalKasbon)}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                              Sisa: {formatRupiah(empSum.totalRemaining)} · Bayar: {formatRupiah(empSum.totalPaid)}
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                              empSum.totalRemaining === 0
                                ? 'bg-[#E1F3EA] text-[#166534]'
                                : 'bg-[#EFF8FF] text-[#175CD3]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                empSum.totalRemaining === 0 ? 'bg-[#15803D]' : 'bg-[#2563EB]'
                              }`}
                            />
                            <span>
                              {empSum.totalRemaining === 0 ? 'Lunas' : `${empSum.records.length} Kasbon`}
                            </span>
                          </span>

                          <ChevronRight
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-6 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100">
                          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80">
                            <table className="w-full text-left text-xs">
                              <tbody className="divide-y divide-slate-200/70">
                                {empSum.records.map((kb) => (
                                  <tr key={kb.id} className="hover:bg-slate-50">
                                    <td className="py-3 px-4 font-mono font-medium text-[#2563EB]">
                                      {kb.kasbonNumber}
                                    </td>
                                    <td className="py-3 px-4 text-slate-500">
                                      Pinjam: {formatDateID(kb.requestDate)}
                                      {kb.paidOffDate ? ` · Lunas: ${formatDateID(kb.paidOffDate)}` : ''}
                                    </td>
                                    <td className="py-3 px-4 text-slate-700">
                                      {kb.projectName || projects.find((p) => p.id === kb.projectId)?.name || '-'}
                                    </td>
                                    <td className="py-3 px-4 text-slate-600">{kb.reason}</td>
                                    <td className="py-3 px-4 text-right font-mono">{formatRupiah(kb.amount)}</td>
                                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                                      {formatRupiah(kb.deductedAmount || 0)}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                                      {formatRupiah(kb.remainingAmount)}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <div className="inline-flex items-center gap-1.5">
                                        {isAdmin && sectionTab === 'active' && kb.remainingAmount > 0 && kb.status !== 'Ditolak' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPayModal(kb, 'full')}
                                              className="px-2.5 py-1 bg-[#16A34A] text-white rounded-lg text-[11px] font-semibold"
                                            >
                                              Pelunasan
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPayModal(kb, 'partial')}
                                              className="px-2.5 py-1 bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF] rounded-lg text-[11px] font-semibold"
                                            >
                                              Cicil
                                            </button>
                                          </>
                                        )}
                                        {isAdmin && sectionTab === 'archive' && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenRestoreModal(kb)}
                                            className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold"
                                          >
                                            Keluarkan dari Arsip
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setDetailKasbon(kb)}
                                          className="px-2.5 py-1 bg-white text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold"
                                        >
                                          Detail
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {employeeSummaries.length > 0 && (
              <div className="px-6 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Menampilkan maksimal <strong>10</strong> karyawan terlihat sekaligus dari{' '}
                  <strong>{employeeSummaries.length}</strong> karyawan
                </span>
                {employeeSummaries.length > 10 && (
                  <span className="text-[#2563EB] font-medium">
                    Scroll daftar ke bawah untuk melihat karyawan ke-11 dst.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: INPUT PENGAJUAN KASBON BARU */}
      {isAdmin && isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in">
          <div className="glass-modal kms-modal-md bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[600px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#155EEF] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Input Pengajuan Kasbon Karyawan</h3>
                  <p className="text-[11px] text-slate-500">Pilih proyek, karyawan, nominal, alasan, dan bukti pendukung</p>
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

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
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
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
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

      {/* MODAL 2: KONFIRMASI PELUNASAN / CICILAN KASBON */}
      {isAdmin && kasbonToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in">
          <div className="glass-modal kms-modal-sm bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[440px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-[#027A48] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {payMode === 'full' ? 'Konfirmasi Pelunasan Kasbon' : 'Catat Pembayaran Cicilan Kasbon'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
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

            <form onSubmit={handlePaySubmit} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                {/* Mode Toggle: Pelunasan Penuh vs Pembayaran Sebagian */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setPayMode('full');
                      setPaymentForm({
                        ...paymentForm,
                        amount: String(kasbonToPay.remainingAmount),
                      });
                    }}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      payMode === 'full'
                        ? 'bg-white text-[#027A48] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pelunasan Penuh (LUNAS)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayMode('partial');
                      setPaymentForm({
                        ...paymentForm,
                        amount: String(Math.round(kasbonToPay.remainingAmount / 2)),
                      });
                    }}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      payMode === 'partial'
                        ? 'bg-white text-[#155EEF] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cicilan / Sebagian
                  </button>
                </div>

                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Nama Karyawan:</span>
                    <span className="font-semibold text-[#1D2939]">{kasbonToPay.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Total Pinjaman Kasbon:</span>
                    <span className="font-mono font-semibold text-[#1D2939]">{formatRupiah(kasbonToPay.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Sudah Dibayar Sebelumnya:</span>
                    <span className="font-mono font-semibold text-[#027A48]">
                      {formatRupiah(kasbonToPay.deductedAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-[#EAECF0]">
                    <span className="font-semibold text-[#344054]">Sisa Kewajiban Kasbon:</span>
                    <span className="font-mono font-bold text-sm text-[#B42318]">
                      {formatRupiah(kasbonToPay.remainingAmount)}
                    </span>
                  </div>
                </div>

                {payMode === 'full' ? (
                  <div className="p-3.5 bg-[#ECFDF3] border border-[#A6F4C5] rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#027A48]">Nominal Pelunasan:</span>
                      <span className="font-mono font-bold text-sm text-[#027A48]">
                        {formatRupiah(kasbonToPay.remainingAmount)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#027A48]/90 leading-relaxed">
                      Setelah dikonfirmasi, status kasbon akan diubah menjadi <strong>LUNAS</strong>, tanggal pelunasan disimpan, dan data otomatis dipindahkan dari <strong>Kasbon Aktif</strong> ke <strong>Arsip Pelunasan</strong>.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-semibold text-[#344054]">
                        Nominal Pembayaran (Rp) <span className="text-[#D92D20]">*</span>
                      </label>
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
                        50% ({formatRupiah(Math.round(kasbonToPay.remainingAmount / 2))})
                      </button>
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
                    <p className="text-[11px] text-slate-500 mt-1">
                      Jika membayar sebagian, status tetap <strong>Belum Lunas (Dibayar Sebagian)</strong> dan tetap berada pada daftar <strong>Kasbon Aktif</strong>.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1.5">Tanggal Pelunasan / Bayar *</label>
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
                      <option value="Potong Gaji">Potong Gaji</option>
                      <option value="E-Wallet">E-Wallet</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">Catatan Pelunasan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pelunasan penuh kasbon atau cicilan ke-1..."
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939]"
                  />
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
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
                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {submittingPayment
                    ? 'Memproses...'
                    : payMode === 'full'
                    ? 'Konfirmasi Pelunasan (Lunas)'
                    : 'Simpan Cicilan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2B: KONFIRMASI KELUARKAN DARI ARSIP PELUNASAN */}
      {isAdmin && kasbonToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in">
          <div className="glass-modal kms-modal-sm bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[440px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-amber-50 border-b border-amber-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">Keluarkan dari Arsip Pelunasan?</h3>
                  <p className="text-[11px] text-amber-700">
                    {kasbonToRestore.kasbonNumber} · {kasbonToRestore.employeeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKasbonToRestore(null)}
                disabled={restoringKasbon}
                className="p-1 text-amber-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRestore} className="flex flex-col flex-1 overflow-hidden text-xs">
              <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                <p className="text-slate-700 leading-relaxed">
                  Apakah Anda yakin ingin mengeluarkan data kasbon{' '}
                  <strong>{kasbonToRestore.employeeName}</strong> dari <strong>Arsip Pelunasan</strong> dan mengembalikannya ke daftar <strong>Kasbon Aktif</strong>?
                </p>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Pinjaman:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatRupiah(kasbonToRestore.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Riwayat Pembayaran:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {formatRupiah(kasbonToRestore.deductedAmount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tanggal Pelunasan:</span>
                    <span className="font-semibold text-slate-700">
                      {kasbonToRestore.paidOffDate ? formatDateID(kasbonToRestore.paidOffDate) : '-'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-slate-700">
                  Seluruh riwayat pembayaran sebelumnya tetap tersimpan utuh dan tidak dihapus. Aktivitas pemulihan ini juga akan tercatat pada log sistem.
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Alasan / Catatan Pemulihan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Koreksi administrasi atau peninjauan ulang..."
                    value={restoreReason}
                    onChange={(e) => setRestoreReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setKasbonToRestore(null)}
                  disabled={restoringKasbon}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={restoringKasbon}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {restoringKasbon ? 'Memproses...' : 'Ya, Keluarkan dari Arsip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DETAIL & RIWAYAT PEMBAYARAN KASBON */}
      {detailKasbon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in">
          <div className="glass-modal kms-modal-md bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[600px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#155EEF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {detailKasbon.kasbonNumber}
                  </span>
                  <h3 className="text-base font-bold text-slate-800">{detailKasbon.employeeName}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
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

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Total Pinjaman Kasbon</span>
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
                  <span className="text-[#B42318] block">Sisa Kewajiban</span>
                  <span className="text-base font-bold font-mono text-[#B42318] mt-0.5 block">
                    {formatRupiah(detailKasbon.remainingAmount)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#EAECF0] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Tanggal Pinjaman:</span>
                  <span className="font-semibold text-[#1D2939]">{formatDateID(detailKasbon.requestDate)}</span>
                </div>
                {detailKasbon.paidOffDate && (
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Tanggal Pelunasan:</span>
                    <span className="font-semibold text-[#027A48]">{formatDateID(detailKasbon.paidOffDate)}</span>
                  </div>
                )}
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
                  <h4 className="font-bold text-[#1D2939]">Riwayat Pembayaran Lengkap</h4>
                  <div className="flex items-center gap-1.5">
                    {isAdmin && detailKasbon.remainingAmount > 0 && detailKasbon.status !== 'Ditolak' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenPayModal(detailKasbon, 'full')}
                          className="px-2.5 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-[11px] font-semibold"
                        >
                          Pelunasan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPayModal(detailKasbon, 'partial')}
                          className="px-2.5 py-1 bg-[#EFF8FF] hover:bg-[#D1E9FF] text-[#175CD3] border border-[#B2DDFF] rounded-lg text-[11px] font-semibold"
                        >
                          + Catat Cicilan
                        </button>
                      </>
                    )}
                    {isAdmin && isArchivedRecord(detailKasbon) && (
                      <button
                        type="button"
                        onClick={() => handleOpenRestoreModal(detailKasbon)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Keluarkan dari Arsip</span>
                      </button>
                    )}
                  </div>
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

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in">
          <div className="glass-modal kms-modal-sm bg-white border border-slate-200 shadow-xl rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[420px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-rose-50 border-b border-rose-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 text-[#D92D20] flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-800">Hapus Data Kasbon?</h3>
                  <p className="text-[11px] text-rose-600">{kasbonToDelete.kasbonNumber}</p>
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

            <div className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto flex-1">
              <p className="text-[#344054]">
                Anda yakin ingin menghapus pengajuan kasbon <strong>{kasbonToDelete.employeeName}</strong> sebesar{' '}
                <strong className="font-mono">{formatRupiah(kasbonToDelete.amount)}</strong>?
              </p>
            </div>

            <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
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
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-[2px]">
            <div className="bg-[#0F172A] rounded-2xl w-[calc(100%-24px)] sm:w-full max-w-[800px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85vh]">
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
