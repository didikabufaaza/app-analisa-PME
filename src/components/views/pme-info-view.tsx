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
  FileText,
  Sparkles,
} from "lucide-react";

interface PmeConfigData {
  activeCycle: string;
  activePeriod: string | null;
  infoTitle: string | null;
  infoContent: string | null;
  infoUpdatedAt?: string;
  infoUpdatedBy?: string;
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
  const [infoTitle, setInfoTitle] = useState("Informasi Resmi Pelaksanaan Program PME");
  const [infoContent, setInfoContent] = useState(
    "Selamat datang di Program Pemantapan Mutu Eksternal (PME). Mohon seluruh laboratorium peserta memastikan pendaftaran, pemilihan paket pemeriksaan, serta pengisian hasil pengujian dilakukan secara teliti sebelum batas akhir yang ditentukan. Pastikan sampel kontrol diperlakukan sama seperti sampel pasien rutin sesuai SOP laboratorium."
  );
  const [runningText, setRunningText] = useState(
    "Selamat datang di Sistem Aplikasi di-dismartPME. Program Pemantapan Mutu Eksternal (PME) Siklus 1 2026 telah dibuka. Silakan masuk dengan akun laboratorium Anda untuk melakukan pendaftaran peserta, pemilihan paket, dan pengisian hasil pemeriksaan."
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pme-mgmt/config", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setActiveCycle(data.config.activeCycle || "Siklus 1 2026");
          setActivePeriod(data.config.activePeriod || "Tahap 1");
          setInfoTitle(data.config.infoTitle || "Informasi Resmi Pelaksanaan Program PME");
          setInfoContent(data.config.infoContent || "");
          if (data.config.runningText) {
            setRunningText(data.config.runningText);
          }
          setLastUpdated(data.config.infoUpdatedAt || null);
          setUpdatedBy(data.config.infoUpdatedBy || null);
        }
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat konfigurasi", description: err.error, variant: "destructive" });
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
            "Siklus dan informasi PME berhasil diperbarui. Form peserta dan Dashboard otomatis menampilkan data terbaru.",
        });
        if (data.config) {
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

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 text-[11.5px]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Dampak Konfigurasi Terhadap Akun Peserta:</span>
                </div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-[11px] pl-1 leading-relaxed">
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
    </div>
  );
}
