"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Calendar,
  Layers,
  Save,
  Loader2,
  RefreshCw,
  Info,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Lock,
  Sparkles,
  Clock,
  Unlock,
  AlertTriangle,
  Users,
  Search,
  Check,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface PmeConfigData {
  activeCycle: string;
  activePeriod: string | null;
  infoTitle: string | null;
  infoContent: string | null;
  isRegistrationOpen?: boolean;
  infoUpdatedAt?: string;
  infoUpdatedBy?: string;
}

interface ParticipantAccessItem {
  id: string;
  labName: string;
  participantCode: string | null;
  status: string;
  allowExpiredInput: boolean;
  customDeadline: string | null;
}

function toLocalDatetimeString(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PmeInfoView() {
  const { user, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const isSuperadmin = user?.role === "SUPERADMIN";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [activeCycle, setActiveCycle] = useState("Siklus 1 2026");
  const [activePeriod, setActivePeriod] = useState("Tahap 1");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(true);
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [infoTitle, setInfoTitle] = useState("Informasi Resmi Pelaksanaan Program PME");
  const [infoContent, setInfoContent] = useState(
    "Selamat datang di Program Pemantapan Mutu Eksternal (PME). Mohon seluruh laboratorium peserta memastikan pendaftaran, pemilihan paket pemeriksaan, serta pengisian hasil pengujian dilakukan secara teliti sebelum batas akhir yang ditentukan. Pastikan sampel kontrol diperlakukan sama seperti sampel pasien rutin sesuai SOP laboratorium."
  );
  const [runningText, setRunningText] = useState(
    "Selamat datang di Sistem Aplikasi di-dismartPME. Program Pemantapan Mutu Eksternal (PME) Siklus 1 2026 telah dibuka. Silakan masuk dengan akun laboratorium Anda untuk melakukan pendaftaran peserta, pemilihan paket, dan pengisian hasil pemeriksaan."
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  // Participants access management state
  const [participants, setParticipants] = useState<ParticipantAccessItem[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [togglingPartId, setTogglingPartId] = useState<string | null>(null);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [targetParticipant, setTargetParticipant] = useState<ParticipantAccessItem | null>(null);
  const [customDeadlineInput, setCustomDeadlineInput] = useState("");
  const [savingCustomDeadline, setSavingCustomDeadline] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [configRes, partRes] = await Promise.all([
        fetch("/api/pme-mgmt/config", { credentials: "same-origin" }),
        fetch("/api/pme-mgmt/participants", { credentials: "same-origin" }),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        if (data.config) {
          setActiveCycle(data.config.activeCycle || "Siklus 1 2026");
          setActivePeriod(data.config.activePeriod || "Tahap 1");
          if (typeof data.config.isRegistrationOpen === "boolean") {
            setIsRegistrationOpen(data.config.isRegistrationOpen);
          }
          if (typeof data.config.isSubmissionOpen === "boolean") {
            setIsSubmissionOpen(data.config.isSubmissionOpen);
          }
          if (data.config.submissionDeadline) {
            setSubmissionDeadline(toLocalDatetimeString(data.config.submissionDeadline));
          } else {
            setSubmissionDeadline("");
          }
          setInfoTitle(data.config.infoTitle || "Informasi Resmi Pelaksanaan Program PME");
          setInfoContent(data.config.infoContent || "");
          if (data.config.runningText) {
            setRunningText(data.config.runningText);
          }
          setLastUpdated(data.config.infoUpdatedAt || null);
          setUpdatedBy(data.config.infoUpdatedBy || null);
        }
      }

      if (partRes.ok) {
        const pData = await partRes.json();
        setParticipants(pData.participants || []);
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal mengambil data informasi PME", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [viewAsTenantId]);

  const handleToggleExpiredAccess = async (part: ParticipantAccessItem) => {
    setTogglingPartId(part.id);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: part.id,
          action: "toggle_expired",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: data.allowExpiredInput ? "Izin Khusus Diberikan" : "Izin Khusus Dicabut",
          description: data.message,
        });
        fetchConfig();
      } else {
        const err = await res.json();
        toast({ title: "Gagal mengubah izin", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setTogglingPartId(null);
    }
  };

  const handleOpenCustomDeadline = (part: ParticipantAccessItem) => {
    setTargetParticipant(part);
    setCustomDeadlineInput(part.customDeadline ? toLocalDatetimeString(part.customDeadline) : "");
    setDeadlineModalOpen(true);
  };

  const handleSaveCustomDeadline = async () => {
    if (!targetParticipant) return;
    setSavingCustomDeadline(true);
    try {
      const res = await fetch("/api/pme-mgmt/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: targetParticipant.id,
          action: "set_custom_deadline",
          customDeadline: customDeadlineInput ? new Date(customDeadlineInput).toISOString() : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Batas Waktu Khusus Diperbarui",
          description: data.message,
        });
        setDeadlineModalOpen(false);
        fetchConfig();
      } else {
        const err = await res.json();
        toast({ title: "Gagal menyimpan deadline khusus", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", variant: "destructive" });
    } finally {
      setSavingCustomDeadline(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle.trim()) {
      toast({ title: "Validasi Gagal", description: "Siklus PME wajib diisi.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/pme-mgmt/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          activeCycle: activeCycle.trim(),
          activePeriod: activePeriod.trim(),
          isRegistrationOpen,
          isSubmissionOpen,
          submissionDeadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : null,
          infoTitle: infoTitle.trim(),
          infoContent: infoContent.trim(),
          runningText: runningText.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Pengaturan & Informasi Berhasil Disimpan!",
          description:
            "Siklus, status pendaftaran, batas waktu pengisian, dan informasi PME berhasil diperbarui.",
        });
        if (data.config) {
          if (typeof data.config.isRegistrationOpen === "boolean") {
            setIsRegistrationOpen(data.config.isRegistrationOpen);
          }
          if (typeof data.config.isSubmissionOpen === "boolean") {
            setIsSubmissionOpen(data.config.isSubmissionOpen);
          }
          if (data.config.submissionDeadline) {
            setSubmissionDeadline(toLocalDatetimeString(data.config.submissionDeadline));
          } else {
            setSubmissionDeadline("");
          }
          setLastUpdated(data.config.infoUpdatedAt);
          setUpdatedBy(data.config.infoUpdatedBy);
        }
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

  if (!isSuperadmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Akses Khusus Superadmin</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Halaman Pengaturan Siklus & Informasi PME hanya dapat diakses dan diubah oleh akun dengan hak akses Superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Pengaturan Siklus & Informasi PME</h1>
                <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/30 text-[10px] font-bold">
                  SUPERADMIN
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atur siklus PME & periode aktif (otomatis terkunci di form peserta) serta publikasikan pengumuman resmi ke Dashboard peserta.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchConfig} disabled={loading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
        </div>
      </div>

      {/* Info Card Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent border border-teal-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 shrink-0 mt-0.5">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-teal-900 dark:text-teal-200">
              Mekanisme Otomatisasi & Penguncian Form:
            </span>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              Nilai <strong>Siklus PME</strong> dan <strong>Periode/Tahap</strong> yang Anda tentukan di bawah akan langsung terisi secara otomatis dan <strong>dikunci (tidak dapat diedit peserta)</strong> pada formulir:
              (1) Pendaftaran Peserta PME Baru, (2) Pemilihan Paket PME, dan (3) Input Hasil Pengujian PME.
            </p>
          </div>
        </div>
        {lastUpdated && (
          <div className="text-[11px] text-muted-foreground shrink-0 md:text-right">
            Terakhir diubah: {new Date(lastUpdated).toLocaleString("id-ID")}
            {updatedBy && <span className="block font-medium text-teal-600 dark:text-teal-400">Oleh: {updatedBy}</span>}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom 1: Pengaturan Siklus & Periode Aktif */}
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">1. Pengaturan Siklus & Periode Aktif</CardTitle>
                    <CardDescription className="text-xs">
                      Menentukan siklus dan tahap PME yang berlaku saat ini
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300 text-[10px]">
                  Terisi Otomatis
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>
                    Nama / Label Siklus PME <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Contoh: Siklus 1 2026</span>
                </Label>
                <div className="relative">
                  <Input
                    value={activeCycle}
                    onChange={(e) => setActiveCycle(e.target.value)}
                    placeholder="Contoh: Siklus 1 2026 atau 2026-I"
                    required
                    className="h-9 text-xs font-bold text-teal-700 dark:text-teal-300"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  🔒 Tampil otomatis & terkunci di menu: Pendaftaran Peserta, Pemilihan Paket, & Input Hasil PME.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>
                    Periode / Tahap Pemeriksaan <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Contoh: Tahap 1 / Jan - Mar</span>
                </Label>
                <Input
                  value={activePeriod}
                  onChange={(e) => setActivePeriod(e.target.value)}
                  placeholder="Contoh: Tahap 1 atau Periode Januari - Maret 2026"
                  required
                  className="h-9 text-xs font-semibold text-blue-700 dark:text-blue-300"
                />
                <p className="text-[11px] text-muted-foreground">
                  🔒 Tampil otomatis & terkunci di menu: Input Hasil PME Peserta.
                </p>
              </div>

              {/* Tombol Pengaktifan / Penonaktifan Pendaftaran PME */}
              <div className="p-3.5 rounded-xl border bg-slate-50/80 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="registration-toggle" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                        Status Pendaftaran Peserta PME
                      </Label>
                      {isRegistrationOpen ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10.5px] font-semibold">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Pendaftaran Aktif (Dibuka)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10.5px] font-semibold">
                          <Lock className="h-3 w-3 mr-1" />
                          Pendaftaran Nonaktif (Ditutup)
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {isRegistrationOpen ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          ✓ Pendaftaran sedang aktif: Peserta dapat mengklik tombol &quot;Daftar Peserta Baru&quot; di menu Pendaftaran PME.
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          ✕ Pendaftaran dinonaktifkan: Tombol &quot;Daftar Peserta Baru&quot; pada menu Pendaftaran PME menjadi tidak aktif (terkunci).
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Switch
                      id="registration-toggle"
                      checked={isRegistrationOpen}
                      onCheckedChange={setIsRegistrationOpen}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Tombol Pengaktifan / Penonaktifan Pengisian Hasil PME */}
              <div className="p-3.5 rounded-xl border bg-slate-50/80 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="submission-toggle" className="text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer">
                        Status Pengisian Hasil PME Peserta
                      </Label>
                      {isSubmissionOpen ? (
                        <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30 text-[10.5px] font-semibold">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Pengisian Dibuka
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10.5px] font-semibold">
                          <Lock className="h-3 w-3 mr-1" />
                          Pengisian Ditutup
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {isSubmissionOpen ? (
                        <span className="text-teal-700 dark:text-teal-400 font-medium">
                          ✓ Pengisian aktif: Seluruh peserta yang telah mendaftar paket dapat menginput dan mengirimkan hasil pengujian.
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          ✕ Pengisian dinonaktifkan: Formulir input hasil PME terkunci untuk semua peserta (kecuali yang diberi izin khusus).
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Switch
                      id="submission-toggle"
                      checked={isSubmissionOpen}
                      onCheckedChange={setIsSubmissionOpen}
                      className="data-[state=checked]:bg-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Pengaturan Batas Waktu Pengisian (Countdown Timer) */}
              <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span>Batas Akhir Waktu Pengisian PME (Hitung Mundur)</span>
                  </Label>
                  {submissionDeadline ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSubmissionDeadline("")}
                      className="h-6 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 px-2"
                    >
                      <X className="h-3 w-3 mr-1" /> Hapus Batas Waktu
                    </Button>
                  ) : null}
                </div>

                <div className="relative">
                  <Input
                    type="datetime-local"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    className="h-9 text-xs font-semibold font-mono"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ⏱️ Hitung mundur batas waktu ini akan <strong>berjalan mundur secara otomatis</strong> pada formulir login sebelah kiri bagian atas dan di menu Input Hasil PME. Ketika waktu habis, peserta tidak dapat mengisi hasil lagi tanpa izin khusus Superadmin.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-[11.5px]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Dampak Konfigurasi Terhadap Akun Peserta:</span>
                </div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-[11px] pl-1 leading-relaxed">
                  <li>
                    {isRegistrationOpen
                      ? "Pendaftaran terbuka: tombol 'Daftar Peserta Baru' aktif di menu Pendaftaran PME."
                      : "Pendaftaran ditutup: tombol 'Daftar Peserta Baru' terkunci/tidak aktif di menu Pendaftaran PME."}
                  </li>
                  <li>
                    Peserta tidak perlu lagi mengetik siklus secara manual sehingga menghindari salah ketik nama siklus.
                  </li>
                  <li>Semua data peserta dalam satu periode akan terkumpul seragam di bawah satu siklus yang valid.</li>
                  <li>
                    Superadmin dapat mengubah nama siklus kapan saja (misal saat berganti ke Siklus 2 2026).
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Kolom 2: Informasi / Pengumuman PME untuk Dashboard Peserta */}
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                    <Megaphone className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">2. Pengumuman Resmi PME untuk Dashboard</CardTitle>
                    <CardDescription className="text-xs">
                      Informasi ini akan langsung tampil di Dashboard Utama semua akun peserta
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-teal-300 text-teal-700 dark:text-teal-300 text-[10px]">
                  Dashboard Peserta
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Judul Informasi / Pengumuman PME <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={infoTitle}
                  onChange={(e) => setInfoTitle(e.target.value)}
                  placeholder="Contoh: Informasi Pelaksanaan Program PME Siklus 1 Tahun 2026"
                  required
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>
                    Isi Pengumuman / Arahan Teknis PME <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Mendukung paragraf & poin panduan</span>
                </Label>
                <Textarea
                  value={infoContent}
                  onChange={(e) => setInfoContent(e.target.value)}
                  placeholder="Tuliskan jadwal pelaksanaan, batas akhir input hasil, petunjuk pengerjaan sampel kontrol, kontak helpdesk panitia, atau instruksi teknis lainnya..."
                  rows={5}
                  required
                  className="text-xs leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground">
                  💡 Seluruh laboratorium peserta akan melihat kartu informasi ini setiap kali membuka Dashboard Utama.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Kolom 3: Input Teks Berjalan (Running Text) untuk Form Login */}
          <Card className="shadow-sm border lg:col-span-2">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                    <Megaphone className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">3. Teks Berjalan (Running Text) Form Login</CardTitle>
                    <CardDescription className="text-xs">
                      Teks berjalan yang ditampilkan di halaman login sebelah kiri di bawah tulisan &ldquo;di-dismartPME Evaluasi Z-Score & PME Laboratorium&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="border-teal-300 text-teal-700 dark:text-teal-300 text-[10px]">
                  Halaman Login
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>
                    Kalimat Teks Berjalan (Running Text) <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">Tampil bergerak dari kanan ke kiri</span>
                </Label>
                <Textarea
                  value={runningText}
                  onChange={(e) => setRunningText(e.target.value)}
                  placeholder="Contoh: Selamat datang di Sistem Aplikasi di-dismartPME. Program Pemantapan Mutu Eksternal (PME) Siklus 1 2026 telah dibuka..."
                  rows={3}
                  required
                  className="text-xs leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground">
                  💡 Pengunjung dan peserta yang membuka halaman login akan melihat teks berjalan ini secara langsung di bawah logo & nama aplikasi.
                </p>
              </div>

              {/* Live Preview Teks Berjalan Login */}
              <div className="rounded-xl border border-teal-500/30 bg-teal-950/80 p-3.5 shadow-md">
                <div className="text-[11px] font-semibold text-teal-200/80 mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  <span>Pratinjau Teks Berjalan di Halaman Login:</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-teal-400/30 bg-teal-950/90 py-2 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex shrink-0 items-center gap-1.5 pr-2.5 text-[11px] font-bold text-teal-300 border-r border-teal-500/30">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <Megaphone className="h-3.5 w-3.5 text-teal-300 animate-pulse" />
                      <span className="uppercase tracking-wider text-[10px]">PENGUMUMAN</span>
                    </div>
                    <div className="relative flex-1 overflow-hidden">
                      <div className="animate-marquee whitespace-nowrap text-xs text-teal-100 font-medium">
                        {runningText || "Teks berjalan belum diisi."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Card: Pratinjau Tampilan di Dashboard Peserta */}
        <Card className="border border-teal-500/30 bg-teal-50/20 dark:bg-teal-950/10 overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-teal-500/20 bg-teal-500/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider">
                Pratinjau Tampilan di Dashboard Utama Peserta
              </span>
            </div>
            <Badge className="bg-teal-600 text-white text-[10px]">Live Preview</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="rounded-xl border border-teal-500/30 bg-card p-4 sm:p-5 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-teal-700 hover:bg-teal-800 text-white text-[11px] px-2.5 py-0.5 font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      <span>INFORMASI RESMI PME</span>
                    </Badge>
                    <Badge variant="outline" className="border-teal-400/50 text-teal-700 dark:text-teal-300 text-[11px] font-bold">
                      {activeCycle || "Siklus 1 2026"}
                    </Badge>
                    {activePeriod && (
                      <Badge variant="outline" className="border-blue-400/50 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                        {activePeriod}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {infoTitle || "Informasi Pelaksanaan Program PME"}
                  </h3>
                  <div className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed max-w-4xl">
                    {infoContent || "Isi pengumuman resmi dari Superadmin akan ditampilkan di sini."}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end justify-between shrink-0 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-muted">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-teal-600 dark:text-teal-400 font-medium bg-teal-500/10 px-2.5 py-1 rounded-md">
                    <Info className="h-3.5 w-3.5" />
                    Penyelenggara PME Resmi
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-2">
                    Diperbarui secara real-time oleh Superadmin
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Manajemen Hak Akses Pengisian & Perpanjangan Waktu Peserta */}
        <Card className="shadow-sm border">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    4. Manajemen Akses Khusus & Perpanjangan Waktu Peserta
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Berikan izin khusus bypass waktu habis atau tentukan batas waktu pengisian khusus per laboratorium peserta
                  </CardDescription>
                </div>
              </div>

              {/* Search Participant */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari laboratorium atau kode..."
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/50 text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3 w-12 text-center">No.</th>
                    <th className="p-3 w-28">Kode Peserta</th>
                    <th className="p-3 min-w-[200px]">Nama Laboratorium</th>
                    <th className="p-3 w-28 text-center">Status</th>
                    <th className="p-3 w-48 text-center">Izin Bypass Waktu Habis</th>
                    <th className="p-3 min-w-[200px] text-center">Batas Waktu Khusus</th>
                    <th className="p-3 w-36 text-center">Aksi Akses</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {participants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground italic">
                        Belum ada data laboratorium peserta.
                      </td>
                    </tr>
                  ) : (
                    participants
                      .filter(
                        (p) =>
                          p.labName.toLowerCase().includes(partSearch.toLowerCase()) ||
                          (p.participantCode && p.participantCode.toLowerCase().includes(partSearch.toLowerCase()))
                      )
                      .map((p, idx) => {
                        const isToggling = togglingPartId === p.id;
                        const hasCustomDeadline = Boolean(p.customDeadline);

                        return (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-3 font-mono font-semibold text-teal-700 dark:text-teal-400">
                              {p.participantCode || "-"}
                            </td>
                            <td className="p-3 font-semibold text-foreground">{p.labName}</td>
                            <td className="p-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  p.status === "APPROVED"
                                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                    : p.status === "PENDING"
                                    ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                                    : "bg-rose-500/10 text-rose-700 border-rose-500/30"
                                }`}
                              >
                                {p.status === "APPROVED" ? "Disetujui" : p.status === "PENDING" ? "Menunggu" : "Ditolak"}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              {p.allowExpiredInput ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                                  <Unlock className="h-3 w-3" /> Diizinkan
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
                                  <Lock className="h-3 w-3" /> Standar
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {hasCustomDeadline ? (
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[11px]">
                                  {new Date(p.customDeadline!).toLocaleString("id-ID")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">- Ikuti Siklus Global -</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isToggling}
                                  onClick={() => handleToggleExpiredAccess(p)}
                                  className={`h-7 text-[11px] px-2 ${
                                    p.allowExpiredInput
                                      ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {isToggling ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : p.allowExpiredInput ? (
                                    <Lock className="h-3 w-3 mr-1 text-rose-600" />
                                  ) : (
                                    <Unlock className="h-3 w-3 mr-1 text-emerald-600" />
                                  )}
                                  {p.allowExpiredInput ? "Cabut Izin" : "Beri Izin"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenCustomDeadline(p)}
                                  className="h-7 text-[11px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Clock className="h-3 w-3 mr-1" /> Atur Deadline
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

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={saving}
            size="lg"
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-md px-6"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan Perubahan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Simpan Siklus & Informasi PME
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Dialog Modal Atur Batas Waktu Khusus Peserta */}
      <Dialog open={deadlineModalOpen} onOpenChange={setDeadlineModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-blue-600">
              <Clock className="h-4.5 w-4.5" />
              <span>Atur Batas Waktu Khusus Peserta</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Tentukan perpanjangan batas akhir pengisian hasil PME khusus untuk laboratorium{" "}
              <strong className="text-foreground">{targetParticipant?.labName}</strong> (
              {targetParticipant?.participantCode || "-"}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Batas Waktu Pengisian Khusus</Label>
              <Input
                type="datetime-local"
                value={customDeadlineInput}
                onChange={(e) => setCustomDeadlineInput(e.target.value)}
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Jika dikosongkan, laboratorium peserta ini akan kembali mengikuti batas waktu siklus global.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {customDeadlineInput ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomDeadlineInput("")}
                className="text-xs text-red-600 border-red-300 hover:bg-red-50"
              >
                Reset ke Global
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeadlineModalOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingCustomDeadline}
              onClick={handleSaveCustomDeadline}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {savingCustomDeadline ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Simpan Batas Waktu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
