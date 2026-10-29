import React from 'react';
import { X, Printer, Building2, CheckCircle2 } from 'lucide-react';
import { SalaryPayment } from '../types.js';
import { formatRupiah, formatDateID, formatOvertimeDuration } from '../lib/utils.js';
import { useCompany } from '../context/CompanyContext.js';

interface SlipGajiModalProps {
  payment: SalaryPayment | null;
  onClose: () => void;
}

export const SlipGajiModal: React.FC<SlipGajiModalProps> = ({ payment, onClose }) => {
  const { settings } = useCompany();

  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-[2px] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden border border-[#EAECF0] animate-in fade-in zoom-in-95 my-8">
        {/* Modal Toolbar (hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-[#EAECF0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF5FF] text-[#4693FD] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#262626]">Slip Gaji Karyawan</h3>
              <p className="text-[11px] text-[#667085] font-mono">{payment.paymentNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4693FD] hover:bg-[#357ee8] text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#667085] hover:text-[#262626] rounded-lg hover:bg-[#F2F4F7] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 text-[#344054] bg-white" id="printable-slip">
          {/* Company Header */}
          <div className="flex items-start justify-between border-b border-[#EAECF0] pb-5 mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#262626] uppercase">
                {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
              </h1>
              <p className="text-xs text-[#667085] font-medium">{settings?.tagline || 'General Contractor & Interior Specialist'}</p>
              <p className="text-xs text-[#667085] mt-1 max-w-md">{settings?.address || 'Jl. Konstruksi Mandiri No. 88, Jakarta Selatan'} | Telp: {settings?.phone || '0812-8899-7722'}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 bg-[#EFF5FF] text-[#4693FD] text-[11px] font-semibold uppercase rounded-md border border-[#D0E2FF]">
                SLIP PEMBAYARAN GAJI
              </span>
              <p className="text-xs font-mono font-medium text-[#262626] mt-1.5">{payment.paymentNumber}</p>
              <p className="text-xs text-[#667085]">Tgl: {formatDateID(payment.paymentDate)}</p>
            </div>
          </div>

          {/* Employee & Period Information */}
          <div className="grid grid-cols-2 gap-4 bg-[#F9FAFB] p-4 rounded-lg border border-[#EAECF0] mb-6 text-xs">
            <div>
              <p className="text-[11px] text-[#667085] font-medium uppercase">Nama Karyawan</p>
              <p className="font-semibold text-[#262626] text-sm mt-0.5">{payment.employeeName}</p>
              <p className="text-xs text-[#667085] mt-1">
                Jabatan: <span className="font-medium text-[#344054]">{payment.employeeRole}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#667085] font-medium uppercase">Periode Pembayaran</p>
              <p className="font-medium text-[#262626] text-xs mt-0.5">
                {formatDateID(payment.periodStart)} s/d {formatDateID(payment.periodEnd)}
              </p>
              <p className="text-xs text-[#667085] mt-1">
                Metode: <span className="font-medium text-[#344054]">{payment.paymentMethod}</span>
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-[#EAECF0] rounded-lg overflow-hidden mb-6">
            <div className="bg-[#F9FAFB] px-4 py-2.5 border-b border-[#EAECF0] font-semibold text-xs text-[#262626]">
              Rincian Perhitungan Gaji & Upah
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[#344054]">
                <span>
                  Upah Harian Penuh ({payment.fullWorkDays !== undefined ? payment.fullWorkDays : Math.floor(payment.totalWorkDays)} hari kerja)
                </span>
                <span className="font-medium text-[#262626] tabular-nums font-mono">
                  {formatRupiah(payment.fullDaySalary !== undefined && payment.fullDaySalary > 0 ? payment.fullDaySalary : payment.totalBasicSalary - (payment.halfDaySalary || 0))}
                </span>
              </div>
              {((payment.halfWorkDays ?? 0) > 0 || (payment.halfDaySalary ?? 0) > 0) && (
                <div className="flex items-center justify-between text-[#175CD3]">
                  <span>
                    Upah Setengah Hari ({payment.halfWorkDays || 1} × ½ hari kerja)
                  </span>
                  <span className="font-medium tabular-nums font-mono">
                    {formatRupiah(payment.halfDaySalary || 0)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[#344054]">
                <span>
                  {String(payment.employeeRole || '').toLowerCase() === 'driver'
                    ? `Upah Lembur (${formatOvertimeDuration(payment.approvedOvertimeHours)} tercatat — Ketentuan Driver: Rp0)`
                    : `Upah Lembur (${formatOvertimeDuration(payment.approvedOvertimeHours)} disetujui)`}
                </span>
                <span className="font-medium text-[#262626] tabular-nums font-mono">
                  {formatRupiah(String(payment.employeeRole || '').toLowerCase() === 'driver' ? 0 : payment.totalOvertimePay)}
                </span>
              </div>
              <div className="flex items-center justify-between font-semibold text-[#262626] pt-2 border-t border-[#EAECF0]">
                <span>TOTAL UPAH KOTOR (PENDAPATAN)</span>
                <span className="tabular-nums font-mono">{formatRupiah(payment.grossSalary)}</span>
              </div>
            </div>

            <div className="bg-[#F9FAFB] px-4 py-2 border-t border-b border-[#EAECF0] font-semibold text-xs text-[#262626]">
              Potongan
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[#344054]">
                <span className="text-[#D64545]">Potongan Kasbon Karyawan</span>
                <span className="font-medium text-[#D64545] tabular-nums font-mono">- {formatRupiah(payment.kasbonDeduction)}</span>
              </div>
              {payment.otherDeductions > 0 && (
                <div className="flex items-center justify-between text-[#344054]">
                  <span className="text-[#D64545]">Potongan Lain-lain</span>
                  <span className="font-medium text-[#D64545] tabular-nums font-mono">- {formatRupiah(payment.otherDeductions)}</span>
                </div>
              )}
            </div>

            {/* Total Net Salary */}
            <div className="bg-[#EFF5FF] px-4 py-3.5 border-t border-[#D0E2FF] flex items-center justify-between">
              <div>
                <span className="font-semibold text-[#1E40AF] text-xs uppercase block">TOTAL GAJI BERSIH DITERIMA</span>
                <span className="text-[11px] text-[#4693FD]">
                  Formula: Gaji Kotor - Potongan Kasbon
                </span>
              </div>
              <span className="text-lg font-bold text-[#1E40AF] font-mono tabular-nums">
                {formatRupiah(payment.netSalary)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="mb-6 p-3 bg-[#F9FAFB] rounded-lg border border-[#EAECF0] text-xs text-[#667085]">
              <span className="font-medium text-[#262626]">Catatan: </span>
              {payment.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-[#EAECF0] text-center text-xs">
            <div>
              <p className="text-[#667085]">Penerima,</p>
              <div className="h-14 flex items-end justify-center">
                <span className="border-b border-[#262626] w-36 inline-block"></span>
              </div>
              <p className="font-medium text-[#262626] mt-1">{payment.employeeName}</p>
              <p className="text-[11px] text-[#667085]">{payment.employeeRole}</p>
            </div>
            <div>
              <p className="text-[#667085]">Mengetahui,</p>
              <div className="h-14 flex items-end justify-center">
                <span className="border-b border-[#262626] w-36 inline-block"></span>
              </div>
              <p className="font-medium text-[#262626] mt-1">{settings?.ownerName || 'Bpk. Bambang Prakoso'}</p>
              <p className="text-[11px] text-[#667085]">Owner / Pimpinan</p>
            </div>
          </div>

          {/* Official Verification Stamp for Print */}
          <div className="mt-8 pt-4 border-t border-[#EAECF0] flex items-center justify-between text-[11px] text-[#667085]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A36A]" />
              <span>Dokumen Resmi Terverifikasi Sistem Manajemen Kontraktor</span>
            </div>
            <span className="font-mono">Diproses oleh: {payment.processedBy}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
