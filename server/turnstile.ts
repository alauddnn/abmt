import crypto from 'crypto';

// In-memory store for verified turnstile tickets (valid for 10 minutes)
const verifiedTickets = new Map<string, { createdAt: number; ip: string }>();

// Cleanup expired tickets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of verifiedTickets.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      verifiedTickets.delete(ticket);
    }
  }
}, 5 * 60 * 1000);

/**
 * Validates a Turnstile token against Cloudflare's siteverify API.
 * Uses CLOUDFLARE_TURNSTILE_SECRET_KEY if configured, or Cloudflare's official
 * testing secret key (1x0000000000000000000000000000000AA - Always Passes) for dev/staging.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<{ success: boolean; ticket?: string; error?: string }> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token verifikasi Cloudflare Turnstile tidak ditemukan atau belum diselesaikan.',
    };
  }

  const secretKey =
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Cloudflare Turnstile server mengembalikan status HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      success: boolean;
      'error-codes'?: string[];
      challenge_ts?: string;
      hostname?: string;
    };

    if (!data.success) {
      const errorCodes = data['error-codes']?.join(', ') || 'invalid-input-response';
      return {
        success: false,
        error: `Verifikasi Cloudflare Turnstile ditolak oleh Cloudflare (${errorCodes}). Token mungkin kedaluwarsa atau tidak valid.`,
      };
    }

    // Generate a temporary verification ticket valid for 10 minutes
    const ticket = `TKT-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
    verifiedTickets.set(ticket, { createdAt: Date.now(), ip: remoteIp || '' });

    return { success: true, ticket };
  } catch (err: any) {
    console.error('Error contacting Cloudflare siteverify API:', err);
    return {
      success: false,
      error: 'Gagal menghubungi server verifikasi Cloudflare: ' + err.message,
    };
  }
}

/**
 * Consumes a one-time verified ticket.
 * Prevents replay attacks for sensitive login flows.
 */
export function consumeTurnstileTicket(ticket: string): boolean {
  if (!ticket) return false;
  const data = verifiedTickets.get(ticket);
  if (!data) return false;
  if (Date.now() - data.createdAt > 10 * 60 * 1000) {
    verifiedTickets.delete(ticket);
    return false;
  }
  verifiedTickets.delete(ticket);
  return true;
}
