export type PetType = 'kucing' | 'anjing';
export type PetGender = 'jantan' | 'betina';
export type PaymentStatus = 'pending' | 'pending_payment' | 'verified' | 'rejected' | 'expired';
export type CheckInStatus = 'belum_hadir' | 'sudah_hadir' | 'selesai_vaksin' | 'tidak_hadir';

export interface VaccineOption {
  id: string;
  name: string;
  code: string; // e.g. "RABIES", "F3", "F4", "VANGUARD"
  category: 'kucing' | 'anjing' | 'semua';
  totalQuota: number;
  price: number; // in IDR
  priceText?: string; // optional custom text pricing label (e.g. "Sesuai Berat Badan", "Bayar di Lokasi")
  description: string;
  minAgeMonths: number;
  active: boolean;
  notes?: string;
  // Computed fields at runtime:
  confirmedCount?: number;
  heldCount?: number;
  availableQuota?: number;
  isSoldOut?: boolean;
}

export interface QuotaHold {
  id: string; // holdId
  vaccineId: string;
  petName: string;
  ownerName: string;
  createdAt: number;
  expiresAt: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrisUrl?: string;
  notes?: string;
  active: boolean;
}

export interface HealthChecklistItem {
  id: string;
  text: string;
  required: boolean;
}

export interface Registration {
  id: string;
  regNumber: string; // e.g. REMOV-2026-RAB-0012
  queueNumber?: string; // e.g. "01", "02", "03" (assigned automatically on verified booking)
  queueSequence?: number;
  barcodeCode?: string; // e.g. "REMOV-Q01-2026"
  createdAt: string;
  eventTitle: string;
  
  // Owner (Pawrent) info
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerCity: string;
  ownerInstagram?: string;
  referralSource?: string;

  // Pet info
  petType: PetType;
  petName: string;
  petBreed: string;
  petGender: PetGender;
  isSterilized: boolean;
  petAge: string;
  petWeightKg: number;
  petColor: string;
  previousVaccineHistory: string;
  healthConfirmation: {
    isHealthy: boolean;
    notPregnantOrNursing: boolean;
    minAgeMet: boolean;
    noFeverOrDiarrhea: boolean;
    agreedToTerms: boolean;
  };
  healthChecklistAnswers?: {
    id: string;
    text: string;
    checked: boolean;
  }[];

  // Service & Vaccine
  vaccineId: string;
  vaccineName: string;
  vaccinePrice: number;
  vaccinePriceText?: string;
  vaccineNotes?: string;
  selectedSession: string; // e.g. "Pukul 12.00 - 14.00"
  rescheduledFromSession?: string;
  addOns?: {
    id: string;
    name: string;
    price: number;
  }[];
  totalAmount: number;

  // Payment
  paymentMethod: string;
  paymentBankTarget?: string; // e.g. "BCA - 8730921200"
  paymentProofUrl?: string; // Base64 data or Google Drive link
  paymentProofType?: 'upload' | 'link';
  paymentStatus: PaymentStatus;
  paymentDeadlineAt?: string; // 2 hours deadline if proof not yet uploaded
  paymentNotes?: string;
  verifiedAt?: string;

  // Check-in & Booth Attendance
  checkInStatus?: CheckInStatus;
  checkedInAt?: string;

  // Compensation Voucher (if verified paid but did not attend)
  voucherId?: string;
  voucherCode?: string;

  // WhatsApp Group tracking
  joinedWhatsAppGroup?: boolean;

  // Sync
  syncedToGoogleSheet?: boolean;
  sheetSyncedAt?: string;
}

export interface VoucherTemplate {
  title: string;
  codePrefix: string;
  benefitText: string;
  imageUrl: string;
  description: string;
  validUntil: string;
}

export interface Voucher {
  id: string;
  code: string; // Unique single-use code
  title: string;
  benefitText: string;
  imageUrl: string;
  registrationId?: string;
  regNumber?: string;
  queueNumber?: string;
  ownerName: string;
  ownerPhone: string;
  petName: string;
  vaccineName: string;
  status: 'active' | 'redeemed' | 'void';
  createdAt: string;
  validUntil?: string;
  redeemedAt?: string;
  redeemedNotes?: string;
}

export interface DailyParticipantEntry {
  id: string;
  regNumber: string;
  queueNumber?: string;
  ownerName: string;
  petName: string;
  petType: PetType;
  vaccineName: string;
  selectedSession: string;
  checkInStatus?: CheckInStatus;
  createdAt: string;
}

export interface DailyRegistrationSnapshot {
  dateKey: string; // YYYY-MM-DD (Asia/Jakarta WIB)
  dateLabel: string; // e.g. "22 Nov 2026"
  newCount: number;
  cumulativeCount: number;
  catCount: number;
  dogCount: number;
  checkedInCount: number;
  participants: DailyParticipantEntry[];
  updatedAt: string;
}

