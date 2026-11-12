import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { searchBoRecords, removeBoRecord, getDashboardStats } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { I, fmtWhen, humanize, GlobalStyle } from '../components/ui.jsx';
import './Records.css';

const PAGE_SIZE_OPTIONS = [5, 15, 25, 50];
const DEFAULT_PAGE_SIZE = 5;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 40;

const STATUS_TABS = [
  { key: '', label: 'All', stat: 'total' },
  { key: 'PENDING', label: 'Pending review', stat: 'pending' },
  { key: 'VERIFIED', label: 'Verified', stat: 'verified' },
  { key: 'REJECTED', label: 'Rejected', stat: 'rejected' },
  { key: 'CEASED', label: 'Ceased', stat: 'ceased' },
];

function decisionOf(r) {
  if ((r.status === 'VERIFIED' || r.status === 'CEASED') && (r.approvedBy || r.approvedAt)) {
    return { label: 'Approved', by: r.approvedBy, at: fmtWhen(r.approvedAt), tone: 'success' };
  }
  if (r.status === 'REJECTED' && (r.rejectedBy || r.rejectedAt)) {
    return { label: 'Rejected', by: r.rejectedBy, at: fmtWhen(r.rejectedAt), tone: 'danger' };
  }
  return null;
}

/* ---------- Icons (inline SVG) ---------- */
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const InboxIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
  </svg>
);

/* ---------- Sub-components ---------- */
function Avatar({ name, size = 38 }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff',
        fontSize: size * 0.36, fontWeight: 700, letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </span>
  );
}

function PersonCell({ r }) {
  return (
    <div className="rec-person">
      <Avatar name={r.fullName} />
      <div className="rec-person__body">
        <div className="rec-person__name-row">
          <span className="rec-person__name">{r.fullName}</span>
          {r.pep && <span className="rec-pill rec-pill--warn">PEP</span>}
        </div>
        <div className="rec-person__ref">{r.boReference}</div>
      </div>
    </div>
  );
}

function DecisionCell({ record }) {
  const d = decisionOf(record);
  if (!d) {
    const hint = record.status === 'PENDING' ? 'Awaiting review'
      : record.status === 'DRAFT' ? 'Not submitted' : null;
    return <span className="rec-decision__hint">{hint || '—'}</span>;
  }
  return (
    <div className="rec-decision">
      <div className="rec-decision__label" style={{ color: d.tone === 'success' ? 'var(--rec-success)' : 'var(--rec-danger)' }}>
        {d.label}
        {d.by && <span className="rec-decision__by"> by {d.by}</span>}
      </div>
      {d.at && <div className="rec-decision__at">{d.at}</div>}
    </div>
  );
}

function SkeletonRows({ columns }) {
  return Array.from({ length: 6 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: columns }).map((__, j) => (
        <td key={j}>
          {j === 0 ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className="rec-skel" style={{ width: 38, height: 38, borderRadius: 12 }} />
              <div style={{ flex: 1 }}>
                <div className="rec-skel" style={{ height: 12, width: '60%' }} />
                <div className="rec-skel" style={{ height: 10, width: '40%', marginTop: 8 }} />
              </div>
            </div>
          ) : (
            <div className="rec-skel" style={{ height: 12, width: j === 3 ? 90 : '70%' }} />
          )}
        </td>
      ))}
    </tr>
  ));
}

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
    <nav className="rec-pagination" aria-label="Pagination">
      <button
        type="button" className="rec-page-btn"
        disabled={page === 0 || disabled}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >←</button>

      {pageWindow(page, totalPages).map((it, i) =>
        it === '…' ? (
          <span key={`gap-${i}`} className="rec-page-gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={it} type="button"
            className={`rec-page-btn${it === page ? ' rec-page-btn--active' : ''}`}
            aria-label={`Page ${it + 1}`}
            aria-current={it === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => it !== page && onChange(it)}
          >{it + 1}</button>
        )
      )}

      <button
        type="button" className="rec-page-btn"
        disabled={page + 1 >= totalPages || disabled}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >→</button>
    </nav>
  );
}

