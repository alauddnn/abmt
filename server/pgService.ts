import { pool, query, withTransaction, isPostgresConfigured, insertAuditLog } from './postgres.js';
import {
  CompanySettings,
  Employee,
  Attendance,
  OvertimeRecord,
  KasbonRecord,
  SalaryPayment,
  OperationalExpense,
  OperationalExpenseAttachment,
  AuditLog,
  Project,
  DashboardStats,
  ProjectAssignment,
  ProjectExpense,
  ProjectOverviewStats,
} from '../src/types.js';
import { AppUser } from './db.js';
import { deleteFromStorage } from './supabaseStorage.js';

// --- CALCULATION HELPERS ---
export function calcBasicPayByStatus(status: string, dailyWage: number | undefined | null): number {
  const wage = Number(dailyWage) || 0;
  if (status === 'Hadir') return Math.round(wage);
  if (status === 'Setengah Hari') return Math.round(wage / 2);
  return 0;
}

export function resolveOvertimeDecimalHours(data: {
  hours?: number;
  overtimeHours?: number;
  durationHours?: number;
  durationMinutes?: number;
}): number {
  if (data.durationHours !== undefined || data.durationMinutes !== undefined) {
    const h = Math.max(0, Number(data.durationHours) || 0);
    const m = Math.max(0, Number(data.durationMinutes) || 0);
    return Number(((h * 60 + m) / 60).toFixed(4));
  }
  const raw = Math.max(0, Number(data.overtimeHours ?? data.hours ?? 0) || 0);
  const totalMinutes = Math.round(raw * 60);
  return Number((totalMinutes / 60).toFixed(4));
}

export function isDriverRole(role?: string | null): boolean {
  return String(role || '').trim().toLowerCase() === 'driver';
}

export function calcOvertimePayExact(
  decimalHours: number | undefined | null,
  hourlyRate: number | undefined | null,
  durationHours?: number,
  durationMinutes?: number,
  role?: string | null
): number {
  if (isDriverRole(role)) return 0;
  let totalMinutes = Math.round(Math.max(0, Number(decimalHours) || 0) * 60);
  if (durationHours !== undefined || durationMinutes !== undefined) {
    const h = Math.max(0, Math.floor(Number(durationHours) || 0));
    const m = Math.max(0, Math.round(Number(durationMinutes) || 0));
    totalMinutes = h * 60 + m;
  }
  const rate = Math.max(0, Number(hourlyRate) || 0);
  return Math.round((totalMinutes * rate) / 60);
}

// --- MAPPERS ---
function mapSettings(row: any): CompanySettings {
  return {
    id: row.id,
    companyName: row.company_name,
    tagline: row.tagline,
    address: row.address,
    phone: row.phone,
    ownerName: row.owner_name,
    assistantName: row.assistant_name,
    workHourStart: row.work_hour_start,
    workHourEnd: row.work_hour_end,
    wageMandorDaily: Number(row.wage_mandor_daily || 200000),
    overtimeMandorHourly: Number(row.overtime_mandor_hourly || 25000),
    wageTukangDaily: Number(row.wage_tukang_daily || 150000),
    overtimeTukangHourly: Number(row.overtime_tukang_hourly || 20000),
    wageHelperDaily: Number(row.wage_helper_daily || row.wage_kenek_daily || 125000),
    overtimeHelperHourly: Number(row.overtime_helper_hourly || row.overtime_kenek_hourly || 15000),
    wageDriverDaily: Number(row.wage_driver_daily || 140000),
    overtimeDriverHourly: 0,
    wageKenekDaily: Number(row.wage_kenek_daily || 125000),
    overtimeKenekHourly: Number(row.overtime_kenek_hourly || 15000),
    minTenureDaysForKasbon: Number(row.min_tenure_days_for_kasbon || 7),
  };
}

function mapEmployee(row: any): Employee {
  const role = row.role;
  const isDriver = isDriverRole(role);
  return {
    id: row.id,
    name: row.name,
    nik: row.nik || undefined,
    role,
    dailyWage: Number(row.daily_wage),
    overtimeHourlyWage: isDriver ? 0 : Number(row.overtime_hourly_wage),
    startDate: row.start_date ? (typeof row.start_date === 'string' ? row.start_date.split('T')[0] : row.start_date.toISOString().split('T')[0]) : '',
    status: row.status,
    phone: row.phone || '',
    notes: row.notes || '',
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : new Date().toISOString(),
  };
}

function mapProject(row: any): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location || '',
    client: row.client,
    startDate: row.start_date ? row.start_date.toISOString().split('T')[0] : '',
    targetEndDate: row.target_end_date ? row.target_end_date.toISOString().split('T')[0] : '',
    budget: Number(row.budget || 0),
    status: row.status || 'Berjalan',
    description: row.description || '',
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
  };
}

function mapAttendance(row: any): Attendance {
  const isDriver = isDriverRole(row.employee_role);
  const dailySnap = Number(row.daily_wage_snapshot || 0);
  const basicOnly = calcBasicPayByStatus(row.status, dailySnap);
  return {
    id: row.id,
    date: row.date ? (typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    projectId: row.project_id || undefined,
    projectName: row.project_name || undefined,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
    overtimeHours: Number(row.overtime_hours || 0),
    overtimeApproved: Boolean(row.overtime_approved),
    dailyWageSnapshot: dailySnap,
    overtimeWageSnapshot: isDriver ? 0 : Number(row.overtime_wage_snapshot || 0),
    totalDailyPay: isDriver ? basicOnly : Number(row.total_daily_pay || 0),
    notes: row.notes || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at ? (typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString()) : '',
  };
}

function mapOvertime(row: any): OvertimeRecord {
  const hours = Number(row.hours || 0);
  const totalMinutes = Math.round(hours * 60);
  const durationHours = Math.floor(totalMinutes / 60);
  const durationMinutes = totalMinutes % 60;
  const isDriver = isDriverRole(row.employee_role);
  return {
    id: row.id,
    attendanceId: row.attendance_id || undefined,
    date: row.date ? (typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    projectId: row.project_id || undefined,
    projectName: row.project_name || undefined,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    hours,
    durationHours,
    durationMinutes,
    hourlyRateSnapshot: isDriver ? 0 : Number(row.hourly_rate_snapshot || 0),
    totalPay: isDriver ? 0 : Number(row.total_pay || 0),
    status: row.status,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at ? (typeof row.approved_at === 'string' ? row.approved_at : row.approved_at.toISOString()) : undefined,
    notes: row.notes || '',
    auditTrail: Array.isArray(row.audit_trail) ? row.audit_trail : [],
  };
}

function mapKasbon(row: any): KasbonRecord {
  const attachments: OperationalExpenseAttachment[] = Array.isArray(row.attachments)
    ? row.attachments.map((a: any) => ({
        id: a.id,
        expenseId: a.kasbonId || a.kasbon_id || a.expense_id || row.id,
        fileName: a.fileName || a.file_name,
        filePath: a.filePath || a.file_path,
        fileSize: Number(a.fileSize || a.file_size || 0),
        mimeType: a.mimeType || a.mime_type || 'image/jpeg',
        uploadedBy: a.uploadedBy || a.uploaded_by || '',
        createdAt: a.createdAt || a.created_at || '',
        viewUrl: `/api/projects/kasbon/attachments/${a.id}/view`,
      }))
    : [];

  return {
    id: row.id,
    kasbonNumber: row.kasbon_number,
    attendanceId: row.attendance_id || undefined,
    requestDate: row.request_date ? (typeof row.request_date === 'string' ? row.request_date : row.request_date.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    employeeStartDate: row.employee_start_date ? (typeof row.employee_start_date === 'string' ? row.employee_start_date.split('T')[0] : row.employee_start_date.toISOString().split('T')[0]) : '',
    eligibilityDate: row.eligibility_date ? (typeof row.eligibility_date === 'string' ? row.eligibility_date.split('T')[0] : row.eligibility_date.toISOString().split('T')[0]) : '',
    isEligible: Boolean(row.is_eligible),
    eligibilityReason: row.eligibility_reason || '',
    amount: Number(row.amount || 0),
    reason: row.reason || '',
    status: row.status,
    deductedAmount: Number(row.deducted_amount || 0),
    remainingAmount: Number(row.remaining_amount || 0),
    targetPaymentPeriod: row.target_payment_period || undefined,
    adminNotes: row.admin_notes || '',
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at ? (typeof row.approved_at === 'string' ? row.approved_at : row.approved_at.toISOString()) : undefined,
    rejectionReason: row.rejection_reason || undefined,
    projectId: row.project_id || undefined,
    attachmentFilePath: row.attachment_file_path || undefined,
    attachmentFileName: row.attachment_file_name || undefined,
    attachmentFileSize: row.attachment_file_size ? Number(row.attachment_file_size) : undefined,
    attachmentMimeType: row.attachment_mime_type || undefined,
    attachments,
    auditTrail: Array.isArray(row.audit_trail) ? row.audit_trail : [],
  };
}

function mapSalaryPayment(row: any): SalaryPayment {
  const totalWorkDays = Number(row.total_work_days || 0);
  const fullWorkDays = row.full_work_days !== undefined && row.full_work_days !== null
    ? Number(row.full_work_days)
    : Math.floor(totalWorkDays);
  const halfWorkDays = row.half_work_days !== undefined && row.half_work_days !== null
    ? Number(row.half_work_days)
    : (totalWorkDays % 1 >= 0.4 ? 1 : 0);
  const totalBasicSalary = Number(row.total_basic_salary || 0);
  const fullDaySalary = row.full_day_salary !== undefined && row.full_day_salary !== null
    ? Number(row.full_day_salary)
    : totalBasicSalary;
  const halfDaySalary = row.half_day_salary !== undefined && row.half_day_salary !== null
    ? Number(row.half_day_salary)
    : 0;

  return {
    id: row.id,
    paymentNumber: row.payment_number,
    periodStart: row.period_start ? (typeof row.period_start === 'string' ? row.period_start.split('T')[0] : row.period_start.toISOString().split('T')[0]) : '',
    periodEnd: row.period_end ? (typeof row.period_end === 'string' ? row.period_end.split('T')[0] : row.period_end.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    fullWorkDays,
    halfWorkDays,
    totalWorkDays,
    fullDaySalary,
    halfDaySalary,
    approvedOvertimeHours: Number(row.approved_overtime_hours || 0),
    totalBasicSalary,
    totalOvertimePay: Number(row.total_overtime_pay || 0),
    grossSalary: Number(row.gross_salary || 0),
    kasbonDeduction: Number(row.kasbon_deduction || 0),
    otherDeductions: Number(row.other_deductions || 0),
    netSalary: Number(row.net_salary || 0),
    paymentDate: row.payment_date ? (typeof row.payment_date === 'string' ? row.payment_date.split('T')[0] : row.payment_date.toISOString().split('T')[0]) : '',
    paymentMethod: row.payment_method || 'Kas Tunai',
    referenceNumber: row.reference_number || undefined,
    status: row.status,
    notes: row.notes || undefined,
    processedBy: row.processed_by || '',
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : '',
    auditTrail: Array.isArray(row.audit_trail) ? row.audit_trail : [],
  };
}

function mapExpense(row: any): OperationalExpense {
  const attachments: OperationalExpenseAttachment[] = Array.isArray(row.attachments)
    ? row.attachments.map((a: any) => ({
        id: a.id,
        expenseId: a.expenseId || a.expense_id,
        fileName: a.fileName || a.file_name,
        filePath: a.filePath || a.file_path,
        fileSize: Number(a.fileSize || a.file_size || 0),
        mimeType: a.mimeType || a.mime_type || 'image/jpeg',
        uploadedBy: a.uploadedBy || a.uploaded_by || '',
        createdAt: a.createdAt || a.created_at || '',
        viewUrl: `/api/expenses/attachments/${a.id}/view`,
      }))
    : [];

  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    date: row.date ? (typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]) : '',
    personType: row.person_type,
    personName: row.person_name,
    category: row.category,
    description: row.description || '',
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || 'Tunai',
    receiptProof: row.receipt_proof || '',
    notes: row.notes || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : '',
    attachments,
  };
}

function mapUser(row: any): AppUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email || `${row.username}@astabrata.com`,
    name: row.name,
    role: row.role,
    salt: row.salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
  };
}

function mapProjectAssignment(row: any): ProjectAssignment {
  return {
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    roleInProject: row.role_in_project || 'Anggota Proyek',
    assignedDate: row.assigned_date ? (typeof row.assigned_date === 'string' ? row.assigned_date.split('T')[0] : row.assigned_date.toISOString().split('T')[0]) : '',
    status: row.status || 'active',
    notes: row.notes || '',
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : '',
    employeeName: row.employee_name || '',
    employeeRole: row.employee_role || '',
    employeePhone: row.employee_phone || '',
    employeeNik: row.employee_nik || '',
    employeeStartDate: row.employee_start_date ? (typeof row.employee_start_date === 'string' ? row.employee_start_date.split('T')[0] : row.employee_start_date.toISOString().split('T')[0]) : '',
    employeeStatus: row.employee_status || 'active',
    dailyWage: row.daily_wage !== undefined ? Number(row.daily_wage) : undefined,
    overtimeHourlyWage: isDriverRole(row.employee_role || row.role_in_project)
      ? 0
      : (row.overtime_hourly_wage !== undefined ? Number(row.overtime_hourly_wage) : undefined),
  };
}

function mapProjectExpense(row: any): ProjectExpense {
  const attachments: OperationalExpenseAttachment[] = Array.isArray(row.attachments)
    ? row.attachments.map((a: any) => ({
        id: a.id,
        expenseId: a.expenseId || a.expense_id,
        fileName: a.fileName || a.file_name,
        filePath: a.filePath || a.file_path,
        fileSize: Number(a.fileSize || a.file_size || 0),
        mimeType: a.mimeType || a.mime_type || 'image/jpeg',
        uploadedBy: a.uploadedBy || a.uploaded_by || '',
        createdAt: a.createdAt || a.created_at || '',
        viewUrl: `/api/projects/expenses/attachments/${a.id}/view`,
      }))
    : [];

  return {
    id: row.id,
    transactionNumber: row.transaction_number,
    projectId: row.project_id,
    expenseType: row.expense_type,
    date: row.date ? (typeof row.date === 'string' ? row.date.split('T')[0] : row.date.toISOString().split('T')[0]) : '',
    category: row.category,
    transportType: row.transport_type || '',
    destination: row.destination || '',
    picName: row.pic_name,
    description: row.description || '',
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || 'Tunai',
    notes: row.notes || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : '',
    attachments,
  };
}

let isSchemaEnsured = false;
let schemaEnsuringPromise: Promise<void> | null = null;

