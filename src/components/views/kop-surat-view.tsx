"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  FileSignature,
  ImageIcon,
  Sparkles,
  Info,
  RotateCcw,
} from "lucide-react";
import { apiGet, apiSend } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";

interface KopSuratData {
  id?: string;
  organizationId?: string;
  logoKiri: string | null;
  logoKanan: string | null;
  pemda: string;
  namaRumahSakit: string;
  alamatRumahSakit: string;
  kontakRumahSakit: string;
}

// Helper to optimize image size to clean base64 data URL
async function optimizeImage(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Use PNG to preserve transparency
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function KopSuratView() {
  const { toast } = useToast();
  const { user } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [logoKiri, setLogoKiri] = useState<string | null>(null);
  const [logoKanan, setLogoKanan] = useState<string | null>(null);
  const [pemda, setPemda] = useState("");
  const [namaRumahSakit, setNamaRumahSakit] = useState("");
  const [alamatRumahSakit, setAlamatRumahSakit] = useState("");
  const [kontakRumahSakit, setKontakRumahSakit] = useState("");

  const logoKiriInputRef = useRef<HTMLInputElement>(null);
  const logoKananInputRef = useRef<HTMLInputElement>(null);

  // Load existing tenant kop surat
  useEffect(() => {
    let cancelled = false;
    const fetchKopSurat = async () => {
      setLoading(true);
      try {
        const res = await apiGet<{
          organization: { id: string; name: string };
          kopSurat: KopSuratData;
        }>("/api/kop-surat");

        if (!cancelled && res) {
          setOrgName(res.organization?.name || "");
          const k = res.kopSurat;
          setLogoKiri(k.logoKiri || null);
          setLogoKanan(k.logoKanan || null);
          setPemda(k.pemda || "");
          setNamaRumahSakit(k.namaRumahSakit || res.organization?.name || "");
          setAlamatRumahSakit(k.alamatRumahSakit || "");
          setKontakRumahSakit(k.kontakRumahSakit || "");
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Gagal Memuat Kop Surat",
            description: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data kop surat.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchKopSurat();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Handle Logo Kiri Upload
  const handleLogoKiriChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Berkas Tidak Valid",
        description: "Harap unggah berkas gambar (PNG, JPG, JPEG, WEBP, atau SVG).",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await optimizeImage(file);
      setLogoKiri(dataUrl);
      toast({
        title: "Logo Kiri Dipilih",
        description: "Logo kiri berhasil dimuat. Jangan lupa klik 'Simpan Kop Surat'.",
      });
    } catch {
      toast({
        title: "Gagal Memproses Gambar",
        description: "Tidak dapat memproses berkas gambar yang dipilih.",
        variant: "destructive",
      });
    }
  };

  // Handle Logo Kanan Upload
  const handleLogoKananChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Berkas Tidak Valid",
        description: "Harap unggah berkas gambar (PNG, JPG, JPEG, WEBP, atau SVG).",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataUrl = await optimizeImage(file);
      setLogoKanan(dataUrl);
      toast({
        title: "Logo Kanan Dipilih",
        description: "Logo kanan berhasil dimuat. Jangan lupa klik 'Simpan Kop Surat'.",
      });
    } catch {
      toast({
        title: "Gagal Memproses Gambar",
        description: "Tidak dapat memproses berkas gambar yang dipilih.",
        variant: "destructive",
      });
    }
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: KopSuratData = {
        logoKiri,
        logoKanan,
        pemda,
        namaRumahSakit,
        alamatRumahSakit,
        kontakRumahSakit,
      };

      const res = await apiSend<{ success: boolean; message: string; kopSurat: KopSuratData }>(
        "/api/kop-surat",
        "POST",
        payload
      );

      toast({
        title: "Kop Surat Berhasil Disimpan",
        description: res.message || "Pengaturan kop surat untuk organisasi Anda telah tersimpan secara privat.",
      });
    } catch (err) {
      toast({
        title: "Gagal Menyimpan Kop Surat",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data kop surat.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[420px] w-full rounded-xl" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-teal-700 dark:text-teal-400" />
            <h2 className="text-xl font-bold tracking-tight">Pengaturan Kop Surat Laboratorium</h2>
            <Badge variant="outline" className="bg-teal-50 text-teal-800 dark:text-teal-300 border-teal-300 text-xs">
              Tenant Privat
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Konfigurasi logo kiri & kanan serta 4 kolom identitas resmi instansi untuk keperluan laporan dan surat evaluasi mutu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 font-medium text-xs">
            🏢 {orgName || user?.organization?.name || "Organisasi"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* FORM INPUT & UPLOAD (Left Column - 6 cols) */}
        <div className="xl:col-span-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Card 1: Logo Kanan & Kiri */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-teal-700" />
                  Upload Logo Instansi (Kiri & Kanan)
                </CardTitle>
                <CardDescription className="text-xs">
                  Unggah logo resmi instansi (format PNG/JPG transparan disarankan). Data disimpan secara privat per-organisasi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Logo Kiri */}
                  <div className="rounded-lg border border-dashed p-4 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                    <p className="text-xs font-semibold text-foreground mb-2">Logo Kiri (Pemda / Lab)</p>
                    {logoKiri ? (
                      <div className="relative group flex flex-col items-center">
                        <div className="h-24 w-24 rounded-md border bg-white p-2 flex items-center justify-center shadow-xs">
                          <img src={logoKiri} alt="Logo Kiri" className="h-full w-full object-contain" />
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoKiriInputRef.current?.click()}
                            className="h-7 text-xs px-2"
                          >
                            Ganti
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setLogoKiri(null)}
                            className="h-7 text-xs px-2"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => logoKiriInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center py-4 px-2 w-full"
                      >
                        <div className="h-12 w-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-700 mb-2">
                          <Upload className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium text-teal-800 dark:text-teal-300">Pilih Berkas Logo Kiri</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">PNG / JPG (Maks 2MB)</span>
                      </div>
                    )}
                    <input
                      ref={logoKiriInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoKiriChange}
                      className="hidden"
                    />
                  </div>

                  {/* Logo Kanan */}
                  <div className="rounded-lg border border-dashed p-4 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                    <p className="text-xs font-semibold text-foreground mb-2">Logo Kanan (Rumah Sakit / KARS)</p>
                    {logoKanan ? (
                      <div className="relative group flex flex-col items-center">
                        <div className="h-24 w-24 rounded-md border bg-white p-2 flex items-center justify-center shadow-xs">
                          <img src={logoKanan} alt="Logo Kanan" className="h-full w-full object-contain" />
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoKananInputRef.current?.click()}
                            className="h-7 text-xs px-2"
                          >
                            Ganti
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setLogoKanan(null)}
                            className="h-7 text-xs px-2"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => logoKananInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center py-4 px-2 w-full"
                      >
                        <div className="h-12 w-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-700 mb-2">
                          <Upload className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium text-teal-800 dark:text-teal-300">Pilih Berkas Logo Kanan</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">PNG / JPG (Maks 2MB)</span>
                      </div>
                    )}
                    <input
                      ref={logoKananInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoKananChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: 4 Kolom Input Teks Kop Surat */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-teal-700" />
                  4 Kolom Identitas Kop Surat
                </CardTitle>
                <CardDescription className="text-xs">
                  Masukkan teks baris kop surat secara terperinci. Pratinjau di sebelah kanan akan berubah seketika.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Kolom 1: Pemda */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kolom-pemda" className="text-xs font-semibold">
                      1. Kolom Pemda / Instansi Induk / Dinas
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Baris Pertama</span>
                  </div>
                  <Input
                    id="kolom-pemda"
                    value={pemda}
                    onChange={(e) => setPemda(e.target.value)}
                    placeholder="Contoh: PEMERINTAH PROVINSI JAWA TIMUR / DINAS KESEHATAN"
                    className="text-xs h-9 font-medium"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Contoh: <em>PEMERINTAH KABUPATEN BANDUNG / DINAS KESEHATAN</em>
                  </p>
                </div>

                {/* Kolom 2: Nama Rumah Sakit / Laboratorium */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kolom-rs" className="text-xs font-semibold">
                      2. Kolom Nama Rumah Sakit / Laboratorium
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-bold text-teal-700">Teks Utama Tebal</span>
                  </div>
                  <Input
                    id="kolom-rs"
                    value={namaRumahSakit}
                    onChange={(e) => setNamaRumahSakit(e.target.value)}
                    placeholder="Contoh: RUMAH SAKIT UMUM DAERAH DR. SOETOMO"
                    className="text-xs h-9 font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Nama resmi rumah sakit atau laboratorium klinik peserta.
                  </p>
                </div>

                {/* Kolom 3: Alamat Rumah Sakit */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kolom-alamat" className="text-xs font-semibold">
                      3. Kolom Alamat Rumah Sakit / Laboratorium
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Baris Ketiga</span>
                  </div>
                  <Input
                    id="kolom-alamat"
                    value={alamatRumahSakit}
                    onChange={(e) => setAlamatRumahSakit(e.target.value)}
                    placeholder="Contoh: Jl. Mayjen Prof. Dr. Moestopo No. 6-8, Surabaya 60286"
                    className="text-xs h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Alamat jalan, nomor, kelurahan, kecamatan, kota/kabupaten dan kode pos.
                  </p>
                </div>

                {/* Kolom 4: Telepon & Email Rumah Sakit */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kolom-kontak" className="text-xs font-semibold">
                      4. Kolom Telepon & Email Rumah Sakit
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Baris Keempat</span>
                  </div>
                  <Input
                    id="kolom-kontak"
                    value={kontakRumahSakit}
                    onChange={(e) => setKontakRumahSakit(e.target.value)}
                    placeholder="Contoh: Telp: (031) 5501078 | Fax: (031) 5501111 | Email: lab@rsud.go.id"
                    className="text-xs h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Nomor telepon kontak, faksimili, alamat email laboratorium, dan website resmi.
                  </p>
                </div>

                {/* Tombol Aksi Simpan */}
                <div className="pt-3 flex items-center justify-end gap-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPemda("");
                      setNamaRumahSakit(orgName || "");
                      setAlamatRumahSakit("");
                      setKontakRumahSakit("");
                    }}
                    className="text-xs h-9"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Reset Teks
                  </Button>

                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-9 px-4 font-semibold"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {saving ? "Menyimpan Data..." : "Simpan Kop Surat"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* LIVE VISUAL PREVIEW (Right Column - 6 cols) */}
        <div className="xl:col-span-6 space-y-4">
          <Card className="border-teal-500/30">
            <CardHeader className="pb-3 border-b bg-teal-500/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-teal-950 dark:text-teal-100">
                  <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                  Pratinjau Nyata Kop Surat Resmi (A4 Mockup)
                </CardTitle>
                <Badge variant="outline" className="bg-white text-[10px] text-teal-800">
                  Live Preview
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Tampilan kop surat ini adalah representasi visual yang akan muncul pada laporan cetak resmi.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 bg-slate-100 dark:bg-zinc-950">
              {/* Paper Sheet Mockup */}
              <div className="bg-white text-slate-900 rounded-lg p-5 sm:p-6 shadow-md border border-slate-200">
                {/* Header Kop Area */}
                <div className="flex items-center justify-between gap-3">
                  {/* Logo Kiri */}
                  <div className="w-16 sm:w-20 shrink-0 flex items-center justify-center">
                    {logoKiri ? (
                      <img
                        src={logoKiri}
                        alt="Logo Kiri"
                        className="max-h-16 sm:max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-md border border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] text-slate-400 text-center p-1">
                        <ImageIcon className="h-4 w-4 mb-0.5 opacity-50" />
                        Logo Kiri
                      </div>
                    )}
                  </div>

                  {/* Center Text (4 Kolom) */}
                  <div className="flex-1 text-center px-1 sm:px-2 space-y-0.5">
                    {/* Kolom 1: Pemda */}
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {pemda || "PEMERINTAH PROVINSI / KABUPATEN ..."}
                    </p>

                    {/* Kolom 2: Nama Rumah Sakit / Laboratorium */}
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 leading-tight">
                      {namaRumahSakit || orgName || "RUMAH SAKIT UMUM DAERAH ..."}
                    </h3>

                    {/* Kolom 3: Alamat */}
                    <p className="text-[9.5px] sm:text-[11px] text-slate-600 font-normal leading-tight">
                      {alamatRumahSakit || "Jl. Alamat Rumah Sakit No. 00, Kota / Kabupaten, Kode Pos 00000"}
                    </p>

                    {/* Kolom 4: Telepon & Email */}
                    <p className="text-[8.5px] sm:text-[10px] text-slate-500 font-normal leading-tight">
                      {kontakRumahSakit || "Telepon: (000) 000000 | Email: laboratorium@rsud.go.id"}
                    </p>
                  </div>

                  {/* Logo Kanan */}
                  <div className="w-16 sm:w-20 shrink-0 flex items-center justify-center">
                    {logoKanan ? (
                      <img
                        src={logoKanan}
                        alt="Logo Kanan"
                        className="max-h-16 sm:max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-md border border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] text-slate-400 text-center p-1">
                        <ImageIcon className="h-4 w-4 mb-0.5 opacity-50" />
                        Logo Kanan
                      </div>
                    )}
                  </div>
                </div>

                {/* Classic Double-Line Divider (Garis Tebal Atas, Garis Tipis Bawah) */}
                <div className="mt-3.5 space-y-0.5">
                  <div className="border-t-[2.5px] border-slate-900" />
                  <div className="border-t-[0.8px] border-slate-900" />
                </div>

                {/* Mockup Document Body Content Placeholder */}
                <div className="mt-6 space-y-3 opacity-60">
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-800 underline">
                      LAPORAN EVALUASI PEMANTAPAN MUTU EKSTERNAL (PME)
                    </p>
                    <p className="text-[10px] text-slate-600">Nomor: PME/LAB/{new Date().getFullYear()}/001</p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="h-2.5 bg-slate-200 rounded-sm w-3/4" />
                    <div className="h-2.5 bg-slate-200 rounded-sm w-full" />
                    <div className="h-2.5 bg-slate-200 rounded-sm w-5/6" />
                  </div>

                  <div className="border rounded p-3 text-[10px] text-slate-500 bg-slate-50/50 flex items-center justify-between">
                    <span>Ringkasan Evaluasi Parameter Z-Score</span>
                    <span className="font-mono font-semibold text-emerald-700">MEMUASKAN</span>
                  </div>
                </div>
              </div>

              {/* Info Tips */}
              <div className="mt-4 rounded-lg bg-teal-500/10 border border-teal-500/20 p-3 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Informasi Multi-Tenant Privat:</p>
                  <p className="text-[11px] text-teal-800/80 dark:text-teal-200/80">
                    Setiap akun organisasi memiliki ruang penyimpanan kop surat tersendiri. Pengaturan kop surat organisasi lain tidak akan tertukar atau terpengaruh.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
