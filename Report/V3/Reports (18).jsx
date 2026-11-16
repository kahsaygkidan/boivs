import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, X, Download, Printer, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, FileSearch, Inbox, RefreshCw, Building2,
} from 'lucide-react';
import { searchBoRecords, getBoRecord, listLegalPersons, getOwnershipTree } from '../api/bovsApi.js';
import { resolveBoRule, meetsPct } from '../utils/boRules.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { controlBasisLabel } from '../utils/records.js';
import { T, Avatar, Pill, Bar, fmtWhen, humanize } from '../components/ui.jsx';
import '../styles/ReportsPage.css';

/* ==========================================================================
   Constants
   ========================================================================== */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 40;
const EXPORT_CHUNK = 200;       // rows per request while exporting
const EXPORT_CAP = 5000;        // hard stop so an export can never run away
const COLUMN_STORAGE_KEY = 'rp.columns.v1';
const ENTITY_STORAGE_KEY = 'rp.entityColumns.v1';
const ENTITY_FIELDS_KEY = 'rp.entityFields.v1';

const STATUS_OPTIONS = [
  { key: '', label: 'All statuses' },
  { key: 'PENDING', label: 'Pending review' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'CEASED', label: 'Ceased' },
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.key, s.label]));
const EMPTY_FILTERS = { q: '', status: '', pep: false };

/* ui.jsx design tokens -> CSS variables, so ReportsPage.css follows the app theme */
const TOKEN_VARS = {
  '--rp-primary': T.primary, '--rp-primary-soft': T.primarySoft, '--rp-ring': T.primaryRing,
  '--rp-surface': T.surface, '--rp-alt': T.surfaceAlt, '--rp-border': T.border, '--rp-border-strong': T.borderStrong,
  '--rp-text': T.text, '--rp-soft': T.textSoft, '--rp-muted': T.textMuted, '--rp-faint': T.textFaint,
  '--rp-success': T.success, '--rp-danger': T.danger, '--rp-warn': T.warn, '--rp-font': T.font, '--rp-mono': T.mono,
};
const ROOT_STYLE = Object.fromEntries(Object.entries(TOKEN_VARS).filter(([, v]) => v));

/* ==========================================================================
   Field catalogue — every column the report can show.
   `text` is the plain value (used for CSV and as the fallback display);
   `cell` is the optional rich renderer. Missing values render as "—".
   ========================================================================== */
const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '');
const when = (v) => (v ? fmtWhen(v) : '');
const controlText = (r) => (r.controlBasis || []).map((c) => controlBasisLabel[c] || humanize(c)).join(', ');

function decisionOf(r) {
  if ((r.status === 'VERIFIED' || r.status === 'CEASED') && (r.approvedBy || r.approvedAt)) {
    return { label: 'Approved', by: r.approvedBy, at: when(r.approvedAt), tone: 'ok' };
  }
  if (r.status === 'REJECTED' && (r.rejectedBy || r.rejectedAt)) {
    return { label: 'Rejected', by: r.rejectedBy, at: when(r.rejectedAt), tone: 'bad' };
  }
  return null;
}

const COLUMNS = [
  { key: 'person', label: 'Beneficial owner', group: 'Identity', always: true, on: true, entityOn: true, pw: 1.7, text: (r) => r.fullName,
    print: (r) => (<><strong>{r.fullName}</strong>{r.pep ? ' (PEP)' : ''}{r.boReference && <div>{r.boReference}</div>}</>),
    cell: (r) => (
      <div className="rp-person">
        <Avatar name={r.fullName} size={36} />
        <div>
          <div className="rp-person__name">{r.fullName}{r.pep && <Pill tone="warn">PEP</Pill>}</div>
          <div className="rp-person__sub">{r.boReference || r.idNumber || ''}</div>
        </div>
      </div>
    ) },
  { key: 'reference', label: 'BO reference', group: 'Identity', text: (r) => r.boReference },
  { key: 'phone', label: 'Phone', group: 'Identity', text: (r) => r.phoneNumber || r.mobileNumber || r.phone || r.mobile },
  { key: 'email', label: 'Email', group: 'Identity', pw: 1.6, text: (r) => r.emailAddress || r.email },
  { key: 'idType', label: 'ID type', group: 'Identity', text: (r) => humanize(r.idDocumentType) },
  { key: 'idNumber', label: 'ID number', group: 'Identity', entityOn: true, pw: 1.2, text: (r) => r.idNumber, mono: true },
  { key: 'idExpiry', label: 'ID expiry', group: 'Identity', text: (r) => r.dateOfExpiry,
    print: (r) => `${dash(r.dateOfExpiry)}${r.idExpired ? ' (expired)' : ''}`,
    cell: (r) => (r.idExpired ? <Pill tone="danger">Expired {r.dateOfExpiry || ''}</Pill> : dash(r.dateOfExpiry)) },
  { key: 'pep', label: 'PEP', group: 'Identity', pw: 0.6, text: (r) => yesNo(Boolean(r.pep)) },
  { key: 'entity', label: 'Legal entity', group: 'Ownership', on: true, recordsOnly: true, pw: 1.5, text: (r) => r.legalPersonName },
  { key: 'regNo', label: 'Registration no.', group: 'Ownership', recordsOnly: true, pw: 1.2, text: (r) => r.legalPersonRegistrationNumber, mono: true },
  { key: 'ownership', label: 'Ownership', group: 'Ownership', on: true, entityOn: true, pw: 0.9, text: (r) => (r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : ''),
    cell: (r) => (r.ownershipPercentage != null
      ? <div className="rp-own"><b>{r.ownershipPercentage}%</b><Bar value={r.ownershipPercentage} /></div>
      : <span className="rp-muted">—</span>) },
  { key: 'ownershipType', label: 'Ownership type', group: 'Ownership', text: (r) => humanize(r.ownershipType) },
  { key: 'control', label: 'Control basis', group: 'Ownership', pw: 1.4, text: controlText },
  { key: 'directness', label: 'Direct / indirect', group: 'Ownership', entityOnly: true, entityOn: true, pw: 0.9, text: (r) => r.directness },
  { key: 'basis', label: 'Basis', group: 'Ownership', entityOnly: true, entityOn: true, pw: 1.6, text: (r) => r.basisLabel },
  { key: 'chain', label: 'Ownership chain', group: 'Ownership', pw: 2.2, text: (r) => r.ownershipChain },
  { key: 'boSince', label: 'BO since', group: 'Ownership', entityOn: true, text: (r) => r.dateBecameBo },
  { key: 'status', label: 'Status', group: 'Review', on: true, entityOn: true, text: (r) => (r.status ? humanize(r.status) : (r.isFallback ? '' : 'Not registered')),
    cell: (r) => (r.status ? <StatusBadge status={r.status} /> : (r.isFallback ? <span className="rp-muted">—</span> : <Pill>Not registered</Pill>)) },
  { key: 'isBo', label: 'Beneficial owner', group: 'Review', entityOnly: true, entityOn: true, pw: 0.9, text: (r) => (r.isFallback ? 'Fallback' : r.isBo ? 'Yes' : 'No'),
    cell: (r) => <span className={r.isBo ? 'rp-ok' : 'rp-muted'}>{r.isFallback ? 'Fallback' : r.isBo ? 'Yes' : 'No'}</span> },
  { key: 'decision', label: 'Decision', group: 'Review', on: true, pw: 1.6,
    text: (r) => { const d = decisionOf(r); return d ? `${d.label}${d.by ? ` by ${d.by}` : ''}${d.at ? ` · ${d.at}` : ''}` : ''; },
    cell: (r) => {
      const d = decisionOf(r);
      if (!d) return <span className="rp-muted">{r.status === 'PENDING' ? 'Awaiting review' : '—'}</span>;
      return (
        <div className="rp-decision">
          <span className={d.tone === 'ok' ? 'rp-ok' : 'rp-bad'}>{d.label}</span>{d.by && <em> by {d.by}</em>}
          {d.at && <small>{d.at}</small>}
        </div>
      );
    } },
  { key: 'rejectReason', label: 'Rejection reason', group: 'Review', pw: 1.8, text: (r) => r.rejectionReason || r.rejectReason || r.rejectionNote },
  { key: 'sanctions', label: 'Sanctions screened', group: 'Review', text: (r) => yesNo(r.sanctionsScreened) },
  { key: 'createdBy', label: 'Created by', group: 'Audit', text: (r) => r.createdBy },
  { key: 'createdAt', label: 'Created', group: 'Audit', text: (r) => when(r.createdAt) },
  { key: 'updatedAt', label: 'Last updated', group: 'Audit', text: (r) => when(r.updatedAt) },
];
/* "All records" shows record-level fields; "Single legal entity" shows owner-level fields
   (the entity itself is the report heading, so its name / registration no. are not repeated per row). */
