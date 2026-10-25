import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt,
  User,
  UserCheck,
  Plus,
  Fuel,
  Cigarette,
  Navigation,
  Utensils,
  Search,
  Filter,
  Trash2,
  Pencil,
  Calendar,
  DollarSign,
  Layers,
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { OperationalExpense, OperationalExpenseAttachment } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

interface ExpensesPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onDataChanged: () => void;
}

interface NewPhotoItem {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  dataBase64: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ showToast, onDataChanged }) => {
  const { user, token, isAdmin, isOwner } = useAuth();
  const { settings } = useCompany();

  const [expenses, setExpenses] = useState<OperationalExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab: 'owner' | 'asisten' | 'all'
  const [activeTab, setActiveTab] = useState<'owner' | 'asisten' | 'all'>('owner');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OperationalExpense | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: getTodayDateString(),
    personType: 'Owner' as 'Owner' | 'Asisten',
    personName: '',
    category: 'Bensin' as OperationalExpense['category'],
    description: '',
    amount: 100000,
    paymentMethod: 'Tunai' as OperationalExpense['paymentMethod'],
    notes: '',
  });

  // Attached photos states for the form
  const [newPhotos, setNewPhotos] = useState<NewPhotoItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<OperationalExpenseAttachment[]>([]);
  const [attachmentsToKeep, setAttachmentsToKeep] = useState<string[]>([]);

  // Hidden file input references
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Proof Viewer Modal (Interactive Lightbox)
  const [viewingProofExpense, setViewingProofExpense] = useState<OperationalExpense | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // Reset photo states whenever lightbox opens or active photo changes
  useEffect(() => {
    if (viewingProofExpense) {
      setPhotoLoading(true);
      setPhotoError(false);
    }
  }, [viewingProofExpense, activePhotoIndex]);

  // Helper to generate authenticated view URL for img tags and downloads
  const getPhotoViewUrl = (attachmentId: string, download: boolean = false) => {
    const params = new URLSearchParams();
    const storedToken = token || localStorage.getItem('kms_token');
    if (storedToken) {
      params.set('token', storedToken);
    }

    // Role & user name fallback query params for seamless session pass-through
    const role = user?.role || (isAdmin ? 'admin' : isOwner ? 'owner' : 'admin');
    const name = user?.name || (role === 'admin' ? 'Administrator Proyek' : 'Owner');
    params.set('role', role);
    params.set('userName', name);

    if (download) {
      params.set('download', 'true');
    }

    const qs = params.toString();
    return `/api/expenses/attachments/${attachmentId}/view${qs ? `?${qs}` : ''}`;
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await api.getExpenses();
      setExpenses(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Open Modal for Create
  const openCreateModal = (type: 'Owner' | 'Asisten') => {
    setEditingExpense(null);
    setForm({
      date: getTodayDateString(),
      personType: type,
      personName: type === 'Owner' ? settings?.ownerName || 'Bpk. Bambang' : settings?.assistantName || 'Ahmad Fauzi',
      category: 'Bensin',
      description: '',
      amount: 100000,
      paymentMethod: 'Tunai',
      notes: '',
    });
    setNewPhotos([]);
    setExistingAttachments([]);
    setAttachmentsToKeep([]);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const openEditModal = (expense: OperationalExpense) => {
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang memiliki akses untuk mengubah data pengeluaran.');
      return;
    }
    setEditingExpense(expense);
    setForm({
      date: expense.date,
      personType: expense.personType,
      personName: expense.personName,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes || '',
    });
    const existing = expense.attachments || [];
    setExistingAttachments(existing);
    setAttachmentsToKeep(existing.map((a) => a.id));
    setNewPhotos([]);
    setIsModalOpen(true);
  };

  // Handle file selections from Camera or Gallery
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validAdditions: NewPhotoItem[] = [];

    fileArray.forEach((file) => {
      // 1. Validate File Size <= 5MB
      if (file.size > MAX_FILE_SIZE) {
        showToast(
          'error',
          `Ukuran file '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 5 MB.`
        );
        return;
      }

      // 2. Validate MIME Type
      const mime = file.type.toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mime)) {
        showToast(
          'error',
          `Format file '${file.name}' tidak didukung. Harap gunakan format JPG, JPEG, PNG, atau WebP.`
        );
        return;
      }

      // 3. Read as Data URL for preview & backend transmission
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setNewPhotos((prev) => [
            ...prev,
            {
              id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              fileName: file.name,
              mimeType: file.type || 'image/jpeg',
              size: file.size,
              previewUrl: result,
              dataBase64: result,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input elements so the same file can be re-selected if deleted
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removeNewPhoto = (id: string) => {
    setNewPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const removeExistingAttachment = (attachmentId: string) => {
    setAttachmentsToKeep((prev) => prev.filter((id) => id !== attachmentId));
  };

  // Save Transaction (Add or Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) {
      showToast('error', 'Keterangan pengeluaran wajib diisi.');
      return;
    }
    if (form.amount <= 0) {
      showToast('error', 'Nominal pengeluaran harus lebih besar dari 0.');
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        // Edit Mode
        const payload = {
          date: form.date,
          personType: form.personType,
          personName: form.personName || (form.personType === 'Owner' ? settings?.ownerName || 'Owner' : settings?.assistantName || 'Asisten'),
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          notes: form.notes,
          attachmentsToKeep,
          newAttachments: newPhotos.map((p) => ({
            fileName: p.fileName,
            mimeType: p.mimeType,
            dataBase64: p.dataBase64,
          })),
        };

        await api.updateExpense(editingExpense.id, payload);
        showToast('success', `Pengeluaran ${editingExpense.transactionNumber} (${form.personType}) berhasil diperbarui.`);
      } else {
        // Create Mode
        const payload = {
          date: form.date,
          personType: form.personType,
          personName: form.personName || (form.personType === 'Owner' ? settings?.ownerName || 'Owner' : settings?.assistantName || 'Asisten'),
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          notes: form.notes,
          attachments: newPhotos.map((p) => ({
            fileName: p.fileName,
            mimeType: p.mimeType,
            dataBase64: p.dataBase64,
          })),
        };

        const created = await api.createExpense(payload);
        const count = created.attachments?.length || newPhotos.length;
        showToast(
          'success',
          `Pengeluaran ${form.personType} (${form.category}) berhasil dicatat${count > 0 ? ` dengan ${count} foto bukti tersimpan` : ''}.`
        );
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      setNewPhotos([]);
      fetchExpenses();
      onDataChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan transaksi pengeluaran');
    } finally {
      setSaving(false);
    }
  };

  // Delete Transaction
  const handleDelete = async (id: string, num: string) => {
    if (!isAdmin) {
      showToast('error', 'Hanya Administrator yang berhak menghapus data pengeluaran.');
      return;
    }

    if (window.confirm(`Yakin ingin menghapus transaksi ${num}? Seluruh data dan foto bukti terkait akan dihapus secara permanen.`)) {
      try {
        await api.deleteExpense(id);
        showToast('info', `Transaksi ${num} berhasil dihapus.`);
        fetchExpenses();
        onDataChanged();
      } catch (err: any) {
        showToast('error', err.message || 'Gagal menghapus data pengeluaran');
      }
    }
  };

  // Open Proof Lightbox Viewer
  const openProofViewer = (expense: OperationalExpense) => {
    if (!expense.attachments || expense.attachments.length === 0) {
      showToast('info', 'Transaksi ini tidak memiliki foto bukti lampiran.');
      return;
    }
    setViewingProofExpense(expense);
    setActivePhotoIndex(0);
    setIsZoomed(false);
  };

  // Format bytes for UI
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Filter calculations
  const tabFiltered = expenses.filter((e) => {
    if (activeTab === 'owner') return e.personType === 'Owner';
    if (activeTab === 'asisten') return e.personType === 'Asisten';
    return true;
  });

  const finalFiltered = tabFiltered.filter((e) => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.transactionNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.personName.toLowerCase().includes(search.toLowerCase());
    const matchesStart = !startDate || e.date >= startDate;
    const matchesEnd = !endDate || e.date <= endDate;
    return matchesCategory && matchesSearch && matchesStart && matchesEnd;
  });

  // Strict distinct summaries for Owner & Asisten
  const ownerExpenses = expenses.filter((e) => e.personType === 'Owner');
  const asistenExpenses = expenses.filter((e) => e.personType === 'Asisten');

  const ownerBensin = ownerExpenses.filter((e) => e.category === 'Bensin').reduce((s, e) => s + e.amount, 0);
  const ownerRokok = ownerExpenses.filter((e) => e.category === 'Rokok').reduce((s, e) => s + e.amount, 0);
  const ownerEToll = ownerExpenses.filter((e) => e.category === 'E-Toll').reduce((s, e) => s + e.amount, 0);
  const ownerMakan = ownerExpenses.filter((e) => e.category === 'Makan').reduce((s, e) => s + e.amount, 0);
  const totalOwner = ownerBensin + ownerRokok + ownerEToll + ownerMakan;

  const asistenBensin = asistenExpenses.filter((e) => e.category === 'Bensin').reduce((s, e) => s + e.amount, 0);
  const asistenRokok = asistenExpenses.filter((e) => e.category === 'Rokok').reduce((s, e) => s + e.amount, 0);
  const asistenEToll = asistenExpenses.filter((e) => e.category === 'E-Toll').reduce((s, e) => s + e.amount, 0);
  const asistenMakan = asistenExpenses.filter((e) => e.category === 'Makan').reduce((s, e) => s + e.amount, 0);
  const totalAsisten = asistenBensin + asistenRokok + asistenEToll + asistenMakan;

  // Currently viewing photo in lightbox
  const currentViewingPhoto =
    viewingProofExpense?.attachments && viewingProofExpense.attachments.length > 0
      ? viewingProofExpense.attachments[activePhotoIndex]
      : null;

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
              Bensin, Rokok, E-Toll, Makan
            </span>
            <span className="text-[#D0D5DD]">·</span>
            <span className="text-[10px] bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Supabase Storage Private
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Biaya Operasional Owner & Asisten
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Pencatatan pengeluaran harian lengkap dengan unggah foto struk bensin, tiket e-toll, kuitansi, dan bukti pembayaran yang tersimpan aman di Supabase.
          </p>
        </div>

        {/* Quick Add Buttons */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => openCreateModal('Owner')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <User className="w-4 h-4" />
              <span>+ Biaya Owner</span>
            </button>
            <button
              onClick={() => openCreateModal('Asisten')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-semibold rounded-lg border border-[#D0D5DD] shadow-xs transition-colors"
            >
              <UserCheck className="w-4 h-4 text-[#4693FD]" />
              <span>+ Biaya Asisten</span>
            </button>
          </div>
        )}
      </div>

      {/* Two Dedicated Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REKAP OWNER */}
        <div
          className={`p-6 rounded-xl border transition-all ${
            activeTab === 'owner'
              ? 'bg-white border-2 border-[#4693FD] shadow-xs'
              : 'bg-white border-[#EAECF0] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-[#EAECF0]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center font-semibold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-[#262626] text-xs uppercase tracking-wider">REKAP PENGELUARAN OWNER</h3>
                <p className="text-xs text-[#667085]">{settings?.ownerName || 'Bpk. Bambang'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#667085] uppercase">Total Pengeluaran</span>
              <p className="text-xl font-semibold text-[#262626] tabular-nums">{formatRupiah(totalOwner)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-[#D99A23]" /> Bensin
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(ownerBensin)}</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Cigarette className="w-3.5 h-3.5 text-[#D64545]" /> Rokok
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(ownerRokok)}</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-[#4693FD]" /> E-Toll
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(ownerEToll)}</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Utensils className="w-3.5 h-3.5 text-[#16A36A]" /> Makan
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(ownerMakan)}</p>
            </div>
          </div>
        </div>

        {/* REKAP ASISTEN */}
        <div
          className={`p-6 rounded-xl border transition-all ${
            activeTab === 'asisten'
              ? 'bg-white border-2 border-[#4693FD] shadow-xs'
              : 'bg-white border-[#EAECF0] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-[#EAECF0]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center font-semibold">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-[#262626] text-xs uppercase tracking-wider">REKAP PENGELUARAN ASISTEN</h3>
                <p className="text-xs text-[#667085]">{settings?.assistantName || 'Ahmad Fauzi'}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#667085] uppercase">Total Pengeluaran</span>
              <p className="text-xl font-semibold text-[#262626] tabular-nums">{formatRupiah(totalAsisten)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-[#D99A23]" /> Bensin
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(asistenBensin)}</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Cigarette className="w-3.5 h-3.5 text-[#D64545]" /> Rokok
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(asistenRokok)}</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-[#4693FD]" /> E-Toll
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(asistenEToll)}</p>
            </div>
            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0]">
              <span className="text-[11px] font-medium text-[#667085] flex items-center gap-1">
                <Utensils className="w-3.5 h-3.5 text-[#16A36A]" /> Makan
              </span>
              <p className="text-sm font-semibold text-[#262626] mt-1 tabular-nums">{formatRupiah(asistenMakan)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAECF0]">
          {/* Tabs */}
          <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0]">
            <button
              onClick={() => setActiveTab('owner')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                activeTab === 'owner' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Pengeluaran Owner ({ownerExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('asisten')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                activeTab === 'asisten' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Pengeluaran Asisten ({asistenExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                activeTab === 'all' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Semua Pengeluaran ({expenses.length})
            </button>
          </div>

          {/* Quick Date Range */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#667085] font-medium">Rentang:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
            />
            <span className="text-[#667085]">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari transaksi atau keterangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            {['all', 'Bensin', 'Rokok', 'E-Toll', 'Makan'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md font-medium text-xs border transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[#EFF5FF] text-[#4693FD] border-[#4693FD]'
                    : 'bg-white text-[#667085] border-[#D0D5DD] hover:bg-[#F9FAFB]'
                }`}
              >
                {cat === 'all' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] font-semibold border-b border-[#EAECF0]">
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Personil</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Kategori Biaya</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 font-mono">Nominal</th>
                <th className="py-3 px-4">Metode Bayar</th>
                <th className="py-3 px-4 text-center">Foto Bukti</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#667085]">
                    Memuat data pengeluaran operasional...
                  </td>
                </tr>
              ) : finalFiltered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#667085]">
                    Belum ada catatan pengeluaran operasional sesuai filter.
                  </td>
                </tr>
              ) : (
                finalFiltered.map((exp) => {
                  const hasPhotos = exp.attachments && exp.attachments.length > 0;
                  const photoCount = exp.attachments ? exp.attachments.length : 0;

                  return (
                    <tr key={exp.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[#262626] whitespace-nowrap">
                        {exp.transactionNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                        {formatDateID(exp.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            exp.personType === 'Owner'
                              ? 'bg-[#EFF5FF] text-[#4693FD]'
                              : 'bg-[#FEF7EC] text-[#D99A23]'
                          }`}
                        >
                          {exp.personType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">{exp.personName}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-[#344054]">{exp.category}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[#262626]" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#262626] whitespace-nowrap tabular-nums">
                        {formatRupiah(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-[#667085] whitespace-nowrap">{exp.paymentMethod}</td>
                      {/* Foto Bukti Column */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {hasPhotos ? (
                          <button
                            onClick={() => openProofViewer(exp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EFF8FF] hover:bg-[#D1E9FF] text-[#175CD3] border border-[#B2DDFF] rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            title="Buka pratinjau foto bukti pengeluaran"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-[#175CD3]" />
                            <span>Lihat Bukti ({photoCount})</span>
                          </button>
                        ) : (
                          <span className="text-[#98A2B3] text-[11px] italic">Tanpa foto</span>
                        )}
                      </td>
                      {/* Action Column */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(exp)}
                              className="p-1.5 text-[#344054] hover:text-[#4693FD] hover:bg-[#F2F4F7] rounded-lg transition-colors"
                              title="Edit transaksi & foto bukti"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id, exp.transactionNumber)}
                              className="p-1.5 text-[#98A2B3] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded-lg transition-colors"
                              title="Hapus transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#98A2B3] text-[11px]">Read-only</span>
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

      {/* Hidden File Inputs for Camera and Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-[#EAECF0] overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-sm">
                  {editingExpense
                    ? `Edit Pengeluaran: ${editingExpense.transactionNumber}`
                    : `Catat Pengeluaran Operasional ${form.personType}`}
                </h3>
                <p className="text-[11px] text-[#667085]">
                  {editingExpense
                    ? 'Perbarui rincian transaksi atau foto bukti'
                    : 'Pencatatan biaya harian proyek lengkap dengan bukti'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Penerima & Nama */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Penerima Biaya *</label>
                  <select
                    value={form.personType}
                    onChange={(e) => {
                      const t = e.target.value as 'Owner' | 'Asisten';
                      setForm({
                        ...form,
                        personType: t,
                        personName: t === 'Owner' ? settings?.ownerName || 'Bpk. Bambang' : settings?.assistantName || 'Ahmad Fauzi',
                      });
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Asisten">Asisten</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#344054] mb-1">Nama Personil *</label>
                  <input
                    type="text"
                    required
                    value={form.personName}
                    onChange={(e) => setForm({ ...form, personName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              {/* Tanggal & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#344054] mb-1">Kategori Pengeluaran *</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as OperationalExpense['category'],
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="Bensin">Bensin</option>
                    <option value="Rokok">Rokok</option>
                    <option value="E-Toll">E-Toll</option>
                    <option value="Makan">Makan</option>
                  </select>
                </div>
              </div>

              {/* Nominal & Metode Bayar */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Nominal (IDR) *</label>
                  <input
                    type="number"
                    step={1000}
                    min={1000}
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#344054] mb-1">Metode Bayar *</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentMethod: e.target.value as OperationalExpense['paymentMethod'],
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="E-Wallet">E-Wallet</option>
                    <option value="Flazz / TapCash">Flazz / TapCash</option>
                  </select>
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-medium text-[#344054] mb-1">Keterangan Biaya *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Isi bensin mobil operasional proyek pikap..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block font-medium text-[#344054] mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan struk, nomor gerbang toll, atau lokasi..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              {/* SECTION: FOTO BUKTI PENGELUARAN */}
              <div className="pt-2 border-t border-[#EAECF0] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-semibold text-[#101828] text-xs">
                      Foto Bukti Pengeluaran
                    </label>
                    <p className="text-[11px] text-[#667085]">
                      Struk bensin, struk makan, kuitansi, atau e-toll (Opsional, maks. 5 MB/foto)
                    </p>
                  </div>
                  <span className="text-[10px] bg-[#F2F4F7] text-[#475467] px-2 py-0.5 rounded font-mono font-medium">
                    JPG, PNG, WebP
                  </span>
                </div>

                {/* Upload Buttons: Camera & Device Gallery */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#F8F9FC] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg font-medium text-xs transition-colors"
                  >
                    <Camera className="w-4 h-4 text-[#4693FD]" />
                    <span>Ambil Kamera HP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#F8F9FC] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg font-medium text-xs transition-colors"
                  >
                    <Upload className="w-4 h-4 text-[#16A36A]" />
                    <span>Pilih dari Galeri</span>
                  </button>
                </div>

                {/* Existing Attachments in Edit Mode */}
                {editingExpense && existingAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-[#344054] text-[11px]">
                      Foto Tersimpan Saat Ini ({attachmentsToKeep.length} aktif):
                    </p>
                    <div className="space-y-1.5">
                      {existingAttachments.map((att) => {
                        const isKept = attachmentsToKeep.includes(att.id);
                        return (
                          <div
                            key={att.id}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                              isKept
                                ? 'bg-white border-[#EAECF0]'
                                : 'bg-[#FEF3F2] border-[#FECDCA] opacity-60 line-through'
                            }`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={getPhotoViewUrl(att.id)}
                                alt={att.fileName}
                                className="w-9 h-9 object-cover rounded border border-[#EAECF0] shrink-0"
                                onError={(e) => {
                                  (e.target as any).style.display = 'none';
                                }}
                              />
                              <div className="overflow-hidden">
                                <p className="font-medium text-[#101828] truncate text-[11px]">{att.fileName}</p>
                                <p className="text-[10px] text-[#667085]">{formatFileSize(att.fileSize)}</p>
                              </div>
                            </div>
                            {isKept ? (
                              <button
                                type="button"
                                onClick={() => removeExistingAttachment(att.id)}
                                className="p-1 text-[#98A2B3] hover:text-[#D64545] rounded hover:bg-[#FEE4E2] transition-colors"
                                title="Hapus foto ini saat menyimpan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAttachmentsToKeep((prev) => [...prev, att.id])}
                                className="text-[11px] text-[#4693FD] hover:underline font-medium"
                              >
                                Batal Hapus
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Previews of Newly Selected Photos */}
                {newPhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-[#344054] text-[11px]">
                      Foto Baru yang Akan Disimpan ({newPhotos.length}):
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {newPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative group p-2 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] flex items-center gap-2 overflow-hidden"
                        >
                          <img
                            src={photo.previewUrl}
                            alt={photo.fileName}
                            className="w-10 h-10 object-cover rounded border border-[#D0D5DD] shrink-0"
                          />
                          <div className="overflow-hidden pr-5">
                            <p className="font-medium text-[#101828] truncate text-[11px]">{photo.fileName}</p>
                            <p className="text-[10px] text-[#667085]">{formatFileSize(photo.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeNewPhoto(photo.id)}
                            className="absolute top-1.5 right-1.5 p-1 bg-white hover:bg-[#FEE4E2] text-[#667085] hover:text-[#D64545] rounded-full border border-[#D0D5DD] shadow-2xs transition-colors"
                            title="Batal lampirkan foto ini"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] disabled:opacity-50 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {saving ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <span>{editingExpense ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proof Lightbox Viewer Modal */}
      {viewingProofExpense && viewingProofExpense.attachments && viewingProofExpense.attachments.length > 0 && currentViewingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-[#EAECF0] overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-3.5 bg-white border-b border-[#EAECF0] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EFF8FF] text-[#175CD3] flex items-center justify-center font-bold">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#101828]">
                    Bukti Pengeluaran: {viewingProofExpense.transactionNumber}
                  </h3>
                  <p className="text-[11px] text-[#667085]">
                    {viewingProofExpense.personType} ({viewingProofExpense.personName}) · {viewingProofExpense.category} · {formatRupiah(viewingProofExpense.amount)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-[#475467] bg-[#F2F4F7] px-2.5 py-1 rounded-md">
                  Foto {activePhotoIndex + 1} dari {viewingProofExpense.attachments.length}
                </span>
                <button
                  onClick={() => setViewingProofExpense(null)}
                  className="p-1.5 text-[#667085] hover:text-[#101828] hover:bg-[#F2F4F7] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Photo Viewer Canvas */}
            <div className="relative bg-[#0F172A] flex-1 flex items-center justify-center min-h-[360px] max-h-[58vh] overflow-hidden select-none">
              {photoLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 z-10 pointer-events-none">
                  <Loader2 className="w-8 h-8 animate-spin text-[#4693FD]" />
                  <span className="text-xs">Memuat foto bukti...</span>
                </div>
              )}
              {photoError ? (
                <div className="flex flex-col items-center justify-center text-center p-6 text-white max-w-sm z-10">
                  <AlertCircle className="w-10 h-10 text-[#FDA29B] mb-2" />
                  <p className="font-medium text-sm text-[#FEE4E2]">Gagal Menampilkan Pratinjau</p>
                  <p className="text-xs text-[#98A2B3] mt-1 mb-4">
                    Gambar tidak dapat dimuat langsung di browser. Anda dapat mencoba memuat ulang atau langsung mengunduh file ini.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoLoading(true);
                        setPhotoError(false);
                      }}
                      className="px-3 py-1.5 bg-[#1D2939] hover:bg-[#344054] text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors border border-white/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Coba Lagi
                    </button>
                    <a
                      href={getPhotoViewUrl(currentViewingPhoto.id, true)}
                      download={currentViewingPhoto.fileName}
                      className="px-3 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh Foto
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  key={currentViewingPhoto.id}
                  src={getPhotoViewUrl(currentViewingPhoto.id)}
                  alt={currentViewingPhoto.fileName}
                  className={`max-w-full max-h-[56vh] object-contain transition-transform duration-200 ${
                    photoLoading ? 'opacity-0' : 'opacity-100'
                  } ${isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'}`}
                  onLoad={() => setPhotoLoading(false)}
                  onError={() => {
                    setPhotoLoading(false);
                    setPhotoError(true);
                  }}
                  onClick={() => setIsZoomed(!isZoomed)}
                />
              )}

              {/* Prev Button */}
              {viewingProofExpense.attachments.length > 1 && (
                <button
                  onClick={() => {
                    setIsZoomed(false);
                    setActivePhotoIndex((prev) =>
                      prev > 0 ? prev - 1 : viewingProofExpense.attachments!.length - 1
                    );
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-[#0F172A]/70 hover:bg-[#0F172A] text-white rounded-full backdrop-blur-xs transition-colors"
                  title="Foto sebelumnya"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Next Button */}
              {viewingProofExpense.attachments.length > 1 && (
                <button
                  onClick={() => {
                    setIsZoomed(false);
                    setActivePhotoIndex((prev) =>
                      prev < viewingProofExpense.attachments!.length - 1 ? prev + 1 : 0
                    );
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#0F172A]/70 hover:bg-[#0F172A] text-white rounded-full backdrop-blur-xs transition-colors"
                  title="Foto berikutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Thumbnails Strip if multiple photos */}
            {viewingProofExpense.attachments.length > 1 && (
              <div className="px-6 py-2.5 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center gap-2 overflow-x-auto shrink-0">
                {viewingProofExpense.attachments.map((att, idx) => (
                  <button
                    key={att.id}
                    onClick={() => {
                      setIsZoomed(false);
                      setActivePhotoIndex(idx);
                    }}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                      activePhotoIndex === idx
                        ? 'border-[#4693FD] ring-2 ring-[#4693FD]/20'
                        : 'border-[#D0D5DD] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getPhotoViewUrl(att.id)}
                      alt={att.fileName}
                      className="w-12 h-12 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Footer / Metadata */}
            <div className="px-6 py-3 bg-white border-t border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-3 text-[#667085]">
                <span className="font-medium text-[#101828]">{currentViewingPhoto.fileName}</span>
                <span>·</span>
                <span>{formatFileSize(currentViewingPhoto.fileSize)}</span>
                <span>·</span>
                <span>{currentViewingPhoto.mimeType}</span>
                {currentViewingPhoto.uploadedBy && (
                  <>
                    <span>·</span>
                    <span>Diunggah oleh: {currentViewingPhoto.uploadedBy}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F8F9FC] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg text-xs font-medium transition-colors"
                >
                  {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                  <span>{isZoomed ? 'Perkecil' : 'Perbesar'}</span>
                </button>

                <a
                  href={getPhotoViewUrl(currentViewingPhoto.id, true)}
                  download={currentViewingPhoto.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Foto</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
