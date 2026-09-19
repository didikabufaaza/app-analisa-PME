"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PackageCheck,
  PlusCircle,
  FlaskConical,
  Droplet,
  ShieldAlert,
  Search,
  CheckCircle2,
  Trash2,
  Loader2,
  Lock,
  Layers,
  Sparkles,
  Clock,
  AlertTriangle,
  Check,
  XCircle,
} from "lucide-react";

interface ParameterItem {
  id: string;
  name: string;
  unit: string | null;
  defaultMethodCode: string | null;
  defaultInstrumentCode: string | null;
  sortOrder: number;
}

interface PackageItem {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  parameters: ParameterItem[];
  _count?: { registrations: number };
}

interface ParticipantOption {
  id: string;
  labName: string;
  participantCode: string | null;
  cycle?: string | null;
  status: string; // "PENDING" | "APPROVED" | "REJECTED"
  approvedAt?: string | null;
  approvedBy?: string | null;
}

interface EnrollmentItem {
  id: string;
  cycle: string;
  period: string | null;
  registeredAt: string;
  participant: { id: string; labName: string; participantCode: string | null };
  package: { id: string; name: string; category: string; parameters: ParameterItem[] };
}

export function PmePackagesView() {
  const { user, navigate, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const isSuperadmin = user?.role === "SUPERADMIN";

  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Pemilihan Paket
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<string>("Siklus 1 2026");
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [approvingParticipant, setApprovingParticipant] = useState(false);

  // Modal Tambah Paket (Superadmin only)
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgCategory, setPkgCategory] = useState("Kimia Klinik");
  const [pkgDescription, setPkgDescription] = useState("");
  const [savingPkg, setSavingPkg] = useState(false);

  // Modal Tambah Parameter (Superadmin only)
  const [paramDialogOpen, setParamDialogOpen] = useState(false);
  const [targetPkgId, setTargetPkgId] = useState<string>("");
  const [paramName, setParamName] = useState("");
  const [paramUnit, setParamUnit] = useState("");
  const [paramMethodCode, setParamMethodCode] = useState("");
  const [paramInstrumentCode, setParamInstrumentCode] = useState("");
  const [savingParam, setSavingParam] = useState(false);

  const handleSelectParticipant = (pId: string) => {
    setSelectedParticipantId(pId);
    const p = participants.find((x) => x.id === pId);
    if (p?.cycle) {
      setSelectedCycle(p.cycle);
    }
  };

  const handleApproveParticipant = async (pId: string) => {
    if (!pId) return;
    setApprovingParticipant(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: pId, action: "approve" }),
      });
      if (res.ok) {
        toast({
          title: "Laboratorium Disetujui",
          description: "Laboratorium telah disetujui dan kini dapat memilih paket PME.",
        });
        await loadData();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyetujui", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setApprovingParticipant(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pkgRes, partRes, enrollRes] = await Promise.all([
        fetch("/api/pme-mgmt/packages", { credentials: "same-origin" }),
        fetch("/api/pme-mgmt/participants", { credentials: "same-origin" }),
        fetch("/api/pme-mgmt/enroll", { credentials: "same-origin" }),
      ]);

      if (pkgRes.ok) {
        const d = await pkgRes.json();
        setPackages(d.packages || []);
      }
      if (partRes.ok) {
        const d = await partRes.json();
        setParticipants(d.participants || []);
      }
      if (enrollRes.ok) {
        const d = await enrollRes.json();
        setEnrollments(d.registrations || []);
      }
    } catch {
      toast({ title: "Gagal memuat data", description: "Terjadi kesalahan jaringan.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewAsTenantId]);

  const togglePackageSelection = (pkgId: string) => {
    setSelectedPackageIds((prev) =>
      prev.includes(pkgId) ? prev.filter((id) => id !== pkgId) : [...prev, pkgId]
    );
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticipantId) {
      toast({ title: "Validasi Gagal", description: "Pilih laboratorium peserta terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!selectedCycle.trim()) {
      toast({ title: "Validasi Gagal", description: "Siklus PME wajib diisi.", variant: "destructive" });
      return;
    }
    if (selectedPackageIds.length === 0) {
      toast({ title: "Validasi Gagal", description: "Pilih minimal satu paket PME.", variant: "destructive" });
      return;
    }

    setEnrolling(true);
    try {
      const res = await fetch("/api/pme-mgmt/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          participantId: selectedParticipantId,
          cycle: selectedCycle.trim(),
          packageIds: selectedPackageIds,
        }),
      });

      if (res.ok) {
        toast({
          title: "Pemilihan Paket Berhasil Disimpan",
          description: "Peserta berhasil didaftarkan pada paket yang dipilih.",
        });
        setSelectedPackageIds([]);
        loadData();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menyimpan", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteEnrollment = async (id: string) => {
    try {
      const res = await fetch(`/api/pme-mgmt/enroll?id=${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        toast({ title: "Pendaftaran Paket Dihapus", description: "Pendaftaran berhasil dibatalkan." });
        loadData();
      }
    } catch {
      toast({ title: "Gagal menghapus", variant: "destructive" });
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) return;

    setSavingPkg(true);
    try {
      const res = await fetch("/api/pme-mgmt/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: pkgName.trim(),
          category: pkgCategory,
          description: pkgDescription.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: "Paket Berhasil Ditambahkan", description: `Paket ${pkgName} siap digunakan.` });
        setPkgDialogOpen(false);
        setPkgName("");
        setPkgDescription("");
        loadData();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menambah paket", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menambah paket", variant: "destructive" });
    } finally {
      setSavingPkg(false);
    }
  };

  const handleCreateParameter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramName.trim() || !targetPkgId) return;

    setSavingParam(true);
    try {
      const res = await fetch("/api/pme-mgmt/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "ADD_PARAMETER",
          packageId: targetPkgId,
          name: paramName.trim(),
          unit: paramUnit.trim() || undefined,
          defaultMethodCode: paramMethodCode.trim() || undefined,
          defaultInstrumentCode: paramInstrumentCode.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: "Parameter Ditambahkan", description: `Parameter ${paramName} berhasil ditambahkan ke paket.` });
        setParamDialogOpen(false);
        setParamName("");
        setParamUnit("");
        setParamMethodCode("");
        setParamInstrumentCode("");
        loadData();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menambah parameter", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menambah parameter", variant: "destructive" });
    } finally {
      setSavingParam(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes("kimia")) return <FlaskConical className="h-5 w-5 text-amber-600" />;
    if (category.toLowerCase().includes("hematologi")) return <Droplet className="h-5 w-5 text-rose-600" />;
    return <ShieldAlert className="h-5 w-5 text-blue-600" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Pemilihan Paket PME</h1>
              <p className="text-xs text-muted-foreground">
                Pilih paket pemeriksaan yang diikuti laboratorium peserta atau kelola master paket (Superadmin)
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="enrollment" className="space-y-5">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="enrollment" className="text-xs flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5" />
            <span>Pemilihan Paket Peserta</span>
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>Katalog Master Paket & Parameter</span>
            {isSuperadmin && (
              <span className="ml-1 text-[9px] bg-teal-600 text-white px-1.5 py-0.2 rounded font-mono">
                Superadmin
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PEMILIHAN PAKET PESERTA */}
        <TabsContent value="enrollment" className="space-y-6">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>Formulir Pendaftaran Paket PME</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Pilih laboratorium peserta dan centang paket-paket yang akan diikuti pada siklus evaluasi
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              <form onSubmit={handleEnroll} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Pilih Laboratorium Peserta <span className="text-red-500">*</span>
                    </Label>
                    <Select value={selectedParticipantId} onValueChange={handleSelectParticipant}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="-- Pilih Laboratorium Peserta --" />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Belum ada peserta. Daftarkan di menu Pendaftaran PME.
                          </SelectItem>
                        ) : (
                          participants.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.participantCode ? `[${p.participantCode}] ` : ""}
                              {p.labName} {p.status === "APPROVED" ? "✓ (Disetujui)" : p.status === "PENDING" ? "⏳ (Menunggu Persetujuan)" : "✗ (Ditolak)"}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Siklus PME <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Contoh: Siklus 1 2026"
                      value={selectedCycle}
                      onChange={(e) => setSelectedCycle(e.target.value)}
                      required
                      className="h-9 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Banner Status Persetujuan Peserta */}
                {(() => {
                  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);
                  const isApproved = selectedParticipant?.status === "APPROVED";

                  if (!selectedParticipant || isApproved) return null;

                  return (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-semibold">
                            Laboratorium ini berstatus: {selectedParticipant.status === "REJECTED" ? "Ditolak" : "Menunggu Persetujuan Superadmin"}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Pemilihan paket PME hanya dapat dilakukan setelah pendaftaran laboratorium disetujui oleh Superadmin.
                          </p>
                        </div>
                      </div>
                      {isSuperadmin && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={approvingParticipant}
                          onClick={() => handleApproveParticipant(selectedParticipant.id)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs shrink-0"
                        >
                          {approvingParticipant ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Setujui Pendaftaran Sekarang
                        </Button>
                      )}
                    </div>
                  );
                })()}

                {/* Checklist Paket */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold">
                    Pilih Paket Pemeriksaan yang Diikuti: <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {packages.map((pkg) => {
                      const isSelected = selectedPackageIds.includes(pkg.id);
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => togglePackageSelection(pkg.id)}
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            isSelected
                              ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/20 ring-1 ring-teal-600"
                              : "border-border/70 hover:border-teal-500/50 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-lg bg-card border shadow-xs">
                                {getCategoryIcon(pkg.category)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-xs text-foreground">{pkg.name}</h4>
                                <span className="text-[10px] text-muted-foreground">{pkg.category}</span>
                              </div>
                            </div>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePackageSelection(pkg.id)}
                              className="mt-1"
                            />
                          </div>
                          <p className="mt-2.5 text-[11px] text-muted-foreground line-clamp-2">
                            {pkg.description || "Evaluasi parameter standar laboratorium klinis."}
                          </p>
                          <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-[10px]">
                            <span className="text-teal-700 dark:text-teal-400 font-medium">
                              {pkg.parameters.length} Parameter Uji
                            </span>
                            <span className="text-muted-foreground">
                              {pkg.parameters.slice(0, 3).map((p) => p.name).join(", ")}...
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedPackageIds.length} paket dipilih
                  </span>
                  {(() => {
                    const selPart = participants.find((p) => p.id === selectedParticipantId);
                    const isApproved = selPart?.status === "APPROVED";
                    const isLocked = !isApproved || !selectedParticipantId || selectedPackageIds.length === 0;

                    return (
                      <Button
                        type="submit"
                        disabled={enrolling || isLocked}
                        className="bg-teal-700 hover:bg-teal-800 text-white text-xs px-5 disabled:opacity-50"
                      >
                        {enrolling ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        )}
                        {!isApproved && selectedParticipantId
                          ? "Terkunci (Menunggu Persetujuan Superadmin)"
                          : "Simpan Pemilihan Paket"}
                      </Button>
                    );
                  })()}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tabel Riwayat Pendaftaran Paket Peserta */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Riwayat Pendaftaran Paket Laboratorium Peserta</CardTitle>
              <CardDescription className="text-xs">
                Daftar paket PME yang telah dipilih oleh masing-masing peserta
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/50 text-muted-foreground font-medium">
                    <tr>
                      <th className="p-3 w-12 text-center">No.</th>
                      <th className="p-3 w-32">Siklus PME</th>
                      <th className="p-3 min-w-[180px]">Nama Laboratorium</th>
                      <th className="p-3 min-w-[160px]">Paket yang Dipilih</th>
                      <th className="p-3 w-28 text-center">Jumlah Parameter</th>
                      <th className="p-3 w-32 text-center">Aksi Lanjut</th>
                      <th className="p-3 w-16 text-center">Batal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Memuat data pendaftaran...
                        </td>
                      </tr>
                    ) : enrollments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                          Belum ada peserta yang mendaftar paket. Silakan gunakan formulir di atas.
                        </td>
                      </tr>
                    ) : (
                      enrollments.map((en, idx) => (
                        <tr key={en.id} className="hover:bg-muted/40 transition-colors">
                          <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-3 font-semibold text-foreground font-mono">{en.cycle}</td>
                          <td className="p-3">
                            <p className="font-semibold text-foreground">{en.participant.labName}</p>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {en.participant.participantCode || "-"}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20">
                              {en.package.name}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-mono font-medium">
                            {en.package.parameters?.length || 0} Uji
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("pme-input")}
                              className="h-7 text-[11px] text-teal-700 dark:text-teal-300 border-teal-600/30 hover:bg-teal-50"
                            >
                              Input Hasil
                            </Button>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Batalkan Pendaftaran Paket"
                              onClick={() => handleDeleteEnrollment(en.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: KATALOG MASTER PAKET & PARAMETER */}
        <TabsContent value="catalog" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Katalog Master Paket & Parameter Uji</h3>
              <p className="text-xs text-muted-foreground">
                {isSuperadmin
                  ? "Sebagai Superadmin, Anda dapat menambah paket baru atau menambahkan parameter uji."
                  : "Daftar paket dan parameter acuan dalam program PME (Hanya Superadmin yang dapat menambah)."}
              </p>
            </div>
            {isSuperadmin && (
              <Button onClick={() => setPkgDialogOpen(true)} size="sm" className="bg-teal-700 hover:bg-teal-800 text-white text-xs">
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                Tambah Paket Baru
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5">
            {packages.map((pkg) => (
              <Card key={pkg.id} className="shadow-sm border">
                <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-card border shadow-xs">
                      {getCategoryIcon(pkg.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold">{pkg.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">
                          {pkg.category}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        {pkg.description || "Paket evaluasi laboratorium"}
                      </CardDescription>
                    </div>
                  </div>

                  {isSuperadmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTargetPkgId(pkg.id);
                        setParamDialogOpen(true);
                      }}
                      className="text-xs h-8 border-teal-600/40 text-teal-700 dark:text-teal-300"
                    >
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                      Tambah Parameter
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {pkg.parameters.map((p, pIdx) => (
                      <div
                        key={p.id}
                        className="rounded-lg border bg-card/60 p-2.5 flex items-start justify-between text-xs hover:bg-muted/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground w-4">
                              {pIdx + 1}.
                            </span>
                            <span className="font-semibold text-foreground">{p.name}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
                            {p.unit && <span>Satuan: <strong>{p.unit}</strong></span>}
                            {p.defaultMethodCode && <span>Metode: {p.defaultMethodCode}</span>}
                            {p.defaultInstrumentCode && <span>Alat: {p.defaultInstrumentCode}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Tambah Paket Baru (Superadmin) */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Paket PME Baru</DialogTitle>
            <DialogDescription className="text-xs">
              Buat kategori dan nama paket pemeriksaan baru dalam sistem PME.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePackage} className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Paket Pemeriksaan <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Contoh: Paket Urinalisa Lengkap / Paket Toksikologi"
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kategori Bidang</Label>
              <Select value={pkgCategory} onValueChange={setPkgCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kimia Klinik">Kimia Klinik</SelectItem>
                  <SelectItem value="Hematologi">Hematologi</SelectItem>
                  <SelectItem value="Imunologi">Imunologi</SelectItem>
                  <SelectItem value="Mikrobiologi">Mikrobiologi</SelectItem>
                  <SelectItem value="Urinalisa">Urinalisa</SelectItem>
                  <SelectItem value="Lainnya">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Deskripsi Paket</Label>
              <Textarea
                placeholder="Rincian mengenai program evaluasi paket ini..."
                value={pkgDescription}
                onChange={(e) => setPkgDescription(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setPkgDialogOpen(false)} disabled={savingPkg}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={savingPkg} className="bg-teal-700 hover:bg-teal-800 text-white">
                {savingPkg && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Buat Paket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Tambah Parameter Uji (Superadmin) */}
      <Dialog open={paramDialogOpen} onOpenChange={setParamDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Parameter Pemeriksaan</DialogTitle>
            <DialogDescription className="text-xs">
              Tambahkan parameter uji baru ke dalam paket yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateParameter} className="space-y-3.5 text-xs py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Parameter Pemeriksaan <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Contoh: Glukosa / Hb / Troponin I"
                value={paramName}
                onChange={(e) => setParamName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Satuan Hasil</Label>
                <Input
                  placeholder="mg/dL, g/dL, dll"
                  value={paramUnit}
                  onChange={(e) => setParamUnit(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kode Metode</Label>
                <Input
                  placeholder="Contoh: 041"
                  value={paramMethodCode}
                  onChange={(e) => setParamMethodCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kode Alat</Label>
                <Input
                  placeholder="Contoh: 2202"
                  value={paramInstrumentCode}
                  onChange={(e) => setParamInstrumentCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setParamDialogOpen(false)} disabled={savingParam}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={savingParam} className="bg-teal-700 hover:bg-teal-800 text-white">
                {savingParam && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Tambah Parameter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
