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
  { icon: ScanLine, title: "Ekstraksi PDF Otomatis", desc: "AI membaca PDF PME apa pun template-nya: parameter, nilai peserta, target, dan Z-score." },
  { icon: BrainCircuit, title: "Interpretasi & Root Cause", desc: "Analisis AI: kemungkinan penyebab, investigasi, tindakan korektif & preventif." },
  { icon: FileBarChart, title: "Laporan PDF & Excel", desc: "Laporan siap audit dengan executive summary, grafik, dan CAPA." },
  { icon: ShieldCheck, title: "Aturan Z-Score Deterministik", desc: "Status akhir ditentukan rule engine backend — bukan oleh AI." },
];

export function LoginView({ onLogin }: { onLogin?: (user: UserInfo) => void }) {
  const setUser = useAppStore((s) => s.setUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const data = await apiSend<{ user: UserInfo }>("/api/auth/login", "POST", { email, password });
        setUser(data.user);
        onLogin?.(data.user);
      } else {
        const data = await apiSend<{ user: UserInfo }>("/api/auth/register", "POST", {
          name,
          organizationName,
          email,
          password,
        });
        setUser(data.user);
        onLogin?.(data.user);
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
      {/* Brand panel */}
      <div className="relative lg:w-[52%] flex flex-col justify-between overflow-hidden bg-teal-950 text-white px-8 py-10 lg:px-14 lg:py-12">
        <div aria-hidden className="absolute inset-0 opacity-[0.14]" style={{
          backgroundImage: "radial-gradient(circle at 18% 22%, #2dd4bf55 0, transparent 42%), radial-gradient(circle at 82% 12%, #99f6e455 0, transparent 38%), radial-gradient(circle at 65% 85%, #0d948866 0, transparent 45%)",
        }} />
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-teal-300/20" />
        <div aria-hidden className="absolute -right-10 top-32 h-64 w-64 rounded-full border border-teal-300/10" />
        <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        <header className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/25 backdrop-blur">
            <FlaskConical className="h-6 w-6 text-teal-200" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">didikpme</p>
            <p className="text-xs text-teal-200/80">PME AI Z-Score Analyzer</p>
          </div>
        </header>

        <main className="relative z-10 max-w-xl space-y-8 py-10">
          <div className="space-y-4">
            <Badge variant="secondary" className="bg-teal-400/15 text-teal-100 ring-1 ring-teal-300/30 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Gemini AI Edition
            </Badge>
            <h1 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.15] tracking-tight">
              Analisis Pemantapan Mutu Eksternal menjadi{" "}
              <span className="text-teal-300">otomatis, akurat, dan teraudit.</span>
            </h1>
            <p className="text-teal-100/70 leading-relaxed">
              Cukup unggah PDF hasil PME laboratorium Anda — AI mengekstrak data, backend memvalidasi
              Z-score secara deterministik, lalu menghasilkan interpretasi, analisis akar masalah,
              CAPA, dan laporan siap audit.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <f.icon className="h-5 w-5 text-teal-300" />
                <p className="mt-2 text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-teal-100/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="relative z-10 flex items-center justify-between text-xs text-teal-100/50">
          <span>© {new Date().getFullYear()} didikpme · Clinical Laboratory SaaS</span>
          <span className="hidden sm:inline">ISO 15189 · Z-Score Rule Engine</span>
        </footer>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-md">
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
