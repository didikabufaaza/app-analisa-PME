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
  Megaphone,
  Database,
} from "lucide-react";
import type { TenantOption } from "@/types/pme";
import { useIdleLogout } from "@/hooks/use-idle-logout";
import { isViewAllowed } from "@/lib/permissions";
import { DICTIONARY, type Language } from "@/lib/i18n";

const NAV: { key: AppView; icon: typeof LayoutDashboard; superAdminOnly?: boolean }[] = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "sessions", icon: FileText },
  { key: "reports", icon: FileSpreadsheet },
  { key: "review", icon: ClipboardCheck },
  { key: "capa", icon: ListChecks },
  { key: "kop-surat", icon: Building2 },
  { key: "settings", icon: Settings },
  { key: "audit", icon: ScrollText },
  { key: "users", icon: Users, superAdminOnly: true },
];

const NAV_LABELS: Record<Language, Record<AppView, string>> = {
  id: {
    dashboard: "Dashboard",
    sessions: "Sesi PME",
    "session-detail": "Detail Sesi PME",
    reports: "Laporan",
    review: "Review Center",
    capa: "CAPA",
    "kop-surat": "Kop Surat",
    settings: "Pengaturan",
    audit: "Log Audit",
    users: "Pengaturan User",
    "pme-registration": "1. Pendaftaran PME",
    "pme-packages": "2. Pemilihan Paket PME",
    "pme-input": "3. Input Hasil PME",
    "pme-reports": "Laporan Hasil PME",
    "pme-info": "4. Informasi & Siklus PME",
    "master-data": "5. Master Data",
  },
  en: {
    dashboard: "Dashboard",
    sessions: "PME Sessions",
    "session-detail": "PME Session Detail",
    reports: "Reports",
    review: "Review Center",
    capa: "CAPA",
    "kop-surat": "Letterhead",
    settings: "Settings",
    audit: "Audit Logs",
    users: "User Settings",
    "pme-registration": "1. PME Registration",
    "pme-packages": "2. Package Selection",
    "pme-input": "3. Results Entry",
    "pme-reports": "PME Results Report",
    "pme-info": "4. Information & Cycles",
    "master-data": "5. Master Data",
  },
};

const VIEW_TITLES: Record<Language, Record<AppView, string>> = {
  id: {
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
    "pme-reports": "Laporan Hasil PME",
    "pme-info": "Pengaturan Siklus & Informasi PME",
    "master-data": "Master Data PME",
  },
  en: {
    dashboard: "Dashboard",
    sessions: "PME Sessions",
    "session-detail": "PME Session Detail",
    reports: "Comprehensive Reports & Quality Evaluation",
    review: "Data Verification Center",
    capa: "Corrective & Preventive Action (CAPA)",
    "kop-surat": "Laboratory Letterhead Settings",
    settings: "Settings",
    audit: "Audit Logs",
    users: "User Management & Access Control",
    "pme-registration": "PME Participant Registration",
    "pme-packages": "PME Package Selection",
    "pme-input": "PME Results Entry",
    "pme-reports": "PME Results Report",
    "pme-info": "PME Information & Cycles",
    "master-data": "PME Master Data",
  },
};

