import React, { useState, useEffect, useRef } from 'react';
import {
  Search, CheckCircle2, Clock, XCircle, Printer, AlertCircle, ArrowLeft,
  QrCode, UserCheck, CalendarClock, Syringe, UserX, Users, Archive, RefreshCw
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Registration, EventConfig, CheckInStatus } from '../types.ts';

interface CheckTicketProps {
  event: EventConfig;
  onBackToForm: () => void;
  onRefreshParent?: () => void;
}

interface ArchiveMetaInfo {
  id: string;
  eventTitle: string;
  eventDate: string;
  timeRange?: string;
  month: string;
  year: string;
  locationName: string;
  partnerName: string;
  completionStatement?: string;
  archivedAt: string;
}

const CHECKIN_BADGE: Record<CheckInStatus, { label: string; cls: string }> = {
  belum_hadir: { label: 'BELUM HADIR DI BOOTH', cls: 'bg-stone-100 text-stone-700 border-stone-300' },
  sudah_hadir: { label: 'SUDAH HADIR / REGISTRASI BOOTH', cls: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
  selesai_vaksin: { label: 'SELESAI VAKSINASI', cls: 'bg-sky-100 text-sky-800 border-sky-400' },
  tidak_hadir: { label: 'TIDAK HADIR', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export const CheckTicketModal: React.FC<CheckTicketProps> = ({ event, onBackToForm, onRefreshParent }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Registration | null>(null);
  const [resultArchiveInfo, setResultArchiveInfo] = useState<ArchiveMetaInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [rescheduleSession, setRescheduleSession] = useState<string>(event.sessions[0] || '');
  const [isUpdating, setIsUpdating] = useState(false);

  // Real-time live participant directory
  const [activeDirectory, setActiveDirectory] = useState<Registration[]>([]);
  const [archivedMatches, setArchivedMatches] = useState<Array<{ registration: Registration; archiveInfo: ArchiveMetaInfo }>>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const resultIdRef = useRef<string | null>(null);
  const resultIsArchivedRef = useRef<boolean>(false);

  useEffect(() => {
    resultIdRef.current = result?.id || null;
    resultIsArchivedRef.current = !!resultArchiveInfo;
  }, [result?.id, resultArchiveInfo]);

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

  const fetchLiveDirectory = async (searchText = query, silent = false) => {
    if (!silent) setIsLoadingDirectory(true);
    try {
      const qs = searchText.trim() ? `?q=${encodeURIComponent(searchText.trim())}&_t=${Date.now()}` : `?_t=${Date.now()}`;
      const res = await fetch(`/api/admin/ticket-directory${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        const activeList: Registration[] = data.activeRegistrations || [];
        setActiveDirectory(activeList);
        setArchivedMatches(data.archivedMatches || []);

        // Keep open ticket synced in real time with latest DB state
        if (resultIdRef.current && !resultIsArchivedRef.current) {
          const latestMatch = activeList.find(r => r.id === resultIdRef.current);
          if (latestMatch) {
            setResult(latestMatch);
            setRescheduleSession(latestMatch.selectedSession || event.sessions[0] || '');
          }
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setIsLoadingDirectory(false);
    }
  };

  useEffect(() => {
    fetchLiveDirectory(query, false);

    const handleServerUpdate = () => {
      fetchLiveDirectory(query, true);
    };
    window.addEventListener('remov:server-update', handleServerUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('remov_event_sync');
      bc.onmessage = () => fetchLiveDirectory(query, true);
    }

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLiveDirectory(query, true);
      }
    }, 6000);

    return () => {
      clearInterval(timer);
      window.removeEventListener('remov:server-update', handleServerUpdate);
      bc?.close();
    };
  }, [query]);

  const selectTicket = async (reg: Registration, arcInfo: ArchiveMetaInfo | null = null) => {
    setErrorMessage(null);
    setActionMessage(null);
    setResult(reg);
    setResultArchiveInfo(arcInfo);
    setRescheduleSession(reg.selectedSession || event.sessions[0] || '');
    await generateQrForReg(reg);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setActionMessage(null);
    setResult(null);
    setResultArchiveInfo(null);

    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(query.trim())}?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Pendaftaran / Nomor Antrian / Barcode tidak ditemukan.');
        fetchLiveDirectory(query, true);
        return;
      }

      await selectTicket(data.registration, data.isArchived ? (data.archiveInfo || null) : null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat mencari tiket.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCheckIn = async (status: CheckInStatus) => {
    if (!result || resultArchiveInfo) return;
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
        fetchLiveDirectory(query, true);
        onRefreshParent?.();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui status kehadiran.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReschedule = async () => {
    if (!result || !rescheduleSession || resultArchiveInfo) return;
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
        fetchLiveDirectory(query, true);
        onRefreshParent?.();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menggeser kloter.');
    } finally {
      setIsUpdating(false);
    }
  };

  const checkInInfo = CHECKIN_BADGE[(result?.checkInStatus || 'belum_hadir') as CheckInStatus];

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="bg-white rounded-3xl p-5 sm:p-8 border-2 border-stone-200 shadow-xl space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#fff000] text-[#141414] border-2 border-[#141414] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-lg sm:text-xl text-[#141414] leading-tight">
                Cek Barcode Antrian &amp; Check-In Booth (Panitia)
              </h2>
              <p className="text-xs text-stone-500">
                Data terupdate real-time. Scan/ketik No. Antrian (01, 02...), Barcode, No. Registrasi, Nama, atau No. HP.
              </p>
            </div>
          </div>

          <button
            onClick={onBackToForm}
            className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-[#141414] bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-xl font-bold transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ke Formulir</span>
          </button>
        </div>

        {/* Event Completion Status Banner for Panitia */}
        {event.eventStatus === 'completed' && (
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-extrabold text-sm">
                Event Telah Dinyatakan Selesai ({event.date})
              </strong>
              <p className="mt-0.5 text-emerald-900">
                {event.eventCompletedStatement || 'Tim Admin telah menyatakan event selesai dan seluruh data peserta tersimpan otomatis sesuai jadwal.'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSearch} className="space-y-2">
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
            Cari Kode Barcode / No. Antrian / No. Registrasi / Nama / No. HP
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Contoh: 01, REMOV-Q01-2026, Nama Pawrent/Anabul, atau 0812..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm font-mono font-bold"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-4" />
            </div>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="bg-[#fff000] hover:bg-yellow-300 disabled:bg-stone-200 text-[#141414] border-2 border-[#141414] font-extrabold px-6 py-3.5 rounded-2xl text-sm transition-all shrink-0 cursor-pointer"
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
          <div className="bg-yellow-50/70 rounded-3xl p-5 sm:p-7 border-2 border-[#141414] space-y-5">
            {resultArchiveInfo && (
              <div className="bg-[#141414] text-[#fff000] rounded-2xl px-4 py-3 text-xs flex items-start gap-2.5">
                <Archive className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Data Dari Arsip Event Selesai — {resultArchiveInfo.eventTitle}</strong>
                  <span className="text-stone-300">
                    Jadwal: {resultArchiveInfo.eventDate} {resultArchiveInfo.timeRange ? `(${resultArchiveInfo.timeRange})` : ''} • {resultArchiveInfo.locationName}
                  </span>
                </div>
              </div>
            )}

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

            {/* Panitia Booth Check-In Action Bar (active/just-completed event only) */}
            {!resultArchiveInfo && (
              <div className="bg-white rounded-2xl p-4 border border-stone-200 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#141414] block">
                  Aksi Panitia Booth (Tersinkron Real-Time &amp; ke Spreadsheet):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateCheckIn('sudah_hadir')}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Check-In Hadir di Booth</span>
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateCheckIn('selesai_vaksin')}
                    className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Syringe className="w-4 h-4" />
                    <span>Tandai Selesai Vaksin</span>
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleUpdateCheckIn('tidak_hadir')}
                    className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
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
                    className="px-4 py-2 bg-[#141414] hover:bg-black text-[#fff000] rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Simpan Kloter Baru
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 bg-[#141414] hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak E-Pass Antrian</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Real-Time Participant Directory (Active Event + Archive Search Results) */}
        <div className="border-t border-stone-200 pt-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#141414]" />
              <h3 className="font-heading font-bold text-sm text-[#141414]">
                Daftar Peserta Jadwal Event Ini ({activeDirectory.length})
              </h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live
              </span>
            </div>
            <button
              type="button"
              onClick={() => fetchLiveDirectory(query, false)}
              className="text-xs font-bold text-stone-600 hover:text-[#141414] inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDirectory ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {activeDirectory.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center text-xs text-stone-500">
              {query.trim()
                ? 'Tidak ada peserta aktif yang cocok dengan pencarian di jadwal event ini.'
                : 'Belum ada peserta terdaftar pada jadwal event aktif saat ini.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {activeDirectory.map((reg) => {
                const isSelected = result?.id === reg.id && !resultArchiveInfo;
                const badge = CHECKIN_BADGE[(reg.checkInStatus || 'belum_hadir') as CheckInStatus];
                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => selectTicket(reg, null)}
                    className={`text-left p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#141414] bg-[#fff000]/30 shadow-xs'
                        : 'border-stone-200 bg-stone-50/70 hover:bg-yellow-50 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-heading font-black text-base bg-[#fff000] text-[#141414] border border-[#141414] px-2.5 py-1 rounded-xl shrink-0">
                        {reg.queueNumber || '--'}
                      </span>
                      <div className="min-w-0">
                        <strong className="text-xs font-bold text-[#141414] block truncate">
                          {reg.ownerName} • {reg.petName}
                        </strong>
                        <span className="text-[11px] text-stone-600 block truncate">
                          {reg.vaccineName}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 block truncate">
                          {reg.regNumber} • {reg.ownerPhone}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                      {reg.paymentStatus === 'verified' ? (reg.checkInStatus === 'sudah_hadir' ? 'Hadir' : reg.checkInStatus === 'selesai_vaksin' ? 'Selesai' : 'Booking') : 'Terdaftar'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {archivedMatches.length > 0 && (
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />
                <span>Ditemukan di Arsip Event Selesai ({archivedMatches.length})</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {archivedMatches.map(({ registration: reg, archiveInfo }) => (
                  <button
                    key={`${archiveInfo.id}_${reg.id}`}
                    type="button"
                    onClick={() => selectTicket(reg, archiveInfo)}
                    className="text-left p-3 rounded-2xl border border-stone-300 bg-stone-100/80 hover:bg-stone-200/70 transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <strong className="text-xs font-bold text-[#141414] block truncate">
                        #{reg.queueNumber || '--'} {reg.ownerName} ({reg.petName})
                      </strong>
                      <span className="text-[11px] text-stone-600 block truncate">
                        {archiveInfo.eventTitle} • {archiveInfo.eventDate}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold bg-[#141414] text-[#fff000] px-2 py-0.5 rounded-full shrink-0">
                      Arsip
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
