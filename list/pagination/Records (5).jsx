import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { searchBoRecords, removeBoRecord, getDashboardStats } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import {
  T, Btn, Banner, Avatar, Pill, Bar, Skeleton, GlobalStyle, I, fmtWhen, humanize,
} from '../components/ui.jsx';

const PAGE_SIZE_OPTIONS = [5, 15, 25, 50];
const DEFAULT_PAGE_SIZE = 5;
const CACHE_TTL_MS = 30_000;   // how long a fetched page is reused (back/forward, prefetch)
const CACHE_MAX = 40;          // cap on cached pages

/* Status filter tabs. `stat` is the key in /dashboard/stats (draft has no count). */
const STATUS_TABS = [
  { key: '', label: 'All', stat: 'total' },
  { key: 'PENDING', label: 'Pending review', stat: 'pending' },
  { key: 'VERIFIED', label: 'Verified', stat: 'verified' },
  { key: 'REJECTED', label: 'Rejected', stat: 'rejected' },

  { key: 'CEASED', label: 'Ceased', stat: 'ceased' },
];

/**
 * Who made the checker decision on a record, and when.
 *  VERIFIED / CEASED -> approved by / at (the approver is kept after a cease)
 *  REJECTED          -> rejected by / at
 */
function decisionOf(r) {
  if ((r.status === 'VERIFIED' || r.status === 'CEASED') && (r.approvedBy || r.approvedAt)) {
    return { label: 'Approved', by: r.approvedBy, at: fmtWhen(r.approvedAt), color: T.success };
  }
  if (r.status === 'REJECTED' && (r.rejectedBy || r.rejectedAt)) {
    return { label: 'Rejected', by: r.rejectedBy, at: fmtWhen(r.rejectedAt), color: T.danger };
  }
  return null;
}

/* ==========================================================================
   Pieces
   ========================================================================== */
function StatCard({ label, value, tone, active, onClick, loading }) {
  const color = { neutral: T.text, warn: T.warn, success: T.success, danger: T.danger }[tone] || T.text;
  return (
    <button
      type="button"
      className="ui-stat"
      onClick={onClick}
      aria-pressed={active}
      style={{
        textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', padding: '14px 16px',
        background: T.surface, borderRadius: T.radius, boxShadow: T.shadow,
        border: `1px solid ${active ? T.primary : T.border}`,
        outline: active ? `3px solid ${T.primaryRing}` : 'none', outlineOffset: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>{label}</div>
      {loading
        ? <Skeleton width={48} height={26} />
        : <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value ?? '—'}</div>}
    </button>
  );
}

function PersonCell({ r }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <Avatar name={r.fullName} size={38} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 650, color: T.text, fontSize: 13.5 }}>{r.fullName}</span>
          {r.pep && <Pill tone="warn">PEP</Pill>}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{r.boReference}</div>
      </div>
    </div>
  );
}

function DecisionCell({ record }) {
  const d = decisionOf(record);
  if (!d) {
    const hint = record.status === 'PENDING' ? 'Awaiting review' : record.status === 'DRAFT' ? 'Not submitted' : null;
    return <span style={{ color: T.textFaint, fontSize: 12.5 }}>{hint || '—'}</span>;
  }
  return (
    <div style={{ lineHeight: 1.4 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>
        <span style={{ color: d.color }}>{d.label}</span>
        {d.by && <span style={{ color: T.textMuted, fontWeight: 500 }}> by {d.by}</span>}
      </div>
      {d.at && <div style={{ fontSize: 11.5, color: T.textMuted }}>{d.at}</div>}
    </div>
  );
}

function SkeletonRows({ columns }) {
  return Array.from({ length: 6 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: columns }).map((__, j) => (
        <td key={j} style={tdBase}>
          {j === 0
            ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Skeleton width={38} height={38} style={{ borderRadius: 12 }} /><div style={{ flex: 1 }}><Skeleton width="60%" /><Skeleton width="40%" height={10} style={{ marginTop: 8 }} /></div></div>
            : <Skeleton width={j === 3 ? 90 : '70%'} />}
        </td>
      ))}
    </tr>
  ));
}

