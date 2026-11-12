/* Determines the tone of a node */
function nodeTone(node, isMe) {
  if (isMe) return 'me';
  if (node.kind === 'entity') return 'entity';
  if (node.kind === 'intermediate') return 'intermediate';
  if (node.kind === 'person') return node.holder?.ubo ? 'ubo' : 'control';
  return 'intermediate';
}

/* The card that represents one node in the tree */
function TreeNodeCard({ node, record }) {
  const [open, setOpen] = useState(true);
  const kids = [...node.children.values()];
  const h = node.holder;
  const isMe = Boolean(h) && (
    (h.boReference && h.boReference === record.boReference)
    || (h.idNumber && record.idNumber && h.idNumber === record.idNumber)
    || h.fullName === record.fullName
  );
  const tone = nodeTone(node, isMe);
  const pctText = h && (h.effectivePercentage ?? h.ownershipPercentage) != null
    ? `${h.effectivePercentage ?? h.ownershipPercentage}%`
    : null;
  const kindLabel = node.kind === 'entity'
    ? 'Legal entity'
    : node.kind === 'intermediate'
      ? 'Intermediate entity'
      : (h?.ubo ? 'Beneficial owner' : 'Control only');

  return (
    <div className="rd-tree-branch">
      <div className={`rd-tnode rd-tnode--${tone}`}>
        <div className="rd-tnode__strip" aria-hidden="true" />
        <div className="rd-tnode__body">
          <span className="rd-tnode__icon" aria-hidden="true">
            {node.kind === 'person' ? <Avatar name={node.label} size={0} /> : null}
            {node.kind === 'person'
              ? (node.label || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
              : I.building}
          </span>
          <div className="rd-tnode__main">
            <div className="rd-tnode__label" title={node.label}>{node.label}</div>
            <div className="rd-tnode__sub">
              <span>{kindLabel}</span>
              {pctText && (
                <span className="rd-tnode__pct">
                  {pctText} · {holderIsDirect(h) ? 'direct' : 'indirect'}
                </span>
              )}
              {h?.pep && <Pill tone="warn">PEP</Pill>}
              {isMe && <Pill tone="primary">This record</Pill>}
            </div>
          </div>
          {kids.length > 0 && (
            <button
              type="button"
              className="rd-tnode__toggle"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
            >
              {open ? '−' : '+'}
            </button>
          )}
        </div>
      </div>

      {kids.length > 0 && open && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="rd-tree-branch__vline" aria-hidden="true" />
          <div className="rd-tree-list">
            {kids.map((c) => (
              <div key={c.key} className="rd-tree-list__item">
                <TreeNodeCard node={c} record={record} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeRoot({ node, record }) {
  return (
    <div className="rd-tree-layout">
      <TreeNodeCard node={node} record={record} />
    </div>
  );
}