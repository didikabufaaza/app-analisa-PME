"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Loader2, FlaskConical, ScanLine, BrainCircuit, FileBarChart, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { apiSend, ApiError } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import type { UserInfo } from "@/types/pme";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: ScanLine, title: "Ekstraksi Laporan Otomatis", desc: "Membaca dan memproses berkas laporan PME apa pun formatnya: parameter, nilai peserta, target, dan Z-score." },
  { icon: BrainCircuit, title: "Interpretasi & Root Cause", desc: "Analisis klinis: investigasi akar masalah, kemungkinan penyebab, tindakan korektif & preventif." },
  { icon: FileBarChart, title: "Laporan PDF & Excel", desc: "Laporan siap audit dengan executive summary, grafik, dan CAPA." },
  { icon: ShieldCheck, title: "Validasi Sesuai Standar Mutu", desc: "Status akhir dan evaluasi dihitung berdasarkan standar ISO 13528 & Permenkes." },
];

export function LoginView({ onLogin }: { onLogin?: (user: UserInfo) => void }) {
  const setUser = useAppStore((s) => s.setUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await apiSend<{ user: UserInfo }>("/api/auth/login", "POST", { email, password });
        setUser(data.user);
        onLogin?.(data.user);
      } else {
        const data = await apiSend<{ ok: boolean; pendingApproval?: boolean; message?: string; user?: UserInfo }>("/api/auth/register", "POST", {
          name,
          organizationName,
          email,
          password,
        });
        if (data.pendingApproval) {
          setSuccessMessage(data.message || "Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan dari Superadmin.");
          setMode("login");
          setPassword("");
        } else if (data.user) {
          setUser(data.user);
          onLogin?.(data.user);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(kind: "admin" | "analis") {
    setMode("login");
    setEmail(kind === "admin" ? "admin@didikpme.id" : "analis@didikpme.id");
    setPassword("demo1234");
    setError(null);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Brand panel (70% width on desktop, clean background without boxes/grid) */}
      <div className="relative w-full lg:w-[70%] flex flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-950 via-[#072424] to-[#031515] text-white px-8 py-10 lg:px-14 lg:py-12 shrink-0">
        {/* Subtle clean ambient lighting - NO grid lines / NO boxes */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-teal-500/10 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px]" />

        <header className="relative z-10 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur shadow-md">
            <img
              src="/logo.png"
              alt="di-dismartPME Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-2xl font-black tracking-tight text-white">di-dismartPME</p>
            <p className="text-xs font-medium text-teal-200/80">Evaluasi Z-Score & PME Laboratorium</p>
          </div>
        </header>

        <main className="relative z-10 max-w-4xl space-y-8 py-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="bg-teal-400/15 text-teal-100 ring-1 ring-teal-300/30 gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-teal-300" /> Clinical Quality Suite · Didik – Digital Smart PME
            </Badge>
            <h1 className="text-3xl lg:text-5xl font-bold leading-[1.18] tracking-tight max-w-3xl">
              Analisis Pemantapan Mutu Eksternal menjadi{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-teal-300 to-emerald-300">
                otomatis, akurat, dan teraudit.
              </span>
            </h1>
            <p className="text-teal-100/75 leading-relaxed text-sm lg:text-base max-w-2xl">
              Cukup unggah PDF hasil PME laboratorium Anda — sistem memvalidasi dan mengekstrak data
              Z-score secara otomatis, lalu menghasilkan interpretasi klinis, analisis akar masalah,
              CAPA, dan laporan evaluasi mutu siap audit.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-teal-100/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="relative z-10 flex items-center justify-between text-xs text-teal-100/50">
          <span>© {new Date().getFullYear()} di-dismartPME · Clinical Laboratory SaaS</span>
          <span className="hidden sm:inline">ISO 15189 · ISO 13528 · Z-Score Rule Engine</span>
        </footer>
      </div>

      {/* Form panel (30% width on desktop) */}
      <div className="w-full lg:w-[30%] shrink-0 flex items-center justify-center px-6 py-10 lg:px-8 bg-card border-l border-border/40">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Masuk ke akun Anda" : "Buat organisasi baru"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Akses dashboard analisis PME laboratorium Anda."
                : "Daftarkan laboratorium Anda dan mulai analisis PME pertama."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input id="name" placeholder="Dr. Nama Anda" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org">Nama Organisasi / Laboratorium</Label>
                  <Input id="org" placeholder="Laboratorium Klinik ..." value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="nama@laboratorium.id" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "register" ? "Minimal 8 karakter" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {successMessage && (
              <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                {successMessage}
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === "login" ? "Masuk" : "Daftar"}<ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="font-medium text-teal-700 hover:text-teal-800 hover:underline dark:text-teal-400"
            >
              {mode === "login" ? "Daftar organisasi baru" : "Masuk di sini"}
            </button>
          </p>

          <div className="mt-8 rounded-xl border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Akun demo</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("admin")} className={cn("text-xs")}>
                admin@didikpme.id — Administrator
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fillDemo("analis")} className="text-xs">
                analis@didikpme.id — Analis
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Password demo: <code className="rounded bg-muted px-1 py-0.5">demo1234</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