const RECORD_COLUMNS = COLUMNS.filter((c) => !c.entityOnly);
const ENTITY_COLUMNS = COLUMNS.filter((c) => !c.recordsOnly);
const DEFAULT_COLUMNS = RECORD_COLUMNS.filter((c) => c.on).map((c) => c.key);
const ENTITY_DEFAULT_COLUMNS = ENTITY_COLUMNS.filter((c) => c.entityOn).map((c) => c.key);

function readColumnPrefs(storageKey, available, defaults, required) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved)) {
      const allowed = new Set(available.map((c) => c.key));
      const valid = saved.filter((k) => allowed.has(k));
      if (required && !valid.includes(required)) valid.unshift(required);
      return valid;
    }
  } catch { /* storage unavailable or corrupt — use defaults */ }
  return defaults;
}

/* selected fields, remembered per report type */
function useColumnPrefs(storageKey, available, defaults, required = 'person') {
  const [keys, setKeys] = useState(() => readColumnPrefs(storageKey, available, defaults, required));
  const set = useCallback((next) => {
    const withReq = !required || next.includes(required) ? next : [required, ...next];
    setKeys(withReq);
    try { window.localStorage.setItem(storageKey, JSON.stringify(withReq)); } catch { /* ignore */ }
  }, [storageKey, required]);
  return [keys, set];
}

/* CSV: quote everything, and neutralise spreadsheet formulas (=, +, -, @) */
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/* ==========================================================================
   Pieces
   ========================================================================== */
function pageWindow(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, total - 1, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((n) => set.add(n));
  if (page >= total - 3) [total - 2, total - 3, total - 4].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 0 && n < total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(n - nums[i - 1] === 2 ? n - 1 : '…');
    out.push(n);
  });
  return out;
}

function Pagination({ page, totalPages, onChange, disabled }) {
  return (
    <nav className="rp-pager" aria-label="Pagination">
      <button type="button" className="rp-btn rp-btn--sm" disabled={page === 0 || disabled} onClick={() => onChange(page - 1)}><ChevronLeft size={14} />Previous</button>
      {pageWindow(page, totalPages).map((it, i) => it === '…'
        ? <span key={`g${i}`} className="rp-gap" aria-hidden="true">…</span>
        : (
          <button key={it} type="button" className="rp-page" aria-label={`Page ${it + 1}`} aria-current={it === page ? 'page' : undefined}
            disabled={disabled} onClick={() => it !== page && onChange(it)}>{it + 1}</button>
        ))}
      <button type="button" className="rp-btn rp-btn--sm" disabled={page + 1 >= totalPages || disabled} onClick={() => onChange(page + 1)}>Next<ChevronRight size={14} /></button>
    </nav>
  );
}

/* Memoised row: only re-renders when its record or the visible columns change */
const ReportRow = memo(function ReportRow({ r, columns, onOpen }) {
  return (
    <tr
      className={onOpen ? 'rp-row' : 'rp-row--static'}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(r) : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(r); } : undefined}
    >
      {columns.map((c) => (
        <td key={c.key} className="rp-td">
          {c.cell ? c.cell(r) : <span className={c.mono ? 'rp-mono' : undefined}>{dash(c.text(r))}</span>}
        </td>
      ))}
    </tr>
  );
});

