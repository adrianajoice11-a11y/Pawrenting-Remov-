import React, { useState } from 'react';
import {
  Search, CheckCircle2, Clock, XCircle, Printer, AlertCircle, ArrowLeft,
  QrCode, UserCheck, CalendarClock, Syringe, UserX
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Registration, EventConfig, CheckInStatus } from '../types.ts';

interface CheckTicketProps {
  event: EventConfig;
  onBackToForm: () => void;
}

const CHECKIN_BADGE: Record<CheckInStatus, { label: string; cls: string }> = {
  belum_hadir: { label: 'BELUM HADIR DI BOOTH', cls: 'bg-stone-100 text-stone-700 border-stone-300' },
  sudah_hadir: { label: 'SUDAH HADIR / REGISTRASI BOOTH', cls: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
  selesai_vaksin: { label: 'SELESAI VAKSINASI', cls: 'bg-sky-100 text-sky-800 border-sky-400' },
  tidak_hadir: { label: 'TIDAK HADIR', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export const CheckTicketModal: React.FC<CheckTicketProps> = ({ event, onBackToForm }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Registration | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [rescheduleSession, setRescheduleSession] = useState<string>(event.sessions[0] || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const generateQrForReg = async (reg: Registration) => {
    const qrPayload = JSON.stringify({
      barcode: reg.barcodeCode,
      queue: reg.queueNumber,
      reg: reg.regNumber,
      pet: reg.petName,
      owner: reg.ownerName,
      vac: reg.vaccineName,
      session: reg.selectedSession,
    });
    const url = await QRCode.toDataURL(qrPayload, { width: 200, margin: 2, color: { dark: '#141414', light: '#ffffff' } });
    setQrCodeUrl(url);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setActionMessage(null);
    setResult(null);

    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Pendaftaran / Nomor Antrian / Barcode tidak ditemukan.');
        return;
      }

      setResult(data.registration);
      setRescheduleSession(data.registration.selectedSession || event.sessions[0] || '');
      await generateQrForReg(data.registration);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat mencari tiket.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCheckIn = async (status: CheckInStatus) => {
    if (!result) return;
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/registrations/${result.id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInStatus: status }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.registration);
        setActionMessage(data.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui status kehadiran.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReschedule = async () => {
    if (!result || !rescheduleSession) return;
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/registrations/${result.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSession: rescheduleSession }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.registration);
        setActionMessage(data.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menggeser kloter.');
    } finally {
      setIsUpdating(false);
    }
  };

  const checkInInfo = CHECKIN_BADGE[(result?.checkInStatus || 'belum_hadir') as CheckInStatus];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-stone-200 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#fff000] text-[#141414] border-2 border-[#141414] flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl text-[#141414]">
                Cek Barcode Antrian & Check-In Booth (Panitia)
              </h2>
              <p className="text-xs text-stone-500">
                Scan atau ketik Barcode Antrian, Nomor Antrian (01, 02...), Nomor Registrasi, atau No. HP peserta.
              </p>
            </div>
          </div>

          <button
            onClick={onBackToForm}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#141414] bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-xl font-bold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ke Formulir</span>
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-2">
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
            Cari Kode Barcode / No. Antrian / No. Registrasi / No. HP
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Contoh: 01, REMOV-Q01-2026, REMOV-2026-RAB-0001, atau 0812..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm font-mono font-bold"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-4" />
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="bg-[#fff000] hover:bg-yellow-300 disabled:bg-stone-200 text-[#141414] border-2 border-[#141414] font-extrabold px-6 py-3.5 rounded-2xl text-sm transition-all shrink-0"
            >
              {isLoading ? 'Mencari...' : 'Cek Antrian'}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {actionMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {result && (
          <div className="bg-yellow-50/70 rounded-3xl p-6 sm:p-7 border-2 border-[#141414] space-y-5">
            {/* Queue & Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
              <div className="flex items-center gap-4">
                <div className="bg-[#fff000] border-2 border-[#141414] rounded-2xl px-5 py-3 text-center shadow-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#141414] block">
                    NO. ANTRIAN
                  </span>
                  <span className="font-heading font-black text-4xl text-[#141414] leading-none">
                    {result.queueNumber || '--'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {result.paymentStatus === 'verified' ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {event.bookingSuccessLabel || 'SUKSES BOOKING'}
                      </span>
                    ) : result.paymentStatus === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-xs font-extrabold border border-rose-300">
                        <XCircle className="w-3.5 h-3.5" />
                        DITOLAK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-xs font-extrabold border border-amber-300">
                        <Clock className="w-3.5 h-3.5" />
                        MENUNGGU PEMBAYARAN
                      </span>
                    )}

                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${checkInInfo.cls}`}>
                      {checkInInfo.label}
                    </span>
                  </div>
                  <div className="text-xs text-stone-600 font-mono">
                    Reg: <strong className="text-[#141414]">{result.regNumber}</strong> • Barcode: <strong className="text-[#141414]">{result.barcodeCode || '-'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Info & QR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm flex-1 w-full">
                <div>
                  <span className="text-stone-500 block">Nama Pawrent:</span>
                  <strong className="text-[#141414]">{result.ownerName} ({result.ownerPhone})</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">Nama Anabul:</span>
                  <strong className="text-[#141414]">{result.petName} ({result.petType === 'kucing' ? 'Kucing' : 'Anjing'})</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">Jenis Vaksin:</span>
                  <strong className="text-[#141414] bg-[#fff000] px-2 py-0.5 rounded-md inline-block mt-0.5">{result.vaccineName}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">Kloter Pemeriksaan:</span>
                  <strong className="text-[#141414]">{result.selectedSession}</strong>
                  {result.rescheduledFromSession && (
                    <span className="block text-[10px] text-amber-800">
                      (Digeser dari: {result.rescheduledFromSession})
                    </span>
                  )}
                </div>
                {result.vaccineNotes && (
                  <div className="col-span-2 bg-white/90 p-2.5 rounded-xl border border-stone-200">
                    <span className="text-stone-500 block text-[11px]">Keterangan / Kebutuhan Tambahan:</span>
                    <strong className="text-[#141414] text-xs whitespace-pre-wrap">{result.vaccineNotes}</strong>
                  </div>
                )}
              </div>

              {qrCodeUrl && (
                <div className="bg-white p-3 rounded-2xl border-2 border-[#141414] text-center shrink-0">
                  <img src={qrCodeUrl} alt="QR Antrian" className="w-28 h-28 mx-auto" />
                  <span className="text-[10px] text-[#141414] font-mono font-bold block mt-1">
                    {result.barcodeCode || result.regNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Panitia Booth Check-In Action Bar */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#141414] block">
                Aksi Panitia Booth (Tersinkron ke Spreadsheet):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleUpdateCheckIn('sudah_hadir')}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Check-In Hadir di Booth</span>
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleUpdateCheckIn('selesai_vaksin')}
                  className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors"
                >
                  <Syringe className="w-4 h-4" />
                  <span>Tandai Selesai Vaksin</span>
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleUpdateCheckIn('tidak_hadir')}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors"
                >
                  <UserX className="w-4 h-4" />
                  <span>Tandai Tidak Hadir</span>
                </button>
              </div>

              {/* Reschedule Kloter */}
              <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 shrink-0">
                  <CalendarClock className="w-4 h-4" />
                  <span>Geser ke Kloter Lain:</span>
                </div>
                <select
                  value={rescheduleSession}
                  onChange={(e) => setRescheduleSession(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium bg-white"
                >
                  {event.sessions.map((s, i) => (
                    <option key={i} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleReschedule}
                  className="px-4 py-2 bg-[#141414] hover:bg-black text-[#fff000] rounded-xl text-xs font-bold shrink-0"
                >
                  Simpan Kloter Baru
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 bg-[#141414] hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak E-Pass Antrian</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
