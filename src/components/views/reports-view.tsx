"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiDownload } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ReportItemData } from "@/types/pme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  FileText,
  Filter,
  Download,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  Calendar,
  Layers,
  Sparkles,
  Activity,
} from "lucide-react";
import { ZScoreChartView } from "./zscore-chart-view";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  SATISFACTORY: { label: "Memuaskan", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  WARNING: { label: "Waspada", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  UNSATISFACTORY: { label: "Tidak Memuaskan", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  REVIEW_REQUIRED: { label: "Perlu Review", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
};

export function ReportsView() {
  const { toast } = useToast();
  const [items, setItems] = useState<ReportItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table");

  // Filter state
  const [sessionId, setSessionId] = useState("");
  const [program, setProgram] = useState("");
  const [cycle, setCycle] = useState("");
  const [period, setPeriod] = useState("");
  const [zStatus, setZStatus] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Options from server
  const [filterOptions, setFilterOptions] = useState<{
    sessions: { id: string; program: string | null; cycle: string | null; period: string | null; createdAt: string }[];
    programs: string[];
    cycles: string[];
    periods: string[];
  }>({ sessions: [], programs: [], cycles: [], periods: [] });

  const [summary, setSummary] = useState({
    total: 0,
    satisfactory: 0,
    warning: 0,
    unsatisfactory: 0,
    reviewRequired: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set("sessionId", sessionId);
      if (program) params.set("program", program);
      if (cycle) params.set("cycle", cycle);
      if (period) params.set("period", period);
      if (zStatus) params.set("zStatus", zStatus);
      if (search) params.set("q", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiGet<{
        items: ReportItemData[];
        summary: typeof summary;
        filterOptions: typeof filterOptions;
      }>(`/api/reports${qs}`);

      setItems(res.items || []);
      setSummary(res.summary || { total: 0, satisfactory: 0, warning: 0, unsatisfactory: 0, reviewRequired: 0 });
      if (res.filterOptions) setFilterOptions(res.filterOptions);
    } catch (err) {
      toast({
        title: "Gagal memuat laporan",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data laporan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, program, cycle, period, zStatus, search, startDate, endDate, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetFilters = () => {
    setSessionId("");
    setProgram("");
    setCycle("");
    setPeriod("");
    setZStatus("");
    setSearch("");
    setStartDate("");
    setEndDate("");
  };

  const activeSessionTarget = sessionId || filterOptions.sessions[0]?.id;

  const handleExport = async (format: "pdf" | "pdf2" | "excel" | "excel2") => {
    if (!activeSessionTarget) {
      toast({
        title: "Pilih Sesi PME",
        description: "Silakan pilih sesi PME yang ingin diunduh laporannya.",
        variant: "destructive",
      });
      return;
    }

    setExporting(format);
    try {
      const endpoint =
        format === "pdf"
          ? `/api/pme/${activeSessionTarget}/export/pdf`
          : format === "pdf2"
          ? `/api/pme/${activeSessionTarget}/export/pdf2`
          : format === "excel"
          ? `/api/pme/${activeSessionTarget}/export/excel`
          : `/api/pme/${activeSessionTarget}/export/excel2`;

      const filename =
        format === "pdf"
          ? `laporan-pme-model1-${activeSessionTarget}.pdf`
          : format === "pdf2"
          ? `laporan-pme-model2-${activeSessionTarget}.pdf`
          : format === "excel"
          ? `hasil-pme-model1-${activeSessionTarget}.xlsx`
          : `evaluasi-pme-model2-${activeSessionTarget}.xlsx`;

      await apiDownload(endpoint, filename);
      toast({
        title: "Unduhan Berhasil",
        description: `Berkas ${filename} berhasil diunduh.`,
      });
    } catch (err) {
      toast({
        title: "Gagal Mengunduh Laporan",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat mengunduh berkas.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions (Hidden on Print) */}
      <div className="no-print flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Laporan Lengkap & Rekapitulasi Mutu PME</h2>
          <p className="text-sm text-muted-foreground">
            Rekap seluruh parameter evaluasi PME, filter multi-kriteria, dan unduh laporan resmi Model 1 & Model 2.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Model 1 Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="border-teal-600 text-teal-800 dark:text-teal-300 hover:bg-teal-50"
          >
            <FileText className="mr-1.5 h-4 w-4 text-teal-600" />
            {exporting === "pdf" ? "Mengunduh..." : "PDF Model 1 (Laporan Evaluasi)"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={exporting !== null}
            className="border-teal-600 text-teal-800 dark:text-teal-300 hover:bg-teal-50"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-teal-600" />
            {exporting === "excel" ? "Mengunduh..." : "Excel Model 1 (Teknis)"}
          </Button>

          {/* Model 2 Buttons (Format EVALUASI PME.xlsx) */}
          <Button
            variant="default"
            size="sm"
            onClick={() => handleExport("pdf2")}
            disabled={exporting !== null}
            className="bg-teal-700 hover:bg-teal-800 text-white"
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {exporting === "pdf2" ? "Mengunduh..." : "PDF Model 2 (Sasaran Mutu)"}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => handleExport("excel2")}
            disabled={exporting !== null}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            {exporting === "excel2" ? "Mengunduh..." : "Excel Model 2 (EVALUASI PME)"}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards (Hidden on Print) */}
      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Parameter</span>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{summary.total}</p>
          <p className="text-[11px] text-muted-foreground">Hasil terfilter</p>
        </Card>

        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Memuaskan</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summary.satisfactory}</p>
          <p className="text-[11px] text-emerald-600/80">|Z| ≤ 2.0</p>
        </Card>

        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Waspada</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">{summary.warning}</p>
          <p className="text-[11px] text-amber-600/80">2.0 &lt; |Z| &lt; 3.0</p>
        </Card>

        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-800 dark:text-red-300">Tidak Memuaskan</span>
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-300">{summary.unsatisfactory}</p>
          <p className="text-[11px] text-red-600/80">|Z| ≥ 3.0</p>
        </Card>

        <Card className="p-4 border-violet-500/20 bg-violet-500/5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-violet-800 dark:text-violet-300">Perlu Review</span>
            <ClipboardCheck className="h-4 w-4 text-violet-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-violet-700 dark:text-violet-300">{summary.reviewRequired}</p>
          <p className="text-[11px] text-violet-600/80">Verifikasi teknis</p>
        </Card>
      </div>

      {/* Complete Filters Card (Hidden on Print) */}
      <Card className="no-print">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-teal-700" />
              <CardTitle className="text-base">Filter Laporan Lengkap</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-muted-foreground">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Filter
            </Button>
          </div>
          <CardDescription>Saring parameter berdasarkan sesi, program, siklus, status evaluasi, atau rentang waktu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {/* Sesi */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sesi PME</label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Semua Sesi</option>
                {filterOptions.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.program || "PME"} ({s.cycle || "-"} {s.period || ""})
                  </option>
                ))}
              </select>
            </div>

            {/* Program */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Program PME</label>
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Semua Program</option>
                {filterOptions.programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Siklus */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Siklus</label>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Semua Siklus</option>
                {filterOptions.cycles.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Z-Score */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status Evaluasi</label>
              <select
                value={zStatus}
                onChange={(e) => setZStatus(e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="">Semua Status</option>
                <option value="SATISFACTORY">Memuaskan (|Z| ≤ 2)</option>
                <option value="WARNING">Waspada (2 &lt; |Z| &lt; 3)</option>
                <option value="UNSATISFACTORY">Tidak Memuaskan (|Z| ≥ 3)</option>
                <option value="REVIEW_REQUIRED">Perlu Review</option>
              </select>
            </div>

            {/* Tanggal Mulai */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs px-2"
              />
            </div>

            {/* Tanggal Akhir */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs px-2"
              />
            </div>

            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cari Parameter</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nama parameter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Switcher: Tabel Evaluasi vs Grafik Z-Score (Levey-Jennings) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3 pt-1">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 font-semibold transition-all cursor-pointer",
              activeTab === "table"
                ? "bg-white dark:bg-zinc-800 text-teal-800 dark:text-teal-200 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600" />
            <span>Tabel Evaluasi ({items.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chart")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 font-semibold transition-all cursor-pointer",
              activeTab === "chart"
                ? "bg-white dark:bg-zinc-800 text-teal-800 dark:text-teal-200 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="h-4 w-4 text-teal-600" />
            <span>Grafik Z-Score (Levey-Jennings)</span>
            <Badge variant="outline" className="ml-1 bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] py-0 px-1.5">
              Visual
            </Badge>
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          {activeTab === "chart" ? (
            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-medium">
              <Activity className="h-3.5 w-3.5" />
              Mode Tampilan: Visualisasi Plot Levey-Jennings & Garis Kontrol (±2, ±3 SD)
            </span>
          ) : (
            <span>Menampilkan data numerik lengkap & rencana tindak lanjut</span>
          )}
        </div>
      </div>

      {activeTab === "chart" ? (
        <ZScoreChartView
          items={items}
          summary={summary}
          filterMeta={{
            program,
            cycle,
            period,
            labName: items[0]?.session?.laboratoryName || null,
          }}
        />
      ) : (
        /* Results Table */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daftar Parameter Hasil Evaluasi</CardTitle>
            <CardDescription>
              Menampilkan {items.length} parameter sesuai filter aktif. Kolom menyajikan data numerik dan rencana tindak lanjut perbaikan mutu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Tidak ada parameter yang sesuai dengan filter.</p>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="mt-2 text-teal-700">
                  Atur Ulang Filter
                </Button>
              </div>
            ) : (
              <div className="max-h-[38rem] overflow-x-auto overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b bg-muted/70 backdrop-blur">
                    <tr>
                      <th className="p-3 font-semibold text-muted-foreground w-12 text-center">No.</th>
                      <th className="p-3 font-semibold text-muted-foreground min-w-[180px]">Sasaran / Parameter</th>
                      <th className="p-3 font-semibold text-muted-foreground min-w-[140px]">Hasil Peserta & Target</th>
                      <th className="p-3 font-semibold text-muted-foreground w-24 text-center">Z-Score</th>
                      <th className="p-3 font-semibold text-muted-foreground w-32 text-center">Status Evaluasi</th>
                      <th className="p-3 font-semibold text-muted-foreground min-w-[280px]">Interpretasi & Rencana Perbaikan</th>
                      <th className="p-3 font-semibold text-muted-foreground w-28 text-center">CAPA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item, idx) => {
                      const zBadge = STATUS_BADGE[item.zStatus || (item.validationStatus === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "")] || {
                        label: item.zStatus || "Review",
                        className: "bg-muted text-foreground",
                      };
                      const zFormatted =
                        item.zScore !== null ? (item.zScore > 0 ? `+${item.zScore.toFixed(2)}` : item.zScore.toFixed(2)) : "-";

                      return (
                        <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                          <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="p-3">
                            <p className="font-semibold text-foreground">{item.parameterName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.session.program || "PME"} · {item.session.cycle || "-"} ({item.session.period || "-"})
                            </p>
                            {item.method && <p className="text-[10px] text-muted-foreground/80">Metode: {item.method}</p>}
                          </td>
                          <td className="p-3">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <p>
                                Peserta: <span className="font-semibold text-foreground">{item.participantValue ?? "-"}</span> {item.unit || ""}
                              </p>
                              <p className="text-muted-foreground">Target: {item.targetValue ?? "-"}</p>
                              {item.sdpa !== null && item.sdpa !== undefined && (
                                <p className="text-muted-foreground text-[10px]">SDPA: {item.sdpa}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={cn("font-mono font-bold text-sm", item.zScore !== null && Math.abs(item.zScore) >= 3 ? "text-red-600" : item.zScore !== null && Math.abs(item.zScore) > 2 ? "text-amber-600" : "text-emerald-600")}>
                              {zFormatted}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn("text-[11px] font-medium", zBadge.className)}>
                              {zBadge.label}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {item.aiAnalysis ? (
                              <div className="space-y-1.5 text-[11px]">
                                <p className="line-clamp-2 text-muted-foreground">{item.aiAnalysis.interpretation}</p>
                                {item.aiAnalysis.correctiveActions && (
                                  <div className="rounded bg-muted/60 p-1.5 text-[10px] text-foreground">
                                    <span className="font-semibold text-teal-700 dark:text-teal-400">Rencana Korektif: </span>
                                    {item.aiAnalysis.correctiveActions.slice(0, 150)}...
                                  </div>
                                )}
                              </div>
                            ) : item.zStatus === "SATISFACTORY" ? (
                              <p className="text-[11px] text-muted-foreground italic">
                                Hasil memuaskan. Pertahankan pemeliharaan berkala instrumen dan kontrol IQC.
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground italic">Belum ada analisis evaluasi tersimpan.</p>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {item.capaActions && item.capaActions.length > 0 ? (
                              <Badge variant="outline" className="bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30 text-[10px]">
                                {item.capaActions[0].status}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
