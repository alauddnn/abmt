import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Building,
  Calendar,
  MapPin,
  DollarSign,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { Project } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { ProjectOverviewDashboard } from '../components/ProjectOverviewDashboard.js';

interface ProjectsPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ showToast }) => {
  const { isAdmin, isOwner } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewOnly, setViewOnly] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    client: '',
    location: '',
    startDate: new Date().toISOString().split('T')[0],
    targetEndDate: '',
    budget: 0,
    status: 'Berjalan' as 'Berjalan' | 'Selesai' | 'Persiapan',
    description: '',
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat daftar proyek');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openCreateModal = () => {
    if (!isAdmin) return;
    setEditingProject(null);
    setViewOnly(false);
    setFormData({
      code: `PRJ-${String(projects.length + 1).padStart(3, '0')}`,
      name: '',
      client: '',
      location: '',
      startDate: new Date().toISOString().split('T')[0],
      targetEndDate: '',
      budget: 0,
      status: 'Berjalan',
      description: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    if (!isAdmin) return;
    setEditingProject(p);
    setViewOnly(false);
    setFormData({
      code: p.code,
      name: p.name,
      client: p.client,
      location: p.location,
      startDate: p.startDate,
      targetEndDate: p.targetEndDate || '',
      budget: p.budget,
      status: p.status,
      description: p.description || '',
    });
    setIsModalOpen(true);
  };

  const openDetailModal = (p: Project) => {
    setEditingProject(p);
    setViewOnly(true);
    setFormData({
      code: p.code,
      name: p.name,
      client: p.client,
      location: p.location,
      startDate: p.startDate,
      targetEndDate: p.targetEndDate || '',
      budget: p.budget,
      status: p.status,
      description: p.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak menyimpan proyek.');
      return;
    }

    if (!formData.name.trim() || !formData.client.trim()) {
      showToast('error', 'Nama proyek dan nama klien wajib diisi.');
      return;
    }

    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, formData);
        showToast('success', `Proyek ${formData.name} berhasil diperbarui.`);
      } else {
        await api.createProject(formData);
        showToast('success', `Proyek baru ${formData.name} berhasil ditambahkan.`);
      }
      setIsModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan proyek');
    }
  };

  const handleDelete = async (p: Project) => {
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak menghapus proyek.');
      return;
    }

    if (!window.confirm(`Hapus proyek "${p.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      await api.deleteProject(p.id);
      showToast('success', `Proyek ${p.name} berhasil dihapus.`);
      fetchProjects();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus proyek');
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const activeCount = projects.filter((p) => p.status === 'Berjalan').length;
  const finishedCount = projects.filter((p) => p.status === 'Selesai').length;

  if (selectedProject) {
    return (
      <ProjectOverviewDashboard
        project={selectedProject}
        onBack={() => {
          setSelectedProject(null);
          fetchProjects();
        }}
        showToast={showToast}
      />
    );
  }

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
            <span className="text-xs text-[#667085] font-medium font-mono">Daftar & Portfolio Proyek</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Manajemen & Monitoring Proyek Konstruksi
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            {isAdmin
              ? 'Kelola proyek konstruksi, alokasi anggaran, status pelaksanaan, dan dokumen kontrak.'
              : 'Pemantauan portofolio proyek konstruksi, status pengerjaan, dan anggaran perusahaan (Mode Baca-Saja).'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Proyek Baru</span>
          </button>
        )}
      </div>

      {/* Role Notice for Owner */}
      {isOwner && (
        <div className="bg-[#FEF6EE] border border-[#F9DBAF] rounded-xl p-3.5 flex items-center justify-between text-xs text-[#B54708]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#B54708] shrink-0" />
            <span>
              <strong>Mode Akun Owner:</strong> Anda memiliki akses penuh untuk melihat rincian dan progres seluruh proyek. Penambahan dan perubahan data dikelola oleh Admin.
            </span>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#667085]">Total Seluruh Proyek</p>
          <p className="text-2xl font-semibold text-[#262626] mt-2">{projects.length}</p>
          <p className="text-[11px] text-[#667085] mt-1">Portofolio aktif & selesai</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#16A36A]">Proyek Sedang Berjalan</p>
          <p className="text-2xl font-semibold text-[#16A36A] mt-2">{activeCount}</p>
          <p className="text-[11px] text-[#667085] mt-1">Dalam pengerjaan lapangan</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#4693FD]">Proyek Selesai</p>
          <p className="text-2xl font-semibold text-[#4693FD] mt-2">{finishedCount}</p>
          <p className="text-[11px] text-[#667085] mt-1">Telah serah terima pekerjaan</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs">
          <p className="text-xs font-medium text-[#667085]">Total Nilai Anggaran</p>
          <p className="text-2xl font-semibold text-[#262626] mt-2">{formatRupiah(totalBudget)}</p>
          <p className="text-[11px] text-[#667085] mt-1">Akumulasi nilai kontrak</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama proyek, klien, kode, lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs w-full md:w-auto">
          <label className="text-[#667085] font-medium">Status:</label>
          <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg border border-[#EAECF0]">
            {['all', 'Berjalan', 'Persiapan', 'Selesai'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-white text-[#262626] shadow-xs'
                    : 'text-[#667085] hover:text-[#262626]'
                }`}
              >
                {s === 'all' ? 'Semua' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                <th className="py-3 px-4">Kode Proyek</th>
                <th className="py-3 px-4">Nama Proyek</th>
                <th className="py-3 px-4">Klien</th>
                <th className="py-3 px-4">Lokasi</th>
                <th className="py-3 px-4">Jadwal Pelaksanaan</th>
                <th className="py-3 px-4 text-right">Nilai Anggaran</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#667085]">
                    Memuat data proyek...
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#667085]">
                    Belum ada data proyek sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const statusColors: Record<string, string> = {
                    Berjalan: 'bg-[#EFF5FF] text-[#155EEF] border-[#D0E2FF]',
                    Selesai: 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]',
                    Persiapan: 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]',
                  };

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group"
                      onClick={() => setSelectedProject(p)}
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#4693FD] group-hover:underline">
                        {p.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[#262626] group-hover:text-[#4693FD] transition-colors block">
                          {p.name}
                        </span>
                        {p.description && (
                          <span className="text-[11px] text-[#667085] truncate max-w-xs block">
                            {p.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#344054] font-medium">{p.client}</td>
                      <td className="py-3.5 px-4 text-[#667085]">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#98A2B3] shrink-0" />
                          <span className="truncate max-w-[150px]">{p.location}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#667085]">
                        <div>{formatDateID(p.startDate)}</div>
                        {p.targetEndDate && (
                          <div className="text-[11px] text-[#98A2B3]">s/d {formatDateID(p.targetEndDate)}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-[#262626]">
                        {formatRupiah(p.budget)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                            statusColors[p.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedProject(p)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#4693FD] hover:bg-[#1849A9] rounded-lg transition-colors shadow-xs flex items-center gap-1"
                            title="Buka Project Overview Dashboard"
                          >
                            <FolderKanban className="w-3.5 h-3.5" />
                            <span>Dashboard</span>
                          </button>
                          <button
                            onClick={() => openDetailModal(p)}
                            className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF5FF] rounded transition-colors"
                            title="Lihat Dokumen Kontrak"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF5FF] rounded transition-colors"
                                title="Edit Proyek"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(p)}
                                className="p-1 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded transition-colors"
                                title="Hapus Proyek"
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

      {/* Modal Add / Edit / Detail */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#EAECF0] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#262626]">
                  {viewOnly
                    ? 'Rincian Detail Proyek'
                    : editingProject
                    ? 'Edit Data Proyek'
                    : 'Tambah Proyek Baru'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  {viewOnly
                    ? 'Informasi lengkap proyek dan nilai kontrak'
                    : 'Lengkapi formulir informasi proyek perusahaan'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#98A2B3] hover:text-[#262626] rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Kode Proyek
                  </label>
                  <input
                    type="text"
                    disabled={viewOnly}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#262626]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Status Proyek
                  </label>
                  <select
                    disabled={viewOnly}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                  >
                    <option value="Berjalan">Berjalan</option>
                    <option value="Persiapan">Persiapan</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#344054] mb-1">
                  Nama Proyek
                </label>
                <input
                  type="text"
                  disabled={viewOnly}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Renovasi Kantor Menara Astra Lt. 12"
                  className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Nama Klien / Pemilik
                  </label>
                  <input
                    type="text"
                    disabled={viewOnly}
                    value={formData.client}
                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    placeholder="Contoh: PT Mega Graha"
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Lokasi Proyek
                  </label>
                  <input
                    type="text"
                    disabled={viewOnly}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Contoh: Sudirman, Jakarta Selatan"
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    disabled={viewOnly}
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Target Selesai
                  </label>
                  <input
                    type="date"
                    disabled={viewOnly}
                    value={formData.targetEndDate}
                    onChange={(e) => setFormData({ ...formData, targetEndDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#344054] mb-1">
                  Nilai Anggaran / Kontrak (Rp)
                </label>
                <input
                  type="number"
                  disabled={viewOnly}
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs font-mono font-medium text-[#262626]"
                />
                <p className="text-[11px] text-[#667085] mt-1 font-mono">
                  Terbaca: {formatRupiah(formData.budget)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#344054] mb-1">
                  Deskripsi / Lingkup Pekerjaan
                </label>
                <textarea
                  disabled={viewOnly}
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Catatan lingkup pekerjaan, spesifikasi khusus, dll"
                  className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  {viewOnly ? 'Tutup' : 'Batal'}
                </button>
                {!viewOnly && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white rounded-lg text-xs font-medium shadow-xs"
                  >
                    Simpan Proyek
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
