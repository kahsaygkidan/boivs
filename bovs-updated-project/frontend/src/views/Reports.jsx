import { useEffect, useMemo, useState } from 'react';
import { getQueue, searchBoRecords } from '../api/bovsApi.js';

/* ==========================================================================
   Constants
   ========================================================================== */

const RANGE_OPTIONS = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
];

const REPORTS = [
  {
    key: 'bo-summary',
    icon: 'grid',
    title: 'BO Registration Summary',
    description: 'Count of beneficial owner records registered, by status and period.',
    updated: 'Updated daily',
    fetch: () => searchBoRecords({ size: 50 }),
  },
  {
    key: 'verification-summary',
    icon: 'check',
    title: 'Verification Queue Summary',
    description: 'Turnaround time and outcomes for checker verification decisions.',
    updated: 'Updated hourly',
    fetch: () => getQueue({ size: 50 }),
  },
];

const TABLE_COLUMNS = [
  { key: 'ref',     label: 'Reference',    className: 'ref mono' },
  { key: 'name',    label: 'Name' },
  { key: 'status',  label: 'Status' },
  { key: 'updated', label: 'Last updated' },
];

/* ==========================================================================
   Data helpers
   ========================================================================== */

/**
 * Normalise a raw API payload (paginated or bare array) into table rows.
 */
function toRows(payload) {
  const content = payload?.content || payload || [];
  return content.map((r) => ({
    ref: r.boReference || r.id,
    name: r.fullName || '—',
    status: (r.status || 'pending').toLowerCase(),
    updated: formatDate(r.updatedAt || r.submittedAt),
  }));
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Trigger a client-side CSV download for the given rows.
 */
function downloadCsv(filename, rows) {
  if (!rows.length) return;

  const header = ['Reference', 'Name', 'Status', 'Last updated'];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.ref, r.name, r.status, r.updated].map(escape).join(',')
  );
  const csv = [header.join(','), ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/* ==========================================================================
   Icons
   ========================================================================== */

function ReportIcon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none' };

  if (name === 'check') {
    return (
      <svg {...common} aria-hidden="true">
        <path
          d="M9 1.5 15.5 4v4c0 4.4-2.9 6.6-6.5 7.1C5.4 14.6 2.5 12.4 2.5 8V4L9 1.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="M6 9l1.9 1.9L12 6.8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common} aria-hidden="true">
      <rect x="2.25"  y="2.25"  width="5.6" height="5.6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.15" y="2.25"  width="5.6" height="5.6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2.25"  y="10.15" width="5.6" height="5.6" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.15" y="10.15" width="5.6" height="5.6" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ==========================================================================
   Sub-components
   ========================================================================== */

function StatusPill({ status }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {capitalize(status)}
    </span>
  );
}

function ReportCard({ report, isActive, onSelect, onExport }) {
  return (
    <div
      className={`report-card${isActive ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={() => onSelect(report.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(report.key);
        }
      }}
    >
      <div className="report-card-icon">
        <ReportIcon name={report.icon} />
      </div>
      <div className="report-card-title">{report.title}</div>
      <div className="report-card-desc">{report.description}</div>
      <div className="report-card-foot">
        <span className="report-card-tag">{report.updated}</span>
        <button
          type="button"
          className="report-card-export"
          onClick={(e) => {
            e.stopPropagation();
            onExport(report);
          }}
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Reports
   ========================================================================== */

export default function Reports() {
  const [range, setRange] = useState('30d');
  const [selected, setSelected] = useState(REPORTS[0].key);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* --- Derived values --- */
  const rangeLabel = useMemo(
    () => RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '',
    [range]
  );

  const activeReport = useMemo(
    () => REPORTS.find((r) => r.key === selected),
    [selected]
  );

  /* ------------------------------------------------------------------------
     Fetch report data whenever the active report changes
     ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!activeReport) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    activeReport
      .fetch()
      .then((res) => {
        if (cancelled) return;
        setRows(toRows(res));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.friendlyMessage || 'Failed to load report data');
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeReport]);

  /* ------------------------------------------------------------------------
     Handlers
     ------------------------------------------------------------------------ */
  const handleExport = (report) => {
    // If exporting the active report, use the loaded rows.
    // If exporting a different report, switch to it first (data will load).
    if (report.key === selected) {
      downloadCsv(`${report.key}.csv`, rows);
    } else {
      setSelected(report.key);
    }
  };

  const handleExportActive = () => {
    if (activeReport) downloadCsv(`${activeReport.key}.csv`, rows);
  };

  const hasRows = rows.length > 0;

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  return (
    <div className="page-narrow">
      {/* ---------- Page header ---------- */}
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="desc">
            Generate and export compliance and activity reports.
          </div>
        </div>

        <div className="toolbar toolbar-flush">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            aria-label="Report date range"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-blue"
            onClick={handleExportActive}
            disabled={!hasRows}
          >
            Export all
          </button>
        </div>
      </div>

      {/* ---------- Report cards ---------- */}
      <div className="report-grid">
        {REPORTS.map((report) => (
          <ReportCard
            key={report.key}
            report={report}
            isActive={selected === report.key}
            onSelect={setSelected}
            onExport={handleExport}
          />
        ))}
      </div>

      {/* ---------- Preview ---------- */}
      {activeReport && (
        <div className="table-card report-preview">
          <div className="report-preview-head">
            <div>
              <h3>{activeReport.title}</h3>
              <div className="hint">{rangeLabel}</div>
            </div>

            <div className="report-preview-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => window.print()}
              >
                Print / Save as PDF
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleExportActive}
                disabled={!hasRows}
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Print-only header — hidden on screen, visible in print/PDF output */}
          <div className="print-only report-print-header">
            <div className="report-print-brand">
              Dashen Bank — Beneficial Owner Identification &amp; Verification System
            </div>
            <div className="report-print-title">{activeReport.title}</div>
            <div className="report-print-meta">
              {rangeLabel} &middot; Generated {new Date().toLocaleString()}
            </div>
          </div>

          {error && (
            <div className="banner-error">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          <table>
            <thead>
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="table-empty">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && !error && !hasRows && (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="table-empty">
                    No records found.
                  </td>
                </tr>
              )}

              {!loading && rows.map((row) => (
                <tr key={row.ref}>
                  <td className="ref mono">{row.ref}</td>
                  <td>{row.name}</td>
                  <td><StatusPill status={row.status} /></td>
                  <td>{row.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}