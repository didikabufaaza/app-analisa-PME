import { PmeDocumentHeader } from '../types';
import html2pdf from 'html2pdf.js';

// Comprehensive standalone CSS for OfficialTable rendering without any Tailwind v4 / oklab dependencies
const PDF_STANDALONE_CSS = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    background-color: #ffffff !important;
    color: #0f172a !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    font-size: 12px;
    line-height: 1.5;
    padding: 0;
    margin: 0;
  }

  #pme-official-report {
    width: 100% !important;
    max-width: 100% !important;
    background-color: #ffffff !important;
    color: #1e293b !important;
    font-family: inherit !important;
    padding: 16px 20px !important;
    box-shadow: none !important;
    border: none !important;
    margin: 0 auto !important;
  }

  .print\\:hidden, [class*="print:hidden"] {
    display: none !important;
  }

  /* Table styling */
  table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 11px !important;
    margin-top: 8px;
    margin-bottom: 8px;
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  th {
    background-color: #f1f5f9 !important;
    color: #475569 !important;
    font-weight: 700 !important;
    border: 1px solid #cbd5e1 !important;
    padding: 8px 10px !important;
    text-transform: uppercase !important;
    font-size: 10px !important;
    letter-spacing: 0.05em !important;
  }

  td {
    border: 1px solid #e2e8f0 !important;
    padding: 8px 10px !important;
    vertical-align: top !important;
    font-size: 11px !important;
  }

  /* Colors & Utilities */
  .bg-white { background-color: #ffffff !important; }
  .bg-slate-50 { background-color: #f8fafc !important; }
  .bg-slate-100 { background-color: #f1f5f9 !important; }
  .bg-indigo-50\\/40, [class*="bg-indigo-50"] { background-color: #eef2ff !important; }
  .bg-indigo-100\\/60, [class*="bg-indigo-100"] { background-color: #e0e7fe !important; }
  .bg-emerald-50 { background-color: #ecfdf5 !important; }
  .bg-amber-50 { background-color: #fffbeb !important; }
  .bg-red-50 { background-color: #fef2f2 !important; }

  .text-slate-900 { color: #0f172a !important; }
  .text-slate-800 { color: #1e293b !important; }
  .text-slate-700 { color: #334155 !important; }
  .text-slate-600 { color: #475569 !important; }
  .text-slate-500 { color: #64748b !important; }
  .text-slate-400 { color: #94a3b8 !important; }
  .text-indigo-900 { color: #312e81 !important; }
  .text-indigo-700 { color: #4338ca !important; }
  .text-emerald-800 { color: #065f46 !important; }
  .text-emerald-700 { color: #047857 !important; }
  .text-amber-800 { color: #92400e !important; }
  .text-amber-700 { color: #b45309 !important; }
  .text-red-800 { color: #991b1b !important; }
  .text-red-700 { color: #b91c1c !important; }

  .border-slate-100 { border-color: #f1f5f9 !important; }
  .border-slate-200 { border-color: #e2e8f0 !important; }
  .border-slate-300 { border-color: #cbd5e1 !important; }
  .border-emerald-200 { border-color: #a7f3d0 !important; }
  .border-amber-200 { border-color: #fde68a !important; }
  .border-red-200 { border-color: #fecaca !important; }
  .border-indigo-200 { border-color: #c7d2fe !important; }

  .font-bold { font-weight: 700 !important; }
  .font-semibold { font-weight: 600 !important; }
  .font-medium { font-weight: 500 !important; }
  .uppercase { text-transform: uppercase !important; }
  .tracking-tight { letter-spacing: -0.025em !important; }
  .tracking-wide, .tracking-wider { letter-spacing: 0.05em !important; }
  .text-center { text-align: center !important; }
  .text-right { text-align: right !important; }
  .text-left { text-align: left !important; }
  .underline { text-decoration: underline !important; }

  /* Flex & Grid Layout for Signatures in PDF */
  .flex { display: flex !important; }
  .flex-col { flex-direction: column !important; }
  .flex-wrap { flex-wrap: wrap !important; }
  .items-center { align-items: center !important; }
  .justify-between { justify-content: space-between !important; }
  .justify-end { justify-content: flex-end !important; }
  .justify-start { justify-content: flex-start !important; }
  .justify-center { justify-content: center !important; }
  .grid { display: grid !important; }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .gap-2 { gap: 8px !important; }
  .gap-4 { gap: 16px !important; }
  .gap-6 { gap: 24px !important; }
  .gap-8 { gap: 32px !important; }

  .rounded { border-radius: 4px !important; }
  .rounded-md { border-radius: 6px !important; }
  .rounded-lg { border-radius: 8px !important; }

  /* Cursive font for signature */
  .font-serif { font-family: Georgia, Cambria, "Times New Roman", Times, serif !important; }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
  .italic { font-style: italic !important; }

  /* Page break avoidance */
  .print\\:break-inside-avoid {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
`;

/**
 * Deeply strips all modern CSS variables and oklab/oklch strings from any inline style attributes
 */
function cleanInlineStyles(element: HTMLElement) {
  const styleAttr = element.getAttribute('style');
  if (styleAttr && (styleAttr.includes('okl') || styleAttr.includes('color(') || styleAttr.includes('var('))) {
    const cleaned = styleAttr
      .replace(/(oklab|oklch|color|light-dark)\s*\([^)]*\)/gi, '#1e293b')
      .replace(/var\(--[^)]+\)/gi, '#1e293b');
    element.setAttribute('style', cleaned);
  }

  // Sanitize all descendants
  const children = element.querySelectorAll('*');
  children.forEach((child) => {
    const childEl = child as HTMLElement;
    const childStyle = childEl.getAttribute('style');
    if (childStyle && (childStyle.includes('okl') || childStyle.includes('color(') || childStyle.includes('var('))) {
      const cleaned = childStyle
        .replace(/(oklab|oklch|color|light-dark)\s*\([^)]*\)/gi, '#1e293b')
        .replace(/var\(--[^)]+\)/gi, '#1e293b');
      childEl.setAttribute('style', cleaned);
    }
  });
}

/**
 * Prepares the cloned document for html2canvas by replacing all Tailwind v4 stylesheets
 * with pure standard RGB/HEX CSS.
 */
function sanitizeClonedDocumentForPdf(clonedDoc: Document, elementId: string) {
  // 1. Remove ALL existing <style> and <link rel="stylesheet"> tags to eliminate oklab/oklch rules completely
  const existingStyles = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
  existingStyles.forEach((s) => s.parentNode?.removeChild(s));

  // 2. Remove all elements with print:hidden from the cloned DOM
  const printHiddenEls = Array.from(clonedDoc.querySelectorAll('.print\\:hidden, [class*="print:hidden"]'));
  printHiddenEls.forEach((el) => el.parentNode?.removeChild(el));

  // 3. Inject our standalone, 100% standard-compliant CSS
  const styleTag = clonedDoc.createElement('style');
  styleTag.type = 'text/css';
  styleTag.textContent = PDF_STANDALONE_CSS;
  clonedDoc.head.appendChild(styleTag);

  // 4. Clean any inline style attributes that might contain oklch/oklab
  const reportElement = clonedDoc.getElementById(elementId);
  if (reportElement) {
    cleanInlineStyles(reportElement);
  }
}

export async function downloadPmeAsPdf(
  header: PmeDocumentHeader,
  elementId = 'pme-official-report'
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Elemen tabel laporan PME tidak ditemukan pada halaman.');
  }

  const filename = `Laporan_Evaluasi_PME_Hematologi_${header.kodePeserta || 'Peserta'}_${(header.tanggalHasil || '2025').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  const opt = {
    margin: [8, 8, 8, 8] as [number, number, number, number],
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      windowWidth: 1100,
      onclone: (clonedDoc: Document) => {
        sanitizeClonedDocumentForPdf(clonedDoc, elementId);
      },
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      avoid: ['tr', '.print\\:break-inside-avoid'],
    },
  };

  try {
    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (error) {
    console.error('html2pdf execution error:', error);
    // If html2pdf fails for any reason, trigger standard browser print as foolproof fallback
    window.print();
    throw error;
  }
}
