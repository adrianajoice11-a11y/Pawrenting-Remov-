import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, ArrowRight, X, ShieldAlert } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetTabName?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetTabName = 'Dashboard Admin'
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem('remov_admin_auth', 'true');
        onSuccess();
        onClose();
        setPin('');
      } else {
        setErrorMessage(data.message || 'PIN Admin salah. Silakan coba kembali.');
      }
    } catch {
      setErrorMessage('Gagal terhubung ke server untuk verifikasi PIN. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-[#141414] space-y-5">
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#fff000] text-[#141414] border-2 border-[#141414] flex items-center justify-center font-bold shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-[#141414]">
                Akses Khusus Admin Panitia
              </h2>
              <p className="text-xs text-stone-500">
                Otentikasi diperlukan untuk membuka {targetTabName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-yellow-50 rounded-2xl p-4 border border-[#fff000] flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#141414] shrink-0 mt-0.5" />
          <p className="text-xs text-[#141414] leading-relaxed">
            Halaman <strong>Cek Tiket / Check-In</strong> dan <strong>Dashboard Admin</strong> hanya dapat diakses oleh tim panitia & dokter hewan REMOV untuk menjaga privasi data peserta serta pengelolaan voucher.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-center gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Masukkan PIN / Password Admin
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                required
                autoFocus
                autoComplete="current-password"
                placeholder="Masukkan PIN / Kata Sandi Panitia..."
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-10 pr-11 py-3 rounded-2xl border border-stone-300 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/50 outline-hidden text-sm font-mono tracking-wider"
              />
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-700 p-0.5"
                title={showPin ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-400 mt-1.5">
              Kata sandi hanya diketahui panitia resmi dan dapat diubah melalui Dashboard Admin.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold transition-colors"
            >
              Kembali ke Formulir
            </button>
            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 disabled:bg-stone-200 text-[#141414] border-2 border-[#141414] font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs"
            >
              {isLoading ? 'Memverifikasi...' : 'Masuk Sebagai Admin'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
