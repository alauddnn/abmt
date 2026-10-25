import React, { useState, useEffect } from 'react';
import {
  History,
  Shield,
  Search,
  Filter,
  Calendar,
  Lock,
  User,
  Clock,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  X,
  ShieldAlert,
} from 'lucide-react';
import { AuditLog, AppUser } from '../types.js';
import { api } from '../lib/api.js';
import { formatDateTimeID, formatDateID } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.js';

interface AuditLogPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ showToast }) => {
  const { isAdmin, isOwner, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'logs' | 'users'>('logs');

  // Logs State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  // Users State
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    name: '',
    role: 'admin' as 'admin' | 'owner',
    password: '',
  });

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat catatan audit');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat daftar pengguna');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, []);

  const openAddUserModal = () => {
    if (!isAdmin) return;
    setEditingUser(null);
    setUserFormData({
      username: '',
      email: '',
      name: '',
      role: 'admin',
      password: '',
    });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (u: AppUser) => {
    if (!isAdmin) return;
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      email: u.email,
      name: u.name,
      role: u.role,
      password: '',
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak mengelola akun.');
      return;
    }

    if (!userFormData.name.trim() || !userFormData.username.trim()) {
      showToast('error', 'Nama dan username wajib diisi.');
      return;
    }

    if (!editingUser && !userFormData.password) {
      showToast('error', 'Password wajib diisi untuk pengguna baru.');
      return;
    }

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, userFormData);
        showToast('success', `Akun ${userFormData.username} berhasil diperbarui.`);
      } else {
        await api.createUser(userFormData);
        showToast('success', `Akun baru ${userFormData.username} (${userFormData.role.toUpperCase()}) berhasil dibuat.`);
      }
      setIsUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan data pengguna');
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak menghapus akun.');
      return;
    }

    if (currentUser?.username === u.username) {
      showToast('error', 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
      return;
    }

    if (!window.confirm(`Hapus akun pengguna "${u.username}" (${u.name})?`)) {
      return;
    }

    try {
      await api.deleteUser(u.id);
      showToast('success', `Akun pengguna ${u.username} berhasil dihapus.`);
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menghapus pengguna');
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

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
            <span className="text-xs text-[#667085] font-medium font-mono">Keamanan & Audit Trail</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Pengguna, Hak Akses & Riwayat Audit
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Merekam seluruh jejak aktivitas transaksi, kelola akun pengguna perusahaan, dan kontrol akses berbasis 2 Role (Admin & Owner).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#F2F4F7] p-0.5 rounded-lg text-xs border border-[#EAECF0] shrink-0">
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'logs' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#4693FD]" />
            <span>Audit Log ({logs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'users' ? 'bg-white text-[#262626] shadow-xs' : 'text-[#667085] hover:text-[#262626]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#4693FD]" />
            <span>Kelola Pengguna ({users.length})</span>
          </button>
        </div>
      </div>

      {/* Owner Notice */}
      {isOwner && (
        <div className="bg-[#FEF6EE] border border-[#F9DBAF] rounded-xl p-3.5 flex items-center justify-between text-xs text-[#B54708]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#B54708] shrink-0" />
            <span>
              <strong>Mode Akun Owner:</strong> Anda memiliki akses baca untuk riwayat aktivitas dan daftar akun pengguna. Penambahan atau pengubahan akun dikelola oleh Admin.
            </span>
          </div>
        </div>
      )}

      {activeTab === 'logs' ? (
        <>
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#EAECF0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari aktivitas, admin, atau detail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs">
                <label className="text-[#667085] font-medium">Modul:</label>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                >
                  <option value="all">Semua Modul</option>
                  <option value="Karyawan">Karyawan</option>
                  <option value="Proyek">Proyek</option>
                  <option value="Absensi">Absensi</option>
                  <option value="Lembur">Lembur</option>
                  <option value="Kasbon">Kasbon</option>
                  <option value="Gaji">Gaji</option>
                  <option value="Operasional">Operasional</option>
                  <option value="Pengaturan">Pengaturan</option>
                  <option value="Pengguna">Pengguna</option>
                  <option value="Sistem">Sistem</option>
                </select>
              </div>

              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-medium rounded-lg border border-[#D0D5DD] shadow-xs transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#667085] ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">Waktu (WIB)</th>
                    <th className="py-3 px-4">Pengguna</th>
                    <th className="py-3 px-4">Peran (Role)</th>
                    <th className="py-3 px-4">Modul</th>
                    <th className="py-3 px-4">Aksi</th>
                    <th className="py-3 px-4">Rincian Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#667085]">
                        Memuat catatan audit log...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#667085]">
                        Belum ada riwayat aktivitas log sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isLogAdmin = log.userRole?.toLowerCase().includes('admin');
                      return (
                        <tr key={log.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-3 px-4 font-mono text-[#667085] whitespace-nowrap">
                            {formatDateTimeID(log.timestamp)}
                          </td>
                          <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">
                            {log.userName}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                isLogAdmin
                                  ? 'bg-[#EFF5FF] text-[#155EEF] border-[#D0E2FF]'
                                  : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                              }`}
                            >
                              {isLogAdmin ? <Shield className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                              {isLogAdmin ? 'ADMIN' : 'OWNER'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-medium text-[#344054]">{log.module}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-[#262626] whitespace-nowrap">
                            {log.action}
                          </td>
                          <td className="py-3 px-4 text-[#667085] max-w-md">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Users Management Tab */
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#262626]">Daftar Akun Pengguna Sistem</h3>
              <p className="text-xs text-[#667085] mt-0.5">
                Pengguna terdaftar dengan autentikasi kata sandi terenkripsi (SHA-512 with unique salt)
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={openAddUserModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Pengguna Baru</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Hak Akses (Role)</th>
                    <th className="py-3 px-4">Izin & Wewenang</th>
                    <th className="py-3 px-4">Dibuat Pada</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#667085]">
                        Memuat daftar pengguna...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[#667085]">
                        Belum ada pengguna.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isUserAdmin = u.role === 'admin';
                      return (
                        <tr key={u.id} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full border flex items-center justify-center font-semibold text-xs shrink-0 ${
                                  isUserAdmin
                                    ? 'bg-[#EFF5FF] text-[#4693FD] border-[#D0E2FF]'
                                    : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                                }`}
                              >
                                {isUserAdmin ? 'AD' : 'OW'}
                              </div>
                              <span className="font-semibold text-[#262626]">{u.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-[#4693FD]">
                            {u.username}
                          </td>
                          <td className="py-3 px-4 text-[#667085]">{u.email}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isUserAdmin
                                  ? 'bg-[#EFF5FF] text-[#155EEF] border-[#D0E2FF]'
                                  : 'bg-[#FEF6EE] text-[#B54708] border-[#F9DBAF]'
                              }`}
                            >
                              {isUserAdmin ? <Shield className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                              {isUserAdmin ? 'ADMIN' : 'OWNER'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#667085]">
                            {isUserAdmin ? (
                              <span className="text-[#155EEF] font-medium">Akses Penuh (Baca & Tulis)</span>
                            ) : (
                              <span className="text-[#B54708] font-medium">Akses Baca-Saja (Read-Only)</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#667085] font-mono text-[11px]">
                            {u.createdAt ? formatDateID(u.createdAt.split('T')[0]) : '-'}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => openEditUserModal(u)}
                                  className="p-1 text-[#667085] hover:text-[#4693FD] hover:bg-[#EFF5FF] rounded transition-colors"
                                  title="Edit Akun & Password"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {currentUser?.username !== u.username && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1 text-[#667085] hover:text-[#D64545] hover:bg-[#FEF3F2] rounded transition-colors"
                                    title="Hapus Akun"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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

      {/* Add / Edit User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#EAECF0] shadow-xl overflow-hidden">
            <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#262626]">
                  {editingUser ? `Edit Akun: ${editingUser.username}` : 'Tambah Pengguna Baru'}
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Tentukan peran akun: Admin (akses penuh) atau Owner (baca-saja)
                </p>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 text-[#98A2B3] hover:text-[#262626] rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[#344054] mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bpk. Ir. H. Bambang Prakoso"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    placeholder="Contoh: admin atau owner"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs font-mono text-[#262626]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#344054] mb-1">Peran (Hak Akses) *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#262626]"
                  >
                    <option value="admin">ADMIN (Akses Penuh)</option>
                    <option value="owner">OWNER (Baca-Saja)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">Email</label>
                <input
                  type="email"
                  placeholder="user@astabrata.com"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#344054] mb-1">
                  {editingUser ? 'Ganti Password (Kosongkan jika tidak diubah)' : 'Password Akun *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder="Minimal 6 karakter"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs text-[#262626]"
                />
              </div>

              <div className="pt-3 border-t border-[#EAECF0] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white rounded-lg text-xs font-medium shadow-xs"
                >
                  {editingUser ? 'Perbarui Akun' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
