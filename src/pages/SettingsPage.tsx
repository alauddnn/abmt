import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Save,
  Clock,
  DollarSign,
  Shield,
  User,
  UserCheck,
  AlertCircle,
  RotateCcw,
  ShieldAlert,
  Users,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext.js';
import { useAuth } from '../context/AuthContext.js';
import { formatRupiah } from '../lib/utils.js';

interface SettingsPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigate?: (tab: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ showToast, onNavigate }) => {
  const { settings, updateSettings, refreshSettings } = useCompany();
  const { isAdmin, isOwner } = useAuth();

  const [form, setForm] = useState({
    companyName: '',
    tagline: '',
    address: '',
    phone: '',
    ownerName: '',
    assistantName: '',
    workHourStart: '08:00',
    workHourEnd: '16:00',
    wageMandorDaily: 200000,
    overtimeMandorHourly: 25000,
    wageTukangDaily: 150000,
    overtimeTukangHourly: 20000,
    wageHelperDaily: 125000,
    overtimeHelperHourly: 15000,
    wageDriverDaily: 140000,
    overtimeDriverHourly: 0,
    wageKenekDaily: 125000,
    overtimeKenekHourly: 15000,
    minTenureDaysForKasbon: 7,
  });

  const [syncActiveEmployees, setSyncActiveEmployees] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName,
        tagline: settings.tagline || '',
        address: settings.address,
        phone: settings.phone,
        ownerName: settings.ownerName,
        assistantName: settings.assistantName,
        workHourStart: settings.workHourStart,
        workHourEnd: settings.workHourEnd,
        wageMandorDaily: settings.wageMandorDaily || 200000,
        overtimeMandorHourly: settings.overtimeMandorHourly || 25000,
        wageTukangDaily: settings.wageTukangDaily,
        overtimeTukangHourly: settings.overtimeTukangHourly,
        wageHelperDaily: settings.wageHelperDaily || settings.wageKenekDaily || 125000,
        overtimeHelperHourly: settings.overtimeHelperHourly || settings.overtimeKenekHourly || 15000,
        wageDriverDaily: settings.wageDriverDaily || 140000,
        overtimeDriverHourly: 0,
        wageKenekDaily: settings.wageHelperDaily || settings.wageKenekDaily || 125000,
        overtimeKenekHourly: settings.overtimeHelperHourly || settings.overtimeKenekHourly || 15000,
        minTenureDaysForKasbon: settings.minTenureDaysForKasbon,
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('error', 'Akses ditolak: Hanya Administrator yang berhak mengubah pengaturan.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        overtimeDriverHourly: 0,
        wageKenekDaily: form.wageHelperDaily,
        overtimeKenekHourly: form.overtimeHelperHourly,
        syncActiveEmployees,
      };
      await updateSettings(payload as any);
      showToast(
        'success',
        'Pengaturan tarif upah berhasil disimpan permanen di Supabase. Riwayat gaji periode lama tetap aman (snapshot tersimpan).'
      );
      refreshSettings();
    } catch (err: any) {
      showToast('error', err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaultRates = () => {
    if (!isAdmin) return;
    setForm((prev) => ({
      ...prev,
      workHourStart: '08:00',
      workHourEnd: '16:00',
      wageMandorDaily: 200000,
      overtimeMandorHourly: 25000,
      wageTukangDaily: 150000,
      overtimeTukangHourly: 20000,
      wageHelperDaily: 125000,
      overtimeHelperHourly: 15000,
      wageDriverDaily: 140000,
      overtimeDriverHourly: 0,
      wageKenekDaily: 125000,
      overtimeKenekHourly: 15000,
      minTenureDaysForKasbon: 7,
    }));
    showToast('info', 'Tarif dikembalikan ke standar acuan.');
  };

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
            <span className="text-xs text-[#667085] font-medium font-mono">
              Konfigurasi Sistem
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Pengaturan Perusahaan & Tarif Operasional
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            {isAdmin
              ? 'Kelola nama perusahaan, alamat, personil owner & asisten, serta tarif standar upah harian dan lembur kontraktor.'
              : 'Informasi profil perusahaan, personil kunci, dan tarif standar operasional (Mode Baca-Saja).'}
          </p>
        </div>
      </div>

      {/* Owner Notice */}
      {isOwner && (
        <div className="bg-[#FEF6EE] border border-[#F9DBAF] rounded-xl p-4 flex items-start gap-3 text-xs text-[#B54708]">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#B54708]" />
          <div>
            <p className="font-semibold text-sm">Mode Baca-Saja (Akun Owner)</p>
            <p className="mt-0.5 text-[#B54708]">
              Anda memiliki hak akses untuk meninjau profil perusahaan, personil kunci, jam kerja, dan tarif upah standar. Untuk mengubah data konfigurasi perusahaan, silakan gunakan akun Administrator.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Profil Perusahaan */}
        <div className="bg-white p-6 rounded-xl border border-[#EAECF0] shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#262626] font-semibold text-sm pb-3 border-b border-[#EAECF0]">
            <Building className="w-4 h-4 text-[#4693FD]" />
            <span>1. Profil Perusahaan Kontraktor</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-[#344054] mb-1">Nama Perusahaan Kontraktor *</label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] font-medium focus:outline-none focus:border-[#4693FD]"
              />
              <p className="text-[11px] text-[#667085] mt-1">Tampil di seluruh slip gaji, laporan rekap, dan header aplikasi</p>
            </div>

            <div>
              <label className="block font-medium text-[#344054] mb-1">Tagline / Spesialisasi</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="General Contractor & Interior Specialist"
                className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#344054] mb-1">Alamat Kantor / Proyek *</label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#344054] mb-1">Nomor Telepon Kantor *</label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Personil Kunci Lapangan */}
        <div className="bg-white p-6 rounded-xl border border-[#EAECF0] shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#262626] font-semibold text-sm pb-3 border-b border-[#EAECF0]">
            <User className="w-4 h-4 text-[#4693FD]" />
            <span>2. Personil Kunci Lapangan (Owner & Asisten)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-2">
              <div className="flex items-center gap-2 text-[#4693FD] font-semibold">
                <User className="w-4 h-4" />
                <span>Nama Lengkap Owner / Pimpinan Proyek</span>
              </div>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
              <p className="text-[11px] text-[#667085]">Penerima rekap biaya operasional kategori Owner</p>
            </div>

            <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-2">
              <div className="flex items-center gap-2 text-[#D99A23] font-semibold">
                <UserCheck className="w-4 h-4" />
                <span>Nama Lengkap Asisten Lapangan</span>
              </div>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={form.assistantName}
                onChange={(e) => setForm({ ...form, assistantName: e.target.value })}
                className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg text-xs font-medium text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
              <p className="text-[11px] text-[#667085]">Penerima rekap biaya operasional kategori Asisten</p>
            </div>
          </div>
        </div>

        {/* Section 3: Jam Kerja & Tarif Upah */}
        <div className="bg-white p-6 rounded-xl border border-[#EAECF0] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EAECF0]">
            <div className="flex items-center gap-2 text-[#262626] font-semibold text-sm">
              <DollarSign className="w-4 h-4 text-[#16A36A]" />
              <span>3. Jam Kerja Standar & Tarif Upah</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={resetDefaultRates}
                className="flex items-center gap-1 text-xs text-[#4693FD] hover:text-[#357ee8] font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Tarif Standar</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Jam Kerja */}
            <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-3">
              <div className="flex items-center gap-2 font-semibold text-[#262626]">
                <Clock className="w-4 h-4 text-[#4693FD]" />
                <span>Jam Kerja Normal Proyek (8 Jam Kerja)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#344054] mb-1">Jam Mulai Kerja</label>
                  <input
                    type="time"
                    disabled={!isAdmin}
                    value={form.workHourStart}
                    onChange={(e) => setForm({ ...form, workHourStart: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
                <div>
                  <label className="block text-[#344054] mb-1">Jam Selesai Normal</label>
                  <input
                    type="time"
                    disabled={!isAdmin}
                    value={form.workHourEnd}
                    onChange={(e) => setForm({ ...form, workHourEnd: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#667085]">Pekerjaan setelah jam selesai dihitung sebagai lembur.</p>
            </div>

            {/* Grid 4 Jabatan: Mandor, Tukang, Helper, Driver */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Standar Mandor */}
              <div className="p-4 bg-[#F9F5FF] rounded-lg border border-[#E9D7FE] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#7F56D9] text-xs">Standar Upah Mandor:</span>
                  <span className="text-[10px] text-[#7F56D9] bg-white px-2 py-0.5 rounded border border-[#E9D7FE]">Pengawas</span>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Gaji Normal Harian (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.wageMandorDaily}
                    onChange={(e) => setForm({ ...form, wageMandorDaily: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#7F56D9]"
                  />
                  <p className="text-[10px] text-[#7F56D9] mt-1 font-mono">
                    Upah ½ Hari (50%): {formatRupiah(Math.round((form.wageMandorDaily || 0) / 2))}
                  </p>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Tarif Lembur / Jam (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.overtimeMandorHourly}
                    onChange={(e) => setForm({ ...form, overtimeMandorHourly: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#7F56D9]"
                  />
                </div>
              </div>

              {/* Standar Tukang */}
              <div className="p-4 bg-[#EFF5FF] rounded-lg border border-[#D1E9FF] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#4693FD] text-xs">Standar Upah Tukang:</span>
                  <span className="text-[10px] text-[#4693FD] bg-white px-2 py-0.5 rounded border border-[#D1E9FF]">Terampil</span>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Gaji Normal Harian (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.wageTukangDaily}
                    onChange={(e) => setForm({ ...form, wageTukangDaily: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                  <p className="text-[10px] text-[#175CD3] mt-1 font-mono">
                    Upah ½ Hari (50%): {formatRupiah(Math.round((form.wageTukangDaily || 0) / 2))}
                  </p>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Tarif Lembur / Jam (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.overtimeTukangHourly}
                    onChange={(e) => setForm({ ...form, overtimeTukangHourly: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                  />
                </div>
              </div>

              {/* Standar Helper (Pengganti Kenek) */}
              <div className="p-4 bg-[#FEF7EC] rounded-lg border border-[#FEDF89] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#D99A23] text-xs">Standar Upah Helper / Kenek:</span>
                  <span className="text-[10px] text-[#D99A23] bg-white px-2 py-0.5 rounded border border-[#FEDF89]">Pembantu</span>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Gaji Normal Harian (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.wageHelperDaily}
                    onChange={(e) => setForm({ ...form, wageHelperDaily: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#D99A23]"
                  />
                  <p className="text-[10px] text-[#B54708] mt-1 font-mono">
                    Upah ½ Hari (50%): {formatRupiah(Math.round((form.wageHelperDaily || 0) / 2))}
                  </p>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Tarif Lembur / Jam (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.overtimeHelperHourly}
                    onChange={(e) => setForm({ ...form, overtimeHelperHourly: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#D99A23]"
                  />
                </div>
              </div>

              {/* Standar Driver */}
              <div className="p-4 bg-[#F0FDF9] rounded-lg border border-[#99F6E0] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0E9384] text-xs">Standar Upah Driver:</span>
                  <span className="text-[10px] text-[#0E9384] bg-white px-2 py-0.5 rounded border border-[#99F6E0]">Armada / Supir</span>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Gaji Normal Harian (IDR)</label>
                  <input
                    type="number"
                    step={1000}
                    disabled={!isAdmin}
                    value={form.wageDriverDaily}
                    onChange={(e) => setForm({ ...form, wageDriverDaily: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#0E9384]"
                  />
                  <p className="text-[10px] text-[#0E9384] mt-1 font-mono">
                    Upah ½ Hari (50%): {formatRupiah(Math.round((form.wageDriverDaily || 0) / 2))}
                  </p>
                </div>
                <div>
                  <label className="block text-[#344054] text-xs mb-1">Tarif Lembur / Jam (IDR)</label>
                  <input
                    type="number"
                    disabled={true}
                    value={0}
                    readOnly
                    className="w-full px-3 py-1.5 bg-[#F2F4F7] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#667085] cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#0E9384] mt-1 font-medium">
                    Ketentuan perusahaan: Driver tidak mendapat upah lembur (Rp0).
                  </p>
                </div>
              </div>
            </div>

            {/* Syarat Kasbon & Sinkronisasi Tarif */}
            <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] space-y-3">
              <div>
                <label className="block font-medium text-[#262626] mb-1">Syarat Minimal Hari Kerja untuk Kasbon (Hari)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  disabled={!isAdmin}
                  value={form.minTenureDaysForKasbon}
                  onChange={(e) => setForm({ ...form, minTenureDaysForKasbon: Number(e.target.value) })}
                  className="w-32 px-3 py-1.5 bg-white disabled:bg-[#F9FAFB] border border-[#D0D5DD] rounded-lg font-mono font-medium text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
                />
                <p className="text-[11px] text-[#667085] mt-1">
                  Karyawan dengan masa kerja kurang dari {form.minTenureDaysForKasbon} hari akan otomatis ditolak saat pengajuan persetujuan kasbon.
                </p>
              </div>

              {isAdmin && (
                <div className="pt-3 border-t border-[#EAECF0]">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncActiveEmployees}
                      onChange={(e) => setSyncActiveEmployees(e.target.checked)}
                      className="mt-0.5 rounded border-[#D0D5DD] text-[#4693FD] focus:ring-[#4693FD]"
                    />
                    <div>
                      <span className="font-medium text-[#262626] block">
                        Terapkan tarif baru ke karyawan aktif sesuai jabatan untuk absensi mendatang
                      </span>
                      <span className="text-[11px] text-[#667085] block mt-0.5">
                        Aman: Perubahan tarif baru TIDAK akan mengubah nominal absensi, lembur, atau gaji periode lama yang sudah dihitung/dibayarkan (snapshot tarif historis tersimpan permanen).
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Akses & Manajemen Akun Tim IT */}
        <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EFF8FF] text-[#175CD3] flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#101828] text-sm flex items-center gap-2">
                  <span>Manajemen Pengguna & Keamanan Sistem (Tim IT)</span>
                  <span className="text-[10px] bg-[#EEF4FF] text-[#3538CD] px-2 py-0.5 rounded font-mono font-medium">RBAC Aktif</span>
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  Kelola hak akses pengguna, reset kata sandi akun Staf/Mandor/Admin, dan pantau log audit aktivitas di panel Keamanan & Tim IT.
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('audit-logs')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F8F9FC] hover:bg-[#EEF2F6] text-[#1D2939] border border-[#D0D5DD] text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#175CD3]" />
                <span>Buka Panel IT & Reset Sandi</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#667085]" />
              </button>
            )}
          </div>
          <div className="p-3.5 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] text-xs text-[#475467] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium text-[#1D2939]">Akun Default Sistem:</p>
              <p>• <strong className="font-mono text-[#101828]">admin</strong> (Role: Owner / Administrator) — Akses penuh modul RAB, Keuangan, Invoice, & Pengaturan</p>
              <p>• <strong className="font-mono text-[#101828]">mandor</strong> (Role: Staf Lapangan) — Akses operasional lapangan, absensi tukang, dan progress fisik</p>
            </div>
            <div className="text-left md:text-right">
              <span className="inline-block px-2.5 py-1 bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5] rounded-md text-[11px] font-medium">
                ✓ Sesuai Spesifikasi Tanpa Google OAuth
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#4693FD] hover:bg-[#357ee8] disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Seluruh Pengaturan'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
