import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RankedPlayer } from '@/types/database';
import { formatRankingBucketLabel, type UserRankingBucketDb } from '@/utils/userRankingsBucket';
import { displayTeamAbbrevOrFa } from '@/utils/teamMapping';

const EXPORT_COLUMNS = ['Rank', 'Player', 'Position', 'Team', 'Bye', 'ADP'] as const;

function buildExportRows(players: RankedPlayer[]): (string | number)[][] {
  return players.map((p) => [
    p.rank,
    p.name,
    p.position,
    displayTeamAbbrevOrFa(p.team, p.position, p.name),
    p.bye_week ?? '',
    p.adp != null ? Math.round(p.adp * 10) / 10 : '',
  ]);
}

function exportFileBaseName(bucket: UserRankingBucketDb): string {
  const label = formatRankingBucketLabel(bucket)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `my-rankings-${label}-${date}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Downloads the current rankings as a CSV file — opens cleanly in Excel or Google Sheets. */
export function exportRankingsToCsv(players: RankedPlayer[], bucket: UserRankingBucketDb) {
  const rows = buildExportRows(players);
  const lines = [EXPORT_COLUMNS.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${exportFileBaseName(bucket)}.csv`);
}

/** Downloads the current rankings as an .xlsx workbook — opens in Excel or Google Sheets. */
export function exportRankingsToXlsx(players: RankedPlayer[], bucket: UserRankingBucketDb) {
  const rows = buildExportRows(players);
  const worksheet = XLSX.utils.aoa_to_sheet([[...EXPORT_COLUMNS], ...rows]);
  worksheet['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 8 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rankings');
  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, `${exportFileBaseName(bucket)}.xlsx`);
}

/** Downloads a printable PDF of the current rankings, paginated for long boards (e.g. Top 300). */
export function exportRankingsToPdf(players: RankedPlayer[], bucket: UserRankingBucketDb) {
  const rows = buildExportRows(players);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const title = 'My Rankings';
  const subtitle = `${formatRankingBucketLabel(bucket)} — Generated ${new Date().toLocaleDateString()}`;

  doc.setFontSize(16);
  doc.text(title, 40, 36);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitle, 40, 52);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [[...EXPORT_COLUMNS]],
    body: rows,
    startY: 66,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 40, halign: 'right' },
      1: { cellWidth: 180 },
      2: { cellWidth: 60 },
      3: { cellWidth: 60 },
      4: { cellWidth: 40, halign: 'right' },
      5: { cellWidth: 50, halign: 'right' },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 70,
        doc.internal.pageSize.getHeight() - 20
      );
    },
  });

  doc.save(`${exportFileBaseName(bucket)}.pdf`);
}
