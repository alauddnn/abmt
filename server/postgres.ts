import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

export const isPostgresConfigured = Boolean(
  databaseUrl && databaseUrl.trim() && !databaseUrl.includes('your-project-ref')
);

function getOptimizedConnectionString(url?: string): string {
  if (!url) return '';
  let str = url.trim();
  // When using Supabase Supavisor pooler (*.pooler.supabase.com),
  // port 5432 is Session mode (limited to pool_size: 15 on free/micro tier).
  // Port 6543 is Transaction mode (multiplexed, allowing high concurrency without EMAXCONNSESSION).
  if (str.includes('pooler.supabase.com')) {
    try {
      const u = new URL(str);
      if (u.port === '5432' || !u.port) {
        u.port = '6543';
        str = u.toString();
      }
    } catch {
      str = str.replace(':5432', ':6543');
    }
  }
  return str;
}

const connectionString = getOptimizedConnectionString(databaseUrl);

export const pool = new Pool({
  connectionString,
  ssl: isPostgresConfigured ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL client pool error:', err.message);
});

// Helper for single parameterized query
export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  if (!isPostgresConfigured) {
    throw new Error(
      'DATABASE_URL belum dikonfigurasi. Harap masukkan URI koneksi Supabase PostgreSQL pada environment variable backend.'
    );
  }
  return pool.query<T>(text, params);
}

// Helper for atomic transaction
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!isPostgresConfigured) {
    throw new Error('DATABASE_URL belum dikonfigurasi.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Password hashing & security
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

// Audit log helper
export async function insertAuditLog(
  userName: string,
  userRole: 'admin' | 'owner' | 'Administrator' | 'Petugas',
  action: string,
  module: string,
  details: string
) {
  try {
    if (!isPostgresConfigured) return;
    const normalizedRole = userRole.toLowerCase().includes('admin') ? 'admin' : 'owner';
    const id = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    await pool.query(
      `INSERT INTO audit_logs (id, timestamp, user_name, user_role, action, module, details)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [id, userName, normalizedRole, action, module, details]
    );
  } catch (err) {
    console.error('Failed to write audit log to PostgreSQL:', err);
  }
}
