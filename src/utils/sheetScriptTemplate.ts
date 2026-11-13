export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script Resmi Pawrenting REMOV
 * Mendukung:
 * 1. Pengelompokan tabel per jenis vaksin dalam 1 sheet (format dinamis dari Dashboard Admin)
 * 2. Nomor Antrian (01, 02, 03...), Barcode Antrian, & Status Check-In Booth otomatis
 * 3. Status Booking (Otomatis Verified / Pending 2 Jam / Hangus) & Kode Voucher Petshop
 *
 * CARA PEMASANGAN:
 * 1. Buka Google Spreadsheet Anda > Extensions > Apps Script.
 * 2. Hapus isi lama, PASTE seluruh kode ini, lalu klik Save.
 * 3. Klik Deploy > New deployment > Web app.
 * 4. Execute as: "Me", Who has access: "Anyone".
 * 5. Salin Web App URL (/exec) ke tab Koneksi Google Sheets di Dashboard Admin.
 */

function resolveColumnValue(d, key) {
  var checkInMap = {
    belum_hadir: "Belum Hadir",
    sudah_hadir: "Sudah Hadir di Booth",
    selesai_vaksin: "Selesai Vaksin",
    tidak_hadir: "Tidak Hadir"
  };
  var paymentMap = {
    verified: "SUKSES BOOKING",
    pending: "Menunggu Verifikasi",
    pending_payment: "Menunggu Bayar (2 Jam)",
    expired: "HANGUS (>2 Jam)",
    rejected: "Ditolak"
  };
  switch (key) {
    case "queueNumber": return d.queueNumber ? "'" + d.queueNumber : "-";
    case "barcodeCode": return d.barcodeCode || "-";
    case "checkInStatus": return checkInMap[d.checkInStatus || "belum_hadir"] || "Belum Hadir";
    case "checkedInAt": return d.checkedInAt || "-";
    case "createdAt": return d.createdAt || new Date().toISOString();
    case "ownerName": return d.ownerName || "";
    case "ownerPhone": return d.ownerPhone ? "'" + d.ownerPhone : "";
    case "ownerEmail": return d.ownerEmail || "";
    case "ownerCity": return d.ownerCity || "";
    case "ownerInstagram": return d.ownerInstagram || "";
    case "referralSource": return d.referralSource || "-";
    case "petType": return d.petType === "kucing" ? "Kucing" : "Anjing";
    case "petName": return d.petName || "";
    case "petBreed": return d.petBreed || "";
    case "petGender": return d.petGender === "jantan" ? "Jantan" : "Betina";
    case "petAge": return d.petAge || "";
    case "vaccineName": return d.vaccineName || "";
    case "selectedSession": return d.selectedSession || "";
    case "paymentProofUrl": return d.paymentProofUrl || "-";
    case "paymentStatus": return paymentMap[d.paymentStatus] || (d.paymentStatus || "pending");
    case "joinedWhatsAppGroup": return d.joinedWhatsAppGroup ? "Done" : "Belum Join";
    case "regNumber": return d.regNumber || "";
    case "totalAmount": return d.totalAmount || 0;
    case "paymentBankTarget": return d.paymentBankTarget || d.paymentMethod || "";
    case "voucherCode": return d.voucherCode || "-";
    default: return "-";
  }
}

function getDefaultColumns() {
  return [
    { key: "queueNumber", label: "No. Antrian", enabled: true },
    { key: "barcodeCode", label: "Barcode Antrian", enabled: true },
    { key: "checkInStatus", label: "Status Hadir Booth", enabled: true },
    { key: "checkedInAt", label: "Waktu Check-In", enabled: true },
    { key: "createdAt", label: "Timestamp Daftar", enabled: true },
    { key: "ownerName", label: "Nama Lengkap", enabled: true },
    { key: "ownerPhone", label: "No Telepon", enabled: true },
    { key: "ownerCity", label: "Alamat Lengkap", enabled: true },
    { key: "referralSource", label: "Informasi Vaksin", enabled: true },
    { key: "petType", label: "Jenis Hewan Peliharaan", enabled: true },
    { key: "petName", label: "Nama Anabul yang akan divaksin", enabled: true },
    { key: "petGender", label: "Jenis Kelamin Anabul", enabled: true },
    { key: "vaccineName", label: "Pilih Vaksin", enabled: true },
    { key: "selectedSession", label: "Pemilihan kloter Pemeriksaan", enabled: true },
    { key: "paymentProofUrl", label: "Bukti Payment Booking", enabled: true },
    { key: "paymentStatus", label: "Status Booking", enabled: true },
    { key: "joinedWhatsAppGroup", label: "Status Group WhatsApp", enabled: true },
    { key: "regNumber", label: "No. Registrasi", enabled: true },
    { key: "voucherCode", label: "Kode Voucher Petshop", enabled: true }
  ];
}

function getActiveColumns(cfg) {
  var cols = (cfg && cfg.columns && cfg.columns.length > 0) ? cfg.columns : getDefaultColumns();
  return cols.filter(function(c) { return c.enabled !== false; });
}

