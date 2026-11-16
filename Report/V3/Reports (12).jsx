import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, X, Download, Printer, SlidersHorizontal, ChevronLeft, ChevronRight, FileSearch, Inbox, RefreshCw,
} from 'lucide-react';
import { searchBoRecords, getBoRecord } from '../api/bovsApi.js';
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
  { key: 'person', label: 'Beneficial owner', group: 'Identity', always: true, on: true, text: (r) => r.fullName,
    cell: (r) => (
      <div className="rp-person">
        <Avatar name={r.fullName} size={36} />
        <div>
          <div className="rp-person__name">{r.fullName}{r.pep && <Pill tone="warn">PEP</Pill>}</div>
          <div className="rp-person__sub">{r.boReference}</div>
        </div>
      </div>
    ) },
  { key: 'reference', label: 'BO reference', group: 'Identity', text: (r) => r.boReference },
  { key: 'phone', label: 'Phone', group: 'Identity', text: (r) => r.phoneNumber || r.mobileNumber || r.phone || r.mobile },
  { key: 'email', label: 'Email', group: 'Identity', text: (r) => r.emailAddress || r.email },
  { key: 'idType', label: 'ID type', group: 'Identity', text: (r) => humanize(r.idDocumentType) },
  { key: 'idNumber', label: 'ID number', group: 'Identity', text: (r) => r.idNumber, mono: true },
  { key: 'idExpiry', label: 'ID expiry', group: 'Identity', text: (r) => r.dateOfExpiry,
    cell: (r) => (r.idExpired ? <Pill tone="danger">Expired {r.dateOfExpiry || ''}</Pill> : dash(r.dateOfExpiry)) },
  { key: 'pep', label: 'PEP', group: 'Identity', text: (r) => yesNo(Boolean(r.pep)) },
  { key: 'entity', label: 'Legal entity', group: 'Ownership', on: true, text: (r) => r.legalPersonName },
  { key: 'regNo', label: 'Registration no.', group: 'Ownership', text: (r) => r.legalPersonRegistrationNumber, mono: true },
  { key: 'ownership', label: 'Ownership', group: 'Ownership', on: true, text: (r) => (r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : ''),
    cell: (r) => (r.ownershipPercentage != null
      ? <div className="rp-own"><b>{r.ownershipPercentage}%</b><Bar value={r.ownershipPercentage} /></div>
      : <span className="rp-muted">—</span>) },
  { key: 'ownershipType', label: 'Ownership type', group: 'Ownership', text: (r) => humanize(r.ownershipType) },
  { key: 'control', label: 'Control basis', group: 'Ownership', text: controlText },
  { key: 'chain', label: 'Ownership chain', group: 'Ownership', text: (r) => r.ownershipChain },
  { key: 'boSince', label: 'BO since', group: 'Ownership', text: (r) => r.dateBecameBo },
  { key: 'status', label: 'Status', group: 'Review', on: true, text: (r) => humanize(r.status), cell: (r) => <StatusBadge status={r.status} /> },
  { key: 'decision', label: 'Decision', group: 'Review', on: true,
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
  { key: 'rejectReason', label: 'Rejection reason', group: 'Review', text: (r) => r.rejectionReason || r.rejectReason || r.rejectionNote },
  { key: 'sanctions', label: 'Sanctions screened', group: 'Review', text: (r) => yesNo(r.sanctionsScreened) },
  { key: 'createdBy', label: 'Created by', group: 'Audit', text: (r) => r.createdBy },
  { key: 'createdAt', label: 'Created', group: 'Audit', text: (r) => when(r.createdAt) },
  { key: 'updatedAt', label: 'Last updated', group: 'Audit', text: (r) => when(r.updatedAt) },
];
const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.on).map((c) => c.key);
const GROUPS = [...new Set(COLUMNS.map((c) => c.group))];

function loadColumnPrefs() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(COLUMN_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) {
      const valid = saved.filter((k) => COLUMN_BY_KEY[k]);
      if (!valid.includes('person')) valid.unshift('person');
      return valid;
    }
  } catch { /* storage unavailable or corrupt — use defaults */ }
  return DEFAULT_COLUMNS;
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
    <tr className="rp-row" tabIndex={0} onClick={() => onOpen(r)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r); }}>
      {columns.map((c) => (
        <td key={c.key} className="rp-td">
          {c.cell ? c.cell(r) : <span className={c.mono ? 'rp-mono' : undefined}>{dash(c.text(r))}</span>}
        </td>
      ))}
    </tr>
  );
});

