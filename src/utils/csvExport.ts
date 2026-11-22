import type {
  Registration,
  EventConfig,
  VaccineOption,
  SpreadsheetGroupingConfig,
} from '../types.ts';

export interface SpreadsheetColumnDef {
  key: string;
  label: string;
  enabled: boolean;
}

const CHECKIN_LABELS: Record<string, string> = {
  belum_hadir: 'Belum Hadir',
  sudah_hadir: 'Sudah Hadir di Booth',
  selesai_vaksin: 'Selesai Vaksin',
  tidak_hadir: 'Tidak Hadir',
};

const PAYMENT_LABELS: Record<string, string> = {
  verified: 'SUKSES BOOKING (ONSITE)',
  pending: 'Menunggu Konfirmasi',
  pending_payment: 'Terdaftar Onsite',
  expired: 'Terdaftar Onsite',
  rejected: 'Ditolak',
};

export const DEFAULT_COLUMNS: SpreadsheetColumnDef[] = [
  { key: 'queueNumber', label: 'No. Antrian', enabled: true },
  { key: 'barcodeCode', label: 'Barcode Antrian', enabled: true },
  { key: 'regNumber', label: 'No. Registrasi', enabled: true },
  { key: 'checkInStatus', label: 'Status Hadir Booth', enabled: true },
  { key: 'checkedInAt', label: 'Waktu Check-In', enabled: true },
  { key: 'createdAt', label: 'Timestamp Daftar', enabled: true },
  { key: 'ownerName', label: 'Nama Lengkap', enabled: true },
  { key: 'ownerPhone', label: 'No Telepon', enabled: true },
  { key: 'ownerEmail', label: 'Email Pemilik', enabled: true },
  { key: 'ownerCity', label: 'Alamat Lengkap', enabled: true },
  { key: 'ownerInstagram', label: 'Instagram', enabled: true },
  { key: 'referralSource', label: 'Informasi Vaksin', enabled: true },
  { key: 'petType', label: 'Jenis Hewan Peliharaan', enabled: true },
  { key: 'petName', label: 'Nama Anabul yang akan divaksin', enabled: true },
  { key: 'petBreed', label: 'Ras Anabul', enabled: true },
  { key: 'petGender', label: 'Jenis Kelamin Anabul', enabled: true },
  { key: 'isSterilized', label: 'Status Steril', enabled: true },
  { key: 'petAge', label: 'Usia Anabul', enabled: true },
  { key: 'petWeightKg', label: 'Berat Badan (Kg)', enabled: true },
  { key: 'petColor', label: 'Warna Bulu', enabled: true },
  { key: 'previousVaccineHistory', label: 'Riwayat Vaksin Sebelumnya', enabled: true },
  { key: 'vaccineName', label: 'Pilih Vaksin', enabled: true },
  { key: 'vaccineNotes', label: 'Keterangan Kebutuhan Tambahan', enabled: true },
  { key: 'selectedSession', label: 'Pemilihan kloter Pemeriksaan', enabled: true },
  { key: 'rescheduledFromSession', label: 'Kloter Sebelumnya (Reschedule)', enabled: true },
  { key: 'totalAmount', label: 'Biaya / Keterangan Harga', enabled: true },
  { key: 'paymentBankTarget', label: 'Metode Pembayaran (Onsite)', enabled: true },
  { key: 'paymentStatus', label: 'Status Booking', enabled: true },
  { key: 'verifiedAt', label: 'Waktu Konfirmasi', enabled: true },
  { key: 'paymentNotes', label: 'Catatan Ketentuan Onsite', enabled: true },
  { key: 'joinedWhatsAppGroup', label: 'Status Group WhatsApp', enabled: true },
  { key: 'voucherCode', label: 'Kode Voucher Petshop', enabled: true },
];

// Internal/technical Registration fields that should not auto-spawn unwanted extra CSV columns
// unless explicitly enabled by admin in spreadsheetConfig.columns
const INTERNAL_SKIP_DYNAMIC_KEYS = new Set<string>([
  'id',
  'eventTitle',
  'vaccineId',
  'vaccinePrice',
  'vaccinePriceText',
  'paymentMethod',
  'paymentProofUrl',
  'paymentProofType',
  'paymentDeadlineAt',
  'queueSequence',
  'voucherId',
  'syncedToGoogleSheet',
  'sheetSyncedAt',
  'healthConfirmation',
  'healthChecklistAnswers',
  'addOns',
]);