function writeGroupedTables(sheet, items, cfg, eventTitle) {
  sheet.clear();
  var cols = getActiveColumns(cfg);
  var numCols = cols.length;
  var headers = cols.map(function(c) { return c.label; });
  var headerBg = (cfg && cfg.headerColorHex) ? cfg.headerColorHex : "#FFF000";
  var prefix = (cfg && cfg.tableHeaderPrefix) ? cfg.tableHeaderPrefix : "TABEL KELOMPOK VAKSIN";
  var groupByVaccine = !(cfg && cfg.groupByVaccine === false);

  sheet.getRange(1, 1).setValue((eventTitle || "PAWRENTING REMOV") + " - REKAP DATA PESERTA").setFontWeight("bold").setFontSize(13);
  var currentRow = 3;

  if (!groupByVaccine) {
    sheet.getRange(currentRow, 1, 1, numCols).setValues([headers]).setFontWeight("bold").setBackground(headerBg).setFontColor("#141414");
    currentRow++;
    if (items.length > 0) {
      var rows = items.map(function(d) {
        return cols.map(function(c) { return resolveColumnValue(d, c.key); });
      });
      sheet.getRange(currentRow, 1, rows.length, numCols).setValues(rows);
    }
    return;
  }

  // Group registrations by vaccineName into distinct tables inside the same single sheet
  var grouped = {};
  var groupOrder = [];
  items.forEach(function(item) {
    var vName = item.vaccineName || "Lainnya";
    if (!grouped[vName]) {
      grouped[vName] = [];
      groupOrder.push(vName);
    }
    grouped[vName].push(item);
  });

  groupOrder.forEach(function(vName) {
    var groupRows = grouped[vName];
    // Banner row for this vaccine table
    sheet.getRange(currentRow, 1, 1, numCols).merge();
    sheet.getRange(currentRow, 1)
      .setValue(prefix + ": " + vName + " (" + groupRows.length + " Peserta)")
      .setFontWeight("bold")
      .setBackground("#141414")
      .setFontColor(headerBg);
    currentRow++;

    // Table column header
    sheet.getRange(currentRow, 1, 1, numCols)
      .setValues([headers])
      .setFontWeight("bold")
      .setBackground(headerBg)
      .setFontColor("#141414");
    currentRow++;

    // Table body rows
    var rows = groupRows.map(function(d) {
      return cols.map(function(c) { return resolveColumnValue(d, c.key); });
    });
    if (rows.length > 0) {
      sheet.getRange(currentRow, 1, rows.length, numCols).setValues(rows).setBorder(true, true, true, true, true, true);
      currentRow += rows.length;
    }
    currentRow += 1; // Blank separator row between vaccine tables
  });
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var cfg = contents.spreadsheetConfig || {};
    var cols = getActiveColumns(cfg);

    if (action === "TEST_CONNECTION") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Koneksi Google Sheets Pawrenting REMOV berhasil!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "SYNC_ALL_REGISTRATIONS" && contents.items) {
      writeGroupedTables(sheet, contents.items, cfg, contents.eventTitle);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Berhasil menyinkronkan " + contents.items.length + " data terkelompok per vaksin."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "NEW_REGISTRATION" && contents.data) {
      var d = contents.data;
      if (sheet.getLastRow() === 0) {
        var headers = cols.map(function(c) { return c.label; });
        var headerBg = (cfg && cfg.headerColorHex) ? cfg.headerColorHex : "#FFF000";
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, cols.length).setFontWeight("bold").setBackground(headerBg).setFontColor("#141414");
        sheet.setFrozenRows(1);
      }
      var row = cols.map(function(c) { return resolveColumnValue(d, c.key); });
      sheet.appendRow(row);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data " + d.regNumber + " (Antrian " + (d.queueNumber || "-") + ") tersimpan."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if ((action === "UPDATE_STATUS" || action === "CHECK_IN_UPDATE") && contents.data) {
      var d = contents.data;
      var values = sheet.getDataRange().getValues();
      var regColIdx = -1;
      var headersRow = [];

      // Locate matching row by regNumber anywhere in the sheet
      for (var r = 0; r < values.length; r++) {
        for (var c = 0; c < values[r].length; c++) {
          if (String(values[r][c]) === String(d.regNumber)) {
            // Find the nearest header row above r
            for (var h = r - 1; h >= 0; h--) {
              if (values[h].indexOf("No. Registrasi") !== -1 || values[h].indexOf("Nama Lengkap") !== -1) {
                headersRow = values[h];
                break;
              }
            }
            if (headersRow.length > 0) {
              var newVals = cols.map(function(col) { return resolveColumnValue(d, col.key); });
              sheet.getRange(r + 1, 1, 1, newVals.length).setValues([newVals]);
            }
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              message: "Status & Check-in " + d.regNumber + " diperbarui."
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      // If not found yet, append row cleanly
      var fallbackRow = cols.map(function(col) { return resolveColumnValue(d, col.key); });
      sheet.appendRow(fallbackRow);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Baris baru ditambahkan untuk " + d.regNumber
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ignored",
      message: "No action performed"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
