export function formatRupiah(amount: number | undefined | null): string {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

// Convert YYYY-MM-DD to DD/MM/YYYY
export function formatDateID(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// Format ISO string to DD/MM/YYYY HH:mm
export function formatDateTimeID(isoStr: string | undefined | null): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return isoStr;
  }
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Hitung upah pokok berdasarkan status kehadiran:
 * - 'Hadir': 100% upah harian
 * - 'Setengah Hari': Upah harian ÷ 2 (50%)
 * - Status lainnya ('Izin', 'Sakit', 'Libur', 'Tidak Hadir'): Rp0
 */
export function calculateBasicPayByStatus(status: string, dailyWage: number | undefined | null): number {
  const wage = Number(dailyWage) || 0;
  if (status === 'Hadir') return Math.round(wage);
  if (status === 'Setengah Hari') return Math.round(wage / 2);
  return 0;
}

/**
 * Konversi jam desimal menjadi { hours, minutes } secara akurat tanpa pembulatan durasi.
 */
export function splitHoursMinutes(decimalHours: number | undefined | null): { hours: number; minutes: number; totalMinutes: number } {
  const val = Math.max(0, Number(decimalHours) || 0);
  const totalMinutes = Math.round(val * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, totalMinutes };
}

/**
 * Hitung upah lembur proporsional berdasarkan durasi aktual (jam & menit) × tarif lembur per jam.
 * Rumus: Upah lembur = Durasi lembur dalam jam × Tarif lembur per jam
 */
export function calculateOvertimePayFromHoursMinutes(
  hours: number | undefined | null,
  minutes: number | undefined | null,
  hourlyRate: number | undefined | null
): number {
  const h = Math.max(0, Number(hours) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  const rate = Math.max(0, Number(hourlyRate) || 0);
  const totalMinutes = Math.round(h * 60 + m);
  return Math.round((totalMinutes * rate) / 60);
}

/**
 * Hitung upah lembur proporsional dari jam desimal (misal 1.5 jam = 1 jam 30 menit).
 */
export function calculateOvertimePayFromDecimal(
  decimalHours: number | undefined | null,
  hourlyRate: number | undefined | null
): number {
  const { totalMinutes } = splitHoursMinutes(decimalHours);
  const rate = Math.max(0, Number(hourlyRate) || 0);
  return Math.round((totalMinutes * rate) / 60);
}

/**
 * Format durasi lembur dari jam desimal ke teks "X jam Y menit"
 */
export function formatOvertimeDuration(decimalHours: number | undefined | null): string {
  const { hours, minutes, totalMinutes } = splitHoursMinutes(decimalHours);
  if (totalMinutes <= 0) return '0 jam';
  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} mnt`;
  if (hours > 0) return `${hours} jam`;
  return `${minutes} menit`;
}

/**
 * Cek apakah jabatan adalah Driver (Ketentuan: Driver tidak mendapatkan upah lembur / Rp 0).
 */
export function isDriverRole(role: string | undefined | null): boolean {
  return String(role || '').trim().toLowerCase() === 'driver';
}

/**
 * Konversi nominal angka Rupiah ke kalimat Terbilang Bahasa Indonesia.
 */
export function terbilangRupiah(nominal: number | undefined | null): string {
  const val = Math.floor(Math.abs(Number(nominal) || 0));
  if (val === 0) return 'Nol Rupiah';

  const satuan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  function sebut(n: number): string {
    if (n < 12) return satuan[n];
    if (n < 20) return `${sebut(n - 10)} Belas`.trim();
    if (n < 100) return `${sebut(Math.floor(n / 10))} Puluh ${sebut(n % 10)}`.trim();
    if (n < 200) return `Seratus ${sebut(n - 100)}`.trim();
    if (n < 1000) return `${sebut(Math.floor(n / 100))} Ratus ${sebut(n % 100)}`.trim();
    if (n < 2000) return `Seribu ${sebut(n - 1000)}`.trim();
    if (n < 1000000) return `${sebut(Math.floor(n / 1000))} Ribu ${sebut(n % 1000)}`.trim();
    if (n < 1000000000) return `${sebut(Math.floor(n / 1000000))} Juta ${sebut(n % 1000000)}`.trim();
    if (n < 1000000000000) return `${sebut(Math.floor(n / 1000000000))} Miliar ${sebut(n % 1000000000)}`.trim();
    return `${sebut(Math.floor(n / 1000000000000))} Triliun ${sebut(n % 1000000000000)}`.trim();
  }

  return `${sebut(val).replace(/\s+/g, ' ').trim()} Rupiah`;
}