const FIELD_KEY_ALIASES: Record<string, string> = {
  queue: 'queueNumber',
  queuenumber: 'queueNumber',
  noantrian: 'queueNumber',
  nomorantrian: 'queueNumber',
  barcode: 'barcodeCode',
  barcodecode: 'barcodeCode',
  barcodeantrian: 'barcodeCode',
  regnumber: 'regNumber',
  noregistrasi: 'regNumber',
  nomorregistrasi: 'regNumber',
  checkinstatus: 'checkInStatus',
  statushadirbooth: 'checkInStatus',
  checkedinat: 'checkedInAt',
  waktucheckin: 'checkedInAt',
  createdat: 'createdAt',
  timestampdaftar: 'createdAt',
  ownername: 'ownerName',
  namalengkap: 'ownerName',
  namapemilik: 'ownerName',
  ownerphone: 'ownerPhone',
  notelepon: 'ownerPhone',
  nowa: 'ownerPhone',
  whatsapp: 'ownerPhone',
  owneremail: 'ownerEmail',
  email: 'ownerEmail',
  emailpemilik: 'ownerEmail',
  ownercity: 'ownerCity',
  alamatlengkap: 'ownerCity',
  alamat: 'ownerCity',
  ownerinstagram: 'ownerInstagram',
  instagram: 'ownerInstagram',
  referralsource: 'referralSource',
  informasivaksin: 'referralSource',
  pettype: 'petType',
  jenishewanpeliharaan: 'petType',
  jenishewan: 'petType',
  petname: 'petName',
  namaanabul: 'petName',
  namaanabulyangakandivaksin: 'petName',
  petbreed: 'petBreed',
  rasanabul: 'petBreed',
  ras: 'petBreed',
  petgender: 'petGender',
  jeniskelaminanabul: 'petGender',
  issterilized: 'isSterilized',
  statussteril: 'isSterilized',
  petage: 'petAge',
  usiaanabul: 'petAge',
  umur: 'petAge',
  petweightkg: 'petWeightKg',
  beratbadankg: 'petWeightKg',
  beratbadan: 'petWeightKg',
  petcolor: 'petColor',
  warnabulu: 'petColor',
  previousvaccinehistory: 'previousVaccineHistory',
  riwayatvaksinsebelumnya: 'previousVaccineHistory',
  vaccinename: 'vaccineName',
  pilihvaksin: 'vaccineName',
  vaksin: 'vaccineName',
  vaccinenotes: 'vaccineNotes',
  keterangankebutuhantambahan: 'vaccineNotes',
  keterangan: 'vaccineNotes',
  selectedsession: 'selectedSession',
  pemilihankloterpemeriksaan: 'selectedSession',
  kloter: 'selectedSession',
  rescheduledfromsession: 'rescheduledFromSession',
  klotersebelumnyareschedule: 'rescheduledFromSession',
  totalamount: 'totalAmount',
  biayaketerangaharga: 'totalAmount',
  biayaketeranganharga: 'totalAmount',
  harga: 'totalAmount',
  paymentbanktarget: 'paymentBankTarget',
  metodebankpembayaran: 'paymentBankTarget',
  paymentproofurl: 'paymentProofUrl',
  buktipaymentbooking: 'paymentProofUrl',
  buktibayar: 'paymentProofUrl',
  paymentstatus: 'paymentStatus',
  statusbooking: 'paymentStatus',
  verifiedat: 'verifiedAt',
  waktuverifikasi: 'verifiedAt',
  paymentnotes: 'paymentNotes',
  catatanpembayaran: 'paymentNotes',
  joinedwhatsappgroup: 'joinedWhatsAppGroup',
  statusgroupwhatsapp: 'joinedWhatsAppGroup',
  vouchercode: 'voucherCode',
  kodevoucherpetshop: 'voucherCode',
  kodevoucher: 'voucherCode',
};

