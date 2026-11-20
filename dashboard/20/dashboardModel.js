import { HIGH_RISK_SECTORS, HIGH_RISK_SECTOR_LABELS } from './uboForm.js';

export const splitChain = (chain) =>
  String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);

export const isDirectHolder = (holder) => {
  const paths = holder.paths || [];
  if (paths.length === 0) return true;
  return paths.every((p) => splitChain(p.chain).length === 2);
};

export const RISK_BANDS = [
  { key: 'LOW',    label: 'Low',    min: 0,  max: 29,  tone: 'success' },
  { key: 'MEDIUM', label: 'Medium', min: 30, max: 59,  tone: 'warn' },
  { key: 'HIGH',   label: 'High',   min: 60, max: 100, tone: 'danger' },
];

export const bandFor = (score) =>
  RISK_BANDS.find((b) => score >= b.min && score <= b.max) || RISK_BANDS[0];

export function computeRisk(lp, tree) {
  const reasons = [];
  let score = 0;

  const sector = lp?.sector || tree?.sector;
  if (HIGH_RISK_SECTORS.has(sector)) {
    score += 40;
    reasons.push(`High-risk sector — ${HIGH_RISK_SECTOR_LABELS[sector] || sector}`);
  }

  if (lp?.entityType === 'FOREIGN_LEGAL_PERSON') {
    score += 10;
    reasons.push('Foreign legal person');
  }

  const holders = tree?.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const fallback = tree?.seniorManagingOfficial || null;

  if (ubos.length === 0) {
    score += fallback ? 20 : 15;
    reasons.push(fallback ? 'Fallback only — no natural-person UBO' : 'No UBO recorded');
  }

  if (ubos.some((h) => h.pep)) {
    score += 10;
    reasons.push('UBO is a PEP — enhanced due diligence');
  }

  // Sanctions hit is an override, not just another +10: it must never rate "Low".
  const sanctionsHit = ubos.some(
    (h) => h.sanctionsScreened && h.sanctionsResult && h.sanctionsResult !== 'CLEAR',
  );
  if (sanctionsHit) {
    score += 10;
    reasons.push('Sanctions screening match');
  }

  if (ubos.some((h) => ['PENDING', 'FAILED', 'EXPIRED'].includes(String(h.status || '').toUpperCase()))) {
    score += 10;
    reasons.push('UBO verification incomplete');
  }

  // Gap is measured across ALL holders, not only UBOs: UBOs are by definition the
  // holders above the threshold, so summing only them flagged almost every entity.
  if (ubos.length > 0 && !fallback) {
    const traced = holders.reduce((s, h) => s + (Number(h.effectivePercentage) || 0), 0);
    if (traced < 99.99) {
      score += 10;
      reasons.push(`Ownership gap — ${traced.toFixed(2)}% traced`);
    }
  }

  if (sanctionsHit) score = Math.max(score, 60);

  score = Math.max(0, Math.min(100, score));
  return { score, band: bandFor(score), reasons, ubos, fallback };
}

/* Risk is recomputed only when the tree object (or entity) actually changes. */
const riskCache = new WeakMap();
export function computeRiskCached(lp, tree) {
  if (!tree) return null;
  const hit = riskCache.get(tree);
  if (hit && hit.lp === lp) return hit.risk;
  const risk = computeRisk(lp, tree);
  riskCache.set(tree, { lp, risk });
  return risk;
}
