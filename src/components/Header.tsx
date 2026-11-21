import React from 'react';
import { Search, LayoutDashboard, FileText, QrCode, Lock, LogOut } from 'lucide-react';
import type { EventConfig } from '../types.ts';

interface HeaderProps {
  event: EventConfig;
  activeTab: 'form' | 'ticket' | 'admin';
  setActiveTab: (tab: 'form' | 'ticket' | 'admin') => void;
  isAdminAuthenticated: boolean;
  onOpenAdminLogin: (targetTab: 'admin' | 'ticket') => void;
  onOpenShareModal: () => void;
  onLogoutAdmin: () => void;
  availableSummary?: {
    totalSeats: number;
    availableSeats: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  event,
  activeTab,
  setActiveTab,
  isAdminAuthenticated,
  onOpenAdminLogin,
  onOpenShareModal,
  onLogoutAdmin,
  availableSummary
}) => {
  const removLogo = event.removLogoUrl || '/logos/remov-logo.svg';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs no-print">
      {/* Top micro banner with REMOV #fff000 & #141414 high contrast */}
      <div className="bg-[#141414] text-white text-[10px] sm:text-xs py-1 sm:py-1.5 px-3 sm:px-4 font-medium">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden truncate">
            <span className="inline-flex items-center gap-1 bg-[#fff000] text-[#141414] px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold tracking-wide uppercase shrink-0">
              Official REMOV Event
            </span>
            <span className="truncate text-stone-200">
              {event.subtitle}
            </span>
          </div>
          {availableSummary && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {event.eventStatus === 'completed' ? (
                <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                  ✓ Event Selesai &amp; Terarsip
                </span>
              ) : (
                <>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fff000] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fff000]"></span>
                  </span>
                  <span className="text-stone-200">
                    Sisa Kuota: <strong className="font-bold text-[#fff000] underline">{availableSummary.availableSeats}</strong>/{availableSummary.totalSeats} ekor
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main navigation & brand with Image Logos */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        <div
          onClick={() => setActiveTab('form')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0 w-full sm:w-auto"
        >
          {/* REMOV Logo Image + Optional Partner Collaboration Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <img
              src={removLogo}
              alt="Logo REMOV"
              className="w-12 h-12 sm:w-[66px] sm:h-[67px] object-contain rounded-xl border border-stone-200 bg-[#fff000] p-1 shadow-xs group-hover:scale-105 transition-transform duration-200"
            />
            {event.partnerLogoUrl && (
              <>
                <span className="text-stone-400 font-black text-xs">×</span>
                <img
                  src={event.partnerLogoUrl}
                  alt={event.partnerName || 'Partner Kolaborasi'}
                  className="h-10 sm:h-11 w-auto max-w-[84px] sm:max-w-[110px] object-contain rounded-xl border border-stone-200 bg-white p-1 shadow-xs"
                />
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              <span className="font-heading font-extrabold text-sm sm:text-xl text-[#141414] tracking-tight leading-tight truncate max-w-full">
                {event.title}
              </span>
              {event.partnerName && (
                <span className="inline-flex text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-[#fff000] text-[#141414] px-1.5 sm:px-2 py-0.5 rounded-md border border-[#141414]/15 shrink-0">
                  × {event.partnerName}
                </span>
              )}
              {isAdminAuthenticated && (
                <span className="inline-flex text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#141414] text-[#fff000] px-1.5 sm:px-2 py-0.5 rounded-md shrink-0">
                  Admin Aktif
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-stone-500 flex items-center gap-1 truncate w-full sm:max-w-md mt-0.5">
              <span className="shrink-0">{event.date}</span>
              <span className="text-stone-300 shrink-0">•</span>
              <span className="text-[#141414] font-semibold truncate">{event.locationName}</span>
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-10 px-2 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold leading-none whitespace-nowrap border-2 transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-[#fff000] text-[#141414] border-[#141414] shadow-xs'
                : 'text-stone-600 hover:text-[#141414] hover:bg-stone-100 border-stone-200 sm:border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline leading-none">Form Pendaftaran</span>
            <span className="sm:hidden leading-none">Form</span>
          </button>

          <button
            onClick={onOpenShareModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-10 px-2 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold leading-none whitespace-nowrap border-2 border-stone-300 bg-yellow-50 text-[#141414] hover:bg-[#fff000] hover:border-[#141414] transition-all shadow-2xs group cursor-pointer"
            title="Bagikan Formulir Pendaftaran (QR Code & Link)"
          >
            <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#141414] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline leading-none">Bagikan Form</span>
            <span className="sm:hidden leading-none">Share QR</span>
          </button>

          {isAdminAuthenticated ? (
            <>
              <button
                onClick={() => setActiveTab('ticket')}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-10 px-2 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold leading-none whitespace-nowrap border-2 transition-all cursor-pointer ${
                  activeTab === 'ticket'
                    ? 'bg-[#fff000] text-[#141414] border-[#141414] shadow-xs'
                    : 'text-stone-600 hover:text-[#141414] hover:bg-stone-100 border-stone-200 sm:border-transparent'
                }`}
                title="Cek Tiket & Check-In Barcode Peserta"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden md:inline leading-none">Cek & Check-In</span>
                <span className="md:hidden leading-none">Tiket</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-10 px-2 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold leading-none whitespace-nowrap border-2 transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#141414] text-[#fff000] border-[#141414] shadow-sm'
                    : 'bg-white text-[#141414] border-stone-300 hover:bg-stone-50'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden md:inline leading-none">Dashboard Admin</span>
                <span className="md:hidden leading-none">Admin</span>
              </button>

              <button
                onClick={onLogoutAdmin}
                className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 border-stone-200 sm:border-transparent text-stone-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                title="Logout Admin"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onOpenAdminLogin('admin')}
              className="flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-10 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold leading-none whitespace-nowrap border-2 border-stone-200 sm:border-transparent text-stone-500 hover:text-[#141414] hover:bg-stone-100 hover:border-stone-200 transition-colors cursor-pointer shrink-0"
              title="Khusus Panitia Event"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 text-stone-400" />
              <span className="hidden lg:inline leading-none">Akses Panitia</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
