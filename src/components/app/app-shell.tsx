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
} from "lucide-react";
import type { TenantOption } from "@/types/pme";

const NAV: { key: AppView; label: string; icon: typeof LayoutDashboard; superAdminOnly?: boolean }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "sessions", label: "Sesi PME", icon: FileText },
  { key: "reports", label: "Laporan", icon: FileSpreadsheet },
  { key: "review", label: "Review Center", icon: ClipboardCheck },
  { key: "capa", label: "CAPA", icon: ListChecks },
  { key: "settings", label: "Pengaturan", icon: Settings },
  { key: "audit", label: "Log Audit", icon: ScrollText },
  { key: "users", label: "Pengaturan User", icon: Users, superAdminOnly: true },
];

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Dashboard",
  sessions: "Sesi PME",
  "session-detail": "Detail Sesi PME",
  reports: "Laporan Lengkap & Evaluasi Mutu",
  review: "AI Review Center",
  capa: "Tindakan Korektif & Preventif (CAPA)",
  settings: "Pengaturan",
  audit: "Log Audit",
  users: "Pengaturan Pengguna & Hak Akses",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, view, navigate, sidebarOpen, setSidebarOpen, refreshUser, viewAsTenantId, setViewAsTenantId } = useAppStore();
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);

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

  const navList = (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3 py-2">
      {filteredNav.map((item) => (
        <button
          key={item.key}
          onClick={() => navigate(item.key)}
          aria-current={view === item.key ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            view === item.key
              ? "bg-teal-700/10 text-teal-800 dark:text-teal-300"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className={cn("h-4.5 w-4.5 h-[18px] w-[18px]", view === item.key && "text-teal-700 dark:text-teal-300")} />
          {item.label}
        </button>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
        <FlaskConical className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight">didikpme</p>
        <p className="text-[10px] text-muted-foreground">PME AI Z-Score Analyzer</p>
      </div>
    </div>
  );

  const usageCard = usage ? (
    <div className="mx-3 mb-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 font-medium">
          <Sparkles className="h-3 w-3 text-teal-600" /> Kuota AI bulan ini
        </span>
        <button onClick={() => refreshUser()} aria-label="Segarkan kuota">
          <RefreshCw className="h-3 w-3 hover:text-foreground" />
        </button>
      </div>
      <div className="mt-1.5">
        <Progress value={usagePct} className="h-1.5" aria-label={`Penggunaan kuota AI ${usagePct}%`} />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {usage.used}/{usage.limit} analisis · plan {user.organization.plan}
      </p>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        {brand}
        {navList}
        {usageCard}
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
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              {brand}
              {navList}
              {usageCard}
            </SheetContent>
          </Sheet>

          <h1 className="truncate text-base font-semibold sm:text-lg">{VIEW_TITLES[view]}</h1>

          <div className="ml-auto flex items-center gap-3">
            {/* Superadmin Tenant Switcher */}
            {user.role === "SUPERADMIN" && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-900 dark:text-amber-200">
                <Eye className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="hidden sm:inline font-medium">Lihat Sebagai:</span>
                <select
                  value={viewAsTenantId || "ALL"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setViewAsTenantId(val);
                    // trigger refresh of active view
                    window.location.reload();
                  }}
                  className="bg-transparent font-semibold text-xs focus:outline-none cursor-pointer border-none py-0.5 text-amber-950 dark:text-amber-100"
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
              <span className="font-semibold text-foreground/70">didikpme</span> — PME AI Z-Score Analyzer · Gemini AI Edition
            </p>
            <p>© {new Date().getFullYear()} didikpme. Status akhir Z-score ditentukan rule engine deterministik.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
