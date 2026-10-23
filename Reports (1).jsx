import { useEffect, useMemo, useState } from 'react';
import { getQueue, searchBoRecords } from '../api/bovsApi.js';
import './Reports.css';

/* Install once:  npm i xlsx jspdf jspdf-autotable */

/* ==========================================================================
   Constants
   ========================================================================== */

const RANGE_OPTIONS = [
  { value: '7d',     label: 'Last 7 days' },
  { value: '30d',    label: 'Last 30 days' },
  { value: 'qtd',    label: 'Quarter to date' },
  { value: 'ytd',    label: 'Year to date' },
  { value: 'all',    label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const REPORTS = [
  {
    key: 'bo-summary',
    title: 'BO registration summary',
    description: 'Beneficial owner records registered, by status and period.',
    fetch: () => searchBoRecords({ size: 200 }),
  },
  {
    key: 'verification-summary',
    title: 'Verification queue summary',
    description: 'Outcomes of checker verification decisions.',
    fetch: () => getQueue({ size: 200 }),
  },
];

const COLUMNS = [
  { key: 'ref',     label: 'Reference',    className: 'rp-mono' },
  { key: 'name',    label: 'Name' },
  { key: 'status',  label: 'Status' },
  { key: 'updated', label: 'Last updated' },
];

const PAGE_SIZE = 10;

/* ==========================================================================
   Data helpers
   ========================================================================== */

function toRows(payload) {
  const content = payload?.content || payload || [];
  return content.map((r) => {
    const raw = r.updatedAt || r.submittedAt;
    const ts = raw ? new Date(raw) : null;
    return {
      ref: r.boReference || r.id,
      name: r.fullName || '—',
      status: (r.status || 'pending').toLowerCase(),
      ts: ts && !Number.isNaN(ts.getTime()) ? ts : null,
    };
  });
}

const fmtDate = (d) => (d ? d.toLocaleDateString() : '—');
const capitalize = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');
const stamp = () => new Date().toISOString().slice(0, 10);

function rangeBounds(range, from, to) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const y = start.getFullYear();

  switch (range) {
    case '7d':  start.setDate(start.getDate() - 7);  return [start, null];
    case '30d': start.setDate(start.getDate() - 30); return [start, null];
    case 'qtd': return [new Date(y, Math.floor(start.getMonth() / 3) * 3, 1), null];
    case 'ytd': return [new Date(y, 0, 1), null];
    case 'custom':
      return [
        from ? new Date(`${from}T00:00:00`) : null,
        to ? new Date(`${to}T23:59:59.999`) : null,
      ];
    default: return [null, null];
  }
}

/* ==========================================================================
   Export helpers (lazy-loaded so they don't bloat the main bundle)
   ========================================================================== */

function toTable(rows) {
  return rows.map((r) => [r.ref, r.name, capitalize(r.status), fmtDate(r.ts)]);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(file, rows) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [COLUMNS.map((c) => c.label), ...toTable(rows)].map((l) => l.map(esc).join(','));
  saveBlob(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${file}.csv`);
}

async function exportExcel(file, title, meta, rows) {
  const XLSX = await import('xlsx');
  const aoa = [
    [title],
    [meta],
    [`Generated ${new Date().toLocaleString()}`],
    [],
    COLUMNS.map((c) => c.label),
    ...toTable(rows),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 14 }, { wch: 16 }];
  ws['!autofilter'] = { ref: `A5:D${aoa.length}` };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${file}.xlsx`);
}

async function exportPdf(file, title, meta, rows) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(11, 42, 91);
  doc.rect(0, 0, W, 64, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text('Dashen Bank', 40, 28);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text('Beneficial Owner Identification & Verification System', 40, 46);

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(title, 40, 100);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139);
  doc.text(meta, 40, 118);
  doc.text(`Generated ${new Date().toLocaleString()}  |  ${rows.length} records`, 40, 132);

  autoTable(doc, {
    startY: 148,
    head: [COLUMNS.map((c) => c.label)],
    body: toTable(rows),
    styles: { fontSize: 9, cellPadding: 6, textColor: [30, 41, 59] },
    headStyles: { fillColor: [11, 42, 91], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: () => {
      doc.setFontSize(8).setTextColor(100, 116, 139);
      doc.text(`Page ${doc.getNumberOfPages()}`, W - 40, H - 20, { align: 'right' });
    },
  });

  doc.save(`${file}.pdf`);
}

/* ==========================================================================
   Sub-components
   ========================================================================== */

const Icon = ({ d }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  download: 'M8 2v8m0 0L5 7m3 3 3-3M2.5 13h11',
  alert: 'M8 5v3.5M8 11h.01M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z',
  search: 'M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm4-1 3.5 3.5',
};

function StatusPill({ status }) {
  return (
    <span className={`rp-pill rp-st-${status}`}>
      <span className="rp-dot" />
      {capitalize(status)}
    </span>
  );
}

function Distribution({ counts, total }) {
  if (!total) return null;
  return (
    <div className="rp-dist" role="img" aria-label="Status distribution">
      <div className="rp-dist-bar">
        {Object.entries(counts).map(([s, n]) => (
          <span key={s} className={`rp-seg rp-st-${s}`} style={{ width: `${(n / total) * 100}%` }} title={`${capitalize(s)}: ${n}`} />
        ))}
      </div>
      <div className="rp-dist-legend">
        {Object.entries(counts).map(([s, n]) => (
          <span key={s} className={`rp-legend-item rp-st-${s}`}>
            <span className="rp-dot" />
            {capitalize(s)} <strong>{n}</strong>
            <em>{Math.round((n / total) * 100)}%</em>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Reports
   ========================================================================== */

export default function Reports() {
  const [selected, setSelected] = useState(REPORTS[0].key);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [range, setRange] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statuses, setStatuses] = useState([]); // empty = all
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);

  const report = useMemo(() => REPORTS.find((r) => r.key === selected), [selected]);

  /* --- Load data when the report changes --- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStatuses([]);

    report
      .fetch()
      .then((res) => !cancelled && setRows(toRows(res)))
      .catch((err) => {
        if (cancelled) return;
        setError(err.friendlyMessage || 'Could not load report data. Try again.');
        setRows([]);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [report]);

  /* --- Filtering --- */
  const [start, end] = useMemo(() => rangeBounds(range, from, to), [range, from, to]);

  // Date + search filtered (status chips show counts against this set)
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if ((start || end) && !r.ts) return false;
      if (start && r.ts < start) return false;
      if (end && r.ts > end) return false;
      if (q && !`${r.ref} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, start, end, query]);

  const counts = useMemo(
    () => scoped.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
    [scoped]
  );

  const filtered = useMemo(
    () => (statuses.length ? scoped.filter((r) => statuses.includes(r.status)) : scoped),
    [scoped, statuses]
  );

  const visibleCounts = useMemo(
    () => filtered.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}),
    [filtered]
  );

  useEffect(() => setPage(1), [range, from, to, statuses, query, selected]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const rangeLabel =
    range === 'custom'
      ? `${from || 'Start'} to ${to || 'Today'}`
      : RANGE_OPTIONS.find((o) => o.value === range)?.label;
  const meta = `Period: ${rangeLabel}  |  Status: ${statuses.length ? statuses.map(capitalize).join(', ') : 'All'}`;

  const toggleStatus = (s) =>
    setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const clearFilters = () => {
    setRange('30d'); setFrom(''); setTo(''); setStatuses([]); setQuery('');
  };
  const filtersActive = statuses.length || query || range !== '30d';

  /* --- Export --- */
  const run = async (kind) => {
    if (!filtered.length || busy) return;
    const file = `${report.key}_${stamp()}`;
    setBusy(kind);
    try {
      if (kind === 'csv') exportCsv(file, filtered);
      if (kind === 'xlsx') await exportExcel(file, report.title, meta, filtered);
      if (kind === 'pdf') await exportPdf(file, report.title, meta, filtered);
    } catch (e) {
      setError('Export failed. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const noData = !loading && !error && filtered.length === 0;

  /* ----------------------------------------------------------------------
     Render
     ---------------------------------------------------------------------- */
  return (
    <div className="rp">
      <header className="rp-head">
        <div>
          <h1>Reports</h1>
          <p>Compliance and activity reports. Filters apply to the preview and to every export.</p>
        </div>
        <div className="rp-export" role="group" aria-label="Export">
          <button className="rp-btn rp-btn-primary" disabled={!filtered.length || !!busy} onClick={() => run('xlsx')}>
            <Icon d={ICONS.download} /> {busy === 'xlsx' ? 'Preparing…' : 'Excel'}
          </button>
          <button className="rp-btn rp-btn-primary" disabled={!filtered.length || !!busy} onClick={() => run('pdf')}>
            <Icon d={ICONS.download} /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
          <button className="rp-btn rp-btn-ghost" disabled={!filtered.length || !!busy} onClick={() => run('csv')}>
            CSV
          </button>
        </div>
      </header>

      {/* Report selector */}
      <div className="rp-tabs" role="tablist" aria-label="Report type">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={r.key === selected}
            className={`rp-tab${r.key === selected ? ' is-active' : ''}`}
            onClick={() => setSelected(r.key)}
          >
            <span className="rp-tab-title">{r.title}</span>
            <span className="rp-tab-desc">{r.description}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <section className="rp-card rp-filters" aria-label="Filters">
        <div className="rp-filter-row">
          <label className="rp-field rp-search">
            <span className="rp-label">Search</span>
            <span className="rp-input-wrap">
              <Icon d={ICONS.search} />
              <input
                type="search"
                placeholder="Reference or name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>

          <label className="rp-field">
            <span className="rp-label">Period</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {range === 'custom' && (
            <>
              <label className="rp-field">
                <span className="rp-label">From</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="rp-field">
                <span className="rp-label">To</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}
        </div>

        <div className="rp-filter-row rp-status-row">
          <span className="rp-label">Status</span>
          <div className="rp-chips">
            <button
              className={`rp-chip${statuses.length === 0 ? ' is-on' : ''}`}
              aria-pressed={statuses.length === 0}
              onClick={() => setStatuses([])}
            >
              All <b>{scoped.length}</b>
            </button>
            {Object.keys(counts).map((s) => (
              <button
                key={s}
                className={`rp-chip rp-st-${s}${statuses.includes(s) ? ' is-on' : ''}`}
                aria-pressed={statuses.includes(s)}
                onClick={() => toggleStatus(s)}
              >
                <span className="rp-dot" />
                {capitalize(s)} <b>{counts[s]}</b>
              </button>
            ))}
          </div>
          {filtersActive ? (
            <button className="rp-link" onClick={clearFilters}>Reset filters</button>
          ) : null}
        </div>
      </section>

      {/* Summary */}
      <section className="rp-card rp-summary" aria-label="Summary">
        <div className="rp-total">
          <span className="rp-total-num">{filtered.length}</span>
          <span className="rp-total-label">records in {rangeLabel?.toLowerCase()}</span>
        </div>
        <Distribution counts={visibleCounts} total={filtered.length} />
      </section>

      {/* Table */}
      <section className="rp-card rp-table-card">
        <div className="rp-table-head">
          <h2>{report.title}</h2>
          <span className="rp-hint">{meta.replace(/\s{2}\|\s{2}/, ' · ')}</span>
        </div>

        {error && (
          <div className="rp-error" role="alert">
            <Icon d={ICONS.alert} />
            <span>{error}</span>
          </div>
        )}

        <div className="rp-scroll">
          <table>
            <thead>
              <tr>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="rp-skel">
                    {COLUMNS.map((c) => <td key={c.key}><span /></td>)}
                  </tr>
                ))}

              {noData && (
                <tr>
                  <td colSpan={COLUMNS.length} className="rp-empty">
                    No records match these filters. Widen the period or reset the filters.
                  </td>
                </tr>
              )}

              {!loading && pageRows.map((r) => (
                <tr key={r.ref}>
                  <td className="rp-mono">{r.ref}</td>
                  <td>{r.name}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td>{fmtDate(r.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <footer className="rp-pager">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div>
              <button className="rp-btn rp-btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="rp-btn rp-btn-ghost" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
