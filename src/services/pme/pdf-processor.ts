/**
 * PDF Processor (PRD sections #13, #14, #15, #16)
 * - File validation: MIME, extension, size, page count, corruption (pdf-lib)
 * - Classification: TEXT_PDF | SCANNED_PDF | MIXED_PDF
 * - Text extraction per page (unpdf/pdfjs)
 * - Page rendering for scanned PDFs (pdftoppm) used by vision-based extraction
 * - Document normalization: { pages: [{ page_number, text, images }] }
 */
import { PDFDocument } from "pdf-lib";
import { getDocumentProxy, extractText } from "unpdf";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { NormalizedPage, PdfClass } from "@/services/ai/ai-provider";

export interface PdfValidationLimits {
  maxBytes: number;
  maxPages: number;
}

export interface PdfValidationResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export function validateUploadMeta(opts: { mimeType: string; originalName: string; sizeBytes: number }): PdfValidationResult {
  const maxBytes = (Number(process.env.MAX_PDF_SIZE_MB) || 15) * 1024 * 1024;
  if (!opts.originalName.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Hanya berkas berekstensi .pdf yang diperbolehkan.", code: "INVALID_EXTENSION" };
  }
  const normalizedMime = opts.mimeType.toLowerCase();
  if (normalizedMime !== "application/pdf" && normalizedMime !== "application/x-pdf" && normalizedMime !== "application/octet-stream") {
    return { ok: false, error: "Format berkas tidak didukung. Tipe MIME harus application/pdf.", code: "INVALID_MIME" };
  }
  if (opts.sizeBytes <= 0) {
    return { ok: false, error: "Berkas kosong atau tidak dapat dibaca.", code: "EMPTY_FILE" };
  }
  if (opts.sizeBytes > maxBytes) {
    return { ok: false, error: `Ukuran berkas melebihi batas maksimum ${maxBytes / (1024 * 1024)} MB.`, code: "FILE_TOO_LARGE" };
  }
  return { ok: true };
}

/** Deep validation using magic bytes + pdf-lib: corruption + encryption + page count. */
export async function validatePdfBuffer(buffer: Buffer): Promise<{ ok: boolean; error?: string; code?: string; pageCount?: number }> {
  // 1. Verify standard PDF magic bytes: %PDF-
  if (buffer.length < 5 || buffer.subarray(0, 5).toString("utf-8") !== "%PDF-") {
    return { ok: false, error: "Format berkas bukan PDF yang valid (header berkas tidak sesuai).", code: "INVALID_PDF_HEADER" };
  }

  const maxPages = Number(process.env.MAX_PAGES_PER_PDF) || 50;
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
  } catch {
    return { ok: false, error: "Berkas PDF rusak atau tidak dapat diproses.", code: "CORRUPT_PDF" };
  }
  if (doc.isEncrypted) {
    return { ok: false, error: "Berkas PDF terenkripsi (dilindungi kata sandi) tidak didukung.", code: "ENCRYPTED_PDF" };
  }
  const pageCount = doc.getPageCount();
  if (pageCount === 0) {
    return { ok: false, error: "Berkas PDF tidak memiliki halaman.", code: "EMPTY_PDF" };
  }
  if (pageCount > maxPages) {
    return { ok: false, error: `Dokumen melebihi batas ${maxPages} halaman (${pageCount} halaman terdeteksi).`, code: "PAGE_LIMIT_EXCEEDED" };
  }
  return { ok: true, pageCount };
}

/** Extract text per page using unpdf (bundled pdfjs). */
export async function extractPageTexts(buffer: Buffer): Promise<string[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    if (Array.isArray(text)) return text;
    return [String(text)];
  } catch (e) {
    console.error("[pdf-text-extraction-failed]", e);
    return [];
  }
}

/**
 * Classify the PDF by measuring meaningful text per page.
 * OCR-confusable characters are NOT auto-corrected here — ambiguity is flagged
 * downstream by the validation engine (PRD section #15: never guess).
 */
export function classifyPdf(pageTexts: string[]): { pdfClass: PdfClass; textyPages: number } {
  const meaningful = pageTexts.filter((t) => (t || "").replace(/\s+/g, "").length >= 120).length;
  const total = Math.max(1, pageTexts.length);
  let pdfClass: PdfClass;
  if (meaningful === 0) pdfClass = "SCANNED_PDF";
  else if (meaningful < total * 0.6) pdfClass = "MIXED_PDF";
  else pdfClass = "TEXT_PDF";
  return { pdfClass, textyPages: meaningful };
}

/** Render specific PDF pages to PNG base64 using poppler's pdftoppm (for scanned OCR). */
export async function renderPagesToImages(buffer: Buffer, maxPages = 10, dpi = 150): Promise<NormalizedPage["image_base64"][]> {
  const id = randomUUID();
  const dir = join(tmpdir(), `pme-${id}`);
  try {
    await fs.mkdir(dir, { recursive: true });
    const pdfPath = join(dir, "doc.pdf");
    await fs.writeFile(pdfPath, buffer);
    const prefix = join(dir, "page");
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("pdftoppm", ["-png", "-r", String(dpi), pdfPath, prefix]);
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += String(d)));
      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(stderr || `pdftoppm exited ${code}`))));
    });
    const files = (await fs.readdir(dir)).filter((f) => f.startsWith("page") && f.endsWith(".png")).sort();
    const images: string[] = [];
    for (const f of files.slice(0, maxPages)) {
      const data = await fs.readFile(join(dir, f));
      images.push(data.toString("base64"));
    }
    return images;
  } catch (e) {
    console.error("[pdf-render-failed]", e);
    return [];
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export interface NormalizedDocument {
  pageCount: number;
  pdfClass: PdfClass;
  pages: NormalizedPage[];
}

/** Full pipeline: normalize document structure sent to AI providers (PRD section #16). */
export async function normalizeDocument(buffer: Buffer, fileName: string, includeImages: boolean): Promise<NormalizedDocument> {
  const pageTexts = await extractPageTexts(buffer);
  const { pdfClass } = classifyPdf(pageTexts);
  const pageCount = Math.max(pageTexts.length, 1);

  const pages: NormalizedPage[] = [];
  for (let i = 0; i < Math.min(pageTexts.length, 60); i++) {
    pages.push({ page_number: i + 1, text: pageTexts[i] || "" });
  }

  if (includeImages && pdfClass !== "TEXT_PDF") {
    const images = await renderPagesToImages(buffer, Math.min(pageCount, 10));
    images.forEach((img, idx) => {
      if (pages[idx]) pages[idx].image_base64 = img;
      else pages.push({ page_number: idx + 1, text: "", image_base64: img });
    });
  }

  return { pageCount, pdfClass, pages };
}
