import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  HardHat,
  Award,
  Truck,
  Phone,
  Calendar,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  ShieldAlert,
} from 'lucide-react';
import { Employee, EmployeeRole } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';

interface EmployeesPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const EmployeesPage: React.FC<EmployeesPageProps> = ({ showToast }) => {
  const { isAdmin, isOwner } = useAuth();
  const { settings } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Mandor' | 'Tukang' | 'Helper' | 'Driver'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);

  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    role: EmployeeRole;
    dailyWage: number;
    overtimeHourlyWage: number;
    startDate: string;
    status: 'active' | 'inactive';
    phone: string;
    notes: string;
  }>({
    id: '',
    name: '',
    role: 'Tukang',
    dailyWage: 150000,
    overtimeHourlyWage: 20000,
    startDate: getTodayDateString(),
    status: 'active',
    phone: '',
    notes: '',
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees();
      setEmployees(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openCreateModal = () => {
    if (!isAdmin) return;
    setEditingEmp(null);
    setIsViewOnly(false);
    setFormData({
      id: '',
      name: '',
      role: 'Tukang',
      dailyWage: settings?.wageTukangDaily || 150000,
      overtimeHourlyWage: settings?.overtimeTukangHourly || 20000,
      startDate: getTodayDateString(),
      status: 'active',
      phone: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    if (!isAdmin) return;
    setEditingEmp(emp);
    setIsViewOnly(false);
    setFormData({
      id: emp.id,
      name: emp.name,
      role: (emp.role === 'Kenek' ? 'Helper' : emp.role) as EmployeeRole,
      dailyWage: emp.dailyWage,
      overtimeHourlyWage: emp.overtimeHourlyWage,
      startDate: emp.startDate,
      status: emp.status,
      phone: emp.phone || '',
      notes: emp.notes || '',
    });
    setIsModalOpen(true);
  };

  const openDetailModal = (emp: Employee) => {
    setEditingEmp(emp);
    setIsViewOnly(true);
    setFormData({
      id: emp.id,
      name: emp.name,
      role: (emp.role === 'Kenek' ? 'Helper' : emp.role) as EmployeeRole,
      dailyWage: emp.dailyWage,
      overtimeHourlyWage: emp.overtimeHourlyWage,
      startDate: emp.startDate,
      status: emp.status,
      phone: emp.phone || '',
      notes: emp.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleRoleChange = (role: EmployeeRole) => {
    let dailyWage = settings?.wageTukangDaily || 150000;
    let overtimeHourlyWage = settings?.overtimeTukangHourly || 20000;

    if (role === 'Mandor') {
      dailyWage = settings?.wageMandorDaily || 200000;
      overtimeHourlyWage = settings?.overtimeMandorHourly || 25000;
    } else if (role === 'Helper' || role === 'Kenek') {
      dailyWage = settings?.wageHelperDaily || settings?.wageKenekDaily || 125000;
      overtimeHourlyWage = settings?.overtimeHelperHourly || settings?.overtimeKenekHourly || 15000;
    } else if (role === 'Driver') {
      dailyWage = settings?.wageDriverDaily || 140000;
      overtimeHourlyWage = settings?.overtimeDriverHourly || 18000;
    }

    setFormData({
      ...formData,
      role,
      dailyWage,
      overtimeHourlyWage,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak mengubah data karyawan.');
      return;
    }

    if (!formData.name.trim()) {
      showToast('error', 'Nama karyawan wajib diisi.');
      return;
    }

    try {
      if (editingEmp) {
        await api.updateEmployee(editingEmp.id, formData);
        showToast('success', `Data ${formData.name} berhasil diperbarui.`);
      } else {
        await api.createEmployee(formData);
        showToast('success', `Karyawan baru ${formData.name} berhasil ditambahkan.`);
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan data karyawan');
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak menghapus karyawan.');
      return;
    }

    if (!window.confirm(`Hapus data karyawan "${emp.name}" (${emp.id})? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      await api.deleteEmployee(emp.id);
      showToast('success', `Data karyawan ${emp.name} berhasil dihapus.`);
      fetchEmployees();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus karyawan');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.id.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === 'all' ||
      emp.role === roleFilter ||
      (roleFilter === 'Helper' && emp.role === 'Kenek');
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const countMandor = employees.filter((e) => e.role === 'Mandor').length;
  const countTukang = employees.filter((e) => e.role === 'Tukang').length;
  const countHelper = employees.filter((e) => e.role === 'Helper' || e.role === 'Kenek').length;
  const countDriver = employees.filter((e) => e.role === 'Driver').length;

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
            <span className="text-xs text-[#667085] font-medium font-mono">Database Tenaga Kerja</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Data Karyawan & Personel Proyek
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            {isAdmin
              ? 'Kelola data identitas mandor, tukang, helper, driver, penyesuaian ID manual, serta kustomisasi tarif gaji dan lembur.'
              : 'Pemantauan data identitas personil proyek dan status keaktifan tenaga kerja (Mode Baca-Saja).'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Karyawan Baru</span>
          </button>
        )}
      </div>

      {/* Role Notice for Owner */}
      {isOwner && (
        <div className="bg-[#FEF6EE] border border-[#F9DBAF] rounded-xl p-3.5 flex items-center justify-between text-xs text-[#B54708]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#B54708] shrink-0" />
            <span>
              <strong>Mode Akun Owner:</strong> Anda memiliki akses baca untuk seluruh data karyawan, tarif, dan profil. Perubahan data hanya dapat dilakukan oleh Admin.
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#667085]">Total Personil</p>
          <p className="text-xl font-semibold text-[#262626] mt-1.5">{employees.length}</p>
          <p className="text-[10px] text-[#667085] mt-0.5">Semua jabatan</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#7F56D9]">Mandor</p>
          <p className="text-xl font-semibold text-[#7F56D9] mt-1.5">{countMandor}</p>
          <p className="text-[10px] text-[#667085] mt-0.5">Pengawas lapangan</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#4693FD]">Tukang</p>
          <p className="text-xl font-semibold text-[#4693FD] mt-1.5">{countTukang}</p>
          <p className="text-[10px] text-[#667085] mt-0.5">Tenaga terampil</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#D99A23]">Helper</p>
          <p className="text-xl font-semibold text-[#D99A23] mt-1.5">{countHelper}</p>
          <p className="text-[10px] text-[#667085] mt-0.5">Pembantu tukang</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#0E9384]">Driver</p>
          <p className="text-xl font-semibold text-[#0E9384] mt-1.5">{countDriver}</p>
          <p className="text-[10px] text-[#667085] mt-0.5">Logistik & armada</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama atau ID karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0]">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                roleFilter === 'all' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Semua ({employees.length})
            </button>
            <button
              onClick={() => setRoleFilter('Mandor')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                roleFilter === 'Mandor' ? 'bg-white text-[#7F56D9] shadow-xs' : 'text-[#667085] hover:text-[#7F56D9]'
              }`}
            >
              Mandor ({countMandor})
            </button>
            <button
              onClick={() => setRoleFilter('Tukang')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                roleFilter === 'Tukang' ? 'bg-white text-[#4693FD] shadow-xs' : 'text-[#667085] hover:text-[#4693FD]'
              }`}
            >
              Tukang ({countTukang})
            </button>
            <button
              onClick={() => setRoleFilter('Helper')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                roleFilter === 'Helper' ? 'bg-white text-[#D99A23] shadow-xs' : 'text-[#667085] hover:text-[#D99A23]'
              }`}
            >
              Helper ({countHelper})
            </button>
            <button
              onClick={() => setRoleFilter('Driver')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                roleFilter === 'Driver' ? 'bg-white text-[#0E9384] shadow-xs' : 'text-[#667085] hover:text-[#0E9384]'
              }`}
            >
              Driver ({countDriver})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                statusFilter === 'active' ? 'bg-white text-[#16A36A] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Aktif
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors ${
                statusFilter === 'inactive' ? 'bg-white text-[#D64545] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
              }`}
            >
              Nonaktif
            </button>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                <th className="py-3 px-4">ID Karyawan</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4 text-right">Gaji Pokok / Hari</th>
                <th className="py-3 px-4 text-right">Tarif Lembur / Jam</th>
                <th className="py-3 px-4">Mulai Bekerja</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Telepon & Catatan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[#667085]">
                    Memuat data karyawan...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[#667085]">
                    Tidak ada karyawan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#4693FD]">{emp.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center font-semibold text-xs shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <span className="font-medium text-[#262626] text-xs">{emp.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {emp.role === 'Mandor' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F9F5FF] text-[#7F56D9] border border-[#E9D7FE]">
                          <Award className="w-3 h-3 text-[#7F56D9]" />
                          Mandor
                        </span>
                      )}
                      {emp.role === 'Tukang' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF5FF] text-[#4693FD] border border-[#D0E2FF]">
                          <HardHat className="w-3 h-3 text-[#4693FD]" />
                          Tukang
                        </span>
                      )}
                      {(emp.role === 'Helper' || emp.role === 'Kenek') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FEF7EC] text-[#D99A23] border border-[#FEDF89]">
                          <Users className="w-3 h-3 text-[#D99A23]" />
                          Helper
                        </span>
                      )}
                      {emp.role === 'Driver' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF9] text-[#0E9384] border border-[#99F6E0]">
                          <Truck className="w-3 h-3 text-[#0E9384]" />
                          Driver
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#262626] tabular-nums">
                      {formatRupiah(emp.dailyWage)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#667085] tabular-nums">
                      {formatRupiah(emp.overtimeHourlyWage)}
                    </td>
                    <td className="py-3 px-4 text-[#667085] whitespace-nowrap">
                      {formatDateID(emp.startDate)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          emp.status === 'active'
                            ? 'bg-[#ECFDF3] text-[#16A36A]'
                            : 'bg-[#F2F4F7] text-[#667085]'
                        }`}
                      >
                        {emp.status === 'active' ? (
                          <CheckCircle2 className="w-3 h-3 text-[#16A36A]" />
                        ) : (
                          <XCircle className="w-3 h-3 text-[#98A2B3]" />
                        )}
                        {emp.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">
                      <p className="text-[#344054] truncate">{emp.phone || '-'}</p>
                      <p className="text-[#98A2B3] text-[11px] truncate">{emp.notes || '-'}</p>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openDetailModal(emp)}
                          className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF5FF] rounded transition-colors"
                          title="Lihat Detail Karyawan"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF5FF] rounded transition-colors"
                              title="Edit Karyawan"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp)}
                              className="p-1 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded transition-colors"
                              title="Hapus Karyawan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
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

      {/* Edit / Add / Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#EAECF0] overflow-hidden">
            <div className="px-6 py-4 bg-white text-[#262626] border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">
                  {isViewOnly
                    ? `Detail Karyawan: ${editingEmp?.name}`
                    : editingEmp
                    ? `Edit Data Karyawan: ${editingEmp.name}`
                    : 'Tambah Karyawan Baru'}
                </h3>
                <p className="text-[11px] text-[#667085]">
                  {isViewOnly ? 'Mode pratinjau data tenaga kerja' : 'ID karyawan dapat ditentukan secara manual'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#667085] hover:text-[#262626] p-1 rounded-md hover:bg-[#F2F4F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {/* Manual ID Input */}
              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  ID Karyawan <span className="text-[#667085] font-normal font-mono">(Dapat diedit manual)</span>
                </label>
                <input
                  type="text"
                  disabled={isViewOnly}
                  placeholder="Contoh: EMP-TK-01 atau ID Khusus"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs font-mono font-medium text-[#4693FD] focus:outline-none focus:border-[#4693FD]"
                />
                <p className="text-[10px] text-[#667085] mt-0.5">
                  Kosongkan saat tambah baru jika ingin ID dibuat otomatis sesuai format perusahaan.
                </p>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  Nama Lengkap Karyawan *
                </label>
                <input
                  type="text"
                  required
                  disabled={isViewOnly}
                  placeholder="Contoh: Budi Santoso"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Jabatan *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={isViewOnly}
                    onClick={() => handleRoleChange('Mandor')}
                    className={`py-2 px-2.5 rounded-lg border font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      formData.role === 'Mandor'
                        ? 'bg-[#F9F5FF] text-[#7F56D9] border-[#7F56D9]'
                        : 'bg-white text-[#667085] border-[#D0D5DD]'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    Mandor
                  </button>
                  <button
                    type="button"
                    disabled={isViewOnly}
                    onClick={() => handleRoleChange('Tukang')}
                    className={`py-2 px-2.5 rounded-lg border font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      formData.role === 'Tukang'
                        ? 'bg-[#EFF5FF] text-[#4693FD] border-[#4693FD]'
                        : 'bg-white text-[#667085] border-[#D0D5DD]'
                    }`}
                  >
                    <HardHat className="w-3.5 h-3.5" />
                    Tukang
                  </button>
                  <button
                    type="button"
                    disabled={isViewOnly}
                    onClick={() => handleRoleChange('Helper')}
                    className={`py-2 px-2.5 rounded-lg border font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      formData.role === 'Helper' || formData.role === 'Kenek'
                        ? 'bg-[#FEF7EC] text-[#D99A23] border-[#FEDF89]'
                        : 'bg-white text-[#667085] border-[#D0D5DD]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Helper
                  </button>
                  <button
                    type="button"
                    disabled={isViewOnly}
                    onClick={() => handleRoleChange('Driver')}
                    className={`py-2 px-2.5 rounded-lg border font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      formData.role === 'Driver'
                        ? 'bg-[#F0FDF9] text-[#0E9384] border-[#99F6E0]'
                        : 'bg-white text-[#667085] border-[#D0D5DD]'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Driver
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-[#344054]">
                      Gaji Normal / Hari (IDR) *
                    </label>
                  </div>
                  <input
                    type="number"
                    step={1000}
                    required
                    disabled={isViewOnly}
                    value={formData.dailyWage}
                    onChange={(e) => setFormData({ ...formData, dailyWage: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                    placeholder="Contoh: 150000"
                  />
                  <p className="text-[10px] text-[#667085] mt-0.5">Bebas Anda kustomisasi per personil</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-[#344054]">
                      Tarif Lembur / Jam (IDR) *
                    </label>
                  </div>
                  <input
                    type="number"
                    step={1000}
                    required
                    disabled={isViewOnly}
                    value={formData.overtimeHourlyWage}
                    onChange={(e) =>
                      setFormData({ ...formData, overtimeHourlyWage: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                    placeholder="Contoh: 20000"
                  />
                  <p className="text-[10px] text-[#667085] mt-0.5">Bebas Anda kustomisasi per personil</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">
                    Mulai Bekerja *
                  </label>
                  <input
                    type="date"
                    required
                    disabled={isViewOnly}
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Status Karyawan</label>
                  <select
                    disabled={isViewOnly}
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
                    }
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  >
                    <option value="active">Aktif Bekerja</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  Nomor HP / WhatsApp (Opsional)
                </label>
                <input
                  type="text"
                  disabled={isViewOnly}
                  placeholder="0812-xxxx-xxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Catatan Keahlian</label>
                <textarea
                  rows={2}
                  disabled={isViewOnly}
                  placeholder="Contoh: Ahli pasang bata hebel, acian halus, cor dak"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] font-medium rounded-lg border border-[#D0D5DD] text-xs transition-colors"
                >
                  {isViewOnly ? 'Tutup' : 'Batal'}
                </button>
                {!isViewOnly && (
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#4693FD] hover:bg-[#357ee8] text-white font-medium rounded-lg text-xs shadow-xs transition-colors"
                  >
                    {editingEmp ? 'Simpan Perubahan' : 'Tambah Karyawan'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
