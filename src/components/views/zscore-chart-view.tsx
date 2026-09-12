"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ReportItemData } from "@/types/pme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Activity,
  Maximize2,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Dot,
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ZScoreChartViewProps {
  items: ReportItemData[];
  summary: {
    total: number;
    satisfactory: number;
    warning: number;
    unsatisfactory: number;
    reviewRequired: number;
  };
  filterMeta: {
    program?: string;
    cycle?: string;
    period?: string;
    labName?: string | null;
  };
}

interface ChartDataItem {
  name: string;
  fullName: string;
  zScore: number | null;
  instrumentZScore: number | null;
  methodZScore: number | null;
  participantValue: number | null;
  targetValue: number | null;
  sdpa: number | null;
  unit: string | null;
  zStatus: string | null;
  instrument: string | null;
  method: string | null;
  interpretation?: string;
}

export function ZScoreChartView({ items, summary, filterMeta }: ZScoreChartViewProps) {
  const { toast } = useToast();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // View Options
  const [selectedSeries, setSelectedSeries] = useState<"all" | "global" | "instrument" | "method">("all");
  const [showLabels, setShowLabels] = useState(true);
  const [printDate, setPrintDate] = useState("");

  useEffect(() => {
    setMounted(true);
    try {
      setPrintDate(
        new Date().toLocaleString("id-ID", {
          dateStyle: "long",
          timeStyle: "short",
        })
      );
    } catch {
      setPrintDate(new Date().toLocaleString("id-ID"));
    }
  }, []);

  // Format data for chart
  const chartData = useMemo<ChartDataItem[]>(() => {
    return items.map((item) => {
      const z = typeof item.zScore === "number" && !isNaN(item.zScore) ? Number(item.zScore.toFixed(2)) : null;
      const instZ =
        typeof item.instrumentZScore === "number" && !isNaN(item.instrumentZScore)
          ? Number(item.instrumentZScore.toFixed(2))
          : null;
      const metZ =
        typeof item.methodZScore === "number" && !isNaN(item.methodZScore)
          ? Number(item.methodZScore.toFixed(2))
          : null;

      return {
        name: item.parameterName.length > 14 ? `${item.parameterName.slice(0, 12)}..` : item.parameterName,
        fullName: item.parameterName,
        zScore: z,
        instrumentZScore: instZ,
        methodZScore: metZ,
        participantValue: item.participantValue ?? null,
        targetValue: item.targetValue ?? null,
        sdpa: item.sdpa ?? null,
        unit: item.unit ?? null,
        zStatus: item.zStatus ?? null,
        instrument: item.instrument ?? null,
        method: item.method ?? null,
        interpretation: item.aiAnalysis?.interpretation,
      };
    });
  }, [items]);

  // Compute dynamic Y-axis domain
  const { yMin, yMax } = useMemo(() => {
    let min = -4.0;
    let max = 4.0;
    chartData.forEach((d) => {
      [d.zScore, d.instrumentZScore, d.methodZScore].forEach((val) => {
        if (typeof val === "number") {
          if (val < min) min = Math.floor(val - 0.5);
          if (val > max) max = Math.ceil(val + 0.5);
        }
      });
    });
    return { yMin: Math.min(-4, min), yMax: Math.max(4, max) };
  }, [chartData]);

  // Handler Print
  const handlePrint = () => {
    window.print();
  };

  // Convert SVG to Base64 PNG image
  const captureChartSvg = async (): Promise<string | null> => {
    if (!chartContainerRef.current) return null;
    const svgEl = chartContainerRef.current.querySelector("svg");
    if (!svgEl) return null;

    try {
      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
      const svgRect = svgEl.getBoundingClientRect();
      const width = svgRect.width || 1000;
      const height = svgRect.height || 420;

      clonedSvg.setAttribute("width", `${width}`);
      clonedSvg.setAttribute("height", `${height}`);
      clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

      // Inline styles for text and lines so it renders properly in canvas
      const origEls = svgEl.querySelectorAll("*");
      const cloneEls = clonedSvg.querySelectorAll("*");
      for (let i = 0; i < cloneEls.length; i++) {
        const orig = origEls[i] as HTMLElement | SVGElement;
        const clone = cloneEls[i] as HTMLElement | SVGElement;
        if (orig && clone) {
          const comp = window.getComputedStyle(orig);
          if (comp.fill) clone.setAttribute("fill", comp.fill);
          if (comp.stroke) clone.setAttribute("stroke", comp.stroke);
          if (comp.fontSize) (clone as HTMLElement).style.fontSize = comp.fontSize;
          if (comp.fontFamily) (clone as HTMLElement).style.fontFamily = comp.fontFamily;
        }
      }

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clonedSvg);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      return await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = 2.5; // High-resolution rasterization
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          // White background
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    } catch (e) {
      console.error("Gagal menangkap SVG grafik:", e);
      return null;
    }
  };

  // Handler PDF Export
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4", // 297mm x 210mm
      });

      const pageW = doc.internal.pageSize.getWidth(); // 297
      const pageH = doc.internal.pageSize.getHeight(); // 210
      const margin = 14;
      const contentW = pageW - margin * 2; // 269mm

      // Header Banner
      doc.setFillColor(13, 122, 105); // Teal branding
      doc.rect(0, 0, pageW, 26, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("di-dismartPME — SISTEM EVALUASI MUTU LABORATORIUM", margin, 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("LAPORAN GRAFIK KENDALI MUTU Z-SCORE (LEVEY-JENNINGS)", margin, 18);

      const printDateStr = new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.setFontSize(8.5);
      doc.text(`Waktu Cetak: ${printDateStr}`, pageW - margin, 18, { align: "right" });

      // Metadata Bar
      let y = 32;
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("INFORMASI EVALUASI:", margin, y);
      doc.setFont("helvetica", "normal");
      const labTitle = filterMeta.labName || "Laboratorium Peserta PME";
      const progTitle = filterMeta.program || "Seluruh Program";
      const cycleTitle = filterMeta.cycle ? `Siklus ${filterMeta.cycle}` : "-";
      const periodTitle = filterMeta.period ? `Periode ${filterMeta.period}` : "-";

      doc.text(
        `Laboratorium: ${labTitle}  |  Program: ${progTitle}  |  Siklus/Periode: ${cycleTitle} (${periodTitle})`,
        margin + 36,
        y
      );

      // KPI Summary Pill Box
      y += 6;
      const kpiBoxW = contentW / 4 - 3;
      const kpiHeight = 10;

      // Box 1: Total
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, y, kpiBoxW, kpiHeight, 2, 2, "F");
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`Total Parameter: ${summary.total}`, margin + 4, y + 6.5);

      // Box 2: Memuaskan
      doc.setFillColor(209, 250, 229);
      doc.roundedRect(margin + kpiBoxW + 4, y, kpiBoxW, kpiHeight, 2, 2, "F");
      doc.setTextColor(6, 95, 70);
      doc.text(`Memuaskan (|Z|<=2): ${summary.satisfactory}`, margin + kpiBoxW + 8, y + 6.5);

      // Box 3: Waspada
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(margin + (kpiBoxW + 4) * 2, y, kpiBoxW, kpiHeight, 2, 2, "F");
      doc.setTextColor(146, 64, 14);
      doc.text(`Waspada (2<|Z|<3): ${summary.warning}`, margin + (kpiBoxW + 4) * 2 + 8, y + 6.5);

      // Box 4: Tidak Memuaskan
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(margin + (kpiBoxW + 4) * 3, y, kpiBoxW, kpiHeight, 2, 2, "F");
      doc.setTextColor(153, 27, 27);
      doc.text(`Tdk Memuaskan (|Z|>=3): ${summary.unsatisfactory}`, margin + (kpiBoxW + 4) * 3 + 8, y + 6.5);

      // Render Captured Chart Image
      y += 14;
      const chartImg = await captureChartSvg();
      const chartHeight = 96; // mm
      if (chartImg) {
        doc.addImage(chartImg, "PNG", margin, y, contentW, chartHeight);
      } else {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, contentW, chartHeight, 2, 2, "F");
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text("Grafik Levey-Jennings disajikan dalam lampiran sistem.", pageW / 2, y + chartHeight / 2, {
          align: "center",
        });
      }

      // Legend Description below chart
      y += chartHeight + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Keterangan Batas Mutu: [Garis Hijau] Target (Z=0)  |  [Garis Kuning] Batas Peringatan (±2.0 SD)  |  [Garis Merah] Batas Tindakan/Kontrol (±3.0 SD - Wajib CAPA)",
        margin,
        y
      );

      // Page 2: Table of Coordinate Details
      doc.addPage("a4", "landscape");

      // Page 2 Header
      doc.setFillColor(13, 122, 105);
      doc.rect(0, 0, pageW, 14, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("di-dismartPME — TABEL REKAPITULASI DATA KOORDINAT Z-SCORE", margin, 9.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Halaman 2  |  Dicetak: ${printDateStr}`, pageW - margin, 9.5, { align: "right" });

      const tableRows = items.map((it, idx) => {
        const zG = typeof it.zScore === "number" && !isNaN(it.zScore) ? (it.zScore > 0 ? `+${it.zScore.toFixed(2)}` : it.zScore.toFixed(2)) : "-";
        const zA = typeof it.instrumentZScore === "number" && !isNaN(it.instrumentZScore) ? (it.instrumentZScore > 0 ? `+${it.instrumentZScore.toFixed(2)}` : it.instrumentZScore.toFixed(2)) : "-";
        const zM = typeof it.methodZScore === "number" && !isNaN(it.methodZScore) ? (it.methodZScore > 0 ? `+${it.methodZScore.toFixed(2)}` : it.methodZScore.toFixed(2)) : "-";
        
        let statusText = it.zStatus || "-";
        if (statusText === "SATISFACTORY") statusText = "Memuaskan";
        else if (statusText === "WARNING") statusText = "Peringatan";
        else if (statusText === "UNSATISFACTORY") statusText = "Tdk Memuaskan";

        return [
          (idx + 1).toString(),
          it.parameterName,
          it.participantValue !== null && it.participantValue !== undefined ? `${it.participantValue} ${it.unit || ""}` : "-",
          it.targetValue !== null && it.targetValue !== undefined ? `${it.targetValue}` : "-",
          it.sdpa !== null && it.sdpa !== undefined ? `${it.sdpa}` : "-",
          zG,
          zA,
          zM,
          statusText,
          it.aiAnalysis?.interpretation ? it.aiAnalysis.interpretation.slice(0, 80) + "..." : "-",
        ];
      });

      autoTable(doc, {
        startY: 19,
        theme: "grid",
        head: [
          [
            "No",
            "Sasaran / Parameter",
            "Hasil Peserta",
            "Target (Mean)",
            "SDPA",
            "Z-Score (Global)",
            "Z-Score (Alat)",
            "Z-Score (Metode)",
            "Status Evaluasi",
            "Interpretasi Evaluasi",
          ],
        ],
        body: tableRows,
        headStyles: {
          fillColor: [13, 122, 105],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { halign: "left", cellWidth: 42, fontStyle: "bold" },
          2: { halign: "center", cellWidth: 26 },
          3: { halign: "center", cellWidth: 22 },
          4: { halign: "center", cellWidth: 18 },
          5: { halign: "center", cellWidth: 24, fontStyle: "bold" },
          6: { halign: "center", cellWidth: 24 },
          7: { halign: "center", cellWidth: 24 },
          8: { halign: "center", cellWidth: 26 },
          9: { halign: "left" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && (data.column.index === 5 || data.column.index === 8)) {
            const val = data.cell.raw as string;
            if (val.includes("Tdk Memuaskan") || (data.column.index === 5 && (val.startsWith("-3") || val.startsWith("+3") || val.startsWith("-4") || val.startsWith("+4")))) {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            } else if (val.includes("Peringatan") || (data.column.index === 5 && (val.startsWith("-2") || val.startsWith("+2")))) {
              data.cell.styles.textColor = [180, 83, 9];
              data.cell.styles.fontStyle = "bold";
            } else if (val.includes("Memuaskan")) {
              data.cell.styles.textColor = [4, 120, 87];
            }
          }
        },
      });

      // Signature Block at Bottom
      // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
      const lastY = doc.lastAutoTable?.finalY ?? 150;
      const signY = lastY + 12 < pageH - 25 ? lastY + 12 : pageH - 25;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);

      doc.text("Dianalisis Oleh:", margin + 20, signY);
      doc.text("( Pranata Laboratorium Kesehatan )", margin + 20, signY + 18);

      doc.text("Disetujui & Diverifikasi Oleh:", pageW - margin - 65, signY);
      doc.text("( Penanggung Jawab Teknis Mutu )", pageW - margin - 65, signY + 18);

      // Save PDF
      const progClean = (filterMeta.program || "pme").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const fileName = `grafik-zscore-levey-jennings-${progClean}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Berhasil Dibuat",
        description: `Berkas ${fileName} berhasil diunduh tanpa bagian yang terpotong.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Gagal Membuat PDF",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat memproses PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Custom Dot for Main Z-Score Line
  const renderCustomDot = (props: { cx?: number; cy?: number; payload?: ChartDataItem }) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload || payload.zScore === null) return null;

    const z = payload.zScore;
    const absZ = Math.abs(z);

    let fill = "#10b981"; // Green (Satisfactory)
    let stroke = "#047857";
    if (absZ >= 3.0) {
      fill = "#ef4444"; // Red (Unsatisfactory)
      stroke = "#b91c1c";
    } else if (absZ > 2.0) {
      fill = "#f59e0b"; // Yellow (Warning)
      stroke = "#b45309";
    }

    return (
      <g key={`dot-${payload.name}-${cx}`}>
        <circle cx={cx} cy={cy} r={6} fill={fill} stroke={stroke} strokeWidth={2} />
        {showLabels && (
          <text
            x={cx}
            y={z >= 0 ? cy - 10 : cy + 15}
            textAnchor="middle"
            fill={stroke}
            fontSize={10}
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {z > 0 ? `+${z}` : `${z}`}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6 print-container">
      {/* PRINT-ONLY HEADER (Appears ONLY during browser print) */}
      <div className="print-only mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-teal-800 tracking-tight">
              di-dismartPME — SISTEM EVALUASI MUTU LABORATORIUM
            </h1>
            <h2 className="text-sm font-bold text-gray-700">
              LAPORAN GRAFIK KENDALI MUTU Z-SCORE (LEVEY-JENNINGS)
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Laboratorium: {filterMeta.labName || "Laboratorium Peserta"} | Program: {filterMeta.program || "Semua"} | Siklus: {filterMeta.cycle || "-"} | Periode: {filterMeta.period || "-"}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Tanggal Cetak: {printDate || "-"}</p>
            <p className="font-semibold text-gray-700">Total: {summary.total} Parameter</p>
          </div>
        </div>
      </div>

      {/* Action Header & Series Filter Bar (Hidden on print) */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-700" />
            <h3 className="text-lg font-bold tracking-tight">Grafik Kendali Mutu Z-Score (Levey-Jennings)</h3>
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-xs">
              ISO 13528
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plot distribusi Z-score antar parameter laboratorium dengan batas peringatan (±2 SD) dan batas kendali tindakan (±3 SD).
          </p>
        </div>

        {/* Buttons & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Series Toggle Selector */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-1 text-xs">
            <button
              onClick={() => setSelectedSeries("all")}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                selectedSeries === "all"
                  ? "bg-white dark:bg-zinc-800 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua Seri
            </button>
            <button
              onClick={() => setSelectedSeries("global")}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                selectedSeries === "global"
                  ? "bg-white dark:bg-zinc-800 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Z-Global
            </button>
            <button
              onClick={() => setSelectedSeries("instrument")}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                selectedSeries === "instrument"
                  ? "bg-white dark:bg-zinc-800 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Z-Alat
            </button>
            <button
              onClick={() => setSelectedSeries("method")}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                selectedSeries === "method"
                  ? "bg-white dark:bg-zinc-800 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Z-Metode
            </button>
          </div>

          {/* Label Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLabels(!showLabels)}
            className={`text-xs h-8 ${showLabels ? "border-teal-500/40 text-teal-700" : "text-muted-foreground"}`}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            {showLabels ? "Label Z: Aktif" : "Label Z: Nonaktif"}
          </Button>

          {/* Print Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 border-teal-600 text-teal-800 dark:text-teal-300 hover:bg-teal-50 text-xs"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-teal-600" />
            Cetak Grafik (Print)
          </Button>

          {/* Download PDF Button */}
          <Button
            variant="default"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf || items.length === 0}
            className="h-8 bg-teal-700 hover:bg-teal-800 text-white text-xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {isExportingPdf ? "Memproses PDF..." : "Unduh PDF Grafik"}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards & Zone Legend Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Zona Terkendali</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{summary.satisfactory}</span>
            <span className="text-[11px] text-emerald-600/80">parameter (|Z| ≤ 2.0)</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Kinerja analitik memuaskan & presisi.</p>
        </Card>

        <Card className="p-3.5 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Zona Peringatan</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{summary.warning}</span>
            <span className="text-[11px] text-amber-600/80">parameter (2.0 &lt; |Z| &lt; 3.0)</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Waspada deviasi analitik 2 SD.</p>
        </Card>

        <Card className="p-3.5 border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800 dark:text-red-300">Zona Tindakan (Out)</span>
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-red-700 dark:text-red-300">{summary.unsatisfactory}</span>
            <span className="text-[11px] text-red-600/80">parameter (|Z| ≥ 3.0)</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Wajib investigasi akar masalah & CAPA.</p>
        </Card>

        <Card className="p-3.5 bg-muted/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Total Terfilter</span>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">{items.length}</span>
            <span className="text-[11px] text-muted-foreground">parameter aktif</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Rentang Z: {yMin.toFixed(1)} s/d +{yMax.toFixed(1)}</p>
        </Card>
      </div>

      {/* Main Levey-Jennings Chart Container */}
      <Card className="chart-print-area overflow-hidden border">
        <CardHeader className="pb-2 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Grafik Levey-Jennings: Posisi Z-Score Parameter Laboratorium
              </CardTitle>
              <CardDescription className="text-xs">
                Sumbu X: Nama Parameter Laboratorium · Sumbu Y: Deviasi Standar Z-Score
              </CardDescription>
            </div>

            {/* Legend indicators */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Memuaskan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Peringatan (±2 SD)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Tindakan (±3 SD)</span>
              </div>
              {(selectedSeries === "all" || selectedSeries === "instrument") && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-blue-500" />
                  <span className="text-muted-foreground">Z-Alat</span>
                </div>
              )}
              {(selectedSeries === "all" || selectedSeries === "method") && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-purple-500" />
                  <span className="text-muted-foreground">Z-Metode</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 pb-2">
          {!mounted ? (
            <div className="h-[430px] w-full flex items-center justify-center">
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Info className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">Tidak ada parameter yang sesuai dengan filter.</p>
              <p className="text-xs">Pilih filter sesi PME atau sesuaikan filter pencarian.</p>
            </div>
          ) : (
            <div ref={chartContainerRef} className="w-full h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 25, right: 35, left: 10, bottom: 55 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.6} />

                  {/* Levey-Jennings Background Tolerance Zones */}
                  {/* Top Action Red Zone: +3 SD up to yMax */}
                  <ReferenceArea y1={3.0} y2={yMax} fill="#fee2e2" fillOpacity={0.45} />
                  {/* Top Warning Yellow Zone: +2 SD to +3 SD */}
                  <ReferenceArea y1={2.0} y2={3.0} fill="#fef3c7" fillOpacity={0.45} />
                  {/* Center Green Controlled Zone: -2 SD to +2 SD */}
                  <ReferenceArea y1={-2.0} y2={2.0} fill="#d1fae5" fillOpacity={0.35} />
                  {/* Bottom Warning Yellow Zone: -3 SD to -2 SD */}
                  <ReferenceArea y1={-3.0} y2={-2.0} fill="#fef3c7" fillOpacity={0.45} />
                  {/* Bottom Action Red Zone: yMin down to -3 SD */}
                  <ReferenceArea y1={yMin} y2={-3.0} fill="#fee2e2" fillOpacity={0.45} />

                  {/* Horizontal Control Reference Lines */}
                  {/* Mean / Target: Z = 0 */}
                  <ReferenceLine
                    y={0}
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    label={{
                      value: "Target (Z = 0)",
                      position: "right",
                      fill: "#0d9488",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  />
                  {/* Warning Line: +2 SD */}
                  <ReferenceLine
                    y={2.0}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: "+2 SD (Peringatan)",
                      position: "right",
                      fill: "#b45309",
                      fontSize: 9,
                    }}
                  />
                  {/* Warning Line: -2 SD */}
                  <ReferenceLine
                    y={-2.0}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: "-2 SD (Peringatan)",
                      position: "right",
                      fill: "#b45309",
                      fontSize: 9,
                    }}
                  />
                  {/* Control / Action Line: +3 SD */}
                  <ReferenceLine
                    y={3.0}
                    stroke="#dc2626"
                    strokeDasharray="5 5"
                    strokeWidth={1.8}
                    label={{
                      value: "+3 SD (Tindakan/CAPA)",
                      position: "right",
                      fill: "#b91c1c",
                      fontSize: 9,
                      fontWeight: "bold",
                    }}
                  />
                  {/* Control / Action Line: -3 SD */}
                  <ReferenceLine
                    y={-3.0}
                    stroke="#dc2626"
                    strokeDasharray="5 5"
                    strokeWidth={1.8}
                    label={{
                      value: "-3 SD (Tindakan/CAPA)",
                      position: "right",
                      fill: "#b91c1c",
                      fontSize: 9,
                      fontWeight: "bold",
                    }}
                  />

                  {/* X Axis: Parameter Names */}
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
                    height={60}
                  />

                  {/* Y Axis: Z-Score scale */}
                  <YAxis
                    domain={[yMin, yMax]}
                    ticks={[-4, -3, -2, -1, 0, 1, 2, 3, 4]}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    label={{
                      value: "Z-Score",
                      angle: -90,
                      position: "insideLeft",
                      offset: 5,
                      fill: "#475569",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  />

                  {/* Custom Tooltip */}
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as ChartDataItem;
                      const z = data.zScore;

                      return (
                        <div className="rounded-lg border bg-white dark:bg-zinc-900 p-3 shadow-lg text-xs space-y-1.5 min-w-[220px]">
                          <p className="font-bold text-sm text-foreground border-b pb-1">
                            {data.fullName}
                          </p>
                          <div className="space-y-0.5 text-muted-foreground">
                            <p>
                              Hasil Lab:{" "}
                              <span className="font-semibold text-foreground font-mono">
                                {data.participantValue ?? "-"} {data.unit || ""}
                              </span>
                            </p>
                            <p>
                              Target (Mean):{" "}
                              <span className="font-mono text-foreground">{data.targetValue ?? "-"}</span>
                            </p>
                            {data.sdpa !== null && (
                              <p>
                                SDPA: <span className="font-mono text-foreground">{data.sdpa}</span>
                              </p>
                            )}
                          </div>

                          <div className="border-t pt-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">Z-Score Utama:</span>
                              <span
                                className={`font-mono font-bold ${
                                  z !== null && Math.abs(z) >= 3
                                    ? "text-red-600"
                                    : z !== null && Math.abs(z) > 2
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {z !== null ? (z > 0 ? `+${z.toFixed(2)}` : z.toFixed(2)) : "-"}
                              </span>
                            </div>

                            {data.instrumentZScore !== null && (
                              <div className="flex items-center justify-between text-blue-600">
                                <span>Z-Score Kel. Alat:</span>
                                <span className="font-mono font-bold">
                                  {data.instrumentZScore > 0
                                    ? `+${data.instrumentZScore.toFixed(2)}`
                                    : data.instrumentZScore.toFixed(2)}
                                </span>
                              </div>
                            )}

                            {data.methodZScore !== null && (
                              <div className="flex items-center justify-between text-purple-600">
                                <span>Z-Score Kel. Metode:</span>
                                <span className="font-mono font-bold">
                                  {data.methodZScore > 0
                                    ? `+${data.methodZScore.toFixed(2)}`
                                    : data.methodZScore.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>

                          {data.interpretation && (
                            <div className="border-t pt-1 text-[10px] text-muted-foreground italic">
                              {data.interpretation.slice(0, 100)}...
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />

                  {/* Instrument Group Line (Blue) */}
                  {(selectedSeries === "all" || selectedSeries === "instrument") && (
                    <Line
                      type="monotone"
                      dataKey="instrumentZScore"
                      name="Z-Alat"
                      stroke="#3b82f6"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      connectNulls
                      dot={{ r: 4, fill: "#3b82f6", stroke: "#1d4ed8" }}
                    />
                  )}

                  {/* Method Group Line (Purple) */}
                  {(selectedSeries === "all" || selectedSeries === "method") && (
                    <Line
                      type="monotone"
                      dataKey="methodZScore"
                      name="Z-Metode"
                      stroke="#8b5cf6"
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                      connectNulls
                      dot={{ r: 4, fill: "#8b5cf6", stroke: "#6d28d9" }}
                    />
                  )}

                  {/* Main Global Z-Score Line (Teal/Emerald) */}
                  {(selectedSeries === "all" || selectedSeries === "global") && (
                    <Line
                      type="monotone"
                      dataKey="zScore"
                      name="Z-Global"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      connectNulls
                      dot={renderCustomDot}
                      activeDot={{ r: 7, stroke: "#0f766e", strokeWidth: 2 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coordinate & Evaluation Table (Included in View and Print) */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Tabel Koordinat & Rekapitulasi Z-Score</CardTitle>
              <CardDescription className="text-xs">
                Rincian nilai numerik koordinat grafik untuk keperluan verifikasi dan audit mutu laboratorium.
              </CardDescription>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {items.length} Parameter Tercatat
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="max-h-[30rem] overflow-x-auto overflow-y-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur">
                <tr>
                  <th className="p-2.5 font-semibold text-muted-foreground w-10 text-center">No.</th>
                  <th className="p-2.5 font-semibold text-muted-foreground min-w-[160px]">Sasaran / Parameter</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Hasil Peserta</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-24 text-center">Target (Mean)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-20 text-center">SDPA</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Z-Score (Global)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Z-Score (Alat)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Z-Score (Metode)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Status Evaluasi</th>
                  <th className="p-2.5 font-semibold text-muted-foreground min-w-[220px]">Rekomendasi Mutu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, idx) => {
                  const z = item.zScore;
                  const zFormatted =
                    z !== null && z !== undefined
                      ? z > 0
                        ? `+${z.toFixed(2)}`
                        : z.toFixed(2)
                      : "-";
                  const zInstFormatted =
                    item.instrumentZScore !== null && item.instrumentZScore !== undefined
                      ? item.instrumentZScore > 0
                        ? `+${item.instrumentZScore.toFixed(2)}`
                        : item.instrumentZScore.toFixed(2)
                      : "-";
                  const zMetFormatted =
                    item.methodZScore !== null && item.methodZScore !== undefined
                      ? item.methodZScore > 0
                        ? `+${item.methodZScore.toFixed(2)}`
                        : item.methodZScore.toFixed(2)
                      : "-";

                  const isOut = z !== null && Math.abs(z) >= 3;
                  const isWarn = z !== null && Math.abs(z) > 2 && Math.abs(z) < 3;

                  return (
                    <tr
                      key={item.id || idx}
                      className={`hover:bg-muted/40 transition-colors ${
                        isOut ? "bg-red-500/5" : isWarn ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="p-2.5 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="p-2.5">
                        <p className="font-semibold text-foreground">{item.parameterName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.session?.program || "PME"} · {item.session?.cycle || "-"} ({item.session?.period || "-"})
                        </p>
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.participantValue !== null ? `${item.participantValue} ${item.unit || ""}` : "-"}
                      </td>
                      <td className="p-2.5 text-center font-mono">{item.targetValue ?? "-"}</td>
                      <td className="p-2.5 text-center font-mono">{item.sdpa ?? "-"}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isOut ? "text-red-600" : isWarn ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {zFormatted}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono text-xs text-blue-600 font-semibold">
                        {zInstFormatted}
                      </td>
                      <td className="p-2.5 text-center font-mono text-xs text-purple-600 font-semibold">
                        {zMetFormatted}
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isOut
                              ? "bg-red-500/15 text-red-700 border-red-500/30"
                              : isWarn
                              ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                          }`}
                        >
                          {item.zStatus || (isOut ? "TIDAK MEMUASKAN" : isWarn ? "WARNING" : "MEMUASKAN")}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        {item.aiAnalysis?.interpretation ? (
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">
                            {item.aiAnalysis.interpretation}
                          </p>
                        ) : item.zStatus === "SATISFACTORY" || (!isOut && !isWarn) ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            Hasil analitik memuaskan. Pertahankan kontrol mutu rutin.
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                            Disarankan verifikasi instrumen, reagen, dan buat usulan CAPA.
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PRINT-ONLY SIGNATURE BLOCK (Appears ONLY during browser print) */}
      <div className="print-only mt-10 pt-6 border-t">
        <div className="flex justify-between items-center text-xs text-gray-700 px-8">
          <div className="text-center">
            <p>Dianalisis Oleh,</p>
            <div className="h-16" />
            <p className="font-bold underline">( Pranata Laboratorium Kesehatan )</p>
            <p className="text-[10px] text-gray-500">Petugas Pemantapan Mutu</p>
          </div>
          <div className="text-center">
            <p>Disetujui & Diverifikasi Oleh,</p>
            <div className="h-16" />
            <p className="font-bold underline">( Penanggung Jawab Teknis Mutu )</p>
            <p className="text-[10px] text-gray-500">Kepala Instalasi Laboratorium</p>
          </div>
        </div>
      </div>
    </div>
  );
}
