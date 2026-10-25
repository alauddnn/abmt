import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (errorCode: string) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

interface CloudflareTurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err: string) => void;
  className?: string;
}

export const CloudflareTurnstile: React.FC<CloudflareTurnstileProps> = ({
  onVerify,
  onExpire,
  onError,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Cloudflare test sitekey (1x00000000000000000000AA) is official always-pass key for testing
  const siteKey =
    (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY as string) ||
    '1x00000000000000000000AA';

  const [status, setStatus] = useState<'loading' | 'ready' | 'verified' | 'error' | 'expired'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;

      // Remove existing widget if any
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'normal',
          callback: (token: string) => {
            if (!isMounted) return;
            setStatus('verified');
            setErrorMessage('');
            onVerify(token);
          },
          'error-callback': (code: string) => {
            if (!isMounted) return;
            setStatus('error');
            setErrorMessage(`Gagal memuat Turnstile (Kode: ${code || 'Error'})`);
            onError?.(code);
          },
          'expired-callback': () => {
            if (!isMounted) return;
            setStatus('expired');
            onExpire?.();
          },
        });
        widgetIdRef.current = id;
        if (isMounted) setStatus('ready');
      } catch (err: any) {
        console.error('Turnstile render error:', err);
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Gagal menginisialisasi widget Turnstile');
        }
      }
    };

    // Load Turnstile script if not already present
    const SCRIPT_ID = 'cf-turnstile-script';
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted) renderWidget();
      };
      script.onerror = () => {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Gagal memuat skrip Cloudflare Turnstile');
        }
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    } else {
      script.addEventListener('load', () => {
        if (isMounted) renderWidget();
      });
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return (
    <div className={`p-3.5 bg-[#F9FAFB] rounded-xl border border-[#EAECF0] ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className={`w-4 h-4 ${status === 'verified' ? 'text-[#12B76A]' : 'text-[#4693FD]'}`} />
          <span className="text-xs font-semibold text-[#344054]">
            Verifikasi Keamanan Turnstile
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#F2F4F7] text-[#667085] border border-[#E4E7EC]">
          Cloudflare
        </span>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[68px] py-1">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Loader2 className="w-4 h-4 animate-spin text-[#4693FD]" />
            <span>Memuat verifikasi keamanan...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 text-xs text-[#D92D20]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage || 'Verifikasi gagal. Harap refresh halaman.'}</span>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-xs text-[#B54708] mb-1">
            Token verifikasi kedaluwarsa. Silakan centang kembali.
          </div>
        )}

        {/* Turnstile explicit container */}
        <div ref={containerRef} className="my-1" />
      </div>

      {status === 'verified' && (
        <div className="mt-2 text-center text-[11px] font-medium text-[#027A48] flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verifikasi Cloudflare Turnstile berhasil</span>
        </div>
      )}
    </div>
  );
};
