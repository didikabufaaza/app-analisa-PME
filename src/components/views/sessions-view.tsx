"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileText,
  FileUp,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { ApiError, apiGet, apiSend, apiUpload } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { PmeSessionListItem, SessionStatus } from "@/types/pme";
import { cn } from "@/lib/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/* ---------------------------------- constants --------------------------------- */

const STATUSES: SessionStatus[] = [
  "UPLOADED",
  "EXTRACTING",
  "VALIDATING",
  "REVIEW_REQUIRED",
  "ANALYZING",
  "COMPLETED",
  "FAILED",
];

const PROCESSING_STATUSES: SessionStatus[] = ["UPLOADED", "EXTRACTING", "VALIDATING", "ANALYZING"];

const STATUS_LABEL: Record<SessionStatus, string> = {
  UPLOADED: "Diunggah",
  EXTRACTING: "Ekstraksi AI",
  VALIDATING: "Validasi",
  REVIEW_REQUIRED: "Perlu Review",
  ANALYZING: "Analisis AI",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;

/* ----------------------------------- helpers ---------------------------------- */

function statusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "REVIEW_REQUIRED":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
    default:
      return "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300";
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string | null | undefined): string {
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

function StatusBadge({ status }: { status: SessionStatus }) {
  const processing = PROCESSING_STATUSES.includes(status);
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap font-semibold", statusBadgeClass(status))}>
      {processing ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      ) : status === "COMPLETED" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : status === "FAILED" ? (
        <CircleAlert className="h-3 w-3" />
      ) : status === "REVIEW_REQUIRED" ? (
        <ClipboardCheck className="h-3 w-3" />
      ) : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/* ---------------------------------- component --------------------------------- */

export function SessionsView() {
  const { toast } = useToast();
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const isAdmin = canDelete;

  /* list state */
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sessions, setSessions] = useState<PmeSessionListItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* upload dialog state */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* row action & selection state */
  const [deleteTarget, setDeleteTarget] = useState<PmeSessionListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  /* debounced search: input value -> applied query (400 ms) */
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleAuthLoss = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      useAppStore.getState().setUser(null);
      return true;
    }
    return false;
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        params.set("limit", "50");
        const data = await apiGet<{ sessions: PmeSessionListItem[]; statusCounts: Record<string, number> }>(
          `/api/pme?${params.toString()}`
        );
        setSessions(data.sessions ?? []);
        setStatusCounts(data.statusCounts ?? {});
        setLoadError(null);
        if (!silent) setSelectedIds(new Set());
      } catch (err) {
        if (handleAuthLoss(err)) return;
        if (!silent) setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar sesi PME.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [query, statusFilter, handleAuthLoss]
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* poll every 2.5 s while any listed session is still processing */
  const anyProcessing = useMemo(
    () => sessions.some((s) => PROCESSING_STATUSES.includes(s.status)),
    [sessions]
  );

  useEffect(() => {
    if (!anyProcessing) return;
    const t = setInterval(() => {
      void load(true);
    }, 2500);
    return () => clearInterval(t);
  }, [anyProcessing, load]);

  const counts = useMemo(() => {
    const get = (k: string) => statusCounts[k] ?? 0;
    return {
      total: Object.values(statusCounts).reduce((a, b) => a + (b || 0), 0),
      processing: PROCESSING_STATUSES.reduce((a, k) => a + get(k), 0),
      completed: get("COMPLETED"),
      review: get("REVIEW_REQUIRED"),
      failed: get("FAILED"),
    };
  }, [statusCounts]);

  /* ---------------------------------- upload ---------------------------------- */

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    const hasPdfExt = f.name.toLowerCase().endsWith(".pdf");
    const isPdfMime = !f.type || f.type === "application/pdf" || f.type === "application/x-pdf";
    if (!hasPdfExt || !isPdfMime) {
      toast({
        title: "Format Berkas Ditolak",
        description: "Hanya berkas dokumen PDF (.pdf) yang diperbolehkan untuk diunggah.",
        variant: "destructive",
      });
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast({
        title: "Ukuran berkas terlalu besar",
        description: `Maksimum 15 MB — berkas Anda ${formatBytes(f.size)}.`,
        variant: "destructive",
      });
      return;
    }
    setFile(f);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiUpload<{ session: { id: string; status: string } }>("/api/pme/upload", fd);
      toast({
        title: "Unggahan berhasil",
        description: "PME masuk antrean — ekstraksi AI dimulai otomatis.",
      });
      setFile(null);
      setUploadOpen(false);
      void load();
    } catch (err) {
      if (handleAuthLoss(err)) return;
      setUploadError(err instanceof Error ? err.message : "Unggahan gagal. Coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  /* -------------------------------- row actions -------------------------------- */

  const handleReprocess = async (s: PmeSessionListItem) => {
    setReprocessingId(s.id);
    try {
      await apiSend(`/api/pme/${s.id}/process`, "POST");
      toast({
        title: "Reproses dimulai",
        description: `${s.file?.fileName ?? "Sesi PME"} dikembalikan ke antrean pemrosesan.`,
      });
      void load();
    } catch (err) {
      if (handleAuthLoss(err)) return;
      toast({
        title: "Gagal memproses ulang",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setReprocessingId(null);
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sessions.map((s) => s.id)));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend(`/api/pme/${deleteTarget.id}`, "DELETE");
      toast({
        title: "Sesi dihapus",
        description: `${deleteTarget.file?.fileName ?? "Sesi PME"} beserta berkas di Google Drive telah dihapus permanen.`,
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      void load();
    } catch (err) {
      if (handleAuthLoss(err)) return;
      toast({
        title: "Gagal menghapus sesi",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      let successCount = 0;
      for (const id of ids) {
        try {
          await apiSend(`/api/pme/${id}`, "DELETE");
          successCount++;
        } catch (err) {
          console.error(`Failed to delete session ${id}:`, err);
        }
      }
      toast({
        title: "Selesai Menghapus",
        description: `${successCount} dari ${ids.length} berkas PME terpilih berhasil dihapus beserta berkas di Google Drive.`,
      });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      void load();
    } catch (err) {
      if (handleAuthLoss(err)) return;
      toast({
        title: "Gagal menghapus berkas terpilih",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(search);
  };

  const onDropKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const hasActiveFilter = query.trim() !== "" || statusFilter !== "ALL";

  /* ----------------------------------- render ---------------------------------- */

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Page intro */}
      <div>
        <h2 className="text-lg font-bold tracking-tight">Sesi Analisis PME</h2>
        <p className="text-sm text-muted-foreground">
          Unggah laporan Proficiency Testing, pantau pipeline AI, dan telusuri hasil Z-score per parameter.
        </p>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total Sesi", value: counts.total, dot: "bg-slate-400" },
          { label: "Diproses", value: counts.processing, dot: "bg-teal-500" },
          { label: "Selesai", value: counts.completed, dot: "bg-emerald-500" },
          { label: "Perlu Review", value: counts.review, dot: "bg-violet-500" },
          { label: "Gagal", value: counts.failed, dot: "bg-red-500" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", c.dot)} aria-hidden />
              {c.label}
            </div>
            <p className="mt-0.5 text-xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative w-full lg:max-w-xs" onSubmit={onSearchSubmit} role="search">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari provider, program, siklus, lab…"
            className="pl-9"
            aria-label="Cari sesi PME"
          />
        </form>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[210px]" aria-label="Filter status sesi">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            {STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                {STATUS_LABEL[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="lg:ml-auto">
          <Button
            onClick={() => setUploadOpen(true)}
            className="w-full bg-teal-700 text-white hover:bg-teal-800 sm:w-auto"
          >
            <UploadCloud className="h-4 w-4" aria-hidden />
            Unggah PDF PME
          </Button>
        </div>
      </div>

      {/* Table card */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b py-4">
          <div>
            <CardTitle className="text-base">Daftar Sesi PME</CardTitle>
            <CardDescription>
              {loading && sessions.length === 0
                ? "Memuat daftar sesi…"
                : `${sessions.length} sesi ditampilkan${hasActiveFilter ? " (terfilter)" : ""}`}
            </CardDescription>
          </div>
          {anyProcessing && (
            <span
              className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800"
              role="status"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              sedang diproses…
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadError && !loading ? (
            <div className="flex flex-col items-start gap-3 p-6">
              <div
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                role="alert"
              >
                {loadError}
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Coba Lagi
              </Button>
            </div>
          ) : loading && sessions.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700/10 text-teal-800">
                <FileText className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">
                  {hasActiveFilter ? "Tidak ada sesi yang cocok" : "Belum ada sesi PME"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  {hasActiveFilter
                    ? "Coba ubah kata kunci pencarian atau filter status."
                    : "Unggah laporan hasil PME pertama Anda — AI akan mengekstrak parameter dan menghitung Z-score secara otomatis."}
                </p>
              </div>
              {hasActiveFilter ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setQuery("");
                    setStatusFilter("ALL");
                  }}
                >
                  <X className="h-4 w-4" aria-hidden /> Reset Filter
                </Button>
              ) : (
                <Button size="sm" className="bg-teal-700 text-white hover:bg-teal-800" onClick={() => setUploadOpen(true)}>
                  <UploadCloud className="h-4 w-4" aria-hidden /> Unggah PDF PME
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[36rem] overflow-y-auto">
              {selectedIds.size > 0 && canDelete && (
                <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-teal-50 px-4 py-2 text-sm text-teal-950 dark:bg-teal-950/60 dark:text-teal-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                      {selectedIds.size}
                    </span>
                    <span className="font-medium">berkas PME dipilih</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Batal Pilihan
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium"
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Hapus {selectedIds.size} Berkas Terpilih
                    </Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    {canDelete && (
                      <TableHead className="w-10 pl-4">
                        <input
                          type="checkbox"
                          checked={sessions.length > 0 && selectedIds.size === sessions.length}
                          onChange={toggleSelectAll}
                          aria-label="Pilih semua berkas"
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </TableHead>
                    )}
                    <TableHead className={canDelete ? "pl-2" : "pl-4"}>Berkas</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="hidden xl:table-cell">Program</TableHead>
                    <TableHead className="hidden lg:table-cell">Siklus / Periode</TableHead>
                    <TableHead className="hidden md:table-cell">Laboratorium</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Tanggal</TableHead>
                    <TableHead className="pr-4 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => {
                    const canReprocess = s.status === "FAILED" || s.status === "COMPLETED";
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <TableRow
                        key={s.id}
                        tabIndex={0}
                        aria-label={`Buka detail sesi ${s.file?.fileName ?? s.id}`}
                        onClick={() => navigate("session-detail", s.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") navigate("session-detail", s.id);
                        }}
                        className={cn("cursor-pointer", isSelected && "bg-teal-500/5")}
                      >
                        {/* Checkbox */}
                        {canDelete && (
                          <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelect(s.id, e as unknown as React.MouseEvent)}
                              aria-label={`Pilih berkas ${s.file?.fileName ?? s.id}`}
                              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                          </TableCell>
                        )}

                        {/* File */}
                        <TableCell className={canDelete ? "pl-2" : "pl-4"}>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-700/10 text-teal-800">
                              <FileText className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-medium" title={s.file?.fileName ?? undefined}>
                                {s.file?.fileName ?? "—"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {s.file
                                  ? `${formatBytes(s.file.sizeBytes)}${s.file.pageCount ? ` · ${s.file.pageCount} hal.` : ""}`
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Provider */}
                        <TableCell>
                          <span className="block max-w-[140px] truncate" title={s.provider ?? undefined}>
                            {s.provider ?? "—"}
                          </span>
                        </TableCell>

                        {/* Program */}
                        <TableCell className="hidden xl:table-cell">
                          <span className="block max-w-[150px] truncate" title={s.program ?? undefined}>
                            {s.program ?? "—"}
                          </span>
                        </TableCell>

                        {/* Cycle / Period */}
                        <TableCell className="hidden lg:table-cell">
                          <div className="leading-tight">
                            <span className="block max-w-[140px] truncate text-[13px]" title={s.cycle ?? undefined}>
                              {s.cycle ?? "—"}
                            </span>
                            {s.period && (
                              <span className="block max-w-[140px] truncate text-[11px] text-muted-foreground" title={s.period}>
                                {s.period}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Laboratory */}
                        <TableCell className="hidden md:table-cell">
                          <span className="block max-w-[150px] truncate" title={s.laboratoryName ?? undefined}>
                            {s.laboratoryName ?? "—"}
                          </span>
                        </TableCell>

                        {/* Parameter count */}
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold tabular-nums">{s.resultCount}</span>
                            <span className="text-[11px] text-muted-foreground">param</span>
                            {s.capaCount > 0 && (
                              <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                                {s.capaCount} CAPA
                              </Badge>
                            )}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-0.5">
                            <StatusBadge status={s.status} />
                            {(s.statusDetail || s.errorMessage) && (
                              <span
                                className={cn(
                                  "max-w-[220px] truncate text-[11px]",
                                  s.status === "FAILED" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                                )}
                                title={(s.statusDetail ?? s.errorMessage) ?? undefined}
                              >
                                {s.statusDetail ?? s.errorMessage}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Date */}
                        <TableCell className="hidden md:table-cell text-[13px] text-muted-foreground">
                          {formatDate(s.createdAt)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => navigate("session-detail", s.id)}
                            >
                              Detail
                            </Button>
                            {canDelete && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                                onClick={() => setDeleteTarget(s)}
                                title="Hapus sesi PME dan berkas di Google Drive"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:mr-1" aria-hidden />
                                <span className="hidden sm:inline">Hapus</span>
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Menu aksi untuk ${s.file?.fileName ?? "sesi"}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {canReprocess && (
                                  <DropdownMenuItem onClick={() => void handleReprocess(s)} disabled={reprocessingId === s.id}>
                                    {reprocessingId === s.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" aria-hidden />
                                    )}
                                    Reproses
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <>
                                    {canReprocess && <DropdownMenuSeparator />}
                                    <DropdownMenuItem
                                      className="text-red-700 focus:text-red-700 dark:text-red-400 dark:focus:text-red-400"
                                      onClick={() => setDeleteTarget(s)}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden /> Hapus Berkas &amp; Sesi
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {!canReprocess && !canDelete && (
                                  <DropdownMenuItem disabled>Tidak ada aksi lain</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) {
            setFile(null);
            setUploadError(null);
            setDragging(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Unggah PDF PME</DialogTitle>
            <DialogDescription>
              Unggah laporan hasil Proficiency Testing (PDF). AI akan mengekstrak parameter, memvalidasi data, dan
              menghitung Z-score secara otomatis.
            </DialogDescription>
          </DialogHeader>

          <div
            role="button"
            tabIndex={0}
            aria-label="Zona unggah: klik atau tarik-lepas berkas PDF"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={onDropKeyDown}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
              dragging
                ? "border-teal-600 bg-teal-50 dark:bg-teal-950/40"
                : "border-muted-foreground/25 hover:border-teal-500/60 hover:bg-muted/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                acceptFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-700/10 text-teal-800">
              <UploadCloud className="h-5 w-5" aria-hidden />
            </span>
            {file ? (
              <div className="flex items-center gap-2.5 rounded-md border bg-card px-3 py-2 text-left shadow-xs">
                <FileText className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />
                <div className="min-w-0">
                  <p className="max-w-[240px] truncate text-sm font-medium">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Batalkan pilihan berkas"
                  className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">Tarik &amp; lepas berkas PDF di sini</p>
                <p className="text-xs text-muted-foreground">atau klik untuk memilih berkas · maks. 15 MB</p>
              </>
            )}
          </div>

          {uploadError && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              role="alert"
            >
              {uploadError}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Batal
            </Button>
            <Button
              onClick={() => void handleUpload()}
              disabled={!file || uploading}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
              {uploading ? "Mengunggah…" : "Unggah & Proses"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (Single) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus sesi PME ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Sesi <span className="font-semibold">{deleteTarget?.file?.fileName ?? deleteTarget?.id}</span> beserta
              seluruh hasil ekstraksi, analisis AI, riwayat CAPA, dan berkas terkait di Google Drive akan dihapus secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {deleting ? "Menghapus…" : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} berkas PME terpilih?</AlertDialogTitle>
            <AlertDialogDescription>
              Sebanyak <span className="font-semibold">{selectedIds.size} berkas dan sesi PME</span> yang dipilih beserta
              seluruh hasil ekstraksi, analisis AI, riwayat CAPA, dan berkas terkait di Google Drive akan dihapus secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={(e) => {
                e.preventDefault();
                void handleBulkDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {deleting ? "Menghapus…" : "Ya, Hapus Semua Terpilih"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
