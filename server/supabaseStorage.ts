import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DEFAULT_SUPABASE_URL = 'https://wrphgazcvapjbwlaryny.supabase.co';
export const EXPENSE_BUCKET_NAME = 'expense-receipts';
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Storage directory for local fallback (resilience across offline / test setups)
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads', 'expense-receipts');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Retrieve configured Supabase URL & Key from server environment
export function getBackendSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  );
}

export function getBackendSupabaseKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  );
}

let supabaseAdminClient: SupabaseClient | null = null;

export function getBackendSupabaseClient(): SupabaseClient | null {
  const key = getBackendSupabaseKey();
  if (!key || key.trim().length < 20 || key.includes('your-anon-key')) {
    return null;
  }

  if (!supabaseAdminClient) {
    const url = getBackendSupabaseUrl();
    try {
      supabaseAdminClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase Storage client:', err);
      return null;
    }
  }

  return supabaseAdminClient;
}

export function isSupabaseStorageAvailable(): boolean {
  return Boolean(getBackendSupabaseClient());
}

// Magic number validation to prevent spoofed file extensions
export function validateImageBuffer(buffer: Buffer, fileName: string, declaredMimeType: string): { valid: boolean; error?: string; mimeType: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File foto kosong / tidak valid.', mimeType: '' };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Ukuran file foto (${sizeMb} MB) melebihi batas maksimal 5 MB.`,
      mimeType: '',
    };
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Ekstensi file '${ext}' tidak didukung. Harap gunakan format JPG, JPEG, PNG, atau WebP.`,
      mimeType: '',
    };
  }

  // Detect signature from magic bytes
  let detectedMime = '';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = 'image/jpeg';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = 'image/png';
  } else if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedMime = 'image/webp';
  }

  if (!detectedMime) {
    // If declared MIME is in allowed list and extension matches, accept as fallback
    if (ALLOWED_MIME_TYPES.includes(declaredMimeType.toLowerCase())) {
      detectedMime = declaredMimeType.toLowerCase();
    } else {
      return {
        valid: false,
        error: 'Konten file bukan merupakan format gambar yang valid (hanya JPG, PNG, WebP).',
        mimeType: '',
      };
    }
  }

  return { valid: true, mimeType: detectedMime };
}

// Upload file to Supabase Storage private bucket, with local fallback
export async function uploadToStorage(
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
  expenseId: string
): Promise<{ filePath: string; storageType: 'supabase' | 'local'; signedUrl?: string }> {
  const ext = path.extname(originalFileName).toLowerCase() || '.jpg';
  const cleanBase = path
    .basename(originalFileName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const uniqueId = crypto.randomBytes(6).toString('hex');
  const remotePath = `${expenseId}/${Date.now()}_${uniqueId}_${cleanBase}${ext}`;

  const client = getBackendSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.storage
        .from(EXPENSE_BUCKET_NAME)
        .upload(remotePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn('Supabase Storage upload warning (fallback to local if bucket not found):', error.message);
      } else if (data?.path) {
        // Generate signed URL for private bucket (valid 1 hour)
        const { data: signedData } = await client.storage
          .from(EXPENSE_BUCKET_NAME)
          .createSignedUrl(data.path, 3600);

        return {
          filePath: data.path,
          storageType: 'supabase',
          signedUrl: signedData?.signedUrl || undefined,
        };
      }
    } catch (err: any) {
      console.error('Error uploading to Supabase Storage:', err);
    }
  }

  // Local persistent fallback
  ensureUploadsDir();
  const localSubdir = path.join(UPLOADS_DIR, expenseId);
  if (!fs.existsSync(localSubdir)) {
    fs.mkdirSync(localSubdir, { recursive: true });
  }
  const localFileName = `${Date.now()}_${uniqueId}_${cleanBase}${ext}`;
  const fullPath = path.join(localSubdir, localFileName);
  fs.writeFileSync(fullPath, buffer);

  return {
    filePath: `local://${expenseId}/${localFileName}`,
    storageType: 'local',
  };
}

// Generate signed URL for private bucket file
export async function getAttachmentSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
  if (filePath.startsWith('local://')) {
    return null;
  }
  const client = getBackendSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.storage
      .from(EXPENSE_BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// Download file buffer for authenticated streaming / viewing
export async function downloadAttachmentBuffer(
  filePath: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  if (filePath.startsWith('local://')) {
    const relative = filePath.replace('local://', '');
    const fullPath = path.join(UPLOADS_DIR, relative);
    if (fs.existsSync(fullPath)) {
      const buf = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      let mime = 'image/jpeg';
      if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      return { buffer: buf, mimeType: mime, fileName: path.basename(fullPath) };
    }
    return null;
  }

  const client = getBackendSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.storage.from(EXPENSE_BUCKET_NAME).download(filePath);
      if (error || !data) {
        console.warn('Failed to download from Supabase Storage:', error?.message);
      } else {
        const arrayBuf = await data.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const ext = path.extname(filePath).toLowerCase();
        let mime = data.type || 'image/jpeg';
        if (ext === '.png') mime = 'image/png';
        else if (ext === '.webp') mime = 'image/webp';
        return { buffer: buf, mimeType: mime, fileName: path.basename(filePath) };
      }
    } catch (err) {
      console.error('Error downloading from Supabase Storage:', err);
    }
  }

  // Fallback: check if also saved locally
  const localFallbackPath = path.join(UPLOADS_DIR, filePath);
  if (fs.existsSync(localFallbackPath)) {
    const buf = fs.readFileSync(localFallbackPath);
    return { buffer: buf, mimeType: 'image/jpeg', fileName: path.basename(filePath) };
  }

  return null;
}

// Delete file from storage
export async function deleteFromStorage(filePath: string): Promise<boolean> {
  if (filePath.startsWith('local://')) {
    const relative = filePath.replace('local://', '');
    const fullPath = path.join(UPLOADS_DIR, relative);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  const client = getBackendSupabaseClient();
  if (client) {
    try {
      const { error } = await client.storage.from(EXPENSE_BUCKET_NAME).remove([filePath]);
      if (!error) return true;
    } catch (err) {
      console.error('Error deleting from Supabase Storage:', err);
    }
  }

  // Also remove local copy if exists
  const localFallbackPath = path.join(UPLOADS_DIR, filePath);
  if (fs.existsSync(localFallbackPath)) {
    try {
      fs.unlinkSync(localFallbackPath);
    } catch {}
  }

  return true;
}