const RecordRow = memo(function RecordRow({ r, canRemove, canOpen, onOpen, onRemove }) {
  const removable = canRemove && (r.status === 'PENDING' || r.status === 'DRAFT');
  return (
    <tr
      className="rec-row"
      tabIndex={canOpen ? 0 : -1}
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}
    >
      <td><PersonCell r={r} /></td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--rec-text-soft)' }}>
          <span style={{ display: 'inline-flex', color: 'var(--rec-faint)', flexShrink: 0 }}>
            <BuildingIcon />
          </span>
          <span>{r.legalPersonName || '—'}</span>
        </div>
      </td>
      <td>
        {r.ownershipPercentage != null ? (
          <div className="rec-ownership">
            <span className="rec-ownership__pct">{r.ownershipPercentage}%</span>
            <div className="rec-bar">
              <div className="rec-bar__fill" style={{ width: `${Math.min(r.ownershipPercentage, 100)}%` }} />
            </div>
          </div>
        ) : <span style={{ color: 'var(--rec-faint)' }}>—</span>}
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--rec-text-soft)', fontSize: 13 }}>{humanize(r.idDocumentType) || '—'}</span>
          {r.idExpired && <span className="rec-pill rec-pill--danger">ID expired</span>}
        </div>
      </td>
      <td><StatusBadge status={r.status} /></td>
      <td><DecisionCell record={r} /></td>
      {canRemove && (
        <td style={{ textAlign: 'right' }}>
          {removable && (
            <button
              type="button"
              className="rec-btn rec-btn--sm rec-btn--danger-outline"
              onClick={(e) => onRemove(e, r)}
            >Remove</button>
          )}
        </td>
      )}
    </tr>
  );
});

/* ==========================================================================
   Page
   ========================================================================== */
