import type { Registration, EventConfig, VaccineOption, SpreadsheetGroupingConfig } from '../types.ts';

const CHECKIN_LABELS: Record<string, string> = {
  belum_hadir: 'Belum Hadir',
  sudah_hadir: 'Sudah Hadir di Booth',
  selesai_vaksin: 'Selesai Vaksin',
  tidak_hadir: 'Tidak Hadir',
};

const PAYMENT_LABELS: Record<string, string> = {
  verified: 'SUKSES BOOKING',
  pending: 'Menunggu Verifikasi',
  pending_payment: 'Menunggu Bayar (Batas 2 Jam)',
  expired: 'HANGUS (>2 Jam)',
  rejected: 'Ditolak',
};

const DEFAULT_COLUMNS = [
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
  { key: 'vaccineNotes', label: 'Keterangan Kebutuhan Tambahan', enabled: true },
  { key: 'selectedSession', label: 'Pemilihan kloter Pemeriksaan', enabled: true },
  { key: 'paymentProofUrl', label: 'Bukti Payment Booking', enabled: true },
  { key: 'paymentStatus', label: 'Status Booking', enabled: true },
  { key: 'joinedWhatsAppGroup', label: 'Status Group WhatsApp', enabled: true },
  { key: 'regNumber', label: 'No. Registrasi', enabled: true },
  { key: 'voucherCode', label: 'Kode Voucher Petshop', enabled: true },
];

export function resolveProofLink(r: Registration): string {
  if (!r.paymentProofUrl) return '-';
  if (r.paymentProofUrl.startsWith('http')) return r.paymentProofUrl;
  if (r.paymentProofUrl.startsWith('data:')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/registrations/${r.id}/proof-image`;
  }
  return r.paymentProofUrl;
}

export function extractColumnValue(r: Registration, key: string, forExcelQuote = true): string {
  switch (key) {
    case 'queueNumber':
      return r.queueNumber ? (forExcelQuote ? `'${r.queueNumber}` : r.queueNumber) : '-';
    case 'barcodeCode':
      return r.barcodeCode || '-';
    case 'checkInStatus':
      return CHECKIN_LABELS[r.checkInStatus || 'belum_hadir'] || 'Belum Hadir';
    case 'checkedInAt':
      return r.checkedInAt ? new Date(r.checkedInAt).toLocaleString('id-ID') : '-';
    case 'createdAt':
      return r.createdAt ? new Date(r.createdAt).toLocaleString('id-ID') : '-';
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
      return r.petType === 'kucing' ? 'Kucing' : 'Anjing';
    case 'petName':
      return r.petName || '-';
    case 'petBreed':
      return r.petBreed || '-';
    case 'petGender':
      return r.petGender === 'jantan' ? 'Jantan' : 'Betina';
    case 'petAge':
      return r.petAge || '-';
    case 'vaccineName':
      return r.vaccineName || '-';
    case 'vaccineNotes':
      return r.vaccineNotes || '-';
    case 'selectedSession':
      return r.selectedSession || '-';
    case 'paymentProofUrl':
      return resolveProofLink(r);
    case 'paymentStatus':
      return PAYMENT_LABELS[r.paymentStatus] || r.paymentStatus.toUpperCase();
    case 'joinedWhatsAppGroup':
      return r.joinedWhatsAppGroup ? 'Done' : 'Belum Join';
    case 'regNumber':
      return r.regNumber || '-';
    case 'totalAmount':
      return String(r.totalAmount ?? 0);
    case 'paymentBankTarget':
      return r.paymentBankTarget || r.paymentMethod || '-';
    case 'voucherCode':
      return r.voucherCode || '-';
    default:
      return '-';
  }
}

export function exportRegistrationsToCSV(
  registrations: Registration[],
  eventTitle: string,
  spreadsheetConfig?: SpreadsheetGroupingConfig
) {
  const activeCols = (spreadsheetConfig?.columns && spreadsheetConfig.columns.length > 0
    ? spreadsheetConfig.columns
    : DEFAULT_COLUMNS
  ).filter(c => c.enabled);

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
    activeCols.map(c => escapeCSV(extractColumnValue(r, c.key, true)))
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
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
  const activeCols = (cfg?.columns && cfg.columns.length > 0 ? cfg.columns : DEFAULT_COLUMNS).filter(c => c.enabled);
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
