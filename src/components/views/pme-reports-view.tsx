"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  Download,
  FileBarChart,
  Layers,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Calendar,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  Activity,
  ShieldCheck,
  Award,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface EvaluationRow {
  no: number;
  parameterName: string;
  unit: string;
  methodCode: string;
  instrumentCode: string;
  participantValue: number | null;
  global: {
    n: number;
    target: number | null;
    sdpa: number | null;
    zScore: number | null;
    category: string;
    keterangan: string;
  };
  method: {
    n: number;
    target: number | null;
    sdpa: number | null;
    zScore: number | null;
    category: string;
    keterangan: string;
    isAnalyzed: boolean;
  };
  instrument: {
    n: number;
    target: number | null;
    sdpa: number | null;
    zScore: number | null;
    category: string;
    keterangan: string;
    isAnalyzed: boolean;
  };
  biasPercent: number | null;
  cvPercent: number | null;
  totalErrorPercent: number | null;
  outlierStatus: string;
}

interface ParticipantReport {
  participant: {
    id: string;
    participantCode: string | null;
    labName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  cycle: string;
  period: string | null;
  submittedAt: string;
  category: string;
  rows: EvaluationRow[];
  comments: string[];
}

interface DashboardStatItem {
  parameterName: string;
  unit: string | null;
  stats: {
    n: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    q1: number;
    q3: number;
    iqr: number;
    sdpa: number;
    mad: number;
    robustSd: number;
    cvPercent: number;
    innerLower: number;
    innerUpper: number;
    outerLower: number;
    outerUpper: number;
  } | null;
  dixon: {
    isApplicable: boolean;
    n: number;
    qTable: number | null;
    qMin: number | null;
    qMax: number | null;
    isLowOutlier: boolean;
    isHighOutlier: boolean;
    status: string;
  } | null;
}

export function PmeReportsView() {
  const { user, viewAsTenantId } = useAppStore();
  const { toast } = useToast();

  const printAreaRef = useRef<HTMLDivElement>(null);

  const [cycle, setCycle] = useState<string>("Siklus 2 2025");
  const [category, setCategory] = useState<string>("Kimia Klinik");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatItem[]>([]);
  const [participantReports, setParticipantReports] = useState<ParticipantReport[]>([]);
  const [kopSurat, setKopSurat] = useState<any>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const url = `/api/pme-mgmt/reports?cycle=${encodeURIComponent(cycle)}&category=${encodeURIComponent(category)}${
        selectedParticipantId !== "ALL" ? `&participantId=${selectedParticipantId}` : ""
      }`;

      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setDashboardStats(data.dashboardStats || []);
        setParticipantReports(data.participantReports || []);
        setKopSurat(data.kopSurat || null);
      } else {
        const err = await res.json();
        toast({ title: "Gagal memuat laporan", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Kesalahan jaringan", description: "Gagal mengambil data laporan.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [cycle, category, selectedParticipantId, viewAsTenantId]);

  const handlePrint = () => {
    window.print();
  };

  // Generate Official PDF Matching Kemenkes Labkesmas Palembang Format
  const handleDownloadPdf = (report: ParticipantReport) => {
    try {
      setIsExportingPdf(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;

      // 1. Header & Kop Surat
      let y = 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);

      // Kemenkes Logo Text or Official Header
      doc.text(kopSurat?.pemda || "Kementerian Kesehatan", margin, y);
      doc.setFontSize(12);
      doc.setTextColor(13, 122, 105);
      doc.text(kopSurat?.namaRumahSakit || "Labkesmas Palembang I", margin, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang", pageW - margin, y, { align: "right" });
      doc.text(kopSurat?.kontakRumahSakit || "(0711) 352 683 | bblabkesmaspalembang.go.id", pageW - margin, y + 4.5, { align: "right" });

      // Title Section
      y += 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const titleText = `HASIL EVALUASI BIDANG PATOLOGI PARAMETER ${category.toUpperCase()} ${cycle.toUpperCase()}`;
      doc.text(titleText, pageW / 2, y, { align: "center" });

      // Participant Metadata
      y += 6;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Kode Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.participant.participantCode || "-"}`, margin + 25, y);

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Nama Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.participant.labName}`, margin + 25, y);

      y += 4.5;
      doc.setFont("helvetica", "bold");
      doc.text("Alamat Peserta", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${report.participant.address || "Sumatera Selatan"}`, margin + 25, y);

      // 2. Multi-tier Table (Kemenkes Format)
      const tableData = report.rows.map((row) => {
        const valStr = row.participantValue !== null ? Number(row.participantValue).toFixed(2) : "-";

        // Global Target / Sdpa stacked
        const gTargetSdpa =
          row.global.target !== null && row.global.sdpa !== null
            ? `${row.global.target.toFixed(2)}\n${row.global.sdpa.toFixed(2)}`
            : "-";
        const gZ = row.global.zScore !== null ? row.global.zScore.toFixed(2) : "-";

        // Method Target / Sdpa stacked
        const mTargetSdpa =
          row.method.isAnalyzed && row.method.target !== null && row.method.sdpa !== null
            ? `${row.method.target.toFixed(2)}\n${row.method.sdpa.toFixed(2)}`
            : "-";
        const mZ = row.method.isAnalyzed && row.method.zScore !== null ? row.method.zScore.toFixed(2) : "-";

        // Instrument Target / Sdpa stacked
        const iTargetSdpa =
          row.instrument.isAnalyzed && row.instrument.target !== null && row.instrument.sdpa !== null
            ? `${row.instrument.target.toFixed(2)}\n${row.instrument.sdpa.toFixed(2)}`
            : "-";
        const iZ = row.instrument.isAnalyzed && row.instrument.zScore !== null ? row.instrument.zScore.toFixed(2) : "-";

        return [
          row.no.toString(),
          row.parameterName,
          row.methodCode || "-",
          row.instrumentCode || "-",
          valStr,
          // Seluruh Peserta
          row.global.n > 0 ? row.global.n.toString() : "-",
          gTargetSdpa,
          gZ,
          row.global.category,
          row.global.keterangan,
          // Kelompok Metode
          row.method.n > 0 ? row.method.n.toString() : "-",
          mTargetSdpa,
          mZ,
          row.method.category,
          row.method.keterangan,
          // Kelompok Alat
          row.instrument.n > 0 ? row.instrument.n.toString() : "-",
          iTargetSdpa,
          iZ,
          row.instrument.category,
          row.instrument.keterangan,
        ];
      });

      autoTable(doc, {
        startY: y + 5,
        theme: "grid",
        margin: { top: 12, right: margin, bottom: 25, left: margin },
        head: [
          [
            { content: "No", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
            { content: "Parameter", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
            { content: "Kode", colSpan: 2, styles: { halign: "center" } },
            { content: "Hasil Saudara", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
            { content: "Seluruh Peserta", colSpan: 5, styles: { halign: "center" } },
            { content: "Kelompok Metode", colSpan: 5, styles: { halign: "center" } },
            { content: "Kelompok Alat", colSpan: 5, styles: { halign: "center" } },
          ],
          [
            // Kode
            { content: "Metode", styles: { halign: "center" } },
            { content: "Alat", styles: { halign: "center" } },
            // Seluruh Peserta
            { content: "n", styles: { halign: "center" } },
            { content: "Target / Sdpa", styles: { halign: "center" } },
            { content: "Z Score", styles: { halign: "center" } },
            { content: "Kategori", styles: { halign: "center" } },
            { content: "Keterangan", styles: { halign: "center" } },
            // Kelompok Metode
            { content: "n", styles: { halign: "center" } },
            { content: "Target / Sdpa", styles: { halign: "center" } },
            { content: "Z Score", styles: { halign: "center" } },
            { content: "Kategori", styles: { halign: "center" } },
            { content: "Keterangan", styles: { halign: "center" } },
            // Kelompok Alat
            { content: "n", styles: { halign: "center" } },
            { content: "Target / Sdpa", styles: { halign: "center" } },
            { content: "Z Score", styles: { halign: "center" } },
            { content: "Kategori", styles: { halign: "center" } },
            { content: "Keterangan", styles: { halign: "center" } },
          ],
        ],
        body: tableData,
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [15, 23, 42],
          fontSize: 7,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
        },
        styles: {
          fontSize: 6.8,
          cellPadding: 1.2,
          valign: "middle",
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
        },
        columnStyles: {
          0: { cellWidth: 7, halign: "center" }, // No
          1: { cellWidth: 32, fontStyle: "bold" }, // Parameter
          2: { cellWidth: 11, halign: "center" }, // Kode Metode
          3: { cellWidth: 11, halign: "center" }, // Kode Alat
          4: { cellWidth: 15, halign: "center", fontStyle: "bold" }, // Hasil Saudara
          // Seluruh Peserta
          5: { cellWidth: 8, halign: "center" },
          6: { cellWidth: 16, halign: "center" },
          7: { cellWidth: 13, halign: "center", fontStyle: "bold" },
          8: { cellWidth: 12, halign: "center" },
          9: { cellWidth: 20, halign: "center" },
          // Kelompok Metode
          10: { cellWidth: 8, halign: "center" },
          11: { cellWidth: 16, halign: "center" },
          12: { cellWidth: 13, halign: "center" },
          13: { cellWidth: 12, halign: "center" },
          14: { cellWidth: 20, halign: "center" },
          // Kelompok Alat
          15: { cellWidth: 8, halign: "center" },
          16: { cellWidth: 16, halign: "center" },
          17: { cellWidth: 13, halign: "center" },
          18: { cellWidth: 12, halign: "center" },
          19: { cellWidth: 20, halign: "center" },
        },
        didDrawPage: (data) => {
          // Watermark RAHASIA
          doc.saveGraphicsState();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(75);
          doc.setTextColor(239, 68, 68);
          // Set transparency if supported
          try {
            // @ts-ignore
            doc.setGState(new doc.GState({ opacity: 0.08 }));
          } catch {}
          doc.text("RAHASIA", pageW / 2, pageH / 2 + 10, {
            align: "center",
            angle: 25,
          });
          doc.restoreGraphicsState();

          // Footer
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(
            "* Hasil bersifat rahasia, hanya dapat diunduh oleh peserta melalui aplikasi menggunakan akun masing-masing",
            margin,
            pageH - 6
          );
          doc.text("pme.bblabkesmaspalembang.go.id", pageW - margin, pageH - 6, { align: "right" });
        },
      });

      // 3. Comments & Signature Section below table
      // @ts-ignore
      let finalY = (doc as any).lastAutoTable?.finalY + 5 || y + 80;
      if (finalY > pageH - 40) {
        doc.addPage("a4", "landscape");
        finalY = 20;
      }

      // Komentar / Saran
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("Komentar / Saran", margin, finalY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      let cY = finalY + 4;
      report.comments.forEach((c) => {
        doc.text(`• ${c}`, margin + 2, cY);
        cY += 3.8;
      });

      // Signature Block
      const sigX = pageW - margin - 60;
      let sigY = finalY + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Palembang, 14 November 2025", sigX, sigY);
      sigY += 4;
      doc.text("Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan", sigX, sigY);
      sigY += 15;
      doc.setFont("helvetica", "bold");
      doc.text("dr. Lisa Dewi, MKes", sigX, sigY);
      sigY += 3.5;
      doc.setFont("helvetica", "normal");
      doc.text("NIP 196907172001122001", sigX, sigY);

      doc.save(`Laporan_PME_${report.participant.labName.replace(/\s+/g, "_")}_${cycle.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "PDF Berhasil Diunduh", description: "Format lembar evaluasi resmi Kemenkes telah tersimpan." });
    } catch (err) {
      toast({ title: "Gagal membuat PDF", description: String(err), variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const activeReport = participantReports.length > 0 ? participantReports[0] : null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <FileBarChart className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Laporan Hasil PME</h1>
                <Badge variant="outline" className="bg-teal-600 text-white border-none text-[10px] font-mono">
                  Superadmin Only
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Rekapitulasi otomatis Z-score, SDPA, outlier ISO 13528, dan penerbitan lembar evaluasi resmi Kemenkes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" size="sm" onClick={loadReports} disabled={loading} className="text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Hitung Ulang
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs">
            <Printer className="mr-1.5 h-4 w-4 text-teal-700" />
            Cetak Halaman
          </Button>
          {activeReport && (
            <Button
              size="sm"
              onClick={() => handleDownloadPdf(activeReport)}
              disabled={isExportingPdf}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
            >
              {isExportingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              Unduh PDF Resmi
            </Button>
          )}
        </div>
      </div>

      {/* Filter Control Bar (No Print) */}
      <Card className="shadow-xs border no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>Siklus PME</span>
              </Label>
              <Input
                value={cycle}
                onChange={(e) => setCycle(e.target.value)}
                placeholder="Siklus 2 2025"
                className="h-8 text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-teal-600" />
                <span>Kategori Paket</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kimia Klinik">Kimia Klinik</SelectItem>
                  <SelectItem value="Hematologi">Hematologi</SelectItem>
                  <SelectItem value="Imunologi">Imunologi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                <span>Pilih Peserta</span>
              </Label>
              <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Peserta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Peserta ({participantReports.length})</SelectItem>
                  {participantReports.map((pr) => (
                    <SelectItem key={pr.participant.id} value={pr.participant.id} className="text-xs">
                      {pr.participant.participantCode ? `[${pr.participant.participantCode}] ` : ""}
                      {pr.participant.labName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-purple-600" />
                <span>Status Evaluasi</span>
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="SATISFACTORY">Hanya Memuaskan (OK)</SelectItem>
                  <SelectItem value="WARNING">Hanya Peringatan ($)</SelectItem>
                  <SelectItem value="UNSATISFACTORY">Hanya Tidak Memuaskan (ACTION)</SelectItem>
                  <SelectItem value="OUTLIER">Hanya Outlier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Biostatistical Summary Banner */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
          <Card className="p-3 border shadow-xs bg-card">
            <p className="text-[11px] text-muted-foreground font-medium">Peserta Mengirim</p>
            <h4 className="text-xl font-bold mt-1 text-foreground">{summary.totalParticipants} Lab</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Memuaskan (|Z| ≤ 2)</p>
            <h4 className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{summary.totalSatisfactory}</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/20">
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Peringatan (2 &lt; |Z| &lt; 3)</p>
            <h4 className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{summary.totalWarning}</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-red-50/50 dark:bg-red-950/20 border-red-500/20">
            <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">Tdk Memuaskan (|Z| ≥ 3)</p>
            <h4 className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">{summary.totalUnsatisfactory}</h4>
          </Card>
          <Card className="p-3 border shadow-xs bg-purple-50/50 dark:bg-purple-950/20 border-purple-500/20 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">Tingkat Kelulusan</p>
            <h4 className="text-xl font-bold mt-1 text-purple-700 dark:text-purple-400">{summary.passRate}%</h4>
          </Card>
        </div>
      )}

      <Tabs defaultValue="report" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 no-print">
          <TabsTrigger value="report" className="text-xs flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-teal-600" />
            <span>Lembar Laporan Resmi Kemenkes</span>
          </TabsTrigger>
          <TabsTrigger value="biostats" className="text-xs flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-blue-600" />
            <span>Dashboard Statistik & Uji Outlier (ISO 13528)</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LEMBAR EVALUASI RESMI FORMAT KEMENKES LABKESMAS PALEMBANG I */}
        <TabsContent value="report" className="space-y-6">
          {loading ? (
            <Card className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-600" />
              <span>Menghitung biostatistik ISO 13528 & menyusun laporan resmi...</span>
            </Card>
          ) : participantReports.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground italic">
              Belum ada data hasil PME yang dikirim untuk siklus dan kategori ini. Silakan input hasil terlebih dahulu di submenu Input Hasil PME.
            </Card>
          ) : (
            participantReports.map((report) => (
              <div
                key={report.participant.id}
                ref={printAreaRef}
                className="relative bg-white text-black p-8 rounded-xl shadow-md border print:border-none print:shadow-none print:p-0 print:m-0 overflow-hidden"
              >
                {/* Watermark Diagonal RAHASIA */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none overflow-hidden">
                  <span className="text-[130px] font-extrabold text-red-500/10 dark:text-red-500/5 rotate-[-25deg] tracking-widest uppercase">
                    RAHASIA
                  </span>
                </div>

                {/* Header Instansi Penyelenggara */}
                <div className="flex items-start justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-700 font-bold text-lg border">
                      <ShieldCheck className="h-7 w-7 text-teal-700" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold tracking-tight text-slate-800">
                        {kopSurat?.pemda || "Kementerian Kesehatan Republik Indonesia"}
                      </h2>
                      <h3 className="text-base font-extrabold text-teal-800">
                        {kopSurat?.namaRumahSakit || "Balai Besar Laboratorium Kesehatan Masyarakat (Labkesmas Palembang I)"}
                      </h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {kopSurat?.alamatRumahSakit || "Jl. Inspektur Yazid No.2, Sekip Jaya, Palembang, Sumatera Selatan"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-gray-500 leading-tight">
                    <p>{kopSurat?.kontakRumahSakit || "Telp: (0711) 352 683 / 0811 7165 777"}</p>
                    <p className="font-semibold text-teal-700">bblabkesmaspalembang.go.id</p>
                  </div>
                </div>

                {/* Title & Metadata Peserta */}
                <div className="my-5 text-center">
                  <h3 className="text-sm font-extrabold tracking-wide uppercase text-slate-900">
                    HASIL EVALUASI BIDANG PATOLOGI PARAMETER {category.toUpperCase()} {cycle.toUpperCase()}
                  </h3>
                </div>

                <div className="mb-4 text-xs grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <span className="w-28 font-bold text-gray-700">Kode Peserta:</span>
                      <span className="font-mono font-bold text-teal-800">
                        {report.participant.participantCode || "-"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-28 font-bold text-gray-700">Nama Peserta:</span>
                      <span className="font-semibold text-slate-900">{report.participant.labName}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <span className="w-28 font-bold text-gray-700">Alamat Peserta:</span>
                      <span className="text-gray-700">{report.participant.address || "Sumatera Selatan"}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-28 font-bold text-gray-700">Waktu Pengiriman:</span>
                      <span className="text-gray-600 font-mono">
                        {new Date(report.submittedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Table Format Multi-kelompok Standar Kemenkes */}
                <div className="overflow-x-auto border border-slate-300 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-center">
                        <th rowSpan={2} className="p-2 border-r border-slate-300 w-9">No</th>
                        <th rowSpan={2} className="p-2 border-r border-slate-300 min-w-[130px] text-left">Parameter</th>
                        <th colSpan={2} className="p-1.5 border-r border-slate-300">Kode</th>
                        <th rowSpan={2} className="p-2 border-r border-slate-300 w-20">Hasil Saudara</th>
                        <th colSpan={5} className="p-1.5 border-r border-slate-300 bg-teal-50/50">Seluruh Peserta</th>
                        <th colSpan={5} className="p-1.5 border-r border-slate-300 bg-blue-50/50">Kelompok Metode</th>
                        <th colSpan={5} className="p-1.5 bg-purple-50/50">Kelompok Alat</th>
                      </tr>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-semibold text-slate-700 text-center">
                        {/* Kode */}
                        <th className="p-1 border-r border-slate-300 w-12">Metode</th>
                        <th className="p-1 border-r border-slate-300 w-12">Alat</th>
                        {/* Seluruh Peserta */}
                        <th className="p-1 border-r border-slate-300 w-9 bg-teal-50/50">n</th>
                        <th className="p-1 border-r border-slate-300 w-20 bg-teal-50/50">Target<br />Sdpa</th>
                        <th className="p-1 border-r border-slate-300 w-14 bg-teal-50/50">Z Score</th>
                        <th className="p-1 border-r border-slate-300 w-14 bg-teal-50/50">Kategori</th>
                        <th className="p-1 border-r border-slate-300 w-22 bg-teal-50/50">Keterangan</th>
                        {/* Kelompok Metode */}
                        <th className="p-1 border-r border-slate-300 w-9 bg-blue-50/50">n</th>
                        <th className="p-1 border-r border-slate-300 w-20 bg-blue-50/50">Target<br />Sdpa</th>
                        <th className="p-1 border-r border-slate-300 w-14 bg-blue-50/50">Z Score</th>
                        <th className="p-1 border-r border-slate-300 w-14 bg-blue-50/50">Kategori</th>
                        <th className="p-1 border-r border-slate-300 w-22 bg-blue-50/50">Keterangan</th>
                        {/* Kelompok Alat */}
                        <th className="p-1 border-r border-slate-300 w-9 bg-purple-50/50">n</th>
                        <th className="p-1 border-r border-slate-300 w-20 bg-purple-50/50">Target<br />Sdpa</th>
                        <th className="p-1 border-r border-slate-300 w-14 bg-purple-50/50">Z Score</th>
                        <th className="p-1 border-r border-slate-300 w-14 bg-purple-50/50">Kategori</th>
                        <th className="p-1 bg-purple-50/50 w-22">Keterangan</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {report.rows.map((row) => {
                        const isWarn = row.global.keterangan === "Peringatan";
                        const isAction = row.global.keterangan === "Tidak Memuaskan";

                        return (
                          <tr
                            key={row.no}
                            className={`text-slate-800 hover:bg-slate-50/60 ${
                              isAction ? "bg-red-50/40" : isWarn ? "bg-amber-50/30" : ""
                            }`}
                          >
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">{row.no}</td>
                            <td className="p-1.5 border-r border-slate-200 font-semibold">{row.parameterName}</td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">{row.methodCode}</td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">{row.instrumentCode}</td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono font-bold">
                              {row.participantValue !== null ? row.participantValue.toFixed(2) : "-"}
                            </td>

                            {/* Seluruh Peserta */}
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.global.n > 0 ? row.global.n : "-"}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono leading-tight">
                              {row.global.target !== null ? (
                                <div>
                                  <span className="font-bold">{row.global.target.toFixed(2)}</span>
                                  <div className="text-[9.5px] text-gray-500 border-t border-dotted border-gray-300 mt-0.5">
                                    {row.global.sdpa !== null ? row.global.sdpa.toFixed(2) : "-"}
                                  </div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono font-bold">
                              <span
                                className={
                                  isAction ? "text-red-700" : isWarn ? "text-amber-700" : "text-emerald-700"
                                }
                              >
                                {row.global.zScore !== null ? (row.global.zScore > 0 ? `+${row.global.zScore.toFixed(2)}` : row.global.zScore.toFixed(2)) : "-"}
                              </span>
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono font-semibold">
                              {row.global.category}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 text-[10px] font-medium">
                              {row.global.keterangan}
                            </td>

                            {/* Kelompok Metode */}
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.method.n > 0 ? row.method.n : "-"}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono leading-tight">
                              {row.method.isAnalyzed && row.method.target !== null ? (
                                <div>
                                  <span className="font-bold">{row.method.target.toFixed(2)}</span>
                                  <div className="text-[9.5px] text-gray-500 border-t border-dotted border-gray-300 mt-0.5">
                                    {row.method.sdpa !== null ? row.method.sdpa.toFixed(2) : "-"}
                                  </div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.method.isAnalyzed && row.method.zScore !== null
                                ? row.method.zScore > 0 ? `+${row.method.zScore.toFixed(2)}` : row.method.zScore.toFixed(2)
                                : "-"}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.method.isAnalyzed ? row.method.category : "-"}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 text-[10px]">
                              {row.method.keterangan}
                            </td>

                            {/* Kelompok Alat */}
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.instrument.n > 0 ? row.instrument.n : "-"}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono leading-tight">
                              {row.instrument.isAnalyzed && row.instrument.target !== null ? (
                                <div>
                                  <span className="font-bold">{row.instrument.target.toFixed(2)}</span>
                                  <div className="text-[9.5px] text-gray-500 border-t border-dotted border-gray-300 mt-0.5">
                                    {row.instrument.sdpa !== null ? row.instrument.sdpa.toFixed(2) : "-"}
                                  </div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.instrument.isAnalyzed && row.instrument.zScore !== null
                                ? row.instrument.zScore > 0 ? `+${row.instrument.zScore.toFixed(2)}` : row.instrument.zScore.toFixed(2)
                                : "-"}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-200 font-mono">
                              {row.instrument.isAnalyzed ? row.instrument.category : "-"}
                            </td>
                            <td className="p-1.5 text-center text-[10px]">
                              {row.instrument.keterangan}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Komentar / Saran & Pengesahan */}
                <div className="mt-6 pt-2 flex flex-col md:flex-row justify-between items-start gap-6 text-xs text-slate-800">
                  <div className="space-y-1.5 max-w-lg">
                    <h4 className="font-bold text-slate-900">Komentar / Saran</h4>
                    <div className="text-[11px] text-gray-700 space-y-1 leading-relaxed">
                      {report.comments.map((c, i) => (
                        <p key={i}>• {c}</p>
                      ))}
                    </div>
                  </div>

                  <div className="text-right min-w-[240px] space-y-1 text-slate-900">
                    <p>Palembang, 14 November 2025</p>
                    <p className="text-[11px] text-gray-600">Ketua Tim Kerja Mutu, Penguatan SDM dan Kemitraan</p>
                    <div className="h-14 flex items-center justify-end">
                      <span className="font-serif italic text-teal-800 text-lg">dr. Lisa Dewi</span>
                    </div>
                    <p className="font-bold">dr. Lisa Dewi, MKes</p>
                    <p className="text-[10px] text-gray-500 font-mono">NIP 196907172001122001</p>
                  </div>
                </div>

                <div className="mt-8 pt-3 border-t text-[10px] text-gray-400 flex justify-between items-center italic">
                  <span>* Hasil bersifat rahasia, hanya dapat diunduh oleh peserta melalui aplikasi menggunakan akun masing-masing</span>
                  <span>pme.bblabkesmaspalembang.go.id</span>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* TAB 2: DASHBOARD STATISTIK & DETEKSI OUTLIER (ISO 13528 / DIXON) */}
        <TabsContent value="biostats" className="space-y-6 no-print">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Tabel Analisis Biostatistik Robust ISO 13528 & Deteksi Pencilan</CardTitle>
              <CardDescription className="text-xs">
                Perhitungan nilai target ($X_{'{pt}'}$ Median), IQR, SDPA, Robust SD Algoritma A, dan Uji Dixon Q-Test
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5 min-w-[140px]">Parameter</th>
                      <th className="p-2.5 w-14 text-center">N</th>
                      <th className="p-2.5 w-20 text-center">Min - Max</th>
                      <th className="p-2.5 w-20 text-center">Rerata</th>
                      <th className="p-2.5 w-24 text-center font-bold text-teal-800 dark:text-teal-300">Target (Median)</th>
                      <th className="p-2.5 w-16 text-center">IQR</th>
                      <th className="p-2.5 w-20 text-center font-bold text-blue-800 dark:text-blue-300">SDPA (nIQR)</th>
                      <th className="p-2.5 w-20 text-center">Robust SD</th>
                      <th className="p-2.5 w-16 text-center">CV %</th>
                      <th className="p-2.5 w-36 text-center">Rentang Tukey (Inner)</th>
                      <th className="p-2.5 min-w-[180px]">Uji Dixon Q-Test (N ≤ 25)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dashboardStats.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-semibold text-foreground">{item.parameterName}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">{item.unit || ""}</span>
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats?.n || 0}</td>
                        <td className="p-2.5 text-center font-mono text-[11px]">
                          {item.stats ? `${item.stats.min.toFixed(2)} - ${item.stats.max.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? item.stats.mean.toFixed(2) : "-"}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-teal-700 dark:text-teal-400">
                          {item.stats ? item.stats.median.toFixed(2) : "-"}
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? item.stats.iqr.toFixed(2) : "-"}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-blue-700 dark:text-blue-400">
                          {item.stats ? item.stats.sdpa.toFixed(2) : "-"}
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? item.stats.robustSd.toFixed(2) : "-"}</td>
                        <td className="p-2.5 text-center font-mono">{item.stats ? `${item.stats.cvPercent.toFixed(2)}%` : "-"}</td>
                        <td className="p-2.5 text-center font-mono text-[10px]">
                          {item.stats ? `${item.stats.innerLower.toFixed(2)} s.d ${item.stats.innerUpper.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2.5 text-[11px]">
                          {item.dixon?.isApplicable ? (
                            <div className="space-y-0.5">
                              <span
                                className={`font-semibold ${
                                  item.dixon.isLowOutlier || item.dixon.isHighOutlier
                                    ? "text-red-600 font-bold"
                                    : "text-emerald-600"
                                }`}
                              >
                                {item.dixon.status}
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                Q-Tab: {item.dixon.qTable} | Q-Min: {item.dixon.qMin} | Q-Max: {item.dixon.qMax}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">
                              {item.dixon?.status || "N > 25 (Gunakan ISO 13528)"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
