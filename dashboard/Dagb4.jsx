import { useEffect, useMemo, useState } from 'react';
import { getDashboardStats, listLegalPersons, getOwnershipTree } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';

/* ==========================================================================
   Design tokens
   ========================================================================== */
const T = {
  surface: '#ffffff',
  surfaceAlt: '#fafbfc',
  bg: '#f4f6fa',
  border: '#e5e8ef',
  borderStrong: '#d5d9e6',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#283375',
  primaryHover: '#1f2859',
  primarySoft: 'rgba(40,51,117,.08)',
  primaryRing: 'rgba(40,51,117,.16)',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  line: '#d5d9e6',
  hoverRow: '#f8fafc',
  radius: 10,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Icons
   ========================================================================== */
const ic = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const I = {
  building: <svg {...ic}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" /></svg>,
  person: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
  users: <svg {...ic}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  check: <svg {...ic}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  clock: <svg {...ic}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
};

/* ==========================================================================
   KPI tile
   ========================================================================== */
function Kpi({ label, value, tone, icon, caption, loading }) {
  const tones = {
    neutral: { fg: T.primary, bg: T.primarySoft },
    success: { fg: T.success, bg: T.successSoft },
    warn: { fg: T.warn, bg: T.warnSoft },
    danger: { fg: T.danger, bg: T.dangerSoft },
  }[tone];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, padding: 18, minHeight: 120, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, fontFamily: T.font }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: tones.bg, color: tones.fg, flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: tones.fg, lineHeight: 1, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
          {loading ? '—' : value ?? '—'}
        </span>
      </div>
      {caption && <span style={{ fontSize: 11.5, color: T.textFaint }}>{caption}</span>}
    </div>
  );
}

/* ==========================================================================
   Entity picker
   ========================================================================== */
