"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  PackageCheck,
  FilePenLine,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Check,
  X,
  RotateCcw,
  Calendar,
  Lock,
} from "lucide-react";

interface ParticipantItem {
  id: string;
  participantCode: string | null;
  labName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPerson: string | null;
  cycle?: string | null;
  status: string; // "PENDING" | "APPROVED" | "REJECTED"
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
  packageRegistrations?: {
    id: string;
    cycle: string;
    package: { name: string; category: string };
  }[];
  _count?: { submissions: number };
}

export function PmeRegistrationView() {
  const { user, navigate, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const isSuperadmin = user?.role === "SUPERADMIN";

  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  // Modal form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParticipantItem | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formLabName, setFormLabName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formCycle, setFormCycle] = useState("Siklus 1 2026");
  const [activeConfigCycle, setActiveConfigCycle] = useState("Siklus 1 2026");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  // Approval processing state
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ParticipantItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchActiveConfig = async () => {
    try {
      const res = await fetch("/api/pme-mgmt/config", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.config?.activeCycle) {
          setActiveConfigCycle(data.config.activeCycle);
          setFormCycle(data.config.activeCycle);
        }
        if (typeof data.config?.isRegistrationOpen === "boolean") {
          setIsRegistrationOpen(data.config.isRegistrationOpen);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat peserta", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal mengambil data peserta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
    fetchActiveConfig();
  }, [viewAsTenantId]);

  const handleOpenCreate = () => {
    if (!isRegistrationOpen) {
      toast({
        title: "Pendaftaran Dinonaktifkan",
        description: "Pendaftaran peserta PME saat ini sedang ditutup/dinonaktifkan oleh pihak penyelenggara.",
        variant: "destructive",
      });
      return;
    }
    setEditingItem(null);
    setFormCode("");
    setFormLabName(user?.organization?.name || "");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormContactPerson("");
    setFormCycle(activeConfigCycle);
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: ParticipantItem) => {
    setEditingItem(p);
    setFormCode(p.participantCode || "");
    setFormLabName(p.labName || user?.organization?.name || "");
    setFormPhone(p.phone || "");
    setFormEmail(p.email || "");
    setFormAddress(p.address || "");
    setFormContactPerson(p.contactPerson || "");
    setFormCycle(p.cycle || activeConfigCycle);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabName.trim()) {
      toast({ title: "Validasi Gagal", description: "Nama Laboratorium Peserta wajib diisi.", variant: "destructive" });
      return;
    }
    if (!formCycle.trim()) {
      toast({ title: "Validasi Gagal", description: "Siklus PME wajib diisi.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: editingItem?.id,
          participantCode: formCode.trim() || undefined,
          labName: formLabName.trim(),
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          address: formAddress.trim() || undefined,
          contactPerson: formContactPerson.trim() || undefined,
          cycle: formCycle.trim(),
        }),
      });

      if (res.ok) {
        toast({
          title: editingItem ? "Peserta Diperbarui" : "Peserta Didaftarkan",
          description: editingItem
            ? `Laboratorium ${formLabName} berhasil diperbarui.`
            : `Laboratorium ${formLabName} berhasil didaftarkan dengan status Menunggu Persetujuan Superadmin.`,
        });
        setDialogOpen(false);
        fetchParticipants();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menyimpan", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (id: string, action: "approve" | "reject" | "pending") => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, action }),
      });

      if (res.ok) {
        const d = await res.json();
        toast({
          title:
            action === "approve"
              ? "Pendaftaran Disetujui"
              : action === "reject"
              ? "Pendaftaran Ditolak"
              : "Status Direset ke Menunggu",
          description: d.message,
        });
        fetchParticipants();
      } else {
        const err = await res.json();
        toast({ title: "Gagal mengubah status", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan", description: "Gagal memproses persetujuan.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pme-mgmt/participants?id=${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        toast({ title: "Peserta Dihapus", description: `Data ${deleteTarget.labName} telah dihapus.` });
        setDeleteTarget(null);
        fetchParticipants();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menghapus", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menghapus", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = participants.filter((p) => p.status === "PENDING").length;
  const approvedCount = participants.filter((p) => p.status === "APPROVED").length;
  const rejectedCount = participants.filter((p) => p.status === "REJECTED").length;

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.labName.toLowerCase().includes(q) ||
      (p.participantCode && p.participantCode.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.cycle && p.cycle.toLowerCase().includes(q));

    if (!matchSearch) return false;
    if (statusFilter === "ALL") return true;
    return p.status === statusFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Pendaftaran Peserta PME</h1>
              <p className="text-xs text-muted-foreground">
                Pendaftaran data identitas laboratorium peserta Program Pemantapan Mutu Eksternal
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchParticipants} disabled={loading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
          <Button
            onClick={handleOpenCreate}
            disabled={!isRegistrationOpen}
            size="sm"
            className={cn(
              "text-xs font-medium transition-all",
              isRegistrationOpen
                ? "bg-teal-700 hover:bg-teal-800 text-white shadow-sm"
                : "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border"
            )}
            title={!isRegistrationOpen ? "Pendaftaran peserta PME saat ini dinonaktifkan oleh penyelenggara" : "Daftar Peserta Baru"}
          >
            {isRegistrationOpen ? (
              <UserPlus className="mr-1.5 h-4 w-4" />
            ) : (
              <Lock className="mr-1.5 h-4 w-4 text-slate-400" />
            )}
            Daftar Peserta Baru
          </Button>
        </div>
      </div>

      {/* Banner Peringatan Ketika Pendaftaran PME Dinonaktifkan */}
      {!isRegistrationOpen && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-300">
            <Lock className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>
              <strong>Pendaftaran Peserta PME Saat Ini Ditutup:</strong> Penyelenggara telah menonaktifkan periode pendaftaran peserta baru. Tombol <em>&quot;Daftar Peserta Baru&quot;</em> dinonaktifkan sementara waktu hingga dibuka kembali.
            </span>
          </div>
          <Badge variant="destructive" className="shrink-0 text-[10px] font-semibold">
            PENDAFTARAN NONAKTIF
          </Badge>
        </div>
      )}

      {/* Superadmin Notification Banner if Pending */}
      {isSuperadmin && pendingCount > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Terdapat <strong>{pendingCount} laboratorium peserta</strong> berstatus <em>Menunggu Persetujuan</em>.
              Laboratorium hanya dapat melakukan pemilihan paket dan input hasil setelah Anda menyetujuinya.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatusFilter("PENDING")}
            className="text-[11px] h-7 shrink-0 border-amber-400 text-amber-900 dark:text-amber-200 bg-amber-100/50 hover:bg-amber-200/50"
          >
            Tinjau Sekarang
          </Button>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Laboratorium</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">{participants.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")}
          className={`bg-card shadow-sm border cursor-pointer transition-all ${
            statusFilter === "PENDING" ? "ring-2 ring-amber-500" : "hover:border-amber-400"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground font-medium">Menunggu Persetujuan</p>
                {pendingCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </div>
              <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{pendingCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter(statusFilter === "APPROVED" ? "ALL" : "APPROVED")}
          className={`bg-card shadow-sm border cursor-pointer transition-all ${
            statusFilter === "APPROVED" ? "ring-2 ring-emerald-500" : "hover:border-emerald-400"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Disetujui Superadmin</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{approvedCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Sudah Memilih Paket</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {participants.filter((p) => (p.packageRegistrations?.length || 0) > 0).length}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <PackageCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Daftar Laboratorium Peserta Terdaftar</CardTitle>
              <CardDescription className="text-xs">
                Laboratorium peserta wajib berstatus <strong>Disetujui</strong> oleh Superadmin sebelum dapat memilih paket dan menginput hasil PME.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Status Filter Tabs */}
              <div className="flex items-center rounded-lg border bg-muted/30 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === "ALL" ? "bg-background font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Semua ({participants.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("PENDING")}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    statusFilter === "PENDING" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Menunggu
                  {pendingCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("APPROVED")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === "APPROVED" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Disetujui ({approvedCount})
                </button>
                {rejectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("REJECTED")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      statusFilter === "REJECTED" ? "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Ditolak ({rejectedCount})
                  </button>
                )}
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari lab, kode, siklus..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground font-medium">
                <tr>
                  <th className="p-3 w-10 text-center">No.</th>
                  <th className="p-3 w-28">Kode Peserta</th>
                  <th className="p-3 min-w-[180px]">Nama Laboratorium</th>
                  <th className="p-3 w-32">Siklus PME</th>
                  <th className="p-3 w-36 text-center">Status Persetujuan</th>
                  <th className="p-3 min-w-[130px]">Kontak & HP</th>
                  <th className="p-3 min-w-[150px]">Email</th>
                  <th className="p-3 min-w-[180px]">Alamat Instansi</th>
                  <th className="p-3 min-w-[130px]">Paket Terdaftar</th>
                  <th className="p-3 w-36 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                        <span>Memuat data peserta...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground italic">
                      {search
                        ? "Tidak ditemukan peserta yang sesuai pencarian."
                        : statusFilter !== "ALL"
                        ? `Tidak ada peserta dengan status filter "${statusFilter}".`
                        : "Belum ada peserta PME yang didaftarkan. Klik tombol di atas untuk mendaftarkan peserta baru."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => {
                    const isApproved = item.status === "APPROVED";
                    const isPending = item.status === "PENDING";
                    const isRejected = item.status === "REJECTED";
                    const isProcessing = processingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          isPending ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                        }`}
                      >
                        <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <span className="font-mono font-semibold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded text-[11px]">
                            {item.participantCode || "-"}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-foreground">{item.labName}</p>
                          {item.contactPerson && (
                            <p className="text-[10px] text-muted-foreground">PJ: {item.contactPerson}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            {item.cycle || "Siklus 1 2026"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {isApproved ? (
                            <div className="flex flex-col items-center">
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 text-[10px] font-semibold">
                                <CheckCircle2 className="h-3 w-3" /> Disetujui
                              </Badge>
                              {item.approvedBy && (
                                <span className="text-[9px] text-muted-foreground mt-0.5">
                                  Oleh: {item.approvedBy}
                                </span>
                              )}
                            </div>
                          ) : isPending ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 text-[10px] font-semibold animate-pulse">
                              <Clock className="h-3 w-3" /> Menunggu Persetujuan
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1 text-[10px] font-semibold">
                              <XCircle className="h-3 w-3" /> Ditolak
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {item.phone ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3 text-teal-600" />
                              <span className="font-mono">{item.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.email ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3 text-blue-600" />
                              <span className="truncate max-w-[140px]" title={item.email}>{item.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">-</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground leading-relaxed">
                          {item.address ? (
                            <div className="flex items-start gap-1">
                              <MapPin className="h-3 w-3 text-rose-500 mt-0.5 shrink-0" />
                              <span className="line-clamp-2" title={item.address}>{item.address}</span>
                            </div>
                          ) : (
                            <span className="italic">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.packageRegistrations && item.packageRegistrations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.packageRegistrations.map((pr) => (
                                <Badge key={pr.id} variant="outline" className="text-[10px] bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20">
                                  {pr.package.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                              Belum Pilih Paket
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Tombol Otoritas Persetujuan Khusus Superadmin */}
                            {isSuperadmin && (
                              <>
                                {isPending && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isProcessing}
                                      title="Setujui Pendaftaran Laboratorium Ini"
                                      onClick={() => handleApproval(item.id, "approve")}
                                      className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isProcessing}
                                      title="Tolak Pendaftaran Laboratorium Ini"
                                      onClick={() => handleApproval(item.id, "reject")}
                                      className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {isApproved && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isProcessing}
                                    title="Batalkan Persetujuan (Kembalikan ke Status Menunggu)"
                                    onClick={() => handleApproval(item.id, "pending")}
                                    className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {isRejected && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isProcessing}
                                    title="Setujui Pendaftaran (Ubah dari Ditolak)"
                                    onClick={() => handleApproval(item.id, "approve")}
                                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Tombol Edit */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit Data Peserta"
                              onClick={() => handleOpenEdit(item)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Tombol Pintas ke Pemilihan Paket (Hanya jika disetujui) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!isApproved}
                              title={isApproved ? "Pilih Paket PME" : "Terkunci: Menunggu persetujuan Superadmin"}
                              onClick={() => navigate("pme-packages")}
                              className={`h-7 w-7 p-0 ${
                                isApproved
                                  ? "text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                  : "text-muted-foreground/40 cursor-not-allowed"
                              }`}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                            </Button>

                            {/* Tombol Pintas ke Input Hasil (Hanya jika disetujui) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!isApproved}
                              title={isApproved ? "Input Hasil PME" : "Terkunci: Menunggu persetujuan Superadmin"}
                              onClick={() => navigate("pme-input")}
                              className={`h-7 w-7 p-0 ${
                                isApproved
                                  ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  : "text-muted-foreground/40 cursor-not-allowed"
                              }`}
                            >
                              <FilePenLine className="h-3.5 w-3.5" />
                            </Button>

                            {/* Tombol Hapus */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Hapus Peserta"
                              onClick={() => setDeleteTarget(item)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Pendaftaran / Edit Peserta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Data Peserta PME" : "Pendaftaran Peserta PME Baru"}</DialogTitle>
            <DialogDescription className="text-xs">
              {editingItem
                ? "Perbarui informasi laboratorium peserta PME di bawah ini."
                : "Daftarkan laboratorium peserta baru. Pendaftaran akan berstatus Menunggu Persetujuan Superadmin sebelum dapat memilih paket dan menginput hasil."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 text-xs py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Kode Peserta (Opsional / Otomatis)</Label>
                <Input
                  placeholder="Contoh: LAB-001"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* KOLOM INPUT SIKLUS PME (TERISI OTOMATIS & TERKUNCI) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Siklus PME <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium bg-teal-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Otomatis Superadmin
                  </span>
                </div>
                <Input
                  placeholder="Contoh: Siklus 1 2026"
                  value={formCycle}
                  readOnly
                  disabled
                  tabIndex={-1}
                  required
                  className="h-8 text-xs font-semibold bg-muted/60 text-foreground cursor-not-allowed border-dashed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Nama Laboratorium Peserta <span className="text-red-500">*</span>
                </Label>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium bg-teal-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Terisi Otomatis (Akun Organisasi)
                </span>
              </div>
              <Input
                placeholder="Nama Laboratorium Peserta"
                value={formLabName}
                readOnly
                disabled
                tabIndex={-1}
                required
                className="h-8 text-xs font-semibold bg-muted/60 text-foreground cursor-not-allowed border-dashed"
              />
              <p className="text-[10.5px] text-muted-foreground">
                🔒 Nama laboratorium disesuaikan otomatis dengan nama instansi/organisasi akun login Anda ({user?.organization?.name || "Laboratorium"}).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">No. Handphone / WhatsApp</Label>
                <Input
                  placeholder="0811..."
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Penanggung Jawab (PJ)</Label>
                <Input
                  placeholder="Nama PJ Lab"
                  value={formContactPerson}
                  onChange={(e) => setFormContactPerson(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alamat Email Resmi</Label>
              <Input
                type="email"
                placeholder="laboratorium@instansi.go.id"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alamat Lengkap Instansi</Label>
              <Textarea
                placeholder="Jln. Raya Belitang-Rasuan No.1 Sumatera Selatan"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || (!editingItem && !isRegistrationOpen)}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editingItem ? "Simpan Perubahan" : "Daftarkan Peserta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Konfirmasi Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Peserta?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Apakah Anda yakin ingin menghapus data laboratorium{" "}
              <strong>{deleteTarget?.labName}</strong>? Seluruh riwayat pendaftaran paket dan hasil PME yang terkait dengan peserta ini akan terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              {deleting ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
