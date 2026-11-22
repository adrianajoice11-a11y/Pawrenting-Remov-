import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Users, Syringe, Settings, Table, Download,
  Plus, Edit2, Trash2, CheckCircle, XCircle, AlertCircle,
  ExternalLink, Copy, Check, RefreshCw, Eye, EyeOff,
  Search, Lock, Unlock, FileSpreadsheet,
  Clock, Phone, Calendar, MapPin, CreditCard, Image as ImageIcon,
  Link as LinkIcon, QrCode, Ticket, Archive, FolderOpen, Upload,
  UserCheck, UserX, CalendarClock, Sparkles, Award, Building2, RotateCcw, X
} from 'lucide-react';
import type {
  EventConfig, VaccineOption, Registration, QuotaHold,
  GoogleSheetConfig, BankAccount, Voucher, EventArchive, CheckInStatus, HealthChecklistItem,
  SheetSyncAuditEntry, SheetSyncLiveState, DailyRegistrationSnapshot
} from '../types.ts';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/sheetScriptTemplate.ts';
import {
  exportRegistrationsToCSV,
  exportGroupedSpreadsheetXLS,
  syncColumnsToCanonicalDatabaseOrder,
} from '../utils/csvExport.ts';
import {
  PetDistributionDonutCard,
  DailyRegistrationTrendCard,
  RealtimeSheetSyncVisualizer,
  SheetAuditLogPanel,
} from './AdminAnalyticsAndSyncPanel.tsx';

interface AdminDashboardProps {
  onBackToPublic: () => void;
  onRefreshParent: () => void;
  onOpenShareModal?: () => void;
}

interface AssetFile {
  name: string;
  url: string;
}

