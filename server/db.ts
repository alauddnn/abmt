import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  wageKenekDaily?: number;        // legacy alias
  overtimeKenekHourly?: number;   // legacy alias
  minTenureDaysForKasbon: number;
}

export interface Employee {
  id: string;
  name: string;
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
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole | string;
  projectId?: string;
  projectName?: string;
  status: 'Hadir' | 'Setengah Hari' | 'Izin' | 'Sakit' | 'Libur' | 'Tidak Hadir';
  checkIn: string; // '08:00'
  checkOut: string; // '16:00'
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
  kasbonId?: string;
  kasbonNumber?: string;
  kasbonAmount?: number;
  kasbonNotes?: string;
  kasbonStatus?: string;
  kasbonAttachmentFilePath?: string;
  kasbonAttachments?: OperationalExpenseAttachment[];
}

export interface OvertimeRecord {
  id: string;
  attendanceId?: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole | string;
  startTime: string;
  endTime: string;
  hours: number;
  durationHours?: number;
  durationMinutes?: number;
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
  kasbonNumber: string; // KB-202610-001
  attendanceId?: string;
  requestDate: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeStartDate: string;
  eligibilityDate: string; // 7 days after employeeStartDate
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

export interface KasbonDeduction {
  id: string;
  kasbonId: string;
  salaryPaymentId: string;
  date: string;
  employeeId: string;
  amount: number;
  note: string;
}

export interface SalaryPayment {
  id: string;
  paymentNumber: string; // PAY-202610-001
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  totalWorkDays: number;
  fullWorkDays?: number;
  halfWorkDays?: number;
  approvedOvertimeHours: number;
  totalBasicSalary: number;
  fullDaySalary?: number;
  halfDaySalary?: number;
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
  transactionNumber: string; // EXP-202610-001
  date: string; // YYYY-MM-DD
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

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: 'admin' | 'owner' | 'Administrator' | 'Petugas';
  action: string;
  module: 'Karyawan' | 'Absensi' | 'Lembur' | 'Kasbon' | 'Gaji' | 'Operasional' | 'Pengaturan' | 'Sistem' | 'Proyek' | 'Pengguna';
  details: string;
}

export interface AppUser {
  id: string;
  username: string; // e.g. "admin", "owner"
  email: string;    // e.g. "admin@astabrata.com", "owner@astabrata.com"
  name: string;     // e.g. "Administrator Proyek", "Bpk. Ir. H. Bambang Prakoso"
  role: 'admin' | 'owner';
  passwordHash: string;
  salt: string;
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
  createdAt: string;
}

export interface DatabaseSchema {
  settings: CompanySettings;
  employees: Employee[];
  attendance: Attendance[];
  overtime: OvertimeRecord[];
  kasbon: KasbonRecord[];
  kasbonDeductions: KasbonDeduction[];
  salaryPayments: SalaryPayment[];
  operationalExpenses: OperationalExpense[];
  operationalExpenseAttachments: OperationalExpenseAttachment[];
  auditLogs: AuditLog[];
  users: AppUser[];
  projects: Project[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'kontraktor.json');
const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');

// --- PASSWORD & SECURITY UTILITIES ---
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const computed = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

// Fixed salts for default seed accounts
const ADMIN_SALT = 'e5a1b3c7d9f2468013579bdf02468ace';
const OWNER_SALT = 'f2468ace02468ace13579bdfa1b3c7d9';

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'USR-ADMIN-01',
    username: 'admin',
    email: 'admin@astabrata.com',
    name: 'Administrator Proyek',
    role: 'admin',
    salt: ADMIN_SALT,
    passwordHash: hashPassword('admin123', ADMIN_SALT),
    createdAt: '2026-10-19T00:00:00.000Z',
  },
  {
    id: 'USR-OWNER-01',
    username: 'owner',
    email: 'owner@astabrata.com',
    name: 'Bpk. Ir. H. Bambang Prakoso (Owner)',
    role: 'owner',
    salt: OWNER_SALT,
    passwordHash: hashPassword('owner123', OWNER_SALT),
    createdAt: '2026-10-19T00:00:00.000Z',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'PRJ-2026-001',
    code: 'PRJ-MA-01',
    name: 'Renovasi Gedung Perkantoran Menara Astra',
    location: 'Jl. Jend. Sudirman Kav. 5-6, Jakarta Pusat',
    client: 'PT Mega Graha Properti',
    startDate: '2026-09-01',
    targetEndDate: '2026-12-15',
    budget: 450000000,
    status: 'Berjalan',
    description: 'Pekerjaan renovasi arsitektural dan partisi kantor lantai 12-14',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'PRJ-2026-002',
    code: 'PRJ-BSD-02',
    name: 'Pembangunan Rumah Tinggal & Kolam Renang BSD',
    location: 'Cluster De Park Blok A3 No. 8, BSD City, Tangerang',
    client: 'Bpk. Hendra Wijaya',
    startDate: '2026-09-15',
    targetEndDate: '2027-02-28',
    budget: 320000000,
    status: 'Berjalan',
    description: 'Struktur pondasi, pembesian sloof, pasangan bata hebel, dan instalasi mekanikal',
    createdAt: '2026-09-15T08:00:00.000Z',
  },
  {
    id: 'PRJ-2026-003',
    code: 'PRJ-GI-03',
    name: 'Interior Fit-Out & Finishing Butik Grand Indonesia',
    location: 'West Mall Lt. 2, Grand Indonesia, Jakarta Pusat',
    client: 'PT Moda Prima Nusantara',
    startDate: '2026-08-01',
    targetEndDate: '2026-10-05',
    budget: 180000000,
    status: 'Selesai',
    description: 'Pemasangan lantai granit, gypsum plafon, dan lighting track aesthetic',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
];

export const DEFAULT_SETTINGS: CompanySettings = {
  id: 'default',
  companyName: 'PT. ASTA BRATA MATAHARI TERBIT',
  tagline: 'General Contractor & Interior Specialist',
  address: 'Jl. Konstruksi Mandiri No. 88, Jakarta Selatan',
  phone: '0812-8899-7722',
  ownerName: 'Bpk. Ir. H. Bambang Prakoso',
  assistantName: 'Ahmad Fauzi',
  workHourStart: '08:00',
  workHourEnd: '16:00',
  wageMandorDaily: 200000,
  overtimeMandorHourly: 25000,
  wageTukangDaily: 150000,
  overtimeTukangHourly: 20000,
  wageHelperDaily: 125000,
  overtimeHelperHourly: 15000,
  wageDriverDaily: 140000,
  overtimeDriverHourly: 18000,
  wageKenekDaily: 125000,
  overtimeKenekHourly: 15000,
  minTenureDaysForKasbon: 7,
};

// Default clean employees list (starts empty as requested)
export const INITIAL_EMPLOYEES: Employee[] = [];

export interface SessionData {
  token: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'owner';
  createdAt: string;
  expiresAt: string;
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();

