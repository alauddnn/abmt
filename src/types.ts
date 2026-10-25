export type EmployeeRole = 'Mandor' | 'Tukang' | 'Helper' | 'Driver' | 'Kenek';

export interface CompanySettings {
  id: string;
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  ownerName: string;
  assistantName: string;
  workHourStart: string; // '08:00'
  workHourEnd: string;   // '16:00'
  wageMandorDaily: number;
  overtimeMandorHourly: number;
  wageTukangDaily: number;
  overtimeTukangHourly: number;
  wageHelperDaily: number;
  overtimeHelperHourly: number;
  wageDriverDaily: number;
  overtimeDriverHourly: number;
  wageKenekDaily?: number; // legacy alias
  overtimeKenekHourly?: number; // legacy alias
  minTenureDaysForKasbon: number;
}

export interface Employee {
  id: string;
  name: string;
  nik?: string;
  role: EmployeeRole;
  dailyWage: number;
  overtimeHourlyWage: number;
  startDate: string; // YYYY-MM-DD
  status: 'active' | 'inactive';
  phone?: string;
  notes?: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole | string;
  projectId?: string;
  projectName?: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Libur' | 'Tidak Hadir';
  checkIn: string;
  checkOut: string;
  overtimeHours: number;
  overtimeApproved: boolean;
  dailyWageSnapshot: number;
  overtimeWageSnapshot: number;
  totalDailyPay: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface OvertimeRecord {
  id: string;
  attendanceId?: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole | string;
  projectId?: string;
  projectName?: string;
  startTime: string;
  endTime: string;
  hours: number;
  hourlyRateSnapshot: number;
  totalPay: number;
  status: 'Menunggu persetujuan' | 'Disetujui' | 'Ditolak';
  approvedBy?: string;
  approvedAt?: string;
  notes: string;
  auditTrail: Array<{ timestamp: string; user: string; action: string }>;
}

export interface KasbonRecord {
  id: string;
  kasbonNumber: string;
  requestDate: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeStartDate: string;
  eligibilityDate: string;
  isEligible: boolean;
  eligibilityReason: string;
  amount: number;
  reason: string;
  status: 'Menunggu persetujuan' | 'Disetujui' | 'Ditolak' | 'Dipotong sebagian' | 'Lunas';
  deductedAmount: number;
  remainingAmount: number;
  targetPaymentPeriod?: string;
  adminNotes: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  projectId?: string;
  attachmentFilePath?: string;
  attachmentFileName?: string;
  attachmentFileSize?: number;
  attachmentMimeType?: string;
  attachments?: OperationalExpenseAttachment[];
  auditTrail: Array<{ timestamp: string; user: string; action: string }>;
}

export interface SalaryPayment {
  id: string;
  paymentNumber: string;
  periodStart: string;
  periodEnd: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  totalWorkDays: number;
  approvedOvertimeHours: number;
  totalBasicSalary: number;
  totalOvertimePay: number;
  grossSalary: number;
  kasbonDeduction: number;
  otherDeductions: number;
  netSalary: number;
  paymentDate: string;
  paymentMethod: 'Transfer BCA' | 'Transfer Mandiri' | 'Transfer BRI' | 'Kas Tunai';
  referenceNumber?: string;
  status: 'Belum dibayar' | 'Diproses' | 'Sudah dibayar' | 'Dibatalkan';
  notes?: string;
  processedBy: string;
  createdAt: string;
  auditTrail: Array<{ timestamp: string; user: string; action: string }>;
}

export interface OperationalExpenseAttachment {
  id: string;
  expenseId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy?: string;
  createdAt: string;
  viewUrl?: string;
  signedUrl?: string;
}

export interface OperationalExpense {
  id: string;
  transactionNumber: string;
  date: string;
  personType: 'Owner' | 'Asisten';
  personName: string;
  category: 'Bensin' | 'Rokok' | 'E-Toll' | 'Makan';
  description: string;
  amount: number;
  paymentMethod: 'Tunai' | 'Kartu Debit' | 'E-Money' | 'QRIS' | 'Transfer';
  receiptProof?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  attachments?: OperationalExpenseAttachment[];
}

export interface DashboardStats {
  periodInfo: {
    period: string;
    rangeStart: string;
    rangeEnd: string;
  };
  metrics: {
    totalGajiPokok: number;
    totalUpahLembur: number;
    totalKasbonBelumDipotong: number;
    totalBiayaOwner: number;
    totalBiayaAsisten: number;
    totalBensin: number;
    totalRokok: number;
    totalEToll: number;
    totalMakan: number;
    totalPengeluaranOperasional: number;
    totalGajiBersihDibayarkan: number;
    jumlahKaryawanAktif: number;
    totalHariKerja: number;
    ownerBreakdown: {
      bensin: number;
      rokok: number;
      eToll: number;
      makan: number;
      total: number;
    };
    asistenBreakdown: {
      bensin: number;
      rokok: number;
      eToll: number;
      makan: number;
      total: number;
    };
    totalKasbonDicairkanPeriode: number;
    totalKasKeluarRiil: number;
    totalGajiKotorAkrual: number;
    unpaidSalaryEstimate: number;
  };
  dailyTrend: Array<{
    date: string;
    gaji: number;
    lembur: number;
    owner: number;
    asisten: number;
    total: number;
  }>;
}

export type UserRole = 'admin' | 'owner' | 'Administrator' | 'Petugas';

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: 'admin' | 'owner' | 'Administrator' | 'Petugas';
  action: string;
  module: 'Karyawan' | 'Absensi' | 'Lembur' | 'Kasbon' | 'Gaji' | 'Operasional' | 'Pengaturan' | 'Sistem' | 'Proyek' | 'Pengguna';
  details: string;
}

export interface UserSession {
  id?: string;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'owner' | 'Administrator' | 'Petugas';
  token?: string;
}

export interface AppUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'owner';
  createdAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  location: string;
  client: string;
  startDate: string;
  targetEndDate: string;
  budget: number;
  status: 'Berjalan' | 'Selesai' | 'Persiapan';
  description?: string;
  createdAt?: string;
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  employeeId: string;
  roleInProject: string;
  assignedDate: string;
  status: 'active' | 'completed' | 'transferred' | 'inactive';
  notes?: string;
  createdAt?: string;
  employeeName?: string;
  employeeRole?: string;
  employeePhone?: string;
  employeeNik?: string;
  employeeStartDate?: string;
  employeeStatus?: 'active' | 'inactive';
  dailyWage?: number;
  overtimeHourlyWage?: number;
}

export interface ProjectExpense {
  id: string;
  transactionNumber: string;
  projectId: string;
  expenseType: 'transportasi' | 'operasional';
  date: string;
  category: string;
  transportType?: string;
  destination?: string;
  picName: string;
  description: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  attachments?: OperationalExpenseAttachment[];
}

export interface ProjectOverviewStats {
  project?: Project;
  totalAssignedEmployees: number;
  presentToday: number;
  absentToday: number;
  overtimeCount: number;
  totalKasbon: number;
  totalTransportationCost: number;
  totalOperationalCost: number;
  budget: number;
  budgetRemaining: number;
  realizationPercentage: number;
  // Aliases for compatibility
  totalPresentToday?: number;
  totalAbsentToday?: number;
  totalOvertimeEmployees?: number;
  totalTransportCost?: number;
  remainingBudget?: number;
}