const tdBase = { padding: '14px 16px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle', fontSize: 13.5, color: T.text, background: T.surface };
const thBase = {
  padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase',
  color: T.textMuted, background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0,
};

/* Page numbers to show: first, last, current ±1, with "…" for gaps. */
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
  const items = pageWindow(page, totalPages);
  return (
    <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Btn variant="secondary" size="sm" icon={I.chevronLeft} disabled={page === 0 || disabled} onClick={() => onChange(page - 1)}>Previous</Btn>
      {items.map((it, i) => it === '…' ? (
        <span key={`gap-${i}`} aria-hidden="true" style={{ padding: '0 4px', color: T.textFaint }}>…</span>
      ) : (
        <button
          key={it}
          type="button"
          className="ui-chip"
          aria-label={`Page ${it + 1}`}
          aria-current={it === page ? 'page' : undefined}
          disabled={disabled}
          onClick={() => it !== page && onChange(it)}
          style={{
            minWidth: 32, height: 32, padding: '0 8px', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            fontVariantNumeric: 'tabular-nums', borderRadius: T.radiusMd, cursor: disabled ? 'default' : 'pointer',
            border: `1px solid ${it === page ? T.primary : T.border}`,
            background: it === page ? T.primary : '#fff', color: it === page ? '#fff' : T.textSoft,
          }}
        >{it + 1}</button>
      ))}
      <Btn variant="secondary" size="sm" disabled={page + 1 >= totalPages || disabled} onClick={() => onChange(page + 1)}>
        Next<span style={{ display: 'inline-flex', marginLeft: 2 }}>{I.chevronRight}</span>
      </Btn>
    </nav>
  );
}

/* Memoised so changing page/loading state doesn't re-render rows whose record is unchanged. */
const RecordRow = memo(function RecordRow({ r, canRemove, canOpen, onOpen, onRemove }) {
  const removable = canRemove && (r.status === 'PENDING' || r.status === 'DRAFT');
  return (
    <tr
      className="ui-row"
      tabIndex={canOpen ? 0 : -1}
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}
      style={{ cursor: canOpen ? 'pointer' : 'default' }}
    >
      <td style={tdBase}><PersonCell r={r} /></td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSoft }}>
          <span style={{ display: 'inline-flex', color: T.textFaint, flexShrink: 0 }}>{I.building}</span>
          <span>{r.legalPersonName || '—'}</span>
        </div>
      </td>
      <td style={tdBase}>
        {r.ownershipPercentage != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', minWidth: 42 }}>{r.ownershipPercentage}%</span>
            <Bar value={r.ownershipPercentage} />
          </div>
        ) : <span style={{ color: T.textFaint }}>—</span>}
      </td>
      <td style={tdBase}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <span style={{ color: T.textSoft, fontSize: 13 }}>{humanize(r.idDocumentType) || '—'}</span>
          {r.idExpired && <Pill tone="danger">ID expired</Pill>}
        </div>
      </td>
      <td style={tdBase}><StatusBadge status={r.status} /></td>
      <td style={tdBase}><DecisionCell record={r} /></td>
      {canRemove && (
        <td style={{ ...tdBase, textAlign: 'right' }}>
          {removable && (
            <Btn variant="dangerOutline" size="sm" icon={I.trash} onClick={(e) => onRemove(e, r)}>Remove</Btn>
          )}
        </td>
      )}
    </tr>
  );
});

/* ==========================================================================
   Records
   ========================================================================== */
