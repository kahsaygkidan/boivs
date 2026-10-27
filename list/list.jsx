import { useEffect, useState } from 'react';
import { searchBoRecords,removeBoRecord } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';

/* ==========================================================================
   Icons
   ========================================================================== */

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.2 9.2 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="5" y="6" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 11h10M9 15h10M9 19h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

function EmptyState({ query }) {
  return (
    <div className="table-empty-state">
      <EmptyIcon />
      <div>No records found.</div>
      {query && <div className="hint">Try a different name or BO reference.</div>}
    </div>
  );
}

/* ==========================================================================
   Records
   ========================================================================== */

const COLUMN_COUNT = 6;

export default function Records({ onRegister, canRegister, canRemove, onOpen }) {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const removable = (r) => canRemove && (r.status === 'PENDING' || r.status === 'DRAFT');


   const handleRemove = async (e, r) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${r.boReference} (${r.fullName}) from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return;
    try {
      await removeBoRecord(r.id);
      setRecords((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to remove the record');
    }
  };
  /* ------------------------------------------------------------------------
     Fetch records whenever the query changes
     ------------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    searchBoRecords({ q: query || undefined, size: 50 })
      .then((res) => {
        if (cancelled) return;
        setRecords(res.content || []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.friendlyMessage || 'Failed to load records');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  /* ------------------------------------------------------------------------
     Derived values
     ------------------------------------------------------------------------ */
  const recordCount = records.length;
  const showCount = !loading && !error;

  const handleRowClick = (id) => {
    if (onOpen) onOpen(id);
  };

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  return (
    <div className="page-narrow">
      {/* ---------- Page header ---------- */}
      <div className="page-head">
        <div>
          <h1>BO Records</h1>
          <div className="desc">
            Full register of beneficial owner records.
            {showCount && (
              <>
                {' '}&middot; {recordCount} record{recordCount === 1 ? '' : 's'}
              </>
            )}
          </div>
        </div>
        {canRegister && (
          <button
            type="button"
            className="btn btn-blue"
            onClick={onRegister}
          >
            + Register beneficial owner
          </button>
        )}
      </div>

      {/* ---------- Search toolbar ---------- */}
      <div className="toolbar">
        <div className="search-box toolbar-search">
          <SearchIcon />
          <input
            placeholder="Search by name , BO reference or Phone number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search records"
          />
        </div>
      </div>

      {/* ---------- Error banner ---------- */}
      {error && (
        <div className="banner-error">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Records table ---------- */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>BO Reference</th>
              <th>Full name</th>
              <th>Legal entity</th>
              <th>Ownership %</th>
              <th>Identification document</th>
                <th>Phone number</th>
              <th>ID Status</th>
              <th>Approval status</th>
              {canRemove && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="table-empty">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && recordCount === 0 && (
              <tr>
                <td colSpan={COLUMN_COUNT}>
                  <EmptyState query={query} />
                </td>
              </tr>
            )}

            {!loading && records.map((r) => (
              <tr
                key={r.id}
                onClick={() => handleRowClick(r.id)}
                className={onOpen ? 'row-clickable' : undefined}
              >
                <td className="ref mono">{r.boReference}</td>
                <td>{r.fullName}</td>
                <td>{r.legalPersonName}</td>
                <td>{r.ownershipPercentage}%</td>
                <td> {r.idDocumentType}      </td>
                <td>{r.phoneNumber} </td>
                <td>
                  <StatusBadge status={r.idExpired ? 'EXPIRED' : 'ACTIVE'} />
                </td>

                <td>
                  <StatusBadge status={r.status} />
                </td>
                 {canRemove && (
                    <td>
                      {removable(r) && (
                        <button type="button" className="btn btn-danger-outline btn-sm" onClick={(e) => handleRemove(e, r)}>Remove</button>
                      )}
                    </td>
                  )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
