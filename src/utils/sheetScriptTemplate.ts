export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script Resmi Pawrenting REMOV
 * Mendukung:
 * 1. Pengelompokan tabel per jenis vaksin dalam 1 sheet (format dinamis dari Dashboard Admin)
 * 2. Nomor Antrian (01, 02, 03...), Barcode Antrian, & Status Check-In Booth otomatis
 * 3. Status Booking (Otomatis Verified Onsite) & Kode Voucher Petshop
 * 4. Sinkronisasi 100% kolom database peserta (termasuk keterangan tambahan, data anabul, & hasil check-in)
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
    verified: "SUKSES BOOKING (ONSITE)",
    pending: "Menunggu Konfirmasi",
    pending_payment: "Terdaftar Onsite",
    expired: "Terdaftar Onsite",
    rejected: "Ditolak"
  };
  switch (key) {
    case "id": return d.id || "-";
    case "eventTitle": return d.eventTitle || "-";
    case "queueNumber": return d.queueNumber ? "'" + d.queueNumber : "-";
    case "barcodeCode": return d.barcodeCode || "-";
    case "regNumber": return d.regNumber || "-";
    case "checkInStatus": return checkInMap[d.checkInStatus || "belum_hadir"] || "Belum Hadir";
    case "checkedInAt": return d.checkedInAt || "-";
    case "createdAt": return d.createdAt || new Date().toISOString();
    case "ownerName": return d.ownerName || "-";
    case "ownerPhone": return d.ownerPhone ? "'" + d.ownerPhone : "-";
    case "ownerEmail": return d.ownerEmail || "-";
    case "ownerCity": return d.ownerCity || "-";
    case "ownerInstagram": return d.ownerInstagram || "-";
    case "referralSource": return d.referralSource || "-";
    case "petType": return d.petType === "kucing" ? "Kucing" : (d.petType === "anjing" ? "Anjing" : (d.petType || "-"));
    case "petName": return d.petName || "-";
    case "petBreed": return d.petBreed || "-";
    case "petGender": return d.petGender === "jantan" ? "Jantan" : (d.petGender === "betina" ? "Betina" : (d.petGender || "-"));
    case "isSterilized": return typeof d.isSterilized === "boolean" ? (d.isSterilized ? "Sudah Steril" : "Belum Steril") : "-";
    case "petAge": return d.petAge || "-";
    case "petWeightKg": return (d.petWeightKg !== undefined && d.petWeightKg !== null && d.petWeightKg !== 0) ? String(d.petWeightKg) : "-";
    case "petColor": return d.petColor || "-";
    case "previousVaccineHistory": return d.previousVaccineHistory || "-";
    case "vaccineName": return d.vaccineName || "-";
    case "vaccineNotes": return d.vaccineNotes || "-";
    case "selectedSession": return d.selectedSession || "-";
    case "rescheduledFromSession": return d.rescheduledFromSession || "-";
    case "totalAmount": return (d.vaccinePriceText && String(d.vaccinePriceText).trim()) ? String(d.vaccinePriceText).trim() : (d.totalAmount !== undefined ? d.totalAmount : (d.vaccinePrice || 0));
    case "vaccinePrice": return (d.vaccinePriceText && String(d.vaccinePriceText).trim()) ? String(d.vaccinePriceText).trim() : (d.vaccinePrice || 0);
    case "paymentMethod": return d.paymentMethod || "-";
    case "paymentBankTarget": return d.paymentBankTarget || d.paymentMethod || "-";
    case "paymentProofUrl": return d.paymentProofUrl || "-";
    case "paymentStatus": return paymentMap[d.paymentStatus] || (d.paymentStatus || "pending");
    case "verifiedAt": return d.verifiedAt || "-";
    case "paymentNotes": return d.paymentNotes || "-";
    case "joinedWhatsAppGroup": return d.joinedWhatsAppGroup ? "Done" : "Belum Join";
    case "voucherCode": return d.voucherCode || "-";
    default: return (d[key] !== undefined && d[key] !== null && d[key] !== "") ? String(d[key]) : "-";
  }
}

