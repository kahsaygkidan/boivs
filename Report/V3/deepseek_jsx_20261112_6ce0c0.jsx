import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listLegalPersons, searchBoRecords, getBoRecord,
} from '../api/bovsApi.js';
import {
  fmtWhen, humanize, buildEntityReportHtml, buildMultiEntityReportHtml, printHtml,
} from '../utils/reportBuilders.js';
import {
  T, Btn, Banner, Skeleton, GlobalStyle, I, StatusBadge,
} from '../components/ui.jsx';
import '../styles/Reports.css';

/* ---------- Constants ---------- */
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending review' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CEASED', label: 'Ceased' },
  { value: 'DRAFT', label: 'Draft' },
];

const PAGE_SIZE = 10;

/* ---------- Icons ---------- */
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const EmptyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const PrinterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

/* ---------- KPI strip ---------- */
function KpiStrip({ entities, owners }) {
  const stats = useMemo(() => {
    const pending = owners.filter((o) => o.status === 'PENDING').length;
    const verified = owners.filter((o) => o.status === 'VERIFIED').length;
    const rejected = owners.filter((o) => o.status === 'REJECTED').length;
    const pep = owners.filter((o) => o.pep).length;
    return { pending, verified, rejected, pep };
  }, [owners]);

  const items = [
    { label: 'Entities', value: entities.length, tone: 'primary' },
    { label: 'Owners', value: owners.length, tone: 'neutral' },
    { label: 'Verified', value: stats.verified, tone: 'success' },
    { label: 'Pending', value: stats.pending, tone: 'warn' },
    { label: 'Rejected', value: stats.rejected, tone: 'danger' },
    { label: 'PEPs', value: stats.pep, tone: 'info' },
  ];

  return (
    <div className="rp-kpis">
      {items.map((k) => (
        <div key={k.label} className={`rp-kpi rp-kpi--${k.tone}`}>
          <div className="rp-kpi__label">{k.label}</div>
          <div className="rp-kpi__value">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Owner table ---------- */
function OwnerTable({ owners }) {
  if (owners.length === 0) {
    return <div className="rp-owners__empty">No beneficial owners match the current filters.</div>;
  }
  return (
    <div className="rp-owners">
      <table>
        <thead>
          <tr>
            <th>Beneficial owner</th>
            <th>Status</th>
            <th className="is-num">Ownership</th>
            <th>Type</th>
            <th>PEP</th>
            <th>Sanctions</th>
            <th>ID expired</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o) => (
            <tr key={o.id}>
              <td>
                <div className="rp-owner-name">{o.fullName}</div>
                {o.idNumber && <div className="rp-owner-id">{o.idNumber}</div>}
              </td>
              <td><StatusBadge status={o.status} /></td>
              <td className="is-num">
                {o.ownershipPercentage != null ? `${o.ownershipPercentage}%` : '—'}
              </td>
              <td>{humanize(o.ownershipType) || '—'}</td>
              <td>{o.pep ? 'Yes' : 'No'}</td>
              <td>{o.sanctionsScreened ? 'Yes' : 'No'}</td>
              <td>{o.idExpired ? 'Yes' : 'No'}</td>
              <td style={{ fontFamily: 'var(--rp-mono)', fontSize: 11.5 }}>{o.boReference || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Entity card ---------- */
function EntityCard({ entity, owners, onPrint }) {
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => ({
    total: owners.length,
    pending: owners.filter((o) => o.status === 'PENDING').length,
    verified: owners.filter((o) => o.status === 'VERIFIED').length,
    rejected: owners.filter((o) => o.status === 'REJECTED').length,
    pep: owners.filter((o) => o.pep).length,
  }), [owners]);

  return (
    <section className={`rp-entity${open ? ' rp-entity--expanded' : ''}`}>
      <button
        type="button"
        className="rp-entity__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="rp-entity__chevron"><ChevronIcon /></span>
        <span className="rp-entity__icon"><BuildingIcon /></span>
        <div className="rp-entity__body">
          <div className="rp-entity__name">{entity.name}</div>
          <div className="rp-entity__meta">
            {entity.registrationNumber && <span className="rp-entity__mono">{entity.registrationNumber}</span>}
            {entity.countryOfIncorporation && <span>{entity.countryOfIncorporation}</span>}
            {entity.sector && <span>· {entity.sector}</span>}
          </div>
        </div>
        <div className="rp-entity__counts">
          <span className="rp-chip rp-chip--muted">{counts.total} owner{counts.total === 1 ? '' : 's'}</span>
          {counts.verified > 0 && <span className="rp-chip rp-chip--success">{counts.verified} verified</span>}
          {counts.pending > 0 && <span className="rp-chip rp-chip--warn">{counts.pending} pending</span>}
          {counts.rejected > 0 && <span className="rp-chip rp-chip--danger">{counts.rejected} rejected</span>}
          {counts.pep > 0 && <span className="rp-chip rp-chip--info">{counts.pep} PEP</span>}
        </div>
      </button>

      {open && (
        <div className="rp-entity__content">
          <div className="rp-entity__toolbar">
            <span className="rp-entity__section-title">Beneficial owners</span>
            <Btn variant="secondary" size="sm" icon={<PrinterIcon />} onClick={() => onPrint(entity, owners)}>
              Print entity report
            </Btn>
          </div>
          <OwnerTable owners={owners} />
        </div>
      )}
    </section>
  );
}

/* ---------- Pagination ---------- */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end = Math.min(totalPages, start + 5);
  for (let i = start; i < end; i += 1) pages.push(i);

  return (
    <div className="rp-pagination">
      <span className="rp-pagination__info">
        Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
      </span>
      <div className="rp-pagination__controls">
        <button type="button" className="rp-page-btn" disabled={page === 0} onClick={() => onChange(page - 1)}>←</button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`rp-page-btn${p === page ? ' rp-page-btn--active' : ''}`}
            onClick={() => p !== page && onChange(p)}
          >{p + 1}</button>
        ))}
        <button type="button" className="rp-page-btn" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>→</button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */
export default function Reports() {
  /* filter state */
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [pepOnly, setPepOnly] = useState(false);
  const [sanctionsOnly, setSanctionsOnly] = useState(false);
  const [idExpiredOnly, setIdExpiredOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  /* data */
  const [entities, setEntities] = useState([]);
  const [ownersByEntity, setOwnersByEntity] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => setToast({ msg, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* reset page on filter change */
  useEffect(() => { setPage(0); }, [status, pepOnly, sanctionsOnly, idExpiredOnly, dateFrom, dateTo]);

  /* load entities + owners */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lpRes = await listLegalPersons({ size: 500, sort: 'createdAt,desc' });
      const lpList = lpRes.content || [];
      setEntities(lpList);

      /* fetch owners for all entities in parallel (bounded) */
      const chunks = [];
      for (let i = 0; i < lpList.length; i += 8) chunks.push(lpList.slice(i, i + 8));

      const byEntity = {};
      for (const chunk of chunks) {
        const results = await Promise.all(
          chunk.map((lp) => searchBoRecords({ legalPersonId: lp.id, size: 500 })
            .then((res) => ({ id: lp.id, owners: res.content || [] }))
            .catch(() => ({ id: lp.id, owners: [] }))),
        );
        results.forEach(({ id, owners }) => { byEntity[id] = owners; });
      }
      setOwnersByEntity(byEntity);
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------- Derived filtered data ---------- */
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const matchOwner = (o) => {
      if (status && o.status !== status) return false;
      if (pepOnly && !o.pep) return false;
      if (sanctionsOnly && !o.sanctionsScreened) return false;
      if (idExpiredOnly && !o.idExpired) return false;
      if (dateFrom && o.dateBecameBo && o.dateBecameBo < dateFrom) return false;
      if (dateTo && o.dateBecameBo && o.dateBecameBo > dateTo) return false;
      return true;
    };
    const matchQuery = (o, entityName) => {
      if (!q) return true;
      const hay = [
        o.fullName, o.boReference, o.idNumber, o.phoneNumber, o.email, entityName,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    };

    return entities
      .map((entity) => {
        const all = ownersByEntity[entity.id] || [];
        const owners = all.filter((o) => matchOwner(o) && matchQuery(o, entity.name));
        return { entity, allOwners: all, owners };
      })
      .filter(({ owners, allOwners, entity }) => {
        if (!debouncedSearch && !status && !pepOnly && !sanctionsOnly && !idExpiredOnly && !dateFrom && !dateTo) return allOwners.length > 0 || true;
        if (owners.length > 0) return true;
        if (debouncedSearch && entity.name.toLowerCase().includes(q) && allOwners.length > 0) return true;
        return false;
      });
  }, [entities, ownersByEntity, debouncedSearch, status, pepOnly, sanctionsOnly, idExpiredOnly, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntities = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const allOwnersFlat = useMemo(
    () => Object.values(ownersByEntity).flat(),
    [ownersByEntity],
  );

  const activeFilterCount = [status, pepOnly, sanctionsOnly, idExpiredOnly, dateFrom, dateTo, debouncedSearch]
    .filter(Boolean).length;

  /* ---------- Print ---------- */
  const handlePrintEntity = useCallback((entity, owners) => {
    const html = buildEntityReportHtml(entity, owners);
    if (!printHtml(html)) {
      setError('The report window was blocked. Allow pop-ups for this site, then try again.');
    } else {
      showToast('Report opened in a new window');
    }
  }, [showToast]);

  const handlePrintAll = useCallback(() => {
    const blocks = filtered.map(({ entity, owners }) => ({ entity, owners }));
    if (blocks.length === 0) { showToast('No data to print'); return; }
    const parts = [];
    if (status) parts.push(`status: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`);
    if (pepOnly) parts.push('PEP only');
    if (sanctionsOnly) parts.push('sanctions screened');
    if (idExpiredOnly) parts.push('ID expired');
    if (dateFrom) parts.push(`from ${dateFrom}`);
    if (dateTo) parts.push(`to ${dateTo}`);
    if (debouncedSearch) parts.push(`search: "${debouncedSearch}"`);
    const html = buildMultiEntityReportHtml(blocks, parts.join(' · '));
    if (!printHtml(html)) {
      setError('The report window was blocked. Allow pop-ups for this site, then try again.');
    } else {
      showToast(`Printing ${blocks.length} entit${blocks.length === 1 ? 'y' : 'ies'}`);
    }
  }, [filtered, status, pepOnly, sanctionsOnly, idExpiredOnly, dateFrom, dateTo, debouncedSearch, showToast]);

  /* ---------- Clear filters ---------- */
  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setStatus(''); setPepOnly(false); setSanctionsOnly(false); setIdExpiredOnly(false);
    setDateFrom(''); setDateTo(''); setPage(0);
  };

  /* ---------- Render ---------- */
  return (
    <div className="rp-root">
      <GlobalStyle />

      {/* Header */}
      <header className="rp-header">
        <div>
          <h1 className="rp-header__title">Reports</h1>
          <p className="rp-header__sub">Legal entity ownership reports — filter, review and print.</p>
        </div>
        <div className="rp-header__actions">
          <Btn variant="secondary" icon={I.refresh} onClick={load} disabled={loading}>Refresh</Btn>
          <Btn variant="primary" icon={<PrinterIcon />} onClick={handlePrintAll} disabled={filtered.length === 0}>
            Print all ({filtered.length})
          </Btn>
        </div>
      </header>

      {error && <Banner action={<Btn size="sm" variant="secondary" onClick={load}>Retry</Btn>}>{error}</Banner>}

      {/* Filters */}
      <section className="rp-filters">
        <div className="rp-filters__head">
          <span className="rp-filters__title">Filters</span>
          {activeFilterCount > 0 && (
            <>
              <span className="rp-filters__count">{activeFilterCount} active</span>
              <button type="button" className="rp-btn rp-btn--ghost rp-btn--sm" onClick={clearFilters}>Clear</button>
            </>
          )}
          <span className="rp-filters__divider" />
        </div>

        <div className="rp-filters__grid">
          <label className="rp-field rp-field--wide">
            <span className="rp-field__label">Search</span>
            <span className="rp-search">
              <span className="rp-search__icon"><SearchIcon /></span>
              <input
                className="rp-search__input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Owner name, reference, ID, phone, email, entity…"
                aria-label="Search reports"
              />
              {search && (
                <button type="button" className="rp-search__clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
              )}
            </span>
          </label>

          <label className="rp-field">
            <span className="rp-field__label">Status</span>
            <select className="rp-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          <label className="rp-field">
            <span className="rp-field__label">From date</span>
            <input className="rp-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label className="rp-field">
            <span className="rp-field__label">To date</span>
            <input className="rp-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>

          <label className="rp-field">
            <span className="rp-field__label">Flags</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`rp-chip ${pepOnly ? 'rp-chip--primary' : 'rp-chip--muted'}`}
                style={{ cursor: 'pointer', height: 36, padding: '0 12px' }}
                onClick={() => setPepOnly((v) => !v)}
                aria-pressed={pepOnly}
              >PEP only</button>
              <button
                type="button"
                className={`rp-chip ${sanctionsOnly ? 'rp-chip--primary' : 'rp-chip--muted'}`}
                style={{ cursor: 'pointer', height: 36, padding: '0 12px' }}
                onClick={() => setSanctionsOnly((v) => !v)}
                aria-pressed={sanctionsOnly}
              >Sanctions screened</button>
              <button
                type="button"
                className={`rp-chip ${idExpiredOnly ? 'rp-chip--primary' : 'rp-chip--muted'}`}
                style={{ cursor: 'pointer', height: 36, padding: '0 12px' }}
                onClick={() => setIdExpiredOnly((v) => !v)}
                aria-pressed={idExpiredOnly}
              >ID expired</button>
            </div>
          </label>
        </div>
      </section>

      {/* KPIs */}
      <KpiStrip entities={entities} owners={allOwnersFlat} />

      {/* List */}
      {loading && entities.length === 0 ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rp-skel rp-skel--card" />
          ))}
        </div>
      ) : pageEntities.length === 0 ? (
        <div className="rp-empty">
          <span className="rp-empty__icon"><EmptyIcon /></span>
          <div className="rp-empty__title">No entities match your filters</div>
          <div className="rp-empty__desc">Try clearing filters or broadening your search.</div>
          {activeFilterCount > 0 && (
            <Btn variant="secondary" size="sm" onClick={clearFilters} style={{ marginTop: 12 }}>Clear filters</Btn>
          )}
        </div>
      ) : (
        <>
          <div className="rp-list">
            {pageEntities.map(({ entity, owners }) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                owners={owners}
                onPrint={handlePrintEntity}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {toast && <div className="rp-toast">{toast.msg}</div>}
    </div>
  );
}