import React, { useState, useEffect } from 'react';
import {
  QrCode, Copy, Check, Download, Share2, ExternalLink, X,
  Sparkles, PawPrint, Printer, Globe, CheckCircle2, Smartphone, Edit3, AlertTriangle
} from 'lucide-react';
import QRCode from 'qrcode';
import type { EventConfig } from '../types.ts';

interface ShareFormModalProps {
  event: EventConfig;
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated?: () => void;
}

export const ShareFormModal: React.FC<ShareFormModalProps> = ({
  event,
  isOpen,
  onClose,
  onEventUpdated
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);
  const [isEditingCustomLink, setIsEditingCustomLink] = useState(false);
  const [customLinkInput, setCustomLinkInput] = useState(event.customShareUrl || '');
  const [isSavingCustomLink, setIsSavingCustomLink] = useState(false);
  const [customLinkSavedMsg, setCustomLinkSavedMsg] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isDevOrigin = currentOrigin.includes('ais-dev-');
  const isAiStudioPreviewProxy = currentOrigin.includes('ais-dev-') || currentOrigin.includes('ais-pre-');
  const [urlMode, setUrlMode] = useState<'public' | 'live'>('public');

  useEffect(() => {
    if (isOpen) {
      setCustomLinkInput(event.customShareUrl || '');
      setCustomLinkSavedMsg(false);
    }
  }, [isOpen, event.customShareUrl]);

  const getPublicUrl = () => {
    if (currentOrigin && !isDevOrigin) {
      return currentOrigin;
    }
    if (event.publicShareUrl && event.publicShareUrl.trim().startsWith('http')) {
      return event.publicShareUrl.trim();
    }
    if (currentOrigin) {
      if (currentOrigin.includes('ais-dev-')) {
        return currentOrigin.replace('ais-dev-', 'ais-pre-');
      }
      return currentOrigin;
    }
    return 'https://ais-pre-eokbt5pudc45k3nxlwvdte-860791107159.asia-northeast1.run.app';
  };

  const getShareUrl = () => {
    if (customLinkInput && customLinkInput.trim().startsWith('http')) {
      return customLinkInput.trim();
    }
    if (event.customShareUrl && event.customShareUrl.trim().startsWith('http')) {
      return event.customShareUrl.trim();
    }
    if (urlMode === 'live' && currentOrigin) {
      return currentOrigin;
    }
    return getPublicUrl();
  };

  const shareUrl = getShareUrl();
  const isShareUrlPreviewProxy = shareUrl.includes('ais-dev-') || shareUrl.includes('ais-pre-');

  useEffect(() => {
    if (isOpen && shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#141414',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Error generating QR code:', err));
    }
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleSaveCustomLink = async () => {
    setIsSavingCustomLink(true);
    try {
      const res = await fetch('/api/admin/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customShareUrl: customLinkInput.trim()
        })
      });
      if (res.ok) {
        setCustomLinkSavedMsg(true);
        setIsEditingCustomLink(false);
        onEventUpdated?.();
        setTimeout(() => setCustomLinkSavedMsg(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save custom share URL:', e);
    } finally {
      setIsSavingCustomLink(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const broadcastMessage = `🐾 *PENDAFTARAN RESMI ${event.title.toUpperCase()}* 🐾
${event.subtitle}

Halo Pawrents! 🐱🐶
Yuk lindungi anabul tersayang dengan vaksinasi resmi bersama tim dokter hewan REMOV Pet Care${event.partnerName ? ` × ${event.partnerName}` : ''}.

📅 *Tanggal*: ${event.date}
⏰ *Waktu*: ${event.timeRange}
📍 *Lokasi*: ${event.locationName}
📌 *Alamat*: ${event.locationAddress}

✨ *Fasilitas & Sistem Antrian*:
• Kuota Vaksin Real-Time (Otomatis Terkunci saat Checkout)
• Konfirmasi Pendaftaran -> Langsung Terdaftar & Dapat Nomor Antrian + Barcode
• Pembayaran & Pembelian Produk Dilakukan Langsung Secara Onsite di Lokasi
• Akses Grup WhatsApp Resmi Pawrenting REMOV

👇 *Klik Tautan Formulir Pendaftaran Online*:
${shareUrl}

*(Pilih vaksin & amankan kuota Anda sebelum slot habis!)*`;

  const handleCopyBroadcast = () => {
    navigator.clipboard.writeText(broadcastMessage);
    setCopiedBroadcast(true);
    setTimeout(() => setCopiedBroadcast(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_Pendaftaran_${event.title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(broadcastMessage)}`;
    window.open(waUrl, '_blank');
  };

  const toAbsoluteAssetUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return currentOrigin ? `${currentOrigin}${url.startsWith('/') ? '' : '/'}${url}` : url;
  };

  const handlePrintStandee = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoImg = toAbsoluteAssetUrl(event.removLogoUrl || '/logos/remov-logo.svg');
    const partnerLogoImg = toAbsoluteAssetUrl(event.partnerLogoUrl);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Standee QR Code - ${event.title}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; color: #141414; padding: 20px; background: #fffef0; }
          .header { border-bottom: 4px solid #141414; padding-bottom: 20px; margin-bottom: 25px; }
          .logos { display: flex; justify-content: center; align-items: center; gap: 14px; margin-bottom: 12px; }
          .logos img { height: 64px; object-fit: contain; }
          .badge { display: inline-block; background: #fff000; color: #141414; border: 2px solid #141414; font-weight: bold; padding: 6px 16px; border-radius: 20px; font-size: 14px; margin-bottom: 10px; }
          h1 { font-size: 30px; margin: 10px 0; color: #141414; }
          p.subtitle { font-size: 16px; color: #444; margin: 0 0 15px; }
          .qr-box { background: #fff; border: 4px solid #141414; border-radius: 24px; padding: 25px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.1); margin: 15px auto; }
          .qr-img { width: 280px; height: 280px; display: block; margin: 0 auto; }
          .instruction { font-size: 20px; font-weight: bold; color: #141414; background: #fff000; padding: 6px 14px; border-radius: 10px; display: inline-block; margin: 15px 0 8px; }
          .url { font-family: monospace; font-size: 13px; background: #f3f4f6; padding: 6px 12px; border-radius: 8px; display: inline-block; word-break: break-all; margin-top: 5px; }
          .info-grid { display: flex; justify-content: center; gap: 30px; margin-top: 25px; font-size: 14px; text-align: left; background: #fff000; padding: 15px 25px; border-radius: 16px; border: 2px solid #141414; }
          .info-item strong { display: block; color: #141414; font-size: 11px; text-transform: uppercase; }
          .footer { margin-top: 35px; font-size: 12px; color: #57534e; border-top: 1px dashed #d6d3d1; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logos">
            <img src="${logoImg}" alt="REMOV" />
            ${partnerLogoImg ? `<span style="font-weight:900;font-size:20px;">×</span><img src="${partnerLogoImg}" alt="${event.partnerName || 'Partner'}" />` : ''}
          </div>
          <div class="badge">${event.heroBadgeText || 'EVENT RESMI PAWRENTING REMOV'}</div>
          <h1>${event.title}${event.partnerName ? ` × ${event.partnerName}` : ''}</h1>
          <p class="subtitle">${event.tagline || event.subtitle}</p>
        </div>
        <div class="qr-box">
          <img class="qr-img" src="${qrDataUrl}" alt="QR Code Pendaftaran" />
          <div class="instruction">SCAN QR CODE DENGAN KAMERA HP</div>
          <div style="font-size: 13px; color: #57534e; margin-top:4px;">Untuk Mengisi Formulir & Mendapatkan Nomor Antrian</div>
          <div class="url">${shareUrl}</div>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <strong>Tanggal & Waktu</strong>
            <span>${event.date} • ${event.timeRange}</span>
          </div>
          <div class="info-item">
            <strong>Lokasi Kegiatan</strong>
            <span>${event.locationName}${event.locationAddress ? ` — ${event.locationAddress}` : ''}</span>
          </div>
        </div>
        <div class="footer">
          REMOV Pet Care • Layanan Kesehatan & Vaksinasi Anabul • WhatsApp Panitia: ${event.contactWhatsApp}
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border-2 border-[#141414] space-y-5 relative my-8 max-h-[92vh] overflow-y-auto">

        <div className="flex items-start justify-between border-b border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#fff000] text-[#141414] border-2 border-[#141414] flex items-center justify-center shadow-sm shrink-0">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#141414]">
                  Bagikan Formulir Pendaftaran
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                  Publik Siap
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Tautan & QR Code selalu mengikuti tampilan dan pengaturan acara terbaru dari Admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-[#141414] hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Proxy vs Deployed Public URL Guidance */}
        {(isAiStudioPreviewProxy || isShareUrlPreviewProxy) ? (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5 text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block">
                  Agar QR Code Bisa Dibuka Langsung di iPhone / Safari Tanpa Peringatan Cookie:
                </strong>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Link preview AI Studio (<code className="font-mono">ais-pre</code> / <code className="font-mono">ais-dev</code>) memakai gerbang cookie preview Google sehingga Safari/iOS sering menampilkan <em>"Action required to load your app"</em>. Klik tombol <strong>Deploy</strong> (Cloud Run) di kanan atas AI Studio lalu tempel URL hasil Deploy ke kolom <strong>URL Publik / Custom Link</strong> di bawah (atau buka QR langsung dari URL hasil Deploy) agar customer bisa langsung scan tanpa hambatan apapun.
                </p>
              </div>
            </div>
            {isDevOrigin && !event.customShareUrl && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUrlMode('public')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                    urlMode === 'public'
                      ? 'bg-[#141414] text-[#fff000] border-[#141414]'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Link Preview Publik (ais-pre)
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('live')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                    urlMode === 'live'
                      ? 'bg-[#fff000] text-[#141414] border-[#141414]'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Mode Uji Live (Tampilan Saat Ini)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-950 block">
                QR Code Langsung ke Form Tanpa Login & Tanpa Cookie Gate
              </span>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Setiap perubahan tampilan, logo, jadwal, lokasi, maupun kuota vaksin dari Dashboard Admin langsung tampil saat customer scan QR atau membuka link ini.
              </p>
            </div>
          </div>
        )}

        <div className="bg-yellow-50/80 rounded-3xl p-5 border-2 border-[#fff000] text-center space-y-3.5 relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 bg-[#141414] text-[#fff000] text-[11px] font-extrabold px-3.5 py-1 rounded-full shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SCAN LANGSUNG KE FORM PENDAFTARAN</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border-2 border-[#141414] shadow-md inline-block mx-auto">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Pendaftaran"
                className="w-52 h-52 sm:w-60 sm:h-60 mx-auto rounded-xl object-contain"
              />
            ) : (
              <div className="w-52 h-52 bg-stone-100 animate-pulse rounded-xl" />
            )}
            <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] font-mono font-bold text-[#141414]">
              <PawPrint className="w-3.5 h-3.5 text-[#141414]" />
              <span>{event.title}{event.partnerName ? ` × ${event.partnerName}` : ''}</span>
            </div>
          </div>

          <p className="text-xs text-stone-600 max-w-md mx-auto">
            Arahkan kamera smartphone ke kode di atas. Peserta langsung mengisi formulir sesuai tampilan terbaru dan mendapat nomor antrian otomatis.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={handleDownloadQr}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-[#141414] border border-stone-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#141414]" />
              <span>Unduh Gambar QR (PNG)</span>
            </button>

            <button
              onClick={handlePrintStandee}
              className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Standee Meja (Print A4)</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#141414] uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Tautan Link Pendaftaran</span>
            </label>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold text-[#141414] hover:underline flex items-center gap-1 bg-[#fff000] px-2 py-0.5 rounded-md"
            >
              <span>Uji Buka di Tab Baru</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-xs sm:text-sm font-mono text-stone-800 outline-hidden select-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                {urlMode === 'live' && isDevOrigin ? 'Live' : 'Publik'}
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              className={`inline-flex items-center gap-1.5 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#141414] hover:bg-black text-[#fff000]'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Tersalin!' : 'Salin Link'}</span>
            </button>
          </div>

          <div className="pt-1">
            {customLinkSavedMsg && (
              <p className="text-[11px] font-bold text-emerald-700 mb-1">
                Custom link berhasil disimpan ke pengaturan event!
              </p>
            )}
            {!isEditingCustomLink ? (
              <button
                type="button"
                onClick={() => setIsEditingCustomLink(true)}
                className="text-[11px] text-stone-500 hover:text-[#141414] flex items-center gap-1 font-medium cursor-pointer"
              >
                <Edit3 className="w-3 h-3 text-stone-400" />
                <span>Punya shortlink / domain sendiri? Klik untuk ubah & simpan link QR</span>
              </button>
            ) : (
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2 mt-1">
                <label className="block text-[11px] font-bold text-stone-700">
                  Custom Shortlink / Custom Domain (kosongkan untuk reset ke default)
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="url"
                    placeholder="https://bit.ly/pawrenting-remov-2026"
                    value={customLinkInput}
                    onChange={(e) => setCustomLinkInput(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono outline-hidden bg-white"
                  />
                  <button
                    type="button"
                    disabled={isSavingCustomLink}
                    onClick={handleSaveCustomLink}
                    className="px-3 py-1.5 bg-[#141414] text-[#fff000] rounded-lg text-xs font-bold hover:bg-black disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingCustomLink ? 'Menyimpan...' : 'Simpan Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCustomLink(false)}
                    className="px-3 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-300 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-yellow-50/70 rounded-2xl p-4 border border-stone-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#141414] uppercase tracking-wide flex items-center gap-1.5">
              <Share2 className="w-4 h-4" />
              <span>Broadcast Siap Kirim (WhatsApp & Medsos)</span>
            </span>
            <button
              onClick={handleCopyBroadcast}
              className="text-xs font-bold text-[#141414] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedBroadcast ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBroadcast ? 'Teks Tersalin!' : 'Salin Teks Broadcast'}</span>
            </button>
          </div>

          <div className="bg-white p-3 rounded-xl border border-stone-200 max-h-24 overflow-y-auto text-[11px] text-stone-700 whitespace-pre-line font-sans">
            {broadcastMessage}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Buka Kirim ke WhatsApp</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>Salin Link untuk IG Story / Bio</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-stone-400 text-center">
          Peserta hanya dapat melihat formulir pendaftaran. Akses data pendaftar & cek tiket tetap aman terkunci di dalam akun panitia.
        </p>

      </div>
    </div>
  );
};