const CHECKIN_LABELS: Record<CheckInStatus, { label: string; cls: string }> = {
  belum_hadir: { label: 'Belum Hadir', cls: 'bg-stone-100 text-stone-700 border-stone-300' },
  sudah_hadir: { label: 'Hadir Booth', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  selesai_vaksin: { label: 'Selesai Vaksin', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  tidak_hadir: { label: 'Tidak Hadir', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToPublic,
  onRefreshParent,
  onOpenShareModal
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'submissions' | 'vouchers' | 'vaccines' | 'payments' | 'archives' | 'event' | 'sheets' | 'holds'
  >('overview');

  const [isLoading, setIsLoading] = useState(true);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [adminData, setAdminData] = useState<{
    event: EventConfig;
    vaccines: VaccineOption[];
    registrations: Registration[];
    dailySnapshots?: DailyRegistrationSnapshot[];
    holds: QuotaHold[];
    vouchers: Voucher[];
    archives: EventArchive[];
    sheetConfig: GoogleSheetConfig;
    sheetAuditLogs?: SheetSyncAuditEntry[];
    sheetSyncState?: SheetSyncLiveState;
    stats: any;
  } | null>(null);

  // Asset folder listings
  const [backgroundAssets, setBackgroundAssets] = useState<AssetFile[]>([]);
  const [logoAssets, setLogoAssets] = useState<AssetFile[]>([]);
  const [voucherAssets, setVoucherAssets] = useState<AssetFile[]>([]);

  // Submissions Filters & Modals
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_payment' | 'verified' | 'expired' | 'rejected'>('all');
  const [checkInFilter, setCheckInFilter] = useState<'all' | CheckInStatus>('all');
  const [vaccineFilter, setVaccineFilter] = useState<string>('all');
  const [petTypeFilter, setPetTypeFilter] = useState<'all' | 'kucing' | 'anjing'>('all');
  const [registrationDateFilter, setRegistrationDateFilter] = useState<string>('all');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [selectedRegDetails, setSelectedRegDetails] = useState<Registration | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ reg: Registration; newSession: string } | null>(null);

  // Payments Tab Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending_payment' | 'verified' | 'expired' | 'rejected'>('all');

  // Modals: Vaccine & Bank
  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Partial<VaccineOption> | null>(null);
  const [confirmDeleteVaccineId, setConfirmDeleteVaccineId] = useState<string | null>(null);
  const [deletingVaccineId, setDeletingVaccineId] = useState<string | null>(null);
  const [vaccineFeedback, setVaccineFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingPriceVacId, setEditingPriceVacId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<string>('');
  const [savingInlinePriceId, setSavingInlinePriceId] = useState<string | null>(null);
  const [vaccinePriceMode, setVaccinePriceMode] = useState<'number' | 'text'>('number');
  const [confirmEmptyAllQuotas, setConfirmEmptyAllQuotas] = useState(false);
  const [isEmptyingQuotas, setIsEmptyingQuotas] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<Partial<BankAccount> | null>(null);

  // Google Sheets
  const [sheetWebhookUrl, setSheetWebhookUrl] = useState('');
  const [sheetAutoSync, setSheetAutoSync] = useState(true);
  const [isTestingSheet, setIsTestingSheet] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [sheetFeedback, setSheetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Event & Visual Config Form
  const [eventForm, setEventForm] = useState<EventConfig | null>(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [eventSaveSuccess, setEventSaveSuccess] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newSessionText, setNewSessionText] = useState('');
  const lastSyncedEventJsonRef = useRef<string>('');
  const eventFormRef = useRef<EventConfig | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    eventFormRef.current = eventForm;
  }, [eventForm]);

  // Team Admin Event Completion State
  const [isCompleteEventModalOpen, setIsCompleteEventModalOpen] = useState(false);
  const [isCompletingEvent, setIsCompletingEvent] = useState(false);
  const [eventActionFeedback, setEventActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [completeEventForm, setCompleteEventForm] = useState({
    statement: '',
    completedBy: 'Tim Admin REMOV',
    city: '',
    summaryNotes: '',
    documentationPhotos: [] as string[],
  });

  const notifyPublicSync = () => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('remov_event_sync');
        bc.postMessage({ ts: Date.now() });
        bc.close();
      }
    } catch {
      // Ignore BroadcastChannel errors
    }
    onRefreshParent();
  };

  // Vouchers State
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeemNotesInput, setRedeemNotesInput] = useState('');
  const [redeemFeedback, setRedeemFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [customVoucherModalReg, setCustomVoucherModalReg] = useState<Registration | null>(null);
  const [customVoucherCode, setCustomVoucherCode] = useState('');
  const [previewVoucher, setPreviewVoucher] = useState<Voucher | null>(null);
  const [isSavingVoucherTpl, setIsSavingVoucherTpl] = useState(false);

  // Archives & Reset Queue State
  const [isArchiveResetModalOpen, setIsArchiveResetModalOpen] = useState(false);
  const [isManualArchiveModalOpen, setIsManualArchiveModalOpen] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<EventArchive | null>(null);
  const [confirmDeleteArchiveId, setConfirmDeleteArchiveId] = useState<string | null>(null);
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);
  const [archiveFeedback, setArchiveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [archiveResetForm, setArchiveResetForm] = useState({
    partnerName: '',
    partnerLogoUrl: '',
    city: '',
    month: new Date().toLocaleString('id-ID', { month: 'long' }),
    year: String(new Date().getFullYear()),
    programsRunText: 'Vaksinasi Anti-Rabies, Vaksinasi F3, Pemeriksaan Kesehatan Anabul',
    summaryNotes: '',
    documentationPhotos: [] as string[],
    resetRegistrations: true,
    nextEventTitle: '',
    nextEventDate: '',
  });
  const [manualArchiveForm, setManualArchiveForm] = useState({
    eventTitle: '',
    locationName: '',
    locationAddress: '',
    city: '',
    eventDate: '',
    month: '',
    year: String(new Date().getFullYear()),
    partnerName: '',
    programsRunText: 'Vaksinasi Rabies, Edukasi Pawrenting',
    summaryNotes: '',
    totalRegistrations: 50,
    totalAttended: 48,
    documentationPhotos: [] as string[],
  });

  const fetchFolders = async () => {
    try {
      const [bgRes, logoRes, vchRes] = await Promise.all([
        fetch('/api/assets/backgrounds').then(r => r.json()),
        fetch('/api/assets/logos').then(r => r.json()),
        fetch('/api/assets/vouchers').then(r => r.json()),
      ]);
      if (bgRes.success) setBackgroundAssets(bgRes.files || []);
      if (logoRes.success) setLogoAssets(logoRes.files || []);
      if (vchRes.success) setVoucherAssets(vchRes.files || []);
    } catch (e) {
      console.error('Error loading asset folders:', e);
    }
  };

  const fetchAdminData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/data?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setAdminData(data);
        setSheetWebhookUrl(data.sheetConfig.webhookUrl || '');
        setSheetAutoSync(data.sheetConfig.autoSync ?? true);

        const currentForm = eventFormRef.current;
        const hasUnsavedFormEdits = !!currentForm
          && !!lastSyncedEventJsonRef.current
          && JSON.stringify(currentForm) !== lastSyncedEventJsonRef.current;

        lastSyncedEventJsonRef.current = JSON.stringify(data.event);
        if (!hasUnsavedFormEdits) {
          setEventForm(data.event);
        }

        setArchiveResetForm(prev => ({
          ...prev,
          partnerName: prev.partnerName || data.event.partnerName || '',
          partnerLogoUrl: prev.partnerLogoUrl || data.event.partnerLogoUrl || '',
          nextEventTitle: data.event.title,
          nextEventDate: data.event.date,
        }));
      }
    } catch (err) {
      if (!silent) {
        console.warn('Error fetching admin data:', err);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData(false);
    fetchFolders();

    const handleServerUpdate = () => {
      fetchAdminData(true);
    };
    window.addEventListener('remov:server-update', handleServerUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('remov_event_sync');
      bc.onmessage = () => fetchAdminData(true);
    }

    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAdminData(true);
      }
    }, 8000);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('remov:server-update', handleServerUpdate);
      bc?.close();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Faster live polling while Google Sheets sync pipeline is actively pushing or retrying
  const livePipelineStatus = adminData?.sheetSyncState?.pipelineStatus;
  useEffect(() => {
    if (livePipelineStatus !== 'pushing' && livePipelineStatus !== 'retrying') return;
    const fastTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAdminData(true);
      }
    }, 1500);
    return () => clearInterval(fastTimer);
  }, [livePipelineStatus]);

  // Upload asset into folder (/backgrounds, /logos, /vouchers, /archives)
  const handleUploadAssetToFolder = async (
    folder: 'backgrounds' | 'logos' | 'vouchers' | 'archives',
    file: File,
    onSuccess: (url: string) => void
  ) => {
    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file maksimal 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/admin/upload-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder,
            fileName: file.name,
            base64Data: reader.result
          })
        });
        const data = await res.json();
        if (data.success) {
          onSuccess(data.url);
          fetchFolders();
        } else {
          alert(data.message || 'Gagal upload file.');
        }
      } catch (err: any) {
        alert(err.message || 'Gagal upload asset.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateStatus = async (regId: string, status: 'verified' | 'rejected' | 'pending' | 'expired', notes?: string) => {
    try {
      const res = await fetch(`/api/admin/registrations/${regId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (res.ok) {
        fetchAdminData();
        onRefreshParent();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleCheckInStatus = async (regId: string, checkInStatus: CheckInStatus) => {
    try {
      const res = await fetch(`/api/admin/registrations/${regId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInStatus })
      });
      if (res.ok) {
        fetchAdminData();
        onRefreshParent();
      }
    } catch (err) {
      console.error('Error updating check-in:', err);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTarget) return;
    try {
      const res = await fetch(`/api/admin/registrations/${rescheduleTarget.reg.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSession: rescheduleTarget.newSession })
      });
      if (res.ok) {
        setRescheduleTarget(null);
        fetchAdminData();
        onRefreshParent();
      }
    } catch (err) {
      console.error('Error rescheduling:', err);
    }
  };

  const handleDeleteRegistration = async (regId: string, regNum: string) => {
    if (!confirm(`Hapus pendaftaran ${regNum}? Kuota vaksin akan otomatis dikembalikan ke publik.`)) return;
    try {
      const res = await fetch(`/api/admin/registrations/${regId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAdminData();
        onRefreshParent();
      }
    } catch (err) {
      console.error('Error deleting registration:', err);
    }
  };

  const handleSaveVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVaccine?.name || !editingVaccine?.code) {
      alert('Nama dan kode vaksin wajib diisi.');
      return;
    }
    const action = editingVaccine.id ? 'update' : 'create';
    const cleanVaccine = { ...editingVaccine };
    delete cleanVaccine.confirmedCount;
    delete cleanVaccine.heldCount;
    delete cleanVaccine.availableQuota;
    delete cleanVaccine.isSoldOut;
    try {
      const res = await fetch('/api/admin/vaccines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, vaccine: cleanVaccine })
      });
      if (res.ok) {
        setIsVaccineModalOpen(false);
        setEditingVaccine(null);
        fetchAdminData();
        onRefreshParent();
      }
    } catch (err) {
      console.error('Error saving vaccine:', err);
    }
  };

  const handleToggleVaccine = async (vac: VaccineOption) => {
    await fetch('/api/admin/vaccines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', vaccine: { id: vac.id } })
    });
    fetchAdminData();
    onRefreshParent();
  };

  const handleDeleteVaccine = async (vac: VaccineOption) => {
    setDeletingVaccineId(vac.id);
    setVaccineFeedback(null);
    try {
      const res = await fetch('/api/admin/vaccines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', vaccine: { id: vac.id } })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus vaksin.');
      }
      setAdminData(prev => (prev ? { ...prev, vaccines: data.vaccines || [] } : prev));
      setConfirmDeleteVaccineId(null);
      setVaccineFeedback({ type: 'success', message: `Vaksin "${vac.name}" berhasil dihapus.` });
      await fetchAdminData();
      onRefreshParent();
    } catch (err: any) {
      setVaccineFeedback({ type: 'error', message: err?.message || 'Gagal menghapus vaksin.' });
    } finally {
      setDeletingVaccineId(null);
    }
  };

  const handleAdjustQuota = async (vac: VaccineOption, delta: number) => {
    const newQuota = Math.max(0, vac.totalQuota + delta);
    const { confirmedCount: _c, heldCount: _h, availableQuota: _a, isSoldOut: _s, ...cleanVac } = vac;
    await fetch('/api/admin/vaccines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', vaccine: { ...cleanVac, totalQuota: newQuota } })
    });
    fetchAdminData();
    onRefreshParent();
  };

  const handleSetQuotaZero = async (vac: VaccineOption) => {
    const { confirmedCount: _c, heldCount: _h, availableQuota: _a, isSoldOut: _s, ...cleanVac } = vac;
    await fetch('/api/admin/vaccines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', vaccine: { ...cleanVac, totalQuota: 0 } })
    });
    setVaccineFeedback({ type: 'success', message: `Kuota "${vac.name}" berhasil dikosongkan (0 / HABIS).` });
    fetchAdminData();
    onRefreshParent();
  };

  const handleEmptyAllQuotas = async () => {
    setIsEmptyingQuotas(true);
    setVaccineFeedback(null);
    try {
      const res = await fetch('/api/admin/vaccines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'empty-all-quotas' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmEmptyAllQuotas(false);
        setVaccineFeedback({ type: 'success', message: 'Seluruh kuota vaksin berhasil dikosongkan menjadi 0 (KUOTA HABIS).' });
        await fetchAdminData();
        onRefreshParent();
      }
    } finally {
      setIsEmptyingQuotas(false);
    }
  };

  const handleSaveInlinePrice = async (vac: VaccineOption) => {
    const raw = inlinePriceValue.trim();
    const isNumericInput = raw === '' || /^(?:rp\.?\s*)?[\d.,\s]+$/i.test(raw);
    const digitsOnly = raw.replace(/[^\d]/g, '');

    const nextPrice = isNumericInput ? (digitsOnly ? Number(digitsOnly) : 0) : 0;
    const nextPriceText = isNumericInput ? '' : raw;

    setSavingInlinePriceId(vac.id);
    setVaccineFeedback(null);
    const { confirmedCount: _c, heldCount: _h, availableQuota: _a, isSoldOut: _s, ...cleanVac } = vac;
    try {
      const res = await fetch('/api/admin/vaccines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          vaccine: { ...cleanVac, price: nextPrice, priceText: nextPriceText }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memperbarui harga vaksin.');
      }
      setEditingPriceVacId(null);
      setVaccineFeedback({
        type: 'success',
        message: `Harga "${vac.name}" diperbarui menjadi ${
          nextPriceText ? nextPriceText : nextPrice === 0 ? 'GRATIS (Rp 0)' : `Rp ${nextPrice.toLocaleString('id-ID')}`
        }.`
      });
      await fetchAdminData();
      onRefreshParent();
    } catch (err: any) {
      setVaccineFeedback({ type: 'error', message: err?.message || 'Gagal memperbarui harga.' });
    } finally {
      setSavingInlinePriceId(null);
    }
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankAccount?.bankName || !editingBankAccount?.accountNumber) {
      alert('Nama Bank dan Nomor Rekening Tujuan wajib diisi.');
      return;
    }
    const action = editingBankAccount.id ? 'update' : 'create';
    const res = await fetch('/api/admin/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, account: editingBankAccount })
    });
    if (res.ok) {
      setIsBankModalOpen(false);
      setEditingBankAccount(null);
      fetchAdminData();
      onRefreshParent();
    }
  };

  const handleToggleBankAccount = async (acc: BankAccount) => {
    await fetch('/api/admin/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', account: { id: acc.id } })
    });
    fetchAdminData();
    onRefreshParent();
  };

  const handleDeleteBankAccount = async (acc: BankAccount) => {
    if (!confirm(`Hapus rekening ${acc.bankName} (${acc.accountNumber})?`)) return;
    await fetch('/api/admin/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', account: { id: acc.id } })
    });
    fetchAdminData();
    onRefreshParent();
  };

  const handleReleaseHold = async (holdId: string) => {
    await fetch(`/api/admin/holds/${holdId}/release`, { method: 'POST' });
    fetchAdminData();
    onRefreshParent();
  };

  // Vouchers Actions
  const handleSaveVoucherTemplate = async () => {
    if (!eventForm) return;
    setIsSavingVoucherTpl(true);
    try {
      const res = await fetch('/api/admin/vouchers/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventForm.voucherTemplate)
      });
      if (res.ok) {
        fetchAdminData();
        alert('Template desain & gambar voucher berhasil disimpan!');
      }
    } finally {
      setIsSavingVoucherTpl(false);
    }
  };

  const handleGenerateVoucher = async (reg: Registration, customCode?: string) => {
    try {
      const res = await fetch('/api/admin/vouchers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: reg.id,
          customCode: customCode?.trim() || undefined,
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || 'Gagal menerbitkan voucher.');
        return;
      }
      setCustomVoucherModalReg(null);
      setCustomVoucherCode('');
      setPreviewVoucher(data.voucher);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat voucher.');
    }
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCodeInput.trim()) return;
    setRedeemFeedback(null);
    try {
      const res = await fetch('/api/admin/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: redeemCodeInput.trim(),
          redeemedNotes: redeemNotesInput.trim() || undefined
        })
      });
      const data = await res.json();
      setRedeemFeedback({
        type: data.success ? 'success' : 'error',
        message: data.message
      });
      if (data.success) {
        setRedeemCodeInput('');
        setRedeemNotesInput('');
        fetchAdminData();
      }
    } catch (err: any) {
      setRedeemFeedback({ type: 'error', message: err.message || 'Gagal memproses kode voucher.' });
    }
  };

  const handleDeleteVoucher = async (vId: string) => {
    if (!confirm('Hapus voucher ini dari daftar?')) return;
    await fetch(`/api/admin/vouchers/${vId}`, { method: 'DELETE' });
    fetchAdminData();
  };

  const openCompleteEventModal = () => {
    if (!adminData) return;
    const ev = adminData.event;
    setCompleteEventForm({
      statement: ev.eventCompletedStatement || `Tim Admin REMOV menyatakan bahwa acara "${ev.title}"${ev.partnerName ? ` bersama ${ev.partnerName}` : ''} pada jadwal ${ev.date} (${ev.timeRange}) di ${ev.locationName} telah selesai dilaksanakan. Seluruh data peserta tersimpan otomatis sesuai jadwal pelaksanaan.`,
      completedBy: ev.eventCompletedBy || 'Tim Admin REMOV',
      city: '',
      summaryNotes: '',
      documentationPhotos: [],
    });
    setIsCompleteEventModalOpen(true);
  };

  const handleConfirmCompleteEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCompletingEvent(true);
    setEventActionFeedback(null);
    try {
      const res = await fetch('/api/admin/events/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeEventForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyelesaikan event.');
      }
      setIsCompleteEventModalOpen(false);
      setEventActionFeedback({ type: 'success', message: data.message });
      await fetchAdminData(true);
      notifyPublicSync();
    } catch (err: any) {
      setEventActionFeedback({ type: 'error', message: err?.message || 'Gagal menyelesaikan event.' });
    } finally {
      setIsCompletingEvent(false);
    }
  };

  const handleReopenEvent = async () => {
    setEventActionFeedback(null);
    try {
      const res = await fetch('/api/admin/events/reopen', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setEventActionFeedback({ type: 'success', message: data.message });
        await fetchAdminData(true);
        notifyPublicSync();
      }
    } catch (err: any) {
      setEventActionFeedback({ type: 'error', message: err?.message || 'Gagal membuka kembali event.' });
    }
  };

  // Archive & Reset Queue Action
  const handleArchiveAndResetEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventActionFeedback(null);
    try {
      const res = await fetch('/api/admin/events/archive-and-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...archiveResetForm,
          programsRun: archiveResetForm.programsRunText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsArchiveResetModalOpen(false);
        setEventActionFeedback({ type: 'success', message: data.message });
        await fetchAdminData(true);
        notifyPublicSync();
      }
    } catch (err: any) {
      setEventActionFeedback({ type: 'error', message: err.message || 'Gagal mengarsipkan event.' });
    }
  };

  const handleSaveManualArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          archive: {
            ...manualArchiveForm,
            programsRun: manualArchiveForm.programsRunText
              .split(',')
              .map(s => s.trim())
              .filter(Boolean),
          }
        })
      });
      if (res.ok) {
        setIsManualArchiveModalOpen(false);
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan arsip manual.');
    }
  };

  const handleDeleteArchive = async (arcId: string) => {
    setDeletingArchiveId(arcId);
    setArchiveFeedback(null);
    try {
      const res = await fetch('/api/admin/archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', archive: { id: arcId } })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus arsip.');
      }
      setAdminData(prev => (prev ? { ...prev, archives: data.archives || [] } : prev));
      if (viewingArchive?.id === arcId) {
        setViewingArchive(null);
      }
      setConfirmDeleteArchiveId(null);
      setArchiveFeedback({ type: 'success', message: 'Arsip portofolio berhasil dihapus.' });
      await fetchAdminData();
      onRefreshParent();
    } catch (err: any) {
      setArchiveFeedback({ type: 'error', message: err?.message || 'Gagal menghapus arsip.' });
    } finally {
      setDeletingArchiveId(null);
    }
  };

  // Save Sheet Webhook + Grouping Format
  const handleSaveSheetConfig = async () => {
    try {
      const res = await fetch('/api/admin/sheet-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: sheetWebhookUrl,
          autoSync: sheetAutoSync,
          spreadsheetConfig: eventForm?.spreadsheetConfig
        })
      });
      if (res.ok) {
        setSheetFeedback({ type: 'success', message: 'Pengaturan Google Sheets & format tabel kelompok vaksin berhasil disimpan!' });
        fetchAdminData();
        onRefreshParent();
      }
    } catch {
      setSheetFeedback({ type: 'error', message: 'Gagal menyimpan pengaturan.' });
    }
  };

  const handleTestSheetConnection = async () => {
    setIsTestingSheet(true);
    setSheetFeedback(null);
    try {
      const res = await fetch('/api/admin/sheet-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: sheetWebhookUrl })
      });
      const data = await res.json();
      setSheetFeedback({
        type: data.success ? 'success' : 'error',
        message: data.success ? 'Koneksi berhasil: ' + data.message : 'Gagal tersambung: ' + data.message
      });
      fetchAdminData();
    } catch (err: any) {
      setSheetFeedback({ type: 'error', message: err.message || 'Koneksi gagal' });
    } finally {
      setIsTestingSheet(false);
    }
  };

  const handleSyncAllRegistrations = async () => {
    setIsSyncingAll(true);
    setSheetFeedback(null);
    try {
      const res = await fetch('/api/admin/sheet-sync', { method: 'POST' });
      const data = await res.json();
      setSheetFeedback({
        type: data.success ? 'success' : 'error',
        message: data.success
          ? `Berhasil menyinkronkan ${data.syncedCount} data (terkelompok per vaksin dalam 1 sheet)!`
          : (data.message || 'Gagal sinkronisasi data.')
      });
      fetchAdminData();
    } catch (err: any) {
      setSheetFeedback({ type: 'error', message: err.message || 'Koneksi gagal' });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncPendingRegistrations = async () => {
    setIsSyncingPending(true);
    setSheetFeedback(null);
    try {
      const res = await fetch('/api/admin/sheet-sync-pending', { method: 'POST' });
      const data = await res.json();
      setSheetFeedback({
        type: data.success ? 'success' : 'error',
        message: data.success
          ? (data.syncedCount > 0
              ? `Berhasil mendorong ${data.syncedCount} data tertunda ke Google Sheets!`
              : data.message)
          : (data.message || 'Gagal sinkronisasi data tertunda.')
      });
      fetchAdminData(true);
    } catch (err: any) {
      setSheetFeedback({ type: 'error', message: err.message || 'Koneksi gagal' });
    } finally {
      setIsSyncingPending(false);
    }
  };

  const flushEventFormToServer = async (targetForm: EventConfig, showBanner = true) => {
    const { queueCounter: _q, publicShareUrl: _u, ...safePayload } = targetForm;
    setIsSavingEvent(true);
    try {
      const res = await fetch('/api/admin/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.event) {
        lastSyncedEventJsonRef.current = JSON.stringify(data.event);
        setAdminData((prev) => (prev ? { ...prev, event: data.event } : prev));
        if (showBanner) {
          setEventSaveSuccess(true);
          setTimeout(() => setEventSaveSuccess(false), 2500);
        }
        notifyPublicSync();
      }
    } catch (err) {
      console.error('Error saving event:', err);
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Auto-save any edits made in Tab 7 after 650ms so the live app immediately reflects Admin updates
  useEffect(() => {
    if (!eventForm || !lastSyncedEventJsonRef.current) return;
    if (JSON.stringify(eventForm) === lastSyncedEventJsonRef.current) return;
    if (!eventForm.title || !eventForm.title.trim()) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const snapshot = eventForm;
    autoSaveTimerRef.current = setTimeout(() => {
      flushEventFormToServer(snapshot, true);
    }, 650);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [eventForm]);

  const savePartialEventConfig = async (patch: Partial<EventConfig>) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setEventForm((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      const res = await fetch('/api/admin/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (data.success && data.event) {
        lastSyncedEventJsonRef.current = JSON.stringify(data.event);
        setEventSaveSuccess(true);
        setAdminData((prev) => (prev ? { ...prev, event: data.event } : prev));
        setEventForm(data.event);
        notifyPublicSync();
        setTimeout(() => setEventSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Error auto-saving event patch:', err);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setEventSaveSuccess(false);
    await flushEventFormToServer(eventForm, true);
  };

  const handleBackToPublicWithFlush = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (eventForm && lastSyncedEventJsonRef.current && JSON.stringify(eventForm) !== lastSyncedEventJsonRef.current && eventForm.title.trim()) {
      await flushEventFormToServer(eventForm, false);
    }
    notifyPublicSync();
    onBackToPublic();
  };

  if (isLoading || !adminData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <RefreshCw className="w-8 h-8 text-[#141414] animate-spin mx-auto mb-3" />
        <p className="text-stone-600 font-medium">Memuat Dashboard Admin Pawrenting REMOV...</p>
      </div>
    );
  }

  const getRegDateKeyWib = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };

  const filteredRegistrations = adminData.registrations.filter((r) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      r.ownerName.toLowerCase().includes(q) ||
      r.petName.toLowerCase().includes(q) ||
      r.ownerPhone.includes(searchTerm) ||
      r.regNumber.toLowerCase().includes(q) ||
      (r.queueNumber || '').toLowerCase().includes(q) ||
      (r.barcodeCode || '').toLowerCase().includes(q) ||
      (r.vaccineNotes || '').toLowerCase().includes(q);

    const matchStatus = statusFilter === 'all' || r.paymentStatus === statusFilter;
    const matchCheckIn = checkInFilter === 'all' || (r.checkInStatus || 'belum_hadir') === checkInFilter;
    const matchVaccine = vaccineFilter === 'all' || r.vaccineId === vaccineFilter;
    const matchPetType = petTypeFilter === 'all' || r.petType === petTypeFilter;
    const matchRegDate = registrationDateFilter === 'all' || getRegDateKeyWib(r.createdAt) === registrationDateFilter;

    return matchSearch && matchStatus && matchCheckIn && matchVaccine && matchPetType && matchRegDate;
  });

  const paymentProofRegistrations = adminData.registrations.filter((r) => {
    return paymentStatusFilter === 'all' || r.paymentStatus === paymentStatusFilter;
  });

  // Candidate paid bookings who haven't arrived / marked tidak_hadir (eligible for petshop compensation voucher)
  const voucherCandidates = adminData.registrations.filter(
    r => r.paymentStatus === 'verified' && (!r.checkInStatus || r.checkInStatus === 'belum_hadir' || r.checkInStatus === 'tidak_hadir')
  );

  const verifiedQueueList = adminData.registrations
    .filter(r => r.paymentStatus === 'verified')
    .sort((a, b) => (a.queueSequence || 9999) - (b.queueSequence || 9999));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-6">
      {/* Admin Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#141414] text-white rounded-3xl p-6 shadow-xl border-2 border-[#fff000]">
        <div className="flex items-center gap-3">
          <img
            src={adminData.event.removLogoUrl || '/logos/remov-logo.svg'}
            alt="REMOV Logo"
            className="h-12 w-auto max-w-[120px] object-contain rounded-2xl bg-[#fff000] p-1.5 border border-white/20"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading font-extrabold text-xl text-white">
                Admin Hub Pawrenting REMOV
              </h1>
              <span className="bg-[#fff000] text-[#141414] text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                Antrian Aktif: #{String(adminData.event.queueCounter || 0).padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Kelola Antrian & Barcode Booth, Voucher Petshop 1x Pakai, Arsip Portofolio, Tampilan Logo/BG & Spreadsheet
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchAdminData(false)}
            title="Refresh Data"
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => exportRegistrationsToCSV(adminData.registrations, adminData.event.title, eventForm?.spreadsheetConfig || adminData.event.spreadsheetConfig)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV (Rapi)</span>
          </button>

          <button
            onClick={() => exportGroupedSpreadsheetXLS(adminData.registrations, adminData.vaccines, { ...adminData.event, spreadsheetConfig: eventForm?.spreadsheetConfig || adminData.event.spreadsheetConfig })}
            className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Kelompok Vaksin (.xls)</span>
          </button>

          {onOpenShareModal && (
            <button
              onClick={onOpenShareModal}
              className="inline-flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-[#fff000] border border-[#fff000]/40 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>QR & Link Share</span>
            </button>
          )}

          <button
            onClick={handleBackToPublicWithFlush}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-[#141414] text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <span>Lihat Form Publik</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-stone-200 text-xs sm:text-sm">
        {[
          { id: 'overview', label: 'Ringkasan & Booth Antrian', icon: LayoutDashboard },
          { id: 'submissions', label: `Pendaftar & Reschedule (${adminData.registrations.length})`, icon: Users },
          { id: 'vouchers', label: `Voucher Petshop (${adminData.vouchers.length})`, icon: Ticket },
          { id: 'vaccines', label: `Kelola Vaksin (${adminData.vaccines.length})`, icon: Syringe },
          { id: 'payments', label: 'Pembayaran Onsite & Kasir', icon: CreditCard },
          { id: 'archives', label: `Arsip & Portofolio (${adminData.archives.length})`, icon: Archive },
          { id: 'event', label: 'Event, Logo, BG & Checklist', icon: Settings },
          { id: 'sheets', label: 'Spreadsheet & Grup Tabel', icon: FileSpreadsheet },
          { id: 'holds', label: `Slot Hold (${adminData.holds.length})`, icon: Lock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#fff000] text-[#141414] border-2 border-[#141414] shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: OVERVIEW & LIVE BOOTH QUEUE BOARD ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider block">Total Pendaftar</span>
              <span className="font-heading font-black text-3xl text-[#141414] tabular-nums">{adminData.stats.totalRegistrations}</span>
              <span className="text-[11px] text-emerald-700 font-bold block mt-1 tabular-nums">
                {adminData.stats.verifiedCount} Sukses · +{adminData.stats.todayRegistrations ?? 0} Hari Ini
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider block">Kehadiran Booth</span>
              <span className="font-heading font-black text-3xl text-emerald-600">{adminData.stats.checkedInCount}</span>
              <span className="text-[11px] text-rose-600 font-bold block mt-1">
                {adminData.stats.notArrivedVerifiedCount} Belum Hadir / Absen
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider block">Metode Pembayaran</span>
              <span className="font-heading font-black text-xl text-[#141414] block mt-1">Onsite Booth</span>
              <span className="text-[11px] text-stone-500 font-semibold block mt-1">
                Transaksi langsung di lokasi acara
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider block">Estimasi Transaksi Onsite</span>
              <span className="font-heading font-black text-xl text-[#141414] block mt-1">
                Rp {adminData.stats.totalRevenue.toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] text-stone-400 block mt-1">
                Hold aktif: {adminData.stats.activeHoldsCount} slot
              </span>
            </div>

            <div className="bg-[#fff000] p-5 rounded-3xl border-2 border-[#141414] shadow-xs">
              <span className="text-[11px] text-[#141414] font-extrabold uppercase tracking-wider block">Voucher Petshop</span>
              <span className="font-heading font-black text-3xl text-[#141414]">{adminData.stats.activeVouchersCount}</span>
              <span className="text-[11px] text-[#141414] font-bold block mt-1">
                {adminData.stats.redeemedVouchersCount} Sudah Hangus (Dipakai)
              </span>
            </div>
          </div>

          {eventActionFeedback && (
            <div className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
              eventActionFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}>
              <span>{eventActionFeedback.message}</span>
              <button
                type="button"
                onClick={() => setEventActionFeedback(null)}
                className="px-1.5 opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Event Lifecycle & Real-Time Completion Statement Banner */}
          <div className={`rounded-3xl p-5 border-2 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
            adminData.event.eventStatus === 'completed'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
              : 'bg-yellow-50/70 border-[#141414] text-[#141414]'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  adminData.event.eventStatus === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#141414] text-[#fff000]'
                }`}>
                  {adminData.event.eventStatus === 'completed'
                    ? '✓ Event Dinyatakan Selesai & Tersimpan Sesuai Jadwal'
                    : '● Event Berjalan (Sinkron Real-Time)'}
                </span>
                <span className="text-xs font-bold text-stone-600">
                  Jadwal: {adminData.event.date} • {adminData.event.timeRange}
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                {adminData.event.eventStatus === 'completed'
                  ? (adminData.event.eventCompletedStatement || 'Tim Admin telah menyatakan event selesai dan data peserta tersimpan otomatis di Arsip.')
                  : 'Seluruh data customer yang mengisi form terupdate secara real-time hingga Tim Admin menyatakan event ini selesai.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {adminData.event.eventStatus === 'completed' ? (
                <button
                  type="button"
                  onClick={handleReopenEvent}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-[#141414] border-2 border-[#141414] text-xs font-bold px-3.5 py-2.5 rounded-xl cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Buka Kembali Event</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCompleteEventModal}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Nyatakan Event Selesai &amp; Simpan Data</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsArchiveResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#141414] hover:bg-black text-[#fff000] text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mulai Jadwal Baru (Reset 01)</span>
              </button>
            </div>
          </div>

          {/* Monitor Antrian Booth Real-time (Siapa Belum Datang / Sudah Hadir) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#141414] flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  <span>Monitor Nomor Antrian & Kehadiran Booth Hari-H</span>
                </h2>
                <p className="text-xs text-stone-500">
                  Pantau nomor antrian mana yang sudah check-in barcode di booth atau belum datang (dapat digeser kloter atau diterbitkan Voucher Petshop).
                </p>
              </div>
              <button
                onClick={() => setIsArchiveResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#141414] hover:bg-black text-[#fff000] text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Selesaikan Event & Reset Antrian ke 01</span>
              </button>
            </div>

            {verifiedQueueList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm">
                Belum ada peserta dengan booking terverifikasi di event aktif ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {verifiedQueueList.map((reg) => {
                  const status = (reg.checkInStatus || 'belum_hadir') as CheckInStatus;
                  const badge = CHECKIN_LABELS[status];
                  return (
                    <div
                      key={reg.id}
                      className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                        status === 'sudah_hadir' || status === 'selesai_vaksin'
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : status === 'tidak_hadir'
                          ? 'border-rose-300 bg-rose-50/40'
                          : 'border-[#141414]/25 bg-yellow-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-[#fff000] border-2 border-[#141414] rounded-xl px-3 py-1.5 text-center shrink-0">
                            <span className="font-heading font-black text-xl text-[#141414]">
                              {reg.queueNumber || '--'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <strong className="text-sm text-[#141414] block truncate">{reg.ownerName}</strong>
                            <span className="text-[11px] text-stone-600 block truncate">
                              {reg.petType === 'kucing' ? '🐱' : '🐶'} {reg.petName} • {reg.vaccineName}
                            </span>
                            {reg.vaccineNotes && (
                              <span className="text-[10px] text-[#141414] bg-yellow-100 border border-yellow-300 px-1.5 py-0.5 rounded mt-0.5 inline-block max-w-full truncate">
                                📝 {reg.vaccineNotes}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-600 flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-stone-200">
                        <span className="truncate">{reg.selectedSession}</span>
                        <span className="font-mono font-bold text-[#141414] ml-2 shrink-0">{reg.barcodeCode}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {status !== 'sudah_hadir' && status !== 'selesai_vaksin' && (
                          <button
                            onClick={() => handleCheckInStatus(reg.id, 'sudah_hadir')}
                            className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Hadir</span>
                          </button>
                        )}
                        {status === 'sudah_hadir' && (
                          <button
                            onClick={() => handleCheckInStatus(reg.id, 'selesai_vaksin')}
                            className="flex-1 inline-flex items-center justify-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                          >
                            <Syringe className="w-3.5 h-3.5" />
                            <span>Selesai</span>
                          </button>
                        )}
                        <button
                          onClick={() => setRescheduleTarget({ reg, newSession: reg.selectedSession })}
                          className="inline-flex items-center gap-1 bg-white hover:bg-stone-100 text-[#141414] border border-stone-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                          title="Geser ke Kloter Lain"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          <span>Geser</span>
                        </button>
                        {status !== 'sudah_hadir' && status !== 'selesai_vaksin' && (
                          <button
                            onClick={() => {
                              if (reg.voucherCode) {
                                alert(`Peserta ini sudah punya voucher: ${reg.voucherCode}`);
                              } else {
                                setCustomVoucherModalReg(reg);
                              }
                            }}
                            className="inline-flex items-center gap-1 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg"
                            title="Terbitkan Voucher Petshop untuk peserta tidak datang"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            <span>{reg.voucherCode ? 'Ada Voucher' : 'Voucher'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Registration Trend & Per-Day Participant Log */}
          <DailyRegistrationTrendCard
            dailySnapshots={adminData.dailySnapshots || []}
            todayDateKey={adminData.stats.todayDateKey || new Date().toISOString().slice(0, 10)}
            todayDateLabel={adminData.stats.todayDateLabel || 'Hari Ini'}
            yesterdayRegistrations={adminData.stats.yesterdayRegistrations ?? 0}
            lastUpdatedAt={adminData.stats.lastUpdatedAt}
            eventStatus={adminData.event.eventStatus}
            eventDate={adminData.event.date}
            onSelectDateFilter={(dateKey) => {
              setRegistrationDateFilter(dateKey);
              setActiveTab('submissions');
            }}
          />

          {/* Pet Distribution Donut Chart & Vaccine Quota Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-6">
              <PetDistributionDonutCard
                registrations={adminData.registrations}
                onFilterPetType={(petType) => {
                  setPetTypeFilter(petType);
                  setActiveTab('submissions');
                }}
              />
            </div>

            {/* Vaccine Quota Summary */}
            <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-stone-200 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-4">
                <div>
                  <h2 className="font-heading font-bold text-lg text-[#141414]">Status Kuota Real-Time Vaksin</h2>
                  <p className="text-xs text-stone-500 mt-0.5">Ketersediaan kuota aktif per jenis layanan vaksinasi.</p>
                </div>
                <button
                  onClick={() => setActiveTab('vaccines')}
                  className="text-xs font-bold text-[#141414] bg-[#fff000] px-3 py-1.5 rounded-xl border border-[#141414] shrink-0 cursor-pointer"
                >
                  Kelola Vaksin →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                {adminData.vaccines.map(vac => (
                  <div key={vac.id} className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-xs sm:text-sm text-[#141414] truncate">{vac.name}</strong>
                      <span className="font-mono text-[10px] font-bold bg-[#fff000] px-2 py-0.5 rounded-md border border-[#141414] shrink-0">
                        {vac.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-600 tabular-nums">
                      <span>Terisi: <strong>{vac.confirmedCount || 0}</strong></span>
                      <span>Hold: <strong>{vac.heldCount || 0}</strong></span>
                      <span>Sisa: <strong className="text-emerald-700">{vac.availableQuota ?? 0}/{vac.totalQuota}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real-Time Google Sheets Synchronization Visualizer */}
          <RealtimeSheetSyncVisualizer
            sheetConfig={adminData.sheetConfig}
            sheetSyncState={adminData.sheetSyncState}
            registrations={adminData.registrations}
            isSyncingPending={isSyncingPending}
            isSyncingAll={isSyncingAll}
            onSyncPending={handleSyncPendingRegistrations}
            onSyncAll={handleSyncAllRegistrations}
            onOpenSheetSettings={() => setActiveTab('sheets')}
          />

          {/* Admin Audit Log Panel for Google Sheets Sync History */}
          <SheetAuditLogPanel
            logs={adminData.sheetAuditLogs || []}
            webhookConfigured={Boolean(adminData.sheetConfig.webhookUrl && adminData.sheetConfig.webhookUrl.trim().startsWith('http'))}
            onOpenSheetSettings={() => setActiveTab('sheets')}
            onTestConnection={handleTestSheetConnection}
            isTestingSheet={isTestingSheet}
          />
        </div>
      )}

      {/* ================= TAB 2: SUBMISSIONS, CHECK-IN & RESCHEDULE ================= */}
      {activeTab === 'submissions' && (
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="font-heading font-bold text-lg text-[#141414]">
                Daftar Pendaftar, Barcode Antrian & Reschedule Kloter
              </h2>
              <p className="text-xs text-stone-500">
                Kelola verifikasi, check-in kehadiran di booth, pergeseran kloter, dan ekspor CSV/Excel rapi per vaksin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportRegistrationsToCSV(adminData.registrations, adminData.event.title, eventForm?.spreadsheetConfig || adminData.event.spreadsheetConfig)}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV Rapi</span>
              </button>
              <button
                onClick={() => exportGroupedSpreadsheetXLS(adminData.registrations, adminData.vaccines, { ...adminData.event, spreadsheetConfig: eventForm?.spreadsheetConfig || adminData.event.spreadsheetConfig })}
                className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] text-xs font-extrabold px-3.5 py-2 rounded-xl"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Unduh Excel Per Vaksin (.xls)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari No. Antrian (01), Barcode, Nama, Anabul, No. WA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:border-[#141414] outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-medium bg-white"
              >
                <option value="all">Semua Status Booking</option>
                <option value="verified">Sukses Booking (Onsite)</option>
                <option value="rejected">Ditolak / Dibatalkan</option>
              </select>

              <select
                value={checkInFilter}
                onChange={(e) => setCheckInFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-medium bg-white"
              >
                <option value="all">Semua Kehadiran Booth</option>
                <option value="belum_hadir">Belum Hadir</option>
                <option value="sudah_hadir">Sudah Hadir Booth</option>
                <option value="selesai_vaksin">Selesai Vaksin</option>
                <option value="tidak_hadir">Tidak Hadir</option>
              </select>

              <select
                value={vaccineFilter}
                onChange={(e) => setVaccineFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-medium bg-white"
              >
                <option value="all">Semua Vaksin</option>
                {adminData.vaccines.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
                <option value="no-vaccine">Tidak Memilih Vaksin (Keperluan Lainnya)</option>
              </select>

              <select
                value={petTypeFilter}
                onChange={(e) => setPetTypeFilter(e.target.value as 'all' | 'kucing' | 'anjing')}
                className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-medium bg-white"
              >
                <option value="all">Semua Jenis Hewan</option>
                <option value="kucing">Kucing ({adminData.stats.catCount ?? 0})</option>
                <option value="anjing">Anjing ({adminData.stats.dogCount ?? 0})</option>
              </select>

              <select
                value={registrationDateFilter}
                onChange={(e) => setRegistrationDateFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-medium bg-white"
              >
                <option value="all">Semua Tanggal Daftar</option>
                {(adminData.dailySnapshots || [])
                  .slice()
                  .reverse()
                  .map((snap) => (
                    <option key={snap.dateKey} value={snap.dateKey}>
                      {snap.dateKey === adminData.stats.todayDateKey ? `Hari Ini (${snap.dateLabel})` : snap.dateLabel} — {snap.newCount} org
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left text-xs text-stone-600 border-collapse">
              <thead className="bg-[#141414] text-[#fff000] font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">Antrian & Reg</th>
                  <th className="py-3 px-3">Pawrent</th>
                  <th className="py-3 px-3">Anabul</th>
                  <th className="py-3 px-3">Vaksin & Kloter</th>
                  <th className="py-3 px-3">Status Booking</th>
                  <th className="py-3 px-3">Kehadiran Booth</th>
                  <th className="py-3 px-3 text-right">Aksi Panitia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400">
                      Tidak ada pendaftar yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => {
                    const checkInfo = CHECKIN_LABELS[(reg.checkInStatus || 'belum_hadir') as CheckInStatus];
                    return (
                      <tr key={reg.id} className="hover:bg-yellow-50/40 transition-colors">
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-black text-base bg-[#fff000] text-[#141414] border border-[#141414] px-2 py-0.5 rounded-lg">
                              {reg.queueNumber || '--'}
                            </span>
                            <div>
                              <span className="font-mono font-bold text-[#141414] block">{reg.regNumber}</span>
                              <span className="text-[10px] text-stone-400 font-mono block">{reg.barcodeCode || '-'}</span>
                              <span className="text-[10px] text-stone-500 font-mono tabular-nums">
                                Daftar: {new Date(reg.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <strong className="text-[#141414] block">{reg.ownerName}</strong>
                          <a
                            href={`https://wa.me/${reg.ownerPhone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5 text-[11px]"
                          >
                            <Phone className="w-3 h-3" />
                            {reg.ownerPhone}
                          </a>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <strong className="text-[#141414] block">
                            {reg.petType === 'kucing' ? '🐱' : '🐶'} {reg.petName}
                          </strong>
                          <span className="text-[11px] text-stone-500">{reg.petBreed} • {reg.petAge}</span>
                        </td>

                        <td className="py-3 px-3">
                          <strong className="text-[#141414] block">{reg.vaccineName}</strong>
                          <span className="text-[11px] text-stone-500 block">{reg.selectedSession}</span>
                          {reg.vaccineNotes && (
                            <span className="text-[11px] text-[#141414] bg-yellow-50 border border-yellow-300 px-2 py-0.5 rounded-md mt-1 inline-block max-w-[240px]">
                              📝 {reg.vaccineNotes}
                            </span>
                          )}
                          {reg.rescheduledFromSession && (
                            <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                              Digeser dari {reg.rescheduledFromSession}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {reg.paymentStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                              <CheckCircle className="w-3 h-3" />
                              Sukses Booking
                            </span>
                          ) : reg.paymentStatus === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                              Ditolak
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                              <Clock className="w-3 h-3" />
                              Terdaftar Onsite
                            </span>
                          )}
                          {reg.voucherCode && (
                            <span className="block mt-1 text-[10px] font-mono font-bold text-[#141414] bg-[#fff000] px-1.5 py-0.5 rounded w-fit">
                              🎟️ {reg.voucherCode}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${checkInfo.cls}`}>
                            {checkInfo.label}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {reg.paymentStatus === 'verified' && (
                              <>
                                <button
                                  onClick={() => handleCheckInStatus(reg.id, 'sudah_hadir')}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg"
                                  title="Check-In Hadir di Booth"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setRescheduleTarget({ reg, newSession: reg.selectedSession })}
                                  className="p-1.5 bg-yellow-100 hover:bg-[#fff000] text-[#141414] rounded-lg"
                                  title="Geser / Reschedule Kloter"
                                >
                                  <CalendarClock className="w-4 h-4" />
                                </button>
                                {!reg.voucherCode && (
                                  <button
                                    onClick={() => setCustomVoucherModalReg(reg)}
                                    className="p-1.5 bg-stone-100 hover:bg-[#fff000] text-[#141414] rounded-lg"
                                    title="Buat Voucher Petshop (Tidak Hadir)"
                                  >
                                    <Ticket className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                            {reg.paymentStatus !== 'verified' && (
                              <button
                                onClick={() => handleUpdateStatus(reg.id, 'verified', 'Diverifikasi manual oleh Admin')}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg"
                                title="Verifikasi Manual & Beri Antrian"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedRegDetails(reg)}
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg"
                              title="Detail Lengkap"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRegistration(reg.id, reg.regNumber)}
                              className="p-1.5 bg-stone-100 hover:bg-rose-100 text-stone-400 hover:text-rose-600 rounded-lg"
                              title="Hapus Data"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: VOUCHER PETSHOP SINGLE-USE (KHUSUS ADMIN) ================= */}
      {activeTab === 'vouchers' && eventForm && (
        <div className="space-y-6">
          {/* 1. Custom Template & Gambar Voucher */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#141414] flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  <span>Pengaturan Desain & Kode Voucher Petshop (Dikelola Khusus Admin)</span>
                </h2>
                <p className="text-xs text-stone-500">
                  Kustomisasi judul, prefix kode, nominal/benefit, serta gambar voucher sesuai event. Setiap kode yang terbit hanya berlaku <strong>1x pakai (sekali redeem langsung hangus)</strong>.
                </p>
              </div>
              <button
                type="button"
                disabled={isSavingVoucherTpl}
                onClick={handleSaveVoucherTemplate}
                className="bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold text-xs px-4 py-2.5 rounded-xl shrink-0"
              >
                {isSavingVoucherTpl ? 'Menyimpan...' : 'Simpan Desain Voucher'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold uppercase text-stone-600 block mb-1">Judul Voucher</label>
                  <input
                    type="text"
                    value={eventForm.voucherTemplate.title}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      voucherTemplate: { ...eventForm.voucherTemplate, title: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="font-bold uppercase text-stone-600 block mb-1">Prefix Kode Voucher</label>
                  <input
                    type="text"
                    value={eventForm.voucherTemplate.codePrefix}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      voucherTemplate: { ...eventForm.voucherTemplate, codePrefix: e.target.value.toUpperCase() }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="font-bold uppercase text-stone-600 block mb-1">Benefit / Nilai Voucher</label>
                  <input
                    type="text"
                    value={eventForm.voucherTemplate.benefitText}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      voucherTemplate: { ...eventForm.voucherTemplate, benefitText: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="font-bold uppercase text-stone-600 block mb-1">Berlaku Hingga</label>
                  <input
                    type="text"
                    value={eventForm.voucherTemplate.validUntil}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      voucherTemplate: { ...eventForm.voucherTemplate, validUntil: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold uppercase text-stone-600 block mb-1">Keterangan / Syarat Voucher</label>
                  <textarea
                    rows={2}
                    value={eventForm.voucherTemplate.description}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      voucherTemplate: { ...eventForm.voucherTemplate, description: e.target.value }
                    })}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-[#141414] font-bold px-3.5 py-2 rounded-xl cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Gambar Voucher Baru</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleUploadAssetToFolder('vouchers', f, (url) => {
                            setEventForm({
                              ...eventForm,
                              voucherTemplate: { ...eventForm.voucherTemplate, imageUrl: url }
                            });
                          });
                        }
                      }}
                    />
                  </label>
                  {voucherAssets.length > 0 && (
                    <select
                      value={eventForm.voucherTemplate.imageUrl}
                      onChange={(e) => setEventForm({
                        ...eventForm,
                        voucherTemplate: { ...eventForm.voucherTemplate, imageUrl: e.target.value }
                      })}
                      className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                    >
                      {voucherAssets.map(a => (
                        <option key={a.url} value={a.url}>Folder /vouchers: {a.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Preview Voucher */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-center space-y-2">
                <span className="text-[11px] font-bold uppercase text-stone-500 block">Pratinjau Gambar Voucher</span>
                <img
                  src={eventForm.voucherTemplate.imageUrl || '/vouchers/voucher-remov-default.svg'}
                  alt="Preview Voucher"
                  className="w-full max-h-40 object-contain rounded-xl border border-stone-200 bg-white p-1"
                />
                <strong className="block text-xs text-[#141414]">{eventForm.voucherTemplate.benefitText}</strong>
              </div>
            </div>
          </div>

          {/* 2. Verifikasi / Hanguskan Kode Voucher (Anti-Double) */}
          <div className="bg-[#141414] text-white rounded-3xl p-6 border-2 border-[#fff000] space-y-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#fff000]">
                Kasir Penukaran Voucher Petshop (1x Pakai Langsung Hangus)
              </h3>
              <p className="text-xs text-stone-300">
                Masukkan kode voucher yang ditunjukkan peserta di Petshop. Setelah ditukarkan 1 kali, kode otomatis <strong>HANGUS</strong> dan ditolak jika dicoba dipakai lagi.
              </p>
            </div>

            <form onSubmit={handleRedeemVoucher} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Masukkan Kode Voucher (contoh: REMOV-PS-02-ABCD)"
                value={redeemCodeInput}
                onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 rounded-xl bg-stone-800 border border-stone-700 text-white font-mono font-bold text-sm uppercase outline-hidden focus:border-[#fff000]"
              />
              <input
                type="text"
                placeholder="Catatan Petshop (opsional)"
                value={redeemNotesInput}
                onChange={(e) => setRedeemNotesInput(e.target.value)}
                className="sm:w-56 px-4 py-3 rounded-xl bg-stone-800 border border-stone-700 text-white text-xs outline-hidden focus:border-[#fff000]"
              />
              <button
                type="submit"
                className="bg-[#fff000] hover:bg-yellow-300 text-[#141414] font-extrabold px-6 py-3 rounded-xl text-xs sm:text-sm shrink-0"
              >
                Tukar & Hanguskan 1x
              </button>
            </form>

            {redeemFeedback && (
              <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                redeemFeedback.type === 'success'
                  ? 'bg-emerald-900/60 border border-emerald-400 text-emerald-200'
                  : 'bg-rose-900/60 border border-rose-400 text-rose-200'
              }`}>
                {redeemFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                <span>{redeemFeedback.message}</span>
              </div>
            )}
          </div>

          {/* 3. Kandidat Peserta Tidak Hadir yang Sudah Booking Payment */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-heading font-bold text-base text-[#141414]">
              Peserta Terverifikasi Belum Hadir / Tidak Hadir (Penerima Voucher Kompensasi)
            </h3>
            {voucherCandidates.length === 0 ? (
              <p className="text-xs text-stone-400">Semua peserta terverifikasi sudah check-in di booth.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {voucherCandidates.map(reg => (
                  <div key={reg.id} className="p-4 rounded-2xl border border-stone-200 bg-yellow-50/40 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#fff000] border border-[#141414] font-black text-xs px-2 py-0.5 rounded">
                          #{reg.queueNumber || '--'}
                        </span>
                        <strong className="text-sm text-[#141414]">{reg.ownerName}</strong>
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Anabul: {reg.petName} • {reg.vaccineName} • {reg.ownerPhone}
                      </p>
                      {reg.voucherCode && (
                        <span className="text-[11px] font-mono font-bold text-emerald-700 block mt-1">
                          Kode Terbit: {reg.voucherCode}
                        </span>
                      )}
                    </div>

                    {reg.voucherCode ? (
                      <button
                        onClick={() => {
                          const found = adminData.vouchers.find(v => v.code === reg.voucherCode);
                          if (found) setPreviewVoucher(found);
                        }}
                        className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-[#141414] shrink-0"
                      >
                        Lihat Kartu
                      </button>
                    ) : (
                      <button
                        onClick={() => setCustomVoucherModalReg(reg)}
                        className="px-3.5 py-2 bg-[#fff000] hover:bg-yellow-300 border border-[#141414] rounded-xl text-xs font-extrabold text-[#141414] shrink-0"
                      >
                        + Buat Voucher
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Daftar Seluruh Voucher */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-heading font-bold text-base text-[#141414]">
              Riwayat Kode Voucher Terbit ({adminData.vouchers.length})
            </h3>
            {adminData.vouchers.length === 0 ? (
              <p className="text-xs text-stone-400">Belum ada voucher petshop yang diterbitkan.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100 text-stone-800 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Kode Unik</th>
                      <th className="py-2.5 px-3">Penerima</th>
                      <th className="py-2.5 px-3">Benefit</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {adminData.vouchers.map(v => (
                      <tr key={v.id}>
                        <td className="py-2.5 px-3 font-mono font-black text-[#141414]">{v.code}</td>
                        <td className="py-2.5 px-3">
                          <strong>{v.ownerName}</strong> ({v.petName})
                          <span className="block text-[10px] text-stone-400">{v.ownerPhone}</span>
                        </td>
                        <td className="py-2.5 px-3">{v.benefitText}</td>
                        <td className="py-2.5 px-3">
                          {v.status === 'active' ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[11px]">
                              AKTIF (Siap Pakai 1x)
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold text-[11px]">
                              HANGUS (Sudah Dipakai)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <button
                            onClick={() => setPreviewVoucher(v)}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-[#fff000] text-[#141414] rounded-lg font-bold"
                          >
                            Kartu
                          </button>
                          <button
                            onClick={() => handleDeleteVoucher(v.id)}
                            className="p-1 text-stone-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: KELOLA VAKSIN ================= */}
      {activeTab === 'vaccines' && (
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="font-heading font-bold text-lg text-[#141414]">
                Kelola Jenis Vaksin & Aturan Kuota
              </h2>
              <p className="text-xs text-stone-500">
                Tambah, hapus, atau nonaktifkan vaksin sesuai kebutuhan event.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {confirmEmptyAllQuotas ? (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1.5 rounded-xl">
                  <span className="text-[11px] font-bold text-rose-800">Habiskan semua kuota ke 0?</span>
                  <button
                    type="button"
                    disabled={isEmptyingQuotas}
                    onClick={handleEmptyAllQuotas}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg cursor-pointer"
                  >
                    {isEmptyingQuotas ? 'Proses...' : 'Ya, Habiskan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyAllQuotas(false)}
                    className="bg-white border border-stone-300 text-stone-700 text-[11px] font-semibold px-2 py-1 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyAllQuotas(true)}
                  className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer"
                >
                  <span>Kosongkan Semua Kuota (0)</span>
                </button>
              )}
              <button
                onClick={() => {
                  setVaccinePriceMode('number');
                  setEditingVaccine({
                    name: '', code: '', category: 'kucing', totalQuota: 20, price: 100000, priceText: '', minAgeMonths: 2, description: '', active: true
                  });
                  setIsVaccineModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Vaksin Baru</span>
              </button>
            </div>
          </div>

          {vaccineFeedback && (
            <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
              vaccineFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              <span>{vaccineFeedback.message}</span>
              <button
                type="button"
                onClick={() => setVaccineFeedback(null)}
                className="text-current opacity-70 hover:opacity-100 font-bold px-1.5"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminData.vaccines.map((vac) => (
              <div
                key={vac.id}
                className={`p-5 rounded-2xl border-2 space-y-3 ${
                  vac.active !== false ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-100/70 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#141414] bg-[#fff000] border border-[#141414] px-2 py-0.5 rounded-md uppercase">
                        {vac.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleVaccine(vac)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                          vac.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-300 text-stone-700'
                        }`}
                      >
                        {vac.active !== false ? '✓ Tampil di Form' : '✕ Disembunyikan'}
                      </button>
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#141414] mt-1">{vac.name}</h3>
                    <p className="text-xs text-stone-500">
                      Kategori: <strong>{vac.category.toUpperCase()}</strong> • Min. Usia: {vac.minAgeMonths} bulan
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteVaccineId(null);
                        setVaccinePriceMode(vac.priceText?.trim() ? 'text' : 'number');
                        setEditingVaccine(vac);
                        setIsVaccineModalOpen(true);
                      }}
                      title="Edit Vaksin"
                      className="p-2 bg-stone-100 hover:bg-[#fff000] text-stone-700 rounded-xl cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {confirmDeleteVaccineId === vac.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={deletingVaccineId === vac.id}
                          onClick={() => handleDeleteVaccine(vac)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{deletingVaccineId === vac.id ? 'Menghapus...' : 'Hapus'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteVaccineId(null)}
                          className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-[11px] font-semibold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteVaccineId(vac.id)}
                        title="Hapus Vaksin"
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Total Kuota</span>
                    <strong className="text-[#141414] font-mono text-base">{vac.totalQuota}</strong>
                  </div>
                  <div
                    onClick={() => {
                      if (editingPriceVacId !== vac.id) {
                        setEditingPriceVacId(vac.id);
                        setInlinePriceValue(vac.priceText?.trim() ? vac.priceText.trim() : String(vac.price ?? 0));
                      }
                    }}
                    title="Klik untuk ubah harga (angka atau keterangan tulisan)"
                    className={`rounded-lg px-1.5 py-0.5 transition-colors ${
                      editingPriceVacId === vac.id
                        ? 'bg-white ring-2 ring-[#141414]'
                        : 'cursor-pointer hover:bg-[#fff000]/40'
                    }`}
                  >
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">
                      Harga <span className="text-[9px] text-stone-500 font-normal">✎</span>
                    </span>
                    {editingPriceVacId === vac.id ? (
                      <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={inlinePriceValue}
                          onChange={(e) => setInlinePriceValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveInlinePrice(vac);
                            } else if (e.key === 'Escape') {
                              setEditingPriceVacId(null);
                            }
                          }}
                          placeholder="Angka / tulisan..."
                          className="w-full px-1.5 py-1 text-[11px] font-semibold text-[#141414] bg-white border border-stone-300 rounded-md outline-hidden focus:border-[#141414]"
                        />
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={savingInlinePriceId === vac.id}
                            onClick={() => handleSaveInlinePrice(vac)}
                            className="px-2 py-0.5 bg-[#141414] text-[#fff000] rounded text-[10px] font-bold cursor-pointer"
                          >
                            {savingInlinePriceId === vac.id ? '...' : 'Simpan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriceVacId(null)}
                            className="px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <strong className={`text-[#141414] block leading-tight mt-0.5 break-words ${vac.priceText?.trim() ? 'text-xs font-extrabold' : 'font-mono text-sm'}`}>
                        {vac.priceText?.trim()
                          ? vac.priceText.trim()
                          : vac.price === 0
                          ? 'GRATIS'
                          : `Rp ${vac.price.toLocaleString('id-ID')}`}
                      </strong>
                    )}
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Sisa Kuota</span>
                    <strong className={`font-mono text-base ${(vac.availableQuota ?? vac.totalQuota) <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {(vac.availableQuota ?? vac.totalQuota) <= 0 ? '0 (HABIS)' : (vac.availableQuota ?? vac.totalQuota)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <span className="text-xs text-stone-500">Edit Cepat Kuota:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSetQuotaZero(vac)}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      Habiskan (0)
                    </button>
                    <button type="button" onClick={() => handleAdjustQuota(vac, -1)} className="w-7 h-7 bg-stone-100 hover:bg-stone-200 rounded-lg font-bold text-sm cursor-pointer">-1</button>
                    <button type="button" onClick={() => handleAdjustQuota(vac, 1)} className="w-7 h-7 bg-stone-100 hover:bg-stone-200 rounded-lg font-bold text-sm cursor-pointer">+1</button>
                    <button type="button" onClick={() => handleAdjustQuota(vac, 10)} className="px-2 py-1 bg-[#fff000] border border-[#141414] rounded-lg font-bold text-xs cursor-pointer">+10</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 5: PEMBAYARAN ONSITE & REFERENSI KASIR ================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-yellow-50/90 border-2 border-[#141414] rounded-3xl p-5 flex items-start gap-3 text-xs sm:text-sm text-[#141414]">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-heading font-extrabold text-sm sm:text-base">
                Ketentuan Pembayaran &amp; Pembelian Produk Secara Onsite Aktif
              </strong>
              <p className="text-stone-700 mt-1">
                Formulir pendaftaran publik tidak lagi meminta upload bukti payment. Seluruh peserta otomatis memperoleh nomor antrian dan menyelesaikan pembelian produk/pembayaran langsung secara <strong>onsite di booth acara</strong>. Daftar rekening di bawah hanya bersifat referensi internal kasir booth panitia.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#141414]">
                  Referensi Rekening / QRIS Kasir Booth (Onsite)
                </h2>
                <p className="text-xs text-stone-500">
                  Digunakan panitia/kasir saat customer bertransaksi langsung secara onsite di lokasi acara.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingBankAccount({ bankName: '', accountNumber: '', accountHolder: 'PT REMOV PET CARE INDONESIA', notes: '', active: true });
                  setIsBankModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] text-xs font-extrabold px-4 py-2.5 rounded-xl shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Referensi Kasir</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {adminData.event.bankAccounts.map((acc) => (
                <div key={acc.id} className={`p-4 rounded-2xl border-2 space-y-2 ${acc.active !== false ? 'border-[#141414]/25 bg-yellow-50/40' : 'border-stone-200 bg-stone-100 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase text-[#141414]">{acc.bankName}</span>
                    <button onClick={() => handleToggleBankAccount(acc)} className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${acc.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>
                      {acc.active !== false ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <span className="font-mono font-black text-sm text-[#141414] block">{acc.accountNumber}</span>
                    <span className="text-xs text-stone-600">a.n. <strong>{acc.accountHolder}</strong></span>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => { setEditingBankAccount(acc); setIsBankModalOpen(true); }}
                      className="text-xs font-bold bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg"
                    >
                      Edit
                    </button>
                    <button onClick={() => handleDeleteBankAccount(acc)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#141414]">Daftar Estimasi Transaksi Onsite Peserta</h2>
                <p className="text-xs text-stone-500">Pantau layanan &amp; estimasi nilai transaksi peserta yang akan diselesaikan langsung di lokasi booth.</p>
              </div>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="verified">Booking Terkonfirmasi (Onsite)</option>
                <option value="rejected">Ditolak / Dibatalkan</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentProofRegistrations.map((reg) => {
                const checkInfo = CHECKIN_LABELS[(reg.checkInStatus || 'belum_hadir') as CheckInStatus];
                return (
                  <div key={reg.id} className="p-4 rounded-2xl border border-stone-200 space-y-2.5 bg-stone-50/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold bg-[#fff000] px-2 py-0.5 rounded border border-[#141414]">
                        #{reg.queueNumber || '--'} • {reg.regNumber}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${checkInfo.cls}`}>
                        {checkInfo.label}
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      <strong className="block text-[#141414] text-sm">{reg.ownerName} ({reg.petName})</strong>
                      <span className="text-stone-600 block">{reg.vaccineName}</span>
                      <span className="text-stone-500 block">{reg.selectedSession}</span>
                    </div>
                    <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-semibold">Transaksi Onsite</span>
                      <strong className="font-heading font-black text-[#141414] tabular-nums">
                        {reg.vaccinePriceText?.trim()
                          ? reg.vaccinePriceText.trim()
                          : reg.totalAmount === 0
                          ? 'Rp 0'
                          : `Rp ${reg.totalAmount.toLocaleString('id-ID')}`}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 6: ARSIP EVENT & PORTOFOLIO KERJASAMA PARTNER ================= */}
      {activeTab === 'archives' && (
        <div className="space-y-6">
          {/* Action Banner: Selesaikan Event & Reset Queue 01 */}
          <div className="bg-[#141414] text-white rounded-3xl p-6 border-2 border-[#fff000] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#fff000]" />
                <h2 className="font-heading font-extrabold text-lg text-[#fff000]">
                  Arsip Event & Portofolio Kerjasama Pawrenting REMOV
                </h2>
              </div>
              <p className="text-xs text-stone-300 max-w-2xl">
                Setelah acara selesai, arsipkan seluruh data pendaftar, lokasi, tanggal/bulan/tahun, partner petshop/instansi, serta dokumentasi foto acara ke Portofolio REMOV, lalu reset nomor antrian kembali ke <strong>01</strong> untuk event selanjutnya.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {adminData.event.eventStatus !== 'completed' && (
                <button
                  type="button"
                  onClick={openCompleteEventModal}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Nyatakan Event Selesai (Simpan Sesuai Jadwal)</span>
                </button>
              )}
              <button
                onClick={() => setIsManualArchiveModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-stone-600 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Portofolio Manual</span>
              </button>
              <button
                onClick={() => setIsArchiveResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Arsipkan Event Ini & Reset Antrian ke 01</span>
              </button>
            </div>
          </div>

          {archiveFeedback && (
            <div className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
              archiveFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span>{archiveFeedback.message}</span>
              <button
                type="button"
                onClick={() => setArchiveFeedback(null)}
                className="text-current opacity-70 hover:opacity-100 px-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Portfolio Cards Grid */}
          {adminData.archives.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-stone-300 p-10 text-center space-y-2">
              <Archive className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="text-sm font-bold text-[#141414]">Belum ada arsip event tersimpan</p>
              <p className="text-xs text-stone-500">
                Gunakan tombol <strong>Tambah Portofolio Manual</strong> atau <strong>Arsipkan Event Ini</strong> untuk menyimpan riwayat acara.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adminData.archives.map((arc) => (
              <div key={arc.id} className="bg-white rounded-3xl border-2 border-stone-200 shadow-xs overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-[#fff000] px-5 py-3.5 border-b border-[#141414]/15 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#141414] text-[#fff000] px-2 py-0.5 rounded">
                        {arc.month} {arc.year}
                      </span>
                      <h3 className="font-heading font-black text-lg text-[#141414] mt-1 truncate">{arc.eventTitle}</h3>
                    </div>
                    {confirmDeleteArchiveId === arc.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={deletingArchiveId === arc.id}
                          onClick={() => handleDeleteArchive(arc.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                          title="Konfirmasi Hapus Arsip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{deletingArchiveId === arc.id ? 'Menghapus...' : 'Ya, Hapus'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingArchiveId === arc.id}
                          onClick={() => setConfirmDeleteArchiveId(null)}
                          className="px-2 py-1.5 rounded-lg bg-white/90 hover:bg-white text-[#141414] text-[11px] font-bold border border-[#141414]/20 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteArchiveId(arc.id)}
                        className="p-2 text-[#141414] hover:text-rose-700 hover:bg-rose-100/80 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title="Hapus Arsip"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Partner / Kolaborator</span>
                          <strong className="text-[#141414]">{arc.partnerName || 'REMOV Internal'}</strong>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Jadwal Event</span>
                          <strong className="text-[#141414]">{arc.eventDate}</strong>
                          {arc.timeRange && <span className="block text-stone-500">{arc.timeRange}</span>}
                        </div>
                      </div>
                      <div className="col-span-2 flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-stone-400 block text-[10px] uppercase font-bold">Lokasi</span>
                          <strong className="text-[#141414]">{arc.locationName} {arc.city ? `(${arc.city})` : ''}</strong>
                          {arc.locationAddress && <span className="block text-stone-500">{arc.locationAddress}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-center">
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Total Pendaftar</span>
                        <strong className="font-heading font-black text-xl text-[#141414]">{arc.totalRegistrations} Ekor</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Hadir & Terlayani</span>
                        <strong className="font-heading font-black text-xl text-emerald-700">{arc.totalAttended} Ekor</strong>
                      </div>
                    </div>

                    {/* Programs Run */}
                    {arc.programsRun && arc.programsRun.length > 0 && (
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1.5">Program yang Dijalankan:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {arc.programsRun.map((prog, idx) => (
                            <span key={idx} className="bg-yellow-100 text-[#141414] border border-stone-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                              {prog}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {arc.completionStatement && (
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-950 space-y-1">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                          Pernyataan Selesai ({arc.completedBy || 'Tim Admin REMOV'})
                        </span>
                        <p className="leading-relaxed">{arc.completionStatement}</p>
                      </div>
                    )}

                    {arc.summaryNotes && (
                      <p className="text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100 leading-relaxed">
                        {arc.summaryNotes}
                      </p>
                    )}

                    {/* Documentation Photos */}
                    {arc.documentationPhotos && arc.documentationPhotos.length > 0 && (
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1.5">Dokumentasi Acara:</span>
                        <div className="grid grid-cols-3 gap-2">
                          {arc.documentationPhotos.map((photoUrl, i) => (
                            <img
                              key={i}
                              src={photoUrl}
                              alt={`Dokumentasi ${i + 1}`}
                              onClick={() => setPreviewPhotoUrl(photoUrl)}
                              className="h-20 w-full object-cover rounded-xl border border-stone-200 cursor-pointer hover:opacity-90"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
                  <span className="text-[11px] text-stone-500">
                    Data peserta tersimpan: <strong>{arc.registrations?.length || 0}</strong> record
                  </span>
                  <button
                    onClick={() => setViewingArchive(arc)}
                    className="inline-flex items-center gap-1.5 bg-[#141414] text-[#fff000] text-xs font-bold px-3.5 py-1.5 rounded-xl"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Peserta Arsip</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* ================= TAB 7: PENGATURAN EVENT, LOGO, BACKGROUND FOLDER & CHECKLIST ================= */}
      {activeTab === 'event' && eventForm && (
        <form onSubmit={handleSaveEvent} className="space-y-6">
          {/* Save Top Bar */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-heading font-bold text-lg text-[#141414]">
                Pengaturan Tampilan, Logo Kerjasama, Background Folder & Syarat Vaksin
              </h2>
              <p className="text-xs text-stone-500">
                Ubah logo REMOV & partner, background formulir dari folder, checklist kesehatan, kalimat sukses booking, link WA & kloter jam kapan saja.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {eventSaveSuccess && (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Tersimpan!
                </span>
              )}
              <button
                type="submit"
                disabled={isSavingEvent}
                className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-5 py-2.5 rounded-2xl text-xs sm:text-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingEvent ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
              </button>
            </div>
          </div>

          {/* 0. Pengaturan Judul Utama, Jadwal & Lokasi Event (Hero Form) */}
          <div className="bg-white rounded-3xl p-6 border-2 border-[#141414] shadow-xs space-y-5 text-xs sm:text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#141414] flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>Identitas Event, Judul Hero, Jadwal & Lokasi Acara</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Atur judul acara, tagline, jadwal tanggal/jam, serta lokasi venue yang tampil langsung di bagian atas formulir pendaftaran.
                </p>
              </div>
              <span className="bg-[#fff000] text-[#141414] border border-[#141414] text-[10px] font-black uppercase px-2.5 py-1 rounded-full self-start">
                Tampil di Header Formulir
              </span>
            </div>

            {/* Live Preview Kartu Hero */}
            <div className="bg-linear-to-br from-[#fff000] via-[#fde047] to-[#facc15] rounded-2xl p-4 border-2 border-[#141414] space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#141414]/70">
                  Pratinjau Tampilan Header Formulir:
                </span>
                {eventForm.heroBadgeText !== '' && (
                  <span className="bg-[#141414] text-[#fff000] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    {eventForm.heroBadgeText || 'Pendaftaran Resmi Pawrenting REMOV'}
                  </span>
                )}
              </div>
              <div>
                <div className="font-heading font-black text-xl sm:text-2xl text-[#141414] leading-tight">
                  {eventForm.title || 'Judul Event'}
                  {eventForm.partnerName && (
                    <span className="ml-2 text-base sm:text-lg font-bold text-stone-800">× {eventForm.partnerName}</span>
                  )}
                </div>
                {eventForm.tagline && (
                  <p className="text-xs text-stone-800 font-medium mt-1">{eventForm.tagline}</p>
                )}
              </div>
              {(eventForm.showDateCard !== false || eventForm.showLocationCard !== false) && (
                <div className={`grid grid-cols-1 ${eventForm.showDateCard !== false && eventForm.showLocationCard !== false ? 'sm:grid-cols-2' : ''} gap-2.5 text-xs`}>
                  {eventForm.showDateCard !== false && (
                    <div className="flex items-start gap-2 bg-white/85 p-3 rounded-xl border border-[#141414]/20">
                      <Clock className="w-4 h-4 text-[#141414] shrink-0 mt-0.5" />
                      <div>
                        {eventForm.dateCardLabel && (
                          <span className="block text-[9px] font-extrabold uppercase tracking-wider text-stone-500">
                            {eventForm.dateCardLabel}
                          </span>
                        )}
                        <strong className="block text-[#141414]">{eventForm.date || '-'}</strong>
                        {eventForm.timeRange && <span className="block text-[11px] text-stone-700">{eventForm.timeRange}</span>}
                        {eventForm.dateNote && <span className="block text-[10px] text-stone-600 mt-0.5">{eventForm.dateNote}</span>}
                      </div>
                    </div>
                  )}
                  {eventForm.showLocationCard !== false && (
                    <div className="flex items-start gap-2 bg-white/85 p-3 rounded-xl border border-[#141414]/20">
                      <MapPin className="w-4 h-4 text-[#141414] shrink-0 mt-0.5" />
                      <div>
                        {eventForm.locationCardLabel && (
                          <span className="block text-[9px] font-extrabold uppercase tracking-wider text-stone-500">
                            {eventForm.locationCardLabel}
                          </span>
                        )}
                        <strong className="block text-[#141414]">{eventForm.locationName || '-'}</strong>
                        {eventForm.locationAddress && <span className="block text-[11px] text-stone-700">{eventForm.locationAddress}</span>}
                        {eventForm.locationMapsUrl && (
                          <span className="inline-block text-[10px] font-bold underline text-[#141414] mt-0.5">
                            Buka Google Maps ↗
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Judul, Partner, Badge & Tagline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Judul Utama Event (Hero Title)</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="Contoh: PAWRENTING REMOV 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-bold text-[#141414]"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Nama Partner Kolaborasi (Opsional, tampil × Partner)</label>
                <input
                  type="text"
                  value={eventForm.partnerName || ''}
                  onChange={(e) => setEventForm({ ...eventForm, partnerName: e.target.value })}
                  placeholder="Kosongkan jika acara internal REMOV"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Badge Atas Judul</label>
                <input
                  type="text"
                  value={eventForm.heroBadgeText ?? 'Pendaftaran Resmi Pawrenting REMOV'}
                  onChange={(e) => setEventForm({ ...eventForm, heroBadgeText: e.target.value })}
                  placeholder="Contoh: Pendaftaran Resmi Pawrenting REMOV"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 uppercase block mb-1">Sub-Judul Top Banner</label>
                <input
                  type="text"
                  value={eventForm.subtitle}
                  onChange={(e) => setEventForm({ ...eventForm, subtitle: e.target.value })}
                  placeholder="Contoh: Vaksinasi Massal & Edukasi Kesehatan Anabul"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                />
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-stone-700 uppercase block mb-1">Tagline / Deskripsi Singkat di Bawah Judul</label>
                <input
                  type="text"
                  value={eventForm.tagline || ''}
                  onChange={(e) => setEventForm({ ...eventForm, tagline: e.target.value })}
                  placeholder="Contoh: Wujudkan Anabul Sehat, Bahagia, & Bebas Penyakit Bersama REMOV Pet Care"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                />
              </div>
            </div>

            {/* Kartu Tanggal & Jam + Kartu Lokasi Venue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-stone-100">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#141414] flex items-center gap-1.5 uppercase">
                    <Clock className="w-4 h-4" />
                    <span>Kotak Jadwal (Tanggal & Jam)</span>
                  </span>
                  <label className="inline-flex items-center gap-1.5 font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventForm.showDateCard !== false}
                      onChange={(e) => setEventForm({ ...eventForm, showDateCard: e.target.checked })}
                      className="accent-[#141414]"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Label Kotak (Opsional)</label>
                  <input
                    type="text"
                    value={eventForm.dateCardLabel ?? ''}
                    onChange={(e) => setEventForm({ ...eventForm, dateCardLabel: e.target.value })}
                    placeholder="Contoh: Jadwal Pelaksanaan"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Tanggal Event</label>
                  <input
                    type="text"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    placeholder="Contoh: Minggu, 24 Mei 2026"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Jam Pelaksanaan</label>
                  <input
                    type="text"
                    value={eventForm.timeRange}
                    onChange={(e) => setEventForm({ ...eventForm, timeRange: e.target.value })}
                    placeholder="Contoh: 08:30 - 16:00 WIB"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Catatan Waktu Tambahan (Opsional)</label>
                  <input
                    type="text"
                    value={eventForm.dateNote || ''}
                    onChange={(e) => setEventForm({ ...eventForm, dateNote: e.target.value })}
                    placeholder="Contoh: Registrasi ulang dibuka 30 menit sebelum kloter"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#141414] flex items-center gap-1.5 uppercase">
                    <MapPin className="w-4 h-4" />
                    <span>Kotak Lokasi Venue</span>
                  </span>
                  <label className="inline-flex items-center gap-1.5 font-bold text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventForm.showLocationCard !== false}
                      onChange={(e) => setEventForm({ ...eventForm, showLocationCard: e.target.checked })}
                      className="accent-[#141414]"
                    />
                    <span>Tampilkan</span>
                  </label>
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Label Kotak (Opsional)</label>
                  <input
                    type="text"
                    value={eventForm.locationCardLabel ?? ''}
                    onChange={(e) => setEventForm({ ...eventForm, locationCardLabel: e.target.value })}
                    placeholder="Contoh: Lokasi Event"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Nama Venue / Tempat Acara</label>
                  <input
                    type="text"
                    value={eventForm.locationName}
                    onChange={(e) => setEventForm({ ...eventForm, locationName: e.target.value })}
                    placeholder="Contoh: REMOV Care Center & Vet Clinic"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Alamat Lengkap Venue</label>
                  <input
                    type="text"
                    value={eventForm.locationAddress}
                    onChange={(e) => setEventForm({ ...eventForm, locationAddress: e.target.value })}
                    placeholder="Contoh: Jl. Boulevard Raya No. 88, Jakarta Selatan"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-600 block mb-1">Link Google Maps Lokasi (Opsional)</label>
                  <input
                    type="url"
                    value={eventForm.locationMapsUrl || ''}
                    onChange={(e) => setEventForm({ ...eventForm, locationMapsUrl: e.target.value })}
                    placeholder="https://maps.google.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 1. Custom Logo REMOV & Partner Image */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-heading font-bold text-base text-[#141414] flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              <span>Logo REMOV & Logo Partner Kolaborasi (Image)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-4 rounded-2xl bg-yellow-50/70 border border-stone-200 space-y-3">
                <label className="font-bold uppercase text-[#141414] block">Logo Utama REMOV</label>
                <div className="flex items-center gap-4">
                  <img
                    src={eventForm.removLogoUrl || '/logos/remov-logo.svg'}
                    alt="Logo REMOV"
                    className="h-14 w-auto max-w-[140px] object-contain bg-[#fff000] p-1.5 rounded-xl border border-[#141414]"
                  />
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 border border-stone-300 font-bold px-3 py-2 rounded-xl cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo REMOV Baru</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadAssetToFolder('logos', f, (url) => savePartialEventConfig({ removLogoUrl: url }));
                        }}
                      />
                    </label>
                    {logoAssets.length > 0 && (
                      <select
                        value={eventForm.removLogoUrl}
                        onChange={(e) => savePartialEventConfig({ removLogoUrl: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                      >
                        {logoAssets.map(l => <option key={l.url} value={l.url}>{l.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <label className="font-bold uppercase text-[#141414] block">Logo & Nama Partner Kolaborasi (Opsional)</label>
                <input
                  type="text"
                  placeholder="Nama Partner (contoh: Petshop Harmoni / Dinas Ketahanan Pangan)"
                  value={eventForm.partnerName || ''}
                  onChange={(e) => setEventForm({ ...eventForm, partnerName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                />
                <div className="flex items-center gap-3">
                  {eventForm.partnerLogoUrl ? (
                    <img
                      src={eventForm.partnerLogoUrl}
                      alt="Logo Partner"
                      className="h-12 w-auto max-w-[120px] object-contain bg-white p-1 rounded-xl border border-stone-300"
                    />
                  ) : (
                    <div className="h-12 w-20 rounded-xl border border-dashed border-stone-300 flex items-center justify-center text-[10px] text-stone-400">
                      Tanpa Logo
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 border border-stone-300 font-bold px-3 py-2 rounded-xl cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Partner</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadAssetToFolder('logos', f, (url) => savePartialEventConfig({ partnerLogoUrl: url }));
                      }}
                    />
                  </label>
                  {eventForm.partnerLogoUrl && (
                    <button
                      type="button"
                      onClick={() => savePartialEventConfig({ partnerLogoUrl: '' })}
                      className="text-xs text-rose-600 font-bold hover:underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Background Folder Selector (/public/backgrounds/) */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#141414] flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  <span>Background Formulir Pendaftaran (Folder /public/backgrounds/)</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Pilih gambar latar dari folder backgrounds atau unggah gambar baru kapan saja (otomatis tersimpan ke form).
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] font-extrabold text-xs px-3.5 py-2 rounded-xl cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Background Baru ke Folder</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAssetToFolder('backgrounds', f, (url) => savePartialEventConfig({ backgroundImageUrl: url }));
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                onClick={() => savePartialEventConfig({ backgroundImageUrl: '' })}
                className={`rounded-2xl overflow-hidden border-2 cursor-pointer transition-all flex flex-col ${
                  eventForm.backgroundImageUrl === '' ? 'border-[#141414] ring-3 ring-[#fff000]' : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                <div className="h-24 w-full bg-[#fefdf5] flex items-center justify-center text-xs font-bold text-stone-400 border-b border-stone-200">
                  Polos Bersih
                </div>
                <div className="p-2 bg-stone-50 flex items-center justify-between text-[11px]">
                  <span className="truncate font-semibold text-stone-700">Tanpa Gambar</span>
                  {eventForm.backgroundImageUrl === '' && <Check className="w-3.5 h-3.5 text-[#141414] shrink-0" />}
                </div>
              </div>
              {backgroundAssets.map((bg) => {
                const isSelected = eventForm.backgroundImageUrl === bg.url;
                return (
                  <div
                    key={bg.url}
                    onClick={() => savePartialEventConfig({ backgroundImageUrl: bg.url })}
                    className={`rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${
                      isSelected ? 'border-[#141414] ring-3 ring-[#fff000]' : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <img src={bg.url} alt={bg.name} className="h-24 w-full object-cover" />
                    <div className="p-2 bg-stone-50 flex items-center justify-between text-[11px]">
                      <span className="truncate font-semibold text-stone-700">{bg.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#141414] shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
              <label className="font-bold text-stone-700 shrink-0">
                Transparansi Lapisan Kontras (Scrim): {eventForm.backgroundOverlayOpacity ?? 78}%
              </label>
              <input
                type="range"
                min={20}
                max={95}
                value={eventForm.backgroundOverlayOpacity ?? 78}
                onChange={(e) => setEventForm({ ...eventForm, backgroundOverlayOpacity: Number(e.target.value) })}
                className="flex-1 accent-[#141414]"
              />
            </div>
          </div>

          {/* 3. Editable Health Checklist Terms */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-heading font-bold text-base text-[#141414]">
              Syarat & Ketentuan Vaksin Anabul (Checklist yang Dicek Peserta)
            </h3>
            <div className="space-y-2">
              {(eventForm.healthChecklistItems || []).map((item: HealthChecklistItem, idx: number) => (
                <div key={item.id} className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs">
                  <span className="font-mono font-bold text-stone-400 w-5">{idx + 1}.</span>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => {
                      const next = [...eventForm.healthChecklistItems];
                      next[idx] = { ...item, text: e.target.value };
                      setEventForm({ ...eventForm, healthChecklistItems: next });
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                  />
                  <label className="flex items-center gap-1 font-semibold text-stone-700 shrink-0">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => {
                        const next = [...eventForm.healthChecklistItems];
                        next[idx] = { ...item, required: e.target.checked };
                        setEventForm({ ...eventForm, healthChecklistItems: next });
                      }}
                    />
                    <span>Wajib</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = eventForm.healthChecklistItems.filter((_, i) => i !== idx);
                      setEventForm({ ...eventForm, healthChecklistItems: next });
                    }}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tambah poin syarat ketentuan vaksin anabul baru..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newChecklistText.trim()) return;
                  const next = [
                    ...(eventForm.healthChecklistItems || []),
                    { id: 'chk_' + Date.now(), text: newChecklistText.trim(), required: true }
                  ];
                  setEventForm({ ...eventForm, healthChecklistItems: next });
                  setNewChecklistText('');
                }}
                className="bg-[#fff000] border border-[#141414] text-[#141414] font-bold text-xs px-4 py-2 rounded-xl"
              >
                + Tambah Syarat
              </button>
            </div>
          </div>

          {/* 4. Editable Queue Ticket Footer Copy */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-4 text-xs">
            <h3 className="font-heading font-bold text-base text-[#141414]">
              Teks Nomor Antrian (Sukses Booking)
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">Label Status Sukses Booking</label>
                <input
                  type="text"
                  value={eventForm.bookingSuccessLabel || ''}
                  onChange={(e) => setEventForm({ ...eventForm, bookingSuccessLabel: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">
                  Deskripsi di Bawah Nomor Antrian (Dapat Diubah Kapan Saja)
                </label>
                <textarea
                  rows={2}
                  value={eventForm.ticketArrivalNote || ''}
                  onChange={(e) => setEventForm({ ...eventForm, ticketArrivalNote: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
            </div>
          </div>

          {/* 5. WhatsApp Group & Event Details + Sessions + PIN */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-5 text-xs sm:text-sm">
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 space-y-3">
              <label className="font-bold text-emerald-950 block">Link Group WhatsApp Resmi</label>
              <input
                type="url"
                value={eventForm.whatsappGroupLink || ''}
                onChange={(e) => setEventForm({ ...eventForm, whatsappGroupLink: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-white font-mono text-xs"
              />
              <textarea
                rows={2}
                value={eventForm.whatsappGroupPrompt || ''}
                onChange={(e) => setEventForm({ ...eventForm, whatsappGroupPrompt: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 bg-white text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-stone-700 text-xs uppercase block mb-1">WhatsApp Panitia</label>
                <input type="text" value={eventForm.contactWhatsApp} onChange={(e) => setEventForm({ ...eventForm, contactWhatsApp: e.target.value })} className="w-full px-3.5 py-2 rounded-xl border border-stone-300" />
              </div>
              <div>
                <label className="font-bold text-stone-700 text-xs uppercase block mb-1">Custom Shortlink Share</label>
                <input type="url" value={eventForm.customShareUrl || ''} onChange={(e) => setEventForm({ ...eventForm, customShareUrl: e.target.value })} className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono text-xs" />
              </div>
            </div>

            {/* Editable Kloter Jam */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <label className="font-bold text-stone-700 text-xs uppercase block">Daftar Kloter Jam Pemeriksaan</label>
              <div className="space-y-2">
                {eventForm.sessions.map((sess, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sess}
                      onChange={(e) => {
                        const next = [...eventForm.sessions];
                        next[i] = e.target.value;
                        setEventForm({ ...eventForm, sessions: next });
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setEventForm({ ...eventForm, sessions: eventForm.sessions.filter((_, idx) => idx !== i) })}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambah kloter baru (misal: Pukul 16.00 - 17.30 WIB (Kloter 4))"
                  value={newSessionText}
                  onChange={(e) => setNewSessionText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newSessionText.trim()) return;
                    setEventForm({ ...eventForm, sessions: [...eventForm.sessions, newSessionText.trim()] });
                    setNewSessionText('');
                  }}
                  className="bg-stone-900 text-[#fff000] text-xs font-bold px-4 py-2 rounded-xl"
                >
                  + Kloter
                </button>
              </div>
            </div>

            {/* Admin PIN */}
            <div className="bg-[#141414] text-white p-4 rounded-2xl space-y-2">
              <label className="text-xs font-bold uppercase text-[#fff000] block">PIN Akses Panitia</label>
              <div className="relative max-w-xs">
                <input
                  type={showAdminPin ? 'text' : 'password'}
                  value={eventForm.adminPin || 'remov2026'}
                  onChange={(e) => setEventForm({ ...eventForm, adminPin: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-800 border border-stone-700 text-white font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPin(!showAdminPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
                >
                  {showAdminPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-stone-600">
              Setiap perubahan yang disimpan otomatis berlaku di formulir pendaftaran & QR Code publik.
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {eventSaveSuccess && (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Tersimpan!
                </span>
              )}
              <button
                type="submit"
                disabled={isSavingEvent}
                className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border-2 border-[#141414] font-extrabold px-5 py-2.5 rounded-2xl text-xs sm:text-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingEvent ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ================= TAB 8: GOOGLE SHEETS & FORMAT PENGELOMPOKAN TABEL PER VAKSIN ================= */}
      {activeTab === 'sheets' && eventForm && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-5">
            <div className="border-b border-stone-100 pb-4">
              <h2 className="font-heading font-bold text-lg text-[#141414] flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <span>Format Tabel Kelompok per Vaksin (1 Sheet) & Koneksi Spreadsheet</span>
              </h2>
              <p className="text-xs text-stone-500">
                Atur pengelompokan tabel berdasarkan jenis vaksin dalam satu sheet serta kolom mana saja yang diekspor ke Excel / Google Sheets.
              </p>
            </div>

            {sheetFeedback && (
              <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                sheetFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <span>{sheetFeedback.message}</span>
              </div>
            )}

            {/* Dynamic Grouping Format Controls */}
            <div className="bg-yellow-50/80 border-2 border-[#141414] rounded-2xl p-5 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 font-extrabold text-sm text-[#141414] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.spreadsheetConfig?.groupByVaccine !== false}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      spreadsheetConfig: {
                        ...eventForm.spreadsheetConfig,
                        groupByVaccine: e.target.checked
                      }
                    })}
                    className="w-4 h-4 accent-[#141414]"
                  />
                  <span>Kelompokkan Tabel Terpisah per Jenis Vaksin dalam 1 Sheet</span>
                </label>

                <button
                  type="button"
                  onClick={() => exportGroupedSpreadsheetXLS(adminData.registrations, adminData.vaccines, { ...adminData.event, spreadsheetConfig: eventForm.spreadsheetConfig })}
                  className="bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] font-extrabold px-4 py-2 rounded-xl"
                >
                  Pratinjau & Unduh Excel Kelompok Vaksin (.xls)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Awalan Judul Setiap Tabel Vaksin</label>
                  <input
                    type="text"
                    value={eventForm.spreadsheetConfig?.tableHeaderPrefix || 'TABEL KELOMPOK VAKSIN'}
                    onChange={(e) => setEventForm({
                      ...eventForm,
                      spreadsheetConfig: { ...eventForm.spreadsheetConfig, tableHeaderPrefix: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Warna Header Tabel (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={eventForm.spreadsheetConfig?.headerColorHex || '#FFF000'}
                      onChange={(e) => setEventForm({
                        ...eventForm,
                        spreadsheetConfig: { ...eventForm.spreadsheetConfig, headerColorHex: e.target.value }
                      })}
                      className="h-9 w-12 rounded-lg border border-stone-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={eventForm.spreadsheetConfig?.headerColorHex || '#FFF000'}
                      onChange={(e) => setEventForm({
                        ...eventForm,
                        spreadsheetConfig: { ...eventForm.spreadsheetConfig, headerColorHex: e.target.value }
                      })}
                      className="flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Column toggles, ordering & custom labels */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-stone-700">
                    Kolom CSV & Spreadsheet ({(eventForm.spreadsheetConfig?.columns || []).filter(c => c.enabled !== false).length} Aktif • Sinkron Database Peserta):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const synced = syncColumnsToCanonicalDatabaseOrder(eventForm.spreadsheetConfig?.columns);
                      setEventForm({
                        ...eventForm,
                        spreadsheetConfig: { ...eventForm.spreadsheetConfig, columns: synced },
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-[11px] font-bold text-[#141414] cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Urutkan Sesuai Database</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(eventForm.spreadsheetConfig?.columns || []).map((col, idx, arr) => (
                    <div key={col.key} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border border-stone-200">
                      <div className="flex items-center justify-between gap-1">
                        <label className="inline-flex items-center gap-1.5 text-[10px] font-mono text-stone-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={col.enabled}
                            onChange={(e) => {
                              const cols = [...eventForm.spreadsheetConfig.columns];
                              cols[idx] = { ...col, enabled: e.target.checked };
                              setEventForm({
                                ...eventForm,
                                spreadsheetConfig: { ...eventForm.spreadsheetConfig, columns: cols }
                              });
                            }}
                          />
                          <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">{col.key}</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              if (idx === 0) return;
                              const cols = [...eventForm.spreadsheetConfig.columns];
                              [cols[idx - 1], cols[idx]] = [cols[idx], cols[idx - 1]];
                              setEventForm({
                                ...eventForm,
                                spreadsheetConfig: { ...eventForm.spreadsheetConfig, columns: cols }
                              });
                            }}
                            title="Geser ke atas / kiri"
                            className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-[10px] font-bold"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === arr.length - 1}
                            onClick={() => {
                              if (idx === arr.length - 1) return;
                              const cols = [...eventForm.spreadsheetConfig.columns];
                              [cols[idx], cols[idx + 1]] = [cols[idx + 1], cols[idx]];
                              setEventForm({
                                ...eventForm,
                                spreadsheetConfig: { ...eventForm.spreadsheetConfig, columns: cols }
                              });
                            }}
                            title="Geser ke bawah / kanan"
                            className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-[10px] font-bold"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => {
                          const cols = [...eventForm.spreadsheetConfig.columns];
                          cols[idx] = { ...col, label: e.target.value };
                          setEventForm({
                            ...eventForm,
                            spreadsheetConfig: { ...eventForm.spreadsheetConfig, columns: cols }
                          });
                        }}
                        className="w-full text-xs px-2 py-1 rounded border border-stone-200 font-semibold text-[#141414]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Webhook Input & Sync Controls */}
            <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 uppercase mb-2">
                  Google Apps Script Webhook URL (Web App URL)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  value={sheetWebhookUrl}
                  onChange={(e) => setSheetWebhookUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 text-xs sm:text-sm font-mono bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-800">
                  <input type="checkbox" checked={sheetAutoSync} onChange={(e) => setSheetAutoSync(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                  <span>Auto Push Otomatis (Pendaftaran Baru, Check-In Barcode & Reschedule)</span>
                </label>

                <button
                  type="button"
                  onClick={handleSaveSheetConfig}
                  className="bg-[#141414] hover:bg-black text-[#fff000] font-bold text-xs px-5 py-2.5 rounded-xl"
                >
                  Simpan Format Tabel & URL Webhook
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isTestingSheet || !sheetWebhookUrl}
                  onClick={handleTestSheetConnection}
                  className="inline-flex items-center gap-2 bg-[#fff000] hover:bg-yellow-300 disabled:bg-stone-200 text-[#141414] border border-[#141414] font-bold text-xs px-4 py-2.5 rounded-xl"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSheet ? 'animate-spin' : ''}`} />
                  <span>Uji Koneksi</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncingAll || !sheetWebhookUrl}
                  onClick={handleSyncAllRegistrations}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Sinkronkan Semua (Kelompok per Vaksin) Sekarang</span>
                </button>
              </div>
            </div>

            {/* Apps Script Copy Box */}
            <div className="border border-stone-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-sm text-[#141414]">
                  Kode Google Apps Script (Mendukung Check-In Barcode & Tabel Terkelompok per Vaksin)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#fff000] border border-[#141414] text-[#141414] font-bold text-xs px-3.5 py-1.5 rounded-xl"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Tersalin!' : 'Salin Kode Script'}</span>
                </button>
              </div>
              <p className="text-xs text-stone-600">
                Paste kode terbaru ini ke Google Sheets → Extensions → Apps Script agar baris otomatis terkelompok dalam tabel per jenis vaksin dan mendukung update check-in barcode.
              </p>
            </div>

            {/* Step-by-Step Visual Illustrated Guide */}
            <div className="border border-stone-200 rounded-2xl p-5 space-y-4 bg-stone-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-[#141414]">
                    Panduan Bergambar Step-by-Step: Simpan Database Otomatis ke Google Sheets
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Ikuti 4 langkah ini agar seluruh pendaftar langsung tersimpan permanen di Google Sheets pribadi Anda (klik gambar untuk memperbesar).
                  </p>
                </div>
                <span className="text-[11px] font-bold text-stone-600 whitespace-nowrap shrink-0">
                  4 Langkah Mudah
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    step: '01',
                    title: 'Salin Kode Script dari Admin Hub',
                    desc: 'Di tab "Spreadsheet & Grup Tabel", klik tombol kuning "Salin Kode Script" di atas untuk menyalin kode Google Apps Script resmi.',
                    image: '/src/assets/images/guide_step1_copy_script_1795355336892.jpg',
                    alt: 'Langkah 1: Klik Salin Kode Script pada tab Spreadsheet & Grup Tabel di Admin Dashboard',
                  },
                  {
                    step: '02',
                    title: 'Buka Extensions → Apps Script & Simpan',
                    desc: 'Buka Google Sheets kosong di akun Google Anda → klik menu Extensions → Apps Script, hapus kode lama lalu paste script yang disalin dan tekan ikon Save.',
                    image: '/src/assets/images/guide_step2_apps_script_1795355338037.jpg',
                    alt: 'Langkah 2: Buka menu Extensions lalu Apps Script di Google Sheets, paste script dan simpan',
                  },
                  {
                    step: '03',
                    title: 'Deploy sebagai Web App (Akses: Anyone)',
                    desc: 'Klik tombol Deploy → New deployment → Select type: Web app → Execute as: Me → Who has access: pilih "Anyone" (wajib agar aplikasi bisa mengirim data), lalu Copy Web App URL.',
                    image: '/src/assets/images/guide_step3_deploy_webapp_1795355338096.jpg',
                    alt: 'Langkah 3: Deploy Web App dengan Who has access diatur ke Anyone dan salin Web App URL',
                  },
                  {
                    step: '04',
                    title: 'Tempel URL, Uji Koneksi & Sinkronkan',
                    desc: 'Tempel Web App URL ke kolom "Google Apps Script Webhook URL", centang "Auto Push Otomatis", klik "Simpan Format Tabel & URL Webhook", lalu klik "Uji Koneksi" dan "Sinkronkan Semua".',
                    image: '/src/assets/images/guide_step4_paste_sync_1795355339624.jpg',
                    alt: 'Langkah 4: Tempel URL Webhook, simpan pengaturan, uji koneksi, dan sinkronkan semua data',
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoUrl(item.image)}
                      className="block w-full aspect-video bg-stone-100 border-b border-stone-200 overflow-hidden group relative cursor-zoom-in text-left"
                    >
                      <img
                        src={item.image}
                        alt={item.alt}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                      <span className="absolute bottom-2 right-2 bg-[#141414]/85 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-90 group-hover:opacity-100">
                        Perbesar Gambar
                      </span>
                    </button>

                    <div className="p-4 space-y-1.5">
                      <div className="text-[11px] font-mono font-bold text-stone-500">
                        Langkah {item.step}
                      </div>
                      <h4 className="font-heading font-bold text-sm text-[#141414]">
                        {item.title}
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <RealtimeSheetSyncVisualizer
            sheetConfig={adminData.sheetConfig}
            sheetSyncState={adminData.sheetSyncState}
            registrations={adminData.registrations}
            isSyncingPending={isSyncingPending}
            isSyncingAll={isSyncingAll}
            onSyncPending={handleSyncPendingRegistrations}
            onSyncAll={handleSyncAllRegistrations}
          />

          <SheetAuditLogPanel
            logs={adminData.sheetAuditLogs || []}
            webhookConfigured={Boolean(adminData.sheetConfig.webhookUrl && adminData.sheetConfig.webhookUrl.trim().startsWith('http'))}
            onTestConnection={handleTestSheetConnection}
            isTestingSheet={isTestingSheet}
          />
        </div>
      )}

      {/* ================= TAB 9: HOLDS ================= */}
      {activeTab === 'holds' && (
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <h2 className="font-heading font-bold text-lg text-[#141414]">Monitor Slot Terkunci (Hold Checkout)</h2>
            <button onClick={() => fetchAdminData(false)} className="p-2 bg-stone-100 rounded-xl text-xs font-bold">Refresh</button>
          </div>
          {adminData.holds.length === 0 ? (
            <div className="py-10 text-center text-stone-400 text-sm">
              <Unlock className="w-8 h-8 mx-auto mb-2 text-stone-300" />
              Tidak ada slot yang sedang terkunci saat ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminData.holds.map(hold => {
                const vac = adminData.vaccines.find(v => v.id === hold.vaccineId);
                const secsLeft = Math.max(0, Math.floor((hold.expiresAt - Date.now()) / 1000));
                return (
                  <div key={hold.id} className="p-4 rounded-2xl border-2 border-[#fff000] bg-yellow-50/40 flex items-center justify-between">
                    <div>
                      <strong className="text-sm text-[#141414]">{vac?.name || hold.vaccineId}</strong>
                      <p className="text-xs text-stone-600">{hold.petName} ({hold.ownerName}) • Sisa {Math.floor(secsLeft / 60)}:{(secsLeft % 60).toString().padStart(2, '0')}</p>
                    </div>
                    <button onClick={() => handleReleaseHold(hold.id)} className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded-xl text-xs font-bold">
                      Lepaskan
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Vaccine Modal */}
      {isVaccineModalOpen && editingVaccine && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-bold text-lg text-[#141414]">
                {editingVaccine.id ? 'Edit Vaksin & Kuota' : 'Tambah Jenis Vaksin'}
              </h3>
              <button onClick={() => setIsVaccineModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">✕</button>
            </div>
            <form onSubmit={handleSaveVaccine} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Nama Vaksin *</label>
                <input required type="text" value={editingVaccine.name || ''} onChange={e => setEditingVaccine({ ...editingVaccine, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Kode *</label>
                  <input required type="text" value={editingVaccine.code || ''} onChange={e => setEditingVaccine({ ...editingVaccine, code: e.target.value.toUpperCase() })} className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono uppercase" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Kategori</label>
                  <select value={editingVaccine.category || 'kucing'} onChange={e => setEditingVaccine({ ...editingVaccine, category: e.target.value as any })} className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white">
                    <option value="kucing">Khusus Kucing</option>
                    <option value="anjing">Khusus Anjing</option>
                    <option value="semua">Kucing & Anjing</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">Total Kuota (isi 0 jika habis)</label>
                  <input type="number" min={0} value={editingVaccine.totalQuota ?? 20} onChange={e => setEditingVaccine({ ...editingVaccine, totalQuota: Math.max(0, Number(e.target.value) || 0) })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Min. Usia (Bulan)</label>
                  <input type="number" min={0} value={editingVaccine.minAgeMonths ?? 2} onChange={e => setEditingVaccine({ ...editingVaccine, minAgeMonths: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
              </div>
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="font-bold text-[#141414]">Format Tampilan Harga</label>
                  <div className="inline-flex rounded-lg bg-white border border-stone-300 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setVaccinePriceMode('number');
                        setEditingVaccine({ ...editingVaccine, priceText: '' });
                      }}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${vaccinePriceMode === 'number' ? 'bg-[#fff000] text-[#141414]' : 'text-stone-600'}`}
                    >
                      Angka (Rp)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVaccinePriceMode('text')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${vaccinePriceMode === 'text' ? 'bg-[#fff000] text-[#141414]' : 'text-stone-600'}`}
                    >
                      Keterangan Tulisan
                    </button>
                  </div>
                </div>
                {vaccinePriceMode === 'number' ? (
                  <div>
                    <label className="font-bold block mb-1 text-stone-600">Nominal Harga (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingVaccine.price ?? 0}
                      onChange={e => setEditingVaccine({ ...editingVaccine, price: Number(e.target.value), priceText: '' })}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="font-bold block mb-1 text-stone-600">Keterangan Harga (Tulisan)</label>
                      <input
                        type="text"
                        placeholder="Contoh: Sesuai Berat Badan / Bayar di Lokasi / Subsidi Khusus"
                        value={editingVaccine.priceText || ''}
                        onChange={e => setEditingVaccine({ ...editingVaccine, priceText: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1 text-stone-500">Nominal Tagihan Transfer Online (Rp, isi 0 jika tanpa transfer)</label>
                      <input
                        type="number"
                        min={0}
                        value={editingVaccine.price ?? 0}
                        onChange={e => setEditingVaccine({ ...editingVaccine, price: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="font-bold block mb-1">Deskripsi</label>
                <textarea rows={2} value={editingVaccine.description || ''} onChange={e => setEditingVaccine({ ...editingVaccine, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsVaccineModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-[#fff000] border-2 border-[#141414] text-[#141414] font-extrabold rounded-xl">Simpan Vaksin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Account Modal */}
      {isBankModalOpen && editingBankAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-bold text-lg text-[#141414]">
                {editingBankAccount.id ? 'Edit Rekening Tujuan' : 'Tambah Rekening Tujuan'}
              </h3>
              <button onClick={() => setIsBankModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveBankAccount} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Nama Bank / QRIS *</label>
                <input required type="text" value={editingBankAccount.bankName || ''} onChange={e => setEditingBankAccount({ ...editingBankAccount, bankName: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div>
                <label className="font-bold block mb-1">Nomor Rekening / NMID *</label>
                <input required type="text" value={editingBankAccount.accountNumber || ''} onChange={e => setEditingBankAccount({ ...editingBankAccount, accountNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono" />
              </div>
              <div>
                <label className="font-bold block mb-1">Atas Nama</label>
                <input required type="text" value={editingBankAccount.accountHolder || ''} onChange={e => setEditingBankAccount({ ...editingBankAccount, accountHolder: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsBankModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-[#fff000] border-2 border-[#141414] text-[#141414] font-extrabold rounded-xl">Simpan Rekening</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Kloter Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 text-xs">
            <h3 className="font-heading font-bold text-lg text-[#141414]">
              Geser Kloter Antrian #{rescheduleTarget.reg.queueNumber || '--'}
            </h3>
            <p className="text-stone-600">
              Peserta: <strong>{rescheduleTarget.reg.ownerName}</strong> ({rescheduleTarget.reg.petName})
            </p>
            <div>
              <label className="font-bold block mb-1.5">Pilih Kloter Tujuan Baru:</label>
              <select
                value={rescheduleTarget.newSession}
                onChange={(e) => setRescheduleTarget({ ...rescheduleTarget, newSession: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                {adminData.event.sessions.map((s, i) => (
                  <option key={i} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRescheduleTarget(null)} className="px-4 py-2 border rounded-xl font-bold">Batal</button>
              <button onClick={handleConfirmReschedule} className="px-5 py-2 bg-[#fff000] border-2 border-[#141414] text-[#141414] font-extrabold rounded-xl">
                Simpan Kloter Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Voucher Modal */}
      {customVoucherModalReg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 text-xs">
            <h3 className="font-heading font-bold text-lg text-[#141414]">
              Terbitkan Voucher Petshop (Single-Use)
            </h3>
            <p className="text-stone-600">
              Peserta: <strong>{customVoucherModalReg.ownerName}</strong> (Antrian #{customVoucherModalReg.queueNumber || '--'}) — berhalangan hadir di booth.
            </p>
            <div>
              <label className="font-bold block mb-1">Kode Voucher Unik (Kosongkan untuk generate otomatis)</label>
              <input
                type="text"
                placeholder={`Contoh: ${adminData.event.voucherTemplate.codePrefix}-${customVoucherModalReg.queueNumber || '01'}-UNIK`}
                value={customVoucherCode}
                onChange={(e) => setCustomVoucherCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-mono uppercase"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setCustomVoucherModalReg(null); setCustomVoucherCode(''); }} className="px-4 py-2 border rounded-xl font-bold">Batal</button>
              <button onClick={() => handleGenerateVoucher(customVoucherModalReg, customVoucherCode)} className="px-5 py-2 bg-[#fff000] border-2 border-[#141414] text-[#141414] font-extrabold rounded-xl">
                Terbitkan Voucher Unik
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Card Preview Modal */}
      {previewVoucher && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 text-center">
            <div className="flex justify-between items-center border-b pb-2">
              <strong className="text-sm text-[#141414]">Kartu Voucher Resmi (1x Pakai)</strong>
              <button onClick={() => setPreviewVoucher(null)}>✕</button>
            </div>
            <img
              src={previewVoucher.imageUrl || '/vouchers/voucher-remov-default.svg'}
              alt="Voucher"
              className="w-full max-h-44 object-contain rounded-2xl border border-stone-200"
            />
            <div className="bg-[#fff000] border-2 border-[#141414] rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-700 block">KODE VOUCHER PETSHOP</span>
              <span className="font-mono font-black text-2xl text-[#141414] select-all block">{previewVoucher.code}</span>
              <span className="text-xs font-bold text-[#141414] block">{previewVoucher.benefitText}</span>
            </div>
            <p className="text-xs text-stone-600">
              Penerima: <strong>{previewVoucher.ownerName}</strong> ({previewVoucher.petName}) • Status: <strong>{previewVoucher.status === 'active' ? 'AKTIF (1x Pakai)' : 'SUDAH HANGUS'}</strong>
            </p>
            <div className="flex gap-2 justify-center">
              <a
                href={`https://wa.me/${previewVoucher.ownerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Halo Kak ${previewVoucher.ownerName}, sebagai pengganti ketidakhadiran pada vaksinasi ${previewVoucher.vaccineName} (${previewVoucher.petName}), berikut Kode Voucher Petshop REMOV (1x pakai):\n\nKode: *${previewVoucher.code}*\nBenefit: ${previewVoucher.benefitText}\nBerlaku s/d: ${previewVoucher.validUntil}\n\nTunjukkan kode ini saat berbelanja di Petshop partner REMOV.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Kirim ke WhatsApp Peserta
              </a>
              <button onClick={() => window.print()} className="bg-[#141414] text-[#fff000] text-xs font-bold px-4 py-2.5 rounded-xl">
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Event Official Statement Modal */}
      {isCompleteEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#141414]">
                  Pernyataan Tim Admin: Event Selesai Dilaksanakan
                </h3>
                <p className="text-[11px] text-stone-500">
                  Jadwal Event: <strong>{adminData.event.date}</strong> ({adminData.event.timeRange}) • {adminData.event.locationName}
                </p>
              </div>
              <button type="button" onClick={() => setIsCompleteEventModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleConfirmCompleteEvent} className="space-y-3 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-emerald-950">
                Seluruh data <strong>{adminData.registrations.length} peserta</strong> akan otomatis tersimpan ke Arsip sesuai jadwal event <strong>{adminData.event.date}</strong> dan langsung tersinkron real-time ke seluruh perangkat customer.
              </div>
              <div>
                <label className="font-bold block mb-1">Pernyataan Resmi Tim Admin *</label>
                <textarea
                  required
                  rows={3}
                  value={completeEventForm.statement}
                  onChange={e => setCompleteEventForm({ ...completeEventForm, statement: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Dinyatakan Oleh (Tim / PIC Admin)</label>
                  <input
                    type="text"
                    value={completeEventForm.completedBy}
                    onChange={e => setCompleteEventForm({ ...completeEventForm, completedBy: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Kota Pelaksanaan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Bandung / Jakarta Selatan"
                    value={completeEventForm.city}
                    onChange={e => setCompleteEventForm({ ...completeEventForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">Catatan Tambahan Portofolio (Opsional)</label>
                <textarea
                  rows={2}
                  value={completeEventForm.summaryNotes}
                  onChange={e => setCompleteEventForm({ ...completeEventForm, summaryNotes: e.target.value })}
                  placeholder="Catatan pelaksanaan acara, tingkat kehadiran, dll..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Upload Foto Dokumentasi Acara (Opsional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleUploadAssetToFolder('archives', f, (url) => {
                        setCompleteEventForm(prev => ({ ...prev, documentationPhotos: [...prev.documentationPhotos, url] }));
                      });
                    }
                  }}
                  className="block w-full text-xs"
                />
                {completeEventForm.documentationPhotos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {completeEventForm.documentationPhotos.map((u, i) => (
                      <img key={i} src={u} alt="Doc" className="h-14 w-14 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCompleteEventModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold cursor-pointer">Batal</button>
                <button
                  type="submit"
                  disabled={isCompletingEvent}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl cursor-pointer"
                >
                  {isCompletingEvent ? 'Menyimpan...' : 'Nyatakan Event Selesai & Simpan Otomatis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Event & Reset Queue Modal */}
      {isArchiveResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#141414]">
                  Arsipkan Event &amp; Reset Antrian Kembali ke 01
                </h3>
                <p className="text-[11px] text-stone-500">
                  Otomatis menyimpan arsip jadwal: <strong>{adminData.event.date}</strong> ({adminData.event.timeRange})
                </p>
              </div>
              <button onClick={() => setIsArchiveResetModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleArchiveAndResetEvent} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Partner / Petshop Kolaborasi</label>
                  <input type="text" value={archiveResetForm.partnerName} onChange={e => setArchiveResetForm({ ...archiveResetForm, partnerName: e.target.value })} placeholder="Contoh: Petshop Harmoni Bandung" className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Kota Pelaksanaan</label>
                  <input type="text" value={archiveResetForm.city} onChange={e => setArchiveResetForm({ ...archiveResetForm, city: e.target.value })} placeholder="Contoh: Jakarta Selatan" className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Bulan</label>
                  <input type="text" value={archiveResetForm.month} onChange={e => setArchiveResetForm({ ...archiveResetForm, month: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Tahun</label>
                  <input type="text" value={archiveResetForm.year} onChange={e => setArchiveResetForm({ ...archiveResetForm, year: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div>
                  <label className="font-bold block mb-1 text-stone-700">Judul Event Jadwal Berikutnya</label>
                  <input type="text" value={archiveResetForm.nextEventTitle} onChange={e => setArchiveResetForm({ ...archiveResetForm, nextEventTitle: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white" />
                </div>
                <div>
                  <label className="font-bold block mb-1 text-stone-700">Tanggal Jadwal Event Berikutnya</label>
                  <input type="text" value={archiveResetForm.nextEventDate} onChange={e => setArchiveResetForm({ ...archiveResetForm, nextEventDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white" />
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">Program yang Dijalankan (pisahkan dengan koma)</label>
                <input type="text" value={archiveResetForm.programsRunText} onChange={e => setArchiveResetForm({ ...archiveResetForm, programsRunText: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div>
                <label className="font-bold block mb-1">Ringkasan / Catatan Portofolio Event</label>
                <textarea rows={2} value={archiveResetForm.summaryNotes} onChange={e => setArchiveResetForm({ ...archiveResetForm, summaryNotes: e.target.value })} placeholder="Contoh: Tingkat kehadiran 95%, kolaborasi vaksinasi & edukasi nutrisi..." className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div>
                <label className="font-bold block mb-1">Upload Foto Dokumentasi Acara</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleUploadAssetToFolder('archives', f, (url) => {
                        setArchiveResetForm(prev => ({ ...prev, documentationPhotos: [...prev.documentationPhotos, url] }));
                      });
                    }
                  }}
                  className="block w-full text-xs"
                />
                {archiveResetForm.documentationPhotos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {archiveResetForm.documentationPhotos.map((u, i) => (
                      <img key={i} src={u} alt="Doc" className="h-14 w-14 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 font-bold text-[#141414] bg-yellow-50 p-3 rounded-xl border border-[#141414]/20">
                <input type="checkbox" checked={archiveResetForm.resetRegistrations} onChange={e => setArchiveResetForm({ ...archiveResetForm, resetRegistrations: e.target.checked })} />
                <span>Kosongkan daftar pendaftar aktif & reset Nomor Antrian mulai dari 01 untuk jadwal event berikutnya</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsArchiveResetModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-5 py-2.5 bg-[#fff000] border-2 border-[#141414] text-[#141414] font-extrabold rounded-xl">
                  Simpan Arsip &amp; Reset ke 01
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Archive Modal */}
      {isManualArchiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-bold text-lg text-[#141414]">Tambah Portofolio Event Terdahulu</h3>
              <button onClick={() => setIsManualArchiveModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveManualArchive} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Nama Event *</label>
                  <input required type="text" value={manualArchiveForm.eventTitle} onChange={e => setManualArchiveForm({ ...manualArchiveForm, eventTitle: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Partner / Kolaborator *</label>
                  <input required type="text" value={manualArchiveForm.partnerName} onChange={e => setManualArchiveForm({ ...manualArchiveForm, partnerName: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Lokasi / Venue *</label>
                  <input required type="text" value={manualArchiveForm.locationName} onChange={e => setManualArchiveForm({ ...manualArchiveForm, locationName: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Kota</label>
                  <input type="text" value={manualArchiveForm.city} onChange={e => setManualArchiveForm({ ...manualArchiveForm, city: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Tanggal</label>
                  <input type="text" value={manualArchiveForm.eventDate} onChange={e => setManualArchiveForm({ ...manualArchiveForm, eventDate: e.target.value })} placeholder="15 Maret 2026" className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold block mb-1">Bulan</label>
                    <input type="text" value={manualArchiveForm.month} onChange={e => setManualArchiveForm({ ...manualArchiveForm, month: e.target.value })} placeholder="Maret" className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Tahun</label>
                    <input type="text" value={manualArchiveForm.year} onChange={e => setManualArchiveForm({ ...manualArchiveForm, year: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                  </div>
                </div>
                <div>
                  <label className="font-bold block mb-1">Total Pendaftar</label>
                  <input type="number" value={manualArchiveForm.totalRegistrations} onChange={e => setManualArchiveForm({ ...manualArchiveForm, totalRegistrations: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Total Hadir</label>
                  <input type="number" value={manualArchiveForm.totalAttended} onChange={e => setManualArchiveForm({ ...manualArchiveForm, totalAttended: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">Program yang Dijalankan (pisah koma)</label>
                <input type="text" value={manualArchiveForm.programsRunText} onChange={e => setManualArchiveForm({ ...manualArchiveForm, programsRunText: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div>
                <label className="font-bold block mb-1">Catatan Portofolio</label>
                <textarea rows={2} value={manualArchiveForm.summaryNotes} onChange={e => setManualArchiveForm({ ...manualArchiveForm, summaryNotes: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-stone-300" />
              </div>
              <div>
                <label className="font-bold block mb-1">Upload Foto Dokumentasi</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAssetToFolder('archives', f, (url) => setManualArchiveForm(prev => ({ ...prev, documentationPhotos: [...prev.documentationPhotos, url] })));
                  }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsManualArchiveModalOpen(false)} className="px-4 py-2 border rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-[#fff000] border-2 border-[#141414] text-[#141414] font-extrabold rounded-xl">Simpan Portofolio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Archive Participants Modal */}
      {viewingArchive && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between gap-2 border-b pb-3 flex-wrap">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#141414]">Arsip Peserta: {viewingArchive.eventTitle}</h3>
                <span className="text-stone-500">{viewingArchive.eventDate} • {viewingArchive.locationName}</span>
              </div>
              <div className="flex items-center gap-2">
                {viewingArchive.registrations && viewingArchive.registrations.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      exportRegistrationsToCSV(
                        viewingArchive.registrations,
                        viewingArchive.eventTitle,
                        eventForm?.spreadsheetConfig || adminData.event.spreadsheetConfig
                      )
                    }
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV Arsip</span>
                  </button>
                )}
                <button onClick={() => setViewingArchive(null)} className="p-1 font-bold">✕</button>
              </div>
            </div>
            {(!viewingArchive.registrations || viewingArchive.registrations.length === 0) ? (
              <p className="text-stone-400 py-8 text-center">Arsip ini hanya mencatat ringkasan portofolio (tanpa baris peserta individual).</p>
            ) : (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#141414] text-[#fff000]">
                    <tr>
                      <th className="p-2">Antrian</th>
                      <th className="p-2">Pawrent</th>
                      <th className="p-2">Anabul</th>
                      <th className="p-2">Vaksin</th>
                      <th className="p-2">Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewingArchive.registrations.map(r => (
                      <tr key={r.id}>
                        <td className="p-2 font-bold">#{r.queueNumber || '-'}</td>
                        <td className="p-2">{r.ownerName} ({r.ownerPhone})</td>
                        <td className="p-2">{r.petName}</td>
                        <td className="p-2">{r.vaccineName}</td>
                        <td className="p-2">{r.checkInStatus || 'belum_hadir'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archive Documentation Photo Zoom Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-3xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <span className="font-bold text-sm text-[#141414]">Pratinjau Dokumentasi</span>
              <button onClick={() => setPreviewPhotoUrl(null)} className="px-3 py-1 bg-stone-100 rounded-lg text-xs font-bold">Tutup ✕</button>
            </div>
            <img src={previewPhotoUrl} alt="Dokumentasi Acara" className="max-h-[75vh] w-auto mx-auto rounded-xl object-contain" />
          </div>
        </div>
      )}

      {/* Registration Details Modal */}
      {selectedRegDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-[#141414] space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading font-bold text-lg text-[#141414]">
                Detail Antrian #{selectedRegDetails.queueNumber || '--'} • {selectedRegDetails.regNumber}
              </h3>
              <button onClick={() => setSelectedRegDetails(null)}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-stone-400 block">Pawrent:</span><strong>{selectedRegDetails.ownerName}</strong></div>
              <div><span className="text-stone-400 block">WhatsApp:</span><strong>{selectedRegDetails.ownerPhone}</strong></div>
              <div><span className="text-stone-400 block">Email:</span><strong>{selectedRegDetails.ownerEmail || '-'}</strong></div>
              <div><span className="text-stone-400 block">Kota:</span><strong>{selectedRegDetails.ownerCity}</strong></div>
              <div><span className="text-stone-400 block">Anabul:</span><strong>{selectedRegDetails.petName} ({selectedRegDetails.petType})</strong></div>
              <div><span className="text-stone-400 block">Vaksin:</span><strong>{selectedRegDetails.vaccineName}</strong></div>
              <div><span className="text-stone-400 block">Kloter:</span><strong>{selectedRegDetails.selectedSession}</strong></div>
              <div><span className="text-stone-400 block">Barcode:</span><strong className="font-mono">{selectedRegDetails.barcodeCode || '-'}</strong></div>
            </div>
            {selectedRegDetails.vaccineNotes && (
              <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-300">
                <span className="font-bold block text-[#141414] mb-0.5">Keterangan / Kebutuhan Tambahan Peserta:</span>
                <p className="text-stone-800 whitespace-pre-wrap">{selectedRegDetails.vaccineNotes}</p>
              </div>
            )}
            {selectedRegDetails.healthChecklistAnswers && selectedRegDetails.healthChecklistAnswers.length > 0 && (
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1">
                <span className="font-bold block text-stone-700">Checklist Kesehatan Peserta:</span>
                {selectedRegDetails.healthChecklistAnswers.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
                    <span>{c.checked ? '✅' : '⬜'}</span>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setSelectedRegDetails(null)} className="px-4 py-2 bg-[#141414] text-[#fff000] font-bold rounded-xl">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