function getDefaultColumns() {
  return [
    { key: "queueNumber", label: "No. Antrian", enabled: true },
    { key: "barcodeCode", label: "Barcode Antrian", enabled: true },
    { key: "regNumber", label: "No. Registrasi", enabled: true },
    { key: "checkInStatus", label: "Status Hadir Booth", enabled: true },
    { key: "checkedInAt", label: "Waktu Check-In", enabled: true },
    { key: "createdAt", label: "Timestamp Daftar", enabled: true },
    { key: "ownerName", label: "Nama Lengkap", enabled: true },
    { key: "ownerPhone", label: "No Telepon", enabled: true },
    { key: "ownerEmail", label: "Email Pemilik", enabled: true },
    { key: "ownerCity", label: "Alamat Lengkap", enabled: true },
    { key: "ownerInstagram", label: "Instagram", enabled: true },
    { key: "referralSource", label: "Informasi Vaksin", enabled: true },
    { key: "petType", label: "Jenis Hewan Peliharaan", enabled: true },
    { key: "petName", label: "Nama Anabul yang akan divaksin", enabled: true },
    { key: "petBreed", label: "Ras Anabul", enabled: true },
    { key: "petGender", label: "Jenis Kelamin Anabul", enabled: true },
    { key: "isSterilized", label: "Status Steril", enabled: true },
    { key: "petAge", label: "Usia Anabul", enabled: true },
    { key: "petWeightKg", label: "Berat Badan (Kg)", enabled: true },
    { key: "petColor", label: "Warna Bulu", enabled: true },
    { key: "previousVaccineHistory", label: "Riwayat Vaksin Sebelumnya", enabled: true },
    { key: "vaccineName", label: "Pilih Vaksin", enabled: true },
    { key: "vaccineNotes", label: "Keterangan Kebutuhan Tambahan", enabled: true },
    { key: "selectedSession", label: "Pemilihan kloter Pemeriksaan", enabled: true },
    { key: "rescheduledFromSession", label: "Kloter Sebelumnya (Reschedule)", enabled: true },
    { key: "totalAmount", label: "Biaya / Keterangan Harga", enabled: true },
    { key: "paymentBankTarget", label: "Metode Pembayaran (Onsite)", enabled: true },
    { key: "paymentStatus", label: "Status Booking", enabled: true },
    { key: "verifiedAt", label: "Waktu Konfirmasi", enabled: true },
    { key: "paymentNotes", label: "Catatan Ketentuan Onsite", enabled: true },
    { key: "joinedWhatsAppGroup", label: "Status Group WhatsApp", enabled: true },
    { key: "voucherCode", label: "Kode Voucher Petshop", enabled: true }
  ];
}

function getActiveColumns(cfg) {
  var defaults = getDefaultColumns();
  var defaultMap = {};
  defaults.forEach(function(c) { defaultMap[c.key] = c; });

  var raw = (cfg && cfg.columns && cfg.columns.length > 0) ? cfg.columns : defaults;
  var seen = {};
  var merged = [];
  raw.forEach(function(c) {
    if (!c || !c.key || seen[c.key]) return;
    seen[c.key] = true;
    var fb = defaultMap[c.key];
    merged.push({
      key: c.key,
      label: (c.label && String(c.label).trim()) ? String(c.label).trim() : (fb ? fb.label : c.key),
      enabled: c.enabled !== false
    });
  });
  defaults.forEach(function(def) {
    if (!seen[def.key]) {
      seen[def.key] = true;
      merged.push(def);
    }
  });
  return merged.filter(function(c) { return c.enabled !== false; });
}

function buildLabelToKeyMap(cols) {
  var map = {};
  getDefaultColumns().forEach(function(c) {
    map[String(c.label).trim().toLowerCase()] = c.key;
    map[String(c.key).trim().toLowerCase()] = c.key;
  });
  cols.forEach(function(c) {
    map[String(c.label).trim().toLowerCase()] = c.key;
    map[String(c.key).trim().toLowerCase()] = c.key;
  });
  return map;
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

    if ((action === "SYNC_ALL_REGISTRATIONS" || action === "EVENT_COMPLETED_FINAL_SYNC") && contents.items) {
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
      var labelMap = buildLabelToKeyMap(cols);

      // Locate matching row by regNumber anywhere in the sheet
      for (var r = 0; r < values.length; r++) {
        for (var c = 0; c < values[r].length; c++) {
          if (String(values[r][c]) === String(d.regNumber)) {
            // Find the nearest header row above r dynamically via labelMap
            var headersRow = [];
            for (var h = r - 1; h >= 0; h--) {
              var nonEmpty = values[h].filter(function(cell) { return String(cell).trim() !== ""; });
              if (nonEmpty.length >= 3) {
                var matchedKeys = nonEmpty.filter(function(cell) {
                  return !!labelMap[String(cell).trim().toLowerCase()];
                });
                if (matchedKeys.length >= 2) {
                  headersRow = values[h];
                  break;
                }
              }
            }
            if (headersRow.length > 0) {
              var alignedVals = headersRow.map(function(hdr, colIdx) {
                var k = labelMap[String(hdr).trim().toLowerCase()];
                return k ? resolveColumnValue(d, k) : values[r][colIdx];
              });
              sheet.getRange(r + 1, 1, 1, alignedVals.length).setValues([alignedVals]);
            }
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              message: "Status & Check-in " + d.regNumber + " diperbarui."
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      // If not found yet, append row cleanly matching sheet's current headers if present
      if (sheet.getLastRow() === 0) {
        var hdrs = cols.map(function(col) { return col.label; });
        var hdrBg = (cfg && cfg.headerColorHex) ? cfg.headerColorHex : "#FFF000";
        sheet.appendRow(hdrs);
        sheet.getRange(1, 1, 1, cols.length).setFontWeight("bold").setBackground(hdrBg).setFontColor("#141414");
      }
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