function ColumnPicker({ columns: available, defaults, selected, onChange, label = 'Fields' }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => [...new Set(available.map((c) => c.group))], [available]);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const toggle = (k) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : available.map((c) => c.key).filter((x) => x === k || selected.includes(x)));
  return (
    <div className="rp-pop" ref={ref}>
      <button type="button" className="rp-btn rp-btn--sm" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal size={14} />{label}
      </button>
      {open && (
        <div className="rp-pop__panel" role="dialog" aria-label={`Choose ${label}`}>
          <div className="rp-pop__head">
            <span>{label}</span>
            <span className="rp-pop__links">
              <button type="button" className="rp-link" onClick={() => onChange(available.map((c) => c.key))}>All</button>
              <button type="button" className="rp-link" onClick={() => onChange(defaults)}>Default</button>
            </span>
          </div>
          {groups.map((g) => (
            <div key={g}>
              <div className="rp-group">{g}</div>
              {available.filter((c) => c.group === g).map((c) => (
                <label key={c.key} className={`rp-check${c.always ? ' rp-check--locked' : ''}`}>
                  <input type="checkbox" checked={selected.includes(c.key)} disabled={c.always} onChange={() => toggle(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Print layout — plain, fixed-width table so every selected field fits the page.
   Column widths follow each field's weight (`pw`), the font steps down as more
   fields are chosen, and the page switches to landscape past five fields.
   ========================================================================== */
const printFontPt = (n) => (n <= 5 ? 10.5 : n <= 7 ? 9.5 : n <= 9 ? 8.5 : n <= 12 ? 7.5 : n <= 15 ? 6.8 : 6.2);

const PRINT_CSS = `
.rp-print-portal { display: none; }
@media print {
  html.rp-printing-records, body.rp-printing-records { height: auto !important; overflow: visible !important; background: #fff !important; }
  body.rp-printing-records > *:not(.rp-print-portal) { display: none !important; }
  body.rp-printing-records .rp-print-portal { display: block !important; }
  body.rp-printing-records .rp-print-portal, body.rp-printing-records .rp-print-portal * { visibility: visible !important; }
  .rp-pdoc { color: #0f172a; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rp-pdoc__brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px; }
  .rp-pdoc__bank { font-size: 14pt; font-weight: 800; }
  .rp-pdoc__sub, .rp-pdoc__date { font-size: 8.5pt; color: #475569; }
  .rp-pdoc__title { font-size: 16pt; margin: 0 0 4px; }
  .rp-pdoc__meta { font-size: 9pt; color: #334155; margin: 0 0 10px; }
  .rp-pdoc__foot { margin-top: 14px; padding-top: 6px; border-top: 1px solid #cbd5e1; font-size: 7.5pt; color: #64748b; }
  table.rp-ptable { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; font-size: var(--rp-pfs, 8pt) !important; line-height: 1.3; }
  table.rp-ptable th, table.rp-ptable td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
  table.rp-ptable th { background: #f1f5f9 !important; font-weight: 700; }
  table.rp-ptable thead { display: table-header-group; }
  table.rp-ptable tr { break-inside: avoid; page-break-inside: avoid; }
  table.rp-ptable td div { margin-top: 1px; color: #475569; }
  table.rp-ptable tr.rp-ptable__group td { background: #e2e8f0 !important; font-weight: 700; color: #0f172a; border-top: 2px solid #0f172a; break-after: avoid; page-break-after: avoid; }
}`;

function PrintStyle({ count }) {
  return <style>{`${PRINT_CSS}\n@page { size: A4 ${count > 5 ? 'landscape' : 'portrait'}; margin: 10mm; }`}</style>;
}

/* Rows of the same legal entity are kept together under one heading */
const NO_ENTITY = 'No legal entity';
function groupByLegalEntity(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const name = r.legalPersonName || NO_ENTITY;
    if (!map.has(name)) map.set(name, { key: name, name, regNo: r.legalPersonRegistrationNumber || '', items: [] });
    map.get(name).items.push(r);
  });
  return [...map.values()].sort((a, b) => (a.name === NO_ENTITY) - (b.name === NO_ENTITY) || a.name.localeCompare(b.name));
}
const GROUPED_HIDDEN = new Set(['entity', 'regNo']);   // already shown in the group heading

function PrintTable({ columns, rows, groups = null, className = '' }) {
  const weights = columns.map((c) => c.pw ?? 1);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return (
    <table className={`rp-ptable ${className}`.trim()} style={{ '--rp-pfs': `${printFontPt(columns.length)}pt` }}>
      <colgroup>{columns.map((c, i) => <col key={c.key} style={{ width: `${((weights[i] / sum) * 100).toFixed(2)}%` }} />)}</colgroup>
      <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
      <tbody>
        {(groups || [{ key: '', items: rows }]).map((g) => (
          <Fragment key={g.key}>
            {groups && (
              <tr className="rp-ptable__group">
                <td colSpan={columns.length}>{g.name}{g.regNo ? ` · ${g.regNo}` : ''} — {g.items.length} beneficial owner{g.items.length === 1 ? '' : 's'}</td>
              </tr>
            )}
            {g.items.map((r, i) => (
              <tr key={r.id ?? i}>
                {columns.map((c) => <td key={c.key}>{c.print ? c.print(r) : dash(c.text(r))}</td>)}
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

/* While the on-screen report is printable, everything else in <body> is hidden for print */
function usePrintClass(active) {
  useEffect(() => {
    if (!active) return undefined;
    document.body.classList.add('rp-printing-records');
    document.documentElement.classList.add('rp-printing-records');
    return () => {
      document.body.classList.remove('rp-printing-records');
      document.documentElement.classList.remove('rp-printing-records');
    };
  }, [active]);
}

const Item = ({ label, children, wide }) => (
  <div className={`rp-dl__item${wide ? ' rp-dl__item--wide' : ''}`}>
    <dt>{label}</dt><dd>{dash(children)}</dd>
  </div>
);

/* Side drawer: shows the row straight away, then enriches it with the full record */
function DetailDrawer({ row, onClose, onOpenFull }) {
  const [full, setFull] = useState(null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setFull(null); setFailed(false);
    getBoRecord(row.id).then((r) => { if (!cancelled) setFull(r); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [row.id]);

  useEffect(() => {
    closeRef.current?.focus();
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const r = { ...row, ...(full || {}) };
  const d = decisionOf(r);
  return (
    <div className="rp-overlay" onClick={onClose}>
      <aside className="rp-drawer" role="dialog" aria-modal="true" aria-label={`Details for ${r.fullName}`} onClick={(e) => e.stopPropagation()}>
        <div className="rp-drawer__head">
          <Avatar name={r.fullName} size={46} />
          <div className="rp-drawer__title">
            <h2>{r.fullName}</h2>
            <p>{r.boReference}</p>
            <div className="rp-drawer__badges">
              <StatusBadge status={r.status} />
              {r.pep && <Pill tone="warn">PEP</Pill>}
              {r.idExpired && <Pill tone="danger">ID expired</Pill>}
            </div>
          </div>
          <button ref={closeRef} type="button" className="rp-iconbtn" aria-label="Close details" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="rp-drawer__body">
          {failed && <div className="rp-banner rp-banner--spaced">Couldn’t load the full record — showing list data only.</div>}

          <section className="rp-section">
            <div className="rp-section__title">Ownership</div>
            <dl className="rp-dl">
              <Item label="Legal entity" wide>{r.legalPersonName}</Item>
              <Item label="Registration no.">{r.legalPersonRegistrationNumber}</Item>
              <Item label="Ownership">{r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : ''}</Item>
              <Item label="Ownership type">{humanize(r.ownershipType)}</Item>
              <Item label="BO since">{r.dateBecameBo}</Item>
              <Item label="Control basis" wide>{controlText(r)}</Item>
              <Item label="Ownership chain" wide>{r.ownershipChain}</Item>
            </dl>
          </section>

          <section className="rp-section">
            <div className="rp-section__title">Identity</div>
            <dl className="rp-dl">
              <Item label="Phone">{r.phoneNumber || r.mobileNumber || r.phone || r.mobile}</Item>
              <Item label="Email">{r.emailAddress || r.email}</Item>
              <Item label="ID type">{humanize(r.idDocumentType)}</Item>
              <Item label="ID number">{r.idNumber}</Item>
              <Item label="ID expiry">{r.dateOfExpiry}</Item>
              <Item label="Sanctions screened">{yesNo(r.sanctionsScreened)}</Item>
            </dl>
          </section>

          <section className="rp-section">
            <div className="rp-section__title">Review</div>
            <dl className="rp-dl">
              <Item label="Decision" wide>{d ? `${d.label}${d.by ? ` by ${d.by}` : ''}${d.at ? ` · ${d.at}` : ''}` : ''}</Item>
              {(r.rejectionReason || r.rejectReason || r.rejectionNote) && <Item label="Rejection reason" wide>{r.rejectionReason || r.rejectReason || r.rejectionNote}</Item>}
              <Item label="Created">{[r.createdBy, when(r.createdAt)].filter(Boolean).join(' · ')}</Item>
              <Item label="Last updated">{[r.updatedBy, when(r.updatedAt)].filter(Boolean).join(' · ')}</Item>
            </dl>
          </section>
        </div>

        {onOpenFull && (
          <div className="rp-drawer__foot">
            <button type="button" className="rp-btn" onClick={onClose}>Close</button>
            <button type="button" className="rp-btn rp-btn--primary" onClick={() => onOpenFull(r.id)}>Open full record</button>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ==========================================================================
   Single legal entity report — pick an entity, see its own UBOs, print it
   ========================================================================== */
const ENTITY_LABELS = {
  SHARE_COMPANY: 'Share Company', PRIVATE_LIMITED_COMPANY: 'Private Limited Company', ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_LIMITED_COMPANY: 'Public Limited Company', GENERAL_PARTNERSHIP: 'General Partnership', LIMITED_PARTNERSHIP: 'Limited Partnership',
  LIMITED_LIABILITY_PARTNERSHIP: 'Limited Liability Partnership', FINANCIAL_INSTITUTION: 'Financial Institution',
  FOREIGN_LEGAL_PERSON: 'Foreign Legal Person', PPP: 'Public Private Partnership', CIVIL_SOCIETY_ORGANIZATION: 'Civil Society Organisation',
  GOVERNMENT_OWNED_ENTERPRISE: 'Government-Owned Enterprise', COOPERATIVE_ASSOCIATION: 'Cooperative Association', PUBLIC_ADMINISTRATION: 'Public Administration',
};
const SECTOR_LABELS = {
  OTHER: 'Other', MINING: 'Mining', REAL_ESTATE: 'Real Estate', MOTOR_DEALERSHIP: 'Motor Dealership', IMPORT_EXPORT: 'Import / Export', FINANCIAL: 'Financial',
};
const UNREGISTERED_STATUSES = ['', 'DRAFT', 'UNREGISTERED', 'NOT_REGISTERED', 'NONE'];

const splitChain = (c) => String(c || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
const isDirectHolder = (h) => { const p = h.paths || []; return p.length === 0 || p.every((x) => splitChain(x.chain).length === 2); };
/* Draft and unregistered placeholders are never part of a report */
const holderStatus = (h) => {
  const st = String(h?.status ?? h?.boStatus ?? h?.recordStatus ?? h?.workflowStatus ?? h?.verificationStatus ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return UNREGISTERED_STATUSES.includes(st) ? '' : st;
};
const holderName = (h) => h?.fullName || h?.name || '—';
const holderPct = (h) => h?.effectivePercentage ?? h?.ownershipPercentage ?? null;
const holderPhone = (h) => h?.phoneNumber || h?.phone || h?.mobileNumber || h?.mobile || '';
const holderIdNumber = (h) => h?.idNumber || h?.identificationNumber || '';
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const ruleText = (rule) => (!rule ? 'Not defined' : rule.pct != null ? `≥ ${rule.pct}%` : rule.badge === 'OWNER + GM' ? 'Owner + General Manager' : 'Special rule');

/* why is this person a beneficial owner? */
function basisText(h, rule) {
  const out = [];
  if (h.qualifiesByOwnership || meetsPct(rule, holderPct(h))) out.push('Ownership');
  const ctl = (h.controlBasis || []).map((c) => controlBasisLabel[c] || humanize(c));
  if (h.qualifiesByControl || ctl.length) out.push(ctl.length ? `Control (${ctl.join(', ')})` : 'Control');
  if (h.jointOwnership) out.push('Joint ownership');
  if (out.length === 0) out.push(rule?.key === 'ONE_MEMBER_PLC' ? 'Owner / general manager' : 'Other criteria');
  return out.join(' · ');
}

/* Shapes an ownership-tree holder like a BO record, so the same field catalogue drives both reports */
function holderToRecord(h, entity, rule, i) {
  const paths = h.paths || [];
  return {
    ...h,
    id: h.key ?? h.id ?? `${holderName(h)}-${i}`,
    fullName: holderName(h),
    status: holderStatus(h),
    ownershipPercentage: holderPct(h),
    phoneNumber: holderPhone(h),
    idNumber: holderIdNumber(h),
    dateBecameBo: h.dateBecameBo ? fmtDate(h.dateBecameBo) : '',
    legalPersonName: entity.name,
    legalPersonRegistrationNumber: entity.registrationNumber,
    ownershipChain: h.ownershipChain || paths.map((p) => p.chain).filter(Boolean).join('; '),
    directness: isDirectHolder(h) ? 'Direct' : 'Indirect',
    isBo: isUboHolder(h, rule),
    basisLabel: isUboHolder(h, rule) ? basisText(h, rule) : 'Holder — below threshold / not a beneficial owner',
  };
}

function EntityPicker({ entities, loading, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const src = entities || [];
    const hits = n ? src.filter((e) => [e.name, e.registrationNumber, e.tin].some((v) => String(v || '').toLowerCase().includes(n))) : src;
    return hits.slice(0, 50);
  }, [entities, q]);

  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open]);
  useEffect(() => { setHi(0); }, [q]);

  const choose = (e) => { onChange(e.id); setOpen(false); setQ(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && list[hi]) { e.preventDefault(); choose(list[hi]); }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); }
  };

  return (
    <div className="rp-combo" ref={ref}>
      <label className="rp-search rp-search--combo">
        <span className="rp-search__icon"><Building2 size={17} /></span>
        <input
          type="text" role="combobox" aria-expanded={open} aria-controls="rp-entity-list" aria-autocomplete="list" autoComplete="off" spellCheck={false}
          value={open ? q : (value?.name || '')}
          placeholder={loading ? 'Loading legal entities…' : 'Search legal entity by name, registration no. or TIN…'}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey}
          aria-label="Legal entity"
        />
        <span className="rp-search__icon"><ChevronDown size={16} /></span>
      </label>
      {open && (
        <ul className="rp-combo__list" id="rp-entity-list" role="listbox">
          {loading && <li className="rp-combo__empty">Loading…</li>}
          {!loading && list.length === 0 && <li className="rp-combo__empty">No legal entity found</li>}
          {list.map((e, i) => (
            <li key={e.id} role="option" aria-selected={e.id === value?.id}
              className={`rp-combo__item${i === hi ? ' rp-combo__item--hi' : ''}${e.id === value?.id ? ' rp-combo__item--sel' : ''}`}
              onMouseEnter={() => setHi(i)} onMouseDown={(ev) => { ev.preventDefault(); choose(e); }}>
              <span>{e.name}</span><small>{e.registrationNumber || e.tin || ''}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Legal-entity detail fields (selectable, shown under each entity heading) */
const entityCountry = (e) => e?.country || e?.countryOfIncorporation || e?.countryOfRegistration || e?.registrationCountry || e?.countryName || '';
const ENTITY_FIELDS = [
  { key: 'name', label: 'Legal entity', group: 'Legal entity', always: true, on: true, text: (e) => e.name },
  { key: 'regNo', label: 'Registration no.', group: 'Legal entity', on: true, text: (e) => e.registrationNumber },
  { key: 'tin', label: 'TIN', group: 'Legal entity', on: true, text: (e) => e.tin },
  { key: 'type', label: 'Entity type', group: 'Legal entity', on: true, text: (e) => ENTITY_LABELS[e.entityType] || humanize(e.entityType) },
  { key: 'sector', label: 'Sector', group: 'Legal entity', on: true, text: (e) => SECTOR_LABELS[e.sector] || humanize(e.sector) },
  { key: 'country', label: 'Country', group: 'Legal entity', on: true, text: entityCountry },
  { key: 'incorporated', label: 'Date of incorporation', group: 'Legal entity', text: (e) => e.dateOfIncorporation || e.incorporationDate || e.dateOfRegistration },
  { key: 'threshold', label: 'BO threshold', group: 'Legal entity', on: true, text: (e, c) => ruleText(c.rule) },
  { key: 'owners', label: 'Beneficial owners', group: 'Legal entity', on: true, text: (e, c) => `${c.count} (${c.direct} direct, ${c.count - c.direct} indirect)` },
];
const ENTITY_FIELD_DEFAULTS = ENTITY_FIELDS.filter((f) => f.on).map((f) => f.key);
const MAX_ENTITIES = 40;       // entities loaded at once (one ownership tree each)
const FETCH_WORKERS = 4;       // parallel ownership-tree requests

/* a holder is reportable when flagged UBO, or when it clearly meets ownership / control criteria */
function isUboHolder(h, rule) {
  if (h.ubo ?? h.isUbo) return true;
  if (h.qualifiesByOwnership || h.qualifiesByControl || h.jointOwnership) return true;
  return Boolean(rule) && meetsPct(rule, holderPct(h));
}

function buildSection(e, entry, scope) {
  const rule = resolveBoRule(e.entityType, e.sector);
  const base = { e, rule, holders: [], ubos: [], rows: [], direct: 0, fallback: null, usingFallback: false, diag: { total: 0, notUbo: 0, unregistered: 0 } };
  if (!entry) return { ...base, loading: true };
  if (entry.error) return { ...base, error: entry.error };
  const holders = entry.tree?.holders || [];
  /* every holder in the ownership structure is reported — flagged or not, registered or not */
  const listed = holders.filter((h) => !scope || holderStatus(h) === scope);
  const ubos = listed.filter((h) => isUboHolder(h, rule) && holderStatus(h));
  const fallback = entry.tree?.seniorManagingOfficial || null;
  const usingFallback = Boolean(!scope && ubos.length === 0 && fallback);
  const rows = listed.map((h, i) => holderToRecord(h, e, rule, i));
  if (usingFallback) {
    const smo = holderToRecord({ ...fallback, key: 'smo', paths: [] }, e, rule, rows.length);
    rows.push({ ...smo, isFallback: true, isBo: false, directness: 'Direct', basisLabel: `Senior managing official (fallback)${fallback.position ? ` — ${fallback.position}` : ''}` });
  }
  return {
    ...base, holders: listed, ubos, rows, fallback, usingFallback, direct: ubos.filter(isDirectHolder).length,
    diag: {
      total: holders.length,
      notUbo: holders.filter((h) => !isUboHolder(h, rule)).length,
      unregistered: holders.filter((h) => !holderStatus(h)).length,
    },
  };
}

const uniqSorted = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

function EntityReport() {
  const [entities, setEntities] = useState(null);
  const [entError, setEntError] = useState(null);
  const [entityId, setEntityId] = useState('');
  const [onlyThis, setOnlyThis] = useState(false);          // false = every entity of the same type
  const [fType, setFType] = useState('');
  const [fSector, setFSector] = useState('');
  const [fCountry, setFCountry] = useState('');
  const [scope, setScope] = useState('');                   // '' = every recorded status
  const [retryKey, setRetryKey] = useState(0);
  const [tick, setTick] = useState(0);
  const treeCache = useRef(new Map());                      // id -> { tree } | { error }
  const [columnKeys, setColumns] = useColumnPrefs(ENTITY_STORAGE_KEY, ENTITY_COLUMNS, ENTITY_DEFAULT_COLUMNS);
  const [fieldKeys, setFieldKeys] = useColumnPrefs(ENTITY_FIELDS_KEY, ENTITY_FIELDS, ENTITY_FIELD_DEFAULTS, 'name');
  const columns = useMemo(() => ENTITY_COLUMNS.filter((c) => columnKeys.includes(c.key)), [columnKeys]);
  const fields = useMemo(() => ENTITY_FIELDS.filter((f) => fieldKeys.includes(f.key) && f.key !== 'name'), [fieldKeys]);

  /* the entity list loads once, only when this mode is opened */
  useEffect(() => {
    let cancelled = false;
    listLegalPersons({ size: 500, sort: 'name' })
      .then((res) => { if (!cancelled) setEntities(res.content || []); })
      .catch((err) => { if (!cancelled) setEntError(err.friendlyMessage || 'Failed to load legal entities'); });
    return () => { cancelled = true; };
  }, []);

  const entity = useMemo(() => (entities || []).find((e) => e.id === entityId) || null, [entities, entityId]);
  const options = useMemo(() => ({
    types: uniqSorted((entities || []).map((e) => e.entityType)),
    sectors: uniqSorted((entities || []).map((e) => e.sector)),
    countries: uniqSorted((entities || []).map(entityCountry)),
  }), [entities]);

  /* choosing an entity lists every registered entity of the same type (narrow further with the filters) */
  const pick = (id) => {
    setEntityId(id);
    const e = (entities || []).find((x) => x.id === id);
    if (e) { setFType(e.entityType || ''); setFSector(''); setFCountry(''); setOnlyThis(false); }
  };
  const clearAll = () => { setEntityId(''); setFType(''); setFSector(''); setFCountry(''); setOnlyThis(false); };

  const matches = useMemo(() => {
    if (!entities) return [];
    if (entity && onlyThis) return [entity];
    if (!entity && !fType && !fSector && !fCountry) return [];
    const list = entities.filter((e) => (!fType || e.entityType === fType) && (!fSector || e.sector === fSector) && (!fCountry || entityCountry(e) === fCountry));
    return entity ? [entity, ...list.filter((e) => e.id !== entity.id)] : list;
  }, [entities, entity, onlyThis, fType, fSector, fCountry]);
  const shown = useMemo(() => matches.slice(0, MAX_ENTITIES), [matches]);
  const shownKey = shown.map((e) => e.id).join('|');

  /* one ownership tree per entity, a few at a time; cached so switching filters is instant */
  useEffect(() => {
    const queue = shown.map((e) => e.id).filter((id) => !treeCache.current.has(id));
    if (!queue.length) return undefined;
    let cancelled = false;
    const worker = async () => {
      while (queue.length && !cancelled) {
        const id = queue.shift();
        try {
          // eslint-disable-next-line no-await-in-loop
          const t = await getOwnershipTree(id);
          treeCache.current.set(id, { tree: t });
        } catch (err) {
          treeCache.current.set(id, { error: err.friendlyMessage || 'Failed to load the ownership structure' });
        }
        if (!cancelled) setTick((n) => n + 1);
      }
    };
    Promise.all(Array.from({ length: FETCH_WORKERS }, worker));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, retryKey]);

  const sections = useMemo(
    () => shown.map((e) => buildSection(e, treeCache.current.get(e.id), scope)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, scope, tick],
  );
  const pending = sections.filter((x) => x.loading).length;
  const failed = sections.filter((x) => x.error);
  const totalOwners = sections.reduce((n, x) => n + x.ubos.length, 0);
  const totalHolders = sections.reduce((n, x) => n + x.holders.length, 0);
  const ready = shown.length > 0 && pending === 0;
  const generated = new Date().toLocaleString();
  const scopeLabel = scope ? STATUS_LABEL[scope] : 'All recorded statuses';

  const retry = () => { failed.forEach((x) => treeCache.current.delete(x.e.id)); setRetryKey((k) => k + 1); setTick((n) => n + 1); };
  const ctxOf = (x) => ({ rule: x.rule, count: x.ubos.length, direct: x.direct });
  const filterSummary = [fType && (ENTITY_LABELS[fType] || humanize(fType)), fSector && (SECTOR_LABELS[fSector] || humanize(fSector)), fCountry].filter(Boolean).join(' · ') || 'All';

  return (
    <>
      {/* ---------- on screen ---------- */}
      <div className="rp-card rp-filters rp-screen">
        <div className="rp-filters__row">
          <EntityPicker entities={entities} loading={!entities && !entError} value={entity} onChange={pick} />
          {(entityId || fType || fSector || fCountry) && <button type="button" className="rp-btn rp-btn--lg rp-btn--ghost" onClick={clearAll}>Clear</button>}
          <button type="button" className="rp-btn rp-btn--lg rp-btn--primary rp-push" disabled={!ready} onClick={() => window.print()}>
            <Printer size={15} />Print entity report
          </button>
        </div>
        <div className="rp-filters__row">
          <select className="rp-select" aria-label="Filter by entity type" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">All entity types</option>
            {options.types.map((t) => <option key={t} value={t}>{ENTITY_LABELS[t] || humanize(t)}</option>)}
          </select>
          <select className="rp-select" aria-label="Filter by sector" value={fSector} onChange={(e) => setFSector(e.target.value)}>
            <option value="">All sectors</option>
            {options.sectors.map((t) => <option key={t} value={t}>{SECTOR_LABELS[t] || humanize(t)}</option>)}
          </select>
          {options.countries.length > 0 && (
            <select className="rp-select" aria-label="Filter by country" value={fCountry} onChange={(e) => setFCountry(e.target.value)}>
              <option value="">All countries</option>
              {options.countries.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {entity && (
            <button type="button" className={`rp-chip${onlyThis ? ' rp-chip--on' : ''}`} aria-pressed={onlyThis} onClick={() => setOnlyThis((v) => !v)}>
              Selected entity only
            </button>
          )}
        </div>
        <div className="rp-filters__row rp-filters__row--between">
          <div className="rp-chips" role="radiogroup" aria-label="Status included in the report">
            {STATUS_OPTIONS.map((st) => (
              <button key={st.key || 'all'} type="button" role="radio" aria-checked={scope === st.key}
                className={`rp-chip${scope === st.key ? ' rp-chip--on' : ''}`} onClick={() => setScope(st.key)}>{st.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ColumnPicker label="Entity details" columns={ENTITY_FIELDS} defaults={ENTITY_FIELD_DEFAULTS} selected={fieldKeys} onChange={setFieldKeys} />
            <ColumnPicker label="Owner fields" columns={ENTITY_COLUMNS} defaults={ENTITY_DEFAULT_COLUMNS} selected={columnKeys} onChange={setColumns} />
          </div>
        </div>
      </div>

      {(entError || failed.length > 0) && (
        <div className="rp-banner rp-screen" role="alert">
          {entError || `${failed.length} legal entit${failed.length === 1 ? 'y' : 'ies'} could not be loaded.`}
          {failed.length > 0 && <button type="button" className="rp-btn rp-btn--sm" onClick={retry}><RefreshCw size={13} />Retry</button>}
        </div>
      )}
      {matches.length > MAX_ENTITIES && (
        <div className="rp-banner rp-screen">Showing the first {MAX_ENTITIES} of {matches.length} legal entities — narrow the filters to see the rest.</div>
      )}

      {shown.length === 0 && (
        <div className="rp-card rp-prompt rp-screen">
          <span className="rp-prompt__icon"><Building2 size={28} /></span>
          <div className="rp-prompt__title">{entities && matches.length === 0 && (entityId || fType || fSector || fCountry) ? 'No legal entities match' : 'Choose a legal entity'}</div>
          <div className="rp-prompt__text">Pick an entity to list every registered entity of the same type, or filter by entity type, sector or country. Each entity is shown with its own beneficial owners (or senior managing official fallback).</div>
        </div>
      )}

      {sections.map((x) => (
        <div key={x.e.id} className="rp-card rp-card--clip rp-screen">
          <div className="rp-entity-head">
            <span className="rp-entity-head__icon"><Building2 size={20} /></span>
            <div className="rp-entity-head__main">
              <h2>{x.e.name || 'Legal entity'}</h2>
              <p>{[x.e.registrationNumber, ENTITY_LABELS[x.e.entityType] || humanize(x.e.entityType), SECTOR_LABELS[x.e.sector] || humanize(x.e.sector)].filter(Boolean).join(' · ')}</p>
            </div>
            {x.e.id === entityId && <span className="rp-tag rp-tag--static">Selected</span>}
            <span className="rp-tag rp-tag--static" title={x.rule?.title}>Threshold {ruleText(x.rule)}</span>
          </div>

          {fields.length > 0 && (
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px 18px', margin: 0, padding: '12px 16px', borderBottom: '1px solid var(--rp-border)' }}>
              {fields.map((f) => (
                <div key={f.key}>
                  <dt style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--rp-muted)' }}>{f.label}</dt>
                  <dd style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{dash(f.text(x.e, ctxOf(x)))}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="rp-stats">
            <div className="rp-stat"><span>Holders listed</span><b>{x.loading ? '…' : x.holders.length}</b></div>
            <div className="rp-stat rp-stat--strong"><span>Total UBOs</span><b>{x.loading ? '…' : x.ubos.length}</b></div>
            <div className="rp-stat"><span>Direct</span><b>{x.loading ? '…' : x.direct}</b></div>
            <div className="rp-stat"><span>Indirect</span><b>{x.loading ? '…' : x.ubos.length - x.direct}</b></div>
          </div>

          {x.usingFallback && <div className="rp-banner" style={{ margin: 12 }}>No registered beneficial owner meets the threshold, so the senior managing official is listed as the fallback.</div>}
          {x.error && <div className="rp-banner" style={{ margin: 12 }} role="alert">{x.error}</div>}

          <div className="rp-scroll">
            <table className="rp-table">
              <thead><tr>{columns.map((c) => <th key={c.key} className="rp-th">{c.label}</th>)}</tr></thead>
              <tbody>
                {x.loading && Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c.key} className="rp-td"><div className="rp-skel" /></td>)}</tr>
                ))}
                {!x.loading && !x.error && x.rows.length === 0 && (
                  <tr><td colSpan={columns.length} className="rp-td rp-td--flush">
                    <div className="rp-empty">
                      <Inbox size={34} color="var(--rp-faint)" />
                      <div className="rp-empty__title">No beneficial owners to report</div>
                      <div className="rp-empty__text">
                        {scope ? 'None with this status. Choose another status.' : 'No holders are recorded in this entity’s ownership structure.'}
                        {x.diag.total > 0 && <><br />Ownership structure holds {x.diag.total} holder{x.diag.total === 1 ? '' : 's'}: {x.diag.notUbo} not beneficial owners{x.diag.unregistered ? `, ${x.diag.unregistered} still draft / unregistered` : ''}.</>}
                      </div>
                    </div>
                  </td></tr>
                )}
                {x.rows.map((r) => <ReportRow key={r.id} r={r} columns={columns} />)}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ---------- print layout (hidden on screen) ---------- */}
      {ready && (
        <article className="rp-doc" aria-hidden="true">
          <PrintStyle count={columns.length} />
          <header className="rp-doc__brand">
            <div><div className="rp-doc__bank">Dashen Bank</div><div className="rp-doc__sub">Compliance reporting</div></div>
            <div className="rp-doc__date">Generated {generated}</div>
          </header>
          <h1 className="rp-doc__title">Beneficial Ownership Report</h1>
          <dl className="rp-doc__meta">
            <div><dt>Entity type · sector · country</dt><dd>{filterSummary}</dd></div>
            <div><dt>Statuses included</dt><dd>{scopeLabel}</dd></div>
            <div><dt>Legal entities</dt><dd>{sections.length}</dd></div>
            <div><dt>Holders listed</dt><dd>{totalHolders}</dd></div>
            <div><dt>Beneficial owners</dt><dd>{totalOwners}</dd></div>
          </dl>

          {sections.map((x) => (
            <section key={x.e.id} style={{ marginTop: 16, breakInside: x.rows.length > 8 ? 'auto' : 'avoid' }}>
              <div className="rp-doc__entity">{x.e.name}</div>
              {fields.length > 0 && (
                <dl className="rp-doc__meta">
                  {fields.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{dash(f.text(x.e, ctxOf(x)))}</dd></div>)}
                </dl>
              )}
              {x.error ? (
                <p className="rp-doc__none">The ownership structure of this entity could not be loaded.</p>
              ) : x.rows.length === 0 ? (
                <p className="rp-doc__none">
                  No holders are recorded for this entity{scope ? ` with status “${STATUS_LABEL[scope]}”` : ''}.
                  {x.fallback && <> Senior managing official on record: <strong>{x.fallback.name || x.fallback.fullName}</strong>{x.fallback.position ? ` (${x.fallback.position})` : ''}.</>}
                </p>
              ) : (
                <>
                  {x.usingFallback && <p className="rp-doc__none">No beneficial owner meets the threshold; the senior managing official is reported as the fallback.</p>}
                  <PrintTable columns={columns} rows={x.rows} className="rp-doc__table" />
                  {x.holders.some((h) => (h.paths || []).length > 0) && (
                    <div className="rp-doc__chains">
                      <h3>Ownership structure</h3>
                      <ul>
                        {x.holders.flatMap((h) => (h.paths || []).map((pth, i) => <li key={`${h.key ?? holderName(h)}-${i}`}>{pth.chain}</li>))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>
          ))}

          <div className="rp-doc__sign">
            <div><span /> Prepared by</div>
            <div><span /> Reviewed by</div>
            <div><span /> Date</div>
          </div>
          <footer className="rp-doc__foot">Confidential — generated from the Beneficial Owner Identification and Verification System. Reflects data at the time of printing.</footer>
        </article>
      )}
    </>
  );
}

/* ==========================================================================
   Reports
   Nothing is fetched until the user applies a filter (or chooses "Show all").
   Only the visible page is requested; the next page is prefetched.
   ========================================================================== */
export default function Reports({ onOpen }) {
  const [mode, setMode] = useState('records');             // 'records' | 'entity'
  const [draft, setDraft] = useState(EMPTY_FILTERS);       // what the form shows
  const [applied, setApplied] = useState(null);            // null = nothing applied yet -> no request
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [columnKeys, setColumns] = useColumnPrefs(COLUMN_STORAGE_KEY, RECORD_COLUMNS, DEFAULT_COLUMNS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null);          // row shown in the drawer
  const [groupByEntity, setGroupByEntity] = useState(true);   // keep each legal entity's owners together
  const [exporting, setExporting] = useState(null);        // { done, total } while exporting
  const cacheRef = useRef(new Map());
  const scrollRef = useRef(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const columns = useMemo(() => RECORD_COLUMNS.filter((c) => columnKeys.includes(c.key)), [columnKeys]);
  const dirty = !applied || JSON.stringify(applied) !== JSON.stringify({ ...draft, q: draft.q.trim() });

  const apply = useCallback((filters) => {
    const f = { ...filters, q: filters.q.trim() };
    setDraft(f); setApplied(f); setPage(0); setError(null);
  }, []);

  const reset = () => { setDraft(EMPTY_FILTERS); setApplied(null); setData(null); setPage(0); setError(null); };

  /* removing a filter tag re-applies immediately */
  const removeFilter = (key) => apply({ ...applied, [key]: EMPTY_FILTERS[key] });

  /* --- fetch (cached + next-page prefetch) --- */
  const fetchPage = useCallback((p) => {
    const key = JSON.stringify([applied, p, pageSize, reloadKey]);
    const cache = cacheRef.current;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.promise;
    const promise = searchBoRecords({
      q: applied.q || undefined, status: applied.status || undefined, pep: applied.pep ? true : undefined, page: p, size: pageSize,
    }).catch((err) => { cache.delete(key); throw err; });
    cache.set(key, { promise, ts: Date.now() });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return promise;
  }, [applied, pageSize, reloadKey]);

  useEffect(() => {
    if (!applied) return undefined;               // first visit: no request until a filter is applied
    let cancelled = false;
    setLoading(true);
    fetchPage(page)
      .then((res) => {
        if (cancelled) return;
        if (res.totalPages > 0 && page >= res.totalPages) { setPage(res.totalPages - 1); return; }
        setData(res); setError(null); setLoading(false);
        if (page + 1 < res.totalPages) fetchPage(page + 1).catch(() => {});
      })
      .catch((err) => { if (!cancelled) { setError(err.friendlyMessage || 'Failed to load the report'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [applied, page, fetchPage]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [page, pageSize]);

  const rows = data?.content || [];
  const viewColumns = useMemo(() => (groupByEntity ? columns.filter((c) => !GROUPED_HIDDEN.has(c.key)) : columns), [columns, groupByEntity]);
  const groups = useMemo(() => (groupByEntity ? groupByLegalEntity(rows) : null), [rows, groupByEntity]);
  const total = data?.totalElements ?? rows.length;
  const totalPages = data?.totalPages ?? 1;
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = page * pageSize + rows.length;
  const hasResults = Boolean(applied) && !error && total > 0;

  /* --- export the whole filtered set (not just the page) with the chosen fields --- */
  const exportCsv = async () => {
    if (!applied || exporting) return;
    const all = [];
    let p = 0; let pages = 1;
    try {
      setExporting({ done: 0, total });
      while (p < pages && all.length < EXPORT_CAP && aliveRef.current) {
        // eslint-disable-next-line no-await-in-loop
        const res = await searchBoRecords({ q: applied.q || undefined, status: applied.status || undefined, pep: applied.pep ? true : undefined, page: p, size: EXPORT_CHUNK });
        all.push(...res.content);
        pages = res.totalPages; p += 1;
        setExporting({ done: Math.min(all.length, res.totalElements), total: res.totalElements });
      }
      const lines = [columns.map((c) => csvCell(c.label)).join(',')];
      all.forEach((r) => lines.push(columns.map((c) => csvCell(c.text(r))).join(',')));
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `beneficial-owner-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.friendlyMessage || 'Export failed');
    } finally {
      if (aliveRef.current) setExporting(null);
    }
  };

  const tags = applied ? [
    applied.q && { key: 'q', label: `“${applied.q}”` },
    applied.status && { key: 'status', label: STATUS_LABEL[applied.status] },
    applied.pep && { key: 'pep', label: 'PEP only' },
  ].filter(Boolean) : [];

  const closeDrawer = useCallback(() => setSelected(null), []);
  usePrintClass(mode === 'records' && hasResults);
  const generated = new Date().toLocaleString();

  return (
    <div className={`rp-root${mode === 'entity' ? ' rp-root--entity' : ''}`} style={ROOT_STYLE}>
      {/* ---------- Header ---------- */}
      <header className="rp-head">
        <div>
          <div className="rp-eyebrow">Reports</div>
          <h1 className="rp-title">Beneficial owner report</h1>
          <div className="rp-subtitle">
            {mode === 'records' ? 'Choose filters to build the report, then pick the fields you need.' : 'Report the beneficial owners of one legal entity and print it.'}
          </div>
        </div>
        <div className="rp-head__actions">
          {mode === 'records' && (
            <>
              <button type="button" className="rp-btn" disabled={!hasResults} onClick={() => window.print()}><Printer size={15} />Print</button>
              <button type="button" className="rp-btn rp-btn--primary" disabled={!hasResults || Boolean(exporting)} onClick={exportCsv}>
                <Download size={15} />{exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="rp-modes" role="tablist" aria-label="Report type">
        <button type="button" role="tab" aria-selected={mode === 'records'} className={`rp-mode${mode === 'records' ? ' rp-mode--on' : ''}`} onClick={() => setMode('records')}>All records</button>
        <button type="button" role="tab" aria-selected={mode === 'entity'} className={`rp-mode${mode === 'entity' ? ' rp-mode--on' : ''}`} onClick={() => setMode('entity')}>Single legal entity</button>
      </div>

      {mode === 'entity' && <EntityReport />}

      {mode === 'records' && (
      <>
      {/* ---------- Filters ---------- */}
      <form className="rp-card rp-filters" onSubmit={(e) => { e.preventDefault(); apply(draft); }}>
        <div className="rp-filters__row">
          <label className="rp-search">
            <span className="rp-search__icon"><Search size={17} /></span>
            <input
              type="text" value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder="Search name, BO reference or phone…" aria-label="Search records" autoComplete="off" spellCheck={false} enterKeyHint="search"
            />
            {draft.q && <button type="button" className="rp-iconbtn" aria-label="Clear search" onClick={() => setDraft((d) => ({ ...d, q: '' }))}><X size={14} /></button>}
          </label>
          <button type="submit" className={`rp-btn rp-btn--lg rp-btn--primary${applied && dirty ? ' rp-btn--dirty' : ''}`}>
            <Search size={15} />Apply filters
          </button>
          {(applied || draft.q || draft.status || draft.pep) && <button type="button" className="rp-btn rp-btn--lg rp-btn--ghost" onClick={reset}>Reset</button>}
        </div>

        <div className="rp-filters__row rp-filters__row--between">
          <div className="rp-chips" role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map((s) => (
              <button key={s.key || 'all'} type="button" role="radio" aria-checked={draft.status === s.key}
                className={`rp-chip${draft.status === s.key ? ' rp-chip--on' : ''}`} onClick={() => setDraft((d) => ({ ...d, status: s.key }))}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className={`rp-chip${draft.pep ? ' rp-chip--on' : ''}`} aria-pressed={draft.pep} onClick={() => setDraft((d) => ({ ...d, pep: !d.pep }))}>
            <span className="rp-chip__dot" aria-hidden="true" />PEP only
          </button>
        </div>
      </form>

      {error && (
        <div className="rp-banner" role="alert">
          {error}
          {applied && <button type="button" className="rp-btn rp-btn--sm" onClick={() => setReloadKey((k) => k + 1)}><RefreshCw size={13} />Retry</button>}
        </div>
      )}

      {/* ---------- First visit: nothing requested yet ---------- */}
      {!applied && (
        <div className="rp-card rp-prompt">
          <span className="rp-prompt__icon"><FileSearch size={28} /></span>
          <div className="rp-prompt__title">Apply a filter to see the report</div>
          <div className="rp-prompt__text">Search by name, reference or phone, or narrow by status. The list loads only after you apply, so the page stays fast.</div>
          <button type="button" className="rp-btn" onClick={() => apply(EMPTY_FILTERS)}>Show all records</button>
        </div>
      )}

      {/* ---------- Results ---------- */}
      {applied && (
        <div className="rp-card rp-card--clip">
          <div className="rp-resultbar">
            <div className="rp-resultbar__left">
              <span className="rp-count" aria-live="polite">
                {loading && !data ? 'Loading…' : <><strong>{total}</strong> record{total === 1 ? '' : 's'}</>}
              </span>
              {tags.map((t) => (
                <span key={t.key} className="rp-tag"><span>{t.label}</span>
                  <button type="button" className="rp-iconbtn" aria-label={`Remove filter ${t.label}`} onClick={() => removeFilter(t.key)}><X size={12} /></button>
                </span>
              ))}
              {exporting && <span className="rp-progress"><span className="rp-spinner" />Exporting {exporting.done} of {exporting.total}…</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className={`rp-chip${groupByEntity ? ' rp-chip--on' : ''}`} aria-pressed={groupByEntity} onClick={() => setGroupByEntity((v) => !v)}>
                <Building2 size={13} />Group by legal entity
              </button>
              <ColumnPicker columns={RECORD_COLUMNS} defaults={DEFAULT_COLUMNS} selected={columnKeys} onChange={setColumns} />
            </div>
          </div>

          <div ref={scrollRef} className={`rp-scroll${loading && data ? ' rp-scroll--busy' : ''}`}>
            <table className="rp-table">
              <thead><tr>{viewColumns.map((c) => <th key={c.key} className="rp-th">{c.label}</th>)}</tr></thead>
              <tbody>
                {loading && !data && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{viewColumns.map((c) => <td key={c.key} className="rp-td"><div className="rp-skel" style={{ width: c.key === 'person' ? '70%' : '55%' }} /></td>)}</tr>
                ))}
                {!loading && !error && rows.length === 0 && (
                  <tr><td colSpan={viewColumns.length} className="rp-td rp-td--flush">
                    <div className="rp-empty">
                      <Inbox size={34} color="var(--rp-faint)" />
                      <div className="rp-empty__title">No records match these filters</div>
                      <div className="rp-empty__text">Try a different name or reference, or remove a filter.</div>
                    </div>
                  </td></tr>
                )}
                {(groups || [{ key: '', items: rows }]).map((g) => (
                  <Fragment key={g.key}>
                    {groups && (
                      <tr className="rp-group-row">
                        <td colSpan={viewColumns.length} className="rp-td" style={{ background: 'var(--rp-alt)', fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={15} />{g.name}
                            {g.regNo && <span style={{ fontWeight: 400, color: 'var(--rp-muted)' }}>· {g.regNo}</span>}
                            <span style={{ fontWeight: 400, color: 'var(--rp-muted)' }}>— {g.items.length} beneficial owner{g.items.length === 1 ? '' : 's'}</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {g.items.map((r) => <ReportRow key={r.id} r={r} columns={viewColumns} onOpen={setSelected} />)}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {hasResults && (
            <div className="rp-footer">
              <span>Showing <strong>{first}–{last}</strong> of <strong>{total}</strong></span>
              <div className="rp-footer__right">
                <label className="rp-rows">Rows
                  <select className="rp-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} aria-label="Rows per page">
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading} />}
              </div>
            </div>
          )}
        </div>
      )}

      </>
      )}

      {/* ---------- print layout: only the selected fields, fitted to the page ---------- */}
      {mode === 'records' && hasResults && createPortal(
        <div className="rp-print-portal">
          <PrintStyle count={viewColumns.length} />
          <article className="rp-pdoc" aria-hidden="true">
            <header className="rp-pdoc__brand">
              <div><div className="rp-pdoc__bank">Dashen Bank</div><div className="rp-pdoc__sub">Compliance reporting</div></div>
              <div className="rp-pdoc__date">Generated {generated}</div>
            </header>
            <h1 className="rp-pdoc__title">Beneficial Owner Report</h1>
            <div className="rp-pdoc__meta">
              Filters: {tags.length ? tags.map((t) => t.label).join(' · ') : 'none'} · Records {first}–{last} of {total}
            </div>
            <PrintTable columns={viewColumns} rows={rows} groups={groups} />
            <footer className="rp-pdoc__foot">Confidential — generated from the Beneficial Owner Identification and Verification System. Reflects data at the time of printing.</footer>
          </article>
        </div>,
        document.body,
      )}

      {selected && <DetailDrawer row={selected} onClose={closeDrawer} onOpenFull={onOpen ? (id) => { closeDrawer(); onOpen(id); } : null} />}
    </div>
  );
}