function ColumnPicker({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const toggle = (k) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : COLUMNS.map((c) => c.key).filter((x) => x === k || selected.includes(x)));
  return (
    <div className="rp-pop" ref={ref}>
      <button type="button" className="rp-btn rp-btn--sm" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal size={14} />Fields
      </button>
      {open && (
        <div className="rp-pop__panel" role="dialog" aria-label="Choose report fields">
          <div className="rp-pop__head">
            <span>Report fields</span>
            <span className="rp-pop__links">
              <button type="button" className="rp-link" onClick={() => onChange(COLUMNS.map((c) => c.key))}>All</button>
              <button type="button" className="rp-link" onClick={() => onChange(DEFAULT_COLUMNS)}>Default</button>
            </span>
          </div>
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="rp-group">{g}</div>
              {COLUMNS.filter((c) => c.group === g).map((c) => (
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
   Reports
   Nothing is fetched until the user applies a filter (or chooses "Show all").
   Only the visible page is requested; the next page is prefetched.
   ========================================================================== */
export default function Reports({ onOpen }) {
  const [draft, setDraft] = useState(EMPTY_FILTERS);       // what the form shows
  const [applied, setApplied] = useState(null);            // null = nothing applied yet -> no request
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [columnKeys, setColumnKeys] = useState(loadColumnPrefs);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null);          // row shown in the drawer
  const [exporting, setExporting] = useState(null);        // { done, total } while exporting
  const cacheRef = useRef(new Map());
  const scrollRef = useRef(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const columns = useMemo(() => COLUMNS.filter((c) => columnKeys.includes(c.key)), [columnKeys]);
  const dirty = !applied || JSON.stringify(applied) !== JSON.stringify({ ...draft, q: draft.q.trim() });

  const setColumns = useCallback((keys) => {
    const next = keys.includes('person') ? keys : ['person', ...keys];
    setColumnKeys(next);
    try { window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

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

  return (
    <div className="rp-root" style={ROOT_STYLE}>
      {/* ---------- Header ---------- */}
      <header className="rp-head">
        <div>
          <div className="rp-eyebrow">Reports</div>
          <h1 className="rp-title">Beneficial owner report</h1>
          <div className="rp-subtitle">Choose filters to build the report, then pick the fields you need.</div>
        </div>
        <div className="rp-head__actions">
          <button type="button" className="rp-btn" disabled={!hasResults} onClick={() => window.print()}><Printer size={15} />Print</button>
          <button type="button" className="rp-btn rp-btn--primary" disabled={!hasResults || Boolean(exporting)} onClick={exportCsv}>
            <Download size={15} />{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

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
            <ColumnPicker selected={columnKeys} onChange={setColumns} />
          </div>

          <div ref={scrollRef} className={`rp-scroll${loading && data ? ' rp-scroll--busy' : ''}`}>
            <table className="rp-table">
              <thead><tr>{columns.map((c) => <th key={c.key} className="rp-th">{c.label}</th>)}</tr></thead>
              <tbody>
                {loading && !data && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c.key} className="rp-td"><div className="rp-skel" style={{ width: c.key === 'person' ? '70%' : '55%' }} /></td>)}</tr>
                ))}
                {!loading && !error && rows.length === 0 && (
                  <tr><td colSpan={columns.length} className="rp-td rp-td--flush">
                    <div className="rp-empty">
                      <Inbox size={34} color="var(--rp-faint)" />
                      <div className="rp-empty__title">No records match these filters</div>
                      <div className="rp-empty__text">Try a different name or reference, or remove a filter.</div>
                    </div>
                  </td></tr>
                )}
                {rows.map((r) => <ReportRow key={r.id} r={r} columns={columns} onOpen={setSelected} />)}
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

      {selected && <DetailDrawer row={selected} onClose={closeDrawer} onOpenFull={onOpen ? (id) => { closeDrawer(); onOpen(id); } : null} />}
    </div>
  );
}
