import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Database,
  Layers,
  Send,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  History,
  Cat,
  Dog,
  Settings,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import type {
  Registration,
  GoogleSheetConfig,
  SheetSyncAuditEntry,
  SheetSyncLiveState,
  SheetSyncAction,
  DailyRegistrationSnapshot,
} from '../types.ts';

const PET_COLORS = {
  kucing: '#D97706', // Warm Amber — distinct & high-contrast
  anjing: '#141414', // Obsidian Charcoal — matches REMOV brand ink
};

const ACTION_LABELS: Record<SheetSyncAction, string> = {
  NEW_REGISTRATION: 'Pendaftaran Baru',
  UPDATE_STATUS: 'Update Status / Jadwal',
  CHECK_IN_UPDATE: 'Check-In Booth',
  SYNC_ALL_REGISTRATIONS: 'Sinkronisasi Penuh',
  SYNC_PENDING_BATCH: 'Push Data Tertunda',
  EVENT_COMPLETED_FINAL_SYNC: 'Finalisasi Event',
  TEST_CONNECTION: 'Uji Koneksi',
};

function formatTimestampShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface PetDistributionDonutCardProps {
  registrations: Registration[];
  onFilterPetType?: (petType: 'kucing' | 'anjing') => void;
}

export const PetDistributionDonutCard: React.FC<PetDistributionDonutCardProps> = ({
  registrations,
  onFilterPetType,
}) => {
  const summary = useMemo(() => {
    const catList = registrations.filter((r) => r.petType === 'kucing');
    const dogList = registrations.filter((r) => r.petType === 'anjing');
    const total = registrations.length;
    const catPct = total > 0 ? Math.round((catList.length / total) * 100) : 0;
    const dogPct = total > 0 ? Math.max(0, 100 - catPct) : 0;

    const catVerified = catList.filter((r) => r.paymentStatus === 'verified').length;
    const dogVerified = dogList.filter((r) => r.paymentStatus === 'verified').length;

    const chartData = [
      {
        key: 'kucing' as const,
        name: 'Kucing',
        value: catList.length,
        percentage: catPct,
        verified: catVerified,
        color: PET_COLORS.kucing,
      },
      {
        key: 'anjing' as const,
        name: 'Anjing',
        value: dogList.length,
        percentage: total > 0 ? Math.round((dogList.length / total) * 100) : 0,
        verified: dogVerified,
        color: PET_COLORS.anjing,
      },
    ];

    const nonZeroChartData = chartData.filter((d) => d.value > 0);

    return {
      total,
      catCount: catList.length,
      dogCount: dogList.length,
      catPct,
      dogPct,
      catVerified,
      dogVerified,
      chartData,
      nonZeroChartData,
    };
  }, [registrations]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200 flex flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-[#141414]">
            Ringkasan Pendaftaran per Jenis Hewan
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Distribusi pendaftar Kucing vs Anabul Anjing pada event aktif.
          </p>
        </div>
        <span className="font-mono tabular-nums text-xs font-bold text-[#141414] bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg shrink-0">
          Total: {summary.total}
        </span>
      </div>

      {summary.total === 0 ? (
        <div className="py-10 px-4 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/60">
          <div className="flex items-center justify-center gap-2 text-stone-400 mb-2">
            <Cat className="w-5 h-5" />
            <Dog className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-[#141414]">Belum ada pendaftaran anabul</p>
          <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
            Grafik donat perbandingan Kucing dan Anjing akan muncul otomatis setelah pendaftar pertama masuk.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-5">
          {/* Recharts Donut Chart */}
          <div className="sm:col-span-5 relative h-[200px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={summary.nonZeroChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={summary.nonZeroChartData.length > 1 ? 3 : 0}
                  stroke="#ffffff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {summary.nonZeroChartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    `${Number(value)} Pendaftar (${summary.total > 0 ? Math.round((Number(value) / summary.total) * 100) : 0}%)`,
                    String(name),
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e7e5e4',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#141414',
                    boxShadow: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Metric Label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-heading font-black text-3xl text-[#141414] tabular-nums leading-none">
                {summary.total}
              </span>
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mt-1">
                Anabul
              </span>
            </div>
          </div>

          {/* Breakdown & Quick Filter Rows */}
          <div className="sm:col-span-7 divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
            {summary.chartData.map((row) => {
              const Icon = row.key === 'kucing' ? Cat : Dog;
              return (
                <div
                  key={row.key}
                  className="p-3.5 bg-white hover:bg-stone-50/70 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-8 rounded-sm shrink-0"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-[#141414] shrink-0" />
                        <span className="font-heading font-bold text-sm text-[#141414]">
                          {row.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 tabular-nums mt-0.5">
                        {row.verified} terverifikasi · {row.value - row.verified} menunggu/lainnya
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right tabular-nums">
                      <span className="font-heading font-black text-lg text-[#141414] block leading-tight">
                        {row.value}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-stone-500">
                        {row.percentage}%
                      </span>
                    </div>

                    {onFilterPetType && row.value > 0 && (
                      <button
                        type="button"
                        onClick={() => onFilterPetType(row.key)}
                        className="text-[11px] font-bold text-[#141414] bg-stone-100 hover:bg-[#fff000] border border-stone-300 hover:border-[#141414] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Lihat
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ratio Bar Footer */}
            <div className="px-3.5 py-2.5 bg-stone-50/70">
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600 tabular-nums mb-1.5">
                <span>Rasio Kucing vs Anjing</span>
                <span className="font-mono font-bold text-[#141414]">
                  {summary.catPct}% : {summary.dogPct}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden flex">
                {summary.catCount > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${summary.catPct}%`,
                      backgroundColor: PET_COLORS.kucing,
                    }}
                  />
                )}
                {summary.dogCount > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${summary.dogPct}%`,
                      backgroundColor: PET_COLORS.anjing,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DailyRegistrationTrendCardProps {
  dailySnapshots: DailyRegistrationSnapshot[];
  todayDateKey: string;
  todayDateLabel: string;
  yesterdayRegistrations?: number;
  lastUpdatedAt?: string;
  eventStatus?: 'active' | 'completed';
  eventDate?: string;
  onSelectDateFilter?: (dateKey: string) => void;
}

export const DailyRegistrationTrendCard: React.FC<DailyRegistrationTrendCardProps> = ({
  dailySnapshots,
  todayDateKey,
  todayDateLabel,
  yesterdayRegistrations = 0,
  lastUpdatedAt,
  eventStatus = 'active',
  eventDate,
  onSelectDateFilter,
}) => {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [chartMode, setChartMode] = useState<'daily' | 'both'>('daily');

  const summary = useMemo(() => {
    const sortedAsc = [...dailySnapshots].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const sortedDesc = [...sortedAsc].reverse();
    const totalCollected = sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1].cumulativeCount : 0;
    const todaySnap = sortedAsc.find((s) => s.dateKey === todayDateKey);
    const todayCount = todaySnap?.newCount ?? 0;
    const activeDays = sortedAsc.length;
    const avgPerDay = activeDays > 0 ? (totalCollected / activeDays).toFixed(1) : '0';
    const deltaVsYesterday = todayCount - yesterdayRegistrations;

    const chartData = sortedAsc.map((snap) => ({
      dateKey: snap.dateKey,
      label: snap.dateKey === todayDateKey ? 'Hari Ini' : snap.dateLabel,
      fullLabel: snap.dateLabel,
      newCount: snap.newCount,
      cumulativeCount: snap.cumulativeCount,
    }));

    return {
      sortedDesc,
      totalCollected,
      todayCount,
      activeDays,
      avgPerDay,
      deltaVsYesterday,
      chartData,
    };
  }, [dailySnapshots, todayDateKey, yesterdayRegistrations]);

  const toggleExpandDay = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const isCompleted = eventStatus === 'completed';

  const growthStatusText =
    summary.todayCount > 0
      ? `Bertambah +${summary.todayCount} peserta baru hari ini (${summary.deltaVsYesterday >= 0 ? `+${summary.deltaVsYesterday}` : summary.deltaVsYesterday} dibanding kemarin)`
      : summary.totalCollected > 0
      ? `Belum ada tambahan baru hari ini · ${summary.totalCollected} peserta tersimpan permanen`
      : 'Menunggu pendaftaran pertama';

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-1">
            <span className={isCompleted ? 'font-bold text-[#16A34A]' : 'font-bold text-[#141414]'}>
              {isCompleted ? 'Finalisasi Event · Statistik Terkunci' : 'Pembaruan Harian Aktif s/d Acara Selesai'}
            </span>
            <span aria-hidden="true">·</span>
            <span className={summary.todayCount > 0 ? 'font-bold text-[#16A34A]' : 'text-stone-600'}>
              {growthStatusText}
            </span>
            {eventDate && (
              <>
                <span aria-hidden="true">·</span>
                <span>Jadwal Acara: {eventDate}</span>
              </>
            )}
          </div>
          <h2 className="font-heading font-bold text-lg text-[#141414] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#141414]" />
            <span>Tren Laju Pendaftar Per Hari &amp; Rekap Peserta</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Panitia dapat memantau laju penambahan peserta per hari menjelang hari-H dan memastikan seluruh pendaftar tetap tersimpan aman setiap hari.
          </p>
        </div>

        <a
          href="/api/admin/daily-recap.csv"
          className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-[#141414] border border-stone-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh Rekap Harian (.csv)</span>
        </a>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-stone-200 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-stone-200 bg-stone-50/50">
        <div className="p-4">
          <span className="text-[11px] font-bold text-stone-500 block">Pertambahan Hari Ini</span>
          <strong className={`font-heading font-black text-2xl tabular-nums block mt-0.5 ${summary.todayCount > 0 ? 'text-[#16A34A]' : 'text-[#141414]'}`}>
            +{summary.todayCount}
          </strong>
          <span className="text-[11px] text-stone-500 tabular-nums block mt-0.5">
            {todayDateLabel} · Kemarin: +{yesterdayRegistrations}
          </span>
        </div>

        <div className="p-4">
          <span className="text-[11px] font-bold text-stone-500 block">Total Terkumpul</span>
          <strong className="font-heading font-black text-2xl text-[#16A34A] tabular-nums block mt-0.5">
            {summary.totalCollected}
          </strong>
          <span className="text-[11px] text-stone-500 block mt-0.5">
            {isCompleted ? 'Total final acara selesai' : 'Data peserta tersimpan utuh'}
          </span>
        </div>

        <div className="p-4">
          <span className="text-[11px] font-bold text-stone-500 block">Hari Pengumpulan</span>
          <strong className="font-heading font-black text-2xl text-[#141414] tabular-nums block mt-0.5">
            {summary.activeDays} Hari
          </strong>
          <span className="text-[11px] text-stone-500 tabular-nums block mt-0.5">
            Rata-rata {summary.avgPerDay} peserta/hari
          </span>
        </div>

        <div className="p-4">
          <span className="text-[11px] font-bold text-stone-500 block">Terakhir Diperbarui</span>
          <strong className="font-mono font-bold text-xs sm:text-sm text-[#141414] tabular-nums block mt-1.5">
            {formatTimestampShort(lastUpdatedAt)}
          </strong>
          <span className="text-[11px] text-stone-500 block mt-0.5">
            {isCompleted ? 'Tersimpan di arsip jadwal' : 'Backup harian aktif otomatis'}
          </span>
        </div>
      </div>

      {/* Line Chart + Daily Participant Log */}
      {summary.sortedDesc.length === 0 ? (
        <div className="py-10 px-4 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/60">
          <Calendar className="w-6 h-6 text-stone-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-[#141414]">Belum ada riwayat pendaftaran harian</p>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            Saat peserta mengisi formulir dari hari ke hari menjelang acara, grafik garis tren harian dan daftar nama per tanggal akan langsung muncul dan tersimpan otomatis di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Recharts Line Chart: Daily Pace & Optional Cumulative */}
          <div className="lg:col-span-6 border border-stone-200 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#141414]">
                  Grafik Tren Jumlah Pendaftar Per Hari
                </h3>
                <p className="text-[11px] text-stone-500">
                  {chartMode === 'daily'
                    ? 'Garis hitam = jumlah pendaftar baru per tanggal'
                    : 'Garis hitam = harian · Garis amber = akumulasi total'}
                </p>
              </div>

              <div className="inline-flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setChartMode('daily')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    chartMode === 'daily'
                      ? 'bg-white text-[#141414] border border-stone-200'
                      : 'text-stone-600 hover:text-[#141414]'
                  }`}
                >
                  Laju Per Hari
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('both')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    chartMode === 'both'
                      ? 'bg-white text-[#141414] border border-stone-200'
                      : 'text-stone-600 hover:text-[#141414]'
                  }`}
                >
                  + Akumulasi
                </button>
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={summary.chartData} margin={{ top: 10, right: 14, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#57534e' }}
                    axisLine={{ stroke: '#d6d3d1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#57534e' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      `${Number(value)} Peserta`,
                      name === 'newCount' ? 'Pendaftar Baru Hari Ini' : 'Akumulasi Total',
                    ]}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload;
                      return item ? `Tanggal: ${item.fullLabel} (${item.dateKey})` : '';
                    }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e7e5e4',
                      fontSize: '12px',
                      color: '#141414',
                      boxShadow: 'none',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="newCount"
                    name="newCount"
                    stroke="#141414"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#fff000', stroke: '#141414', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#141414', stroke: '#fff000', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  {chartMode === 'both' && (
                    <Line
                      type="monotone"
                      dataKey="cumulativeCount"
                      name="cumulativeCount"
                      stroke="#D97706"
                      strokeWidth={2.5}
                      strokeDasharray="5 4"
                      dot={{ r: 4, fill: '#D97706', stroke: '#ffffff', strokeWidth: 1.5 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Participant Log Table */}
          <div className="lg:col-span-6 border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between gap-2">
              <h3 className="font-heading font-bold text-sm text-[#141414]">
                Daftar Siapa Saja yang Mendaftar Per Hari
              </h3>
              <span className="font-mono text-[11px] font-bold text-stone-600 tabular-nums">
                {summary.sortedDesc.length} Tanggal
              </span>
            </div>

            <div className="divide-y divide-stone-100 max-h-[280px] overflow-y-auto">
              {summary.sortedDesc.map((snap) => {
                const isToday = snap.dateKey === todayDateKey;
                const isExpanded = !!expandedDates[snap.dateKey];
                const visibleParticipants = isExpanded
                  ? snap.participants
                  : snap.participants.slice(0, 3);
                const hiddenCount = Math.max(0, snap.participants.length - visibleParticipants.length);

                return (
                  <div key={snap.dateKey} className="p-3.5 bg-white hover:bg-stone-50/70 transition-colors space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs min-w-0">
                        <strong className="font-heading text-[#141414] whitespace-nowrap">
                          {snap.dateLabel}
                        </strong>
                        {isToday && (
                          <span className="text-[11px] font-bold text-[#16A34A] whitespace-nowrap">
                            · Hari Ini
                          </span>
                        )}
                        <span className="text-[11px] text-stone-400 font-mono tabular-nums">
                          ({snap.dateKey})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] tabular-nums shrink-0">
                        <span className="font-mono font-bold text-[#141414]">
                          +{snap.newCount} baru
                        </span>
                        <span className="text-stone-300" aria-hidden="true">·</span>
                        <span className="font-mono text-stone-600">
                          Total: {snap.cumulativeCount}
                        </span>
                        {onSelectDateFilter && (
                          <button
                            type="button"
                            onClick={() => onSelectDateFilter(snap.dateKey)}
                            className="text-[11px] font-bold text-[#141414] bg-stone-100 hover:bg-[#fff000] border border-stone-300 hover:border-[#141414] px-2 py-0.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Lihat Tabel
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-stone-500 tabular-nums">
                      {snap.catCount} Kucing · {snap.dogCount} Anjing · {snap.checkedInCount} Hadir Booth
                    </div>

                    <div className="space-y-1 pt-0.5">
                      {visibleParticipants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 text-xs text-stone-700 py-0.5"
                        >
                          <div className="truncate min-w-0">
                            <span className="font-mono font-bold text-[#141414] mr-1.5">
                              #{p.queueNumber || '--'}
                            </span>
                            <span className="font-semibold text-[#141414]">{p.ownerName}</span>
                            <span className="text-stone-400 mx-1">·</span>
                            <span>
                              {p.petName} ({p.petType === 'kucing' ? 'Kucing' : 'Anjing'})
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 truncate max-w-[140px] shrink-0">
                            {p.vaccineName}
                          </span>
                        </div>
                      ))}

                      {(hiddenCount > 0 || isExpanded) && snap.participants.length > 3 && (
                        <button
                          type="button"
                          onClick={() => toggleExpandDay(snap.dateKey)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#141414] hover:underline pt-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Tampilkan lebih ringkas</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>+{hiddenCount} peserta lainnya di tanggal ini</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface RealtimeSheetSyncVisualizerProps {
  sheetConfig: GoogleSheetConfig;
  sheetSyncState?: SheetSyncLiveState;
  registrations: Registration[];
  isSyncingPending: boolean;
  isSyncingAll: boolean;
  onSyncPending: () => void;
  onSyncAll: () => void;
  onOpenSheetSettings?: () => void;
}

export const RealtimeSheetSyncVisualizer: React.FC<RealtimeSheetSyncVisualizerProps> = ({
  sheetConfig,
  sheetSyncState,
  registrations,
  isSyncingPending,
  isSyncingAll,
  onSyncPending,
  onSyncAll,
  onOpenSheetSettings,
}) => {
  const totalRegs = sheetSyncState?.totalRegistrationsCount ?? registrations.length;
  const syncedRegs =
    sheetSyncState?.syncedRegistrationsCount ??
    registrations.filter((r) => r.syncedToGoogleSheet).length;
  const unsyncedRegs = Math.max(0, totalRegs - syncedRegs);
  const syncCoveragePct = totalRegs > 0 ? Math.round((syncedRegs / totalRegs) * 100) : 100;

  const webhookConfigured =
    sheetSyncState?.webhookConfigured ??
    Boolean(sheetConfig.webhookUrl && sheetConfig.webhookUrl.trim().startsWith('http'));
  const pipelineStatus =
    sheetSyncState?.pipelineStatus ?? (webhookConfigured ? 'idle' : 'unconfigured');
  const pendingQueueCount = sheetSyncState?.pendingQueueCount ?? 0;
  const activeJob = sheetSyncState?.activeJob ?? null;
  const queuedJobs = sheetSyncState?.queuedJobs ?? [];

  const isActiveTransfer = pipelineStatus === 'pushing' || pipelineStatus === 'retrying';

  const statusDescriptor = (() => {
    if (pipelineStatus === 'retrying') {
      return {
        label: 'Mengulang Push (Retry Backoff)',
        dotCls: 'bg-[#D97706]',
        textCls: 'text-[#D97706]',
        borderCls: 'border-amber-300 bg-amber-50/70',
      };
    }
    if (pipelineStatus === 'pushing') {
      return {
        label: 'Sedang Mengirim Data ke Sheets',
        dotCls: 'bg-[#16A34A] animate-pulse',
        textCls: 'text-[#16A34A]',
        borderCls: 'border-emerald-300 bg-emerald-50/70',
      };
    }
    if (!webhookConfigured) {
      return {
        label: 'Webhook Belum Diatur (Data Aman di Buffer Lokal)',
        dotCls: 'bg-[#D97706]',
        textCls: 'text-[#D97706]',
        borderCls: 'border-amber-300 bg-amber-50/60',
      };
    }
    if (sheetConfig.lastSyncStatus === 'failed') {
      return {
        label: 'Siaga · Transaksi Terakhir Gagal',
        dotCls: 'bg-[#DC2626]',
        textCls: 'text-[#DC2626]',
        borderCls: 'border-rose-300 bg-rose-50/60',
      };
    }
    return {
      label: 'Pipeline Siaga · Sinkron Real-Time Aktif',
      dotCls: 'bg-[#16A34A]',
      textCls: 'text-[#16A34A]',
      borderCls: 'border-emerald-200 bg-emerald-50/50',
    };
  })();

  const stages = [
    {
      id: 'capture',
      title: '1. Data Masuk',
      metric: `${totalRegs} Data`,
      sub: 'Tersimpan lokal',
      icon: Database,
      state: totalRegs > 0 ? 'done' : 'standby',
    },
    {
      id: 'queue',
      title: '2. Buffer Antrean',
      metric: `${pendingQueueCount} Antre`,
      sub: pendingQueueCount > 0 ? 'Antrean serial aktif' : 'Bebas penumpukan',
      icon: Layers,
      state: pendingQueueCount > 0 ? 'active' : 'standby',
    },
    {
      id: 'push',
      title: '3. Push Webhook',
      metric:
        activeJob
          ? `Try ${activeJob.attempt}/${activeJob.maxAttempts}`
          : pipelineStatus === 'unconfigured'
          ? 'Off'
          : 'Siap',
      sub: activeJob ? ACTION_LABELS[activeJob.action] : sheetConfig.autoSync ? 'Auto-push aktif' : 'Mode manual',
      icon: Send,
      state:
        pipelineStatus === 'retrying'
          ? 'warn'
          : isActiveTransfer
          ? 'active'
          : webhookConfigured
          ? 'done'
          : 'warn',
    },
    {
      id: 'sheets',
      title: '4. Google Sheets',
      metric: `${syncedRegs}/${totalRegs}`,
      sub: unsyncedRegs > 0 ? `${unsyncedRegs} menunggu push` : 'Semua tercatat',
      icon: FileSpreadsheet,
      state:
        !webhookConfigured
          ? 'warn'
          : unsyncedRegs === 0
          ? 'done'
          : 'warn',
    },
  ] as const;

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-[#141414]">
            Visualizer Sinkronisasi Real-Time Google Sheets
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Antrean berurutan &amp; retry otomatis mencegah kehilangan data saat traffic pendaftaran tinggi.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 ${statusDescriptor.borderCls} ${statusDescriptor.textCls}`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDescriptor.dotCls}`} />
          <span>{statusDescriptor.label}</span>
        </div>
      </div>

      {/* 4-Stage Pipeline Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          const borderStyle =
            st.state === 'active'
              ? 'border-[#141414] bg-yellow-50/60'
              : st.state === 'warn'
              ? 'border-amber-300 bg-amber-50/40'
              : st.state === 'done'
              ? 'border-emerald-200 bg-emerald-50/30'
              : 'border-stone-200 bg-stone-50/50';

          return (
            <div
              key={st.id}
              className={`relative rounded-2xl border p-3.5 flex items-center justify-between gap-3 ${borderStyle}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200 flex items-center justify-center shrink-0">
                  <Icon
                    className={`w-4 h-4 ${
                      st.state === 'active'
                        ? 'text-[#141414]'
                        : st.state === 'warn'
                        ? 'text-[#D97706]'
                        : st.state === 'done'
                        ? 'text-[#16A34A]'
                        : 'text-stone-500'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-stone-500 block truncate">
                    {st.title}
                  </span>
                  <strong className="font-heading font-extrabold text-sm text-[#141414] tabular-nums block">
                    {st.metric}
                  </strong>
                  <span className="text-[11px] text-stone-500 block truncate">{st.sub}</span>
                </div>
              </div>

              {idx < stages.length - 1 && (
                <ArrowRight className="hidden lg:block w-4 h-4 text-stone-300 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Coverage Progress & Live Queue Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Sync Coverage Meter */}
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 p-4 bg-stone-50/50 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#141414]">Cakupan Data di Sheets</span>
            <span className="font-mono text-xs font-bold text-[#141414] tabular-nums">
              {syncedRegs}/{totalRegs} ({syncCoveragePct}%)
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={`h-full transition-all ${
                unsyncedRegs === 0 ? 'bg-[#16A34A]' : 'bg-[#D97706]'
              }`}
              style={{ width: `${syncCoveragePct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-600 tabular-nums pt-1 border-t border-stone-200/80">
            <span>Tersinkron: <strong className="text-[#16A34A]">{syncedRegs}</strong></span>
            <span>Tertunda: <strong className={unsyncedRegs > 0 ? 'text-[#D97706]' : 'text-[#141414]'}>{unsyncedRegs}</strong></span>
            <span>Terakhir: <strong className="font-mono text-[#141414]">{formatTimestampShort(sheetConfig.lastSyncTime)}</strong></span>
          </div>
        </div>

        {/* Live Traffic Buffer & Active Job Monitor */}
        <div className="lg:col-span-7 rounded-2xl border border-stone-200 p-4 bg-white flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#141414]">
              Status Antrean &amp; Proses Pengiriman Aktif
            </span>
            <span className="font-mono text-[11px] text-stone-500 tabular-nums">
              Sesi ini: {sheetSyncState?.sessionCompletedCount ?? 0} sukses · {sheetSyncState?.sessionFailedCount ?? 0} gagal
            </span>
          </div>

          {activeJob || queuedJobs.length > 0 ? (
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {activeJob && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-yellow-50 border border-[#141414]/25 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="w-3.5 h-3.5 text-[#141414] animate-spin shrink-0" />
                    <span className="font-bold text-[#141414] truncate">
                      {ACTION_LABELS[activeJob.action]} · {activeJob.targetLabel}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#141414] tabular-nums shrink-0">
                    {activeJob.status === 'retrying' ? 'Retry' : 'Push'} {activeJob.attempt}/{activeJob.maxAttempts}
                  </span>
                </div>
              )}
              {queuedJobs.map((job, idx) => (
                <div
                  key={job.jobId}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-700"
                >
                  <span className="truncate">
                    Antre #{idx + 1} · {ACTION_LABELS[job.action]} · {job.targetLabel}
                  </span>
                  <span className="font-mono text-stone-500 tabular-nums shrink-0">
                    {job.recordCount} data
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-stone-600 bg-stone-50 rounded-xl px-3 py-2.5 border border-stone-200/80 flex items-center justify-between gap-2">
              <span className="truncate">
                {!webhookConfigured
                  ? 'Webhook URL Google Sheets belum diisi. Data pendaftar tetap aman tersimpan di database lokal.'
                  : sheetConfig.lastSyncMessage || 'Tidak ada antrean tertunda. Siap memproses traffic pendaftaran secara berurutan.'}
              </span>
              {sheetConfig.lastSyncStatus === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              )}
              {sheetConfig.lastSyncStatus === 'failed' && (
                <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              )}
            </div>
          )}

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-stone-500">
              {unsyncedRegs > 0
                ? `${unsyncedRegs} data pendaftar belum ditandai tersinkron ke Google Sheets.`
                : 'Seluruh pendaftar aktif tercatat tersinkron.'}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {webhookConfigured && unsyncedRegs > 0 && (
                <button
                  type="button"
                  disabled={isSyncingPending || isSyncingAll}
                  onClick={onSyncPending}
                  className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 disabled:bg-stone-200 text-[#141414] border border-[#141414] text-xs font-extrabold px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPending ? 'animate-spin' : ''}`} />
                  <span>Push {unsyncedRegs} Tertunda</span>
                </button>
              )}

              {webhookConfigured && (
                <button
                  type="button"
                  disabled={isSyncingAll || isSyncingPending}
                  onClick={onSyncAll}
                  className="inline-flex items-center gap-1.5 bg-[#16A34A] hover:bg-emerald-700 disabled:bg-stone-300 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Send className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-pulse' : ''}`} />
                  <span>{isSyncingAll ? 'Menyinkronkan...' : 'Sinkronkan Semua'}</span>
                </button>
              )}

              {onOpenSheetSettings && (
                <button
                  type="button"
                  onClick={onOpenSheetSettings}
                  className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-[#141414] border border-stone-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{webhookConfigured ? 'Pengaturan Sheets' : 'Atur URL Webhook'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SheetAuditLogPanelProps {
  logs: SheetSyncAuditEntry[];
  webhookConfigured: boolean;
  onOpenSheetSettings?: () => void;
  onTestConnection?: () => void;
  isTestingSheet?: boolean;
}

export const SheetAuditLogPanel: React.FC<SheetAuditLogPanelProps> = ({
  logs,
  webhookConfigured,
  onOpenSheetSettings,
  onTestConnection,
  isTestingSheet,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const counts = useMemo(() => {
    const success = logs.filter((l) => l.status === 'success').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    return { total: logs.length, success, failed };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.targetLabel.toLowerCase().includes(q) ||
        (entry.regNumber || '').toLowerCase().includes(q) ||
        ACTION_LABELS[entry.action].toLowerCase().includes(q) ||
        entry.message.toLowerCase().includes(q)
      );
    });
  }, [logs, statusFilter, searchQuery]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-[#141414] flex items-center gap-2">
            <History className="w-5 h-5 text-[#141414]" />
            <span>Audit Log Sinkronisasi Google Sheets</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Riwayat transaksi pengiriman data aplikasi ke Google Sheets beserta timestamp, jumlah percobaan, dan status respons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums shrink-0">
          <span className="font-mono font-bold text-[#141414] bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg">
            Total: {counts.total}
          </span>
          <span className="font-mono font-bold text-[#16A34A] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            Berhasil: {counts.success}
          </span>
          <span className="font-mono font-bold text-[#DC2626] bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
            Gagal: {counts.failed}
          </span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 w-fit">
          {[
            { id: 'all' as const, label: `Semua (${counts.total})` },
            { id: 'success' as const, label: `Berhasil (${counts.success})` },
            { id: 'failed' as const, label: `Gagal (${counts.failed})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-white text-[#141414] border border-stone-200'
                  : 'text-stone-600 hover:text-[#141414]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari target, No. Reg, atau pesan..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-[#141414]"
          />
        </div>
      </div>

      {/* Log Table or Empty State */}
      {logs.length === 0 ? (
        <div className="py-10 px-4 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/60 space-y-3">
          <Clock className="w-7 h-7 text-stone-400 mx-auto" />
          <div>
            <p className="text-sm font-bold text-[#141414]">
              Belum ada riwayat transaksi sinkronisasi Google Sheets
            </p>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              Setiap push otomatis pendaftar baru, update check-in booth, uji koneksi, maupun sinkronisasi batch akan tercatat permanen di audit log ini.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {webhookConfigured && onTestConnection && (
              <button
                type="button"
                disabled={isTestingSheet}
                onClick={onTestConnection}
                className="inline-flex items-center gap-1.5 bg-[#fff000] hover:bg-yellow-300 text-[#141414] border border-[#141414] text-xs font-extrabold px-3.5 py-2 rounded-xl cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSheet ? 'animate-spin' : ''}`} />
                <span>Uji Koneksi Sekarang</span>
              </button>
            )}
            {onOpenSheetSettings && (
              <button
                type="button"
                onClick={onOpenSheetSettings}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-100 text-[#141414] border border-stone-300 text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{webhookConfigured ? 'Lihat Konfigurasi Sheets' : 'Konfigurasi Google Sheets'}</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-8 text-center border border-stone-200 rounded-2xl bg-stone-50/40 text-xs text-stone-500">
          Tidak ada entri audit log yang cocok dengan filter pencarian saat ini.
        </div>
      ) : (
        <div className="overflow-x-auto border border-stone-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Waktu Transaksi</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Jenis Aksi</th>
                <th className="py-2.5 px-3.5">Target / Peserta</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Data</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Retry · Durasi</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3.5">Keterangan Respons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredLogs.slice(0, 50).map((entry) => {
                const isSuccess = entry.status === 'success';
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-stone-50/80 transition-colors h-10"
                  >
                    <td className="py-2 px-3.5 font-mono text-[11px] text-stone-600 tabular-nums whitespace-nowrap">
                      {formatTimestampShort(entry.completedAt || entry.createdAt)}
                    </td>
                    <td className="py-2 px-3.5 font-bold text-[#141414] whitespace-nowrap">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </td>
                    <td className="py-2 px-3.5 text-[#141414] max-w-[220px]">
                      <span className="font-semibold block truncate">{entry.targetLabel}</span>
                      {entry.regNumber && (
                        <span className="font-mono text-[10px] text-stone-500">{entry.regNumber}</span>
                      )}
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono tabular-nums text-stone-700 whitespace-nowrap">
                      {entry.recordCount}
                    </td>
                    <td className="py-2 px-3.5 text-right font-mono text-[11px] text-stone-600 tabular-nums whitespace-nowrap">
                      {entry.attempts}x · {entry.durationMs} ms
                    </td>
                    <td className="py-2 px-3.5 whitespace-nowrap">
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Berhasil</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#DC2626] font-bold text-[11px]">
                          {entry.attempts > 1 ? (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>Gagal</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3.5 text-stone-600 max-w-[260px] truncate" title={entry.message}>
                      {entry.message}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