function EntityPicker({ legalPersons, value, onChange, loading }) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font, minWidth: 280 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>
        Legal entity
      </span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={onChange}
          disabled={loading}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            height: 38,
            width: '100%',
            minWidth: 280,
            padding: '0 34px 0 12px',
            fontSize: 13.5,
            fontFamily: 'inherit',
            fontWeight: 500,
            color: value ? T.text : T.textMuted,
            background: focused ? '#fff' : T.surface,
            border: `1px solid ${focused ? T.primary : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
          }}
        >
          <option value="">{loading ? 'Loading entities…' : 'Select a legal entity…'}</option>
          {legalPersons.map((lp) => (
            <option key={lp.id} value={lp.id}>
              {lp.name}{lp.registrationNumber ? ` — ${lp.registrationNumber}` : ''}
            </option>
          ))}
        </select>
        <span aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: T.textFaint, pointerEvents: 'none', display: 'flex' }}>
          {I.chevron}
        </span>
      </div>
    </label>
  );
}

/* ==========================================================================
   Tree node classification
   ========================================================================== */
// OwnershipTree holders look like:
//   { key, fullName, idNumber, nationality, ownershipNodeId,
//     effectivePercentage, paths:[{chain, percentage}], controlBasis:[],
//     qualifiesByOwnership, qualifiesByControl, ubo, registered, ... }
//
// Intermediates: entries in paths where the chain has more than 2 hops
//   (Entity → Intermediate → UBO) — derived from the chain string.
function buildTreeFromOwnershipTree(tree, legalPerson) {
  if (!tree) return { root: null, ubos: [], fallbacks: [], intermediates: [] };

  const holders = tree.holders || [];

  // Split holders into UBOs and control-only (still human) nodes.
  const ubos = holders.filter((h) => h.ubo);
  const controlOnly = holders.filter((h) => !h.ubo && (h.qualifiesByControl || (h.controlBasis || []).length > 0));

  // Intermediates: extract every "A → B" segment in each chain and dedupe
  // by the left-hand name. Root legal person is skipped.
  const intermediateSet = new Map();
  const rootName = (legalPerson?.name || '').trim();
  holders.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = String(p.chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
      // parts[0] is root legal person; last part is the UBO; the middle are intermediates
      for (let i = 1; i < parts.length - 1; i++) {
        const name = parts[i];
        if (!name || name === rootName) continue;
        if (!intermediateSet.has(name)) {
          // Effective % reachable through this intermediate is the max across chains
          intermediateSet.set(name, { name, percentage: Number(p.percentage) || 0, children: [] });
        } else {
          const cur = intermediateSet.get(name);
          cur.percentage = Math.max(cur.percentage, Number(p.percentage) || 0);
        }
      }
    });
  });

  const intermediates = Array.from(intermediateSet.values());

  // Parent map — for each UBO, the immediate parent intermediate (or root if direct)
  ubos.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = String(p.chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
      if (parts.length <= 2) return; // direct root → ubo, no intermediate
      const parentName = parts[parts.length - 2];
      const parent = intermediateSet.get(parentName);
      if (parent && !parent.children.includes(h.key)) parent.children.push(h.key);
    });
  });

  return {
    root: {
      name: legalPerson?.name || tree.legalPersonName || 'Legal entity',
      registrationNumber: legalPerson?.registrationNumber,
      id: legalPerson?.id,
    },
    ubos,
    fallbacks: tree.seniorManagingOfficial ? [tree.seniorManagingOfficial] : [],
    intermediates,
    fallbackAllowed: !!tree.seniorManagingOfficialAllowed,
    warnings: tree.warnings || [],
  };
}

/* ==========================================================================
   Tree rendering — recursive
   ========================================================================== */
function NodeBadge({ label, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: T.primarySoft, fg: T.primary },
    success: { bg: T.successSoft, fg: T.success },
    warn: { bg: T.warnSoft, fg: T.warn },
    danger: { bg: T.dangerSoft, fg: T.danger },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: tones.bg, color: tones.fg, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function TreeNode({ node, depth, isLast, guides, onOpen }) {
  const [hover, setHover] = useState(false);
  const INDENT = 28;

  const kindIcon = node.kind === 'entity' ? I.building : node.kind === 'intermediate' ? I.building : I.person;
  const iconBg = node.kind === 'entity' ? T.primarySoft : node.kind === 'intermediate' ? '#e8ebf5' : '#eef1f7';
  const iconFg = node.kind === 'entity' ? T.primary : node.kind === 'intermediate' ? T.primary : T.textMuted;
  const isClickable = node.kind === 'ubo' && node.recordId && onOpen;

  return (
    <div style={{ position: 'relative', paddingLeft: depth * INDENT + (depth > 0 ? 12 : 0) }}>
      {/* Ancestor guides */}
      {depth > 0 &&
        guides.map((cont, i) =>
          cont ? (
            <span key={i} aria-hidden="true" style={{ position: 'absolute', left: i * INDENT + 22, top: 0, bottom: 0, width: 1, background: T.line }} />
          ) : null
        )}
      {/* Elbow for current node */}
      {depth > 0 && (
        <>
          <span aria-hidden="true" style={{ position: 'absolute', left: (depth - 1) * INDENT + 22, top: 0, bottom: isLast ? '50%' : 0, width: 1, background: T.line }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: (depth - 1) * INDENT + 22, top: '50%', width: 14, height: 1, background: T.line }} />
        </>
      )}

      {/* Node row */}
      <div
        onClick={() => isClickable && onOpen(node.recordId)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: node.kind === 'entity' ? '12px 14px' : '9px 12px',
          marginBottom: 2,
          background: isClickable && hover ? T.hoverRow : 'transparent',
          cursor: isClickable ? 'pointer' : 'default',
          borderRadius: 6,
          transition: 'background .12s ease',
          fontFamily: T.font,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: node.kind === 'entity' ? 32 : 26, height: node.kind === 'entity' ? 32 : 26, borderRadius: 7, background: iconBg, color: iconFg, flexShrink: 0 }}>
          {kindIcon}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: node.kind === 'entity' ? 14 : 13.5, fontWeight: node.kind === 'entity' ? 700 : 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.label}
          </div>
          {node.sub && (
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 1, fontFamily: node.monoSub ? T.mono : 'inherit' }}>
              {node.sub}
            </div>
          )}
        </div>

        {/* Ownership % */}
        {node.percentage != null && (
          <div style={{ textAlign: 'right', minWidth: 66, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
              {node.percentage}%
            </div>
            <div style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.04em' }}>ownership</div>
          </div>
        )}

        {/* Status badges */}
        {node.idStatus && (
          <div style={{ flexShrink: 0, minWidth: 82 }}>
            <StatusBadge status={node.idStatus} />
          </div>
        )}
        {node.approvalStatus && (
          <div style={{ flexShrink: 0, minWidth: 90 }}>
            <StatusBadge status={node.approvalStatus} />
          </div>
        )}

        {/* PEP / role chips */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, minWidth: 0 }}>
          {node.kind === 'intermediate' && <NodeBadge label="Intermediate" tone="neutral" />}
          {node.kind === 'ubo' && <NodeBadge label="UBO" tone="success" />}
          {node.kind === 'fallback' && <NodeBadge label="Fallback" tone="warn" />}
          {node.pep && <NodeBadge label="PEP" tone="warn" />}
        </div>
      </div>

      {/* Children */}
      {node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode
              key={child.id || child.key || `${depth}-${i}`}
              node={child}
              depth={depth + 1}
              isLast={i === node.children.length - 1}
              guides={[...guides, !isLast]}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Dashboard
   ========================================================================== */
export default function Dashboard({ onRegister, canRegister, onOpen }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [legalPersonId, setLegalPersonId] = useState('');
  const [tree, setTree] = useState(null);
  const [stats, setStats] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState(null);

  /* Load legal persons + stats */
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setLoadingStats(true);
    Promise.all([listLegalPersons({ size: 500, sort: 'name' }), getDashboardStats()])
      .then(([listRes, statsRes]) => {
        if (cancelled) return;
        const list = listRes.content || [];
        setLegalPersons(list);
        setStats(statsRes);
        if (list.length > 0) setLegalPersonId(list[0].id);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load dashboard'))
      .finally(() => {
        if (cancelled) return;
        setLoadingList(false);
        setLoadingStats(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* Load ownership tree whenever selected entity changes */
  useEffect(() => {
    if (!legalPersonId) { setTree(null); return; }
    let cancelled = false;
    setLoadingTree(true);
    getOwnershipTree(legalPersonId)
      .then((t) => { if (!cancelled) { setTree(t); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.friendlyMessage || 'Failed to load ownership structure'); })
      .finally(() => { if (!cancelled) setLoadingTree(false); });
    return () => { cancelled = true; };
  }, [legalPersonId]);

  const selectedEntity = legalPersons.find((lp) => lp.id === legalPersonId);

  /* Build a renderable tree */
  const model = useMemo(() => {
    const raw = buildTreeFromOwnershipTree(tree, selectedEntity);
    if (!raw.root) return { root: null, uboCount: 0, intermediateCount: 0, hasFallback: false };

    const rootNode = {
      kind: 'entity',
      label: raw.root.name,
      sub: raw.root.registrationNumber ? `Registration ${raw.root.registrationNumber}` : 'Legal entity',
      children: [],
    };

    // Index intermediates + UBOs by key/name
    const ubosByKey = new Map(raw.ubos.map((h) => [h.key, h]));
    const nodeForUbo = (h, parentName) => ({
      kind: 'ubo',
      label: h.fullName,
      sub: h.idNumber || h.boReference || '',
      monoSub: true,
      percentage: h.effectivePercentage != null ? Number(h.effectivePercentage) : null,
      idStatus: h.idExpired ? 'EXPIRED' : h.idNumber ? 'ACTIVE' : undefined,
      approvalStatus: h.status,
      pep: !!h.pep,
      recordId: h.id || h.boReference,
      children: [],
    });

    // Build intermediate nodes with their children UBOs
    raw.intermediates.forEach((it) => {
      const childUbos = raw.ubos.filter((h) =>
        (h.paths || []).some((p) => {
          const parts = String(p.chain).split(/\s*→\s*/);
          return parts.length >= 2 && parts[parts.length - 2] === it.name;
        })
      );
      it.children = childUbos.map((h) => nodeForUbo(h, it.name));
    });

    // UBOs whose parent intermediate exists get dropped from root; direct ones stay
    const directUbos = raw.ubos.filter((h) =>
      (h.paths || []).every((p) => {
        const parts = String(p.chain).split(/\s*→\s*/);
        return parts.length <= 2;
      })
    );

    const intermediateNodes = raw.intermediates.map((it) => ({
      kind: 'intermediate',
      label: it.name,
      sub: 'Holding entity / intermediate',
      percentage: it.percentage,
      children: it.children,
    }));

    rootNode.children = [
      ...intermediateNodes,
      ...directUbos.map((h) => nodeForUbo(h)),
    ];

    // Fallback (senior managing official)
    if (raw.fallbacks.length > 0) {
      raw.fallbacks.forEach((s) => {
        rootNode.children.push({
          kind: 'fallback',
          label: s.name,
          sub: s.position || 'Senior managing official',
          children: [],
        });
      });
    }

    return {
      root: rootNode,
      uboCount: raw.ubos.length,
      intermediateCount: raw.intermediates.length,
      hasFallback: raw.fallbacks.length > 0,
    };
  }, [tree, selectedEntity]);

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ==================== Command bar ==================== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-.02em', color: T.text }}>Ownership structure</h1>
          <div style={{ fontSize: 13, color: T.textMuted }}>Pick a legal entity to view its chain down to natural persons and any fallback.</div>
        </div>
        {canRegister && (
          <button type="button" onClick={onRegister} onMouseEnter={(e) => { e.currentTarget.style.background = T.primaryHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = T.primary; }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: T.primary, border: 'none', borderRadius: T.radiusSm, cursor: 'pointer', boxShadow: '0 1px 2px rgba(40,51,117,.20)', transition: 'background .15s ease', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
            New record
          </button>
        )}
      </div>

      {/* ==================== Error ==================== */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: T.dangerSoft, color: T.danger, border: `1px solid ${T.danger}33`, borderRadius: T.radiusSm, fontSize: 13 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* ==================== KPI grid ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Kpi label="Legal entities" value={legalPersons.length} tone="neutral" icon={I.building} loading={loadingList} caption="Registered customers" />
        <Kpi label="UBOs (selected entity)" value={model.uboCount ?? 0} tone="neutral" icon={I.users} loading={loadingTree} caption={selectedEntity ? selectedEntity.name : 'Select an entity'} />
        <Kpi label="Verified (all)" value={stats?.verified ?? 0} tone="success" icon={I.check} loading={loadingStats} caption="Approved by checker" />
        <Kpi label="Pending (all)" value={stats?.pending ?? 0} tone="warn" icon={I.clock} loading={loadingStats} caption="Awaiting approval" />
      </div>

      {/* ==================== Selector + tree card ==================== */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
          <EntityPicker
            legalPersons={legalPersons}
            value={legalPersonId}
            onChange={(e) => setLegalPersonId(e.target.value)}
            loading={loadingList}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
            {loadingTree ? 'Loading structure…' : model.root ? (
              <>
                <strong style={{ color: T.text }}>{model.uboCount}</strong> UBO{model.uboCount === 1 ? '' : 's'} · <strong style={{ color: T.text }}>{model.intermediateCount}</strong> intermediate · {model.hasFallback ? '1 fallback' : 'no fallback'}
              </>
            ) : 'No entity selected'}
          </span>
        </div>

        {/* Tree body */}
        {loadingTree && (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${T.border}`, borderTopColor: T.primary, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              Loading ownership structure…
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loadingTree && !model.root && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Select a legal entity</div>
            <div style={{ fontSize: 12.5, color: T.textMuted }}>The ownership tree will appear here.</div>
          </div>
        )}

        {!loadingTree && model.root && (
          <div style={{ padding: '16px 16px 20px', background: T.surfaceAlt }}>
            <TreeNode node={model.root} depth={0} isLast guides={[]} onOpen={onOpen} />
          </div>
        )}

        {/* Warnings */}
        {tree?.warnings?.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, background: T.warnSoft, color: T.warn, fontSize: 12.5 }}>
            <strong>Tracing notes</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{tree.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
