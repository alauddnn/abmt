import React, { useState, useRef } from 'react';
import { Camera, Trash2, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const { user, isAdmin, updateProfile } = useAuth();
  const [name, setName] = useState<string>(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state whenever modal opens or user changes
  React.useEffect(() => {
    if (isOpen) {
      setName(user?.name || '');
      setAvatarPreview(user?.avatarUrl || null);
      setErrorMsg(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Harap pilih file gambar (JPG, PNG, atau WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Ukuran file foto maksimal 2 MB.');
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarPreview(compressed);
        } else {
          setAvatarPreview(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama pengguna tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await updateProfile({
      name: name.trim(),
      avatarUrl: avatarPreview !== null ? avatarPreview : undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      if (showToast) {
        showToast('success', 'Profil dan foto profil berhasil diperbarui.');
      }
      onClose();
    } else {
      setErrorMsg(res.error || 'Gagal menyimpan perubahan.');
    }
  };

  const getInitials = (n: string) => {
    if (!n) return isAdmin ? 'AD' : 'OW';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/45 animate-in fade-in duration-200">
      <div
        className="w-[calc(100%-24px)] sm:w-full max-w-[420px] max-h-[90dvh] sm:max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 id="profile-modal-title" className="text-base font-semibold text-slate-900">
              Profil Pengguna
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbarui foto profil dan informasi akun Anda
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Photo Uploader */}
            <div className="flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="relative group">
                <div
                  className={`w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center text-xl font-bold shadow-xs transition-all ${
                    isAdmin
                      ? 'bg-blue-50 text-[#4693FD] border-blue-200 ring-4 ring-blue-500/10'
                      : 'bg-amber-50 text-amber-700 border-amber-200 ring-4 ring-amber-500/10'
                  }`}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt={name || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(name)}</span>
                  )}
                </div>

                {/* Camera overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-[#4693FD] hover:bg-[#357ee8] text-white rounded-full shadow-md transition-transform duration-150 hover:scale-105 cursor-pointer"
                  title="Pilih Foto Baru"
                  aria-label="Pilih Foto Baru"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  Pilih Foto Baru
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Foto
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Tersimpan permanen di database · Maksimal 2 MB
              </p>
            </div>

            {/* Account Details */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nama Tampilan
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2563EB] transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Username Akun
                </label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Peran Akses
                </label>
                <div className="px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {isAdmin ? 'ADMINISTRATOR' : 'OWNER (BACA)'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isAdmin ? 'Akses Penuh Pengelolaan' : 'Hanya Lihat Data & Laporan'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
