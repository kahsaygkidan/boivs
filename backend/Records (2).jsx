import { useCallback, useEffect, useState } from 'react';
import { searchBoRecords, removeBoRecord, getDashboardStats } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import {
  T, Btn, Banner, Avatar, Pill, Bar, Skeleton, GlobalStyle, I, fmtWhen, humanize,
} from '../components/ui.jsx';

const PAGE_SIZE = 15;

/* Status filter tabs. `stat` is the key in /dashboard/stats (draft has no count). */
const STATUS_TABS = [
  { key: '', label: 'All', stat: 'total' },
  { key: 'PENDING', label: 'Pending review', stat: 'pending' },
  { key: 'VERIFIED', label: 'Verified', stat: 'verified' },
  { key: 'REJECTED', label: 'Rejected', stat: 'rejected' },
  { key: 'DRAFT', label: 'Draft', stat: null },
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

/* ==========================================================================
   Records
   ========================================================================== */
export default function Records({ onRegister, canRegister, canRemove, onOpen }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [pepOnly, setPepOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);       // Spring Page: { content, totalElements, totalPages }
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

  const columns = 6 + (canRemove ? 1 : 0);
  const removable = (r) => canRemove && (r.status === 'PENDING' || r.status === 'DRAFT');

  /* debounce the search box */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  /* any filter change goes back to the first page */
  useEffect(() => { setPage(0); }, [debounced, status, pepOnly]);

  /* summary numbers (optional — the page works without them) */
  const loadStats = useCallback(() => {
    getDashboardStats().then(setStats).catch(() => setStats(null));
  }, []);
  useEffect(() => { loadStats(); }, [loadStats, reloadKey]);

  /* records */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchBoRecords({
      q: debounced || undefined,
      status: status || undefined,
      pep: pepOnly ? true : undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.friendlyMessage || 'Failed to load records'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, status, pepOnly, page, reloadKey]);

  const records = data?.content || [];
  const total = data?.totalElements ?? records.length;
  const totalPages = data?.totalPages ?? 1;
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastShown = page * PAGE_SIZE + records.length;
  const filtered = Boolean(debounced || status || pepOnly);

  const clearFilters = () => { setQuery(''); setDebounced(''); setStatus(''); setPepOnly(false); };

  const handleRemove = async (e, r) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${r.boReference} (${r.fullName}) from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return;
    try {
      await removeBoRecord(r.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to remove the record');
    }
  };

  const open = (id) => { if (onOpen) onOpen(id); };

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <GlobalStyle />

      {/* ---------- Header ---------- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 750, margin: '0 0 4px', letterSpacing: '-.025em' }}>Beneficial owner register</h1>
          <div style={{ fontSize: 13.5, color: T.textMuted }}>
            Every beneficial owner record across your customers, with its review status and decision.
          </div>
        </div>
        {canRegister && (
          <Btn size="lg" icon={I.plus} onClick={onRegister}>Register beneficial owner</Btn>
        )}
      </div>

      {/* ---------- Summary cards (click to filter) ---------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total records" value={stats?.total} tone="neutral" active={status === ''} loading={!stats && loading} onClick={() => setStatus('')} />
        <StatCard label="Pending review" value={stats?.pending} tone="warn" active={status === 'PENDING'} loading={!stats && loading} onClick={() => setStatus('PENDING')} />
        <StatCard label="Verified" value={stats?.verified} tone="success" active={status === 'VERIFIED'} loading={!stats && loading} onClick={() => setStatus('VERIFIED')} />
        <StatCard label="Rejected" value={stats?.rejected} tone="danger" active={status === 'REJECTED'} loading={!stats && loading} onClick={() => setStatus('REJECTED')} />
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
              onClick={() => setPepOnly((v) => !v)}
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
                  onClick={() => setStatus(t.key)}
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
        <div style={{ overflowX: 'auto', maxHeight: '68vh', opacity: loading && data ? 0.6 : 1, transition: 'opacity .15s ease' }}>
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
                <tr
                  key={r.id}
                  className="ui-row"
                  tabIndex={onOpen ? 0 : -1}
                  onClick={() => open(r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') open(r.id); }}
                  style={{ cursor: onOpen ? 'pointer' : 'default' }}
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
                      {removable(r) && (
                        <Btn variant="dangerOutline" size="sm" icon={I.trash} onClick={(e) => handleRemove(e, r)}>Remove</Btn>
                      )}
                    </td>
                  )}
                </tr>
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
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Btn variant="secondary" size="sm" icon={I.chevronLeft} disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Btn>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>Page {page + 1} of {totalPages}</span>
                <Btn variant="secondary" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next<span style={{ display: 'inline-flex', marginLeft: 2 }}>{I.chevronRight}</span>
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