export async function ensureAllSchemasOnce(): Promise<void> {
  if (isSchemaEnsured) return;
  if (schemaEnsuringPromise) return schemaEnsuringPromise;

  schemaEnsuringPromise = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS company_settings (
          id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
          company_name VARCHAR(255) NOT NULL DEFAULT 'PT. ASTA BRATA MATAHARI TERBIT',
          tagline VARCHAR(255) DEFAULT 'General Contractor & Interior Specialist',
          address TEXT DEFAULT 'Jl. Konstruksi Mandiri No. 88, Jakarta Selatan',
          phone VARCHAR(50) DEFAULT '0812-8899-7722',
          owner_name VARCHAR(150) DEFAULT 'Bpk. Astari',
          assistant_name VARCHAR(150) DEFAULT 'Bpk. Acil',
          work_hour_start VARCHAR(10) DEFAULT '08:00',
          work_hour_end VARCHAR(10) DEFAULT '16:00',
          wage_mandor_daily NUMERIC(15, 2) DEFAULT 200000,
          overtime_mandor_hourly NUMERIC(15, 2) DEFAULT 25000,
          wage_tukang_daily NUMERIC(15, 2) DEFAULT 150000,
          overtime_tukang_hourly NUMERIC(15, 2) DEFAULT 20000,
          wage_helper_daily NUMERIC(15, 2) DEFAULT 125000,
          overtime_helper_hourly NUMERIC(15, 2) DEFAULT 15000,
          wage_driver_daily NUMERIC(15, 2) DEFAULT 140000,
          overtime_driver_hourly NUMERIC(15, 2) DEFAULT 0,
          wage_kenek_daily NUMERIC(15, 2) DEFAULT 125000,
          overtime_kenek_hourly NUMERIC(15, 2) DEFAULT 15000,
          min_tenure_days_for_kasbon INT DEFAULT 7,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS wage_mandor_daily NUMERIC(15, 2) DEFAULT 200000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS overtime_mandor_hourly NUMERIC(15, 2) DEFAULT 25000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS wage_tukang_daily NUMERIC(15, 2) DEFAULT 150000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS overtime_tukang_hourly NUMERIC(15, 2) DEFAULT 20000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS wage_helper_daily NUMERIC(15, 2) DEFAULT 125000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS overtime_helper_hourly NUMERIC(15, 2) DEFAULT 15000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS wage_driver_daily NUMERIC(15, 2) DEFAULT 140000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS overtime_driver_hourly NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS wage_kenek_daily NUMERIC(15, 2) DEFAULT 125000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS overtime_kenek_hourly NUMERIC(15, 2) DEFAULT 15000;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS min_tenure_days_for_kasbon INT DEFAULT 7;
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tagline VARCHAR(255) DEFAULT 'General Contractor & Interior Specialist';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS address TEXT DEFAULT 'Jl. Konstruksi Mandiri No. 88, Jakarta Selatan';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT '0812-8899-7722';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150) DEFAULT 'Bpk. Astari';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS assistant_name VARCHAR(150) DEFAULT 'Bpk. Acil';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS work_hour_start VARCHAR(10) DEFAULT '08:00';
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS work_hour_end VARCHAR(10) DEFAULT '16:00';

        INSERT INTO company_settings (id, company_name) VALUES ('default', 'PT. ASTA BRATA MATAHARI TERBIT')
        ON CONFLICT (id) DO NOTHING;

        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS project_id VARCHAR(100);
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attendance_id VARCHAR(100);
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_file_path TEXT;
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_file_name VARCHAR(255);
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_file_size INT;
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(100);

        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT con.conname
            FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'attendance' AND con.contype = 'c'
          ) LOOP
            EXECUTE 'ALTER TABLE attendance DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
          END LOOP;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;

        DO $$ BEGIN
          ALTER TABLE attendance ALTER COLUMN overtime_hours TYPE NUMERIC(10, 4);
        EXCEPTION WHEN OTHERS THEN NULL; END $$;

        DO $$ BEGIN
          ALTER TABLE overtime_records ALTER COLUMN hours TYPE NUMERIC(10, 4);
        EXCEPTION WHEN OTHERS THEN NULL; END $$;

        DO $$ BEGIN
          ALTER TABLE salary_payments ALTER COLUMN total_work_days TYPE NUMERIC(10, 4);
        EXCEPTION WHEN OTHERS THEN NULL; END $$;

        DO $$ BEGIN
          ALTER TABLE salary_payments ALTER COLUMN approved_overtime_hours TYPE NUMERIC(10, 4);
        EXCEPTION WHEN OTHERS THEN NULL; END $$;

        ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS full_work_days NUMERIC(10, 2) DEFAULT 0;
        ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS half_work_days NUMERIC(10, 2) DEFAULT 0;
        ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS full_day_salary NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE salary_payments ADD COLUMN IF NOT EXISTS half_day_salary NUMERIC(15, 2) DEFAULT 0;

        CREATE TABLE IF NOT EXISTS kasbon_attachments (
          id VARCHAR(100) PRIMARY KEY,
          kasbon_id VARCHAR(100) NOT NULL REFERENCES kasbon_records(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          file_size INT DEFAULT 0,
          mime_type VARCHAR(100) DEFAULT 'image/jpeg',
          uploaded_by VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS operational_expense_attachments (
          id VARCHAR(64) PRIMARY KEY,
          expense_id VARCHAR(64) NOT NULL REFERENCES operational_expenses(id) ON UPDATE CASCADE ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          file_size INT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          uploaded_by VARCHAR(150),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Data Integrity Reconciliation:
        -- 0. Company Policy: Driver does NOT receive overtime pay (Rp0). Keep overtime duration intact, set rate & pay to 0.
        UPDATE company_settings SET overtime_driver_hourly = 0 WHERE overtime_driver_hourly != 0;

        UPDATE employees SET overtime_hourly_wage = 0 WHERE LOWER(role) = 'driver' AND overtime_hourly_wage != 0;

        UPDATE attendance a
        SET overtime_wage_snapshot = 0,
            total_daily_pay = (
              CASE
                WHEN a.status = 'Hadir' THEN ROUND(a.daily_wage_snapshot)
                WHEN a.status = 'Setengah Hari' THEN ROUND(a.daily_wage_snapshot / 2.0)
                ELSE 0
              END
            )
        FROM employees e
        WHERE a.employee_id = e.id
          AND (LOWER(e.role) = 'driver' OR LOWER(a.employee_role) = 'driver')
          AND (
            a.overtime_wage_snapshot != 0
            OR a.total_daily_pay != (
              CASE
                WHEN a.status = 'Hadir' THEN ROUND(a.daily_wage_snapshot)
                WHEN a.status = 'Setengah Hari' THEN ROUND(a.daily_wage_snapshot / 2.0)
                ELSE 0
              END
            )
          );

        UPDATE overtime_records o
        SET hourly_rate_snapshot = 0,
            total_pay = 0
        FROM employees e
        WHERE o.employee_id = e.id
          AND (LOWER(e.role) = 'driver' OR LOWER(o.employee_role) = 'driver')
          AND (o.hourly_rate_snapshot != 0 OR o.total_pay != 0);

        -- 1. Project-created employees (PRJ...) who were removed from project_assignments and have no active project_assignments should be marked 'inactive'
        UPDATE employees e
        SET status = 'inactive'
        WHERE e.status = 'active'
          AND e.id LIKE 'PRJ%'
          AND NOT EXISTS (
            SELECT 1 FROM project_assignments pa
            WHERE pa.employee_id = e.id AND pa.status = 'active'
          );

        -- 1B. Permanently delete inactive orphan employees who were mistakenly added & deleted and have 0 project_assignments and 0 transactions across all tables
        DELETE FROM employees e
        WHERE e.status = 'inactive'
          AND NOT EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.employee_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.employee_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM overtime_records o WHERE o.employee_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM kasbon_records k WHERE k.employee_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM kasbon_deductions kd WHERE kd.employee_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM salary_payments sp WHERE sp.employee_id = e.id);

        -- 2. Repair any attendance rows where overtime_wage_snapshot was 0 but the employee (non-Driver) has a valid overtime_hourly_wage > 0
        UPDATE attendance a
        SET overtime_wage_snapshot = e.overtime_hourly_wage,
            overtime_approved = CASE WHEN a.overtime_hours > 0 THEN true ELSE a.overtime_approved END,
            total_daily_pay = (
              CASE
                WHEN a.status = 'Hadir' THEN ROUND(a.daily_wage_snapshot)
                WHEN a.status = 'Setengah Hari' THEN ROUND(a.daily_wage_snapshot / 2.0)
                ELSE 0
              END
            ) + (
              CASE
                WHEN a.overtime_hours > 0 THEN ROUND((ROUND(a.overtime_hours * 60.0) * e.overtime_hourly_wage) / 60.0)
                ELSE 0
              END
            )
        FROM employees e
        WHERE a.employee_id = e.id
          AND LOWER(e.role) != 'driver'
          AND LOWER(a.employee_role) != 'driver'
          AND (a.overtime_wage_snapshot = 0 OR (a.overtime_hours > 0 AND a.overtime_approved = false))
          AND e.overtime_hourly_wage > 0;

        -- 3. Repair any overtime_records rows where hourly_rate_snapshot = 0 or total_pay = 0 despite hours > 0 (non-Driver only)
        UPDATE overtime_records o
        SET hourly_rate_snapshot = e.overtime_hourly_wage,
            total_pay = ROUND((ROUND(o.hours * 60.0) * e.overtime_hourly_wage) / 60.0)
        FROM employees e
        WHERE o.employee_id = e.id
          AND LOWER(e.role) != 'driver'
          AND LOWER(o.employee_role) != 'driver'
          AND o.hours > 0
          AND (o.hourly_rate_snapshot = 0 OR o.total_pay = 0)
          AND e.overtime_hourly_wage > 0;

        -- 4. Insert missing overtime_records for any attendance rows that have overtime_hours > 0
        INSERT INTO overtime_records (
          id, attendance_id, date, employee_id, employee_name, employee_role,
          project_id, project_name, start_time, end_time, hours,
          hourly_rate_snapshot, total_pay, status, approved_by, approved_at, notes, audit_trail
        )
        SELECT
          'OVT-SYNC-' || a.id,
          a.id,
          a.date,
          a.employee_id,
          a.employee_name,
          a.employee_role,
          a.project_id,
          a.project_name,
          COALESCE(NULLIF(a.check_out, '-'), '16:00'),
          '',
          a.overtime_hours,
          CASE WHEN LOWER(e.role) = 'driver' OR LOWER(a.employee_role) = 'driver' THEN 0 WHEN a.overtime_wage_snapshot > 0 THEN a.overtime_wage_snapshot ELSE e.overtime_hourly_wage END,
          CASE WHEN LOWER(e.role) = 'driver' OR LOWER(a.employee_role) = 'driver' THEN 0 ELSE ROUND((ROUND(a.overtime_hours * 60.0) * (CASE WHEN a.overtime_wage_snapshot > 0 THEN a.overtime_wage_snapshot ELSE e.overtime_hourly_wage END)) / 60.0) END,
          'Disetujui',
          COALESCE(NULLIF(a.created_by, ''), 'Administrator'),
          NOW(),
          COALESCE(NULLIF(a.notes, ''), 'Lembur dari absensi harian'),
          jsonb_build_array(
            jsonb_build_object(
              'timestamp', NOW()::text,
              'user', 'Sistem Integritas',
              'action', 'Sinkronisasi otomatis lembur dari data absensi'
            )
          )
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE a.overtime_hours > 0
          AND NOT EXISTS (
            SELECT 1 FROM overtime_records o
            WHERE o.attendance_id = a.id
               OR (o.employee_id = a.employee_id AND o.date = a.date)
          );
      `);
      isSchemaEnsured = true;
    } catch (err: any) {
      console.warn('Schema check notice:', err.message);
      isSchemaEnsured = true;
    } finally {
      schemaEnsuringPromise = null;
    }
  })();

  return schemaEnsuringPromise;
}

// Export database operations service
export const pgService = {
  // 1. Settings
  async ensureCompanySettingsTable(): Promise<void> {
    await ensureAllSchemasOnce();
  },

  async getSettings(): Promise<CompanySettings> {
    await ensureAllSchemasOnce();
    const res = await query('SELECT * FROM company_settings WHERE id = $1 LIMIT 1', ['default']);
    if (!res.rows.length) {
      throw new Error('Pengaturan perusahaan belum diinisialisasi di PostgreSQL.');
    }
    return mapSettings(res.rows[0]);
  },

  async updateSettings(
    data: Partial<CompanySettings> & { syncActiveEmployees?: boolean },
    userName: string,
    userRole: string
  ): Promise<CompanySettings> {
    await ensureAllSchemasOnce();
    const current = await this.getSettings();
    const updated: CompanySettings = { ...current, ...data };
    const helperDaily = updated.wageHelperDaily || updated.wageKenekDaily || 125000;
    const helperOt = updated.overtimeHelperHourly || updated.overtimeKenekHourly || 15000;
    const mandorDaily = updated.wageMandorDaily || 200000;
    const mandorOt = updated.overtimeMandorHourly || 25000;
    const tukangDaily = updated.wageTukangDaily || 150000;
    const tukangOt = updated.overtimeTukangHourly || 20000;
    const driverDaily = updated.wageDriverDaily || 140000;
    const driverOt = 0; // Ketentuan perusahaan: Driver tidak mendapatkan upah lembur (Rp0)

    const res = await query(
      `UPDATE company_settings SET
        company_name = $1, tagline = $2, address = $3, phone = $4,
        owner_name = $5, assistant_name = $6, work_hour_start = $7, work_hour_end = $8,
        wage_mandor_daily = $9, overtime_mandor_hourly = $10,
        wage_tukang_daily = $11, overtime_tukang_hourly = $12,
        wage_helper_daily = $13, overtime_helper_hourly = $14,
        wage_driver_daily = $15, overtime_driver_hourly = $16,
        wage_kenek_daily = $17, overtime_kenek_hourly = $18,
        min_tenure_days_for_kasbon = $19, updated_at = NOW()
       WHERE id = 'default' RETURNING *`,
      [
        updated.companyName, updated.tagline, updated.address, updated.phone,
        updated.ownerName, updated.assistantName, updated.workHourStart, updated.workHourEnd,
        mandorDaily, mandorOt,
        tukangDaily, tukangOt,
        helperDaily, helperOt,
        driverDaily, driverOt,
        helperDaily, helperOt,
        updated.minTenureDaysForKasbon || 7,
      ]
    );

    // Optional: Sync active employees' current master rates when requested by Admin,
    // OR sync active employees whose rate matched the previous role standard.
    // Historical attendance snapshots, overtime snapshots, and salary_payments are NEVER modified!
    if (data.syncActiveEmployees) {
      await query(`UPDATE employees SET daily_wage = $1, overtime_hourly_wage = $2 WHERE role = 'Mandor' AND status = 'active'`, [mandorDaily, mandorOt]);
      await query(`UPDATE employees SET daily_wage = $1, overtime_hourly_wage = $2 WHERE role = 'Tukang' AND status = 'active'`, [tukangDaily, tukangOt]);
      await query(`UPDATE employees SET daily_wage = $1, overtime_hourly_wage = $2 WHERE role IN ('Helper', 'Kenek') AND status = 'active'`, [helperDaily, helperOt]);
      await query(`UPDATE employees SET daily_wage = $1, overtime_hourly_wage = 0 WHERE role = 'Driver' AND status = 'active'`, [driverDaily]);
    } else {
      // Automatically update active employees who were using the exact previous default role rate
      await query(
        `UPDATE employees SET daily_wage = $1, overtime_hourly_wage = $2
         WHERE role = 'Mandor' AND status = 'active' AND daily_wage = $3 AND overtime_hourly_wage = $4`,
        [mandorDaily, mandorOt, current.wageMandorDaily, current.overtimeMandorHourly]
      );
      await query(
        `UPDATE employees SET daily_wage = $1, overtime_hourly_wage = $2
         WHERE role = 'Tukang' AND status = 'active' AND daily_wage = $3 AND overtime_hourly_wage = $4`,
        [tukangDaily, tukangOt, current.wageTukangDaily, current.overtimeTukangHourly]
      );
      await query(
        `UPDATE employees SET daily_wage = $1, overtime_hourly_wage = $2
         WHERE role IN ('Helper', 'Kenek') AND status = 'active' AND daily_wage = $3 AND overtime_hourly_wage = $4`,
        [helperDaily, helperOt, current.wageHelperDaily || current.wageKenekDaily, current.overtimeHelperHourly || current.overtimeKenekHourly]
      );
      await query(
        `UPDATE employees SET daily_wage = $1, overtime_hourly_wage = 0
         WHERE role = 'Driver' AND status = 'active' AND daily_wage = $2`,
        [driverDaily, current.wageDriverDaily]
      );
    }

    await insertAuditLog(userName, userRole as any, 'Ubah Pengaturan', 'Pengaturan', 'Memperbarui profil perusahaan dan tarif upah di PostgreSQL (riwayat gaji lama tetap aman)');
    return mapSettings(res.rows[0]);
  },

  // 2. Employees (supports manual ID and cascading update)
  async getEmployees(): Promise<Employee[]> {
    await ensureAllSchemasOnce();
    const res = await query('SELECT * FROM employees ORDER BY role DESC, id ASC');
    return res.rows.map(mapEmployee);
  },

  async createEmployee(data: Partial<Employee>, userName: string, userRole: string): Promise<Employee> {
    const settings = await this.getSettings();
    let id = (data.id || '').trim();
    if (!id) {
      const roleName = data.role || 'Tukang';
      const countRes = await query('SELECT COUNT(*) as count FROM employees WHERE role = $1', [roleName]);
      const count = Number(countRes.rows[0].count) + 1;
      let prefix = 'TK';
      if (roleName === 'Mandor') prefix = 'MD';
      else if (roleName === 'Helper' || roleName === 'Kenek') prefix = 'HL';
      else if (roleName === 'Driver') prefix = 'DR';
      id = `EMP-${prefix}-${String(count).padStart(2, '0')}`;
    }

    let defaultDaily = settings.wageTukangDaily;
    let defaultOvertime = settings.overtimeTukangHourly;
    if (data.role === 'Mandor') {
      defaultDaily = settings.wageMandorDaily || 200000;
      defaultOvertime = settings.overtimeMandorHourly || 25000;
    } else if (data.role === 'Helper' || data.role === 'Kenek') {
      defaultDaily = settings.wageHelperDaily || settings.wageKenekDaily || 125000;
      defaultOvertime = settings.overtimeHelperHourly || settings.overtimeKenekHourly || 15000;
    } else if (data.role === 'Driver') {
      defaultDaily = settings.wageDriverDaily || 140000;
      defaultOvertime = 0;
    }

    const dailyWage = data.dailyWage !== undefined && data.dailyWage !== null && data.dailyWage !== ('' as any)
      ? Number(data.dailyWage)
      : defaultDaily;
    const overtimeHourlyWage = isDriverRole(data.role)
      ? 0
      : (data.overtimeHourlyWage !== undefined && data.overtimeHourlyWage !== null && data.overtimeHourlyWage !== ('' as any)
        ? Number(data.overtimeHourlyWage)
        : defaultOvertime);
    const startDate = data.startDate || new Date().toISOString().split('T')[0];

    const res = await query(
      `INSERT INTO employees (id, name, role, daily_wage, overtime_hourly_wage, start_date, status, phone, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [id, data.name?.trim(), data.role, dailyWage, overtimeHourlyWage, startDate, data.status || 'active', data.phone || '', data.notes || '']
    );

    await insertAuditLog(userName, userRole as any, 'Tambah Karyawan', 'Karyawan', `Menambahkan karyawan baru ID ${id}: ${data.name}`);
    return mapEmployee(res.rows[0]);
  },

  async updateEmployee(oldId: string, data: Partial<Employee>, userName: string, userRole: string): Promise<Employee> {
    const targetId = (data.id || oldId).trim();
    const idChanged = targetId.toLowerCase() !== oldId.toLowerCase();

    return withTransaction(async (client) => {
      if (idChanged) {
        // Cascade update in all related tables
        await client.query('UPDATE attendance SET employee_id = $1 WHERE employee_id = $2', [targetId, oldId]);
        await client.query('UPDATE overtime_records SET employee_id = $1 WHERE employee_id = $2', [targetId, oldId]);
        await client.query('UPDATE kasbon_records SET employee_id = $1 WHERE employee_id = $2', [targetId, oldId]);
        await client.query('UPDATE kasbon_deductions SET employee_id = $1 WHERE employee_id = $2', [targetId, oldId]);
        await client.query('UPDATE salary_payments SET employee_id = $1 WHERE employee_id = $2', [targetId, oldId]);
        await client.query('UPDATE project_assignments SET employee_id = $1 WHERE employee_id = $2', [targetId, oldId]);
      }

      const nextOvertimeRate = isDriverRole(data.role) ? 0 : data.overtimeHourlyWage;

      const res = await client.query(
        `UPDATE employees SET
          id = $1, name = COALESCE($2, name), role = COALESCE($3, role),
          daily_wage = COALESCE($4, daily_wage), overtime_hourly_wage = CASE WHEN LOWER(COALESCE($3, role)) = 'driver' THEN 0 ELSE COALESCE($5, overtime_hourly_wage) END,
          start_date = COALESCE($6, start_date), status = COALESCE($7, status),
          phone = COALESCE($8, phone), notes = COALESCE($9, notes)
         WHERE id = $10 RETURNING *`,
        [targetId, data.name?.trim(), data.role, data.dailyWage, nextOvertimeRate, data.startDate, data.status, data.phone, data.notes, oldId]
      );

      if (!res.rows.length) {
        throw new Error('Karyawan tidak ditemukan.');
      }

      // Sync project_assignments status when master employee status is explicitly changed
      if (data.status === 'inactive') {
        await client.query(
          `UPDATE project_assignments SET status = 'inactive' WHERE employee_id = $1 AND status = 'active'`,
          [targetId]
        );
      } else if (data.status === 'active') {
        await client.query(
          `UPDATE project_assignments SET status = 'active' WHERE employee_id = $1 AND status = 'inactive'`,
          [targetId]
        );
      }

      const updatedEmp = mapEmployee(res.rows[0]);
      if (isDriverRole(updatedEmp.role)) {
        await client.query(
          `UPDATE attendance
           SET employee_role = $1,
               overtime_wage_snapshot = 0,
               total_daily_pay = (
                 CASE
                   WHEN status = 'Hadir' THEN ROUND(daily_wage_snapshot)
                   WHEN status = 'Setengah Hari' THEN ROUND(daily_wage_snapshot / 2.0)
                   ELSE 0
                 END
               )
           WHERE employee_id = $2`,
          [updatedEmp.role, targetId]
        );
        await client.query(
          `UPDATE overtime_records
           SET employee_role = $1,
               hourly_rate_snapshot = 0,
               total_pay = 0
           WHERE employee_id = $2`,
          [updatedEmp.role, targetId]
        );
      } else if (updatedEmp.overtimeHourlyWage > 0) {
        await client.query(
          `UPDATE attendance
           SET overtime_wage_snapshot = $1,
               total_daily_pay = (
                 CASE
                   WHEN status = 'Hadir' THEN ROUND(daily_wage_snapshot)
                   WHEN status = 'Setengah Hari' THEN ROUND(daily_wage_snapshot / 2.0)
                   ELSE 0
                 END
               ) + (
                 CASE
                   WHEN overtime_hours > 0 AND overtime_approved = true THEN ROUND((ROUND(overtime_hours * 60.0) * $1) / 60.0)
                   ELSE 0
                 END
               )
           WHERE employee_id = $2 AND overtime_wage_snapshot = 0`,
          [updatedEmp.overtimeHourlyWage, targetId]
        );
        await client.query(
          `UPDATE overtime_records
           SET hourly_rate_snapshot = $1,
               total_pay = ROUND((ROUND(hours * 60.0) * $1) / 60.0)
           WHERE employee_id = $2 AND hours > 0 AND (hourly_rate_snapshot = 0 OR total_pay = 0)`,
          [updatedEmp.overtimeHourlyWage, targetId]
        );
      }

      await insertAuditLog(userName, userRole as any, 'Ubah Data Karyawan', 'Karyawan', `Memperbarui data karyawan ID: ${oldId} -> ${targetId}`);
      return updatedEmp;
    });
  },

  async deleteEmployee(
    id: string,
    userName: string,
    userRole: string
  ): Promise<{ deletedPermanently: boolean; employeeId: string; employeeName: string; message: string }> {
    await ensureAllSchemasOnce();
    return withTransaction(async (client) => {
      const empRes = await client.query('SELECT id, name FROM employees WHERE id = $1 FOR UPDATE', [id]);
      if (!empRes.rows.length) {
        const notFoundErr: any = new Error('Karyawan tidak ditemukan.');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      const empName = empRes.rows[0].name;

      // Check if employee has historical transactions in attendance, overtime_records, kasbon_records, kasbon_deductions, or salary_payments
      const txRes = await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM attendance WHERE employee_id = $1) AS att_count,
          (SELECT COUNT(*)::int FROM overtime_records WHERE employee_id = $1) AS ot_count,
          (SELECT COUNT(*)::int FROM kasbon_records WHERE employee_id = $1) AS kb_count,
          (SELECT COUNT(*)::int FROM kasbon_deductions WHERE employee_id = $1) AS kd_count,
          (SELECT COUNT(*)::int FROM salary_payments WHERE employee_id = $1) AS pay_count`,
        [id]
      );
      const counts = txRes.rows[0];
      const totalTx =
        (counts?.att_count || 0) +
        (counts?.ot_count || 0) +
        (counts?.kb_count || 0) +
        (counts?.kd_count || 0) +
        (counts?.pay_count || 0);

      if (totalTx > 0) {
        const refErr: any = new Error(
          `Penghapusan permanen ditolak: Karyawan "${empName}" (${id}) sudah memiliki riwayat transaksi sah (${counts.att_count} absensi, ${counts.ot_count} lembur, ${counts.kb_count} kasbon, ${counts.pay_count} pembayaran gaji). Untuk menjaga keakuratan rekap gaji dan laporan keuangan historis, silakan gunakan fitur Nonaktifkan Karyawan.`
        );
        refErr.statusCode = 409;
        refErr.transactionCounts = counts;
        throw refErr;
      }

      // Safe permanent deletion in foreign-key order
      await client.query('DELETE FROM project_assignments WHERE employee_id = $1', [id]);
      await client.query('DELETE FROM employees WHERE id = $1', [id]);

      await insertAuditLog(
        userName,
        userRole as any,
        'Hapus Karyawan Permanen',
        'Karyawan',
        `Menghapus permanen karyawan tanpa riwayat transaksi dari database: ${empName} (${id})`
      );

      return {
        deletedPermanently: true,
        employeeId: id,
        employeeName: empName,
        message: `Data karyawan "${empName}" (${id}) berhasil dihapus permanen dari database.`,
      };
    });
  },

  // 3. Projects
  async getProjects(): Promise<Project[]> {
    const res = await query('SELECT * FROM projects ORDER BY created_at DESC');
    return res.rows.map(mapProject);
  },

  async createProject(data: Partial<Project>, userName: string, userRole: string): Promise<Project> {
    const id = `PRJ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    const code = data.code?.trim() || `PRJ-${Date.now().toString().slice(-4)}-${randomSuffix}`;

    const res = await query(
      `INSERT INTO projects (id, code, name, location, client, start_date, target_end_date, budget, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        id, code, data.name?.trim(), data.location?.trim() || 'Jakarta', data.client?.trim(),
        data.startDate || new Date().toISOString().split('T')[0], data.targetEndDate || null,
        Number(data.budget || 0), data.status || 'Berjalan', data.description || '',
      ]
    );

    await insertAuditLog(userName, userRole as any, 'Tambah Proyek', 'Proyek', `Menambahkan proyek: ${data.name} (${code})`);
    return mapProject(res.rows[0]);
  },

  async updateProject(id: string, data: Partial<Project>, userName: string, userRole: string): Promise<Project> {
    const res = await query(
      `UPDATE projects SET
        code = COALESCE($1, code), name = COALESCE($2, name), location = COALESCE($3, location),
        client = COALESCE($4, client), start_date = COALESCE($5, start_date),
        target_end_date = COALESCE($6, target_end_date), budget = COALESCE($7, budget),
        status = COALESCE($8, status), description = COALESCE($9, description)
       WHERE id = $10 RETURNING *`,
      [data.code?.trim(), data.name?.trim(), data.location?.trim(), data.client?.trim(), data.startDate, data.targetEndDate, data.budget, data.status, data.description, id]
    );
    if (!res.rows.length) throw new Error('Proyek tidak ditemukan.');
    await insertAuditLog(userName, userRole as any, 'Ubah Proyek', 'Proyek', `Memperbarui proyek: ${res.rows[0].name}`);
    return mapProject(res.rows[0]);
  },

  async deleteProject(id: string, userName: string, userRole: string): Promise<void> {
    const res = await query('SELECT name FROM projects WHERE id = $1', [id]);
    if (!res.rows.length) throw new Error('Proyek tidak ditemukan.');
    await query('DELETE FROM projects WHERE id = $1', [id]);
    await insertAuditLog(userName, userRole as any, 'Hapus Proyek', 'Proyek', `Menghapus proyek: ${res.rows[0].name}`);
  },

  async getProjectById(id: string): Promise<Project | null> {
    const res = await query('SELECT * FROM projects WHERE id = $1 LIMIT 1', [id]);
    if (!res.rows.length) return null;
    return mapProject(res.rows[0]);
  },

  // 3B. Project Assignments & Direct Project Employees
  async getProjectAssignments(projectId: string): Promise<ProjectAssignment[]> {
    const res = await query(
      `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
              e.nik as employee_nik, e.start_date as employee_start_date, e.status as employee_status,
              e.daily_wage, e.overtime_hourly_wage
       FROM project_assignments pa
       JOIN employees e ON pa.employee_id = e.id
       WHERE pa.project_id = $1
       ORDER BY CASE WHEN pa.status = 'active' THEN 0 ELSE 1 END, pa.assigned_date DESC, e.name ASC`,
      [projectId]
    );
    return res.rows.map(mapProjectAssignment);
  },

  // Direct Employee Addition from Project Page (With auto unique ID, zero duplicates)
  async createProjectEmployee(
    projectId: string,
    data: {
      name: string;
      phone?: string;
      nik?: string;
      role: string;
      startDate: string;
      dailyWage: number;
      overtimeHourlyWage: number;
      status: 'active' | 'inactive';
      notes?: string;
    },
    userName: string,
    userRole: string
  ): Promise<ProjectAssignment> {
    const projRes = await query('SELECT id, code, name FROM projects WHERE id = $1', [projectId]);
    if (!projRes.rows.length) throw new Error('Proyek tidak ditemukan.');
    const project = projRes.rows[0];

    // Generate unique ID based on project code and role without duplication
    const cleanProjCode = (project.code || 'PRJ').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const roleAbbrMap: Record<string, string> = {
      Mandor: 'MD',
      Tukang: 'TK',
      Helper: 'HL',
      Kenek: 'HL',
      Driver: 'DR',
    };
    const roleAbbr = roleAbbrMap[data.role] || 'STF';

    let seq = 1;
    let empId = `${cleanProjCode}-${roleAbbr}-${String(seq).padStart(3, '0')}`;
    while (true) {
      const check = await query('SELECT id FROM employees WHERE id = $1', [empId]);
      if (!check.rows.length) break;
      seq++;
      empId = `${cleanProjCode}-${roleAbbr}-${String(seq).padStart(3, '0')}`;
    }

    const trimmedName = data.name.trim();
    const startDate = data.startDate || new Date().toISOString().split('T')[0];
    const status = data.status || 'active';

    const settings = await this.getSettings();
    let defaultDaily = settings.wageTukangDaily || 150000;
    let defaultOvertime = settings.overtimeTukangHourly || 20000;
    if (data.role === 'Mandor') {
      defaultDaily = settings.wageMandorDaily || 200000;
      defaultOvertime = settings.overtimeMandorHourly || 25000;
    } else if (data.role === 'Helper' || data.role === 'Kenek') {
      defaultDaily = settings.wageHelperDaily || settings.wageKenekDaily || 125000;
      defaultOvertime = settings.overtimeHelperHourly || settings.overtimeKenekHourly || 15000;
    } else if (data.role === 'Driver') {
      defaultDaily = settings.wageDriverDaily || 140000;
      defaultOvertime = 0;
    }

    const finalDailyWage = Number(data.dailyWage) > 0 ? Number(data.dailyWage) : defaultDaily;
    const finalOvertimeWage = isDriverRole(data.role)
      ? 0
      : (Number(data.overtimeHourlyWage) > 0 ? Number(data.overtimeHourlyWage) : defaultOvertime);

    return withTransaction(async (client) => {
      // 1. Insert into employees master
      await client.query(
        `INSERT INTO employees (id, name, nik, role, daily_wage, overtime_hourly_wage, start_date, status, phone, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          empId,
          trimmedName,
          data.nik?.trim() || null,
          data.role,
          finalDailyWage,
          finalOvertimeWage,
          startDate,
          status,
          data.phone?.trim() || '',
          data.notes?.trim() || '',
        ]
      );

      // 2. Insert into project_assignments directly linked to this project
      const assignmentId = `PASG-${empId}`;
      await client.query(
        `INSERT INTO project_assignments (id, project_id, employee_id, role_in_project, assigned_date, status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          assignmentId,
          projectId,
          empId,
          data.role,
          startDate,
          status,
          data.notes?.trim() || '',
        ]
      );

      await insertAuditLog(
        userName,
        userRole as any,
        'Tambah Karyawan Proyek',
        'Karyawan',
        `Menambahkan karyawan baru ${trimmedName} (${empId}) pada proyek ${project.name}`
      );

      const full = await client.query(
        `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
                e.nik as employee_nik, e.start_date as employee_start_date, e.status as employee_status,
                e.daily_wage, e.overtime_hourly_wage
         FROM project_assignments pa
         JOIN employees e ON pa.employee_id = e.id
         WHERE pa.id = $1`,
        [assignmentId]
      );
      return mapProjectAssignment(full.rows[0]);
    });
  },

  // Update Project Employee (Retains historical logs, safely deactivates without deletion)
  async updateProjectEmployee(
    projectId: string,
    assignmentId: string,
    data: {
      name?: string;
      phone?: string;
      nik?: string;
      role?: string;
      startDate?: string;
      dailyWage?: number;
      overtimeHourlyWage?: number;
      status?: 'active' | 'inactive';
      notes?: string;
    },
    userName: string,
    userRole: string
  ): Promise<ProjectAssignment> {
    const asgRes = await query(
      'SELECT pa.*, p.name as project_name FROM project_assignments pa JOIN projects p ON pa.project_id = p.id WHERE pa.id = $1 AND pa.project_id = $2',
      [assignmentId, projectId]
    );
    if (!asgRes.rows.length) throw new Error('Penugasan karyawan proyek tidak ditemukan.');
    const asg = asgRes.rows[0];
    const empId = asg.employee_id;

    return withTransaction(async (client) => {
      // 1. Update assignment status and role in project first
      await client.query(
        `UPDATE project_assignments SET
          role_in_project = COALESCE($1, role_in_project),
          status = COALESCE($2, status),
          notes = COALESCE($3, notes)
         WHERE id = $4`,
        [data.role || asg.role_in_project, data.status || asg.status, data.notes !== undefined ? data.notes : asg.notes, assignmentId]
      );

      // Determine effective master employee status across all projects
      let effectiveEmpStatus: string | null = data.status || null;
      if (data.status === 'inactive') {
        const otherActive = await client.query(
          `SELECT COUNT(*)::int AS cnt FROM project_assignments WHERE employee_id = $1 AND status = 'active'`,
          [empId]
        );
        effectiveEmpStatus = (otherActive.rows[0]?.cnt || 0) > 0 ? 'active' : 'inactive';
      } else if (data.status === 'active') {
        effectiveEmpStatus = 'active';
      }

      // 2. Update employee record
      const targetRole = data.role || asg.role_in_project;
      const isDriverTarget = isDriverRole(targetRole);
      const effectiveOvertimeRate = isDriverTarget
        ? 0
        : (data.overtimeHourlyWage !== undefined && data.overtimeHourlyWage !== null ? Number(data.overtimeHourlyWage) : null);

      await client.query(
        `UPDATE employees SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          nik = COALESCE($3, nik),
          role = COALESCE($4, role),
          start_date = COALESCE($5, start_date),
          daily_wage = COALESCE($6, daily_wage),
          overtime_hourly_wage = CASE WHEN LOWER(COALESCE($4, role)) = 'driver' THEN 0 ELSE COALESCE($7, overtime_hourly_wage) END,
          status = COALESCE($8, status),
          notes = COALESCE($9, notes)
         WHERE id = $10`,
        [
          data.name?.trim(),
          data.phone?.trim(),
          data.nik !== undefined ? data.nik.trim() : null,
          data.role,
          data.startDate,
          data.dailyWage !== undefined && data.dailyWage !== null ? Number(data.dailyWage) : null,
          effectiveOvertimeRate,
          effectiveEmpStatus,
          data.notes,
          empId,
        ]
      );

      if (isDriverTarget) {
        await client.query(
          `UPDATE attendance
           SET employee_role = $1,
               overtime_wage_snapshot = 0,
               total_daily_pay = (
                 CASE
                   WHEN status = 'Hadir' THEN ROUND(daily_wage_snapshot)
                   WHEN status = 'Setengah Hari' THEN ROUND(daily_wage_snapshot / 2.0)
                   ELSE 0
                 END
               )
           WHERE employee_id = $2`,
          [targetRole, empId]
        );
        await client.query(
          `UPDATE overtime_records
           SET employee_role = $1,
               hourly_rate_snapshot = 0,
               total_pay = 0
           WHERE employee_id = $2`,
          [targetRole, empId]
        );
      } else {
        // Repair any 0-rate overtime snapshots if overtimeHourlyWage > 0 was provided
        const newOtRate = effectiveOvertimeRate ?? 0;
        if (newOtRate > 0) {
          await client.query(
            `UPDATE attendance
             SET overtime_wage_snapshot = $1,
                 total_daily_pay = (
                   CASE
                     WHEN status = 'Hadir' THEN ROUND(daily_wage_snapshot)
                     WHEN status = 'Setengah Hari' THEN ROUND(daily_wage_snapshot / 2.0)
                     ELSE 0
                   END
                 ) + (
                   CASE
                     WHEN overtime_hours > 0 AND overtime_approved = true THEN ROUND((ROUND(overtime_hours * 60.0) * $1) / 60.0)
                     ELSE 0
                   END
                 )
             WHERE employee_id = $2 AND overtime_wage_snapshot = 0`,
            [newOtRate, empId]
          );
          await client.query(
            `UPDATE overtime_records
             SET hourly_rate_snapshot = $1,
                 total_pay = ROUND((ROUND(hours * 60.0) * $1) / 60.0)
             WHERE employee_id = $2 AND hours > 0 AND (hourly_rate_snapshot = 0 OR total_pay = 0)`,
            [newOtRate, empId]
          );
        }
      }

      await insertAuditLog(
        userName,
        userRole as any,
        'Ubah Data Karyawan Proyek',
        'Karyawan',
        `Memperbarui data karyawan ${data.name || asg.employee_id} pada proyek ${asg.project_name}`
      );

      const full = await client.query(
        `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
                e.nik as employee_nik, e.start_date as employee_start_date, e.status as employee_status,
                e.daily_wage, e.overtime_hourly_wage
         FROM project_assignments pa
         JOIN employees e ON pa.employee_id = e.id
         WHERE pa.id = $1`,
        [assignmentId]
      );
      return mapProjectAssignment(full.rows[0]);
    });
  },

  async assignEmployeeToProject(
    projectId: string,
    data: { employeeId: string; roleInProject?: string; assignedDate?: string; notes?: string },
    userName: string,
    userRole: string
  ): Promise<ProjectAssignment> {
    const empRes = await query('SELECT id, name, role FROM employees WHERE id = $1', [data.employeeId]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const emp = empRes.rows[0];

    const projRes = await query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
    if (!projRes.rows.length) throw new Error('Proyek tidak ditemukan.');
    const proj = projRes.rows[0];

    const existing = await query(
      'SELECT id, status FROM project_assignments WHERE project_id = $1 AND employee_id = $2',
      [projectId, data.employeeId]
    );

    let res;
    if (existing.rows.length > 0) {
      res = await query(
        `UPDATE project_assignments
         SET status = 'active', role_in_project = COALESCE($1, role_in_project),
             assigned_date = COALESCE($2, assigned_date), notes = COALESCE($3, notes)
         WHERE id = $4 RETURNING *`,
        [
          data.roleInProject || emp.role || 'Anggota Proyek',
          data.assignedDate || new Date().toISOString().split('T')[0],
          data.notes || '',
          existing.rows[0].id,
        ]
      );
    } else {
      const id = `PASG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      res = await query(
        `INSERT INTO project_assignments (id, project_id, employee_id, role_in_project, assigned_date, status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW()) RETURNING *`,
        [
          id,
          projectId,
          data.employeeId,
          data.roleInProject || emp.role || 'Anggota Proyek',
          data.assignedDate || new Date().toISOString().split('T')[0],
          data.notes || '',
        ]
      );
    }

    // Ensure master employee is marked active when assigned to a project
    await query(`UPDATE employees SET status = 'active' WHERE id = $1`, [data.employeeId]);

    await insertAuditLog(
      userName,
      userRole as any,
      'Penugasan Proyek',
      'Proyek',
      `Menugaskan karyawan ${emp.name} (${emp.id}) ke proyek ${proj.name}`
    );

    const full = await query(
      `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
              e.nik as employee_nik, e.start_date as employee_start_date, e.status as employee_status,
              e.daily_wage, e.overtime_hourly_wage
       FROM project_assignments pa
       JOIN employees e ON pa.employee_id = e.id
       WHERE pa.id = $1`,
      [res.rows[0].id]
    );
    return mapProjectAssignment(full.rows[0]);
  },

  async updateProjectAssignment(
    id: string,
    data: { roleInProject?: string; status?: string; notes?: string },
    userName: string,
    userRole: string
  ): Promise<ProjectAssignment> {
    const res = await query(
      `UPDATE project_assignments
       SET role_in_project = COALESCE($1, role_in_project),
           status = COALESCE($2, status),
           notes = COALESCE($3, notes)
       WHERE id = $4 RETURNING *`,
      [data.roleInProject, data.status, data.notes, id]
    );
    if (!res.rows.length) throw new Error('Penugasan proyek tidak ditemukan.');
    const empId = res.rows[0].employee_id;

    if (data.status === 'active') {
      await query(`UPDATE employees SET status = 'active' WHERE id = $1`, [empId]);
    } else if (data.status === 'inactive' || data.status === 'completed' || data.status === 'transferred') {
      const otherActive = await query(
        `SELECT COUNT(*)::int AS cnt FROM project_assignments WHERE employee_id = $1 AND status = 'active'`,
        [empId]
      );
      if ((otherActive.rows[0]?.cnt || 0) === 0) {
        await query(`UPDATE employees SET status = 'inactive' WHERE id = $1`, [empId]);
      }
    }

    const full = await query(
      `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
              e.nik as employee_nik, e.start_date as employee_start_date, e.status as employee_status,
              e.daily_wage, e.overtime_hourly_wage
       FROM project_assignments pa
       JOIN employees e ON pa.employee_id = e.id
       WHERE pa.id = $1`,
      [id]
    );
    await insertAuditLog(userName, userRole as any, 'Ubah Penugasan Proyek', 'Proyek', `Memperbarui status penugasan ID: ${id}`);
    return mapProjectAssignment(full.rows[0]);
  },

  async removeProjectAssignment(
    id: string,
    userName: string,
    userRole: string
  ): Promise<{
    deletedPermanently: boolean;
    employeeId: string;
    employeeName: string;
    transactionCounts: { att_count: number; ot_count: number; kb_count: number; pay_count: number };
    message: string;
  }> {
    await ensureAllSchemasOnce();
    return withTransaction(async (client) => {
      const check = await client.query(
        'SELECT pa.*, e.name as emp_name FROM project_assignments pa JOIN employees e ON pa.employee_id = e.id WHERE pa.id = $1 FOR UPDATE',
        [id]
      );
      if (!check.rows.length) throw new Error('Penugasan tidak ditemukan.');
      const row = check.rows[0];
      const empId = row.employee_id;
      const empName = row.emp_name;

      // 1. Remove assignment from this project
      await client.query('DELETE FROM project_assignments WHERE id = $1', [id]);

      // 2. Check if employee has ANY assignments in other projects
      const otherAllRes = await client.query(
        `SELECT
          COUNT(*)::int AS total_cnt,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_cnt
         FROM project_assignments WHERE employee_id = $1`,
        [empId]
      );
      const remainingTotalAssignments = Number(otherAllRes.rows[0]?.total_cnt || 0);
      const remainingActiveCount = Number(otherAllRes.rows[0]?.active_cnt || 0);

      // 3. Check if employee has ANY valid historical transactions across all financial/operational tables
      const txRes = await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM attendance WHERE employee_id = $1) AS att_count,
          (SELECT COUNT(*)::int FROM overtime_records WHERE employee_id = $1) AS ot_count,
          (SELECT COUNT(*)::int FROM kasbon_records WHERE employee_id = $1) AS kb_count,
          (SELECT COUNT(*)::int FROM kasbon_deductions WHERE employee_id = $1) AS kd_count,
          (SELECT COUNT(*)::int FROM salary_payments WHERE employee_id = $1) AS pay_count`,
        [empId]
      );
      const counts = txRes.rows[0] || { att_count: 0, ot_count: 0, kb_count: 0, kd_count: 0, pay_count: 0 };
      const totalTx =
        Number(counts.att_count || 0) +
        Number(counts.ot_count || 0) +
        Number(counts.kb_count || 0) +
        Number(counts.kd_count || 0) +
        Number(counts.pay_count || 0);

      // Case A: Employee has 0 transactions AND 0 other project assignments -> PERMANENTLY delete from master employees table!
      if (totalTx === 0 && remainingTotalAssignments === 0) {
        await client.query('DELETE FROM employees WHERE id = $1', [empId]);
        await insertAuditLog(
          userName,
          userRole as any,
          'Hapus Permanen Karyawan Proyek',
          'Karyawan',
          `Menghapus permanen karyawan salah input / tanpa riwayat transaksi dari proyek & database: ${empName} (${empId})`
        );
        return {
          deletedPermanently: true,
          employeeId: empId,
          employeeName: empName,
          transactionCounts: counts,
          message: `Data karyawan "${empName}" (${empId}) belum memiliki riwayat transaksi dan telah dihapus permanen dari proyek serta database.`,
        };
      }

      // Case B: Employee has valid historical transactions (or is assigned to another project)
      // Keep master employee record for historical integrity, set status = 'inactive' if no active assignments remain.
      if (remainingActiveCount === 0) {
        await client.query(`UPDATE employees SET status = 'inactive' WHERE id = $1`, [empId]);
      }

      await insertAuditLog(
        userName,
        userRole as any,
        'Lepas Penugasan Proyek',
        'Proyek',
        `Melepas penugasan karyawan ${empName} (${empId}) dari proyek${
          remainingActiveCount === 0
            ? ` dan menonaktifkan status karyawan (riwayat ${counts.att_count} absensi, ${counts.kb_count} kasbon, ${counts.pay_count} gaji tetap terjaga)`
            : ''
        }`
      );

      return {
        deletedPermanently: false,
        employeeId: empId,
        employeeName: empName,
        transactionCounts: counts,
        message:
          remainingActiveCount === 0
            ? `Karyawan "${empName}" (${empId}) dilepas dari proyek dan dinonaktifkan. Riwayat transaksi (${counts.att_count} absensi, ${counts.ot_count} lembur, ${counts.kb_count} kasbon, ${counts.pay_count} slip gaji) tetap tersimpan aman untuk laporan keuangan.`
            : `Penugasan "${empName}" (${empId}) pada proyek ini telah dihapus (karyawan masih aktif di proyek lain).`,
      };
    });
  },

  // 3C. Project Expenses (Biaya Transportasi & Pengeluaran Operasional Proyek)
  async getProjectExpenses(projectId: string, expenseType?: 'transportasi' | 'operasional'): Promise<ProjectExpense[]> {
    let sql = 'SELECT * FROM project_expenses WHERE project_id = $1';
    const params: any[] = [projectId];
    if (expenseType) {
      sql += ' AND expense_type = $2';
      params.push(expenseType);
    }
    sql += ' ORDER BY date DESC, created_at DESC';

    const res = await query(sql, params);
    if (!res.rows.length) return [];

    const expIds = res.rows.map((r) => r.id);
    const attRes = await query(
      'SELECT * FROM project_expense_attachments WHERE expense_id = ANY($1) ORDER BY created_at ASC',
      [expIds]
    );
    const attMap: Record<string, any[]> = {};
    for (const a of attRes.rows) {
      if (!attMap[a.expense_id]) attMap[a.expense_id] = [];
      attMap[a.expense_id].push(a);
    }

    return res.rows.map((row) => {
      row.attachments = attMap[row.id] || [];
      return mapProjectExpense(row);
    });
  },

  async createProjectExpense(
    data: Partial<ProjectExpense>,
    attachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }>,
    userName: string,
    userRole: string
  ): Promise<ProjectExpense> {
    const countRes = await query('SELECT COUNT(*) FROM project_expenses');
    const nextSeq = Number(countRes.rows[0]?.count || 0) + 1;
    const prefix = data.expenseType === 'transportasi' ? 'TRP' : 'PRJ-EXP';
    const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
    const txNum = `${prefix}-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}-${randomSuffix}`;
    const id = `PEXP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const res = await query(
      `INSERT INTO project_expenses
        (id, transaction_number, project_id, expense_type, date, category, transport_type, destination, pic_name, description, amount, payment_method, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       RETURNING *`,
      [
        id,
        txNum,
        data.projectId,
        data.expenseType || 'transportasi',
        data.date || new Date().toISOString().split('T')[0],
        data.category || (data.expenseType === 'transportasi' ? 'Bensin' : 'Operasional'),
        data.transportType || null,
        data.destination || null,
        data.picName || userName,
        data.description || '',
        Number(data.amount || 0),
        data.paymentMethod || 'Tunai',
        data.notes || '',
        userName,
      ]
    );

    const savedAttachments: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const attId = `PEATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const attRes = await query(
          `INSERT INTO project_expense_attachments
            (id, expense_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [attId, id, att.fileName, att.filePath, att.fileSize, att.mimeType, userName]
        );
        savedAttachments.push(attRes.rows[0]);
      }
    }

    const row = res.rows[0];
    row.attachments = savedAttachments;
    await insertAuditLog(
      userName,
      userRole as any,
      'Tambah Pengeluaran Proyek',
      'Proyek',
      `Mencatat ${data.expenseType}: ${txNum} senilai Rp ${Number(data.amount || 0).toLocaleString('id-ID')}`
    );

    return mapProjectExpense(row);
  },

  async deleteProjectExpense(id: string, userName: string, userRole: string, projectId?: string): Promise<void> {
    let sql = 'SELECT * FROM project_expenses WHERE id = $1';
    const params: any[] = [id];
    if (projectId) {
      sql += ' AND project_id = $2';
      params.push(projectId);
    }
    const res = await query(sql, params);
    if (!res.rows.length) throw new Error('Pengeluaran proyek tidak ditemukan.');
    const exp = res.rows[0];

    const atts = await query('SELECT * FROM project_expense_attachments WHERE expense_id = $1', [id]);
    for (const a of atts.rows) {
      try {
        await deleteFromStorage(a.file_path);
      } catch (e) {
        console.warn('Could not delete storage file:', a.file_path);
      }
    }
    await query('DELETE FROM project_expense_attachments WHERE expense_id = $1', [id]);
    await query('DELETE FROM project_expenses WHERE id = $1', [id]);

    await insertAuditLog(
      userName,
      userRole as any,
      'Hapus Pengeluaran Proyek',
      'Proyek',
      `Menghapus pengeluaran proyek ${exp.transaction_number} (${exp.category}) senilai Rp ${Number(exp.amount).toLocaleString('id-ID')}`
    );
  },

  async updateProjectExpense(
    id: string,
    data: Partial<ProjectExpense>,
    attachmentsToKeep: string[],
    newAttachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }>,
    userName: string,
    userRole: string,
    projectId?: string
  ): Promise<ProjectExpense> {
    let sql = 'SELECT * FROM project_expenses WHERE id = $1';
    const params: any[] = [id];
    if (projectId) {
      sql += ' AND project_id = $2';
      params.push(projectId);
    }
    const res = await query(sql, params);
    if (!res.rows.length) throw new Error('Pengeluaran proyek tidak ditemukan.');
    const exp = res.rows[0];

    // Find existing attachments
    const existingAtts = await query('SELECT * FROM project_expense_attachments WHERE expense_id = $1', [id]);
    const attachmentsToRemove = existingAtts.rows.filter((a) => !attachmentsToKeep.includes(a.id));

    // Delete removed attachments from Supabase storage and DB
    for (const a of attachmentsToRemove) {
      try {
        await deleteFromStorage(a.file_path);
      } catch (e) {
        console.warn('Could not delete storage file:', a.file_path);
      }
      await query('DELETE FROM project_expense_attachments WHERE id = $1', [a.id]);
    }

    // Insert newly uploaded attachments
    for (const att of newAttachments) {
      const attId = `PEATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      await query(
        `INSERT INTO project_expense_attachments
          (id, expense_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [attId, id, att.fileName, att.filePath, att.fileSize, att.mimeType, userName]
      );
    }

    // Update project_expenses
    const updateRes = await query(
      `UPDATE project_expenses SET
        date = COALESCE($1, date),
        category = COALESCE($2, category),
        transport_type = $3,
        destination = $4,
        pic_name = COALESCE($5, pic_name),
        description = COALESCE($6, description),
        amount = COALESCE($7, amount),
        payment_method = COALESCE($8, payment_method),
        notes = COALESCE($9, notes)
       WHERE id = $10 RETURNING *`,
      [
        data.date || null,
        data.category || null,
        data.transportType !== undefined ? data.transportType : exp.transport_type,
        data.destination !== undefined ? data.destination : exp.destination,
        data.picName || null,
        data.description || null,
        data.amount !== undefined ? Number(data.amount) : exp.amount,
        data.paymentMethod || null,
        data.notes !== undefined ? data.notes : exp.notes,
        id,
      ]
    );

    const updatedRow = updateRes.rows[0];
    const finalAtts = await query('SELECT * FROM project_expense_attachments WHERE expense_id = $1 ORDER BY created_at ASC', [id]);
    updatedRow.attachments = finalAtts.rows;

    await insertAuditLog(
      userName,
      userRole as any,
      'Ubah Pengeluaran Proyek',
      'Proyek',
      `Memperbarui pengeluaran proyek ${exp.transaction_number} (${data.category || exp.category}) senilai Rp ${Number(data.amount !== undefined ? data.amount : exp.amount).toLocaleString('id-ID')}`
    );

    return mapProjectExpense(updatedRow);
  },

  async getProjectExpenseAttachmentById(id: string): Promise<OperationalExpenseAttachment | null> {
    const res = await query('SELECT * FROM project_expense_attachments WHERE id = $1', [id]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      expenseId: r.expense_id,
      fileName: r.file_name,
      filePath: r.file_path,
      fileSize: Number(r.file_size || 0),
      mimeType: r.mime_type || 'image/jpeg',
      uploadedBy: r.uploaded_by || '',
      createdAt: r.created_at ? (typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString()) : '',
      viewUrl: `/api/projects/expenses/attachments/${r.id}/view`,
    };
  },

  // 3D. Project Overview Statistics (Calculated strictly from real database records)
  async getProjectStats(projectId: string, todayDate?: string): Promise<ProjectOverviewStats> {
    const today = todayDate || new Date().toISOString().split('T')[0];

    const pRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!pRes.rows.length) throw new Error('Proyek tidak ditemukan.');
    const project = pRes.rows[0];
    const budget = Number(project.budget || 0);

    const assignRes = await query(
      `SELECT pa.employee_id
       FROM project_assignments pa
       JOIN employees e ON pa.employee_id = e.id
       WHERE pa.project_id = $1 AND pa.status = 'active' AND e.status = 'active'`,
      [projectId]
    );
    const assignedEmpIds: string[] = assignRes.rows.map((r) => r.employee_id);
    const totalAssignedEmployees = assignedEmpIds.length;

    let presentToday = 0;
    let absentToday = 0;
    if (assignedEmpIds.length > 0) {
      const attRes = await query(
        `SELECT status, employee_id FROM attendance
         WHERE date = $1 AND (project_id = $2 OR (project_id IS NULL AND employee_id = ANY($3)))`,
        [today, projectId, assignedEmpIds]
      );
      presentToday = attRes.rows.filter((r) => r.status === 'Hadir' || r.status === 'Setengah Hari').length;
      const explicitAbsent = attRes.rows.filter(
        (r) => r.status === 'Sakit' || r.status === 'Izin' || r.status === 'Alpa' || r.status === 'Tidak Hadir' || r.status === 'Libur'
      ).length;
      absentToday = Math.max(explicitAbsent, totalAssignedEmployees - presentToday);
    }

    let overtimeCount = 0;
    const otRes = await query(
      assignedEmpIds.length > 0
        ? `SELECT COUNT(DISTINCT employee_id) as emp_count
           FROM overtime_records
           WHERE (project_id = $1 OR employee_id = ANY($2)) AND status = 'Disetujui'`
        : `SELECT COUNT(DISTINCT employee_id) as emp_count
           FROM overtime_records
           WHERE project_id = $1 AND status = 'Disetujui'`,
      assignedEmpIds.length > 0 ? [projectId, assignedEmpIds] : [projectId]
    );
    overtimeCount = Number(otRes.rows[0]?.emp_count || 0);

    let totalKasbon = 0;
    const kbRes = await query(
      assignedEmpIds.length > 0
        ? `SELECT SUM(remaining_amount) as total_sisa
           FROM kasbon_records
           WHERE (project_id = $1 OR (project_id IS NULL AND employee_id = ANY($2)))
             AND (status = 'Disetujui' OR status = 'Dipotong sebagian')`
        : `SELECT SUM(remaining_amount) as total_sisa
           FROM kasbon_records
           WHERE project_id = $1
             AND (status = 'Disetujui' OR status = 'Dipotong sebagian')`,
      assignedEmpIds.length > 0 ? [projectId, assignedEmpIds] : [projectId]
    );
    totalKasbon = Number(kbRes.rows[0]?.total_sisa || 0);

    const trRes = await query(
      `SELECT SUM(amount) as total FROM project_expenses WHERE project_id = $1 AND expense_type = 'transportasi'`,
      [projectId]
    );
    const totalTransportationCost = Number(trRes.rows[0]?.total || 0);

    const opRes = await query(
      `SELECT SUM(amount) as total FROM project_expenses WHERE project_id = $1 AND expense_type = 'operasional'`,
      [projectId]
    );
    const totalOperationalCost = Number(opRes.rows[0]?.total || 0);

    const totalExpenses = totalTransportationCost + totalOperationalCost;
    const budgetRemaining = budget - totalExpenses;
    const realizationPercentage = budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;

    return {
      totalAssignedEmployees,
      presentToday,
      absentToday,
      overtimeCount,
      totalKasbon,
      totalTransportationCost,
      totalOperationalCost,
      budget,
      budgetRemaining,
      realizationPercentage,
    };
  },

  // 3E. Project Detailed Recap for Reports
  async getProjectRecap(projectId: string, startDate?: string, endDate?: string) {
    await ensureAllSchemasOnce();
    const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRes.rows.length) throw new Error('Proyek tidak ditemukan.');
    const project = mapProject(projRes.rows[0]);

    const assignments = await this.getProjectAssignments(projectId);
    const assignedEmpIds = assignments
      .filter((a) => a.status === 'active' && a.employeeStatus !== 'inactive')
      .map((a) => a.employeeId);

    let attSql = `SELECT * FROM attendance WHERE (project_id = $1`;
    const attParams: any[] = [projectId];
    let pIdx = 2;
    if (assignedEmpIds.length > 0) {
      attSql += ` OR (project_id IS NULL AND employee_id = ANY($${pIdx++})))`;
      attParams.push(assignedEmpIds);
    } else {
      attSql += `)`;
    }
    if (startDate && endDate) {
      attSql += ` AND date >= $${pIdx++} AND date <= $${pIdx++}`;
      attParams.push(startDate, endDate);
    }
    attSql += ' ORDER BY date DESC';
    const attRes = await query(attSql, attParams);
    const rawAttendance = attRes.rows.map(mapAttendance);

    // Deduplicate attendance by employeeId + date so no employee is ever double-counted on the same day
    const seenAttKey = new Set<string>();
    const attendance: Attendance[] = [];
    for (const a of rawAttendance) {
      const key = `${a.employeeId}_${a.date}`;
      if (!seenAttKey.has(key)) {
        seenAttKey.add(key);
        attendance.push(a);
      }
    }

    let otSql = `SELECT * FROM overtime_records WHERE (project_id = $1`;
    const otParams: any[] = [projectId];
    pIdx = 2;
    if (assignedEmpIds.length > 0) {
      otSql += ` OR employee_id = ANY($${pIdx++}))`;
      otParams.push(assignedEmpIds);
    } else {
      otSql += `)`;
    }
    if (startDate && endDate) {
      otSql += ` AND date >= $${pIdx++} AND date <= $${pIdx++}`;
      otParams.push(startDate, endDate);
    }
    otSql += ' ORDER BY date DESC';
    const otRes = await query(otSql, otParams);
    const overtime = otRes.rows.map(mapOvertime);

    const kbRes = await query(
      assignedEmpIds.length > 0
        ? `SELECT * FROM kasbon_records WHERE project_id = $1 OR employee_id = ANY($2) ORDER BY request_date DESC`
        : `SELECT * FROM kasbon_records WHERE project_id = $1 ORDER BY request_date DESC`,
      assignedEmpIds.length > 0 ? [projectId, assignedEmpIds] : [projectId]
    );
    const kasbon: KasbonRecord[] = kbRes.rows.map(mapKasbon);

    const expenses = await this.getProjectExpenses(projectId);
    const filteredExpenses = (startDate && endDate)
      ? expenses.filter((e) => e.date >= startDate && e.date <= endDate)
      : expenses;

    const transportExpenses = filteredExpenses.filter((e) => e.expenseType === 'transportasi');
    const operationalExpenses = filteredExpenses.filter((e) => e.expenseType === 'operasional');

    const fullWorkDays = attendance.filter((a) => a.status === 'Hadir').length;
    const halfWorkDays = attendance.filter((a) => a.status === 'Setengah Hari').length;
    const totalWorkDays = fullWorkDays + halfWorkDays * 0.5;
    const fullDaySalary = attendance.reduce((s, a) => (a.status === 'Hadir' ? s + a.dailyWageSnapshot : s), 0);
    const halfDaySalary = attendance.reduce((s, a) => (a.status === 'Setengah Hari' ? s + Math.round(a.dailyWageSnapshot / 2) : s), 0);
    const totalBasicSalary = fullDaySalary + halfDaySalary;

    const approvedOts = overtime.filter((o) => o.status === 'Disetujui');
    const totalOvertimeHours = Number(approvedOts.reduce((s, o) => s + o.hours, 0).toFixed(4));
    const totalOvertimePay = approvedOts.reduce((s, o) => s + (isDriverRole(o.employeeRole) ? 0 : o.totalPay), 0);
    const totalTransport = transportExpenses.reduce((s, e) => s + e.amount, 0);
    const totalOp = operationalExpenses.reduce((s, e) => s + e.amount, 0);
    const totalProjectCost = totalBasicSalary + totalOvertimePay + totalTransport + totalOp;

    return {
      project,
      assignments,
      attendance,
      overtime,
      kasbon,
      transportExpenses,
      operationalExpenses,
      summary: {
        totalEmployees: assignments.filter((a) => a.status === 'active' && a.employeeStatus !== 'inactive').length,
        fullWorkDays,
        halfWorkDays,
        totalWorkDays,
        fullDaySalary,
        halfDaySalary,
        totalBasicSalary,
        totalOvertimeHours,
        totalOvertimePay,
        totalTransport,
        totalOp,
        totalProjectCost,
        budget: project.budget,
        budgetRemaining: project.budget - totalProjectCost,
        realizationPercentage: project.budget > 0 ? Math.round((totalProjectCost / project.budget) * 100) : 0,
      },
    };
  },

  // 4. Attendance
  async attachKasbonToAttendanceList(atts: Attendance[]): Promise<Attendance[]> {
    if (!atts.length) return atts;
    const attIds = atts.map((a) => a.id);
    const empIds = Array.from(new Set(atts.map((a) => a.employeeId)));

    const kbRes = await query(
      `SELECT * FROM kasbon_records
       WHERE attendance_id = ANY($1) OR employee_id = ANY($2)
       ORDER BY request_date DESC, id DESC`,
      [attIds, empIds]
    );
    if (!kbRes.rows.length) return atts;

    const kbIds = kbRes.rows.map((r) => r.id);
    const attRes = await query(
      `SELECT * FROM kasbon_attachments WHERE kasbon_id = ANY($1) ORDER BY created_at ASC`,
      [kbIds]
    );
    const attMap: Record<string, any[]> = {};
    for (const a of attRes.rows) {
      if (!attMap[a.kasbon_id]) attMap[a.kasbon_id] = [];
      attMap[a.kasbon_id].push(a);
    }

    const kbs: KasbonRecord[] = kbRes.rows.map((row) => {
      row.attachments = attMap[row.id] || [];
      return mapKasbon(row);
    });

    const usedKbIds = new Set<string>();

    // Pass 1: exact attendance_id match
    for (const att of atts) {
      const exact = kbs.find((k) => !usedKbIds.has(k.id) && k.attendanceId === att.id);
      if (exact) {
        usedKbIds.add(exact.id);
        att.kasbonId = exact.id;
        att.kasbonNumber = exact.kasbonNumber;
        att.kasbonAmount = exact.amount;
        att.kasbonNotes = exact.reason;
        att.kasbonStatus = exact.status;
        att.kasbonAttachmentFilePath = exact.attachmentFilePath;
        att.kasbonAttachments = exact.attachments || [];
      }
    }

    // Pass 2: fallback match by (employeeId + requestDate === date) for legacy kasbons without attendanceId
    for (const att of atts) {
      if (att.kasbonId) continue;
      const fallback = kbs.find(
        (k) =>
          !usedKbIds.has(k.id) &&
          !k.attendanceId &&
          k.employeeId === att.employeeId &&
          k.requestDate === att.date &&
          (!att.projectId || !k.projectId || k.projectId === att.projectId)
      );
      if (fallback) {
        usedKbIds.add(fallback.id);
        att.kasbonId = fallback.id;
        att.kasbonNumber = fallback.kasbonNumber;
        att.kasbonAmount = fallback.amount;
        att.kasbonNotes = fallback.reason;
        att.kasbonStatus = fallback.status;
        att.kasbonAttachmentFilePath = fallback.attachmentFilePath;
        att.kasbonAttachments = fallback.attachments || [];
      }
    }

    return atts;
  },

  async syncAttendanceKasbon(
    att: Attendance,
    data: any,
    kasbonAttachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = [],
    userName: string = 'Administrator',
    userRole: string = 'admin',
    prevAtt?: Attendance
  ): Promise<void> {
    if (data.hasKasbon === undefined) return;

    const searchEmpId = prevAtt ? prevAtt.employeeId : att.employeeId;
    const searchDate = prevAtt ? prevAtt.date : att.date;

    const existingRes = await query(
      `SELECT * FROM kasbon_records
       WHERE attendance_id = $1
          OR ($2::varchar IS NOT NULL AND id = $2)
          OR (attendance_id IS NULL AND employee_id = $3 AND request_date = $4 AND (project_id = $5 OR project_id IS NULL OR $5::varchar IS NULL))
       ORDER BY (CASE WHEN attendance_id = $1 THEN 0 WHEN id = $2 THEN 1 ELSE 2 END) ASC, id DESC
       LIMIT 1`,
      [att.id, data.kasbonId || null, searchEmpId, searchDate, att.projectId || null]
    );
    const existingKb = existingRes.rows[0] || null;

    if (data.hasKasbon === true || data.hasKasbon === 'true' || data.hasKasbon === 'Ya') {
      const amount = Number(data.kasbonAmount || 0);
      if (!amount || amount <= 0 || isNaN(amount)) {
        throw new Error('Nominal kasbon wajib diisi dan harus lebih besar dari Rp0.');
      }
      const reason = (data.kasbonNotes ?? data.kasbonReason ?? '').trim() || 'Kasbon melalui absensi proyek';

      if (existingKb) {
        const deducted = Number(existingKb.deducted_amount || 0);
        if (amount < deducted) {
          throw new Error(
            `Nominal kasbon (Rp ${amount.toLocaleString('id-ID')}) tidak boleh lebih kecil dari nominal yang sudah dipotong gaji (Rp ${deducted.toLocaleString('id-ID')}).`
          );
        }

        const empRes = await query('SELECT * FROM employees WHERE id = $1', [att.employeeId]);
        const emp = empRes.rows.length ? mapEmployee(empRes.rows[0]) : null;

        let filePath: string | null = existingKb.attachment_file_path || null;
        let fileName: string | null = existingKb.attachment_file_name || null;
        let fileSize: number | null = existingKb.attachment_file_size ? Number(existingKb.attachment_file_size) : null;
        let mimeType: string | null = existingKb.attachment_mime_type || null;

        if (kasbonAttachments && kasbonAttachments.length > 0) {
          // Replace existing attachments with new uploaded photo
          const oldAtts = await query('SELECT * FROM kasbon_attachments WHERE kasbon_id = $1', [existingKb.id]);
          for (const oa of oldAtts.rows) {
            try {
              await deleteFromStorage(oa.file_path);
            } catch (e) {
              console.warn('Could not delete old kasbon attachment:', oa.file_path);
            }
          }
          await query('DELETE FROM kasbon_attachments WHERE kasbon_id = $1', [existingKb.id]);

          for (const newAtt of kasbonAttachments) {
            const attId = `KATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
            await query(
              `INSERT INTO kasbon_attachments (id, kasbon_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
              [attId, existingKb.id, newAtt.fileName, newAtt.filePath, newAtt.fileSize, newAtt.mimeType, userName]
            );
          }

          filePath = kasbonAttachments[0].filePath;
          fileName = kasbonAttachments[0].fileName;
          fileSize = kasbonAttachments[0].fileSize;
          mimeType = kasbonAttachments[0].mimeType;
        } else if (data.removeKasbonPhoto === true) {
          const oldAtts = await query('SELECT * FROM kasbon_attachments WHERE kasbon_id = $1', [existingKb.id]);
          for (const oa of oldAtts.rows) {
            try {
              await deleteFromStorage(oa.file_path);
            } catch (e) {
              console.warn('Could not delete old kasbon attachment:', oa.file_path);
            }
          }
          if (existingKb.attachment_file_path) {
            try {
              await deleteFromStorage(existingKb.attachment_file_path);
            } catch (e) {
              console.warn('Could not delete main kasbon attachment:', existingKb.attachment_file_path);
            }
          }
          await query('DELETE FROM kasbon_attachments WHERE kasbon_id = $1', [existingKb.id]);
          filePath = null;
          fileName = null;
          fileSize = null;
          mimeType = null;
        }

        const remaining = Math.max(0, amount - deducted);
        const newStatus =
          deducted >= amount && amount > 0
            ? 'Lunas'
            : deducted > 0
            ? 'Dipotong sebagian'
            : existingKb.status === 'Ditolak'
            ? 'Disetujui'
            : existingKb.status || 'Disetujui';

        const prevTrail = Array.isArray(existingKb.audit_trail) ? existingKb.audit_trail : [];
        const nextTrail = [
          ...prevTrail,
          {
            timestamp: new Date().toISOString(),
            user: userName,
            action: `Memperbarui kasbon melalui koreksi absensi: Rp ${amount.toLocaleString('id-ID')} (${reason})`,
          },
        ];

        await query(
          `UPDATE kasbon_records SET
             attendance_id = $1,
             request_date = $2,
             employee_id = $3,
             employee_name = $4,
             employee_role = $5,
             project_id = COALESCE($6, project_id),
             amount = $7,
             remaining_amount = $8,
             reason = $9,
             status = $10,
             attachment_file_path = $11,
             attachment_file_name = $12,
             attachment_file_size = $13,
             attachment_mime_type = $14,
             audit_trail = $15
           WHERE id = $16`,
          [
            att.id,
            att.date,
            emp ? emp.id : att.employeeId,
            emp ? emp.name : att.employeeName,
            emp ? emp.role : att.employeeRole,
            att.projectId || null,
            amount,
            remaining,
            reason,
            newStatus,
            filePath,
            fileName,
            fileSize,
            mimeType,
            JSON.stringify(nextTrail),
            existingKb.id,
          ]
        );
      } else {
        await this.createKasbon(
          {
            attendanceId: att.id,
            projectId: att.projectId || null,
            employeeId: att.employeeId,
            requestDate: att.date,
            amount,
            reason,
            status: 'Disetujui',
          },
          userName,
          userRole,
          kasbonAttachments
        );
      }
    } else if (data.hasKasbon === false || data.hasKasbon === 'false' || data.hasKasbon === 'Tidak') {
      if (existingKb) {
        const deducted = Number(existingKb.deducted_amount || 0);
        if (deducted > 0 || existingKb.status === 'Lunas' || existingKb.status === 'Dipotong sebagian') {
          throw new Error(
            `Kasbon ${existingKb.kasbon_number} sudah memiliki potongan gaji (Rp ${deducted.toLocaleString('id-ID')}) sehingga tidak dapat dibatalkan.`
          );
        }
        await this.deleteKasbon(existingKb.id, userName, userRole);
      }
    }
  },

  async getAttendance(params?: { date?: string; startDate?: string; endDate?: string; employeeId?: string; projectId?: string; role?: string }): Promise<Attendance[]> {
    await ensureAllSchemasOnce();
    let sql = 'SELECT * FROM attendance WHERE 1=1';
    const values: any[] = [];
    let idx = 1;

    if (params?.date) {
      sql += ` AND date = $${idx++}`;
      values.push(params.date);
    }
    if (params?.startDate && params?.endDate) {
      sql += ` AND date >= $${idx++} AND date <= $${idx++}`;
      values.push(params.startDate, params.endDate);
    }
    if (params?.employeeId) {
      sql += ` AND employee_id = $${idx++}`;
      values.push(params.employeeId);
    }
    if (params?.projectId) {
      sql += ` AND project_id = $${idx++}`;
      values.push(params.projectId);
    }
    if (params?.role) {
      sql += ` AND employee_role = $${idx++}`;
      values.push(params.role);
    }

    sql += ' ORDER BY date DESC, employee_name ASC';
    const res = await query(sql, values);
    const list = res.rows.map(mapAttendance);
    return this.attachKasbonToAttendanceList(list);
  },

  async createAttendance(
    data: any,
    userName: string,
    userRole: string,
    kasbonAttachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = []
  ): Promise<Attendance> {
    await ensureAllSchemasOnce();
    const empRes = await query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const emp = mapEmployee(empRes.rows[0]);

    if (data.hasKasbon === true || data.hasKasbon === 'true' || data.hasKasbon === 'Ya') {
      const kAmount = Number(data.kasbonAmount || 0);
      if (!kAmount || kAmount <= 0 || isNaN(kAmount)) {
        throw new Error('Nominal kasbon wajib diisi dan harus lebih besar dari Rp0.');
      }
    }

    // Prevent double-counting on the same date: if already exists for (date, employee_id), update it!
    const existingRes = await query('SELECT id FROM attendance WHERE date = $1 AND employee_id = $2 LIMIT 1', [
      data.date,
      emp.id,
    ]);
    if (existingRes.rows.length > 0) {
      return this.updateAttendance(existingRes.rows[0].id, data, userName, userRole, kasbonAttachments);
    }

    if (emp.status === 'inactive') {
      throw new Error(
        `Karyawan "${emp.name}" (${emp.id}) berstatus Nonaktif atau sudah dilepas dari proyek sehingga tidak dapat dicatat absensi baru.`
      );
    }

    const id = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const status = data.status || 'Hadir';
    const isWorkingStatus = status === 'Hadir' || status === 'Setengah Hari';
    const checkIn = isWorkingStatus ? (data.checkIn || '08:00') : '-';
    const checkOut = isWorkingStatus ? (data.checkOut || (status === 'Setengah Hari' ? '12:00' : '16:00')) : '-';
    const overtimeHours = isWorkingStatus ? resolveOvertimeDecimalHours(data) : 0;
    const isApprovedOt = userRole === 'admin' && overtimeHours > 0;

    const isDriver = isDriverRole(emp.role);
    const effectiveOtWage = isDriver ? 0 : emp.overtimeHourlyWage;
    const basicPay = calcBasicPayByStatus(status, emp.dailyWage);
    const overtimePay = isApprovedOt && !isDriver ? calcOvertimePayExact(overtimeHours, effectiveOtWage, undefined, undefined, emp.role) : 0;
    const totalDailyPay = basicPay + overtimePay;

    const res = await query(
      `INSERT INTO attendance (
        id, date, employee_id, employee_name, employee_role, project_id, project_name,
        status, check_in, check_out, overtime_hours, overtime_approved,
        daily_wage_snapshot, overtime_wage_snapshot, total_daily_pay,
        notes, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      RETURNING *`,
      [
        id, data.date, emp.id, emp.name, emp.role, data.projectId || null, data.projectName || null,
        status, checkIn, checkOut, overtimeHours, isApprovedOt,
        emp.dailyWage, effectiveOtWage, totalDailyPay,
        data.notes || '', userName,
      ]
    );

    // Sync with overtime_records if overtimeHours > 0 (without duplicating)
    if (overtimeHours > 0) {
      const totalOtPay = isDriver ? 0 : calcOvertimePayExact(overtimeHours, effectiveOtWage, undefined, undefined, emp.role);
      const existingOt = await query(
        'SELECT id FROM overtime_records WHERE attendance_id = $1 OR (employee_id = $2 AND date = $3) LIMIT 1',
        [id, emp.id, data.date]
      );
      if (existingOt.rows.length > 0) {
        await query(
          `UPDATE overtime_records SET
            attendance_id = $1, hours = $2, hourly_rate_snapshot = $3, total_pay = $4,
            status = $5, approved_by = $6, approved_at = NOW(), notes = COALESCE($7, notes)
           WHERE id = $8`,
          [
            id, overtimeHours, effectiveOtWage, totalOtPay,
            isApprovedOt ? 'Disetujui' : 'Menunggu persetujuan',
            isApprovedOt ? userName : null,
            data.notes || null,
            existingOt.rows[0].id,
          ]
        );
      } else {
        const otId = `OVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        await query(
          `INSERT INTO overtime_records (
            id, attendance_id, date, employee_id, employee_name, employee_role,
            project_id, project_name, start_time, end_time, hours,
            hourly_rate_snapshot, total_pay, status, approved_by, approved_at, notes, audit_trail
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, $17)`,
          [
            otId, id, data.date, emp.id, emp.name, emp.role,
            data.projectId || null, data.projectName || null, checkOut !== '-' ? checkOut : '16:00', '',
            overtimeHours, effectiveOtWage, totalOtPay,
            isApprovedOt ? 'Disetujui' : 'Menunggu persetujuan',
            isApprovedOt ? userName : null,
            data.notes || 'Lembur dari absensi harian',
            JSON.stringify([{ timestamp: new Date().toISOString(), user: userName, action: 'Lembur tercatat dari absensi' }]),
          ]
        );
      }
    }

    const createdAtt = mapAttendance(res.rows[0]);
    await this.syncAttendanceKasbon(createdAtt, data, kasbonAttachments, userName, userRole);

    await insertAuditLog(
      userName,
      userRole as any,
      'Catat Absensi',
      'Absensi',
      `Mencatat absensi ${emp.name} (${status}, lembur ${overtimeHours} jam) pada ${data.date}`
    );

    const enriched = await this.attachKasbonToAttendanceList([createdAtt]);
    return enriched[0];
  },

  async createBulkAttendance(date: string, entries: any[], userName: string, userRole: string): Promise<{ created: Attendance[]; skipped: string[] }> {
    await ensureAllSchemasOnce();
    return withTransaction(async (client) => {
      const created: Attendance[] = [];
      const skipped: string[] = [];

      for (const entry of entries) {
        const existing = await client.query('SELECT id FROM attendance WHERE date = $1 AND employee_id = $2', [date, entry.employeeId]);
        if (existing.rows.length > 0) {
          skipped.push(entry.employeeName || entry.employeeId);
          continue;
        }

        const empRes = await client.query('SELECT * FROM employees WHERE id = $1', [entry.employeeId]);
        if (!empRes.rows.length) continue;
        const emp = mapEmployee(empRes.rows[0]);
        if (emp.status === 'inactive') {
          skipped.push(emp.name);
          continue;
        }

        const id = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const status = entry.status || 'Hadir';
        const isWorkingStatus = status === 'Hadir' || status === 'Setengah Hari';
        const checkIn = isWorkingStatus ? (entry.checkIn || '08:00') : '-';
        const checkOut = isWorkingStatus ? (entry.checkOut || (status === 'Setengah Hari' ? '12:00' : '16:00')) : '-';
        const otHours = isWorkingStatus ? resolveOvertimeDecimalHours(entry) : 0;
        const isApprovedOt = userRole === 'admin' && otHours > 0;

        const isDriver = isDriverRole(emp.role);
        const effectiveOtWage = isDriver ? 0 : emp.overtimeHourlyWage;
        const basicPay = calcBasicPayByStatus(status, emp.dailyWage);
        const overtimePay = isApprovedOt && !isDriver ? calcOvertimePayExact(otHours, effectiveOtWage, undefined, undefined, emp.role) : 0;
        const totalPay = basicPay + overtimePay;

        const res = await client.query(
          `INSERT INTO attendance (
            id, date, employee_id, employee_name, employee_role, project_id, project_name,
            status, check_in, check_out, overtime_hours, overtime_approved,
            daily_wage_snapshot, overtime_wage_snapshot, total_daily_pay, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          RETURNING *`,
          [
            id, date, emp.id, emp.name, emp.role, entry.projectId || null, entry.projectName || null,
            status, checkIn, checkOut, otHours, isApprovedOt,
            emp.dailyWage, effectiveOtWage, totalPay, entry.notes || '', userName,
          ]
        );
        created.push(mapAttendance(res.rows[0]));

        if (otHours > 0) {
          const totalOtPay = isDriver ? 0 : calcOvertimePayExact(otHours, effectiveOtWage, undefined, undefined, emp.role);
          const otId = `OVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          await client.query(
            `INSERT INTO overtime_records (
              id, attendance_id, date, employee_id, employee_name, employee_role,
              project_id, project_name, start_time, end_time, hours,
              hourly_rate_snapshot, total_pay, status, approved_by, approved_at, notes, audit_trail
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, $17)`,
            [
              otId, id, date, emp.id, emp.name, emp.role,
              entry.projectId || null, entry.projectName || null, checkOut !== '-' ? checkOut : '16:00', '',
              otHours, effectiveOtWage, totalOtPay,
              isApprovedOt ? 'Disetujui' : 'Menunggu persetujuan',
              isApprovedOt ? userName : null,
              entry.notes || 'Lembur dari absensi massal',
              JSON.stringify([{ timestamp: new Date().toISOString(), user: userName, action: 'Lembur tercatat dari absensi massal' }]),
            ]
          );
        }
      }

      await insertAuditLog(userName, userRole as any, 'Catat Absensi Massal', 'Absensi', `Mencatat ${created.length} kehadiran pada tanggal ${date}`);
      return { created, skipped };
    });
  },

  async updateAttendance(
    id: string,
    data: any,
    userName: string,
    userRole: string,
    kasbonAttachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = []
  ): Promise<Attendance> {
    await ensureAllSchemasOnce();
    const currRes = await query('SELECT * FROM attendance WHERE id = $1', [id]);
    if (!currRes.rows.length) throw new Error('Data absensi tidak ditemukan.');
    const prev = mapAttendance(currRes.rows[0]);

    if (data.hasKasbon === true || data.hasKasbon === 'true' || data.hasKasbon === 'Ya') {
      const kAmount = Number(data.kasbonAmount || 0);
      if (!kAmount || kAmount <= 0 || isNaN(kAmount)) {
        throw new Error('Nominal kasbon wajib diisi dan harus lebih besar dari Rp0.');
      }
    }

    let empId = prev.employeeId;
    let empName = prev.employeeName;
    let empRole = prev.employeeRole;
    let dailySnapshot = prev.dailyWageSnapshot;
    let overtimeSnapshot = prev.overtimeWageSnapshot;
    const newDate = data.date || prev.date;

    if (data.employeeId && data.employeeId !== prev.employeeId) {
      const empRes = await query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
      if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
      const newEmp = mapEmployee(empRes.rows[0]);
      const conflictRes = await query(
        'SELECT id FROM attendance WHERE date = $1 AND employee_id = $2 AND id != $3 LIMIT 1',
        [newDate, newEmp.id, id]
      );
      if (conflictRes.rows.length > 0) {
        throw new Error(`Absensi untuk karyawan ${newEmp.name} pada tanggal ${newDate} sudah tercatat.`);
      }
      empId = newEmp.id;
      empName = newEmp.name;
      empRole = newEmp.role;
      dailySnapshot = newEmp.dailyWage;
      overtimeSnapshot = newEmp.overtimeHourlyWage;
    }

    const newStatus = data.status || prev.status;
    const isWorkingStatus = newStatus === 'Hadir' || newStatus === 'Setengah Hari';
    const newCheckIn = isWorkingStatus ? (data.checkIn || (prev.checkIn !== '-' ? prev.checkIn : '08:00')) : '-';
    const newCheckOut = isWorkingStatus
      ? (data.checkOut || (prev.checkOut !== '-' ? prev.checkOut : (newStatus === 'Setengah Hari' ? '12:00' : '16:00')))
      : '-';

    const hasOvertimeInput =
      data.overtimeHours !== undefined || data.durationHours !== undefined || data.durationMinutes !== undefined;
    const newOtHours = isWorkingStatus
      ? (hasOvertimeInput ? resolveOvertimeDecimalHours(data) : prev.overtimeHours)
      : 0;
    const isApprovedOt = newOtHours > 0 ? (userRole === 'admin' || prev.overtimeApproved) : false;

    const isDriver = isDriverRole(empRole);
    const effectiveOtSnapshot = isDriver ? 0 : overtimeSnapshot;
    const basicPay = calcBasicPayByStatus(newStatus, dailySnapshot);
    const overtimePay = isApprovedOt && !isDriver ? calcOvertimePayExact(newOtHours, effectiveOtSnapshot, undefined, undefined, empRole) : 0;
    const totalDailyPay = basicPay + overtimePay;

    const res = await query(
      `UPDATE attendance SET
        date = $1, employee_id = $2, employee_name = $3, employee_role = $4,
        daily_wage_snapshot = $5, overtime_wage_snapshot = $6,
        status = $7, check_in = $8, check_out = $9, overtime_hours = $10,
        overtime_approved = $11, total_daily_pay = $12, notes = COALESCE($13, notes),
        updated_by = $14, updated_at = NOW()
       WHERE id = $15 RETURNING *`,
      [
        newDate, empId, empName, empRole,
        dailySnapshot, effectiveOtSnapshot,
        newStatus, newCheckIn, newCheckOut, newOtHours,
        isApprovedOt, totalDailyPay, data.notes !== undefined ? data.notes : prev.notes,
        userName, id,
      ]
    );

    // Sync linked overtime record
    const existingOt = await query(
      'SELECT * FROM overtime_records WHERE attendance_id = $1 OR (employee_id = $2 AND date = $3) LIMIT 1',
      [id, prev.employeeId, prev.date]
    );
    if (newOtHours > 0) {
      const totalOtPay = isDriver ? 0 : calcOvertimePayExact(newOtHours, effectiveOtSnapshot, undefined, undefined, empRole);
      if (existingOt.rows.length > 0) {
        await query(
          `UPDATE overtime_records SET
            attendance_id = $1, date = $2, employee_id = $3, employee_name = $4, employee_role = $5,
            hourly_rate_snapshot = $6, hours = $7, total_pay = $8,
            status = $9, approved_by = COALESCE(approved_by, $10), approved_at = COALESCE(approved_at, NOW()),
            notes = COALESCE($11, notes)
           WHERE id = $12`,
          [
            id, newDate, empId, empName, empRole,
            effectiveOtSnapshot, newOtHours, totalOtPay,
            isApprovedOt ? 'Disetujui' : existingOt.rows[0].status,
            isApprovedOt ? userName : null,
            data.notes !== undefined ? data.notes : null,
            existingOt.rows[0].id,
          ]
        );
      } else {
        const otId = `OVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        await query(
          `INSERT INTO overtime_records (
            id, attendance_id, date, employee_id, employee_name, employee_role,
            project_id, project_name, start_time, end_time, hours,
            hourly_rate_snapshot, total_pay, status, approved_by, approved_at, notes, audit_trail
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, $17)`,
          [
            otId, id, newDate, empId, empName, empRole,
            prev.projectId || null, prev.projectName || null, newCheckOut !== '-' ? newCheckOut : '16:00', '',
            newOtHours, effectiveOtSnapshot, totalOtPay,
            isApprovedOt ? 'Disetujui' : 'Menunggu persetujuan',
            isApprovedOt ? userName : null,
            data.notes || prev.notes || 'Lembur dari koreksi absensi',
            JSON.stringify([{ timestamp: new Date().toISOString(), user: userName, action: 'Lembur tercatat dari koreksi absensi' }]),
          ]
        );
      }
    } else if (existingOt.rows.length > 0) {
      await query('DELETE FROM overtime_records WHERE id = $1', [existingOt.rows[0].id]);
    }

    const updatedAtt = mapAttendance(res.rows[0]);
    await this.syncAttendanceKasbon(updatedAtt, data, kasbonAttachments, userName, userRole, prev);

    await insertAuditLog(
      userName,
      userRole as any,
      'Koreksi Absensi',
      'Absensi',
      `Koreksi absensi ${empName} (${newDate}): status=${newStatus}, lembur=${newOtHours} jam`
    );

    const enriched = await this.attachKasbonToAttendanceList([updatedAtt]);
    return enriched[0];
  },

  async deleteAttendance(id: string, userName: string, userRole: string, projectId?: string): Promise<Attendance> {
    await ensureAllSchemasOnce();
    return withTransaction(async (client) => {
      const currRes = await client.query('SELECT * FROM attendance WHERE id = $1 FOR UPDATE', [id]);
      if (!currRes.rows.length) {
        const notFoundErr: any = new Error('Data absensi tidak ditemukan.');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      const att = mapAttendance(currRes.rows[0]);

      // 1. Validate project access context if projectId is provided
      if (projectId && att.projectId && att.projectId !== projectId) {
        const projErr: any = new Error(
          'Penghapusan ditolak: Data absensi ini milik proyek lain dan tidak sesuai dengan konteks proyek yang sedang dibuka.'
        );
        projErr.statusCode = 403;
        throw projErr;
      }

      // 2. Check linked active kasbon or kasbon financial history
      const kbRes = await client.query(
        `SELECT id, kasbon_number, amount, deducted_amount, remaining_amount, status
         FROM kasbon_records
         WHERE attendance_id = $1
            OR (attendance_id IS NULL AND employee_id = $2 AND request_date = $3 AND (project_id = $4 OR project_id IS NULL OR $4::varchar IS NULL))
         ORDER BY id DESC LIMIT 1`,
        [att.id, att.employeeId, att.date, att.projectId || null]
      );

      if (kbRes.rows.length > 0) {
        const kb = kbRes.rows[0];
        if (kb.status !== 'Ditolak') {
          const kbErr: any = new Error(
            `Penghapusan ditolak: Absensi ini memiliki transaksi kasbon terkait (${kb.kasbon_number} sebesar Rp ${Number(
              kb.amount || 0
            ).toLocaleString('id-ID')}, status: ${kb.status}). Untuk menjaga riwayat kasbon dan bukti foto, silakan gunakan tombol Edit pada baris absensi untuk mengoreksi status kehadiran atau pengajuan kasbon.`
          );
          kbErr.statusCode = 409;
          throw kbErr;
        }
      }

      // 3. Check if attendance date is already included in a processed or paid biweekly payroll period
      const payRes = await client.query(
        `SELECT id, payment_number, period_start, period_end, status
         FROM salary_payments
         WHERE employee_id = $1
           AND period_start <= $2
           AND period_end >= $2
           AND status != 'Dibatalkan'
         ORDER BY id DESC LIMIT 1`,
        [att.employeeId, att.date]
      );

      if (payRes.rows.length > 0) {
        const pay = payRes.rows[0];
        const pStart =
          typeof pay.period_start === 'string'
            ? pay.period_start.split('T')[0]
            : pay.period_start?.toISOString().split('T')[0] || '';
        const pEnd =
          typeof pay.period_end === 'string'
            ? pay.period_end.split('T')[0]
            : pay.period_end?.toISOString().split('T')[0] || '';
        const payErr: any = new Error(
          `Penghapusan ditolak: Data absensi tanggal ${att.date} sudah masuk ke periode gaji yang telah diproses/dibayarkan (${pay.payment_number}, periode ${pStart} s/d ${pEnd}, status: ${pay.status}). Gunakan mekanisme koreksi penggajian yang sesuai.`
        );
        payErr.statusCode = 409;
        throw payErr;
      }

      // 4. Delete linked overtime record(s) and the attendance record inside the transaction
      await client.query(
        `DELETE FROM overtime_records
         WHERE attendance_id = $1
            OR (attendance_id IS NULL AND employee_id = $2 AND date = $3)`,
        [att.id, att.employeeId, att.date]
      );
      await client.query('DELETE FROM attendance WHERE id = $1', [att.id]);

      await insertAuditLog(
        userName,
        userRole as any,
        'Hapus Absensi',
        'Absensi',
        `Menghapus data absensi ${att.employeeName} (${att.employeeId}) pada tanggal ${att.date}${
          att.projectName ? ` di proyek ${att.projectName}` : ''
        }`
      );

      return att;
    });
  },

  // 5. Overtime
  async getOvertime(): Promise<OvertimeRecord[]> {
    await ensureAllSchemasOnce();
    const res = await query('SELECT * FROM overtime_records ORDER BY date DESC, id DESC');
    return res.rows.map(mapOvertime);
  },

  async createOvertime(data: any, userName: string, userRole: string): Promise<OvertimeRecord> {
    await ensureAllSchemasOnce();
    const empRes = await query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const emp = mapEmployee(empRes.rows[0]);
    if (emp.status === 'inactive') {
      throw new Error(
        `Karyawan "${emp.name}" (${emp.id}) berstatus Nonaktif atau sudah dilepas dari proyek sehingga tidak dapat dicatat lembur baru.`
      );
    }

    const id = `OVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const hours = resolveOvertimeDecimalHours(data);
    if (hours <= 0) {
      throw new Error('Durasi lembur (jam/menit) harus lebih besar dari 0.');
    }
    const isDriver = isDriverRole(emp.role);
    const hourlyRate = isDriver ? 0 : emp.overtimeHourlyWage;
    const totalPay = isDriver ? 0 : calcOvertimePayExact(hours, hourlyRate, undefined, undefined, emp.role);
    const isApproved = data.status ? data.status === 'Disetujui' : userRole === 'admin';
    const finalStatus = data.status || (isApproved ? 'Disetujui' : 'Menunggu persetujuan');

    // Check if an attendance record exists on the same date to link attendance_id
    let linkedAttId = data.attendanceId || null;
    const attRes = await query('SELECT * FROM attendance WHERE employee_id = $1 AND date = $2 LIMIT 1', [
      emp.id,
      data.date,
    ]);
    if (attRes.rows.length > 0 && !linkedAttId) {
      linkedAttId = attRes.rows[0].id;
    }

    const res = await query(
      `INSERT INTO overtime_records (
        id, attendance_id, date, employee_id, employee_name, employee_role,
        project_id, project_name, start_time, end_time, hours,
        hourly_rate_snapshot, total_pay, status, approved_by, approved_at, notes, audit_trail
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        id,
        linkedAttId,
        data.date,
        emp.id,
        emp.name,
        emp.role,
        data.projectId || null,
        data.projectName || null,
        data.startTime || '16:00',
        data.endTime || '18:00',
        hours,
        hourlyRate,
        totalPay,
        finalStatus,
        isApproved ? userName : null,
        isApproved ? new Date().toISOString() : null,
        data.notes || '',
        JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            user: userName,
            action: `Pencatatan lembur (${hours} jam) - Status: ${finalStatus}`,
          },
        ]),
      ]
    );

    // Sync attendance record's overtime_hours and total_daily_pay if present on that date
    if (attRes.rows.length > 0) {
      const att = mapAttendance(attRes.rows[0]);
      const basicPay = calcBasicPayByStatus(att.status, att.dailyWageSnapshot);
      const newTotalDailyPay = basicPay + (finalStatus === 'Disetujui' && !isDriver ? totalPay : 0);
      await query(
        `UPDATE attendance SET overtime_hours = $1, overtime_approved = $2, overtime_wage_snapshot = CASE WHEN $5 THEN 0 ELSE overtime_wage_snapshot END, total_daily_pay = $3 WHERE id = $4`,
        [hours, finalStatus === 'Disetujui', newTotalDailyPay, att.id, isDriver]
      );
    }

    await insertAuditLog(
      userName,
      userRole as any,
      'Catat Lembur',
      'Lembur',
      `Mencatat lembur ${emp.name} (${hours} jam, Rp ${totalPay.toLocaleString('id-ID')}) pada ${data.date}`
    );

    return mapOvertime(res.rows[0]);
  },

  async updateOvertimeStatus(
    id: string,
    status: string,
    hours?: number,
    notes?: string,
    userName?: string,
    durationHours?: number,
    durationMinutes?: number
  ): Promise<OvertimeRecord> {
    await ensureAllSchemasOnce();
    const ovtRes = await query('SELECT * FROM overtime_records WHERE id = $1', [id]);
    if (!ovtRes.rows.length) throw new Error('Catatan lembur tidak ditemukan.');
    const current = mapOvertime(ovtRes.rows[0]);
    const isDriver = isDriverRole(current.employeeRole);

    const hasNewDuration = hours !== undefined || durationHours !== undefined || durationMinutes !== undefined;
    const finalHours = hasNewDuration
      ? resolveOvertimeDecimalHours({ hours, durationHours, durationMinutes })
      : current.hours;
    const effectiveRate = isDriver ? 0 : current.hourlyRateSnapshot;
    const totalPay = isDriver ? 0 : calcOvertimePayExact(finalHours, effectiveRate, undefined, undefined, current.employeeRole);
    const finalStatus = status || current.status;
    const trail = [
      ...current.auditTrail,
      {
        timestamp: new Date().toISOString(),
        user: userName || 'Admin',
        action: `Status diubah menjadi: ${finalStatus} (Durasi: ${finalHours} jam, Total: Rp ${totalPay.toLocaleString('id-ID')})`,
      },
    ];

    const res = await query(
      `UPDATE overtime_records SET
        status = $1, hours = $2, hourly_rate_snapshot = $3, total_pay = $4, notes = COALESCE($5, notes),
        approved_by = $6, approved_at = NOW(), audit_trail = $7
       WHERE id = $8 RETURNING *`,
      [finalStatus, finalHours, effectiveRate, totalPay, notes, userName || 'Admin', JSON.stringify(trail), id]
    );

    // Sync linked attendance record if exists
    const attRes = await query(
      'SELECT * FROM attendance WHERE id = $1 OR (employee_id = $2 AND date = $3) LIMIT 1',
      [current.attendanceId || '', current.employeeId, current.date]
    );
    if (attRes.rows.length > 0) {
      const att = mapAttendance(attRes.rows[0]);
      const basicPay = calcBasicPayByStatus(att.status, att.dailyWageSnapshot);
      const newTotalDailyPay = basicPay + (finalStatus === 'Disetujui' ? totalPay : 0);
      await query(
        `UPDATE attendance SET overtime_hours = $1, overtime_approved = $2, total_daily_pay = $3 WHERE id = $4`,
        [finalStatus === 'Ditolak' ? 0 : finalHours, finalStatus === 'Disetujui', newTotalDailyPay, att.id]
      );
    }

    return mapOvertime(res.rows[0]);
  },

  async deleteOvertime(id: string): Promise<void> {
    const ovtRes = await query('SELECT * FROM overtime_records WHERE id = $1', [id]);
    if (ovtRes.rows.length > 0) {
      const current = mapOvertime(ovtRes.rows[0]);
      const attRes = await query(
        'SELECT * FROM attendance WHERE id = $1 OR (employee_id = $2 AND date = $3) LIMIT 1',
        [current.attendanceId || '', current.employeeId, current.date]
      );
      if (attRes.rows.length > 0) {
        const att = mapAttendance(attRes.rows[0]);
        const basicPay = calcBasicPayByStatus(att.status, att.dailyWageSnapshot);
        await query(
          `UPDATE attendance SET overtime_hours = 0, overtime_approved = false, total_daily_pay = $1 WHERE id = $2`,
          [basicPay, att.id]
        );
      }
    }
    await query('DELETE FROM overtime_records WHERE id = $1', [id]);
  },

  // 6. Kasbon
  async ensureKasbonTables(): Promise<void> {
    await ensureAllSchemasOnce();
  },

  async getKasbon(projectId?: string): Promise<KasbonRecord[]> {
    await this.ensureKasbonTables();
    let sql = 'SELECT * FROM kasbon_records';
    const params: any[] = [];
    if (projectId) {
      sql += ` WHERE project_id = $1 OR employee_id IN (SELECT employee_id FROM project_assignments WHERE project_id = $1)`;
      params.push(projectId);
    }
    sql += ' ORDER BY request_date DESC, id DESC';

    const res = await query(sql, params);
    if (!res.rows.length) return [];

    const kbIds = res.rows.map((r) => r.id);
    const attRes = await query(
      'SELECT * FROM kasbon_attachments WHERE kasbon_id = ANY($1) ORDER BY created_at ASC',
      [kbIds]
    );
    const attMap: Record<string, any[]> = {};
    for (const a of attRes.rows) {
      if (!attMap[a.kasbon_id]) attMap[a.kasbon_id] = [];
      attMap[a.kasbon_id].push(a);
    }

    return res.rows.map((row) => {
      row.attachments = attMap[row.id] || [];
      return mapKasbon(row);
    });
  },

  async createKasbon(
    data: any,
    userName: string,
    userRole: string,
    attachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = []
  ): Promise<KasbonRecord> {
    await this.ensureKasbonTables();
    const empRes = await query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const emp = mapEmployee(empRes.rows[0]);

    const settings = await this.getSettings();
    const datePrefix = (data.requestDate || new Date().toISOString()).slice(0, 7).replace('-', '');
    let kasbonNumber = '';
    while (true) {
      const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
      kasbonNumber = `KB-${datePrefix}-${Date.now().toString().slice(-4)}-${randomSuffix}`;
      const dupCheck = await query('SELECT id FROM kasbon_records WHERE kasbon_number = $1 LIMIT 1', [kasbonNumber]);
      if (!dupCheck.rows.length) break;
    }
    const id = `KB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const reqDate = new Date(data.requestDate || new Date());
    const empStartDate = new Date(emp.startDate);
    const diffDays = Math.floor((reqDate.getTime() - empStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const isEligible = diffDays >= settings.minTenureDaysForKasbon;
    const eligibilityReason = isEligible
      ? `Masa kerja ${diffDays} hari (memenuhi syarat minimal ${settings.minTenureDaysForKasbon} hari)`
      : `Masa kerja baru ${diffDays} hari (kurang dari syarat minimal ${settings.minTenureDaysForKasbon} hari)`;

    const amount = Number(data.amount || 0);
    if (amount <= 0) {
      throw new Error('Nominal kasbon wajib lebih besar dari 0');
    }

    const firstAtt = attachments && attachments.length > 0 ? attachments[0] : null;
    const defaultStatus = data.status || 'Disetujui';

    const res = await query(
      `INSERT INTO kasbon_records (
        id, kasbon_number, attendance_id, request_date, employee_id, employee_name, employee_role,
        employee_start_date, eligibility_date, is_eligible, eligibility_reason,
        amount, reason, status, deducted_amount, remaining_amount,
        target_payment_period, admin_notes, project_id,
        attachment_file_path, attachment_file_name, attachment_file_size, attachment_mime_type,
        audit_trail
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        id,
        kasbonNumber,
        data.attendanceId || null,
        data.requestDate || new Date().toISOString().split('T')[0],
        emp.id,
        emp.name,
        emp.role,
        emp.startDate,
        null,
        isEligible,
        eligibilityReason,
        amount,
        data.reason || 'Kebutuhan keluarga mendesak',
        defaultStatus,
        0,
        amount,
        data.targetPaymentPeriod || '',
        data.adminNotes || '',
        data.projectId || null,
        firstAtt ? firstAtt.filePath : null,
        firstAtt ? firstAtt.fileName : null,
        firstAtt ? firstAtt.fileSize : null,
        firstAtt ? firstAtt.mimeType : null,
        JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            user: userName,
            action: `Pencatatan kasbon ${kasbonNumber} sebesar Rp ${amount.toLocaleString('id-ID')} untuk ${emp.name}${data.projectId ? ` pada proyek ${data.projectId}` : ''}.`,
          },
        ]),
      ]
    );

    const savedAttachments: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const attId = `KATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const attRes = await query(
          `INSERT INTO kasbon_attachments (id, kasbon_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [attId, id, att.fileName, att.filePath, att.fileSize, att.mimeType, userName]
        );
        savedAttachments.push(attRes.rows[0]);
      }
    }

    const row = res.rows[0];
    row.attachments = savedAttachments;

    await insertAuditLog(
      userName,
      userRole as any,
      'Catat Kasbon Proyek',
      'Kasbon',
      `Mencatat kasbon ${kasbonNumber} untuk ${emp.name} (${emp.id}) senilai Rp ${amount.toLocaleString('id-ID')}`
    );

    return mapKasbon(row);
  },

  async updateKasbonStatus(id: string, action: 'approve' | 'reject', rejectionReason?: string, adminNotes?: string, userName?: string): Promise<KasbonRecord> {
    await this.ensureKasbonTables();
    const kRes = await query('SELECT * FROM kasbon_records WHERE id = $1', [id]);
    if (!kRes.rows.length) throw new Error('Kasbon tidak ditemukan.');
    const current = mapKasbon(kRes.rows[0]);

    const newStatus = action === 'approve' ? 'Disetujui' : 'Ditolak';
    const trail = [...current.auditTrail, { timestamp: new Date().toISOString(), user: userName || 'Admin', action: `Status diubah menjadi: ${newStatus}` }];

    const res = await query(
      `UPDATE kasbon_records SET
        status = $1, rejection_reason = $2, admin_notes = COALESCE($3, admin_notes),
        approved_by = $4, approved_at = NOW(), audit_trail = $5
       WHERE id = $6 RETURNING *`,
      [newStatus, rejectionReason || null, adminNotes || null, userName || 'Admin', JSON.stringify(trail), id]
    );

    const attRes = await query('SELECT * FROM kasbon_attachments WHERE kasbon_id = $1 ORDER BY created_at ASC', [id]);
    const row = res.rows[0];
    row.attachments = attRes.rows;
    return mapKasbon(row);
  },

  async getKasbonAttachmentById(id: string): Promise<OperationalExpenseAttachment | null> {
    await this.ensureKasbonTables();
    const res = await query('SELECT * FROM kasbon_attachments WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        id: r.id,
        expenseId: r.kasbon_id,
        fileName: r.file_name,
        filePath: r.file_path,
        fileSize: Number(r.file_size || 0),
        mimeType: r.mime_type || 'image/jpeg',
        uploadedBy: r.uploaded_by || '',
        createdAt: r.created_at ? (typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString()) : '',
        viewUrl: `/api/projects/kasbon/attachments/${r.id}/view`,
      };
    }

    const kbRes = await query('SELECT * FROM kasbon_records WHERE id = $1 AND attachment_file_path IS NOT NULL', [id]);
    if (kbRes.rows.length > 0) {
      const kb = kbRes.rows[0];
      return {
        id: kb.id,
        expenseId: kb.id,
        fileName: kb.attachment_file_name || 'bukti_kasbon.jpg',
        filePath: kb.attachment_file_path,
        fileSize: Number(kb.attachment_file_size || 0),
        mimeType: kb.attachment_mime_type || 'image/jpeg',
        uploadedBy: kb.approved_by || '',
        createdAt: kb.request_date ? (typeof kb.request_date === 'string' ? kb.request_date : kb.request_date.toISOString()) : '',
        viewUrl: `/api/projects/kasbon/attachments/${kb.id}/view`,
      };
    }
    return null;
  },

  async deleteKasbonAttachment(attachmentId: string, userName: string, userRole: string): Promise<void> {
    await this.ensureKasbonTables();
    const att = await this.getKasbonAttachmentById(attachmentId);
    if (!att) throw new Error('Lampiran bukti kasbon tidak ditemukan');

    try {
      await deleteFromStorage(att.filePath);
    } catch (e) {
      console.warn('Could not delete storage file:', att.filePath);
    }

    await query('DELETE FROM kasbon_attachments WHERE id = $1', [attachmentId]);
    await query(
      `UPDATE kasbon_records
       SET attachment_file_path = NULL, attachment_file_name = NULL, attachment_file_size = NULL, attachment_mime_type = NULL
       WHERE id = $1 OR attachment_file_path = $2`,
      [att.expenseId, att.filePath]
    );

    await insertAuditLog(
      userName,
      userRole as any,
      'Hapus Bukti Kasbon',
      'Kasbon',
      `Menghapus file bukti lampiran kasbon: ${att.fileName}`
    );
  },

  async deleteKasbon(id: string, userName: string = 'Administrator', userRole: string = 'admin', projectId?: string): Promise<void> {
    await this.ensureKasbonTables();
    let sql = 'SELECT * FROM kasbon_records WHERE id = $1';
    const params: any[] = [id];
    if (projectId) {
      sql += ' AND (project_id = $2 OR project_id IS NULL)';
      params.push(projectId);
    }
    const res = await query(sql, params);
    if (!res.rows.length) throw new Error('Data kasbon tidak ditemukan.');
    const kb = res.rows[0];

    const deducted = Number(kb.deducted_amount || 0);
    if (deducted > 0 || kb.status === 'Lunas' || kb.status === 'Dipotong sebagian') {
      throw new Error(
        'Kasbon tidak dapat dihapus karena sudah memiliki riwayat pemotongan gaji (Rp ' +
          deducted.toLocaleString('id-ID') +
          '). Batalkan slip gaji terkait terlebih dahulu jika ingin merevisi.'
      );
    }

    const checkDeductions = await query('SELECT id FROM kasbon_deductions WHERE kasbon_id = $1 LIMIT 1', [id]);
    if (checkDeductions.rows.length > 0) {
      throw new Error('Kasbon ini telah tercatat dalam riwayat potongan gaji penggajian.');
    }

    // Delete attachment files from storage
    const atts = await query('SELECT * FROM kasbon_attachments WHERE kasbon_id = $1', [id]);
    for (const a of atts.rows) {
      try {
        await deleteFromStorage(a.file_path);
      } catch (e) {
        console.warn('Could not delete storage file:', a.file_path);
      }
    }
    if (kb.attachment_file_path) {
      try {
        await deleteFromStorage(kb.attachment_file_path);
      } catch (e) {
        console.warn('Could not delete main attachment file:', kb.attachment_file_path);
      }
    }

    await query('DELETE FROM kasbon_attachments WHERE kasbon_id = $1', [id]);
    await query('DELETE FROM kasbon_records WHERE id = $1', [id]);

    await insertAuditLog(
      userName,
      userRole as any,
      'Hapus Kasbon',
      'Kasbon',
      `Menghapus kasbon ${kb.kasbon_number} untuk ${kb.employee_name} (${kb.employee_id}) senilai Rp ${Number(kb.amount).toLocaleString('id-ID')}`
    );
  },

  // 7. Payroll
  async getPayments(params?: { periodStart?: string; periodEnd?: string; status?: string; employeeId?: string }): Promise<SalaryPayment[]> {
    let sql = 'SELECT * FROM salary_payments WHERE 1=1';
    const values: any[] = [];
    let idx = 1;

    if (params?.periodStart) {
      sql += ` AND period_start >= $${idx++}`;
      values.push(params.periodStart);
    }
    if (params?.periodEnd) {
      sql += ` AND period_end <= $${idx++}`;
      values.push(params.periodEnd);
    }
    if (params?.status) {
      sql += ` AND status = $${idx++}`;
      values.push(params.status);
    }
    if (params?.employeeId) {
      sql += ` AND employee_id = $${idx++}`;
      values.push(params.employeeId);
    }

    sql += ' ORDER BY period_end DESC, id DESC';
    const res = await query(sql, values);
    return res.rows.map(mapSalaryPayment);
  },

  async paySalary(id: string, paymentMethod: string, referenceNumber?: string, notes?: string, userName?: string): Promise<SalaryPayment> {
    const pRes = await query('SELECT * FROM salary_payments WHERE id = $1', [id]);
    if (!pRes.rows.length) throw new Error('Data gaji tidak ditemukan.');
    const current = mapSalaryPayment(pRes.rows[0]);

    const trail = [...current.auditTrail, { timestamp: new Date().toISOString(), user: userName || 'Admin', action: 'Gaji Diberikan / Sudah Dibayar' }];

    const res = await query(
      `UPDATE salary_payments SET
        status = 'Sudah dibayar', payment_method = $1, reference_number = $2,
        notes = COALESCE($3, notes), payment_date = CURRENT_DATE, audit_trail = $4
       WHERE id = $5 RETURNING *`,
      [paymentMethod || 'Kas Tunai', referenceNumber || null, notes || null, JSON.stringify(trail), id]
    );

    return mapSalaryPayment(res.rows[0]);
  },

  async processPayment(data: any, userName: string, userRole: string): Promise<SalaryPayment> {
    return withTransaction(async (client) => {
      const exist = await client.query(
        `SELECT id, payment_number FROM salary_payments WHERE employee_id = $1 AND period_start = $2 AND period_end = $3 AND status != 'Dibatalkan'`,
        [data.employeeId, data.periodStart, data.periodEnd]
      );
      if (exist.rows.length) {
        throw new Error(`Gaji untuk karyawan ini pada periode ${data.periodStart} s/d ${data.periodEnd} sudah pernah diproses (${exist.rows[0].payment_number}).`);
      }

      const empRes = await client.query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
      if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
      const emp = mapEmployee(empRes.rows[0]);

      const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
      const paymentDatePrefix = (data.paymentDate || new Date().toISOString()).replace(/-/g, '').slice(0, 6);
      const paymentNumber = `PAY-${paymentDatePrefix}-${Date.now().toString().slice(-4)}-${randomSuffix}`;
      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      // 1. Always compute accurate breakdown from attendance & overtime tables (including Setengah Hari & exact overtime)
      const attRes = await client.query(
        `SELECT date, status, daily_wage_snapshot FROM attendance
         WHERE employee_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC`,
        [emp.id, data.periodStart, data.periodEnd]
      );

      // Deduplicate by date so no day is ever double-counted
      const seenDates = new Set<string>();
      const uniqueAtts: any[] = [];
      for (const r of attRes.rows) {
        const dStr = typeof r.date === 'string' ? r.date : r.date.toISOString().split('T')[0];
        if (!seenDates.has(dStr)) {
          seenDates.add(dStr);
          uniqueAtts.push(r);
        }
      }

      const fullDayAtts = uniqueAtts.filter((r: any) => r.status === 'Hadir');
      const halfDayAtts = uniqueAtts.filter((r: any) => r.status === 'Setengah Hari');

      const computedFullDays = fullDayAtts.length;
      const computedHalfDays = halfDayAtts.length;
      const computedWorkDays = computedFullDays + computedHalfDays * 0.5;
      const computedFullDaySalary = fullDayAtts.reduce(
        (sum: number, r: any) => sum + Math.round(Number(r.daily_wage_snapshot || emp.dailyWage)),
        0
      );
      const computedHalfDaySalary = halfDayAtts.reduce(
        (sum: number, r: any) => sum + Math.round(Number(r.daily_wage_snapshot || emp.dailyWage) / 2),
        0
      );
      const computedBasicSalary = computedFullDaySalary + computedHalfDaySalary;

      const isDriver = isDriverRole(emp.role);
      const ovtRes = await client.query(
        `SELECT hours, total_pay FROM overtime_records
         WHERE employee_id = $1 AND date >= $2 AND date <= $3 AND status = 'Disetujui'`,
        [emp.id, data.periodStart, data.periodEnd]
      );
      const computedOtHours = Number(
        ovtRes.rows.reduce((sum: number, r: any) => sum + Number(r.hours || 0), 0).toFixed(4)
      );
      const computedOtPay = isDriver
        ? 0
        : ovtRes.rows.reduce((sum: number, r: any) => sum + Math.round(Number(r.total_pay || 0)), 0);

      const fullWorkDays = data.fullWorkDays !== undefined ? Number(data.fullWorkDays) : computedFullDays;
      const halfWorkDays = data.halfWorkDays !== undefined ? Number(data.halfWorkDays) : computedHalfDays;
      const totalWorkDays = !isNaN(Number(data.totalWorkDays ?? data.workDays)) && Number(data.totalWorkDays ?? data.workDays) > 0
        ? Number(data.totalWorkDays ?? data.workDays)
        : computedWorkDays;
      const fullDaySalary = data.fullDaySalary !== undefined ? Number(data.fullDaySalary) : computedFullDaySalary;
      const halfDaySalary = data.halfDaySalary !== undefined ? Number(data.halfDaySalary) : computedHalfDaySalary;
      const totalBasicSalary = !isNaN(Number(data.totalBasicSalary ?? data.basicSalary)) && Number(data.totalBasicSalary ?? data.basicSalary) > 0
        ? Number(data.totalBasicSalary ?? data.basicSalary)
        : computedBasicSalary;
      const approvedOvertimeHours = !isNaN(Number(data.approvedOvertimeHours)) && Number(data.approvedOvertimeHours) > 0
        ? Number(data.approvedOvertimeHours)
        : computedOtHours;
      const totalOvertimePay = isDriver
        ? 0
        : (!isNaN(Number(data.totalOvertimePay ?? data.overtimePay)) && Number(data.totalOvertimePay ?? data.overtimePay) > 0
          ? Number(data.totalOvertimePay ?? data.overtimePay)
          : computedOtPay);
      const numGross = totalBasicSalary + totalOvertimePay;

      let numKasbonDeduction = Number(data.kasbonDeduction);
      if (isNaN(numKasbonDeduction) || numKasbonDeduction < 0) {
        numKasbonDeduction = 0;
      }
      numKasbonDeduction = Math.min(numKasbonDeduction, numGross);
      const numOther = Math.max(0, Number(data.otherDeductions) || 0);
      const numNet = Math.max(0, numGross - numKasbonDeduction - numOther);

      if (numKasbonDeduction > 0) {
        let remainingToDeduct = numKasbonDeduction;
        const kbRes = await client.query(
          `SELECT * FROM kasbon_records WHERE employee_id = $1 AND status IN ('Disetujui', 'Dipotong sebagian') AND remaining_amount > 0 ORDER BY request_date ASC FOR UPDATE`,
          [emp.id]
        );
        for (const row of kbRes.rows) {
          if (remainingToDeduct <= 0) break;
          const currRemaining = Number(row.remaining_amount);
          const deductFromThis = Math.min(currRemaining, remainingToDeduct);
          const newRemaining = currRemaining - deductFromThis;
          const newDeducted = Number(row.deducted_amount) + deductFromThis;
          const newStatus = newRemaining === 0 ? 'Lunas' : 'Dipotong sebagian';
          const auditTrail = Array.isArray(row.audit_trail) ? row.audit_trail : [];
          auditTrail.push({
            timestamp: new Date().toISOString(),
            user: userName,
            action: `Dipotong sebesar Rp ${deductFromThis.toLocaleString('id-ID')} melalui pembayaran ${paymentNumber}. Sisa kasbon: Rp ${newRemaining.toLocaleString('id-ID')}`,
          });

          await client.query(
            `UPDATE kasbon_records SET deducted_amount = $1, remaining_amount = $2, status = $3, audit_trail = $4 WHERE id = $5`,
            [newDeducted, newRemaining, newStatus, JSON.stringify(auditTrail), row.id]
          );

          const dedId = `DED-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          await client.query(
            `INSERT INTO kasbon_deductions (id, kasbon_id, salary_payment_id, date, employee_id, amount, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [dedId, row.id, paymentId, data.paymentDate, emp.id, deductFromThis, `Dipotong otomatis via slip ${paymentNumber}`]
          );

          remainingToDeduct -= deductFromThis;
        }
      }

      const initialTrail = [
        {
          timestamp: new Date().toISOString(),
          user: userName,
          action: `Pembayaran gaji diproses (${paymentNumber}): ${fullWorkDays} hari penuh, ${halfWorkDays} setengah hari, lembur ${approvedOvertimeHours} jam`,
        },
      ];

      const insRes = await client.query(
        `INSERT INTO salary_payments (
          id, payment_number, period_start, period_end, employee_id, employee_name, employee_role,
          project_id, full_work_days, half_work_days, total_work_days,
          full_day_salary, half_day_salary, approved_overtime_hours, total_basic_salary, total_overtime_pay,
          gross_salary, kasbon_deduction, other_deductions, net_salary, payment_date,
          payment_method, reference_number, status, notes, processed_by, created_at, audit_trail
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), $27
        ) RETURNING *`,
        [
          paymentId, paymentNumber, data.periodStart, data.periodEnd, emp.id, emp.name, emp.role,
          data.projectId || null,
          Number(fullWorkDays), Number(halfWorkDays), Number(totalWorkDays),
          Number(fullDaySalary), Number(halfDaySalary), Number(approvedOvertimeHours),
          Number(totalBasicSalary), Number(totalOvertimePay),
          numGross, numKasbonDeduction, numOther, numNet, data.paymentDate,
          data.paymentMethod || 'Kas Tunai', data.referenceNumber || null, 'Sudah dibayar',
          data.notes || '', userName, JSON.stringify(initialTrail)
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (id, timestamp, user_name, user_role, action, module, details)
         VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
        [
          `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userName, userRole, 'Proses Pembayaran Gaji', 'Penggajian',
          `Memproses slip gaji ${paymentNumber} untuk ${emp.name} (${emp.role}) - Gaji Bersih: Rp ${numNet.toLocaleString('id-ID')}`
        ]
      );

      return mapSalaryPayment(insRes.rows[0]);
    });
  },

  async deletePayment(id: string): Promise<void> {
    await query('DELETE FROM salary_payments WHERE id = $1', [id]);
  },

  async cancelPayment(id: string, reason: string, userName: string, userRole: string): Promise<SalaryPayment> {
    return await withTransaction(async (client) => {
      const pRes = await client.query('SELECT * FROM salary_payments WHERE id = $1', [id]);
      if (!pRes.rows.length) throw new Error('Data pembayaran tidak ditemukan');
      const payment = mapSalaryPayment(pRes.rows[0]);
      if (payment.status === 'Dibatalkan') {
        throw new Error('Pembayaran ini sudah pernah dibatalkan');
      }

      // Revert kasbon deductions
      const dedRes = await client.query('SELECT * FROM kasbon_deductions WHERE salary_payment_id = $1', [id]);
      for (const dRow of dedRes.rows) {
        const kbRes = await client.query('SELECT * FROM kasbon_records WHERE id = $1', [dRow.kasbon_id]);
        if (kbRes.rows.length) {
          const kb = mapKasbon(kbRes.rows[0]);
          const newDeducted = Math.max(0, kb.deductedAmount - Number(dRow.amount));
          const newRemaining = kb.remainingAmount + Number(dRow.amount);
          const newStatus = newDeducted === 0 ? 'Disetujui' : 'Dipotong sebagian';
          const newTrail = [
            ...kb.auditTrail,
            {
              timestamp: new Date().toISOString(),
              user: userName,
              action: `Pengembalian potongan sebesar Rp ${Number(dRow.amount).toLocaleString('id-ID')} karena pembatalan pembayaran ${payment.paymentNumber}`,
            },
          ];
          await client.query(
            `UPDATE kasbon_records SET deducted_amount = $1, remaining_amount = $2, status = $3, audit_trail = $4 WHERE id = $5`,
            [newDeducted, newRemaining, newStatus, JSON.stringify(newTrail), kb.id]
          );
        }
      }
      await client.query('DELETE FROM kasbon_deductions WHERE salary_payment_id = $1', [id]);

      const newTrail = [
        ...payment.auditTrail,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          action: `Pembayaran dibatalkan: ${reason || 'Pembatalan oleh administrator'}`,
        },
      ];

      const updRes = await client.query(
        `UPDATE salary_payments SET status = 'Dibatalkan', audit_trail = $1 WHERE id = $2 RETURNING *`,
        [JSON.stringify(newTrail), id]
      );

      await client.query(
        `INSERT INTO audit_logs (id, timestamp, user_name, user_role, action, module, details)
         VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
        [
          `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userName, userRole, 'Batalkan Pembayaran Gaji', 'Gaji',
          `Pembayaran gaji ${payment.paymentNumber} dibatalkan: ${reason || '-'}`
        ]
      );

      return mapSalaryPayment(updRes.rows[0]);
    });
  },

  // 8. Operational Expenses & Attachments
  async ensureAttachmentsTable(): Promise<void> {
    await ensureAllSchemasOnce();
  },

  async getExpenses(params?: { personType?: string; category?: string; startDate?: string; endDate?: string }): Promise<OperationalExpense[]> {
    await this.ensureAttachmentsTable();

    let opSql = `
      SELECT e.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'expense_id', a.expense_id,
              'file_name', a.file_name,
              'file_path', a.file_path,
              'file_size', a.file_size,
              'mime_type', a.mime_type,
              'uploaded_by', a.uploaded_by,
              'created_at', a.created_at
            ) ORDER BY a.created_at ASC
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) AS attachments
      FROM operational_expenses e
      LEFT JOIN operational_expense_attachments a ON a.expense_id = e.id
      WHERE 1=1
    `;
    const opValues: any[] = [];
    let opIdx = 1;

    if (params?.startDate && params?.endDate) {
      opSql += ` AND e.date >= $${opIdx++} AND e.date <= $${opIdx++}`;
      opValues.push(params.startDate, params.endDate);
    }
    opSql += ' GROUP BY e.id';

    // Also fetch project expenses (e.g. MERAK transportation and project operational expenses)
    let projSql = `
      SELECT pe.*,
        p.name as project_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pa.id,
              'expense_id', pa.expense_id,
              'file_name', pa.file_name,
              'file_path', pa.file_path,
              'file_size', pa.file_size,
              'mime_type', pa.mime_type,
              'uploaded_by', pa.uploaded_by,
              'created_at', pa.created_at
            ) ORDER BY pa.created_at ASC
          ) FILTER (WHERE pa.id IS NOT NULL),
          '[]'::json
        ) AS attachments
      FROM project_expenses pe
      LEFT JOIN projects p ON p.id = pe.project_id
      LEFT JOIN project_expense_attachments pa ON pa.expense_id = pe.id
      WHERE 1=1
    `;
    const projValues: any[] = [];
    let projIdx = 1;

    if (params?.startDate && params?.endDate) {
      projSql += ` AND pe.date >= $${projIdx++} AND pe.date <= $${projIdx++}`;
      projValues.push(params.startDate, params.endDate);
    }
    projSql += ' GROUP BY pe.id, p.name';

    const [opRes, projRes] = await Promise.all([
      query(opSql, opValues),
      query(projSql, projValues),
    ]);

    const opList = opRes.rows.map(mapExpense);
    const projList = projRes.rows.map((row: any) => {
      const attachments: OperationalExpenseAttachment[] = Array.isArray(row.attachments)
        ? row.attachments.map((a: any) => ({
            id: a.id,
            expenseId: a.expenseId || a.expense_id,
            fileName: a.fileName || a.file_name,
            filePath: a.filePath || a.file_path,
            fileSize: Number(a.fileSize || a.file_size || 0),
            mimeType: a.mimeType || a.mime_type || 'image/jpeg',
            uploadedBy: a.uploadedBy || a.uploaded_by || '',
            createdAt: a.createdAt || a.created_at || '',
            viewUrl: `/api/projects/expenses/attachments/${a.id}/view`,
          }))
        : [];

      const picLower = (row.pic_name || '').toLowerCase();
      const isOwner = picLower.includes('astari') || picLower.includes('owner') || picLower.includes('bambang');
      const personType: 'Owner' | 'Asisten' = isOwner ? 'Owner' : 'Asisten';

      let category: OperationalExpense['category'] = 'Bensin';
      const cat = String(row.category || '');
      if (cat === 'Bensin') category = 'Bensin';
      else if (cat === 'Konsumsi Lapangan' || cat === 'Makan' || cat === 'Konsumsi') category = 'Makan';
      else if (cat === 'E-Toll' || cat === 'Tol') category = 'E-Toll';
      else if (cat === 'Rokok') category = 'Rokok';
      else category = (cat as any);

      const projTag = `[Proyek ${row.project_name || 'MERAK'}]`;
      const desc = row.description ? `${projTag} ${row.description}` : `${projTag} Biaya ${row.category}`;

      return {
        id: row.id,
        transactionNumber: row.transaction_number,
        date: row.date ? (typeof row.date === 'string' ? row.date.split('T')[0] : row.date.toISOString().split('T')[0]) : '',
        personType,
        personName: row.pic_name || (personType === 'Owner' ? 'Bpk. Astari' : 'Bpk Acil'),
        category,
        description: desc,
        amount: Number(row.amount || 0),
        paymentMethod: row.payment_method || 'Tunai',
        receiptProof: '',
        notes: row.notes || '',
        createdBy: row.created_by || '',
        createdAt: row.created_at ? (typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString()) : '',
        attachments,
      };
    });

    let combined = [...opList, ...projList];

    if (params?.personType) {
      combined = combined.filter((e) => e.personType === params.personType);
    }
    if (params?.category) {
      combined = combined.filter(
        (e) =>
          e.category === params.category ||
          (params.category === 'Makan' && (e.category as string) === 'Konsumsi Lapangan')
      );
    }

    combined.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    return combined;
  },

  async createExpense(
    data: any,
    userName: string,
    userRole: string,
    attachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = []
  ): Promise<OperationalExpense> {
    await this.ensureAttachmentsTable();

    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    const expDatePrefix = (data.date || new Date().toISOString()).slice(0, 7).replace('-', '');
    const transactionNumber = `EXP-${expDatePrefix}-${Date.now().toString().slice(-4)}-${randomSuffix}`;
    const id = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const res = await query(
      `INSERT INTO operational_expenses (
        id, transaction_number, date, person_type, person_name, category,
        project_id, description, amount, payment_method, receipt_proof, notes, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *`,
      [
        id, transactionNumber, data.date, data.personType, data.personName, data.category,
        data.projectId || null, data.description || '', Number(data.amount || 0),
        data.paymentMethod || 'Tunai', data.receiptProof || '', data.notes || '', userName,
      ]
    );

    const insertedAttachments: OperationalExpenseAttachment[] = [];
    for (const att of attachments) {
      const attId = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const attRes = await query(
        `INSERT INTO operational_expense_attachments (
          id, expense_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [attId, id, att.fileName, att.filePath, att.fileSize, att.mimeType, userName]
      );
      insertedAttachments.push({
        id: attId,
        expenseId: id,
        fileName: att.fileName,
        filePath: att.filePath,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        uploadedBy: userName,
        createdAt: new Date().toISOString(),
        viewUrl: `/api/expenses/attachments/${attId}/view`,
      });
    }

    await insertAuditLog(
      userName,
      userRole as any,
      'Catat Pengeluaran Operasional',
      'Operasional',
      `Mencatat pengeluaran ${transactionNumber} (${data.personType} - ${data.category}) senilai Rp ${Number(data.amount || 0).toLocaleString('id-ID')} dengan ${insertedAttachments.length} foto bukti`
    );

    const exp = mapExpense(res.rows[0]);
    exp.attachments = insertedAttachments;
    return exp;
  },

  async updateExpense(
    id: string,
    data: any,
    attachmentsToKeep: string[] = [],
    newAttachments: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = [],
    userName = 'Administrator',
    userRole = 'admin'
  ): Promise<OperationalExpense> {
    await this.ensureAttachmentsTable();

    // 1. Check existing
    const existingRes = await query('SELECT * FROM operational_expenses WHERE id = $1', [id]);
    if (!existingRes.rows.length) {
      throw new Error('Data pengeluaran tidak ditemukan');
    }

    // 2. Fetch existing attachments to remove deleted ones from storage
    const currentAttRes = await query('SELECT * FROM operational_expense_attachments WHERE expense_id = $1', [id]);
    for (const row of currentAttRes.rows) {
      if (!attachmentsToKeep.includes(row.id)) {
        await deleteFromStorage(row.file_path);
        await query('DELETE FROM operational_expense_attachments WHERE id = $1', [row.id]);
      }
    }

    // 3. Insert newly uploaded attachments
    for (const att of newAttachments) {
      const attId = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      await query(
        `INSERT INTO operational_expense_attachments (
          id, expense_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [attId, id, att.fileName, att.filePath, att.fileSize, att.mimeType, userName]
      );
    }

    // 4. Update operational_expenses row
    const updRes = await query(
      `UPDATE operational_expenses SET
        date = $1, person_type = $2, person_name = $3, category = $4,
        description = $5, amount = $6, payment_method = $7, receipt_proof = $8, notes = $9
       WHERE id = $10 RETURNING *`,
      [
        data.date, data.personType, data.personName, data.category,
        data.description || '', Number(data.amount || 0),
        data.paymentMethod || 'Tunai', data.receiptProof || '', data.notes || '', id
      ]
    );

    await insertAuditLog(
      userName,
      userRole as any,
      'Ubah Pengeluaran Operasional',
      'Operasional',
      `Memperbarui transaksi pengeluaran ${updRes.rows[0].transaction_number} (${data.personType} - ${data.category})`
    );

    // 5. Fetch updated with attachments
    const freshList = await this.getExpenses();
    const updatedExp = freshList.find((e) => e.id === id);
    return updatedExp || mapExpense(updRes.rows[0]);
  },

  async deleteExpense(id: string): Promise<void> {
    await this.ensureAttachmentsTable();
    // Delete attached files from storage first
    const attRes = await query('SELECT * FROM operational_expense_attachments WHERE expense_id = $1', [id]);
    for (const row of attRes.rows) {
      await deleteFromStorage(row.file_path);
    }

    await query('DELETE FROM operational_expenses WHERE id = $1', [id]);
  },

  async getAttachmentById(id: string): Promise<OperationalExpenseAttachment | null> {
    await this.ensureAttachmentsTable();
    const res = await query('SELECT * FROM operational_expense_attachments WHERE id = $1', [id]);
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      expenseId: r.expense_id,
      fileName: r.file_name,
      filePath: r.file_path,
      fileSize: Number(r.file_size || 0),
      mimeType: r.mime_type,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at ? r.created_at.toISOString() : '',
      viewUrl: `/api/expenses/attachments/${r.id}/view`,
    };
  },

  async deleteAttachmentById(id: string): Promise<void> {
    await this.ensureAttachmentsTable();
    const att = await this.getAttachmentById(id);
    if (att) {
      await deleteFromStorage(att.filePath);
      await query('DELETE FROM operational_expense_attachments WHERE id = $1', [id]);
    }
  },

  // 9. Audit Logs
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const res = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
    return res.rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      userName: r.user_name,
      userRole: r.user_role,
      action: r.action,
      module: r.module,
      details: r.details,
    }));
  },

  // 10. Users
  async getUsers(): Promise<AppUser[]> {
    const res = await query('SELECT * FROM app_users ORDER BY id ASC');
    return res.rows.map(mapUser);
  },

  async getUserByIdentifier(identifier: string): Promise<AppUser | null> {
    const res = await query(
      'SELECT * FROM app_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1',
      [identifier.trim()]
    );
    if (!res.rows.length) return null;
    return mapUser(res.rows[0]);
  },

  async createUser(data: Partial<AppUser>): Promise<AppUser> {
    const res = await query(
      `INSERT INTO app_users (id, username, email, name, role, salt, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [
        data.id, data.username, data.email, data.name, data.role,
        data.salt, data.passwordHash,
      ]
    );
    return mapUser(res.rows[0]);
  },

  async updateUser(id: string, data: Partial<AppUser>): Promise<AppUser> {
    const currentRes = await query('SELECT * FROM app_users WHERE id = $1', [id]);
    if (!currentRes.rows.length) throw new Error('User tidak ditemukan.');
    const current = mapUser(currentRes.rows[0]);
    const updated = { ...current, ...data };

    const res = await query(
      `UPDATE app_users SET
        name = $1, email = $2, role = $3, salt = $4, password_hash = $5
       WHERE id = $6 RETURNING *`,
      [updated.name, updated.email, updated.role, updated.salt, updated.passwordHash, id]
    );
    return mapUser(res.rows[0]);
  },

  async deleteUser(id: string): Promise<void> {
    await query('DELETE FROM app_users WHERE id = $1', [id]);
  },
};
