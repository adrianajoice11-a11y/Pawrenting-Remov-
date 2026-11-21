import React, { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, AlertCircle, Clock, ShieldCheck,
  Upload, Copy, ArrowRight, ArrowLeft, RefreshCw, PawPrint,
  Lock, Check, Share2, Printer, AlertTriangle, Phone, Mail,
  User, MapPin, Tag, ExternalLink, Link as LinkIcon, Image as ImageIcon,
  QrCode, CalendarClock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import type { EventConfig, VaccineOption, Registration, PetType, PetGender } from '../types.ts';

interface RegistrationFormProps {
  event: EventConfig;
  vaccines: VaccineOption[];
  onRefreshData: () => void;
  onViewTicket: (regNumber: string) => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  event,
  vaccines,
  onRefreshData,
}) => {
  // Current Step: 1 (Owner), 2 (Pet & Dynamic Checklist), 3 (Vaccine), 4 (Hold & Payment), 5 (Queue Ticket / 2h Warning)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Resume unpaid booking state (within 2h window)
  const [showResumeBox, setShowResumeBox] = useState<boolean>(false);
  const [resumeQuery, setResumeQuery] = useState<string>('');
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isSearchingResume, setIsSearchingResume] = useState<boolean>(false);

  // Form State
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerCity, setOwnerCity] = useState('');
  const [ownerInstagram, setOwnerInstagram] = useState('');
  const [referralSource, setReferralSource] = useState('Instagram @remov.official');

  // Pet State
  const [petType, setPetType] = useState<PetType>('kucing');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petGender, setPetGender] = useState<PetGender>('jantan');
  const [isSterilized, setIsSterilized] = useState<boolean>(false);
  const [petAge, setPetAge] = useState('');
  const [petWeightKg, setPetWeightKg] = useState<string>('3.5');
  const [petColor, setPetColor] = useState('');
  const [previousVaccineHistory, setPreviousVaccineHistory] = useState('Belum pernah vaksin');

  // Dynamic Health Checklist Answers keyed by item.id
  const checklistItems = Array.isArray(event.healthChecklistItems)
    ? event.healthChecklistItems
    : (event.termsAndConditions || []).map((text, idx) => ({ id: `chk-${idx + 1}`, text, required: true }));

  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});

  // Vaccine & Session State
  const NO_VACCINE_ID = 'no-vaccine';
  const [selectedVaccineId, setSelectedVaccineId] = useState<string>('');
  const [vaccineNotes, setVaccineNotes] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>(event.sessions[0] || 'Pukul 09.00 - 12.00 WIB (Kloter 1)');

  // Lock Quota (Hold) State
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLockingQuota, setIsLockingQuota] = useState<boolean>(false);
  const [lockError, setLockError] = useState<string | null>(null);

  // Payment State
  const activeBankAccounts = event.bankAccounts?.filter(b => b.active !== false) || [];
  const [paymentMethod, setPaymentMethod] = useState<string>(activeBankAccounts[0]?.bankName || 'BCA (Bank Central Asia)');
  const [selectedBankTarget, setSelectedBankTarget] = useState<string>(
    activeBankAccounts[0] ? `${activeBankAccounts[0].bankName} (${activeBankAccounts[0].accountNumber})` : ''
  );

  // Proof of payment
  const [proofType, setProofType] = useState<'upload' | 'link'>('upload');
  const [paymentProofData, setPaymentProofData] = useState<string>('');
  const [paymentProofName, setPaymentProofName] = useState<string>('');
  const [paymentProofLink, setPaymentProofLink] = useState<string>('');

  const [hasJoinedWhatsApp, setHasJoinedWhatsApp] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Completed Registration & 2-Hour Payment Countdown
  const [confirmedRegistration, setConfirmedRegistration] = useState<Registration | null>(null);
  const [ticketQrUrl, setTicketQrUrl] = useState<string>('');
  const [copiedBank, setCopiedBank] = useState<string | null>(null);
  const [paymentDeadlineRemaining, setPaymentDeadlineRemaining] = useState<number>(0);
  const [lateProofType, setLateProofType] = useState<'upload' | 'link'>('upload');
  const [lateProofData, setLateProofData] = useState<string>('');
  const [lateProofName, setLateProofName] = useState<string>('');
  const [lateProofLink, setLateProofLink] = useState<string>('');
  const [isSubmittingLateProof, setIsSubmittingLateProof] = useState<boolean>(false);
  const [lateProofError, setLateProofError] = useState<string | null>(null);

  // Returning customer saved registration references on this device (read-only server lookup)
  interface SavedRegistrationRef {
    id: string;
    regNumber: string;
    queueNumber?: string;
    petName: string;
    ownerName: string;
    vaccineName: string;
    createdAt: string;
  }
  const SAVED_REGS_KEY = 'remov_my_registrations_v1';
  const [savedRegRefs, setSavedRegRefs] = useState<SavedRegistrationRef[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SAVED_REGS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [loadingSavedRegId, setLoadingSavedRegId] = useState<string | null>(null);
  const [savedRegError, setSavedRegError] = useState<string | null>(null);

  const persistRegistrationRef = (reg: Registration) => {
    const nextRef: SavedRegistrationRef = {
      id: reg.id,
      regNumber: reg.regNumber,
      queueNumber: reg.queueNumber,
      petName: reg.petName,
      ownerName: reg.ownerName,
      vaccineName: reg.vaccineName,
      createdAt: reg.createdAt,
    };
    setSavedRegRefs((prev) => {
      const filtered = prev.filter((item) => item.id !== reg.id);
      const updated = [nextRef, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(SAVED_REGS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors
      }
      return updated;
    });
  };

  const removeSavedRegistrationRef = (id: string) => {
    setSavedRegRefs((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(SAVED_REGS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  };

  const handleOpenSavedRegistration = async (refItem: SavedRegistrationRef) => {
    setLoadingSavedRegId(refItem.id);
    setSavedRegError(null);
    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(refItem.id)}?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.registration) {
        removeSavedRegistrationRef(refItem.id);
        setSavedRegError(`Data pendaftaran ${refItem.regNumber} sudah tidak berada di event aktif saat ini (kemungkinan sudah diarsipkan oleh panitia).`);
        return;
      }
      persistRegistrationRef(data.registration);
      setConfirmedRegistration(data.registration);
      setCurrentStep(5);
    } catch {
      setSavedRegError('Gagal memuat data pendaftaran tersimpan. Silakan coba lagi.');
    } finally {
      setLoadingSavedRegId(null);
    }
  };

  const availableVaccines = vaccines.filter(v => v.active !== false);

  useEffect(() => {
    if (availableVaccines.length > 0 && !selectedVaccineId) {
      const available = availableVaccines.find(v => {
        const matchesCategory = v.category === 'semua' || v.category === petType;
        return matchesCategory && !v.isSoldOut;
      });
      if (available) {
        setSelectedVaccineId(available.id);
      }
    }
  }, [availableVaccines, petType, selectedVaccineId]);

  useEffect(() => {
    if (activeBankAccounts.length > 0) {
      const stillValid = activeBankAccounts.some(b => selectedBankTarget.includes(b.accountNumber));
      if (!selectedBankTarget || !stillValid) {
        setSelectedBankTarget(`${activeBankAccounts[0].bankName} (${activeBankAccounts[0].accountNumber})`);
        setPaymentMethod(activeBankAccounts[0].bankName);
      }
    } else if (selectedBankTarget) {
      setSelectedBankTarget('');
    }
  }, [activeBankAccounts, selectedBankTarget]);

  // Keep session valid if admin updated event.sessions
  useEffect(() => {
    if (event.sessions.length > 0 && !event.sessions.includes(selectedSession)) {
      setSelectedSession(event.sessions[0]);
    }
  }, [event.sessions, selectedSession]);

  // 10-minute checkout hold countdown
  useEffect(() => {
    if (!holdExpiresAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((holdExpiresAt - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        clearInterval(interval);
        setLockError(`Waktu penguncian kuota (${event.holdDurationMinutes || 10} menit) telah habis. Silakan pilih kembali vaksin untuk mengunci kuota baru.`);
        setHoldId(null);
        setHoldExpiresAt(null);
        setCurrentStep(3);
        onRefreshData();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt, event.holdDurationMinutes, onRefreshData]);

  // 2-hour payment deadline countdown for pending_payment bookings
  useEffect(() => {
    if (!confirmedRegistration || confirmedRegistration.paymentStatus !== 'pending_payment' || !confirmedRegistration.paymentDeadlineAt) {
      return;
    }

    const updateTick = () => {
      const deadlineMs = new Date(confirmedRegistration.paymentDeadlineAt!).getTime();
      const diff = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setPaymentDeadlineRemaining(diff);
      if (diff <= 0) {
        setConfirmedRegistration(prev => prev ? { ...prev, paymentStatus: 'expired' } : null);
        onRefreshData();
      }
    };

    updateTick();
    const timer = setInterval(updateTick, 1000);
    return () => clearInterval(timer);
  }, [confirmedRegistration?.id, confirmedRegistration?.paymentStatus, confirmedRegistration?.paymentDeadlineAt, onRefreshData]);

  // Generate Queue Barcode QR Code when verified
  useEffect(() => {
    if (confirmedRegistration && confirmedRegistration.paymentStatus === 'verified') {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fff000', '#141414', '#10b981', '#facc15']
      });

      const qrContent = JSON.stringify({
        barcode: confirmedRegistration.barcodeCode,
        queue: confirmedRegistration.queueNumber,
        reg: confirmedRegistration.regNumber,
        pet: confirmedRegistration.petName,
        owner: confirmedRegistration.ownerName,
        vac: confirmedRegistration.vaccineName,
        session: confirmedRegistration.selectedSession,
        date: event.date
      });

      QRCode.toDataURL(qrContent, { width: 240, margin: 2, color: { dark: '#141414', light: '#ffffff' } })
        .then(url => setTicketQrUrl(url))
        .catch(err => console.error('QR code error:', err));
    }
  }, [confirmedRegistration?.id, confirmedRegistration?.paymentStatus, confirmedRegistration?.queueNumber, event.date]);

  const isNoVaccineSelected = selectedVaccineId === NO_VACCINE_ID;
  const selectedVaccine = availableVaccines.find(v => v.id === selectedVaccineId);
  const grandTotal = isNoVaccineSelected ? 0 : (selectedVaccine?.price || 0);

  const validateStep1 = () => {
    if (!ownerName.trim()) {
      setSubmitError('Mohon masukkan nama lengkap pemilik (Pawrent).');
      return false;
    }
    if (!ownerPhone.trim() || ownerPhone.length < 9) {
      setSubmitError('Mohon masukkan nomor WhatsApp aktif yang valid.');
      return false;
    }
    if (ownerEmail.trim() && !ownerEmail.includes('@')) {
      setSubmitError('Mohon masukkan format alamat email yang valid atau kosongkan jika tidak ada.');
      return false;
    }
    if (!ownerCity.trim()) {
      setSubmitError('Mohon masukkan kota domisili Anda.');
      return false;
    }
    setSubmitError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!petName.trim()) {
      setSubmitError('Mohon masukkan nama anabul Anda.');
      return false;
    }
    if (!petAge.trim()) {
      setSubmitError('Mohon sebutkan perkiraan usia anabul (misal: 6 bulan, 1 tahun).');
      return false;
    }
    const missingRequired = checklistItems.filter(item => item.required && !checklistChecked[item.id]);
    if (missingRequired.length > 0) {
      setSubmitError(`Mohon centang seluruh syarat & ketentuan kesehatan anabul (${missingRequired.length} syarat wajib belum dicentang).`);
      return false;
    }
    setSubmitError(null);
    return true;
  };

  const handleProceedToLockAndPayment = async () => {
    if (isNoVaccineSelected) {
      if (!vaccineNotes.trim()) {
        setLockError('Mohon tuliskan keterangan tujuan atau kebutuhan Anda di kolom keterangan karena Anda tidak memilih vaksin.');
        return;
      }
      setLockError(null);
      setHoldId(null);
      setHoldExpiresAt(null);
      setCurrentStep(4);
      return;
    }

    if (!selectedVaccine) {
      setLockError('Silakan pilih salah satu jenis vaksin atau opsi "Tidak Memilih Vaksin (Keperluan Lainnya)".');
      return;
    }
    if (selectedVaccine.isSoldOut) {
      setLockError(`Maaf, kuota untuk ${selectedVaccine.name} sudah habis.`);
      return;
    }

    setIsLockingQuota(true);
    setLockError(null);

    try {
      const res = await fetch('/api/quota/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaccineId: selectedVaccine.id,
          petName,
          ownerName
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLockError(data.message || 'Gagal mengunci kuota vaksin.');
        onRefreshData();
        return;
      }

      setHoldId(data.holdId);
      setHoldExpiresAt(data.expiresAt);
      setRemainingSeconds(data.durationMinutes * 60);
      setCurrentStep(4);
      onRefreshData();
    } catch (err: any) {
      setLockError(err.message || 'Koneksi bermasalah saat mengunci kuota.');
    } finally {
      setIsLockingQuota(false);
    }
  };

  const handleReleaseHoldAndBack = async () => {
    if (holdId) {
      try {
        await fetch('/api/quota/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holdId })
        });
      } catch (e) {
        console.error('Failed to release hold:', e);
      }
    }
    setHoldId(null);
    setHoldExpiresAt(null);
    setCurrentStep(3);
    onRefreshData();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isLate = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file maksimal 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isLate) {
        setLateProofName(file.name);
        setLateProofData(reader.result as string);
      } else {
        setPaymentProofName(file.name);
        setPaymentProofData(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRegistration = async (allowDeferred = false) => {
    const finalProofUrl = allowDeferred
      ? ''
      : (proofType === 'upload' ? paymentProofData : paymentProofLink.trim());

    if (!allowDeferred && !finalProofUrl && grandTotal > 0) {
      setSubmitError('Silakan unggah foto / tempel link bukti payment booking terlebih dahulu, atau klik tombol "Simpan Dulu & Bayar Dalam 2 Jam".');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        holdId,
        ownerName,
        ownerPhone,
        ownerEmail,
        ownerCity,
        ownerInstagram,
        referralSource,
        petType,
        petName,
        petBreed: petBreed || 'Domestik / Campuran',
        petGender,
        isSterilized,
        petAge,
        petWeightKg: Number(petWeightKg) || 0,
        petColor,
        previousVaccineHistory,
        healthChecklistAnswers: checklistItems.map(item => ({
          id: item.id,
          text: item.text,
          checked: !!checklistChecked[item.id]
        })),
        vaccineId: selectedVaccineId,
        vaccineNotes: vaccineNotes.trim(),
        selectedSession,
        totalAmount: grandTotal,
        paymentMethod: grandTotal === 0 ? 'Tanpa Biaya' : paymentMethod,
        paymentBankTarget: grandTotal === 0 ? '' : selectedBankTarget,
        paymentProofUrl: grandTotal === 0 ? '' : finalProofUrl,
        joinedWhatsAppGroup: hasJoinedWhatsApp,
      };

      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.message || 'Gagal mengirim pendaftaran.');
        return;
      }

      setConfirmedRegistration(data.registration);
      persistRegistrationRef(data.registration);
      setHoldId(null);
      setHoldExpiresAt(null);
      setCurrentStep(5);
      onRefreshData();
    } catch (err: any) {
      setSubmitError(err.message || 'Terjadi kesalahan sistem saat menyimpan pendaftaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitLateProof = async () => {
    if (!confirmedRegistration) return;
    const proofUrl = lateProofType === 'upload' ? lateProofData : lateProofLink.trim();
    if (!proofUrl) {
      setLateProofError('Mohon unggah foto bukti pembayaran atau masukkan link Google Drive terlebih dahulu.');
      return;
    }

    setIsSubmittingLateProof(true);
    setLateProofError(null);
    try {
      const res = await fetch(`/api/registrations/${confirmedRegistration.id}/submit-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentProofUrl: proofUrl,
          paymentMethod,
          paymentBankTarget: selectedBankTarget,
          joinedWhatsAppGroup: hasJoinedWhatsApp,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLateProofError(data.message || 'Gagal memverifikasi bukti bayar.');
        if (data.expired) {
          setConfirmedRegistration(prev => prev ? { ...prev, paymentStatus: 'expired' } : null);
        }
        onRefreshData();
        return;
      }
      setConfirmedRegistration(data.registration);
      persistRegistrationRef(data.registration);
      onRefreshData();
    } catch (err: any) {
      setLateProofError(err.message || 'Gagal mengirim bukti pembayaran.');
    } finally {
      setIsSubmittingLateProof(false);
    }
  };

  const handleResumeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeQuery.trim()) return;
    setIsSearchingResume(true);
    setResumeError(null);
    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(resumeQuery.trim())}?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setResumeError(data.message || 'Data pendaftaran tidak ditemukan.');
        return;
      }
      setConfirmedRegistration(data.registration);
      persistRegistrationRef(data.registration);
      setCurrentStep(5);
      setShowResumeBox(false);
    } catch (err: any) {
      setResumeError(err.message || 'Gagal mencari pendaftaran.');
    } finally {
      setIsSearchingResume(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBank(key);
    setTimeout(() => setCopiedBank(null), 2500);
  };

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetForNewPet = () => {
    setPetName('');
    setPetBreed('');
    setPetAge('');
    setChecklistChecked({});
    setVaccineNotes('');
    setPaymentProofData('');
    setPaymentProofName('');
    setPaymentProofLink('');
    setLateProofData('');
    setLateProofName('');
    setLateProofLink('');
    setConfirmedRegistration(null);
    setTicketQrUrl('');
    setCurrentStep(2);
  };

  const bgImageUrl = event.backgroundImageUrl !== undefined
    ? event.backgroundImageUrl
    : '/backgrounds/pawrenting-kuning-remov.svg';
  const overlayOpacity = event.backgroundOverlayOpacity ?? 78;

  // Root div of RegistrationForm matches Focus Mode selector:
  // div#root:nth-of-type(1) > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(1)
  return (
    <div
      className="relative min-h-full w-full bg-cover bg-center bg-fixed transition-all duration-500"
      style={bgImageUrl ? { backgroundImage: `url("${bgImageUrl}")` } : undefined}
    >
      {/* Dynamic Contrast Scrim Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ backgroundColor: `rgba(254, 253, 245, ${overlayOpacity / 100})` }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-10">
        {/* Event Hero Card in Signature REMOV Yellow (#fff000) & Charcoal (#141414) */}
        <div className="bg-linear-to-br from-[#fff000] via-[#fde047] to-[#facc15] rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-[#141414] border-2 border-[#141414] shadow-xl mb-6 sm:mb-8 relative overflow-hidden">
          <div className="absolute right-4 -bottom-6 text-[#141414]/10 select-none pointer-events-none transform rotate-12">
            <PawPrint className="w-64 h-64" />
          </div>

          <div className="relative z-10 max-w-3xl">
            {/* Logo Lockup (REMOV Image + Optional Partner Collaboration Image) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 bg-white/90 px-3 py-2 rounded-2xl border-2 border-[#141414] shadow-xs">
                <img
                  src={event.removLogoUrl || '/logos/remov-logo.svg'}
                  alt="REMOV Official"
                  className="w-[82px] h-[78px] object-contain"
                />
                {event.partnerLogoUrl && (
                  <>
                    <span className="text-[#141414] font-black text-sm px-1">×</span>
                    <img
                      src={event.partnerLogoUrl}
                      alt={event.partnerName || 'Partner Kolaborasi'}
                      className="h-9 sm:h-11 w-auto max-w-[130px] object-contain"
                    />
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {event.heroBadgeText !== '' && (
                  <div className="inline-flex items-center gap-1.5 bg-[#141414] text-[#fff000] text-xs font-extrabold px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{event.heroBadgeText || 'Pendaftaran Resmi Pawrenting REMOV'}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 bg-white/85 border border-[#141414]/30 text-[#141414] text-xs font-bold px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                  <span>Kuota Real-Time</span>
                </div>
              </div>
            </div>

            <h1 className="font-heading font-black text-2xl sm:text-4xl tracking-tight leading-tight mb-2 text-[#141414] w-[745px] max-w-full">
              {event.title}
              {event.partnerName && (
                <span className="block sm:inline sm:ml-2 text-lg sm:text-2xl font-bold text-stone-800 w-auto h-auto">
                  × {event.partnerName}
                </span>
              )}
            </h1>
            {event.tagline && (
              <p className="text-stone-800 text-sm sm:text-base mb-5 font-medium leading-relaxed">
                {event.tagline}
              </p>
            )}

            {/* Event Info Grid (Tanggal & Lokasi dapat di-setting sesuai kebutuhan event) */}
            {(event.showDateCard !== false || event.showLocationCard !== false) && (
              <div
                className={`grid grid-cols-1 ${
                  event.showDateCard !== false && event.showLocationCard !== false ? 'sm:grid-cols-2' : ''
                } gap-3 text-xs sm:text-sm mb-5`}
              >
                {event.showDateCard !== false && (
                  <div className="flex items-start gap-2.5 bg-white/85 backdrop-blur-xs p-3.5 rounded-2xl border border-[#141414]/20">
                    <Clock className="w-4 h-4 text-[#141414] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      {event.dateCardLabel && (
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-stone-500 mb-0.5">
                          {event.dateCardLabel}
                        </span>
                      )}
                      <span className="font-bold block text-[#141414] leading-snug">{event.date}</span>
                      {event.timeRange && (
                        <span className="text-stone-700 text-xs block mt-0.5">{event.timeRange}</span>
                      )}
                      {event.dateNote && (
                        <span className="text-stone-600 text-[11px] block mt-1 font-medium">{event.dateNote}</span>
                      )}
                    </div>
                  </div>
                )}

                {event.showLocationCard !== false && (
                  <div className="flex items-start gap-2.5 bg-white/85 backdrop-blur-xs p-3.5 rounded-2xl border border-[#141414]/20">
                    <MapPin className="w-4 h-4 text-[#141414] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      {event.locationCardLabel && (
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-stone-500 mb-0.5">
                          {event.locationCardLabel}
                        </span>
                      )}
                      <span className="font-bold block text-[#141414] leading-snug">{event.locationName}</span>
                      {event.locationAddress && (
                        <span className="text-stone-700 text-xs block mt-0.5 leading-snug">{event.locationAddress}</span>
                      )}
                      {event.locationMapsUrl && (
                        <a
                          href={event.locationMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-extrabold text-[#141414] underline hover:text-stone-700"
                        >
                          <span>Buka Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Real-time Quota Badges Bar */}
            <div className="bg-[#141414] text-white rounded-2xl p-3.5 sm:p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#fff000]">
                  Status Kuota Vaksin Hari Ini:
                </span>
                <span className="text-[11px] text-stone-300 font-medium">
                  Update otomatis real-time
                </span>
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2">
                {availableVaccines.map((v) => {
                  const total = v.totalQuota || 0;
                  const sisa = v.availableQuota ?? total;
                  const held = v.heldCount ?? 0;
                  const habis = sisa <= 0;
                  return (
                    <div
                      key={v.id}
                      className={`inline-flex items-center justify-between sm:justify-start gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
                        habis
                          ? 'bg-rose-600 text-white border border-rose-400'
                          : sisa <= 5
                          ? 'bg-amber-500/20 text-white border border-amber-400/60'
                          : 'bg-white/12 text-white border border-white/20'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <span>{v.category === 'anjing' ? '🐶' : v.category === 'kucing' ? '🐱' : '🐾'}</span>
                        <span className="truncate">{v.code}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <strong className={habis ? 'text-white' : 'text-[#fff000]'}>
                          {habis ? `HABIS (0/${total})` : `Sisa ${sisa}/${total}`}
                        </strong>
                        {!habis && held > 0 && (
                          <span className="text-[10px] bg-amber-400 text-[#141414] px-1.5 py-0.5 rounded font-extrabold">
                            Hold {held}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#141414]/15 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[#141414]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>🩺 Tim Dokter Hewan Berizin</span>
                <span>🔒 Slot Kuota Terkunci {event.holdDurationMinutes || 10} Menit saat Bayar</span>
                <span>🎟️ Nomor Antrian & Barcode Otomatis</span>
              </div>

              <button
                type="button"
                onClick={() => setShowResumeBox(!showResumeBox)}
                className="underline font-bold text-[#141414] hover:text-stone-700 cursor-pointer"
              >
                Sudah daftar? Upload Bukti Bayar (Batas {event.paymentTimeoutHours || 2} Jam) →
              </button>
            </div>
          </div>
        </div>

        {/* Returning Customer Saved Registrations Banner (Read-Only Snapshot Access) */}
        {savedRegRefs.length > 0 && currentStep < 5 && (
          <div className="bg-white/95 backdrop-blur-xs rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 border-[#141414] shadow-md mb-6 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-[#fff000] border border-[#141414] flex items-center justify-center shrink-0">
                  <QrCode className="w-4 h-4 text-[#141414]" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-xs sm:text-sm text-[#141414]">
                    Data Pendaftaran Tersimpan di Perangkat Ini
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Data Anda tersimpan permanen & tidak berubah. Klik untuk membuka kembali Nomor Antrian & Barcode kapan saja.
                  </p>
                </div>
              </div>
            </div>

            {savedRegError && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-2 rounded-xl text-xs font-medium">
                {savedRegError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {savedRegRefs.slice(0, 4).map((refItem) => (
                <div
                  key={refItem.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-yellow-50/70 border border-[#141414]/25"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {refItem.queueNumber && (
                        <span className="bg-[#141414] text-[#fff000] text-[10px] font-black px-2 py-0.5 rounded-md">
                          Antrian #{refItem.queueNumber}
                        </span>
                      )}
                      <span className="font-mono text-[11px] font-bold text-stone-700 truncate">
                        {refItem.regNumber}
                      </span>
                    </div>
                    <p className="font-bold text-xs text-[#141414] truncate mt-1">
                      {refItem.ownerName} — {refItem.petName}
                    </p>
                    <p className="text-[11px] text-stone-600 truncate">
                      {refItem.vaccineName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={loadingSavedRegId === refItem.id}
                      onClick={() => handleOpenSavedRegistration(refItem)}
                      className="bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] font-extrabold text-[11px] px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      {loadingSavedRegId === refItem.id ? 'Memuat...' : 'Lihat Tiket'}
                    </button>
                    <button
                      type="button"
                      title="Sembunyikan pintasan dari perangkat ini"
                      onClick={() => removeSavedRegistrationRef(refItem.id)}
                      className="text-stone-400 hover:text-stone-700 px-1.5 py-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume Unpaid Booking Box */}
        {showResumeBox && (
          <div className="bg-white rounded-3xl p-5 border-2 border-[#141414] shadow-lg mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-[#141414]">
                Lanjutkan Upload Bukti Pembayaran / Cek Nomor Antrian Anda
              </h3>
              <button
                type="button"
                onClick={() => setShowResumeBox(false)}
                className="text-xs font-bold text-stone-500 hover:text-[#141414]"
              >
                Tutup ✕
              </button>
            </div>
            <form onSubmit={handleResumeLookup} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Masukkan No. Registrasi (misal: REMOV-2026-...) atau No. WhatsApp..."
                value={resumeQuery}
                onChange={(e) => setResumeQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm outline-hidden focus:border-[#141414]"
              />
              <button
                type="submit"
                disabled={isSearchingResume}
                className="bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm"
              >
                {isSearchingResume ? 'Mencari...' : 'Buka Pendaftaran Saya'}
              </button>
            </form>
            {resumeError && <p className="text-xs text-rose-600 font-semibold">{resumeError}</p>}
          </div>
        )}

        {/* Step Progress Indicator */}
        {currentStep < 5 && (
          <div className="mb-6 sm:mb-8 bg-white/90 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              {[
                { num: 1, title: 'Data Pawrent', desc: 'Identitas Pemilik' },
                { num: 2, title: 'Anabul & Syarat', desc: 'Profil & Checklist' },
                { num: 3, title: 'Pilih Vaksin', desc: 'Kuota Real-Time' },
                { num: 4, title: 'Bayar & Antrian', desc: 'Upload Bukti' },
              ].map((step, idx) => {
                const isActive = currentStep === step.num;
                const isPast = currentStep > step.num;
                return (
                  <div key={step.num} className="flex-1 flex flex-col items-center relative text-center min-w-0 px-0.5">
                    <div
                      className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center font-extrabold text-xs sm:text-sm transition-all duration-300 z-10 ${
                        isActive
                          ? 'bg-[#fff000] text-[#141414] border-2 border-[#141414] shadow-md scale-105'
                          : isPast
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {isPast ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : step.num}
                    </div>
                    <span className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 font-bold leading-tight ${isActive ? 'text-[#141414]' : isPast ? 'text-emerald-700' : 'text-stone-400'}`}>
                      {step.title}
                    </span>
                    <span className="hidden md:inline text-[11px] text-stone-500 font-normal">
                      {step.desc}
                    </span>

                    {idx < 3 && (
                      <div
                        className={`absolute top-4 sm:top-5 left-1/2 w-full h-1 -translate-y-1/2 -z-0 transition-colors ${
                          currentStep > step.num ? 'bg-emerald-500' : 'bg-stone-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Form Card Container */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#141414]/15 shadow-xl">

          {submitError && currentStep < 5 && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* ================= STEP 1: DATA PAWRENT ================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-4">
                <div className="flex items-center gap-2 text-[#141414] mb-1">
                  <span className="p-1.5 rounded-lg bg-[#fff000] border border-[#141414]">
                    <User className="w-4 h-4" />
                  </span>
                  <h2 className="font-heading font-bold text-xl text-[#141414]">1. Data Pemilik (Pawrent)</h2>
                </div>
                <p className="text-sm text-stone-500">
                  Digunakan untuk pencatatan registrasi peserta dan pengiriman nomor antrian.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Nama Lengkap Pemilik <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Rian Pratama"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm transition-all"
                    />
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Nomor WhatsApp Aktif <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 081234567890"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm transition-all"
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">Nomor antrian & informasi kloter dikirim via WhatsApp.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Email Aktif <span className="text-stone-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="Contoh: pawrent@email.com (boleh dikosongkan)"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm transition-all"
                    />
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Alamat Lengkap / Kota Domisili <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Cimahi / Jakarta Selatan"
                      value={ownerCity}
                      onChange={(e) => setOwnerCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm transition-all"
                    />
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Akun Instagram <span className="text-stone-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Contoh: @rian.kucingku"
                      value={ownerInstagram}
                      onChange={(e) => setOwnerInstagram(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm transition-all"
                    />
                    <Tag className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Informasi Vaksin Diketahui Dari Mana?
                  </label>
                  <select
                    value={referralSource}
                    onChange={(e) => setReferralSource(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm bg-white"
                  >
                    <option value="Instagram">Instagram @remov.official</option>
                    <option value="Teman / Komunitas Pecinta Hewan">Teman / Komunitas Pecinta Hewan</option>
                    <option value="Klinik / Petshop Rekanan REMOV">Klinik / Petshop Rekanan REMOV</option>
                    <option value="Grup WhatsApp Cat/Dog Lovers">Grup WhatsApp Cat/Dog Lovers</option>
                    <option value="TikTok / Media Sosial Lainnya">TikTok / Media Sosial Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setCurrentStep(2);
                  }}
                  className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-6 py-3.5 rounded-2xl shadow-sm transition-all text-sm group cursor-pointer"
                >
                  <span>Lanjut ke Data Anabul</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: DATA ANABUL & EDITABLE HEALTH CHECKLIST ================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-4">
                <div className="flex items-center gap-2 text-[#141414] mb-1">
                  <span className="p-1.5 rounded-lg bg-[#fff000] border border-[#141414]">
                    <PawPrint className="w-4 h-4" />
                  </span>
                  <h2 className="font-heading font-bold text-xl text-[#141414]">2. Data Anabul & Syarat Ketentuan Vaksin</h2>
                </div>
                <p className="text-sm text-stone-500">
                  Lengkapi profil anabul dan centang seluruh syarat ketentuan kondisi kesehatan sebelum vaksinasi.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                  Jenis Hewan Peliharaan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPetType('kucing')}
                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      petType === 'kucing'
                        ? 'border-[#141414] bg-[#fff000]/35 text-[#141414] shadow-sm'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    <span className="text-3xl">🐱</span>
                    <div className="text-left">
                      <span className="block font-heading font-bold text-base">Kucing (Cat)</span>
                      <span className="text-xs text-stone-600">Feline Care</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPetType('anjing')}
                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      petType === 'anjing'
                        ? 'border-[#141414] bg-[#fff000]/35 text-[#141414] shadow-sm'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    <span className="text-3xl">🐶</span>
                    <div className="text-left">
                      <span className="block font-heading font-bold text-base">Anjing (Dog)</span>
                      <span className="text-xs text-stone-600">Canine Care</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Nama Anabul yang Akan Divaksin <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Audy / Milo / Choco"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Ras / Breed Anabul
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Domestik Mix / Persia / Poodle"
                    value={petBreed}
                    onChange={(e) => setPetBreed(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Jenis Kelamin Anabul
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPetGender('jantan')}
                      className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                        petGender === 'jantan'
                          ? 'border-[#141414] bg-[#fff000]/40 text-[#141414]'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      ♂️ Jantan
                    </button>
                    <button
                      type="button"
                      onClick={() => setPetGender('betina')}
                      className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                        petGender === 'betina'
                          ? 'border-[#141414] bg-[#fff000]/40 text-[#141414]'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      ♀️ Betina
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Status Sterilisasi
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSterilized(true)}
                      className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                        isSterilized
                          ? 'border-[#141414] bg-[#fff000]/40 text-[#141414]'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      Sudah Steril
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSterilized(false)}
                      className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                        !isSterilized
                          ? 'border-[#141414] bg-[#fff000]/40 text-[#141414]'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      Belum Steril
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Perkiraan Usia Anabul <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 1 tahun / 7 bulan"
                    value={petAge}
                    onChange={(e) => setPetAge(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Perkiraan Berat Badan (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Contoh: 3.5"
                    value={petWeightKg}
                    onChange={(e) => setPetWeightKg(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Warna Bulu / Ciri Khusus Anabul
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Putih belang oranye di kepala"
                    value={petColor}
                    onChange={(e) => setPetColor(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Riwayat Vaksinasi Sebelumnya
                  </label>
                  <select
                    value={previousVaccineHistory}
                    onChange={(e) => setPreviousVaccineHistory(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40 outline-hidden text-sm bg-white"
                  >
                    <option value="Belum pernah vaksin">Belum pernah vaksin sama sekali (Vaksin Perdana)</option>
                    <option value="Pernah vaksin lengkap (ada buku vaksin)">Pernah vaksin lengkap & ada buku vaksin</option>
                    <option value="Pernah vaksin tetapi buku hilang">Pernah vaksin tetapi buku vaksin hilang / lupa</option>
                    <option value="Hanya vaksin rabies tahun lalu">Hanya vaksin rabies tahun lalu</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Health Checklist & Terms Managed by Admin */}
              <div className="bg-yellow-50/90 border-2 border-[#141414] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-[#141414] font-extrabold text-sm">
                    <ShieldCheck className="w-5 h-5 text-[#141414]" />
                    <span>Syarat & Ketentuan Vaksin Anabul (Wajib Dicek Peserta)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      checklistItems.forEach(item => { next[item.id] = true; });
                      setChecklistChecked(next);
                    }}
                    className="text-[11px] font-bold bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    Centang Semua
                  </button>
                </div>
                <p className="text-xs text-stone-700">
                  Demi keselamatan anabul, mohon baca dan centang seluruh syarat ketentuan di bawah ini:
                </p>

                <div className="space-y-2.5 pt-1 text-xs sm:text-sm text-[#141414]">
                  {checklistItems.map((item) => (
                    <label key={item.id} className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl bg-white/80 border border-stone-200 hover:border-[#141414] transition-colors">
                      <input
                        type="checkbox"
                        checked={!!checklistChecked[item.id]}
                        onChange={(e) => setChecklistChecked({ ...checklistChecked, [item.id]: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-[#141414] rounded-sm border-stone-400"
                      />
                      <span className="flex-1 leading-snug">
                        {item.text}
                        {item.required && <span className="text-rose-600 font-bold ml-1">*</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setCurrentStep(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep2()) setCurrentStep(3);
                  }}
                  className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-6 py-3.5 rounded-2xl shadow-sm transition-all text-sm group cursor-pointer"
                >
                  <span>Lanjut ke Pilihan Vaksin</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: PILIH VAKSIN & KLOTER (TANPA REKOMENDASI PRODUK) ================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[#141414] mb-1">
                      <span className="p-1.5 rounded-lg bg-[#fff000] border border-[#141414]">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <h2 className="font-heading font-bold text-xl text-[#141414]">3. Pilih Jenis Vaksin & Kloter</h2>
                    </div>
                    <p className="text-sm text-stone-500">
                      Menampilkan pilihan vaksin aktif secara real-time. Pilihan otomatis terkunci saat kuota habis.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRefreshData}
                    title="Perbarui Kuota"
                    className="inline-flex items-center gap-1 text-xs text-[#141414] bg-[#fff000] hover:bg-yellow-300 px-3 py-1.5 rounded-xl border border-[#141414] font-bold transition-colors shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Update Kuota</span>
                  </button>
                </div>
              </div>

              {lockError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Pemberitahuan Kuota:</span>
                    <span>{lockError}</span>
                  </div>
                </div>
              )}

              {/* Pemilihan Kloter Pemeriksaan */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                  Pemilihan Kloter Jam Pemeriksaan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {event.sessions.map((sess, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedSession(sess)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selectedSession === sess
                          ? 'border-[#141414] bg-[#fff000]/40 font-bold text-[#141414] shadow-xs'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm">{sess}</span>
                        {selectedSession === sess && <Check className="w-4 h-4 text-[#141414] shrink-0 stroke-3" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vaccine Cards */}
              <div className="space-y-3.5">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Pilih Vaksin ({petType === 'kucing' ? 'Untuk Kucing' : 'Untuk Anjing'}) <span className="text-rose-500">*</span>
                </label>

                {availableVaccines.length === 0 ? (
                  <div className="p-6 text-center text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
                    <p className="font-semibold text-stone-600 text-sm">Saat ini belum ada pilihan vaksin aktif. Anda tetap dapat mendaftar menggunakan opsi Keperluan Lainnya di bawah ini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {availableVaccines.map((vac) => {
                      const isSelected = selectedVaccineId === vac.id;
                      const isSoldOut = vac.isSoldOut || (vac.availableQuota !== undefined && vac.availableQuota <= 0);
                      const isCompatible = vac.category === 'semua' || vac.category === petType;
                      const total = vac.totalQuota || 1;
                      const available = vac.availableQuota ?? total;
                      const percentLeft = Math.round((available / total) * 100);
                      const isLowQuota = available <= 5 && available > 0;

                      return (
                        <div
                          key={vac.id}
                          onClick={() => {
                            if (!isSoldOut && isCompatible && vac.active) {
                              setSelectedVaccineId(vac.id);
                              setLockError(null);
                            }
                          }}
                          className={`relative rounded-3xl p-5 border-2 transition-all ${
                            isSoldOut
                              ? 'border-stone-200 bg-stone-100/70 opacity-60 cursor-not-allowed'
                              : !isCompatible
                              ? 'border-stone-200 bg-stone-50/50 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-[#141414] bg-yellow-50/90 shadow-md cursor-pointer ring-3 ring-[#fff000]'
                              : 'border-stone-200 bg-white hover:border-[#141414]/50 hover:shadow-xs cursor-pointer'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <h3 className="font-heading font-bold text-lg text-[#141414]">
                                  {vac.name}
                                </h3>

                                {isSoldOut ? (
                                  <span className="bg-rose-100 text-rose-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300">
                                    KUOTA HABIS
                                  </span>
                                ) : isLowQuota ? (
                                  <span className="bg-[#fff000] text-[#141414] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-[#141414] animate-pulse">
                                    Sisa {available} Ekor Lagi!
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                                    Tersedia ({available}/{vac.totalQuota})
                                  </span>
                                )}

                                {!isCompatible && (
                                  <span className="bg-stone-200 text-stone-600 text-[11px] font-medium px-2 py-0.5 rounded-md">
                                    Khusus {vac.category === 'kucing' ? 'Kucing' : 'Anjing'}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-stone-600 max-w-xl">
                                {vac.description}
                              </p>

                              {vac.notes && (
                                <p className="text-[11px] text-stone-700 font-semibold">
                                  ℹ️ {vac.notes}
                                </p>
                              )}
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0">
                              <div className="text-left sm:text-right">
                                <span className="text-xs text-stone-400 block font-normal">Biaya Booking Vaksin</span>
                                <span className={`font-heading font-black text-[#141414] ${vac.priceText?.trim() ? 'text-sm sm:text-base' : 'text-lg'}`}>
                                  {vac.priceText?.trim()
                                    ? vac.priceText.trim()
                                    : vac.price === 0
                                    ? 'GRATIS'
                                    : `Rp ${vac.price.toLocaleString('id-ID')}`}
                                </span>
                              </div>

                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                                  isSelected
                                    ? 'bg-[#fff000] border-[#141414] text-[#141414]'
                                    : 'border-stone-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-stone-200/80 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-1.5 text-xs">
                              <span className="font-bold text-stone-700">Rincian Kuota Real-Time:</span>
                              <span className={`font-extrabold ${isSoldOut ? 'text-rose-700' : isLowQuota ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {isSoldOut
                                  ? `KUOTA HABIS (0 / ${vac.totalQuota} tersisa)`
                                  : `Sisa ${available} dari ${vac.totalQuota} kuota (${percentLeft}%)`}
                              </span>
                            </div>

                            <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isSoldOut
                                    ? 'bg-rose-500 w-full'
                                    : isLowQuota
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${isSoldOut ? 100 : percentLeft}%` }}
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                              <div className={`px-2.5 py-1.5 rounded-xl border text-center ${
                                isSoldOut
                                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              }`}>
                                <span className="block text-[10px] text-stone-500 font-semibold">Sisa Kuota</span>
                                <strong className="font-heading text-xs sm:text-sm">{available} ekor</strong>
                              </div>
                              <div className="px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-center text-[#141414]">
                                <span className="block text-[10px] text-stone-500 font-semibold">
                                  {(vac.heldCount ?? 0) > 0 ? 'Terisi / Hold' : 'Sudah Terisi'}
                                </span>
                                <strong className="font-heading text-xs sm:text-sm">
                                  {vac.confirmedCount ?? Math.max(0, vac.totalQuota - available)}
                                  {(vac.heldCount ?? 0) > 0 ? ` (+${vac.heldCount} hold)` : ''} ekor
                                </strong>
                              </div>
                              <div className="px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-center text-[#141414]">
                                <span className="block text-[10px] text-stone-500 font-semibold">Total Kuota</span>
                                <strong className="font-heading text-xs sm:text-sm">{vac.totalQuota} ekor</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Opsi Tidak Memilih Vaksin / Keperluan Lainnya */}
                <div
                  onClick={() => {
                    setSelectedVaccineId(NO_VACCINE_ID);
                    setLockError(null);
                  }}
                  className={`relative rounded-3xl p-5 border-2 transition-all cursor-pointer ${
                    isNoVaccineSelected
                      ? 'border-[#141414] bg-yellow-50/90 shadow-md ring-3 ring-[#fff000]'
                      : 'border-dashed border-stone-300 bg-stone-50/60 hover:border-[#141414]/60 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-heading font-bold text-base sm:text-lg text-[#141414]">
                          Tidak Memilih Vaksin (Keperluan / Keterangan Lainnya)
                        </h3>
                        <span className="bg-stone-200 text-[#141414] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-stone-300">
                          Opsional • Non-Vaksin
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 max-w-xl">
                        Pilih opsi ini jika Anda tidak membutuhkan vaksinasi, namun tetap ingin mendaftar untuk keperluan atau kebutuhan lain dengan menuliskan keterangannya di bawah.
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <span className="text-xs text-stone-400 block font-normal">Biaya Pendaftaran</span>
                        <span className="font-heading font-black text-lg text-[#141414]">
                          GRATIS
                        </span>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          isNoVaccineSelected
                            ? 'bg-[#fff000] border-[#141414] text-[#141414]'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isNoVaccineSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kolom Keterangan Tambahan / Kebutuhan Peserta */}
              <div
                className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 transition-all space-y-2.5 ${
                  isNoVaccineSelected
                    ? 'bg-yellow-50/90 border-[#141414] shadow-xs'
                    : 'bg-stone-50/80 border-stone-200'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-extrabold text-[#141414] uppercase tracking-wider">
                    Keterangan / Kebutuhan Tambahan Peserta{' '}
                    {isNoVaccineSelected ? (
                      <span className="text-rose-600">* (Wajib Diisi)</span>
                    ) : (
                      <span className="text-stone-400 font-semibold normal-case">(Opsional)</span>
                    )}
                  </label>
                  {isNoVaccineSelected && (
                    <span className="bg-[#141414] text-[#fff000] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                      Tujuan Non-Vaksin
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  {isNoVaccineSelected
                    ? 'Karena Anda tidak memilih vaksin, silakan ketik kebutuhan, keluhan anabul, atau tujuan pendaftaran Anda pada kolom di bawah ini.'
                    : 'Tuliskan kebutuhan tambahan atau catatan khusus untuk panitia/dokter hewan jika ada (misalnya: sekalian cek kulit/telinga, konsultasi vitamin, riwayat alergi, dll).'}
                </p>

                <textarea
                  rows={3}
                  value={vaccineNotes}
                  onChange={(e) => {
                    setVaccineNotes(e.target.value);
                    if (lockError) setLockError(null);
                  }}
                  placeholder={
                    isNoVaccineSelected
                      ? 'Ketik tujuan atau kebutuhan Anda di sini... Contoh: Ingin konsultasi kesehatan kulit anabul / cek telinga / hadir edukasi pawrenting'
                      : 'Contoh: Sekalian konsultasi bulu rontok atau kebutuhan tambahan lainnya (kosongkan jika tidak ada)'
                  }
                  className={`w-full px-4 py-3 rounded-2xl border-2 outline-hidden text-xs sm:text-sm bg-white transition-all resize-y ${
                    isNoVaccineSelected && !vaccineNotes.trim()
                      ? 'border-amber-500 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/50'
                      : 'border-stone-200 focus:border-[#141414] focus:ring-3 focus:ring-[#fff000]/40'
                  }`}
                />
              </div>

              {/* Sticky Summary */}
              <div className="bg-[#141414] text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="w-full sm:w-auto">
                  <span className="text-stone-400 text-xs block">
                    {isNoVaccineSelected ? 'Total Biaya Pendaftaran:' : 'Total Biaya Booking Vaksin:'}
                  </span>
                  <span className="font-heading font-black text-xl sm:text-2xl text-[#fff000]">
                    {grandTotal === 0
                      ? (!isNoVaccineSelected && selectedVaccine?.priceText?.trim()
                          ? selectedVaccine.priceText.trim()
                          : 'GRATIS (Rp 0)')
                      : `Rp ${grandTotal.toLocaleString('id-ID')}`}
                  </span>
                  <span className="text-[11px] text-stone-300 block">
                    {isNoVaccineSelected
                      ? 'Tidak Memilih Vaksin (Keperluan Lainnya)'
                      : (selectedVaccine?.name || 'Belum memilih vaksin')} • {selectedSession}
                  </span>
                  {vaccineNotes.trim() && (
                    <span className="text-[11px] text-[#fff000] block truncate max-w-md mt-0.5">
                      Catatan: {vaccineNotes.trim()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-4 py-3 rounded-xl border border-stone-700 text-stone-300 hover:text-white hover:bg-stone-800 text-sm font-semibold"
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    disabled={isLockingQuota || (!isNoVaccineSelected && (!selectedVaccine || selectedVaccine.isSoldOut))}
                    onClick={handleProceedToLockAndPayment}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#fff000] hover:bg-yellow-300 disabled:bg-stone-700 disabled:text-stone-500 text-[#141414] font-extrabold px-6 py-3.5 rounded-xl shadow-md transition-all text-sm group cursor-pointer"
                  >
                    {isLockingQuota ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mengunci Kuota...</span>
                      </>
                    ) : isNoVaccineSelected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lanjut Konfirmasi Pendaftaran</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Kunci Kuota & Lanjut Bayar</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: KUNCI KUOTA & PAYMENT PROOF (AUTO-VERIFIED) ================= */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Hold / Non-Vaccine Banner */}
              {holdId ? (
                <div className="bg-[#141414] text-white rounded-3xl p-5 shadow-lg border-2 border-[#fff000] pulse-glow">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                      <div className="w-12 h-12 rounded-2xl bg-[#fff000] text-[#141414] flex items-center justify-center shrink-0">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                          <span className="font-heading font-bold text-lg text-[#fff000]">KUOTA ANDA SEDANG TERKUNCI!</span>
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                        <p className="text-xs text-stone-300 max-w-lg">
                          1 slot untuk <strong>{selectedVaccine?.name}</strong> atas nama anabul <strong>{petName}</strong> sedang dikunci khusus untuk Anda.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/10 px-5 py-2.5 rounded-2xl border border-white/20 text-center shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#fff000] block">
                        Sisa Waktu Hold
                      </span>
                      <span className="font-heading font-black text-2xl tracking-wider font-mono text-white">
                        {formatTimer(remainingSeconds)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141414] text-white rounded-3xl p-5 shadow-lg border-2 border-[#fff000]">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#fff000] text-[#141414] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-heading font-bold text-base sm:text-lg text-[#fff000] block">
                        PENDAFTARAN NON-VAKSIN / KEPERLUAN LAINNYA
                      </span>
                      <p className="text-xs text-stone-300">
                        Kebutuhan Anda atas nama anabul <strong>{petName}</strong> telah dicatat. Silakan periksa ringkasan dan konfirmasi pendaftaran di bawah ini.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Group WhatsApp Resmi */}
              {event.whatsappGroupLink && (
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-extrabold text-base text-emerald-950">
                          Group WhatsApp Resmi Pawrenting REMOV
                        </span>
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                          Wajib Bergabung
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        {event.whatsappGroupPrompt}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
                    <a
                      href={event.whatsappGroupLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setHasJoinedWhatsApp(true)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl text-xs sm:text-sm shadow-sm transition-all group"
                    >
                      <span>📲 Join Group WhatsApp Resmi</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <label className="flex items-center gap-2 text-xs text-emerald-900 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasJoinedWhatsApp}
                        onChange={(e) => setHasJoinedWhatsApp(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded-sm border-emerald-300"
                      />
                      <span>Saya sudah bergabung ke Group WhatsApp</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Ringkasan */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200">
                <h3 className="font-heading font-bold text-sm text-[#141414] uppercase tracking-wider mb-3">
                  {isNoVaccineSelected ? 'Ringkasan Pendaftaran' : 'Ringkasan Booking Vaksin'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 block">Pawrent:</span>
                    <span className="font-bold text-[#141414]">{ownerName} ({ownerPhone})</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Anabul:</span>
                    <span className="font-bold text-[#141414]">{petName} ({petType === 'kucing' ? 'Kucing' : 'Anjing'})</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Vaksin / Layanan:</span>
                    <span className="font-bold text-[#141414]">
                      {isNoVaccineSelected ? 'Tidak Memilih Vaksin (Keperluan Lainnya)' : selectedVaccine?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Kloter:</span>
                    <span className="font-bold text-[#141414]">{selectedSession}</span>
                  </div>
                </div>

                {vaccineNotes.trim() && (
                  <div className="mt-3 p-3 rounded-xl bg-yellow-50 border border-[#141414]/20 text-xs">
                    <span className="text-stone-500 font-bold uppercase text-[10px] block mb-0.5">
                      Keterangan / Kebutuhan Tambahan:
                    </span>
                    <p className="font-semibold text-[#141414] whitespace-pre-wrap">{vaccineNotes.trim()}</p>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#141414]">Total Tagihan Booking:</span>
                  <span className="font-heading font-black text-base sm:text-xl text-[#141414] bg-[#fff000] px-3 py-1 rounded-xl border border-[#141414]">
                    {grandTotal === 0
                      ? (!isNoVaccineSelected && selectedVaccine?.priceText?.trim()
                          ? selectedVaccine.priceText.trim()
                          : 'GRATIS (Rp 0)')
                      : `Rp ${grandTotal.toLocaleString('id-ID')}`}
                  </span>
                </div>
              </div>

              {/* Rekening Tujuan */}
              {grandTotal > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-bold text-base text-[#141414]">
                      Pilih Rekening Tujuan Transfer Resmi
                    </h3>
                    <span className="text-xs text-stone-400">Klik untuk memilih:</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {activeBankAccounts.map((acc) => {
                      const isSelected = selectedBankTarget.includes(acc.accountNumber);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => {
                            setPaymentMethod(acc.bankName);
                            setSelectedBankTarget(`${acc.bankName} (${acc.accountNumber})`);
                          }}
                          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#141414] bg-[#fff000]/25 ring-2 ring-[#fff000]'
                              : 'border-stone-200 bg-white hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-xs uppercase tracking-wide text-[#141414]">
                              {acc.bankName}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-[#141414] stroke-3" />}
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-stone-200 flex items-center justify-between mb-1.5">
                            <span className="font-mono font-bold text-sm text-[#141414] select-all">
                              {acc.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(acc.accountNumber.replace(/[^0-9]/g, ''), acc.id);
                              }}
                              className="text-stone-500 hover:text-[#141414] p-1"
                              title="Salin Nomor Rekening"
                            >
                              {copiedBank === acc.id ? (
                                <span className="text-[11px] font-bold text-emerald-600">Disalin!</span>
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <span className="text-[11px] text-stone-600 block font-medium">
                            a.n. {acc.accountHolder}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload Bukti Payment (Hanya jika berbayar) */}
              {grandTotal > 0 ? (
                <div className="bg-yellow-50/90 rounded-3xl p-5 border-2 border-[#141414] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="block text-xs font-extrabold text-[#141414] uppercase tracking-wider">
                          Bukti Payment Booking Vaksin
                        </label>
                        <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          Otomatis Terverifikasi & Dapat No. Antrian
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 mt-0.5">
                        Lampirkan foto bukti transfer atau link Drive untuk langsung mendapat <strong>Nomor Antrian (01, 02, ...)</strong> & Barcode Booth.
                      </p>
                    </div>

                    <div className="inline-flex rounded-xl bg-white border border-stone-300 p-1 text-xs font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => setProofType('upload')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                          proofType === 'upload' ? 'bg-[#fff000] text-[#141414] font-extrabold' : 'text-stone-600'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Upload Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProofType('link')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                          proofType === 'link' ? 'bg-[#fff000] text-[#141414] font-extrabold' : 'text-stone-600'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Link Drive</span>
                      </button>
                    </div>
                  </div>

                  {proofType === 'upload' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-[#141414] font-bold px-5 py-3 rounded-2xl border-2 border-[#141414] shadow-xs cursor-pointer text-sm transition-colors">
                          <Upload className="w-4 h-4" />
                          <span>Pilih Foto Bukti Transfer (JPG/PNG)</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFileChange(e, false)}
                            className="hidden"
                          />
                        </label>

                        {paymentProofName ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="truncate max-w-xs">{paymentProofName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">Belum ada file dipilih</span>
                        )}
                      </div>

                      {paymentProofData && (
                        <div>
                          <img
                            src={paymentProofData}
                            alt="Bukti Transfer"
                            className="max-h-40 rounded-2xl border border-stone-300 shadow-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {proofType === 'link' && (
                    <div className="relative">
                      <input
                        type="url"
                        placeholder="Contoh: https://drive.google.com/open?id=..."
                        value={paymentProofLink}
                        onChange={(e) => setPaymentProofLink(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border border-stone-300 focus:border-[#141414] outline-hidden text-xs sm:text-sm bg-white"
                      />
                      <LinkIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    </div>
                  )}

                  {/* 2-Hour Warning Notice */}
                  <div className="bg-amber-100/80 border border-amber-400 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>Info Penting:</strong> Jika belum bisa mengunggah bukti bayar sekarang, Anda dapat menyimpan pendaftaran terlebih dahulu dengan batas waktu <strong>{event.paymentTimeoutHours || 2} jam</strong> untuk melunasi & mengunggah bukti agar mendapat Nomor Antrian. Jika lewat {event.paymentTimeoutHours || 2} jam tanpa bukti bayar, formulir otomatis <strong>HANGUS</strong>.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/90 rounded-3xl p-5 border-2 border-emerald-400 flex items-start gap-3 text-xs sm:text-sm text-emerald-950">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-extrabold">Pendaftaran Tanpa Biaya Booking (GRATIS / Rp 0)</strong>
                    <span>
                      Tidak perlu melakukan transfer atau mengunggah bukti pembayaran. Klik tombol konfirmasi di bawah untuk langsung mendapatkan <strong>Nomor Antrian & Barcode Booth</strong>.
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleReleaseHoldAndBack}
                  className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold transition-colors"
                >
                  {holdId ? 'Batalkan & Lepaskan Kuota' : 'Kembali Ubah Pilihan'}
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                  {grandTotal > 0 && !paymentProofData && !paymentProofLink.trim() && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmitRegistration(true)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-[#141414] border border-stone-300 font-bold px-5 py-3.5 rounded-2xl text-xs sm:text-sm transition-all"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Simpan Dulu (Bayar Maks {event.paymentTimeoutHours || 2} Jam)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitRegistration(false)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-7 py-3.5 rounded-2xl shadow-md text-sm transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memproses & Membuat Antrian...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{grandTotal === 0 ? 'Konfirmasi Pendaftaran & Ambil No. Antrian' : 'Konfirmasi Booking & Ambil No. Antrian'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: NOMOR ANTRIAN / 2-HOUR WARNING / EXPIRED ================= */}
          {currentStep === 5 && confirmedRegistration && (
            <div className="space-y-6">

              {/* CASE A: EXPIRED (> 2 Jam tanpa bukti bayar) */}
              {confirmedRegistration.paymentStatus === 'expired' && (
                <div className="bg-rose-50 border-2 border-rose-400 rounded-3xl p-6 sm:p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-9 h-9" />
                  </div>
                  <h2 className="font-heading font-black text-2xl text-rose-900">
                    Formulir Pendaftaran Hangus (Melewati Batas {event.paymentTimeoutHours || 2} Jam)
                  </h2>
                  <p className="text-sm text-rose-800 max-w-lg mx-auto">
                    Pendaftaran atas nama <strong>{confirmedRegistration.ownerName}</strong> ({confirmedRegistration.petName}) untuk <strong>{confirmedRegistration.vaccineName}</strong> melewati batas waktu 2 jam tanpa bukti pembayaran, sehingga slot telah dikembalikan ke publik.
                  </p>
                  <p className="text-xs text-rose-700">
                    Silakan mengisi ulang formulir atau memilih jenis vaksin lain yang masih tersedia.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedRegistration(null);
                      setCurrentStep(1);
                      onRefreshData();
                    }}
                    className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-6 py-3 rounded-2xl text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Isi Ulang Formulir / Pilih Vaksin Lain</span>
                  </button>
                </div>
              )}

              {/* CASE B: PENDING PAYMENT (2-Hour Countdown Warning + Inline Proof Upload) */}
              {confirmedRegistration.paymentStatus === 'pending_payment' && (
                <div className="space-y-6">
                  <div className="bg-amber-50 border-2 border-amber-500 rounded-3xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="bg-amber-200 text-amber-950 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full">
                            Peringatan Batas Waktu {event.paymentTimeoutHours || 2} Jam
                          </span>
                          <h2 className="font-heading font-black text-xl text-[#141414] mt-1">
                            Segera Lakukan Payment Booking & Upload Bukti!
                          </h2>
                          <p className="text-xs sm:text-sm text-stone-700 mt-1">
                            Data pendaftaran Anda (<strong>{confirmedRegistration.regNumber}</strong>) sudah tercatat untuk <strong>{confirmedRegistration.vaccineName}</strong>. Mohon segera unggah bukti payment booking sebelum batas waktu habis agar langsung memperoleh <strong>Nomor Antrian</strong>. Jika melewati 2 jam tanpa bukti bayar, formulir otomatis dianggap <strong>HANGUS</strong> dan Anda harus mengisi ulang atau memilih vaksin lain.
                          </p>
                        </div>
                      </div>

                      <div className="bg-[#141414] text-[#fff000] px-5 py-3 rounded-2xl text-center shrink-0 border-2 border-[#fff000]">
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-stone-300">
                          Sisa Waktu Bayar
                        </span>
                        <span className="font-heading font-black text-2xl font-mono">
                          {formatTimer(paymentDeadlineRemaining)}
                        </span>
                      </div>
                    </div>

                    {lateProofError && (
                      <div className="bg-rose-100 border border-rose-300 text-rose-800 rounded-xl p-3 text-xs font-semibold">
                        {lateProofError}
                      </div>
                    )}

                    {/* Inline Late Proof Upload */}
                    <div className="bg-white rounded-2xl p-4 border border-amber-300 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-extrabold uppercase text-[#141414]">
                          Upload Bukti Payment Sekarang untuk Aktifkan Nomor Antrian:
                        </span>
                        <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setLateProofType('upload')}
                            className={`px-2.5 py-1 rounded-md ${lateProofType === 'upload' ? 'bg-[#fff000] text-[#141414]' : 'text-stone-600'}`}
                          >
                            Upload Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => setLateProofType('link')}
                            className={`px-2.5 py-1 rounded-md ${lateProofType === 'link' ? 'bg-[#fff000] text-[#141414]' : 'text-stone-600'}`}
                          >
                            Link Drive
                          </button>
                        </div>
                      </div>

                      {lateProofType === 'upload' ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-[#141414] font-bold px-4 py-2.5 rounded-xl border border-stone-300 cursor-pointer text-xs">
                            <Upload className="w-4 h-4" />
                            <span>Pilih File Bukti Transfer</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => handleFileChange(e, true)}
                              className="hidden"
                            />
                          </label>
                          {lateProofName && (
                            <span className="text-xs font-bold text-emerald-700">{lateProofName}</span>
                          )}
                        </div>
                      ) : (
                        <input
                          type="url"
                          placeholder="https://drive.google.com/..."
                          value={lateProofLink}
                          onChange={(e) => setLateProofLink(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs outline-hidden focus:border-[#141414]"
                        />
                      )}

                      <button
                        type="button"
                        disabled={isSubmittingLateProof}
                        onClick={handleSubmitLateProof}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-6 py-3 rounded-xl text-xs sm:text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isSubmittingLateProof ? 'Memverifikasi...' : 'Kirim Bukti & Dapatkan Nomor Antrian Sekarang'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CASE C: VERIFIED BOOKING -> NOMOR ANTRIAN (01, 02, 03...) + BARCODE + EDITABLE NOTES */}
              {confirmedRegistration.paymentStatus === 'verified' && (
                <div className="space-y-6">
                  <div className="text-center max-w-lg mx-auto py-1">
                    <div className="w-16 h-16 bg-[#fff000] border-2 border-[#141414] text-[#141414] rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <CheckCircle2 className="w-10 h-10 stroke-2" />
                    </div>
                    <h2 className="font-heading font-black text-2xl text-[#141414]">
                      Booking Otomatis Terverifikasi!
                    </h2>
                    <p className="text-sm text-stone-600 mt-1">
                      Simpan & tunjukkan <strong>Nomor Antrian dan Barcode</strong> di bawah ini saat registrasi ulang di booth Pawrenting REMOV.
                    </p>
                  </div>

                  {/* Queue Number Hero Ticket Card */}
                  <div className="bg-linear-to-b from-[#fff000]/35 via-yellow-50 to-white rounded-3xl p-6 sm:p-8 border-2 border-[#141414] shadow-lg space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      {/* Left: Queue Number + Vaccine + Session + Status + Editable Arrival Description */}
                      <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="inline-flex flex-col items-center md:items-start bg-[#141414] text-[#fff000] px-7 py-5 rounded-3xl shadow-md border-2 border-[#fff000]">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest text-stone-300">
                            NOMOR ANTRIAN ANDA
                          </span>
                          <span className="font-heading font-black text-6xl sm:text-7xl tracking-tight leading-none mt-1">
                            {confirmedRegistration.queueNumber || '01'}
                          </span>
                        </div>

                        {/* Directly beneath Queue Number: Vaccine, Kloter Jam, Sukses Booking, Arrival Note */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                            <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full uppercase tracking-wide shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {event.bookingSuccessLabel || 'SUKSES BOOKING'}
                            </span>
                            <span className="font-mono text-xs font-bold bg-white border border-stone-300 text-[#141414] px-3 py-1.5 rounded-full">
                              {confirmedRegistration.regNumber}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left bg-white p-4 rounded-2xl border border-stone-200">
                            <div>
                              <span className="text-[11px] text-stone-400 uppercase font-bold block">Jenis Vaksin / Layanan Dipilih</span>
                              <strong className="text-sm text-[#141414]">{confirmedRegistration.vaccineName}</strong>
                              <span className="block text-[11px] font-semibold text-stone-600 mt-0.5">
                                Biaya: {confirmedRegistration.vaccinePriceText?.trim()
                                  ? confirmedRegistration.vaccinePriceText.trim()
                                  : confirmedRegistration.totalAmount === 0
                                  ? 'GRATIS (Rp 0)'
                                  : `Rp ${confirmedRegistration.totalAmount.toLocaleString('id-ID')}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-[11px] text-stone-400 uppercase font-bold block">Kloter Jam Pemeriksaan</span>
                              <strong className="text-sm text-[#141414] flex items-center gap-1">
                                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                                {confirmedRegistration.selectedSession}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[11px] text-stone-400 uppercase font-bold block">Pawrent</span>
                              <strong className="text-sm text-[#141414]">{confirmedRegistration.ownerName}</strong>
                            </div>
                            <div>
                              <span className="text-[11px] text-stone-400 uppercase font-bold block">Nama Anabul</span>
                              <strong className="text-sm text-[#141414]">
                                {confirmedRegistration.petName} ({confirmedRegistration.petType === 'kucing' ? 'Kucing' : 'Anjing'})
                              </strong>
                            </div>
                            <div className="sm:col-span-2 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                              <span>Event: <strong className="text-[#141414]">{confirmedRegistration.eventTitle}</strong></span>
                              <span>Tercatat Permanen: <strong className="text-[#141414]">{new Date(confirmedRegistration.createdAt).toLocaleString('id-ID')}</strong></span>
                            </div>
                            {confirmedRegistration.vaccineNotes && (
                              <div className="sm:col-span-2 pt-2 border-t border-stone-100">
                                <span className="text-[11px] text-stone-400 uppercase font-bold block">Keterangan / Kebutuhan Tambahan</span>
                                <strong className="text-xs sm:text-sm text-[#141414] whitespace-pre-wrap">{confirmedRegistration.vaccineNotes}</strong>
                              </div>
                            )}
                          </div>

                          {/* Editable Description Note beneath Queue Number */}
                          <div className="bg-[#fff000]/45 border border-[#141414]/30 rounded-2xl p-4 text-left">
                            <p className="text-xs sm:text-sm font-semibold text-[#141414] leading-relaxed">
                              {event.ticketArrivalNote || 'Harap datang ke booth Pawrenting REMOV tepat waktu sesuai kloter jam yang dipilih. Jika ada perubahan jadwal, mohon konfirmasi terlebih dahulu kepada pihak panitia.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Scannable Queue Barcode & QR Code */}
                      <div className="flex flex-col items-center bg-white p-4 rounded-2xl border-2 border-[#141414] shadow-sm shrink-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-[#141414] text-[#fff000] px-2.5 py-0.5 rounded-full mb-2">
                          <QrCode className="w-3 h-3" />
                          Barcode Antrian Booth
                        </span>
                        {ticketQrUrl ? (
                          <img
                            src={ticketQrUrl}
                            alt="Barcode Antrian"
                            className="w-40 h-40 rounded-lg"
                          />
                        ) : (
                          <div className="w-40 h-40 bg-stone-100 animate-pulse rounded-lg" />
                        )}
                        <span className="font-mono font-extrabold text-xs text-[#141414] mt-2 bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200">
                          {confirmedRegistration.barcodeCode || confirmedRegistration.regNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-stone-500 mt-1 text-center">
                          Tunjukkan saat registrasi di booth
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Wajib Join WhatsApp Group */}
                  {event.whatsappGroupLink && (
                    <div className="bg-emerald-50 border-2 border-emerald-500 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3 text-center sm:text-left">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-heading font-extrabold text-base text-emerald-950">
                            Masuk Group WhatsApp Resmi Pawrenting REMOV
                          </h3>
                          <p className="text-xs text-emerald-800 mt-0.5">
                            Dapatkan panggilan antrian dan pengumuman hari-H langsung dari panitia.
                          </p>
                        </div>
                      </div>

                      <a
                        href={event.whatsappGroupLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-2xl text-xs sm:text-sm transition-all shrink-0"
                      >
                        <span>📲 Masuk Group WhatsApp</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2 no-print">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 bg-[#141414] hover:bg-black text-[#fff000] font-bold px-5 py-3 rounded-2xl text-sm transition-all shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Cetak / Simpan PDF Nomor Antrian</span>
                    </button>

                    <a
                      href={`https://wa.me/${event.contactWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        `Halo Panitia REMOV Pawrenting, saya telah terverifikasi booking:\nNo. Antrian: ${confirmedRegistration.queueNumber}\nNo. Reg: ${confirmedRegistration.regNumber}\nPawrent: ${confirmedRegistration.ownerName}\nAnabul: ${confirmedRegistration.petName}\nLayanan/Vaksin: ${confirmedRegistration.vaccineName}${confirmedRegistration.vaccineNotes ? `\nKeterangan: ${confirmedRegistration.vaccineNotes}` : ''}\nKloter: ${confirmedRegistration.selectedSession}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-2xl text-sm transition-all shadow-sm"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Konfirmasi ke WhatsApp Panitia</span>
                    </a>

                    <button
                      type="button"
                      onClick={resetForNewPet}
                      className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-5 py-3 rounded-2xl text-sm transition-all shadow-sm"
                    >
                      <PawPrint className="w-4 h-4" />
                      <span>Daftarkan Anabul Lain</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
