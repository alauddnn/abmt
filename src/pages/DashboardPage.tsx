import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Eye,
  CreditCard,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import { DashboardStats } from '../types.js';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID } from '../lib/utils.js';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onOpenTestCases: () => void;
  refreshTrigger: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenTestCases,
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

      // Fetch actual recent transactions across modules
      const [exps, kbs, pays] = await Promise.all([
        api.getExpenses(),
        api.getKasbon(),
        api.getSalaryPayments(),
      ]);

      const txs: typeof recentTransactions = [];

      // Add recent operational and project expenses
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

      // Add recent kasbons
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
          targetTab: 'reports',
        });
      });

      // Add recent salary payments
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

      // Sort by date desc
      txs.sort((a, b) => b.date.localeCompare(a.date));
      setRecentTransactions(txs.slice(0, 7));
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
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

  // Categories breakdown for Section C (right column)
  const catSalary = totalGajiDanLembur;
  const catOwner = metrics?.totalBiayaOwner || 0;
  const catAsisten = metrics?.totalBiayaAsisten || 0;
  const catKasbon = metrics?.totalKasbonDicairkanPeriode || 0;
  const catSum = catSalary + catOwner + catAsisten + catKasbon;

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
    <div className="space-y-6 pb-20">
      {/* =========================================================================
          BAGIAN A — PAGE HEADER
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#4693FD] text-sm font-semibold tracking-tight">
                PT. Asta Brata Matahari Terbit
              </span>
              <span className="text-[#D0D5DD]">·</span>
              <span className="text-xs text-[#667085] font-medium">
                Kontraktor Management
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
              Dashboard Operasional
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Ringkasan operasional dan keuangan perusahaan.
            </p>
          </div>

          {/* Action buttons on header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('reports')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-medium rounded-lg border border-[#D0D5DD] shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#667085]" />
              <span>Ekspor Laporan</span>
            </button>
            <button
              onClick={() => onNavigate('attendance')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Absensi</span>
            </button>
          </div>
        </div>

        {/* Filter Periode */}
        <div className="mt-5 pt-4 border-t border-[#EAECF0] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'this_week', label: 'Minggu Ini' },
              { id: 'this_month', label: 'Bulan Ini' },
              { id: 'last_month', label: 'Bulan Sebelumnya' },
              { id: 'this_year', label: 'Tahun Ini' },
              { id: 'custom', label: 'Rentang Khusus' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  period === p.id
                    ? 'bg-[#4693FD] text-white shadow-xs'
                    : 'bg-[#F2F4F7] text-[#667085] hover:text-[#262626] hover:bg-[#E4E7EC]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="p-1.5 text-[#667085] hover:text-[#262626] hover:bg-[#F2F4F7] rounded-md transition-colors"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {stats && (
              <span className="font-mono text-[11px] text-[#667085]">
                {formatDateID(stats.periodInfo.rangeStart)} – {formatDateID(stats.periodInfo.rangeEnd)}
              </span>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {period === 'custom' && (
          <div className="mt-3 pt-3 border-t border-[#EAECF0] flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-[#667085] font-medium">Dari:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[#667085] font-medium">Sampai:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] focus:outline-none focus:border-[#4693FD]"
              />
            </div>
            <button
              onClick={fetchStats}
              className="px-3 py-1 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          BAGIAN B — 4 KPI CARDS (Single row on desktop)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pengeluaran Operasional */}
        <div className="bg-white rounded-xl border border-[#EAECF0] p-5 shadow-xs">
          <p className="text-xs font-medium text-[#667085]">
            Total Pengeluaran Operasional
          </p>
          <p className="text-2xl lg:text-[28px] font-semibold text-[#262626] tracking-tight mt-1.5 tabular-nums">
            {formatRupiah(metrics?.totalPengeluaranOperasional || 0)}
          </p>
          <p className="text-[11px] text-[#667085] mt-1 truncate">
            Gaji + lembur + biaya owner & asisten
          </p>
        </div>

        {/* Card 2: Total Gaji dan Lembur */}
        <div className="bg-white rounded-xl border border-[#EAECF0] p-5 shadow-xs">
          <p className="text-xs font-medium text-[#667085]">
            Total Gaji dan Lembur
          </p>
          <p className="text-2xl lg:text-[28px] font-semibold text-[#262626] tracking-tight mt-1.5 tabular-nums">
            {formatRupiah(totalGajiDanLembur)}
          </p>
          <p className="text-[11px] text-[#667085] mt-1 truncate">
            {metrics?.totalHariKerja || 0} hari kerja ({metrics?.jumlahKaryawanAktif || 10} tenaga kerja aktif)
          </p>
        </div>

        {/* Card 3: Sisa Kasbon Karyawan */}
        <div className="bg-white rounded-xl border border-[#EAECF0] p-5 shadow-xs">
          <p className="text-xs font-medium text-[#667085]">
            Sisa Kasbon Karyawan
          </p>
          <p className="text-2xl lg:text-[28px] font-semibold text-[#262626] tracking-tight mt-1.5 tabular-nums">
            {formatRupiah(metrics?.totalKasbonBelumDipotong || 0)}
          </p>
          <p className="text-[11px] text-[#667085] mt-1 truncate">
            Piutang kasbon aktif belum dipotong
          </p>
        </div>

        {/* Card 4: Total Gaji Belum Dibayar */}
        <div className="bg-white rounded-xl border border-[#EAECF0] p-5 shadow-xs">
          <p className="text-xs font-medium text-[#667085]">
            Total Gaji Belum Dibayar
          </p>
          <p className="text-2xl lg:text-[28px] font-semibold text-[#262626] tracking-tight mt-1.5 tabular-nums">
            {formatRupiah(metrics?.unpaidSalaryEstimate || 0)}
          </p>
          <p className="text-[11px] text-[#667085] mt-1 truncate">
            Kewajiban gaji terakumulasi periode ini
          </p>
        </div>
      </div>

      {/* =========================================================================
          BAGIAN C — GRAFIK & RINGKASAN KATEGORI (Layout 2 Kolom: 65% / 35%)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: 65% (lg:col-span-8) - Grafik Pengeluaran Operasional */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#EAECF0]">
              <div>
                <h2 className="text-base font-semibold text-[#262626]">
                  Tren Pengeluaran Operasional
                </h2>
                <p className="text-xs text-[#667085] mt-0.5">
                  Berdasarkan transaksi aktual harian dalam periode terpilih.
                </p>
              </div>
              <span className="text-xs font-medium text-[#4693FD] bg-[#EFF5FF] px-2.5 py-1 rounded-md">
                {periodLabels[period] || 'Bulan Ini'}
              </span>
            </div>

            {/* Clean Minimalist Chart */}
            <div className="pt-6">
              {stats?.dailyTrend && stats.dailyTrend.length > 0 ? (
                <div className="space-y-4">
                  {/* Subtle Grid SVG Bar View */}
                  <div className="h-48 w-full flex items-end gap-2 pt-6 pb-2 border-b border-[#EAECF0]">
                    {stats.dailyTrend.map((d, idx) => {
                      const maxVal = Math.max(...stats.dailyTrend.map((t) => t.total), 1);
                      const heightPct = Math.max(12, Math.round((d.total / maxVal) * 100));

                      return (
                        <div
                          key={d.date}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative"
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[#262626] text-white text-[11px] py-1 px-2 rounded shadow-md whitespace-nowrap z-20">
                            {formatDateID(d.date)}: {formatRupiah(d.total)}
                          </div>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full max-w-[36px] bg-[#4693FD] hover:bg-[#357ee8] rounded-t-sm transition-all"
                          />
                          <span className="text-[10px] text-[#667085] mt-2 font-mono truncate w-full text-center">
                            {d.date.slice(-2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#667085] pt-1">
                    <span>*Angka di bawah adalah tanggal kalender</span>
                    <span className="font-medium text-[#262626]">
                      Puncak Pengeluaran:{' '}
                      {formatRupiah(
                        Math.max(...stats.dailyTrend.map((t) => t.total), 0)
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-[#667085] text-xs">
                  <p className="font-medium text-[#262626]">Belum ada aktivitas pada periode ini</p>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    Data pengeluaran operasional akan divisualisasikan saat transaksi dicatat.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#EAECF0] flex items-center justify-between text-xs text-[#667085]">
            <span>Sumber Data: Absensi, Lembur & Transaksi Lapangan</span>
            <span className="font-semibold text-[#16A36A]">● Data Sinkron</span>
          </div>
        </div>

        {/* Kolom Kanan: 35% (lg:col-span-4) - Ringkasan Kategori Pengeluaran */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#EAECF0]">
              <h2 className="text-base font-semibold text-[#262626]">
                Ringkasan Kategori Pengeluaran
              </h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Proporsi pengeluaran operasional perusahaan.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {/* Category 1: Gaji dan Lembur */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#344054]">Gaji & Lembur</span>
                  <span className="font-semibold text-[#262626] tabular-nums">
                    {formatRupiah(catSalary)}
                  </span>
                </div>
                <div className="w-full bg-[#F2F4F7] h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    style={{ width: `${pctSalary}%` }}
                    className="bg-[#4693FD] h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#667085] mt-0.5">
                  <span>Pokok & upah lembur disetujui</span>
                  <span>{pctSalary}%</span>
                </div>
              </div>

              {/* Category 2: Pengeluaran Owner */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#344054]">Pengeluaran Owner</span>
                  <span className="font-semibold text-[#262626] tabular-nums">
                    {formatRupiah(catOwner)}
                  </span>
                </div>
                <div className="w-full bg-[#F2F4F7] h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    style={{ width: `${pctOwner}%` }}
                    className="bg-[#357ee8] h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#667085] mt-0.5">
                  <span>Bensin, rokok, e-toll, makan</span>
                  <span>{pctOwner}%</span>
                </div>
              </div>

              {/* Category 3: Pengeluaran Asisten */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#344054]">Pengeluaran Asisten</span>
                  <span className="font-semibold text-[#262626] tabular-nums">
                    {formatRupiah(catAsisten)}
                  </span>
                </div>
                <div className="w-full bg-[#F2F4F7] h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    style={{ width: `${pctAsisten}%` }}
                    className="bg-[#85b9fe] h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#667085] mt-0.5">
                  <span>Operasional lapangan asisten</span>
                  <span>{pctAsisten}%</span>
                </div>
              </div>

              {/* Category 4: Kasbon yang Diberikan */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#344054]">Kasbon yang Diberikan</span>
                  <span className="font-semibold text-[#262626] tabular-nums">
                    {formatRupiah(catKasbon)}
                  </span>
                </div>
                <div className="w-full bg-[#F2F4F7] h-2 rounded-full overflow-hidden mt-1.5">
                  <div
                    style={{ width: `${pctKasbon}%` }}
                    className="bg-[#D99A23] h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#667085] mt-0.5">
                  <span>Arus kas keluar (piutang aktif)</span>
                  <span>{pctKasbon}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#EAECF0] mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#667085] font-medium">Total Akumulasi:</span>
              <span className="font-semibold text-[#262626] tabular-nums">
                {formatRupiah(catSum)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BAGIAN D — TRANSAKSI TERBARU (Table Standard Enterprise)
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#EAECF0] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#262626]">
              Transaksi Operasional Terbaru
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Catatan mutasi pengeluaran, kasbon, dan penggajian terkini.
            </p>
          </div>

          <button
            onClick={() => onNavigate('reports')}
            className="text-xs font-medium text-[#4693FD] hover:text-[#357ee8] transition-colors"
          >
            Lihat Semua Transaksi →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#EAECF0] text-[#475467] font-medium">
                <th className="py-3 px-5">Tanggal</th>
                <th className="py-3 px-5">Keterangan</th>
                <th className="py-3 px-5">Kategori</th>
                <th className="py-3 px-5 text-right font-medium">Nominal</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#667085]">
                    <p className="font-medium text-[#262626]">Belum ada data transaksi</p>
                    <p className="text-[11px] mt-0.5">
                      Transaksi absensi, lembur, kasbon, atau operasional yang disimpan akan tampil di sini.
                    </p>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-5 text-[#667085] whitespace-nowrap">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="py-3 px-5 font-medium text-[#262626] max-w-sm truncate">
                      {tx.description}
                    </td>
                    <td className="py-3 px-5 text-[#475467] whitespace-nowrap">
                      {tx.category}
                    </td>
                    <td className="py-3 px-5 text-right font-medium text-[#262626] whitespace-nowrap tabular-nums">
                      {formatRupiah(tx.amount)}
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          tx.statusType === 'success'
                            ? 'bg-[#ECFDF3] text-[#16A36A]'
                            : tx.statusType === 'warning'
                            ? 'bg-[#FEF7EC] text-[#D99A23]'
                            : tx.statusType === 'danger'
                            ? 'bg-[#FEF3F2] text-[#D64545]'
                            : 'bg-[#F2F4F7] text-[#344054]'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center whitespace-nowrap">
                      <button
                        onClick={() => onNavigate(tx.targetTab)}
                        className="text-xs font-medium text-[#4693FD] hover:text-[#357ee8] inline-flex items-center gap-0.5"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
