"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";

import { ApiError, apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { CapaData } from "@/types/pme";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type CapaStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

const STATUS_BADGE: Record<CapaStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-teal-100 text-teal-800 border-teal-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const STATUS_LABEL: Record<CapaStatus, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Berjalan",
  CLOSED: "Selesai",
};

const NEXT_STATUS: Partial<Record<CapaStatus, CapaStatus>> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "CLOSED",
};

interface CapaFormState {
  problem: string;
  finding: string;
  rootCause: string;
  immediateCorrection: string;
  correctiveAction: string;
  preventiveAction: string;
  pic: string;
  dueDate: string;
  verification: string;
  evidence: string;
}

const EMPTY_FORM: CapaFormState = {
  problem: "",
  finding: "",
  rootCause: "",
  immediateCorrection: "",
  correctiveAction: "",
  preventiveAction: "",
  pic: "",
  dueDate: "",
  verification: "",
  evidence: "",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtZ(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v);
}

function isOverdue(capa: CapaData): boolean {
  if (!capa.dueDate || capa.status === "CLOSED") return false;
  const due = new Date(capa.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formFromCapa(capa: CapaData): CapaFormState {
  return {
    problem: capa.problem ?? "",
    finding: capa.finding ?? "",
    rootCause: capa.rootCause ?? "",
    immediateCorrection: capa.immediateCorrection ?? "",
    correctiveAction: capa.correctiveAction ?? "",
    preventiveAction: capa.preventiveAction ?? "",
    pic: capa.pic ?? "",
    dueDate: toDateInputValue(capa.dueDate),
    verification: capa.verification ?? "",
    evidence: capa.evidence ?? "",
  };
}

function payloadFromForm(form: CapaFormState): Record<string, string> {
  return {
    problem: form.problem.trim(),
    finding: form.finding.trim(),
    rootCause: form.rootCause.trim(),
    immediateCorrection: form.immediateCorrection.trim(),
    correctiveAction: form.correctiveAction.trim(),
    preventiveAction: form.preventiveAction.trim(),
    pic: form.pic.trim(),
    dueDate: form.dueDate,
    verification: form.verification.trim(),
    evidence: form.evidence.trim(),
  };
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value && value.trim() ? value : "—"}</p>
    </div>
  );
}

