"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Coins,
  Edit2,
  Gauge,
  KeyRound,
  Loader2,
  Palette,
  Paintbrush,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  SlidersHorizontal,
  Timer,
  Type,
} from "lucide-react";

import { ApiError, apiGet, apiSend } from "@/lib/api-client";
import { useAppStore, DEFAULT_SIDEBAR_THEME, type SidebarTheme } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { AiConfigData, AiUsageData, ZscoreRuleData } from "@/types/pme";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  monthlyAiLimit: number;
  createdAt: string;
  _count?: { users: number; pmeSessions: number };
}

interface ZscoreRulesResponse {
  rules: ZscoreRuleData[];
  active: { ruleVersion: string; satisfactoryLimit: number; warningLimit: number };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID").format(n);
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden="true" />;
}

export function SettingsView() {
  const { toast } = useToast();
  const user = useAppStore((s) => s.user);
  const tenantDisplayName = user?.organization?.name || user?.name || "Laboratorium PME";
  const isSuper = user?.role === "SUPERADMIN";
  const isAdmin = user?.role === "ADMIN" || isSuper;

  // ===== Section 4: Tenants Quota Management (SUPERADMIN only) =====
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [editLimit, setEditLimit] = useState("");
  const [editPlan, setEditPlan] = useState("PRO");
  const [savingQuota, setSavingQuota] = useState(false);

  // ===== Section 5: Sidebar Styling Customization (SUPERADMIN only) =====
  const sidebarTheme = useAppStore((s) => s.sidebarTheme);
  const setSidebarTheme = useAppStore((s) => s.setSidebarTheme);
  const resetSidebarTheme = useAppStore((s) => s.resetSidebarTheme);

  const [themeEdit, setThemeEdit] = useState<SidebarTheme>(sidebarTheme || DEFAULT_SIDEBAR_THEME);
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => {
    if (sidebarTheme) {
      setThemeEdit(sidebarTheme);
    }
  }, [sidebarTheme]);

  const handleSaveSidebarTheme = () => {
    setSavingTheme(true);
    try {
      setSidebarTheme(themeEdit);
      toast({
        title: "Pengaturan Sidebar Berhasil Disimpan",
        description: "Warna, tipografi, dan gaya sidebar telah diperbarui secara permanen.",
      });
    } catch {
      toast({
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan pengaturan sidebar.",
        variant: "destructive",
      });
    } finally {
      setSavingTheme(false);
    }
  };

  const handleResetSidebarTheme = () => {
    resetSidebarTheme();
    setThemeEdit(DEFAULT_SIDEBAR_THEME);
    toast({
      title: "Sidebar Direset ke Default",
      description: "Desain dan tipografi sidebar telah dikembalikan ke standar awal sistem.",
    });
  };

  const fetchTenants = useCallback(async () => {
    if (user?.role !== "SUPERADMIN") return;
    setTenantsLoading(true);
    try {
      const res = await apiGet<{ tenants: TenantItem[] }>("/api/admin/tenants");
      setTenants(res.tenants || []);
    } catch {
      // ignore
    } finally {
      setTenantsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (isSuper) {
      void fetchTenants();
    }
  }, [isSuper, fetchTenants]);

  const openQuotaDialogForCurrent = () => {
    if (!user) return;
    const currentT = tenants.find((t) => t.id === user.organization?.id) || {
      id: user.organization?.id || "",
      name: user.organization?.name || "Organisasi Saat Ini",
      slug: "",
      plan: user.organization?.plan || "PRO",
      monthlyAiLimit: user.organization?.monthlyAiLimit || 100,
      createdAt: "",
    };
    setSelectedTenant(currentT);
    setEditLimit(String(currentT.monthlyAiLimit));
    setEditPlan(currentT.plan || "PRO");
    setQuotaDialogOpen(true);
  };

  async function handleSaveQuota() {
    if (!selectedTenant) return;
    const limitNum = Number(editLimit);
    if (!Number.isFinite(limitNum) || limitNum < 0) {
      toast({ title: "Nilai tidak valid", description: "Batas kuota harus berupa angka valid >= 0.", variant: "destructive" });
      return;
    }
    setSavingQuota(true);
    try {
      await apiSend("/api/admin/tenants", "PATCH", {
        id: selectedTenant.id,
        monthlyAiLimit: limitNum,
        plan: editPlan,
      });
      toast({
        title: "Kuota berhasil diperbarui",
        description: `Kapasitas untuk ${selectedTenant.name} diset menjadi ${limitNum} evaluasi/bulan (${editPlan}).`,
      });
      setQuotaDialogOpen(false);
      void fetchTenants();
      void fetchUsage();
      useAppStore.getState().refreshUser();
    } catch (err) {
      toast({
        title: "Gagal memperbarui kuota",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setSavingQuota(false);
    }
  }

  // ===== Section 1: Z-Score rules =====
  const [rules, setRules] = useState<ZscoreRuleData[]>([]);
  const [active, setActive] = useState<ZscoreRulesResponse["active"] | null>(null);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [satisfactoryInput, setSatisfactoryInput] = useState("");
  const [warningInput, setWarningInput] = useState("");
  const [savingRules, setSavingRules] = useState(false);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const data = await apiGet<ZscoreRulesResponse>("/api/zscore-rules");
      setRules(data.rules ?? []);
      setActive(data.active ?? null);
      if (data.active) {
        setSatisfactoryInput(String(data.active.satisfactoryLimit));
        setWarningInput(String(data.active.warningLimit));
      }
    } catch (err) {
      setRulesError(err instanceof ApiError ? err.message : "Gagal memuat aturan Z-score.");
    } finally {
      setRulesLoading(false);
    }
  }, []);

  async function handleSaveRules() {
    const sat = Number(satisfactoryInput);
    const warn = Number(warningInput);
    if (!Number.isFinite(sat) || !Number.isFinite(warn) || sat <= 0 || warn <= 0) {
      toast({ title: "Nilai tidak valid", description: "Batas harus berupa angka positif.", variant: "destructive" });
      return;
    }
    if (sat > warn) {
      toast({ title: "Urutan batas salah", description: "Batas Memuaskan harus lebih kecil atau sama dengan Batas Warning.", variant: "destructive" });
      return;
    }
    setSavingRules(true);
    try {
      const res = await apiSend<{ ok: boolean; ruleVersion: string; reevaluated: number }>("/api/zscore-rules", "PATCH", {
        satisfactoryLimit: sat,
        warningLimit: warn,
        reapply: true,
      });
      toast({
        title: "Aturan baru disimpan",
        description: `Versi ${res.ruleVersion} aktif. ${fmtInt(res.reevaluated)} parameter dievaluasi ulang.`,
      });
      await fetchRules();
    } catch (err) {
      toast({ title: "Gagal menyimpan aturan", description: err instanceof ApiError ? err.message : "Penyimpanan gagal.", variant: "destructive" });
    } finally {
      setSavingRules(false);
    }
  }

  // ===== Section 2: AI config (ADMIN only, hide silently on 403) =====
  const [aiConfig, setAiConfig] = useState<AiConfigData | null>(null);
  const [aiConfigLoading, setAiConfigLoading] = useState(isAdmin);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);

  const fetchAiConfig = useCallback(async () => {
    if (!useAppStore.getState().user || useAppStore.getState().user?.role !== "ADMIN") {
      setAiConfigLoading(false);
      return;
    }
    setAiConfigLoading(true);
    setAiConfigError(null);
    try {
      const data = await apiGet<AiConfigData>("/api/admin/ai-config");
      setAiConfig(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        setAiConfig(null); // hide silently
      } else {
        setAiConfigError(err instanceof ApiError ? err.message : "Gagal memuat konfigurasi engine.");
      }
    } finally {
      setAiConfigLoading(false);
    }
  }, []);

  // ===== Section 3: Usage =====
  const [usage, setUsage] = useState<AiUsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const data = await apiGet<AiUsageData>("/api/ai-usage");
      setUsage(data);
    } catch (err) {
      setUsageError(err instanceof ApiError ? err.message : "Gagal memuat penggunaan kapasitas.");
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
    void fetchUsage();
  }, [fetchRules, fetchUsage]);

  useEffect(() => {
    if (isAdmin) {
      void fetchAiConfig();
    } else {
      setAiConfig(null);
      setAiConfigLoading(false);
    }
  }, [isAdmin, fetchAiConfig]);

  const apiStatusOk = aiConfig?.apiStatus?.toUpperCase() === "CONNECTED";
  const usagePct = Math.min(100, Math.max(0, usage?.summary.usagePct ?? 0));

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Header Modern Gradient & Dynamic Tenant Name */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white p-5 sm:p-7 shadow-xl border border-indigo-500/30 backdrop-blur-md">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-16 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-white/10 text-indigo-300 border border-white/15 shadow-inner backdrop-blur-md shrink-0">
              <SlidersHorizontal className="h-7 w-7 text-indigo-300" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  Pengaturan Sistem &amp; Evaluasi <span className="text-indigo-300 font-bold">({tenantDisplayName})</span>
                </h1>
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-200 border-indigo-400/40 text-[11px] font-bold">
                  {user?.role === "SUPERADMIN" ? "Superadmin" : user?.role || "Pengguna"}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Aturan penilaian Z-score ISO 13528, konfigurasi engine evaluasi, dan pemantauan kuota kapasitas laboratorium.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Section 1: Aturan Z-Score ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
            <SlidersHorizontal className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Aturan Z-Score
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm font-medium">
            Batas klasifikasi status hasil: |Z| ≤ Memuaskan; antara Memuaskan dan Warning = Perhatian; ≥ Warning = Tidak Memuaskan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {rulesError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{rulesError}</span>
                <Button size="sm" variant="outline" onClick={() => void fetchRules()}>
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : rulesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat aturan…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label htmlFor="limit-satisfactory">Batas Memuaskan (|Z| ≤)</Label>
                  <Input
                    id="limit-satisfactory"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={satisfactoryInput}
                    onChange={(e) => setSatisfactoryInput(e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="limit-warning">Batas Warning (|Z| &lt;)</Label>
                  <Input
                    id="limit-warning"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={warningInput}
                    onChange={(e) => setWarningInput(e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="flex items-end">
                  {isAdmin ? (
                    <Button className="w-full bg-teal-600 text-white hover:bg-teal-700 sm:w-auto" onClick={() => void handleSaveRules()} disabled={savingRules}>
                      {savingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Simpan Aturan Baru
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Hanya Administrator yang dapat mengubah aturan Z-score. Nilai di atas bersifat hanya-baca.
                    </p>
                  )}
                </div>
                <div className="flex items-end justify-start text-xs text-muted-foreground lg:justify-end">
                  {active ? (
                    <span>
                      Versi aktif: <span className="font-medium text-foreground">{active.ruleVersion}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Riwayat Aturan</p>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur">
                      <TableRow>
                        <TableHead>Versi</TableHead>
                        <TableHead>Batas Memuaskan</TableHead>
                        <TableHead>Batas Warning</TableHead>
                        <TableHead>Berlaku Sejak</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                            Belum ada riwayat aturan.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rules.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.ruleVersion}</TableCell>
                            <TableCell className="tabular-nums">{r.satisfactoryLimit}</TableCell>
                            <TableCell className="tabular-nums">{r.warningLimit}</TableCell>
                            <TableCell>{fmtDate(r.effectiveDate)}</TableCell>
                            <TableCell>
                              {r.isActive ? (
                                <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800" variant="outline">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Aktif
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                  Nonaktif
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Section 2: Konfigurasi Engine (ADMIN only) ===== */}
      {isAdmin ? (
        aiConfigLoading ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat konfigurasi engine…
            </CardContent>
          </Card>
        ) : aiConfigError ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-teal-600" />
                Konfigurasi Engine Analisis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{aiConfigError}</span>
                  <Button size="sm" variant="outline" onClick={() => void fetchAiConfig()}>
                    Coba lagi
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : aiConfig ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
                <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Konfigurasi Engine Analisis
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm font-medium">Status engine pemrosesan yang digunakan untuk ekstraksi dan evaluasi.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Server className="h-3.5 w-3.5" /> Provider
                  </p>
                  <p className="mt-1 text-sm font-semibold capitalize">{aiConfig.provider || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Mode {aiConfig.mode || "auto"} · fallback internal
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Model</p>
                  <p className="mt-1 break-all text-sm font-semibold">{aiConfig.model || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Aktif: {aiConfig.activeProvider || "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status API</p>
                  <p className="mt-1">
                    {apiStatusOk ? (
                      <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800" variant="outline">
                        <StatusDot ok /> Connected
                      </Badge>
                    ) : (
                      <Badge className="border border-red-200 bg-red-100 text-red-800" variant="outline">
                        <StatusDot ok={false} /> Error
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Fallback: {aiConfig.fallbackStatus || "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" /> API Key
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold">{aiConfig.apiKeyMasked || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Tersimpan aman di server</p>
                </div>
              </div>

              {!apiStatusOk && aiConfig.apiStatusDetail ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Status API bermasalah</AlertTitle>
                  <AlertDescription>{aiConfig.apiStatusDetail}</AlertDescription>
                </Alert>
              ) : aiConfig.apiStatusDetail ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>{aiConfig.apiStatusDetail}</AlertDescription>
                </Alert>
              ) : null}

              {aiConfig.fallbackDetail ? (
                <Alert className="border-teal-200 bg-teal-50 text-teal-900">
                  <Bot className="h-4 w-4 text-teal-600" />
                  <AlertDescription>Fallback: {aiConfig.fallbackDetail}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Permintaan Bulan Ini</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{fmtInt(aiConfig.monthlyRequests)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Token (Input / Output)</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {fmtInt(aiConfig.monthlyTokenUsage?.input)} / {fmtInt(aiConfig.monthlyTokenUsage?.output)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estimasi Biaya</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{fmtUsd(aiConfig.estimatedCost)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Permintaan Berhasil Terakhir</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {aiConfig.lastSuccessfulRequest ? fmtDateTime(aiConfig.lastSuccessfulRequest.createdAt) : "—"}
                  </p>
                  {aiConfig.lastSuccessfulRequest ? (
                    <p className="text-xs text-muted-foreground">
                      {aiConfig.lastSuccessfulRequest.provider} · {aiConfig.lastSuccessfulRequest.model}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null
      ) : null}

      {/* ===== Section 3: Kuota & Penggunaan Pemrosesan ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
            <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Kapasitas Pemrosesan Bulanan
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm font-medium">Pemakaian kapasitas pemrosesan bulan ini untuk seluruh operasi ekstraksi dan evaluasi.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {usageError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{usageError}</span>
                <Button size="sm" variant="outline" onClick={() => void fetchUsage()}>
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : usageLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat penggunaan…
            </div>
          ) : usage ? (
            <>
              {usage.summary.alerts && usage.summary.alerts.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {usage.summary.alerts.map((a, idx) => (
                    <Alert key={idx} className="border-amber-200 bg-amber-50 text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription>{a}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium flex items-center gap-2">
                    Kuota Bulanan
                    {isSuper && (
                      <Badge variant="outline" className="text-[10px] border-teal-500/30 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                        Superadmin
                      </Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {fmtInt(usage.summary.successfulRequests)} / {fmtInt(usage.summary.limit)} permintaan ({usagePct}%)
                    </span>
                    {isSuper && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs border-teal-600 text-teal-700 hover:bg-teal-50 gap-1.5 shadow-sm"
                        onClick={openQuotaDialogForCurrent}
                      >
                        <Edit2 className="h-3 w-3" />
                        Ubah Kuota
                      </Button>
                    )}
                  </div>
                </div>
                <Progress value={usagePct} aria-label={`Penggunaan kapasitas ${usagePct}%`} />
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Coins className="h-3.5 w-3.5" /> Total Permintaan
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{fmtInt(usage.summary.requests)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" /> Error
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{fmtInt(usage.summary.errors)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Token</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{fmtInt(usage.summary.totalTokens)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    in {fmtInt(usage.summary.inputTokens)} · out {fmtInt(usage.summary.outputTokens)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estimasi Biaya</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{fmtUsd(usage.summary.estimatedCost)}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Log Permintaan Terakhir</p>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur">
                      <TableRow>
                        <TableHead>Operasi</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Token</TableHead>
                        <TableHead className="text-right">Waktu (ms)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Waktu Eksekusi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(usage.recentLogs ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                            Belum ada riwayat pemrosesan tercatat.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (usage.recentLogs ?? []).map((log) => {
                          const ok = log.status?.toUpperCase() === "SUCCESS";
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.operation}</TableCell>
                              <TableCell className="max-w-[180px] truncate" title={log.model}>
                                {log.model || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{fmtInt(log.totalTokens)}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <Timer className="h-3 w-3 text-muted-foreground" />
                                  {fmtInt(log.processingTimeMs)}
                                </span>
                              </TableCell>
                              <TableCell>
                                {ok ? (
                                  <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-800" variant="outline">
                                    Sukses
                                  </Badge>
                                ) : (
                                  <Badge className="border border-red-200 bg-red-100 text-red-800" variant="outline" title={log.errorMessage ?? undefined}>
                                    Gagal
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(log.createdAt)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ===== Section 4: Kelola Kuota Organisasi / Laboratorium (SUPERADMIN only) ===== */}
      {isSuper && (
        <Card className="border-teal-600/30 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
                  <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Kelola Kuota Organisasi & Laboratorium (Superadmin)
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm font-medium mt-1">
                  Atur alokasi kapasitas pemrosesan bulanan dan tipe paket untuk setiap laboratorium atau organisasi pengguna.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-10 text-xs sm:text-sm font-bold gap-2 self-start sm:self-auto border-indigo-400/40"
                onClick={() => void fetchTenants()}
                disabled={tenantsLoading}
              >
                <RefreshCw className={cn("h-4 w-4 text-indigo-500", tenantsLoading && "animate-spin")} />
                Segarkan Data
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader className="bg-muted/80">
                  <TableRow>
                    <TableHead className="font-bold text-xs sm:text-sm text-foreground">Nama Laboratorium / Organisasi</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm text-foreground">Paket (Plan)</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm text-foreground">Kapasitas Bulanan</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm text-foreground">Pengguna Terdaftar</TableHead>
                    <TableHead className="text-center font-bold text-xs sm:text-sm text-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        {tenantsLoading ? "Memuat data organisasi..." : "Belum ada data organisasi."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((t) => (
                      <TableRow key={t.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <p className="font-semibold text-foreground text-sm">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">ID: {t.id}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-semibold",
                              t.plan === "ENTERPRISE"
                                ? "bg-purple-100 text-purple-800 border-purple-300"
                                : t.plan === "PRO"
                                ? "bg-teal-100 text-teal-800 border-teal-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            )}
                          >
                            {t.plan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-teal-800 dark:text-teal-300 text-sm tabular-nums">
                            {fmtInt(t.monthlyAiLimit)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">evaluasi / bulan</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {t._count?.users ?? 0} akun pengguna
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-teal-600 text-teal-700 hover:bg-teal-50 gap-1.5 shadow-sm"
                            onClick={() => {
                              setSelectedTenant(t);
                              setEditLimit(String(t.monthlyAiLimit));
                              setEditPlan(t.plan || "PRO");
                              setQuotaDialogOpen(true);
                            }}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Ubah / Tambah Kuota
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Section 5: Kustomisasi Desain & Tipografi Sidebar (SUPERADMIN only) ===== */}
      {isSuper && (
        <Card className="border-teal-500/30 shadow-md">
          <CardHeader className="bg-gradient-to-r from-teal-950/20 via-background to-background border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  5. Kustomisasi Desain & Tipografi Sidebar (Khusus Superadmin)
                </CardTitle>
                <CardDescription className="text-xs">
                  Atur warna latar belakang, warna teks menu, warna menu aktif, ukuran font, dan ketebalan font menu sidebar secara real-time.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] px-2.5 py-1">
                  Superadmin Only
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetSidebarTheme}
                  className="text-xs h-8 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                  Reset ke Default
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveSidebarTheme}
                  disabled={savingTheme}
                  className="text-xs h-8 bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5 shadow-sm cursor-pointer"
                >
                  {savingTheme ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Simpan Pengaturan Sidebar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controls Column */}
              <div className="lg:col-span-7 space-y-5">
                {/* 1. Warna Latar Sidebar */}
                <div className="space-y-2.5 p-3.5 rounded-xl border bg-card/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Paintbrush className="h-4 w-4 text-teal-600" />
                      Warna Latar Belakang Sidebar (Background Color)
                    </Label>
                    <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">{themeEdit.bgColor}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeEdit.bgColor.startsWith("#") ? themeEdit.bgColor : "#0B131B"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setThemeEdit((prev) => ({ ...prev, bgColor: val }));
                        setSidebarTheme({ bgColor: val });
                      }}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-input p-1 bg-background"
                      title="Pilih warna latar sidebar"
                    />
                    <Input
                      type="text"
                      value={themeEdit.bgColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setThemeEdit((prev) => ({ ...prev, bgColor: val }));
                        setSidebarTheme({ bgColor: val });
                      }}
                      placeholder="#0B131B"
                      className="font-mono text-xs max-w-[140px] uppercase font-semibold"
                    />
                  </div>
                  {/* Presets */}
                  <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground mr-1 font-medium">Preset Cepat:</span>
                    {[
                      { name: "Default Slate", hex: "#0B131B" },
                      { name: "Midnight Obsidian", hex: "#090D16" },
                      { name: "Dark Emerald", hex: "#061a14" },
                      { name: "Charcoal Dark", hex: "#111827" },
                      { name: "Navy Blue", hex: "#0f172a" },
                      { name: "Deep Teal", hex: "#042f2e" },
                      { name: "Deep Indigo", hex: "#1e1338" },
                    ].map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => {
                          setThemeEdit((prev) => ({ ...prev, bgColor: p.hex }));
                          setSidebarTheme({ bgColor: p.hex });
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer",
                          themeEdit.bgColor.toLowerCase() === p.hex.toLowerCase()
                            ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: p.hex }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Warna Font Menu Sidebar (Normal & Aktif) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Warna Font Normal */}
                  <div className="space-y-2 p-3.5 rounded-xl border bg-card/60">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Type className="h-4 w-4 text-teal-600" />
                        Warna Font Menu (Normal)
                      </Label>
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">{themeEdit.textColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={themeEdit.textColor.startsWith("#") ? themeEdit.textColor : "#94A3B8"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThemeEdit((prev) => ({ ...prev, textColor: val }));
                          setSidebarTheme({ textColor: val });
                        }}
                        className="h-9 w-12 cursor-pointer rounded border border-input p-0.5 bg-background"
                      />
                      <Input
                        type="text"
                        value={themeEdit.textColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThemeEdit((prev) => ({ ...prev, textColor: val }));
                          setSidebarTheme({ textColor: val });
                        }}
                        className="font-mono text-xs uppercase font-semibold h-9"
                      />
                    </div>
                    {/* Presets */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        { name: "Slate Muted", hex: "#94A3B8" },
                        { name: "White", hex: "#F8FAFC" },
                        { name: "Silver", hex: "#CBD5E1" },
                        { name: "Light Emerald", hex: "#A7F3D0" },
                        { name: "Warm Gold", hex: "#FEF08A" },
                      ].map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => {
                            setThemeEdit((prev) => ({ ...prev, textColor: p.hex }));
                            setSidebarTheme({ textColor: p.hex });
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10.5px] border transition-all cursor-pointer",
                            themeEdit.textColor.toLowerCase() === p.hex.toLowerCase()
                              ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warna Font Menu Aktif */}
                  <div className="space-y-2 p-3.5 rounded-xl border bg-card/60">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                        Warna Font Menu (Aktif)
                      </Label>
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase">{themeEdit.activeTextColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={themeEdit.activeTextColor.startsWith("#") ? themeEdit.activeTextColor : "#2DD4BF"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThemeEdit((prev) => ({ ...prev, activeTextColor: val }));
                          setSidebarTheme({ activeTextColor: val });
                        }}
                        className="h-9 w-12 cursor-pointer rounded border border-input p-0.5 bg-background"
                      />
                      <Input
                        type="text"
                        value={themeEdit.activeTextColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThemeEdit((prev) => ({ ...prev, activeTextColor: val }));
                          setSidebarTheme({ activeTextColor: val });
                        }}
                        className="font-mono text-xs uppercase font-semibold h-9"
                      />
                    </div>
                    {/* Presets */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[
                        { name: "Teal Mint", hex: "#2DD4BF" },
                        { name: "Emerald", hex: "#34D399" },
                        { name: "Cyan", hex: "#38BDF8" },
                        { name: "Amber Gold", hex: "#FCD34D" },
                        { name: "Bright White", hex: "#FFFFFF" },
                      ].map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => {
                            setThemeEdit((prev) => ({ ...prev, activeTextColor: p.hex }));
                            setSidebarTheme({ activeTextColor: p.hex });
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10.5px] border transition-all cursor-pointer",
                            themeEdit.activeTextColor.toLowerCase() === p.hex.toLowerCase()
                              ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Ukuran & Ketebalan Font */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ukuran Font Sidebar */}
                  <div className="space-y-2 p-3.5 rounded-xl border bg-card/60">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Ukuran Font Sidebar (Font Size)
                      </Label>
                      <Badge variant="outline" className="font-mono text-[11px] font-bold text-teal-600 dark:text-teal-400">
                        {themeEdit.fontSize}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[
                        { label: "12.5px", desc: "Kecil" },
                        { label: "13.5px", desc: "Sedang" },
                        { label: "14.5px", desc: "Standar" },
                        { label: "15.5px", desc: "Besar" },
                        { label: "16.5px", desc: "Ekstra" },
                        { label: "17.5px", desc: "Super" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            setThemeEdit((prev) => ({ ...prev, fontSize: opt.label }));
                            setSidebarTheme({ fontSize: opt.label });
                          }}
                          className={cn(
                            "px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer",
                            themeEdit.fontSize === opt.label
                              ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold shadow-xs"
                              : "border-border hover:bg-muted text-foreground"
                          )}
                        >
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="text-[9.5px] text-muted-foreground">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ketebalan Font Sidebar */}
                  <div className="space-y-2 p-3.5 rounded-xl border bg-card/60">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Ketebalan Font (Font Weight)
                      </Label>
                      <Badge variant="outline" className="font-mono text-[11px] font-bold text-teal-600 dark:text-teal-400">
                        {themeEdit.fontWeight}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {[
                        { value: "400", label: "400 - Regular" },
                        { value: "500", label: "500 - Medium" },
                        { value: "600", label: "600 - Semibold" },
                        { value: "700", label: "700 - Bold" },
                        { value: "800", label: "800 - Extra Bold" },
                        { value: "900", label: "900 - Black" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setThemeEdit((prev) => ({ ...prev, fontWeight: opt.value }));
                            setSidebarTheme({ fontWeight: opt.value });
                          }}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer",
                            themeEdit.fontWeight === opt.value
                              ? "border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold shadow-xs"
                              : "border-border hover:bg-muted text-foreground"
                          )}
                        >
                          <p className="text-xs" style={{ fontWeight: Number(opt.value) }}>{opt.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview Column */}
              <div className="lg:col-span-5 flex flex-col">
                <Label className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-teal-600" />
                  Live Preview Tampilan Sidebar
                </Label>
                <div
                  className="flex-1 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col justify-between transition-colors duration-200 min-h-[300px]"
                  style={{ backgroundColor: themeEdit.bgColor }}
                >
                  <div className="space-y-3">
                    {/* Mini Brand */}
                    <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
                      <div className="h-8 w-8 rounded-lg bg-teal-500/20 p-1 flex items-center justify-center ring-1 ring-teal-400/30">
                        <img src="/icon.png" alt="Logo" className="h-full w-full object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-white tracking-tight">di-dismartPME</p>
                        <p className="text-[10px] text-teal-400 font-medium">Evaluasi Z-Score & PME</p>
                      </div>
                    </div>

                    {/* Sample Nav Items */}
                    <div className="space-y-1.5 pt-1">
                      {/* Active Item */}
                      <div
                        style={{
                          fontSize: themeEdit.fontSize,
                          fontWeight: 700,
                          color: themeEdit.activeTextColor,
                          backgroundColor: themeEdit.activeBgColor || "rgba(20, 184, 166, 0.22)",
                          borderLeft: `3.5px solid ${themeEdit.activeTextColor}`,
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg shadow-xs"
                      >
                        <Building2 className="h-4 w-4 shrink-0" style={{ color: themeEdit.activeTextColor }} />
                        <span className="truncate">Sesi PME (Aktif)</span>
                      </div>

                      {/* Normal Items */}
                      <div
                        style={{
                          fontSize: themeEdit.fontSize,
                          fontWeight: Number(themeEdit.fontWeight) || 500,
                          color: themeEdit.textColor,
                          borderLeft: "3.5px solid transparent",
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5"
                      >
                        <Bot className="h-4 w-4 shrink-0" />
                        <span className="truncate">Laporan Evaluasi</span>
                      </div>

                      <div
                        style={{
                          fontSize: themeEdit.fontSize,
                          fontWeight: Number(themeEdit.fontWeight) || 500,
                          color: themeEdit.textColor,
                          borderLeft: "3.5px solid transparent",
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5"
                      >
                        <SlidersHorizontal className="h-4 w-4 shrink-0" />
                        <span className="truncate">Input Hasil PME</span>
                      </div>

                      <div
                        style={{
                          fontSize: themeEdit.fontSize,
                          fontWeight: Number(themeEdit.fontWeight) || 500,
                          color: themeEdit.textColor,
                          borderLeft: "3.5px solid transparent",
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5"
                      >
                        <Save className="h-4 w-4 shrink-0" />
                        <span className="truncate">Pengaturan Sistem</span>
                      </div>
                    </div>
                  </div>

                  {/* Mini Footer Preview */}
                  <div className="pt-3 mt-4 border-t border-white/10 text-center">
                    <p className="text-[10px] text-slate-400 font-mono">
                      Ukuran: {themeEdit.fontSize} · Berat: {themeEdit.fontWeight} · BG: {themeEdit.bgColor}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Modal Ubah Kuota */}
      <Dialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-teal-600" />
              Ubah Kuota Evaluasi Laboratorium
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sesuaikan kapasitas kuota bulanan dan paket langganan untuk laboratorium ini.
            </DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground text-sm">{selectedTenant.name}</p>
                <p className="text-muted-foreground font-mono">ID: {selectedTenant.id}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-plan" className="text-xs font-semibold">
                  Tipe Paket (Plan)
                </Label>
                <select
                  id="tenant-plan"
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="FREE">FREE (Standar)</option>
                  <option value="PRO">PRO (Prioritas)</option>
                  <option value="ENTERPRISE">ENTERPRISE (Tanpa Batas / Kustom)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tenant-limit" className="text-xs font-semibold">
                  Kapasitas Evaluasi Bulanan (Limit Jumlah Evaluasi)
                </Label>
                <Input
                  id="tenant-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                  placeholder="Misal: 100, 200, 500"
                  className="text-sm font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Jumlah maksimal dokumen PME yang dapat diproses oleh laboratorium ini setiap bulan.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setQuotaDialogOpen(false)} disabled={savingQuota}>
              Batal
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
              onClick={() => void handleSaveQuota()}
              disabled={savingQuota}
            >
              {savingQuota ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Kuota Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
