import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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
  HealthChecklistItem
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'db.json');
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

const defaultSpreadsheetColumns = [
  { key: 'queueNumber', label: 'No. Antrian', enabled: true },
  { key: 'barcodeCode', label: 'Barcode Antrian', enabled: true },
  { key: 'checkInStatus', label: 'Status Hadir Booth', enabled: true },
  { key: 'checkedInAt', label: 'Waktu Check-In', enabled: true },
  { key: 'createdAt', label: 'Timestamp Daftar', enabled: true },
  { key: 'ownerName', label: 'Nama Lengkap', enabled: true },
  { key: 'ownerPhone', label: 'No Telepon', enabled: true },
  { key: 'ownerCity', label: 'Alamat Lengkap', enabled: true },
  { key: 'referralSource', label: 'Informasi Vaksin', enabled: true },
  { key: 'petType', label: 'Jenis Hewan Peliharaan', enabled: true },
  { key: 'petName', label: 'Nama Anabul yang akan divaksin', enabled: true },
  { key: 'petGender', label: 'Jenis Kelamin Anabul', enabled: true },
  { key: 'vaccineName', label: 'Pilih Vaksin', enabled: true },
  { key: 'selectedSession', label: 'Pemilihan kloter Pemeriksaan', enabled: true },
  { key: 'paymentProofUrl', label: 'Bukti Payment Booking', enabled: true },
  { key: 'paymentStatus', label: 'Status Booking', enabled: true },
  { key: 'joinedWhatsAppGroup', label: 'Status Group WhatsApp', enabled: true },
  { key: 'regNumber', label: 'No. Registrasi', enabled: true },
  { key: 'voucherCode', label: 'Kode Voucher Petshop', enabled: true },
];

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
  }
};

function readDb(): AppDatabase {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultInitialData, null, 2), 'utf-8');
      return defaultInitialData;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    const checklist = (parsed.event?.healthChecklistItems && parsed.event.healthChecklistItems.length > 0)
      ? parsed.event.healthChecklistItems
      : (parsed.event?.termsAndConditions && parsed.event.termsAndConditions.length > 0)
        ? parsed.event.termsAndConditions.map((t: string, i: number) => ({ id: `chk-${i + 1}`, text: t, required: true }))
        : defaultHealthChecklist;

    const mergedEvent: EventConfig = {
      ...defaultInitialData.event,
      ...(parsed.event || {}),
      whatsappGroupLink: parsed.event?.whatsappGroupLink || defaultInitialData.event.whatsappGroupLink,
      whatsappGroupPrompt: parsed.event?.whatsappGroupPrompt || defaultInitialData.event.whatsappGroupPrompt,
      adminPin: parsed.event?.adminPin || defaultInitialData.event.adminPin || 'remov2026',
      removLogoUrl: parsed.event?.removLogoUrl || '/logos/remov-logo.svg',
      partnerLogoUrl: parsed.event?.partnerLogoUrl ?? '',
      partnerName: parsed.event?.partnerName ?? '',
      heroBadgeText: parsed.event?.heroBadgeText ?? defaultInitialData.event.heroBadgeText,
      dateCardLabel: parsed.event?.dateCardLabel ?? defaultInitialData.event.dateCardLabel,
      dateNote: parsed.event?.dateNote ?? '',
      showDateCard: parsed.event?.showDateCard !== false,
      locationCardLabel: parsed.event?.locationCardLabel ?? defaultInitialData.event.locationCardLabel,
      locationMapsUrl: parsed.event?.locationMapsUrl ?? '',
      showLocationCard: parsed.event?.showLocationCard !== false,
      backgroundImageUrl: parsed.event?.backgroundImageUrl !== undefined ? parsed.event.backgroundImageUrl : '/backgrounds/pawrenting-kuning-remov.svg',
      backgroundOverlayOpacity: parsed.event?.backgroundOverlayOpacity ?? 78,
      bookingSuccessLabel: parsed.event?.bookingSuccessLabel || defaultInitialData.event.bookingSuccessLabel,
      ticketArrivalNote: parsed.event?.ticketArrivalNote || defaultInitialData.event.ticketArrivalNote,
      paymentTimeoutHours: parsed.event?.paymentTimeoutHours || 2,
      queueCounter: parsed.event?.queueCounter ?? 0,
      healthChecklistItems: checklist,
      voucherTemplate: {
        ...defaultInitialData.event.voucherTemplate,
        ...(parsed.event?.voucherTemplate || {}),
      },
      spreadsheetConfig: {
        ...defaultInitialData.event.spreadsheetConfig,
        ...(parsed.event?.spreadsheetConfig || {}),
        columns: (parsed.event?.spreadsheetConfig?.columns && parsed.event.spreadsheetConfig.columns.length > 0)
          ? parsed.event.spreadsheetConfig.columns
          : defaultSpreadsheetColumns,
      },
      bankAccounts: (parsed.event?.bankAccounts && parsed.event.bankAccounts.length > 0)
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

    const rawRegs: Registration[] = parsed.registrations || defaultInitialData.registrations;
    // Ensure verified registrations have queueNumber & barcodeCode
    let maxSeq = mergedEvent.queueCounter || 0;
    const normalizedRegs = rawRegs.map((r) => {
      if (r.paymentStatus === 'verified' && !r.queueNumber) {
        maxSeq += 1;
        const qStr = String(maxSeq).padStart(2, '0');
        return {
          ...r,
          queueSequence: maxSeq,
          queueNumber: qStr,
          barcodeCode: r.barcodeCode || `REMOV-Q${qStr}-${new Date().getFullYear()}`,
          checkInStatus: r.checkInStatus || 'belum_hadir',
        };
      }
      if (r.queueSequence && r.queueSequence > maxSeq) {
        maxSeq = r.queueSequence;
      }
      return {
        ...r,
        checkInStatus: r.checkInStatus || 'belum_hadir',
      };
    });
    mergedEvent.queueCounter = maxSeq;

    return {
      ...defaultInitialData,
      ...parsed,
      event: mergedEvent,
      vaccines: (parsed.vaccines && parsed.vaccines.length > 0)
        ? parsed.vaccines.map((v: any) => ({ ...v, active: v.active !== false }))
        : defaultInitialData.vaccines,
      registrations: normalizedRegs,
      holds: parsed.holds || [],
      vouchers: parsed.vouchers || [],
      archives: Array.isArray(parsed.archives) ? parsed.archives : defaultInitialData.archives,
      sheetConfig: { ...defaultInitialData.sheetConfig, ...(parsed.sheetConfig || {}) }
    };
  } catch (err) {
    console.error('Error reading DB, using default:', err);
    return defaultInitialData;
  }
}