export function CapaView() {
  const { toast } = useToast();

  const [capas, setCapas] = useState<CapaData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CapaFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailCapa, setDetailCapa] = useState<CapaData | null>(null);
  const [editCapa, setEditCapa] = useState<CapaData | null>(null);
  const [editForm, setEditForm] = useState<CapaFormState>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<{ capa: CapaData; next: CapaStatus } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CapaData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCapas = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
      const data = await apiGet<{ capas: CapaData[] }>(`/api/capa${qs}`);
      setCapas(data.capas ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat data CAPA.");
      setCapas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCapas(statusFilter);
  }, [fetchCapas, statusFilter]);

  async function handleCreate() {
    if (!createForm.problem.trim()) {
      setFormError("Deskripsi masalah wajib diisi.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await apiSend("/api/capa", "POST", payloadFromForm(createForm));
      toast({ title: "CAPA berhasil dibuat", description: "Tindakan korektif dan preventif telah dicatat." });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await fetchCapas(statusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan CAPA.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(capa: CapaData, next: CapaStatus) {
    setBusyId(capa.id);
    try {
      await apiSend(`/api/capa/${capa.id}`, "PATCH", { status: next });
      toast({ title: "Status diperbarui", description: `CAPA kini berstatus ${STATUS_LABEL[next]}.` });
      setDetailCapa(null);
      setConfirmStatus(null);
      await fetchCapas(statusFilter);
    } catch (err) {
      toast({ title: "Gagal mengubah status", description: err instanceof ApiError ? err.message : "Perubahan gagal.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit() {
    if (!editCapa) return;
    if (!editForm.problem.trim()) {
      setFormError("Deskripsi masalah wajib diisi.");
      return;
    }
    setSavingEdit(true);
    setFormError(null);
    try {
      await apiSend(`/api/capa/${editCapa.id}`, "PATCH", payloadFromForm(editForm));
      toast({ title: "CAPA diperbarui", description: "Perubahan berhasil disimpan." });
      setEditCapa(null);
      await fetchCapas(statusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await apiSend(`/api/capa/${confirmDelete.id}`, "DELETE");
      toast({ title: "CAPA berhasil dihapus", description: "Tindakan CAPA telah dihapus dari sistem." });
      if (detailCapa?.id === confirmDelete.id) setDetailCapa(null);
      setConfirmDelete(null);
      await fetchCapas(statusFilter);
    } catch (err) {
      toast({
        title: "Gagal menghapus CAPA",
        description: err instanceof ApiError ? err.message : "Penghapusan gagal.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  const overdueCount = (capas ?? []).filter(isOverdue).length;

  function renderFormFields(form: CapaFormState, setForm: (f: CapaFormState) => void, idPrefix: string) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-problem`}>
            Masalah <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id={`${idPrefix}-problem`}
            value={form.problem}
            onChange={(e) => setForm({ ...form, problem: e.target.value })}
            placeholder="Jelaskan masalah / ketidaksesuaian yang ditemukan"
            rows={2}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-finding`}>Temuan</Label>
          <Textarea
            id={`${idPrefix}-finding`}
            value={form.finding}
            onChange={(e) => setForm({ ...form, finding: e.target.value })}
            rows={2}
            placeholder="Temuan objektif dari investigasi"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-rootCause`}>Akar Masalah</Label>
          <Textarea
            id={`${idPrefix}-rootCause`}
            value={form.rootCause}
            onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
            rows={2}
            placeholder="Analisis akar masalah (root cause)"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-immediateCorrection`}>Koreksi Segera</Label>
          <Textarea
            id={`${idPrefix}-immediateCorrection`}
            value={form.immediateCorrection}
            onChange={(e) => setForm({ ...form, immediateCorrection: e.target.value })}
            rows={2}
            placeholder="Tindakan perbaikan yang dilakukan segera"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-correctiveAction`}>Tindakan Korektif</Label>
          <Textarea
            id={`${idPrefix}-correctiveAction`}
            value={form.correctiveAction}
            onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            rows={2}
            placeholder="Tindakan korektif untuk mencegah kekambuhan"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-preventiveAction`}>Tindakan Preventif</Label>
          <Textarea
            id={`${idPrefix}-preventiveAction`}
            value={form.preventiveAction}
            onChange={(e) => setForm({ ...form, preventiveAction: e.target.value })}
            rows={2}
            placeholder="Tindakan preventif jangka panjang"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-pic`}>PIC (Penanggung Jawab)</Label>
            <Input
              id={`${idPrefix}-pic`}
              value={form.pic}
              onChange={(e) => setForm({ ...form, pic: e.target.value })}
              placeholder="Nama penanggung jawab"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-dueDate`}>Target Selesai</Label>
            <Input
              id={`${idPrefix}-dueDate`}
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-verification`}>Verifikasi Efektivitas</Label>
          <Textarea
            id={`${idPrefix}-verification`}
            value={form.verification}
            onChange={(e) => setForm({ ...form, verification: e.target.value })}
            rows={2}
            placeholder="Hasil verifikasi efektivitas tindakan"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-evidence`}>Bukti / Evidence</Label>
          <Textarea
            id={`${idPrefix}-evidence`}
            value={form.evidence}
            onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            rows={2}
            placeholder="Referensi dokumen, foto, atau lampiran pendukung"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tindakan Korektif &amp; Preventif (CAPA)</h2>
          <p className="text-sm text-muted-foreground">
            Kelola tindakan perbaikan atas hasil PME yang tidak memuaskan.
            {overdueCount > 0 ? (
              <span className="ml-1 inline-flex items-center gap-1 font-medium text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {overdueCount} melewati tenggat
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger className="w-[170px]" aria-label="Filter status CAPA">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="OPEN">Terbuka</SelectItem>
              <SelectItem value="IN_PROGRESS">Berjalan</SelectItem>
              <SelectItem value="CLOSED">Selesai</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => { setCreateForm(EMPTY_FORM); setFormError(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" />
            CAPA Baru
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void fetchCapas(statusFilter)}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-3/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (capas ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ClipboardList className="h-12 w-12 text-teal-600" />
            <p className="text-base font-medium">Belum ada CAPA</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Buat CAPA baru untuk mendokumentasikan tindakan korektif dan preventif terhadap temuan PME.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {(capas ?? []).map((capa) => {
            const overdue = isOverdue(capa);
            return (
              <Card key={capa.id}>
                <CardContent className="flex flex-col gap-3 p-4 md:p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`border ${STATUS_BADGE[capa.status] ?? ""}`}>
                          {STATUS_LABEL[capa.status] ?? capa.status}
                        </Badge>
                        {overdue ? (
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            Lewat tenggat
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-1.5 text-base font-bold leading-snug">{capa.problem}</h3>
                      {capa.result ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Parameter: {capa.result.parameterName}
                          {capa.result.zScore !== null && capa.result.zScore !== undefined ? ` (Z=${fmtZ(capa.result.zScore)})` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 self-start">
                      <Button size="sm" variant="outline" onClick={() => setDetailCapa(capa)}>
                        Detail
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                        title="Hapus CAPA"
                        aria-label="Hapus CAPA"
                        onClick={() => setConfirmDelete(capa)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        PIC: <span className="font-medium text-foreground">{capa.pic || "—"}</span>
                      </span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      <span>Tenggat: {fmtDate(capa.dueDate)}</span>
                    </div>
                    <div className="text-muted-foreground sm:col-span-2">
                      Dibuat: {fmtDateTime(capa.createdAt)}
                    </div>
                  </div>

                  {capa.correctiveAction || capa.preventiveAction ? (
                    <div className="grid gap-2 border-t pt-3 text-xs md:grid-cols-2">
                      {capa.correctiveAction ? (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Korektif: </span>
                          <span className="line-clamp-2">{capa.correctiveAction}</span>
                        </p>
                      ) : null}
                      {capa.preventiveAction ? (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Preventif: </span>
                          <span className="line-clamp-2">{capa.preventiveAction}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>CAPA Baru</DialogTitle>
            <DialogDescription>Dokumentasikan masalah beserta rencana tindakan korektif dan preventif.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {renderFormFields(createForm, setCreateForm, "create")}
            {formError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Batal
            </Button>
            <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Simpan CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailCapa !== null} onOpenChange={(open) => { if (!open) setDetailCapa(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail CAPA</DialogTitle>
            {detailCapa ? (
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`border ${STATUS_BADGE[detailCapa.status] ?? ""}`}>
                  {STATUS_LABEL[detailCapa.status] ?? detailCapa.status}
                </Badge>
                <span>Dibuat {fmtDateTime(detailCapa.createdAt)}</span>
              </DialogDescription>
            ) : (
              <DialogDescription />
            )}
          </DialogHeader>
          {detailCapa ? (
            <div className="grid gap-4 py-2">
              <DetailField label="Masalah" value={detailCapa.problem} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="PIC" value={detailCapa.pic} />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Target Selesai</p>
                  <p className={`mt-0.5 text-sm ${isOverdue(detailCapa) ? "font-medium text-red-600" : ""}`}>
                    {fmtDate(detailCapa.dueDate)}
                    {isOverdue(detailCapa) ? " (lewat tenggat)" : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Temuan" value={detailCapa.finding} />
                <DetailField label="Akar Masalah" value={detailCapa.rootCause} />
                <DetailField label="Koreksi Segera" value={detailCapa.immediateCorrection} />
                <DetailField label="Tindakan Korektif" value={detailCapa.correctiveAction} />
                <DetailField label="Tindakan Preventif" value={detailCapa.preventiveAction} />
                <DetailField label="Verifikasi Efektivitas" value={detailCapa.verification} />
                <DetailField label="Bukti / Evidence" value={detailCapa.evidence} />
              </div>
              {detailCapa.result ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Parameter terkait: {detailCapa.result.parameterName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Z-Score: {fmtZ(detailCapa.result.zScore)}
                    {detailCapa.result.zStatus ? ` · Status: ${detailCapa.result.zStatus}` : ""}
                  </p>
                </div>
              ) : null}
              {detailCapa.closedAt ? (
                <p className="text-xs text-muted-foreground">Ditutup pada {fmtDateTime(detailCapa.closedAt)}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {detailCapa && NEXT_STATUS[detailCapa.status] ? (
                <Button
                  variant="outline"
                  className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                  disabled={busyId === detailCapa.id}
                  onClick={() => setConfirmStatus({ capa: detailCapa, next: NEXT_STATUS[detailCapa.status] as CapaStatus })}
                >
                  {busyId === detailCapa.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Ubah Status: {STATUS_LABEL[NEXT_STATUS[detailCapa.status] as CapaStatus]}
                </Button>
              ) : null}
              {detailCapa && detailCapa.status !== "OPEN" ? (
                <Button variant="ghost" disabled={busyId === detailCapa.id} onClick={() => { if (detailCapa) void handleStatusChange(detailCapa, "OPEN"); }}>
                  Kembalikan ke Terbuka
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              {detailCapa ? (
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                  onClick={() => setConfirmDelete(detailCapa)}
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </Button>
              ) : null}
              {detailCapa ? (
                <Button
                  variant="outline"
                  onClick={() => { setEditCapa(detailCapa); setEditForm(formFromCapa(detailCapa)); setFormError(null); }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setDetailCapa(null)}>
                Tutup
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editCapa !== null} onOpenChange={(open) => { if (!open) setEditCapa(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit CAPA</DialogTitle>
            <DialogDescription>Perbarui informasi tindakan korektif dan preventif.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {renderFormFields(editForm, setEditForm, "edit")}
            {formError ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCapa(null)} disabled={savingEdit}>
              Batal
            </Button>
            <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change confirmation */}
      <AlertDialog open={confirmStatus !== null} onOpenChange={(open) => { if (!open) setConfirmStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ubah status CAPA?</AlertDialogTitle>
            <AlertDialogDescription>
              Status CAPA “{confirmStatus?.capa.problem.slice(0, 80)}{confirmStatus && confirmStatus.capa.problem.length > 80 ? "…" : ""}” akan diubah menjadi{" "}
              <span className="font-medium text-foreground">{confirmStatus ? STATUS_LABEL[confirmStatus.next] : ""}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-600 text-white hover:bg-teal-700"
              disabled={busyId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirmStatus) void handleStatusChange(confirmStatus.capa, confirmStatus.next);
              }}
            >
              Ya, Ubah Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus CAPA ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tindakan CAPA “{confirmDelete?.problem}”? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Ya, Hapus CAPA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