export default function Records({ onRegister, canRegister, canRemove, onOpen }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [pepOnly, setPepOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const cacheRef = useRef(new Map());
  const scrollRef = useRef(null);
  const debouncedRef = useRef('');
  const searchRef = useRef(null);

  const columns = 6 + (canRemove ? 1 : 0);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => {
      const v = query.trim();
      if (v === debouncedRef.current) return;
      debouncedRef.current = v;
      setDebounced(v);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  /* keyboard shortcut: "/" focuses search */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const changeStatus = useCallback((s) => { setStatus(s); setPage(0); }, []);
  const changePageSize = useCallback((n) => { setPageSize(n); setPage(0); }, []);
  const goToPage = useCallback((p) => setPage(Math.max(0, p)), []);

  const loadStats = useCallback(() => {
    getDashboardStats().then(setStats).catch(() => setStats(null));
  }, []);
  useEffect(() => { loadStats(); }, [loadStats, reloadKey]);

  const fetchPage = useCallback((p) => {
    const key = JSON.stringify([debounced, status, pepOnly, p, pageSize, reloadKey]);
    const cache = cacheRef.current;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.promise;
    const promise = searchBoRecords({
      q: debounced || undefined,
      status: status || undefined,
      pep: pepOnly ? true : undefined,
      page: p,
      size: pageSize,
    }).catch((err) => { cache.delete(key); throw err; });
    cache.set(key, { promise, ts: Date.now() });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return promise;
  }, [debounced, status, pepOnly, pageSize, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage(page)
      .then((res) => {
        if (cancelled) return;
        if (res.totalPages > 0 && page >= res.totalPages) { setPage(res.totalPages - 1); return; }
        setData(res);
        setError(null);
        setLoading(false);
        if (page + 1 < res.totalPages) fetchPage(page + 1).catch(() => {});
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.friendlyMessage || 'Failed to load records');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchPage, page]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [page, pageSize]);

  const records = data?.content || [];
  const total = data?.totalElements ?? records.length;
  const totalPages = data?.totalPages ?? 1;
  const firstShown = total === 0 ? 0 : page * pageSize + 1;
  const lastShown = page * pageSize + records.length;
  const filtered = Boolean(debounced || status || pepOnly);

  const clearFilters = () => {
    setQuery(''); debouncedRef.current = '';
    setDebounced(''); setStatus(''); setPepOnly(false); setPage(0);
  };

  const handleRemove = useCallback(async (e, r) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${r.boReference} (${r.fullName}) from the list?`)) return;
    try {
      await removeBoRecord(r.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to remove the record');
    }
  }, []);

  const open = useCallback((id) => { if (onOpen) onOpen(id); }, [onOpen]);

  return (
    <div className="rec-root">
      <GlobalStyle />

      {/* Header */}
      <header className="rec-header">
        <div>
          <h1 className="rec-header__title">Beneficial owner lists</h1>
          <p className="rec-header__subtitle">Every beneficial owner record in one place.</p>
        </div>
        {canRegister && onRegister && (
          <div className="rec-header__actions">
            <button type="button" className="rec-btn rec-btn--primary" onClick={onRegister}>
              + Register owner
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="rec-error" role="alert">
          <span className="rec-error__msg">{error}</span>
          <button type="button" className="rec-btn rec-btn--sm rec-btn--secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      )}

      {/* Card */}
      <div className="rec-card">
        <div className="rec-toolbar">
          <div className="rec-toolbar__row">
            {/* Modern search bar */}
            <div
              className={`rec-search${searchFocused ? ' rec-search--focused' : ''}`}
              onClick={() => searchRef.current?.focus()}
            >
              <span className="rec-search__icon"><SearchIcon /></span>
              <input
                ref={searchRef}
                className="rec-search__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search by name, BO reference or phone number"
                aria-label="Search records"
              />
              {query ? (
                <button
                  type="button"
                  className="rec-search__clear"
                  aria-label="Clear search"
                  onClick={(e) => { e.stopPropagation(); setQuery(''); searchRef.current?.focus(); }}
                >
                  <CloseIcon />
                </button>
              ) : (
                <kbd className="rec-search__kbd" aria-hidden="true">/</kbd>
              )}
            </div>

            {filtered && (
              <button type="button" className="rec-btn rec-btn--sm rec-btn--ghost" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {/* Status tabs */}
          <div className="rec-tabs" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((t) => {
              const on = status === t.key;
              const count = t.stat && stats ? stats[t.stat] : null;
              return (
                <button
                  key={t.key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`rec-tab${on ? ' rec-tab--active' : ''}`}
                  onClick={() => changeStatus(t.key)}
                >
                  {t.label}
                  {count != null && <span className="rec-tab__count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div
          ref={scrollRef}
          className={`rec-table-wrap${loading && data ? ' rec-table-wrap--loading' : ''}`}
        >
          <table className="rec-table">
            <thead>
              <tr>
                <th>Beneficial owner</th>
                <th>Legal entity</th>
                <th>Ownership</th>
                <th>Identification</th>
                <th>Status</th>
                <th>Decision</th>
                {canRemove && <th className="th--right" style={{ textAlign: 'right' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && !data && <SkeletonRows columns={columns} />}

              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={columns} style={{ borderBottom: 'none', padding: 0 }}>
                    <div className="rec-empty">
                      <span className="rec-empty__icon"><InboxIcon /></span>
                      <div className="rec-empty__title">
                        {filtered ? 'No records match your filters' : 'No records yet'}
                      </div>
                      <div className="rec-empty__desc">
                        {filtered
                          ? 'Try a different name or reference, or clear the filters.'
                          : 'Beneficial owner records will appear here once they are registered.'}
                      </div>
                      {filtered && (
                        <button type="button" className="rec-btn rec-btn--sm rec-btn--secondary" onClick={clearFilters}>
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {records.map((r) => (
                <RecordRow
                  key={r.id}
                  r={r}
                  canRemove={canRemove}
                  canOpen={Boolean(onOpen)}
                  onOpen={open}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!error && total > 0 && (
          <footer className="rec-footer">
            <span>
              Showing <strong>{firstShown}–{lastShown}</strong> of <strong>{total}</strong> record{total === 1 ? '' : 's'}
            </span>
            <div className="rec-footer__controls">
              <label className="rec-footer__rows">
                Rows
                <select
                  className="rec-footer__select"
                  value={pageSize}
                  onChange={(e) => changePageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onChange={goToPage} disabled={loading} />
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}