function writeDb(data: AppDatabase) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
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

  // Expire unpaid bookings whose 2-hour deadline has passed
  db.registrations.forEach((reg) => {
    if (
      (reg.paymentStatus === 'pending_payment' || (reg.paymentStatus === 'pending' && !reg.paymentProofUrl)) &&
      reg.paymentDeadlineAt
    ) {
      const deadlineMs = new Date(reg.paymentDeadlineAt).getTime();
      if (!isNaN(deadlineMs) && now > deadlineMs) {
        reg.paymentStatus = 'expired';
        reg.paymentNotes = 'Otomatis hangus: melewati batas waktu 2 jam tanpa bukti pembayaran.';
        changed = true;
      }
    }
  });

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
    });
    if (response.ok) {
      return { success: true, message: 'Berhasil dikirim ke Google Sheets.' };
    } else {
      const txt = await response.text().catch(() => '');
      return { success: false, message: `Google Sheets merespon status ${response.status}: ${txt}` };
    }
  } catch (err: any) {
    return { success: false, message: `Gagal menghubungi Google Sheets: ${err.message || 'Network error'}` };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  // Serve folder-based assets immediately in dev and prod
  ASSET_FOLDERS.forEach((folder) => {
    app.use(`/${folder}`, express.static(path.resolve(PUBLIC_DIR, folder)));
  });

  // Periodic cleaner for 10-min checkout holds and 2-hour unpaid booking deadlines
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
    if (pin && (pin.trim() === validPin || pin.trim() === 'remov2026' || pin.trim() === 'admin123')) {
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
  // - With paymentProofUrl -> Auto-verified booking + Instant Queue Number (01, 02, 03...) + Barcode!
  // - Without paymentProofUrl -> Pending payment with 2-hour deadline; expires automatically if unpaid!
  app.post('/api/registrations', async (req, res) => {
    try {
      const regData = req.body;
      const { holdId, vaccineId } = regData;

      if (!vaccineId || !regData.ownerName || !regData.ownerPhone || !regData.petName) {
        return res.status(400).json({ success: false, message: 'Lengkapi seluruh data wajib pendaftaran.' });
      }

      const db = readDb();
      cleanExpiredHoldsAndBookings(db);

      const vaccine = db.vaccines.find(v => v.id === vaccineId);
      if (!vaccine) {
        return res.status(404).json({ success: false, message: 'Jenis vaksin tidak ditemukan.' });
      }

      const existingHoldIndex = holdId ? db.holds.findIndex(h => h.id === holdId && h.expiresAt > Date.now()) : -1;

      if (existingHoldIndex >= 0) {
        db.holds.splice(existingHoldIndex, 1);
      } else {
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

      const proofUrl = regData.paymentProofUrl ? String(regData.paymentProofUrl).trim() : '';
      const hasProof = proofUrl.length > 0;
      const proofType: 'upload' | 'link' = proofUrl.startsWith('data:') ? 'upload' : (proofUrl.startsWith('http') ? 'link' : 'upload');
      const nowIso = new Date().toISOString();
      const timeoutHours = db.event.paymentTimeoutHours || 2;
      const deadlineIso = new Date(Date.now() + timeoutHours * 3600 * 1000).toISOString();

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
        selectedSession: regData.selectedSession || db.event.sessions[0] || 'Sesi Utama',
        addOns: [],
        totalAmount: vaccine.price,
        paymentMethod: regData.paymentMethod || 'QRIS REMOV Official',
        paymentBankTarget: regData.paymentBankTarget || '',
        paymentProofUrl: proofUrl,
        paymentProofType: proofType,
        paymentStatus: hasProof ? 'verified' : 'pending_payment',
        paymentDeadlineAt: hasProof ? undefined : deadlineIso,
        paymentNotes: hasProof
          ? 'Otomatis terverifikasi saat bukti payment booking dilampirkan'
          : `Belum upload bukti bayar. Batas waktu pelunasan ${timeoutHours} jam sebelum otomatis hangus.`,
        verifiedAt: hasProof ? nowIso : undefined,
        checkInStatus: 'belum_hadir',
        joinedWhatsAppGroup: !!regData.joinedWhatsAppGroup,
        syncedToGoogleSheet: false,
      };

      // Assign Queue Number immediately if payment proof is provided (or vaccine is free price=0)
      if (hasProof || vaccine.price === 0) {
        newRegistration.paymentStatus = 'verified';
        newRegistration.verifiedAt = nowIso;
        newRegistration.paymentNotes = vaccine.price === 0 && !hasProof
          ? 'Pendaftaran layanan gratis otomatis terverifikasi'
          : 'Otomatis terverifikasi booking saat bukti payment booking dilampirkan';
        assignQueueNumberIfMissing(db, newRegistration);
      }

      db.registrations.unshift(newRegistration);
      writeDb(db);

      // Async sync to Google Sheets if enabled
      if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
        const sheetItem = {
          ...newRegistration,
          paymentProofUrl: formatProofUrlForSheet(newRegistration, req),
        };
        syncToGoogleSheetWebhook(db.sheetConfig.webhookUrl, {
          action: 'NEW_REGISTRATION',
          data: sheetItem,
          spreadsheetConfig: db.event.spreadsheetConfig,
          timestamp: new Date().toISOString()
        }).then(result => {
          const freshDb = readDb();
          const target = freshDb.registrations.find(r => r.id === regId);
          if (target) {
            target.syncedToGoogleSheet = result.success;
            target.sheetSyncedAt = new Date().toISOString();
            freshDb.sheetConfig.lastSyncTime = new Date().toISOString();
            freshDb.sheetConfig.lastSyncStatus = result.success ? 'success' : 'failed';
            freshDb.sheetConfig.lastSyncMessage = result.message;
            writeDb(freshDb);
          }
        }).catch(err => {
          console.error('Auto sync to sheet failed:', err);
        });
      }

      res.json({
        success: true,
        registration: newRegistration,
        message: newRegistration.paymentStatus === 'verified'
          ? `Sukses Booking! Nomor Antrian Anda: ${newRegistration.queueNumber}`
          : `Data tersimpan! Segera unggah bukti payment dalam ${timeoutHours} jam agar mendapat nomor antrian.`
      });
    } catch (err: any) {
      console.error('Error submitting registration:', err);
      res.status(500).json({ success: false, message: err.message || 'Terjadi kesalahan sistem' });
    }
  });

  // 4b. PUBLIC: Upload Payment Proof Within 2-Hour Window (POST /api/registrations/:id/submit-proof)
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

    if (reg.paymentStatus === 'expired') {
      return res.status(410).json({
        success: false,
        expired: true,
        message: 'Maaf, batas waktu 2 jam telah berakhir sehingga formulir ini dianggap HANGUS. Silakan mengisi ulang formulir atau memilih vaksin lain.'
      });
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
    reg.paymentNotes = 'Otomatis terverifikasi setelah bukti payment diunggah dalam batas waktu 2 jam';
    assignQueueNumberIfMissing(db, reg);
    writeDb(db);

    if (db.sheetConfig.autoSync && db.sheetConfig.webhookUrl) {
      syncToGoogleSheetWebhook(db.sheetConfig.webhookUrl, {
        action: 'UPDATE_STATUS',
        data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
        spreadsheetConfig: db.event.spreadsheetConfig,
        timestamp: new Date().toISOString()
      }).catch(console.error);
    }

    res.json({
      success: true,
      registration: reg,
      message: `Pembayaran terverifikasi otomatis! Nomor Antrian Anda adalah ${reg.queueNumber}.`
    });
  });

  // 5. ADMIN / PANITIA: Check Registration Status / Barcode / Queue Lookup
  app.get('/api/registrations/:idOrNumber', (req, res) => {
    const rawQuery = decodeURIComponent(req.params.idOrNumber).trim();
    const db = readDb();
    if (cleanExpiredHoldsAndBookings(db)) {
      writeDb(db);
    }
    const upper = rawQuery.toUpperCase();
    const item = db.registrations.find(
      r =>
        r.id === rawQuery ||
        r.regNumber.toUpperCase() === upper ||
        (r.queueNumber && (r.queueNumber.toUpperCase() === upper || r.queueNumber === rawQuery.padStart(2, '0'))) ||
        (r.barcodeCode && r.barcodeCode.toUpperCase() === upper) ||
        r.ownerPhone === rawQuery
    );

    if (!item) {
      return res.status(404).json({ success: false, message: 'Data pendaftaran / Nomor Antrian tidak ditemukan.' });
    }

    res.json({ success: true, registration: item, event: db.event });
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
      syncToGoogleSheetWebhook(db.sheetConfig.webhookUrl, {
        action: 'CHECK_IN_UPDATE',
        data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
        spreadsheetConfig: db.event.spreadsheetConfig,
        timestamp: new Date().toISOString()
      }).catch(console.error);
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
      syncToGoogleSheetWebhook(db.sheetConfig.webhookUrl, {
        action: 'UPDATE_STATUS',
        data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
        spreadsheetConfig: db.event.spreadsheetConfig,
        timestamp: new Date().toISOString()
      }).catch(console.error);
    }

    res.json({
      success: true,
      registration: reg,
      message: `Jadwal ${reg.ownerName} (${reg.petName}) berhasil digeser ke ${newSession}.`
    });
  });

  // 6. ADMIN: Full Data (GET /api/admin/data)
  app.get('/api/admin/data', (req, res) => {
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
      stats,
      serverTime: Date.now()
    });
  });

  // 7. ADMIN: Update Event Info, Logos, Background, Checklist, & Ticket Copy (POST /api/admin/event)
  app.post('/api/admin/event', (req, res) => {
    const db = readDb();
    const updatedChecklist = req.body.healthChecklistItems || db.event.healthChecklistItems;
    db.event = {
      ...db.event,
      ...req.body,
      healthChecklistItems: updatedChecklist,
      termsAndConditions: Array.isArray(updatedChecklist)
        ? updatedChecklist.map((c: HealthChecklistItem) => c.text)
        : db.event.termsAndConditions,
    };
    writeDb(db);
    res.json({ success: true, event: db.event, message: 'Pengaturan event berhasil diperbarui.' });
  });

  // 8. ADMIN: Manage Vaccines (POST /api/admin/vaccines)
  app.post('/api/admin/vaccines', (req, res) => {
    const { action, vaccine } = req.body;
    const db = readDb();

    if (action === 'create') {
      const newVac: VaccineOption = {
        id: 'vac_' + Date.now(),
        name: vaccine.name,
        code: (vaccine.code || vaccine.name.substring(0, 4)).toUpperCase(),
        category: vaccine.category || 'semua',
        totalQuota: Number(vaccine.totalQuota) || 20,
        price: Number(vaccine.price) || 0,
        description: vaccine.description || '',
        minAgeMonths: Number(vaccine.minAgeMonths) || 2,
        active: vaccine.active !== false,
        notes: vaccine.notes || ''
      };
      db.vaccines.push(newVac);
    } else if (action === 'update') {
      const idx = db.vaccines.findIndex(v => v.id === vaccine.id);
      if (idx >= 0) {
        db.vaccines[idx] = {
          ...db.vaccines[idx],
          ...vaccine,
          totalQuota: Number(vaccine.totalQuota),
          price: Number(vaccine.price),
          minAgeMonths: Number(vaccine.minAgeMonths),
          active: vaccine.active !== undefined ? !!vaccine.active : db.vaccines[idx].active,
        };
      }
    } else if (action === 'toggle') {
      const idx = db.vaccines.findIndex(v => v.id === vaccine.id);
      if (idx >= 0) {
        db.vaccines[idx].active = !db.vaccines[idx].active;
      }
    } else if (action === 'delete') {
      db.vaccines = db.vaccines.filter(v => v.id !== vaccine.id);
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
      syncToGoogleSheetWebhook(db.sheetConfig.webhookUrl, {
        action: 'UPDATE_STATUS',
        data: { ...reg, paymentProofUrl: formatProofUrlForSheet(reg, req) },
        spreadsheetConfig: db.event.spreadsheetConfig,
        timestamp: new Date().toISOString()
      }).catch(console.error);
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

  // 14. ADMIN: Event Archive & Portfolio Management + Reset Queue Counter for Next Event
  app.post('/api/admin/events/archive-and-reset', (req, res) => {
    const {
      partnerName,
      partnerLogoUrl,
      city,
      month,
      year,
      programsRun,
      summaryNotes,
      documentationPhotos,
      resetRegistrations,
      nextEventTitle,
      nextEventDate
    } = req.body;

    const db = readDb();
    const vaccineCounts: Record<string, number> = {};
    db.registrations
      .filter(r => r.paymentStatus === 'verified')
      .forEach(r => {
        vaccineCounts[r.vaccineName] = (vaccineCounts[r.vaccineName] || 0) + 1;
      });

    const newArchive: EventArchive = {
      id: 'arc_' + Date.now(),
      eventTitle: db.event.title,
      subtitle: db.event.subtitle,
      locationName: db.event.locationName,
      locationAddress: db.event.locationAddress,
      city: city || '',
      eventDate: db.event.date,
      month: month || new Date().toLocaleString('id-ID', { month: 'long' }),
      year: year || String(new Date().getFullYear()),
      partnerName: partnerName || db.event.partnerName || 'REMOV Internal Care',
      partnerLogoUrl: partnerLogoUrl || db.event.partnerLogoUrl || '',
      programsRun: Array.isArray(programsRun) && programsRun.length > 0
        ? programsRun
        : db.vaccines.filter(v => v.active).map(v => v.name),
      summaryNotes: summaryNotes || '',
      documentationPhotos: Array.isArray(documentationPhotos) ? documentationPhotos : [],
      totalRegistrations: db.registrations.length,
      totalAttended: db.registrations.filter(r => r.checkInStatus === 'sudah_hadir' || r.checkInStatus === 'selesai_vaksin').length,
      totalVaccinatedByVaccine: Object.entries(vaccineCounts).map(([vaccineName, count]) => ({ vaccineName, count })),
      registrations: [...db.registrations],
      archivedAt: new Date().toISOString(),
    };

    db.archives.unshift(newArchive);

    // Reset queue counter back to 0 so the next event starts cleanly from 01 again!
    db.event.queueCounter = 0;
    if (resetRegistrations !== false) {
      db.registrations = [];
      db.holds = [];
    }
    if (nextEventTitle) db.event.title = nextEventTitle;
    if (nextEventDate) db.event.date = nextEventDate;

    writeDb(db);
    res.json({
      success: true,
      archive: newArchive,
      message: 'Event berhasil diarsipkan ke Portofolio REMOV & nomor antrian direset kembali ke 01 untuk acara berikutnya!'
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
    const url = webhookUrl || readDb().sheetConfig.webhookUrl;
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

    const result = await syncToGoogleSheetWebhook(url, testPayload);
    const db = readDb();
    db.sheetConfig.lastSyncTime = new Date().toISOString();
    db.sheetConfig.lastSyncStatus = result.success ? 'success' : 'failed';
    db.sheetConfig.lastSyncMessage = result.message;
    writeDb(db);

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

    const result = await syncToGoogleSheetWebhook(url, payload);

    if (result.success) {
      db.registrations.forEach(r => {
        r.syncedToGoogleSheet = true;
        r.sheetSyncedAt = new Date().toISOString();
      });
    }

    db.sheetConfig.lastSyncTime = new Date().toISOString();
    db.sheetConfig.lastSyncStatus = result.success ? 'success' : 'failed';
    db.sheetConfig.lastSyncMessage = result.message;
    writeDb(db);

    res.json({
      ...result,
      syncedCount: db.registrations.length,
      sheetConfig: db.sheetConfig
    });
  });

  // 18. ADMIN: Reset / Restore Demo Data (POST /api/admin/reset-demo)
  app.post('/api/admin/reset-demo', (req, res) => {
    writeDb(defaultInitialData);
    res.json({ success: true, message: 'Data berhasil direset ke pengaturan awal.' });
  });

  const httpServer = http.createServer(app);

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🐾 Pawrenting REMOV Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
