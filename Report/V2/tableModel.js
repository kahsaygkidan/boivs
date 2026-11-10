import { dash } from './shared.js';

/* Report model for any on-screen table: { header, rows } + the active filters.
   Works with every exporter (print, pdf, docx, xlsx, csv, json). */
export function buildTableReport({ title, filters = [], header, rows, sheetName = 'Data', landscape = true }) {
  const filterText = filters.length ? filters.join(' · ') : 'None';
  return {
    title,
    subtitle: filters.length ? filterText : 'No filters applied',
    status: `${rows.length} record${rows.length === 1 ? '' : 's'}`,
    generatedAt: new Date().toLocaleString(),
    landscape,
    sections: [
      { title: 'Report scope', kind: 'rows', rows: [['Applied filters', filterText], ['Records', String(rows.length)]] },
      { title: sheetName, kind: 'table', head: header, rows: rows.map((r) => r.map(dash)) },
    ],
    csv: { head: header, rows },
    raw: { title, filters, header, rows },
  };
}
