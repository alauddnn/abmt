import {
  CompanySettings,
  Employee,
  Attendance,
  OvertimeRecord,
  KasbonRecord,
  SalaryPayment,
  OperationalExpense,
  DashboardStats,
  AuditLog,
  UserSession,
  AppUser,
  Project,
  ProjectAssignment,
  ProjectExpense,
  ProjectOverviewStats,
} from '../types.js';

// Get current user session and auth headers
export function getCurrentAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = localStorage.getItem('kms_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }

    const raw = localStorage.getItem('kms_user');
    if (raw) {
      const u = JSON.parse(raw);
      headers['x-user-name'] = u.name || 'Administrator Proyek';
      headers['x-user-role'] = u.role || 'admin';
    }
  } catch {}

  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getCurrentAuthHeaders(),
    ...(options.headers || {}),
  };

  let response: Response;
  try {
    response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new Error(`Koneksi jaringan terputus atau server tidak merespons: ${netErr?.message || 'Network error'}`);
  }

  if (!response.ok) {
    let errorMsg = `Permintaan gagal (Status HTTP ${response.status}${response.statusText ? ` - ${response.statusText}` : ''})`;
    let errorMeta: any = null;
    try {
      const rawText = await response.text();
      try {
        const data = JSON.parse(rawText);
        if (data && typeof data === 'object') {
          errorMeta = data;
          if (data.error && typeof data.error === 'string') {
            errorMsg = data.error;
          } else if (data.message && typeof data.message === 'string') {
            errorMsg = data.message;
          } else if (data.msg && typeof data.msg === 'string') {
            errorMsg = data.msg;
          }
        }
      } catch {
        const clean = rawText.trim();
        if (clean && clean.length < 250 && !clean.includes('<!DOCTYPE') && !clean.includes('<html')) {
          errorMsg = clean;
        }
      }
    } catch {}
    const errObj: any = new Error(errorMsg);
    if (errorMeta) {
      errObj.status = response.status;
      errObj.transactionCounts = errorMeta.transactionCounts;
      errObj.canDeactivate = errorMeta.canDeactivate;
    }
    throw errObj;
  }

  return response.json();
}