function normalizeToken(val: string): string {
  return val.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolveFieldKey(keyOrLabel: string): string {
  if (!keyOrLabel) return '';
  const trimmed = keyOrLabel.trim();
  if (DEFAULT_COLUMNS.some(c => c.key === trimmed)) return trimmed;
  const normalized = normalizeToken(trimmed);
  return FIELD_KEY_ALIASES[normalized] || trimmed;
}

function formatDynamicFieldLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

/**
 * Merges configured spreadsheet columns with the canonical participant database schema
 * and any extra fields present on stored Registration documents, inserting missing
 * columns right next to their logical canonical neighbors instead of breaking order.
 */
export function mergeSpreadsheetColumnsWithDatabase(
  existingCols?: { key: string; label?: string; enabled?: boolean }[],
  registrations?: Registration[]
): SpreadsheetColumnDef[] {
  const defaultMap = new Map<string, SpreadsheetColumnDef>(
    DEFAULT_COLUMNS.map(c => [c.key, c])
  );

  if (!existingCols || existingCols.length === 0) {
    const base = DEFAULT_COLUMNS.map(c => ({ ...c }));
    const seenBase = new Set(base.map(c => c.key));
    if (registrations && registrations.length > 0) {
      for (const reg of registrations) {
        if (!reg || typeof reg !== 'object') continue;
        for (const k of Object.keys(reg)) {
          const canonical = resolveFieldKey(k);
          if (!canonical || seenBase.has(canonical) || INTERNAL_SKIP_DYNAMIC_KEYS.has(canonical)) continue;
          seenBase.add(canonical);
          base.push({
            key: canonical,
            label: defaultMap.get(canonical)?.label || formatDynamicFieldLabel(canonical),
            enabled: true,
          });
        }
      }
    }
    return base;
  }

  const seen = new Set<string>();
  const nextCols: SpreadsheetColumnDef[] = [];

  for (const col of existingCols) {
    if (!col || (!col.key && !col.label)) continue;
    const resolvedKey = resolveFieldKey(col.key || col.label || '');
    if (!resolvedKey || seen.has(resolvedKey) || resolvedKey === 'paymentProofUrl') continue;
    seen.add(resolvedKey);
    const def = defaultMap.get(resolvedKey);
    nextCols.push({
      key: resolvedKey,
      label: (col.label || '').trim() || def?.label || formatDynamicFieldLabel(resolvedKey),
      enabled: col.enabled !== false,
    });
  }

  // Insert missing canonical DB columns immediately after their closest preceding canonical neighbor
  for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
    const def = DEFAULT_COLUMNS[i];
    if (seen.has(def.key)) continue;
    seen.add(def.key);

    let inserted = false;
    for (let prevIdx = i - 1; prevIdx >= 0; prevIdx--) {
      const anchorKey = DEFAULT_COLUMNS[prevIdx].key;
      const anchorPos = nextCols.findIndex(c => c.key === anchorKey);
      if (anchorPos >= 0) {
        nextCols.splice(anchorPos + 1, 0, { ...def });
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      nextCols.unshift({ ...def });
    }
  }

  // Discover any extra custom fields present on stored Registration records
  if (registrations && registrations.length > 0) {
    for (const reg of registrations) {
      if (!reg || typeof reg !== 'object') continue;
      for (const rawKey of Object.keys(reg)) {
        const canonical = resolveFieldKey(rawKey);
        if (!canonical || seen.has(canonical) || INTERNAL_SKIP_DYNAMIC_KEYS.has(canonical)) continue;
        seen.add(canonical);
        nextCols.push({
          key: canonical,
          label: defaultMap.get(canonical)?.label || formatDynamicFieldLabel(canonical),
          enabled: true,
        });
      }
    }
  }

  return nextCols;
}

export function syncColumnsToCanonicalDatabaseOrder(
  existingCols?: { key: string; label?: string; enabled?: boolean }[]
): SpreadsheetColumnDef[] {
  const existingMap = new Map<string, { label?: string; enabled?: boolean }>();
  if (existingCols) {
    for (const c of existingCols) {
      if (!c) continue;
      const k = resolveFieldKey(c.key || c.label || '');
      if (k && !existingMap.has(k)) {
        existingMap.set(k, { label: c.label, enabled: c.enabled });
      }
    }
  }

  const ordered = DEFAULT_COLUMNS.map(def => {
    const prev = existingMap.get(def.key);
    return {
      key: def.key,
      label: (prev?.label || '').trim() || def.label,
      enabled: prev?.enabled !== undefined ? prev.enabled !== false : def.enabled,
    };
  });

  const knownSet = new Set(ordered.map(c => c.key));
  if (existingCols) {
    for (const c of existingCols) {
      if (!c) continue;
      const k = resolveFieldKey(c.key || c.label || '');
      if (k && !knownSet.has(k)) {
        knownSet.add(k);
        ordered.push({
          key: k,
          label: (c.label || '').trim() || formatDynamicFieldLabel(k),
          enabled: c.enabled !== false,
        });
      }
    }
  }

  return ordered;
}

export function resolveActiveColumns(
  spreadsheetConfig?: SpreadsheetGroupingConfig,
  registrations?: Registration[]
): SpreadsheetColumnDef[] {
  const merged = mergeSpreadsheetColumnsWithDatabase(
    spreadsheetConfig?.columns,
    registrations
  );
  const enabledCols = merged.filter(c => c.enabled !== false);
  return enabledCols.length > 0 ? enabledCols : DEFAULT_COLUMNS.map(c => ({ ...c }));
}

export function resolveProofLink(r: Registration, originOverride?: string): string {
  if (!r.paymentProofUrl) return '-';
  if (r.paymentProofUrl.startsWith('http')) return r.paymentProofUrl;
  if (r.paymentProofUrl.startsWith('data:')) {
    const origin =
      originOverride !== undefined
        ? originOverride
        : typeof window !== 'undefined'
        ? window.location.origin
        : '';
    return `${origin}/api/registrations/${r.id}/proof-image`;
  }
  return r.paymentProofUrl;
}

function formatDateTimeValue(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('id-ID');
}

export function extractColumnValue(
  r: Registration,
  rawKey: string,
  forExcelQuote = false,
  originOverride?: string
): string {
  const key = resolveFieldKey(rawKey);
  switch (key) {
    case 'id':
      return r.id || '-';
    case 'eventTitle':
      return r.eventTitle || '-';
    case 'queueNumber':
      return r.queueNumber ? (forExcelQuote ? `'${r.queueNumber}` : r.queueNumber) : '-';
    case 'queueSequence':
      return r.queueSequence !== undefined && r.queueSequence !== null ? String(r.queueSequence) : '-';
    case 'barcodeCode':
      return r.barcodeCode || '-';
    case 'regNumber':
      return r.regNumber || '-';
    case 'checkInStatus':
      return CHECKIN_LABELS[r.checkInStatus || 'belum_hadir'] || 'Belum Hadir';
    case 'checkedInAt':
      return formatDateTimeValue(r.checkedInAt);
    case 'createdAt':
      return formatDateTimeValue(r.createdAt);
    case 'ownerName':
      return r.ownerName || '-';
    case 'ownerPhone':
      return r.ownerPhone ? (forExcelQuote ? `'${r.ownerPhone}` : r.ownerPhone) : '-';
    case 'ownerEmail':
      return r.ownerEmail || '-';
    case 'ownerCity':
      return r.ownerCity || '-';
    case 'ownerInstagram':
      return r.ownerInstagram || '-';
    case 'referralSource':
      return r.referralSource || '-';
    case 'petType':
      return r.petType === 'kucing' ? 'Kucing' : r.petType === 'anjing' ? 'Anjing' : (r.petType || '-');
    case 'petName':
      return r.petName || '-';
    case 'petBreed':
      return r.petBreed || '-';
    case 'petGender':
      return r.petGender === 'jantan' ? 'Jantan' : r.petGender === 'betina' ? 'Betina' : (r.petGender || '-');
    case 'isSterilized':
      return typeof r.isSterilized === 'boolean'
        ? (r.isSterilized ? 'Sudah Steril' : 'Belum Steril')
        : '-';
    case 'petAge':
      return r.petAge || '-';
    case 'petWeightKg':
      return r.petWeightKg !== undefined && r.petWeightKg !== null && r.petWeightKg !== 0
        ? String(r.petWeightKg)
        : '-';
    case 'petColor':
      return r.petColor || '-';
    case 'previousVaccineHistory':
      return r.previousVaccineHistory || '-';
    case 'healthConfirmation': {
      if (!r.healthConfirmation) return '-';
      const allOk = Object.values(r.healthConfirmation).every(Boolean);
      return allOk ? 'Memenuhi Semua Syarat Kesehatan' : 'Perlu Pemeriksaan Ulang';
    }
    case 'healthChecklistAnswers': {
      if (!Array.isArray(r.healthChecklistAnswers) || r.healthChecklistAnswers.length === 0) return '-';
      const checkedCount = r.healthChecklistAnswers.filter(item => item.checked).length;
      return `${checkedCount}/${r.healthChecklistAnswers.length} Terkonfirmasi`;
    }
    case 'vaccineId':
      return r.vaccineId || '-';
    case 'vaccineName':
      return r.vaccineName || '-';
    case 'vaccineNotes':
      return r.vaccineNotes || '-';
    case 'selectedSession':
      return r.selectedSession || '-';
    case 'rescheduledFromSession':
      return r.rescheduledFromSession || '-';
    case 'addOns': {
      if (!Array.isArray(r.addOns) || r.addOns.length === 0) return '-';
      return r.addOns.map(a => `${a.name} (${a.price})`).join('; ');
    }
    case 'totalAmount': {
      if (r.vaccinePriceText && r.vaccinePriceText.trim()) {
        return r.vaccinePriceText.trim();
      }
      return String(r.totalAmount ?? r.vaccinePrice ?? 0);
    }
    case 'vaccinePrice':
      return r.vaccinePriceText?.trim() || String(r.vaccinePrice ?? 0);
    case 'paymentMethod':
      return r.paymentMethod || '-';
    case 'paymentBankTarget':
      return r.paymentBankTarget || r.paymentMethod || '-';
    case 'paymentProofUrl':
      return resolveProofLink(r, originOverride);
    case 'paymentStatus':
      return PAYMENT_LABELS[r.paymentStatus] || (r.paymentStatus ? r.paymentStatus.toUpperCase() : '-');
    case 'verifiedAt':
      return formatDateTimeValue(r.verifiedAt);
    case 'paymentNotes':
      return r.paymentNotes || '-';
    case 'joinedWhatsAppGroup':
      return r.joinedWhatsAppGroup ? 'Done' : 'Belum Join';
    case 'voucherCode':
      return r.voucherCode || '-';
    case 'syncedToGoogleSheet':
      return r.syncedToGoogleSheet ? 'Tersinkron' : 'Belum';
    case 'sheetSyncedAt':
      return formatDateTimeValue(r.sheetSyncedAt);
    default: {
      const record = r as unknown as Record<string, unknown>;
      const raw = record[key] !== undefined ? record[key] : record[rawKey];
      if (raw === undefined || raw === null || raw === '') return '-';
      if (typeof raw === 'boolean') return raw ? 'Ya' : 'Tidak';
      if (typeof raw === 'object') return JSON.stringify(raw);
      return String(raw);
    }
  }
}

export function buildRegistrationsCSVContent(
  registrations: Registration[],
  spreadsheetConfig?: SpreadsheetGroupingConfig,
  originOverride?: string
): { csvContent: string; columns: SpreadsheetColumnDef[]; rowCount: number } {
  const activeCols = resolveActiveColumns(spreadsheetConfig, registrations);

  // Clean RFC-4180 CSV escaping: strip embedded newlines/tabs so every record stays strictly on 1 row & aligned 1:1 with header
  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const cleaned = String(val)
      .replace(/[\r\n]+/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/"/g, '""')
      .trim();
    return `"${cleaned}"`;
  };

  const headers = activeCols.map(c => escapeCSV(c.label));
  const rows = registrations.map(r =>
    activeCols.map(c => escapeCSV(extractColumnValue(r, c.key, false, originOverride)))
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  return {
    csvContent,
    columns: activeCols,
    rowCount: rows.length,
  };
}

export function exportRegistrationsToCSV(
  registrations: Registration[],
  eventTitle: string,
  spreadsheetConfig?: SpreadsheetGroupingConfig
) {
  const { csvContent } = buildRegistrationsCSVContent(registrations, spreadsheetConfig);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeTitle = (eventTitle || 'Pawrenting_REMOV').replace(/[^a-zA-Z0-9]+/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeTitle}_Registrations_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportGroupedSpreadsheetXLS(
  registrations: Registration[],
  vaccines: VaccineOption[],
  event: EventConfig
) {
  const cfg = event.spreadsheetConfig;
  const activeCols = resolveActiveColumns(cfg, registrations);
  const headerColor = cfg?.headerColorHex || '#FFF000';
  const prefix = cfg?.tableHeaderPrefix || 'TABEL KELOMPOK VAKSIN';
  const groupByVaccine = cfg?.groupByVaccine !== false;

  const escHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Build vaccine groups preserving order of configured vaccines + any legacy vaccine names
  const groups: { title: string; rows: Registration[] }[] = [];
  if (groupByVaccine) {
    const knownIds = new Set<string>();
    const knownNames = new Set<string>();
    vaccines.forEach(v => {
      knownIds.add(v.id);
      knownNames.add(v.name);
      const matching = registrations.filter(r => r.vaccineId === v.id || r.vaccineName === v.name);
      groups.push({
        title: `${prefix}: ${v.name} (${v.code}) — ${matching.length} Peserta`,
        rows: matching,
      });
    });
    const noVaccineRegs = registrations.filter(r => r.vaccineId === 'no-vaccine' || r.vaccineId === 'none');
    if (noVaccineRegs.length > 0) {
      groups.push({
        title: `${prefix}: Tidak Memilih Vaksin (Keperluan Lainnya) — ${noVaccineRegs.length} Peserta`,
        rows: noVaccineRegs,
      });
    }
    const extraRegs = registrations.filter(
      r => !knownIds.has(r.vaccineId) && !knownNames.has(r.vaccineName) && r.vaccineId !== 'no-vaccine' && r.vaccineId !== 'none'
    );
    if (extraRegs.length > 0) {
      groups.push({
        title: `${prefix}: Lainnya — ${extraRegs.length} Peserta`,
        rows: extraRegs,
      });
    }
  } else {
    groups.push({
      title: `SEMUA DATA PENDAFTAR — ${registrations.length} Peserta`,
      rows: registrations,
    });
  }

  const colSpan = Math.max(1, activeCols.length);
  const tablesHtml = groups
    .map(group => {
      const headerRow = `<tr>${activeCols
        .map(
          c =>
            `<th style="background-color:${escHtml(headerColor)};color:#141414;font-weight:bold;border:1px solid #44403c;padding:8px 10px;text-align:left;white-space:nowrap;">${escHtml(c.label)}</th>`
        )
        .join('')}</tr>`;

      const bodyRows =
        group.rows.length === 0
          ? `<tr><td colspan="${colSpan}" style="border:1px solid #d6d3d1;padding:10px;color:#78716c;font-style:italic;">Belum ada pendaftar untuk jenis vaksin ini.</td></tr>`
          : group.rows
              .map((r, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#fefce8';
                return `<tr style="background-color:${bg};">${activeCols
                  .map(c => {
                    const val = extractColumnValue(r, c.key, false);
                    const isTextForce = c.key === 'ownerPhone' || c.key === 'queueNumber';
                    const style = isTextForce
                      ? 'mso-number-format:"\\@";border:1px solid #d6d3d1;padding:6px 10px;vertical-align:top;'
                      : 'border:1px solid #d6d3d1;padding:6px 10px;vertical-align:top;';
                    if (c.key === 'paymentProofUrl' && val.startsWith('http')) {
                      return `<td style="${style}"><a href="${escHtml(val)}">Lihat Bukti</a></td>`;
                    }
                    return `<td style="${style}">${escHtml(val)}</td>`;
                  })
                  .join('')}</tr>`;
              })
              .join('');

      return `
        <table style="border-collapse:collapse;margin-bottom:24px;font-family:Arial,sans-serif;font-size:12px;">
          <tr>
            <td colspan="${colSpan}" style="background-color:#141414;color:${escHtml(headerColor)};font-weight:bold;font-size:14px;padding:10px 12px;border:1px solid #141414;">
              ${escHtml(group.title)}
            </td>
          </tr>
          ${headerRow}
          ${bodyRows}
        </table>
      `;
    })
    .join('<br/>');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Data Pawrenting REMOV</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>
        <h2 style="font-family:Arial,sans-serif;color:#141414;margin-bottom:4px;">${escHtml(event.title)}</h2>
        <p style="font-family:Arial,sans-serif;color:#57534e;font-size:12px;margin-top:0;margin-bottom:16px;">
          ${escHtml(event.date)} • ${escHtml(event.locationName)} • Diekspor: ${escHtml(new Date().toLocaleString('id-ID'))}
        </p>
        ${tablesHtml}
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeTitle = (event.title || 'Pawrenting_REMOV').replace(/[^a-zA-Z0-9]+/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeTitle}_Tabel_Per_Vaksin_${timestamp}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
