"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Eye,
  FileDown,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  FlaskConical,
  GraduationCap,
  Layers,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { ApiError, apiDownload, apiGet, apiSend } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { AiAnalysisData, IssueCode, PmeResultData, PmeSessionDetail, SessionStatus, ZStatus } from "@/types/pme";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/* ---------------------------------- constants --------------------------------- */

const PROCESSING_STATUSES: SessionStatus[] = ["UPLOADED", "EXTRACTING", "VALIDATING", "ANALYZING"];

const STEPS: { key: SessionStatus; label: string }[] = [
  { key: "UPLOADED", label: "Unggah" },
  { key: "EXTRACTING", label: "Ekstraksi Data" },
  { key: "VALIDATING", label: "Validasi" },
  { key: "ANALYZING", label: "Analisis Evaluasi" },
  { key: "COMPLETED", label: "Selesai" },
];

const STATUS_LABEL: Record<SessionStatus, string> = {
  UPLOADED: "Diunggah",
  EXTRACTING: "Ekstraksi Data",
  VALIDATING: "Validasi",
  REVIEW_REQUIRED: "Perlu Review",
  ANALYZING: "Analisis Evaluasi",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

const ISSUE_LABEL: Record<IssueCode, string> = {
  LOW_CONFIDENCE: "Confidence rendah",
  MISSING_Z_SCORE: "Z-score hilang",
  MISSING_VALUE: "Nilai kosong",
  INVALID_NUMBER: "Angka tidak valid",
  SIGN_CONFLICT: "Konflik tanda",
  OCR_CONFLICT: "Konflik OCR",
  MISSING_SOURCE: "Tanpa sumber",
  UNVERIFIED_SOURCE: "Sumber tak terlacak",
  DUPLICATE_PARAMETER: "Parameter duplikat",
};

const Z_BADGE_CLASS: Record<ZStatus, string> = {
  SATISFACTORY:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  WARNING:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  UNSATISFACTORY:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

const Z_TEXT_CLASS: Record<ZStatus, string> = {
  SATISFACTORY: "text-emerald-700 dark:text-emerald-400",
  WARNING: "text-amber-700 dark:text-amber-400",
  UNSATISFACTORY: "text-red-700 dark:text-red-400",
};

/* ----------------------------------- helpers ---------------------------------- */

function currentStepIndex(status: SessionStatus, errorCode: string | null): number {
  switch (status) {
    case "UPLOADED":
      return 0;
    case "EXTRACTING":
      return 1;
    case "VALIDATING":
      return 2;
    case "REVIEW_REQUIRED":
      return 2;
    case "ANALYZING":
      return 3;
    case "COMPLETED":
      return 4;
    case "FAILED":
      return errorCode === "GEMINI_API_ERROR" || errorCode === "AI_USAGE_LIMIT_REACHED" ? 3 : 2;
  }
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(v);
}

function fmtZ(z: number | null | undefined): string {
  if (z === null || z === undefined || !Number.isFinite(z)) return "—";
  return `${z > 0 ? "+" : ""}${z.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Confidence is stored on a 0..1 scale; defensively handle 0..100 too. */
function confPct(v: number): number {
  const norm = v > 1 ? v / 100 : v;
  return Math.round(Math.min(Math.max(norm, 0), 1) * 100);
}

function resultConfidence(r: PmeResultData): number {
  const min = Math.min(r.parameterConfidence, r.participantConfidence, r.targetConfidence, r.zScoreConfidence);
  return confPct(min);
}

function confDotClass(pct: number): string {
  if (pct >= 95) return "bg-emerald-500";
  if (pct >= 85) return "bg-amber-500";
  return "bg-red-500";
}

function issueBadgeClass(code: IssueCode): string {
  return code.startsWith("MISSING")
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
}

function causeBadgeClass(category: string): string {
  switch (category) {
    case "PRE_ANALYTICAL":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
    case "ANALYTICAL":
      return "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300";
    case "POST_ANALYTICAL":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  }
}

function causeLabel(category: string): string {
  switch (category) {
    case "PRE_ANALYTICAL":
      return "Pra-Analitik";
    case "ANALYTICAL":
      return "Analitik";
    case "POST_ANALYTICAL":
      return "Pasca-Analitik";
    default:
      return category || "Lainnya";
  }
}

/* --------------------------------- subcomponents ------------------------------ */

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const processing = PROCESSING_STATUSES.includes(status);
  const cls =
    status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "REVIEW_REQUIRED"
        ? "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
        : status === "FAILED"
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          : "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300";
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-semibold", cls)}>
      {processing && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function PipelineStepper({ status, errorCode }: { status: SessionStatus; errorCode: string | null }) {
  const failed = status === "FAILED";
  const completedAll = status === "COMPLETED";
  const cur = currentStepIndex(status, errorCode);
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-[520px] items-start" aria-label="Progres pemrosesan PME">
        {STEPS.map((step, i) => {
          const isDone = !failed && i < cur;
          const isCurrent = !failed && i === cur && !completedAll;
          const isFailedStep = failed && i === cur;
          const circleCls = isFailedStep
            ? "border-red-400 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
            : isDone || completedAll
              ? "border-teal-600 bg-teal-600 text-white"
              : isCurrent
                ? "border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                : "border-border bg-muted text-muted-foreground";
          const labelCls = isFailedStep
            ? "text-red-700 dark:text-red-400"
            : isDone || isCurrent || completedAll
              ? "text-foreground"
              : "text-muted-foreground";
          return (
            <li key={step.key} className={cn("flex items-start", i < STEPS.length - 1 && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                    circleCls
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isFailedStep ? (
                    <X className="h-3.5 w-3.5" aria-hidden />
                  ) : isDone || completedAll ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : isCurrent ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-teal-500 opacity-60" />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-teal-600" />
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn("whitespace-nowrap text-[11px] font-medium", labelCls)}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn("mt-3.5 h-0.5 flex-1", isDone || completedAll ? "bg-teal-600" : "bg-border")}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function IdentityItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-700/10 text-teal-800 dark:text-teal-300">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-medium" title={typeof value === "string" ? value : undefined}>
          {value ?? "—"}
        </div>
      </div>
    </div>
  );
}

function AiListCard({
  title,
  icon: Icon,
  iconClass,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} aria-hidden />
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function MultiGroupCompare({ r }: { r: PmeResultData }) {
  const hasGroups =
    r.instrumentTarget !== null ||
    r.instrumentZScore !== null ||
    r.methodTarget !== null ||
    r.methodZScore !== null ||
    r.allParticipantsTarget !== null ||
    r.allParticipantsZScore !== null;

  if (!hasGroups) return null;

  return (
    <div className="mt-3 rounded-lg border border-border/80 bg-background/50 p-3">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-teal-600" />
          Komparasi Z-Score Berdasarkan Kelompok Evaluasi
        </p>
        <span className="text-[10px] text-muted-foreground">
          ISO 15189 / Evaluasi Peer Group
        </span>
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
        {/* Kelompok Alat */}
        <div className="rounded-md border border-teal-200/90 bg-teal-50/50 p-2.5 dark:border-teal-900/60 dark:bg-teal-950/20">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
              Kelompok Alat
            </span>
            {r.instrument ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-teal-300 bg-white dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 font-mono">
                {r.instrument}
              </Badge>
            ) : (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Alat Sejenis</Badge>
            )}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Peserta (N):</span>
              <span className="font-medium text-foreground">{r.instrumentCount ?? "—"}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Target:</span>
              <span className="font-medium text-foreground">{fmtNum(r.instrumentTarget)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SDPA:</span>
              <span className="font-medium text-foreground">{fmtNum(r.instrumentSdpa)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground pt-0.5 border-t border-teal-200/60 dark:border-teal-900/40">
              <span className="font-semibold text-teal-950 dark:text-teal-100">Nilai Z:</span>
              <span className="font-mono font-bold text-sm text-teal-900 dark:text-teal-200">{fmtZ(r.instrumentZScore)}</span>
            </div>
            {r.instrumentStatus && (
              <div className="pt-1">
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-teal-300 bg-teal-100/80 text-teal-900 dark:border-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                  {r.instrumentStatus}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Kelompok Metode */}
        <div className="rounded-md border border-blue-200/90 bg-blue-50/50 p-2.5 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
              Kelompok Metode
            </span>
            {r.method ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-blue-300 bg-white dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-mono">
                {r.method}
              </Badge>
            ) : (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Metode Sejenis</Badge>
            )}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Peserta (N):</span>
              <span className="font-medium text-foreground">{r.methodCount ?? "—"}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Target:</span>
              <span className="font-medium text-foreground">{fmtNum(r.methodTarget)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SDPA:</span>
              <span className="font-medium text-foreground">{fmtNum(r.methodSdpa)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground pt-0.5 border-t border-blue-200/60 dark:border-blue-900/40">
              <span className="font-semibold text-blue-950 dark:text-blue-100">Nilai Z:</span>
              <span className="font-mono font-bold text-sm text-blue-900 dark:text-blue-200">{fmtZ(r.methodZScore)}</span>
            </div>
            {r.methodStatus && (
              <div className="pt-1">
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-blue-300 bg-blue-100/80 text-blue-900 dark:border-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                  {r.methodStatus}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Seluruh Peserta */}
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Seluruh Peserta
            </span>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              Konsensus Global
            </Badge>
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Peserta (N):</span>
              <span className="font-medium text-foreground">{r.allParticipantsCount ?? "—"}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Target:</span>
              <span className="font-medium text-foreground">{fmtNum(r.allParticipantsTarget)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SDPA:</span>
              <span className="font-medium text-foreground">{fmtNum(r.allParticipantsSdpa)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground pt-0.5 border-t border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-foreground">Nilai Z:</span>
              <span className="font-mono font-bold text-sm text-foreground">{fmtZ(r.allParticipantsZScore)}</span>
            </div>
            {r.allParticipantsStatus && (
              <div className="pt-1">
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] border-slate-300 bg-slate-200/70 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {r.allParticipantsStatus}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- types ------------------------------------ */

interface DetailResponse {
  session: PmeSessionDetail;
  results: PmeResultData[];
}

interface EditFormState {
  parameterName: string;
  participantValue: string;
  targetValue: string;
  sdpa: string;
  zScore: string;
  unit: string;
  method: string;
  instrument: string;
}

interface CapaFormState {
  problem: string;
  finding: string;
  rootCause: string;
  immediateCorrection: string;
  correctiveAction: string;
  preventiveAction: string;
  pic: string;
  dueDate: string;
}

const EMPTY_EDIT: EditFormState = {
  parameterName: "",
  participantValue: "",
  targetValue: "",
  sdpa: "",
  zScore: "",
  unit: "",
  method: "",
  instrument: "",
};

const EMPTY_CAPA: CapaFormState = {
  problem: "",
  finding: "",
  rootCause: "",
  immediateCorrection: "",
  correctiveAction: "",
  preventiveAction: "",
  pic: "",
  dueDate: "",
};

/* ---------------------------------- component --------------------------------- */

export function SessionDetailView() {
  const { toast } = useToast();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const navigate = useAppStore((s) => s.navigate);

  const [session, setSession] = useState<PmeSessionDetail | null>(null);
  const [results, setResults] = useState<PmeResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sourceResult, setSourceResult] = useState<PmeResultData | null>(null);
  const [editResult, setEditResult] = useState<PmeResultData | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [findingResult, setFindingResult] = useState<PmeResultData | null>(null);
  const [capaResult, setCapaResult] = useState<PmeResultData | null>(null);
  const [capaForm, setCapaForm] = useState<CapaFormState>(EMPTY_CAPA);
  const [capaError, setCapaError] = useState<string | null>(null);
  const [capaSaving, setCapaSaving] = useState(false);

  const [analyzingIds, setAnalyzingIds] = useState<string[]>([]);
  const [sessionAnalyzing, setSessionAnalyzing] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | "pdf2" | "excel2" | null>(null);

  /* ----------------------------------- load ----------------------------------- */

  const handleAuthLoss = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      useAppStore.getState().setUser(null);
      return true;
    }
    return false;
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!activeSessionId) {
        setSession(null);
        setResults([]);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await apiGet<DetailResponse>(`/api/pme/${activeSessionId}`);
        setSession(data.session);
        setResults(data.results ?? []);
        setLoadError(null);
      } catch (err) {
        if (handleAuthLoss(err)) return;
        if (!silent) setLoadError(err instanceof Error ? err.message : "Gagal memuat detail sesi.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeSessionId, handleAuthLoss]
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------- polling: pipeline + per-result AI analysis ------------------ */

  const processing = !!session && PROCESSING_STATUSES.includes(session.status);
  const needsPolling = processing || analyzingIds.length > 0;

  useEffect(() => {
    if (!needsPolling) return;
    const t = setInterval(() => {
      void load(true);
    }, 2500);
    return () => clearInterval(t);
  }, [needsPolling, load]);

  /* prune finished per-result analyses */
  useEffect(() => {
    if (analyzingIds.length === 0) return;
    const next = analyzingIds.filter((id) => {
      const r = results.find((x) => x.id === id);
      return !!r && r.analysisStatus === "PENDING";
    });
    if (next.length !== analyzingIds.length) setAnalyzingIds(next);
  }, [results, analyzingIds]);

  /* -------------------------------- derived data -------------------------------- */

  const resultStats = useMemo(
    () => ({
      total: results.length,
      satisfactory: results.filter((r) => r.zStatus === "SATISFACTORY").length,
      warning: results.filter((r) => r.zStatus === "WARNING").length,
      unsatisfactory: results.filter((r) => r.zStatus === "UNSATISFACTORY").length,
      review: results.filter((r) => r.validationStatus === "REVIEW_REQUIRED").length,
    }),
    [results]
  );

  const cycleLabel = session?.cycle || session?.id || "pme";

  /* ---------------------------------- handlers ---------------------------------- */

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async (format: "pdf" | "excel" | "pdf2" | "excel2") => {
    if (!session || exporting) return;
    setExporting(format);
    try {
      if (format === "pdf") {
        await apiDownload(`/api/pme/${session.id}/export/pdf`, `laporan-pme-model1-${cycleLabel}.pdf`);
      } else if (format === "pdf2") {
        await apiDownload(`/api/pme/${session.id}/export/pdf2`, `laporan-pme-model2-${cycleLabel}.pdf`);
      } else if (format === "excel2") {
        await apiDownload(`/api/pme/${session.id}/export/excel2`, `evaluasi-pme-model2-${cycleLabel}.xlsx`);
      } else {
        await apiDownload(`/api/pme/${session.id}/export/excel`, `laporan-pme-model1-${cycleLabel}.xlsx`);
      }
      toast({
        title: "Unduhan dimulai",
        description: format.startsWith("pdf") ? "Laporan PDF sedang diunduh." : "Laporan Excel sedang diunduh.",
      });
    } catch (err) {
      if (handleAuthLoss(err)) return;
      toast({
        title: "Unduhan gagal",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat mengunduh laporan.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const handleAnalyzeSession = async () => {
    if (!session || sessionAnalyzing) return;
    setSessionAnalyzing(true);
    try {
      await apiSend<{ ok: boolean; status: string }>(`/api/pme/${session.id}/analyze`, "POST");
      toast({
        title: "Analisis evaluasi sesi dimulai",
        description: "Parameter terpilih sedang dianalisis — hasil akan muncul otomatis.",
      });
      void load(true);
    } catch (err) {
      if (handleAuthLoss(err)) return;
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      toast({
        title: err instanceof ApiError && err.code === "AI_USAGE_LIMIT_REACHED" ? "Kapasitas evaluasi habis" : "Analisis evaluasi gagal",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSessionAnalyzing(false);
    }
  };

  const handleAnalyzeResult = async (r: PmeResultData) => {
    if (analyzingIds.includes(r.id)) return;
    setAnalyzingIds((prev) => [...prev, r.id]);
    try {
      await apiSend(`/api/pme/results/${r.id}/analyze`, "POST");
      toast({
        title: "Analisis evaluasi dimulai",
        description: `Menganalisis parameter "${r.parameterName}" — temuan akan muncul otomatis.`,
      });
      void load(true);
    } catch (err) {
      if (handleAuthLoss(err)) return;
      setAnalyzingIds((prev) => prev.filter((id) => id !== r.id));
      toast({
        title: "Analisis evaluasi gagal",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    }
  };

  const handleReprocess = async () => {
    if (!session || reprocessing) return;
    setReprocessing(true);
    try {
      await apiSend(`/api/pme/${session.id}/process`, "POST");
      toast({
        title: "Reproses dimulai",
        description: "PME dikembalikan ke awal pipeline pemrosesan.",
      });
      setAnalyzingIds([]);
      await load(true);
    } catch (err) {
      if (handleAuthLoss(err)) return;
      toast({
        title: "Gagal memproses ulang",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setReprocessing(false);
    }
  };

  const openEdit = (r: PmeResultData) => {
    setEditResult(r);
    setEditError(null);
    setEditForm({
      parameterName: r.parameterName ?? "",
      participantValue: r.participantValue === null || r.participantValue === undefined ? "" : String(r.participantValue),
      targetValue: r.targetValue === null || r.targetValue === undefined ? "" : String(r.targetValue),
      sdpa: r.sdpa === null || r.sdpa === undefined ? "" : String(r.sdpa),
      zScore: r.zScore === null || r.zScore === undefined ? "" : String(r.zScore),
      unit: r.unit ?? "",
      method: r.method ?? "",
      instrument: r.instrument ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editResult || editSaving) return;
    if (!editForm.parameterName.trim()) {
      setEditError("Nama parameter wajib diisi.");
      return;
    }
    const numbers: Record<"participantValue" | "targetValue" | "sdpa" | "zScore", number | null> = {
      participantValue: null,
      targetValue: null,
      sdpa: null,
      zScore: null,
    };
    for (const key of ["participantValue", "targetValue", "sdpa", "zScore"] as const) {
      const raw = editForm[key].trim();
      if (raw === "") {
        numbers[key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setEditError("Nilai angka (peserta, target, SDPA, Z-score) harus berupa angka yang valid, mis. 12.345 atau -0.87.");
        return;
      }
      numbers[key] = n;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await apiSend(`/api/pme/results/${editResult.id}`, "PATCH", {
        parameterName: editForm.parameterName.trim(),
        participantValue: numbers.participantValue,
        targetValue: numbers.targetValue,
        sdpa: numbers.sdpa,
        zScore: numbers.zScore,
        unit: editForm.unit.trim() || null,
        method: editForm.method.trim() || null,
        instrument: editForm.instrument.trim() || null,
      });
      toast({
        title: "Data diperbarui",
        description: `Parameter "${editForm.parameterName.trim()}" disimpan dan status Z-score dihitung ulang.`,
      });
      setEditResult(null);
      void load(true);
    } catch (err) {
      if (handleAuthLoss(err)) return;
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setEditSaving(false);
    }
  };

  const openCapa = (r: PmeResultData) => {
    setCapaResult(r);
    setCapaError(null);
    const ai: AiAnalysisData | null = r.aiAnalysis;
    setCapaForm({
      problem: `Z-score ${fmtZ(r.zScore)} pada parameter ${r.parameterName}${r.zStatus ? ` (status: ${r.zStatus})` : ""}`,
      finding: ai?.interpretation ?? "",
      rootCause: ai ? ai.possibleCauses.map((c) => c.text).join("; ") : "",
      immediateCorrection: "",
      correctiveAction: ai ? ai.correctiveActions.join("\n") : "",
      preventiveAction: ai ? ai.preventiveActions.join("\n") : "",
      pic: "",
      dueDate: "",
    });
  };

  const saveCapa = async () => {
    if (!capaResult || capaSaving) return;
    if (!capaForm.problem.trim()) {
      setCapaError("Uraian masalah wajib diisi.");
      return;
    }
    setCapaSaving(true);
    setCapaError(null);
    try {
      await apiSend<{ capa: { id: string } }>("/api/capa", "POST", {
        problem: capaForm.problem.trim(),
        finding: capaForm.finding.trim() || null,
        rootCause: capaForm.rootCause.trim() || null,
        immediateCorrection: capaForm.immediateCorrection.trim() || null,
        correctiveAction: capaForm.correctiveAction.trim() || null,
        preventiveAction: capaForm.preventiveAction.trim() || null,
        pic: capaForm.pic.trim() || null,
        dueDate: capaForm.dueDate || null,
        resultId: capaResult.id,
      });
      toast({
        title: "CAPA dibuat",
        description: `Tindakan korektif & preventif untuk "${capaResult.parameterName}" berhasil dicatat.`,
      });
      setCapaResult(null);
      void load(true);
    } catch (err) {
      if (handleAuthLoss(err)) return;
      setCapaError(err instanceof Error ? err.message : "Gagal menyimpan CAPA.");
    } finally {
      setCapaSaving(false);
    }
  };

  /* ----------------------------------- render ----------------------------------- */

  if (!activeSessionId) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("sessions")}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Daftar Sesi
        </Button>
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700/10 text-teal-800">
            <FileQuestion className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">Tidak ada sesi dipilih</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Pilih salah satu sesi PME dari daftar untuk melihat detail, hasil Z-score, dan tindak lanjutnya.
            </p>
          </div>
          <Button className="bg-teal-700 text-white hover:bg-teal-800" onClick={() => navigate("sessions")}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Buka Daftar Sesi
          </Button>
        </Card>
      </div>
    );
  }

  if (loading && !session) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (loadError && !session) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("sessions")}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Daftar Sesi
        </Button>
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <div
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              role="alert"
            >
              {loadError}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Coba Lagi
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("sessions")}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Daftar Sesi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) return null;

  const file = session.file;
  const isFailed = session.status === "FAILED";
  const isReviewRequired = session.status === "REVIEW_REQUIRED";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      {/* Back */}
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("sessions")}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Daftar Sesi
      </Button>

      {/* Pipeline stepper */}
      <Card>
        <CardContent className="p-4">
          <PipelineStepper status={session.status} errorCode={session.errorCode} />
          {(processing || isFailed) && (
            <p
              className={cn(
                "mt-2 text-xs",
                isFailed ? "text-red-700 dark:text-red-400" : "text-teal-700 dark:text-teal-400"
              )}
              role="status"
            >
              {isFailed
                ? (session.errorMessage ?? session.statusDetail ?? "Pemrosesan berhenti karena kesalahan.")
                : (session.statusDetail ?? "Sedang diproses… data diperbarui otomatis setiap 2,5 detik.")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* FAILED error card */}
      {isFailed && (
        <div
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start dark:border-red-900 dark:bg-red-950/50"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-900 dark:text-red-300">Pemrosesan gagal</p>
            <p className="mt-0.5 break-words text-xs text-red-800 dark:text-red-300/90">
              {session.errorMessage ?? session.statusDetail ?? "Terjadi kesalahan saat memproses PME."}
            </p>
            {session.errorCode && (
              <Badge variant="outline" className="mt-2 border-red-300 text-red-800 dark:border-red-800 dark:text-red-300">
                {session.errorCode}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            disabled={reprocessing}
            onClick={() => void handleReprocess()}
            className="shrink-0 bg-red-700 text-white hover:bg-red-800"
          >
            {reprocessing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Coba Reproses
          </Button>
        </div>
      )}

      {/* REVIEW_REQUIRED banner */}
      {isReviewRequired && (
        <div
          className="flex flex-col gap-2.5 rounded-lg border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center dark:border-violet-900 dark:bg-violet-950/50"
          role="alert"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-400" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-bold text-violet-900 dark:text-violet-300">Sebagian data perlu review</p>
              <p className="mt-0.5 text-xs text-violet-800 dark:text-violet-300/90">
                {session.statusDetail ??
                  "Beberapa parameter memerlukan verifikasi manual sebelum evaluasi dapat dilanjutkan."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("review")}
            className="shrink-0 bg-violet-700 text-white hover:bg-violet-800"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden /> Buka Review Center
          </Button>
        </div>
      )}

      {/* Identity card */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b py-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              Identitas PME
              <SessionStatusBadge status={session.status} />
            </CardTitle>
            <CardDescription className="mt-1 truncate">
              {file?.fileName ?? "Berkas tidak tersedia"}
              {session.statusDetail && !isFailed ? ` · ${session.statusDetail}` : ""}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="secondary" className="whitespace-nowrap">
              {resultStats.total} parameter
            </Badge>
            {session.capaCount > 0 && (
              <Badge variant="outline" className="whitespace-nowrap">
                {session.capaCount} CAPA
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <IdentityItem icon={Building2} label="Provider" value={session.provider ?? "—"} />
          <IdentityItem icon={GraduationCap} label="Program" value={session.program ?? "—"} />
          <IdentityItem icon={Repeat} label="Cycle" value={session.cycle ?? "—"} />
          <IdentityItem icon={CalendarRange} label="Period" value={session.period ?? "—"} />
          <IdentityItem icon={Fingerprint} label="Participant ID" value={session.participantId ?? "—"} />
          <IdentityItem icon={FlaskConical} label="Laboratorium" value={session.laboratoryName ?? "—"} />
          <IdentityItem icon={CalendarDays} label="Tanggal Upload" value={fmtDate(session.createdAt)} />
          <IdentityItem
            icon={FileText}
            label="Berkas"
            value={
              file ? (
                <span className="block truncate" title={file.fileName}>
                  {file.fileName}
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{fmtBytes(file.sizeBytes)}</span>
                </span>
              ) : (
                "—"
              )
            }
          />
          <IdentityItem icon={Layers} label="Halaman PDF" value={file?.pageCount ? `${file.pageCount} halaman` : "—"} />
          <IdentityItem
            icon={ScanSearch}
            label="Klasifikasi PDF"
            value={
              file?.pdfClass ? (
                <Badge variant="secondary" className="bg-teal-700/10 text-teal-800 dark:text-teal-300">
                  {file.pdfClass}
                </Badge>
              ) : (
                "—"
              )
            }
          />
          <IdentityItem icon={Scale} label="Versi Rule" value={session.ruleVersion ?? "—"} />
          <IdentityItem icon={Sparkles} label="Engine Evaluasi" value="Standard ISO/Permenkes" />
        </CardContent>
      </Card>

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void handleExport("pdf")} disabled={exporting !== null} className="border-teal-600/30 text-teal-800 dark:text-teal-300 hover:bg-teal-50">
          {exporting === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-4 w-4 text-teal-600" aria-hidden />
          )}
          PDF Model 1 (Laporan Evaluasi)
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleExport("excel")} disabled={exporting !== null} className="border-teal-600/30 text-teal-800 dark:text-teal-300 hover:bg-teal-50">
          {exporting === "excel" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-teal-600" aria-hidden />
          )}
          Excel Model 1
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleExport("pdf2")} disabled={exporting !== null} className="border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50">
          {exporting === "pdf2" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileDown className="h-4 w-4 text-emerald-600" aria-hidden />
          )}
          PDF Model 2 (Sasaran Mutu)
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleExport("excel2")} disabled={exporting !== null} className="border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50">
          {exporting === "excel2" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden />
          )}
          Excel Model 2 (EVALUASI PME)
        </Button>
        <Button
          size="sm"
          className="bg-teal-700 text-white hover:bg-teal-800"
          onClick={() => void handleAnalyzeSession()}
          disabled={processing || sessionAnalyzing}
          title={processing ? "Tunggu proses selesai" : "Analisis evaluasi untuk seluruh parameter yang memenuhi syarat"}
        >
          {sessionAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          Analisis Evaluasi
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleReprocess()}
          disabled={processing || reprocessing}
          title="Jalankan ulang seluruh pipeline pemrosesan"
        >
          {reprocessing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          Reproses
        </Button>
      </div>

      {/* Results table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Hasil Parameter</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{resultStats.total} parameter terekstrak</span>
            <span className="text-emerald-700 dark:text-emerald-400">· {resultStats.satisfactory} memuaskan</span>
            <span className="text-amber-700 dark:text-amber-400">· {resultStats.warning} perhatian</span>
            <span className="text-red-700 dark:text-red-400">· {resultStats.unsatisfactory} tidak memuaskan</span>
            <span className="text-violet-700 dark:text-violet-400">· {resultStats.review} perlu review</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium">Belum ada hasil parameter</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {processing
                  ? "Ekstraksi data sedang berlangsung — hasil akan muncul di sini secara otomatis."
                  : "Hasil ekstraksi tidak tersedia. Coba jalankan ulang pipeline melalui tombol Reproses."}
              </p>
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Parameter</TableHead>
                    <TableHead className="hidden sm:table-cell">Peserta</TableHead>
                    <TableHead className="hidden md:table-cell">Target</TableHead>
                    <TableHead className="hidden md:table-cell">SDPA</TableHead>
                    <TableHead>Z-Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Confidence</TableHead>
                    <TableHead className="hidden xl:table-cell">Isu</TableHead>
                    <TableHead className="pr-4 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => {
                    const expanded = expandedIds.has(r.id);
                    const conf = resultConfidence(r);
                    const isAnalyzing = analyzingIds.includes(r.id);
                    const confTitle = `Parameter ${confPct(r.parameterConfidence)}% · Partisipan ${confPct(
                      r.participantConfidence
                    )}% · Target ${confPct(r.targetConfidence)}% · Z-Score ${confPct(r.zScoreConfidence)}%`;
                    return (
                      <Fragment key={r.id}>
                      <TableRow className={cn(expanded && "bg-muted/40")}>
                        {/* Parameter (+ expand) */}
                        <TableCell className="pl-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.id)}
                            aria-expanded={expanded}
                            className="flex items-start gap-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                          >
                            <ChevronRight
                              className={cn(
                                "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                                expanded && "rotate-90"
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0">
                              <span
                                className="block max-w-[240px] truncate font-medium"
                                title={r.parameterName}
                              >
                                {r.parameterName}
                              </span>
                              {(r.method || r.instrument) && (
                                <span className="block max-w-[240px] truncate text-[11px] text-muted-foreground">
                                  {[r.method, r.instrument].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </span>
                          </button>
                        </TableCell>

                        {/* Participant */}
                        <TableCell className="hidden sm:table-cell tabular-nums">
                          {fmtNum(r.participantValue)}
                          {r.unit && <span className="ml-1 text-[11px] text-muted-foreground">{r.unit}</span>}
                        </TableCell>

                        {/* Target */}
                        <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                          {fmtNum(r.targetValue)}
                          {r.unit && <span className="ml-1 text-[11px]">{r.unit}</span>}
                        </TableCell>

                        {/* SDPA */}
                        <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                          {fmtNum(r.sdpa ?? null)}
                        </TableCell>

                        {/* Z-Score */}
                        <TableCell>
                          <span
                            className={cn(
                              "font-mono text-sm font-bold tabular-nums",
                              r.zStatus ? Z_TEXT_CLASS[r.zStatus] : "text-muted-foreground"
                            )}
                          >
                            {fmtZ(r.zScore)}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {r.zStatus ? (
                              <Badge variant="outline" className={cn("font-semibold", Z_BADGE_CLASS[r.zStatus])}>
                                {r.zStatus}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                              >
                                Belum dinilai
                              </Badge>
                            )}
                            {r.validationStatus === "REVIEW_REQUIRED" && (
                              <Badge
                                variant="outline"
                                className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                              >
                                Perlu Review
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Confidence */}
                        <TableCell className="hidden lg:table-cell">
                          <span
                            className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums"
                            title={confTitle}
                          >
                            <span className={cn("h-2 w-2 rounded-full", confDotClass(conf))} aria-hidden />
                            {conf}%
                          </span>
                        </TableCell>

                        {/* Issues */}
                        <TableCell className="hidden xl:table-cell">
                          {r.issues.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex max-w-[170px] flex-wrap gap-1">
                              {r.issues.map((code) => (
                                <Badge
                                  key={code}
                                  variant="outline"
                                  className={cn("px-1.5 py-0 text-[10px]", issueBadgeClass(code))}
                                  title={ISSUE_LABEL[code]}
                                >
                                  {ISSUE_LABEL[code]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-teal-700"
                              title="Lihat sumber di PDF"
                              aria-label={`Lihat sumber PDF untuk ${r.parameterName}`}
                              onClick={() => setSourceResult(r)}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </Button>
                            {!r.aiAnalysis && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-teal-700"
                                title={isAnalyzing ? "Analisis evaluasi sedang berjalan…" : "Analisis evaluasi parameter ini"}
                                aria-label={`Analisis evaluasi untuk ${r.parameterName}`}
                                disabled={processing || isAnalyzing}
                                onClick={() => void handleAnalyzeResult(r)}
                              >
                                {isAnalyzing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <Sparkles className="h-4 w-4" aria-hidden />
                                )}
                              </Button>
                            )}
                            {r.aiAnalysis && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-teal-700"
                                title="Lihat temuan evaluasi"
                                aria-label={`Temuan evaluasi untuk ${r.parameterName}`}
                                onClick={() => setFindingResult(r)}
                              >
                                <BrainCircuit className="h-4 w-4" aria-hidden />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-teal-700"
                              title="Edit data hasil"
                              aria-label={`Edit data ${r.parameterName}`}
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Button>
                            {r.aiAnalysis && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-teal-700"
                                title="Buat CAPA dari temuan evaluasi"
                                aria-label={`Buat CAPA untuk ${r.parameterName}`}
                                onClick={() => openCapa(r)}
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="border-t-0 bg-muted/30 px-4 py-3">
                            <div className="ml-1 border-l-2 border-teal-600 pl-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Teks Sumber PDF (Hal. {r.sourcePage ?? "—"})
                                  </p>
                                  <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-card p-2 text-xs leading-relaxed text-muted-foreground">
                                    {r.sourceText?.trim() || "Tidak ada teks sumber terekam."}
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                    {r.method && <span>Metode: {r.method}</span>}
                                    {r.instrument && <span>Instrumen: {r.instrument}</span>}
                                    {r.peerGroup && <span>Kelompok: {r.peerGroup}</span>}
                                    {r.providerRemark && <span>Keterangan Penyedia: {r.providerRemark}</span>}
                                    {r.sourceBbox && r.sourceBbox.length > 0 && (
                                      <span className="font-mono">
                                        bbox [{r.sourceBbox.map((n) => Math.round(n)).join(", ")}]
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Rincian Tingkat Akurasi Data
                                  </p>
                                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                    {(
                                      [
                                        ["Parameter", r.parameterConfidence],
                                        ["Partisipan", r.participantConfidence],
                                        ["Target", r.targetConfidence],
                                        ["Z-Score", r.zScoreConfidence],
                                      ] as const
                                    ).map(([lbl, v]) => {
                                      const p = confPct(v);
                                      return (
                                        <span key={lbl} className="flex items-center gap-1.5">
                                          <span className={cn("h-1.5 w-1.5 rounded-full", confDotClass(p))} aria-hidden />
                                          <span className="text-muted-foreground">{lbl}</span>
                                          <span className="font-medium tabular-nums">{p}%</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                                    Status review: {r.reviewStatus === "NONE" ? "belum direview" : r.reviewStatus.toLowerCase()} ·
                                    evaluasi klinis: {r.analysisStatus === "PENDING" ? "berjalan" : r.analysisStatus === "DONE" ? "selesai" : "dilewati"}
                                  </p>
                                </div>
                              </div>
                              <MultiGroupCompare r={r} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --------------------------- View Source dialog --------------------------- */}
      <Dialog open={!!sourceResult} onOpenChange={(open) => !open && setSourceResult(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-teal-700" aria-hidden /> Sumber Ekstraksi PDF
            </DialogTitle>
            <DialogDescription className="truncate">
              {sourceResult?.parameterName ?? "—"}
            </DialogDescription>
          </DialogHeader>
          {file ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <iframe
                src={`/api/files/${file.id}#page=${sourceResult?.sourcePage || 1}`}
                title={`Pratinjau PDF — ${sourceResult?.parameterName ?? "sumber"}`}
                className="h-[70vh] w-full rounded-md border bg-white"
              />
              <aside className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Parameter</p>
                  <p className="mt-0.5 break-words text-sm font-medium">{sourceResult?.parameterName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Halaman</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums">
                    {sourceResult?.sourcePage ? `Halaman ${sourceResult.sourcePage}` : "Tidak tercatat"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Teks Sumber</p>
                  <p className="mt-0.5 max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground">
                    {sourceResult?.sourceText?.trim() || "Tidak ada teks sumber terekam untuk parameter ini."}
                  </p>
                </div>
                {sourceResult?.sourceBbox && sourceResult.sourceBbox.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Bounding Box
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      [{sourceResult.sourceBbox.map((n) => Math.round(n)).join(", ")}]
                    </p>
                  </div>
                )}
                {file?.driveFileId && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Penyimpanan</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                      Google Drive
                    </p>
                  </div>
                )}
                <div className="pt-2 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(`/api/files/${file.id}#page=${sourceResult?.sourcePage || 1}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden /> Buka di Tab Baru
                  </Button>
                  {file?.driveViewUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                      onClick={() => window.open(file.driveViewUrl!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden /> Buka di Google Drive
                    </Button>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Berkas PDF tidak tersedia untuk sesi ini.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Edit dialog ------------------------------ */}
      <Dialog open={!!editResult} onOpenChange={(open) => !open && setEditResult(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-teal-700" aria-hidden /> Edit Hasil Parameter
            </DialogTitle>
            <DialogDescription>
              Perubahan akan divalidasi ulang dan status Z-score dihitung ulang oleh rule engine.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-parameter">Nama Parameter</Label>
              <Input
                id="edit-parameter"
                value={editForm.parameterName}
                onChange={(e) => setEditForm((f) => ({ ...f, parameterName: e.target.value }))}
                placeholder="mis. Kreatinin"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-participant">Nilai Peserta</Label>
                <Input
                  id="edit-participant"
                  type="number"
                  step="0.001"
                  value={editForm.participantValue}
                  onChange={(e) => setEditForm((f) => ({ ...f, participantValue: e.target.value }))}
                  placeholder="mis. 0.85"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-target">Nilai Target</Label>
                <Input
                  id="edit-target"
                  type="number"
                  step="0.001"
                  value={editForm.targetValue}
                  onChange={(e) => setEditForm((f) => ({ ...f, targetValue: e.target.value }))}
                  placeholder="mis. 0.80"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-sdpa">SDPA</Label>
                <Input
                  id="edit-sdpa"
                  type="number"
                  step="0.001"
                  value={editForm.sdpa}
                  onChange={(e) => setEditForm((f) => ({ ...f, sdpa: e.target.value }))}
                  placeholder="mis. 0.16"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-zscore">Z-Score</Label>
                <Input
                  id="edit-zscore"
                  type="number"
                  step="0.001"
                  value={editForm.zScore}
                  onChange={(e) => setEditForm((f) => ({ ...f, zScore: e.target.value }))}
                  placeholder="mis. 0.50"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-unit">Satuan</Label>
                <Input
                  id="edit-unit"
                  value={editForm.unit}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="mis. mg/dL"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-method">Metode</Label>
                <Input
                  id="edit-method"
                  value={editForm.method}
                  onChange={(e) => setEditForm((f) => ({ ...f, method: e.target.value }))}
                  placeholder="mis. JAFFE"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-instrument">Instrumen</Label>
                <Input
                  id="edit-instrument"
                  value={editForm.instrument}
                  onChange={(e) => setEditForm((f) => ({ ...f, instrument: e.target.value }))}
                  placeholder="mis. Cobas c311"
                />
              </div>
            </div>

            {editError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                role="alert"
              >
                {editError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditResult(null)} disabled={editSaving}>
              Batal
            </Button>
            <Button
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={() => void saveEdit()}
              disabled={editSaving}
            >
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {editSaving ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- Finding dialog --------------------------- */}
      <Dialog open={!!findingResult} onOpenChange={(open) => !open && setFindingResult(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {findingResult?.aiAnalysis && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-teal-700" aria-hidden /> Temuan Evaluasi —{" "}
                  <span className="truncate">{findingResult.parameterName}</span>
                </DialogTitle>
                <DialogDescription>Interpretasi klinis dan evaluasi atas hasil Z-score parameter ini.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <MultiGroupCompare r={findingResult} />

                {findingResult.aiAnalysis.biasAnalysis && (
                  <div className="rounded-lg border border-amber-300/80 bg-amber-50/70 p-3 dark:border-amber-800/70 dark:bg-amber-950/30">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-amber-600" />
                      Analisis Bias Analitik (Alat vs Metode vs Lab)
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                      {findingResult.aiAnalysis.biasAnalysis}
                    </p>
                  </div>
                )}

                {(findingResult.aiAnalysis.instrumentEvaluation || findingResult.aiAnalysis.methodEvaluation) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {findingResult.aiAnalysis.instrumentEvaluation && (
                      <div className="rounded-lg border border-teal-200/90 bg-teal-50/50 p-3 dark:border-teal-900/60 dark:bg-teal-950/20">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-teal-600" />
                          Evaluasi Kelompok Alat
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                          {findingResult.aiAnalysis.instrumentEvaluation}
                        </p>
                      </div>
                    )}
                    {findingResult.aiAnalysis.methodEvaluation && (
                      <div className="rounded-lg border border-blue-200/90 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          <FlaskConical className="h-3.5 w-3.5 text-blue-600" />
                          Evaluasi Kelompok Metode
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                          {findingResult.aiAnalysis.methodEvaluation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 dark:border-teal-900 dark:bg-teal-950/40">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                    Interpretasi Klinis Mutu
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {findingResult.aiAnalysis.interpretation}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {findingResult.aiAnalysis.possibleCauses.length > 0 && (
                    <AiListCard title="Kemungkinan Penyebab" icon={AlertTriangle} iconClass="text-amber-600">
                      <ul className="space-y-2">
                        {findingResult.aiAnalysis.possibleCauses.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                            <Badge variant="outline" className={cn("mt-0.5 shrink-0 px-1.5 py-0 text-[10px]", causeBadgeClass(c.category))}>
                              {causeLabel(c.category)}
                            </Badge>
                            <span className="min-w-0">{c.text}</span>
                          </li>
                        ))}
                      </ul>
                    </AiListCard>
                  )}

                  {findingResult.aiAnalysis.investigationSteps.length > 0 && (
                    <AiListCard title="Langkah Investigasi" icon={ScanSearch} iconClass="text-teal-600">
                      <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-snug">
                        {findingResult.aiAnalysis.investigationSteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </AiListCard>
                  )}

                  {findingResult.aiAnalysis.correctiveActions.length > 0 && (
                    <AiListCard title="Tindakan Korektif" icon={Wrench} iconClass="text-red-600">
                      <ul className="space-y-1.5">
                        {findingResult.aiAnalysis.correctiveActions.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[13px] leading-snug">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </AiListCard>
                  )}

                  {findingResult.aiAnalysis.preventiveActions.length > 0 && (
                    <AiListCard title="Tindakan Preventif" icon={ShieldCheck} iconClass="text-violet-600">
                      <ul className="space-y-1.5">
                        {findingResult.aiAnalysis.preventiveActions.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[13px] leading-snug">
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </AiListCard>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
                  <span className="font-semibold">Meta:</span>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {findingResult.aiAnalysis.provider}
                  </Badge>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {findingResult.aiAnalysis.model}
                  </Badge>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    prompt v{findingResult.aiAnalysis.promptVersion}
                  </Badge>
                  <span>{fmtDate(findingResult.aiAnalysis.createdAt)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setFindingResult(null)}>
                  Tutup
                </Button>
                <Button
                  className="bg-teal-700 text-white hover:bg-teal-800"
                  onClick={() => {
                    const r = findingResult;
                    setFindingResult(null);
                    if (r) openCapa(r);
                  }}
                >
                  <ListPlus className="h-4 w-4" aria-hidden /> Buat CAPA dari Analisis
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------ CAPA dialog ------------------------------ */}
      <Dialog open={!!capaResult} onOpenChange={(open) => !open && setCapaResult(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-teal-700" aria-hidden /> Buat Tindakan CAPA
            </DialogTitle>
            <DialogDescription>
              {capaResult
                ? `Dokumen CAPA untuk parameter "${capaResult.parameterName}" akan tertaut ke hasil PME ini.`
                : "Dokumen CAPA akan tertaut ke hasil PME ini."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="capa-problem">Uraian Masalah *</Label>
              <Textarea
                id="capa-problem"
                rows={2}
                value={capaForm.problem}
                onChange={(e) => setCapaForm((f) => ({ ...f, problem: e.target.value }))}
                placeholder="Jelaskan masalah / penyimpangan yang ditemukan"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capa-finding">Temuan</Label>
              <Textarea
                id="capa-finding"
                rows={3}
                value={capaForm.finding}
                onChange={(e) => setCapaForm((f) => ({ ...f, finding: e.target.value }))}
                placeholder="Temuan dari evaluasi sistem atau investigasi manual"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capa-rootcause">Akar Masalah</Label>
              <Textarea
                id="capa-rootcause"
                rows={2}
                value={capaForm.rootCause}
                onChange={(e) => setCapaForm((f) => ({ ...f, rootCause: e.target.value }))}
                placeholder="Akar masalah yang teridentifikasi"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capa-immediate">Koreksi Segera</Label>
              <Textarea
                id="capa-immediate"
                rows={2}
                value={capaForm.immediateCorrection}
                onChange={(e) => setCapaForm((f) => ({ ...f, immediateCorrection: e.target.value }))}
                placeholder="Tindakan segera untuk mengatasi dampak"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capa-corrective">Tindakan Korektif</Label>
              <Textarea
                id="capa-corrective"
                rows={2}
                value={capaForm.correctiveAction}
                onChange={(e) => setCapaForm((f) => ({ ...f, correctiveAction: e.target.value }))}
                placeholder="Tindakan untuk menghilangkan akar masalah"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="capa-preventive">Tindakan Preventif</Label>
              <Textarea
                id="capa-preventive"
                rows={2}
                value={capaForm.preventiveAction}
                onChange={(e) => setCapaForm((f) => ({ ...f, preventiveAction: e.target.value }))}
                placeholder="Tindakan untuk mencegah keberulangan"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="capa-pic">PIC</Label>
                <Input
                  id="capa-pic"
                  value={capaForm.pic}
                  onChange={(e) => setCapaForm((f) => ({ ...f, pic: e.target.value }))}
                  placeholder="Nama penanggung jawab"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="capa-due">Tenggat Waktu</Label>
                <Input
                  id="capa-due"
                  type="date"
                  value={capaForm.dueDate}
                  onChange={(e) => setCapaForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>

            {capaError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                role="alert"
              >
                {capaError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCapaResult(null)} disabled={capaSaving}>
              Batal
            </Button>
            <Button
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={() => void saveCapa()}
              disabled={capaSaving}
            >
              {capaSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ListPlus className="h-4 w-4" aria-hidden />}
              {capaSaving ? "Menyimpan…" : "Simpan CAPA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


