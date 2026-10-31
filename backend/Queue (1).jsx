import { useCallback, useEffect, useState } from 'react';
import { getQueue } from '../api/bovsApi.js';
import RecordDetail from './RecordDetail.jsx';
import {
  T, Btn, Banner, Avatar, Pill, Bar, Skeleton, GlobalStyle, I, fmtWhen, humanize,
} from '../components/ui.jsx';

const tdBase = { padding: '14px 16px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle', fontSize: 13.5, color: T.text, background: T.surface };
const thBase = {
  padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase',
  color: T.textMuted, background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', position: 'sticky', top: 0,
};

const COLUMNS = 6;

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: COLUMNS }).map((__, j) => (
        <td key={j} style={tdBase}>
          {j === 0
            ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Skeleton width={38} height={38} style={{ borderRadius: 12 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
                </div>
              </div>
            )
            : <Skeleton width={j === COLUMNS - 1 ? 90 : '70%'} />}
        </td>
      ))}
    </tr>
  ));
}

/**
 * Checker verification queue.
 * Reviewing a record opens RecordDetail in place, so approve / reject
 * happens in exactly one place. `roles` is the same object passed to RecordDetail
 * ({ isMaker, isChecker, isAuditor }); isChecker defaults to true here.
 */
export default function Queue({ roles }) {
  /* The queue is a checker screen: if the parent doesn't pass roles, still show checker actions. */
  const effectiveRoles = { isChecker: true, ...(roles || {}) };

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewId, setReviewId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return getQueue({ size: 50 })
      .then((res) => setRecords(res.content || []))
      .catch((err) => setError(err.friendlyMessage || 'Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------- Review mode: the full record page ---------- */
  if (reviewId != null) {
    return (
      <RecordDetail
        id={reviewId}
        roles={effectiveRoles}
        onBack={() => { setReviewId(null); load(); }}
      />
    );
  }

  /* ---------- Queue list ---------- */
  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <GlobalStyle />

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 750, margin: '0 0 4px', letterSpacing: '-.025em' }}>Verification queue</h1>
          <div style={{ fontSize: 13.5, color: T.textMuted }}>
            Records awaiting checker review, sorted by submission date.
          </div>
        </div>
        <Btn variant="secondary" icon={I.refresh} onClick={load} disabled={loading}>Refresh</Btn>
      </div>

      {error && (
        <Banner action={<Btn size="sm" variant="secondary" icon={I.refresh} onClick={load}>Retry</Btn>}>
          {error}
        </Banner>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '72vh', opacity: loading && records.length ? 0.6 : 1, transition: 'opacity .15s ease' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                <th style={thBase}>Beneficial owner</th>
                <th style={thBase}>Customer</th>
                <th style={thBase}>Ownership</th>
                <th style={thBase}>Submitted by</th>
                <th style={thBase}>Submitted</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && records.length === 0 && <SkeletonRows />}

              {!loading && !error && records.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS} style={{ ...tdBase, borderBottom: 'none', padding: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '56px 20px', textAlign: 'center' }}>
                      <span style={{ color: T.textFaint }}>{I.inbox}</span>
                      <div style={{ fontSize: 15, fontWeight: 650 }}>Queue is empty</div>
                      <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 360 }}>
                        Records submitted for verification will appear here.
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {records.map((r) => (
                <tr
                  key={r.id}
                  className="ui-row"
                  tabIndex={0}
                  onClick={() => setReviewId(r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setReviewId(r.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={tdBase}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <Avatar name={r.fullName} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fullName || '—'}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.mono }}>{r.boReference}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdBase}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSoft }}>
                      <span style={{ display: 'inline-flex', color: T.textFaint, flexShrink: 0 }}>{I.building}</span>
                      <span>{r.legalPersonName || '—'}</span>
                    </div>
                  </td>
                  <td style={tdBase}>
                    {r.ownershipPercentage != null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', minWidth: 42 }}>{Number(r.ownershipPercentage)}%</span>
                          <Bar value={Number(r.ownershipPercentage)} />
                        </div>
                        {r.ownershipType && <Pill tone="neutral">{humanize(r.ownershipType)}</Pill>}
                      </div>
                    ) : <span style={{ color: T.textFaint }}>—</span>}
                  </td>
                  <td style={{ ...tdBase, color: T.textSoft }}>{r.createdBy || '—'}</td>
                  <td style={{ ...tdBase, color: T.textSoft, whiteSpace: 'nowrap' }}>{fmtWhen(r.createdAt) || '—'}</td>
                  <td style={{ ...tdBase, textAlign: 'right' }}>
                    <Btn
                      size="sm"
                      icon={I.eye}
                      onClick={(e) => { e.stopPropagation(); setReviewId(r.id); }}
                    >
                      Review
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