  constructor() {
    this.loadSessions();
  }

  private loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const list: SessionData[] = JSON.parse(raw);
        const now = Date.now();
        list.forEach((s) => {
          if (new Date(s.expiresAt).getTime() > now) {
            this.sessions.set(s.token, s);
          }
        });
      }
    } catch (err) {
      console.warn('Failed to load sessions from file:', err);
    }
  }

  private saveSessions() {
    try {
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to persist sessions:', err);
    }
  }

  public createSession(user: AppUser): SessionData {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    // 30 days session expiry
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const session: SessionData = {
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: now.toISOString(),
      expiresAt,
    };

    this.sessions.set(token, session);
    this.saveSessions();
    return session;
  }

  public getSession(token: string): SessionData | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    return session;
  }

  public destroySession(token: string): boolean {
    const deleted = this.sessions.delete(token);
    if (deleted) this.saveSessions();
    return deleted;
  }
}

export const sessionManager = new SessionManager();

class DatabaseManager {
  private memoryDb: DatabaseSchema;

  constructor() {
    this.ensureDataDir();
    this.memoryDb = this.loadFromFile();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadFromFile(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        // Ensure users exist and password hashes are secure
        let users: AppUser[] = parsed.users || [];
        if (!users.length) {
          users = [...INITIAL_USERS];
        } else {
          // Verify that default admin & owner accounts exist
          const hasAdmin = users.some((u) => u.username.toLowerCase() === 'admin');
          const hasOwner = users.some((u) => u.username.toLowerCase() === 'owner');
          if (!hasAdmin) users.unshift(INITIAL_USERS[0]);
          if (!hasOwner) users.push(INITIAL_USERS[1]);
        }

        // Ensure projects exist
        const projects: Project[] = parsed.projects?.length ? parsed.projects : [...INITIAL_PROJECTS];

        return {
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          employees: Array.isArray(parsed.employees) ? parsed.employees : [],
          attendance: parsed.attendance || [],
          overtime: parsed.overtime || [],
          kasbon: parsed.kasbon || [],
          kasbonDeductions: parsed.kasbonDeductions || [],
          salaryPayments: parsed.salaryPayments || [],
          operationalExpenses: parsed.operationalExpenses || [],
          operationalExpenseAttachments: parsed.operationalExpenseAttachments || [],
          auditLogs: parsed.auditLogs || [],
          users,
          projects,
        };
      } catch (err) {
        console.error('Error reading database file, initializing clean database:', err);
      }
    }

