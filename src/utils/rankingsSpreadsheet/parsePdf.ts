/**
 * Text extraction for uploaded rankings PDFs (ESPN cheat sheets, our own exported boards, etc.).
 * pdf.js is loaded lazily so its ~1MB only ships to users who actually upload a PDF.
 */

/** Shape of pdf.js text items we care about (subset of TextItem). */
export type PdfTextItemLike = {
  str: string;
  /** PDF transform matrix; [4] is x, [5] is y (origin bottom-left). */
  transform: number[];
  width?: number;
};

/** Vertical distance (in PDF units) within which two text items count as the same visual line. */
const LINE_Y_TOLERANCE = 3;
/** Horizontal gap (in PDF units) below which adjacent items are joined without a space (split-up words). */
const WORD_GAP_THRESHOLD = 1;

/**
 * Rebuilds visual lines from pdf.js text items. Items arrive in content order, which for multi-column
 * layouts is not reading order, so instead we cluster by y coordinate (same baseline = same line) and
 * sort each line's items left to right. PDFs also split single words across items at font/kerning
 * boundaries; items that sit flush against each other are joined without a space so names survive intact.
 */
export function pdfTextItemsToLines(items: PdfTextItemLike[]): string[] {
  const positioned = items
    .filter((it) => it.str.trim() !== '')
    .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5], width: it.width ?? 0 }));

  positioned.sort((a, b) => b.y - a.y);

  const clusters: { y: number; items: typeof positioned }[] = [];
  for (const item of positioned) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(item.y - last.y) <= LINE_Y_TOLERANCE) {
      last.items.push(item);
    } else {
      clusters.push({ y: item.y, items: [item] });
    }
  }

  const lines: string[] = [];
  for (const cluster of clusters) {
    cluster.items.sort((a, b) => a.x - b.x);
    let line = '';
    let prevEnd: number | null = null;
    for (const item of cluster.items) {
      if (prevEnd !== null && item.x - prevEnd > WORD_GAP_THRESHOLD) {
        line += ' ';
      }
      line += item.text;
      prevEnd = item.x + item.width;
    }
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (cleaned) lines.push(cleaned);
  }
  return lines;
}

/** Extracts all text from a PDF as visual lines, page by page in order. */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  const loadingTask = pdfjs.getDocument({ data });
  try {
    const doc = await loadingTask.promise;
    const lines: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      lines.push(...pdfTextItemsToLines(content.items as PdfTextItemLike[]));
    }
    return lines.join('\n');
  } finally {
    await loadingTask.destroy();
  }
}
