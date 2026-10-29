import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Project, ProjectExpense } from '../types';
import { formatRupiah, formatDateID, formatOvertimeDuration, terbilangRupiah, isDriverRole } from './utils';

export interface ProjectEmployeeRecapItem {
  employeeId: string;
  employeeName: string;
  role: string;
  status: 'active' | 'inactive';
  assignedDate: string;
  dailyWage: number;
  overtimeHourlyWage: number;
  fullWorkDays: number;
  halfWorkDays: number;
  absentDays: number;
  totalWorkDays: number;
  fullDaySalary: number;
  halfDaySalary: number;
  totalBasicSalary: number;
  overtimeHours: number;
  totalOvertimePay: number;
  grossSalary: number;
  kasbonInPeriod: number;
  kasbonDeduction: number;
  remainingKasbon: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  isPaid: boolean;
  paidAmount: number;
  unpaidAmount: number;
  paymentStatusLabel: string;
  attendanceRecords: any[];
  overtimeRecords: any[];
  kasbonRecords: any[];
}

export interface ProjectRecapSummaryData {
  totalEmployees: number;
  totalRecapEmployees: number;
  fullWorkDays: number;
  halfWorkDays: number;
  absentDays: number;
  totalWorkDays: number;
  fullDaySalary: number;
  halfDaySalary: number;
  totalBasicSalary: number;
  totalOvertimeHours: number;
  totalOvertimePay: number;
  totalGrossSalary: number;
  totalKasbonInPeriod: number;
  totalKasbonDeduction: number;
  totalRemainingKasbon: number;
  totalOtherDeductions: number;
  totalNetSalary: number;
  paidPayrollTotal: number;
  unpaidPayrollTotal: number;
  totalTransport: number;
  totalOp: number;
  totalOtherCost: number;
  totalProjectCost: number;
  budget: number;
  budgetRemaining: number;
  realizationPercentage: number;
}

const COMPANY_NAME = 'PT ASTA BRATA MATAHARI TERBIT';
const COMPANY_SUBTITLE = 'Sistem Manajemen Konstruksi, Kehadiran, Pengupahan & Keuangan Proyek';

