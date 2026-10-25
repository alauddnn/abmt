import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Building,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { formatRupiah, formatDateID, getTodayDateString } from '../lib/utils.js';
import { useCompany } from '../context/CompanyContext.js';

interface ReportsPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ showToast }) => {
  const { settings } = useCompany();

  // 15 Reports (including Mandor, Tukang, Helper, and Driver)
  const reportOptions = [
    { id: 'rekap_total_operasional', label: 'M. Rekap Total Pengeluaran Operasional' },
    { id: 'rekap_gaji_semua', label: 'A. Rekap Gaji Seluruh Karyawan' },
    { id: 'rekap_gaji_mandor', label: 'B1. Rekap Gaji Mandor' },
    { id: 'rekap_gaji_tukang', label: 'B. Rekap Gaji Tukang' },
    { id: 'rekap_gaji_kenek', label: 'C. Rekap Gaji Helper' },
    { id: 'rekap_gaji_driver', label: 'C1. Rekap Gaji Driver' },
    { id: 'rekap_lembur', label: 'D. Rekap Upah Lembur' },
    { id: 'rekap_kasbon', label: 'E. Rekap Kasbon Karyawan' },
    { id: 'rekap_pembayaran_dua_mingguan', label: 'F. Rekap Pembayaran Gaji Dua Mingguan' },
    { id: 'rekap_pengeluaran_owner', label: 'G. Rekap Pengeluaran Owner' },
    { id: 'rekap_pengeluaran_asisten', label: 'H. Rekap Pengeluaran Asisten' },
    { id: 'rekap_bensin', label: 'I. Rekap Biaya Bensin' },
    { id: 'rekap_rokok', label: 'J. Rekap Biaya Rokok' },
    { id: 'rekap_etoll', label: 'K. Rekap Biaya E-Toll' },
    { id: 'rekap_makan', label: 'L. Rekap Biaya Makan' },
  ];

  const [selectedReport, setSelectedReport] = useState<string>('rekap_total_operasional');

  // Date range defaults to current month
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
  const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(firstDay);
  const [endDate, setEndDate] = useState<string>(lastDay);

  const [reportData, setReportData] = useState<{ title: string; data: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReport(selectedReport, startDate, endDate);
      setReportData(data);
    } catch (err: any) {
      showToast('error', err.message || 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, startDate, endDate]);

  const handleDownloadExcel = () => {
    window.location.href = `/api/export/excel?type=${selectedReport}&startDate=${startDate}&endDate=${endDate}`;
    showToast('info', 'Mengunduh berkas laporan Excel (.xlsx)...');
  };

