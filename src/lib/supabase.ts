import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project URL extracted from verified DATABASE_URL (project ref: wrphgazcvapjbwlaryny)
const DEFAULT_SUPABASE_URL = 'https://wrphgazcvapjbwlaryny.supabase.co';

export function getSupabaseUrl(): string {
  return (
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    localStorage.getItem('kms_supabase_url') ||
    DEFAULT_SUPABASE_URL
  );
}

export function getSupabaseAnonKey(): string {
  return (
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    localStorage.getItem('kms_supabase_anon_key') ||
    ''
  );
}

export function isSupabaseConfigured(): boolean {
  const key = getSupabaseAnonKey();
  return Boolean(key && key.trim() && key.length > 20 && !key.includes('your-anon-key'));
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      });
    } catch (err) {
      console.error('Error creating Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
