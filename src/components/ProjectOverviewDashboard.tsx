import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Building,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  CalendarCheck,
  Clock,
  Wallet,
  Truck,
  Receipt,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Trash2,
  Edit2,
  Upload,
  Download,
  Image as ImageIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  HardHat,
  FileText,
  Phone,
  Layers,
  X,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Printer,
} from 'lucide-react';
import {
  Project,
  ProjectAssignment,
  ProjectExpense,
  ProjectOverviewStats,
  Employee,
  Attendance,
  OvertimeRecord,
  KasbonRecord,
} from '../types.js';
import { api } from '../lib/api.js';
import {
  formatRupiah,
  formatDateID,
  getTodayDateString,
  formatOvertimeDuration,
  calculateOvertimePayFromHoursMinutes,
  calculateBasicPayByStatus,
  splitHoursMinutes,
  isDriverRole,
  terbilangRupiah,
} from '../lib/utils.js';
import {
  exportProjectReportPDF,
  exportProjectSlipGajiPDF,
  exportProjectReportExcel,
  ProjectEmployeeRecapItem,
  ProjectRecapSummaryData,
} from '../lib/projectReportExport.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

interface ProjectOverviewDashboardProps {
  project: Project;
  onBack: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type SubModule =
  | 'overview'
  | 'karyawan'
  | 'absensi'
  | 'lembur'
  | 'kasbon'
  | 'transport'
  | 'operasional'
  | 'laporan';

export const ProjectOverviewDashboard: React.FC<ProjectOverviewDashboardProps> = ({
  project,
  onBack,
  showToast,
}) => {
  const { user, token, isAdmin, isOwner } = useAuth();
  const { settings } = useCompany();
  const [activeModule, setActiveModule] = useState<SubModule>('overview');

  // Stats state (Strictly calculated from real DB data)
  const [stats, setStats] = useState<ProjectOverviewStats>({
    totalAssignedEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    overtimeCount: 0,
    totalKasbon: 0,
    totalTransportationCost: 0,
    totalOperationalCost: 0,
    budget: project.budget || 0,
    budgetRemaining: project.budget || 0,
    realizationPercentage: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Sub-modules data state
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [masterEmployees, setMasterEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [overtimeList, setOvertimeList] = useState<OvertimeRecord[]>([]);
  const [kasbonList, setKasbonList] = useState<KasbonRecord[]>([]);
  const [recapData, setRecapData] = useState<any>(null);
  const [loadingModuleData, setLoadingModuleData] = useState(false);

  // Employee search & filter state
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Helper for standard wages
  const getDefaultWages = (role: string) => {
    switch (role) {
      case 'Mandor':
        return {
          daily: settings?.wageMandorDaily || 200000,
          overtime: settings?.overtimeMandorHourly || 25000,
        };
      case 'Tukang':
        return {
          daily: settings?.wageTukangDaily || 150000,
          overtime: settings?.overtimeTukangHourly || 20000,
        };
      case 'Helper':
      case 'Kenek':
        return {
          daily: settings?.wageHelperDaily || 125000,
          overtime: settings?.overtimeHelperHourly || 15000,
        };
      case 'Driver':
        return {
          daily: settings?.wageDriverDaily || 140000,
          overtime: 0,
        };
      default:
        return {
          daily: settings?.wageTukangDaily || 150000,
          overtime: settings?.overtimeTukangHourly || 20000,
        };
    }
  };

  // Modals for Direct Project Employee Management
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isDetailEmployeeModalOpen, setIsDetailEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<ProjectAssignment | null>(null);
  const [assignmentActionModal, setAssignmentActionModal] = useState<{
    mode: 'delete' | 'toggle';
    assignment: ProjectAssignment;
  } | null>(null);
  const [processingAssignmentAction, setProcessingAssignmentAction] = useState(false);

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    phone: '',
    nik: '',
    role: 'Tukang',
    startDate: getTodayDateString(),
    dailyWage: 150000,
    overtimeHourlyWage: 20000,
    status: 'active' as 'active' | 'inactive',
    notes: '',
  });

  const [editEmployeeForm, setEditEmployeeForm] = useState({
    id: '',
    employeeId: '',
    name: '',
    phone: '',
    nik: '',
    role: 'Tukang',
    startDate: getTodayDateString(),
    dailyWage: 150000,
    overtimeHourlyWage: 20000,
    status: 'active' as 'active' | 'inactive',
    notes: '',
  });

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseFormType, setExpenseFormType] = useState<'transportasi' | 'operasional'>('transportasi');
  const [expenseForm, setExpenseForm] = useState({
    category: 'Bensin',
    transportType: 'Mobil Pick-up',
    destination: '',
    picName: '',
    description: '',
    amount: '',
    paymentMethod: 'Tunai',
    notes: '',
    date: getTodayDateString(),
  });
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [existingAttachmentsToKeep, setExistingAttachmentsToKeep] = useState<string[]>([]);
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<Array<{ fileName: string; dataBase64: string }>>([]);
  const [uploadingExpense, setUploadingExpense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo viewer / lightbox modal state
  const [viewingProofExpense, setViewingProofExpense] = useState<ProjectExpense | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // Helper to generate authenticated view URL for img tags and downloads (Supports both Admin & Owner)
  const getPhotoViewUrl = (attachmentId: string, download: boolean = false) => {
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
    return `/api/projects/expenses/attachments/${attachmentId}/view${qs ? `?${qs}` : ''}`;
  };

  useEffect(() => {
    if (viewingProofExpense) {
      setPhotoLoading(true);
      setPhotoError(false);
      setIsZoomed(false);
    }
  }, [viewingProofExpense, activePhotoIndex]);

  // Transportation Expense Deletion Confirmation Modal State
  const [expenseToDelete, setExpenseToDelete] = useState<ProjectExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Kasbon Proyek Management State
  const [isAddKasbonModalOpen, setIsAddKasbonModalOpen] = useState(false);
  const [kasbonForm, setKasbonForm] = useState({
    employeeId: '',
    requestDate: getTodayDateString(),
    amount: '',
    reason: '',
    adminNotes: '',
    targetPaymentPeriod: '',
  });
  const [selectedKasbonPhoto, setSelectedKasbonPhoto] = useState<{
    fileName: string;
    dataBase64: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  const [kasbonPhotoError, setKasbonPhotoError] = useState<string | null>(null);
  const [uploadingKasbon, setUploadingKasbon] = useState(false);
  const kasbonFileInputRef = useRef<HTMLInputElement>(null);

  // Kasbon Photo Lightbox Viewer State
  const [viewingProofKasbon, setViewingProofKasbon] = useState<KasbonRecord | null>(null);
  const [isKasbonZoomed, setIsKasbonZoomed] = useState(false);
  const [kasbonPhotoLoading, setKasbonPhotoLoading] = useState(false);
  const [kasbonPhotoLoadError, setKasbonPhotoLoadError] = useState(false);

  // Kasbon Deletion Confirmation Modal State
  const [kasbonToDelete, setKasbonToDelete] = useState<KasbonRecord | null>(null);
  const [deletingKasbon, setDeletingKasbon] = useState(false);

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
      setKasbonPhotoLoading(true);
      setKasbonPhotoLoadError(false);
      setIsKasbonZoomed(false);
    }
  }, [viewingProofKasbon]);

  // Attendance in Project modal (Create & Edit with integrated Kasbon)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(getTodayDateString());
  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: '',
    date: getTodayDateString(),
    status: 'Hadir',
    checkIn: '08:00',
    checkOut: '16:00',
    overtimeHours: 0,
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
  const [selectedAttKasbonPhoto, setSelectedAttKasbonPhoto] = useState<{
    fileName: string;
    dataBase64: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  const [attKasbonPhotoError, setAttKasbonPhotoError] = useState<string | null>(null);
  const attKasbonFileInputRef = useRef<HTMLInputElement>(null);

  // Attendance Deletion Confirmation Modal State
  const [attendanceToDelete, setAttendanceToDelete] = useState<Attendance | null>(null);
  const [deletingAttendance, setDeletingAttendance] = useState(false);
  const [deleteAttendanceError, setDeleteAttendanceError] = useState<string | null>(null);

  // Overtime in Project modal
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState({
    employeeId: '',
    date: getTodayDateString(),
    startTime: '16:00',
    endTime: '18:00',
    hours: 2,
    durationHours: 2,
    durationMinutes: 0,
    notes: '',
  });

  // Section H: Laporan & Rekapitulasi Komprehensif Proyek (H1 - H5) state
  const [activeReportSubmenu, setActiveReportSubmenu] = useState<'h1' | 'h2' | 'h3' | 'h4' | 'h5'>('h1');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  const [appliedStartDate, setAppliedStartDate] = useState<string>('');
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');
  const [reportRoleFilter, setReportRoleFilter] = useState<string>('ALL');
  const [reportEmployeeFilter, setReportEmployeeFilter] = useState<string>('ALL');
  const [reportCategoryFilter, setReportCategoryFilter] = useState<string>('ALL');
  const [selectedH1EmployeeDetail, setSelectedH1EmployeeDetail] = useState<ProjectEmployeeRecapItem | null>(null);
  const [slipGajiModalEmployees, setSlipGajiModalEmployees] = useState<ProjectEmployeeRecapItem[] | null>(null);

  const fetchProjectRecapData = async (start?: string, end?: string) => {
    setLoadingModuleData(true);
    try {
      const s = start && end ? start : undefined;
      const e = start && end ? end : undefined;
      const data = await api.getProjectRecap(project.id, s, e);
      setRecapData(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat laporan rekap proyek');
    } finally {
      setLoadingModuleData(false);
    }
  };

  // Fetch real statistics
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await api.getProjectStats(project.id);
      setStats(data);
    } catch (err: any) {
      console.error('Error fetching project stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch master employees for assignment selector
  const fetchMasterEmployees = async () => {
    try {
      const data = await api.getEmployees();
      setMasterEmployees(data.filter((e) => e.status === 'active'));
    } catch (err: any) {
      console.error('Error fetching master employees:', err);
    }
  };

  // Fetch submodule specific data
  const fetchModuleData = async (mod: SubModule) => {
    setLoadingModuleData(true);
    try {
      if (mod === 'karyawan') {
        const data = await api.getProjectAssignments(project.id);
        setAssignments(data);
      } else if (mod === 'transport') {
        const data = await api.getProjectExpenses(project.id, 'transportasi');
        setExpenses(data);
      } else if (mod === 'operasional') {
        const data = await api.getProjectExpenses(project.id, 'operasional');
        setExpenses(data);
      } else if (mod === 'absensi') {
        const [atts, asgs] = await Promise.all([
          api.getAttendance({ projectId: project.id }),
          api.getProjectAssignments(project.id),
        ]);
        setAttendanceList(atts);
        setAssignments(asgs);
      } else if (mod === 'lembur') {
        const [ots, asgs] = await Promise.all([
          api.getOvertime(),
          api.getProjectAssignments(project.id),
        ]);
        const assignedIds = new Set(asgs.map((a) => a.employeeId));
        setOvertimeList(ots.filter((o) => (o as any).projectId === project.id || assignedIds.has(o.employeeId)));
        setAssignments(asgs);
      } else if (mod === 'kasbon') {
        const [kbs, asgs] = await Promise.all([
          api.getProjectKasbon(project.id),
          api.getProjectAssignments(project.id),
        ]);
        setKasbonList(kbs);
        setAssignments(asgs);
      } else if (mod === 'laporan') {
        const s = appliedStartDate && appliedEndDate ? appliedStartDate : undefined;
        const e = appliedStartDate && appliedEndDate ? appliedEndDate : undefined;
        const data = await api.getProjectRecap(project.id, s, e);
        setRecapData(data);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data modul');
    } finally {
      setLoadingModuleData(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchMasterEmployees();
  }, [project.id]);

  useEffect(() => {
    if (activeModule !== 'overview') {
      fetchModuleData(activeModule);
    }
  }, [activeModule]);

  // Handle Direct Project Employee Addition
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!employeeForm.name.trim()) {
      showToast('error', 'Nama lengkap karyawan wajib diisi.');
      return;
    }

    try {
      await api.createProjectEmployee(project.id, employeeForm);
      showToast('success', `Karyawan ${employeeForm.name} berhasil ditambahkan ke proyek.`);
      setIsAddEmployeeModalOpen(false);
      setEmployeeForm({
        name: '',
        phone: '',
        nik: '',
        role: 'Tukang',
        startDate: getTodayDateString(),
        dailyWage: getDefaultWages('Tukang').daily,
        overtimeHourlyWage: getDefaultWages('Tukang').overtime,
        status: 'active',
        notes: '',
      });
      fetchStats();
      fetchModuleData('karyawan');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menambahkan karyawan proyek');
    }
  };

  // Handle Edit Project Employee
  const handleOpenEditEmployee = (asg: ProjectAssignment) => {
    setSelectedEmployee(asg);
    const currentRole = asg.roleInProject || asg.employeeRole || 'Tukang';
    setEditEmployeeForm({
      id: asg.id,
      employeeId: asg.employeeId,
      name: asg.employeeName || '',
      phone: asg.employeePhone || '',
      nik: asg.employeeNik || '',
      role: currentRole,
      startDate: asg.employeeStartDate || asg.assignedDate || getTodayDateString(),
      dailyWage: asg.dailyWage !== undefined ? asg.dailyWage : getDefaultWages(currentRole).daily,
      overtimeHourlyWage:
        currentRole === 'Driver'
          ? 0
          : asg.overtimeHourlyWage !== undefined
          ? asg.overtimeHourlyWage
          : getDefaultWages(currentRole).overtime,
      status: (asg.status === 'active' || asg.status === 'inactive') ? asg.status : 'active',
      notes: asg.notes || '',
    });
    setIsEditEmployeeModalOpen(true);
  };

  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!editEmployeeForm.name.trim()) {
      showToast('error', 'Nama lengkap karyawan wajib diisi.');
      return;
    }

    try {
      await api.updateProjectEmployee(project.id, editEmployeeForm.id, {
        ...editEmployeeForm,
        overtimeHourlyWage: editEmployeeForm.role === 'Driver' ? 0 : editEmployeeForm.overtimeHourlyWage,
      });
      showToast('success', `Data karyawan ${editEmployeeForm.name} berhasil diperbarui.`);
      setIsEditEmployeeModalOpen(false);
      fetchStats();
      fetchModuleData('karyawan');
      fetchMasterEmployees();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memperbarui data karyawan');
    }
  };

  // Safe Deactivation / Activation (Never deletes historical logs)
  const handleToggleEmployeeStatus = (asg: ProjectAssignment) => {
    if (!isAdmin) return;
    setAssignmentActionModal({ mode: 'toggle', assignment: asg });
  };

  const handleDeleteProjectEmployee = (asg: ProjectAssignment) => {
    if (!isAdmin) return;
    setAssignmentActionModal({ mode: 'delete', assignment: asg });
  };

  const handleConfirmAssignmentAction = async () => {
    if (!assignmentActionModal || !isAdmin) return;
    const { mode, assignment: asg } = assignmentActionModal;
    setProcessingAssignmentAction(true);

    try {
      if (mode === 'toggle') {
        const nextStatus: 'active' | 'inactive' = asg.status === 'active' ? 'inactive' : 'active';
        await api.updateProjectEmployee(project.id, asg.id, {
          status: nextStatus,
        });
        showToast(
          'success',
          `Status karyawan ${asg.employeeName} diubah menjadi ${nextStatus === 'active' ? 'Aktif' : 'Nonaktif'}. Riwayat data tetap aman.`
        );
      } else {
        const res: any = await api.deleteProjectEmployee(project.id, asg.id);
        showToast(
          'success',
          res?.message || `Karyawan ${asg.employeeName} berhasil dihapus dari proyek.`
        );
      }
      setAssignmentActionModal(null);
      fetchStats();
      fetchModuleData('karyawan');
      fetchMasterEmployees();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memproses tindakan karyawan proyek');
    } finally {
      setProcessingAssignmentAction(false);
    }
  };

  // Handle Expense Creation with Photo Upload
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', `Ukuran file ${file.name} melebihi batas 5MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPhotoFiles((prev) => [
          ...prev,
          { fileName: file.name, dataBase64: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleEditExpenseClick = (exp: ProjectExpense) => {
    if (!isAdmin) return;
    setEditingExpense(exp);
    setExpenseFormType(exp.expenseType);
    setExpenseForm({
      category: exp.category,
      transportType: exp.transportType || '',
      destination: exp.destination || '',
      picName: exp.picName,
      description: exp.description,
      amount: String(exp.amount),
      paymentMethod: exp.paymentMethod || 'Tunai',
      notes: exp.notes || '',
      date: exp.date || getTodayDateString(),
    });
    setSelectedPhotoFiles([]);
    setExistingAttachmentsToKeep(exp.attachments ? exp.attachments.map((a) => a.id) : []);
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const numAmount = Number(expenseForm.amount);
    if (!numAmount || numAmount <= 0) {
      showToast('error', 'Nominal pengeluaran harus lebih besar dari 0.');
      return;
    }

    setUploadingExpense(true);
    try {
      if (editingExpense) {
        await api.updateProjectExpense(project.id, editingExpense.id, {
          expenseType: expenseFormType,
          category: expenseForm.category,
          transportType: expenseFormType === 'transportasi' ? expenseForm.transportType : undefined,
          destination: expenseFormType === 'transportasi' ? expenseForm.destination : undefined,
          picName: expenseForm.picName,
          description: expenseForm.description,
          amount: numAmount,
          paymentMethod: expenseForm.paymentMethod,
          notes: expenseForm.notes,
          date: expenseForm.date,
          attachmentsToKeep: existingAttachmentsToKeep,
          newAttachments: selectedPhotoFiles,
        });

        showToast(
          'success',
          `${expenseFormType === 'transportasi' ? 'Biaya Transportasi' : 'Pengeluaran Operasional'} berhasil diperbarui.`
        );
      } else {
        await api.createProjectExpense(project.id, {
          expenseType: expenseFormType,
          category: expenseForm.category,
          transportType: expenseFormType === 'transportasi' ? expenseForm.transportType : undefined,
          destination: expenseFormType === 'transportasi' ? expenseForm.destination : undefined,
          picName: expenseForm.picName,
          description: expenseForm.description,
          amount: numAmount,
          paymentMethod: expenseForm.paymentMethod,
          notes: expenseForm.notes,
          date: expenseForm.date,
          attachments: selectedPhotoFiles,
        });

        showToast(
          'success',
          `${expenseFormType === 'transportasi' ? 'Biaya Transportasi' : 'Pengeluaran Operasional'} berhasil disimpan.`
        );
      }

      setIsExpenseModalOpen(false);
      setEditingExpense(null);
      setSelectedPhotoFiles([]);
      setExistingAttachmentsToKeep([]);
      setExpenseForm({
        category: expenseFormType === 'transportasi' ? 'Bensin' : 'Material Darurat',
        transportType: 'Mobil Pick-up',
        destination: '',
        picName: '',
        description: '',
        amount: '',
        paymentMethod: 'Tunai',
        notes: '',
        date: getTodayDateString(),
      });
      fetchStats();
      fetchModuleData(activeModule);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan pengeluaran');
    } finally {
      setUploadingExpense(false);
    }
  };

  const handleDeleteExpenseClick = (exp: ProjectExpense) => {
    if (!isAdmin) return;
    setExpenseToDelete(exp);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!isAdmin || !expenseToDelete) return;
    setDeletingExpense(true);
    try {
      await api.deleteProjectExpense(project.id, expenseToDelete.id);
      showToast('success', `Pengeluaran ${expenseToDelete.transactionNumber} berhasil dihapus.`);
      setExpenseToDelete(null);
      fetchStats();
      fetchModuleData(activeModule);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus pengeluaran');
    } finally {
      setDeletingExpense(false);
    }
  };

  // Kasbon Handlers
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
  };