export default function Records({ onRegister, canRegister, canRemove, onOpen }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [pepOnly, setPepOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState(null);       // Spring Page: { content, totalElements, totalPages }
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const cacheRef = useRef(new Map());   // key -> { promise, ts }
  const scrollRef = useRef(null);
  const debouncedRef = useRef('');

  const columns = 6 + (canRemove ? 1 : 0);

  /* debounce the search box */
  useEffect(() => {
    const t = setTimeout(() => {
      const v = query.trim();
      if (v === debouncedRef.current) return;
      debouncedRef.current = v;
      setDebounced(v);
      setPage(0);                    // batched with setDebounced -> one request, not two
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  /* filter changes reset the page in the same update, so only one request is fired */
  const changeStatus = useCallback((s) => { setStatus(s); setPage(0); }, []);
  const togglePep = useCallback(() => { setPepOnly((v) => !v); setPage(0); }, []);
  const changePageSize = useCallback((n) => { setPageSize(n); setPage(0); }, []);
  const goToPage = useCallback((p) => setPage(Math.max(0, p)), []);

  /* summary numbers (optional — the page works without them) */
  const loadStats = useCallback(() => {
    getDashboardStats().then(setStats).catch(() => setStats(null));
  }, []);
  useEffect(() => { loadStats(); }, [loadStats, reloadKey]);

  /* records — cached per (filters, page, size, reloadKey); the next page is prefetched */
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
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);   // drop oldest
    return promise;
  }, [debounced, status, pepOnly, pageSize, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage(page)
      .then((res) => {
        if (cancelled) return;
        // the last page can vanish (e.g. after removing its only row) -> step back
        if (res.totalPages > 0 && page >= res.totalPages) { setPage(res.totalPages - 1); return; }
        setData(res);
        setError(null);
        setLoading(false);
        if (page + 1 < res.totalPages) fetchPage(page + 1).catch(() => {});   // warm next page
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.friendlyMessage || 'Failed to load records');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchPage, page]);

  /* back to the top of the table when the page changes */
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [page, pageSize]);

  const records = data?.content || [];
  const total = data?.totalElements ?? records.length;
  const totalPages = data?.totalPages ?? 1;
  const firstShown = total === 0 ? 0 : page * pageSize + 1;
  const lastShown = page * pageSize + records.length;
  const filtered = Boolean(debounced || status || pepOnly);

  const clearFilters = () => { setQuery(''); debouncedRef.current = ''; setDebounced(''); setStatus(''); setPepOnly(false); setPage(0); };

  const handleRemove = useCallback(async (e, r) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${r.boReference} (${r.fullName}) from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return;
    try {
      await removeBoRecord(r.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to remove the record');
    }
  }, []);

  const open = useCallback((id) => { if (onOpen) onOpen(id); }, [onOpen]);

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <GlobalStyle />

      {/* ---------- Header ---------- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 750, margin: '0 0 4px', letterSpacing: '-.025em' }}>Beneficial owner lists</h1>
          <div style={{ fontSize: 13.5, color: T.textMuted }}>
            Every beneficial owner records.
          </div>
        </div>

      </div>

      {/* ---------- Summary cards (click to filter) ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total records" value={stats?.total} tone="neutral" active={status === ''} loading={!stats && loading} onClick={() => changeStatus('')} />
        <StatCard label="Pending review" value={stats?.pending} tone="warn" active={status === 'PENDING'} loading={!stats && loading} onClick={() => changeStatus('PENDING')} />
        <StatCard label="Verified" value={stats?.verified} tone="success" active={status === 'VERIFIED'} loading={!stats && loading} onClick={() => changeStatus('VERIFIED')} />
        <StatCard label="Rejected" value={stats?.rejected} tone="danger" active={status === 'REJECTED'} loading={!stats && loading} onClick={() => changeStatus('REJECTED')} />
      </div>

      {error && (
        <Banner action={<Btn size="sm" variant="secondary" icon={I.refresh} onClick={() => setReloadKey((k) => k + 1)}>Retry</Btn>}>
          {error}
        </Banner>
      )}

      {/* ---------- Table card ---------- */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>

        {/* toolbar */}
        <div style={{ padding: 16, borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', flex: '1 1 280px', maxWidth: 460,
              background: searchFocused ? '#fff' : T.surfaceAlt, borderRadius: T.radiusMd, cursor: 'text',
              border: `1px solid ${searchFocused ? T.primary : T.border}`,
              boxShadow: searchFocused ? `0 0 0 3px ${T.primaryRing}` : 'none', transition: 'all .15s ease',
            }}>
              <span style={{ display: 'flex', color: searchFocused ? T.primary : T.textFaint }}>{I.search}</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search by name, BO reference or phone number"
                aria-label="Search records"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: 'inherit', color: T.text, padding: 0 }}
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}
                  style={{ display: 'flex', border: 'none', background: 'transparent', color: T.textFaint, cursor: 'pointer', padding: 2 }}>
                  {I.close}
                </button>
              )}
            </label>

            <button
              type="button"
              className="ui-chip"
              aria-pressed={pepOnly}
              onClick={togglePep}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, borderRadius: T.radiusMd, cursor: 'pointer',
                border: `1px solid ${pepOnly ? T.warnBorder : T.border}`,
                background: pepOnly ? T.warnBg : '#fff', color: pepOnly ? T.warn : T.textSoft,
              }}
            >
              <span style={{ display: 'inline-flex' }}>{I.shield}</span>
              PEP only{stats?.pepFlagged != null ? ` (${stats.pepFlagged})` : ''}
            </button>

            {filtered && (
              <Btn variant="ghost" size="md" onClick={clearFilters}>Clear filters</Btn>
            )}
          </div>

          {/* status segments */}
          <div role="tablist" aria-label="Filter by status" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_TABS.map((t) => {
              const on = status === t.key;
              const count = t.stat && stats ? stats[t.stat] : null;
              return (
                <button
                  key={t.key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="ui-chip"
                  onClick={() => changeStatus(t.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 12px', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${on ? T.primary : T.border}`,
                    background: on ? T.primary : '#fff', color: on ? '#fff' : T.textSoft,
                  }}
                >
                  {t.label}
                  {count != null && (
                    <span style={{
                      minWidth: 20, height: 18, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: on ? 'rgba(255,255,255,.2)' : '#eef1f6', color: on ? '#fff' : T.textMuted,
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* table */}
        <div ref={scrollRef} style={{ overflowX: 'auto', maxHeight: '68vh', opacity: loading && data ? 0.6 : 1, transition: 'opacity .15s ease' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                <th style={thBase}>Beneficial owner</th>
                <th style={thBase}>Legal entity</th>
                <th style={thBase}>Ownership</th>
                <th style={thBase}>Identification</th>
                <th style={thBase}>Status</th>
                <th style={thBase}>Decision</th>
                {canRemove && <th style={{ ...thBase, textAlign: 'right' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && !data && <SkeletonRows columns={columns} />}

              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={columns} style={{ ...tdBase, borderBottom: 'none', padding: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '56px 20px', textAlign: 'center' }}>
                      <span style={{ color: T.textFaint }}>{I.inbox}</span>
                      <div style={{ fontSize: 15, fontWeight: 650 }}>{filtered ? 'No records match your filters' : 'No records yet'}</div>
                      <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 360 }}>
                        {filtered ? 'Try a different name or reference, or clear the filters.' : 'Beneficial owner records will appear here once they are registered.'}
                      </div>
                      {filtered && <Btn variant="secondary" size="sm" onClick={clearFilters} style={{ marginTop: 6 }}>Clear filters</Btn>}
                    </div>
                  </td>
                </tr>
              )}

              {records.map((r) => (
                <RecordRow key={r.id} r={r} canRemove={canRemove} canOpen={Boolean(onOpen)} onOpen={open} onRemove={handleRemove} />
              ))}
            </tbody>
          </table>
        </div>

        {/* footer / pagination */}
        {!error && total > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderTop: `1px solid ${T.border}`, background: T.surfaceAlt, fontSize: 12.5, color: T.textMuted,
          }}>
            <span>
              Showing <strong style={{ color: T.text }}>{firstShown}–{lastShown}</strong> of <strong style={{ color: T.text }}>{total}</strong> record{total === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => changePageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                  style={{ height: 30, fontFamily: 'inherit', fontSize: 12.5, border: `1px solid ${T.border}`, borderRadius: T.radiusMd, background: '#fff', color: T.text }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={goToPage} disabled={loading} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
