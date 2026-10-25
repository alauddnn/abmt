-- ============================================================================
-- SKEMA DATABASE POSTGRESQL SUPABASE
-- KONTRAKTOR MANAGEMENT SYSTEM - PT. ASTA BRATA MATAHARI TERBIT
-- ============================================================================
-- Jalankan skrip ini sekali pada menu "SQL Editor" di Dashboard Supabase Anda.
-- ============================================================================

-- 1. TABEL PENGATURAN PERUSAHAAN
CREATE TABLE IF NOT EXISTS company_settings (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
  company_name VARCHAR(255) NOT NULL DEFAULT 'PT. ASTA BRATA MATAHARI TERBIT',
  tagline VARCHAR(255) DEFAULT 'General Contractor & Interior Specialist',
  address TEXT DEFAULT 'Jl. Konstruksi Mandiri No. 88, Jakarta Selatan',
  phone VARCHAR(50) DEFAULT '0812-8899-7722',
  owner_name VARCHAR(150) DEFAULT 'Bpk. Ir. H. Bambang Prakoso',
  assistant_name VARCHAR(150) DEFAULT 'Ahmad Fauzi',
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

-- Inisialisasi Pengaturan Default jika belum ada
INSERT INTO company_settings (id, company_name, tagline, address, phone, owner_name, assistant_name, work_hour_start, work_hour_end, wage_mandor_daily, overtime_mandor_hourly, wage_tukang_daily, overtime_tukang_hourly, wage_helper_daily, overtime_helper_hourly, wage_driver_daily, overtime_driver_hourly, min_tenure_days_for_kasbon)
VALUES ('default', 'PT. ASTA BRATA MATAHARI TERBIT', 'General Contractor & Interior Specialist', 'Jl. Konstruksi Mandiri No. 88, Jakarta Selatan', '0812-8899-7722', 'Bpk. Ir. H. Bambang Prakoso', 'Ahmad Fauzi', '08:00', '16:00', 200000, 25000, 150000, 20000, 125000, 15000, 140000, 18000, 7)
ON CONFLICT (id) DO NOTHING;

-- 2. TABEL KARYAWAN (Mendukung ID manual seperti EMP-TK-01, EMP-MD-01, dll)
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Mandor', 'Tukang', 'Helper', 'Driver', 'Kenek')),
  daily_wage NUMERIC(15, 2) NOT NULL,
  overtime_hourly_wage NUMERIC(15, 2) NOT NULL,
  start_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  phone VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

-- 3. TABEL PROYEK
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  client VARCHAR(150) NOT NULL,
  start_date DATE,
  target_end_date DATE,
  budget NUMERIC(15, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Berjalan',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 4. TABEL PENEMPATAN KARYAWAN PADA PROYEK (Project Assignments)
CREATE TABLE IF NOT EXISTS project_assignments (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON UPDATE CASCADE ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  role_in_project VARCHAR(50),
  assigned_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_project_employee UNIQUE (project_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_proj_assign_proj ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_assign_emp ON project_assignments(employee_id);

-- 5. TABEL ABSENSI (Dilengkapi referensi proyek)
CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NOT NULL,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_name VARCHAR(150) NOT NULL,
  employee_role VARCHAR(50) NOT NULL,
  project_id VARCHAR(64) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
  project_name VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  check_in VARCHAR(10) DEFAULT '08:00',
  check_out VARCHAR(10) DEFAULT '16:00',
  overtime_hours NUMERIC(6, 2) DEFAULT 0,
  overtime_approved BOOLEAN DEFAULT FALSE,
  daily_wage_snapshot NUMERIC(15, 2) NOT NULL,
  overtime_wage_snapshot NUMERIC(15, 2) NOT NULL,
  total_daily_pay NUMERIC(15, 2) NOT NULL,
  notes TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(150),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_project ON attendance(project_id);

-- 6. TABEL LEMBUR KARYAWAN
CREATE TABLE IF NOT EXISTS overtime_records (
  id VARCHAR(64) PRIMARY KEY,
  attendance_id VARCHAR(64) REFERENCES attendance(id) ON UPDATE CASCADE ON DELETE SET NULL,
  date DATE NOT NULL,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_name VARCHAR(150) NOT NULL,
  employee_role VARCHAR(50) NOT NULL,
  project_id VARCHAR(64) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
  project_name VARCHAR(255),
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  hours NUMERIC(6, 2) NOT NULL,
  hourly_rate_snapshot NUMERIC(15, 2) NOT NULL,
  total_pay NUMERIC(15, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Menunggu persetujuan',
  approved_by VARCHAR(150),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  audit_trail JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_records(date);
CREATE INDEX IF NOT EXISTS idx_overtime_employee ON overtime_records(employee_id);

-- 7. TABEL KASBON KARYAWAN
CREATE TABLE IF NOT EXISTS kasbon_records (
  id VARCHAR(64) PRIMARY KEY,
  kasbon_number VARCHAR(50) UNIQUE NOT NULL,
  request_date DATE NOT NULL,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_name VARCHAR(150) NOT NULL,
  employee_role VARCHAR(50) NOT NULL,
  employee_start_date DATE,
  eligibility_date DATE,
  is_eligible BOOLEAN DEFAULT TRUE,
  eligibility_reason TEXT,
  amount NUMERIC(15, 2) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'Menunggu persetujuan',
  deducted_amount NUMERIC(15, 2) DEFAULT 0,
  remaining_amount NUMERIC(15, 2) NOT NULL,
  target_payment_period VARCHAR(50),
  admin_notes TEXT,
  approved_by VARCHAR(150),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  audit_trail JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_kasbon_employee ON kasbon_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_kasbon_status ON kasbon_records(status);

-- 8. TABEL PENGGAJIAN (SALARY PAYMENTS)
CREATE TABLE IF NOT EXISTS salary_payments (
  id VARCHAR(64) PRIMARY KEY,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  employee_name VARCHAR(150) NOT NULL,
  employee_role VARCHAR(50) NOT NULL,
  project_id VARCHAR(64) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
  total_work_days INT DEFAULT 0,
  approved_overtime_hours NUMERIC(6, 2) DEFAULT 0,
  total_basic_salary NUMERIC(15, 2) DEFAULT 0,
  total_overtime_pay NUMERIC(15, 2) DEFAULT 0,
  gross_salary NUMERIC(15, 2) DEFAULT 0,
  kasbon_deduction NUMERIC(15, 2) DEFAULT 0,
  other_deductions NUMERIC(15, 2) DEFAULT 0,
  net_salary NUMERIC(15, 2) DEFAULT 0,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Kas Tunai',
  reference_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Belum dibayar',
  notes TEXT,
  processed_by VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  audit_trail JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_salary_employee ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_period ON salary_payments(period_start, period_end);

-- 9. TABEL POTONGAN KASBON DARI GAJI
CREATE TABLE IF NOT EXISTS kasbon_deductions (
  id VARCHAR(64) PRIMARY KEY,
  kasbon_id VARCHAR(64) NOT NULL REFERENCES kasbon_records(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  salary_payment_id VARCHAR(64) NOT NULL REFERENCES salary_payments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  date DATE NOT NULL,
  employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_kasbon_deduct_kasbon ON kasbon_deductions(kasbon_id);
CREATE INDEX IF NOT EXISTS idx_kasbon_deduct_salary ON kasbon_deductions(salary_payment_id);

-- 10. TABEL PENGELUARAN OPERASIONAL (Owner & Asisten)
CREATE TABLE IF NOT EXISTS operational_expenses (
  id VARCHAR(64) PRIMARY KEY,
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  date DATE NOT NULL,
  person_type VARCHAR(50) NOT NULL CHECK (person_type IN ('Owner', 'Asisten')),
  person_name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Bensin', 'Rokok', 'E-Toll', 'Makan')),
  project_id VARCHAR(64) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Tunai',
  receipt_proof TEXT,
  notes TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON operational_expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_person ON operational_expenses(person_type);

-- 11. TABEL PENGGUNA & HAK AKSES (ADMIN & OWNER)
CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner')),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Akun Default:
-- Admin: username 'admin', password 'admin123'
-- Owner: username 'owner', password 'owner123'
INSERT INTO app_users (id, username, email, name, role, password_hash, salt, created_at)
VALUES 
  (
    'USR-ADMIN-01',
    'admin',
    'admin@astabrata.com',
    'Administrator Proyek',
    'admin',
    -- PBKDF2 SHA-512 hash untuk 'admin123' dengan salt 'e5a1b3c7d9f2468013579bdf02468ace'
    '23d408477ff35467e2a9ef4f85e49c7161b0c0f99479cb25a4099ce207d3837920409a7b7a151b6814d43ae621bc14dcae2ef75f284e365063065d6c8e312457',
    'e5a1b3c7d9f2468013579bdf02468ace',
    NOW()
  ),
  (
    'USR-OWNER-01',
    'owner',
    'owner@astabrata.com',
    'Bpk. Ir. H. Bambang Prakoso (Owner)',
    'owner',
    -- PBKDF2 SHA-512 hash untuk 'owner123' dengan salt 'f2468ace02468ace13579bdfa1b3c7d9'
    '3fe39c63c37e192c7322e1858c160da308554284bfa4a6c6e7a2b0051e967a57a8a1db54341aa9aa354f91e459952542a1f057816f1947e4b953457a4128f731',
    'f2468ace02468ace13579bdfa1b3c7d9',
    NOW()
  )
ON CONFLICT (username) DO NOTHING;

-- 12. TABEL SESI PENGGUNA (SESSI PERSISTEN)
CREATE TABLE IF NOT EXISTS user_sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES app_users(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- 13. TABEL AUDIT LOG TRAIL
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_name VARCHAR(150) NOT NULL,
  user_role VARCHAR(20) NOT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- ============================================================================
-- 14. TABEL LAMPIRAN FOTO BUKTI PENGELUARAN (SUPABASE STORAGE PRIVATE BUCKET)
-- ============================================================================
-- Migrasi aman: terhubung ke tabel operational_expenses melalui Foreign Key
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
CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense_id ON operational_expense_attachments(expense_id);
