import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  X,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, useAnimatedNumber } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';
import { ProjectOverviewDashboard } from '../components/ProjectOverviewDashboard.js';

interface ProjectsPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.26,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

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
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

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

    if (!formData.name.trim()) {
      showToast('error', 'Nama proyek wajib diisi.');
      return;
    }

    const payload: Partial<Project> = {
      ...formData,
      code: formData.code.trim() || `PRJ-${String(projects.length + 1).padStart(3, '0')}`,
      name: formData.name.trim(),
      client: formData.client.trim() || '-',
      location: formData.location.trim() || '-',
      startDate: formData.startDate.trim() || new Date().toISOString().split('T')[0],
      targetEndDate: formData.targetEndDate.trim() ? formData.targetEndDate.trim() : (null as any),
      budget: Number(formData.budget) || 0,
      description: formData.description.trim(),
    };

    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, payload);
        showToast('success', `Proyek ${payload.name} berhasil diperbarui.`);
      } else {
        await api.createProject(payload);
        showToast('success', `Proyek baru ${payload.name} berhasil ditambahkan.`);
      }
      setIsModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan proyek');
    }
  };

  const handleDelete = (p: Project) => {
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak menghapus proyek.');
      return;
    }
    setProjectToDelete(p);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeletingProject(true);
    try {
      await api.deleteProject(projectToDelete.id);
      showToast('success', `Proyek ${projectToDelete.name} berhasil dihapus.`);
      setProjectToDelete(null);
      fetchProjects();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus proyek');
    } finally {
      setDeletingProject(false);
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

  // Animated Counters
  const animTotalProjects = useAnimatedNumber(projects.length);
  const animActiveCount = useAnimatedNumber(activeCount);
  const animFinishedCount = useAnimatedNumber(finishedCount);
  const animTotalBudget = useAnimatedNumber(totalBudget);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selectedProject ? (
        <motion.div
          key={`project-detail-${selectedProject.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProjectOverviewDashboard
            project={selectedProject}
            onBack={() => {
              setSelectedProject(null);
              fetchProjects();
            }}
            showToast={showToast}
          />
        </motion.div>
      ) : (
        <motion.div
          key="projects-list"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, y: -8 }}
          className="space-y-7 pb-20"
        >
          {/* Header */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-5"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-[#2563EB]">
                  PT. Asta Brata Matahari Terbit
                </span>
                <span aria-hidden="true">·</span>
                <span>Daftar & Portofolio Proyek</span>
              </div>
              <h1 className="text-2xl sm:text-[26px] font-semibold text-slate-900 tracking-tight">
                Manajemen & Monitoring Proyek Konstruksi
              </h1>
              <p className="text-sm text-slate-500 max-w-2xl">
                {isAdmin
                  ? 'Kelola proyek konstruksi, alokasi anggaran kontrak, jadwal pelaksanaan, dan pusat operasional lapangan.'
                  : 'Pemantauan portofolio proyek konstruksi, status pengerjaan, dan realisasi anggaran perusahaan (Mode Baca-Saja).'}
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="group inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium rounded-xl shadow-xs hover:shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                <span>Tambah Proyek Baru</span>
              </button>
            )}
          </motion.div>

          {/* Role Notice for Owner */}
          {isOwner && (
            <motion.div
              variants={itemVariants}
              className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Mode Akun Owner:</strong> Anda memiliki akses penuh untuk memantau rincian dan progres seluruh proyek. Penambahan dan perubahan data dikelola oleh Administrator.
                </span>
              </div>
            </motion.div>
          )}

          {/* KPI Stats with Staggered Entrance, Animated Counters & Hover Lift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <motion.div
              variants={itemVariants}
              className="kms-card-hover bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-blue-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-slate-500">Total Seluruh Proyek</p>
              {loading && projects.length === 0 ? (
                <div className="h-9 w-16 rounded-lg kms-skeleton mt-3" />
              ) : (
                <p className="text-3xl font-semibold text-slate-900 mt-3 font-mono tabular-nums">
                  {animTotalProjects}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                Portofolio aktif & selesai
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="kms-card-hover bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-emerald-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-slate-500">Proyek Sedang Berjalan</p>
              {loading && projects.length === 0 ? (
                <div className="h-9 w-16 rounded-lg kms-skeleton mt-3" />
              ) : (
                <p className="text-3xl font-semibold text-emerald-600 mt-3 font-mono tabular-nums">
                  {animActiveCount}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                Dalam pengerjaan lapangan
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="kms-card-hover bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-blue-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-slate-500">Proyek Selesai</p>
              {loading && projects.length === 0 ? (
                <div className="h-9 w-16 rounded-lg kms-skeleton mt-3" />
              ) : (
                <p className="text-3xl font-semibold text-[#2563EB] mt-3 font-mono tabular-nums">
                  {animFinishedCount}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                Telah serah terima pekerjaan
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="kms-card-hover bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-blue-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-slate-500">Total Nilai Anggaran</p>
              {loading && projects.length === 0 ? (
                <div className="h-8 w-40 rounded-lg kms-skeleton mt-3" />
              ) : (
                <p className="text-[24px] font-semibold text-slate-900 mt-3 font-mono tabular-nums">
                  {formatRupiah(animTotalBudget)}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                Akumulasi nilai kontrak
              </p>
            </motion.div>
          </div>

          {/* Filter Bar & Projects Table Container */}
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden"
          >
            {/* Toolbar */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Animated Search Input */}
              <div className="relative w-full md:w-96 group">
                <Search className="w-4 h-4 text-slate-400 group-focus-within:text-[#2563EB] transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari nama proyek, klien, kode, atau lokasi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-3 focus:ring-[#2563EB]/12 transition-all"
                />
                <AnimatePresence>
                  {search && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                      aria-label="Bersihkan pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Animated Status Filter Tabs */}
              <div className="flex items-center gap-2.5 text-xs w-full md:w-auto justify-between md:justify-end">
                <span className="text-slate-500 font-medium">Filter Status:</span>
                <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl">
                  {['all', 'Berjalan', 'Persiapan', 'Selesai'].map((s) => {
                    const isSelected = statusFilter === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-slate-900'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="project-status-filter-pill"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            className="absolute inset-0 bg-white rounded-lg shadow-xs"
                          />
                        )}
                        <span className="relative z-10">{s === 'all' ? 'Semua' : s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Projects Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 font-medium border-b border-slate-200/80">
                    <th className="py-3.5 px-6">Kode Proyek</th>
                    <th className="py-3.5 px-6">Nama Proyek</th>
                    <th className="py-3.5 px-6">Klien / Pemilik</th>
                    <th className="py-3.5 px-6">Lokasi</th>
                    <th className="py-3.5 px-6">Jadwal Pelaksanaan</th>
                    <th className="py-3.5 px-6 text-right">Nilai Anggaran</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={`proj-skel-${idx}`}>
                        <td className="py-4 px-6"><div className="h-4 w-16 rounded kms-skeleton" /></td>
                        <td className="py-4 px-6"><div className="h-4 w-44 rounded kms-skeleton" /></td>
                        <td className="py-4 px-6"><div className="h-4 w-28 rounded kms-skeleton" /></td>
                        <td className="py-4 px-6"><div className="h-4 w-24 rounded kms-skeleton" /></td>
                        <td className="py-4 px-6"><div className="h-4 w-24 rounded kms-skeleton" /></td>
                        <td className="py-4 px-6 text-right"><div className="h-4 w-28 rounded kms-skeleton ml-auto" /></td>
                        <td className="py-4 px-6"><div className="h-4 w-16 rounded kms-skeleton" /></td>
                        <td className="py-4 px-6 text-right"><div className="h-7 w-28 rounded-lg kms-skeleton ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-slate-500">
                        Belum ada data proyek yang sesuai dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => {
                      const statusTextColors: Record<string, string> = {
                        Berjalan: 'text-[#2563EB]',
                        Selesai: 'text-emerald-700',
                        Persiapan: 'text-amber-700',
                      };

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-blue-50/35 transition-colors cursor-pointer group"
                          onClick={() => setSelectedProject(p)}
                        >
                          <td className="py-4 px-6 font-mono font-semibold text-[#2563EB] group-hover:underline whitespace-nowrap">
                            {p.code}
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors block text-xs sm:text-sm">
                              {p.name}
                            </span>
                            {p.description && (
                              <span className="text-xs text-slate-500 truncate max-w-xs block mt-0.5">
                                {p.description}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-700 font-medium whitespace-nowrap">
                            {p.client || '-'}
                          </td>
                          <td className="py-4 px-6 text-slate-600 whitespace-nowrap">
                            <span className="truncate max-w-[180px] inline-block">{p.location}</span>
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-mono tabular-nums whitespace-nowrap">
                            <div>{formatDateID(p.startDate)}</div>
                            {p.targetEndDate ? (
                              <div className="text-[11px] text-slate-400 mt-0.5">s/d {formatDateID(p.targetEndDate)}</div>
                            ) : (
                              <div className="text-[11px] text-slate-400 mt-0.5">Target terbuka</div>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatRupiah(p.budget)}
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span
                              className={`text-xs font-semibold ${
                                statusTextColors[p.status] || 'text-slate-700'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td
                            className="py-4 px-6 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedProject(p)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                title="Buka Dashboard Operasional Proyek"
                              >
                                <FolderKanban className="w-3.5 h-3.5" />
                                <span>Buka Proyek</span>
                              </button>
                              <button
                                onClick={() => openDetailModal(p)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Lihat Rincian Kontrak"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => openEditModal(p)}
                                    className="p-1.5 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Proyek"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(p)}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          </motion.div>

          {/* Modal Add / Edit / Detail with Smooth Solvik-style AnimatePresence */}
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                key="project-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setIsModalOpen(false)}
                className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              >
                <motion.div
                  key="project-modal-panel"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8"
                >
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                        <span>Portofolio Proyek</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[#2563EB]">{formData.code || 'PRJ-BARU'}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                        {viewOnly
                          ? 'Rincian Dokumen Kontrak Proyek'
                          : editingProject
                          ? 'Edit Informasi Proyek'
                          : 'Tambah Proyek Konstruksi Baru'}
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="p-6 space-y-5">
                    {/* Row 1: Kode & Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Kode Proyek
                        </label>
                        <input
                          type="text"
                          disabled={viewOnly}
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Status Pelaksanaan
                        </label>
                        <select
                          disabled={viewOnly}
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                          className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        >
                          <option value="Berjalan">Berjalan (Aktif)</option>
                          <option value="Persiapan">Persiapan</option>
                          <option value="Selesai">Selesai</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Nama Proyek */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Nama Proyek Konstruksi
                      </label>
                      <input
                        type="text"
                        disabled={viewOnly}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Contoh: PT. ZUNGLAO atau Renovasi Gudang Merak"
                        className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        required
                      />
                    </div>

                    {/* Row 3: Klien & Lokasi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Nama Klien / Pemilik
                        </label>
                        <input
                          type="text"
                          disabled={viewOnly}
                          value={formData.client}
                          onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                          placeholder="Contoh: PT Mega Graha atau -"
                          className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Lokasi Proyek
                        </label>
                        <input
                          type="text"
                          disabled={viewOnly}
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder="Contoh: Cikande, Serang"
                          className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Row 4: Jadwal Mulai & Target Selesai */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Tanggal Mulai
                        </label>
                        <input
                          type="date"
                          disabled={viewOnly}
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full px-3.5 py-2 bg-white disabled:bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-slate-700">
                            Target Selesai <span className="text-slate-400 font-normal">(Opsional)</span>
                          </label>
                          {!viewOnly && formData.targetEndDate && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, targetEndDate: '' })}
                              className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
                            >
                              Kosongkan
                            </button>
                          )}
                        </div>
                        <input
                          type="date"
                          disabled={viewOnly}
                          value={formData.targetEndDate}
                          onChange={(e) => setFormData({ ...formData, targetEndDate: e.target.value })}
                          className="w-full px-3.5 py-2 bg-white disabled:bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        />
                      </div>
                    </div>

                    {/* Row 5: Nilai Anggaran */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-slate-700">
                          Nilai Anggaran / Kontrak (Rp)
                        </label>
                        <span className="text-xs font-mono font-semibold text-[#2563EB] tabular-nums">
                          {formatRupiah(formData.budget)}
                        </span>
                      </div>
                      <input
                        type="number"
                        disabled={viewOnly}
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 tabular-nums focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                      />
                    </div>

                    {/* Row 6: Deskripsi */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Deskripsi / Lingkup Pekerjaan <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <textarea
                        disabled={viewOnly}
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Catatan lingkup pekerjaan, spesifikasi khusus, dll."
                        className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                      />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {viewOnly ? 'Tutup Rincian' : 'Batal'}
                      </button>
                      {!viewOnly && (
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-medium shadow-xs hover:shadow-md transition-all cursor-pointer"
                        >
                          Simpan Proyek
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal Konfirmasi Hapus Proyek with AnimatePresence */}
          <AnimatePresence>
            {projectToDelete && (
              <motion.div
                key="delete-project-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => !deletingProject && setProjectToDelete(null)}
                className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
              >
                <motion.div
                  key="delete-project-panel"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/70">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-rose-950">Hapus Data Proyek?</h3>
                        <p className="text-[11px] text-rose-700">Konfirmasi penghapusan proyek perusahaan</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setProjectToDelete(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4 text-xs text-slate-700">
                    <p className="leading-relaxed">
                      Apakah Anda yakin ingin menghapus proyek{' '}
                      <strong className="text-slate-900">
                        {projectToDelete.name} ({projectToDelete.code})
                      </strong>
                      ?
                    </p>
                    <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-[11px] leading-relaxed">
                      <strong>Catatan Perlindungan Data:</strong> Proyek yang sudah memiliki riwayat absensi, lembur, kasbon, atau pengeluaran tidak dapat dihapus secara permanen demi menjaga keutuhan riwayat keuangan.
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                      <button
                        type="button"
                        disabled={deletingProject}
                        onClick={() => setProjectToDelete(null)}
                        className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={deletingProject}
                        onClick={confirmDeleteProject}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {deletingProject ? 'Menghapus...' : 'Ya, Hapus Proyek'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
