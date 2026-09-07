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
  WARNING: "Waspada",
  UNSATISFACTORY: "Tidak Memuaskan",
};

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return Number(n).toFixed(digits).replace(/\.?0+$/, "") || "0";
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
  doc.text("Pemantapan Mutu Eksternal (External Quality Assessment) — Berbasis AI Gemini", 14, 44);
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
      ["AI Engine Analisis", `${session.aiProvider || "gemini"} (Gemini 3.6 Flash)`],
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

  /* ---------- RESULT TABLE (Ringkasan) ---------- */
  doc.setFontSize(13);
  doc.text("3. Rekapitulasi Hasil Numerik Z-Score", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "striped",
    head: [["Parameter", "Hasil Peserta", "Target / Mean", "SDPA", "Z-Score", "Status Mutu", "Keyakinan AI"]],
    body: results.map((r) => {
      const conf = Math.min(r.parameterConfidence, r.participantConfidence, r.targetConfidence, r.zScoreConfidence);
      return [
        r.parameterName,
        r.participantValue !== null ? `${fmt(r.participantValue, 4)} ${r.unit || ""}`.trim() : "-",
        r.targetValue !== null ? fmt(r.targetValue, 4) : "-",
        r.sdpa !== null ? fmt(r.sdpa, 4) : "-",
        r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-",
        r.zStatus ? STATUS_LABEL[r.zStatus] : "Perlu Review",
        conf > 0 ? `${Math.round(conf * 100)}%` : "-",
      ];
    }),
    headStyles: { fillColor: [13, 122, 105], fontSize: 8.5 },
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 42 } },
  });

  /* ---------- TABEL KOMPREHENSIF Z-SCORE DENGAN KOLOM AI LENGKAP ---------- */
  // Disajikan dalam halaman baru berorientasi LANDSCAPE agar seluruh kolom terbaca jelas
  doc.addPage("a4", "landscape");
  const landW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 122, 105);
  doc.rect(0, 0, landW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("4. Evaluasi Mendalam Hasil Z-Score & Rencana Tindakan Mutu (Analisis AI)", 14, 13);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.text(
    "Tabel di bawah menyajikan rincian setiap parameter yang memiliki nilai Z-Score mencakup Interpretasi Klinis, Kemungkinan Akar Masalah, Investigasi, Tindakan Perbaikan, dan Tindakan Pencegahan.",
    14,
    27
  );

  const zResults = results.filter((r) => r.zScore !== null || r.aiAnalysis !== null);

  autoTable(doc, {
    startY: 32,
    theme: "grid",
    head: [[
      "Parameter & Z-Score",
      "Interpretasi Klinis",
      "Kemungkinan Penyebab",
      "Langkah Investigasi",
      "Tindakan Perbaikan (Korektif)",
      "Tindakan Pencegahan"
    ]],
    body: zResults.map((r) => {
      const a = r.aiAnalysis;
      const zStr = r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
      const paramCol = `${r.parameterName}\n(Z = ${zStr})\nStatus: ${STATUS_LABEL[r.zStatus || ""] || "Review"}`;

      const interp = a?.interpretation
        ? a.interpretation
        : (r.zStatus === "SATISFACTORY"
            ? "Hasil dalam batas toleransi analitik (memuaskan). Performa pengujian stabil."
            : "Memerlukan investigasi lebih lanjut terkait deviasi analitik.");

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
      1: { cellWidth: 50 },
      2: { cellWidth: 48 },
      3: { cellWidth: 46 },
      4: { cellWidth: 48 },
      5: { cellWidth: 45 },
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
  doc.setFontSize(14);
  doc.text("FORMULIR EVALUASI DAN TINDAK LANJUT HASIL PEMANTAPAN MUTU EKSTERNAL (PME)", 14, 11);
  doc.setFontSize(9);
  doc.text(`Laboratorium: ${session.laboratoryName || session.organization.name} | Program: ${session.program || "Kimia Klinik"} | Siklus: ${session.cycle || "-"} | Periode: ${session.period || "-"}`, 14, 18);

  doc.setTextColor(30, 30, 30);

  /* 5 Columns matching EVALUASI PME.xlsx: No, Sasaran, Hasil Pencapain, Rencana Perbaikan, Penanggung Jawab */
  const bodyRows = session.results.map((r, idx) => {
    const a = r.aiAnalysis;
    const zStr = r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
    const statusStr = STATUS_LABEL[r.zStatus || ""] || "Perlu Review";

    const sasaran = `Pemeriksaan ${r.parameterName}\n(Metode: ${r.method || "Standard"}, Alat: ${r.instrument || "Auto Analyzer"})`;
    const pencapaian = `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nNilai Target: ${r.targetValue ?? "-"}\nSDPA: ${r.sdpa ?? "-"}\nZ-Score: ${zStr} (${statusStr})`;

    let perbaikan = "";
    if (a?.correctiveActions) {
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
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
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
  wb.creator = "didikpme - PME AI Analyzer";
  wb.created = new Date();

  const ws = wb.addWorksheet("Hasil PME Teknis");
  ws.columns = [
    { header: "Parameter", key: "parameter", width: 28 },
    { header: "Participant Value", key: "participant", width: 18 },
    { header: "Target", key: "target", width: 18 },
    { header: "SDPA", key: "sdpa", width: 14 },
    { header: "Z-score", key: "zscore", width: 14 },
    { header: "Peer Group", key: "peergroup", width: 20 },
    { header: "Status Mutu", key: "status", width: 16 },
    { header: "Confidence AI", key: "confidence", width: 14 },
    { header: "Interpretasi Klinis", key: "interpretation", width: 50 },
    { header: "Kemungkinan Penyebab", key: "cause", width: 45 },
    { header: "Langkah Investigasi", key: "investigation", width: 45 },
    { header: "Tindakan Korektif", key: "corrective", width: 45 },
    { header: "Tindakan Preventif", key: "preventive", width: 45 },
  ];

  ws.getRow(1).height = 26;
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D7A69" } };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  for (const r of session.results) {
    const a = r.aiAnalysis;
    const conf = Math.min(r.parameterConfidence, r.participantConfidence, r.targetConfidence, r.zScoreConfidence);
    const row = ws.addRow({
      parameter: r.parameterName,
      participant: r.participantValue ?? "",
      target: r.targetValue ?? "",
      sdpa: r.sdpa ?? "",
      zscore: r.zScore ?? "",
      peergroup: r.peerGroup ?? "",
      status: r.zStatus ? STATUS_LABEL[r.zStatus] : (r.validationStatus === "REVIEW_REQUIRED" ? "Review" : ""),
      confidence: conf > 0 ? `${Math.round(conf * 100)}%` : "",
      interpretation: a?.interpretation || "",
      cause: formatListForCell(a?.possibleCauses),
      investigation: formatListForCell(a?.investigationSteps),
      corrective: formatListForCell(a?.correctiveActions),
      preventive: formatListForCell(a?.preventiveActions),
    });
    row.alignment = { vertical: "middle", wrapText: true };
  }

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
    ["AI Provider", session.aiProvider],
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
  wb.creator = "didikpme - PME AI Analyzer";
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
    const zStr = r.zScore !== null ? (r.zScore > 0 ? `+${fmt(r.zScore, 2)}` : fmt(r.zScore, 2)) : "-";
    const statusStr = STATUS_LABEL[r.zStatus || ""] || "Perlu Review";

    const sasaran = `Pemeriksaan ${r.parameterName}` + (r.method ? `\n(Metode: ${r.method})` : "");
    const pencapaian = `Hasil Peserta: ${r.participantValue ?? "-"} ${r.unit || ""}\nTarget: ${r.targetValue ?? "-"}\nSDPA: ${r.sdpa ?? "-"}\nZ-Score: ${zStr} (${statusStr})`;

    let perbaikan = "";
    if (a?.correctiveActions) {
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
