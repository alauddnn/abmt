import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Project, ProjectExpense } from '../types';
import { formatRupiah, formatDateID, formatOvertimeDuration, terbilangRupiah, isDriverRole } from './utils';
import {
  KOP_COMPANY_NAME,
  KOP_TAGLINE,
  KOP_ADDRESS,
  KOP_CONTACT,
  KOP_LOGO_DATA_URL,
} from './kopSuratLogo';

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

const COMPANY_NAME = KOP_COMPANY_NAME;

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

/**
 * Draws the official PT ASTABRATA MATAHARI TERBIT Kop Surat (Letterhead)
 * matching the reference PDF on the current page.
 */
export function drawOfficialKopSurat(doc: jsPDF, margin = 12): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Left Company Logo (24.5mm x 24.5mm positioned cleanly on A4 Portrait)
  const logoSize = 24.5;
  const logoX = margin + 1.5;
  const logoY = 6;
  try {
    doc.addImage(KOP_LOGO_DATA_URL, 'PNG', logoX, logoY, logoSize, logoSize);
  } catch {
    // Fallback if image rendering fails
  }

  // 2. Centered Identity Text Block (centered in the header space to the right of the logo)
  const textAreaLeft = margin + logoSize + 3;
  const textAreaWidth = pageWidth - margin - textAreaLeft;
  const textCenterX = textAreaLeft + textAreaWidth / 2;

  // Company Name (Bold Navy Blue #0B3070)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(11, 48, 112);
  doc.text(KOP_COMPANY_NAME, textCenterX, 13.2, { align: 'center' });

  // Tagline (Bold Gold #BE870F)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(190, 135, 15);
  doc.text(KOP_TAGLINE, textCenterX, 18.2, { align: 'center' });

  // Address (Regular Dark Gray #323232)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(KOP_ADDRESS, textCenterX, 22.8, { align: 'center' });

  // Contact Phone & Email (Regular Dark Gray #323232)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(KOP_CONTACT, textCenterX, 27, { align: 'center' });

  // 3. Double Horizontal Divider Line (Thick Navy top + Thin Gold bottom) across full 186mm printable width
  doc.setFillColor(11, 48, 112);
  doc.rect(margin, 32, pageWidth - margin * 2, 0.65, 'F');

  doc.setFillColor(221, 170, 34);
  doc.rect(margin, 33.25, pageWidth - margin * 2, 0.25, 'F');

  return 37.5;
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

  // Draw Official Kop Surat at top
  drawOfficialKopSurat(doc, margin);

  // Report Title & Print Timestamp Row (sized for A4 Portrait 186mm width without collision)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(11, 48, 112);
  const cleanTitle =
    reportTitle.length > 64 ? `${reportTitle.slice(0, 62).trim()}...` : reportTitle;
  doc.text(cleanTitle.toUpperCase(), margin, 39.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(102, 112, 133);
  const docCode = `${project.code}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  doc.text(
    `Dicetak: ${getPrintTimestamp()} | Kode: ${docCode}`,
    pageWidth - margin,
    39.2,
    { align: 'right' }
  );

  // Project Metadata Box (186mm width on A4 Portrait)
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(224, 228, 235);
  doc.roundedRect(margin, 41.4, pageWidth - margin * 2, 13.2, 1.6, 1.6, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(52, 64, 84);
  doc.setFont('helvetica', 'bold');
  doc.text(`Proyek: ${project.name} (${project.code})`, margin + 3, 46.3);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lokasi: ${project.location || '-'}`, margin + 3, 51.6);

  const midX = pageWidth / 2 + 2;
  doc.setFont('helvetica', 'bold');
  doc.text(`Periode: ${getPeriodLabel(startDate, endDate)}`, midX, 46.3);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Status Proyek: ${project.status}${extraFilterLabel ? ` | Filter: ${extraFilterLabel}` : ''}`,
    midX,
    51.6
  );

  return 57.8;
}

function applyColumnAlignmentToAllSections(columnStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }>) {
  return (data: any) => {
    const colStyle = columnStyles[data.column.index];
    if (colStyle && colStyle.halign) {
      data.cell.styles.halign = colStyle.halign;
    }
  };
}

function addPageFootersAndSignatures(
  doc: jsPDF,
  project: Project,
  includeSignatures = true,
  customMargin = 12
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = customMargin;

  if (includeSignatures) {
    const lastAutoTable = (doc as any).lastAutoTable;
    let finalY = lastAutoTable ? lastAutoTable.finalY + 9 : 140;
    if (finalY + 30 > pageHeight - 14) {
      doc.addPage();
      finalY = 44;
    }

    const leftCenterX = margin + 38;
    const rightCenterX = pageWidth - margin - 38;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(52, 64, 84);

    // Left signature column (Centered, single clean placeholder without extra line above)
    doc.text('Disiapkan Oleh,', leftCenterX, finalY, { align: 'center' });
    doc.text('Admin Proyek / Keuangan', leftCenterX, finalY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 41, 57);
    doc.text('( ............................................ )', leftCenterX, finalY + 23, {
      align: 'center',
    });

    // Right signature column (Centered, single clean placeholder without extra line above)
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(52, 64, 84);
    doc.text(
      `${project.location || 'Serang'}, ${formatDateID(new Date().toISOString().split('T')[0])}`,
      rightCenterX,
      finalY,
      { align: 'center' }
    );
    doc.text('Disetujui Oleh, Pimpinan / Owner', rightCenterX, finalY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 41, 57);
    doc.text('( ............................................ )', rightCenterX, finalY + 23, {
      align: 'center',
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Ensure Official Kop Surat appears on EVERY A4 page
    drawOfficialKopSurat(doc, margin);

    // Footer divider line
    doc.setDrawColor(208, 213, 221);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(102, 112, 133);
    doc.text(
      `${KOP_COMPANY_NAME} — Proyek ${project.name} (${project.code})`,
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
// 1. EXPORT PDF FOR SUBMENUS H1, H2, H3, H4, H5 (ALL STANDARDIZED TO A4 PORTRAIT)
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

  // All documents standardized to A4 Portrait (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const printableWidth = pageWidth - margin * 2; // 186mm
  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeProjCode = (project.code || project.name).replace(/[^a-zA-Z0-9_-]/g, '_');

  if (submenu === 'h1') {
    const targetList = selectedEmployee ? [selectedEmployee] : employeeRecaps;
    const title = selectedEmployee
      ? `H1. Rekap Gaji & Kehadiran Karyawan — ${selectedEmployee.employeeName}`
      : `H1. Laporan Rekap Gaji Per Karyawan Proyek (Detail Kehadiran & Upah)`;

    let currentY = drawDocumentHeader(
      doc,
      title,
      project,
      startDate,
      endDate,
      roleFilter && roleFilter !== 'ALL' ? `Jabatan: ${roleFilter}` : undefined
    );

    const h1Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'left' },
      3: { cellWidth: 19, halign: 'center' },
      4: { cellWidth: 21, halign: 'right' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 21, halign: 'right' },
      7: { cellWidth: 21, halign: 'right' },
      8: { cellWidth: 22, halign: 'right' },
      9: { cellWidth: 23, halign: 'left' },
    };

    targetList.forEach((emp, idx) => {
      if (idx > 0) {
        const lastY = (doc as any).lastAutoTable?.finalY || currentY;
        if (lastY + 55 > doc.internal.pageSize.getHeight() - 18) {
          doc.addPage();
          currentY = drawDocumentHeader(doc, title, project, startDate, endDate);
        } else {
          currentY = lastY + 6.5;
        }
      }

      // Employee Summary Strip (3 structured rows inside 186mm A4 Portrait box so text never overlaps)
      doc.setFillColor(239, 245, 255);
      doc.setDrawColor(208, 226, 255);
      doc.roundedRect(margin, currentY, printableWidth, 17.5, 1.5, 1.5, 'FD');

      // Row 1: Employee Name & Role (Left) + Net Salary (Right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(11, 48, 112);
      doc.text(
        `${idx + 1}. ${emp.employeeName} (${emp.employeeId}) — Jabatan: ${emp.role} ${
          emp.status === 'inactive' ? '[Nonaktif]' : '[Aktif]'
        }`,
        margin + 3,
        currentY + 4.6
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.setTextColor(21, 94, 239);
      doc.text(
        `Gaji Bersih: ${formatRupiah(emp.netSalary)}`,
        pageWidth - margin - 3,
        currentY + 4.6,
        { align: 'right' }
      );

      // Row 2: Daily Rate, Overtime Rate & Attendance Days Breakdown
      const isDriver = isDriverRole(emp.role);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      doc.setTextColor(52, 64, 84);
      doc.text(
        `Tarif/Hr: ${formatRupiah(emp.dailyWage)}  |  Tarif Lembur/Jam: ${
          isDriver ? 'Rp 0 (Driver)' : formatRupiah(emp.overtimeHourlyWage)
        }  |  Hadir Penuh: ${emp.fullWorkDays} hr  |  Setengah Hari: ${emp.halfWorkDays} hr  |  Absen: ${emp.absentDays} hr`,
        margin + 3,
        currentY + 9.8
      );

      // Row 3: Financial Breakdown (Pokok, Lembur, Kotor, Potongan Kasbon, Sisa Kasbon)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      doc.setTextColor(71, 84, 103);
      doc.text(
        `Gaji Pokok: ${formatRupiah(emp.totalBasicSalary)}  |  Lembur (${formatOvertimeDuration(
          emp.overtimeHours
        )}): ${formatRupiah(emp.totalOvertimePay)}  |  Kotor: ${formatRupiah(
          emp.grossSalary
        )}  |  Pot. Kasbon: -${formatRupiah(emp.kasbonDeduction)} (Sisa: ${formatRupiah(
          emp.remainingKasbon
        )})`,
        margin + 3,
        currentY + 14.8
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
            kbNominal > 0 ? formatRupiah(kbNominal) : '-',
            formatRupiah(basicDay + otPayDay),
            att.notes || '-',
          ];
        });

      // Proportional column widths summing to 186mm on A4 Portrait
      autoTable(doc, {
        startY: currentY + 19,
        margin: { top: 38, bottom: 14, left: margin, right: margin },
        tableWidth: printableWidth,
        showHead: 'everyPage',
        head: [
          [
            'No',
            'Tanggal',
            'Status',
            'Jam Kerja',
            'Upah Harian',
            'Durasi OT',
            'Upah Lembur',
            'Kasbon',
            'Total Harian',
            'Catatan',
          ],
        ],
        body:
          attRows.length > 0
            ? attRows
            : [['-', '-', 'Belum ada kehadiran', '-', 'Rp 0', '-', 'Rp 0', '-', 'Rp 0', '-']],
        foot: [
          [
            '',
            'SUBTOTAL',
            `${emp.fullWorkDays}P, ${emp.halfWorkDays}S`,
            `${emp.totalWorkDays} Hr`,
            formatRupiah(emp.totalBasicSalary),
            formatOvertimeDuration(emp.overtimeHours),
            formatRupiah(emp.totalOvertimePay),
            `-${formatRupiah(emp.kasbonDeduction)}`,
            formatRupiah(emp.netSalary),
            `Sisa KB: ${formatRupiah(emp.remainingKasbon)}`,
          ],
        ],
        showFoot: 'lastPage',
        styles: {
          fontSize: 7.2,
          cellPadding: 1.5,
          textColor: [29, 41, 57],
          valign: 'middle',
          lineWidth: 0.12,
          lineColor: [226, 232, 240],
        },
        headStyles: { fillColor: [11, 48, 112], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2 },
        footStyles: { fillColor: [239, 245, 255], textColor: [11, 48, 112], fontStyle: 'bold', fontSize: 7.1 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: h1Cols,
        didParseCell: applyColumnAlignmentToAllSections(h1Cols),
      });
    });

    addPageFootersAndSignatures(doc, project, true, margin);
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
      `${r.employeeName}\n(${r.employeeId})`,
      r.role,
      `${r.fullWorkDays}P / ${r.halfWorkDays}S / ${r.absentDays}A`,
      formatRupiah(r.dailyWage),
      formatRupiah(r.totalBasicSalary),
      r.overtimeHours > 0
        ? `${formatOvertimeDuration(r.overtimeHours)}\n(${isDriverRole(r.role) ? 'Rp 0' : formatRupiah(r.overtimeHourlyWage)})`
        : '-',
      formatRupiah(r.totalOvertimePay),
      formatRupiah(r.grossSalary),
      r.kasbonDeduction > 0 || r.remainingKasbon > 0
        ? `-${formatRupiah(r.kasbonDeduction)}\n(Sisa: ${formatRupiah(r.remainingKasbon)})`
        : 'Rp 0',
      formatRupiah(r.netSalary),
    ]);

    const totFull = employeeRecaps.reduce((s, r) => s + r.fullWorkDays, 0);
    const totHalf = employeeRecaps.reduce((s, r) => s + r.halfWorkDays, 0);
    const totAbs = employeeRecaps.reduce((s, r) => s + r.absentDays, 0);
    const totBasic = employeeRecaps.reduce((s, r) => s + r.totalBasicSalary, 0);
    const totOtHours = employeeRecaps.reduce((s, r) => s + r.overtimeHours, 0);
    const totOtPay = employeeRecaps.reduce((s, r) => s + r.totalOvertimePay, 0);
    const totGross = employeeRecaps.reduce((s, r) => s + r.grossSalary, 0);
    const totKbDed = employeeRecaps.reduce((s, r) => s + r.kasbonDeduction, 0);
    const totKbRem = employeeRecaps.reduce((s, r) => s + r.remainingKasbon, 0);
    const totNet = employeeRecaps.reduce((s, r) => s + r.netSalary, 0);

    const h2Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 28, halign: 'left' },
      2: { cellWidth: 13, halign: 'left' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 18, halign: 'right' },
      9: { cellWidth: 18, halign: 'right' },
      10: { cellWidth: 20, halign: 'right' },
    };

    // Proportional column widths summing to 186mm on A4 Portrait
    autoTable(doc, {
      startY,
      margin: { top: 38, bottom: 14, left: margin, right: margin },
      tableWidth: printableWidth,
      showHead: 'everyPage',
      head: [
        [
          'No',
          'Nama & ID Karyawan',
          'Jabatan',
          'Hadir (P/S/A)',
          'Tarif/Hr',
          'Gaji Pokok',
          'Durasi & Tarif OT',
          'Upah Lembur',
          'Gaji Kotor',
          'Pot. & Sisa Kasbon',
          'Gaji Bersih',
        ],
      ],
      body: rows,
      foot: [
        [
          '',
          `GRAND TOTAL (${employeeRecaps.length} Karyawan)`,
          '',
          `${totFull}P/${totHalf}S/${totAbs}A`,
          '-',
          formatRupiah(totBasic),
          formatOvertimeDuration(totOtHours),
          formatRupiah(totOtPay),
          formatRupiah(totGross),
          `-${formatRupiah(totKbDed)}\n(Sisa: ${formatRupiah(totKbRem)})`,
          formatRupiah(totNet),
        ],
      ],
      showFoot: 'lastPage',
      styles: {
        fontSize: 7.1,
        cellPadding: 1.5,
        textColor: [29, 41, 57],
        valign: 'middle',
        lineWidth: 0.12,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: [11, 48, 112], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.1 },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold', fontSize: 7.1 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: h2Cols,
      didParseCell: applyColumnAlignmentToAllSections(h2Cols),
    });

    addPageFootersAndSignatures(doc, project, true, margin);
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
      e.expenseNumber || e.transactionNumber || '-',
      formatDateID(e.date),
      e.category,
      e.vehicleOrDriver || e.transportType || '-',
      e.destinationOrRoute || e.destination || '-',
      e.picName || '-',
      e.description || '-',
      `${e.paymentMethod || '-'}\n(${e.attachments && e.attachments.length > 0 ? `${e.attachments.length} Foto` : 'Tanpa Foto'})`,
      formatRupiah(e.amount),
    ]);

    const totalAmount = transportExpenses.reduce((s, e) => s + e.amount, 0);

    const h3Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 21, halign: 'left' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 20, halign: 'left' },
      4: { cellWidth: 22, halign: 'left' },
      5: { cellWidth: 24, halign: 'left' },
      6: { cellWidth: 16, halign: 'left' },
      7: { cellWidth: 24, halign: 'left' },
      8: { cellWidth: 14, halign: 'center' },
      9: { cellWidth: 20, halign: 'right' },
    };

    // Proportional column widths summing to 186mm on A4 Portrait
    autoTable(doc, {
      startY,
      margin: { top: 38, bottom: 14, left: margin, right: margin },
      tableWidth: printableWidth,
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
          'Metode/Bukti',
          'Nominal',
        ],
      ],
      body:
        rows.length > 0
          ? rows
          : [['-', '-', '-', 'Tidak ada data biaya transportasi pada periode ini', '-', '-', '-', '-', '-', 'Rp 0']],
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
          formatRupiah(totalAmount),
        ],
      ],
      showFoot: 'lastPage',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.6,
        textColor: [29, 41, 57],
        valign: 'middle',
        lineWidth: 0.12,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: [11, 48, 112], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2 },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold', fontSize: 7.3 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: h3Cols,
      didParseCell: applyColumnAlignmentToAllSections(h3Cols),
    });

    addPageFootersAndSignatures(doc, project, true, margin);
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
      e.expenseNumber || e.transactionNumber || '-',
      formatDateID(e.date),
      e.category,
      e.description || '-',
      e.picName || '-',
      e.paymentMethod || '-',
      e.attachments && e.attachments.length > 0 ? `${e.attachments.length} Foto` : 'Tanpa Foto',
      formatRupiah(e.amount),
    ]);

    const totalAmount = operationalExpenses.reduce((s, e) => s + e.amount, 0);

    const h4Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 22, halign: 'left' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 24, halign: 'left' },
      4: { cellWidth: 43, halign: 'left' },
      5: { cellWidth: 22, halign: 'left' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 13, halign: 'center' },
      8: { cellWidth: 20, halign: 'right' },
    };

    // Proportional column widths summing to 186mm on A4 Portrait
    autoTable(doc, {
      startY,
      margin: { top: 38, bottom: 14, left: margin, right: margin },
      tableWidth: printableWidth,
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
          'TOTAL OPERASIONAL LAPANGAN',
          `${operationalExpenses.length} Transaksi`,
          '',
          '',
          '',
          '',
          formatRupiah(totalAmount),
        ],
      ],
      showFoot: 'lastPage',
      styles: {
        fontSize: 7.4,
        cellPadding: 1.8,
        textColor: [29, 41, 57],
        valign: 'middle',
        lineWidth: 0.12,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: [11, 48, 112], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4 },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: h4Cols,
      didParseCell: applyColumnAlignmentToAllSections(h4Cols),
    });

    addPageFootersAndSignatures(doc, project, true, margin);
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

    const h5Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 62, halign: 'left' },
      2: { cellWidth: 78, halign: 'left' },
      3: { cellWidth: 36, halign: 'right' },
    };

    // Proportional column widths summing to 186mm on A4 Portrait
    autoTable(doc, {
      startY,
      margin: { top: 38, bottom: 14, left: margin, right: margin },
      tableWidth: printableWidth,
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
      styles: {
        fontSize: 8.2,
        cellPadding: 2.5,
        textColor: [29, 41, 57],
        valign: 'middle',
        lineWidth: 0.12,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: [11, 48, 112], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.2 },
      footStyles: { fillColor: [239, 245, 255], textColor: [21, 94, 239], fontStyle: 'bold', fontSize: 8.2 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: h5Cols,
      didParseCell: applyColumnAlignmentToAllSections(h5Cols),
    });

    addPageFootersAndSignatures(doc, project, true, margin);
    doc.save(`H5_Rekap_Seluruh_Pengeluaran_Proyek_${safeProjCode}_${dateSlug}.pdf`);
  }
}

// ============================================================================
// 2. EXPORT SLIP GAJI KARYAWAN PROYEK PDF (SINGLE OR MULTI-EMPLOYEE, A4 PORTRAIT)
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

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 12;
  const printableWidth = pageWidth - margin * 2; // 186mm
  const dateSlug = new Date().toISOString().slice(0, 10);
  const safeProjCode = (project.code || project.name).replace(/[^a-zA-Z0-9_-]/g, '_');

  const slipTable1Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: 68, halign: 'left' },
    1: { cellWidth: 80, halign: 'left' },
    2: { cellWidth: 38, halign: 'right' },
  };

  const slipTable2Cols: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 23, halign: 'center' },
    2: { cellWidth: 20, halign: 'left' },
    3: { cellWidth: 19, halign: 'center' },
    4: { cellWidth: 24, halign: 'right' },
    5: { cellWidth: 20, halign: 'center' },
    6: { cellWidth: 23, halign: 'right' },
    7: { cellWidth: 24, halign: 'right' },
    8: { cellWidth: 25, halign: 'right' },
  };

  employees.forEach((emp, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const isDriver = isDriverRole(emp.role);

    // Draw Official Kop Surat at top of Slip Gaji
    drawOfficialKopSurat(doc, margin);

    // Slip Title & Print Timestamp Row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 48, 112);
    doc.text('SLIP GAJI & REKAP KEHADIRAN KARYAWAN PROYEK', margin, 39.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(102, 112, 133);
    doc.text(`Tanggal Cetak: ${getPrintTimestamp()}`, pageWidth - margin, 39.2, { align: 'right' });

    // Identity Box (186mm width)
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(234, 236, 240);
    doc.roundedRect(margin, 41.6, printableWidth, 23, 2, 2, 'FD');

    doc.setFontSize(8.2);
    doc.setTextColor(52, 64, 84);

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Karyawan', margin + 4, 47.2);
    doc.text('ID Karyawan', margin + 4, 52.4);
    doc.text('Jabatan / Peran', margin + 4, 57.6);
    doc.text('Status Penugasan', margin + 4, 62.6);

    doc.setFont('helvetica', 'normal');
    doc.text(`: ${emp.employeeName}`, margin + 35, 47.2);
    doc.text(`: ${emp.employeeId}`, margin + 35, 52.4);
    doc.text(`: ${emp.role}${isDriver ? ' (Tanpa Upah Lembur)' : ''}`, margin + 35, 57.6);
    doc.text(`: ${emp.status === 'active' ? 'Aktif di Proyek' : 'Nonaktif (Riwayat Periode)'}`, margin + 35, 62.6);

    // Right column
    const rightColX = pageWidth / 2 + 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Nama Proyek', rightColX, 47.2);
    doc.text('Kode & Lokasi', rightColX, 52.4);
    doc.text('Periode Gaji', rightColX, 57.6);
    doc.text('Status Pembayaran', rightColX, 62.6);

    doc.setFont('helvetica', 'normal');
    doc.text(`: ${project.name}`, rightColX + 31, 47.2);
    doc.text(`: ${project.code} — ${project.location || '-'}`, rightColX + 31, 52.4);
    doc.text(`: ${getPeriodLabel(startDate, endDate)}`, rightColX + 31, 57.6);
    doc.text(`: ${emp.paymentStatusLabel}`, rightColX + 31, 62.6);

    // Table 1: Rincian Penerimaan & Potongan Gaji (total 186mm)
    autoTable(doc, {
      startY: 68,
      margin: { top: 38, bottom: 14, left: margin, right: margin },
      tableWidth: printableWidth,
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
      styles: {
        fontSize: 8.1,
        cellPadding: 2,
        textColor: [29, 41, 57],
        valign: 'middle',
        lineWidth: 0.12,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: [11, 48, 112], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.1 },
      footStyles: { fillColor: [236, 253, 243], textColor: [2, 122, 72], fontStyle: 'bold', fontSize: 8.6 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: slipTable1Cols,
      didParseCell: applyColumnAlignmentToAllSections(slipTable1Cols),
    });

    // Table 2: Ringkasan Kehadiran Harian Karyawan (total 186mm)
    const afterSummaryY = ((doc as any).lastAutoTable?.finalY || 145) + 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(11, 48, 112);
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
      margin: { top: 38, bottom: 14, left: margin, right: margin },
      tableWidth: printableWidth,
      head: [['No', 'Tanggal', 'Status', 'Jam', 'Upah Pokok', 'Lembur', 'Upah OT', 'Kasbon', 'Total Harian']],
      body:
        attRows.length > 0
          ? attRows
          : [['-', '-', 'Tidak ada rincian absensi harian pada periode ini', '-', 'Rp 0', '-', 'Rp 0', '-', 'Rp 0']],
      styles: {
        fontSize: 7.3,
        cellPadding: 1.5,
        textColor: [52, 64, 84],
        valign: 'middle',
        lineWidth: 0.12,
        lineColor: [226, 232, 240],
      },
      headStyles: { fillColor: [52, 64, 84], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.3 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: slipTable2Cols,
      didParseCell: applyColumnAlignmentToAllSections(slipTable2Cols),
    });

    // Signature block for Slip Gaji (Centered per column, no duplicate horizontal line above)
    let sigY = ((doc as any).lastAutoTable?.finalY || 225) + 9;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (sigY + 30 > pageHeight - 14) {
      doc.addPage();
      sigY = 44;
    }

    const leftSigX = margin + 38;
    const rightSigX = pageWidth - margin - 38;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(52, 64, 84);
    doc.text('Penerima Upah / Karyawan,', leftSigX, sigY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 41, 57);
    doc.text(`( ${emp.employeeName} )`, leftSigX, sigY + 23, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(52, 64, 84);
    doc.text(
      `${project.location || 'Serang'}, ${formatDateID(new Date().toISOString().split('T')[0])}`,
      rightSigX,
      sigY,
      { align: 'center' }
    );
    doc.text('Bagian Keuangan / Admin Proyek,', rightSigX, sigY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 41, 57);
    doc.text('( ............................................ )', rightSigX, sigY + 23, {
      align: 'center',
    });
  });

  addPageFootersAndSignatures(doc, project, false, margin);

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