  const handleAddKasbonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!kasbonForm.employeeId) {
      showToast('error', 'Pilih karyawan yang mengajukan kasbon.');
      return;
    }
    const numAmount = Number(kasbonForm.amount);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      showToast('error', 'Nominal kasbon harus lebih besar dari 0.');
      return;
    }

    setUploadingKasbon(true);
    try {
      const attachments = selectedKasbonPhoto
        ? [
            {
              fileName: selectedKasbonPhoto.fileName,
              dataBase64: selectedKasbonPhoto.dataBase64,
            },
          ]
        : [];

      await api.createProjectKasbon(project.id, {
        employeeId: kasbonForm.employeeId,
        requestDate: kasbonForm.requestDate,
        amount: numAmount,
        reason: kasbonForm.reason || 'Kebutuhan keluarga mendesak',
        adminNotes: kasbonForm.adminNotes || '',
        targetPaymentPeriod: kasbonForm.targetPaymentPeriod || '',
        attachments,
      });

      showToast('success', `Kasbon senilai ${formatRupiah(numAmount)} berhasil dicatat.`);
      setIsAddKasbonModalOpen(false);
      setKasbonForm({
        employeeId: '',
        requestDate: getTodayDateString(),
        amount: '',
        reason: '',
        adminNotes: '',
        targetPaymentPeriod: '',
      });
      setSelectedKasbonPhoto(null);
      fetchStats();
      fetchModuleData('kasbon');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mencatat kasbon');
    } finally {
      setUploadingKasbon(false);
    }
  };

  const handleConfirmDeleteKasbon = async () => {
    if (!isAdmin || !kasbonToDelete) return;
    if (kasbonToDelete.deductedAmount > 0 || kasbonToDelete.status === 'Lunas' || kasbonToDelete.status === 'Dipotong sebagian') {
      showToast('error', 'Kasbon ini sudah memiliki riwayat pemotongan gaji dan tidak dapat dihapus langsung.');
      return;
    }

    setDeletingKasbon(true);
    try {
      await api.deleteProjectKasbon(project.id, kasbonToDelete.id);
      showToast('success', `Kasbon ${kasbonToDelete.kasbonNumber} berhasil dihapus.`);
      setKasbonToDelete(null);
      fetchStats();
      fetchModuleData('kasbon');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus kasbon');
    } finally {
      setDeletingKasbon(false);
    }
  };

  // Open Create Attendance Modal
  const openCreateAttendanceModal = () => {
    if (!isAdmin) return;
    const defaultEmpId =
      assignments.find((a) => a.status === 'active' && a.employeeStatus !== 'inactive')?.employeeId ||
      assignments[0]?.employeeId ||
      '';
    setEditingAttendance(null);
    setAttendanceForm({
      employeeId: defaultEmpId,
      date: attendanceDate || getTodayDateString(),
      status: 'Hadir',
      checkIn: settings?.workHourStart || '08:00',
      checkOut: settings?.workHourEnd || '16:00',
      overtimeHours: 0,
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
    setSelectedAttKasbonPhoto(null);
    setAttKasbonPhotoError(null);
    if (attKasbonFileInputRef.current) {
      attKasbonFileInputRef.current.value = '';
    }
    setIsAttendanceModalOpen(true);
  };

  // Open Edit Attendance Modal
  const openEditAttendanceModal = (att: Attendance) => {
    if (!isAdmin) return;
    const hm = splitHoursMinutes(att.overtimeHours || 0);
    const hasLinkedKasbon = Boolean(att.kasbonId || (att.kasbonAmount && att.kasbonAmount > 0));
    const existingAttachment =
      att.kasbonAttachments && att.kasbonAttachments.length > 0
        ? att.kasbonAttachments[0]
        : att.kasbonAttachmentFilePath && att.kasbonId
        ? {
            id: att.kasbonId,
            fileName: `bukti_${att.kasbonNumber || 'kasbon'}.jpg`,
          }
        : null;

    setEditingAttendance(att);
    setAttendanceForm({
      employeeId: att.employeeId,
      date: att.date,
      status: att.status,
      checkIn: att.checkIn || settings?.workHourStart || '08:00',
      checkOut: att.checkOut || (att.status === 'Setengah Hari' ? '12:00' : settings?.workHourEnd || '16:00'),
      overtimeHours: att.overtimeHours || 0,
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
    setSelectedAttKasbonPhoto(null);
    setAttKasbonPhotoError(null);
    if (attKasbonFileInputRef.current) {
      attKasbonFileInputRef.current.value = '';
    }
    setIsAttendanceModalOpen(true);
  };

  const handleAttKasbonPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAttKasbonPhotoError('Format file harus berupa gambar (JPG, JPEG, PNG, atau WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttKasbonPhotoError(`Ukuran file (${(file.size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 5 MB`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedAttKasbonPhoto({
        fileName: file.name,
        dataBase64: reader.result as string,
        fileSize: file.size,
        mimeType: file.type,
      });
      setAttKasbonPhotoError(null);
      setAttendanceForm((prev) => ({ ...prev, removeKasbonPhoto: false }));
    };
    reader.onerror = () => {
      setAttKasbonPhotoError('Gagal membaca file gambar');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttKasbonPhoto = () => {
    setSelectedAttKasbonPhoto(null);
    setAttKasbonPhotoError(null);
    if (attKasbonFileInputRef.current) {
      attKasbonFileInputRef.current.value = '';
    }
    if (attendanceForm.existingKasbonAttachmentId) {
      setAttendanceForm((prev) => ({
        ...prev,
        existingKasbonAttachmentId: '',
        existingKasbonAttachmentFileName: '',
        removeKasbonPhoto: true,
      }));
    }
  };

  // Record or Edit Attendance for Project (with Integrated Kasbon)
  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!attendanceForm.employeeId) {
      showToast('error', 'Pilih karyawan yang bertugas terlebih dahulu.');
      return;
    }

    const targetDate = editingAttendance ? (attendanceForm.date || editingAttendance.date) : (attendanceDate || attendanceForm.date);
    if (!targetDate) {
      showToast('error', 'Tanggal kehadiran wajib diisi.');
      return;
    }

    const numKasbonAmount = Number(attendanceForm.kasbonAmount || 0);
    if (attendanceForm.hasKasbon) {
      if (!numKasbonAmount || numKasbonAmount <= 0 || isNaN(numKasbonAmount)) {
        showToast('error', 'Nominal kasbon wajib diisi dan harus lebih besar dari Rp0.');
        return;
      }
    }

    const isWorking = attendanceForm.status === 'Hadir' || attendanceForm.status === 'Setengah Hari';
    const dHours = isWorking ? Math.max(0, Math.floor(Number(attendanceForm.durationHours || 0))) : 0;
    const dMins = isWorking ? Math.max(0, Math.min(59, Math.round(Number(attendanceForm.durationMinutes || 0)))) : 0;
    const decHours = Number((dHours + dMins / 60).toFixed(4));

    const kasbonAttachments =
      attendanceForm.hasKasbon && selectedAttKasbonPhoto
        ? [
            {
              fileName: selectedAttKasbonPhoto.fileName,
              dataBase64: selectedAttKasbonPhoto.dataBase64,
              fileSize: selectedAttKasbonPhoto.fileSize,
              mimeType: selectedAttKasbonPhoto.mimeType,
            },
          ]
        : [];

    setSavingAttendance(true);
    try {
      const payload = {
        date: targetDate,
        employeeId: attendanceForm.employeeId,
        projectId: project.id,
        status: attendanceForm.status as any,
        checkIn: isWorking ? attendanceForm.checkIn : undefined,
        checkOut: isWorking
          ? attendanceForm.status === 'Setengah Hari' && attendanceForm.checkOut === '16:00'
            ? '12:00'
            : attendanceForm.checkOut
          : undefined,
        overtimeHours: decHours,
        durationHours: dHours,
        durationMinutes: dMins,
        notes: attendanceForm.notes,
        hasKasbon: attendanceForm.hasKasbon,
        kasbonId: attendanceForm.kasbonId || undefined,
        kasbonAmount: attendanceForm.hasKasbon ? numKasbonAmount : 0,
        kasbonNotes: attendanceForm.hasKasbon ? attendanceForm.kasbonNotes : '',
        kasbonAttachments,
        removeKasbonPhoto: attendanceForm.removeKasbonPhoto,
      };

      if (editingAttendance) {
        await api.updateAttendance(editingAttendance.id, payload);
        showToast(
          'success',
          attendanceForm.hasKasbon
            ? `Perubahan kehadiran dan kasbon (${formatRupiah(numKasbonAmount)}) berhasil disimpan.`
            : 'Perubahan kehadiran proyek berhasil disimpan.'
        );
      } else {
        await api.recordAttendance(payload);
        showToast(
          'success',
          attendanceForm.hasKasbon
            ? `Kehadiran dan pengajuan kasbon (${formatRupiah(numKasbonAmount)}) berhasil disimpan.`
            : 'Kehadiran proyek berhasil dicatat.'
        );
      }

      setIsAttendanceModalOpen(false);
      setEditingAttendance(null);
      setSelectedAttKasbonPhoto(null);
      fetchStats();
      fetchModuleData('absensi');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan data kehadiran');
    } finally {
      setSavingAttendance(false);
    }
  };

  const openDeleteAttendanceModal = (att: Attendance) => {
    if (!isAdmin) return;
    setDeleteAttendanceError(null);
    setAttendanceToDelete(att);
  };

  const handleConfirmDeleteAttendance = async () => {
    if (!isAdmin || !attendanceToDelete) return;
    setDeletingAttendance(true);
    setDeleteAttendanceError(null);
    try {
      const res = await api.deleteAttendance(attendanceToDelete.id, project.id);
      showToast(
        'success',
        res.message || `Data absensi ${attendanceToDelete.employeeName} (${formatDateID(attendanceToDelete.date)}) berhasil dihapus.`
      );
      setAttendanceToDelete(null);
      fetchStats();
      fetchModuleData('absensi');
    } catch (err: any) {
      const errMsg = err.message || 'Gagal menghapus data absensi';
      setDeleteAttendanceError(errMsg);
      showToast('error', errMsg);
    } finally {
      setDeletingAttendance(false);
    }
  };

  // Record Overtime for Project
  const handleOvertimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!overtimeForm.employeeId) {
      showToast('error', 'Pilih karyawan yang bertugas terlebih dahulu.');
      return;
    }

    const dHours = Math.max(0, Math.floor(Number(overtimeForm.durationHours || 0)));
    const dMins = Math.max(0, Math.min(59, Math.round(Number(overtimeForm.durationMinutes || 0))));
    const decHours = Number((dHours + dMins / 60).toFixed(4));
    if (decHours <= 0) {
      showToast('error', 'Durasi lembur harus lebih besar dari 0 menit.');
      return;
    }

    try {
      await api.recordOvertime({
        date: overtimeForm.date,
        employeeId: overtimeForm.employeeId,
        projectId: project.id,
        startTime: overtimeForm.startTime,
        endTime: overtimeForm.endTime,
        hours: decHours,
        durationHours: dHours,
        durationMinutes: dMins,
        notes: overtimeForm.notes,
      } as any);
      showToast('success', 'Catatan lembur proyek berhasil disimpan.');
      setIsOvertimeModalOpen(false);
      fetchStats();
      fetchModuleData('lembur');
    } catch (err: any) {
      showToast('error', err.message || 'Gagal mencatat lembur');
    }
  };

  const statusColors: Record<string, string> = {
    Berjalan: 'bg-[#EFF5FF] text-[#155EEF] border-[#D0E2FF]',
    Selesai: 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]',
    Persiapan: 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]',
  };

  return (
    <div className="space-y-6 pb-20 bg-[#F8F9FA] min-h-screen">
      {/* 3. TOP INFO DASHBOARD */}
      <div className="bg-white rounded-2xl border border-[#EAECF0] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4693FD] hover:text-[#1849A9] transition-colors mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Daftar Proyek</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD]">
                {project.code}
              </span>
              <h1 className="text-2xl font-bold text-[#1D2939] tracking-tight">{project.name}</h1>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  statusColors[project.status] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {project.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#475467] pt-1">
              <div className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#98A2B3]" />
                <span className="text-[#667085]">Klien:</span>
                <span className="font-semibold text-[#1D2939]">{project.client}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#98A2B3]" />
                <span className="text-[#667085]">Lokasi:</span>
                <span className="font-medium text-[#1D2939]">{project.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#98A2B3]" />
                <span className="text-[#667085]">Periode:</span>
                <span className="font-medium text-[#1D2939]">
                  {formatDateID(project.startDate)}
                  {project.targetEndDate ? ` s/d ${formatDateID(project.targetEndDate)}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Budget Widget */}
          <div className="bg-[#F8F9FA] border border-[#EAECF0] rounded-xl p-4 min-w-[240px] text-right">
            <span className="text-xs text-[#667085] font-medium block">Nilai Anggaran Proyek</span>
            <span className="text-xl font-bold text-[#1D2939] font-mono block mt-0.5">
              {formatRupiah(project.budget)}
            </span>
            <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-[#475467]">
              <span>Realisasi Biaya:</span>
              <span className="font-semibold text-[#4693FD] font-mono">
                {stats.realizationPercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SEVEN PROJECT SUMMARY STATS CARDS (Strictly calculated from real database) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1: Total Karyawan Ditugaskan */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Ditugaskan</span>
            <Users className="w-4 h-4 text-[#4693FD]" />
          </div>
          <p className="text-2xl font-bold text-[#1D2939] mt-2 font-mono">
            {loadingStats ? '...' : stats.totalAssignedEmployees}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Tenaga kerja aktif</p>
        </div>

        {/* Card 2: Hadir Hari Ini */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Hadir Hari Ini</span>
            <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
          </div>
          <p className="text-2xl font-bold text-[#12B76A] mt-2 font-mono">
            {loadingStats ? '...' : stats.presentToday}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Presensi hadir</p>
        </div>

        {/* Card 3: Tidak Hadir Hari Ini */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Tidak Hadir</span>
            <XCircle className="w-4 h-4 text-[#F04438]" />
          </div>
          <p className="text-2xl font-bold text-[#F04438] mt-2 font-mono">
            {loadingStats ? '...' : stats.absentToday}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Izin/Sakit/Alpa/Belum</p>
        </div>

        {/* Card 4: Lembur */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Lembur</span>
            <Clock className="w-4 h-4 text-[#F79009]" />
          </div>
          <p className="text-2xl font-bold text-[#F79009] mt-2 font-mono">
            {loadingStats ? '...' : stats.overtimeCount}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Orang disetujui</p>
        </div>

        {/* Card 5: Kasbon Terkait */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Kasbon Terkait</span>
            <Wallet className="w-4 h-4 text-[#7A5AF8]" />
          </div>
          <p className="text-sm font-bold text-[#7A5AF8] mt-2 font-mono truncate">
            {loadingStats ? '...' : formatRupiah(stats.totalKasbon)}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Sisa pinjaman aktif</p>
        </div>

        {/* Card 6: Biaya Transportasi */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Transportasi</span>
            <Truck className="w-4 h-4 text-[#0BA5EC]" />
          </div>
          <p className="text-sm font-bold text-[#0BA5EC] mt-2 font-mono truncate">
            {loadingStats ? '...' : formatRupiah(stats.totalTransportationCost)}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Bensin, tol, parkir</p>
        </div>

        {/* Card 7: Pengeluaran Operasional */}
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-medium">Operasional</span>
            <Receipt className="w-4 h-4 text-[#EE46BC]" />
          </div>
          <p className="text-sm font-bold text-[#EE46BC] mt-2 font-mono truncate">
            {loadingStats ? '...' : formatRupiah(stats.totalOperationalCost)}
          </p>
          <p className="text-[10px] text-[#667085] mt-1">Belanja lapangan</p>
        </div>
      </div>

      {/* NAVIGATION TABS OR SUB-MODULE HEADER */}
      {activeModule !== 'overview' && (
        <div className="bg-white border border-[#EAECF0] rounded-xl p-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveModule('overview')}
              className="text-[#4693FD] font-semibold hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Menu Proyek</span>
            </button>
            <span className="text-[#D0D5DD]">/</span>
            <span className="font-semibold text-[#1D2939] uppercase tracking-wide">
              {activeModule === 'karyawan' && 'A. Data Penugasan Karyawan'}
              {activeModule === 'absensi' && 'B. Absensi Karyawan Proyek'}
              {activeModule === 'lembur' && 'C. Sistem Lembur Proyek'}
              {activeModule === 'kasbon' && 'D. Kasbon Karyawan Terkait'}
              {activeModule === 'transport' && 'E. Biaya Transportasi Proyek'}
              {activeModule === 'operasional' && 'F. Pengeluaran Operasional Proyek'}
              {activeModule === 'laporan' && 'H. Laporan & Rekapitulasi Komprehensif Proyek'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && activeModule === 'karyawan' && (
              <button
                onClick={() => setIsAddEmployeeModalOpen(true)}
                className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tambah Karyawan</span>
              </button>
            )}

            {isAdmin && activeModule === 'absensi' && (
              <button
                onClick={openCreateAttendanceModal}
                className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat Presensi Proyek</span>
              </button>
            )}

            {isAdmin && activeModule === 'lembur' && (
              <button
                onClick={() => setIsOvertimeModalOpen(true)}
                className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat Lembur</span>
              </button>
            )}

            {isAdmin && (activeModule === 'transport' || activeModule === 'operasional') && (
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setExistingAttachmentsToKeep([]);
                  setSelectedPhotoFiles([]);
                  const isTrans = activeModule === 'transport';
                  setExpenseFormType(isTrans ? 'transportasi' : 'operasional');
                  setExpenseForm({
                    category: isTrans ? 'Bensin' : 'Material Darurat',
                    transportType: 'Mobil Pick-up',
                    destination: '',
                    picName: '',
                    description: '',
                    amount: '',
                    paymentMethod: 'Tunai',
                    notes: '',
                    date: getTodayDateString(),
                  });
                  setIsExpenseModalOpen(true);
                }}
                className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{activeModule === 'transport' ? 'Catat Biaya Transport' : 'Catat Pengeluaran Lapangan'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. MENU UTAMA BERBENTUK KOTAK-KOTAK (GRID CARDS) */}
      {activeModule === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1D2939]">Pusat Operasional Proyek</h2>
            <span className="text-xs text-[#667085]">Pilih modul untuk mengelola atau melihat rincian operasional</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* A. Data Karyawan */}
            <div
              onClick={() => setActiveModule('karyawan')}
              className="bg-white p-5 rounded-2xl border border-[#EAECF0] hover:border-[#4693FD] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#EFF5FF] text-[#155EEF] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#1D2939] group-hover:text-[#4693FD] transition-colors">
                  A. Data Karyawan Proyek
                </h3>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Kelola penugasan tenaga kerja dari master data ke proyek, peran kerja, kontak, dan riwayat penempatan.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F2F4F7] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#155EEF]">
                  {stats.totalAssignedEmployees} Karyawan Ditugaskan
                </span>
                <ChevronRight className="w-4 h-4 text-[#98A2B3] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* B. Absensi Karyawan */}
            <div
              onClick={() => setActiveModule('absensi')}
              className="bg-white p-5 rounded-2xl border border-[#EAECF0] hover:border-[#4693FD] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF3] text-[#027A48] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#1D2939] group-hover:text-[#4693FD] transition-colors">
                  B. Absensi Karyawan Proyek
                </h3>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Pencatatan dan edit kehadiran harian (penuh/setengah hari), jam lembur aktual, serta pengajuan kasbon terintegrasi.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F2F4F7] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#027A48]">
                  {stats.presentToday} Hadir Hari Ini
                </span>
                <ChevronRight className="w-4 h-4 text-[#98A2B3] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* C. Sistem Lembur */}
            <div
              onClick={() => setActiveModule('lembur')}
              className="bg-white p-5 rounded-2xl border border-[#EAECF0] hover:border-[#4693FD] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FEF6EE] text-[#B54708] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#1D2939] group-hover:text-[#4693FD] transition-colors">
                  C. Sistem Lembur Proyek
                </h3>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Catatan lembur, tarif upah lembur resmi perusahaan, total biaya, dan status persetujuan administrator.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F2F4F7] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#B54708]">
                  {stats.overtimeCount} Karyawan Lembur
                </span>
                <ChevronRight className="w-4 h-4 text-[#98A2B3] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* E. Biaya Transportasi */}
            <div
              onClick={() => setActiveModule('transport')}
              className="bg-white p-5 rounded-2xl border border-[#EAECF0] hover:border-[#4693FD] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#F0F9FF] text-[#026AA2] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#1D2939] group-hover:text-[#4693FD] transition-colors">
                  E. Biaya Transportasi Proyek
                </h3>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Pencatatan bensin, e-toll, parkir, armada kendaraan dinas, PIC penanggung jawab, serta lampiran foto bukti.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F2F4F7] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#026AA2]">
                  {formatRupiah(stats.totalTransportationCost)} Total
                </span>
                <ChevronRight className="w-4 h-4 text-[#98A2B3] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* F. Pengeluaran Operasional Proyek */}
            <div
              onClick={() => setActiveModule('operasional')}
              className="bg-white p-5 rounded-2xl border border-[#EAECF0] hover:border-[#4693FD] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FDF2FA] text-[#C11574] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#1D2939] group-hover:text-[#4693FD] transition-colors">
                  F. Pengeluaran Operasional Lapangan
                </h3>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Pencatatan pengeluaran riil lapangan, alat bantu darurat, konsumsi, dan biaya operasional langsung proyek.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F2F4F7] flex items-center justify-between text-xs">
                <span className="font-semibold text-[#C11574]">
                  {formatRupiah(stats.totalOperationalCost)} Total
                </span>
                <ChevronRight className="w-4 h-4 text-[#98A2B3] group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* H. Laporan & Rekapitulasi Komprehensif Proyek (H1 - H5) */}
            <div
              onClick={() => {
                setActiveReportSubmenu('h1');
                setActiveModule('laporan');
              }}
              className="bg-white p-5 rounded-2xl border border-[#EAECF0] hover:border-[#4693FD] shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between md:col-span-2 lg:col-span-3"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF5FF] text-[#155EEF] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5 text-[#4693FD]" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                    Pusat Rekap Gaji, Slip Gaji, Cetak PDF, Print & Ekspor Excel Proyek
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#1D2939] group-hover:text-[#4693FD] transition-colors">
                  H. Laporan & Rekapitulasi Komprehensif Proyek
                </h3>
                <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">
                  Pusat rekap keuangan resmi proyek {project.name} ({project.code}): rekap gaji per karyawan, rekap total gaji seluruh karyawan, biaya transportasi, pengeluaran operasional lapangan, dan realisasi seluruh anggaran proyek.
                </p>

                {/* 5 Submenu Quick-Launch Buttons (H1 - H5) */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { id: 'h1', code: 'H1', label: 'Rekap Gaji Per Karyawan', desc: 'Detail harian, lembur, kasbon & slip gaji' },
                    { id: 'h2', code: 'H2', label: 'Rekap Total Gaji Seluruh Karyawan', desc: 'Tabel rekap kolektif & grand total upah' },
                    { id: 'h3', code: 'H3', label: 'Rekap Biaya Transportasi', desc: 'Rincian BBM, tol, parkir & bukti foto' },
                    { id: 'h4', code: 'H4', label: 'Rekap Operasional Lapangan', desc: 'Rincian belanja lapangan & struk' },
                    { id: 'h5', code: 'H5', label: 'Rekap Seluruh Pengeluaran', desc: 'Realisasi anggaran vs total biaya proyek' },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setActiveReportSubmenu(sub.id as any);
                        setActiveModule('laporan');
                      }}
                      className="text-left p-2.5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] hover:bg-[#EFF5FF] hover:border-[#4693FD] transition-all group/sub"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#155EEF] bg-white px-1.5 py-0.5 rounded border border-[#D0E2FF]">
                          {sub.code}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#98A2B3] group-hover/sub:text-[#155EEF] group-hover/sub:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs font-bold text-[#1D2939] mt-1.5 line-clamp-1">{sub.label}</p>
                      <p className="text-[10px] text-[#667085] mt-0.5 line-clamp-1">{sub.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F2F4F7] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#4693FD]">
                  Realisasi Anggaran Proyek: {stats.realizationPercentage}% (Sisa Anggaran: {formatRupiah(stats.budgetRemaining)})
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#155EEF]">
                  <span>Buka Pusat Laporan H1–H5</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE VIEW A: DATA KARYAWAN PROYEK */}
      {activeModule === 'karyawan' && (() => {
        const q = searchEmployee.toLowerCase().trim();
        const filteredAssignments = assignments.filter((asg) => {
          const matchesSearch =
            !q ||
            (asg.employeeName || '').toLowerCase().includes(q) ||
            (asg.employeeId || '').toLowerCase().includes(q) ||
            (asg.employeeNik && asg.employeeNik.toLowerCase().includes(q)) ||
            (asg.employeePhone && asg.employeePhone.includes(q)) ||
            (asg.roleInProject && asg.roleInProject.toLowerCase().includes(q)) ||
            (asg.employeeRole && asg.employeeRole.toLowerCase().includes(q));

          const currentRole = asg.roleInProject || asg.employeeRole;
          const matchesRole = filterRole === 'all' || currentRole === filterRole;

          const isActive = asg.status === 'active' && asg.employeeStatus !== 'inactive';
          const matchesStatus =
            filterStatus === 'all' ||
            (filterStatus === 'active' && isActive) ||
            (filterStatus === 'inactive' && !isActive);

          return matchesSearch && matchesRole && matchesStatus;
        });

        const activeCount = assignments.filter(
          (a) => a.status === 'active' && a.employeeStatus !== 'inactive'
        ).length;
        const inactiveCount = assignments.length - activeCount;

        return (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1D2939]">Data Karyawan Proyek</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                      {assignments.length} Karyawan
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] mt-1">
                    Kelola tenaga kerja langsung pada proyek <span className="font-semibold text-[#344054]">{project.name}</span>. Data tersinkronisasi otomatis dengan master perusahaan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5] font-medium text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]"></span>
                      {activeCount} Aktif
                    </span>
                    {inactiveCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2F4F7] text-[#667085] border border-[#D0D5DD] font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#98A2B3]"></span>
                        {inactiveCount} Nonaktif
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => setIsAddEmployeeModalOpen(true)}
                      className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ml-auto sm:ml-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Karyawan</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="p-4 bg-[#F8F9FA] border-b border-[#EAECF0] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchEmployee}
                    onChange={(e) => setSearchEmployee(e.target.value)}
                    placeholder="Cari nama, ID, NIK, peran, telepon..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] placeholder-[#98A2B3] focus:outline-none focus:border-[#4693FD]"
                  />
                  {searchEmployee && (
                    <button
                      onClick={() => setSearchEmployee('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#667085]" />
                    <span className="text-xs text-[#667085]">Jabatan:</span>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="all">Semua Jabatan</option>
                      <option value="Mandor">Mandor</option>
                      <option value="Tukang">Tukang</option>
                      <option value="Helper">Helper / Kenek</option>
                      <option value="Driver">Driver</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#667085]">Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="all">Semua Status</option>
                      <option value="active">Aktif di Proyek</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>

                  {(searchEmployee || filterRole !== 'all' || filterStatus !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchEmployee('');
                        setFilterRole('all');
                        setFilterStatus('all');
                      }}
                      className="text-xs text-[#4693FD] hover:underline px-1.5 py-1"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                      <th className="py-3 px-4">ID Karyawan</th>
                      <th className="py-3 px-4">Nama Lengkap & NIK</th>
                      <th className="py-3 px-4">Jabatan</th>
                      <th className="py-3 px-4">No. Telepon</th>
                      <th className="py-3 px-4">Tgl Mulai</th>
                      <th className="py-3 px-4 text-right">Upah Harian</th>
                      <th className="py-3 px-4 text-right">Tarif Lembur</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                    {loadingModuleData ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-[#667085]">
                          <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#4693FD] border-t-transparent mb-2"></div>
                          <p>Memuat data karyawan proyek...</p>
                        </td>
                      </tr>
                    ) : filteredAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-[#667085]">
                          <Users className="w-8 h-8 text-[#D0D5DD] mx-auto mb-2" />
                          <p className="font-semibold text-[#1D2939]">
                            {assignments.length === 0
                              ? 'Belum ada karyawan yang ditambahkan ke proyek ini.'
                              : 'Tidak ada karyawan yang sesuai dengan kriteria pencarian.'}
                          </p>
                          <p className="text-xs text-[#667085] mt-1">
                            {assignments.length === 0
                              ? 'Tambahkan karyawan proyek langsung menggunakan tombol di atas.'
                              : 'Coba ubah kata kunci atau reset filter status/jabatan.'}
                          </p>
                          {isAdmin && assignments.length === 0 && (
                            <button
                              onClick={() => setIsAddEmployeeModalOpen(true)}
                              className="mt-3 inline-flex items-center gap-1.5 bg-[#4693FD] hover:bg-[#1849A9] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah Karyawan Pertama</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredAssignments.map((asg) => {
                        const isEmployeeActive =
                          asg.status === 'active' && asg.employeeStatus !== 'inactive';
                        const currentRole = asg.roleInProject || asg.employeeRole || 'Tukang';
                        const daily =
                          asg.dailyWage !== undefined
                            ? asg.dailyWage
                            : getDefaultWages(currentRole).daily;
                        const otRate =
                          asg.overtimeHourlyWage !== undefined
                            ? asg.overtimeHourlyWage
                            : getDefaultWages(currentRole).overtime;

                        return (
                          <tr
                            key={asg.id}
                            className={`hover:bg-[#F9FAFB] transition-colors ${
                              !isEmployeeActive ? 'bg-[#F9FAFB]/50 text-[#98A2B3]' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-mono font-medium text-[#4693FD]">
                              <span className="px-2 py-0.5 rounded bg-[#EFF5FF] border border-[#D0E2FF] text-[#155EEF]">
                                {asg.employeeId}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#1D2939]">{asg.employeeName}</div>
                              {asg.employeeNik ? (
                                <div className="text-[11px] font-mono text-[#667085]">
                                  NIK: {asg.employeeNik}
                                </div>
                              ) : (
                                <div className="text-[10px] text-[#98A2B3] italic">NIK belum diisi</div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                  currentRole === 'Mandor'
                                    ? 'bg-[#FEF6EE] text-[#B54708] border border-[#F9DBAF]'
                                    : currentRole === 'Tukang'
                                    ? 'bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]'
                                    : currentRole === 'Driver'
                                    ? 'bg-[#F0F9FF] text-[#026AA2] border border-[#B9E6FE]'
                                    : 'bg-[#F4F3FF] text-[#5925DC] border border-[#D9D6FE]'
                                }`}
                              >
                                {currentRole}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#667085] font-mono">
                              {asg.employeePhone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-[#98A2B3]" />
                                  {asg.employeePhone}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#667085]">
                              {formatDateID(asg.employeeStartDate || asg.assignedDate)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-[#1D2939]">
                              {formatRupiah(daily)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[#667085]">
                              {currentRole === 'Driver' ? (
                                <span className="text-[#0E9384] font-semibold">Rp0 (Driver)</span>
                              ) : (
                                `${formatRupiah(otRate)}/jam`
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                  isEmployeeActive
                                    ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                                    : 'bg-[#F2F4F7] text-[#667085] border-[#D0D5DD]'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isEmployeeActive ? 'bg-[#12B76A]' : 'bg-[#98A2B3]'
                                  }`}
                                ></span>
                                {isEmployeeActive ? 'Aktif di Proyek' : 'Nonaktif'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {/* Detail Button */}
                                <button
                                  onClick={() => {
                                    setSelectedEmployee(asg);
                                    setIsDetailEmployeeModalOpen(true);
                                  }}
                                  className="p-1.5 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF5FF] rounded-lg transition-colors"
                                  title="Lihat Rincian Karyawan"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {isAdmin && (
                                  <>
                                    {/* Edit Button */}
                                    <button
                                      onClick={() => handleOpenEditEmployee(asg)}
                                      className="p-1.5 text-[#667085] hover:text-[#155EEF] hover:bg-[#EFF5FF] rounded-lg transition-colors"
                                      title="Ubah Data Karyawan"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>

                                    {/* Toggle Active / Inactive Status */}
                                    <button
                                      onClick={() => handleToggleEmployeeStatus(asg)}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isEmployeeActive
                                          ? 'text-[#F79009] hover:text-[#B54708] hover:bg-[#FEF6EE]'
                                          : 'text-[#12B76A] hover:text-[#027A48] hover:bg-[#ECFDF3]'
                                      }`}
                                      title={
                                        isEmployeeActive
                                          ? 'Nonaktifkan Karyawan (Riwayat tetap aman)'
                                          : 'Aktifkan Karyawan Kembali'
                                      }
                                    >
                                      {isEmployeeActive ? (
                                        <XCircle className="w-4 h-4" />
                                      ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                      )}
                                    </button>

                                    {/* Delete Assignment from Project */}
                                    <button
                                      onClick={() => handleDeleteProjectEmployee(asg)}
                                      className="p-1.5 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded-lg transition-colors"
                                      title="Hapus Karyawan dari Proyek Ini"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
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
          </div>
        );
      })()}

      {/* SUB-MODULE VIEW B: ABSENSI KARYAWAN */}
      {activeModule === 'absensi' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1D2939]">Presensi & Absensi Karyawan Proyek</h3>
                <p className="text-xs text-[#667085]">
                  Catatan kehadiran harian, durasi lembur, dan kasbon terintegrasi di lokasi proyek {project.name}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#667085]">Filter Tanggal:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
                {attendanceDate && (
                  <button
                    type="button"
                    onClick={() => setAttendanceDate('')}
                    className="text-xs text-[#4693FD] hover:underline px-1"
                  >
                    Semua Tanggal
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openCreateAttendanceModal}
                    className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat Kehadiran</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Nama Karyawan</th>
                    <th className="py-3 px-4">Jabatan</th>
                    <th className="py-3 px-4">Jam Masuk - Pulang</th>
                    <th className="py-3 px-4 text-center">Status Kehadiran</th>
                    <th className="py-3 px-4 text-center">Jam Lembur</th>
                    <th className="py-3 px-4 text-right">Upah Harian</th>
                    <th className="py-3 px-4 text-right">Kasbon</th>
                    <th className="py-3 px-4">Keterangan</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingModuleData ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-[#667085]">
                        Memuat data absensi...
                      </td>
                    </tr>
                  ) : attendanceList.filter((a) => !attendanceDate || a.date === attendanceDate).length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-[#667085]">
                        Belum ada catatan presensi{attendanceDate ? ` pada tanggal ${formatDateID(attendanceDate)}` : ''}.
                      </td>
                    </tr>
                  ) : (
                    attendanceList
                      .filter((a) => !attendanceDate || a.date === attendanceDate)
                      .map((att) => {
                        const hasKasbonData = Boolean(att.kasbonAmount && att.kasbonAmount > 0);
                        const hasKasbonPhoto = Boolean(
                          (att.kasbonAttachments && att.kasbonAttachments.length > 0) ||
                            att.kasbonAttachmentFilePath
                        );

                        return (
                          <tr key={att.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="py-3 px-4 text-[#667085] whitespace-nowrap">{formatDateID(att.date)}</td>
                            <td className="py-3 px-4 font-semibold text-[#1D2939]">{att.employeeName}</td>
                            <td className="py-3 px-4 text-[#475467]">{att.employeeRole}</td>
                            <td className="py-3 px-4 text-[#475467] font-mono">
                              {att.status === 'Hadir' || att.status === 'Setengah Hari'
                                ? `${att.checkIn} - ${att.checkOut}`
                                : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                  att.status === 'Hadir'
                                    ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                                    : att.status === 'Setengah Hari'
                                    ? 'bg-[#F0F9FF] text-[#026AA2] border-[#B9E6FE]'
                                    : att.status === 'Sakit'
                                    ? 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]'
                                    : att.status === 'Izin'
                                    ? 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                                    : 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]'
                                }`}
                              >
                                {att.status === 'Setengah Hari' ? 'Setengah Hari (½)' : att.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              {att.overtimeHours ? formatOvertimeDuration(att.overtimeHours) : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium text-[#1D2939]">
                              <div>{formatRupiah(calculateBasicPayByStatus(att.status, att.dailyWageSnapshot))}</div>
                              {att.status === 'Setengah Hari' && (
                                <span className="text-[10px] text-[#026AA2]">
                                  50% dari {formatRupiah(att.dailyWageSnapshot)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {hasKasbonData ? (
                                <div className="space-y-1">
                                  <div className="font-mono font-semibold text-[#6941C6]">
                                    {formatRupiah(att.kasbonAmount || 0)}
                                  </div>
                                  {att.kasbonNotes && (
                                    <div className="text-[10px] text-[#667085] max-w-[140px] truncate ml-auto">
                                      {att.kasbonNotes}
                                    </div>
                                  )}
                                  {hasKasbonPhoto && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewingProofKasbon({
                                          id: att.kasbonId || att.id,
                                          kasbonNumber: att.kasbonNumber || 'KB-ABSENSI',
                                          employeeId: att.employeeId,
                                          employeeName: att.employeeName,
                                          employeeRole: att.employeeRole,
                                          employeeStartDate: att.date,
                                          requestDate: att.date,
                                          eligibilityDate: att.date,
                                          isEligible: true,
                                          eligibilityReason: 'Kasbon Absensi',
                                          amount: att.kasbonAmount || 0,
                                          reason: att.kasbonNotes || 'Kasbon Absensi',
                                          status: (att.kasbonStatus as any) || 'Disetujui',
                                          deductedAmount: 0,
                                          remainingAmount: att.kasbonAmount || 0,
                                          adminNotes: att.kasbonNotes || '',
                                          attachmentFilePath: att.kasbonAttachmentFilePath,
                                          attachments: att.kasbonAttachments,
                                          auditTrail: [],
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F9F5FF] hover:bg-[#F4EBFF] text-[#6941C6] border border-[#E9D7FE] text-[10px] font-medium transition-colors"
                                    >
                                      <ImageIcon className="w-3 h-3" />
                                      <span>Lihat Bukti</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#98A2B3]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#667085]">{att.notes || '-'}</td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="inline-flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditAttendanceModal(att)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#EFF5FF] text-[#344054] hover:text-[#155EEF] border border-[#D0D5DD] hover:border-[#4693FD] rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                    title="Edit Kehadiran & Kasbon"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteAttendanceModal(att)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#FEF3F2] text-[#D92D20] hover:text-[#B42318] border border-[#FECDCA] hover:border-[#F04438] rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                    title="Hapus Data Absensi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE VIEW C: SISTEM LEMBUR */}
      {activeModule === 'lembur' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1D2939]">Catatan Lembur Tenaga Kerja Proyek</h3>
                <p className="text-xs text-[#667085]">
                  Menampilkan lembur yang terkait dengan penugasan pada proyek {project.name}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Nama Karyawan</th>
                    <th className="py-3 px-4">Jabatan</th>
                    <th className="py-3 px-4">Jam Lembur</th>
                    <th className="py-3 px-4 text-center">Durasi</th>
                    <th className="py-3 px-4 text-right">Tarif / Jam</th>
                    <th className="py-3 px-4 text-right">Total Upah Lembur</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingModuleData ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#667085]">
                        Memuat data lembur...
                      </td>
                    </tr>
                  ) : overtimeList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#667085]">
                        Belum ada data lembur untuk tenaga kerja proyek ini.
                      </td>
                    </tr>
                  ) : (
                    overtimeList.map((ot) => (
                      <tr key={ot.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 text-[#667085]">{formatDateID(ot.date)}</td>
                        <td className="py-3 px-4 font-semibold text-[#1D2939]">{ot.employeeName}</td>
                        <td className="py-3 px-4 text-[#475467]">{ot.employeeRole}</td>
                        <td className="py-3 px-4 text-[#475467]">
                          {ot.startTime} - {ot.endTime}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-[#1D2939]">
                          {formatOvertimeDuration(ot.hours)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#667085]">
                          {formatRupiah(ot.hourlyRateSnapshot)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-[#1D2939]">
                          {formatRupiah(ot.totalPay)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              ot.status === 'Disetujui'
                                ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                                : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                            }`}
                          >
                            {ot.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE VIEW D: KASBON KARYAWAN */}
      {activeModule === 'kasbon' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1D2939]">Kasbon Karyawan Penugasan Proyek</h3>
                <p className="text-xs text-[#667085]">
                  Daftar pinjaman kasbon yang terkait dengan tenaga kerja proyek {project.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F9F5FF] text-[#6941C6] border border-[#E9D7FE]">
                  Total Sisa: {formatRupiah(stats.totalKasbon)}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const defaultEmpId = assignments.find((a) => a.status === 'active' && a.employeeStatus !== 'inactive')?.employeeId || '';
                      setKasbonForm({
                        employeeId: defaultEmpId,
                        requestDate: getTodayDateString(),
                        amount: '',
                        reason: '',
                        adminNotes: '',
                        targetPaymentPeriod: '',
                      });
                      setSelectedKasbonPhoto(null);
                      setKasbonPhotoError(null);
                      setIsAddKasbonModalOpen(true);
                    }}
                    className="bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Kasbon</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">No. Kasbon</th>
                    <th className="py-3 px-4">Nama & ID Karyawan</th>
                    <th className="py-3 px-4">Tanggal Pengajuan</th>
                    <th className="py-3 px-4 text-right">Nominal Awal</th>
                    <th className="py-3 px-4 text-right">Sudah Dipotong</th>
                    <th className="py-3 px-4 text-right">Sisa Kasbon</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Foto Bukti</th>
                    <th className="py-3 px-4">Alasan</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingModuleData ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-[#667085]">
                        Memuat data kasbon...
                      </td>
                    </tr>
                  ) : kasbonList.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-[#667085]">
                        <div className="max-w-xs mx-auto text-center space-y-2">
                          <p>Tidak ada kasbon aktif untuk tenaga kerja proyek ini.</p>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                const defaultEmpId = assignments.find((a) => a.status === 'active' && a.employeeStatus !== 'inactive')?.employeeId || '';
                                setKasbonForm({
                                  employeeId: defaultEmpId,
                                  requestDate: getTodayDateString(),
                                  amount: '',
                                  reason: '',
                                  adminNotes: '',
                                  targetPaymentPeriod: '',
                                });
                                setSelectedKasbonPhoto(null);
                                setKasbonPhotoError(null);
                                setIsAddKasbonModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] rounded-lg font-semibold transition-colors text-xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Catat Kasbon Pertama</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    kasbonList.map((kb) => (
                      <tr key={kb.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#4693FD]">
                          {kb.kasbonNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#1D2939] block">{kb.employeeName}</span>
                          <span className="text-[11px] text-[#667085] font-mono">
                            {kb.employeeId} · {kb.employeeRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#667085]">{formatDateID(kb.requestDate)}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-[#1D2939]">
                          {formatRupiah(kb.amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#027A48]">
                          {formatRupiah(kb.deductedAmount || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#B42318]">
                          {formatRupiah(kb.remainingAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
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
                            {kb.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(kb.attachments && kb.attachments.length > 0) || kb.attachmentFilePath ? (
                            <button
                              onClick={() => setViewingProofKasbon(kb)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] border border-[#D0E2FF] text-xs font-semibold transition-colors shadow-2xs"
                              title="Buka Foto Bukti Kasbon"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{kb.attachments?.length || 1} Foto</span>
                            </button>
                          ) : (
                            <span className="text-[#98A2B3] text-[11px]">Tanpa Foto</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#667085] max-w-[200px] truncate" title={kb.reason}>
                          {kb.reason}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setKasbonToDelete(kb)}
                              className="p-1 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded transition-colors"
                              title="Hapus Kasbon"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE VIEW E: BIAYA TRANSPORTASI PROYEK */}
      {activeModule === 'transport' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1D2939]">Biaya Transportasi Proyek</h3>
                <p className="text-xs text-[#667085]">
                  Pencatatan bensin, tol, parkir, dan armada khusus proyek {project.name}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F0F9FF] text-[#026AA2] border border-[#B9E6FE]">
                Total: {formatRupiah(stats.totalTransportationCost)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">No. Transaksi</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Jenis Kendaraan</th>
                    <th className="py-3 px-4">Tujuan</th>
                    <th className="py-3 px-4">Penanggung Jawab</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                    <th className="py-3 px-4 text-center">Bukti Foto</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingModuleData ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#667085]">
                        Memuat data biaya transportasi...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#667085]">
                        Belum ada biaya transportasi yang dicatat untuk proyek ini.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#4693FD]">
                          {exp.transactionNumber}
                        </td>
                        <td className="py-3 px-4 text-[#667085]">{formatDateID(exp.date)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F2F4F7] text-[#344054]">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#475467]">{exp.transportType || '-'}</td>
                        <td className="py-3 px-4 text-[#475467]">{exp.destination || '-'}</td>
                        <td className="py-3 px-4 font-medium text-[#1D2939]">{exp.picName}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1D2939]">
                          {formatRupiah(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {exp.attachments && exp.attachments.length > 0 ? (
                            <button
                              onClick={() => {
                                setViewingProofExpense(exp);
                                setActivePhotoIndex(0);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] border border-[#D0E2FF] text-xs font-semibold transition-colors shadow-2xs"
                              title="Buka Foto Struk Bukti"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{exp.attachments.length} Foto</span>
                            </button>
                          ) : (
                            <span className="text-[#98A2B3] text-[11px]">Tanpa Foto</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditExpenseClick(exp)}
                                className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF8FF] rounded transition-colors"
                                title="Ubah Biaya Transportasi"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpenseClick(exp)}
                                className="p-1 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded transition-colors"
                                title="Hapus Biaya Transportasi"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE VIEW F: PENGELUARAN OPERASIONAL PROYEK */}
      {activeModule === 'operasional' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1D2939]">Pengeluaran Operasional Proyek</h3>
                <p className="text-xs text-[#667085]">
                  Pengeluaran langsung lapangan: alat kerja, material darurat, konsumsi, dan biaya operasional
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#FDF2FA] text-[#C11574] border border-[#FCCEEE]">
                Total: {formatRupiah(stats.totalOperationalCost)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">No. Transaksi</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Deskripsi Belanja</th>
                    <th className="py-3 px-4">Penanggung Jawab</th>
                    <th className="py-3 px-4">Metode Bayar</th>
                    <th className="py-3 px-4 text-right">Nominal</th>
                    <th className="py-3 px-4 text-center">Bukti Foto</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingModuleData ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#667085]">
                        Memuat data pengeluaran operasional...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#667085]">
                        Belum ada pengeluaran operasional yang dicatat untuk proyek ini.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#4693FD]">
                          {exp.transactionNumber}
                        </td>
                        <td className="py-3 px-4 text-[#667085]">{formatDateID(exp.date)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F2F4F7] text-[#344054]">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#475467] font-medium">{exp.description || '-'}</td>
                        <td className="py-3 px-4 text-[#1D2939]">{exp.picName}</td>
                        <td className="py-3 px-4 text-[#667085]">{exp.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1D2939]">
                          {formatRupiah(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {exp.attachments && exp.attachments.length > 0 ? (
                            <button
                              onClick={() => {
                                setViewingProofExpense(exp);
                                setActivePhotoIndex(0);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] border border-[#D0E2FF] text-xs font-semibold transition-colors shadow-2xs"
                              title="Buka Foto Struk Bukti"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{exp.attachments.length} Foto</span>
                            </button>
                          ) : (
                            <span className="text-[#98A2B3] text-[11px]">Tanpa Foto</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditExpenseClick(exp)}
                                className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF8FF] rounded transition-colors"
                                title="Ubah Pengeluaran"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpenseClick(exp)}
                                className="p-1 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded transition-colors"
                                title="Hapus Pengeluaran"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODULE VIEW H: LAPORAN & REKAPITULASI KOMPREHENSIF PROYEK (H1 - H5) */}
      {activeModule === 'laporan' && (() => {
        const allEmployeeRecaps: ProjectEmployeeRecapItem[] = recapData?.employeeRecaps || [];
        const allTransportExpenses: ProjectExpense[] = recapData?.transportExpenses || [];
        const allOperationalExpenses: ProjectExpense[] = recapData?.operationalExpenses || [];

        // Filtered employee recaps for H1 & H2
        const filteredEmployeeRecaps = allEmployeeRecaps.filter((emp) => {
          const matchRole =
            reportRoleFilter === 'ALL' ||
            emp.role.toLowerCase() === reportRoleFilter.toLowerCase() ||
            (reportRoleFilter === 'Helper' && (emp.role === 'Helper' || emp.role === 'Kenek'));
          const matchEmp =
            activeReportSubmenu !== 'h1' ||
            reportEmployeeFilter === 'ALL' ||
            emp.employeeId === reportEmployeeFilter;
          return matchRole && matchEmp;
        });

        // Filtered transport expenses for H3
        const transportCategories = Array.from(new Set(allTransportExpenses.map((e) => e.category).filter(Boolean)));
        const filteredTransportExpenses = allTransportExpenses.filter((e) =>
          reportCategoryFilter === 'ALL' ? true : e.category === reportCategoryFilter
        );

        // Filtered operational expenses for H4
        const operationalCategories = Array.from(new Set(allOperationalExpenses.map((e) => e.category).filter(Boolean)));
        const filteredOperationalExpenses = allOperationalExpenses.filter((e) =>
          reportCategoryFilter === 'ALL' ? true : e.category === reportCategoryFilter
        );

        // Computed summary (reflecting active period and role/category filters where applicable)
        const rawSummary: ProjectRecapSummaryData = recapData?.summary || {
          totalEmployees: stats.totalAssignedEmployees,
          totalRecapEmployees: allEmployeeRecaps.length,
          fullWorkDays: 0,
          halfWorkDays: 0,
          absentDays: 0,
          totalWorkDays: 0,
          fullDaySalary: 0,
          halfDaySalary: 0,
          totalBasicSalary: 0,
          totalOvertimeHours: 0,
          totalOvertimePay: 0,
          totalGrossSalary: 0,
          totalKasbonInPeriod: 0,
          totalKasbonDeduction: 0,
          totalRemainingKasbon: 0,
          totalOtherDeductions: 0,
          totalNetSalary: 0,
          paidPayrollTotal: 0,
          unpaidPayrollTotal: 0,
          totalTransport: stats.totalTransportationCost,
          totalOp: stats.totalOperationalCost,
          totalOtherCost: 0,
          totalProjectCost: stats.totalTransportationCost + stats.totalOperationalCost,
          budget: project.budget,
          budgetRemaining: stats.budgetRemaining,
          realizationPercentage: stats.realizationPercentage,
        };

        // H2 Totals based on filteredEmployeeRecaps
        const h2Totals = {
          count: filteredEmployeeRecaps.length,
          fullWorkDays: filteredEmployeeRecaps.reduce((s, r) => s + r.fullWorkDays, 0),
          halfWorkDays: filteredEmployeeRecaps.reduce((s, r) => s + r.halfWorkDays, 0),
          absentDays: filteredEmployeeRecaps.reduce((s, r) => s + r.absentDays, 0),
          totalWorkDays: filteredEmployeeRecaps.reduce((s, r) => s + r.totalWorkDays, 0),
          fullDaySalary: filteredEmployeeRecaps.reduce((s, r) => s + r.fullDaySalary, 0),
          halfDaySalary: filteredEmployeeRecaps.reduce((s, r) => s + r.halfDaySalary, 0),
          totalBasicSalary: filteredEmployeeRecaps.reduce((s, r) => s + r.totalBasicSalary, 0),
          overtimeHours: Number(filteredEmployeeRecaps.reduce((s, r) => s + r.overtimeHours, 0).toFixed(4)),
          totalOvertimePay: filteredEmployeeRecaps.reduce((s, r) => s + r.totalOvertimePay, 0),
          grossSalary: filteredEmployeeRecaps.reduce((s, r) => s + r.grossSalary, 0),
          kasbonInPeriod: filteredEmployeeRecaps.reduce((s, r) => s + r.kasbonInPeriod, 0),
          kasbonDeduction: filteredEmployeeRecaps.reduce((s, r) => s + r.kasbonDeduction, 0),
          remainingKasbon: filteredEmployeeRecaps.reduce((s, r) => s + r.remainingKasbon, 0),
          netSalary: filteredEmployeeRecaps.reduce((s, r) => s + r.netSalary, 0),
        };

        const h3TotalAmount = filteredTransportExpenses.reduce((s, e) => s + e.amount, 0);
        const h4TotalAmount = filteredOperationalExpenses.reduce((s, e) => s + e.amount, 0);

        const periodDisplayLabel =
          appliedStartDate && appliedEndDate
            ? `${formatDateID(appliedStartDate)} s/d ${formatDateID(appliedEndDate)}`
            : 'Semua Periode Proyek (Kumulatif)';

        const submenuMeta: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5', { code: string; title: string; subtitle: string }> = {
          h1: {
            code: 'H1',
            title: 'H1. Rekap Gaji Per Karyawan',
            subtitle: 'Rincian lengkap kehadiran harian, setengah hari, jam lembur aktual, kasbon, gaji kotor, dan gaji bersih per individu.',
          },
          h2: {
            code: 'H2',
            title: 'H2. Rekap Total Gaji Seluruh Karyawan',
            subtitle: 'Ringkasan tabel kolektif gaji seluruh tenaga kerja proyek beserta akumulasi grand total komponen pengupahan.',
          },
          h3: {
            code: 'H3',
            title: 'H3. Rekap Biaya Transportasi Proyek',
            subtitle: 'Daftar transaksi biaya transportasi proyek (BBM, tol, parkir, ongkos & armada) lengkap dengan bukti foto.',
          },
          h4: {
            code: 'H4',
            title: 'H4. Rekap Biaya Pengeluaran Operasional Lapangan',
            subtitle: 'Daftar pengeluaran operasional lapangan proyek (material kecil, alat kerja, konsumsi & darurat) beserta struk bukti.',
          },
          h5: {
            code: 'H5',
            title: 'H5. Rekap Seluruh Pengeluaran Proyek',
            subtitle: 'Ringkasan eksekutif penggabungan total gaji karyawan, transportasi, operasional lapangan, sisa anggaran, dan persentase realisasi.',
          },
        };

        const handleApplyReportFilter = () => {
          if ((reportStartDate && !reportEndDate) || (!reportStartDate && reportEndDate)) {
            showToast('error', 'Pilih Tanggal Mulai dan Tanggal Akhir secara lengkap, atau kosongkan keduanya untuk Semua Periode.');
            return;
          }
          if (reportStartDate && reportEndDate && reportStartDate > reportEndDate) {
            showToast('error', 'Tanggal Mulai tidak boleh lebih besar dari Tanggal Akhir.');
            return;
          }
          setAppliedStartDate(reportStartDate);
          setAppliedEndDate(reportEndDate);
          fetchProjectRecapData(reportStartDate, reportEndDate);
          showToast('info', 'Filter laporan proyek berhasil diterapkan.');
        };

        const handleResetReportFilter = () => {
          setReportStartDate('');
          setReportEndDate('');
          setAppliedStartDate('');
          setAppliedEndDate('');
          setReportRoleFilter('ALL');
          setReportEmployeeFilter('ALL');
          setReportCategoryFilter('ALL');
          fetchProjectRecapData(undefined, undefined);
          showToast('info', 'Filter laporan direset ke Semua Periode.');
        };

        const handleQuickPeriodPreset = (preset: 'all' | '14days' | 'month') => {
          if (preset === 'all') {
            setReportStartDate('');
            setReportEndDate('');
            setAppliedStartDate('');
            setAppliedEndDate('');
            fetchProjectRecapData(undefined, undefined);
            return;
          }
          const now = new Date();
          const endStr = now.toISOString().split('T')[0];
          if (preset === '14days') {
            const start = new Date(now);
            start.setDate(now.getDate() - 13);
            const startStr = start.toISOString().split('T')[0];
            setReportStartDate(startStr);
            setReportEndDate(endStr);
            setAppliedStartDate(startStr);
            setAppliedEndDate(endStr);
            fetchProjectRecapData(startStr, endStr);
          } else if (preset === 'month') {
            const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            setReportStartDate(startStr);
            setReportEndDate(endStr);
            setAppliedStartDate(startStr);
            setAppliedEndDate(endStr);
            fetchProjectRecapData(startStr, endStr);
          }
        };

        const handleExportCurrentSubmenuPDF = (singleEmp?: ProjectEmployeeRecapItem) => {
          exportProjectReportPDF({
            submenu: activeReportSubmenu,
            project,
            employeeRecaps: filteredEmployeeRecaps,
            selectedEmployee: singleEmp || null,
            transportExpenses: filteredTransportExpenses,
            operationalExpenses: filteredOperationalExpenses,
            summary: rawSummary,
            startDate: appliedStartDate || undefined,
            endDate: appliedEndDate || undefined,
            roleFilter: reportRoleFilter,
            categoryFilter: reportCategoryFilter,
          });
          showToast('success', `Dokumen PDF ${submenuMeta[activeReportSubmenu].code} berhasil diunduh.`);
        };

        const handleExportCurrentSubmenuExcel = (singleEmp?: ProjectEmployeeRecapItem) => {
          exportProjectReportExcel({
            submenu: activeReportSubmenu,
            project,
            employeeRecaps: filteredEmployeeRecaps,
            selectedEmployee: singleEmp || null,
            transportExpenses: filteredTransportExpenses,
            operationalExpenses: filteredOperationalExpenses,
            summary: rawSummary,
            startDate: appliedStartDate || undefined,
            endDate: appliedEndDate || undefined,
          });
          showToast('success', `File Excel (.xlsx) ${submenuMeta[activeReportSubmenu].code} berhasil diunduh.`);
        };

        const handleDirectPrint = () => {
          window.print();
        };

        return (
          <div className="space-y-5">
            {/* 1. SUBMENU NAVIGATION BAR (H1 - H5) */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-3 shadow-xs print:hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#F2F4F7]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                      BAGIAN H
                    </span>
                    <h2 className="text-base font-bold text-[#1D2939]">
                      Laporan & Rekapitulasi Komprehensif Proyek — {project.name} ({project.code})
                    </h2>
                  </div>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Pilih salah satu dari 5 submenu di bawah untuk melihat rincian, memfilter periode, mencetak PDF, Print langsung, atau mengekspor ke Excel.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportCurrentSubmenuPDF()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Cetak PDF ({submenuMeta[activeReportSubmenu].code})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectPrint}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1D2939] hover:bg-[#344054] text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Laporan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCurrentSubmenuExcel()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#027A48] hover:bg-[#05603A] text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Ekspor Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {(
                  [
                    { id: 'h1', code: 'H1', label: 'Rekap Gaji Per Karyawan', badge: `${allEmployeeRecaps.length} Orang` },
                    { id: 'h2', code: 'H2', label: 'Rekap Total Gaji Seluruh Karyawan', badge: formatRupiah(rawSummary.totalNetSalary) },
                    { id: 'h3', code: 'H3', label: 'Rekap Biaya Transportasi Proyek', badge: formatRupiah(rawSummary.totalTransport) },
                    { id: 'h4', code: 'H4', label: 'Rekap Operasional Lapangan', badge: formatRupiah(rawSummary.totalOp) },
                    { id: 'h5', code: 'H5', label: 'Rekap Seluruh Pengeluaran Proyek', badge: `${rawSummary.realizationPercentage}% Anggaran` },
                  ] as const
                ).map((tab) => {
                  const isActive = activeReportSubmenu === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveReportSubmenu(tab.id);
                        setReportCategoryFilter('ALL');
                      }}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                        isActive
                          ? 'bg-[#EFF5FF] border-[#4693FD] ring-2 ring-[#4693FD]/20 shadow-xs'
                          : 'bg-[#F9FAFB] border-[#EAECF0] hover:bg-white hover:border-[#D0D5DD]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            isActive ? 'bg-[#155EEF] text-white' : 'bg-white text-[#344054] border border-[#D0D5DD]'
                          }`}
                        >
                          {tab.code}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-[#475467] truncate">
                          {tab.badge}
                        </span>
                      </div>
                      <p className={`text-xs font-bold mt-2 line-clamp-1 ${isActive ? 'text-[#155EEF]' : 'text-[#1D2939]'}`}>
                        {tab.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. FILTER BAR FOR REPORTS (H1 - H5) */}
            <div className="bg-white rounded-2xl border border-[#EAECF0] p-4 shadow-xs space-y-3 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#4693FD]" />
                  <span className="text-xs font-bold text-[#1D2939]">Filter Periode & Kriteria Laporan</span>
                  <span className="text-[11px] text-[#667085]">
                    (Periode Aktif: <strong className="text-[#155EEF]">{periodDisplayLabel}</strong>)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[#667085] mr-1">Pilihan Cepat:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriodPreset('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                      !appliedStartDate && !appliedEndDate
                        ? 'bg-[#EFF5FF] text-[#155EEF] border-[#4693FD]'
                        : 'bg-[#F9FAFB] text-[#475467] border-[#EAECF0] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    Semua Periode
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriodPreset('14days')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F9FAFB] text-[#475467] border border-[#EAECF0] hover:bg-[#F2F4F7] transition-colors"
                  >
                    2 Mingguan (14 Hari Terakhir)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPeriodPreset('month')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F9FAFB] text-[#475467] border border-[#EAECF0] hover:bg-[#F2F4F7] transition-colors"
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475467] mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#475467] mb-1">Tanggal Akhir</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl focus:outline-none focus:border-[#4693FD]"
                  />
                </div>

                {/* Role filter for H1 & H2 */}
                {(activeReportSubmenu === 'h1' || activeReportSubmenu === 'h2') && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475467] mb-1">Filter Jabatan</label>
                    <select
                      value={reportRoleFilter}
                      onChange={(e) => setReportRoleFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl bg-white focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="ALL">Semua Jabatan</option>
                      <option value="Mandor">Mandor</option>
                      <option value="Tukang">Tukang</option>
                      <option value="Helper">Helper / Kenek</option>
                      <option value="Driver">Driver</option>
                    </select>
                  </div>
                )}

                {/* Specific employee filter for H1 */}
                {activeReportSubmenu === 'h1' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475467] mb-1">Pilih Karyawan Proyek</label>
                    <select
                      value={reportEmployeeFilter}
                      onChange={(e) => setReportEmployeeFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl bg-white focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="ALL">Semua Karyawan ({allEmployeeRecaps.length} Orang)</option>
                      {allEmployeeRecaps.map((emp) => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          [{emp.employeeId}] {emp.employeeName} — {emp.role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Category filter for H3 */}
                {activeReportSubmenu === 'h3' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#475467] mb-1">Filter Kategori Transportasi</label>
                    <select
                      value={reportCategoryFilter}
                      onChange={(e) => setReportCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl bg-white focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="ALL">Semua Kategori Transportasi</option>
                      {transportCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Category filter for H4 */}
                {activeReportSubmenu === 'h4' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#475467] mb-1">Filter Kategori Operasional</label>
                    <select
                      value={reportCategoryFilter}
                      onChange={(e) => setReportCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl bg-white focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="ALL">Semua Kategori Operasional</option>
                      {operationalCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyReportFilter}
                    className="flex-1 bg-[#4693FD] hover:bg-[#1849A9] text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    Terapkan Filter
                  </button>
                  <button
                    type="button"
                    onClick={handleResetReportFilter}
                    className="px-3 py-2 rounded-xl border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] text-[#475467] text-xs font-semibold transition-colors"
                    title="Reset Filter"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* 3. PRINTABLE & INTERACTIVE REPORT CONTAINER */}
            {loadingModuleData ? (
              <div className="bg-white rounded-2xl border border-[#EAECF0] p-12 text-center text-xs text-[#667085]">
                Memuat data rekapitulasi proyek {project.name}...
              </div>
            ) : (
              <div id="project-report-printable" className="space-y-5">
                {/* OFFICIAL REPORT HEADER (Visible on Print and as Banner in UI) */}
                <div className="bg-white rounded-2xl border border-[#EAECF0] p-5 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#EAECF0] pb-4">
                    <div>
                      <p className="text-[11px] font-bold tracking-wider uppercase text-[#155EEF]">
                        PT ASTA BRATA MATAHARI TERBIT
                      </p>
                      <h3 className="text-lg font-bold text-[#1D2939] mt-0.5">
                        {submenuMeta[activeReportSubmenu].title}
                      </h3>
                      <p className="text-xs text-[#667085] mt-0.5">{submenuMeta[activeReportSubmenu].subtitle}</p>
                    </div>
                    <div className="text-left md:text-right text-xs space-y-0.5 bg-[#F8F9FA] px-4 py-2.5 rounded-xl border border-[#EAECF0]">
                      <div>
                        <span className="text-[#667085]">Proyek: </span>
                        <strong className="text-[#1D2939]">{project.name} ({project.code})</strong>
                      </div>
                      <div>
                        <span className="text-[#667085]">Lokasi: </span>
                        <span className="font-medium text-[#344054]">{project.location || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[#667085]">Periode Rekap: </span>
                        <strong className="text-[#155EEF]">{periodDisplayLabel}</strong>
                      </div>
                    </div>
                  </div>

                  {/* ========================================================== */}
                  {/* SUBMENU H1: REKAP GAJI PER KARYAWAN                        */}
                  {/* ========================================================== */}
                  {activeReportSubmenu === 'h1' && (
                    <div className="mt-4 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0] print:hidden">
                        <div className="text-xs text-[#475467]">
                          Menampilkan <strong>{filteredEmployeeRecaps.length}</strong> karyawan proyek {project.name}.
                          Klik <strong>Lihat Detail</strong> atau <strong>Cetak Slip Gaji</strong> pada masing-masing karyawan, atau cetak kolektif.
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!filteredEmployeeRecaps.length) {
                                showToast('error', 'Tidak ada data karyawan untuk dicetak.');
                                return;
                              }
                              setSlipGajiModalEmployees(filteredEmployeeRecaps);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF5FF] hover:bg-[#D0E2FF] text-[#155EEF] border border-[#D0E2FF] text-xs font-semibold transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Preview & Cetak Semua Slip Gaji ({filteredEmployeeRecaps.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportProjectSlipGajiPDF({
                                project,
                                employees: filteredEmployeeRecaps,
                                startDate: appliedStartDate || undefined,
                                endDate: appliedEndDate || undefined,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#155EEF] hover:bg-[#1849A9] text-white text-xs font-semibold transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh PDF Semua Slip Gaji</span>
                          </button>
                        </div>
                      </div>

                      {filteredEmployeeRecaps.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#667085] border border-dashed border-[#D0D5DD] rounded-xl">
                          Tidak ada data karyawan yang sesuai dengan filter pada proyek ini.
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {filteredEmployeeRecaps.map((emp, idx) => {
                            const isDriver = isDriverRole(emp.role);
                            const sortedAtt = (emp.attendanceRecords || [])
                              .slice()
                              .sort((a, b) => a.date.localeCompare(b.date));

                            return (
                              <div
                                key={emp.employeeId}
                                className="rounded-2xl border border-[#D0D5DD] bg-white overflow-hidden shadow-2xs break-inside-avoid"
                              >
                                {/* Employee Card Header */}
                                <div className="bg-[#F8F9FA] p-4 border-b border-[#EAECF0] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#1D2939] text-white font-mono">
                                        #{idx + 1} • {emp.employeeId}
                                      </span>
                                      <h4 className="text-base font-bold text-[#1D2939]">{emp.employeeName}</h4>
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                                        {emp.role}
                                      </span>
                                      {isDriver && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FEF6EE] text-[#B54708] border border-[#F9DBAF]">
                                          Driver (Tanpa Upah Lembur)
                                        </span>
                                      )}
                                      {emp.status === 'inactive' && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
                                          Nonaktif (Riwayat Transaksi)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475467]">
                                      <span>
                                        Tarif Harian: <strong className="font-mono text-[#1D2939]">{formatRupiah(emp.dailyWage)}</strong>
                                      </span>
                                      <span>
                                        Tarif Setengah Hari: <strong className="font-mono text-[#1D2939]">{formatRupiah(Math.round(emp.dailyWage / 2))}</strong>
                                      </span>
                                      <span>
                                        Tarif Lembur/Jam:{' '}
                                        <strong className="font-mono text-[#1D2939]">
                                          {isDriver ? 'Rp 0 (Driver)' : formatRupiah(emp.overtimeHourlyWage)}
                                        </strong>
                                      </span>
                                      <span>
                                        Status Gaji: <strong className="text-[#155EEF]">{emp.paymentStatusLabel}</strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Individual Action Buttons */}
                                  <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedH1EmployeeDetail(emp)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] text-xs font-semibold transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#4693FD]" />
                                      <span>Lihat Detail</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSlipGajiModalEmployees([emp])}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EFF5FF] hover:bg-[#D0E2FF] text-[#155EEF] border border-[#D0E2FF] text-xs font-semibold transition-colors"
                                    >
                                      <Receipt className="w-3.5 h-3.5" />
                                      <span>Cetak Slip Gaji</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExportCurrentSubmenuPDF(emp)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] text-xs font-semibold transition-colors"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>PDF</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExportCurrentSubmenuExcel(emp)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#ECFDF3] hover:bg-[#D1FADF] text-[#027A48] border border-[#A6F4C5] text-xs font-semibold transition-colors"
                                    >
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                      <span>Excel</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Employee Summary Metrics Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-4 bg-white border-b border-[#EAECF0] text-xs">
                                  <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0]">
                                    <span className="text-[11px] text-[#667085] block">Kehadiran Kerja</span>
                                    <p className="font-bold text-[#1D2939] mt-0.5">
                                      {emp.fullWorkDays} Penuh • {emp.halfWorkDays} Setengah
                                    </p>
                                    <span className="text-[10px] text-[#667085]">
                                      Efektif: {emp.totalWorkDays} hari | Absen: {emp.absentDays}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0]">
                                    <span className="text-[11px] text-[#667085] block">Total Gaji Pokok</span>
                                    <p className="font-bold text-[#1D2939] font-mono mt-0.5">
                                      {formatRupiah(emp.totalBasicSalary)}
                                    </p>
                                    <span className="text-[10px] text-[#667085]">
                                      Penuh: {formatRupiah(emp.fullDaySalary)} | 1/2: {formatRupiah(emp.halfDaySalary)}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-[#FEF6EE] border border-[#F9DBAF]">
                                    <span className="text-[11px] text-[#B54708] block">Total Lembur</span>
                                    <p className="font-bold text-[#B54708] font-mono mt-0.5">
                                      {formatRupiah(emp.totalOvertimePay)}
                                    </p>
                                    <span className="text-[10px] text-[#B54708]">
                                      Durasi: {formatOvertimeDuration(emp.overtimeHours)}
                                      {isDriver ? ' (Driver Rp 0)' : ''}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-[#EFF5FF] border border-[#D0E2FF]">
                                    <span className="text-[11px] text-[#155EEF] block">Total Gaji Kotor</span>
                                    <p className="font-bold text-[#155EEF] font-mono mt-0.5">
                                      {formatRupiah(emp.grossSalary)}
                                    </p>
                                    <span className="text-[10px] text-[#155EEF]">Gaji Pokok + Upah Lembur</span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA]">
                                    <span className="text-[11px] text-[#B42318] block">Kasbon & Potongan</span>
                                    <p className="font-bold text-[#B42318] font-mono mt-0.5">
                                      - {formatRupiah(emp.kasbonDeduction)}
                                    </p>
                                    <span className="text-[10px] text-[#B42318]">
                                      Pinjaman: {formatRupiah(emp.kasbonInPeriod)} | Sisa: {formatRupiah(emp.remainingKasbon)}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5]">
                                    <span className="text-[11px] text-[#027A48] font-semibold block">Gaji Bersih Diterima</span>
                                    <p className="text-sm font-bold text-[#027A48] font-mono mt-0.5">
                                      {formatRupiah(emp.netSalary)}
                                    </p>
                                    <span className="text-[10px] text-[#027A48]">Take Home Pay</span>
                                  </div>
                                </div>

                                {/* Daily Work History Table inside H1 */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-[#F9FAFB] text-[#475467] font-semibold border-b border-[#EAECF0]">
                                      <tr>
                                        <th className="py-2.5 px-3">No</th>
                                        <th className="py-2.5 px-3">Tanggal</th>
                                        <th className="py-2.5 px-3">Status Kehadiran</th>
                                        <th className="py-2.5 px-3">Jam Kerja</th>
                                        <th className="py-2.5 px-3 text-right">Upah Pokok</th>
                                        <th className="py-2.5 px-3 text-center">Durasi Lembur</th>
                                        <th className="py-2.5 px-3 text-right">Upah Lembur</th>
                                        <th className="py-2.5 px-3 text-right">Kasbon Hari Itu</th>
                                        <th className="py-2.5 px-3 text-right">Total Upah Harian</th>
                                        <th className="py-2.5 px-3">Catatan</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                                      {sortedAtt.length === 0 ? (
                                        <tr>
                                          <td colSpan={10} className="py-4 px-3 text-center text-[#98A2B3]">
                                            Belum ada riwayat kehadiran harian tercatat pada periode ini.
                                          </td>
                                        </tr>
                                      ) : (
                                        sortedAtt.map((att, rIdx) => {
                                          const dayBasic =
                                            att.status === 'Hadir'
                                              ? att.dailyWageSnapshot || emp.dailyWage
                                              : att.status === 'Setengah Hari'
                                              ? Math.round((att.dailyWageSnapshot || emp.dailyWage) / 2)
                                              : 0;
                                          const dayOtPay = isDriver
                                            ? 0
                                            : att.overtimeApproved && att.overtimeHours > 0
                                            ? Math.round(att.overtimeHours * (att.overtimeWageSnapshot || emp.overtimeHourlyWage))
                                            : 0;
                                          const dayKb = att.hasKasbon && att.kasbonAmount ? att.kasbonAmount : 0;

                                          return (
                                            <tr key={att.id || rIdx} className="hover:bg-[#F9FAFB]">
                                              <td className="py-2 px-3 font-mono text-[#667085]">{rIdx + 1}</td>
                                              <td className="py-2 px-3 font-medium text-[#1D2939]">{formatDateID(att.date)}</td>
                                              <td className="py-2 px-3">
                                                <span
                                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                    att.status === 'Hadir'
                                                      ? 'bg-[#ECFDF3] text-[#027A48]'
                                                      : att.status === 'Setengah Hari'
                                                      ? 'bg-[#F0F9FF] text-[#026AA2]'
                                                      : 'bg-[#FEF3F2] text-[#B42318]'
                                                  }`}
                                                >
                                                  {att.status}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 font-mono text-[11px] text-[#667085]">
                                                {att.checkIn || '-'} - {att.checkOut || '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-medium text-[#1D2939]">
                                                {formatRupiah(dayBasic)}
                                              </td>
                                              <td className="py-2 px-3 text-center font-mono text-[11px] text-[#B54708]">
                                                {att.overtimeHours > 0 ? formatOvertimeDuration(att.overtimeHours) : '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-[#B54708]">
                                                {isDriver && att.overtimeHours > 0
                                                  ? 'Rp 0 (Driver)'
                                                  : formatRupiah(dayOtPay)}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-[#B42318]">
                                                {dayKb > 0 ? formatRupiah(dayKb) : '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-bold text-[#155EEF]">
                                                {formatRupiah(dayBasic + dayOtPay)}
                                              </td>
                                              <td className="py-2 px-3 text-[#667085] max-w-[200px] truncate">
                                                {att.notes || att.kasbonNotes || '-'}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ========================================================== */}
                  {/* SUBMENU H2: REKAP TOTAL GAJI SELURUH KARYAWAN              */}
                  {/* ========================================================== */}
                  {activeReportSubmenu === 'h2' && (
                    <div className="mt-4 space-y-4">
                      {/* H2 Action Bar for Cetak PDF and Print */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8F9FA] p-3.5 rounded-xl border border-[#EAECF0] print:hidden shadow-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                              H2
                            </span>
                            <h4 className="text-xs font-bold text-[#1D2939]">
                              Rekapitulasi Total Penggajian Proyek ({filteredEmployeeRecaps.length} Karyawan)
                            </h4>
                          </div>
                          <p className="text-[11px] text-[#667085]">
                            Periode: <strong className="text-[#1D2939]">{periodDisplayLabel}</strong> • Cetak dokumen PDF resmi atau cetak langsung via printer browser
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportCurrentSubmenuPDF()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-semibold transition-colors shadow-xs"
                            title="Unduh Dokumen PDF Rekapitulasi Total Gaji H2"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Cetak PDF Rekap H2</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDirectPrint}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1D2939] hover:bg-[#344054] text-white text-xs font-semibold transition-colors shadow-xs"
                            title="Print Langsung Halaman / Dialog Cetak Browser"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Langsung</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCurrentSubmenuExcel()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#027A48] hover:bg-[#05603A] text-white text-xs font-semibold transition-colors shadow-xs"
                            title="Ekspor Data Rekap ke Microsoft Excel"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Ekspor Excel (.xlsx)</span>
                          </button>
                        </div>
                      </div>

                      {/* H2 Top Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#EAECF0]">
                          <span className="text-[11px] text-[#667085] block">Total Karyawan</span>
                          <p className="text-lg font-bold text-[#1D2939] font-mono mt-0.5">{h2Totals.count} Orang</p>
                          <span className="text-[10px] text-[#667085]">
                            {h2Totals.fullWorkDays} Penuh • {h2Totals.halfWorkDays} Setengah
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#EAECF0]">
                          <span className="text-[11px] text-[#667085] block">Total Gaji Pokok</span>
                          <p className="text-base font-bold text-[#1D2939] font-mono mt-0.5">
                            {formatRupiah(h2Totals.totalBasicSalary)}
                          </p>
                          <span className="text-[10px] text-[#667085]">{h2Totals.totalWorkDays} Hari Efektif</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#FEF6EE] border border-[#F9DBAF]">
                          <span className="text-[11px] text-[#B54708] block">Total Upah Lembur</span>
                          <p className="text-base font-bold text-[#B54708] font-mono mt-0.5">
                            {formatRupiah(h2Totals.totalOvertimePay)}
                          </p>
                          <span className="text-[10px] text-[#B54708]">{formatOvertimeDuration(h2Totals.overtimeHours)}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#EFF5FF] border border-[#D0E2FF]">
                          <span className="text-[11px] text-[#155EEF] block">Total Gaji Kotor</span>
                          <p className="text-base font-bold text-[#155EEF] font-mono mt-0.5">
                            {formatRupiah(h2Totals.grossSalary)}
                          </p>
                          <span className="text-[10px] text-[#155EEF]">Pokok + Lembur</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA]">
                          <span className="text-[11px] text-[#B42318] block">Total Potongan Kasbon</span>
                          <p className="text-base font-bold text-[#B42318] font-mono mt-0.5">
                            - {formatRupiah(h2Totals.kasbonDeduction)}
                          </p>
                          <span className="text-[10px] text-[#B42318]">
                            Sisa Kasbon: {formatRupiah(h2Totals.remainingKasbon)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5]">
                          <span className="text-[11px] text-[#027A48] font-semibold block">Total Gaji Bersih</span>
                          <p className="text-base font-bold text-[#027A48] font-mono mt-0.5">
                            {formatRupiah(h2Totals.netSalary)}
                          </p>
                          <span className="text-[10px] text-[#027A48]">Seluruh Karyawan</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-[#EAECF0] rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1D2939] text-white font-semibold">
                            <tr>
                              <th className="py-3 px-2.5">No</th>
                              <th className="py-3 px-2.5">ID</th>
                              <th className="py-3 px-3">Nama Karyawan</th>
                              <th className="py-3 px-2.5">Jabatan</th>
                              <th className="py-3 px-2 text-center">Penuh</th>
                              <th className="py-3 px-2 text-center">1/2 Hr</th>
                              <th className="py-3 px-2 text-center">Absen</th>
                              <th className="py-3 px-2.5 text-right">Tarif/Hr</th>
                              <th className="py-3 px-2.5 text-right">Total Gaji Pokok</th>
                              <th className="py-3 px-2.5 text-center">Jam Lembur</th>
                              <th className="py-3 px-2.5 text-right">Tarif OT</th>
                              <th className="py-3 px-2.5 text-right">Total Upah Lembur</th>
                              <th className="py-3 px-2.5 text-right">Total Gaji Kotor</th>
                              <th className="py-3 px-2.5 text-right">Total Kasbon</th>
                              <th className="py-3 px-2.5 text-right">Pot. Kasbon</th>
                              <th className="py-3 px-2.5 text-right">Sisa Kasbon</th>
                              <th className="py-3 px-3 text-right">Gaji Bersih</th>
                              <th className="py-3 px-2.5 text-center print:hidden">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                            {filteredEmployeeRecaps.length === 0 ? (
                              <tr>
                                <td colSpan={18} className="py-8 text-center text-[#667085]">
                                  Tidak ada data rekap gaji karyawan pada periode ini.
                                </td>
                              </tr>
                            ) : (
                              filteredEmployeeRecaps.map((r, i) => {
                                const isDriver = isDriverRole(r.role);
                                return (
                                  <tr key={r.employeeId} className="hover:bg-[#F9FAFB]">
                                    <td className="py-2.5 px-2.5 font-mono text-[#667085]">{i + 1}</td>
                                    <td className="py-2.5 px-2.5 font-mono text-[11px] font-semibold text-[#344054]">
                                      {r.employeeId}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-[#1D2939]">{r.employeeName}</td>
                                    <td className="py-2.5 px-2.5">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EFF5FF] text-[#155EEF]">
                                        {r.role}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-semibold text-[#027A48]">
                                      {r.fullWorkDays}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono font-semibold text-[#026AA2]">
                                      {r.halfWorkDays}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-mono text-[#B42318]">
                                      {r.absentDays}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono text-[#475467]">
                                      {formatRupiah(r.dailyWage)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-[#1D2939]">
                                      {formatRupiah(r.totalBasicSalary)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-[#B54708]">
                                      {r.overtimeHours > 0 ? formatOvertimeDuration(r.overtimeHours) : '-'}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono text-[#667085]">
                                      {isDriver ? 'Rp 0' : formatRupiah(r.overtimeHourlyWage)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-[#B54708]">
                                      {formatRupiah(r.totalOvertimePay)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-bold text-[#155EEF]">
                                      {formatRupiah(r.grossSalary)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono text-[#475467]">
                                      {formatRupiah(r.kasbonInPeriod)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-[#B42318]">
                                      {r.kasbonDeduction > 0 ? `- ${formatRupiah(r.kasbonDeduction)}` : 'Rp 0'}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-mono text-[#667085]">
                                      {formatRupiah(r.remainingKasbon)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#027A48] bg-[#ECFDF3]/40">
                                      {formatRupiah(r.netSalary)}
                                    </td>
                                    <td className="py-2.5 px-2.5 text-center print:hidden">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedH1EmployeeDetail(r)}
                                          className="p-1 rounded hover:bg-[#EFF5FF] text-[#4693FD]"
                                          title="Lihat Detail Harian Karyawan"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setSlipGajiModalEmployees([r])}
                                          className="p-1 rounded hover:bg-[#ECFDF3] text-[#027A48]"
                                          title="Cetak Slip Gaji Karyawan"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          <tfoot className="bg-[#EFF5FF] font-bold text-[#1D2939] border-t-2 border-[#4693FD]">
                            <tr>
                              <td colSpan={4} className="py-3 px-3 text-xs uppercase text-[#155EEF]">
                                GRAND TOTAL ({h2Totals.count} Karyawan Proyek {project.name})
                              </td>
                              <td className="py-3 px-2 text-center font-mono text-[#027A48]">{h2Totals.fullWorkDays}</td>
                              <td className="py-3 px-2 text-center font-mono text-[#026AA2]">{h2Totals.halfWorkDays}</td>
                              <td className="py-3 px-2 text-center font-mono text-[#B42318]">{h2Totals.absentDays}</td>
                              <td className="py-3 px-2.5 text-right font-mono">-</td>
                              <td className="py-3 px-2.5 text-right font-mono text-[#1D2939]">
                                {formatRupiah(h2Totals.totalBasicSalary)}
                              </td>
                              <td className="py-3 px-2.5 text-center font-mono text-[11px] text-[#B54708]">
                                {formatOvertimeDuration(h2Totals.overtimeHours)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono">-</td>
                              <td className="py-3 px-2.5 text-right font-mono text-[#B54708]">
                                {formatRupiah(h2Totals.totalOvertimePay)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono text-[#155EEF]">
                                {formatRupiah(h2Totals.grossSalary)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono text-[#344054]">
                                {formatRupiah(h2Totals.kasbonInPeriod)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono text-[#B42318]">
                                - {formatRupiah(h2Totals.kasbonDeduction)}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono text-[#475467]">
                                {formatRupiah(h2Totals.remainingKasbon)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sm text-[#027A48]">
                                {formatRupiah(h2Totals.netSalary)}
                              </td>
                              <td className="py-3 px-2.5 print:hidden"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ========================================================== */}
                  {/* SUBMENU H3: REKAP BIAYA TRANSPORTASI PROYEK                */}
                  {/* ========================================================== */}
                  {activeReportSubmenu === 'h3' && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#B9E6FE]">
                          <span className="text-xs text-[#026AA2] font-medium block">Total Transaksi Transportasi</span>
                          <p className="text-xl font-bold text-[#026AA2] font-mono mt-1">
                            {filteredTransportExpenses.length} Transaksi
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#EFF5FF] border border-[#D0E2FF] sm:col-span-2">
                          <span className="text-xs text-[#155EEF] font-medium block">
                            Total Biaya Transportasi Proyek ({project.name})
                          </span>
                          <p className="text-xl font-bold text-[#155EEF] font-mono mt-1">
                            {formatRupiah(h3TotalAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-[#EAECF0] rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1D2939] text-white font-semibold">
                            <tr>
                              <th className="py-3 px-3">No</th>
                              <th className="py-3 px-3">Nomor Transaksi</th>
                              <th className="py-3 px-3">Tanggal</th>
                              <th className="py-3 px-3">Proyek</th>
                              <th className="py-3 px-3">Kategori Transportasi</th>
                              <th className="py-3 px-3">Kendaraan / Armada</th>
                              <th className="py-3 px-3">Tujuan / Rute</th>
                              <th className="py-3 px-3">Penanggung Jawab</th>
                              <th className="py-3 px-3">Keterangan</th>
                              <th className="py-3 px-3">Metode Bayar</th>
                              <th className="py-3 px-3 text-right">Nominal Biaya</th>
                              <th className="py-3 px-3 text-center print:hidden">Bukti Foto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                            {filteredTransportExpenses.length === 0 ? (
                              <tr>
                                <td colSpan={12} className="py-8 text-center text-[#667085]">
                                  Tidak ada transaksi biaya transportasi pada periode ini.
                                </td>
                              </tr>
                            ) : (
                              filteredTransportExpenses.map((exp, idx) => (
                                <tr key={exp.id} className="hover:bg-[#F9FAFB]">
                                  <td className="py-2.5 px-3 font-mono text-[#667085]">{idx + 1}</td>
                                  <td className="py-2.5 px-3 font-mono font-semibold text-[#1D2939]">
                                    {exp.expenseNumber}
                                  </td>
                                  <td className="py-2.5 px-3">{formatDateID(exp.date)}</td>
                                  <td className="py-2.5 px-3 font-semibold text-[#344054]">{project.name}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded-md bg-[#F0F9FF] text-[#026AA2] font-semibold text-[11px]">
                                      {exp.category}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">{exp.vehicleOrDriver || '-'}</td>
                                  <td className="py-2.5 px-3">{exp.destinationOrRoute || '-'}</td>
                                  <td className="py-2.5 px-3 font-medium text-[#1D2939]">{exp.picName || '-'}</td>
                                  <td className="py-2.5 px-3 text-[#667085]">{exp.description || '-'}</td>
                                  <td className="py-2.5 px-3">{exp.paymentMethod || '-'}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1D2939]">
                                    {formatRupiah(exp.amount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center print:hidden">
                                    {exp.attachments && exp.attachments.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setViewingProofExpense(exp);
                                          setActivePhotoIndex(0);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] border border-[#D0E2FF] text-[11px] font-semibold"
                                      >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        <span>Lihat ({exp.attachments.length})</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-[#98A2B3]">Tanpa Foto</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot className="bg-[#EFF5FF] font-bold text-[#1D2939] border-t-2 border-[#4693FD]">
                            <tr>
                              <td colSpan={10} className="py-3 px-3 text-xs uppercase text-[#155EEF]">
                                GRAND TOTAL BIAYA TRANSPORTASI PROYEK ({filteredTransportExpenses.length} Transaksi)
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sm text-[#155EEF]">
                                {formatRupiah(h3TotalAmount)}
                              </td>
                              <td className="py-3 px-3 print:hidden"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ========================================================== */}
                  {/* SUBMENU H4: REKAP PENGELUARAN OPERASIONAL LAPANGAN         */}
                  {/* ========================================================== */}
                  {activeReportSubmenu === 'h4' && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-[#FDF2FA] border border-[#FCCEEE]">
                          <span className="text-xs text-[#C11574] font-medium block">Total Transaksi Operasional</span>
                          <p className="text-xl font-bold text-[#C11574] font-mono mt-1">
                            {filteredOperationalExpenses.length} Transaksi
                          </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#EFF5FF] border border-[#D0E2FF] sm:col-span-2">
                          <span className="text-xs text-[#155EEF] font-medium block">
                            Total Pengeluaran Operasional Lapangan ({project.name})
                          </span>
                          <p className="text-xl font-bold text-[#155EEF] font-mono mt-1">
                            {formatRupiah(h4TotalAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-[#EAECF0] rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1D2939] text-white font-semibold">
                            <tr>
                              <th className="py-3 px-3">No</th>
                              <th className="py-3 px-3">Nomor Transaksi</th>
                              <th className="py-3 px-3">Tanggal</th>
                              <th className="py-3 px-3">Proyek</th>
                              <th className="py-3 px-3">Kategori Operasional</th>
                              <th className="py-3 px-3">Uraian / Kebutuhan Lapangan</th>
                              <th className="py-3 px-3">Penanggung Jawab</th>
                              <th className="py-3 px-3">Metode Bayar</th>
                              <th className="py-3 px-3 text-right">Nominal Pengeluaran</th>
                              <th className="py-3 px-3 text-center print:hidden">Bukti Foto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                            {filteredOperationalExpenses.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="py-8 text-center text-[#667085]">
                                  Tidak ada transaksi pengeluaran operasional lapangan pada periode ini.
                                </td>
                              </tr>
                            ) : (
                              filteredOperationalExpenses.map((exp, idx) => (
                                <tr key={exp.id} className="hover:bg-[#F9FAFB]">
                                  <td className="py-2.5 px-3 font-mono text-[#667085]">{idx + 1}</td>
                                  <td className="py-2.5 px-3 font-mono font-semibold text-[#1D2939]">
                                    {exp.expenseNumber}
                                  </td>
                                  <td className="py-2.5 px-3">{formatDateID(exp.date)}</td>
                                  <td className="py-2.5 px-3 font-semibold text-[#344054]">{project.name}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded-md bg-[#FDF2FA] text-[#C11574] font-semibold text-[11px]">
                                      {exp.category}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[#1D2939]">{exp.description || '-'}</td>
                                  <td className="py-2.5 px-3 font-medium text-[#1D2939]">{exp.picName || '-'}</td>
                                  <td className="py-2.5 px-3">{exp.paymentMethod || '-'}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1D2939]">
                                    {formatRupiah(exp.amount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center print:hidden">
                                    {exp.attachments && exp.attachments.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setViewingProofExpense(exp);
                                          setActivePhotoIndex(0);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF5FF] text-[#155EEF] hover:bg-[#D0E2FF] border border-[#D0E2FF] text-[11px] font-semibold"
                                      >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        <span>Lihat ({exp.attachments.length})</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-[#98A2B3]">Tanpa Foto</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot className="bg-[#EFF5FF] font-bold text-[#1D2939] border-t-2 border-[#4693FD]">
                            <tr>
                              <td colSpan={8} className="py-3 px-3 text-xs uppercase text-[#155EEF]">
                                GRAND TOTAL PENGELUARAN OPERASIONAL LAPANGAN ({filteredOperationalExpenses.length} Transaksi)
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sm text-[#155EEF]">
                                {formatRupiah(h4TotalAmount)}
                              </td>
                              <td className="py-3 px-3 print:hidden"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ========================================================== */}
                  {/* SUBMENU H5: REKAP SELURUH PENGELUARAN PROYEK               */}
                  {/* ========================================================== */}
                  {activeReportSubmenu === 'h5' && (
                    <div className="mt-4 space-y-5">
                      {/* 4 Highlight Realization Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#EAECF0]">
                          <span className="text-xs text-[#667085] font-medium">1. Nilai Anggaran Proyek</span>
                          <p className="text-xl font-bold text-[#1D2939] font-mono mt-1">
                            {formatRupiah(rawSummary.budget)}
                          </p>
                          <p className="text-[11px] text-[#667085] mt-1">Plafon kontrak proyek {project.name}</p>
                        </div>

                        <div className="bg-[#EFF5FF] p-4 rounded-xl border border-[#D0E2FF]">
                          <span className="text-xs text-[#155EEF] font-medium">2. Total Seluruh Pengeluaran Proyek</span>
                          <p className="text-xl font-bold text-[#155EEF] font-mono mt-1">
                            {formatRupiah(rawSummary.totalProjectCost)}
                          </p>
                          <p className="text-[11px] text-[#155EEF] mt-1">
                            Akumulasi Gaji + Transportasi + Operasional
                          </p>
                        </div>

                        <div className="bg-[#ECFDF3] p-4 rounded-xl border border-[#A6F4C5]">
                          <span className="text-xs text-[#027A48] font-medium">3. Sisa Anggaran Proyek</span>
                          <p className="text-xl font-bold text-[#027A48] font-mono mt-1">
                            {formatRupiah(rawSummary.budgetRemaining)}
                          </p>
                          <p className="text-[11px] text-[#027A48] mt-1">
                            Nilai Anggaran − Total Pengeluaran Proyek
                          </p>
                        </div>

                        <div className="bg-[#FEF6EE] p-4 rounded-xl border border-[#F9DBAF]">
                          <span className="text-xs text-[#B54708] font-medium">4. Persentase Realisasi Anggaran</span>
                          <p className="text-xl font-bold text-[#B54708] font-mono mt-1">
                            {rawSummary.realizationPercentage}%
                          </p>
                          <p className="text-[11px] text-[#B54708] mt-1">
                            (Total Pengeluaran ÷ Nilai Anggaran) × 100%
                          </p>
                        </div>
                      </div>

                      {/* Realization Progress Bar */}
                      <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#EAECF0]">
                        <div className="flex justify-between text-xs text-[#344054] mb-1.5 font-semibold">
                          <span>Tingkat Penyerapan Anggaran Proyek {project.name}</span>
                          <span className="font-mono text-[#155EEF]">
                            {formatRupiah(rawSummary.totalProjectCost)} / {formatRupiah(rawSummary.budget)} ({rawSummary.realizationPercentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#EAECF0] h-3 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              rawSummary.realizationPercentage > 90 ? 'bg-[#D92D20]' : 'bg-[#4693FD]'
                            }`}
                            style={{ width: `${Math.min(100, rawSummary.realizationPercentage)}%` }}
                          />
                        </div>
                      </div>

                      {/* Detailed H5 Breakdown Table */}
                      <div className="overflow-x-auto border border-[#EAECF0] rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#1D2939] text-white font-semibold">
                            <tr>
                              <th className="py-3 px-4 w-12">No</th>
                              <th className="py-3 px-4">Komponen Pengeluaran Proyek</th>
                              <th className="py-3 px-4">Rincian & Keterangan Realisasi</th>
                              <th className="py-3 px-4 text-right">Subtotal Realisasi (Rp)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                            <tr>
                              <td className="py-3 px-4 font-mono text-[#667085]">1</td>
                              <td className="py-3 px-4 font-bold text-[#1D2939]">
                                Gaji Pokok Harian Karyawan Proyek (Hadir Penuh & Setengah Hari)
                              </td>
                              <td className="py-3 px-4 text-[#475467]">
                                <div>
                                  Total <strong>{rawSummary.totalWorkDays} hari kerja efektif</strong> ({rawSummary.totalRecapEmployees} karyawan)
                                </div>
                                <div className="text-[11px] text-[#667085] mt-0.5">
                                  • Hadir Penuh: {rawSummary.fullWorkDays} hari ({formatRupiah(rawSummary.fullDaySalary)})
                                  <span className="ml-3">
                                    • Setengah Hari: {rawSummary.halfWorkDays} hari ({formatRupiah(rawSummary.halfDaySalary)})
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-[#1D2939]">
                                {formatRupiah(rawSummary.totalBasicSalary)}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-3 px-4 font-mono text-[#667085]">2</td>
                              <td className="py-3 px-4 font-bold text-[#1D2939]">
                                Upah Lembur Karyawan Proyek Disetujui
                              </td>
                              <td className="py-3 px-4 text-[#475467]">
                                Total durasi lembur aktual: <strong>{formatOvertimeDuration(rawSummary.totalOvertimeHours)}</strong> (Driver = Rp 0 sesuai ketentuan perusahaan)
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-[#B54708]">
                                {formatRupiah(rawSummary.totalOvertimePay)}
                              </td>
                            </tr>

                            <tr className="bg-[#F8F9FA]">
                              <td className="py-3 px-4 font-mono font-bold text-[#155EEF]">1+2</td>
                              <td className="py-3 px-4 font-bold text-[#155EEF]">
                                Subtotal Total Gaji Karyawan Proyek (H2)
                              </td>
                              <td className="py-3 px-4 text-[11px] text-[#475467]">
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  <span>
                                    Sudah Dibayar: <strong className="font-mono text-[#027A48]">{formatRupiah(rawSummary.paidPayrollTotal)}</strong>
                                  </span>
                                  <span>
                                    Belum Dibayar / Terhitung: <strong className="font-mono text-[#B54708]">{formatRupiah(rawSummary.unpaidPayrollTotal)}</strong>
                                  </span>
                                  <span>
                                    Potongan Kasbon: <strong className="font-mono text-[#B42318]">-{formatRupiah(rawSummary.totalKasbonDeduction)}</strong>
                                  </span>
                                  <span>
                                    Gaji Bersih Diterima: <strong className="font-mono text-[#027A48]">{formatRupiah(rawSummary.totalNetSalary)}</strong>
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-[#155EEF]">
                                {formatRupiah(rawSummary.totalGrossSalary)}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-3 px-4 font-mono text-[#667085]">3</td>
                              <td className="py-3 px-4 font-bold text-[#1D2939]">
                                Total Biaya Transportasi Proyek (H3)
                              </td>
                              <td className="py-3 px-4 text-[#475467]">
                                {allTransportExpenses.length} transaksi transportasi proyek (Bensin, Solar, Tol, Parkir, Ongkos & Sewa Kendaraan)
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-[#026AA2]">
                                {formatRupiah(rawSummary.totalTransport)}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-3 px-4 font-mono text-[#667085]">4</td>
                              <td className="py-3 px-4 font-bold text-[#1D2939]">
                                Total Biaya Pengeluaran Operasional Lapangan (H4)
                              </td>
                              <td className="py-3 px-4 text-[#475467]">
                                {allOperationalExpenses.length} transaksi operasional lapangan (Material Kecil, Alat Kerja, Konsumsi & Kebutuhan Darurat)
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-[#C11574]">
                                {formatRupiah(rawSummary.totalOp)}
                              </td>
                            </tr>

                            {rawSummary.totalOtherCost > 0 && (
                              <tr>
                                <td className="py-3 px-4 font-mono text-[#667085]">5</td>
                                <td className="py-3 px-4 font-bold text-[#1D2939]">Biaya Proyek Lainnya</td>
                                <td className="py-3 px-4 text-[#475467]">Komponen pengeluaran proyek lainnya</td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-[#1D2939]">
                                  {formatRupiah(rawSummary.totalOtherCost)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot className="border-t-2 border-[#1D2939] text-xs">
                            <tr className="bg-[#EFF5FF] font-bold text-[#155EEF]">
                              <td colSpan={3} className="py-3 px-4 uppercase">
                                TOTAL SELURUH PENGELUARAN PROYEK ({project.name})
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-sm">
                                {formatRupiah(rawSummary.totalProjectCost)}
                              </td>
                            </tr>
                            <tr className="bg-[#F9FAFB] font-bold text-[#1D2939]">
                              <td colSpan={3} className="py-2.5 px-4 uppercase">
                                NILAI ANGGARAN KONTRAK PROYEK
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono">
                                {formatRupiah(rawSummary.budget)}
                              </td>
                            </tr>
                            <tr className="bg-[#ECFDF3] font-bold text-[#027A48]">
                              <td colSpan={3} className="py-2.5 px-4 uppercase">
                                SISA ANGGARAN PROYEK (Nilai Anggaran − Total Pengeluaran)
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-sm">
                                {formatRupiah(rawSummary.budgetRemaining)}
                              </td>
                            </tr>
                            <tr className="bg-[#FEF6EE] font-bold text-[#B54708]">
                              <td colSpan={3} className="py-2.5 px-4 uppercase">
                                PERSENTASE REALISASI ANGGARAN ((Total Pengeluaran ÷ Nilai Anggaran) × 100%)
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-sm">
                                {rawSummary.realizationPercentage}%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* OFFICIAL SIGNATURE BLOCK (Visible on Print and Bottom of Report) */}
                  <div className="mt-8 pt-6 border-t border-[#EAECF0] grid grid-cols-2 gap-8 text-xs text-[#344054]">
                    <div className="text-center">
                      <p className="text-[#667085]">Disiapkan Oleh,</p>
                      <p className="font-semibold text-[#1D2939] mt-0.5">Admin Proyek / Bagian Keuangan</p>
                      <div className="h-16" />
                      <p className="font-bold text-[#1D2939] underline">( ____________________________ )</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[#667085]">
                        {project.location || 'Jakarta'}, {formatDateID(getTodayDateString())}
                      </p>
                      <p className="font-semibold text-[#1D2939] mt-0.5">Disetujui Oleh, Pimpinan / Owner</p>
                      <div className="h-16" />
                      <p className="font-bold text-[#1D2939] underline">( ____________________________ )</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL H1: LIHAT DETAIL REKAP GAJI KARYAWAN */}
            {selectedH1EmployeeDetail && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
                <div className="bg-white rounded-2xl max-w-4xl w-full border border-[#EAECF0] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                  <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#F8F9FA]">
                    <div>
                      <span className="text-[11px] font-bold text-[#155EEF] uppercase">
                        Detail Rekap Gaji & Kehadiran Karyawan Proyek (H1)
                      </span>
                      <h3 className="text-base font-bold text-[#1D2939] mt-0.5">
                        {selectedH1EmployeeDetail.employeeName} ({selectedH1EmployeeDetail.employeeId}) — {selectedH1EmployeeDetail.role}
                      </h3>
                      <p className="text-xs text-[#667085]">
                        Proyek: <strong>{project.name} ({project.code})</strong> | Periode: {periodDisplayLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedH1EmployeeDetail(null)}
                      className="p-1.5 text-[#667085] hover:text-[#1D2939] rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EAECF0]">
                        <span className="text-[#667085] block">Total Hari Kerja</span>
                        <p className="text-sm font-bold text-[#1D2939] mt-0.5">
                          {selectedH1EmployeeDetail.fullWorkDays} Penuh • {selectedH1EmployeeDetail.halfWorkDays} Setengah
                        </p>
                        <span className="text-[11px] text-[#667085]">
                          Tidak Hadir: {selectedH1EmployeeDetail.absentDays} hari
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#EFF5FF] border border-[#D0E2FF]">
                        <span className="text-[#155EEF] block">Total Gaji Kotor</span>
                        <p className="text-sm font-bold text-[#155EEF] font-mono mt-0.5">
                          {formatRupiah(selectedH1EmployeeDetail.grossSalary)}
                        </p>
                        <span className="text-[11px] text-[#155EEF]">
                          Pokok: {formatRupiah(selectedH1EmployeeDetail.totalBasicSalary)} + OT: {formatRupiah(selectedH1EmployeeDetail.totalOvertimePay)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA]">
                        <span className="text-[#B42318] block">Potongan Kasbon</span>
                        <p className="text-sm font-bold text-[#B42318] font-mono mt-0.5">
                          - {formatRupiah(selectedH1EmployeeDetail.kasbonDeduction)}
                        </p>
                        <span className="text-[11px] text-[#B42318]">
                          Sisa Kasbon: {formatRupiah(selectedH1EmployeeDetail.remainingKasbon)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5]">
                        <span className="text-[#027A48] font-semibold block">Gaji Bersih Diterima</span>
                        <p className="text-base font-bold text-[#027A48] font-mono mt-0.5">
                          {formatRupiah(selectedH1EmployeeDetail.netSalary)}
                        </p>
                        <span className="text-[11px] text-[#027A48]">{selectedH1EmployeeDetail.paymentStatusLabel}</span>
                      </div>
                    </div>

                    {/* Riwayat Kasbon Karyawan pada Periode */}
                    {selectedH1EmployeeDetail.kasbonRecords && selectedH1EmployeeDetail.kasbonRecords.length > 0 && (
                      <div className="border border-[#FECDCA] rounded-xl overflow-hidden">
                        <div className="bg-[#FEF3F2] px-4 py-2 text-xs font-bold text-[#B42318]">
                          Riwayat Pengajuan Kasbon Karyawan ({selectedH1EmployeeDetail.kasbonRecords.length} Transaksi)
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F9FAFB] text-[#475467] border-b border-[#EAECF0]">
                            <tr>
                              <th className="py-2 px-3">No. Kasbon</th>
                              <th className="py-2 px-3">Tanggal</th>
                              <th className="py-2 px-3">Keperluan</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Nominal</th>
                              <th className="py-2 px-3 text-right">Sisa Belum Lunas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAECF0]">
                            {selectedH1EmployeeDetail.kasbonRecords.map((kb: any) => (
                              <tr key={kb.id}>
                                <td className="py-2 px-3 font-mono font-semibold">{kb.kasbonNumber}</td>
                                <td className="py-2 px-3">{formatDateID(kb.requestDate)}</td>
                                <td className="py-2 px-3">{kb.reason || '-'}</td>
                                <td className="py-2 px-3">{kb.status}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-[#B42318]">
                                  {formatRupiah(kb.amount)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  {formatRupiah(kb.remainingAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-[#EAECF0] bg-[#F8F9FA] flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedH1EmployeeDetail(null)}
                      className="px-4 py-2 rounded-xl border border-[#D0D5DD] bg-white text-xs font-semibold text-[#344054]"
                    >
                      Tutup
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const emp = selectedH1EmployeeDetail;
                          setSelectedH1EmployeeDetail(null);
                          setSlipGajiModalEmployees([emp]);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#155EEF] hover:bg-[#1849A9] text-white text-xs font-semibold"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Buka & Cetak Slip Gaji</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCurrentSubmenuPDF(selectedH1EmployeeDetail)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-semibold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Unduh PDF Rekap Karyawan</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL SLIP GAJI KARYAWAN PROYEK (SINGLE OR MULTI-EMPLOYEE) */}
            {slipGajiModalEmployees && slipGajiModalEmployees.length > 0 && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl max-w-3xl w-full border border-[#EAECF0] shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
                  <div className="p-4 border-b border-[#EAECF0] flex flex-wrap items-center justify-between gap-2 bg-[#F8F9FA] print:hidden">
                    <div>
                      <h3 className="text-sm font-bold text-[#1D2939]">
                        Preview Resmi Slip Gaji Karyawan Proyek ({slipGajiModalEmployees.length} Karyawan)
                      </h3>
                      <p className="text-xs text-[#667085]">
                        Proyek {project.name} ({project.code}) — {periodDisplayLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          exportProjectSlipGajiPDF({
                            project,
                            employees: slipGajiModalEmployees,
                            startDate: appliedStartDate || undefined,
                            endDate: appliedEndDate || undefined,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white text-xs font-semibold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Cetak PDF Slip Gaji</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1D2939] hover:bg-[#344054] text-white text-xs font-semibold"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Langsung</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlipGajiModalEmployees(null)}
                        className="p-1.5 text-[#667085] hover:text-[#1D2939] rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div id="project-slip-printable" className="p-6 overflow-y-auto flex-1 space-y-8 bg-white">
                    {slipGajiModalEmployees.map((emp, idx) => {
                      const isDriver = isDriverRole(emp.role);
                      return (
                        <div
                          key={emp.employeeId}
                          className={`border border-[#D0D5DD] rounded-2xl p-6 space-y-4 bg-white ${
                            idx > 0 ? 'print-page-break' : ''
                          }`}
                        >
                          {/* Header Perusahaan */}
                          <div className="flex items-start justify-between border-b-2 border-[#1D2939] pb-3">
                            <div>
                              <h2 className="text-base font-bold text-[#1D2939] tracking-tight">
                                PT ASTA BRATA MATAHARI TERBIT
                              </h2>
                              <p className="text-[11px] text-[#667085]">
                                Dokumen Resmi Slip Gaji & Rekap Kehadiran Tenaga Kerja Proyek
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-block px-2.5 py-0.5 rounded bg-[#EFF5FF] text-[#155EEF] font-bold text-xs border border-[#D0E2FF]">
                                SLIP GAJI KARYAWAN PROYEK
                              </span>
                              <p className="text-[10px] text-[#667085] mt-1">
                                Tanggal Cetak: {formatDateID(getTodayDateString())}
                              </p>
                            </div>
                          </div>

                          {/* Identitas Karyawan & Proyek */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8F9FA] p-3.5 rounded-xl border border-[#EAECF0] text-xs">
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-[#667085]">Nama Karyawan:</span>
                                <strong className="text-[#1D2939]">{emp.employeeName}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#667085]">ID Karyawan:</span>
                                <span className="font-mono font-semibold text-[#344054]">{emp.employeeId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#667085]">Jabatan / Peran:</span>
                                <strong className="text-[#155EEF]">
                                  {emp.role} {isDriver ? '(Tanpa Upah Lembur)' : ''}
                                </strong>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-[#667085]">Nama Proyek:</span>
                                <strong className="text-[#1D2939]">{project.name} ({project.code})</strong>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#667085]">Periode Gaji:</span>
                                <span className="font-semibold text-[#344054]">{periodDisplayLabel}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#667085]">Status Pembayaran:</span>
                                <span className="font-semibold text-[#027A48]">{emp.paymentStatusLabel}</span>
                              </div>
                            </div>
                          </div>

                          {/* Rincian Penerimaan & Potongan */}
                          <table className="w-full text-left text-xs border border-[#EAECF0]">
                            <thead className="bg-[#1D2939] text-white">
                              <tr>
                                <th className="py-2 px-3">Komponen Penerimaan & Potongan</th>
                                <th className="py-2 px-3">Rincian Perhitungan</th>
                                <th className="py-2 px-3 text-right">Nominal (Rp)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAECF0]">
                              <tr>
                                <td className="py-2 px-3 font-medium">1. Upah Hadir Penuh (100%)</td>
                                <td className="py-2 px-3 text-[#667085]">
                                  {emp.fullWorkDays} hari × {formatRupiah(emp.dailyWage)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{formatRupiah(emp.fullDaySalary)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3 font-medium">2. Upah Setengah Hari (50%)</td>
                                <td className="py-2 px-3 text-[#667085]">
                                  {emp.halfWorkDays} hari × {formatRupiah(Math.round(emp.dailyWage / 2))}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{formatRupiah(emp.halfDaySalary)}</td>
                              </tr>
                              <tr className="bg-[#F9FAFB] font-semibold">
                                <td className="py-2 px-3">Total Gaji Pokok</td>
                                <td className="py-2 px-3 text-[#667085]">
                                  {emp.totalWorkDays} hari efektif ({emp.absentDays} hari tidak hadir)
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{formatRupiah(emp.totalBasicSalary)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3 font-medium">3. Upah Lembur Disetujui</td>
                                <td className="py-2 px-3 text-[#667085]">
                                  {isDriver
                                    ? `Durasi: ${formatOvertimeDuration(emp.overtimeHours)} × Rp 0 (Ketentuan Driver)`
                                    : `${formatOvertimeDuration(emp.overtimeHours)} × ${formatRupiah(emp.overtimeHourlyWage)}/jam`}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{formatRupiah(emp.totalOvertimePay)}</td>
                              </tr>
                              <tr className="bg-[#EFF5FF] font-bold text-[#155EEF]">
                                <td className="py-2.5 px-3">TOTAL GAJI KOTOR (PENERIMAAN)</td>
                                <td className="py-2.5 px-3">Gaji Pokok + Upah Lembur</td>
                                <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(emp.grossSalary)}</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3 font-medium text-[#B42318]">4. Potongan Kasbon Periode Ini</td>
                                <td className="py-2 px-3 text-[#667085]">
                                  Total Kasbon: {formatRupiah(emp.kasbonInPeriod)} | Sisa Kasbon: {formatRupiah(emp.remainingKasbon)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-[#B42318]">
                                  - {formatRupiah(emp.kasbonDeduction)}
                                </td>
                              </tr>
                            </tbody>
                            <tfoot className="bg-[#ECFDF3] font-bold text-[#027A48] border-t-2 border-[#027A48]">
                              <tr>
                                <td className="py-3 px-3 text-xs uppercase">GAJI BERSIH DITERIMA (TAKE HOME PAY)</td>
                                <td className="py-3 px-3 text-[11px] italic">{terbilangRupiah(emp.netSalary)}</td>
                                <td className="py-3 px-3 text-right font-mono text-sm">{formatRupiah(emp.netSalary)}</td>
                              </tr>
                            </tfoot>
                          </table>

                          {/* Tanda Tangan Slip Gaji */}
                          <div className="grid grid-cols-2 gap-6 pt-4 text-xs text-center text-[#344054]">
                            <div>
                              <p className="text-[#667085]">Penerima Upah / Karyawan,</p>
                              <div className="h-12" />
                              <p className="font-bold text-[#1D2939] underline">( {emp.employeeName} )</p>
                            </div>
                            <div>
                              <p className="text-[#667085]">Bagian Keuangan / Admin Proyek,</p>
                              <div className="h-12" />
                              <p className="font-bold text-[#1D2939] underline">( ________________________ )</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* MODAL 1: TAMBAH KARYAWAN PROYEK */}
      {isAddEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#EAECF0] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1D2939] flex items-center gap-2">
                  <span>+ Tambah Karyawan Proyek</span>
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Proyek: <span className="font-semibold text-[#1D2939]">{project.name}</span> ({project.code})
                </p>
              </div>
              <button
                onClick={() => setIsAddEmployeeModalOpen(false)}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-[#EFF5FF] border border-[#D0E2FF] rounded-xl p-3 text-xs text-[#155EEF] flex items-start gap-2">
                <Users className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Penambahan Karyawan Terintegrasi</p>
                  <p className="text-[11px] text-[#4693FD] mt-0.5">
                    Karyawan langsung terdaftar pada proyek ini dan otomatis disinkronkan ke master data perusahaan. ID karyawan digenerate otomatis secara unik dan bebas duplikasi.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Nama Lengkap Karyawan *
                </label>
                <input
                  type="text"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                  required
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    NIK (Nomor Induk Kependudukan)
                  </label>
                  <input
                    type="text"
                    value={employeeForm.nik}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, nik: e.target.value })}
                    placeholder="16 digit NIK (Opsional)"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Jabatan / Posisi *
                  </label>
                  <select
                    value={employeeForm.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      const standardWages = getDefaultWages(newRole);
                      setEmployeeForm({
                        ...employeeForm,
                        role: newRole,
                        dailyWage: standardWages.daily,
                        overtimeHourlyWage: standardWages.overtime,
                      });
                    }}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="Mandor">Mandor</option>
                    <option value="Tukang">Tukang</option>
                    <option value="Helper">Helper / Kenek</option>
                    <option value="Driver">Driver</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Tanggal Mulai Bekerja *
                  </label>
                  <input
                    type="date"
                    value={employeeForm.startDate}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Upah Harian (Rp) *
                  </label>
                  <input
                    type="number"
                    value={employeeForm.dailyWage}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, dailyWage: Number(e.target.value) })}
                    required
                    min="0"
                    step="1000"
                    placeholder="150000"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-medium text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Tarif Lembur per Jam (Rp) *
                  </label>
                  <input
                    type="number"
                    value={employeeForm.role === 'Driver' ? 0 : employeeForm.overtimeHourlyWage}
                    disabled={employeeForm.role === 'Driver'}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        overtimeHourlyWage: employeeForm.role === 'Driver' ? 0 : Number(e.target.value),
                      })
                    }
                    required
                    min="0"
                    step="1000"
                    placeholder="20000"
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F2F4F7] border border-[#D0D5DD] rounded-lg text-xs font-mono font-medium text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                  {employeeForm.role === 'Driver' && (
                    <p className="text-[10px] text-[#0E9384] font-medium mt-1">
                      Ketentuan perusahaan: Driver tidak mendapat upah lembur (Rp0)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Status Karyawan di Proyek *
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#344054]">
                    <input
                      type="radio"
                      name="status"
                      checked={employeeForm.status === 'active'}
                      onChange={() => setEmployeeForm({ ...employeeForm, status: 'active' })}
                      className="text-[#4693FD] focus:ring-[#4693FD]"
                    />
                    <span className="font-medium text-[#027A48]">Aktif Bekerja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#344054]">
                    <input
                      type="radio"
                      name="status"
                      checked={employeeForm.status === 'inactive'}
                      onChange={() => setEmployeeForm({ ...employeeForm, status: 'inactive' })}
                      className="text-[#4693FD] focus:ring-[#4693FD]"
                    />
                    <span className="text-[#667085]">Nonaktif</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  value={employeeForm.notes}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Keahlian spesifik, domisili, atau catatan proyek..."
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#EAECF0]">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan & Daftarkan Karyawan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1B: UBAH DATA KARYAWAN PROYEK */}
      {isEditEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#EAECF0] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1D2939]">Ubah Data Karyawan Proyek</h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  ID: <span className="font-mono font-semibold text-[#4693FD]">{editEmployeeForm.employeeId}</span>
                </p>
              </div>
              <button
                onClick={() => setIsEditEmployeeModalOpen(false)}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditEmployeeSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-[#FEF6EE] border border-[#F9DBAF] rounded-xl p-3 text-xs text-[#B54708]">
                <p className="font-semibold">Integritas Data Transaksi Terlindungi</p>
                <p className="text-[11px] mt-0.5">
                  Perubahan data maupun penonaktifan karyawan tidak akan menghapus atau mengubah catatan historis absensi, lembur, kasbon, atau laporan sebelumnya.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  value={editEmployeeForm.name}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    value={editEmployeeForm.phone}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    NIK
                  </label>
                  <input
                    type="text"
                    value={editEmployeeForm.nik}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, nik: e.target.value })}
                    placeholder="16 digit NIK"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Jabatan / Posisi *
                  </label>
                  <select
                    value={editEmployeeForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        role: nextRole,
                        overtimeHourlyWage:
                          nextRole === 'Driver'
                            ? 0
                            : editEmployeeForm.overtimeHourlyWage || getDefaultWages(nextRole).overtime,
                      });
                    }}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="Mandor">Mandor</option>
                    <option value="Tukang">Tukang</option>
                    <option value="Helper">Helper / Kenek</option>
                    <option value="Driver">Driver</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Tanggal Mulai Bekerja *
                  </label>
                  <input
                    type="date"
                    value={editEmployeeForm.startDate}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Upah Harian (Rp) *
                  </label>
                  <input
                    type="number"
                    value={editEmployeeForm.dailyWage}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, dailyWage: Number(e.target.value) })}
                    required
                    min="0"
                    step="1000"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-medium text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Tarif Lembur per Jam (Rp) *
                  </label>
                  <input
                    type="number"
                    value={editEmployeeForm.role === 'Driver' ? 0 : editEmployeeForm.overtimeHourlyWage}
                    disabled={editEmployeeForm.role === 'Driver'}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        overtimeHourlyWage: editEmployeeForm.role === 'Driver' ? 0 : Number(e.target.value),
                      })
                    }
                    required
                    min="0"
                    step="1000"
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F2F4F7] border border-[#D0D5DD] rounded-lg text-xs font-mono font-medium text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                  {editEmployeeForm.role === 'Driver' && (
                    <p className="text-[10px] text-[#0E9384] font-medium mt-1">
                      Ketentuan perusahaan: Driver tidak mendapat upah lembur (Rp0)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Status Karyawan di Proyek *
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#344054]">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={editEmployeeForm.status === 'active'}
                      onChange={() => setEditEmployeeForm({ ...editEmployeeForm, status: 'active' })}
                      className="text-[#4693FD] focus:ring-[#4693FD]"
                    />
                    <span className="font-medium text-[#027A48]">Aktif Bekerja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#344054]">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={editEmployeeForm.status === 'inactive'}
                      onChange={() => setEditEmployeeForm({ ...editEmployeeForm, status: 'inactive' })}
                      className="text-[#4693FD] focus:ring-[#4693FD]"
                    />
                    <span className="text-[#667085]">Nonaktif (Riwayat aman)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Catatan
                </label>
                <textarea
                  value={editEmployeeForm.notes}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#EAECF0]">
                <button
                  type="button"
                  onClick={() => setIsEditEmployeeModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1C: RINCIAN KARYAWAN PROYEK */}
      {isDetailEmployeeModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#EAECF0] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1D2939]">Rincian Karyawan Proyek</h3>
                <p className="text-xs text-[#667085] mt-0.5">Informasi tenaga kerja penugasan proyek</p>
              </div>
              <button
                onClick={() => setIsDetailEmployeeModalOpen(false)}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F2F4F7]">
                <div>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EFF5FF] text-[#155EEF] border border-[#D0E2FF]">
                    {selectedEmployee.employeeId}
                  </span>
                  <h4 className="text-base font-bold text-[#1D2939] mt-1.5">{selectedEmployee.employeeName}</h4>
                  {selectedEmployee.employeeNik && (
                    <p className="text-xs font-mono text-[#667085]">NIK: {selectedEmployee.employeeNik}</p>
                  )}
                </div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    selectedEmployee.status === 'active' && selectedEmployee.employeeStatus !== 'inactive'
                      ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                      : 'bg-[#F2F4F7] text-[#667085] border-[#D0D5DD]'
                  }`}
                >
                  {selectedEmployee.status === 'active' && selectedEmployee.employeeStatus !== 'inactive'
                    ? 'Aktif di Proyek'
                    : 'Nonaktif'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Jabatan / Posisi</span>
                  <span className="font-semibold text-[#1D2939] block mt-0.5">
                    {selectedEmployee.roleInProject || selectedEmployee.employeeRole}
                  </span>
                </div>
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">No. Telepon</span>
                  <span className="font-semibold text-[#1D2939] font-mono block mt-0.5">
                    {selectedEmployee.employeePhone || '-'}
                  </span>
                </div>
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Upah Harian</span>
                  <span className="font-semibold text-[#1D2939] font-mono block mt-0.5">
                    {formatRupiah(selectedEmployee.dailyWage !== undefined ? selectedEmployee.dailyWage : getDefaultWages(selectedEmployee.roleInProject || 'Tukang').daily)}
                  </span>
                </div>
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Tarif Lembur / Jam</span>
                  <span className="font-semibold text-[#1D2939] font-mono block mt-0.5">
                    {formatRupiah(selectedEmployee.overtimeHourlyWage !== undefined ? selectedEmployee.overtimeHourlyWage : getDefaultWages(selectedEmployee.roleInProject || 'Tukang').overtime)}
                  </span>
                </div>
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Tgl Mulai Penugasan</span>
                  <span className="font-semibold text-[#1D2939] block mt-0.5">
                    {formatDateID(selectedEmployee.employeeStartDate || selectedEmployee.assignedDate)}
                  </span>
                </div>
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0]">
                  <span className="text-[#667085] block">Proyek</span>
                  <span className="font-semibold text-[#1D2939] block mt-0.5 truncate">
                    {project.name}
                  </span>
                </div>
              </div>

              {selectedEmployee.notes && (
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0] text-xs">
                  <span className="text-[#667085] block mb-1 font-medium">Catatan:</span>
                  <p className="text-[#344054]">{selectedEmployee.notes}</p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-[#EAECF0]">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsDetailEmployeeModalOpen(false);
                      handleOpenEditEmployee(selectedEmployee);
                    }}
                    className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Ubah Data</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailEmployeeModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CATAT / UBAH PENGELUARAN (TRANSPORTASI / OPERASIONAL PROYEK) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#EAECF0] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1D2939]">
                  {editingExpense
                    ? (expenseFormType === 'transportasi'
                        ? 'Ubah Biaya Transportasi Proyek'
                        : 'Ubah Pengeluaran Operasional Proyek')
                    : (expenseFormType === 'transportasi'
                        ? 'Catat Biaya Transportasi Proyek'
                        : 'Catat Pengeluaran Operasional Proyek')}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  {editingExpense
                    ? `No. Transaksi: ${editingExpense.transactionNumber} • Proyek ${project.name}`
                    : `Tersimpan khusus untuk proyek ${project.name}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsExpenseModalOpen(false);
                  setEditingExpense(null);
                  setSelectedPhotoFiles([]);
                  setExistingAttachmentsToKeep([]);
                }}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Kategori *
                  </label>
                  {expenseFormType === 'transportasi' ? (
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="Bensin">Bensin / BBM</option>
                      <option value="E-Toll">E-Toll</option>
                      <option value="Parkir">Parkir</option>
                      <option value="Sewa Kendaraan">Sewa Kendaraan</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  ) : (
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    >
                      <option value="Material Darurat">Material Darurat</option>
                      <option value="Alat Kerja">Alat Kerja</option>
                      <option value="Konsumsi Lapangan">Konsumsi Lapangan</option>
                      <option value="Medis P3K">Medis P3K</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  )}
                </div>
              </div>

              {expenseFormType === 'transportasi' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#344054] block mb-1">
                      Jenis Transportasi
                    </label>
                    <input
                      type="text"
                      value={expenseForm.transportType}
                      onChange={(e) => setExpenseForm({ ...expenseForm, transportType: e.target.value })}
                      placeholder="Pick-up, Truk, Motor"
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#344054] block mb-1">
                      Tujuan Perjalanan
                    </label>
                    <input
                      type="text"
                      value={expenseForm.destination}
                      onChange={(e) => setExpenseForm({ ...expenseForm, destination: e.target.value })}
                      placeholder="Lokasi proyek / toko material"
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Penanggung Jawab (PIC) *
                  </label>
                  <input
                    type="text"
                    value={expenseForm.picName}
                    onChange={(e) => setExpenseForm({ ...expenseForm, picName: e.target.value })}
                    required
                    placeholder="Nama PIC"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#344054] block mb-1">
                    Nominal Biaya (Rp) *
                  </label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                    min="1"
                    placeholder="Contoh: 150000"
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-semibold text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Keterangan / Rincian Pengeluaran *
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                  placeholder="Rincian barang atau keperluan..."
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              {/* Foto Bukti yang Sudah Tersimpan (Jika Sedang Edit) */}
              {editingExpense && editingExpense.attachments && editingExpense.attachments.length > 0 && (
                <div className="space-y-2 border border-[#EAECF0] rounded-xl p-3 bg-[#F9FAFB]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#344054]">
                      Foto Bukti Saat Ini ({editingExpense.attachments.length})
                    </span>
                    <span className="text-[11px] text-[#667085]">
                      {existingAttachmentsToKeep.length} dipertahankan
                    </span>
                  </div>
                  <div className="space-y-2">
                    {editingExpense.attachments.map((att) => {
                      const isKept = existingAttachmentsToKeep.includes(att.id);
                      return (
                        <div
                          key={att.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                            isKept
                              ? 'bg-white border-[#EAECF0]'
                              : 'bg-[#FEF3F2] border-[#FECDCA] opacity-75'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-[#F2F4F7] flex-shrink-0 border border-[#EAECF0] flex items-center justify-center">
                              <img
                                src={getPhotoViewUrl(att.id)}
                                alt={att.fileName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="truncate">
                              <p className={`font-medium truncate ${isKept ? 'text-[#1D2939]' : 'text-[#B42318] line-through'}`}>
                                {att.fileName}
                              </p>
                              <p className="text-[10px] text-[#667085]">
                                {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : 'Foto'}
                                {!isKept && (
                                  <span className="ml-1.5 font-semibold text-[#D92D20]">
                                    (Akan Dihapus)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div>
                            {isKept ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExistingAttachmentsToKeep(
                                    existingAttachmentsToKeep.filter((id) => id !== att.id)
                                  )
                                }
                                className="px-2 py-1 text-xs font-medium text-[#D92D20] hover:bg-[#FEE4E2] rounded flex items-center gap-1 transition-colors"
                                title="Hapus foto ini saat menyimpan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExistingAttachmentsToKeep([...existingAttachmentsToKeep, att.id])}
                                className="px-2 py-1 text-xs font-medium text-[#155EEF] hover:bg-[#EFF5FF] rounded flex items-center gap-1 transition-colors"
                                title="Batalkan penghapusan foto"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Batal Hapus</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload Foto Bukti Baru ke Private Bucket */}
              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  {editingExpense
                    ? 'Tambah Foto Bukti Baru (Opsional)'
                    : 'Upload Bukti Foto Nota / Struk (Maks 5MB)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{editingExpense ? 'Pilih Foto Baru' : 'Pilih Foto Bukti'}</span>
                  </button>
                  <span className="text-[11px] text-[#667085]">
                    {selectedPhotoFiles.length} file baru dipilih
                  </span>
                </div>

                {selectedPhotoFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedPhotoFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 bg-[#F2F4F7] px-2 py-1 rounded text-[11px] text-[#344054]"
                      >
                        <span className="truncate max-w-[120px]">{f.fileName}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPhotoFiles(selectedPhotoFiles.filter((_, i) => i !== idx))
                          }
                          className="text-[#F04438] hover:text-[#B42318]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#EAECF0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpenseModalOpen(false);
                    setEditingExpense(null);
                    setSelectedPhotoFiles([]);
                    setExistingAttachmentsToKeep([]);
                  }}
                  disabled={uploadingExpense}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingExpense}
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {uploadingExpense
                    ? 'Menyimpan...'
                    : editingExpense
                    ? 'Simpan Perubahan'
                    : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CATAT / EDIT PRESENSI PROYEK (DENGAN PENGAJUAN KASBON TERINTEGRASI) */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#EAECF0] shadow-xl overflow-hidden my-8">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#F8F9FA]">
              <div>
                <h3 className="text-base font-bold text-[#1D2939]">
                  {editingAttendance ? 'Edit Kehadiran Proyek' : 'Catat Kehadiran Proyek'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Proyek: {project.name} · Tanggal: {formatDateID(editingAttendance ? attendanceForm.date : (attendanceDate || attendanceForm.date))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAttendanceModalOpen(false);
                  setEditingAttendance(null);
                  setSelectedAttKasbonPhoto(null);
                }}
                disabled={savingAttendance}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAttendanceSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* 1. Pilih Karyawan */}
              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Pilih Karyawan Ditugaskan *
                </label>
                <select
                  value={attendanceForm.employeeId}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, employeeId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="">-- Pilih Karyawan Proyek --</option>
                  {assignments
                    .filter(
                      (asg) =>
                        (asg.status === 'active' && asg.employeeStatus !== 'inactive') ||
                        (editingAttendance && asg.employeeId === editingAttendance.employeeId)
                    )
                    .map((asg) => (
                      <option key={asg.id} value={asg.employeeId}>
                        {asg.employeeName} ({asg.roleInProject || asg.employeeRole})
                      </option>
                    ))}
                </select>
              </div>

              {/* 2. Status Kehadiran */}
              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Status Kehadiran *
                </label>
                <select
                  value={attendanceForm.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setAttendanceForm({
                      ...attendanceForm,
                      status: nextStatus,
                      checkOut: nextStatus === 'Setengah Hari' ? '12:00' : '16:00',
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="Hadir">Hadir Penuh (100% Upah Harian)</option>
                  <option value="Setengah Hari">Setengah Hari (50% Upah Harian ÷ 2)</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Izin">Izin</option>
                  <option value="Tidak Hadir">Tidak Hadir / Alpa</option>
                </select>
              </div>

              {/* 3. Durasi Lembur */}
              {(attendanceForm.status === 'Hadir' || attendanceForm.status === 'Setengah Hari') && (
                <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#EAECF0] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#344054]">
                      Durasi Lembur (Jam & Menit)
                    </label>
                    <div className="flex gap-1">
                      {[0, 15, 30, 45].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setAttendanceForm({ ...attendanceForm, durationMinutes: m })}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                            attendanceForm.durationMinutes === m
                              ? 'bg-[#4693FD] text-white border-[#4693FD]'
                              : 'bg-white text-[#475467] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                          }`}
                        >
                          {m} mnt
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-[#667085] block mb-1">Jam</span>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={attendanceForm.durationHours}
                        onChange={(e) =>
                          setAttendanceForm({
                            ...attendanceForm,
                            durationHours: Math.max(0, Math.floor(Number(e.target.value))),
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#667085] block mb-1">Menit (0-59)</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={attendanceForm.durationMinutes}
                        onChange={(e) =>
                          setAttendanceForm({
                            ...attendanceForm,
                            durationMinutes: Math.max(0, Math.min(59, Math.round(Number(e.target.value)))),
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                      />
                    </div>
                  </div>
                  {attendanceForm.employeeId && (() => {
                    const selAsg = assignments.find((a) => a.employeeId === attendanceForm.employeeId);
                    const selRole = selAsg?.roleInProject || selAsg?.employeeRole || 'Tukang';
                    if (selRole === 'Driver') {
                      return (
                        <p className="text-[11px] text-[#0E9384] font-medium pt-1">
                          Ketentuan Perusahaan: Durasi lembur Driver tetap dicatat untuk operasional, namun upah lembur Driver adalah Rp0.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* 4. Catatan Kehadiran */}
              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Catatan / Keterangan
                </label>
                <input
                  type="text"
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                  placeholder="Catatan aktivitas atau izin..."
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              {/* 5. Bagian Pengajuan Kasbon */}
              <div className="pt-3 border-t border-[#EAECF0] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1D2939] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#6941C6]" />
                      <span>Pengajuan Kasbon</span>
                    </h4>
                    <p className="text-[11px] text-[#667085]">
                      Karyawan penerima kasbon otomatis mengikuti karyawan pada form absensi ini
                    </p>
                  </div>

                  {/* Pilihan "Ajukan Kasbon?" dengan opsi Tidak atau Ya */}
                  <div className="flex items-center gap-1 bg-[#F2F4F7] p-1 rounded-lg border border-[#D0D5DD]">
                    <button
                      type="button"
                      onClick={() => setAttendanceForm({ ...attendanceForm, hasKasbon: false })}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        !attendanceForm.hasKasbon
                          ? 'bg-white text-[#1D2939] shadow-2xs'
                          : 'text-[#667085] hover:text-[#1D2939]'
                      }`}
                    >
                      Tidak
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceForm({ ...attendanceForm, hasKasbon: true })}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        attendanceForm.hasKasbon
                          ? 'bg-[#6941C6] text-white shadow-2xs'
                          : 'text-[#667085] hover:text-[#1D2939]'
                      }`}
                    >
                      Ya
                    </button>
                  </div>
                </div>

                {attendanceForm.hasKasbon && (
                  <div className="p-3.5 bg-[#F9F5FF]/60 rounded-xl border border-[#E9D7FE] space-y-3">
                    {/* 6. Nominal Kasbon */}
                    <div>
                      <label className="text-xs font-semibold text-[#344054] block mb-1">
                        Nominal Kasbon (Rp) <span className="text-[#D92D20]">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Masukkan nominal kasbon (contoh: 300000)"
                        value={attendanceForm.kasbonAmount}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, kasbonAmount: e.target.value })}
                        required={attendanceForm.hasKasbon}
                        className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-bold text-[#1D2939] focus:outline-none focus:border-[#6941C6]"
                      />
                      {Number(attendanceForm.kasbonAmount) > 0 && (
                        <span className="text-[11px] font-mono font-semibold text-[#6941C6] mt-1 block">
                          {formatRupiah(Number(attendanceForm.kasbonAmount))}
                        </span>
                      )}
                    </div>

                    {/* 7. Keterangan Kasbon */}
                    <div>
                      <label className="text-xs font-semibold text-[#344054] block mb-1">
                        Keterangan Kasbon
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Kebutuhan keluarga / Biaya berobat / Pinjaman harian..."
                        value={attendanceForm.kasbonNotes}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, kasbonNotes: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#6941C6]"
                      />
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {[
                          'Kebutuhan keluarga mendesak',
                          'Biaya berobat / beli obat',
                          'Keperluan anak sekolah',
                          'Ongkos transportasi darurat',
                        ].map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setAttendanceForm({ ...attendanceForm, kasbonNotes: sug })}
                            className="px-2 py-0.5 rounded bg-white hover:bg-[#F4EBFF] text-[#6941C6] border border-[#E9D7FE] text-[10px] font-medium transition-colors"
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 8. Upload Bukti Kasbon + Pratinjau + Tombol Ganti/Hapus */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[#344054]">
                          Upload Bukti Kasbon <span className="text-[#667085] font-normal">(Opsional)</span>
                        </label>
                        <span className="text-[10px] text-[#667085]">Maks. 5 MB · JPG, PNG, WebP</span>
                      </div>

                      <input
                        type="file"
                        ref={attKasbonFileInputRef}
                        accept="image/*"
                        onChange={handleAttKasbonPhotoChange}
                        className="hidden"
                      />

                      {selectedAttKasbonPhoto ? (
                        <div className="p-2.5 bg-white rounded-xl border border-[#D0D5DD] space-y-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={selectedAttKasbonPhoto.dataBase64}
                              alt="Pratinjau Bukti Kasbon"
                              className="w-16 h-16 object-cover rounded-lg border border-[#EAECF0] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#1D2939] truncate">
                                {selectedAttKasbonPhoto.fileName}
                              </p>
                              <p className="text-[11px] text-[#667085]">
                                {selectedAttKasbonPhoto.fileSize
                                  ? `${(selectedAttKasbonPhoto.fileSize / 1024).toFixed(0)} KB`
                                  : 'Foto bukti siap disimpan'}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#ECFDF3] text-[#027A48] text-[10px] font-medium">
                                ✓ Pratinjau foto baru
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-[#F2F4F7]">
                            <button
                              type="button"
                              onClick={() => attKasbonFileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-[#F8F9FA] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Ganti Foto
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveAttKasbonPhoto}
                              className="px-2.5 py-1 bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Hapus Foto
                            </button>
                          </div>
                        </div>
                      ) : attendanceForm.existingKasbonAttachmentId && !attendanceForm.removeKasbonPhoto ? (
                        <div className="p-2.5 bg-white rounded-xl border border-[#D0D5DD] space-y-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={getKasbonPhotoViewUrl(attendanceForm.existingKasbonAttachmentId)}
                              alt="Bukti Kasbon Tersimpan"
                              className="w-16 h-16 object-cover rounded-lg border border-[#EAECF0] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#1D2939] truncate">
                                {attendanceForm.existingKasbonAttachmentFileName || 'Bukti Kasbon Tersimpan'}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#EFF5FF] text-[#155EEF] text-[10px] font-medium">
                                Tersimpan di Supabase Storage
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-[#F2F4F7]">
                            <button
                              type="button"
                              onClick={() => attKasbonFileInputRef.current?.click()}
                              className="px-2.5 py-1 bg-[#F8F9FA] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Ganti Foto
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveAttKasbonPhoto}
                              className="px-2.5 py-1 bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA] rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Hapus Foto
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => attKasbonFileInputRef.current?.click()}
                          className="w-full py-3.5 border-2 border-dashed border-[#D0D5DD] hover:border-[#6941C6] bg-white hover:bg-[#F9F5FF] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-[#6941C6]" />
                          <span className="text-xs font-semibold text-[#344054]">
                            Upload Foto Bukti Transfer / Pembayaran Kasbon
                          </span>
                          <span className="text-[10px] text-[#667085]">Klik untuk memilih foto bukti</span>
                        </button>
                      )}

                      {attKasbonPhotoError && (
                        <div className="mt-1.5 p-2 bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] rounded-lg text-[11px] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{attKasbonPhotoError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 9. Tombol Batal dan Simpan */}
              <div className="pt-3 flex justify-end gap-2 border-t border-[#EAECF0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttendanceModalOpen(false);
                    setEditingAttendance(null);
                    setSelectedAttKasbonPhoto(null);
                  }}
                  disabled={savingAttendance}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAttendance}
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {savingAttendance
                    ? 'Menyimpan...'
                    : editingAttendance
                    ? 'Simpan Perubahan'
                    : 'Simpan Presensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CATAT LEMBUR PROYEK */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#EAECF0] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1D2939]">Catat Lembur Tenaga Kerja Proyek</h3>
                <p className="text-xs text-[#667085] mt-0.5">Proyek: {project.name}</p>
              </div>
              <button
                onClick={() => setIsOvertimeModalOpen(false)}
                className="p-1 text-[#667085] hover:text-[#1D2939] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOvertimeSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Pilih Karyawan Ditugaskan *
                </label>
                <select
                  value={overtimeForm.employeeId}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, employeeId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {assignments
                    .filter((asg) => asg.status === 'active' && asg.employeeStatus !== 'inactive')
                    .map((asg) => (
                      <option key={asg.id} value={asg.employeeId}>
                        {asg.employeeName} ({asg.roleInProject || asg.employeeRole})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Tanggal Lembur *
                </label>
                <input
                  type="date"
                  value={overtimeForm.date}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-[#EAECF0] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#344054]">
                    Durasi Lembur Aktual (Jam & Menit) *
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: '1j', h: 1, m: 0 },
                      { label: '1j 30m', h: 1, m: 30 },
                      { label: '2j', h: 2, m: 0 },
                      { label: '2j 30m', h: 2, m: 30 },
                      { label: '3j', h: 3, m: 0 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() =>
                          setOvertimeForm({
                            ...overtimeForm,
                            durationHours: p.h,
                            durationMinutes: p.m,
                            hours: Number((p.h + p.m / 60).toFixed(4)),
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          overtimeForm.durationHours === p.h && overtimeForm.durationMinutes === p.m
                            ? 'bg-[#4693FD] text-white border-[#4693FD]'
                            : 'bg-white text-[#475467] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-[#667085] block mb-1">Jam</span>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={overtimeForm.durationHours}
                      onChange={(e) => {
                        const h = Math.max(0, Math.floor(Number(e.target.value)));
                        setOvertimeForm({
                          ...overtimeForm,
                          durationHours: h,
                          hours: Number((h + overtimeForm.durationMinutes / 60).toFixed(4)),
                        });
                      }}
                      required
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-semibold text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-[#667085] block mb-1">Menit (0 - 59)</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={overtimeForm.durationMinutes}
                      onChange={(e) => {
                        const m = Math.max(0, Math.min(59, Math.round(Number(e.target.value))));
                        setOvertimeForm({
                          ...overtimeForm,
                          durationMinutes: m,
                          hours: Number((overtimeForm.durationHours + m / 60).toFixed(4)),
                        });
                      }}
                      required
                      className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-mono font-semibold text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                    />
                  </div>
                </div>

                {overtimeForm.employeeId && (() => {
                  const selAsg = assignments.find((a) => a.employeeId === overtimeForm.employeeId);
                  const role = selAsg?.roleInProject || selAsg?.employeeRole || 'Tukang';
                  const isDriver = role === 'Driver';
                  const rate = isDriver ? 0 : (selAsg?.overtimeHourlyWage ?? getDefaultWages(role).overtime);
                  const estPay = isDriver
                    ? 0
                    : calculateOvertimePayFromHoursMinutes(
                        overtimeForm.durationHours,
                        overtimeForm.durationMinutes,
                        rate
                      );
                  return (
                    <div className="pt-2 border-t border-[#EAECF0] flex items-center justify-between text-xs">
                      <span className="text-[#475467]">
                        Tarif {role}:{' '}
                        <span className="font-mono font-medium">
                          {isDriver ? 'Rp0/jam (Tanpa Upah Lembur)' : `${formatRupiah(rate)}/jam`}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-[#155EEF]">
                        Total: {formatRupiah(estPay)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-semibold text-[#344054] block mb-1">
                  Catatan Pekerjaan Lembur
                </label>
                <input
                  type="text"
                  value={overtimeForm.notes}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, notes: e.target.value })}
                  placeholder="Pekerjaan pengecoran, lembur shift..."
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#1D2939] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#EAECF0]">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Simpan & Setujui
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PHOTO PROOF PREVIEW MODAL (LIGHTBOX) */}
      {viewingProofExpense && viewingProofExpense.attachments && viewingProofExpense.attachments.length > 0 && (() => {
        const currentViewingPhoto = viewingProofExpense.attachments[activePhotoIndex] || viewingProofExpense.attachments[0];

        return (
          <div className="fixed inset-0 z-50 bg-[#0F172A]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-[#EAECF0] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="p-4 bg-white border-b border-[#EAECF0] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#155EEF] flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-[#1D2939] truncate">
                      Bukti: {viewingProofExpense.transactionNumber}
                    </h3>
                    <p className="text-[11px] text-[#667085] truncate">
                      {viewingProofExpense.category} · PIC: {viewingProofExpense.picName} · {formatRupiah(viewingProofExpense.amount)}
                      {viewingProofExpense.destination ? ` · Tujuan: ${viewingProofExpense.destination}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {viewingProofExpense.attachments.length > 1 && (
                    <span className="text-xs font-mono font-medium text-[#475467] bg-[#F2F4F7] px-2.5 py-1 rounded-md">
                      Foto {activePhotoIndex + 1} dari {viewingProofExpense.attachments.length}
                    </span>
                  )}
                  <button
                    onClick={() => setViewingProofExpense(null)}
                    className="p-1.5 text-[#667085] hover:text-[#1D2939] hover:bg-[#F2F4F7] rounded-lg transition-colors"
                    title="Tutup Pratinjau"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Photo Canvas */}
              <div className="relative p-4 bg-[#1E293B] flex items-center justify-center overflow-auto flex-1 min-h-[300px] sm:min-h-[420px]">
                {/* Loading indicator */}
                {photoLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs text-white z-10">
                    <div className="w-7 h-7 border-2 border-white/30 border-t-[#4693FD] rounded-full animate-spin mb-2"></div>
                    <span className="text-xs font-medium">Memuat foto bukti...</span>
                  </div>
                )}

                {/* Error Fallback */}
                {photoError ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-white max-w-sm z-10">
                    <AlertCircle className="w-10 h-10 text-[#FDA29B] mb-2" />
                    <p className="font-semibold text-sm text-[#FEE4E2]">Gagal Menampilkan Pratinjau</p>
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
                        className="px-3 py-1.5 bg-[#334155] hover:bg-[#475569] text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors border border-white/20"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Coba Lagi</span>
                      </button>
                      <a
                        href={getPhotoViewUrl(currentViewingPhoto.id, true)}
                        download={currentViewingPhoto.fileName}
                        className="px-3 py-1.5 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Foto</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <img
                    key={currentViewingPhoto.id}
                    src={getPhotoViewUrl(currentViewingPhoto.id)}
                    alt={currentViewingPhoto.fileName}
                    className={`max-w-full max-h-[60vh] object-contain rounded-lg transition-transform duration-200 select-none shadow-md ${
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

                {/* Prev Navigation Button */}
                {viewingProofExpense.attachments.length > 1 && (
                  <button
                    onClick={() => {
                      setIsZoomed(false);
                      setActivePhotoIndex((prev) =>
                        prev > 0 ? prev - 1 : viewingProofExpense.attachments!.length - 1
                      );
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-[#0F172A]/70 hover:bg-[#0F172A] text-white rounded-full backdrop-blur-xs transition-colors shadow-lg z-20"
                    title="Foto Sebelumnya"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Next Navigation Button */}
                {viewingProofExpense.attachments.length > 1 && (
                  <button
                    onClick={() => {
                      setIsZoomed(false);
                      setActivePhotoIndex((prev) =>
                        prev < viewingProofExpense.attachments!.length - 1 ? prev + 1 : 0
                      );
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#0F172A]/70 hover:bg-[#0F172A] text-white rounded-full backdrop-blur-xs transition-colors shadow-lg z-20"
                    title="Foto Berikutnya"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Multi-photo Thumbnails Strip */}
              {viewingProofExpense.attachments.length > 1 && (
                <div className="px-4 py-2 bg-[#F8F9FA] border-t border-[#EAECF0] flex items-center gap-2 overflow-x-auto shrink-0">
                  {viewingProofExpense.attachments.map((att, idx) => (
                    <button
                      key={att.id}
                      onClick={() => {
                        setIsZoomed(false);
                        setActivePhotoIndex(idx);
                      }}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all shrink-0 w-12 h-12 bg-white ${
                        activePhotoIndex === idx
                          ? 'border-[#4693FD] ring-2 ring-[#4693FD]/20'
                          : 'border-[#D0D5DD] opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getPhotoViewUrl(att.id)}
                        alt={att.fileName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-3 bg-white border-t border-[#EAECF0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
                <div className="truncate max-w-sm">
                  <span className="font-medium text-[#1D2939] truncate block">
                    {currentViewingPhoto.fileName}
                  </span>
                  <span className="text-[#667085] text-[11px]">
                    {currentViewingPhoto.fileSize
                      ? `${(currentViewingPhoto.fileSize / 1024).toFixed(0)} KB · Format: ${currentViewingPhoto.mimeType || 'image'}`
                      : 'File tersimpan aman di Supabase Storage'}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F8F9FA] hover:bg-[#EEF2F6] text-[#344054] border border-[#D0D5DD] rounded-lg text-xs font-medium transition-colors"
                  >
                    {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                    <span>{isZoomed ? 'Perkecil' : 'Perbesar'}</span>
                  </button>

                  <a
                    href={getPhotoViewUrl(currentViewingPhoto.id, true)}
                    download={currentViewingPhoto.fileName}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Foto</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 1: KONFIRMASI HAPUS BIAYA TRANSPORTASI / OPERASIONAL PROYEK */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#EAECF0] overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#FEF3F2]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FEE4E2] text-[#D92D20] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#B42318]">Hapus Pengeluaran Proyek</h3>
                  <p className="text-xs text-[#7A271A]">Konfirmasi penghapusan transaksi dan file bukti</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={deletingExpense}
                className="p-1.5 text-[#667085] hover:text-[#1D2939] hover:bg-white/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#EAECF0] space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">No. Transaksi:</span>
                  <span className="font-mono font-bold text-[#1D2939]">{expenseToDelete.transactionNumber}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">Kategori & Jenis:</span>
                  <span className="font-medium text-[#1D2939]">
                    {expenseToDelete.category} {expenseToDelete.transportType ? `(${expenseToDelete.transportType})` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">Penanggung Jawab (PIC):</span>
                  <span className="font-medium text-[#1D2939]">{expenseToDelete.picName}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">Tanggal:</span>
                  <span className="font-medium text-[#1D2939]">{formatDateID(expenseToDelete.date)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-[#EAECF0] pt-1.5">
                  <span className="text-[#667085] font-semibold">Nominal:</span>
                  <span className="font-mono font-bold text-base text-[#D92D20]">{formatRupiah(expenseToDelete.amount)}</span>
                </div>
                {expenseToDelete.attachments && expenseToDelete.attachments.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#B54708] bg-[#FEF6EE] px-2.5 py-1 rounded-md mt-1 border border-[#F9DBAF]">
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{expenseToDelete.attachments.length} foto struk bukti di Supabase Storage akan dihapus permanen.</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-[#475467] leading-relaxed">
                Apakah Anda yakin ingin menghapus transaksi ini? Transaksi akan langsung terhapus dari database PostgreSQL dan total biaya transportasi proyek akan diperbarui.
              </p>
            </div>

            <div className="px-5 py-3.5 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={deletingExpense}
                className="px-4 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExpense}
                disabled={deletingExpense}
                className="px-4 py-2 bg-[#D92D20] hover:bg-[#B42318] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                {deletingExpense ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Pengeluaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FORMULIR TAMBAH KASBON KARYAWAN PROYEK */}
      {isAddKasbonModalOpen && (() => {
        const activeProjectEmployees = assignments.filter((a) => a.status === 'active' && a.employeeStatus !== 'inactive');
        const selectedEmpAssignment = assignments.find((a) => a.employeeId === kasbonForm.employeeId);

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#EAECF0] overflow-hidden my-8">
              <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#F9F5FF]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F4EBFF] text-[#7F56D9] flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1D2939]">Tambah Kasbon Karyawan Proyek</h3>
                    <p className="text-xs text-[#667085]">
                      Mencatat pinjaman untuk tenaga kerja proyek {project.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddKasbonModalOpen(false)}
                  disabled={uploadingKasbon}
                  className="p-1.5 text-[#667085] hover:text-[#1D2939] hover:bg-white/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddKasbonSubmit} className="p-5 space-y-4 text-xs">
                {/* 1. Pilih Karyawan Proyek */}
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">
                    Nama Karyawan Proyek <span className="text-[#D92D20]">*</span>
                  </label>
                  {activeProjectEmployees.length === 0 ? (
                    <div className="p-3 bg-[#FEF6EE] border border-[#F9DBAF] text-[#B54708] rounded-xl text-xs">
                      Belum ada karyawan aktif yang ditugaskan pada proyek ini. Harap tambahkan karyawan ke proyek terlebih dahulu melalui menu <strong>Data Penugasan Karyawan</strong>.
                    </div>
                  ) : (
                    <select
                      value={kasbonForm.employeeId}
                      onChange={(e) => setKasbonForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs font-medium text-[#1D2939] focus:outline-hidden focus:ring-2 focus:ring-[#4693FD]/20 focus:border-[#4693FD]"
                    >
                      <option value="">-- Pilih Karyawan Proyek ({activeProjectEmployees.length} aktif) --</option>
                      {activeProjectEmployees.map((asg) => (
                        <option key={asg.employeeId} value={asg.employeeId}>
                          [{asg.employeeId}] {asg.employeeName} — {asg.roleInProject || asg.employeeRole}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Info Box Karyawan Terpilih */}
                  {selectedEmpAssignment && (
                    <div className="mt-2 p-2.5 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="text-[#667085]">ID Karyawan: </span>
                        <span className="font-mono font-semibold text-[#1D2939]">{selectedEmpAssignment.employeeId}</span>
                      </div>
                      <div>
                        <span className="text-[#667085]">Peran: </span>
                        <span className="font-semibold text-[#1D2939]">{selectedEmpAssignment.roleInProject || selectedEmpAssignment.employeeRole}</span>
                      </div>
                      <div>
                        <span className="text-[#667085]">Mulai Kerja: </span>
                        <span className="font-medium text-[#1D2939]">
                          {formatDateID(selectedEmpAssignment.employeeStartDate || selectedEmpAssignment.assignedDate)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Tanggal Pengajuan & Nominal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#344054] mb-1.5">
                      Tanggal Pengajuan <span className="text-[#D92D20]">*</span>
                    </label>
                    <input
                      type="date"
                      value={kasbonForm.requestDate}
                      onChange={(e) => setKasbonForm((prev) => ({ ...prev, requestDate: e.target.value }))}
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939] focus:outline-hidden focus:ring-2 focus:ring-[#4693FD]/20 focus:border-[#4693FD]"
                    >
                    </input>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#344054] mb-1.5">
                      Nominal Kasbon (Rp) <span className="text-[#D92D20]">*</span>
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="any"
                      placeholder="Contoh: 300000"
                      value={kasbonForm.amount}
                      onChange={(e) => setKasbonForm((prev) => ({ ...prev, amount: e.target.value }))}
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs font-mono font-bold text-[#1D2939] focus:outline-hidden focus:ring-2 focus:ring-[#4693FD]/20 focus:border-[#4693FD]"
                    />
                    {Number(kasbonForm.amount) > 0 && (
                      <span className="text-[11px] font-mono text-[#4693FD] font-semibold mt-1 block">
                        {formatRupiah(Number(kasbonForm.amount))}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Alasan / Keperluan Kasbon */}
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">
                    Alasan / Keperluan Kasbon <span className="text-[#D92D20]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Kebutuhan keluarga mendesak / Beli obat / Keperluan anak"
                    value={kasbonForm.reason}
                    onChange={(e) => setKasbonForm((prev) => ({ ...prev, reason: e.target.value }))}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939] focus:outline-hidden focus:ring-2 focus:ring-[#4693FD]/20 focus:border-[#4693FD]"
                  />
                  {/* Quick Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-[#667085]">Pilihan Cepat:</span>
                    {[
                      'Kebutuhan keluarga mendesak',
                      'Biaya berobat / beli obat',
                      'Keperluan anak sekolah',
                      'Kebutuhan darurat rumah',
                      'Ongkos transportasi darurat',
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setKasbonForm((prev) => ({ ...prev, reason: sug }))}
                        className="px-2 py-0.5 rounded-md bg-[#F2F4F7] hover:bg-[#E4E7EC] text-[#344054] text-[10px] font-medium transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Foto Bukti Kasbon (Opsional) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-[#344054]">
                      Foto Bukti Kasbon <span className="text-[#667085] font-normal">(Opsional)</span>
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
                    <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={selectedKasbonPhoto.dataBase64}
                          alt="Pratinjau Bukti"
                          className="w-14 h-14 object-cover rounded-lg border border-[#D0D5DD] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-[#1D2939] truncate">{selectedKasbonPhoto.fileName}</p>
                          <p className="text-[11px] text-[#667085]">
                            {selectedKasbonPhoto.fileSize
                              ? `${(selectedKasbonPhoto.fileSize / 1024).toFixed(0)} KB`
                              : 'Foto siap diunggah'}
                          </p>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-[#ECFDF3] text-[#027A48] text-[10px] font-medium">
                            ✓ Siap disimpan ke Supabase Storage
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveKasbonPhoto}
                        className="p-1.5 text-[#D92D20] hover:bg-[#FEF3F2] rounded-lg transition-colors shrink-0"
                        title="Hapus Foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => kasbonFileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-[#D0D5DD] hover:border-[#4693FD] bg-[#F8F9FA] hover:bg-[#EFF8FF] rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-full bg-white text-[#4693FD] shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-[#344054] group-hover:text-[#4693FD]">
                        Ambil Foto atau Pilih dari Galeri
                      </span>
                      <span className="text-[10px] text-[#667085]">Kuitansi, nota tanda terima, atau transfer</span>
                    </button>
                  )}

                  {kasbonPhotoError && (
                    <div className="mt-1.5 p-2 bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] rounded-lg text-[11px] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{kasbonPhotoError}</span>
                    </div>
                  )}
                </div>

                {/* 5. Catatan Tambahan (Opsional) */}
                <div>
                  <label className="block font-semibold text-[#344054] mb-1.5">
                    Catatan Tambahan <span className="text-[#667085] font-normal">(Opsional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Keterangan kesepakatan pemotongan atau catatan khusus mandor..."
                    value={kasbonForm.adminNotes}
                    onChange={(e) => setKasbonForm((prev) => ({ ...prev, adminNotes: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D0D5DD] rounded-xl text-xs text-[#1D2939] focus:outline-hidden focus:ring-2 focus:ring-[#4693FD]/20 focus:border-[#4693FD]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddKasbonModalOpen(false)}
                    disabled={uploadingKasbon}
                    className="px-4 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingKasbon || activeProjectEmployees.length === 0}
                    className="px-4 py-2 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {uploadingKasbon ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Menyimpan Kasbon...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Simpan Kasbon Proyek</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL 3: KONFIRMASI HAPUS KASBON KARYAWAN */}
      {kasbonToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#EAECF0] overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#FEF3F2]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FEE4E2] text-[#D92D20] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#B42318]">Hapus Kasbon Karyawan</h3>
                  <p className="text-xs text-[#7A271A]">Konfirmasi penghapusan data kasbon</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKasbonToDelete(null)}
                disabled={deletingKasbon}
                className="p-1.5 text-[#667085] hover:text-[#1D2939] hover:bg-white/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#EAECF0] space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">No. Kasbon:</span>
                  <span className="font-mono font-bold text-[#1D2939]">{kasbonToDelete.kasbonNumber}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">Karyawan:</span>
                  <span className="font-semibold text-[#1D2939]">{kasbonToDelete.employeeName} ({kasbonToDelete.employeeId})</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">Nominal Pinjaman:</span>
                  <span className="font-mono font-bold text-[#1D2939]">{formatRupiah(kasbonToDelete.amount)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#667085]">Sudah Dipotong:</span>
                  <span className="font-mono text-[#027A48] font-bold">{formatRupiah(kasbonToDelete.deductedAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-t border-[#EAECF0] pt-1.5">
                  <span className="text-[#667085]">Sisa Kasbon:</span>
                  <span className="font-mono font-bold text-base text-[#D92D20]">{formatRupiah(kasbonToDelete.remainingAmount)}</span>
                </div>
              </div>

              {kasbonToDelete.deductedAmount > 0 || kasbonToDelete.status === 'Lunas' || kasbonToDelete.status === 'Dipotong sebagian' ? (
                <div className="p-3 bg-[#FEF6EE] border border-[#F9DBAF] rounded-xl text-xs text-[#B54708] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Tidak Dapat Dihapus Langsung</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Kasbon ini sudah pernah dipotong sebesar <strong>{formatRupiah(kasbonToDelete.deductedAmount)}</strong> dalam penggajian karyawan. Untuk menjaga validitas audit trail, batalkan slip gaji yang memotong kasbon ini terlebih dahulu sebelum menghapus transaksi.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#475467] leading-relaxed">
                  Apakah Anda yakin ingin menghapus catatan kasbon ini? Data kasbon beserta file foto bukti lampiran di Supabase Storage akan dihapus secara permanen.
                </p>
              )}
            </div>

            <div className="px-5 py-3.5 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setKasbonToDelete(null)}
                disabled={deletingKasbon}
                className="px-4 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                {kasbonToDelete.deductedAmount > 0 ? 'Tutup' : 'Batal'}
              </button>
              {kasbonToDelete.deductedAmount === 0 && kasbonToDelete.status !== 'Lunas' && kasbonToDelete.status !== 'Dipotong sebagian' && (
                <button
                  type="button"
                  onClick={handleConfirmDeleteKasbon}
                  disabled={deletingKasbon}
                  className="px-4 py-2 bg-[#D92D20] hover:bg-[#B42318] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                >
                  {deletingKasbon ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Kasbon</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS ABSENSI PROYEK (ADMIN ONLY) */}
      {isAdmin && attendanceToDelete && (() => {
        const hasActiveKasbon = Boolean(
          attendanceToDelete.kasbonAmount &&
            attendanceToDelete.kasbonAmount > 0 &&
            attendanceToDelete.kasbonStatus !== 'Ditolak'
        );

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full border border-[#EAECF0] shadow-xl overflow-hidden">
              <div className="p-5 bg-[#FEF3F2] border-b border-[#FECDCA] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEE4E2] text-[#D92D20] flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#912018]">Hapus Data Absensi?</h3>
                    <p className="text-[11px] text-[#B42318]">
                      Konfirmasi penghapusan catatan kehadiran karyawan proyek
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceToDelete(null);
                    setDeleteAttendanceError(null);
                  }}
                  disabled={deletingAttendance}
                  className="text-[#912018]/70 hover:text-[#912018] p-1 rounded-lg hover:bg-[#FEE4E2] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Informasi Karyawan, Tanggal, dan Proyek */}
                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] space-y-2 text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#667085]">Nama Karyawan:</span>
                    <span className="font-semibold text-[#1D2939]">
                      {attendanceToDelete.employeeName} ({attendanceToDelete.employeeRole})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#667085]">Tanggal Absensi:</span>
                    <span className="font-mono font-semibold text-[#1D2939]">
                      {formatDateID(attendanceToDelete.date)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#667085]">Proyek:</span>
                    <span className="font-semibold text-[#155EEF]">
                      {project.name} ({project.code})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-t border-[#EAECF0] pt-2">
                    <span className="text-[#667085]">Status & Total Harian:</span>
                    <span className="font-mono font-bold text-[#1D2939]">
                      {attendanceToDelete.status} · {formatRupiah(attendanceToDelete.totalDailyPay || 0)}
                    </span>
                  </div>
                  {hasActiveKasbon && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-[#667085]">Kasbon Terkait:</span>
                      <span className="font-mono font-bold text-[#6941C6]">
                        {formatRupiah(attendanceToDelete.kasbonAmount || 0)} ({attendanceToDelete.kasbonStatus || 'Disetujui'})
                      </span>
                    </div>
                  )}
                </div>

                {/* Peringatan dampak penghapusan */}
                <div className="p-3 bg-[#FFFAEB] border border-[#FEDF89] rounded-xl text-xs text-[#B54708] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#F79009]" />
                    <span>Peringatan Dampak Penghapusan</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Penghapusan data absensi ini dapat memengaruhi perhitungan rekap gaji dua mingguan, jam lembur harian terkait, serta statistik kehadiran proyek.
                  </p>
                </div>

                {/* Info jika memiliki Kasbon Terkait atau Penolakan Sistem */}
                {hasActiveKasbon && !deleteAttendanceError && (
                  <div className="p-3.5 bg-[#EFF8FF] border border-[#B2DDFF] rounded-xl text-xs text-[#175CD3] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#155EEF]" />
                      <span>Informasi Kasbon Terkait</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#1849A9]">
                      Absensi ini memiliki transaksi kasbon terkait sebesar <strong className="font-bold">{formatRupiah(attendanceToDelete.kasbonAmount || 0)}</strong> ({attendanceToDelete.kasbonStatus || 'Disetujui'}). Menghapus absensi ini akan otomatis menghapus catatan kasbon dan lembur pada hari ini.
                    </p>
                  </div>
                )}

                {deleteAttendanceError && (
                  <div className="p-3.5 bg-[#FEF3F2] border border-[#FECDCA] rounded-xl text-xs text-[#B42318] space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#D92D20]" />
                      <span>Penghapusan Ditolak</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {deleteAttendanceError}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceToDelete(null);
                    setDeleteAttendanceError(null);
                  }}
                  disabled={deletingAttendance}
                  className="px-4 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold transition-colors shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAttendance}
                  disabled={deletingAttendance}
                  className="px-4 py-2 bg-[#D92D20] hover:bg-[#B42318] text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                >
                  {deletingAttendance ? (
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

      {/* MODAL 4: LIGHTBOX PRATINJAU FOTO BUKTI KASBON (ADMIN & OWNER) */}
      {viewingProofKasbon && (() => {
        const photoAttachment =
          viewingProofKasbon.attachments && viewingProofKasbon.attachments.length > 0
            ? viewingProofKasbon.attachments[0]
            : {
                id: viewingProofKasbon.id,
                expenseId: viewingProofKasbon.id,
                fileName: viewingProofKasbon.attachmentFileName || `bukti_kasbon_${viewingProofKasbon.kasbonNumber}.jpg`,
                filePath: viewingProofKasbon.attachmentFilePath || '',
                fileSize: viewingProofKasbon.attachmentFileSize || 0,
                mimeType: viewingProofKasbon.attachmentMimeType || 'image/jpeg',
                createdAt: viewingProofKasbon.requestDate,
              };

        return (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#0F172A] rounded-2xl max-w-4xl w-full border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="px-4 sm:px-6 py-3.5 bg-[#1E293B] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-9 h-9 rounded-xl bg-[#4693FD]/20 text-[#4693FD] flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#4693FD]">
                        {viewingProofKasbon.kasbonNumber}
                      </span>
                      <span className="text-white/40">·</span>
                      <span className="text-xs font-bold text-white truncate">
                        {viewingProofKasbon.employeeName}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 truncate">
                      Nominal Kasbon: {formatRupiah(viewingProofKasbon.amount)} · Pengajuan: {formatDateID(viewingProofKasbon.requestDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setViewingProofKasbon(null)}
                    className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Tutup Pratinjau"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Photo Canvas */}
              <div className="relative p-4 bg-[#0F172A] flex items-center justify-center overflow-auto flex-1 min-h-[300px] sm:min-h-[440px]">
                {/* Loading indicator */}
                {kasbonPhotoLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs text-white z-10">
                    <div className="w-7 h-7 border-2 border-white/30 border-t-[#4693FD] rounded-full animate-spin mb-2"></div>
                    <span className="text-xs font-medium">Memuat foto bukti kasbon...</span>
                  </div>
                )}

                {/* Error Fallback */}
                {kasbonPhotoLoadError ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-white max-w-sm z-10">
                    <AlertCircle className="w-10 h-10 text-[#FDA29B] mb-2" />
                    <p className="font-semibold text-sm text-[#FEE4E2]">Gagal Memuat Gambar</p>
                    <p className="text-xs text-[#98A2B3] mt-1 mb-4">
                      File foto tidak dapat ditampilkan langsung di browser atau koneksi sesi tertutup. Anda dapat mencoba memuat ulang atau langsung mengunduh file ini.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setKasbonPhotoLoading(true);
                          setKasbonPhotoLoadError(false);
                        }}
                        className="px-3 py-1.5 bg-[#334155] hover:bg-[#475569] text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors border border-white/20"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Coba Lagi</span>
                      </button>
                      <a
                        href={getKasbonPhotoViewUrl(photoAttachment.id, true)}
                        download={photoAttachment.fileName}
                        className="px-3 py-1.5 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Foto</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <img
                    key={photoAttachment.id}
                    src={getKasbonPhotoViewUrl(photoAttachment.id)}
                    alt={photoAttachment.fileName}
                    className={`max-w-full max-h-[62vh] object-contain rounded-lg transition-transform duration-200 select-none shadow-md ${
                      kasbonPhotoLoading ? 'opacity-0' : 'opacity-100'
                    } ${isKasbonZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'}`}
                    onLoad={() => setKasbonPhotoLoading(false)}
                    onError={() => {
                      setKasbonPhotoLoading(false);
                      setKasbonPhotoLoadError(true);
                    }}
                    onClick={() => setIsKasbonZoomed(!isKasbonZoomed)}
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-3 bg-[#1E293B] border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
                <div className="truncate max-w-sm">
                  <span className="font-medium text-white truncate block">
                    {photoAttachment.fileName}
                  </span>
                  <span className="text-white/60 text-[11px]">
                    {photoAttachment.fileSize
                      ? `${(photoAttachment.fileSize / 1024).toFixed(0)} KB · ${photoAttachment.mimeType || 'image'}`
                      : 'File tersimpan aman di Supabase Storage'}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsKasbonZoomed(!isKasbonZoomed)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#334155] hover:bg-[#475569] text-white border border-white/10 rounded-lg text-xs font-medium transition-colors"
                  >
                    {isKasbonZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                    <span>{isKasbonZoomed ? 'Perkecil' : 'Perbesar'}</span>
                  </button>

                  <a
                    href={getKasbonPhotoViewUrl(photoAttachment.id, true)}
                    download={photoAttachment.fileName}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#4693FD] hover:bg-[#1849A9] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Foto</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL KONFIRMASI HAPUS / NONAKTIFKAN KARYAWAN PROYEK */}
      {assignmentActionModal && (() => {
        const { mode, assignment: asg } = assignmentActionModal;
        const isToggle = mode === 'toggle';
        const nextStatus = asg.status === 'active' ? 'inactive' : 'active';

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full border border-[#EAECF0] shadow-2xl overflow-hidden">
              <div
                className={`p-5 border-b border-[#EAECF0] flex items-center justify-between ${
                  isToggle ? 'bg-[#FFFAEB]' : 'bg-[#FEF3F2]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isToggle
                        ? 'bg-[#FEF0C7] text-[#DC6803]'
                        : 'bg-[#FEE4E2] text-[#D92D20]'
                    }`}
                  >
                    {isToggle ? <AlertCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1D2939]">
                      {isToggle
                        ? nextStatus === 'active'
                          ? 'Aktifkan Kembali Karyawan Proyek?'
                          : 'Nonaktifkan Karyawan Proyek?'
                        : 'Hapus Karyawan dari Proyek?'}
                    </h3>
                    <p className="text-[11px] text-[#667085]">
                      ID: <span className="font-mono font-semibold text-[#155EEF]">{asg.employeeId}</span> · Proyek: {project.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignmentActionModal(null)}
                  disabled={processingAssignmentAction}
                  className="p-1 text-[#667085] hover:text-[#1D2939] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAECF0] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Nama Karyawan:</span>
                    <span className="font-semibold text-[#1D2939]">{asg.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#667085]">Jabatan di Proyek:</span>
                    <span className="font-semibold text-[#1D2939]">
                      {asg.roleInProject || asg.employeeRole}
                    </span>
                  </div>
                </div>

                {isToggle ? (
                  <div className="p-3.5 bg-[#FFFAEB] border border-[#FEDF89] rounded-xl text-[#B54708] space-y-1.5">
                    <p className="font-bold">Riwayat Transaksi Tetap Terlindungi</p>
                    <p className="text-[11px] leading-relaxed">
                      {nextStatus === 'active'
                        ? 'Karyawan akan diaktifkan kembali pada proyek ini dan dapat dipilih pada pencatatan absensi baru.'
                        : 'Karyawan yang dinonaktifkan tidak akan muncul pada daftar aktif atau form absensi baru, namun seluruh riwayat absensi, lembur, kasbon, dan gaji lama tetap tersimpan aman.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-[#FEF3F2] border border-[#FECDCA] rounded-xl text-[#B42318] space-y-1.5">
                    <p className="font-bold">Ketentuan Penghapusan Karyawan</p>
                    <ul className="list-disc pl-4 text-[11px] leading-relaxed space-y-1">
                      <li>
                        <strong>Jika belum memiliki transaksi (salah input):</strong> Data karyawan dan penugasan proyeknya akan <strong>dihapus permanen dari database PostgreSQL/Supabase</strong>.
                      </li>
                      <li>
                        <strong>Jika sudah memiliki riwayat transaksi sah:</strong> Penugasan proyek dilepas dan karyawan dinonaktifkan agar riwayat absensi, kasbon, serta laporan keuangan lama tetap terjaga.
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-[#F9FAFB] border-t border-[#EAECF0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentActionModal(null)}
                  disabled={processingAssignmentAction}
                  className="px-3.5 py-2 bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#D0D5DD] rounded-xl text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignmentAction}
                  disabled={processingAssignmentAction}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
                    isToggle
                      ? 'bg-[#F79009] hover:bg-[#DC6803]'
                      : 'bg-[#D92D20] hover:bg-[#B42318]'
                  }`}
                >
                  {processingAssignmentAction
                    ? 'Memproses...'
                    : isToggle
                    ? nextStatus === 'active'
                      ? 'Ya, Aktifkan'
                      : 'Ya, Nonaktifkan'
                    : 'Ya, Hapus Karyawan'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
