"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";

import { ApiError, apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { IssueCode, ReviewItem, ZStatus } from "@/types/pme";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const CATEGORY_FILTERS: { key: string; label: string }[] = [
  { key: "Low Confidence", label: "Low Confidence" },
  { key: "Missing Data", label: "Missing Data" },
  { key: "OCR Conflict", label: "OCR Conflict" },
  { key: "Extraction Conflict", label: "Extraction Conflict" },
  { key: "Possible Numeric Error", label: "Possible Numeric Error" },
];

const ISSUE_LABELS: Record<IssueCode, string> = {
  LOW_CONFIDENCE: "Confidence rendah",
  MISSING_Z_SCORE: "Z-score hilang",
  MISSING_VALUE: "Nilai tidak lengkap",
  INVALID_NUMBER: "Angka tidak valid",
  SIGN_CONFLICT: "Konflik tanda (kemungkinan salah baca)",
  OCR_CONFLICT: "Ambiguitas OCR",
  MISSING_SOURCE: "Sumber halaman hilang",
  UNVERIFIED_SOURCE: "Sumber tak terlacak (potensi halusinasi)",
  DUPLICATE_PARAMETER: "Parameter duplikat",
};

const Z_STATUS_BADGE: Record<Exclude<ZStatus, null>, string> = {
  SATISFACTORY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  UNSATISFACTORY: "bg-red-100 text-red-800 border-red-200",
};

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(v);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Confidence is stored on a 0..1 scale; defensively handle 0..100 too. */
function confPct(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const norm = v > 1 ? v / 100 : v;
  return Math.round(Math.min(Math.max(norm, 0), 1) * 100);
}

function confDotClass(pct: number | null): string {
  if (pct === null) return "bg-slate-300";
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-red-500";
}

interface ReviewResponse {
  items: ReviewItem[];
  categoryCounts: Record<string, number>;
  total: number;
}

interface EditFormState {
  parameterName: string;
  participantValue: string;
  targetValue: string;
  zScore: string;
}

export function ReviewView() {
  const { toast } = useToast();

  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<ReviewItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [rejectItem, setRejectItem] = useState<ReviewItem | null>(null);
  const [reprocessItem, setReprocessItem] = useState<ReviewItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ReviewResponse>("/api/review");
      setItems(data.items ?? []);
      setCategoryCounts(data.categoryCounts ?? {});
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat data review.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const removeItem = useCallback((item: ReviewItem) => {
    setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    setTotal((t) => Math.max(0, t - 1));
    const cat = item.categories;
    setCategoryCounts((prev) => {
      if (!cat || !(cat in prev)) return prev;
      const next = { ...prev };
      next[cat] = Math.max(0, next[cat] - 1);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!activeCategory) return items;
    return items.filter((i) => i.categories === activeCategory);
  }, [items, activeCategory]);

  async function handleAccept(item: ReviewItem) {
    setBusyId(item.id);
    try {
      await apiSend(`/api/pme/results/${item.id}/review`, "POST", { action: "ACCEPT" });
      toast({ title: "Parameter diterima", description: `${item.parameterName} ditandai sudah sesuai.` });
      removeItem(item);
    } catch (err) {
      toast({ title: "Gagal", description: err instanceof ApiError ? err.message : "Tindakan gagal.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(item: ReviewItem) {
    setBusyId(item.id);
    try {
      await apiSend(`/api/pme/results/${item.id}/review`, "POST", { action: "REJECT" });
      toast({ title: "Parameter ditolak", description: `${item.parameterName} ditandai ditolak.` });
      removeItem(item);
    } catch (err) {
      toast({ title: "Gagal", description: err instanceof ApiError ? err.message : "Tindakan gagal.", variant: "destructive" });
    } finally {
      setBusyId(null);
      setRejectItem(null);
    }
  }

  async function handleReprocess(item: ReviewItem) {
    setBusyId(item.id);
    try {
      await apiSend(`/api/pme/results/${item.id}/review`, "POST", { action: "REPROCESS" });
      toast({ title: "Sesi sedang direproses", description: "Hasil ekstraksi akan diperbarui secara otomatis." });
      removeItem(item);
    } catch (err) {
      toast({ title: "Gagal", description: err instanceof ApiError ? err.message : "Tindakan gagal.", variant: "destructive" });
    } finally {
      setBusyId(null);
      setReprocessItem(null);
    }
  }

  function openEdit(item: ReviewItem) {
    setEditItem(item);
    setEditForm({
      parameterName: item.parameterName ?? "",
      participantValue: item.participantValue === null || item.participantValue === undefined ? "" : String(item.participantValue),
      targetValue: item.targetValue === null || item.targetValue === undefined ? "" : String(item.targetValue),
      zScore: item.zScore === null || item.zScore === undefined ? "" : String(item.zScore),
    });
  }

  async function handleSaveEdit() {
    if (!editItem || !editForm) return;
    const payload: Record<string, string | number> = {};
    const name = editForm.parameterName.trim();
    if (name && name !== editItem.parameterName) payload.parameterName = name;
    const pNum = editForm.participantValue.trim() === "" ? NaN : Number(editForm.participantValue);
    if (Number.isFinite(pNum)) payload.participantValue = pNum;
    const tNum = editForm.targetValue.trim() === "" ? NaN : Number(editForm.targetValue);
    if (Number.isFinite(tNum)) payload.targetValue = tNum;
    const zNum = editForm.zScore.trim() === "" ? NaN : Number(editForm.zScore);
    if (Number.isFinite(zNum)) payload.zScore = zNum;

    if (Object.keys(payload).length === 0) {
      toast({ title: "Tidak ada perubahan", description: "Isi minimal satu kolom untuk diperbarui." });
      return;
    }

    setSavingEdit(true);
    try {
      await apiSend(`/api/pme/results/${editItem.id}`, "PATCH", payload);
      toast({ title: "Parameter diperbarui", description: "Nilai disimpan dan divalidasi ulang." });
      setEditItem(null);
      setEditForm(null);
      await fetchItems();
    } catch (err) {
      toast({ title: "Gagal menyimpan", description: err instanceof ApiError ? err.message : "Perubahan gagal.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  }

  const activeCount = activeCategory ? (categoryCounts[activeCategory] ?? 0) : total;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Pusat Review & Verifikasi</h2>
          <p className="text-sm text-muted-foreground">
            Periksa hasil ekstraksi yang memerlukan verifikasi manual sebelum evaluasi dilanjutkan.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? "Memuat…" : `${activeCount} dari ${total} parameter perlu review`}
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            activeCategory === null
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-border bg-background text-foreground hover:bg-accent"
          }`}
        >
          Semua
          <span className={`rounded-full px-1.5 text-[10px] ${activeCategory === null ? "bg-white/20" : "bg-muted"}`}>{total}</span>
        </button>
        {CATEGORY_FILTERS.map((c) => {
          const count = categoryCounts[c.key] ?? 0;
          const isActive = activeCategory === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-border bg-background text-foreground hover:bg-accent"
              }`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-[10px] ${isActive ? "bg-white/20" : "bg-muted"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void fetchItems()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-base font-medium">Tidak ada item yang memerlukan review</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Semua hasil ekstraksi telah diproses. Item baru akan muncul di sini jika sistem mendeteksi ketidaksesuaian atau keraguan data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((item) => {
            const busy = busyId === item.id;
            const confidences: { key: string; label: string; value: number }[] = [
              { key: "parameter", label: "Parameter", value: item.confidences?.parameter ?? 0 },
              { key: "participant", label: "Nilai peserta", value: item.confidences?.participant ?? 0 },
              { key: "target", label: "Nilai target", value: item.confidences?.target ?? 0 },
              { key: "zScore", label: "Z-score", value: item.confidences?.zScore ?? 0 },
            ];
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 p-4 md:p-5">
                  {/* Top row: name + session */}
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{item.parameterName || "(Tanpa nama)"}</h3>
                        {item.zStatus ? (
                          <Badge className={`border ${Z_STATUS_BADGE[item.zStatus]}`} variant="outline">
                            {item.zStatus === "SATISFACTORY" ? "Memuaskan" : item.zStatus === "WARNING" ? "Perhatian" : "Tidak Memuaskan"}
                          </Badge>
                        ) : null}
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {item.categories || "Lainnya"}
                        </Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{item.session?.cycle || "Siklus —"}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.session?.program || "Program —"}</span>
                        <span aria-hidden="true">·</span>
                        <span>{fmtDate(item.session?.createdAt)}</span>
                        {item.sourcePage ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Hal. {item.sourcePage}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => void handleAccept(item)}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Terima
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                        Ubah
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => setRejectItem(item)}>
                        <X className="h-4 w-4" />
                        Tolak
                      </Button>
                      <Button size="sm" variant="outline" className="text-teal-700 hover:bg-teal-50 hover:text-teal-800" disabled={busy} onClick={() => setReprocessItem(item)}>
                        <RefreshCw className="h-4 w-4" />
                        Proses Ulang
                      </Button>
                    </div>
                  </div>

                  {/* Values */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nilai Peserta</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtNum(item.participantValue)}{item.unit ? ` ${item.unit}` : ""}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nilai Target</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtNum(item.targetValue)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Z-Score</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtNum(item.zScore)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Halaman Sumber</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{item.sourcePage ?? "—"}</p>
                    </div>
                  </div>

                  {/* Issues */}
                  {item.issues && item.issues.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.issues.map((code) => (
                        <Badge key={code} variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          <AlertTriangle className="h-3 w-3" />
                          {ISSUE_LABELS[code] ?? code}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {/* Confidences */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3">
                    {confidences.map((c) => {
                      const pct = confPct(c.value);
                      return (
                        <span key={c.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={`inline-block h-2 w-2 rounded-full ${confDotClass(pct)}`} aria-hidden="true" />
                          {c.label}: <span className="font-medium text-foreground">{pct !== null ? `${pct}%` : "—"}</span>
                        </span>
                      );
                    })}
                    {item.sourceText ? (
                      <span className="ml-auto max-w-full truncate text-xs italic text-muted-foreground" title={item.sourceText}>
                        “{item.sourceText.slice(0, 120)}{item.sourceText.length > 120 ? "…" : ""}”
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editItem !== null} onOpenChange={(open) => { if (!open) { setEditItem(null); setEditForm(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ubah Hasil Ekstraksi</DialogTitle>
            <DialogDescription>
              Perbaiki nilai hasil ekstraksi berkas. Kolom yang dibiarkan kosong tidak diubah. Nilai akan divalidasi ulang.
            </DialogDescription>
          </DialogHeader>
          {editForm ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-parameterName">Nama Parameter</Label>
                <Input
                  id="edit-parameterName"
                  value={editForm.parameterName}
                  onChange={(e) => setEditForm({ ...editForm, parameterName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-participant">Nilai Peserta</Label>
                  <Input
                    id="edit-participant"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editForm.participantValue}
                    onChange={(e) => setEditForm({ ...editForm, participantValue: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-target">Nilai Target</Label>
                  <Input
                    id="edit-target"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editForm.targetValue}
                    onChange={(e) => setEditForm({ ...editForm, targetValue: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-zscore">Z-Score</Label>
                  <Input
                    id="edit-zscore"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={editForm.zScore}
                    onChange={(e) => setEditForm({ ...editForm, zScore: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setEditForm(null); }} disabled={savingEdit}>
              Batal
            </Button>
            <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      <AlertDialog open={rejectItem !== null} onOpenChange={(open) => { if (!open) setRejectItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tolak parameter ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Parameter “{rejectItem?.parameterName}” akan ditandai ditolak dan dikeluarkan dari daftar review. Tindakan ini tercatat pada log audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busyId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (rejectItem) void handleReject(rejectItem);
              }}
            >
              Ya, Tolak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reprocess confirmation */}
      <AlertDialog open={reprocessItem !== null} onOpenChange={(open) => { if (!open) setReprocessItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proses ulang sesi?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh pipeline ekstraksi untuk parameter “{reprocessItem?.parameterName}” akan dijalankan kembali. Tindakan ini dapat memakan waktu beberapa saat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-600 text-white hover:bg-teal-700"
              disabled={busyId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (reprocessItem) void handleReprocess(reprocessItem);
              }}
            >
              Ya, Proses Ulang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
