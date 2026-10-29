import React, { useState } from 'react';
import {
  AlertCircle,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useCompany } from '../context/CompanyContext.js';
import { CloudflareTurnstile } from '../components/CloudflareTurnstile.js';
import { api } from '../lib/api.js';

export const LoginPage: React.FC = () => {
  const { login, loading } = useAuth();
  const { settings } = useCompany();

  // Form state - standard login credentials (empty by default, no auto-fill)
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileTicket, setTurnstileTicket] = useState<string>('');

  // UI status
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Turnstile handlers
  const handleTurnstileVerify = async (token: string) => {
    setTurnstileToken(token);
    setErrorMessage('');
    try {
      const res = await api.verifyTurnstile(token);
      if (res.success && res.ticket) {
        setTurnstileTicket(res.ticket);
        sessionStorage.setItem('kms_turnstile_ticket', res.ticket);
      }
    } catch (err) {
      console.warn('Turnstile verify error:', err);
    }
  };

  const handleTurnstileExpire = () => {
    setTurnstileToken('');
    setTurnstileTicket('');
    sessionStorage.removeItem('kms_turnstile_ticket');
  };

  // Submit login with ID and Password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!turnstileToken && !turnstileTicket) {
      setErrorMessage('Harap selesaikan verifikasi Cloudflare Turnstile di bawah terlebih dahulu.');
      return;
    }

    if (!usernameOrEmail.trim()) {
      setErrorMessage('User ID / Username wajib diisi.');
      return;
    }

    if (!password) {
      setErrorMessage('Kata sandi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Role is determined authoritatively by the database record of the user
      const res = await login(
        usernameOrEmail.trim(),
        password,
        undefined,
        turnstileToken || undefined,
        turnstileTicket || undefined
      );

      if (!res.success) {
        setErrorMessage(res.error || 'User ID atau kata sandi tidak cocok.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat masuk ke sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerified = Boolean(turnstileToken || turnstileTicket);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#4693FD]/20">
      <div className="w-full max-w-[420px]">
        {/* Company Header - Sleek & Refined */}
        <div className="text-center mb-7">
          <div className="mx-auto w-16 h-16 mb-3 p-1.5 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm flex items-center justify-center">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-10-25_at_22.19.45-removebg-preview_fcf12665.png"
              alt={settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== `${window.location.origin}/logo.png`) {
                  target.src = '/logo.png';
                }
              }}
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            {settings?.companyName || 'PT. ASTA BRATA MATAHARI TERBIT'}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-medium">
            Sistem Informasi Manajemen Kontraktor Terpadu
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Masuk ke Sistem</h2>
            <p className="text-xs text-[#64748B] mt-1">
              Silakan masukkan kredensial akun Anda untuk mengakses portal.
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 leading-relaxed animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                User ID / Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="Masukkan User ID..."
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#4693FD] focus:ring-2 focus:ring-[#4693FD]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-10 pr-10 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#4693FD] focus:ring-2 focus:ring-[#4693FD]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-0.5 rounded transition-colors"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile Security Verification */}
            <div className="pt-1.5">
              <CloudflareTurnstile
                onVerify={handleTurnstileVerify}
                onExpire={handleTurnstileExpire}
                onError={(err) =>
                  setErrorMessage(
                    err
                      ? `Verifikasi keamanan Turnstile mengalami kendala (${err}). Silakan muat ulang halaman.`
                      : 'Gagal memuat verifikasi keamanan Cloudflare Turnstile.'
                  )
                }
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isSubmitting || !isVerified}
              className="w-full py-2.5 px-4 bg-[#4693FD] hover:bg-[#327dec] text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group active:scale-[0.99] mt-2"
            >
              <span>{isSubmitting || loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>
        </div>

        {/* Minimal Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#94A3B8]">
            &copy; {new Date().getFullYear()} PT. Asta Brata Matahari Terbit. All rights reserved.
          </p>
        </div>
      </div>

    </div>
  );
};