function getPrintTimestamp(): string {
  const now = new Date();
  return now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPeriodLabel(startDate?: string, endDate?: string): string {
  if (startDate && endDate) {
    return `${formatDateID(startDate)} s/d ${formatDateID(endDate)}`;
  }
  return 'Semua Periode Proyek (Kumulatif)';
}

function drawDocumentHeader(
  doc: jsPDF,
  reportTitle: string,
  project: Project,
  startDate?: string,
  endDate?: string,
  extraFilterLabel?: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Company Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(29, 41, 57);
  doc.text(COMPANY_NAME, margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(102, 112, 133);
  doc.text(COMPANY_SUBTITLE, margin, 19);

  // Right-aligned Print Timestamp
  doc.setFontSize(8);
  doc.text(`Dicetak: ${getPrintTimestamp()}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Kode Dokumen: ${project.code}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`, pageWidth - margin, 19, {
    align: 'right',
  });

  // Divider line
  doc.setDrawColor(208, 213, 221);
  doc.setLineWidth(0.5);
  doc.line(margin, 22, pageWidth - margin, 22);

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(21, 94, 239);
  doc.text(reportTitle.toUpperCase(), margin, 28.5);

  // Project Metadata Box
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(234, 236, 240);
  doc.roundedRect(margin, 31.5, pageWidth - margin * 2, 15, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(52, 64, 84);
  doc.setFont('helvetica', 'bold');
  doc.text(`Proyek: ${project.name} (${project.code})`, margin + 3, 37);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lokasi: ${project.location || '-'}`, margin + 3, 43);

  const midX = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.text(`Periode Laporan: ${getPeriodLabel(startDate, endDate)}`, midX, 37);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Status Proyek: ${project.status}${extraFilterLabel ? ` | Filter: ${extraFilterLabel}` : ''}`,
    midX,
    43
  );

  return 50;
}

function addPageFootersAndSignatures(
  doc: jsPDF,
  project: Project,
  includeSignatures = true
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  if (includeSignatures) {
    const lastAutoTable = (doc as any).lastAutoTable;
    let finalY = lastAutoTable ? lastAutoTable.finalY + 8 : 140;
    if (finalY + 34 > pageHeight - 14) {
      doc.addPage();
      finalY = 24;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(52, 64, 84);

    const col1X = margin + 20;
    const col2X = pageWidth - margin - 65;

    doc.text('Disiapkan Oleh,', col1X, finalY);
    doc.text('Admin Proyek / Keuangan', col1X, finalY + 4.5);
    doc.line(col1X, finalY + 22, col1X + 48, finalY + 22);
    doc.setFont('helvetica', 'bold');
    doc.text('( ______________________ )', col1X, finalY + 26.5);

    doc.setFont('helvetica', 'normal');
    doc.text(`${project.location || 'Jakarta'}, ${formatDateID(new Date().toISOString().split('T')[0])}`, col2X, finalY);
    doc.text('Disetujui Oleh, Pimpinan / Owner', col2X, finalY + 4.5);
    doc.line(col2X, finalY + 22, col2X + 52, finalY + 22);
    doc.setFont('helvetica', 'bold');
    doc.text('( ________________________ )', col2X, finalY + 26.5);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(234, 236, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(102, 112, 133);
    doc.text(
      `${COMPANY_NAME} — Proyek ${project.name} (${project.code})`,
      margin,
      pageHeight - 5.5
    );
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 5.5,
      { align: 'right' }
    );
  }
}

// ============================================================================
// 1. EXPORT PDF FOR SUBMENUS H1, H2, H3, H4, H5
// ============================================================================
export function exportProjectReportPDF(params: {
  submenu: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  project: Project;
  employeeRecaps: ProjectEmployeeRecapItem[];
  selectedEmployee?: ProjectEmployeeRecapItem | null;
  transportExpenses: ProjectExpense[];
  operationalExpenses: ProjectExpense[];
  summary: ProjectRecapSummaryData;
  startDate?: string;
  endDate?: string;
  roleFilter?: string;
  categoryFilter?: string;
}) {
  const {
    submenu,
    project,
    employeeRecaps,
    selectedEmployee,
    transportExpenses,
    operationalExpenses,
    summary,
    startDate,
    endDate,
    roleFilter,
    categoryFilter,
  } = params;

  const isLandscape = submenu === 'h1' || submenu === 'h2';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeProjCode = (project.code || project.name).replace(/[^a-zA-Z0-9_-]/g, '_');

  if (submenu === 'h1') {
    const targetList = selectedEmployee ? [selectedEmployee] : employeeRecaps;
    const title = selectedEmployee
      ? `H1. Laporan Rekap Gaji & Kehadiran Karyawan — ${selectedEmployee.employeeName}`
      : `H1. Laporan Rekap Gaji Per Karyawan Proyek (Detail Kehadiran & Upah)`;

    let currentY = drawDocumentHeader(
      doc,
      title,
      project,
      startDate,
      endDate,
      roleFilter && roleFilter !== 'ALL' ? `Jabatan: ${roleFilter}` : undefined
    );

    targetList.forEach((emp, idx) => {
      if (idx > 0) {
        const lastY = (doc as any).lastAutoTable?.finalY || currentY;
        if (lastY + 55 > doc.internal.pageSize.getHeight() - 18) {
          doc.addPage();
          currentY = drawDocumentHeader(doc, title, project, startDate, endDate);
        } else {
          currentY = lastY + 8;
        }
      }

      // Employee Summary Strip
      doc.setFillColor(239, 245, 255);
      doc.setDrawColor(208, 226, 255);
      doc.roundedRect(12, currentY, doc.internal.pageSize.getWidth() - 24, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 41, 57);
      doc.text(
        `${idx + 1}. ${emp.employeeName} (${emp.employeeId}) — Jabatan: ${emp.role} ${
          emp.status === 'inactive' ? '[Nonaktif]' : '[Aktif]'
        }`,
        15,
        currentY + 5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(52, 64, 84);
      const isDriver = isDriverRole(emp.role);
      doc.text(
        `Tarif Harian: ${formatRupiah(emp.dailyWage)} | Tarif Lembur/Jam: ${
          isDriver ? 'Rp 0 (Driver Tidak Lembur)' : formatRupiah(emp.overtimeHourlyWage)
        } | Hadir Penuh: ${emp.fullWorkDays} hr | Setengah Hari: ${emp.halfWorkDays} hr | Alpa/Izin/Sakit: ${emp.absentDays} hr`,
        15,
        currentY + 10.5
      );

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 94, 239);
      doc.text(
        `Gaji Bersih: ${formatRupiah(emp.netSalary)}`,
        doc.internal.pageSize.getWidth() - 15,
        currentY + 5,
        { align: 'right' }
      );
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 84, 103);
      doc.text(
        `Pokok: ${formatRupiah(emp.totalBasicSalary)} | Lembur (${formatOvertimeDuration(emp.overtimeHours)}): ${formatRupiah(
          emp.totalOvertimePay
        )} | Kotor: ${formatRupiah(emp.grossSalary)} | Pot. Kasbon: -${formatRupiah(emp.kasbonDeduction)} (Sisa: ${formatRupiah(
          emp.remainingKasbon
        )})`,
        doc.internal.pageSize.getWidth() - 15,
        currentY + 10.5,
        { align: 'right' }
      );

      const attRows = (emp.attendanceRecords || [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((att, rIdx) => {
          const basicDay =
            att.status === 'Hadir'
              ? att.dailyWageSnapshot || emp.dailyWage
              : att.status === 'Setengah Hari'
              ? Math.round((att.dailyWageSnapshot || emp.dailyWage) / 2)
              : 0;
          const otPayDay = isDriver
            ? 0
            : att.overtimeApproved && att.overtimeHours > 0
            ? Math.round(att.overtimeHours * (att.overtimeWageSnapshot || emp.overtimeHourlyWage))
            : 0;
          const kbNominal = att.hasKasbon && att.kasbonAmount ? att.kasbonAmount : 0;

          return [
            String(rIdx + 1),
            formatDateID(att.date),
            att.status,
            `${att.checkIn || '-'} - ${att.checkOut || '-'}`,
            formatRupiah(basicDay),
            att.overtimeHours > 0 ? formatOvertimeDuration(att.overtimeHours) : '-',
            isDriver && att.overtimeHours > 0 ? 'Rp 0 (Driver)' : formatRupiah(otPayDay),
            kbNominal > 0 ? `${formatRupiah(kbNominal)} (${att.kasbonStatus || 'Disetujui'})` : '-',
            formatRupiah(basicDay + otPayDay),
            att.notes || '-',
          ];
        });

      autoTable(doc, {
        startY: currentY + 15.5,
        margin: { left: 12, right: 12 },
        showHead: 'everyPage',
        head: [
          [
            'No',
            'Tanggal',
            'Status Kehadiran',
            'Jam Kerja',
            'Upah Harian',
            'Durasi Lembur',
            'Upah Lembur',
            'Kasbon Hari Itu',
            'Total Upah Hari Itu',
            'Catatan',
          ],
        ],
        body:
          attRows.length > 0
            ? attRows
            : [['-', '-', 'Belum ada riwayat kehadiran pada periode ini', '-', 'Rp 0', '-', 'Rp 0', '-', 'Rp 0', '-']],
        foot: [
          [
            '',
            'SUBTOTAL KARYAWAN',
            `${emp.fullWorkDays} Penuh, ${emp.halfWorkDays} Setengah`,
            `${emp.totalWorkDays} Hari Efektif`,
            formatRupiah(emp.totalBasicSalary),
            formatOvertimeDuration(emp.overtimeHours),
            formatRupiah(emp.totalOvertimePay),
            `Pot: -${formatRupiah(emp.kasbonDeduction)}`,
            `Bersih: ${formatRupiah(emp.netSalary)}`,
            `Sisa Kasbon: ${formatRupiah(emp.remainingKasbon)}`,
          ],
        ],
        showFoot: 'lastPage',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [29, 41, 57] },
        headStyles: { fillColor: [29, 41, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [242, 244, 247], textColor: [29, 41, 57], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
    });

    addPageFootersAndSignatures(doc, project, true);
    const empSuffix = selectedEmployee ? `_${selectedEmployee.employeeName.replace(/\s+/g, '_')}` : '_Semua_Karyawan';
    doc.save(`H1_Rekap_Gaji_Karyawan_${safeProjCode}${empSuffix}_${dateSlug}.pdf`);
    return;
  }

  if (submenu === 'h2') {
    const startY = drawDocumentHeader(
      doc,
      'H2. Laporan Rekap Total Gaji Seluruh Karyawan Proyek',
      project,
      startDate,
      endDate,
      roleFilter && roleFilter !== 'ALL' ? `Jabatan: ${roleFilter}` : undefined
    );

    const rows = employeeRecaps.map((r, i) => [
      String(i + 1),
      r.employeeId,
      r.employeeName,
      r.role,
      String(r.fullWorkDays),
      String(r.halfWorkDays),
      String(r.absentDays),
      formatRupiah(r.dailyWage),
      formatRupiah(r.totalBasicSalary),
      r.overtimeHours > 0 ? formatOvertimeDuration(r.overtimeHours) : '-',
      isDriverRole(r.role) ? 'Rp 0' : formatRupiah(r.overtimeHourlyWage),
      formatRupiah(r.totalOvertimePay),
      formatRupiah(r.grossSalary),
      formatRupiah(r.kasbonInPeriod),
      formatRupiah(r.kasbonDeduction),
      formatRupiah(r.remainingKasbon),
      formatRupiah(r.netSalary),
    ]);

    const totFull = employeeRecaps.reduce((s, r) => s + r.fullWorkDays, 0);
    const totHalf = employeeRecaps.reduce((s, r) => s + r.halfWorkDays, 0);
    const totAbs = employeeRecaps.reduce((s, r) => s + r.absentDays, 0);
    const totBasic = employeeRecaps.reduce((s, r) => s + r.totalBasicSalary, 0);
    const totOtHours = employeeRecaps.reduce((s, r) => s + r.overtimeHours, 0);
    const totOtPay = employeeRecaps.reduce((s, r) => s + r.totalOvertimePay, 0);
    const totGross = employeeRecaps.reduce((s, r) => s + r.grossSalary, 0);
    const totKbPeriod = employeeRecaps.reduce((s, r) => s + r.kasbonInPeriod, 0);
    const totKbDed = employeeRecaps.reduce((s, r) => s + r.kasbonDeduction, 0);
    const totKbRem = employeeRecaps.reduce((s, r) => s + r.remainingKasbon, 0);
    const totNet = employeeRecaps.reduce((s, r) => s + r.netSalary, 0);

    autoTable(doc, {
      startY,
      margin: { left: 10, right: 10 },
      showHead: 'everyPage',
      head: [
        [
          'No',
          'ID',
          'Nama Karyawan',
          'Jabatan',
          'Penuh',
          '1/2 Hr',
          'Absen',
          'Tarif/Hr',
          'Gaji Pokok',
          'Durasi Lembur',
          'Tarif OT',
          'Upah Lembur',
          'Gaji Kotor',
          'Total Kasbon',
          'Pot. Kasbon',
          'Sisa Kasbon',
          'Gaji Bersih',
        ],
      ],
      body: rows,
      foot: [
        [
          '',
          '',
          `GRAND TOTAL (${employeeRecaps.length} Karyawan)`,
          '',
          String(totFull),
          String(totHalf),
          String(totAbs),
          '-',
          formatRupiah(totBasic),
          formatOvertimeDuration(totOtHours),
          '-',
          formatRupiah(totOtPay),
          formatRupiah(totGross),
          formatRupiah(totKbPeriod),
          formatRupiah(totKbDed),
          formatRupiah(totKbRem),
          formatRupiah(totNet),
        ],
      ],
      showFoot: 'lastPage',
      styles: { fontSize: 6.8, cellPadding: 1.6, textColor: [29, 41, 57] },
      headStyles: { fillColor: [29, 41, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    addPageFootersAndSignatures(doc, project, true);
    doc.save(`H2_Rekap_Total_Gaji_Seluruh_Karyawan_${safeProjCode}_${dateSlug}.pdf`);
    return;
  }

  if (submenu === 'h3') {
    const startY = drawDocumentHeader(
      doc,
      'H3. Laporan Rekap Biaya Transportasi Proyek',
      project,
      startDate,
      endDate,
      categoryFilter && categoryFilter !== 'ALL' ? `Kategori: ${categoryFilter}` : undefined
    );

    const rows = transportExpenses.map((e, i) => [
      String(i + 1),
      e.expenseNumber,
      formatDateID(e.date),
      e.category,
      e.vehicleOrDriver || '-',
      e.destinationOrRoute || '-',
      e.picName || '-',
      e.description || '-',
      e.paymentMethod || '-',
      e.attachments && e.attachments.length > 0 ? `${e.attachments.length} Foto` : 'Tanpa Foto',
      formatRupiah(e.amount),
    ]);

    const totalAmount = transportExpenses.reduce((s, e) => s + e.amount, 0);

    autoTable(doc, {
      startY,
      margin: { left: 12, right: 12 },
      showHead: 'everyPage',
      head: [
        [
          'No',
          'No. Transaksi',
          'Tanggal',
          'Kategori',
          'Armada/Driver',
          'Rute/Tujuan',
          'PIC',
          'Keterangan',
          'Metode',
          'Bukti',
          'Nominal',
        ],
      ],
      body:
        rows.length > 0
          ? rows
          : [['-', '-', '-', 'Tidak ada data biaya transportasi pada periode ini', '-', '-', '-', '-', '-', '-', 'Rp 0']],
      foot: [
        [
          '',
          '',
          'TOTAL BIAYA TRANSPORTASI PROYEK',
          `${transportExpenses.length} Transaksi`,
          '',
          '',
          '',
          '',
          '',
          '',
          formatRupiah(totalAmount),
        ],
      ],
      showFoot: 'lastPage',
      styles: { fontSize: 7.2, cellPadding: 1.8, textColor: [29, 41, 57] },
      headStyles: { fillColor: [29, 41, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    addPageFootersAndSignatures(doc, project, true);
    doc.save(`H3_Rekap_Biaya_Transportasi_${safeProjCode}_${dateSlug}.pdf`);
    return;
  }

  if (submenu === 'h4') {
    const startY = drawDocumentHeader(
      doc,
      'H4. Laporan Rekap Pengeluaran Operasional Lapangan',
      project,
      startDate,
      endDate,
      categoryFilter && categoryFilter !== 'ALL' ? `Kategori: ${categoryFilter}` : undefined
    );

    const rows = operationalExpenses.map((e, i) => [
      String(i + 1),
      e.expenseNumber,
      formatDateID(e.date),
      e.category,
      e.description || '-',
      e.picName || '-',
      e.paymentMethod || '-',
      e.attachments && e.attachments.length > 0 ? `${e.attachments.length} Foto` : 'Tanpa Foto',
      formatRupiah(e.amount),
    ]);

    const totalAmount = operationalExpenses.reduce((s, e) => s + e.amount, 0);

    autoTable(doc, {
      startY,
      margin: { left: 12, right: 12 },
      showHead: 'everyPage',
      head: [
        [
          'No',
          'No. Transaksi',
          'Tanggal',
          'Kategori Biaya',
          'Uraian Kebutuhan / Material',
          'Penanggung Jawab',
          'Metode Bayar',
          'Bukti Struk',
          'Nominal',
        ],
      ],
      body:
        rows.length > 0
          ? rows
          : [['-', '-', '-', 'Tidak ada data pengeluaran operasional pada periode ini', '-', '-', '-', '-', 'Rp 0']],
      foot: [
        [
          '',
          '',
          'TOTAL PENGELUARAN OPERASIONAL LAPANGAN',
          `${operationalExpenses.length} Transaksi`,
          '',
          '',
          '',
          '',
          formatRupiah(totalAmount),
        ],
      ],
      showFoot: 'lastPage',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [29, 41, 57] },
      headStyles: { fillColor: [29, 41, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    addPageFootersAndSignatures(doc, project, true);
    doc.save(`H4_Rekap_Operasional_Lapangan_${safeProjCode}_${dateSlug}.pdf`);
    return;
  }

  if (submenu === 'h5') {
    const startY = drawDocumentHeader(
      doc,
      'H5. Laporan Rekapitulasi Seluruh Pengeluaran & Realisasi Anggaran Proyek',
      project,
      startDate,
      endDate
    );

    const rows: string[][] = [
      [
        '1',
        'Gaji Pokok Karyawan Proyek (Hadir Penuh & Setengah Hari)',
        `${summary.totalWorkDays} Hari Efektif (${summary.fullWorkDays} Penuh, ${summary.halfWorkDays} Setengah Hari)`,
        formatRupiah(summary.totalBasicSalary),
      ],
      [
        '2',
        'Upah Lembur Karyawan Proyek Disetujui',
        `Total Durasi: ${formatOvertimeDuration(summary.totalOvertimeHours)} (Driver = Rp 0)`,
        formatRupiah(summary.totalOvertimePay),
      ],
      [
        '2a',
        'Subtotal Beban Gaji Kotor Karyawan Proyek (1 + 2)',
        `Terbayar: ${formatRupiah(summary.paidPayrollTotal)} | Belum Dibayar/Terhitung: ${formatRupiah(
          summary.unpaidPayrollTotal
        )} | Pot. Kasbon: ${formatRupiah(summary.totalKasbonDeduction)} (Gaji Bersih: ${formatRupiah(summary.totalNetSalary)})`,
        formatRupiah(summary.totalGrossSalary),
      ],
      [
        '3',
        'Total Biaya Transportasi Proyek (H3)',
        `${transportExpenses.length} Transaksi (BBM, Tol, Parkir, Ongkos & Sewa Armada)`,
        formatRupiah(summary.totalTransport),
      ],
      [
        '4',
        'Total Pengeluaran Operasional Lapangan (H4)',
        `${operationalExpenses.length} Transaksi (Material Kecil, Alat Kerja, Konsumsi, Darurat)`,
        formatRupiah(summary.totalOp),
      ],
    ];

    if (summary.totalOtherCost > 0) {
      rows.push([
        '5',
        'Biaya Proyek Lainnya',
        'Komponen pengeluaran tambahan proyek',
        formatRupiah(summary.totalOtherCost),
      ]);
    }

    autoTable(doc, {
      startY,
      margin: { left: 12, right: 12 },
      showHead: 'everyPage',
      head: [['No', 'Komponen Pengeluaran Proyek', 'Rincian & Keterangan Realisasi', 'Nominal (Rp)']],
      body: rows,
      foot: [
        ['', 'TOTAL SELURUH PENGELUARAN PROYEK', 'Akumulasi Gaji + Transportasi + Operasional', formatRupiah(summary.totalProjectCost)],
        ['', 'NILAI ANGGARAN KONTRAK PROYEK', `Plafon Anggaran Proyek ${project.name}`, formatRupiah(summary.budget)],
        [
          '',
          'SISA ANGGARAN PROYEK',
          'Nilai Anggaran Proyek - Total Seluruh Pengeluaran',
          formatRupiah(summary.budgetRemaining),
        ],
        [
          '',
          'PERSENTASE REALISASI ANGGARAN',
          '(Total Pengeluaran / Nilai Anggaran) × 100%',
          `${summary.realizationPercentage}%`,
        ],
      ],
      showFoot: 'lastPage',
      styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [29, 41, 57] },
      headStyles: { fillColor: [29, 41, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    addPageFootersAndSignatures(doc, project, true);
    doc.save(`H5_Rekap_Seluruh_Pengeluaran_Proyek_${safeProjCode}_${dateSlug}.pdf`);
  }
}

// ============================================================================
// 2. EXPORT SLIP GAJI KARYAWAN PROYEK PDF (SINGLE OR MULTI-EMPLOYEE, 1 PAGE EACH)
// ============================================================================
export function exportProjectSlipGajiPDF(params: {
  project: Project;
  employees: ProjectEmployeeRecapItem[];
  startDate?: string;
  endDate?: string;
}) {
  const { project, employees, startDate, endDate } = params;
  if (!employees.length) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeProjCode = (project.code || project.name).replace(/[^a-zA-Z0-9_-]/g, '_');

  employees.forEach((emp, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const isDriver = isDriverRole(emp.role);

    // Header Perusahaan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(29, 41, 57);
    doc.text(COMPANY_NAME, margin, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(102, 112, 133);
    doc.text('Dokumen Resmi Bukti Penerimaan Upah & Rekap Kehadiran Karyawan Proyek', margin, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 94, 239);
    doc.text('SLIP GAJI KARYAWAN PROYEK', pageWidth - margin, 15, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 112, 133);
    doc.text(`Tanggal Cetak: ${getPrintTimestamp()}`, pageWidth - margin, 20, { align: 'right' });

    doc.setDrawColor(208, 213, 221);
    doc.setLineWidth(0.5);
    doc.line(margin, 23, pageWidth - margin, 23);

    // Identity Box
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(234, 236, 240);
    doc.roundedRect(margin, 26, pageWidth - margin * 2, 24, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setTextColor(52, 64, 84);

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Karyawan', margin + 4, 32);
    doc.text('ID Karyawan', margin + 4, 37.5);
    doc.text('Jabatan / Peran', margin + 4, 43);
    doc.text('Status Penugasan', margin + 4, 48);

    doc.setFont('helvetica', 'normal');
    doc.text(`: ${emp.employeeName}`, margin + 36, 32);
    doc.text(`: ${emp.employeeId}`, margin + 36, 37.5);
    doc.text(`: ${emp.role}${isDriver ? ' (Tanpa Upah Lembur)' : ''}`, margin + 36, 43);
    doc.text(`: ${emp.status === 'active' ? 'Aktif di Proyek' : 'Nonaktif (Riwayat Periode)'}`, margin + 36, 48);

    // Right column
    const rightColX = pageWidth / 2 + 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Proyek', rightColX, 32);
    doc.text('Kode & Lokasi', rightColX, 37.5);
    doc.text('Periode Gaji', rightColX, 43);
    doc.text('Status Pembayaran', rightColX, 48);

    doc.setFont('helvetica', 'normal');
    doc.text(`: ${project.name}`, rightColX + 32, 32);
    doc.text(`: ${project.code} — ${project.location || '-'}`, rightColX + 32, 37.5);
    doc.text(`: ${getPeriodLabel(startDate, endDate)}`, rightColX + 32, 43);
    doc.text(`: ${emp.paymentStatusLabel}`, rightColX + 32, 48);

    // Table 1: Rincian Penerimaan & Potongan Gaji
    autoTable(doc, {
      startY: 54,
      margin: { left: margin, right: margin },
      head: [['Komponen Pengupahan & Potongan', 'Perhitungan / Rincian', 'Nominal (Rp)']],
      body: [
        [
          '1. Upah Hadir Penuh (100%)',
          `${emp.fullWorkDays} hari × ${formatRupiah(emp.dailyWage)}`,
          formatRupiah(emp.fullDaySalary),
        ],
        [
          '2. Upah Setengah Hari (50%)',
          `${emp.halfWorkDays} hari × ${formatRupiah(Math.round(emp.dailyWage / 2))}`,
          formatRupiah(emp.halfDaySalary),
        ],
        [
          'Subtotal Gaji Pokok Harian',
          `${emp.totalWorkDays} hari kerja efektif (${emp.absentDays} hari tidak hadir)`,
          formatRupiah(emp.totalBasicSalary),
        ],
        [
          '3. Upah Lembur Disetujui',
          isDriver
            ? `Durasi tercatat: ${formatOvertimeDuration(emp.overtimeHours)} × Rp 0 (Ketentuan Driver)`
            : `${formatOvertimeDuration(emp.overtimeHours)} × ${formatRupiah(emp.overtimeHourlyWage)}/jam`,
          formatRupiah(emp.totalOvertimePay),
        ],
        ['TOTAL GAJI KOTOR (PENERIMAAN)', 'Gaji Pokok + Upah Lembur', formatRupiah(emp.grossSalary)],
        [
          '4. Total Pengajuan Kasbon Periode Ini',
          `${emp.kasbonRecords?.length || 0} catatan kasbon aktif/disetujui`,
          formatRupiah(emp.kasbonInPeriod),
        ],
        [
          '5. Potongan Kasbon Periode Ini',
          'Dipotong langsung dari Gaji Kotor periode ini',
          `- ${formatRupiah(emp.kasbonDeduction)}`,
        ],
        [
          '6. Sisa Kasbon Setelah Pemotongan',
          'Saldo kewajiban kasbon yang belum terpotong',
          formatRupiah(emp.remainingKasbon),
        ],
      ],
      foot: [
        [
          'GAJI BERSIH DITERIMA (TAKE HOME PAY)',
          `Terbilang: ${terbilangRupiah(emp.netSalary)}`,
          formatRupiah(emp.netSalary),
        ],
      ],
      styles: { fontSize: 8.2, cellPadding: 2.3, textColor: [29, 41, 57] },
      headStyles: { fillColor: [29, 41, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [236, 253, 243], textColor: [2, 122, 72], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    // Table 2: Ringkasan Kehadiran Harian Karyawan (if records exist)
    const afterSummaryY = ((doc as any).lastAutoTable?.finalY || 135) + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(29, 41, 57);
    doc.text('Rincian Kehadiran & Lembur Harian pada Periode Ini:', margin, afterSummaryY);

    const attRows = (emp.attendanceRecords || [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((a, idxAtt) => {
        const dayBasic =
          a.status === 'Hadir'
            ? a.dailyWageSnapshot || emp.dailyWage
            : a.status === 'Setengah Hari'
            ? Math.round((a.dailyWageSnapshot || emp.dailyWage) / 2)
            : 0;
        const dayOt = isDriver
          ? 0
          : a.overtimeApproved && a.overtimeHours > 0
          ? Math.round(a.overtimeHours * (a.overtimeWageSnapshot || emp.overtimeHourlyWage))
          : 0;
        return [
          String(idxAtt + 1),
          formatDateID(a.date),
          a.status,
          `${a.checkIn || '-'} - ${a.checkOut || '-'}`,
          formatRupiah(dayBasic),
          a.overtimeHours > 0 ? formatOvertimeDuration(a.overtimeHours) : '-',
          formatRupiah(dayOt),
          a.hasKasbon && a.kasbonAmount ? formatRupiah(a.kasbonAmount) : '-',
          formatRupiah(dayBasic + dayOt),
        ];
      });

    autoTable(doc, {
      startY: afterSummaryY + 2,
      margin: { left: margin, right: margin },
      head: [['No', 'Tanggal', 'Status', 'Jam', 'Upah Pokok', 'Lembur', 'Upah OT', 'Kasbon', 'Total Harian']],
      body:
        attRows.length > 0
          ? attRows
          : [['-', '-', 'Tidak ada rincian absensi harian pada periode ini', '-', 'Rp 0', '-', 'Rp 0', '-', 'Rp 0']],
      styles: { fontSize: 7.2, cellPadding: 1.6, textColor: [52, 64, 84] },
      headStyles: { fillColor: [71, 84, 103], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    // Signature block for Slip Gaji
    let sigY = ((doc as any).lastAutoTable?.finalY || 220) + 10;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (sigY + 30 > pageHeight - 12) {
      doc.addPage();
      sigY = 24;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(52, 64, 84);
    doc.text('Penerima Upah / Karyawan,', margin + 12, sigY);
    doc.line(margin + 12, sigY + 20, margin + 62, sigY + 20);
    doc.setFont('helvetica', 'bold');
    doc.text(`( ${emp.employeeName} )`, margin + 12, sigY + 25);

    doc.setFont('helvetica', 'normal');
    doc.text(`${project.location || 'Jakarta'}, ${formatDateID(new Date().toISOString().split('T')[0])}`, pageWidth - margin - 62, sigY);
    doc.text('Bagian Keuangan / Admin Proyek,', pageWidth - margin - 62, sigY + 4.5);
    doc.line(pageWidth - margin - 62, sigY + 20, pageWidth - margin - 10, sigY + 20);
    doc.setFont('helvetica', 'bold');
    doc.text('( ______________________ )', pageWidth - margin - 62, sigY + 25);
  });

  addPageFootersAndSignatures(doc, project, false);

  const fileSuffix =
    employees.length === 1
      ? `_${employees[0].employeeName.replace(/\s+/g, '_')}`
      : `_Kolektif_${employees.length}_Karyawan`;
  doc.save(`Slip_Gaji_Proyek_${safeProjCode}${fileSuffix}_${dateSlug}.pdf`);
}

// ============================================================================
// 3. EXPORT EXCEL (.XLSX) FOR SUBMENUS H1, H2, H3, H4, H5
// ============================================================================
export function exportProjectReportExcel(params: {
  submenu: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  project: Project;
  employeeRecaps: ProjectEmployeeRecapItem[];
  selectedEmployee?: ProjectEmployeeRecapItem | null;
  transportExpenses: ProjectExpense[];
  operationalExpenses: ProjectExpense[];
  summary: ProjectRecapSummaryData;
  startDate?: string;
  endDate?: string;
}) {
  const {
    submenu,
    project,
    employeeRecaps,
    selectedEmployee,
    transportExpenses,
    operationalExpenses,
    summary,
    startDate,
    endDate,
  } = params;

  const wb = XLSX.utils.book_new();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeProjCode = (project.code || project.name).replace(/[^a-zA-Z0-9_-]/g, '_');
  const periodText = getPeriodLabel(startDate, endDate);

  if (submenu === 'h1') {
    const targetList = selectedEmployee ? [selectedEmployee] : employeeRecaps;
    const sheetRows: any[][] = [
      [COMPANY_NAME],
      ['H1. REKAP GAJI PER KARYAWAN PROYEK (DETAIL HARIAN & UPAH)'],
      [`Proyek: ${project.name} (${project.code})`, '', `Lokasi: ${project.location || '-'}`],
      [`Periode: ${periodText}`, '', `Dicetak: ${getPrintTimestamp()}`],
      [],
      [
        'No',
        'ID Karyawan',
        'Nama Karyawan',
        'Jabatan',
        'Tanggal',
        'Status Kehadiran',
        'Jam Masuk',
        'Jam Pulang',
        'Tarif Harian (Rp)',
        'Upah Pokok Hari Itu (Rp)',
        'Durasi Lembur (Jam)',
        'Durasi Lembur (Teks)',
        'Tarif Lembur/Jam (Rp)',
        'Upah Lembur Hari Itu (Rp)',
        'Kasbon Hari Itu (Rp)',
        'Total Upah Kotor Hari Itu (Rp)',
        'Catatan',
      ],
    ];

    let rowNo = 1;
    for (const emp of targetList) {
      const isDriver = isDriverRole(emp.role);
      const sortedAtt = (emp.attendanceRecords || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (sortedAtt.length === 0) {
        sheetRows.push([
          rowNo++,
          emp.employeeId,
          emp.employeeName,
          emp.role,
          '-',
          'Belum Ada Kehadiran',
          '-',
          '-',
          emp.dailyWage,
          0,
          0,
          '0 jam',
          isDriver ? 0 : emp.overtimeHourlyWage,
          0,
          0,
          0,
          '-',
        ]);
      } else {
        for (const att of sortedAtt) {
          const basicDay =
            att.status === 'Hadir'
              ? att.dailyWageSnapshot || emp.dailyWage
              : att.status === 'Setengah Hari'
              ? Math.round((att.dailyWageSnapshot || emp.dailyWage) / 2)
              : 0;
          const otPayDay = isDriver
            ? 0
            : att.overtimeApproved && att.overtimeHours > 0
            ? Math.round(att.overtimeHours * (att.overtimeWageSnapshot || emp.overtimeHourlyWage))
            : 0;
          const kbDay = att.hasKasbon && att.kasbonAmount ? att.kasbonAmount : 0;

          sheetRows.push([
            rowNo++,
            emp.employeeId,
            emp.employeeName,
            emp.role,
            att.date,
            att.status,
            att.checkIn || '-',
            att.checkOut || '-',
            att.dailyWageSnapshot || emp.dailyWage,
            basicDay,
            att.overtimeHours || 0,
            formatOvertimeDuration(att.overtimeHours || 0),
            isDriver ? 0 : att.overtimeWageSnapshot || emp.overtimeHourlyWage,
            otPayDay,
            kbDay,
            basicDay + otPayDay,
            att.notes || '',
          ]);
        }
      }

      sheetRows.push([
        '',
        emp.employeeId,
        `SUBTOTAL ${emp.employeeName.toUpperCase()}`,
        emp.role,
        `${emp.fullWorkDays} Penuh, ${emp.halfWorkDays} Setengah`,
        `Absen: ${emp.absentDays}`,
        '',
        '',
        emp.dailyWage,
        emp.totalBasicSalary,
        emp.overtimeHours,
        formatOvertimeDuration(emp.overtimeHours),
        isDriver ? 0 : emp.overtimeHourlyWage,
        emp.totalOvertimePay,
        emp.kasbonDeduction,
        emp.grossSalary,
        `Gaji Bersih: ${formatRupiah(emp.netSalary)} | Sisa Kasbon: ${formatRupiah(emp.remainingKasbon)}`,
      ]);
      sheetRows.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 34 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'H1_Rekap_Per_Karyawan');
    XLSX.writeFile(wb, `H1_Rekap_Gaji_Per_Karyawan_${safeProjCode}_${dateSlug}.xlsx`);
    return;
  }

  if (submenu === 'h2') {
    const sheetRows: any[][] = [
      [COMPANY_NAME],
      ['H2. REKAP TOTAL GAJI SELURUH KARYAWAN PROYEK'],
      [`Proyek: ${project.name} (${project.code})`, '', `Lokasi: ${project.location || '-'}`],
      [`Periode: ${periodText}`, '', `Dicetak: ${getPrintTimestamp()}`],
      [],
      [
        'No',
        'ID Karyawan',
        'Nama Karyawan',
        'Jabatan',
        'Status',
        'Jumlah Hadir Penuh',
        'Jumlah Setengah Hari',
        'Jumlah Tidak Hadir',
        'Total Hari Efektif',
        'Tarif Harian (Rp)',
        'Total Gaji Pokok (Rp)',
        'Total Jam Lembur (Desimal)',
        'Durasi Lembur',
        'Tarif Lembur/Jam (Rp)',
        'Total Upah Lembur (Rp)',
        'Total Gaji Kotor (Rp)',
        'Total Kasbon Periode (Rp)',
        'Potongan Kasbon (Rp)',
        'Sisa Kasbon (Rp)',
        'Gaji Bersih Diterima (Rp)',
        'Status Pembayaran',
      ],
    ];

    employeeRecaps.forEach((r, idx) => {
      sheetRows.push([
        idx + 1,
        r.employeeId,
        r.employeeName,
        r.role,
        r.status === 'active' ? 'Aktif' : 'Nonaktif',
        r.fullWorkDays,
        r.halfWorkDays,
        r.absentDays,
        r.totalWorkDays,
        r.dailyWage,
        r.totalBasicSalary,
        r.overtimeHours,
        formatOvertimeDuration(r.overtimeHours),
        isDriverRole(r.role) ? 0 : r.overtimeHourlyWage,
        r.totalOvertimePay,
        r.grossSalary,
        r.kasbonInPeriod,
        r.kasbonDeduction,
        r.remainingKasbon,
        r.netSalary,
        r.paymentStatusLabel,
      ]);
    });

    sheetRows.push([
      '',
      '',
      'GRAND TOTAL SELURUH KARYAWAN',
      `${employeeRecaps.length} Orang`,
      '',
      employeeRecaps.reduce((s, r) => s + r.fullWorkDays, 0),
      employeeRecaps.reduce((s, r) => s + r.halfWorkDays, 0),
      employeeRecaps.reduce((s, r) => s + r.absentDays, 0),
      employeeRecaps.reduce((s, r) => s + r.totalWorkDays, 0),
      '',
      employeeRecaps.reduce((s, r) => s + r.totalBasicSalary, 0),
      Number(employeeRecaps.reduce((s, r) => s + r.overtimeHours, 0).toFixed(4)),
      formatOvertimeDuration(employeeRecaps.reduce((s, r) => s + r.overtimeHours, 0)),
      '',
      employeeRecaps.reduce((s, r) => s + r.totalOvertimePay, 0),
      employeeRecaps.reduce((s, r) => s + r.grossSalary, 0),
      employeeRecaps.reduce((s, r) => s + r.kasbonInPeriod, 0),
      employeeRecaps.reduce((s, r) => s + r.kasbonDeduction, 0),
      employeeRecaps.reduce((s, r) => s + r.remainingKasbon, 0),
      employeeRecaps.reduce((s, r) => s + r.netSalary, 0),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'H2_Total_Gaji_Karyawan');
    XLSX.writeFile(wb, `H2_Rekap_Total_Gaji_Seluruh_Karyawan_${safeProjCode}_${dateSlug}.xlsx`);
    return;
  }

  if (submenu === 'h3') {
    const sheetRows: any[][] = [
      [COMPANY_NAME],
      ['H3. REKAP BIAYA TRANSPORTASI PROYEK'],
      [`Proyek: ${project.name} (${project.code})`, '', `Lokasi: ${project.location || '-'}`],
      [`Periode: ${periodText}`, '', `Dicetak: ${getPrintTimestamp()}`],
      [],
      [
        'No',
        'Nomor Transaksi',
        'Tanggal',
        'Proyek',
        'Kategori Transportasi',
        'Kendaraan / Armada / Driver',
        'Tujuan / Rute Perjalanan',
        'Penanggung Jawab (PIC)',
        'Keterangan',
        'Metode Pembayaran',
        'Jumlah Foto Bukti',
        'Nominal Biaya (Rp)',
      ],
    ];

    transportExpenses.forEach((e, idx) => {
      sheetRows.push([
        idx + 1,
        e.expenseNumber,
        e.date,
        project.name,
        e.category,
        e.vehicleOrDriver || '-',
        e.destinationOrRoute || '-',
        e.picName || '-',
        e.description || '-',
        e.paymentMethod || '-',
        e.attachments?.length || 0,
        e.amount,
      ]);
    });

    sheetRows.push([
      '',
      '',
      'GRAND TOTAL BIAYA TRANSPORTASI PROYEK',
      `${transportExpenses.length} Transaksi`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      transportExpenses.reduce((s, e) => s + e.amount, 0),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 30 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'H3_Biaya_Transportasi');
    XLSX.writeFile(wb, `H3_Rekap_Biaya_Transportasi_${safeProjCode}_${dateSlug}.xlsx`);
    return;
  }

  if (submenu === 'h4') {
    const sheetRows: any[][] = [
      [COMPANY_NAME],
      ['H4. REKAP PENGELUARAN OPERASIONAL LAPANGAN'],
      [`Proyek: ${project.name} (${project.code})`, '', `Lokasi: ${project.location || '-'}`],
      [`Periode: ${periodText}`, '', `Dicetak: ${getPrintTimestamp()}`],
      [],
      [
        'No',
        'Nomor Transaksi',
        'Tanggal',
        'Proyek',
        'Kategori Operasional',
        'Uraian Kebutuhan / Material / Alat',
        'Penanggung Jawab (PIC)',
        'Metode Pembayaran',
        'Jumlah Foto Struk',
        'Nominal Pengeluaran (Rp)',
      ],
    ];

    operationalExpenses.forEach((e, idx) => {
      sheetRows.push([
        idx + 1,
        e.expenseNumber,
        e.date,
        project.name,
        e.category,
        e.description || '-',
        e.picName || '-',
        e.paymentMethod || '-',
        e.attachments?.length || 0,
        e.amount,
      ]);
    });

    sheetRows.push([
      '',
      '',
      'GRAND TOTAL PENGELUARAN OPERASIONAL LAPANGAN',
      `${operationalExpenses.length} Transaksi`,
      '',
      '',
      '',
      '',
      '',
      operationalExpenses.reduce((s, e) => s + e.amount, 0),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 },
      { wch: 34 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'H4_Operasional_Lapangan');
    XLSX.writeFile(wb, `H4_Rekap_Operasional_Lapangan_${safeProjCode}_${dateSlug}.xlsx`);
    return;
  }

  if (submenu === 'h5') {
    const sheetRows: any[][] = [
      [COMPANY_NAME],
      ['H5. REKAP SELURUH PENGELUARAN & REALISASI ANGGARAN PROYEK'],
      [`Proyek: ${project.name} (${project.code})`, '', `Lokasi: ${project.location || '-'}`],
      [`Periode: ${periodText}`, '', `Dicetak: ${getPrintTimestamp()}`],
      [],
      ['No', 'Komponen Pengeluaran Proyek', 'Keterangan / Detail Realisasi', 'Nominal (Rp)'],
      [
        1,
        'Gaji Pokok Karyawan Proyek (Penuh & Setengah Hari)',
        `${summary.totalWorkDays} Hari Efektif (${summary.fullWorkDays} Penuh, ${summary.halfWorkDays} Setengah Hari)`,
        summary.totalBasicSalary,
      ],
      [
        2,
        'Upah Lembur Karyawan Proyek Disetujui',
        `Durasi: ${formatOvertimeDuration(summary.totalOvertimeHours)} (Driver = Rp 0)`,
        summary.totalOvertimePay,
      ],
      [
        '2a',
        'Subtotal Total Gaji Kotor Karyawan Proyek (1 + 2)',
        `Sudah Dibayar: ${formatRupiah(summary.paidPayrollTotal)} | Belum Dibayar/Terhitung: ${formatRupiah(
          summary.unpaidPayrollTotal
        )} | Pot. Kasbon: ${formatRupiah(summary.totalKasbonDeduction)} | Gaji Bersih: ${formatRupiah(summary.totalNetSalary)}`,
        summary.totalGrossSalary,
      ],
      [
        3,
        'Total Biaya Transportasi Proyek (H3)',
        `${transportExpenses.length} Transaksi Transportasi`,
        summary.totalTransport,
      ],
      [
        4,
        'Total Pengeluaran Operasional Lapangan (H4)',
        `${operationalExpenses.length} Transaksi Operasional Lapangan`,
        summary.totalOp,
      ],
      [],
      ['', 'TOTAL SELURUH PENGELUARAN PROYEK', 'Total Gaji Kotor + Transportasi + Operasional', summary.totalProjectCost],
      ['', 'NILAI ANGGARAN KONTRAK PROYEK', `Plafon Anggaran Proyek ${project.name}`, summary.budget],
      ['', 'SISA ANGGARAN PROYEK', 'Nilai Anggaran Proyek - Total Pengeluaran Proyek', summary.budgetRemaining],
      ['', 'PERSENTASE REALISASI ANGGARAN (%)', '(Total Pengeluaran / Nilai Anggaran) × 100%', `${summary.realizationPercentage}%`],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [{ wch: 6 }, { wch: 44 }, { wch: 56 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'H5_Seluruh_Pengeluaran');
    XLSX.writeFile(wb, `H5_Rekap_Seluruh_Pengeluaran_Proyek_${safeProjCode}_${dateSlug}.xlsx`);
  }
}
