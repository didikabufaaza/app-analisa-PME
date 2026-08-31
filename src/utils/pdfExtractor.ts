import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Extract raw structured text from all pages of a PDF file using pdfjs-dist.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Group items by line based on Y coordinate to preserve tabular alignment
      const items = textContent.items as Array<{ str: string; transform: number[] }>;
      
      if (!items || items.length === 0) continue;

      // Sort items top-to-bottom, left-to-right
      const sortedItems = [...items].sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 4) {
          return yDiff;
        }
        return a.transform[4] - b.transform[4];
      });

      let pageLines: string[] = [];
      let currentLine: string[] = [];
      let currentY = sortedItems[0]?.transform[5] ?? 0;

      for (const item of sortedItems) {
        if (Math.abs(item.transform[5] - currentY) > 4) {
          if (currentLine.length > 0) {
            pageLines.push(currentLine.join('\t'));
          }
          currentLine = [item.str];
          currentY = item.transform[5];
        } else {
          currentLine.push(item.str);
        }
      }

      if (currentLine.length > 0) {
        pageLines.push(currentLine.join('\t'));
      }

      pageTexts.push(`--- HALAMAN ${pageNum} DARI ${numPages} ---\n` + pageLines.join('\n'));
    }

    return pageTexts.join('\n\n');
  } catch (err) {
    console.warn('PDF text extraction error:', err);
    return '';
  }
}
