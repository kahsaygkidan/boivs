/* src/utils/boUtils.js
   Shared rules, helpers and export engine for Dashboard, InsightsDashboard and Reports.
   Plain JS, no React. Excel export needs:  npm i xlsx   (loaded lazily). */

/* ==========================================================================
   Labels
   ========================================================================== */
export const HIGH_RISK_SECTORS = new Set(['MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT']);

export const SECTOR_LABELS = {
  OTHER: 'Other', MINING: 'Mining', REAL_ESTATE: 'Real Estate', MOTOR_DEALERSHIP: 'Motor Dealership',
  IMPORT_EXPORT: 'Import / Export', FINANCIAL: 'Financial',
};

export const ENTITY_LABELS = {
  SHARE_COMPANY: 'Share Company', PRIVATE_LIMITED_COMPANY: 'Private Limited Company', ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_LIMITED_COMPANY: 'Public Limited Company', GENERAL_PARTNERSHIP: 'General Partnership',
  LIMITED_PARTNERSHIP: 'Limited Partnership', LIMITED_LIABILITY_PARTNERSHIP: 'Limited Liability Partnership',
  FINANCIAL_INSTITUTION: 'Financial Institution', FOREIGN_LEGAL_PERSON: 'Foreign Legal Person',
  PPP: 'Public Private Partnership', CIVIL_SOCIETY_ORGANIZATION: 'Civil Society Organisation',
  GOVERNMENT_OWNED_ENTERPRISE: 'Government-Owned Enterprise', COOPERATIVE_ASSOCIATION: 'Cooperative Association',
  PUBLIC_ADMINISTRATION: 'Public Administration', RELIGIOUS_INSTITUTION: 'Religious Institution',
  INTERNATIONAL_ORGANIZATION: 'International Organisation', TRUST: 'Trust', CHARITY: 'Charity',
  INDIVIDUAL: 'Individual', OTHER: 'Other',
};

/* ==========================================================================
   Threshold rules (NBE directive)
   getRule      -> { pct, basis } or null when the type has no % threshold
   getThreshold -> number or null
   ========================================================================== */
export function getRule(entityType, sector) {
  switch (entityType) {
    case 'SHARE_COMPANY':
      return HIGH_RISK_SECTORS.has(sector)
        ? { pct: 5, basis: 'Share company, high-risk sector' }
        : { pct: 10, basis: 'Share company' };
    case 'PRIVATE_LIMITED_COMPANY': return { pct: 5, basis: 'Private limited company' };
    case 'FINANCIAL_INSTITUTION': return { pct: 2, basis: 'Financial institution' };
    case 'GENERAL_PARTNERSHIP':
    case 'LIMITED_PARTNERSHIP':
    case 'LIMITED_LIABILITY_PARTNERSHIP':
    case 'PPP': return { pct: 25, basis: ENTITY_LABELS[entityType] };
    default: return null;
  }
}
export const getThreshold = (entityType, sector) => getRule(entityType, sector)?.pct ?? null;

/* ==========================================================================
   Ownership helpers
   ========================================================================== */
/** "Entity → Holding Co → Person" -> ['Entity', 'Holding Co', 'Person'] */
export const splitChain = (chain) =>
  String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);

export const isDirectHolder = (h) => (h.paths || []).every((p) => splitChain(p.chain).length === 2);
export const isControlOnly = (h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl);
export const isVerified = (h) => h.status === 'VERIFIED' || h.status === 'APPROVED' || !!h.registered;
export const isForeignEntity = (entityType) => entityType === 'FOREIGN_LEGAL_PERSON';
export const effectivePct = (h) => Number(h.effectivePercentage || 0);
export const uboHolders = (tree) => (tree?.holders || []).filter((h) => h.ubo);

/** Chain contains a repeated name, e.g. A → B → C → B */
export const hasCycle = (chain) => {
  const parts = splitChain(chain);
  return new Set(parts).size !== parts.length;
};

/** Builds a trie of intermediates from holder paths; holders attach to their immediate parent.
    Returns { name: null, children: Map, holders: [] } — use it to render the ownership tree. */
export function buildOwnershipTrie(holders) {
  const root = { name: null, children: new Map(), holders: [] };
  holders.forEach((h) => (h.paths || []).forEach((p) => {
    const parts = splitChain(p.chain);
    let node = root;
    for (let i = 1; i < parts.length - 1; i++) {
      if (!node.children.has(parts[i])) node.children.set(parts[i], { name: parts[i], children: new Map(), holders: [] });
      node = node.children.get(parts[i]);
    }
    if (!node.holders.includes(h)) node.holders.push(h);
  }));
  return root;
}

/* ==========================================================================
   Formatting
   ========================================================================== */
export const label = (map, key) => map[key] || key || '—';
export const pretty = (s) => String(s || 'Other').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};

export const formatGender = (g) => {
  if (!g) return '—';
  const s = String(g).toUpperCase();
  if (s === 'M' || s === 'MALE') return 'Male';
  if (s === 'F' || s === 'FEMALE') return 'Female';
  return g;
};

/* ==========================================================================
   Export engine
   exportData(format, name, header, rows, { meta, logger })
     format: 'csv' | 'xlsx' | 'doc' | 'pdf'
     logger: optional async fn, e.g. api.logExport — called after every export
   ========================================================================== */
/** Neutralises spreadsheet formula injection (=, +, -, @) */
export const csvSafe = (v) => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function saveBlob(content, filename, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export async function exportData(format, name, header, rows, { meta = '', logger } = {}) {
  const file = `${name}-${today()}`;

  if (format === 'csv') {
    const body = [header, ...rows]
      .map((r) => r.map((v) => `"${csvSafe(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    saveBlob('\uFEFF' + body, `${file}.csv`, 'text/csv;charset=utf-8');
  } else if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => r.map(csvSafe))]);
    ws['!cols'] = header.map((h, i) => ({
      wch: Math.min(48, Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)) + 2),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    XLSX.writeFile(wb, `${file}.xlsx`);
  } else if (format === 'doc') {
    const html = `<html><head><meta charset="utf-8"/><title>${escapeHtml(name)}</title><style>
      body{font-family:Arial,sans-serif;font-size:10pt} table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #333;padding:4px 6px;text-align:left} th{background:#283375;color:#fff}</style></head><body>
      <h1>${escapeHtml(name)}</h1><p>Generated ${escapeHtml(new Date().toLocaleString())}${meta ? ` · ${escapeHtml(meta)}` : ''}</p>
      <table><thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </body></html>`;
    saveBlob(html, `${file}.doc`, 'application/msword;charset=utf-8');
  } else if (format === 'pdf') {
    window.print(); // print CSS hides chrome; .rep-printable stays visible
  }

  try { await logger?.({ format: format.toUpperCase(), report: name, rows: rows.length }); } catch { /* best-effort */ }
}
