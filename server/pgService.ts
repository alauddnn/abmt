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
    overtimeDriverHourly: Number(row.overtime_driver_hourly || 18000),
    wageKenekDaily: Number(row.wage_kenek_daily || 125000),
    overtimeKenekHourly: Number(row.overtime_kenek_hourly || 15000),
    minTenureDaysForKasbon: Number(row.min_tenure_days_for_kasbon || 7),
  };
}

function mapEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    nik: row.nik || undefined,
    role: row.role,
    dailyWage: Number(row.daily_wage),
    overtimeHourlyWage: Number(row.overtime_hourly_wage),
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
  return {
    id: row.id,
    date: row.date ? (typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
    overtimeHours: Number(row.overtime_hours || 0),
    overtimeApproved: Boolean(row.overtime_approved),
    dailyWageSnapshot: Number(row.daily_wage_snapshot || 0),
    overtimeWageSnapshot: Number(row.overtime_wage_snapshot || 0),
    totalDailyPay: Number(row.total_daily_pay || 0),
    notes: row.notes || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at ? row.created_at.toISOString() : '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at ? row.updated_at.toISOString() : '',
  };
}

function mapOvertime(row: any): OvertimeRecord {
  return {
    id: row.id,
    attendanceId: row.attendance_id || undefined,
    date: row.date ? (typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    hours: Number(row.hours || 0),
    hourlyRateSnapshot: Number(row.hourly_rate_snapshot || 0),
    totalPay: Number(row.total_pay || 0),
    status: row.status,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at ? row.approved_at.toISOString() : undefined,
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
  return {
    id: row.id,
    paymentNumber: row.payment_number,
    periodStart: row.period_start ? (typeof row.period_start === 'string' ? row.period_start.split('T')[0] : row.period_start.toISOString().split('T')[0]) : '',
    periodEnd: row.period_end ? (typeof row.period_end === 'string' ? row.period_end.split('T')[0] : row.period_end.toISOString().split('T')[0]) : '',
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    totalWorkDays: Number(row.total_work_days || 0),
    approvedOvertimeHours: Number(row.approved_overtime_hours || 0),
    totalBasicSalary: Number(row.total_basic_salary || 0),
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
    createdAt: row.created_at ? row.created_at.toISOString() : '',
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
    overtimeHourlyWage: row.overtime_hourly_wage !== undefined ? Number(row.overtime_hourly_wage) : undefined,
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
          overtime_driver_hourly NUMERIC(15, 2) DEFAULT 18000,
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
        ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS overtime_driver_hourly NUMERIC(15, 2) DEFAULT 18000;
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
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_file_path TEXT;
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_file_name VARCHAR(255);
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_file_size INT;
        ALTER TABLE kasbon_records ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(100);

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

  async updateSettings(data: Partial<CompanySettings>, userName: string, userRole: string): Promise<CompanySettings> {
    await ensureAllSchemasOnce();
    const current = await this.getSettings();
    const updated: CompanySettings = { ...current, ...data };
    const helperDaily = updated.wageHelperDaily || updated.wageKenekDaily || 125000;
    const helperOt = updated.overtimeHelperHourly || updated.overtimeKenekHourly || 15000;
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
        updated.wageMandorDaily || 200000, updated.overtimeMandorHourly || 25000,
        updated.wageTukangDaily || 150000, updated.overtimeTukangHourly || 20000,
        helperDaily, helperOt,
        updated.wageDriverDaily || 140000, updated.overtimeDriverHourly || 18000,
        helperDaily, helperOt,
        updated.minTenureDaysForKasbon || 7,
      ]
    );
    await insertAuditLog(userName, userRole as any, 'Ubah Pengaturan', 'Pengaturan', 'Memperbarui profil perusahaan dan tarif upah di PostgreSQL');
    return mapSettings(res.rows[0]);
  },

  // 2. Employees (supports manual ID and cascading update)
  async getEmployees(): Promise<Employee[]> {
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
      defaultOvertime = settings.overtimeDriverHourly || 18000;
    }

    const dailyWage = data.dailyWage !== undefined && data.dailyWage !== null && data.dailyWage !== ('' as any)
      ? Number(data.dailyWage)
      : defaultDaily;
    const overtimeHourlyWage = data.overtimeHourlyWage !== undefined && data.overtimeHourlyWage !== null && data.overtimeHourlyWage !== ('' as any)
      ? Number(data.overtimeHourlyWage)
      : defaultOvertime;
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

      const res = await client.query(
        `UPDATE employees SET
          id = $1, name = COALESCE($2, name), role = COALESCE($3, role),
          daily_wage = COALESCE($4, daily_wage), overtime_hourly_wage = COALESCE($5, overtime_hourly_wage),
          start_date = COALESCE($6, start_date), status = COALESCE($7, status),
          phone = COALESCE($8, phone), notes = COALESCE($9, notes)
         WHERE id = $10 RETURNING *`,
        [targetId, data.name?.trim(), data.role, data.dailyWage, data.overtimeHourlyWage, data.startDate, data.status, data.phone, data.notes, oldId]
      );

      if (!res.rows.length) {
        throw new Error('Karyawan tidak ditemukan.');
      }

      await insertAuditLog(userName, userRole as any, 'Ubah Data Karyawan', 'Karyawan', `Memperbarui data karyawan ID: ${oldId} -> ${targetId}`);
      return mapEmployee(res.rows[0]);
    });
  },

  async deleteEmployee(id: string, userName: string, userRole: string): Promise<void> {
    const empRes = await query('SELECT name FROM employees WHERE id = $1', [id]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const empName = empRes.rows[0].name;

    await query('DELETE FROM employees WHERE id = $1', [id]);
    await insertAuditLog(userName, userRole as any, 'Hapus Karyawan', 'Karyawan', `Menghapus karyawan: ${empName} (${id})`);
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
          Number(data.dailyWage),
          Number(data.overtimeHourlyWage),
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
      // 1. Update employee record
      await client.query(
        `UPDATE employees SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          nik = COALESCE($3, nik),
          role = COALESCE($4, role),
          start_date = COALESCE($5, start_date),
          daily_wage = COALESCE($6, daily_wage),
          overtime_hourly_wage = COALESCE($7, overtime_hourly_wage),
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
          data.overtimeHourlyWage !== undefined && data.overtimeHourlyWage !== null ? Number(data.overtimeHourlyWage) : null,
          data.status,
          data.notes,
          empId,
        ]
      );

      // 2. Update assignment status and role in project
      await client.query(
        `UPDATE project_assignments SET
          role_in_project = COALESCE($1, role_in_project),
          status = COALESCE($2, status),
          notes = COALESCE($3, notes)
         WHERE id = $4`,
        [data.role || asg.role_in_project, data.status || asg.status, data.notes !== undefined ? data.notes : asg.notes, assignmentId]
      );

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

    await insertAuditLog(
      userName,
      userRole as any,
      'Penugasan Proyek',
      'Proyek',
      `Menugaskan karyawan ${emp.name} (${emp.id}) ke proyek ${proj.name}`
    );

    const full = await query(
      `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
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

    const full = await query(
      `SELECT pa.*, e.name as employee_name, e.role as employee_role, e.phone as employee_phone,
              e.daily_wage, e.overtime_hourly_wage
       FROM project_assignments pa
       JOIN employees e ON pa.employee_id = e.id
       WHERE pa.id = $1`,
      [id]
    );
    await insertAuditLog(userName, userRole as any, 'Ubah Penugasan Proyek', 'Proyek', `Memperbarui status penugasan ID: ${id}`);
    return mapProjectAssignment(full.rows[0]);
  },

  async removeProjectAssignment(id: string, userName: string, userRole: string): Promise<void> {
    const check = await query(
      'SELECT pa.*, e.name as emp_name FROM project_assignments pa JOIN employees e ON pa.employee_id = e.id WHERE pa.id = $1',
      [id]
    );
    if (!check.rows.length) throw new Error('Penugasan tidak ditemukan.');
    await query('DELETE FROM project_assignments WHERE id = $1', [id]);
    await insertAuditLog(userName, userRole as any, 'Hapus Penugasan', 'Proyek', `Menghapus penugasan karyawan ${check.rows[0].emp_name}`);
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
    const txNum = `${prefix}-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
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
      `SELECT employee_id FROM project_assignments WHERE project_id = $1 AND status = 'active'`,
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
      presentToday = attRes.rows.filter((r) => r.status === 'Hadir').length;
      const explicitAbsent = attRes.rows.filter(
        (r) => r.status === 'Sakit' || r.status === 'Izin' || r.status === 'Alpa'
      ).length;
      absentToday = Math.max(explicitAbsent, totalAssignedEmployees - presentToday);
    }

    let overtimeCount = 0;
    if (assignedEmpIds.length > 0) {
      const otRes = await query(
        `SELECT COUNT(DISTINCT employee_id) as emp_count
         FROM overtime_records
         WHERE (project_id = $1 OR employee_id = ANY($2)) AND status = 'Disetujui'`,
        [projectId, assignedEmpIds]
      );
      overtimeCount = Number(otRes.rows[0]?.emp_count || 0);
    }

    let totalKasbon = 0;
    if (assignedEmpIds.length > 0) {
      const kbRes = await query(
        `SELECT SUM(remaining_amount) as total_sisa
         FROM kasbon_records
         WHERE employee_id = ANY($1) AND (status = 'Disetujui' OR status = 'Dipotong sebagian')`,
        [assignedEmpIds]
      );
      totalKasbon = Number(kbRes.rows[0]?.total_sisa || 0);
    }

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
    const projRes = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (!projRes.rows.length) throw new Error('Proyek tidak ditemukan.');
    const project = mapProject(projRes.rows[0]);

    const assignments = await this.getProjectAssignments(projectId);
    const assignedEmpIds = assignments.filter((a) => a.status === 'active').map((a) => a.employeeId);

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
    const attendance = attRes.rows.map(mapAttendance);

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

    let kasbon: KasbonRecord[] = [];
    if (assignedEmpIds.length > 0) {
      const kbRes = await query(
        `SELECT * FROM kasbon_records WHERE employee_id = ANY($1) ORDER BY request_date DESC`,
        [assignedEmpIds]
      );
      kasbon = kbRes.rows.map(mapKasbon);
    }

    const expenses = await this.getProjectExpenses(projectId);
    const filteredExpenses = (startDate && endDate)
      ? expenses.filter((e) => e.date >= startDate && e.date <= endDate)
      : expenses;

    const transportExpenses = filteredExpenses.filter((e) => e.expenseType === 'transportasi');
    const operationalExpenses = filteredExpenses.filter((e) => e.expenseType === 'operasional');

    const totalBasicSalary = attendance.reduce((s, a) => (a.status === 'Hadir' ? s + a.dailyWageSnapshot : s), 0);
    const totalOvertimePay = overtime.filter((o) => o.status === 'Disetujui').reduce((s, o) => s + o.totalPay, 0);
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
        totalEmployees: assignments.filter((a) => a.status === 'active').length,
        totalWorkDays: attendance.filter((a) => a.status === 'Hadir').length,
        totalBasicSalary,
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
  async getAttendance(params?: { date?: string; startDate?: string; endDate?: string; employeeId?: string; projectId?: string; role?: string }): Promise<Attendance[]> {
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
    return res.rows.map(mapAttendance);
  },

  async createAttendance(data: any, userName: string, userRole: string): Promise<Attendance> {
    const empRes = await query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const emp = mapEmployee(empRes.rows[0]);

    const id = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const checkIn = data.checkIn || '08:00';
    const checkOut = data.checkOut || '16:00';
    const overtimeHours = Number(data.overtimeHours || 0);
    const status = data.status || 'Hadir';

    let totalDailyPay = 0;
    if (status === 'Hadir') {
      totalDailyPay = emp.dailyWage;
    }

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
        status, checkIn, checkOut, overtimeHours, false,
        emp.dailyWage, emp.overtimeHourlyWage, totalDailyPay,
        data.notes || '', userName,
      ]
    );

    return mapAttendance(res.rows[0]);
  },

  async createBulkAttendance(date: string, entries: any[], userName: string, userRole: string): Promise<{ created: Attendance[]; skipped: string[] }> {
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

        const id = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const status = entry.status || 'Hadir';
        const totalPay = status === 'Hadir' ? emp.dailyWage : 0;

        const res = await client.query(
          `INSERT INTO attendance (
            id, date, employee_id, employee_name, employee_role, project_id, project_name,
            status, check_in, check_out, overtime_hours, overtime_approved,
            daily_wage_snapshot, overtime_wage_snapshot, total_daily_pay, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          RETURNING *`,
          [
            id, date, emp.id, emp.name, emp.role, entry.projectId || null, entry.projectName || null,
            status, entry.checkIn || '08:00', entry.checkOut || '16:00', Number(entry.overtimeHours || 0), false,
            emp.dailyWage, emp.overtimeHourlyWage, totalPay, entry.notes || '', userName,
          ]
        );
        created.push(mapAttendance(res.rows[0]));
      }

      await insertAuditLog(userName, userRole as any, 'Catat Absensi Massal', 'Absensi', `Mencatat ${created.length} kehadiran pada tanggal ${date}`);
      return { created, skipped };
    });
  },

  async deleteAttendance(id: string, userName: string, userRole: string): Promise<void> {
    await query('DELETE FROM attendance WHERE id = $1', [id]);
    await insertAuditLog(userName, userRole as any, 'Hapus Absensi', 'Absensi', `Menghapus absensi ID ${id}`);
  },

  // 5. Overtime
  async getOvertime(): Promise<OvertimeRecord[]> {
    const res = await query('SELECT * FROM overtime_records ORDER BY date DESC, id DESC');
    return res.rows.map(mapOvertime);
  },

  async createOvertime(data: any, userName: string, userRole: string): Promise<OvertimeRecord> {
    const empRes = await query('SELECT * FROM employees WHERE id = $1', [data.employeeId]);
    if (!empRes.rows.length) throw new Error('Karyawan tidak ditemukan.');
    const emp = mapEmployee(empRes.rows[0]);

    const id = `OVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const hours = Number(data.hours || 0);
    const hourlyRate = emp.overtimeHourlyWage;
    const totalPay = hours * hourlyRate;

    const res = await query(
      `INSERT INTO overtime_records (
        id, attendance_id, date, employee_id, employee_name, employee_role,
        project_id, project_name, start_time, end_time, hours,
        hourly_rate_snapshot, total_pay, status, notes, audit_trail
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        id, data.attendanceId || null, data.date, emp.id, emp.name, emp.role,
        data.projectId || null, data.projectName || null, data.startTime || '', data.endTime || '',
        hours, hourlyRate, totalPay, 'Menunggu persetujuan', data.notes || '',
        JSON.stringify([{ timestamp: new Date().toISOString(), user: userName, action: 'Pengajuan Lembur' }]),
      ]
    );

    return mapOvertime(res.rows[0]);
  },

  async updateOvertimeStatus(id: string, status: string, hours?: number, notes?: string, userName?: string): Promise<OvertimeRecord> {
    const ovtRes = await query('SELECT * FROM overtime_records WHERE id = $1', [id]);
    if (!ovtRes.rows.length) throw new Error('Catatan lembur tidak ditemukan.');
    const current = mapOvertime(ovtRes.rows[0]);

    const finalHours = hours !== undefined ? Number(hours) : current.hours;
    const totalPay = finalHours * current.hourlyRateSnapshot;
    const trail = [...current.auditTrail, { timestamp: new Date().toISOString(), user: userName || 'Admin', action: `Status diubah menjadi: ${status}` }];

    const res = await query(
      `UPDATE overtime_records SET
        status = $1, hours = $2, total_pay = $3, notes = COALESCE($4, notes),
        approved_by = $5, approved_at = NOW(), audit_trail = $6
       WHERE id = $7 RETURNING *`,
      [status, finalHours, totalPay, notes, userName || 'Admin', JSON.stringify(trail), id]
    );

    return mapOvertime(res.rows[0]);
  },

  async deleteOvertime(id: string): Promise<void> {
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
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    const datePrefix = (data.requestDate || new Date().toISOString()).slice(0, 7).replace('-', '');
    const kasbonNumber = `KB-${datePrefix}-${Date.now().toString().slice(-4)}-${randomSuffix}`;
    const id = `KB-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

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
        id, kasbon_number, request_date, employee_id, employee_name, employee_role,
        employee_start_date, eligibility_date, is_eligible, eligibility_reason,
        amount, reason, status, deducted_amount, remaining_amount,
        target_payment_period, admin_notes, project_id,
        attachment_file_path, attachment_file_name, attachment_file_size, attachment_mime_type,
        audit_trail
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *`,
      [
        id,
        kasbonNumber,
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

      // 1. Resolve work days, basic salary, overtime, and gross
      let totalWorkDays = Number(data.totalWorkDays ?? data.workDays);
      let totalBasicSalary = Number(data.totalBasicSalary ?? data.basicSalary);
      let approvedOvertimeHours = Number(data.approvedOvertimeHours);
      let totalOvertimePay = Number(data.totalOvertimePay ?? data.overtimePay);
      let numGross = Number(data.grossSalary);

      // Auto-compute dynamically from attendance & overtime tables if not sent or 0
      if (isNaN(numGross) || numGross <= 0 || isNaN(totalBasicSalary) || totalBasicSalary <= 0) {
        const attRes = await client.query(
          `SELECT status, daily_wage_snapshot FROM attendance
           WHERE employee_id = $1 AND date >= $2 AND date <= $3`,
          [emp.id, data.periodStart, data.periodEnd]
        );
        const presentAtts = attRes.rows.filter((r: any) => r.status === 'Hadir');
        totalWorkDays = presentAtts.length;
        totalBasicSalary = presentAtts.reduce((sum: number, r: any) => sum + Number(r.daily_wage_snapshot || emp.dailyWage), 0);

        const ovtRes = await client.query(
          `SELECT hours, total_pay FROM overtime_records
           WHERE employee_id = $1 AND date >= $2 AND date <= $3 AND status = 'Disetujui'`,
          [emp.id, data.periodStart, data.periodEnd]
        );
        approvedOvertimeHours = ovtRes.rows.reduce((sum: number, r: any) => sum + Number(r.hours || 0), 0);
        totalOvertimePay = ovtRes.rows.reduce((sum: number, r: any) => sum + Number(r.total_pay || 0), 0);
        numGross = totalBasicSalary + totalOvertimePay;
      }

      if (isNaN(totalWorkDays)) totalWorkDays = 0;
      if (isNaN(totalBasicSalary)) totalBasicSalary = 0;
      if (isNaN(approvedOvertimeHours)) approvedOvertimeHours = 0;
      if (isNaN(totalOvertimePay)) totalOvertimePay = 0;
      if (isNaN(numGross)) numGross = 0;

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
          action: `Pembayaran gaji diproses (${paymentNumber})`,
        },
      ];

      const insRes = await client.query(
        `INSERT INTO salary_payments (
          id, payment_number, period_start, period_end, employee_id, employee_name, employee_role,
          project_id, total_work_days, approved_overtime_hours, total_basic_salary, total_overtime_pay,
          gross_salary, kasbon_deduction, other_deductions, net_salary, payment_date,
          payment_method, reference_number, status, notes, processed_by, created_at, audit_trail
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), $23
        ) RETURNING *`,
        [
          paymentId, paymentNumber, data.periodStart, data.periodEnd, emp.id, emp.name, emp.role,
          data.projectId || null, Number(totalWorkDays), Number(approvedOvertimeHours),
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
