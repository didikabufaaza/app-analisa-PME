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
  Sparkles,
  Edit3,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import { apiGet, apiSend } from "@/lib/api-client";

interface KopSuratData {
  id?: string;
  logoKiri: string | null;
  logoKanan: string | null;
  pemda: string;
  namaRumahSakit: string;
  alamatRumahSakit: string;
  kontakRumahSakit: string;
}

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
  const [kopSurat, setKopSurat] = useState<KopSuratData | null>(null);

  // Local items state to allow immediate updates on AI analyze, manual edit, and reset
  const [displayItems, setDisplayItems] = useState<ReportItemData[]>(items);

  useEffect(() => {
    setDisplayItems(items);
  }, [items]);

  // Action state for recommendation
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [editManualItem, setEditManualItem] = useState<ReportItemData | null>(null);
  const [manualText, setManualText] = useState<string>("");
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const handleAnalyzeSingle = async (item: ReportItemData) => {
    setAnalyzingId(item.id);
    try {
      const res = await apiSend<{
        ok: boolean;
        status: string;
        aiAnalysis?: { interpretation?: string; correctiveActions?: string[]; preventiveActions?: string[] };
      }>(`/api/pme/results/${item.id}/analyze`, "POST");

      if (res && res.aiAnalysis) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshAi = res.aiAnalysis as any;
        setDisplayItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, aiAnalysis: freshAi } : it))
        );
        toast({
          title: "Analisis AI Selesai",
          description: `Rekomendasi mutu untuk parameter ${item.parameterName} berhasil dianalisis oleh AI.`,
        });
      } else {
        toast({
          title: "Analisis Diproses",
          description: `Analisis AI sedang diproses di server.`,
        });
      }
    } catch (err) {
      toast({
        title: "Gagal Analisis AI",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat menganalisis parameter.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleOpenManualEdit = (item: ReportItemData) => {
    setEditManualItem(item);
    setManualText(item.aiAnalysis?.interpretation || "");
  };

  const handleSaveManualEdit = async () => {
    if (!editManualItem) return;
    if (!manualText.trim()) {
      toast({
        title: "Teks Rekomendasi Kosong",
        description: "Silakan ketik teks rekomendasi mutu sebelum menyimpan.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingManual(true);
    try {
      const res = await apiSend<{ ok: boolean; aiAnalysis: { interpretation: string } }>(
        `/api/pme/results/${editManualItem.id}/recommendation`,
        "PUT",
        { interpretation: manualText.trim() }
      );

      if (res && res.aiAnalysis) {
        setDisplayItems((prev) =>
          prev.map((it) =>
            it.id === editManualItem.id
              ? {
                  ...it,
                  aiAnalysis: {
                    ...(it.aiAnalysis || {}),
                    interpretation: res.aiAnalysis.interpretation,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any,
                }
              : it
          )
        );
        toast({
          title: "Rekomendasi Tersimpan",
          description: `Rekomendasi mutu manual untuk ${editManualItem.parameterName} berhasil disimpan.`,
        });
        setEditManualItem(null);
      }
    } catch (err) {
      toast({
        title: "Gagal Menyimpan Rekomendasi",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan rekomendasi.",
        variant: "destructive",
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleResetSingle = async (item: ReportItemData) => {
    setResettingId(item.id);
    try {
      await apiSend<{ ok: boolean }>(`/api/pme/results/${item.id}/recommendation`, "DELETE");
      setDisplayItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, aiAnalysis: null } : it))
      );
      toast({
        title: "Rekomendasi Direset",
        description: `Rekomendasi mutu parameter ${item.parameterName} telah dikosongkan.`,
      });
    } catch (err) {
      toast({
        title: "Gagal Mereset Rekomendasi",
        description: err instanceof Error ? err.message : "Terjadi kesalahan saat mereset rekomendasi.",
        variant: "destructive",
      });
    } finally {
      setResettingId(null);
    }
  };

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

    // Fetch official Kop Surat for this tenant
    apiGet<{ kopSurat: KopSuratData }>("/api/kop-surat")
      .then((res) => {
        if (res && res.kopSurat) setKopSurat(res.kopSurat);
      })
      .catch(() => undefined);
  }, []);

  // Format data for chart
  const chartData = useMemo<ChartDataItem[]>(() => {
    return displayItems.map((item) => {
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
      // Draw Official Kop Surat on Page 1
      const kopY = 7;
      const logoSize = 19; // mm

      if (kopSurat?.logoKiri) {
        try {
          doc.addImage(kopSurat.logoKiri, "PNG", margin, kopY, logoSize, logoSize);
        } catch {}
      }

      if (kopSurat?.logoKanan) {
        try {
          doc.addImage(kopSurat.logoKanan, "PNG", pageW - margin - logoSize, kopY, logoSize, logoSize);
        } catch {}
      }

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(
        kopSurat?.pemda || "PEMERINTAH DAERAH / DINAS KESEHATAN",
        pageW / 2,
        kopY + 4,
        { align: "center" }
      );

      doc.setFontSize(13);
      doc.text(
        kopSurat?.namaRumahSakit || filterMeta.labName || "RUMAH SAKIT / LABORATORIUM",
        pageW / 2,
        kopY + 10,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        kopSurat?.alamatRumahSakit || "Alamat Lengkap Rumah Sakit / Laboratorium Klinik",
        pageW / 2,
        kopY + 14.5,
        { align: "center" }
      );

      doc.setFontSize(7.5);
      doc.text(
        kopSurat?.kontakRumahSakit || "Telepon, Fax & Email Resmi Laboratorium",
        pageW / 2,
        kopY + 18.5,
        { align: "center" }
      );

      // Classic Double-Line Divider
      const lineY = kopY + 22.5;
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.7);
      doc.line(margin, lineY, pageW - margin, lineY);
      doc.setLineWidth(0.2);
      doc.line(margin, lineY + 0.9, pageW - margin, lineY + 0.9);

      // Document Title
      let y = lineY + 5.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(13, 122, 105);
      doc.text("LAPORAN GRAFIK KENDALI MUTU Z-SCORE (LEVEY-JENNINGS)", pageW / 2, y, { align: "center" });

      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const printDateStr = new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const subInfo = `Program: ${filterMeta.program || "PME"}  |  Siklus: ${filterMeta.cycle || "-"}  |  Periode: ${filterMeta.period || "-"}  |  Total: ${summary.total} Parameter  |  Waktu Cetak: ${printDateStr}`;
      doc.text(subInfo, pageW / 2, y, { align: "center" });

      // Render Captured Chart Image starting right after
      y += 2.5;
      const chartImg = await captureChartSvg();
      const chartHeight = 135; // mm (fills landscape A4 page 1 neatly alongside Kop Surat)
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
      y += chartHeight + 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Keterangan Batas Mutu: [Garis Hijau] Target (Z=0)  |  [Garis Kuning] Batas Peringatan (±2.0 SD)  |  [Garis Merah] Batas Tindakan/Kontrol (±3.0 SD - Wajib CAPA)",
        margin,
        y
      );

      // Page 2: Table of Coordinate Details with Official Kop Surat Header
      doc.addPage("a4", "landscape");

      // Draw Kop Surat on Page 2
      if (kopSurat?.logoKiri) {
        try { doc.addImage(kopSurat.logoKiri, "PNG", margin, kopY, 17, 17); } catch {}
      }
      if (kopSurat?.logoKanan) {
        try { doc.addImage(kopSurat.logoKanan, "PNG", pageW - margin - 17, kopY, 17, 17); } catch {}
      }
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(kopSurat?.pemda || "PEMERINTAH DAERAH / DINAS KESEHATAN", pageW / 2, kopY + 3.5, { align: "center" });
      doc.setFontSize(12);
      doc.text(kopSurat?.namaRumahSakit || filterMeta.labName || "RUMAH SAKIT / LABORATORIUM", pageW / 2, kopY + 8.5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(kopSurat?.alamatRumahSakit || "Alamat Lengkap Rumah Sakit / Laboratorium Klinik", pageW / 2, kopY + 13, { align: "center" });
      doc.text(kopSurat?.kontakRumahSakit || "Telepon, Fax & Email Resmi Laboratorium", pageW / 2, kopY + 16.5, { align: "center" });
      
      // Divider
      doc.setLineWidth(0.6);
      doc.line(margin, kopY + 19.5, pageW - margin, kopY + 19.5);
      doc.setLineWidth(0.2);
      doc.line(margin, kopY + 20.3, pageW - margin, kopY + 20.3);

      // Page 2 Section Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(13, 122, 105);
      doc.text("TABEL KOORDINAT & REKAPITULASI HASIL NUMERIK Z-SCORE", margin, kopY + 25.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Lampiran Evaluasi Mutu  |  Halaman 2  |  Waktu Cetak: ${printDateStr}`, pageW - margin, kopY + 25.5, { align: "right" });

      const tableRows = displayItems.map((it, idx) => {
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
          it.aiAnalysis?.interpretation ? it.aiAnalysis.interpretation : "-",
        ];
      });

      autoTable(doc, {
        startY: kopY + 29,
        theme: "grid",
        margin: { top: 20, right: margin, bottom: 20, left: margin },
        showHead: "everyPage",
        rowPageBreak: "auto",
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
            "Rekomendasi Mutu",
          ],
        ],
        body: tableRows,
        headStyles: {
          fillColor: [13, 122, 105],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          valign: "top",
          overflow: "linebreak",
          lineColor: [220, 225, 230],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { halign: "left", cellWidth: 34, fontStyle: "bold" },
          2: { halign: "center", cellWidth: 20 },
          3: { halign: "center", cellWidth: 18 },
          4: { halign: "center", cellWidth: 14 },
          5: { halign: "center", cellWidth: 18, fontStyle: "bold" },
          6: { halign: "center", cellWidth: 18 },
          7: { halign: "center", cellWidth: 18 },
          8: { halign: "center", cellWidth: 22 },
          9: { halign: "left", cellWidth: 99, overflow: "linebreak", fontStyle: "normal" },
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
      let signY = lastY + 14;
      if (signY + 25 > pageH - margin) {
        doc.addPage("a4", "landscape");
        signY = margin + 20;
      }

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
      {/* PRINT-ONLY HEADER (Appears ONLY during browser print on Page 1) */}
      <div className="print-only mb-2">
        <div className="flex items-center justify-between gap-3 pb-1">
          {/* Logo Kiri */}
          <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
            {kopSurat?.logoKiri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={kopSurat.logoKiri}
                alt="Logo Kiri"
                className="max-h-12 max-w-12 object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400">
                Logo
              </div>
            )}
          </div>

          {/* Teks Kop Surat Tengah */}
          <div className="flex-1 text-center space-y-0.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-800">
              {kopSurat?.pemda || "PEMERINTAH DAERAH / DINAS KESEHATAN"}
            </h3>
            <h1 className="text-[13px] font-extrabold uppercase tracking-tight text-gray-900 leading-tight">
              {kopSurat?.namaRumahSakit || filterMeta.labName || "RUMAH SAKIT / LABORATORIUM KLINIK"}
            </h1>
            <p className="text-[9.5px] text-gray-600">
              {kopSurat?.alamatRumahSakit || "Alamat Lengkap Rumah Sakit / Laboratorium Klinik"}
            </p>
            <p className="text-[9px] text-gray-500">
              {kopSurat?.kontakRumahSakit || "Telepon, Fax & Email Resmi Laboratorium"}
            </p>
          </div>

          {/* Logo Kanan */}
          <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
            {kopSurat?.logoKanan ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={kopSurat.logoKanan}
                alt="Logo Kanan"
                className="max-h-12 max-w-12 object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400">
                Logo
              </div>
            )}
          </div>
        </div>

        {/* Double divider line */}
        <div className="border-t-2 border-b border-black h-0.5 my-1" />

        {/* Document Title & Meta */}
        <div className="text-center mt-1.5 mb-1.5">
          <h2 className="text-xs font-bold uppercase text-teal-800 tracking-wide">
            LAPORAN GRAFIK KENDALI MUTU Z-SCORE (LEVEY-JENNINGS)
          </h2>
          <div className="flex justify-between items-center text-[8.5px] text-gray-600 mt-1 border-t pt-0.5">
            <span>
              Laboratorium: <strong className="text-gray-800">{filterMeta.labName || kopSurat?.namaRumahSakit || "Peserta"}</strong> |{" "}
              Program: <strong className="text-gray-800">{filterMeta.program || "PME"}</strong> |{" "}
              Siklus: <strong className="text-gray-800">{filterMeta.cycle || "-"}</strong> ({filterMeta.period || "-"})
            </span>
            <span>
              Total: <strong className="text-gray-800">{displayItems.length} Parameter</strong> |{" "}
              Dicetak: {printDate || "-"}
            </span>
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

      {/* Summary KPI Cards & Zone Legend Strip (Hidden on Print) */}
      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      <Card className="table-print-area">
        {/* Page 2 Print-only Header for Table */}
        <div className="print-only mb-2 text-center border-b pb-1.5">
          <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wide">
            TABEL KOORDINAT & REKAPITULASI HASIL NUMERIK Z-SCORE
          </h3>
          <div className="flex justify-between items-center text-[8.5px] text-gray-500 mt-1">
            <span>
              Laboratorium: <strong className="text-gray-700">{filterMeta.labName || kopSurat?.namaRumahSakit || "Peserta"}</strong> |{" "}
              Program: <strong className="text-gray-700">{filterMeta.program || "PME"}</strong>
            </span>
            <span>
              Halaman 2 (Lampiran Evaluasi Mutu) | Waktu Cetak: {printDate || "-"}
            </span>
          </div>
        </div>

        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Tabel Koordinat & Rekapitulasi Z-Score</CardTitle>
              <CardDescription className="text-xs">
                Rincian nilai numerik koordinat grafik untuk keperluan verifikasi dan audit mutu laboratorium.
              </CardDescription>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {displayItems.length} Parameter Tercatat
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="print-table-container max-h-[30rem] print:max-h-none overflow-x-auto print:overflow-visible overflow-y-auto print:overflow-y-visible rounded-lg border print:border-none">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur print:static print:bg-slate-100">
                <tr>
                  <th className="p-2.5 font-semibold text-muted-foreground w-10 text-center">No.</th>
                  <th className="p-2.5 font-semibold text-muted-foreground min-w-[150px]">Sasaran / Parameter</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Hasil Peserta</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-24 text-center">Target (Mean)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-20 text-center">SDPA</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Z-Score (Global)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Z-Score (Alat)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Z-Score (Metode)</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-28 text-center">Status Evaluasi</th>
                  <th className="p-2.5 font-semibold text-muted-foreground min-w-[200px]">Rekomendasi Mutu</th>
                  <th className="p-2.5 font-semibold text-muted-foreground w-44 text-center no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayItems.map((item, idx) => {
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
                      <td className="p-2.5 align-top text-center text-muted-foreground">{idx + 1}</td>
                      <td className="p-2.5 align-top">
                        <p className="font-semibold text-foreground">{item.parameterName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.session?.program || "PME"} · {item.session?.cycle || "-"} ({item.session?.period || "-"})
                        </p>
                      </td>
                      <td className="p-2.5 align-top text-center font-mono">
                        {item.participantValue !== null ? `${item.participantValue} ${item.unit || ""}` : "-"}
                      </td>
                      <td className="p-2.5 align-top text-center font-mono">{item.targetValue ?? "-"}</td>
                      <td className="p-2.5 align-top text-center font-mono">{item.sdpa ?? "-"}</td>
                      <td className="p-2.5 align-top text-center">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isOut ? "text-red-600" : isWarn ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {zFormatted}
                        </span>
                      </td>
                      <td className="p-2.5 align-top text-center font-mono text-xs text-blue-600 font-semibold">
                        {zInstFormatted}
                      </td>
                      <td className="p-2.5 align-top text-center font-mono text-xs text-purple-600 font-semibold">
                        {zMetFormatted}
                      </td>
                      <td className="p-2.5 align-top text-center">
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
                      <td className="p-2.5 align-top min-w-[220px]">
                        {item.aiAnalysis?.interpretation ? (
                          <p className="text-[11px] text-foreground whitespace-normal break-words leading-relaxed print:text-[9.5px]">
                            {item.aiAnalysis.interpretation}
                          </p>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">-</span>
                        )}
                      </td>
                      <td className="p-2.5 align-top text-center no-print">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Analisis AI */}
                          <Button
                            variant="outline"
                            size="sm"
                            title="Analisis Otomatis oleh AI"
                            onClick={() => handleAnalyzeSingle(item)}
                            disabled={analyzingId === item.id}
                            className="h-7 px-2 text-[10px] font-medium border-teal-600/40 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                          >
                            {analyzingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="mr-1 h-3 w-3 text-teal-600" />
                                <span>Analisis</span>
                              </>
                            )}
                          </Button>

                          {/* Tombol Isi Manual */}
                          <Button
                            variant="outline"
                            size="sm"
                            title="Isi Rekomendasi Mutu Manual"
                            onClick={() => handleOpenManualEdit(item)}
                            className="h-7 px-2 text-[10px] font-medium border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <Edit3 className="mr-1 h-3 w-3 text-blue-600" />
                            <span>Manual</span>
                          </Button>

                          {/* Tombol Reset */}
                          <Button
                            variant="outline"
                            size="sm"
                            title="Kosongkan / Reset Rekomendasi"
                            onClick={() => handleResetSingle(item)}
                            disabled={resettingId === item.id || !item.aiAnalysis}
                            className="h-7 px-2 text-[10px] font-medium border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40"
                          >
                            {resettingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="mr-1 h-3 w-3 text-red-500" />
                                <span>Reset</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Isi Manual Rekomendasi Mutu */}
      <Dialog open={!!editManualItem} onOpenChange={(open) => !open && setEditManualItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Edit3 className="h-4 w-4 text-blue-600" />
              <span>Isi Rekomendasi Mutu Manual</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ketik saran dan rekomendasi tindak lanjut mutu laboratorium untuk parameter{" "}
              <strong className="text-foreground">{editManualItem?.parameterName}</strong> (Z-Score:{" "}
              <strong className="text-foreground">
                {editManualItem?.zScore !== null && editManualItem?.zScore !== undefined
                  ? editManualItem.zScore > 0
                    ? `+${editManualItem.zScore.toFixed(2)}`
                    : editManualItem.zScore.toFixed(2)
                  : "-"}
              </strong>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              Teks Rekomendasi Mutu:
            </label>
            <Textarea
              rows={4}
              placeholder="Ketik rekomendasi mutu (misal: Kalibrasi ulang instrumen, evaluasi reagen, periksa kontrol mutu harian...)"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditManualItem(null)}
              disabled={isSavingManual}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveManualEdit}
              disabled={isSavingManual || !manualText.trim()}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
            >
              {isSavingManual ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Rekomendasi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRINT-ONLY SIGNATURE BLOCK (Appears ONLY during browser print) */}
      <div className="print-only print-avoid-break mt-10 pt-6 border-t">
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
