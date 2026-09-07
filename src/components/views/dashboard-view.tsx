"use client";

/**
 * Dashboard view — "Modern Clinical Laboratory SaaS" landing screen.
 * Data source: GET /api/dashboard (DashboardData, see worklog.md contract).
 * Layout: KPI row (6 stat cards) -> charts grid (recharts) -> recent sessions list.
 * Palette: teal/emerald accent; status colors emerald/amber/red, review violet/slate.
 */

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DashboardData, SessionStatus } from "@/types/pme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ListChecks,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------ palette ---------------------------------- */

const COLORS = {
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  teal: "#14b8a6",
  slate: "#64748b",
  violet: "#8b5cf6",
} as const;

/** zDistribution buckets arrive in fixed order: ≤-3, -3..-2, -2..0, 0..2, 2..3, ≥3. */
const Z_DIST_COLORS = [
  COLORS.red,
  COLORS.amber,
  COLORS.emerald,
  COLORS.emerald,
  COLORS.amber,
  COLORS.red,
];

const STATUS_COLORS: Record<string, string> = {
  SATISFACTORY: COLORS.emerald,
  WARNING: COLORS.amber,
  UNSATISFACTORY: COLORS.red,
  REVIEW: COLORS.violet,
};

const AXIS_TICK = { fontSize: 11, fill: COLORS.slate };
const AXIS_LINE = { stroke: "rgba(100,116,139,0.25)" };
const GRID_STROKE = "rgba(100,116,139,0.15)";
const CURSOR = { fill: "rgba(100,116,139,0.12)" } as const;

/* ------------------------------- helpers --------------------------------- */

type Tone = "teal" | "violet" | "emerald" | "amber" | "red" | "slate";

const TONE_CLASSES: Record<Tone, { iconBg: string; iconText: string }> = {
  teal: { iconBg: "bg-teal-500/10", iconText: "text-teal-600 dark:text-teal-400" },
  violet: { iconBg: "bg-violet-500/10", iconText: "text-violet-600 dark:text-violet-400" },
  emerald: { iconBg: "bg-emerald-500/10", iconText: "text-emerald-600 dark:text-emerald-400" },
  amber: { iconBg: "bg-amber-500/10", iconText: "text-amber-600 dark:text-amber-400" },
  red: { iconBg: "bg-red-500/10", iconText: "text-red-600 dark:text-red-400" },
  slate: { iconBg: "bg-slate-500/10", iconText: "text-slate-600 dark:text-slate-400" },
};

