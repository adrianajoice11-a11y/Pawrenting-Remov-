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
      <div className="bg-[#141414] text-white text-xs py-1.5 px-4 font-medium">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <span className="inline-flex items-center gap-1 bg-[#fff000] text-[#141414] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase shrink-0">
              Official REMOV Event
            </span>
            <span className="truncate text-stone-200">
              {event.subtitle}
            </span>
          </div>
          {availableSummary && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fff000] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fff000]"></span>
              </span>
              <span className="text-stone-200">
                Sisa Kuota: <strong className="font-bold text-[#fff000] underline">{availableSummary.availableSeats}</strong>/{availableSummary.totalSeats} ekor
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main navigation & brand with Image Logos */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div
          onClick={() => setActiveTab('form')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
        >
          {/* REMOV Logo Image + Optional Partner Collaboration Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img
              src={removLogo}
              alt="Logo REMOV"
              className="w-[66px] h-[67px] object-contain rounded-xl border border-stone-200 bg-[#fff000] p-1 shadow-xs group-hover:scale-105 transition-transform duration-200"
            />
            {event.partnerLogoUrl && (
              <>
                <span className="text-stone-400 font-black text-xs">×</span>
                <img
                  src={event.partnerLogoUrl}
                  alt={event.partnerName || 'Partner Kolaborasi'}
                  className="h-9 sm:h-11 w-auto max-w-[110px] object-contain rounded-xl border border-stone-200 bg-white p-1 shadow-xs"
                />
              </>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-heading font-extrabold text-base sm:text-xl text-[#141414] tracking-tight truncate">
                {event.title}
              </span>
              {event.partnerName && (
                <span className="hidden md:inline text-[10px] font-extrabold uppercase tracking-wider bg-[#fff000] text-[#141414] px-2 py-0.5 rounded-md border border-[#141414]/15">
                  × {event.partnerName}
                </span>
              )}
              {isAdminAuthenticated && (
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider bg-[#141414] text-[#fff000] px-2 py-0.5 rounded-md">
                  Admin Aktif
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-stone-500 flex items-center gap-1 truncate max-w-[200px] sm:max-w-md">
              <span>{event.date}</span>
              <span className="text-stone-300">•</span>
              <span className="text-[#141414] font-semibold truncate">{event.locationName}</span>
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold leading-none whitespace-nowrap border-2 transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-[#fff000] text-[#141414] border-[#141414] shadow-xs'
                : 'text-stone-600 hover:text-[#141414] hover:bg-stone-100 border-transparent'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline leading-none">Form Pendaftaran</span>
            <span className="sm:hidden leading-none">Form</span>
          </button>

          <button
            onClick={onOpenShareModal}
            className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold leading-none whitespace-nowrap border-2 border-stone-300 bg-yellow-50 text-[#141414] hover:bg-[#fff000] hover:border-[#141414] transition-all shadow-2xs group cursor-pointer"
            title="Bagikan Formulir Pendaftaran (QR Code & Link)"
          >
            <QrCode className="w-4 h-4 shrink-0 text-[#141414] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline leading-none">Bagikan Form</span>
            <span className="sm:hidden leading-none">Share</span>
          </button>

          {isAdminAuthenticated ? (
            <>
              <button
                onClick={() => setActiveTab('ticket')}
                className={`inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold leading-none whitespace-nowrap border-2 transition-all cursor-pointer ${
                  activeTab === 'ticket'
                    ? 'bg-[#fff000] text-[#141414] border-[#141414] shadow-xs'
                    : 'text-stone-600 hover:text-[#141414] hover:bg-stone-100 border-transparent'
                }`}
                title="Cek Tiket & Check-In Barcode Peserta"
              >
                <Search className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline leading-none">Cek & Check-In</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold leading-none whitespace-nowrap border-2 transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#141414] text-[#fff000] border-[#141414] shadow-sm'
                    : 'bg-white text-[#141414] border-stone-300 hover:bg-stone-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline leading-none">Dashboard Admin</span>
                <span className="md:hidden leading-none">Admin</span>
              </button>

              <button
                onClick={onLogoutAdmin}
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-transparent text-stone-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                title="Logout Admin"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onOpenAdminLogin('admin')}
              className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 rounded-xl text-xs font-bold leading-none whitespace-nowrap border-2 border-transparent text-stone-500 hover:text-[#141414] hover:bg-stone-100 hover:border-stone-200 transition-colors cursor-pointer"
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
