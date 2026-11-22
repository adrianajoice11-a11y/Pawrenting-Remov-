import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { RegistrationForm } from './components/RegistrationForm.tsx';
import { CheckTicketModal } from './components/CheckTicketModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { ShareFormModal } from './components/ShareFormModal.tsx';
import type { EventConfig, VaccineOption } from './types.ts';
import { AlertCircle, Lock, QrCode, LogOut, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'ticket' | 'admin'>('form');
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [vaccines, setVaccines] = useState<VaccineOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('remov_admin_auth') === 'true';
    }
    return false;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginTargetTab, setLoginTargetTab] = useState<'admin' | 'ticket'>('admin');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const fetchEventData = useCallback(async (force = false) => {
    if (isFetchingRef.current && !force) return;
    isFetchingRef.current = true;

    const maxAttempts = 3;
    try {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (!isMountedRef.current) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('Koneksi internet sedang terputus');
        }
        try {
          const res = await fetch(`/api/event?_t=${Date.now()}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`Gagal memuat informasi event (${res.status})`);
          const data = await res.json();
          if (data.success && isMountedRef.current) {
            setEvent(data.event);
            setVaccines(data.vaccines || []);
            setFetchError(null);
          }
          return;
        } catch (err) {
          lastErr = err;
          if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)));
          }
        }
      }

      if (isMountedRef.current) {
        const errMsg = lastErr instanceof Error ? lastErr.message : 'Tidak dapat terhubung ke server';
        console.warn('Transient event fetch failure:', errMsg);
        setFetchError(
          errMsg === 'Failed to fetch'
            ? 'Koneksi ke server terputus sementara'
            : errMsg
        );
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchEventData(true);

    // Single shared real-time SSE listener so any Admin/Customer change updates all components
    let evtSource: EventSource | null = null;
    let hasConnectedOnce = false;
    if (typeof EventSource !== 'undefined') {
      evtSource = new EventSource('/api/events/stream');
      evtSource.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed?.type === 'update') {
            fetchEventData();
            window.dispatchEvent(new CustomEvent('remov:server-update'));
          } else if (parsed?.type === 'connected') {
            if (hasConnectedOnce) {
              fetchEventData();
              window.dispatchEvent(new CustomEvent('remov:server-update'));
            }
            hasConnectedOnce = true;
          }
        } catch {
          // Ignore heartbeat / malformed frames
        }
      };
      evtSource.onerror = () => {
        // Browser EventSource automatically reconnects; avoid surfacing transient noise
      };
    }

    // Cross-tab instant sync within same browser
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('remov_event_sync');
      bc.onmessage = () => {
        fetchEventData();
      };
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchEventData();
      }
    }, 8000);
    const handleFocusRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchEventData();
      }
    };
    const handleOnlineRefresh = () => {
      fetchEventData(true);
    };

    window.addEventListener('focus', handleFocusRefresh);
    window.addEventListener('online', handleOnlineRefresh);
    document.addEventListener('visibilitychange', handleFocusRefresh);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      evtSource?.close();
      bc?.close();
      window.removeEventListener('focus', handleFocusRefresh);
      window.removeEventListener('online', handleOnlineRefresh);
      document.removeEventListener('visibilitychange', handleFocusRefresh);
    };
  }, [fetchEventData]);

  // Sync browser tab title & meta description with latest Admin event configuration
  useEffect(() => {
    if (!event) return;
    const titleSuffix = event.partnerName ? ` × ${event.partnerName}` : '';
    document.title = `${event.title}${titleSuffix} — ${event.subtitle || 'Formulir Pendaftaran'}`;
  }, [event?.title, event?.partnerName, event?.subtitle]);

  const handleTabChange = (targetTab: 'form' | 'ticket' | 'admin') => {
    if (targetTab === 'form') {
      setActiveTab('form');
      fetchEventData();
      return;
    }

    if (!isAdminAuthenticated) {
      setLoginTargetTab(targetTab);
      setIsLoginModalOpen(true);
      return;
    }

    setActiveTab(targetTab);
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setActiveTab(loginTargetTab);
  };

  const handleLogoutAdmin = () => {
    sessionStorage.removeItem('remov_admin_auth');
    setIsAdminAuthenticated(false);
    setActiveTab('form');
  };

  const totalSeats = vaccines.reduce((sum, v) => sum + (v.totalQuota || 0), 0);
  const availableSeats = vaccines.reduce((sum, v) => sum + (v.availableQuota ?? 0), 0);

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-[#fefdf5] flex flex-col items-center justify-center p-4">
        <img
          src="/logos/remov-logo.svg"
          alt="Logo REMOV"
          className="h-16 w-auto object-contain rounded-2xl bg-[#fff000] p-2 border-2 border-[#141414] shadow-lg animate-bounce mb-4"
        />
        <h2 className="font-heading font-bold text-lg text-[#141414]">
          Memuat Sistem Pawrenting REMOV...
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Menyiapkan kuota vaksin real-time & formulir pendaftaran
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fefdf5] selection:bg-[#fff000] selection:text-[#141414]">
      {event && (
        <Header
          event={event}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          isAdminAuthenticated={isAdminAuthenticated}
          onOpenAdminLogin={(tab) => {
            setLoginTargetTab(tab);
            setIsLoginModalOpen(true);
          }}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onLogoutAdmin={handleLogoutAdmin}
          availableSummary={{
            totalSeats,
            availableSeats,
          }}
        />
      )}

      <main className="flex-1">
        {fetchError && (
          <div className="max-w-4xl mx-auto px-4 mt-4">
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{fetchError}. Memeriksa kembali secara berkala...</span>
              </div>
              <button
                type="button"
                onClick={() => fetchEventData(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 font-bold text-xs hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'form' && event && (
          <RegistrationForm
            event={event}
            vaccines={vaccines}
            onRefreshData={fetchEventData}
            onViewTicket={() => {
              if (isAdminAuthenticated) {
                setActiveTab('ticket');
              } else {
                setLoginTargetTab('ticket');
                setIsLoginModalOpen(true);
              }
            }}
          />
        )}

        {activeTab === 'ticket' && event && isAdminAuthenticated && (
          <CheckTicketModal
            event={event}
            onBackToForm={() => setActiveTab('form')}
            onRefreshParent={fetchEventData}
          />
        )}

        {activeTab === 'admin' && isAdminAuthenticated && (
          <AdminDashboard
            onBackToPublic={() => setActiveTab('form')}
            onRefreshParent={fetchEventData}
            onOpenShareModal={() => setIsShareModalOpen(true)}
          />
        )}
      </main>

      {event && (
        <ShareFormModal
          event={event}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          onEventUpdated={fetchEventData}
        />
      )}

      <AdminLoginModal
        isOpen={isLoginModalOpen}
        targetTabName={loginTargetTab === 'ticket' ? 'Cek Tiket & Check-In Peserta' : 'Dashboard Admin'}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      <footer className="no-print bg-white border-t border-stone-200 py-8 px-4 text-stone-600">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <img
              src={event?.removLogoUrl || '/logos/remov-logo.svg'}
              alt="REMOV"
              className="h-8 w-auto object-contain rounded-lg bg-[#fff000] p-1 border border-stone-300"
            />
            {event?.partnerLogoUrl && (
              <img
                src={event.partnerLogoUrl}
                alt={event.partnerName || 'Partner'}
                className="h-8 w-auto object-contain rounded-lg bg-white p-1 border border-stone-200"
              />
            )}
            <div>
              <span className="font-heading font-bold text-[#141414] block">
                {event?.title || 'Pawrenting REMOV Official Care'}{event?.partnerName ? ` × ${event.partnerName}` : ''}
              </span>
              <span className="text-stone-400">
                {event?.subtitle || 'Solusi Perawatan & Vaksinasi Sehat untuk Kucing & Anjing Kesayangan'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-stone-500 flex-wrap justify-center">
            <button
              onClick={() => setActiveTab('form')}
              className="hover:text-[#141414] font-semibold"
            >
              Formulir Pendaftaran
            </button>

            <span>•</span>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="hover:text-[#141414] font-semibold inline-flex items-center gap-1 text-[#141414]"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Bagikan Form (QR & Link)</span>
            </button>

            <span>•</span>

            {isAdminAuthenticated ? (
              <>
                <button
                  onClick={() => setActiveTab('ticket')}
                  className="hover:text-[#141414] font-semibold"
                >
                  Cek & Check-In (Admin)
                </button>
                <span>•</span>
                <button
                  onClick={() => setActiveTab('admin')}
                  className="hover:text-[#141414] font-semibold"
                >
                  Dashboard Admin
                </button>
                <span>•</span>
                <button
                  onClick={handleLogoutAdmin}
                  className="hover:text-rose-600 font-semibold text-rose-500 inline-flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setLoginTargetTab('admin');
                  setIsLoginModalOpen(true);
                }}
                className="hover:text-[#141414] font-medium text-stone-400 inline-flex items-center gap-1"
                title="Khusus Panitia Event"
              >
                <Lock className="w-3 h-3" />
                <span>Akses Panitia (Admin)</span>
              </button>
            )}
          </div>

          <div className="text-stone-400 text-center md:text-right">
            <span>© {new Date().getFullYear()} REMOV Indonesia. Semua Hak Dilindungi.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
