import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  AppDatabase,
  EventConfig,
  VaccineOption,
  Registration,
  QuotaHold,
  GoogleSheetConfig,
  BankAccount,
  Voucher,
  EventArchive,
  HealthChecklistItem,
  SheetSyncAction,
  SheetSyncAuditEntry,
  SheetSyncQueueJob,
  SheetSyncLiveState
} from './src/types.ts';
import {
  DEFAULT_COLUMNS as CANONICAL_SPREADSHEET_COLUMNS,
  buildRegistrationsCSVContent,
  mergeSpreadsheetColumnsWithDatabase,
} from './src/utils/csvExport.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'db.json');
const DB_BACKUP_PATH = path.resolve(DATA_DIR, 'db.backup.json');
const DB_TMP_PATH = path.resolve(DATA_DIR, 'db.tmp.json');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const ASSET_FOLDERS = ['backgrounds', 'logos', 'vouchers', 'archives'] as const;
type AssetFolder = typeof ASSET_FOLDERS[number];

// Ensure data & public asset directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
ASSET_FOLDERS.forEach((folder) => {
  const dir = path.resolve(PUBLIC_DIR, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const defaultHealthChecklist: HealthChecklistItem[] = [
  {
    id: 'chk-1',
    text: 'Anabul dalam keadaan sehat, aktif bergerak, dan nafsu makan baik.',
    required: true,
  },
  {
    id: 'chk-2',
    text: 'Tidak ada riwayat demam, bersin pilek, diare, atau muntah dalam 7 hari terakhir.',
    required: true,
  },
  {
    id: 'chk-3',
    text: 'Jika anabul betina, TIDAK dalam kondisi sedang bunting atau menyusui anak.',
    required: true,
  },
  {
    id: 'chk-4',
    text: 'Bersedia membawa pet cargo/carrier bagi kucing atau harness/tali kekang bagi anjing saat hari-H.',
    required: true,
  },
];

const defaultSpreadsheetColumns = CANONICAL_SPREADSHEET_COLUMNS.map(c => ({ ...c }));

const defaultInitialData: AppDatabase = {
  event: {
    id: 'remov-event-2026',
    title: 'PAWRENTING REMOV 2026',
    subtitle: 'Vaksinasi Massal & Edukasi Kesehatan Anabul (Kucing & Anjing)',
    tagline: 'Wujudkan Anabul Sehat, Bahagia, & Bebas Penyakit Bersama REMOV Pet Care',
    heroBadgeText: 'Pendaftaran Resmi Pawrenting REMOV',
    date: 'Minggu, 24 Mei 2026',
    timeRange: '08:30 - 16:00 WIB',
    dateCardLabel: 'Jadwal Pelaksanaan',
    dateNote: '',
    showDateCard: true,
    locationName: 'REMOV Care Center & Vet Clinic (Main Hall)',
    locationAddress: 'Jl. Boulevard Raya No. 88, Kebayoran Baru, Jakarta Selatan',
    locationCardLabel: 'Lokasi Event',
    locationMapsUrl: '',
    showLocationCard: true,
    contactWhatsApp: '081299887766',
    whatsappGroupLink: 'https://chat.whatsapp.com/GrupResmiPawrentingRemov2026',
    whatsappGroupPrompt: 'Jika sudah mengisi semua data diri secara lengkap dan ketentuan yang berlaku silahkan untuk join ke Group WhatsApp Resmi Pawrenting Remov sesuai dengan link di bawah ini',
    sessions: [
      'Pukul 09.00 - 12.00 WIB (Kloter 1)',
      'Pukul 12.00 - 14.00 WIB (Kloter 2)',
      'Pukul 14.00 - 16.00 WIB (Kloter 3)'
    ],
    bankAccounts: [
      {
        id: 'bank-bca',
        bankName: 'BCA (Bank Central Asia)',
        accountNumber: '8730921200',
        accountHolder: 'PT REMOV PET CARE INDONESIA',
        active: true,
        notes: 'Transfer via m-BCA / KlikBCA / Antar Bank'
      },
      {
        id: 'bank-mandiri',
        bankName: 'Bank Mandiri',
        accountNumber: '157001122334',
        accountHolder: 'PT REMOV PET CARE INDONESIA',
        active: true,
        notes: 'Transfer via Livin by Mandiri / BI-Fast'
      },
      {
        id: 'bank-qris',
        bankName: 'QRIS REMOV Official (Semua E-Wallet & Mobile Banking)',
        accountNumber: 'NMID: ID1020039201992',
        accountHolder: 'REMOV PAWRENTING VAKSINASI',
        active: true,
        notes: 'Support Scan QRIS GoPay, OVO, Dana, ShopeePay, BCA'
      }
    ],
    termsAndConditions: defaultHealthChecklist.map(item => item.text),
    healthChecklistItems: defaultHealthChecklist,
    removLogoUrl: '/logos/remov-logo.svg',
    partnerLogoUrl: '',
    partnerName: '',
    backgroundImageUrl: '/backgrounds/pawrenting-kuning-remov.svg',
    backgroundOverlayOpacity: 78,
    bookingSuccessLabel: 'SUKSES BOOKING',
    ticketArrivalNote: 'Harap datang ke booth Pawrenting REMOV tepat waktu sesuai kloter jam yang dipilih. Jika ada perubahan jadwal, mohon konfirmasi terlebih dahulu kepada pihak panitia.',
    paymentTimeoutHours: 2,
    queueCounter: 2,
    voucherTemplate: {
      title: 'Voucher Belanja Petshop REMOV',
      codePrefix: 'REMOV-PS',
      benefitText: 'Voucher Belanja Produk REMOV & Petshop Rp 50.000',
      imageUrl: '/vouchers/voucher-remov-default.svg',
      description: 'Kompensasi resmi bagi peserta Pawrenting REMOV yang telah melakukan pembayaran booking namun berhalangan hadir di hari pelaksanaan. Berlaku untuk 1x penukaran.',
      validUntil: '31 Desember 2026',
    },
    spreadsheetConfig: {
      groupByVaccine: true,
      tableHeaderPrefix: 'TABEL KELOMPOK VAKSIN',
      headerColorHex: '#FFF000',
      columns: defaultSpreadsheetColumns,
    },
    holdDurationMinutes: 10,
    adminPin: 'remov2026',
    eventStatus: 'active',
  },
  vaccines: [
    {
      id: 'vac-rabies',
      name: 'Vaksin Anti-Rabies',
      code: 'RABIES',
      category: 'semua',
      totalQuota: 50,
      price: 50000,
      description: 'Perlindungan esensial dari virus Rabies untuk kucing & anjing oleh dokter hewan berizin.',
      minAgeMonths: 3,
      active: true,
      notes: 'Wajib untuk semua anabul umur min. 3 bulan'
    },
    {
      id: 'vac-f3',
      name: 'Vaksin F3 (Tricat / Felocell 3)',
      code: 'F3',
      category: 'kucing',
      totalQuota: 15,
      price: 125000,
      description: 'Mencegah 3 penyakit mematikan pada kucing: Feline Panleukopenia, Rhinotracheitis (Flu Kucing), & Calicivirus.',
      minAgeMonths: 2,
      active: true,
      notes: 'Khusus Anabul Kucing min. 2 bulan'
    },
    {
      id: 'vac-f4',
      name: 'Hanya Pemeriksaan Dokter Hewan',
      code: 'PEMERIKSAAN',
      category: 'semua',
      totalQuota: 100,
      price: 0,
      description: 'Konsultasi & pemeriksaan fisik umum anabul bersama tim dokter hewan REMOV.',
      minAgeMonths: 2,
      active: true,
      notes: 'Terbuka untuk Kucing & Anjing'
    }
  ],
  registrations: [
    {
      id: 'reg-demo-spread-1',
      regNumber: 'REMOV-2026-RAB-0001',
      queueNumber: '01',
      queueSequence: 1,
      barcodeCode: 'REMOV-Q01-2026',
      createdAt: '2026-11-12T12:27:14.000Z',
      eventTitle: 'PAWRENTING REMOV 2026',
      ownerName: 'Jo',
      ownerPhone: '08912345678',
      ownerEmail: 'jo.anabul@gmail.com',
      ownerCity: 'Cimahi',
      ownerInstagram: '@jo_pets',
      referralSource: 'Instagram',
      petType: 'kucing',
      petName: 'Audy',
      petBreed: 'Domestik Mix',
      petGender: 'jantan',
      isSterilized: false,
      petAge: '1 tahun',
      petWeightKg: 3.8,
      petColor: 'Tabby Oranye',
      previousVaccineHistory: 'Pernah vaksin tahun lalu',
      healthConfirmation: {
        isHealthy: true,
        notPregnantOrNursing: true,
        minAgeMet: true,
        noFeverOrDiarrhea: true,
        agreedToTerms: true,
      },
      vaccineId: 'vac-rabies',
      vaccineName: 'Vaksin Anti-Rabies',
      vaccinePrice: 50000,
      selectedSession: 'Pukul 12.00 - 14.00 WIB (Kloter 2)',
      totalAmount: 50000,
      paymentMethod: 'BCA (Bank Central Asia)',
      paymentBankTarget: 'BCA (8730921200)',
      paymentProofUrl: 'https://drive.google.com/open?id=1JmhlPeMmstMtzCLOL85GnQ1qNPjHuog4',
      paymentProofType: 'link',
      paymentStatus: 'verified',
      paymentNotes: 'Otomatis terverifikasi saat bukti payment dilampirkan',
      verifiedAt: '2026-11-12T12:27:14.000Z',
      checkInStatus: 'sudah_hadir',
      checkedInAt: '2026-11-12T12:40:00.000Z',
      joinedWhatsAppGroup: true,
      syncedToGoogleSheet: true,
      sheetSyncedAt: '2026-11-12T12:35:00.000Z'
    },
    {
      id: 'reg-demo-1',
      regNumber: 'REMOV-2026-F3-0002',
      queueNumber: '02',
      queueSequence: 2,
      barcodeCode: 'REMOV-Q02-2026',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      eventTitle: 'PAWRENTING REMOV 2026',
      ownerName: 'Sarah Amanda Putri',
      ownerPhone: '081234567890',
      ownerEmail: 'sarah.amanda@gmail.com',
      ownerCity: 'Jakarta Selatan',
      ownerInstagram: '@sarahamanda.cat',
      referralSource: 'Instagram @remov.official',
      petType: 'kucing',
      petName: 'Mochi',
      petBreed: 'British Shorthair (BSH)',
      petGender: 'jantan',
      isSterilized: true,
      petAge: '1 tahun 2 bulan',
      petWeightKg: 4.2,
      petColor: 'Abu-abu (Blue)',
      previousVaccineHistory: 'Pernah vaksin lengkap tahun lalu',
      healthConfirmation: {
        isHealthy: true,
        notPregnantOrNursing: true,
        minAgeMet: true,
        noFeverOrDiarrhea: true,
        agreedToTerms: true,
      },
      vaccineId: 'vac-f3',
      vaccineName: 'Vaksin F3 (Tricat / Felocell 3)',
      vaccinePrice: 125000,
      selectedSession: 'Pukul 09.00 - 12.00 WIB (Kloter 1)',
      totalAmount: 125000,
      paymentMethod: 'BCA (Bank Central Asia)',
      paymentBankTarget: 'BCA (8730921200)',
      paymentProofUrl: '',
      paymentProofType: 'upload',
      paymentStatus: 'verified',
      paymentNotes: 'Otomatis terverifikasi saat bukti payment dilampirkan',
      verifiedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      checkInStatus: 'belum_hadir',
      joinedWhatsAppGroup: true,
      syncedToGoogleSheet: true,
      sheetSyncedAt: new Date(Date.now() - 3600000 * 4).toISOString()
    }
  ],
  holds: [],
  vouchers: [],
  archives: [
    {
      id: 'arc-sample-2025',
      eventTitle: 'PAWRENTING REMOV BANDUNG 2025',
      subtitle: 'Roadshow Vaksinasi Anabul & Edukasi Nutrisi',
      locationName: 'Meow & Bark Petshop Hub Bandung',
      locationAddress: 'Jl. Riau No. 45, Bandung',
      city: 'Bandung',
      eventDate: '16 November 2025',
      month: 'November',
      year: '2025',
      partnerName: 'Meow & Bark Petshop Bandung',
      partnerLogoUrl: '',
      programsRun: ['Vaksinasi Rabies Massal', 'Vaksinasi F3 Kucing', 'Pemeriksaan Kesehatan Gratis', 'Edukasi Pawrenting'],
      summaryNotes: 'Kolaborasi perdana bersama Meow & Bark Petshop Bandung berjalan lancar dengan tingkat kehadiran 96%.',
      documentationPhotos: ['/backgrounds/pawrenting-klinik-cerah.jpg', '/backgrounds/pawrenting-taman-komunitas.jpg'],
      totalRegistrations: 65,
      totalAttended: 62,
      totalVaccinatedByVaccine: [
        { vaccineName: 'Vaksin Anti-Rabies', count: 50 },
        { vaccineName: 'Vaksin F3 (Tricat / Felocell 3)', count: 15 }
      ],
      registrations: [],
      archivedAt: '2025-11-16T17:00:00.000Z'
    }
  ],
  sheetConfig: {
    webhookUrl: '',
    autoSync: true,
    lastSyncTime: '',
    lastSyncStatus: 'idle',
    lastSyncMessage: 'Belum pernah sinkronisasi ke Google Sheets',
  },
  sheetAuditLogs: [],
};

function sanitizeVaccinesForDisk(vaccines: VaccineOption[]): VaccineOption[] {
  return vaccines.map((v) => {
    const clean = { ...v };
    delete clean.confirmedCount;
    delete clean.heldCount;
    delete clean.availableQuota;
    delete clean.isSoldOut;
    return {
      ...clean,
      active: clean.active !== false,
    };
  });
}

function sanitizeEventForDisk(event: EventConfig): EventConfig {
  const clean = { ...event };
  delete (clean as any).publicShareUrl;
  return clean;
}

function parseDbPayload(parsed: any): AppDatabase {
  const checklist = Array.isArray(parsed.event?.healthChecklistItems)
    ? parsed.event.healthChecklistItems
    : (parsed.event?.termsAndConditions && parsed.event.termsAndConditions.length > 0)
      ? parsed.event.termsAndConditions.map((t: string, i: number) => ({ id: `chk-${i + 1}`, text: t, required: true }))
      : defaultHealthChecklist;

  const mergedEvent: EventConfig = {
    ...defaultInitialData.event,
    ...(parsed.event || {}),
    whatsappGroupLink: parsed.event?.whatsappGroupLink !== undefined
      ? parsed.event.whatsappGroupLink
      : defaultInitialData.event.whatsappGroupLink,
    whatsappGroupPrompt: parsed.event?.whatsappGroupPrompt !== undefined
      ? parsed.event.whatsappGroupPrompt
      : defaultInitialData.event.whatsappGroupPrompt,
    adminPin: (parsed.event?.adminPin && String(parsed.event.adminPin).trim())
      ? parsed.event.adminPin
      : (defaultInitialData.event.adminPin || 'remov2026'),
    removLogoUrl: parsed.event?.removLogoUrl !== undefined
      ? parsed.event.removLogoUrl
      : '/logos/remov-logo.svg',
    partnerLogoUrl: parsed.event?.partnerLogoUrl ?? '',
    partnerName: parsed.event?.partnerName ?? '',
    heroBadgeText: parsed.event?.heroBadgeText ?? defaultInitialData.event.heroBadgeText,
    dateCardLabel: parsed.event?.dateCardLabel ?? defaultInitialData.event.dateCardLabel,
    dateNote: parsed.event?.dateNote ?? '',
    showDateCard: parsed.event?.showDateCard !== false,
    locationCardLabel: parsed.event?.locationCardLabel ?? defaultInitialData.event.locationCardLabel,
    locationMapsUrl: parsed.event?.locationMapsUrl ?? '',
    showLocationCard: parsed.event?.showLocationCard !== false,
    backgroundImageUrl: parsed.event?.backgroundImageUrl !== undefined
      ? parsed.event.backgroundImageUrl
      : '/backgrounds/pawrenting-kuning-remov.svg',
    backgroundOverlayOpacity: parsed.event?.backgroundOverlayOpacity ?? 78,
    bookingSuccessLabel: parsed.event?.bookingSuccessLabel !== undefined
      ? parsed.event.bookingSuccessLabel
      : defaultInitialData.event.bookingSuccessLabel,
    ticketArrivalNote: parsed.event?.ticketArrivalNote !== undefined
      ? parsed.event.ticketArrivalNote
      : defaultInitialData.event.ticketArrivalNote,
    paymentTimeoutHours: parsed.event?.paymentTimeoutHours !== undefined
      ? parsed.event.paymentTimeoutHours
      : 2,
    queueCounter: parsed.event?.queueCounter ?? 0,
    eventStatus: parsed.event?.eventStatus === 'completed' ? 'completed' : 'active',
    eventCompletedAt: parsed.event?.eventCompletedAt || undefined,
    eventCompletedStatement: parsed.event?.eventCompletedStatement || '',
    eventCompletedBy: parsed.event?.eventCompletedBy || '',
    lastArchivedId: parsed.event?.lastArchivedId || undefined,
    sessions: Array.isArray(parsed.event?.sessions)
      ? parsed.event.sessions
      : defaultInitialData.event.sessions,
    healthChecklistItems: checklist,
    voucherTemplate: {
      ...defaultInitialData.event.voucherTemplate,
      ...(parsed.event?.voucherTemplate || {}),
    },
    spreadsheetConfig: {
      ...defaultInitialData.event.spreadsheetConfig,
      ...(parsed.event?.spreadsheetConfig || {}),
      columns: mergeSpreadsheetColumnsWithDatabase(
        parsed.event?.spreadsheetConfig?.columns,
        Array.isArray(parsed.registrations) ? parsed.registrations : []
      ),
    },
    bankAccounts: Array.isArray(parsed.event?.bankAccounts)
      ? parsed.event.bankAccounts.map((b: any, idx: number) => ({
          id: b.id || `bank_${idx}_${Date.now()}`,
          bankName: b.bankName || 'Bank',
          accountNumber: b.accountNumber || '',
          accountHolder: b.accountHolder || 'REMOV',
          qrisUrl: b.qrisUrl || '',
          notes: b.notes || '',
          active: b.active !== false,
        }))
      : defaultInitialData.event.bankAccounts
  };
  delete (mergedEvent as any).publicShareUrl;

  const rawRegs: Registration[] = Array.isArray(parsed.registrations)
    ? parsed.registrations
    : defaultInitialData.registrations;

  // Ensure verified registrations have queueNumber & barcodeCode, and restore any legacy auto-expired bookings
  let maxSeq = mergedEvent.queueCounter || 0;
  const normalizedRegs = rawRegs.map((r) => {
    const normalized: Registration = {
      ...r,
      checkInStatus: r.checkInStatus || 'belum_hadir',
    };
    if (normalized.paymentStatus === 'expired' || normalized.paymentStatus === 'pending_payment') {
      normalized.paymentStatus = 'verified';
      normalized.paymentDeadlineAt = undefined;
      normalized.verifiedAt = normalized.verifiedAt || normalized.createdAt || new Date().toISOString();
      normalized.paymentNotes = 'Terdaftar — pembayaran & pembelian produk dilakukan langsung secara onsite di lokasi acara.';
    }
    if (normalized.paymentStatus === 'verified' && !normalized.queueNumber) {
      maxSeq += 1;
      const qStr = String(maxSeq).padStart(2, '0');
      return {
        ...normalized,
        queueSequence: maxSeq,
        queueNumber: qStr,
        barcodeCode: normalized.barcodeCode || `REMOV-Q${qStr}-${new Date().getFullYear()}`,
      };
    }
    if (normalized.queueSequence && normalized.queueSequence > maxSeq) {
      maxSeq = normalized.queueSequence;
    }
    return normalized;
  });
  mergedEvent.queueCounter = maxSeq;

  return {
    ...defaultInitialData,
    ...parsed,
    event: mergedEvent,
    vaccines: Array.isArray(parsed.vaccines)
      ? sanitizeVaccinesForDisk(parsed.vaccines)
      : defaultInitialData.vaccines,
    registrations: normalizedRegs,
    holds: Array.isArray(parsed.holds) ? parsed.holds : [],
    vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
    archives: Array.isArray(parsed.archives) ? parsed.archives : defaultInitialData.archives,
    sheetConfig: { ...defaultInitialData.sheetConfig, ...(parsed.sheetConfig || {}) },
    sheetAuditLogs: Array.isArray(parsed.sheetAuditLogs) ? parsed.sheetAuditLogs.slice(0, 200) : [],
  };
}

function readDb(): AppDatabase {
  try {
    if (!fs.existsSync(DB_PATH)) {
      if (fs.existsSync(DB_BACKUP_PATH)) {
        try {
          const backupRaw = fs.readFileSync(DB_BACKUP_PATH, 'utf-8');
          const restored = parseDbPayload(JSON.parse(backupRaw));
          writeDb(restored);
          return restored;
        } catch (backupErr) {
          console.error('Failed to restore from backup:', backupErr);
        }
      }
      writeDb(defaultInitialData);
      return defaultInitialData;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parseDbPayload(parsed);
  } catch (err) {
    console.error('Error reading DB, trying backup before fallback:', err);
    if (fs.existsSync(DB_BACKUP_PATH)) {
      try {
        const backupRaw = fs.readFileSync(DB_BACKUP_PATH, 'utf-8');
        const restored = parseDbPayload(JSON.parse(backupRaw));
        return restored;
      } catch (backupErr) {
        console.error('Backup DB also unreadable:', backupErr);
      }
    }
    return defaultInitialData;
  }
}

const sseClients = new Set<express.Response>();

function broadcastDbUpdate(reason = 'db_updated') {
  const payload = `data: ${JSON.stringify({ type: 'update', reason, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function parseIndonesianScheduleParts(dateStr?: string): { month: string; year: string } {
  const raw = String(dateStr || '').trim();
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const lower = raw.toLowerCase();
  const matchedMonth = months.find(m => lower.includes(m.toLowerCase()))
    || new Date().toLocaleString('id-ID', { month: 'long' });
  const yearMatch = raw.match(/\b(20\d{2})\b/);
  const matchedYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
  return { month: matchedMonth, year: matchedYear };
}

function buildArchiveRecordFromDb(
  db: AppDatabase,
  overrides: {
    id?: string;
    partnerName?: string;
    partnerLogoUrl?: string;
    city?: string;
    month?: string;
    year?: string;
    programsRun?: string[];
    summaryNotes?: string;
    completionStatement?: string;
    completedBy?: string;
    documentationPhotos?: string[];
  } = {}
): EventArchive {
  const { month: autoMonth, year: autoYear } = parseIndonesianScheduleParts(db.event.date);
  const vaccineCounts: Record<string, number> = {};
  db.registrations
    .filter(r => r.paymentStatus === 'verified')
    .forEach(r => {
      vaccineCounts[r.vaccineName] = (vaccineCounts[r.vaccineName] || 0) + 1;
    });

  return {
    id: overrides.id || 'arc_' + Date.now(),
    eventTitle: db.event.title,
    subtitle: db.event.subtitle,
    locationName: db.event.locationName,
    locationAddress: db.event.locationAddress,
    city: overrides.city || '',
    eventDate: db.event.date,
    timeRange: db.event.timeRange,
    month: (overrides.month && overrides.month.trim()) ? overrides.month.trim() : autoMonth,
    year: (overrides.year && overrides.year.trim()) ? overrides.year.trim() : autoYear,
    partnerName: overrides.partnerName || db.event.partnerName || 'REMOV Internal Care',
    partnerLogoUrl: overrides.partnerLogoUrl || db.event.partnerLogoUrl || '',
    programsRun: Array.isArray(overrides.programsRun) && overrides.programsRun.length > 0
      ? overrides.programsRun
      : db.vaccines.filter(v => v.active !== false).map(v => v.name),
    summaryNotes: overrides.summaryNotes || '',
    completionStatement: overrides.completionStatement ?? db.event.eventCompletedStatement ?? '',
    completedBy: overrides.completedBy ?? db.event.eventCompletedBy ?? 'Tim Admin REMOV',
    eventStatus: 'completed',
    documentationPhotos: Array.isArray(overrides.documentationPhotos) ? overrides.documentationPhotos : [],
    totalRegistrations: db.registrations.length,
    totalAttended: db.registrations.filter(r => r.checkInStatus === 'sudah_hadir' || r.checkInStatus === 'selesai_vaksin').length,
    totalVaccinatedByVaccine: Object.entries(vaccineCounts).map(([vaccineName, count]) => ({ vaccineName, count })),
    registrations: [...db.registrations],
    archivedAt: new Date().toISOString(),
  };
}

function syncLinkedCompletedArchive(data: AppDatabase) {
  if (data.event.eventStatus !== 'completed' || !data.event.lastArchivedId) return;
  const idx = data.archives.findIndex(a => a.id === data.event.lastArchivedId);
  if (idx < 0) return;
  const existing = data.archives[idx];
  const refreshed = buildArchiveRecordFromDb(data, {
    id: existing.id,
    partnerName: existing.partnerName,
    partnerLogoUrl: existing.partnerLogoUrl,
    city: existing.city,
    month: existing.month,
    year: existing.year,
    programsRun: existing.programsRun,
    summaryNotes: existing.summaryNotes,
    completionStatement: data.event.eventCompletedStatement || existing.completionStatement,
    completedBy: data.event.eventCompletedBy || existing.completedBy,
    documentationPhotos: existing.documentationPhotos,
  });
  data.archives[idx] = refreshed;
}

function normalizePhoneDigits(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  return digits;
}

function matchRegistrationQuery(r: Registration, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  const isDigitsOnly = /^\d+$/.test(trimmed);
  const paddedQueue = isDigitsOnly ? trimmed.padStart(2, '0') : '';
  const queryPhoneNorm = normalizePhoneDigits(trimmed);
  const regPhoneNorm = normalizePhoneDigits(r.ownerPhone);

  if (r.id === trimmed) return true;
  if (r.regNumber.toUpperCase() === upper) return true;
  if (r.barcodeCode && r.barcodeCode.toUpperCase() === upper) return true;
  if (r.queueNumber) {
    const qUpper = r.queueNumber.toUpperCase();
    if (qUpper === upper || (paddedQueue && qUpper === paddedQueue) || `Q${qUpper}` === upper) {
      return true;
    }
  }
  if (queryPhoneNorm.length >= 6 && regPhoneNorm && (regPhoneNorm === queryPhoneNorm || regPhoneNorm.endsWith(queryPhoneNorm))) {
    return true;
  }
  if (trimmed.length >= 2) {
    const lower = trimmed.toLowerCase();
    if (r.ownerName.toLowerCase().includes(lower) || r.petName.toLowerCase().includes(lower)) {
      return true;
    }
  }
  return false;
}

function writeDb(data: AppDatabase) {
  try {
    syncLinkedCompletedArchive(data);
    const cleanData: AppDatabase = {
      ...data,
      event: sanitizeEventForDisk(data.event),
      vaccines: sanitizeVaccinesForDisk(data.vaccines),
    };
    const serialized = JSON.stringify(cleanData, null, 2);
    if (!serialized || serialized.length < 10) return;

    if (fs.existsSync(DB_PATH)) {
      try {
        const existingRaw = fs.readFileSync(DB_PATH, 'utf-8');
        if (existingRaw && existingRaw.trim().startsWith('{')) {
          JSON.parse(existingRaw);
          fs.writeFileSync(DB_BACKUP_PATH, existingRaw, 'utf-8');
        }
      } catch {
        // Skip overwriting backup if current main file is corrupt
      }
    }

    fs.writeFileSync(DB_TMP_PATH, serialized, 'utf-8');
    fs.renameSync(DB_TMP_PATH, DB_PATH);
    broadcastDbUpdate('db_saved');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

function assignQueueNumberIfMissing(db: AppDatabase, reg: Registration) {
  if (!reg.queueNumber) {
    db.event.queueCounter = (db.event.queueCounter || 0) + 1;
    const seq = db.event.queueCounter;
    const qStr = String(seq).padStart(2, '0');
    reg.queueSequence = seq;
    reg.queueNumber = qStr;
    reg.barcodeCode = `REMOV-Q${qStr}-${new Date().getFullYear()}`;
    if (!reg.checkInStatus) {
      reg.checkInStatus = 'belum_hadir';
    }
  }
}

function cleanExpiredHoldsAndBookings(db: AppDatabase): boolean {
  const now = Date.now();
  let changed = false;

  const initialHolds = db.holds.length;
  db.holds = db.holds.filter(h => h.expiresAt > now);
  if (db.holds.length !== initialHolds) {
    changed = true;
  }

  return changed;
}

function computeVaccinesWithQuota(db: AppDatabase): VaccineOption[] {
  cleanExpiredHoldsAndBookings(db);
  const now = Date.now();

  return db.vaccines.map(vac => {
    const confirmedCount = db.registrations.filter(
      r => r.vaccineId === vac.id && r.paymentStatus !== 'rejected' && r.paymentStatus !== 'expired'
    ).length;

    const heldCount = db.holds.filter(
      h => h.vaccineId === vac.id && h.expiresAt > now
    ).length;

    const availableQuota = Math.max(0, vac.totalQuota - confirmedCount - heldCount);
    const isSoldOut = availableQuota <= 0;

    return {
      ...vac,
      confirmedCount,
      heldCount,
      availableQuota,
      isSoldOut,
    };
  });
}

// Function to push single or multiple registrations to Google Sheets Webhook
async function syncToGoogleSheetWebhook(webhookUrl: string, payload: any) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'URL Webhook Google Sheets belum diatur atau tidak valid.' };
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      return { success: true, message: 'Berhasil dikirim ke Google Sheets.' };
    } else {
      const txt = await response.text().catch(() => '');
      return { success: false, message: `Google Sheets merespon status ${response.status}: ${txt.slice(0, 180)}` };
    }
  } catch (err: any) {
    return { success: false, message: `Gagal menghubungi Google Sheets: ${err.message || 'Network error'}` };
  }
}

interface InternalSheetQueueItem {
  job: SheetSyncQueueJob;
  webhookUrl: string;
  payload: any;
  syncedRegIds?: string[];
  markAllSynced?: boolean;
  resolve?: (result: { success: boolean; message: string; auditEntry: SheetSyncAuditEntry }) => void;
}

const pendingSheetQueue: InternalSheetQueueItem[] = [];
let activeSheetQueueItem: InternalSheetQueueItem | null = null;
let isProcessingSheetQueue = false;
let sessionCompletedSyncCount = 0;
let sessionFailedSyncCount = 0;
let lastSheetTransitionAt = new Date().toISOString();

function formatRegTargetLabel(reg: Registration): string {
  const q = reg.queueNumber ? `#${reg.queueNumber} · ` : '';
  return `${q}${reg.ownerName} (${reg.petName})`;
}

function getSheetSyncLiveState(db: AppDatabase): SheetSyncLiveState {
  const webhookConfigured = Boolean(db.sheetConfig.webhookUrl && db.sheetConfig.webhookUrl.trim().startsWith('http'));
  const totalRegs = db.registrations.length;
  const syncedRegs = db.registrations.filter(r => r.syncedToGoogleSheet).length;
  const unsyncedRegs = Math.max(0, totalRegs - syncedRegs);

  let pipelineStatus: SheetSyncLiveState['pipelineStatus'] = 'idle';
  if (!webhookConfigured) {
    pipelineStatus = 'unconfigured';
  } else if (activeSheetQueueItem) {
    pipelineStatus = activeSheetQueueItem.job.status === 'retrying' ? 'retrying' : 'pushing';
  } else if (pendingSheetQueue.length > 0) {
    pipelineStatus = 'pushing';
  }

  return {
    pipelineStatus,
    webhookConfigured,
    autoSync: db.sheetConfig.autoSync !== false,
    activeJob: activeSheetQueueItem ? { ...activeSheetQueueItem.job } : null,
    queuedJobs: pendingSheetQueue.map(item => ({ ...item.job })),
    pendingQueueCount: (activeSheetQueueItem ? 1 : 0) + pendingSheetQueue.length,
    syncedRegistrationsCount: syncedRegs,
    unsyncedRegistrationsCount: unsyncedRegs,
    totalRegistrationsCount: totalRegs,
    sessionCompletedCount: sessionCompletedSyncCount,
    sessionFailedCount: sessionFailedSyncCount,
    lastTransitionAt: lastSheetTransitionAt,
  };
}

async function processSheetSyncQueue() {
  if (isProcessingSheetQueue) return;
  isProcessingSheetQueue = true;

  try {
    while (pendingSheetQueue.length > 0) {
      const nextItem = pendingSheetQueue.shift()!;
      activeSheetQueueItem = nextItem;
      const startedMs = Date.now();
      nextItem.job.startedAt = new Date().toISOString();
      nextItem.job.status = 'pushing';
      lastSheetTransitionAt = nextItem.job.startedAt;
      broadcastDbUpdate('sheet_sync');

      let finalResult: { success: boolean; message: string } = {
        success: false,
        message: 'Tidak dapat memproses sinkronisasi.'
      };

      const maxAttempts = Math.max(1, nextItem.job.maxAttempts);
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        nextItem.job.attempt = attempt;
        if (attempt > 1) {
          nextItem.job.status = 'retrying';
          lastSheetTransitionAt = new Date().toISOString();
          broadcastDbUpdate('sheet_sync');
          await new Promise(resolve => setTimeout(resolve, Math.min(2500, 600 * attempt)));
          nextItem.job.status = 'pushing';
          lastSheetTransitionAt = new Date().toISOString();
          broadcastDbUpdate('sheet_sync');
        }

        finalResult = await syncToGoogleSheetWebhook(nextItem.webhookUrl, nextItem.payload);
        if (finalResult.success) {
          break;
        }
        nextItem.job.lastError = finalResult.message;
      }

      const completedIso = new Date().toISOString();
      const durationMs = Math.max(1, Date.now() - startedMs);
      const auditEntry: SheetSyncAuditEntry = {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        action: nextItem.job.action,
        status: finalResult.success ? 'success' : 'failed',
        targetLabel: nextItem.job.targetLabel,
        regId: nextItem.job.regId,
        regNumber: nextItem.job.regNumber,
        recordCount: nextItem.job.recordCount,
        attempts: nextItem.job.attempt,
        durationMs,
        message: finalResult.message,
        webhookConfigured: Boolean(nextItem.webhookUrl && nextItem.webhookUrl.startsWith('http')),
        createdAt: nextItem.job.queuedAt,
        completedAt: completedIso,
      };

      if (finalResult.success) {
        sessionCompletedSyncCount += 1;
      } else {
        sessionFailedSyncCount += 1;
      }

      const freshDb = readDb();
      if (finalResult.success) {
        if (nextItem.markAllSynced) {
          freshDb.registrations.forEach(r => {
            r.syncedToGoogleSheet = true;
            r.sheetSyncedAt = completedIso;
          });
        } else if (Array.isArray(nextItem.syncedRegIds) && nextItem.syncedRegIds.length > 0) {
          const idSet = new Set(nextItem.syncedRegIds);
          freshDb.registrations.forEach(r => {
            if (idSet.has(r.id)) {
              r.syncedToGoogleSheet = true;
              r.sheetSyncedAt = completedIso;
            }
          });
        } else if (nextItem.job.regId) {
          const target = freshDb.registrations.find(r => r.id === nextItem.job.regId);
          if (target) {
            target.syncedToGoogleSheet = true;
            target.sheetSyncedAt = completedIso;
          }
        }
      } else if (nextItem.job.regId && nextItem.job.action === 'NEW_REGISTRATION') {
        const target = freshDb.registrations.find(r => r.id === nextItem.job.regId);
        if (target && target.syncedToGoogleSheet === undefined) {
          target.syncedToGoogleSheet = false;
        }
      }

      freshDb.sheetConfig.lastSyncTime = completedIso;
      freshDb.sheetConfig.lastSyncStatus = finalResult.success ? 'success' : 'failed';
      freshDb.sheetConfig.lastSyncMessage = finalResult.message;
      freshDb.sheetAuditLogs = [auditEntry, ...(freshDb.sheetAuditLogs || [])].slice(0, 200);

      activeSheetQueueItem = null;
      lastSheetTransitionAt = completedIso;
      writeDb(freshDb);

      if (nextItem.resolve) {
        nextItem.resolve({
          success: finalResult.success,
          message: finalResult.message,
          auditEntry,
        });
      }
    }
  } finally {
    activeSheetQueueItem = null;
    isProcessingSheetQueue = false;
  }
}

function enqueueSheetSync(options: {
  webhookUrl: string;
  action: SheetSyncAction;
  targetLabel: string;
  payload: any;
  regId?: string;
  regNumber?: string;
  syncedRegIds?: string[];
  markAllSynced?: boolean;
  recordCount?: number;
  maxAttempts?: number;
}) {
  const nowIso = new Date().toISOString();
  const job: SheetSyncQueueJob = {
    jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action: options.action,
    targetLabel: options.targetLabel,
    regId: options.regId,
    regNumber: options.regNumber,
    recordCount: options.recordCount ?? 1,
    status: 'queued',
    attempt: 0,
    maxAttempts: options.maxAttempts ?? (options.action === 'TEST_CONNECTION' ? 1 : 3),
    queuedAt: nowIso,
  };

  pendingSheetQueue.push({
    job,
    webhookUrl: options.webhookUrl,
    payload: options.payload,
    syncedRegIds: options.syncedRegIds,
    markAllSynced: options.markAllSynced,
  });
  lastSheetTransitionAt = nowIso;
  broadcastDbUpdate('sheet_sync');
  void processSheetSyncQueue();
}

function enqueueSheetSyncAndWait(options: {
  webhookUrl: string;
  action: SheetSyncAction;
  targetLabel: string;
  payload: any;
  regId?: string;
  regNumber?: string;
  syncedRegIds?: string[];
  markAllSynced?: boolean;
  recordCount?: number;
  maxAttempts?: number;
}): Promise<{ success: boolean; message: string; auditEntry: SheetSyncAuditEntry }> {
  return new Promise((resolve) => {
    const nowIso = new Date().toISOString();
    const job: SheetSyncQueueJob = {
      jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: options.action,
      targetLabel: options.targetLabel,
      regId: options.regId,
      regNumber: options.regNumber,
      recordCount: options.recordCount ?? 1,
      status: 'queued',
      attempt: 0,
      maxAttempts: options.maxAttempts ?? (options.action === 'TEST_CONNECTION' ? 1 : 3),
      queuedAt: nowIso,
    };

    pendingSheetQueue.push({
      job,
      webhookUrl: options.webhookUrl,
      payload: options.payload,
      syncedRegIds: options.syncedRegIds,
      markAllSynced: options.markAllSynced,
      resolve,
    });
    lastSheetTransitionAt = nowIso;
    broadcastDbUpdate('sheet_sync');
    void processSheetSyncQueue();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // Serve folder-based assets immediately in dev and prod
  ASSET_FOLDERS.forEach((folder) => {
    app.use(`/${folder}`, express.static(path.resolve(PUBLIC_DIR, folder)));
  });

  // Periodic cleaner for 10-min checkout holds
  setInterval(() => {
    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }
  }, 30000);

  // Helper to resolve the public share URL (prefers customShareUrl, then real deployed host, then ais-pre preview)
  const resolvePublicShareUrl = (db: AppDatabase, req: express.Request): string => {
    if (db.event.customShareUrl && db.event.customShareUrl.trim().startsWith('http')) {
      return db.event.customShareUrl.trim();
    }
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const proto = req.get('x-forwarded-proto') || 'https';
    const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
    if (host && !isLocalHost && !host.includes('ais-dev-')) {
      return `${proto}://${host}`;
    }
    const envAppUrl = process.env.APP_URL || '';
    if (envAppUrl.startsWith('http') && !envAppUrl.includes('MY_APP_URL')) {
      if (envAppUrl.includes('ais-dev-')) {
        return envAppUrl.replace('ais-dev-', 'ais-pre-');
      }
      return envAppUrl;
    }
    if (host.includes('ais-dev-')) {
      return `${proto}://${host.replace('ais-dev-', 'ais-pre-')}`;
    }
    return 'https://ais-pre-eokbt5pudc45k3nxlwvdte-860791107159.asia-northeast1.run.app';
  };

  // Helper to sanitize registration paymentProofUrl for external Sheet pushes
  const formatProofUrlForSheet = (reg: Registration, req: express.Request): string => {
    if (!reg.paymentProofUrl) return '-';
    if (reg.paymentProofUrl.startsWith('http')) return reg.paymentProofUrl;
    if (reg.paymentProofUrl.startsWith('data:')) {
      const base = resolvePublicShareUrl(readDb(), req);
      return `${base}/api/registrations/${reg.id}/proof-image`;
    }
    return reg.paymentProofUrl;
  };

  // Serve payment proof image directly via clean URL (prevents CSV/Sheet Base64 overflow!)
  app.get('/api/registrations/:id/proof-image', (req, res) => {
    const db = readDb();
    const reg = db.registrations.find(r => r.id === req.params.id || r.regNumber === req.params.id);
    if (!reg || !reg.paymentProofUrl) {
      return res.status(404).send('Bukti pembayaran tidak ditemukan.');
    }
    if (reg.paymentProofUrl.startsWith('http')) {
      return res.redirect(reg.paymentProofUrl);
    }
    const match = reg.paymentProofUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).send('Format gambar tidak valid.');
    }
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', mimeType);
    res.send(buffer);
  });

  // LIST ASSETS IN FOLDER: /api/assets/:folder
  app.get('/api/assets/:folder', (req, res) => {
    const folder = req.params.folder as AssetFolder;
    if (!ASSET_FOLDERS.includes(folder)) {
      return res.status(400).json({ success: false, message: 'Folder tidak dikenal.' });
    }
    const targetDir = path.resolve(PUBLIC_DIR, folder);
    try {
      const files = fs.readdirSync(targetDir)
        .filter(f => /\.(png|jpe?g|webp|svg|gif)$/i.test(f))
        .map(f => ({
          name: f,
          url: `/${folder}/${f}`,
        }));
      res.json({ success: true, folder, files });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ADMIN: UPLOAD ASSET TO FOLDER (POST /api/admin/upload-asset)
  app.post('/api/admin/upload-asset', (req, res) => {
    try {
      const { folder, fileName, base64Data } = req.body;
      if (!ASSET_FOLDERS.includes(folder)) {
        return res.status(400).json({ success: false, message: 'Folder tujuan tidak valid.' });
      }
      if (!base64Data || !base64Data.startsWith('data:')) {
        return res.status(400).json({ success: false, message: 'File gambar base64 wajib diisi.' });
      }
      const match = base64Data.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ success: false, message: 'Format gambar harus PNG/JPG/WEBP/SVG.' });
      }
      let ext = match[1].toLowerCase().replace('+xml', '');
      if (ext === 'jpeg') ext = 'jpg';
      const safeBase = (fileName || 'asset')
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .slice(0, 40);
      const finalName = `${safeBase}-${Date.now()}.${ext}`;
      const targetPath = path.resolve(PUBLIC_DIR, folder, finalName);
      fs.writeFileSync(targetPath, Buffer.from(match[2], 'base64'));
      res.json({
        success: true,
        url: `/${folder}/${finalName}`,
        name: finalName,
        message: `File berhasil disimpan ke folder /${folder}/`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Gagal mengunggah gambar.' });
    }
  });

  // 0. REAL-TIME SYNC STREAM (SSE): Push instant updates when Admin changes form/event/quota
  app.get('/api/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // 1. PUBLIC: GET Event & Active Vaccines with Real-time Quota
  app.get('/api/event', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }
    const allComputed = computeVaccinesWithQuota(db);
    const activeVaccinesForPublic = allComputed.filter(v => v.active !== false);
    const activeBankAccounts = db.event.bankAccounts.filter(b => b.active !== false);
    const publicShareUrl = resolvePublicShareUrl(db, req);

    const publicEvent = {
      ...db.event,
      bankAccounts: activeBankAccounts,
      publicShareUrl,
    };
    delete (publicEvent as any).adminPin;

    res.json({
      success: true,
      event: publicEvent,
      vaccines: activeVaccinesForPublic,
      activeHoldsCount: db.holds.length,
      serverTime: Date.now()
    });
  });

  // Verify Admin PIN endpoint
  app.post('/api/admin/verify-pin', (req, res) => {
    const { pin } = req.body;
    const db = readDb();
    const validPin = (db.event.adminPin || 'remov2026').trim();
    if (pin && pin.trim() === validPin) {
      return res.json({ success: true, message: 'Autentikasi admin berhasil' });
    }
    return res.status(401).json({ success: false, message: 'PIN Admin tidak sesuai. Silakan coba kembali.' });
  });

  // 2. PUBLIC: Lock Quota (POST /api/quota/lock)
  app.post('/api/quota/lock', (req, res) => {
    const { vaccineId, petName, ownerName } = req.body;
    if (!vaccineId) {
      return res.status(400).json({ success: false, message: 'Vaccine ID wajib diisi' });
    }

    const db = readDb();
    cleanExpiredHoldsAndBookings(db);

    const vaccine = db.vaccines.find(v => v.id === vaccineId && v.active);
    if (!vaccine) {
      return res.status(404).json({ success: false, message: 'Pilihan vaksin tidak ditemukan atau nonaktif' });
    }

    const confirmedCount = db.registrations.filter(
      r => r.vaccineId === vaccine.id && r.paymentStatus !== 'rejected' && r.paymentStatus !== 'expired'
    ).length;

    const heldCount = db.holds.filter(
      h => h.vaccineId === vaccine.id && h.expiresAt > Date.now()
    ).length;

    const available = vaccine.totalQuota - confirmedCount - heldCount;
    if (available <= 0) {
      return res.status(409).json({
        success: false,
        message: `Maaf, kuota untuk ${vaccine.name} sudah habis atau sedang dalam proses pembayaran oleh pengguna lain.`
      });
    }

    const durationMinutes = db.event.holdDurationMinutes || 10;
    const now = Date.now();
    const expiresAt = now + durationMinutes * 60 * 1000;
    const holdId = 'hold_' + Math.random().toString(36).substring(2, 9) + '_' + now;

    const newHold: QuotaHold = {
      id: holdId,
      vaccineId,
      petName: petName || 'Anabul',
      ownerName: ownerName || 'Pawrent',
      createdAt: now,
      expiresAt,
    };

    db.holds.push(newHold);
    writeDb(db);

    const updatedAvailable = Math.max(0, available - 1);

    res.json({
      success: true,
      holdId,
      expiresAt,
      durationMinutes,
      remainingAvailable: updatedAvailable,
      message: `Kuota untuk ${vaccine.name} berhasil dikunci selama ${durationMinutes} menit.`
    });
  });

  // 3. PUBLIC: Release Quota Lock (POST /api/quota/release)
  app.post('/api/quota/release', (req, res) => {
    const { holdId } = req.body;
    if (!holdId) {
      return res.status(400).json({ success: false, message: 'holdId is required' });
    }

    const db = readDb();
    const initialLen = db.holds.length;
    db.holds = db.holds.filter(h => h.id !== holdId);

    if (db.holds.length !== initialLen) {
      writeDb(db);
    }

    res.json({ success: true, message: 'Hold kuota dilepaskan.' });
  });

  // 4. PUBLIC: Submit Registration (POST /api/registrations)
  // - Onsite-only payment/purchase policy: automatically verified with instant Queue Number (01, 02, 03...) + Barcode!
  app.post('/api/registrations', async (req, res) => {
    try {
      const regData = req.body;
      const { holdId, vaccineId } = regData;
      const vaccineNotes = regData.vaccineNotes ? String(regData.vaccineNotes).trim() : '';
      const isNoVaccine = vaccineId === 'no-vaccine' || vaccineId === 'none';

      if (!vaccineId || !regData.ownerName || !regData.ownerPhone || !regData.petName) {
        return res.status(400).json({ success: false, message: 'Lengkapi seluruh data wajib pendaftaran.' });
      }

      if (isNoVaccine && !vaccineNotes) {
        return res.status(400).json({
          success: false,
          message: 'Mohon isi kolom keterangan kebutuhan Anda karena Anda memilih tidak mengambil vaksin.'
        });
      }

      const db = readDb();
      cleanExpiredHoldsAndBookings(db);

      if (db.event.eventStatus === 'completed') {
        return res.status(409).json({
          success: false,
          eventCompleted: true,
          message: 'Event ini telah dinyatakan selesai oleh Tim Admin REMOV. Data peserta yang sudah terdaftar telah tersimpan otomatis sesuai jadwal event.'
        });
      }

      const vaccine = isNoVaccine
        ? {
            id: 'no-vaccine',
            name: 'Tidak Memilih Vaksin (Keperluan Lainnya)',
            code: 'LAIN',
            price: 0,
            totalQuota: 999999,
          }
        : db.vaccines.find(v => v.id === vaccineId);

      if (!vaccine) {
        return res.status(404).json({ success: false, message: 'Jenis vaksin tidak ditemukan.' });
      }

      const existingHoldIndex = holdId ? db.holds.findIndex(h => h.id === holdId && h.expiresAt > Date.now()) : -1;

      if (existingHoldIndex >= 0) {
        db.holds.splice(existingHoldIndex, 1);
      } else if (!isNoVaccine) {
        const confirmedCount = db.registrations.filter(
          r => r.vaccineId === vaccine.id && r.paymentStatus !== 'rejected' && r.paymentStatus !== 'expired'
        ).length;
        const heldCount = db.holds.filter(
          h => h.vaccineId === vaccine.id && h.expiresAt > Date.now()
        ).length;
        const available = vaccine.totalQuota - confirmedCount - heldCount;

        if (available <= 0) {
          return res.status(409).json({
            success: false,
            message: `Maaf! Kuota untuk ${vaccine.name} sudah habis sebelum konfirmasi berhasil.`
          });
        }
      }

      const year = new Date().getFullYear();
      const seqNumber = String(db.registrations.length + 1).padStart(4, '0');
      const regNumber = `REMOV-${year}-${vaccine.code.toUpperCase()}-${seqNumber}`;
      const regId = 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const nowIso = new Date().toISOString();

      const newRegistration: Registration = {
        id: regId,
        regNumber,
        createdAt: nowIso,
        eventTitle: db.event.title,
        ownerName: regData.ownerName.trim(),
        ownerPhone: regData.ownerPhone.trim(),
        ownerEmail: regData.ownerEmail?.trim() || '',
        ownerCity: regData.ownerCity?.trim() || '',
        ownerInstagram: regData.ownerInstagram?.trim() || '',
        referralSource: regData.referralSource || 'Formulir Online',
        petType: regData.petType || 'kucing',
        petName: regData.petName.trim(),
        petBreed: regData.petBreed?.trim() || 'Domestik / Campuran',
        petGender: regData.petGender || 'jantan',
        isSterilized: !!regData.isSterilized,
        petAge: regData.petAge?.trim() || '',
        petWeightKg: Number(regData.petWeightKg) || 0,
        petColor: regData.petColor?.trim() || '',
        previousVaccineHistory: regData.previousVaccineHistory || 'Belum pernah vaksin',
        healthConfirmation: regData.healthConfirmation || {
          isHealthy: true,
          notPregnantOrNursing: true,
          minAgeMet: true,
          noFeverOrDiarrhea: true,
          agreedToTerms: true,
        },
        healthChecklistAnswers: regData.healthChecklistAnswers || [],
        vaccineId: vaccine.id,
        vaccineName: vaccine.name,
        vaccinePrice: vaccine.price,
        vaccinePriceText: (vaccine as VaccineOption).priceText || '',
        vaccineNotes,
        selectedSession: regData.selectedSession || db.event.sessions[0] || 'Sesi Utama',
        addOns: [],
        totalAmount: vaccine.price,
        paymentMethod: vaccine.price === 0 ? 'Tanpa Biaya (Onsite)' : 'Pembayaran Onsite (Di Lokasi Event)',
        paymentBankTarget: '',
        paymentProofUrl: '',
        paymentStatus: 'verified',
        paymentDeadlineAt: undefined,
        paymentNotes: isNoVaccine
          ? 'Pendaftaran non-vaksin (keperluan lainnya) — transaksi langsung secara onsite di lokasi'
          : (vaccine.price === 0
              ? 'Pendaftaran layanan tanpa biaya booking — konfirmasi onsite di booth'
              : 'Booking terkonfirmasi — pembayaran & pembelian produk dilakukan langsung secara onsite di lokasi acara sesuai ketentuan panitia'),
        verifiedAt: nowIso,
        checkInStatus: 'belum_hadir',
        joinedWhatsAppGroup: !!regData.joinedWhatsAppGroup,
        syncedToGoogleSheet: false,
      };

      assignQueueNumberIfMissing(db, newRegistration);

      db.registrations.unshift(newRegistration);
      writeDb(db);

      // Async queued sync to Google Sheets if enabled
      if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
        const sheetItem = {
          ...newRegistration,
          paymentProofUrl: formatProofUrlForSheet(newRegistration, req),
        };
        enqueueSheetSync({
          webhookUrl: db.sheetConfig.webhookUrl,
          action: 'NEW_REGISTRATION',
          targetLabel: formatRegTargetLabel(newRegistration),
          regId: newRegistration.id,
          regNumber: newRegistration.regNumber,
          recordCount: 1,
          payload: {
            action: 'NEW_REGISTRATION',
            data: sheetItem,
            spreadsheetConfig: db.event.spreadsheetConfig,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.json({
        success: true,
        registration: newRegistration,
        message: `Sukses Booking! Nomor Antrian Anda: ${newRegistration.queueNumber}. Silakan datang langsung ke lokasi untuk pembayaran & pembelian produk secara onsite.`
      });
    } catch (err: any) {
      console.error('Error submitting registration:', err);
      res.status(500).json({ success: false, message: err.message || 'Terjadi kesalahan sistem' });
    }
  });

  // 4b. PUBLIC: Upload Payment Proof Anytime (POST /api/registrations/:id/submit-proof)
  app.post('/api/registrations/:id/submit-proof', (req, res) => {
    const { id } = req.params;
    const { paymentProofUrl, paymentMethod, paymentBankTarget, joinedWhatsAppGroup } = req.body;

    if (!paymentProofUrl || !String(paymentProofUrl).trim()) {
      return res.status(400).json({ success: false, message: 'Mohon unggah foto atau masukkan link bukti pembayaran.' });
    }

    const db = readDb();
    cleanExpiredHoldsAndBookings(db);

    const reg = db.registrations.find(r => r.id === id || r.regNumber.toUpperCase() === id.toUpperCase());
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
    }

    const proofUrl = String(paymentProofUrl).trim();
    reg.paymentProofUrl = proofUrl;
    reg.paymentProofType = proofUrl.startsWith('data:') ? 'upload' : (proofUrl.startsWith('http') ? 'link' : 'upload');
    if (paymentMethod) reg.paymentMethod = paymentMethod;
    if (paymentBankTarget) reg.paymentBankTarget = paymentBankTarget;
    if (joinedWhatsAppGroup !== undefined) reg.joinedWhatsAppGroup = !!joinedWhatsAppGroup;

    reg.paymentStatus = 'verified';
    reg.verifiedAt = new Date().toISOString();
    reg.paymentDeadlineAt = undefined;
    reg.paymentNotes = 'Otomatis terverifikasi setelah bukti payment diunggah';
    assignQueueNumberIfMissing(db, reg);
    writeDb(db);

    if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
      enqueueSheetSync({
        webhookUrl: db.sheetConfig.webhookUrl,
        action: 'UPDATE_STATUS',
        targetLabel: formatRegTargetLabel(reg),
        regId: reg.id,
        regNumber: reg.regNumber,
        recordCount: 1,
        payload: {
          action: 'UPDATE_STATUS',
          data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
          spreadsheetConfig: db.event.spreadsheetConfig,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      registration: reg,
      message: `Pembayaran terverifikasi otomatis! Nomor Antrian Anda adalah ${reg.queueNumber}.`
    });
  });

  // 5. ADMIN / PANITIA: Check Registration Status / Barcode / Queue Lookup (Active + Archived Events)
  app.get('/api/registrations/:idOrNumber', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const rawQuery = decodeURIComponent(req.params.idOrNumber).trim();
    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }

    // Prioritize exact ID / RegNumber / Queue / Barcode / Phone before fuzzy name match
    const upper = rawQuery.toUpperCase();
    const padded = /^\d+$/.test(rawQuery) ? rawQuery.padStart(2, '0') : '';
    const phoneDigits = normalizePhoneDigits(rawQuery);
    const isExactMatch = (r: Registration) =>
      r.id === rawQuery ||
      r.regNumber.toUpperCase() === upper ||
      (!!r.barcodeCode && r.barcodeCode.toUpperCase() === upper) ||
      (!!r.queueNumber &&
        (r.queueNumber.toUpperCase() === upper ||
          (!!padded && r.queueNumber === padded) ||
          `Q${r.queueNumber}` === upper)) ||
      (phoneDigits.length >= 6 && normalizePhoneDigits(r.ownerPhone) === phoneDigits);

    const findAllMatching = (list: Registration[]) => {
      const exacts = list.filter(isExactMatch);
      if (exacts.length > 0) return exacts;
      return list.filter(r => matchRegistrationQuery(r, rawQuery));
    };

    const activeMatches = findAllMatching(db.registrations);
    if (activeMatches.length > 0) {
      const publicEvt = { ...db.event };
      delete (publicEvt as any).adminPin;
      return res.json({
        success: true,
        registration: activeMatches[0],
        matches: activeMatches.map(r => ({ registration: r, isArchived: false })),
        event: publicEvt,
        isArchived: false,
      });
    }

    // Fallback: search completed/archived events so historical customer records remain retrievable by schedule!
    for (const arc of db.archives) {
      if (!Array.isArray(arc.registrations) || arc.registrations.length === 0) continue;
      const archivedMatches = findAllMatching(arc.registrations);
      if (archivedMatches.length > 0) {
        const arcEvent = {
          ...db.event,
          title: arc.eventTitle || db.event.title,
          date: arc.eventDate || db.event.date,
          timeRange: arc.timeRange || db.event.timeRange,
          locationName: arc.locationName || db.event.locationName,
          locationAddress: arc.locationAddress || db.event.locationAddress,
          partnerName: arc.partnerName || db.event.partnerName,
          eventStatus: 'completed' as const,
          eventCompletedStatement: arc.completionStatement || db.event.eventCompletedStatement || '',
          eventCompletedAt: arc.archivedAt,
        };
        delete (arcEvent as any).adminPin;
        const archiveInfo = {
          id: arc.id,
          eventTitle: arc.eventTitle,
          eventDate: arc.eventDate,
          timeRange: arc.timeRange,
          month: arc.month,
          year: arc.year,
          locationName: arc.locationName,
          partnerName: arc.partnerName,
          completionStatement: arc.completionStatement,
          archivedAt: arc.archivedAt,
        };
        return res.json({
          success: true,
          registration: archivedMatches[0],
          matches: archivedMatches.map(r => ({ registration: r, isArchived: true, archiveInfo })),
          event: arcEvent,
          isArchived: true,
          archiveInfo,
        });
      }
    }

    return res.status(404).json({
      success: false,
      message: 'Data pendaftaran / Nomor Antrian tidak ditemukan pada jadwal event aktif maupun arsip.'
    });
  });

  // 5b. PUBLIC: Batch Real-Time Sync for Customer Device Saved Registrations
  app.post('/api/registrations/sync-batch', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const ids: string[] = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => String(id).trim()).filter(Boolean).slice(0, 20)
      : [];

    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }

    const items: Record<string, { registration: Registration; isArchived: boolean; archiveInfo?: any }> = {};
    for (const id of ids) {
      const activeReg = db.registrations.find(r => r.id === id);
      if (activeReg) {
        items[id] = { registration: activeReg, isArchived: false };
        continue;
      }
      for (const arc of db.archives) {
        const arcReg = (arc.registrations || []).find(r => r.id === id);
        if (arcReg) {
          items[id] = {
            registration: arcReg,
            isArchived: true,
            archiveInfo: {
              id: arc.id,
              eventTitle: arc.eventTitle,
              eventDate: arc.eventDate,
              timeRange: arc.timeRange,
              locationName: arc.locationName,
              completionStatement: arc.completionStatement,
            },
          };
          break;
        }
      }
    }

    res.json({
      success: true,
      items,
      eventStatus: db.event.eventStatus || 'active',
      serverTime: Date.now(),
    });
  });

  // 5c. PUBLIC: Track Real-Time WhatsApp Group Join from Customer Ticket
  app.post('/api/registrations/:id/whatsapp-joined', (req, res) => {
    const db = readDb();
    const reg = db.registrations.find(r => r.id === req.params.id);
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
    }
    if (!reg.joinedWhatsAppGroup) {
      reg.joinedWhatsAppGroup = true;
      writeDb(db);
      if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
        enqueueSheetSync({
          webhookUrl: db.sheetConfig.webhookUrl,
          action: 'UPDATE_STATUS',
          targetLabel: formatRegTargetLabel(reg),
          regId: reg.id,
          regNumber: reg.regNumber,
          recordCount: 1,
          payload: {
            action: 'UPDATE_STATUS',
            eventTitle: db.event.title,
            spreadsheetConfig: db.event.spreadsheetConfig,
            data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
          }
        });
      }
    }
    res.json({ success: true, registration: reg });
  });

  // 5a. ADMIN: Real-time Ticket & Check-In Directory (Active + Archived Search)
  app.get('/api/admin/ticket-directory', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }

    const q = String(req.query.q || '').trim();
    const activeRegistrations = q
      ? db.registrations.filter(r => matchRegistrationQuery(r, q))
      : db.registrations;

    const archivedMatches: Array<{
      registration: Registration;
      archiveInfo: {
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
      };
    }> = [];

    if (q) {
      for (const arc of db.archives) {
        if (!Array.isArray(arc.registrations)) continue;
        for (const r of arc.registrations) {
          if (matchRegistrationQuery(r, q)) {
            archivedMatches.push({
              registration: r,
              archiveInfo: {
                id: arc.id,
                eventTitle: arc.eventTitle,
                eventDate: arc.eventDate,
                timeRange: arc.timeRange,
                month: arc.month,
                year: arc.year,
                locationName: arc.locationName,
                partnerName: arc.partnerName,
                completionStatement: arc.completionStatement,
                archivedAt: arc.archivedAt,
              },
            });
          }
        }
      }
    }

    res.json({
      success: true,
      eventStatus: db.event.eventStatus || 'active',
      eventCompletedAt: db.event.eventCompletedAt,
      eventCompletedStatement: db.event.eventCompletedStatement || '',
      eventCompletedBy: db.event.eventCompletedBy || '',
      eventTitle: db.event.title,
      eventDate: db.event.date,
      eventTimeRange: db.event.timeRange,
      activeRegistrations,
      totalActiveCount: db.registrations.length,
      archivedMatches: archivedMatches.slice(0, 20),
      serverTime: Date.now(),
    });
  });

  // 5b. ADMIN: Booth Barcode Check-In / Status Update (POST /api/admin/registrations/:id/check-in)
  app.post('/api/admin/registrations/:id/check-in', (req, res) => {
    const { id } = req.params;
    const { checkInStatus } = req.body;
    const db = readDb();

    const reg = db.registrations.find(r => r.id === id || r.regNumber === id);
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
    }

    reg.checkInStatus = checkInStatus || 'sudah_hadir';
    if (reg.checkInStatus === 'sudah_hadir' || reg.checkInStatus === 'selesai_vaksin') {
      reg.checkedInAt = reg.checkedInAt || new Date().toISOString();
    } else if (reg.checkInStatus === 'belum_hadir') {
      reg.checkedInAt = undefined;
    }

    writeDb(db);

    if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
      enqueueSheetSync({
        webhookUrl: db.sheetConfig.webhookUrl,
        action: 'CHECK_IN_UPDATE',
        targetLabel: formatRegTargetLabel(reg),
        regId: reg.id,
        regNumber: reg.regNumber,
        recordCount: 1,
        payload: {
          action: 'CHECK_IN_UPDATE',
          data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
          spreadsheetConfig: db.event.spreadsheetConfig,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      registration: reg,
      message: `Status kehadiran booth antrian #${reg.queueNumber || '-'} berhasil diperbarui.`
    });
  });

  // 5c. ADMIN: Reschedule / Geser Kloter Peserta (POST /api/admin/registrations/:id/reschedule)
  app.post('/api/admin/registrations/:id/reschedule', (req, res) => {
    const { id } = req.params;
    const { newSession } = req.body;
    if (!newSession) {
      return res.status(400).json({ success: false, message: 'Kloter tujuan wajib dipilih.' });
    }
    const db = readDb();
    const reg = db.registrations.find(r => r.id === id);
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
    }

    if (!reg.rescheduledFromSession) {
      reg.rescheduledFromSession = reg.selectedSession;
    }
    reg.selectedSession = newSession;
    writeDb(db);

    if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
      enqueueSheetSync({
        webhookUrl: db.sheetConfig.webhookUrl,
        action: 'UPDATE_STATUS',
        targetLabel: formatRegTargetLabel(reg),
        regId: reg.id,
        regNumber: reg.regNumber,
        recordCount: 1,
        payload: {
          action: 'UPDATE_STATUS',
          data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
          spreadsheetConfig: db.event.spreadsheetConfig,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      registration: reg,
      message: `Jadwal ${reg.ownerName} (${reg.petName}) berhasil digeser ke ${newSession}.`
    });
  });

  // 6. ADMIN: Full Data (GET /api/admin/data)
  app.get('/api/admin/data', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }
    const vaccinesWithQuota = computeVaccinesWithQuota(db);

    const stats = {
      totalRegistrations: db.registrations.length,
      verifiedCount: db.registrations.filter(r => r.paymentStatus === 'verified').length,
      pendingCount: db.registrations.filter(r => r.paymentStatus === 'pending' || r.paymentStatus === 'pending_payment').length,
      expiredCount: db.registrations.filter(r => r.paymentStatus === 'expired').length,
      rejectedCount: db.registrations.filter(r => r.paymentStatus === 'rejected').length,
      checkedInCount: db.registrations.filter(r => r.checkInStatus === 'sudah_hadir' || r.checkInStatus === 'selesai_vaksin').length,
      notArrivedVerifiedCount: db.registrations.filter(r => r.paymentStatus === 'verified' && (!r.checkInStatus || r.checkInStatus === 'belum_hadir' || r.checkInStatus === 'tidak_hadir')).length,
      catCount: db.registrations.filter(r => r.petType === 'kucing').length,
      dogCount: db.registrations.filter(r => r.petType === 'anjing').length,
      proofCount: db.registrations.filter(r => !!r.paymentProofUrl).length,
      totalRevenue: db.registrations
        .filter(r => r.paymentStatus === 'verified')
        .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      totalPotentialRevenue: db.registrations
        .filter(r => r.paymentStatus !== 'rejected' && r.paymentStatus !== 'expired')
        .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      activeHoldsCount: db.holds.length,
      activeVouchersCount: db.vouchers.filter(v => v.status === 'active').length,
      redeemedVouchersCount: db.vouchers.filter(v => v.status === 'redeemed').length,
    };

    res.json({
      success: true,
      event: {
        ...db.event,
        publicShareUrl: resolvePublicShareUrl(db, req),
      },
      vaccines: vaccinesWithQuota,
      registrations: db.registrations,
      holds: db.holds,
      vouchers: db.vouchers,
      archives: db.archives,
      sheetConfig: db.sheetConfig,
      sheetAuditLogs: db.sheetAuditLogs || [],
      sheetSyncState: getSheetSyncLiveState(db),
      stats,
      serverTime: Date.now()
    });
  });

  // 7. ADMIN: Update Event Info, Logos, Background, Checklist, & Ticket Copy (POST /api/admin/event)
  app.post('/api/admin/event', (req, res) => {
    const db = readDb();
    const incoming = { ...(req.body || {}) };
    delete incoming.publicShareUrl;
    delete incoming.queueCounter;
    delete incoming.eventStatus;
    delete incoming.eventCompletedAt;
    delete incoming.eventCompletedStatement;
    delete incoming.eventCompletedBy;
    delete incoming.lastArchivedId;

    const updatedChecklist = Array.isArray(incoming.healthChecklistItems)
      ? incoming.healthChecklistItems
      : db.event.healthChecklistItems;

    const nextAdminPin =
      incoming.adminPin !== undefined && String(incoming.adminPin).trim() !== ''
        ? String(incoming.adminPin).trim()
        : db.event.adminPin;

    db.event = {
      ...db.event,
      ...incoming,
      adminPin: nextAdminPin,
      queueCounter: db.event.queueCounter,
      eventStatus: db.event.eventStatus,
      eventCompletedAt: db.event.eventCompletedAt,
      eventCompletedStatement: db.event.eventCompletedStatement,
      eventCompletedBy: db.event.eventCompletedBy,
      lastArchivedId: db.event.lastArchivedId,
      healthChecklistItems: updatedChecklist,
      termsAndConditions: Array.isArray(updatedChecklist)
        ? updatedChecklist.map((c: HealthChecklistItem) => c.text)
        : db.event.termsAndConditions,
    };
    writeDb(db);
    res.json({
      success: true,
      event: {
        ...db.event,
        publicShareUrl: resolvePublicShareUrl(db, req),
      },
      message: 'Pengaturan event berhasil diperbarui.'
    });
  });

  // 8. ADMIN: Manage Vaccines (POST /api/admin/vaccines)
  app.post('/api/admin/vaccines', (req, res) => {
    const { action, vaccine } = req.body;
    const db = readDb();
    const cleanIncoming = vaccine ? { ...vaccine } : {};
    delete cleanIncoming.confirmedCount;
    delete cleanIncoming.heldCount;
    delete cleanIncoming.availableQuota;
    delete cleanIncoming.isSoldOut;

    if (action === 'create') {
      const parsedQuota = cleanIncoming.totalQuota !== undefined && cleanIncoming.totalQuota !== ''
        ? Math.max(0, Number(cleanIncoming.totalQuota) || 0)
        : 20;
      const newVac: VaccineOption = {
        id: 'vac_' + Date.now(),
        name: cleanIncoming.name,
        code: (cleanIncoming.code || cleanIncoming.name.substring(0, 4)).toUpperCase(),
        category: cleanIncoming.category || 'semua',
        totalQuota: parsedQuota,
        price: Math.max(0, Number(cleanIncoming.price) || 0),
        priceText: cleanIncoming.priceText ? String(cleanIncoming.priceText).trim() : '',
        description: cleanIncoming.description || '',
        minAgeMonths: Number(cleanIncoming.minAgeMonths) || 2,
        active: cleanIncoming.active !== false,
        notes: cleanIncoming.notes || ''
      };
      db.vaccines.push(newVac);
    } else if (action === 'update') {
      const idx = db.vaccines.findIndex(v => v.id === cleanIncoming.id);
      if (idx >= 0) {
        db.vaccines[idx] = {
          ...db.vaccines[idx],
          ...cleanIncoming,
          totalQuota: Math.max(0, Number(cleanIncoming.totalQuota) || 0),
          price: Math.max(0, Number(cleanIncoming.price) || 0),
          priceText: cleanIncoming.priceText !== undefined
            ? String(cleanIncoming.priceText).trim()
            : (db.vaccines[idx].priceText || ''),
          minAgeMonths: Number(cleanIncoming.minAgeMonths),
          active: cleanIncoming.active !== undefined ? !!cleanIncoming.active : db.vaccines[idx].active,
        };
      }
    } else if (action === 'empty-all-quotas') {
      db.vaccines = db.vaccines.map(v => ({ ...v, totalQuota: 0 }));
      db.holds = [];
    } else if (action === 'toggle') {
      const idx = db.vaccines.findIndex(v => v.id === cleanIncoming.id);
      if (idx >= 0) {
        db.vaccines[idx].active = !db.vaccines[idx].active;
      }
    } else if (action === 'delete') {
      const targetId = String(cleanIncoming?.id || '');
      db.vaccines = db.vaccines.filter(v => String(v.id) !== targetId);
      db.holds = db.holds.filter(h => String(h.vaccineId) !== targetId);
    }

    writeDb(db);
    const updated = computeVaccinesWithQuota(db);
    res.json({ success: true, vaccines: updated, message: 'Daftar vaksin berhasil diperbarui.' });
  });

  // 9. ADMIN: Manage Destination Bank Accounts (POST /api/admin/bank-accounts)
  app.post('/api/admin/bank-accounts', (req, res) => {
    const { action, account } = req.body;
    const db = readDb();

    if (!db.event.bankAccounts) {
      db.event.bankAccounts = [];
    }

    if (action === 'create') {
      const newAcc: BankAccount = {
        id: 'bank_' + Date.now(),
        bankName: account.bankName || 'Bank Baru',
        accountNumber: account.accountNumber || '',
        accountHolder: account.accountHolder || 'REMOV',
        qrisUrl: account.qrisUrl || '',
        notes: account.notes || '',
        active: account.active !== false,
      };
      db.event.bankAccounts.push(newAcc);
    } else if (action === 'update') {
      const idx = db.event.bankAccounts.findIndex(b => b.id === account.id);
      if (idx >= 0) {
        db.event.bankAccounts[idx] = {
          ...db.event.bankAccounts[idx],
          ...account,
          active: account.active !== undefined ? !!account.active : db.event.bankAccounts[idx].active,
        };
      }
    } else if (action === 'toggle') {
      const idx = db.event.bankAccounts.findIndex(b => b.id === account.id);
      if (idx >= 0) {
        db.event.bankAccounts[idx].active = !db.event.bankAccounts[idx].active;
      }
    } else if (action === 'delete') {
      db.event.bankAccounts = db.event.bankAccounts.filter(b => b.id !== account.id);
    }

    writeDb(db);
    res.json({
      success: true,
      bankAccounts: db.event.bankAccounts,
      message: 'Rekening tujuan pembayaran berhasil diperbarui.'
    });
  });

  // 10. ADMIN: Update Registration Payment Status (POST /api/admin/registrations/:id/status)
  app.post('/api/admin/registrations/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const db = readDb();

    const reg = db.registrations.find(r => r.id === id);
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
    }

    reg.paymentStatus = status;
    if (notes !== undefined) reg.paymentNotes = notes;
    if (status === 'verified') {
      reg.verifiedAt = new Date().toISOString();
      reg.paymentDeadlineAt = undefined;
      assignQueueNumberIfMissing(db, reg);
    }
    writeDb(db);

    if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
      enqueueSheetSync({
        webhookUrl: db.sheetConfig.webhookUrl,
        action: 'UPDATE_STATUS',
        targetLabel: formatRegTargetLabel(reg),
        regId: reg.id,
        regNumber: reg.regNumber,
        recordCount: 1,
        payload: {
          action: 'UPDATE_STATUS',
          data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
          spreadsheetConfig: db.event.spreadsheetConfig,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({ success: true, registration: reg, message: 'Status pembayaran berhasil diubah.' });
  });

  // 11. ADMIN: Delete Registration (DELETE /api/admin/registrations/:id)
  app.delete('/api/admin/registrations/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const initialLen = db.registrations.length;
    db.registrations = db.registrations.filter(r => r.id !== id);

    if (db.registrations.length !== initialLen) {
      writeDb(db);
    }

    res.json({ success: true, message: 'Data pendaftaran dihapus. Kuota otomatis kembali tersedia.' });
  });

  // 12. ADMIN: Release Stuck Hold (POST /api/admin/holds/:id/release)
  app.post('/api/admin/holds/:id/release', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    db.holds = db.holds.filter(h => h.id !== id);
    writeDb(db);
    res.json({ success: true, message: 'Slot hold berhasil dilepaskan ke kuota umum.' });
  });

  // 13. ADMIN: Single-Use Petshop Voucher Management
  app.post('/api/admin/vouchers/template', (req, res) => {
    const db = readDb();
    db.event.voucherTemplate = {
      ...db.event.voucherTemplate,
      ...req.body,
    };
    writeDb(db);
    res.json({ success: true, voucherTemplate: db.event.voucherTemplate, message: 'Template voucher berhasil diperbarui.' });
  });

  app.post('/api/admin/vouchers/generate', (req, res) => {
    const { registrationId, customCode, title, benefitText, imageUrl, validUntil, ownerName, ownerPhone, petName, vaccineName } = req.body;
    const db = readDb();
    const tpl = db.event.voucherTemplate;

    const reg = registrationId ? db.registrations.find(r => r.id === registrationId) : undefined;
    if (reg && reg.voucherCode) {
      return res.status(409).json({
        success: false,
        message: `Peserta ${reg.ownerName} sudah memiliki voucher aktif/terbit dengan kode ${reg.voucherCode}.`
      });
    }

    const prefix = (tpl.codePrefix || 'REMOV-PS').toUpperCase().trim();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const finalCode = (customCode && String(customCode).trim())
      ? String(customCode).trim().toUpperCase()
      : `${prefix}-${reg?.queueNumber || '00'}-${randomSuffix}`;

    // Enforce strict uniqueness across all vouchers (active, redeemed, void) so codes never repeat/double
    if (db.vouchers.some(v => v.code.toUpperCase() === finalCode)) {
      return res.status(409).json({
        success: false,
        message: `Kode voucher "${finalCode}" sudah pernah dipakai/diterbitkan sebelumnya! Gunakan kode unik lainnya.`
      });
    }

    const newVoucher: Voucher = {
      id: 'vch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      code: finalCode,
      title: title || tpl.title,
      benefitText: benefitText || tpl.benefitText,
      imageUrl: imageUrl || tpl.imageUrl || '/vouchers/voucher-remov-default.svg',
      registrationId: reg?.id,
      regNumber: reg?.regNumber,
      queueNumber: reg?.queueNumber,
      ownerName: reg?.ownerName || ownerName || 'Pawrent',
      ownerPhone: reg?.ownerPhone || ownerPhone || '-',
      petName: reg?.petName || petName || '-',
      vaccineName: reg?.vaccineName || vaccineName || '-',
      status: 'active',
      createdAt: new Date().toISOString(),
      validUntil: validUntil || tpl.validUntil,
    };

    if (reg) {
      reg.checkInStatus = 'tidak_hadir';
      reg.voucherId = newVoucher.id;
      reg.voucherCode = newVoucher.code;
    }

    db.vouchers.unshift(newVoucher);
    writeDb(db);

    res.json({
      success: true,
      voucher: newVoucher,
      message: `Voucher ${newVoucher.code} berhasil diterbitkan untuk ${newVoucher.ownerName}.`
    });
  });

  // Redeem / Hanguskan Voucher (Strictly Single-Use!)
  app.post('/api/admin/vouchers/redeem', (req, res) => {
    const { code, redeemedNotes } = req.body;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Masukkan kode voucher yang akan ditukarkan.' });
    }
    const db = readDb();
    const upper = String(code).trim().toUpperCase();
    const voucher = db.vouchers.find(v => v.code.toUpperCase() === upper);

    if (!voucher) {
      return res.status(404).json({ success: false, message: `Kode voucher "${upper}" tidak ditemukan.` });
    }
    if (voucher.status === 'redeemed') {
      return res.status(409).json({
        success: false,
        voucher,
        message: `DITOLAK (SUDAH HANGUS): Kode voucher "${upper}" sudah pernah digunakan pada ${new Date(voucher.redeemedAt || '').toLocaleString('id-ID')} dan tidak dapat dipakai ulang!`
      });
    }
    if (voucher.status === 'void') {
      return res.status(409).json({
        success: false,
        voucher,
        message: `Kode voucher "${upper}" sudah dinonaktifkan oleh admin.`
      });
    }

    voucher.status = 'redeemed';
    voucher.redeemedAt = new Date().toISOString();
    voucher.redeemedNotes = redeemedNotes || 'Ditukarkan di Petshop Partner REMOV';
    writeDb(db);

    res.json({
      success: true,
      voucher,
      message: `Voucher ${voucher.code} berhasil ditukarkan dan kini berstatus HANGUS (1x pakai selesai).`
    });
  });

  app.delete('/api/admin/vouchers/:id', (req, res) => {
    const db = readDb();
    db.vouchers = db.vouchers.filter(v => v.id !== req.params.id);
    writeDb(db);
    res.json({ success: true, message: 'Voucher dihapus.' });
  });

  // 14a. ADMIN: Official Statement That Team Admin Completed Event -> Auto-Save Schedule Archive & Keep Live Data Synced
  app.post('/api/admin/events/complete', (req, res) => {
    const {
      statement,
      completedBy,
      partnerName,
      partnerLogoUrl,
      city,
      summaryNotes,
      documentationPhotos,
      programsRun,
    } = req.body || {};

    const db = readDb();
    const defaultStatement = `Tim Admin REMOV menyatakan bahwa acara "${db.event.title}" pada jadwal ${db.event.date} (${db.event.timeRange}) di ${db.event.locationName} telah selesai dilaksanakan. Seluruh data peserta telah tersimpan otomatis sesuai jadwal pelaksanaan.`;

    db.event.eventStatus = 'completed';
    db.event.eventCompletedAt = new Date().toISOString();
    db.event.eventCompletedStatement = (statement && String(statement).trim())
      ? String(statement).trim()
      : defaultStatement;
    db.event.eventCompletedBy = (completedBy && String(completedBy).trim())
      ? String(completedBy).trim()
      : 'Tim Admin REMOV';

    // Match existing archive for the same event schedule or lastArchivedId so no duplicate archive is created
    const existingIdx = db.event.lastArchivedId
      ? db.archives.findIndex(a => a.id === db.event.lastArchivedId)
      : db.archives.findIndex(a => a.eventTitle === db.event.title && a.eventDate === db.event.date);

    const archiveRecord = buildArchiveRecordFromDb(db, {
      id: existingIdx >= 0 ? db.archives[existingIdx].id : undefined,
      partnerName,
      partnerLogoUrl,
      city,
      programsRun,
      summaryNotes,
      completionStatement: db.event.eventCompletedStatement,
      completedBy: db.event.eventCompletedBy,
      documentationPhotos: Array.isArray(documentationPhotos)
        ? documentationPhotos
        : (existingIdx >= 0 ? db.archives[existingIdx].documentationPhotos : []),
    });

    if (existingIdx >= 0) {
      db.archives[existingIdx] = archiveRecord;
    } else {
      db.archives.unshift(archiveRecord);
    }

    db.event.lastArchivedId = archiveRecord.id;
    writeDb(db);

    if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
      const cleanItems = db.registrations.map(r => ({
        ...r,
        paymentProofUrl: formatProofUrlForSheet(r, req),
      }));
      enqueueSheetSync({
        webhookUrl: db.sheetConfig.webhookUrl,
        action: 'EVENT_COMPLETED_FINAL_SYNC',
        targetLabel: `Finalisasi Event (${cleanItems.length} Peserta)`,
        markAllSynced: true,
        recordCount: cleanItems.length,
        payload: {
          action: 'EVENT_COMPLETED_FINAL_SYNC',
          eventTitle: db.event.title,
          eventDate: db.event.date,
          timeRange: db.event.timeRange,
          completionStatement: db.event.eventCompletedStatement,
          completedAt: db.event.eventCompletedAt,
          count: cleanItems.length,
          items: cleanItems,
          spreadsheetConfig: db.event.spreadsheetConfig,
          timestamp: new Date().toISOString(),
        }
      });
    }

    res.json({
      success: true,
      event: {
        ...db.event,
        publicShareUrl: resolvePublicShareUrl(db, req),
      },
      archive: archiveRecord,
      message: `Event dinyatakan selesai oleh ${db.event.eventCompletedBy} & seluruh data (${db.registrations.length} peserta) otomatis tersimpan ke arsip jadwal ${db.event.date}!`,
    });
  });

  // 14b. ADMIN: Reopen Completed Event Back to Active
  app.post('/api/admin/events/reopen', (req, res) => {
    const db = readDb();
    db.event.eventStatus = 'active';
    db.event.eventCompletedAt = undefined;
    db.event.eventCompletedStatement = '';
    db.event.eventCompletedBy = '';
    writeDb(db);
    res.json({
      success: true,
      event: {
        ...db.event,
        publicShareUrl: resolvePublicShareUrl(db, req),
      },
      message: 'Status event dibuka kembali menjadi AKTIF sehingga formulir & pembaruan pendaftaran berjalan normal.',
    });
  });

  // 14. ADMIN: Event Archive & Portfolio Management + Reset Queue Counter for Next Scheduled Event
  app.post('/api/admin/events/archive-and-reset', (req, res) => {
    const {
      partnerName,
      partnerLogoUrl,
      city,
      month,
      year,
      programsRun,
      summaryNotes,
      completionStatement,
      completedBy,
      documentationPhotos,
      resetRegistrations,
      nextEventTitle,
      nextEventDate,
      nextTimeRange,
      nextLocationName,
    } = req.body;

    const db = readDb();
    const existingIdx = db.event.lastArchivedId
      ? db.archives.findIndex(a => a.id === db.event.lastArchivedId)
      : -1;

    const newArchive = buildArchiveRecordFromDb(db, {
      id: existingIdx >= 0 ? db.archives[existingIdx].id : undefined,
      partnerName,
      partnerLogoUrl,
      city,
      month,
      year,
      programsRun,
      summaryNotes,
      completionStatement: completionStatement || db.event.eventCompletedStatement || `Event ${db.event.title} (${db.event.date}) selesai dilaksanakan dan diarsipkan oleh Tim Admin REMOV.`,
      completedBy: completedBy || db.event.eventCompletedBy || 'Tim Admin REMOV',
      documentationPhotos: Array.isArray(documentationPhotos) && documentationPhotos.length > 0
        ? documentationPhotos
        : (existingIdx >= 0 ? db.archives[existingIdx].documentationPhotos : []),
    });

    if (existingIdx >= 0) {
      db.archives[existingIdx] = newArchive;
    } else {
      db.archives.unshift(newArchive);
    }

    // Reset queue counter & completion flags cleanly for the next scheduled event
    db.event.queueCounter = 0;
    db.event.eventStatus = 'active';
    db.event.eventCompletedAt = undefined;
    db.event.eventCompletedStatement = '';
    db.event.eventCompletedBy = '';
    db.event.lastArchivedId = undefined;

    if (resetRegistrations !== false) {
      db.registrations = [];
      db.holds = [];
    }
    if (nextEventTitle) db.event.title = nextEventTitle;
    if (nextEventDate) db.event.date = nextEventDate;
    if (nextTimeRange) db.event.timeRange = nextTimeRange;
    if (nextLocationName) db.event.locationName = nextLocationName;

    writeDb(db);
    res.json({
      success: true,
      archive: newArchive,
      message: 'Event berhasil diarsipkan sesuai jadwal ke Portofolio REMOV & nomor antrian direset kembali ke 01 untuk jadwal event berikutnya!'
    });
  });

  app.post('/api/admin/archives', (req, res) => {
    const { action, archive } = req.body;
    const db = readDb();

    if (action === 'create') {
      const created: EventArchive = {
        id: 'arc_' + Date.now(),
        eventTitle: archive.eventTitle || 'Event Pawrenting REMOV',
        subtitle: archive.subtitle || '',
        locationName: archive.locationName || '',
        locationAddress: archive.locationAddress || '',
        city: archive.city || '',
        eventDate: archive.eventDate || '',
        month: archive.month || '',
        year: archive.year || String(new Date().getFullYear()),
        partnerName: archive.partnerName || '',
        partnerLogoUrl: archive.partnerLogoUrl || '',
        programsRun: Array.isArray(archive.programsRun) ? archive.programsRun : [],
        summaryNotes: archive.summaryNotes || '',
        documentationPhotos: Array.isArray(archive.documentationPhotos) ? archive.documentationPhotos : [],
        totalRegistrations: Number(archive.totalRegistrations) || 0,
        totalAttended: Number(archive.totalAttended) || 0,
        totalVaccinatedByVaccine: archive.totalVaccinatedByVaccine || [],
        registrations: archive.registrations || [],
        archivedAt: new Date().toISOString(),
      };
      db.archives.unshift(created);
    } else if (action === 'update') {
      const idx = db.archives.findIndex(a => a.id === archive.id);
      if (idx >= 0) {
        db.archives[idx] = { ...db.archives[idx], ...archive };
      }
    } else if (action === 'delete') {
      const targetId = archive?.id;
      if (targetId) {
        db.archives = db.archives.filter(a => String(a.id) !== String(targetId));
      }
    }

    writeDb(db);
    res.json({ success: true, archives: db.archives, message: 'Arsip portofolio berhasil diperbarui.' });
  });

  app.delete('/api/admin/archives/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    db.archives = db.archives.filter(a => String(a.id) !== String(id));
    writeDb(db);
    res.json({ success: true, archives: db.archives, message: 'Arsip portofolio berhasil dihapus.' });
  });

  // 15. ADMIN: Configure Google Sheets Webhook & Grouping Format
  app.post('/api/admin/sheet-config', (req, res) => {
    const { webhookUrl, autoSync, spreadsheetConfig } = req.body;
    const db = readDb();
    if (webhookUrl !== undefined) db.sheetConfig.webhookUrl = webhookUrl.trim();
    if (autoSync !== undefined) db.sheetConfig.autoSync = !!autoSync;
    if (spreadsheetConfig) {
      db.event.spreadsheetConfig = {
        ...db.event.spreadsheetConfig,
        ...spreadsheetConfig,
      };
    }
    writeDb(db);
    res.json({
      success: true,
      sheetConfig: db.sheetConfig,
      spreadsheetConfig: db.event.spreadsheetConfig,
      message: 'Pengaturan Google Sheets & format pengelompokan tabel disimpan.'
    });
  });

  // 16. ADMIN: Test Google Sheets Webhook (POST /api/admin/sheet-test)
  app.post('/api/admin/sheet-test', async (req, res) => {
    const { webhookUrl } = req.body;
    const currentDb = readDb();
    const url = webhookUrl || currentDb.sheetConfig.webhookUrl;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL Webhook Google Sheets belum diisi.' });
    }

    const testPayload = {
      action: 'TEST_CONNECTION',
      message: 'Uji koneksi sinkronisasi Pawrenting REMOV berhasil!',
      timestamp: new Date().toISOString(),
      sampleData: {
        regNumber: 'TEST-0001',
        queueNumber: '01',
        ownerName: 'Uji Koneksi Pawrenting REMOV',
        petName: 'Anabul Test',
        vaccine: 'RABIES'
      }
    };

    const result = await enqueueSheetSyncAndWait({
      webhookUrl: url,
      action: 'TEST_CONNECTION',
      targetLabel: 'Uji Koneksi Webhook',
      recordCount: 1,
      maxAttempts: 1,
      payload: testPayload,
    });

    res.json(result);
  });

  // 17. ADMIN: Sync All Registrations to Google Sheets (POST /api/admin/sheet-sync)
  app.post('/api/admin/sheet-sync', async (req, res) => {
    const db = readDb();
    const url = db.sheetConfig.webhookUrl;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL Webhook Google Sheets belum diatur.' });
    }

    const cleanItems = db.registrations.map(r => ({
      ...r,
      paymentProofUrl: formatProofUrlForSheet(r, req),
    }));

    const payload = {
      action: 'SYNC_ALL_REGISTRATIONS',
      eventTitle: db.event.title,
      eventDate: db.event.date,
      count: cleanItems.length,
      items: cleanItems,
      spreadsheetConfig: db.event.spreadsheetConfig,
      timestamp: new Date().toISOString()
    };

    const result = await enqueueSheetSyncAndWait({
      webhookUrl: url,
      action: 'SYNC_ALL_REGISTRATIONS',
      targetLabel: `Sinkronisasi Penuh (${cleanItems.length} Peserta)`,
      markAllSynced: true,
      recordCount: cleanItems.length,
      maxAttempts: 3,
      payload,
    });

    const latestDb = readDb();
    res.json({
      ...result,
      syncedCount: cleanItems.length,
      sheetConfig: latestDb.sheetConfig,
      sheetAuditLogs: latestDb.sheetAuditLogs || [],
      sheetSyncState: getSheetSyncLiveState(latestDb),
    });
  });

  // 17a. ADMIN: Sync Only Unsynced / Pending Registrations to Google Sheets (POST /api/admin/sheet-sync-pending)
  app.post('/api/admin/sheet-sync-pending', async (req, res) => {
    const db = readDb();
    const url = db.sheetConfig.webhookUrl;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL Webhook Google Sheets belum diatur.' });
    }

    const unsyncedRegs = db.registrations.filter(r => !r.syncedToGoogleSheet);
    if (unsyncedRegs.length === 0) {
      return res.json({
        success: true,
        syncedCount: 0,
        message: 'Seluruh data peserta sudah tersinkron dengan Google Sheets.',
        sheetConfig: db.sheetConfig,
        sheetAuditLogs: db.sheetAuditLogs || [],
        sheetSyncState: getSheetSyncLiveState(db),
      });
    }

    const cleanItems = unsyncedRegs.map(r => ({
      ...r,
      paymentProofUrl: formatProofUrlForSheet(r, req),
    }));

    const result = await enqueueSheetSyncAndWait({
      webhookUrl: url,
      action: 'SYNC_PENDING_BATCH',
      targetLabel: `Push Data Tertunda (${cleanItems.length} Peserta)`,
      syncedRegIds: unsyncedRegs.map(r => r.id),
      recordCount: cleanItems.length,
      maxAttempts: 3,
      payload: {
        action: 'SYNC_ALL_REGISTRATIONS',
        eventTitle: db.event.title,
        eventDate: db.event.date,
        count: cleanItems.length,
        items: cleanItems,
        spreadsheetConfig: db.event.spreadsheetConfig,
        timestamp: new Date().toISOString()
      },
    });

    const latestDb = readDb();
    res.json({
      ...result,
      syncedCount: cleanItems.length,
      sheetConfig: latestDb.sheetConfig,
      sheetAuditLogs: latestDb.sheetAuditLogs || [],
      sheetSyncState: getSheetSyncLiveState(latestDb),
    });
  });

  // 17c. ADMIN: Get Live Google Sheets Sync Status & Audit Logs (GET /api/admin/sheet-audit)
  app.get('/api/admin/sheet-audit', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const db = readDb();
    res.json({
      success: true,
      sheetConfig: db.sheetConfig,
      sheetAuditLogs: db.sheetAuditLogs || [],
      sheetSyncState: getSheetSyncLiveState(db),
    });
  });

  // 17b. ADMIN: Direct Synchronized CSV Download (GET /api/admin/registrations/export.csv)
  app.get('/api/admin/registrations/export.csv', (req, res) => {
    const db = readDb();
    const archiveId = typeof req.query.archiveId === 'string' ? req.query.archiveId.trim() : '';
    let regs = db.registrations;
    let exportTitle = db.event.title;

    if (archiveId) {
      const arc = db.archives.find(a => a.id === archiveId);
      if (!arc) {
        return res.status(404).json({ success: false, message: 'Arsip event tidak ditemukan.' });
      }
      regs = arc.registrations || [];
      exportTitle = arc.eventTitle || db.event.title;
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
    const origin = `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;

    const { csvContent } = buildRegistrationsCSVContent(regs, db.event.spreadsheetConfig, origin);
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeTitle = (exportTitle || 'Pawrenting_REMOV').replace(/[^a-zA-Z0-9]+/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_Registrations_${timestamp}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csvContent);
  });

  // 18. ADMIN: Reset / Restore Demo Data (POST /api/admin/reset-demo)
  app.post('/api/admin/reset-demo', (req, res) => {
    writeDb(defaultInitialData);
    res.json({ success: true, message: 'Data berhasil direset ke pengaturan awal.' });
  });

  const httpServer = http.createServer(app);
  const distDir = path.resolve(__dirname, 'dist');
  const distIndexPath = path.resolve(distDir, 'index.html');
  const useProdStatic = process.env.NODE_ENV === 'production' && fs.existsSync(distIndexPath);

  // Vite middleware in dev or static files in production
  if (useProdStatic) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      root: __dirname,
      server: {
        middlewareMode: true,
        hmr: !isHmrDisabled,
        ws: isHmrDisabled ? false : { server: httpServer },
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.DEFAULT_APP_PORT) || 3000;
  httpServer.on('error', (err) => {
    console.error('Server HTTP error:', err);
  });
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🐾 Pawrenting REMOV Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