export const api = {
  // Auth
  verifyTurnstile: (token: string) =>
    request<{ success: boolean; ticket: string }>('/auth/turnstile/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  loginWithGoogle: (data: {
    email: string;
    name?: string;
    turnstileToken?: string;
    turnstileTicket?: string;
  }) =>
    request<{ token: string; user: UserSession }>('/auth/google-login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (
    usernameOrEmail: string,
    password?: string,
    role?: string,
    turnstileToken?: string,
    turnstileTicket?: string
  ) =>
    request<{ token: string; user: UserSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, username: usernameOrEmail, password, role, turnstileToken, turnstileTicket }),
    }),

  logout: () =>
    request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => request<{ user: UserSession }>('/auth/me'),

  // Users Management
  getUsers: () => request<AppUser[]>('/users'),
  createUser: (data: { username: string; email?: string; name: string; role: 'admin' | 'owner'; password: string }) =>
    request<AppUser>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: { name?: string; email?: string; role?: 'admin' | 'owner'; password?: string }) =>
    request<AppUser>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    }),

  // Projects Management
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: Partial<Project>) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    request<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
    }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  getProjectStats: (id: string, date?: string) =>
    request<ProjectOverviewStats>(`/projects/${id}/stats${date ? `?date=${date}` : ''}`),
  getProjectAssignments: (projectId: string) =>
    request<ProjectAssignment[]>(`/projects/${projectId}/assignments`),
  assignEmployeeToProject: (
    projectId: string,
    data: { employeeId: string; roleInProject?: string; assignedDate?: string; notes?: string }
  ) =>
    request<ProjectAssignment>(`/projects/${projectId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProjectAssignment: (
    projectId: string,
    assignmentId: string,
    data: { roleInProject?: string; status?: string; notes?: string }
  ) =>
    request<ProjectAssignment>(`/projects/${projectId}/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  removeProjectAssignment: (projectId: string, assignmentId: string) =>
    request<{ message: string }>(`/projects/${projectId}/assignments/${assignmentId}`, {
      method: 'DELETE',
    }),
  createProjectEmployee: (
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
    }
  ) =>
    request<ProjectAssignment>(`/projects/${projectId}/employees`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProjectEmployee: (
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
    }
  ) =>
    request<ProjectAssignment>(`/projects/${projectId}/employees/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProjectEmployee: (projectId: string, assignmentId: string) =>
    request<{ message: string }>(`/projects/${projectId}/employees/${assignmentId}`, {
      method: 'DELETE',
    }),
  getProjectExpenses: (projectId: string, expenseType?: 'transportasi' | 'operasional') =>
    request<ProjectExpense[]>(
      `/projects/${projectId}/expenses${expenseType ? `?expenseType=${expenseType}` : ''}`
    ),
  createProjectExpense: (projectId: string, data: any) =>
    request<ProjectExpense>(`/projects/${projectId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProjectExpense: (projectId: string, expenseId: string, data: any) =>
    request<ProjectExpense>(`/projects/${projectId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProjectExpense: (projectId: string, expenseId: string) =>
    request<{ message: string }>(`/projects/${projectId}/expenses/${expenseId}`, {
      method: 'DELETE',
    }),
  getProjectKasbon: (projectId: string) =>
    request<KasbonRecord[]>(`/projects/${projectId}/kasbon`),
  createProjectKasbon: (projectId: string, data: any) =>
    request<KasbonRecord>(`/projects/${projectId}/kasbon`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteProjectKasbon: (projectId: string, kasbonId: string) =>
    request<{ message: string }>(`/projects/${projectId}/kasbon/${kasbonId}`, {
      method: 'DELETE',
    }),
  updateProjectKasbonStatus: (projectId: string, kasbonId: string, action: 'approve' | 'reject', rejectionReason?: string, adminNotes?: string) =>
    request<KasbonRecord>(`/projects/${projectId}/kasbon/${kasbonId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ action, rejectionReason, adminNotes }),
    }),
  deleteProjectKasbonAttachment: (projectId: string, kasbonId: string, attachmentId: string) =>
    request<{ message: string }>(`/projects/${projectId}/kasbon/${kasbonId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
  getProjectRecap: (projectId: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const q = new URLSearchParams(params).toString();
    return request<any>(`/projects/${projectId}/recap${q ? `?${q}` : ''}`);
  },

  // Settings
  getSettings: () => request<CompanySettings>('/settings'),
  updateSettings: (settings: Partial<CompanySettings> & { syncActiveEmployees?: boolean }) =>
    request<CompanySettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Employees
  getEmployees: () => request<Employee[]>('/employees'),
  createEmployee: (emp: Partial<Employee>) =>
    request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(emp),
    }),
  updateEmployee: (id: string, emp: Partial<Employee>) =>
    request<Employee>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(emp),
    }),
  deleteEmployee: (id: string) =>
    request<{ message: string }>(`/employees/${id}`, {
      method: 'DELETE',
    }),

  // Attendance
  getAttendance: (params?: { date?: string; startDate?: string; endDate?: string; employeeId?: string; role?: string; projectId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<Attendance[]>(`/attendance${query ? `?${query}` : ''}`);
  },
  recordAttendance: (
    data: Omit<Partial<Attendance>, 'kasbonAttachments'> & {
      durationHours?: number;
      durationMinutes?: number;
      hasKasbon?: boolean;
      kasbonId?: string;
      kasbonAmount?: number;
      kasbonNotes?: string;
      kasbonAttachments?: Array<{ fileName: string; dataBase64: string; fileSize?: number; mimeType?: string }>;
      removeKasbonPhoto?: boolean;
    }
  ) =>
    request<Attendance>('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recordBulkAttendance: (date: string, entries: any[]) =>
    request<{ message: string; created: Attendance[]; skipped: string[] }>('/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ date, entries }),
    }),
  updateAttendance: (
    id: string,
    data: Omit<Partial<Attendance>, 'kasbonAttachments'> & {
      durationHours?: number;
      durationMinutes?: number;
      hasKasbon?: boolean;
      kasbonId?: string;
      kasbonAmount?: number;
      kasbonNotes?: string;
      kasbonAttachments?: Array<{ fileName: string; dataBase64: string; fileSize?: number; mimeType?: string }>;
      removeKasbonPhoto?: boolean;
    }
  ) =>
    request<Attendance>(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAttendance: (id: string, projectId?: string) =>
    request<{ message: string; deleted?: Attendance }>(
      `/attendance/${id}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
      {
        method: 'DELETE',
      }
    ),

  // Overtime
  getOvertime: () => request<OvertimeRecord[]>('/overtime'),
  recordOvertime: (data: Partial<OvertimeRecord> & { durationHours?: number; durationMinutes?: number }) =>
    request<OvertimeRecord>('/overtime', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOvertimeStatus: (
    id: string,
    status: string,
    hours?: number,
    notes?: string,
    durationHours?: number,
    durationMinutes?: number
  ) =>
    request<OvertimeRecord>(`/overtime/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, hours, notes, durationHours, durationMinutes }),
    }),

  // Kasbon
  getKasbon: () => request<KasbonRecord[]>('/kasbon'),
  applyKasbon: (data: { employeeId: string; requestDate: string; amount: number; reason: string; targetPaymentPeriod?: string; adminNotes?: string }) =>
    request<KasbonRecord>('/kasbon', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateKasbonStatus: (id: string, action: 'approve' | 'reject', rejectionReason?: string, adminNotes?: string) =>
    request<KasbonRecord>(`/kasbon/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ action, rejectionReason, adminNotes }),
    }),

  // Payroll
  previewPayroll: (periodStart: string, periodEnd: string, employeeId?: string) => {
    const params: any = { periodStart, periodEnd };
    if (employeeId) params.employeeId = employeeId;
    const query = new URLSearchParams(params).toString();
    return request<any>(`/payroll/preview?${query}`);
  },
  generatePayroll: (periodStart: string, periodEnd: string) =>
    request<{ message: string; count: number; payments: SalaryPayment[] }>('/payroll/generate', {
      method: 'POST',
      body: JSON.stringify({ periodStart, periodEnd }),
    }),
  getPayments: (params?: { periodStart?: string; periodEnd?: string; status?: string; employeeId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<SalaryPayment[]>(`/payroll/payments${query ? `?${query}` : ''}`);
  },
  paySalary: (id: string, paymentMethod: string, referenceNumber?: string, notes?: string) =>
    request<SalaryPayment>(`/payroll/payments/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, referenceNumber, notes }),
    }),
  cancelPayment: (id: string, reason: string) =>
    request<SalaryPayment>(`/payroll/payments/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  // Operational Expenses (Owner & Asisten)
  getExpenses: (params?: { personType?: string; category?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<OperationalExpense[]>(`/expenses${query ? `?${query}` : ''}`);
  },
  createExpense: (data: any) =>
    request<OperationalExpense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExpense: (id: string, data: any) =>
    request<OperationalExpense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteExpense: (id: string) =>
    request<{ message: string }>(`/expenses/${id}`, {
      method: 'DELETE',
    }),
  deleteExpenseAttachment: (attachmentId: string) =>
    request<{ message: string }>(`/expenses/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
  getExpenseStorageStatus: () =>
    request<{
      supabaseStorageActive: boolean;
      bucketName: string;
      bucketAccess: string;
      allowedFormats: string[];
      maxFileSizeMb: number;
      url: string;
    }>('/expenses/storage-status'),

  // Dashboard & Stats
  getDashboardStats: (period: string, startDate?: string, endDate?: string) => {
    const params: any = { period };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const query = new URLSearchParams(params).toString();
    return request<DashboardStats>(`/dashboard/stats?${query}`);
  },

  // Reports
  getReport: (type: string, startDate?: string, endDate?: string) => {
    const params: any = { type };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const query = new URLSearchParams(params).toString();
    return request<{ title: string; data: any[] }>(`/reports?${query}`);
  },

  // Audit Logs
  getAuditLogs: () => request<AuditLog[]>('/audit-logs'),

  // Automated Test Scenarios (Testing the 8 cases)
  runTestScenarios: () =>
    request<{ summary: string; results: any[] }>('/test-scenarios/run', {
      method: 'POST',
    }),
  resetTestScenarios: () =>
    request<{ message: string }>('/test-scenarios/reset', {
      method: 'POST',
    }),

  // Backward compatibility aliases
  createAttendance: (
    data: Omit<Partial<Attendance>, 'kasbonAttachments'> & {
      durationHours?: number;
      durationMinutes?: number;
      hasKasbon?: boolean;
      kasbonId?: string;
      kasbonAmount?: number;
      kasbonNotes?: string;
      kasbonAttachments?: Array<{ fileName: string; dataBase64: string; fileSize?: number; mimeType?: string }>;
      removeKasbonPhoto?: boolean;
    }
  ) =>
    request<Attendance>('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createBulkAttendance: (date: string, entries: any[]) =>
    request<{ message: string; created: Attendance[]; skipped: string[] }>('/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ date, entries }),
    }),
  createOvertime: (data: Partial<OvertimeRecord> & { durationHours?: number; durationMinutes?: number }) =>
    request<OvertimeRecord>('/overtime', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createKasbon: (data: any) =>
    request<KasbonRecord>('/kasbon', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSalaryPayments: (params?: { periodStart?: string; periodEnd?: string; status?: string; employeeId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<SalaryPayment[]>(`/payroll/payments${query ? `?${query}` : ''}`);
  },
  getPayrollPreview: (periodStart: string, periodEnd: string, employeeId?: string) => {
    const params: any = { periodStart, periodEnd };
    if (employeeId) params.employeeId = employeeId;
    const query = new URLSearchParams(params).toString();
    return request<any>(`/payroll/preview?${query}`);
  },
  processPayment: (
    dataOrId: any,
    paymentMethod?: string,
    referenceNumber?: string,
    notes?: string
  ) => {
    if (typeof dataOrId === 'object') {
      return request<SalaryPayment>('/payroll/process', {
        method: 'POST',
        body: JSON.stringify(dataOrId),
      });
    }
    return request<SalaryPayment>(`/payroll/payments/${dataOrId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, referenceNumber, notes }),
    });
  },
};