  const handleDownloadCSV = () => {
    if (!reportData || !reportData.data.length) {
      showToast('error', 'Tidak ada data laporan untuk diekspor');
      return;
    }

    const items = reportData.data;
    const replacer = (_key: string, value: any) => (value === null ? '' : value);
    const header = Object.keys(items[0]);
    const csv = [
      header.join(','),
      ...items.map((row) =>
        header
          .map((fieldName) => JSON.stringify(row[fieldName], replacer))
          .join(',')
      ),
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedReport}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'File CSV berhasil diunduh!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="print:hidden bg-white rounded-xl border border-[#EAECF0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#4693FD] text-xs font-semibold tracking-tight">
              PT. Asta Brata Matahari Terbit
            </span>
            <span className="text-[#D0D5DD]">·</span>
            <span className="text-xs text-[#667085] font-medium font-mono">13 Laporan Lengkap (A s/d M)</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#262626] tracking-tight mt-1">
            Laporan & Rekap Keuangan Operasional
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Filter sesuai rentang tanggal, ekspor ke Excel (.xlsx) / CSV, atau cetak sebagai dokumen resmi.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16A36A] hover:bg-[#138a59] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#344054] text-xs font-medium rounded-lg border border-[#D0D5DD] shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-[#667085]" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Report Selection & Period Filters */}
      <div className="print:hidden bg-white p-5 rounded-xl border border-[#EAECF0] shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#262626] uppercase tracking-wider mb-2.5">
            Pilih Jenis Laporan Operasional (A - M):
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {reportOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedReport(opt.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors border ${
                  selectedReport === opt.id
                    ? 'bg-[#EFF5FF] text-[#4693FD] border-[#4693FD] font-medium'
                    : 'bg-white text-[#344054] border-[#EAECF0] hover:bg-[#F9FAFB]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-[#EAECF0] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-[#344054] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#4693FD]" />
              Filter Periode:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] font-mono focus:outline-none focus:border-[#4693FD]"
              />
              <span className="text-[#667085]">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1 text-xs text-[#262626] font-mono focus:outline-none focus:border-[#4693FD]"
              />
            </div>
            <button
              onClick={fetchReport}
              className="px-3 py-1 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              Terapkan
            </button>
          </div>

          <span className="text-xs text-[#667085] font-mono">
            {formatDateID(startDate)} - {formatDateID(endDate)}
          </span>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white rounded-xl border border-[#EAECF0] shadow-xs p-8" id="report-printable">
        {/* Company Header */}
        <div className="border-b border-[#EAECF0] pb-5 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#262626] tracking-tight uppercase">
              {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
            </h1>
            <p className="text-xs text-[#667085] font-medium">{settings?.tagline || 'General Contractor & Interior Specialist'}</p>
            <p className="text-xs text-[#667085] mt-1">{settings?.address || 'Jakarta Selatan'} | Telp: {settings?.phone || '0812-8899-7722'}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 bg-[#EFF5FF] text-[#4693FD] text-[11px] font-semibold uppercase rounded-md border border-[#D0E2FF]">
              DOKUMEN LAPORAN
            </span>
            <p className="text-xs font-semibold text-[#262626] mt-1.5">{reportData?.title}</p>
            <p className="text-xs text-[#667085]">Periode: {formatDateID(startDate)} s/d {formatDateID(endDate)}</p>
          </div>
        </div>

        {/* Report Content Table */}
        {loading ? (
          <div className="py-12 text-center text-[#667085] text-xs">Menyiapkan laporan transaksi...</div>
        ) : !reportData || reportData.data.length === 0 ? (
          <div className="py-12 text-center text-[#667085] text-xs">
            Tidak ada transaksi pada periode yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* If Summary Report M */}
            {selectedReport === 'rekap_total_operasional' ? (
              <table className="w-full text-left text-xs border border-[#EAECF0] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    <th className="py-2.5 px-4">No</th>
                    <th className="py-2.5 px-4">Komponen Biaya Operasional</th>
                    <th className="py-2.5 px-4 text-right">Nominal (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {reportData.data.map((row, idx) => {
                    const isTotal = row.komponen.includes('TOTAL KESELURUHAN');
                    return (
                      <tr
                        key={idx}
                        className={isTotal ? 'bg-[#EFF5FF] text-[#1E40AF] font-semibold text-xs' : 'hover:bg-[#F9FAFB]'}
                      >
                        <td className="py-2.5 px-4">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-medium">{row.komponen}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {formatRupiah(row.nominal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border border-[#EAECF0] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#475467] font-medium border-b border-[#EAECF0]">
                    {Object.keys(reportData.data[0] || {}).map((col) => (
                      <th key={col} className="py-2.5 px-3 capitalize">
                        {col.replace(/([A-Z])/g, ' $1')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                  {reportData.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#F9FAFB]">
                      {Object.entries(row).map(([key, val]: [string, any], cIdx) => (
                        <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap">
                          {typeof val === 'number' && (key.toLowerCase().includes('nominal') || key.toLowerCase().includes('gaji') || key.toLowerCase().includes('upah') || key.toLowerCase().includes('total') || key.toLowerCase().includes('kasbon') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('net') || key.toLowerCase().includes('gross'))
                            ? formatRupiah(val)
                            : String(val ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Report Document Footer */}
        <div className="mt-8 pt-6 border-t border-[#EAECF0] flex items-center justify-between text-xs text-[#667085]">
          <div>
            <p>Dicetak otomatis oleh Sistem Manajemen Operasional Kontraktor</p>
            <p className="text-[11px] text-[#98A2B3] mt-0.5">Waktu Laporan: {new Date().toLocaleString('id-ID')}</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-[#262626]">{settings?.ownerName || 'Bpk. Bambang Prakoso'}</p>
            <p className="text-[11px] text-[#667085]">Owner / Pimpinan Perusahaan</p>
          </div>
        </div>
      </div>
    </div>
  );
};
