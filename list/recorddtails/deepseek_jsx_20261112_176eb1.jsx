function OwnershipTreeCard({ tree, error, record }) {
  const [open, setOpen] = useState(true);  // ← expanded by default
  const root = useMemo(() => buildOwnershipTrie(tree, record.legalPersonName), [tree, record.legalPersonName]);
  const holders = tree?.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const direct = ubos.filter(holderIsDirect).length;
  const indirect = ubos.length - direct;
  const controlOnly = holders.filter((h) => !h.ubo && holderHasControl(h)).length;
  const fallback = tree?.seniorManagingOfficial;

  return (
    <section className="rd-own">
      {/* Head */}
      <header className="rd-own__head">
        <div style={{ minWidth: 0 }}>
          <h2 className="rd-own__title">
            <span className="rd-own__title-icon">{I.building}</span>
            Ownership structure
            {tree && (
              <Pill tone="primary">{ubos.length} UBO{ubos.length === 1 ? '' : 's'}</Pill>
            )}
          </h2>
          <div className="rd-own__sub">
            {record.legalPersonName || 'Ownership structure of the legal entity'}
          </div>
        </div>

        <div className="rd-own__legend">
          <span className="rd-own__legend-item"><span className="rd-own__dot rd-own__dot--entity" />Entity</span>
          <span className="rd-own__legend-item"><span className="rd-own__dot rd-own__dot--intermediate" />Intermediate</span>
          <span className="rd-own__legend-item"><span className="rd-own__dot rd-own__dot--ubo" />Beneficial owner</span>
          <span className="rd-own__legend-item"><span className="rd-own__dot rd-own__dot--control" />Control only</span>
          <span className="rd-own__legend-item"><span className="rd-own__dot rd-own__dot--me" />This record</span>
        </div>

        <button
          type="button"
          className="rd-btn rd-btn--ghost rd-btn--sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </header>

      {/* Stats strip — only when tree is loaded */}
      {tree && open && (
        <div className="rd-own__stats">
          <div className="rd-own__stat">
            <div className="rd-own__stat-label">Direct UBOs</div>
            <div className="rd-own__stat-value">{direct}</div>
          </div>
          <div className="rd-own__stat">
            <div className="rd-own__stat-label">Indirect UBOs</div>
            <div className="rd-own__stat-value">{indirect}</div>
          </div>
          <div className="rd-own__stat">
            <div className="rd-own__stat-label">Control only</div>
            <div className="rd-own__stat-value">{controlOnly}</div>
          </div>
          <div className="rd-own__stat rd-own__stat--primary">
            <div className="rd-own__stat-label">Total</div>
            <div className="rd-own__stat-value">{ubos.length + controlOnly}</div>
          </div>
        </div>
      )}

      {/* Canvas */}
      {open && (
        <div className="rd-own__canvas">
          {error ? (
            <Banner>{error}</Banner>
          ) : !tree ? (
            <div>
              <Skeleton width="100%" height={70} />
              <Skeleton width="60%" height={40} style={{ marginTop: 12 }} />
            </div>
          ) : root.children.size === 0 ? (
            <div className="rd-own__empty">
              <div>No beneficial owners in the ownership structure yet.</div>
              {fallback && (
                <div style={{ marginTop: 6 }}>
                  Senior managing official on record:{' '}
                  <strong>{fallback.name || fallback.fullName}</strong>
                  {fallback.position ? ` (${fallback.position})` : ''}
                </div>
              )}
            </div>
          ) : (
            <TreeRoot node={root} record={record} />
          )}
        </div>
      )}
    </section>
  );
}