"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilePenLine,
  Send,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  PackageCheck,
  Zap,
  Clock,
  Check,
  AlertTriangle,
} from "lucide-react";

interface ParameterRow {
  id: string;
  name: string;
  unit: string | null;
  packageName: string;
  defaultMethodCode: string | null;
  defaultInstrumentCode: string | null;
  sortOrder: number;
  value: string;
  methodCode: string;
  instrumentCode: string;
  reagentName: string;
}

interface ParticipantOption {
  id: string;
  labName: string;
  participantCode: string | null;
  cycle?: string | null;
  status: string; // "PENDING" | "APPROVED" | "REJECTED"
}

export function PmeInputView() {
  const { user, navigate, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<string>("Siklus 1 2026");
  const [period, setPeriod] = useState<string>("Tahap 2");

  const [loading, setLoading] = useState(false);
  const [registeredPackages, setRegisteredPackages] = useState<{ id: string; name: string; category: string }[]>([]);
  const [parameters, setParameters] = useState<ParameterRow[]>([]);
  const [hasNoPackages, setHasNoPackages] = useState(false);
  const [isNotApproved, setIsNotApproved] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvingParticipant, setApprovingParticipant] = useState(false);
  const [isSubmittedBefore, setIsSubmittedBefore] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Quick Batch Fill Helper (Untuk mempercepat pengisian alat & metode yang sama)
  const [batchMethod, setBatchMethod] = useState("");
  const [batchInstrument, setBatchInstrument] = useState("");
  const [batchReagent, setBatchReagent] = useState("");

  // Load participants list
  useEffect(() => {
    fetch("/api/pme-mgmt/participants", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { participants: [] }))
      .then((data) => {
        setParticipants(data.participants || []);
        if (data.participants && data.participants.length > 0 && !selectedParticipantId) {
          setSelectedParticipantId(data.participants[0].id);
          if (data.participants[0].cycle) {
            setSelectedCycle(data.participants[0].cycle);
          }
        }
      })
      .catch(() => undefined);
  }, [viewAsTenantId]);

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
          description: "Laboratorium disetujui. Memuat formulir hasil PME...",
        });
        const pRes = await fetch("/api/pme-mgmt/participants", { credentials: "same-origin" });
        if (pRes.ok) {
          const pData = await pRes.json();
          setParticipants(pData.participants || []);
        }
        await loadParticipantParams();
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

  // Load parameters for selected participant & cycle
  const loadParticipantParams = async () => {
    if (!selectedParticipantId) return;
    setLoading(true);
    setHasNoPackages(false);
    setIsNotApproved(false);
    setApprovalMessage("");

    try {
      const res = await fetch(
        `/api/pme-mgmt/submissions?participantId=${selectedParticipantId}&cycle=${encodeURIComponent(selectedCycle)}`,
        { credentials: "same-origin" }
      );

      if (res.ok) {
        const data = await res.json();

        // Cek apakah laboratorium belum disetujui oleh Superadmin
        if (data.isApproved === false) {
          setIsNotApproved(true);
          setApprovalMessage(data.message || "Pendaftaran laboratorium ini belum disetujui oleh Superadmin.");
          setRegisteredPackages([]);
          setParameters([]);
          setIsSubmittedBefore(false);
          return;
        }

        setRegisteredPackages(data.registeredPackages || []);

        if (!data.registeredPackages || data.registeredPackages.length === 0) {
          setHasNoPackages(true);
          setParameters([]);
          setIsSubmittedBefore(false);
          return;
        }

        // Map parameters with existing submission results if already submitted
        const existingResults = data.submission?.results || [];
        setIsSubmittedBefore(Boolean(data.submission));
        setLastSubmittedAt(data.submission?.submittedAt || null);

        const rows: ParameterRow[] = (data.parameters || []).map((p: any) => {
          const matchedResult = existingResults.find(
            (r: any) => r.parameterName.toLowerCase().trim() === p.name.toLowerCase().trim()
          );

          return {
            id: p.id,
            name: p.name,
            unit: p.unit,
            packageName: p.packageName,
            defaultMethodCode: p.defaultMethodCode,
            defaultInstrumentCode: p.defaultInstrumentCode,
            sortOrder: p.sortOrder,
            value: matchedResult && matchedResult.value !== null ? String(matchedResult.value) : "",
            methodCode: matchedResult?.methodCode || p.defaultMethodCode || "",
            instrumentCode: matchedResult?.instrumentCode || p.defaultInstrumentCode || "",
            reagentName: matchedResult?.reagentName || "",
          };
        });

        setParameters(rows);
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat formulir", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal memuat parameter", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedParticipantId && selectedCycle) {
      loadParticipantParams();
    }
  }, [selectedParticipantId, selectedCycle]);

  const handleRowChange = (index: number, field: keyof ParameterRow, value: string) => {
    setParameters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleApplyBatch = () => {
    if (!batchMethod && !batchInstrument && !batchReagent) {
      toast({ title: "Isi template seragam terlebih dahulu." });
      return;
    }
    setParameters((prev) =>
      prev.map((row) => ({
        ...row,
        methodCode: batchMethod ? batchMethod : row.methodCode,
        instrumentCode: batchInstrument ? batchInstrument : row.instrumentCode,
        reagentName: batchReagent ? batchReagent : row.reagentName,
      }))
    );
    toast({ title: "Template seragam diterapkan ke seluruh baris parameter." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filledRows = parameters.filter((p) => p.value.trim() !== "");
    if (filledRows.length === 0) {
      toast({
        title: "Hasil Masih Kosong",
        description: "Silakan isi minimal satu nilai hasil pemeriksaan sebelum mengirim.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        participantId: selectedParticipantId,
        cycle: selectedCycle.trim(),
        period: period.trim() || undefined,
        results: parameters
          .filter((p) => p.value.trim() !== "")
          .map((p) => ({
            parameterId: p.id,
            parameterName: p.name,
            unit: p.unit,
            value: parseFloat(p.value.replace(/,/g, ".")),
            methodCode: p.methodCode,
            instrumentCode: p.instrumentCode,
            reagentName: p.reagentName,
          })),
      };

      const res = await fetch("/api/pme-mgmt/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Hasil PME Berhasil Dikirim!",
          description: data.message || "Data telah tersimpan di sistem.",
        });
        setIsSubmittedBefore(true);
        setLastSubmittedAt(new Date().toISOString());
      } else {
        const err = await res.json();
        toast({ title: "Gagal mengirim hasil", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal mengirim", description: "Terjadi kesalahan sistem.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filledCount = parameters.filter((p) => p.value.trim() !== "").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <FilePenLine className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Input Hasil PME Peserta</h1>
              <p className="text-xs text-muted-foreground">
                Pengisian hasil pengujian peserta (Hasil, Metode, Alat, dan Reagen) otomatis disesuaikan dengan paket yang dipilih
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "SUPERADMIN" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("pme-reports")}
              className="text-xs border-teal-600/40 text-teal-800 dark:text-teal-300"
            >
              Lihat Laporan Hasil PME
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadParticipantParams} disabled={loading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
        </div>
      </div>

      {/* Participant & Cycle Selector Card */}
      <Card className="shadow-sm border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-teal-600" />
                <span>Pilih Laboratorium Peserta</span>
              </Label>
              <Select value={selectedParticipantId} onValueChange={handleSelectParticipant}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih Laboratorium..." />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.participantCode ? `[${p.participantCode}] ` : ""}
                      {p.labName} {p.status === "APPROVED" ? "✓ (Disetujui)" : p.status === "PENDING" ? "⏳ (Menunggu Persetujuan)" : "✗ (Ditolak)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>Siklus PME</span>
              </Label>
              <Input
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                placeholder="Contoh: Siklus 1 2026"
                className="h-9 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Periode / Tahap</Label>
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Contoh: Tahap 2 / Periode November"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Active Registered Packages Indicator */}
          {registeredPackages.length > 0 && (
            <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Paket Terdaftar:</span>
                {registeredPackages.map((pkg) => (
                  <Badge key={pkg.id} variant="outline" className="bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/30 text-xs">
                    {pkg.name} ({pkg.category})
                  </Badge>
                ))}
              </div>

              {isSubmittedBefore && (
                <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Sudah Terkirim {lastSubmittedAt ? `(${new Date(lastSubmittedAt).toLocaleDateString("id-ID")})` : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case 0: Participant Is NOT Approved by Superadmin */}
      {isNotApproved && (
        <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Pendaftaran Laboratorium Belum Disetujui
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {approvalMessage ||
                "Laboratorium ini berstatus 'Menunggu Persetujuan Superadmin'. Pengisian dan pengiriman hasil pengujian PME baru dapat dilakukan setelah pendaftaran disetujui oleh Superadmin."}
            </p>
            {user?.role === "SUPERADMIN" && (
              <div className="pt-2">
                <Button
                  disabled={approvingParticipant}
                  onClick={() => handleApproveParticipant(selectedParticipantId)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
                >
                  {approvingParticipant ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-4 w-4" />
                  )}
                  Setujui Pendaftaran Laboratorium Ini
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Case 1: Participant Has NOT Registered Any Packages */}
      {!isNotApproved && hasNoPackages && (
        <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Peserta Belum Memilih Paket PME pada {selectedCycle}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Sistem secara otomatis membatasi formulir input hanya untuk parameter dari paket yang telah didaftarkan oleh peserta. Silakan pilih paket terlebih dahulu.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => navigate("pme-packages")}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                <PackageCheck className="mr-1.5 h-4 w-4" />
                Pilih Paket PME Sekarang
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case 2: Form Input Hasil Parameters */}
      {!isNotApproved && !hasNoPackages && parameters.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Helper Banner */}
          <Card className="shadow-xs border bg-muted/20">
            <CardContent className="p-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-foreground">Penerapan Seragam:</span>
                  <span className="hidden sm:inline">Terapkan kode alat/metode/reagen yang sama ke semua parameter:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Kode Metode (cth: 041)"
                    value={batchMethod}
                    onChange={(e) => setBatchMethod(e.target.value)}
                    className="h-7 w-32 text-[11px] font-mono"
                  />
                  <Input
                    placeholder="Kode Alat (cth: 2202)"
                    value={batchInstrument}
                    onChange={(e) => setBatchInstrument(e.target.value)}
                    className="h-7 w-32 text-[11px] font-mono"
                  />
                  <Input
                    placeholder="Nama Reagen"
                    value={batchReagent}
                    onChange={(e) => setBatchReagent(e.target.value)}
                    className="h-7 w-36 text-[11px]"
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={handleApplyBatch} className="h-7 text-[11px]">
                    Terapkan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Input Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Tabel Input Hasil Pemeriksaan</CardTitle>
                <CardDescription className="text-xs">
                  Masukkan nilai numerik hasil uji laboratorium, kode metode, kode alat, dan nama reagen
                </CardDescription>
              </div>
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full font-mono">
                {filledCount} / {parameters.length} Parameter Terisi
              </span>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 w-12 text-center">No.</th>
                      <th className="p-2.5 min-w-[160px]">Sasaran / Parameter</th>
                      <th className="p-2.5 w-24">Satuan</th>
                      <th className="p-2.5 w-36 text-center">
                        Hasil Uji <span className="text-red-500">*</span>
                      </th>
                      <th className="p-2.5 w-32 text-center">Kode / Nama Metode</th>
                      <th className="p-2.5 w-32 text-center">Kode / Nama Alat</th>
                      <th className="p-2.5 min-w-[180px]">Nama Reagen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parameters.map((param, idx) => (
                      <tr key={param.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-semibold text-foreground">{param.name}</p>
                          <span className="text-[10px] text-muted-foreground">{param.packageName}</span>
                        </td>
                        <td className="p-2.5 font-mono text-muted-foreground">
                          {param.unit ? (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {param.unit}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                        {/* Kolom Hasil */}
                        <td className="p-2 text-center">
                          <Input
                            type="text"
                            placeholder="0.00"
                            value={param.value}
                            onChange={(e) => handleRowChange(idx, "value", e.target.value)}
                            className="h-8 text-center font-mono font-bold text-xs bg-background focus:ring-1 focus:ring-teal-600"
                          />
                        </td>
                        {/* Kolom Metode */}
                        <td className="p-2 text-center">
                          <Input
                            placeholder={param.defaultMethodCode || "Metode"}
                            value={param.methodCode}
                            onChange={(e) => handleRowChange(idx, "methodCode", e.target.value)}
                            className="h-8 text-center font-mono text-xs bg-background"
                          />
                        </td>
                        {/* Kolom Alat */}
                        <td className="p-2 text-center">
                          <Input
                            placeholder={param.defaultInstrumentCode || "Alat"}
                            value={param.instrumentCode}
                            onChange={(e) => handleRowChange(idx, "instrumentCode", e.target.value)}
                            className="h-8 text-center font-mono text-xs bg-background"
                          />
                        </td>
                        {/* Kolom Nama Reagen */}
                        <td className="p-2">
                          <Input
                            placeholder="Merk / Nama Reagen yang digunakan"
                            value={param.reagentName}
                            onChange={(e) => handleRowChange(idx, "reagentName", e.target.value)}
                            className="h-8 text-xs bg-background"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              Pastikan seluruh nilai hasil pemeriksaan telah diperiksa dengan teliti sebelum menekan tombol Kirim.
            </div>
            <Button
              type="submit"
              disabled={submitting || filledCount === 0}
              className="bg-teal-700 hover:bg-teal-800 text-white px-6 text-xs h-9 shadow-sm"
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Kirim Hasil PME
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