    const initialDb: DatabaseSchema = {
      settings: DEFAULT_SETTINGS,
      employees: [...INITIAL_EMPLOYEES],
      attendance: [],
      overtime: [],
      kasbon: [],
      kasbonDeductions: [],
      salaryPayments: [],
      operationalExpenses: [],
      operationalExpenseAttachments: [],
      auditLogs: [
        {
          id: 'log-init',
          timestamp: new Date().toISOString(),
          userName: 'Sistem',
          userRole: 'admin',
          action: 'Inisialisasi Database',
          module: 'Sistem',
          details: 'Sistem Operasional PT. ASTA BRATA MATAHARI TERBIT berhasil diinisialisasi dengan role Admin & Owner',
        },
      ],
      users: [...INITIAL_USERS],
      projects: [...INITIAL_PROJECTS],
    };

    this.saveToFile(initialDb);
    return initialDb;
  }

  private saveToFile(db: DatabaseSchema) {
    try {
      this.ensureDataDir();
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  public getDb(): DatabaseSchema {
    return this.memoryDb;
  }

  public mutate<T>(mutator: (db: DatabaseSchema) => T): T {
    const result = mutator(this.memoryDb);
    this.saveToFile(this.memoryDb);
    return result;
  }

  public addAuditLog(
    userName: string,
    userRole: 'admin' | 'owner' | 'Administrator' | 'Petugas',
    action: string,
    module: AuditLog['module'],
    details: string
  ) {
    this.mutate((db) => {
      // Normalize role label
      const normalizedRole = userRole.toLowerCase().includes('admin') ? 'admin' : 'owner';
      db.auditLogs.unshift({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        userName,
        userRole: normalizedRole,
        action,
        module,
        details,
      });
      // Keep last 1000 logs
      if (db.auditLogs.length > 1000) {
        db.auditLogs = db.auditLogs.slice(0, 1000);
      }
    });
  }

  public resetToClean(keepSettings = true) {
    return this.mutate((db) => {
      const savedSettings = keepSettings ? db.settings : DEFAULT_SETTINGS;
      const savedUsers = db.users?.length ? db.users : [...INITIAL_USERS];
      const savedProjects = db.projects?.length ? db.projects : [...INITIAL_PROJECTS];

      db.settings = savedSettings;
      db.employees = [...INITIAL_EMPLOYEES];
      db.attendance = [];
      db.overtime = [];
      db.kasbon = [];
      db.kasbonDeductions = [];
      db.salaryPayments = [];
      db.operationalExpenses = [];
      db.operationalExpenseAttachments = [];
      db.users = savedUsers;
      db.projects = savedProjects;
      db.auditLogs = [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: 'Administrator',
          userRole: 'admin',
          action: 'Reset Data Transaksi',
          module: 'Sistem',
          details: 'Data transaksi berhasil dibersihkan kembali ke data awal 10 karyawan.',
        },
      ];
      return db;
    });
  }
}

export const dbManager = new DatabaseManager();