export interface PublicEventStats {
  totalRegistrations: number;
  todayRegistrations: number;
  todayDateKey: string;
  todayDateLabel: string;
  catCount: number;
  dogCount: number;
  checkedInCount: number;
  activeCollectionDays: number;
  dailyTrend: {
    dateKey: string;
    dateLabel: string;
    newCount: number;
    cumulativeCount: number;
  }[];
  lastUpdatedAt: string;
  eventStatus: 'active' | 'completed';
}

export interface EventArchive {
  id: string;
  eventTitle: string;
  subtitle?: string;
  locationName: string;
  locationAddress: string;
  city?: string;
  eventDate: string;
  timeRange?: string;
  month: string;
  year: string;
  partnerName: string;
  partnerLogoUrl?: string;
  programsRun: string[];
  summaryNotes?: string;
  completionStatement?: string;
  completedBy?: string;
  eventStatus?: 'completed';
  documentationPhotos: string[];
  totalRegistrations: number;
  totalAttended: number;
  totalVaccinatedByVaccine: { vaccineName: string; count: number }[];
  dailySnapshots?: DailyRegistrationSnapshot[];
  registrations: Registration[];
  archivedAt: string;
}

export interface SpreadsheetGroupingConfig {
  groupByVaccine: boolean;
  tableHeaderPrefix: string;
  headerColorHex: string;
  columns: {
    key: string;
    label: string;
    enabled: boolean;
  }[];
}

export interface EventConfig {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  heroBadgeText?: string;
  date: string;
  timeRange: string;
  dateCardLabel?: string;
  dateNote?: string;
  showDateCard?: boolean;
  locationName: string;
  locationAddress: string;
  locationCardLabel?: string;
  locationMapsUrl?: string;
  showLocationCard?: boolean;
  contactWhatsApp: string;
  whatsappGroupLink: string;
  whatsappGroupPrompt: string;
  sessions: string[];
  bankAccounts: BankAccount[];
  termsAndConditions: string[];
  healthChecklistItems: HealthChecklistItem[];
  removLogoUrl: string;
  partnerLogoUrl?: string;
  partnerName?: string;
  backgroundImageUrl?: string;
  backgroundOverlayOpacity?: number; // 0 - 95
  bookingSuccessLabel: string;
  ticketArrivalNote: string;
  paymentTimeoutHours: number; // default 2 hours
  queueCounter: number; // current sequential queue counter (resets to 0 on new event)
  voucherTemplate: VoucherTemplate;
  spreadsheetConfig: SpreadsheetGroupingConfig;
  bannerUrl?: string;
  holdDurationMinutes: number; // default 10 minutes
  adminPin: string; // PIN for panitia/admin access (default 'remov2026')
  publicShareUrl?: string;
  customShareUrl?: string;
  eventStatus?: 'active' | 'completed';
  eventCompletedAt?: string;
  eventCompletedStatement?: string;
  eventCompletedBy?: string;
  lastArchivedId?: string;
}

export type SheetSyncAction =
  | 'NEW_REGISTRATION'
  | 'UPDATE_STATUS'
  | 'CHECK_IN_UPDATE'
  | 'SYNC_ALL_REGISTRATIONS'
  | 'SYNC_PENDING_BATCH'
  | 'EVENT_COMPLETED_FINAL_SYNC'
  | 'TEST_CONNECTION';

export type SheetSyncJobStatus = 'queued' | 'pushing' | 'retrying' | 'success' | 'failed';

export interface SheetSyncAuditEntry {
  id: string;
  action: SheetSyncAction;
  status: 'success' | 'failed';
  targetLabel: string;
  regId?: string;
  regNumber?: string;
  recordCount: number;
  attempts: number;
  durationMs: number;
  message: string;
  webhookConfigured: boolean;
  createdAt: string;
  completedAt: string;
}

export interface SheetSyncQueueJob {
  jobId: string;
  action: SheetSyncAction;
  targetLabel: string;
  regId?: string;
  regNumber?: string;
  recordCount: number;
  status: SheetSyncJobStatus;
  attempt: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string;
  lastError?: string;
}

export interface SheetSyncLiveState {
  pipelineStatus: 'idle' | 'pushing' | 'retrying' | 'unconfigured';
  webhookConfigured: boolean;
  autoSync: boolean;
  activeJob: SheetSyncQueueJob | null;
  queuedJobs: SheetSyncQueueJob[];
  pendingQueueCount: number;
  syncedRegistrationsCount: number;
  unsyncedRegistrationsCount: number;
  totalRegistrationsCount: number;
  sessionCompletedCount: number;
  sessionFailedCount: number;
  lastTransitionAt: string;
}

export interface GoogleSheetConfig {
  webhookUrl: string;
  autoSync: boolean;
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'failed' | 'idle';
  lastSyncMessage?: string;
}

export interface AppDatabase {
  event: EventConfig;
  vaccines: VaccineOption[];
  registrations: Registration[];
  holds: QuotaHold[];
  vouchers: Voucher[];
  archives: EventArchive[];
  sheetConfig: GoogleSheetConfig;
  sheetAuditLogs?: SheetSyncAuditEntry[];
  dailySnapshots?: DailyRegistrationSnapshot[];
  lastUpdatedAt?: string;
}

