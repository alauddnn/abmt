import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardStats } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, useAnimatedNumber } from '../lib/utils.js';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenTestCases: () => void;
  refreshTrigger: number;
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
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  refreshTrigger,
}) => {
  const [period, setPeriod] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Recent transactions collected from actual API records
  const [recentTransactions, setRecentTransactions] = useState<
    Array<{
      id: string;
      date: string;
      description: string;
      category: string;
      amount: number;
      status: string;
      statusType: 'success' | 'warning' | 'danger' | 'info';
      targetTab: string;
    }>
  >([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardStats(
        period,
        period === 'custom' ? startDate : undefined,
        period === 'custom' ? endDate : undefined
      );
      setStats(data);

      if (Array.isArray(data.recentTransactions)) {
        setRecentTransactions(data.recentTransactions);
      } else {
        // Fallback if backend did not include recentTransactions
        const [exps, kbs, pays] = await Promise.all([
          api.getExpenses(),
          api.getKasbon(),
          api.getSalaryPayments(),
        ]);

        const txs: typeof recentTransactions = [];

        exps.slice(0, 5).forEach((e: any) => {
          txs.push({
            id: e.id,
            date: e.date,
            description: `${e.personType}: ${e.description}`,
            category: `Biaya ${e.category}`,
            amount: e.amount,
            status: 'Tercatat',
            statusType: 'info',
            targetTab: e.description.includes('Proyek') ? 'projects' : 'expenses',
          });
        });

        kbs.slice(0, 5).forEach((k: any) => {
          txs.push({
            id: k.id,
            date: k.requestDate,
            description: `Kasbon: ${k.employeeName} (${k.reason})`,
            category: 'Kasbon',
            amount: k.amount,
            status: k.status,
            statusType:
              k.status === 'Disetujui' || k.status === 'Lunas'
                ? 'success'
                : k.status === 'Ditolak'
                ? 'danger'
                : 'warning',
            targetTab: 'projects',
          });
        });

        pays.slice(0, 5).forEach((p: any) => {
          txs.push({
            id: p.id,
            date: p.paymentDate,
            description: `Gaji: ${p.employeeName} (Periode ${formatDateID(p.periodStart)} - ${formatDateID(p.periodEnd)})`,
            category: 'Gaji 2-Mingguan',
            amount: p.netSalary,
            status: p.status,
            statusType: p.status === 'Sudah dibayar' ? 'success' : 'warning',
            targetTab: 'payroll',
          });
        });

        txs.sort((a, b) => b.date.localeCompare(a.date));
        setRecentTransactions(txs.slice(0, 7));
      }
    } catch (err) {
      console.warn('Notice fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  const metrics = stats?.metrics;

  // Total Gaji dan Lembur
  const totalGajiDanLembur = (metrics?.totalGajiPokok || 0) + (metrics?.totalUpahLembur || 0);

  // Animated KPI Counters (Solvik-style smooth number count-up)
  const animTotalOperasional = useAnimatedNumber(metrics?.totalPengeluaranOperasional || 0);
  const animTotalGajiLembur = useAnimatedNumber(totalGajiDanLembur);
  const animSisaKasbon = useAnimatedNumber(metrics?.totalKasbonBelumDipotong || 0);
  const animGajiBelumDibayar = useAnimatedNumber(metrics?.unpaidSalaryEstimate || 0);
  const animHariKerja = useAnimatedNumber(metrics?.totalHariKerja || 0);
  const animKaryawanAktif = useAnimatedNumber(metrics?.jumlahKaryawanAktif || 0);

  // Categories breakdown for Section C (right column)
  const catSalary = totalGajiDanLembur;
  const catOwner = metrics?.totalBiayaOwner || 0;
  const catAsisten = metrics?.totalBiayaAsisten || 0;
  const catKasbon = metrics?.totalKasbonDicairkanPeriode || 0;
  const catSum = catSalary + catOwner + catAsisten + catKasbon;
  const animCatSum = useAnimatedNumber(catSum);

  const pctSalary = catSum > 0 ? Math.round((catSalary / catSum) * 100) : 0;
  const pctOwner = catSum > 0 ? Math.round((catOwner / catSum) * 100) : 0;
  const pctAsisten = catSum > 0 ? Math.round((catAsisten / catSum) * 100) : 0;
  const pctKasbon = catSum > 0 ? Math.round((catKasbon / catSum) * 100) : 0;

  // Period label
  const periodLabels: Record<string, string> = {
    today: 'Hari Ini',
    this_week: 'Minggu Ini',
    this_month: 'Bulan Ini',
    last_month: 'Bulan Lalu',
    this_year: 'Tahun Ini',
    custom: 'Rentang Khusus',
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-20"
    >
      {/* =========================================================================
          BAGIAN A — PAGE HEADER & PERIOD CONTROLS
          ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="glass-panel rounded-2xl p-6 sm:p-7"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-[#2563EB]">
                PT. Asta Brata Matahari Terbit
              </span>
              <span aria-hidden="true">·</span>
              <span>Kontraktor Management</span>
              {stats && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {formatDateID(stats.periodInfo.rangeStart)} – {formatDateID(stats.periodInfo.rangeEnd)}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-[26px] font-semibold text-slate-900 tracking-tight">
              Dashboard Operasional
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Ringkasan realisasi pengeluaran operasional, upah tenaga kerja, dan kasbon perusahaan secara real-time.
            </p>
          </div>
        </div>

        {/* Filter Periode with Animated Sliding Pill */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full border border-slate-200">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'this_week', label: 'Minggu Ini' },
              { id: 'this_month', label: 'Bulan Ini' },
              { id: 'last_month', label: 'Bulan Sebelumnya' },
              { id: 'this_year', label: 'Tahun Ini' },
              { id: 'custom', label: 'Rentang Khusus' },
            ].map((p) => {
              const isSelected = period === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'text-slate-900'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="dashboard-period-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 bg-white rounded-lg shadow-2xs border border-slate-200"
                    />
                  )}
                  <span className="relative z-10">{p.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Periode Aktif:{' '}
              <strong className="font-medium text-slate-800">
                {periodLabels[period] || 'Bulan Ini'}
              </strong>
            </span>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              title="Perbarui Data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loading ? 'animate-spin text-[#2563EB]' : ''
                }`}
              />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker with Smooth Expand/Collapse */}
        <AnimatePresence initial={false}>
          {period === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-600 font-medium">Dari Tanggal:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-slate-600 font-medium">Sampai Tanggal:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>
                <button
                  onClick={fetchStats}
                  className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  Terapkan Rentang
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* =========================================================================
          BAGIAN B — 4 KPI CARDS (Staggered Entrance + Animated Counters + Hover Lift)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Pengeluaran Operasional */}
        <motion.div
          variants={itemVariants}
          className="kms-card-hover bg-white rounded-2xl border border-slate-200/90 hover:border-blue-200/90 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
        >
          <p className="text-xs font-medium text-slate-500">
            Total Pengeluaran Operasional
          </p>
          {loading && !stats ? (
            <div className="h-8 w-40 rounded-lg kms-skeleton mt-3" />
          ) : (
            <p className="text-2xl xl:text-[26px] font-semibold text-slate-900 tracking-tight mt-3 font-mono tabular-nums">
              {formatRupiah(animTotalOperasional)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Akumulasi gaji, lembur & biaya operasional
          </p>
        </motion.div>

        {/* Card 2: Total Gaji dan Lembur */}
        <motion.div
          variants={itemVariants}
          className="kms-card-hover bg-white rounded-2xl border border-slate-200/90 hover:border-blue-200/90 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
        >
          <p className="text-xs font-medium text-slate-500">
            Total Gaji dan Lembur
          </p>
          {loading && !stats ? (
            <div className="h-8 w-40 rounded-lg kms-skeleton mt-3" />
          ) : (
            <p className="text-2xl xl:text-[26px] font-semibold text-slate-900 tracking-tight mt-3 font-mono tabular-nums">
              {formatRupiah(animTotalGajiLembur)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 tabular-nums">
            {animHariKerja} hari kerja · {animKaryawanAktif} tenaga kerja aktif
          </p>
        </motion.div>

        {/* Card 3: Sisa Kasbon Karyawan */}
        <motion.div
          variants={itemVariants}
          className="kms-card-hover bg-white rounded-2xl border border-slate-200/90 hover:border-amber-200/90 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
        >
          <p className="text-xs font-medium text-slate-500">
            Sisa Kasbon Karyawan
          </p>
          {loading && !stats ? (
            <div className="h-8 w-40 rounded-lg kms-skeleton mt-3" />
          ) : (
            <p className="text-2xl xl:text-[26px] font-semibold text-amber-600 tracking-tight mt-3 font-mono tabular-nums">
              {formatRupiah(animSisaKasbon)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Piutang kasbon aktif belum lunas
          </p>
        </motion.div>

        {/* Card 4: Total Gaji Belum Dibayar */}
        <motion.div
          variants={itemVariants}
          className="kms-card-hover bg-white rounded-2xl border border-slate-200/90 hover:border-blue-200/90 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
        >
          <p className="text-xs font-medium text-slate-500">
            Total Gaji Belum Dibayar
          </p>
          {loading && !stats ? (
            <div className="h-8 w-40 rounded-lg kms-skeleton mt-3" />
          ) : (
            <p className="text-[24px] font-semibold text-[#2563EB] tracking-tight mt-3 font-mono tabular-nums">
              {formatRupiah(animGajiBelumDibayar)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Kewajiban gaji terakumulasi periode ini
          </p>
        </motion.div>
      </div>

      {/* =========================================================================
          BAGIAN C — GRAFIK & RINGKASAN KATEGORI (Layout 2 Kolom: 65% / 35%)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: 65% (lg:col-span-8) - Grafik Pengeluaran Operasional */}
        <motion.div
          variants={itemVariants}
          className="kms-card-hover lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Tren Pengeluaran Operasional
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Visualisasi transaksi aktual harian dalam periode {periodLabels[period] || 'Bulan Ini'}.
                </p>
              </div>
              {stats?.dailyTrend && stats.dailyTrend.length > 0 && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Puncak Harian</span>
                  <span className="text-xs font-mono font-semibold text-slate-800 tabular-nums">
                    {formatRupiah(Math.max(...stats.dailyTrend.map((t) => t.total), 0))}
                  </span>
                </div>
              )}
            </div>

            {/* Clean Minimalist Chart with Animated Bars */}
            <div className="pt-6">
              {loading && !stats ? (
                <div className="h-52 w-full rounded-xl kms-skeleton" />
              ) : stats?.dailyTrend && stats.dailyTrend.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-52 w-full flex items-end gap-2 pt-8 pb-2 px-2 border-b border-slate-200/80 bg-slate-50/40 rounded-t-xl">
                    {stats.dailyTrend.map((d, idx) => {
                      const maxVal = Math.max(...stats.dailyTrend.map((t) => t.total), 1);
                      const heightPct = Math.max(10, Math.round((d.total / maxVal) * 100));

                      return (
                        <div
                          key={d.date}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative"
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute -top-9 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0.5 transition-all duration-150 pointer-events-none bg-slate-900 text-white text-[11px] py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap z-20 font-mono tabular-nums">
                            {formatDateID(d.date)}: {formatRupiah(d.total)}
                          </div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPct}%` }}
                            transition={{
                              duration: 0.45,
                              delay: Math.min(idx * 0.025, 0.3),
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="w-full max-w-[38px] bg-[#2563EB]/85 group-hover:bg-[#1D4ED8] rounded-t-md transition-colors"
                          />
                          <span className="text-[10px] text-slate-500 mt-2 font-mono tabular-nums truncate w-full text-center">
                            {d.date.slice(-2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Sumbu horizontal menampilkan tanggal kalender transaksi</span>
                    <span>Sumber: Absensi, Lembur & Biaya Lapangan</span>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <p className="font-medium text-slate-700">Belum ada aktivitas pada periode ini</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Grafik pengeluaran harian akan otomatis tampil saat transaksi dicatat.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Kolom Kanan: 35% (lg:col-span-4) - Ringkasan Kategori Pengeluaran */}
        <motion.div
          variants={itemVariants}
          className="kms-card-hover lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Komposisi Biaya
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Proporsi alokasi pengeluaran operasional perusahaan.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {/* Category 1: Gaji dan Lembur */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Gaji & Lembur</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(catSalary)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctSalary}%` }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-[#2563EB] h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Upah pokok & lembur disetujui</span>
                  <span className="font-mono tabular-nums">{pctSalary}%</span>
                </div>
              </div>

              {/* Category 2: Pengeluaran Owner */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Pengeluaran Owner</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(catOwner)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctOwner}%` }}
                    transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-sky-600 h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Bensin, rokok, e-toll, konsumsi</span>
                  <span className="font-mono tabular-nums">{pctOwner}%</span>
                </div>
              </div>

              {/* Category 3: Pengeluaran Asisten */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Pengeluaran Asisten</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(catAsisten)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctAsisten}%` }}
                    transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-indigo-500 h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Operasional lapangan asisten</span>
                  <span className="font-mono tabular-nums">{pctAsisten}%</span>
                </div>
              </div>

              {/* Category 4: Kasbon yang Diberikan */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Kasbon Karyawan</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(catKasbon)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctKasbon}%` }}
                    transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-amber-500 h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Pencairan kasbon periode ini</span>
                  <span className="font-mono tabular-nums">{pctKasbon}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total Akumulasi</span>
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {formatRupiah(animCatSum)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* =========================================================================
          BAGIAN D — TRANSAKSI TERBARU (Table Standard Enterprise + Skeleton Loading)
          ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="glass-table rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Transaksi Operasional Terbaru
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Catatan mutasi pengeluaran, kasbon, dan penggajian terkini.
            </p>
          </div>

          <button
            onClick={() => onNavigate('reports')}
            className="group inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors self-start sm:self-auto cursor-pointer"
          >
            <span>Lihat Semua Laporan</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3.5 px-6">Tanggal</th>
                <th className="py-3.5 px-6">Keterangan Transaksi</th>
                <th className="py-3.5 px-6">Kategori</th>
                <th className="py-3.5 px-6 text-right font-medium">Nominal</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && recentTransactions.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td className="py-4 px-6"><div className="h-4 w-20 rounded kms-skeleton" /></td>
                    <td className="py-4 px-6"><div className="h-4 w-56 rounded kms-skeleton" /></td>
                    <td className="py-4 px-6"><div className="h-4 w-24 rounded kms-skeleton" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-4 w-24 rounded kms-skeleton ml-auto" /></td>
                    <td className="py-4 px-6"><div className="h-4 w-16 rounded kms-skeleton" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-4 w-16 rounded kms-skeleton ml-auto" /></td>
                  </tr>
                ))
              ) : recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <p className="font-medium text-slate-700">Belum ada data transaksi</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Transaksi absensi, lembur, kasbon, atau operasional yang disimpan akan tampil di sini.
                    </p>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-blue-50/35 transition-colors group"
                  >
                    <td className="py-4 px-6 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-900 max-w-md truncate group-hover:text-[#2563EB] transition-colors">
                      {tx.description}
                    </td>
                    <td className="py-4 px-6 text-slate-600 whitespace-nowrap">
                      {tx.category}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatRupiah(tx.amount)}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          tx.statusType === 'success'
                            ? 'text-emerald-700'
                            : tx.statusType === 'warning'
                            ? 'text-amber-700'
                            : tx.statusType === 'danger'
                            ? 'text-rose-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => onNavigate(tx.targetTab)}
                        className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        Buka Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};