const SESSION_BADGE: Record<SessionStatus, { label: string; className: string; pulse?: boolean }> = {
  UPLOADED: {
    label: "Diunggah",
    className: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  EXTRACTING: {
    label: "Ekstraksi Teks",
    className: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    pulse: true,
  },
  VALIDATING: {
    label: "Validasi",
    className: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    pulse: true,
  },
  REVIEW_REQUIRED: {
    label: "Perlu Review",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  ANALYZING: {
    label: "Analisis Evaluasi",
    className: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    pulse: true,
  },
  COMPLETED: {
    label: "Selesai",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  FAILED: {
    label: "Gagal",
    className: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

function fmtNum(value: string | number | undefined): string {
  if (value === undefined) return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

function truncateText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;
}

function zStatusColor(zStatus: string | null): string {
  if (zStatus === "SATISFACTORY") return COLORS.emerald;
  if (zStatus === "WARNING") return COLORS.amber;
  if (zStatus === "UNSATISFACTORY") return COLORS.red;
  return COLORS.slate;
}

function confidenceColor(name: string): string {
  if (name.startsWith("High")) return COLORS.emerald;
  if (name.startsWith("Medium")) return COLORS.amber;
  return COLORS.red;
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: localeId });
  } catch {
    return iso;
  }
}

function fullTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/* ------------------------------ subcomponents ----------------------------- */

interface KpiCardProps {
  label: string;
  value: number;
  sub: string;
  icon: LucideIcon;
  tone: Tone;
}

function KpiCard({ label, value, sub, icon: Icon, tone }: KpiCardProps) {
  const t = TONE_CLASSES[tone];
  return (
    <Card className="gap-0 py-0 transition-shadow hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", t.iconBg)}>
          <Icon className={cn("h-[18px] w-[18px]", t.iconText)} aria-hidden="true" />
        </span>
        <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
          {value.toLocaleString("id-ID")}
        </p>
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function ChartCard({ title, description, action, className, children }: ChartCardProps) {
  return (
    <Card className={cn("gap-4 transition-shadow hover:shadow-md", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription className="mt-1 text-xs">{description}</CardDescription> : null}
          </div>
          {action ?? null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  valueLabel?: string;
}

/** Shared recharts tooltip, styled with tokens and formatted in Indonesian. */
function ChartTooltip({ active, payload, label, valueLabel }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[150px] rounded-lg border bg-card px-3 py-2 shadow-md">
      {label !== undefined && label !== "" ? (
        <p className="mb-1 max-w-[240px] truncate text-xs font-semibold">{label}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const pct =
            entry.payload && typeof entry.payload.pct === "number" ? entry.payload.pct : null;
          return (
            <div key={`${String(entry.name ?? "v")}-${idx}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color ?? COLORS.slate }}
              />
              <span className="text-muted-foreground">{entry.name ?? valueLabel ?? "Nilai"}</span>
              <span className="ml-auto font-semibold tabular-nums">
                {fmtNum(entry.value)}
                {pct !== null ? (
                  <span className="ml-1 font-normal text-muted-foreground">({pct}%)</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutLegend({ items }: { items: { name: string; value: number; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
          {it.name}
          <span className="font-semibold text-foreground">{fmtNum(it.value)}</span>
        </span>
      ))}
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground sm:h-72">
      {message}
    </div>
  );
}

type RecentSession = DashboardData["recentSessions"][number];

function RecentSessionRow({ session }: { session: RecentSession }) {
  const badge = SESSION_BADGE[session.status];
  const title = session.cycle || session.program || "Sesi PME";
  const sub =
    [session.cycle ? session.program : null, session.provider].filter(Boolean).join(" · ") ||
    "Detail tidak tersedia";
  return (
    <button
      type="button"
      onClick={() => useAppStore.getState().navigate("session-detail", session.id)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Buka detail sesi ${title}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block" title={fullTime(session.createdAt)}>
        {relativeTime(session.createdAt)}
      </span>
      <Badge variant="outline" className={cn(badge.className, badge.pulse && "animate-pulse")}>
        {badge.label}
      </Badge>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------ state screens ----------------------------- */

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-label="Memuat dashboard">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[350px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[350px] rounded-xl" />
      <Skeleton className="h-[520px] rounded-xl" />
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold">Gagal memuat dashboard</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button onClick={onRetry} className="mt-1 gap-2">
            <RefreshCw className="h-4 w-4" /> Coba Lagi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardEmpty({ onNavigateSessions }: { onNavigateSessions: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10">
            <Upload className="h-7 w-7 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">Belum ada data PME</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Unggah berkas hasil PME (PDF) untuk mulai mengevaluasi Z-score secara otomatis.
            Ringkasan kinerja laboratorium Anda akan tampil di sini.
          </p>
          <Button onClick={onNavigateSessions} className="mt-2 gap-2 bg-teal-700 text-white hover:bg-teal-800">
            <Upload className="h-4 w-4" /> Buka Sesi PME
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- main view -------------------------------- */

export function DashboardView() {
  const navigate = useAppStore((s) => s.navigate);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<DashboardData>("/api/dashboard");
      setData(result);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan tak terduga.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <DashboardSkeleton />;
  if (!data && error) return <DashboardError message={error} onRetry={() => void load()} />;
  if (data && data.counts.totalPme === 0) {
    return <DashboardEmpty onNavigateSessions={() => navigate("sessions")} />;
  }
  if (!data) return null;

  const counts = data.counts;

  // Chart sources, guarded with ?? [] so the view never crashes on empty data.
  const zDist = data.zDistribution ?? [];
  const paramStatus = data.parameterStatus ?? [];
  const trend = data.trend ?? [];
  const worst = data.worst ?? [];
  const aiBuckets = data.aiConfidence?.buckets ?? [];
  const aiAvg = data.aiConfidence?.average ?? 0;
  const recent = data.recentSessions ?? [];

  const statusTotal = paramStatus.reduce((acc, d) => acc + d.value, 0);
  const statusData = paramStatus.map((d) => ({
    ...d,
    color: STATUS_COLORS[d.key] ?? COLORS.slate,
    pct: statusTotal > 0 ? Math.round((d.value / statusTotal) * 100) : 0,
  }));

  const aiPct = Math.round(Math.min(1, Math.max(0, aiAvg)) * 100);
  const aiTotal = aiBuckets.reduce((acc, b) => acc + b.count, 0);
  const aiData = aiBuckets.map((b) => ({ ...b, color: confidenceColor(b.name) }));
  const aiMaxBucket = Math.max(1, ...aiBuckets.map((b) => b.count));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Ringkasan Kinerja PME</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau hasil uji profisiensi, distribusi Z-score, dan akurasi evaluasi secara menyeluruh.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt ? (
            <span className="hidden text-[11px] text-muted-foreground md:inline">
              Diperbarui {format(updatedAt, "HH.mm", { locale: localeId })}
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            Segarkan
          </Button>
        </div>
      </div>

      {/* Stale-data refresh warning */}
      {error && data ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Gagal memperbarui data: {error}. Menampilkan data terakhir yang tersedia.</span>
        </div>
      ) : null}

      {/* KPI row */}
      <section aria-label="Statistik utama">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Total PME" value={counts.totalPme} sub="sesi uji profisiensi" icon={FileText} tone="teal" />
          <KpiCard label="Total Parameter" value={counts.totalParameter} sub="parameter dianalisis" icon={ListChecks} tone="violet" />
          <KpiCard label="Memuaskan" value={counts.satisfactory} sub="|Z| ≤ 2,0" icon={CheckCircle2} tone="emerald" />
          <KpiCard label="Waspada" value={counts.warning} sub="2,0 < |Z| < 3,0" icon={AlertTriangle} tone="amber" />
          <KpiCard label="Tidak Memuaskan" value={counts.unsatisfactory} sub="|Z| ≥ 3,0" icon={XCircle} tone="red" />
          <KpiCard label="Perlu Review" value={counts.reviewRequired} sub="verifikasi manual diperlukan" icon={ClipboardCheck} tone="slate" />
        </div>
      </section>

      {/* Charts grid */}
      <section aria-label="Grafik analisis" className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Distribusi Z-Score */}
        <ChartCard title="Distribusi Z-Score" description="Sebaran nilai Z-score seluruh parameter">
          <div className="h-64 sm:h-72" role="img" aria-label="Grafik batang distribusi Z-score">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zDist} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} interval={0} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip cursor={CURSOR} content={<ChartTooltip valueLabel="Jumlah parameter" />} />
                <Bar dataKey="count" name="Jumlah parameter" maxBarSize={48} radius={[4, 4, 0, 0]}
                  label={{ position: "top", fontSize: 11, fill: COLORS.slate }}>
                  {zDist.map((b, i) => (
                    <Cell key={b.range} fill={Z_DIST_COLORS[i] ?? COLORS.emerald} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Status Parameter (donut) */}
        <ChartCard title="Status Parameter" description="Komposisi status akhir parameter">
          {statusData.length === 0 ? (
            <ChartEmpty message="Belum ada parameter untuk ditampilkan." />
          ) : (
            <>
              <div className="relative h-64 sm:h-72" role="img" aria-label="Grafik donat status parameter">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={2}
                      cornerRadius={4}
                      stroke="none"
                    >
                      {statusData.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueLabel="Parameter" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{fmtNum(statusTotal)}</p>
                  <p className="text-[11px] text-muted-foreground">parameter</p>
                </div>
              </div>
              <DonutLegend items={statusData.map((d) => ({ name: d.name, value: d.value, color: d.color }))} />
            </>
          )}
        </ChartCard>

        {/* Tren PME */}
        <ChartCard title="Tren PME" description="Rata-rata |Z| dan parameter bermasalah per sesi">
          {trend.length === 0 ? (
            <ChartEmpty message="Belum ada tren sesi yang selesai diproses." />
          ) : (
            <div className="h-64 sm:h-72" role="img" aria-label="Grafik tren PME per sesi">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="name"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                    tickFormatter={(v: string) => truncateText(v, 9)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} />
                  <Tooltip cursor={CURSOR} content={<ChartTooltip valueLabel="Nilai" />} />
                  <Bar dataKey="warning" name="Waspada" fill={COLORS.amber} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="unsatisfactory" name="Tidak Memuaskan" fill={COLORS.red} radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Line
                    dataKey="avgAbsZ"
                    name="Rata-rata |Z|"
                    stroke={COLORS.teal}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLORS.teal, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Z-Score Terburuk (horizontal) */}
        <ChartCard title="Z-Score Terburuk" description="Parameter dengan |Z| terbesar (maks. 8)">
          {worst.length === 0 ? (
            <ChartEmpty message="Belum ada data Z-score terburuk." />
          ) : (
            <div className="h-64 sm:h-72" role="img" aria-label="Grafik batang horizontal Z-score terburuk">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={worst} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
                  <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="parameter"
                    width={140}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={AXIS_LINE}
                    tickFormatter={(v: string) => truncateText(v, 18)}
                  />
                  <Tooltip cursor={CURSOR} content={<ChartTooltip valueLabel="Z-Score" />} />
                  <Bar dataKey="zScore" name="Z-Score" maxBarSize={18} radius={3}>
                    {worst.map((w) => (
                      <Cell key={w.id} fill={zStatusColor(w.zStatus)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Akurasi Ekstraksi (wide donut + bucket breakdown) */}
        <ChartCard
          title="Akurasi Ekstraksi Data"
          description="Tingkat keyakinan validasi data per parameter"
          className="lg:col-span-2"
          action={
            <Badge variant="secondary" className="gap-1 bg-teal-500/10 text-teal-700 dark:text-teal-300">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Rata-rata {aiPct}%
            </Badge>
          }
        >
          {aiData.length === 0 || counts.totalParameter === 0 ? (
            <ChartEmpty message="Belum ada data akurasi." />
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
              <div className="relative h-64 w-64 shrink-0" role="img" aria-label="Grafik donat akurasi ekstraksi">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={aiData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius="64%"
                      outerRadius="90%"
                      paddingAngle={2}
                      cornerRadius={4}
                      stroke="none"
                    >
                      {aiData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueLabel="Parameter" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{aiPct}%</p>
                  <p className="text-[11px] text-muted-foreground">rata-rata</p>
                </div>
              </div>
              <div className="w-full flex-1 space-y-3">
                <p className="text-xs text-muted-foreground">
                  {fmtNum(aiTotal)} parameter dinilai — keyakinan minimum dari hasil ekstraksi PDF.
                </p>
                {aiData.map((b) => (
                  <div key={b.name} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">{b.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((b.count / aiMaxBucket) * 100)}%`, backgroundColor: b.color }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </section>

      {/* Sesi Terbaru */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Sesi Terbaru</CardTitle>
              <CardDescription className="mt-1 text-xs">
                Delapan sesi PME terakhir — klik baris untuk membuka detail.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("sessions")}>
              Lihat Semua
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 px-3 pb-4 sm:px-4">
          {recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada sesi tercatat.</p>
          ) : (
            recent.map((s) => <RecentSessionRow key={s.id} session={s} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
