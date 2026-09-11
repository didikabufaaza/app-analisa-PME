/**
 * Report Generator (PRD sections #55, #56)
 * - PDF Model 1: Laporan Komprehensif dengan Cover, Identitas, Executive Summary,
 *   Tabel Hasil, dan Tabel Analisis Z-Score Komprehensif (Interpretasi, Kemungkinan Penyebab,
 *   Langkah Investigasi, Tindakan Korektif, dan Tindakan Preventif).
 * - PDF Model 2: Format Evaluasi Mutu Sasaran/Perbaikan (5 kolom sesuai template EVALUASI PME.xlsx).
 * - Excel Model 1: Full export teknis dengan seluruh metadata dan analisis AI.
 * - Excel Model 2: Format tepat sesuai file template EVALUASI PME.xlsx (No, Sasaran, Hasil Pencapain, Rencana Perbaikan, Penanggung Jawab).
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  SATISFACTORY: "Memuaskan",
  WARNING: "Peringatan",
  UNSATISFACTORY: "Tidak Memuaskan",
};

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return Number(n).toFixed(digits).replace(/\.?0+$/, "") || "0";
}

function fmtZ(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}`;
}

/**
 * Evaluasi tingkat keparahan baris Z-Score:
 * - "UNSATISFACTORY" (merah) bila ada status UNSATISFACTORY atau |Z| >= 3.0
 * - "WARNING" (kuning) bila ada status WARNING atau 2.0 < |Z| < 3.0
 * - "SATISFACTORY" bila semua memenuhi batas toleransi (|Z| <= 2.0)
 * - "NOT_ANALYZED" bila tidak ada nilai Z-Score atau berstatus tidak dianalisa
 */
export function getRowEvaluationLevel(r: {
  zScore?: number | null;
  zStatus?: string | null;
  instrumentZScore?: number | null;
  instrumentStatus?: string | null;
  methodZScore?: number | null;
  methodStatus?: string | null;
  allParticipantsZScore?: number | null;
  allParticipantsStatus?: string | null;
}): "UNSATISFACTORY" | "WARNING" | "SATISFACTORY" | "NOT_ANALYZED" {
  if (r.zStatus === "UNSATISFACTORY") return "UNSATISFACTORY";

  const statuses = [r.zStatus, r.instrumentStatus, r.methodStatus, r.allParticipantsStatus];
  for (const s of statuses) {
    if (!s) continue;
    const up = s.toUpperCase();
    if (up.includes("UNSATISFACTORY") || up.includes("TIDAK MEMUASKAN") || up.includes("TIDAK BAIK") || up.includes("$$")) {
      return "UNSATISFACTORY";
    }
  }

  const scores = [r.zScore, r.instrumentZScore, r.methodZScore, r.allParticipantsZScore].filter(
    (z): z is number => typeof z === "number" && !isNaN(z)
  );
  for (const z of scores) {
    if (Math.abs(z) >= 3.0) {
      return "UNSATISFACTORY";
    }
  }

  if (r.zStatus === "WARNING") return "WARNING";

  for (const s of statuses) {
    if (!s) continue;
    const up = s.toUpperCase();
    if (up.includes("WARNING") || up.includes("PERINGATAN") || up.includes("WASPAD")) {
      return "WARNING";
    }
  }

  for (const z of scores) {
    if (Math.abs(z) > 2.0 && Math.abs(z) < 3.0) {
      return "WARNING";
    }
  }

  if (scores.length > 0 || r.zStatus === "SATISFACTORY") {
    return "SATISFACTORY";
  }

  return "NOT_ANALYZED";
}

export function getOverallStatusLabel(r: {
  zStatus?: string | null;
  validationStatus?: string | null;
  instrumentStatus?: string | null;
  methodStatus?: string | null;
  allParticipantsStatus?: string | null;
  zScore?: number | null;
  instrumentZScore?: number | null;
  methodZScore?: number | null;
  allParticipantsZScore?: number | null;
}): string {
  const level = getRowEvaluationLevel(r);
  if (level === "UNSATISFACTORY") return "Tidak Memuaskan";
  if (level === "WARNING") return "Peringatan";
  if (level === "SATISFACTORY") return "Memuaskan";
  if (level === "NOT_ANALYZED") return "-";
  if (r.zStatus && STATUS_LABEL[r.zStatus]) return STATUS_LABEL[r.zStatus];
  if (r.validationStatus === "REVIEW_REQUIRED") return "Perlu Review";
  return "-";
}

