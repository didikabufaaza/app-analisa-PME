"use client";

import { useEffect, useState } from "react";
import { useAppStore, type AppView } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  ClipboardCheck,
  ListChecks,
  Settings,
  ScrollText,
  Users,
  FlaskConical,
  LogOut,
  Menu,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Eye,
  Building2,
  FolderKanban,
  UserPlus,
  PackageCheck,
  FilePenLine,
  FileBarChart,
} from "lucide-react";
import type { TenantOption } from "@/types/pme";
import { useIdleLogout } from "@/hooks/use-idle-logout";

const NAV: { key: AppView; label: string; icon: typeof LayoutDashboard; superAdminOnly?: boolean }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "sessions", label: "Sesi PME", icon: FileText },
  { key: "reports", label: "Laporan", icon: FileSpreadsheet },
  { key: "review", label: "Review Center", icon: ClipboardCheck },
  { key: "capa", label: "CAPA", icon: ListChecks },
  { key: "kop-surat", label: "Kop Surat", icon: Building2 },
  { key: "settings", label: "Pengaturan", icon: Settings },
  { key: "audit", label: "Log Audit", icon: ScrollText },
  { key: "users", label: "Pengaturan User", icon: Users, superAdminOnly: true },
];

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Dashboard",
  sessions: "Sesi PME",
  "session-detail": "Detail Sesi PME",
  reports: "Laporan Lengkap & Evaluasi Mutu",
  review: "Pusat Verifikasi Data",
  capa: "Tindakan Korektif & Preventif (CAPA)",
  "kop-surat": "Pengaturan Kop Surat Laboratorium",
  settings: "Pengaturan",
  audit: "Log Audit",
  users: "Pengaturan Pengguna & Hak Akses",
  "pme-registration": "Pendaftaran Peserta PME",
  "pme-packages": "Pemilihan Paket PME",
  "pme-input": "Input Hasil PME Peserta",
  "pme-reports": "Laporan Hasil PME (Superadmin)",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, view, navigate, sidebarOpen, setSidebarOpen, refreshUser, viewAsTenantId, setViewAsTenantId } = useAppStore();
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  // Aktifkan auto-logout ketika tidak ada aktivitas selama 3 menit
  useIdleLogout();

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.user?.aiUsage) setUsage(data.user.aiUsage);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user?.id]);

  // Load tenants list for Superadmin switcher
  useEffect(() => {
    if (user?.role === "SUPERADMIN") {
      fetch("/api/admin/tenants")
        .then((res) => (res.ok ? res.json() : { tenants: [] }))
        .then((data) => setTenants(data.tenants || []))
        .catch(() => undefined);
    }
  }, [user?.role]);

  if (!user) return null;

  const usagePct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  // Filter navigation items by checklist permissions or role
  const filteredNav = NAV.filter((item) => {
    if (item.superAdminOnly && user.role !== "SUPERADMIN") return false;
    if (user.role === "SUPERADMIN") return true;
    if (user.menuAccess && Array.isArray(user.menuAccess) && user.menuAccess.length > 0) {
      return user.menuAccess.includes(item.key);
    }
    return true;
  });

  const isPmeMgmtAllowed =
    user.role === "SUPERADMIN" ||
    (user.menuAccess && Array.isArray(user.menuAccess) && (user.menuAccess.includes("pme-management") || user.menuAccess.includes("pme-registration")));

  const navList = (
    <nav
      aria-label="Navigasi utama"
      className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700/60 hover:scrollbar-thumb-teal-500/80 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-teal-500/80"
    >
      {filteredNav.map((item) => {
        const isActive = view === item.key;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-teal-500/25 via-teal-500/15 to-transparent text-teal-300 font-bold border-l-[3.5px] border-teal-400 shadow-xs"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
            )}
          >
            <item.icon
              className={cn(
                "h-5 w-5 shrink-0 transition-colors",
                isActive ? "text-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]" : "text-slate-400 group-hover:text-slate-200"
              )}
            />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}

      {/* Menu Tambahan: Manajemen Data PME & Submenu */}
      {isPmeMgmtAllowed && (
        <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1.5">
          <div className="px-3 py-1 flex items-center justify-between text-[11.5px] font-bold text-teal-400/90 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4 text-teal-400" />
              <span>Manajemen Data PME</span>
            </div>
          </div>

          <div className="space-y-1 pl-1">
            <button
              onClick={() => navigate("pme-registration")}
              aria-current={view === "pme-registration" ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-200",
                view === "pme-registration"
                  ? "bg-teal-500/20 text-teal-200 font-semibold border-l-2 border-teal-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
            >
              <UserPlus className="h-4.5 w-4.5 shrink-0 text-teal-400" />
              <span className="truncate">1. Pendaftaran PME</span>
            </button>

            <button
              onClick={() => navigate("pme-packages")}
              aria-current={view === "pme-packages" ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-200",
                view === "pme-packages"
                  ? "bg-teal-500/20 text-teal-200 font-semibold border-l-2 border-teal-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
            >
              <PackageCheck className="h-4.5 w-4.5 shrink-0 text-blue-400" />
              <span className="truncate">2. Pemilihan Paket PME</span>
            </button>

            <button
              onClick={() => navigate("pme-input")}
              aria-current={view === "pme-input" ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-200",
                view === "pme-input"
                  ? "bg-teal-500/20 text-teal-200 font-semibold border-l-2 border-teal-400 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
            >
              <FilePenLine className="h-4.5 w-4.5 shrink-0 text-amber-400" />
              <span className="truncate">3. Input Hasil PME</span>
            </button>
          </div>

          {/* Menu Laporan Hasil PME: Dapat diakses oleh Superadmin & Peserta PME */}
          <div className="pt-2 mt-2 border-t border-slate-800/60">
            <button
              onClick={() => navigate("pme-reports")}
              aria-current={view === "pme-reports" ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-all duration-200",
                view === "pme-reports"
                  ? "bg-gradient-to-r from-teal-500/25 via-teal-500/15 to-transparent text-teal-300 border-l-[3.5px] border-teal-400 shadow-xs font-bold"
                  : "text-teal-400/90 hover:bg-slate-800/60 hover:text-teal-200"
              )}
            >
              <FileBarChart className="h-5 w-5 shrink-0 text-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.3)]" />
              <span className="flex-1 text-left truncate">
                {user.role === "SUPERADMIN" ? "Laporan Hasil PME" : "Lembar Hasil Evaluasi PME"}
              </span>
              {user.role === "SUPERADMIN" ? (
                <span className="text-[9.5px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                  SUPER
                </span>
              ) : (
                <span className="text-[9.5px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                  RESMI
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-4 pt-5 pb-3.5 border-b border-slate-800/80 bg-slate-950/40">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 p-1.5 ring-1 ring-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
        <img
          src="/icon.png"
          alt="di-dismartPME Logo"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="leading-tight min-w-0">
        <p className="text-[16.5px] font-extrabold tracking-tight text-white truncate">di-dismartPME</p>
        <p className="text-[11px] text-teal-400 font-medium tracking-wide truncate">Evaluasi Z-Score & PME</p>
      </div>
    </div>
  );

  const usageCard = usage ? (
    <div className="mx-3 mb-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-slate-300 shadow-xs">
      <div className="flex items-center justify-between text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5 text-teal-400" /> Kapasitas Evaluasi Bulanan
        </span>
        <button onClick={() => refreshUser()} aria-label="Segarkan kuota">
          <RefreshCw className="h-3 w-3 hover:text-teal-300 transition-colors" />
        </button>
      </div>
      <div className="mt-2">
        <Progress value={usagePct} className="h-1.5 bg-slate-800" aria-label={`Kapasitas evaluasi ${usagePct}%`} />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400 font-mono">
        {usage.used}/{usage.limit} evaluasi · plan {user.organization.plan}
      </p>
    </div>
  ) : null;

  const logoutButton = (
    <div className="mt-auto p-3 border-t border-slate-800/80 bg-slate-950/60">
      <button
        type="button"
        onClick={() => void useAppStore.getState().logout()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-900/50 hover:text-red-100 transition-colors shadow-xs cursor-pointer"
      >
        <LogOut className="h-4 w-4" />
        <span>Keluar Aplikasi</span>
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0B131B] text-slate-200 border-r border-slate-800/80 shadow-2xl lg:flex">
        {brand}
        {navList}
        {usageCard}
        {logoutButton}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buka menu navigasi">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-68 p-0 flex flex-col bg-[#0B131B] text-slate-200 border-r border-slate-800">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              {brand}
              {navList}
              {usageCard}
              {logoutButton}
            </SheetContent>
          </Sheet>

          <h1 className="truncate text-base font-semibold sm:text-lg">{VIEW_TITLES[view]}</h1>

          <div className="ml-auto flex items-center gap-3">
            {/* Superadmin Tenant Switcher */}
            {user.role === "SUPERADMIN" && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
                <Eye className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline font-semibold">Lihat Sebagai:</span>
                <select
                  value={viewAsTenantId || "ALL"}
                  onChange={(e) => {
                    setViewAsTenantId(e.target.value);
                  }}
                  className="bg-transparent font-semibold text-xs focus:outline-none cursor-pointer border-none py-0.5 text-amber-950 dark:text-amber-100 max-w-[180px] sm:max-w-[260px] truncate"
                >
                  <option value="ALL" className="bg-background text-foreground font-medium">
                    🌐 Semua Organisasi (Global View)
                  </option>
                  <optgroup label="Database Akun Sendiri" className="bg-background text-foreground font-semibold">
                    <option value={user.organization.id} className="font-medium">
                      🏢 {user.organization.name} (Organisasi Saya)
                    </option>
                  </optgroup>
                  {tenants.filter((t) => t.id !== user.organization.id).length > 0 && (
                    <optgroup label="Organisasi Lain" className="bg-background text-foreground font-semibold">
                      {tenants
                        .filter((t) => t.id !== user.organization.id)
                        .map((t) => (
                          <option key={t.id} value={t.id} className="font-normal">
                            {t.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-sm transition-colors hover:bg-muted">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[140px] truncate sm:inline">{user.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                    {user.role === "SUPERADMIN" ? "SUPER ADMIN" : user.role} · {user.organization.name}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "SUPERADMIN" && (
                  <DropdownMenuItem onClick={() => navigate("users")}>
                    <Users className="h-4 w-4" /> Pengaturan User
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("settings")}>
                  <Settings className="h-4 w-4" /> Pengaturan Sistem
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void useAppStore.getState().logout()} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>

        {/* Sticky footer */}
        <footer className="mt-auto border-t bg-muted/30">
          <div className="flex flex-col items-center justify-between gap-1 px-4 py-3.5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>
              <span className="font-semibold text-foreground/70">di-dismartPME</span> — Evaluasi Z-Score & PME Laboratorium · Standar ISO 15189
            </p>
            <p>© {new Date().getFullYear()} di-dismartPME. Evaluasi akhir Z-score diverifikasi sesuai standar mutu.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
