import React from 'react';
import {
  ArrowLeft,
  Users,
  CalendarCheck,
  Clock,
  Wallet,
  Truck,
  Receipt,
  FileSpreadsheet,
  ChevronRight,
} from 'lucide-react';
import { Project, ProjectOverviewStats } from '../types.js';
import { formatRupiah, formatDateID, useAnimatedNumber } from '../lib/utils.js';

export type ProjectSubModule =
  | 'overview'
  | 'karyawan'
  | 'absensi'
  | 'lembur'
  | 'kasbon'
  | 'transport'
  | 'operasional'
  | 'laporan';

interface ProjectOverviewHomeProps {
  project: Project;
  stats: ProjectOverviewStats;
  loadingStats: boolean;
  onBack: () => void;
  onSelectModule: (module: ProjectSubModule) => void;
}

export const ProjectOverviewHome: React.FC<ProjectOverviewHomeProps> = ({
  project,
  stats,
  loadingStats,
  onBack,
  onSelectModule,
}) => {
  const animBudget = useAnimatedNumber(project.budget);
  const animAssigned = useAnimatedNumber(stats.totalAssignedEmployees);
  const animPresent = useAnimatedNumber(stats.presentToday);
  const animAbsent = useAnimatedNumber(stats.absentToday);
  const animOvertime = useAnimatedNumber(stats.overtimeCount);
  const animKasbon = useAnimatedNumber(stats.totalKasbon);
  const animTransport = useAnimatedNumber(stats.totalTransportationCost);
  const animOperational = useAnimatedNumber(stats.totalOperationalCost);

  return (
    <div className="space-y-7 kms-fade-in">
      {/* 1. INFORMASI PROYEK & NILAI ANGGARAN KONTRAK */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <button
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Kembali ke Daftar Proyek</span>
            </button>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">{project.name}</h1>
              <span className="font-mono text-xs font-semibold text-slate-500">
                {project.code}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-xs font-semibold text-[#2563EB]">
                {project.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-0.5">
              <div>
                <span className="text-slate-400">Klien: </span>
                <span className="font-medium text-slate-800">{project.client || '-'}</span>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <div>
                <span className="text-slate-400">Lokasi: </span>
                <span className="font-medium text-slate-800">{project.location}</span>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <div>
                <span className="text-slate-400">Periode: </span>
                <span className="font-mono text-slate-800 tabular-nums">
                  {formatDateID(project.startDate)}
                  {project.targetEndDate ? ` s/d ${formatDateID(project.targetEndDate)}` : ' (Target Terbuka)'}
                </span>
              </div>
            </div>
          </div>

          {/* Budget Widget */}
          <div className="kms-card-hover bg-slate-50 border border-slate-200 rounded-2xl p-5 min-w-[260px] lg:text-right">
            <span className="text-xs text-slate-500 font-medium block">Nilai Anggaran Kontrak</span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
              {formatRupiah(animBudget)}
            </span>
            <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center lg:justify-end justify-between gap-3 text-xs text-slate-600">
              <span>Realisasi Anggaran:</span>
              <span className="font-semibold text-[#2563EB] font-mono tabular-nums">
                {stats.realizationPercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TUJUH KARTU STATISTIK RINGKASAN PROYEK (Hanya tampil pada halaman utama Overview Proyek) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {/* Card 1: Total Karyawan Ditugaskan */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Ditugaskan</span>
          {loadingStats ? (
            <div className="h-7 w-12 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
              {animAssigned}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Tenaga kerja aktif</p>
        </div>

        {/* Card 2: Hadir Hari Ini */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Hadir Hari Ini</span>
          {loadingStats ? (
            <div className="h-7 w-12 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-2xl font-bold text-emerald-600 mt-2 font-mono tabular-nums">
              {animPresent}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Presensi hadir</p>
        </div>

        {/* Card 3: Tidak Hadir Hari Ini */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-rose-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Tidak Hadir</span>
          {loadingStats ? (
            <div className="h-7 w-12 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-2xl font-bold text-rose-600 mt-2 font-mono tabular-nums">
              {animAbsent}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Izin/Sakit/Alpa</p>
        </div>

        {/* Card 4: Lembur */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Lembur</span>
          {loadingStats ? (
            <div className="h-7 w-12 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-2xl font-bold text-amber-600 mt-2 font-mono tabular-nums">
              {animOvertime}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Orang disetujui</p>
        </div>

        {/* Card 5: Sisa Kasbon */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-violet-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Sisa Kasbon</span>
          {loadingStats ? (
            <div className="h-6 w-24 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-sm font-bold text-violet-700 mt-2 font-mono tabular-nums truncate">
              {formatRupiah(animKasbon)}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Pinjaman aktif</p>
        </div>

        {/* Card 6: Biaya Transportasi */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-sky-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500">Transportasi</span>
          {loadingStats ? (
            <div className="h-6 w-24 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-sm font-bold text-sky-700 mt-2 font-mono tabular-nums truncate">
              {formatRupiah(animTransport)}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Bensin, tol, parkir</p>
        </div>

        {/* Card 7: Pengeluaran Operasional */}
        <div className="kms-card-hover bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-200 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-slate-500">Operasional</span>
          {loadingStats ? (
            <div className="h-6 w-24 rounded kms-skeleton mt-2" />
          ) : (
            <p className="text-sm font-bold text-slate-900 mt-2 font-mono tabular-nums truncate">
              {formatRupiah(animOperational)}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">Belanja lapangan</p>
        </div>
      </div>

      {/* 3. MENU UTAMA PUSAT OPERASIONAL PROYEK (GRID CARDS) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-base font-semibold text-slate-900">Pusat Operasional Proyek</h2>
          <span className="text-xs text-slate-500">
            Pilih modul di bawah untuk mengelola atau memantau rincian proyek
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* A. Data Karyawan */}
          <div
            onClick={() => onSelectModule('karyawan')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] group-hover:scale-105 transition-transform flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                A. Data Karyawan Proyek
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Kelola penugasan tenaga kerja dari master data ke proyek, peran kerja, kontak, dan riwayat penempatan.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#2563EB] font-mono tabular-nums">
                {animAssigned} Karyawan Ditugaskan
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* B. Absensi Karyawan */}
          <div
            onClick={() => onSelectModule('absensi')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform flex items-center justify-center mb-4">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                B. Absensi Karyawan Proyek
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Pencatatan dan koreksi kehadiran harian (penuh/setengah hari), jam masuk-pulang, serta jam lembur di lokasi proyek.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-700 font-mono tabular-nums">
                {animPresent} Hadir Hari Ini
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* C. Sistem Lembur */}
          <div
            onClick={() => onSelectModule('lembur')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                C. Sistem Lembur Proyek
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Catatan lembur harian, tarif upah lembur resmi perusahaan, total biaya, dan status persetujuan administrator.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-700 font-mono tabular-nums">
                {animOvertime} Karyawan Lembur
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* D. Kasbon Karyawan */}
          <div
            onClick={() => onSelectModule('kasbon')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 group-hover:scale-105 transition-transform flex items-center justify-center mb-4">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                D. Kasbon Karyawan
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Pengajuan kasbon karyawan proyek, bukti pendukung, pencatatan pelunasan manual, dan riwayat per karyawan.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-violet-700 font-mono tabular-nums">
                {formatRupiah(animKasbon)} Sisa Kasbon
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* E. Biaya Transportasi */}
          <div
            onClick={() => onSelectModule('transport')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform flex items-center justify-center mb-4">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                E. Biaya Transportasi Proyek
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Pencatatan bensin, e-toll, parkir, armada kendaraan dinas, PIC penanggung jawab, serta lampiran foto bukti.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-700 font-mono tabular-nums">
                {formatRupiah(animTransport)} Total
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* F. Pengeluaran Operasional Proyek */}
          <div
            onClick={() => onSelectModule('operasional')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform flex items-center justify-center mb-4">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                F. Pengeluaran Operasional Lapangan
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Pencatatan pengeluaran riil lapangan, alat bantu darurat, konsumsi, dan biaya operasional langsung proyek.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-700 font-mono tabular-nums">
                {formatRupiah(animOperational)} Total
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          {/* H. Laporan & Rekapitulasi Komprehensif Proyek (H1 - H5) */}
          <div
            onClick={() => onSelectModule('laporan')}
            className="kms-module-card bg-white p-6 rounded-2xl border border-slate-200 hover:border-[#2563EB] shadow-[0_1px_3px_rgba(15,23,42,0.03)] cursor-pointer group flex flex-col justify-between md:col-span-2 lg:col-span-3"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] group-hover:scale-105 transition-transform flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-500">
                  Pusat Rekap Gaji · Slip Gaji · Cetak PDF · Ekspor Excel Proyek
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                H. Laporan & Rekapitulasi Komprehensif Proyek
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-3xl">
                Pusat rekap keuangan resmi proyek {project.name} ({project.code}): rekap gaji per karyawan, rekap total gaji seluruh karyawan, biaya transportasi, pengeluaran operasional lapangan, dan realisasi seluruh anggaran proyek.
              </p>
            </div>
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#155EEF]">
                Realisasi Anggaran Proyek: {stats.realizationPercentage}% (Sisa Anggaran: {formatRupiah(stats.budgetRemaining)})
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#155EEF]">
                <span>Buka Pusat Laporan (H1–H5)</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