function safeParseArray(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatList(arr: unknown[], bullet = "•"): string {
  if (!arr || arr.length === 0) return "-";
  return arr
    .map((item) => {
      if (typeof item === "string") return `${bullet} ${item}`;
      if (item && typeof item === "object") {
        const c = item as { category?: string; text?: string };
        const cat = c.category ? `[${c.category.replace(/_/g, " ")}] ` : "";
        return `${bullet} ${cat}${c.text || ""}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/* ========================================================================== */
/*                           PDF MODEL 1 (KOMPREHENSIF)                       */
/* ========================================================================== */

export async function generatePdfReport(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true }, orderBy: { parameterName: "asc" } },
      organization: true,
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  /* ---------- COVER ---------- */
  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("didikpme", 14, 22);
  doc.setFontSize(15);
  doc.text("Laporan Analisis PME & Rencana Mutu Laboratorium", 14, 34);
  doc.setFontSize(9.5);
  doc.text("Pemantapan Mutu Eksternal (External Quality Assessment) — Evaluasi Terstandar", 14, 44);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 52);

  doc.setTextColor(30, 30, 30);
  let y = 72;

  /* ---------- IDENTITAS PME ---------- */
  doc.setFontSize(13);
  doc.text("1. Identitas Dokumen & Laboratorium", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Parameter Dokumen", "Nilai / Keterangan"]],
    body: [
      ["Laboratorium", session.laboratoryName || session.organization?.name || "-"],
      ["Penyelenggara (Provider)", session.provider || "-"],
      ["Program PME", session.program || "-"],
      ["Siklus / Periode", `${session.cycle || "-"} / ${session.period || "-"}`],
      ["Nomor Peserta (ID)", session.participantId || "-"],
      ["Nama Berkas PDF", session.file?.fileName || "-"],
      ["Versi Aturan Z-Score", session.ruleVersion || "v1.0-default"],
      ["Metode Validasi", "Standar ISO 13528 & Permenkes"],
    ],
    headStyles: { fillColor: [13, 122, 105], fontSize: 9 },
    styles: { fontSize: 8.5 },
  });
  // @ts-expect-error lastAutoTable injected
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  /* ---------- EXECUTIVE SUMMARY ---------- */
  const results = session.results;
  const counts = {
    satisfactory: results.filter((r) => r.zStatus === "SATISFACTORY").length,
    warning: results.filter((r) => r.zStatus === "WARNING").length,
    unsatisfactory: results.filter((r) => r.zStatus === "UNSATISFACTORY").length,
    review: results.filter((r) => r.validationStatus === "REVIEW_REQUIRED").length,
  };
  doc.setFontSize(13);
  doc.text("2. Ringkasan Eksekutif Kinerja Mutu", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(
    `Dari total ${results.length} parameter pemeriksaan yang dievaluasi: ${counts.satisfactory} dinyatakan Memuaskan (|Z| <= 2), ${counts.warning} Waspada (2 < |Z| < 3), ${counts.unsatisfactory} Tidak Memuaskan (|Z| >= 3), dan ${counts.review} memerlukan telaah teknis.`,
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 10;

  /* ---------- RESULT TABLE (Ringkasan Z-Score Multi-Kelompok) ---------- */
  doc.setFontSize(13);
  doc.text("3. Rekapitulasi Hasil Numerik Z-Score", 14, y);
  y += 4;

  const rowLevels = results.map((r) => getRowEvaluationLevel(r));

  autoTable(doc, {
    startY: y,
    theme: "grid",
    tableWidth: 186,
    margin: { left: 12, right: 12 },
    head: [
      [
        { content: "No", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Parameter", rowSpan: 2, styles: { halign: "left", valign: "middle" } },
        { content: "Hasil Lab", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Kelompok Alat", colSpan: 2, styles: { halign: "center" } },
        { content: "Kelompok Metode", colSpan: 2, styles: { halign: "center" } },
        { content: "Seluruh Peserta", colSpan: 2, styles: { halign: "center" } },
        { content: "Status Mutu", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
      ],
    ],
    body: results.map((r, idx) => {
      // Kelompok Alat
      const isInstNotAnalyzed =
        r.instrumentStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.instrumentZScore === null && r.instrumentTarget === null);
      const instTarget = !isInstNotAnalyzed && r.instrumentTarget !== null && r.instrumentTarget !== undefined
        ? fmt(r.instrumentTarget, 2)
        : "-";
      const instZ = !isInstNotAnalyzed && r.instrumentZScore !== null && r.instrumentZScore !== undefined
        ? fmtZ(r.instrumentZScore)
        : "-";

      // Kelompok Metode
      const isMethNotAnalyzed =
        r.methodStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.methodZScore === null && r.methodTarget === null);
      const methTarget = !isMethNotAnalyzed && r.methodTarget !== null && r.methodTarget !== undefined
        ? fmt(r.methodTarget, 2)
        : "-";
      const methZ = !isMethNotAnalyzed && r.methodZScore !== null && r.methodZScore !== undefined
        ? fmtZ(r.methodZScore)
        : "-";

      // Seluruh Peserta
      const isAllNotAnalyzed =
        r.allParticipantsStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.allParticipantsZScore === null && r.allParticipantsTarget === null && r.zScore === null && r.targetValue === null);
      const allTarget = !isAllNotAnalyzed && (r.allParticipantsTarget !== null && r.allParticipantsTarget !== undefined
        ? fmt(r.allParticipantsTarget, 2)
        : (r.targetValue !== null ? fmt(r.targetValue, 2) : "-"));
      const allZ = !isAllNotAnalyzed && (r.allParticipantsZScore !== null && r.allParticipantsZScore !== undefined
        ? fmtZ(r.allParticipantsZScore)
        : (r.zScore !== null ? fmtZ(r.zScore) : "-"));

      const labVal =
        r.participantValue !== null && r.participantValue !== undefined
          ? `${fmt(r.participantValue, 2)}${r.unit ? ` ${r.unit}` : ""}`.trim()
          : "-";

      const statusText = getOverallStatusLabel(r);

      return [
        String(idx + 1),
        r.parameterName,
        labVal,
        instTarget,
        instZ,
        methTarget,
        methZ,
        allTarget,
        allZ,
        statusText,
      ];
    }),
    headStyles: {
      fillColor: [13, 122, 105],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [255, 255, 255],
      lineWidth: 0.1,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 36, halign: "left" },
      2: { cellWidth: 19, halign: "center" },
      3: { cellWidth: 17, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 17, halign: "center" },
      6: { cellWidth: 16, halign: "center" },
      7: { cellWidth: 17, halign: "center" },
      8: { cellWidth: 16, halign: "center" },
      9: { cellWidth: 25, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const level = rowLevels[data.row.index];
        if (level === "UNSATISFACTORY") {
          data.cell.styles.fillColor = [254, 226, 226]; // Merah pastel (#FEE2E2)
          data.cell.styles.textColor = [153, 27, 27];   // Teks merah gelap (#991B1B)
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        } else if (level === "WARNING") {
          data.cell.styles.fillColor = [254, 243, 199]; // Kuning pastel (#FEF3C7)
          data.cell.styles.textColor = [146, 64, 14];   // Teks kuning gelap / amber (#92400E)
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  /* ---------- TABEL KOMPREHENSIF Z-SCORE DENGAN KOLOM EVALUASI LENGKAP ---------- */
  // Disajikan dalam halaman baru berorientasi LANDSCAPE agar seluruh kolom terbaca jelas
  doc.addPage("a4", "landscape");
  const landW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, landW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("4. Evaluasi Mendalam Hasil Z-Score & Rencana Tindakan Mutu", 14, 13);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.text(
    "Tabel di bawah menyajikan rincian setiap parameter yang memiliki nilai Z-Score mencakup Interpretasi Klinis, Kemungkinan Akar Masalah, Investigasi, Tindakan Perbaikan, dan Tindakan Pencegahan.",
    14,
    27
  );

  const zResults = results.filter((r) => getRowEvaluationLevel(r) !== "NOT_ANALYZED");
  const table4Levels = zResults.map((r) => getRowEvaluationLevel(r));

  autoTable(doc, {
    startY: 32,
    theme: "grid",
    tableWidth: 269,
    margin: { left: 14, right: 14 },
    head: [[
      "Parameter & Z-Score",
      "Interpretasi Klinis & Analisis Bias",
      "Kemungkinan Penyebab",
      "Langkah Investigasi",
      "Tindakan Perbaikan (Korektif)",
      "Tindakan Pencegahan"
    ]],
    body: zResults.map((r) => {
      const a = r.aiAnalysis;
      const zGlobal = r.allParticipantsZScore ?? r.zScore;
      const zMethod = r.methodZScore;
      const zInst = r.instrumentZScore;

      let zDetails = `Z-Global: ${fmtZ(zGlobal)}`;
      zDetails += `\nZ-Metode: ${fmtZ(zMethod)}`;
      zDetails += `\nZ-Alat: ${fmtZ(zInst)}`;

      const statusText = getOverallStatusLabel(r);
      const paramCol = `${r.parameterName}\n${zDetails}\nStatus: ${statusText}`;

      let interp = a?.interpretation
        ? a.interpretation
        : (r.zStatus === "SATISFACTORY"
            ? "Hasil dalam batas toleransi analitik (memuaskan). Performa pengujian stabil."
            : "Memerlukan investigasi lebih lanjut terkait deviasi analitik.");

      if (a?.biasAnalysis) {
        interp += `\n\n[Analisis Bias Analitik]:\n${a.biasAnalysis}`;
      }

      const causes = a?.possibleCauses ? formatList(safeParseArray(a.possibleCauses)) : "- Menjaga kestabilan reagen & instrumen";
      const invest = a?.investigationSteps ? formatList(safeParseArray(a.investigationSteps)) : "- Evaluasi tren IQC harian";
      const corrective = a?.correctiveActions ? formatList(safeParseArray(a.correctiveActions)) : "- Lakukan kalibrasi ulang bila IQC bergeser";
      const preventive = a?.preventiveActions ? formatList(safeParseArray(a.preventiveActions)) : "- Pemeliharaan rutin instrumen & cek suhu reagen";

      return [paramCol, interp, causes, invest, corrective, preventive];
    }),
    headStyles: { fillColor: [13, 122, 105], fontSize: 8, fontStyle: "bold", halign: "center" },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 49 },
      2: { cellWidth: 46 },
      3: { cellWidth: 44 },
      4: { cellWidth: 46 },
      5: { cellWidth: 46 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const level = table4Levels[data.row.index];
        if (level === "UNSATISFACTORY") {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
        } else if (level === "WARNING") {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        }
      }
    },
  });

  /* ---------- KESIMPULAN & TANDA TANGAN (Portrait Page) ---------- */
  doc.addPage("a4", "portrait");
  y = 25;
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text("5. Kesimpulan & Rekomendasi Mutu", 14, y);
  y += 6;
  doc.setFontSize(9.5);
  const conclusion =
    counts.unsatisfactory > 0
      ? `Terdapat ${counts.unsatisfactory} parameter Tidak Memuaskan dan ${counts.warning} parameter Waspada yang memerlukan verifikasi berkas CAPA segera, audit reagen, serta kalibrasi instrumen sebelum siklus PME selanjutnya.`
      : counts.warning > 0
        ? `Terdapat ${counts.warning} parameter Waspada. Dianjurkan melakukan monitoring ketat pada grafik Levey-Jennings kontrol kualitas internal harian.`
        : "Seluruh parameter pengujian dinyatakan memuaskan dan memenuhi standar akurasi serta presisi laboratorium.";

  y = wrapText(doc, conclusion, 14, y, pageW - 28) + 15;

  doc.setFontSize(10);
  doc.text("Dibuat Oleh (Penanggung Jawab Mutu):", 14, y);
  doc.text("Disetujui Oleh (Kepala Laboratorium):", pageW - 80, y);
  doc.line(14, y + 25, 70, y + 25);
  doc.line(pageW - 80, y + 25, pageW - 14, y + 25);
  doc.setFontSize(8.5);
  doc.text("Analis QA / Koordinator Mutu", 14, y + 30);
  doc.text(session.laboratoryName || "Kepala Laboratorium", pageW - 80, y + 30);

  return Buffer.from(doc.output("arraybuffer"));
}

/* ========================================================================== */
/*              PDF MODEL 2 (FORMAT EVALUASI SASARAN / MUTU 5 KOLOM)          */
/* ========================================================================== */

export async function generatePdfReportModel2(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true, capaActions: true }, orderBy: { parameterName: "asc" } },
      organization: true,
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  /* Header Box */
  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("FORMULIR EVALUASI DAN HASIL REKAPITULASI PEMANTAPAN MUTU EKSTERNAL (MODEL 2)", 14, 11);
  doc.setFontSize(9);
  doc.text(`Laboratorium: ${session.laboratoryName || session.organization.name} | Program: ${session.program || "Kimia Klinik"} | Siklus: ${session.cycle || "-"} | Periode: ${session.period || "-"}`, 14, 18);

  doc.setTextColor(30, 30, 30);

  /* Section 1: Rekapitulasi Hasil Numerik Z-Score */
  doc.setFontSize(11);
  doc.text("1. Rekapitulasi Hasil Numerik Z-Score (Kelompok Alat, Metode & Seluruh Peserta)", 14, 29);

  const rowLevels = session.results.map((r) => getRowEvaluationLevel(r));

  autoTable(doc, {
    startY: 33,
    theme: "grid",
    tableWidth: 257,
    margin: { left: 20, right: 20 },
    head: [
      [
        { content: "No", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Parameter", rowSpan: 2, styles: { halign: "left", valign: "middle" } },
        { content: "Hasil Lab", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Kelompok Alat", colSpan: 2, styles: { halign: "center" } },
        { content: "Kelompok Metode", colSpan: 2, styles: { halign: "center" } },
        { content: "Seluruh Peserta", colSpan: 2, styles: { halign: "center" } },
        { content: "Status Mutu", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
        { content: "Target", styles: { halign: "center" } },
        { content: "Z-Score", styles: { halign: "center" } },
      ],
    ],
    body: session.results.map((r, idx) => {
      const isInstNotAnalyzed =
        r.instrumentStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.instrumentZScore === null && r.instrumentTarget === null);
      const instTarget = !isInstNotAnalyzed && r.instrumentTarget !== null && r.instrumentTarget !== undefined
        ? fmt(r.instrumentTarget, 2)
        : "-";
      const instZ = !isInstNotAnalyzed && r.instrumentZScore !== null && r.instrumentZScore !== undefined
        ? fmtZ(r.instrumentZScore)
        : "-";

      const isMethNotAnalyzed =
        r.methodStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.methodZScore === null && r.methodTarget === null);
      const methTarget = !isMethNotAnalyzed && r.methodTarget !== null && r.methodTarget !== undefined
        ? fmt(r.methodTarget, 2)
        : "-";
      const methZ = !isMethNotAnalyzed && r.methodZScore !== null && r.methodZScore !== undefined
        ? fmtZ(r.methodZScore)
        : "-";

      const isAllNotAnalyzed =
        r.allParticipantsStatus?.toLowerCase().includes("tidak dianalisa") ||
        (r.allParticipantsZScore === null && r.allParticipantsTarget === null && r.zScore === null && r.targetValue === null);
      const allTarget = !isAllNotAnalyzed && (r.allParticipantsTarget !== null && r.allParticipantsTarget !== undefined
        ? fmt(r.allParticipantsTarget, 2)
        : (r.targetValue !== null ? fmt(r.targetValue, 2) : "-"));
      const allZ = !isAllNotAnalyzed && (r.allParticipantsZScore !== null && r.allParticipantsZScore !== undefined
        ? fmtZ(r.allParticipantsZScore)
        : (r.zScore !== null ? fmtZ(r.zScore) : "-"));

      const labVal =
        r.participantValue !== null && r.participantValue !== undefined
          ? `${fmt(r.participantValue, 2)}${r.unit ? ` ${r.unit}` : ""}`.trim()
          : "-";

      const statusText = getOverallStatusLabel(r);

      return [
        String(idx + 1),
        r.parameterName,
        labVal,
        instTarget,
        instZ,
        methTarget,
        methZ,
        allTarget,
        allZ,
        statusText,
      ];
    }),
    headStyles: {
      fillColor: [13, 122, 105],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      lineColor: [255, 255, 255],
      lineWidth: 0.1,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 45, halign: "left" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 24, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 24, halign: "center" },
      6: { cellWidth: 24, halign: "center" },
      7: { cellWidth: 24, halign: "center" },
      8: { cellWidth: 24, halign: "center" },
      9: { cellWidth: 33, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const level = rowLevels[data.row.index];
        if (level === "UNSATISFACTORY") {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        } else if (level === "WARNING") {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
          if (data.column.index === 9 || data.column.index === 1) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
  });

  /* Section 2: Formulir Evaluasi Sasaran Mutu 5 Kolom (Halaman Baru) */
  doc.addPage("a4", "landscape");
  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("2. Formulir Evaluasi Sasaran Mutu & Rencana Tindak Lanjut", 14, 13);

  doc.setTextColor(30, 30, 30);

  /* 5 Columns matching EVALUASI PME.xlsx: No, Sasaran, Hasil Pencapain, Rencana Perbaikan, Penanggung Jawab */
  const bodyRows = session.results.map((r, idx) => {
    const a = r.aiAnalysis;
    const isAnalyzed = getRowEvaluationLevel(r) !== "NOT_ANALYZED";
    const zStr = isAnalyzed && r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
    const statusStr = isAnalyzed ? (STATUS_LABEL[r.zStatus || ""] || "Perlu Review") : "-";

    const sasaran = `Pemeriksaan ${r.parameterName}\n(Metode: ${r.method || "Standard"}, Alat: ${r.instrument || "Auto Analyzer"})`;
    const pencapaian = isAnalyzed
      ? `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nNilai Target: ${r.targetValue ?? "-"}\nSDPA: ${r.sdpa ?? "-"}\nZ-Score: ${zStr} (${statusStr})`
      : `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nNilai Target: -\nSDPA: -\nZ-Score: - (-)`;

    let perbaikan = "";
    if (!isAnalyzed) {
      perbaikan = "-";
    } else if (a?.correctiveActions) {
      const corrective = safeParseArray(a.correctiveActions);
      const preventive = safeParseArray(a.preventiveActions);
      const cLines = corrective.slice(0, 2).map((c) => `• ${c}`).join("\n");
      const pLines = preventive.slice(0, 2).map((p) => `• ${p}`).join("\n");
      perbaikan = [cLines, pLines ? `Pencegahan:\n${pLines}` : ""].filter(Boolean).join("\n\n");
    } else if (r.zStatus === "SATISFACTORY") {
      perbaikan = "Pertahankan performa pengujian dengan pemeliharaan instrumen rutin dan kontrol harian (IQC).";
    } else {
      perbaikan = "Lakukan evaluasi presisi dan akurasi instrumen serta pengujian ulang bahan kontrol.";
    }

    const pic = r.capaActions?.[0]?.pic || "Analis QA / Ka Lab";

    return [String(idx + 1), sasaran, pencapaian, perbaikan, pic];
  });

  autoTable(doc, {
    startY: 28,
    theme: "grid",
    head: [["No.", "Sasaran", "Hasil Pencapain", "Rencana Perbaikan", "Penanggung Jawab"]],
    body: bodyRows,
    headStyles: {
      fillColor: [13, 122, 105],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    margin: { left: 14, right: 14 },
    tableWidth: 268,
    columnStyles: {
      0: { cellWidth: 11, halign: "center" },
      1: { cellWidth: 62 },
      2: { cellWidth: 64 },
      3: { cellWidth: 95 },
      4: { cellWidth: 36, halign: "center" },
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

/* ========================================================================== */
/*                             EXCEL MODEL 1 (TEKNIS)                         */
/* ========================================================================== */

export async function generateExcelReport(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true }, orderBy: { parameterName: "asc" } },
      organization: true,
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const wb = new ExcelJS.Workbook();
  wb.creator = "didikpme - Evaluasi Mutu PME";
  wb.created = new Date();

  const ws = wb.addWorksheet("Hasil PME Teknis");
  ws.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Parameter", key: "parameter", width: 25 },
    { header: "Hasil Lab (Peserta)", key: "participant", width: 20 },
    { header: "Satuan", key: "unit", width: 12 },
    { header: "Metode", key: "method", width: 16 },
    { header: "Alat / Instrumen", key: "instrument", width: 20 },
    // Rekapitulasi Kelompok Alat
    { header: "Target (Kel. Alat)", key: "instrumentTarget", width: 18 },
    { header: "SDPA (Kel. Alat)", key: "instrumentSdpa", width: 16 },
    { header: "Z-Score (Kel. Alat)", key: "instrumentZScore", width: 18 },
    { header: "Status (Kel. Alat)", key: "instrumentStatus", width: 18 },
    // Rekapitulasi Kelompok Metode
    { header: "Target (Kel. Metode)", key: "methodTarget", width: 18 },
    { header: "SDPA (Kel. Metode)", key: "methodSdpa", width: 16 },
    { header: "Z-Score (Kel. Metode)", key: "methodZScore", width: 18 },
    { header: "Status (Kel. Metode)", key: "methodStatus", width: 18 },
    // Rekapitulasi Seluruh Peserta
    { header: "Target (Seluruh Peserta)", key: "allParticipantsTarget", width: 22 },
    { header: "SDPA (Seluruh Peserta)", key: "allParticipantsSdpa", width: 20 },
    { header: "Z-Score (Seluruh Peserta)", key: "allParticipantsZScore", width: 22 },
    { header: "Status (Seluruh Peserta)", key: "allParticipantsStatus", width: 20 },
    // Status Mutu Keseluruhan
    { header: "Status Mutu Keseluruhan", key: "status", width: 22 },
    // Analisis Multi-Kelompok & Evaluasi
    { header: "Evaluasi Kelompok Alat", key: "instrumentEvaluation", width: 35 },
    { header: "Evaluasi Kelompok Metode", key: "methodEvaluation", width: 35 },
    { header: "Analisis Bias Analitik", key: "biasAnalysis", width: 40 },
    { header: "Interpretasi Klinis", key: "interpretation", width: 45 },
    { header: "Kemungkinan Penyebab", key: "cause", width: 40 },
    { header: "Langkah Investigasi", key: "investigation", width: 40 },
    { header: "Tindakan Korektif", key: "corrective", width: 40 },
    { header: "Tindakan Preventif", key: "preventive", width: 40 },
  ];

  ws.getRow(1).height = 28;
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D7A69" } };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  for (let idx = 0; idx < session.results.length; idx++) {
    const r = session.results[idx];
    const a = r.aiAnalysis;

    const isInstNotAnalyzed =
      r.instrumentStatus?.toLowerCase().includes("tidak dianalisa") ||
      (r.instrumentZScore === null && r.instrumentTarget === null);
    const instTarget = !isInstNotAnalyzed && r.instrumentTarget !== null ? r.instrumentTarget : null;
    const instSdpa = !isInstNotAnalyzed && r.instrumentSdpa !== null ? r.instrumentSdpa : null;
    const instZ = !isInstNotAnalyzed && r.instrumentZScore !== null ? r.instrumentZScore : null;
    const instStatus = !isInstNotAnalyzed ? (r.instrumentStatus || "") : "-";

    const isMethNotAnalyzed =
      r.methodStatus?.toLowerCase().includes("tidak dianalisa") ||
      (r.methodZScore === null && r.methodTarget === null);
    const methTarget = !isMethNotAnalyzed && r.methodTarget !== null ? r.methodTarget : null;
    const methSdpa = !isMethNotAnalyzed && r.methodSdpa !== null ? r.methodSdpa : null;
    const methZ = !isMethNotAnalyzed && r.methodZScore !== null ? r.methodZScore : null;
    const methStatus = !isMethNotAnalyzed ? (r.methodStatus || "") : "-";

    const isAllNotAnalyzed =
      r.allParticipantsStatus?.toLowerCase().includes("tidak dianalisa") ||
      (r.allParticipantsZScore === null && r.allParticipantsTarget === null && r.zScore === null && r.targetValue === null);
    const allTarget = !isAllNotAnalyzed ? (r.allParticipantsTarget ?? r.targetValue) : null;
    const allSdpa = !isAllNotAnalyzed ? (r.allParticipantsSdpa ?? r.sdpa) : null;
    const allZ = !isAllNotAnalyzed ? (r.allParticipantsZScore ?? r.zScore) : null;
    const allStatus = !isAllNotAnalyzed ? (r.allParticipantsStatus ?? (r.zStatus ? STATUS_LABEL[r.zStatus] : "")) : "-";

    const overallStatus = getOverallStatusLabel(r);
    const rowLevel = getRowEvaluationLevel(r);

    const row = ws.addRow({
      no: idx + 1,
      parameter: r.parameterName,
      participant: r.participantValue ?? "",
      unit: r.unit || "",
      method: r.method || "",
      instrument: r.instrument || "",
      instrumentTarget: instTarget !== null && instTarget !== undefined ? Number(instTarget) : "",
      instrumentSdpa: instSdpa !== null && instSdpa !== undefined ? Number(instSdpa) : "",
      instrumentZScore: instZ !== null && instZ !== undefined ? Number(instZ) : "",
      instrumentStatus: instStatus || "",
      methodTarget: methTarget !== null && methTarget !== undefined ? Number(methTarget) : "",
      methodSdpa: methSdpa !== null && methSdpa !== undefined ? Number(methSdpa) : "",
      methodZScore: methZ !== null && methZ !== undefined ? Number(methZ) : "",
      methodStatus: methStatus || "",
      allParticipantsTarget: allTarget !== null && allTarget !== undefined ? Number(allTarget) : "",
      allParticipantsSdpa: allSdpa !== null && allSdpa !== undefined ? Number(allSdpa) : "",
      allParticipantsZScore: allZ !== null && allZ !== undefined ? Number(allZ) : "",
      allParticipantsStatus: allStatus || "",
      status: overallStatus,
      instrumentEvaluation: a?.instrumentEvaluation || "",
      methodEvaluation: a?.methodEvaluation || "",
      biasAnalysis: a?.biasAnalysis || "",
      interpretation: a?.interpretation || "",
      cause: formatListForCell(a?.possibleCauses),
      investigation: formatListForCell(a?.investigationSteps),
      corrective: formatListForCell(a?.correctiveActions),
      preventive: formatListForCell(a?.preventiveActions),
    });

    row.alignment = { vertical: "middle", wrapText: true };

    // Border tipis rapi pada setiap sel
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    // Pewarnaan baris sesuai status Z-Score:
    // Merah untuk Tidak Memuaskan (UNSATISFACTORY)
    // Kuning untuk Peringatan (WARNING)
    if (rowLevel === "UNSATISFACTORY") {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEE2E2" }, // Merah pastel
        };
      });
      const statusCell = row.getCell("status");
      statusCell.font = { bold: true, color: { argb: "FF991B1B" } };
      const paramCell = row.getCell("parameter");
      paramCell.font = { bold: true, color: { argb: "FF991B1B" } };
    } else if (rowLevel === "WARNING") {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" }, // Kuning pastel
        };
      });
      const statusCell = row.getCell("status");
      statusCell.font = { bold: true, color: { argb: "FF92400E" } };
      const paramCell = row.getCell("parameter");
      paramCell.font = { bold: true, color: { argb: "FF92400E" } };
    }
  }

  // Format angka 2 desimal untuk kolom target & Z-score
  ["G", "H", "I", "K", "L", "M", "O", "P", "Q"].forEach((colLetter) => {
    ws.getColumn(colLetter).numFmt = "0.00";
    ws.getColumn(colLetter).alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.getColumn("A").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("C").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("D").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("J").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("N").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("R").alignment = { vertical: "middle", horizontal: "center" };
  ws.getColumn("S").alignment = { vertical: "middle", horizontal: "center" };

  // Identitas Sheet
  const info = wb.addWorksheet("Identitas Dokumen");
  info.columns = [
    { header: "Field", key: "f", width: 22 },
    { header: "Nilai / Keterangan", key: "v", width: 50 },
  ];
  info.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  info.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D7A69" } };
  [
    ["Laboratorium", session.laboratoryName || session.organization.name],
    ["Penyelenggara (Provider)", session.provider],
    ["Program PME", session.program],
    ["Siklus", session.cycle],
    ["Periode", session.period],
    ["Nomor Peserta", session.participantId],
    ["Nama Berkas PDF", session.file?.fileName],
    ["Versi Aturan Z-Score", session.ruleVersion],
    ["Metode Validasi", "Standar ISO 13528 & Permenkes"],
    ["Tanggal Unggah", session.createdAt.toLocaleString("id-ID")],
  ].forEach(([f, v]) => info.addRow({ f, v: v ?? "-" }));

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/* ========================================================================== */
/*       EXCEL MODEL 2 (FORMAT TEMPLATE ASLI: EVALUASI PME.xlsx 5 KOLOM)      */
/* ========================================================================== */

export async function generateExcelReportModel2(sessionId: string, organizationId: string): Promise<Buffer> {
  const session = await db.pmeSession.findFirst({
    where: { id: sessionId, ...(organizationId === "ALL" ? {} : { organizationId }) },
    include: {
      file: true,
      results: { include: { aiAnalysis: true, capaActions: true }, orderBy: { parameterName: "asc" } },
      organization: true,
    },
  });
  if (!session) throw new Error("Sesi PME tidak ditemukan");

  const wb = new ExcelJS.Workbook();
  wb.creator = "didikpme - Evaluasi Mutu PME";
  wb.created = new Date();

  const ws = wb.addWorksheet("Sheet1");

  // Title info at top rows
  ws.getCell("B2").value = "FORMULIR EVALUASI DAN TINDAK LANJUT HASIL PEMANTAPAN MUTU EKSTERNAL (PME)";
  ws.getCell("B2").font = { bold: true, size: 12 };

  ws.getCell("B3").value = `Laboratorium: ${session.laboratoryName || session.organization.name}  |  Program: ${session.program || "Kimia Klinik"}  |  Siklus: ${session.cycle || "-"}  |  Periode: ${session.period || "-"}`;
  ws.getCell("B3").font = { size: 10, italic: true };

  // Row 5 is header per the uploaded template EVALUASI PME.xlsx
  const headerRow = ws.getRow(5);
  headerRow.values = [null, "No.", "Sasaran", "Hasil Pencapain", "Rencana Perbaikan", "Penanggung Jawab"];
  headerRow.height = 28;
  headerRow.font = { bold: true, size: 10, color: { argb: "FF000000" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  // Styling columns B to F
  ws.getColumn(2).width = 8;   // No.
  ws.getColumn(3).width = 32;  // Sasaran
  ws.getColumn(4).width = 36;  // Hasil Pencapain
  ws.getColumn(5).width = 55;  // Rencana Perbaikan
  ws.getColumn(6).width = 24;  // Penanggung Jawab

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FF999999" } },
    left: { style: "thin" as const, color: { argb: "FF999999" } },
    bottom: { style: "thin" as const, color: { argb: "FF999999" } },
    right: { style: "thin" as const, color: { argb: "FF999999" } },
  };

  // Border for header cells
  for (let c = 2; c <= 6; c++) {
    const cell = headerRow.getCell(c);
    cell.border = thinBorder;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F0ED" } };
  }

  // Populate data rows starting at row 6
  let curRow = 6;
  session.results.forEach((r, idx) => {
    const a = r.aiAnalysis;
    const isAnalyzed = getRowEvaluationLevel(r) !== "NOT_ANALYZED";
    const zStr = isAnalyzed && r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
    const statusStr = isAnalyzed ? (STATUS_LABEL[r.zStatus || ""] || "Perlu Review") : "-";

    const sasaran = `Pemeriksaan ${r.parameterName}` + (r.method ? `\n(Metode: ${r.method})` : "");
    const pencapaian = isAnalyzed
      ? `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nTarget: ${r.targetValue ?? "-"}\nSDPA: ${r.sdpa ?? "-"}\nZ-Score: ${zStr} (${statusStr})`
      : `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nTarget: -\nSDPA: -\nZ-Score: - (-)`;

    let perbaikan = "";
    if (!isAnalyzed) {
      perbaikan = "-";
    } else if (a?.correctiveActions) {
      const corrective = safeParseArray(a.correctiveActions);
      const preventive = safeParseArray(a.preventiveActions);
      const cLines = corrective.map((c, i) => `${i + 1}. ${c}`).join("\n");
      const pLines = preventive.map((p, i) => `${i + 1}. ${p}`).join("\n");
      perbaikan = [cLines, pLines ? `Pencegahan:\n${pLines}` : ""].filter(Boolean).join("\n\n");
    } else if (r.zStatus === "SATISFACTORY") {
      perbaikan = "Pertahankan mutu pengujian dengan monitoring harian IQC dan pemeliharaan instrumen rutin.";
    } else {
      perbaikan = "Evaluasi reagen dan lakukan verifikasi bahan kontrol.";
    }

    const pic = r.capaActions?.[0]?.pic || "Analis QA / Ka Lab";

    const row = ws.getRow(curRow);
    row.values = [null, idx + 1, sasaran, pencapaian, perbaikan, pic];
    row.alignment = { vertical: "middle", wrapText: true };

    row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(6).alignment = { vertical: "middle", horizontal: "center" };

    for (let c = 2; c <= 6; c++) {
      row.getCell(c).border = thinBorder;
    }

    curRow += 1;
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function formatListForCell(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return "";
    return parsed
      .map((item) => {
        if (typeof item === "string") return `• ${item}`;
        if (item && typeof item === "object") {
          const c = item as { category?: string; text?: string };
          return `• [${c.category || "?"}] ${c.text || ""}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const lines = doc.splitTextToSize(text || "-", maxWidth) as string[];
  lines.forEach((line) => {
    doc.text(line, x, y);
    y += 4.5;
  });
  return y;
}
