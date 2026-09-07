"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Coins,
  Gauge,
  KeyRound,
  Loader2,
  Save,
  Server,
  SlidersHorizontal,
  Timer,
} from "lucide-react";

import { ApiError, apiGet, apiSend } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { AiConfigData, AiUsageData, ZscoreRuleData } from "@/types/pme";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const isAdmin = user?.role === "ADMIN";

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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Pengaturan</h2>
        <p className="text-sm text-muted-foreground">Aturan penilaian Z-score, konfigurasi engine evaluasi, dan pemakaian kapasitas.</p>
      </div>

      {/* ===== Section 1: Aturan Z-Score ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-teal-600" />
            Aturan Z-Score
          </CardTitle>
          <CardDescription>
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
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-teal-600" />
                Konfigurasi Engine Analisis
              </CardTitle>
              <CardDescription>Status engine pemrosesan yang digunakan untuk ekstraksi dan evaluasi.</CardDescription>
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
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-teal-600" />
            Kapasitas Pemrosesan Bulanan
          </CardTitle>
          <CardDescription>Pemakaian kapasitas pemrosesan bulan ini untuk seluruh operasi ekstraksi dan evaluasi.</CardDescription>
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
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Kuota Bulanan</span>
                  <span className="text-muted-foreground">
                    {fmtInt(usage.summary.successfulRequests)} / {fmtInt(usage.summary.limit)} permintaan ({usagePct}%)
                  </span>
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
    </div>
  );
}