const VIEW_ICONS: Record<AppView, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  sessions: FileText,
  "session-detail": FileText,
  reports: FileSpreadsheet,
  review: ClipboardCheck,
  capa: ListChecks,
  "kop-surat": Building2,
  settings: Settings,
  audit: ScrollText,
  users: Users,
  "pme-registration": UserPlus,
  "pme-packages": PackageCheck,
  "pme-input": FilePenLine,
  "pme-reports": FileBarChart,
  "pme-info": Megaphone,
  "master-data": Database,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    view,
    navigate,
    sidebarOpen,
    setSidebarOpen,
    refreshUser,
    viewAsTenantId,
    setViewAsTenantId,
    sidebarTheme,
    language,
    setLanguage,
  } = useAppStore();
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

  // Load tenants list for Superadmin & Admin2 switcher
  useEffect(() => {
    if (user?.role === "SUPERADMIN" || user?.role === "ADMIN2") {
      fetch("/api/admin/tenants")
        .then((res) => (res.ok ? res.json() : { tenants: [] }))
        .then((data) => setTenants(data.tenants || []))
        .catch(() => undefined);
    }
  }, [user?.role]);

  if (!user) return null;

  const usagePct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  // Filter navigation items strictly based on role and menu access permissions
  const filteredNav = NAV.filter((item) => isViewAllowed(item.key, user));

  const isPmeMgmtAllowed =
    isViewAllowed("pme-registration", user) ||
    isViewAllowed("pme-packages", user) ||
    isViewAllowed("pme-input", user) ||
    isViewAllowed("pme-info", user) ||
    isViewAllowed("master-data", user) ||
    isViewAllowed("pme-reports", user);

  const navList = (
    <nav
      aria-label="Navigasi utama"
      className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700/60 hover:scrollbar-thumb-teal-500/80 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-teal-500/80"
    >
      {filteredNav.map((item) => {
        const isActive = view === item.key;
        const itemLabel = NAV_LABELS[language][item.key] || item.key;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            aria-current={isActive ? "page" : undefined}
            style={{
              fontSize: sidebarTheme.fontSize,
              fontWeight: isActive ? 700 : Number(sidebarTheme.fontWeight) || 600,
              color: isActive ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
              backgroundColor: isActive ? sidebarTheme.activeBgColor : undefined,
              borderLeftColor: isActive ? sidebarTheme.activeTextColor : "transparent",
            }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-200 border-l-[3.5px]",
              isActive
                ? "shadow-sm backdrop-blur-xs"
                : "hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon
              className="h-5 w-5 shrink-0 transition-colors"
              style={{
                color: isActive ? sidebarTheme.activeTextColor : undefined,
                filter: isActive ? `drop-shadow(0 0 6px ${sidebarTheme.activeTextColor}66)` : undefined,
              }}
            />
            <span className="flex-1 text-left truncate leading-snug">{itemLabel}</span>
          </button>
        );
      })}

      {/* Menu Tambahan: Manajemen Data PME & Submenu */}
      {isPmeMgmtAllowed && (
        <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1.5">
          <div className="px-3 py-1 flex items-center justify-between text-[11.5px] font-bold text-teal-400/90 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4 text-teal-400" />
              <span>{language === "en" ? "PME Data Management" : "Manajemen Data PME"}</span>
            </div>
          </div>

          <div className="space-y-1 pl-1">
            {isViewAllowed("pme-registration", user) && (
              <button
                onClick={() => navigate("pme-registration")}
                aria-current={view === "pme-registration" ? "page" : undefined}
                style={{
                  fontSize: sidebarTheme.fontSize,
                  fontWeight: view === "pme-registration" ? 700 : Number(sidebarTheme.fontWeight) || 600,
                  color: view === "pme-registration" ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
                  backgroundColor: view === "pme-registration" ? sidebarTheme.activeBgColor : undefined,
                  borderLeftColor: view === "pme-registration" ? sidebarTheme.activeTextColor : "transparent",
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 border-l-2",
                  view === "pme-registration"
                    ? "shadow-xs"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <UserPlus className="h-4.5 w-4.5 shrink-0 text-teal-400" />
                <span className="flex-1 text-left truncate leading-snug">
                  {language === "en" ? "1. PME Registration" : "1. Pendaftaran PME"}
                </span>
              </button>
            )}

            {isViewAllowed("pme-packages", user) && (
              <button
                onClick={() => navigate("pme-packages")}
                aria-current={view === "pme-packages" ? "page" : undefined}
                style={{
                  fontSize: sidebarTheme.fontSize,
                  fontWeight: view === "pme-packages" ? 700 : Number(sidebarTheme.fontWeight) || 600,
                  color: view === "pme-packages" ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
                  backgroundColor: view === "pme-packages" ? sidebarTheme.activeBgColor : undefined,
                  borderLeftColor: view === "pme-packages" ? sidebarTheme.activeTextColor : "transparent",
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 border-l-2",
                  view === "pme-packages"
                    ? "shadow-xs"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <PackageCheck className="h-4.5 w-4.5 shrink-0 text-blue-400" />
                <span className="flex-1 text-left truncate leading-snug">
                  {language === "en" ? "2. Package Selection" : "2. Pemilihan Paket PME"}
                </span>
              </button>
            )}

            {isViewAllowed("pme-input", user) && (
              <button
                onClick={() => navigate("pme-input")}
                aria-current={view === "pme-input" ? "page" : undefined}
                style={{
                  fontSize: sidebarTheme.fontSize,
                  fontWeight: view === "pme-input" ? 700 : Number(sidebarTheme.fontWeight) || 600,
                  color: view === "pme-input" ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
                  backgroundColor: view === "pme-input" ? sidebarTheme.activeBgColor : undefined,
                  borderLeftColor: view === "pme-input" ? sidebarTheme.activeTextColor : "transparent",
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 border-l-2",
                  view === "pme-input"
                    ? "shadow-xs"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <FilePenLine className="h-4.5 w-4.5 shrink-0 text-amber-400" />
                <span className="flex-1 text-left truncate leading-snug">
                  {language === "en" ? "3. Results Entry" : "3. Input Hasil PME"}
                </span>
              </button>
            )}

            {isViewAllowed("pme-info", user) && (
              <button
                onClick={() => navigate("pme-info")}
                aria-current={view === "pme-info" ? "page" : undefined}
                style={{
                  fontSize: sidebarTheme.fontSize,
                  fontWeight: view === "pme-info" ? 700 : Number(sidebarTheme.fontWeight) || 600,
                  color: view === "pme-info" ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
                  backgroundColor: view === "pme-info" ? sidebarTheme.activeBgColor : undefined,
                  borderLeftColor: view === "pme-info" ? sidebarTheme.activeTextColor : "transparent",
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 border-l-2",
                  view === "pme-info"
                    ? "shadow-xs"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <Megaphone className="h-4.5 w-4.5 shrink-0 text-teal-400" />
                <span className="flex-1 text-left truncate leading-snug">
                  {language === "en" ? "4. Information & Cycles" : "4. Informasi & Siklus PME"}
                </span>
                <span className={cn(
                  "text-[9.5px] border px-1 py-0.2 rounded font-mono font-bold",
                  user.role === "SUPERADMIN"
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                )}>
                  {user.role === "SUPERADMIN" ? "SUPER" : "VIEW"}
                </span>
              </button>
            )}

            {isViewAllowed("master-data", user) && (
              <button
                onClick={() => navigate("master-data")}
                aria-current={view === "master-data" ? "page" : undefined}
                style={{
                  fontSize: sidebarTheme.fontSize,
                  fontWeight: view === "master-data" ? 700 : Number(sidebarTheme.fontWeight) || 600,
                  color: view === "master-data" ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
                  backgroundColor: view === "master-data" ? sidebarTheme.activeBgColor : undefined,
                  borderLeftColor: view === "master-data" ? sidebarTheme.activeTextColor : "transparent",
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 border-l-2",
                  view === "master-data"
                    ? "shadow-xs"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <Database className="h-4.5 w-4.5 shrink-0 text-purple-400" />
                <span className="flex-1 text-left truncate leading-snug">
                  {language === "en" ? "5. Master Data" : "5. Master Data"}
                </span>
                <span className={cn(
                  "text-[9.5px] border px-1 py-0.2 rounded font-mono font-bold",
                  user.role === "SUPERADMIN"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                )}>
                  {user.role === "SUPERADMIN" ? "SUPER" : "VIEW"}
                </span>
              </button>
            )}
          </div>

          {/* Menu Laporan Hasil PME */}
          {isViewAllowed("pme-reports", user) && (
            <div className="pt-2 mt-2 border-t border-slate-800/60">
              <button
                onClick={() => navigate("pme-reports")}
                aria-current={view === "pme-reports" ? "page" : undefined}
                style={{
                  fontSize: sidebarTheme.fontSize,
                  fontWeight: view === "pme-reports" ? 700 : Number(sidebarTheme.fontWeight) || 600,
                  color: view === "pme-reports" ? sidebarTheme.activeTextColor : sidebarTheme.textColor,
                  backgroundColor: view === "pme-reports" ? sidebarTheme.activeBgColor : undefined,
                  borderLeftColor: view === "pme-reports" ? sidebarTheme.activeTextColor : "transparent",
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 border-l-[3.5px]",
                  view === "pme-reports"
                    ? "shadow-xs"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <FileBarChart className="h-5 w-5 shrink-0 text-teal-400 drop-shadow-[0_0_8px_rgba(20,184,166,0.3)]" />
                <span className="flex-1 text-left truncate leading-snug">
                  {user.role === "SUPERADMIN" || user.role === "ADMIN2"
                    ? (language === "en" ? "PME Results Report" : "Laporan Hasil PME")
                    : (language === "en" ? "PME Quality Evaluation Sheet" : "Lembar Hasil Evaluasi PME")}
                </span>
                {user.role === "SUPERADMIN" ? (
                  <span className="text-[9.5px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                    SUPER
                  </span>
                ) : user.role === "ADMIN2" ? (
                  <span className="text-[9.5px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                    ADMIN2
                  </span>
                ) : (
                  <span className="text-[9.5px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                    {language === "en" ? "OFFICIAL" : "RESMI"}
                  </span>
                )}
              </button>
            </div>
          )}
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
        <p className="text-[11px] text-teal-400 font-medium tracking-wide truncate">
          {language === "en" ? "Z-Score & PME Evaluation" : "Evaluasi Z-Score & PME"}
        </p>
      </div>
    </div>
  );

  const usageCard = usage ? (
    <div className="mx-3 mb-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-slate-300 shadow-xs">
      <div className="flex items-center justify-between text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5 text-teal-400" />{" "}
          {language === "en" ? "Monthly Evaluation Capacity" : "Kapasitas Evaluasi Bulanan"}
        </span>
        <button onClick={() => refreshUser()} aria-label="Segarkan kuota">
          <RefreshCw className="h-3 w-3 hover:text-teal-300 transition-colors" />
        </button>
      </div>
      <div className="mt-2">
        <Progress value={usagePct} className="h-1.5 bg-slate-800" aria-label={`Kapasitas evaluasi ${usagePct}%`} />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400 font-mono">
        {usage.used}/{usage.limit} {language === "en" ? "evaluations · plan " : "evaluasi · plan "} {user.organization.plan}
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
        <span>{language === "en" ? "Sign Out" : "Keluar Aplikasi"}</span>
      </button>
    </div>
  );

  const activeTenantLabel =
    viewAsTenantId && viewAsTenantId !== "ALL"
      ? tenants.find((t) => t.id === viewAsTenantId)?.name || user?.organization?.name || "Superadmin"
      : user?.organization?.name || (user?.role === "SUPERADMIN" ? "Superadmin" : user?.name || (language === "en" ? "Laboratory" : "Laboratorium"));

  const pageTitle =
    view === "pme-reports"
      ? `${language === "en" ? "PME Results Report" : "Laporan Hasil PME"} (${activeTenantLabel})`
      : VIEW_TITLES[language][view];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar - Widened to 295px so all text and buttons fit perfectly without cutting off */}
      <aside
        style={{ backgroundColor: sidebarTheme?.bgColor || "#0B131B" }}
        className="sticky top-0 hidden h-screen w-[295px] shrink-0 flex-col text-slate-200 border-r border-slate-800/80 shadow-2xl lg:flex transition-colors duration-200"
      >
        {brand}
        {navList}
        {usageCard}
        {logoutButton}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3.5 border-b border-slate-700/50 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950/95 text-white backdrop-blur-xl px-4 sm:px-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] transition-all">
          {/* Mobile menu trigger */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-white/10" aria-label="Buka menu navigasi">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[310px] p-0 flex flex-col text-slate-200 border-r border-slate-800"
              style={{ backgroundColor: sidebarTheme?.bgColor || "#0B131B" }}
            >
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              {brand}
              {navList}
              {usageCard}
              {logoutButton}
            </SheetContent>
          </Sheet>

          {/* Active View Icon Badge */}
          {VIEW_ICONS[view] && (() => {
            const Icon = VIEW_ICONS[view];
            return (
              <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/25 to-emerald-500/20 text-teal-300 ring-1 ring-teal-400/35 shadow-[0_0_12px_rgba(20,184,166,0.25)]">
                <Icon className="h-5 w-5" />
              </div>
            );
          })()}

          {/* Dynamic View Title & Context */}
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-extrabold sm:text-lg text-white tracking-tight drop-shadow-xs">
                {pageTitle}
              </h1>
              {user.role === "SUPERADMIN" ? (
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-300 ring-1 ring-teal-400/40 uppercase tracking-wider">
                  <Sparkles className="h-2.5 w-2.5" /> Superadmin
                </span>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 ring-1 ring-slate-700/60 truncate max-w-[180px]">
                  <Building2 className="h-2.5 w-2.5 text-teal-400" /> {user.organization.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-teal-400/80 font-medium hidden sm:block truncate">
              {language === "en"
                ? "Laboratory Z-Score Evaluation & External Quality Assurance System (ISO 15189)"
                : "Sistem Evaluasi Z-Score & Penjaminan Mutu Eksternal Laboratorium"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Language Switcher (🇮🇩 ID / 🇬🇧 EN) */}
            <div className="flex items-center rounded-xl border border-teal-500/30 bg-slate-900/80 p-0.5 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setLanguage("id")}
                title="Bahasa Indonesia"
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                  language === "id"
                    ? "bg-gradient-to-r from-teal-500/35 to-emerald-500/25 text-teal-200 border border-teal-400/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <span className="text-sm sm:text-base leading-none">🇮🇩</span>
                <span className="font-mono text-[11px] font-extrabold">ID</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                title="English (United Kingdom / United States)"
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                  language === "en"
                    ? "bg-gradient-to-r from-teal-500/35 to-emerald-500/25 text-teal-200 border border-teal-400/50 shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <span className="text-sm sm:text-base leading-none">🇬🇧</span>
                <span className="font-mono text-[11px] font-extrabold">EN</span>
              </button>
            </div>

            {/* Tenant Switcher: Superadmin & Admin2 */}
            {(user.role === "SUPERADMIN" || user.role === "ADMIN2") && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 sm:px-3 py-1.5 text-xs shadow-inner backdrop-blur-md transition-all",
                  user.role === "ADMIN2"
                    ? "border-sky-500/40 bg-sky-950/40 text-sky-200"
                    : "border-teal-500/40 bg-slate-900/80 text-teal-200 ring-1 ring-teal-500/20"
                )}
              >
                <Eye className={cn("h-4 w-4 shrink-0", user.role === "ADMIN2" ? "text-sky-400" : "text-teal-400")} />
                <span className="hidden xl:inline font-bold text-slate-300">
                  {language === "en" ? "View As:" : "Lihat Sebagai:"}
                </span>
                <select
                  value={viewAsTenantId || "ALL"}
                  onChange={(e) => {
                    setViewAsTenantId(e.target.value);
                  }}
                  className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer border-none py-0.5 text-teal-300 max-w-[130px] sm:max-w-[180px] lg:max-w-[220px] truncate"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-100 font-semibold">
                    {language === "en" ? "🌐 All Organizations (Global View)" : "🌐 Semua Organisasi (Global View)"}
                  </option>
                  <optgroup label={language === "en" ? "Current Account Database" : "Database Akun Sendiri"} className="bg-slate-900 text-teal-300 font-bold">
                    <option value={user.organization.id} className="bg-slate-900 text-slate-100 font-medium">
                      🏢 {user.organization.name} {language === "en" ? "(My Organization)" : "(Organisasi Saya)"}
                    </option>
                  </optgroup>
                  {tenants.filter((t) => t.id !== user.organization.id).length > 0 && (
                    <optgroup label={language === "en" ? "Other Organizations" : "Organisasi Lain"} className="bg-slate-900 text-teal-300 font-bold">
                      {tenants
                        .filter((t) => t.id !== user.organization.id)
                        .map((t) => (
                          <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100 font-normal">
                            {t.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                {user.role === "ADMIN2" && (
                  <span className="hidden md:inline-block ml-1 bg-sky-500/20 text-sky-300 font-mono text-[9.5px] px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                    {language === "en" ? "View Only" : "Lihat Saja"}
                  </span>
                )}
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full border border-teal-500/30 bg-slate-900/80 hover:bg-slate-800/90 py-1 pl-1 pr-3 text-sm text-slate-100 transition-all shadow-xs ring-1 ring-teal-500/20 hover:ring-teal-400/40 cursor-pointer">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-xs font-black text-white shadow-[0_0_10px_rgba(20,184,166,0.4)]">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[120px] truncate sm:inline font-semibold">{user.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                    {user.role === "SUPERADMIN" ? "SUPER ADMIN" : user.role === "ADMIN2" ? (language === "en" ? "ADMIN2 (View Only)" : "ADMIN2 (Lihat Saja)") : user.role} · {user.organization.name}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "SUPERADMIN" && (
                  <DropdownMenuItem onClick={() => navigate("users")}>
                    <Users className="h-4 w-4" /> {language === "en" ? "User Settings" : "Pengaturan User"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("settings")}>
                  <Settings className="h-4 w-4" /> {language === "en" ? "System Settings" : "Pengaturan Sistem"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void useAppStore.getState().logout()} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> {language === "en" ? "Sign Out" : "Keluar"}
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
              <span className="font-semibold text-foreground/70">di-dismartPME</span> —{" "}
              {language === "en"
                ? "Laboratory Z-Score & PME Evaluation · ISO 15189 Standards"
                : "Evaluasi Z-Score & PME Laboratorium · Standar ISO 15189"}
            </p>
            <p>
              © {new Date().getFullYear()} di-dismartPME.{" "}
              {language === "en"
                ? "Final Z-score evaluation verified in accordance with quality standards."
                : "Evaluasi akhir Z-score diverifikasi sesuai standar mutu."}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
