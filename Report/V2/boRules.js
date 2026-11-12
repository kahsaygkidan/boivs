/* ==========================================================================
   Beneficial-ownership rules — Regulation No. 592/2026
   (Transparency of Legal Persons' Beneficial Ownership Information)

   Single source of truth shared by NewLegalRegistration.jsx and Reports.jsx so
   the threshold a user sees at registration is exactly the threshold the
   reports apply. The backend still decides h.ubo; mismatches are flagged.
   ========================================================================== */
import { HIGH_RISK_SECTORS } from './uboForm.js';

export const OVER_100_EPSILON = 0.0001;

// The table prints "25%" (no ≥) for partnership-type rows. Treated as inclusive
// (>=) like the other rows — confirm against the regulation text.
export const BO_RULES = {
  SHARE_COMPANY: {
    title: 'Share company',
    pct: 10, heightenedPct: 5,
    body: 'A person is a beneficial owner with ≥ 10% direct or indirect ownership (individually or jointly), holds preferential shares, holds ≥ 10% convertible equity debt, or exercises control through other means.',
    note: 'The threshold drops to 5% for mining, real estate development, motor vehicle dealership, import/export and other Directive-specified sectors.',
  },
  PRIVATE_LIMITED_COMPANY: {
    title: 'Private limited company',
    pct: 5,
    body: 'A person is a beneficial owner with ≥ 5% direct or indirect ownership (individually or jointly), or exercises control through other means.',
  },
  ONE_MEMBER_PLC: {
    title: 'One member PLC',
    pct: null, badge: 'OWNER + GM',
    body: 'No percentage test. The sole owner and the applicable general manager (or other controlling person) must both be registered as beneficial owners.',
  },
  GENERAL_PARTNERSHIP: {
    title: 'General partnership',
    pct: 25,
    body: 'A person is a beneficial owner with 25% of profit entitlement, assets on dissolution, voting rights or qualifying third-party beneficial interests, or through control provisions.',
    note: 'Assess profit, dissolution assets and voting rights separately — meeting any one is enough.',
  },
  LIMITED_PARTNERSHIP: {
    title: 'Limited partnership (general & limited partners)',
    pct: 25,
    body: 'A person is a beneficial owner with 25% of profit distribution, assets on dissolution or voting rights, or through control rights.',
    note: 'Applies to both general and limited partners. Assess each criterion separately.',
  },
  LLP: {
    title: 'Limited liability partnership',
    pct: 25,
    body: 'A person is a beneficial owner with a 25% profit or asset interest, or through control by other means.',
  },
  PPP: {
    title: 'Public private partnership',
    pct: 25,
    body: 'A person is a beneficial owner meeting the 25% share/asset criterion.',
  },
  FINANCIAL_INSTITUTION: {
    title: 'Financial institution',
    pct: 2,
    body: 'A person is a beneficial owner with ≥ 2% direct or indirect ownership (individually or jointly), ≥ 2% convertible equity debt, or through control provisions.',
  },
  FOREIGN_LEGAL_PERSON: {
    title: 'Foreign-established legal person',
    pct: null, badge: 'SPECIAL',
    body: 'No threshold in the table. Capture the country of registration and support the beneficial-ownership information with home-jurisdiction documentation, attestation or authentication.',
  },
};

// Tolerant of whatever enum values ENTITY_TYPES uses (order matters).
export function normalizeEntityKey(entityType) {
  const v = String(entityType || '').toUpperCase().replace(/[^A-Z]+/g, '_');
  if (/ONE_MEMBER|SINGLE_MEMBER/.test(v)) return 'ONE_MEMBER_PLC';
  if (/FOREIGN/.test(v)) return 'FOREIGN_LEGAL_PERSON';
  if (/FINANCIAL/.test(v)) return 'FINANCIAL_INSTITUTION';
  if (/PUBLIC_PRIVATE|^PPP$/.test(v)) return 'PPP';
  if (/LIMITED_LIABILITY_PARTNERSHIP|^LLP$/.test(v)) return 'LLP';
  if (/GENERAL_PARTNERSHIP/.test(v)) return 'GENERAL_PARTNERSHIP';
  if (/LIMITED_PARTNERSHIP/.test(v)) return 'LIMITED_PARTNERSHIP';
  if (/SHARE/.test(v)) return 'SHARE_COMPANY';
  if (/PRIVATE_LIMITED|^PLC$|^PRIVATE/.test(v)) return 'PRIVATE_LIMITED_COMPANY';
  return null;
}

/* Returns { key, title, pct, body, note, badge, tone, heightened } or null */
export function resolveBoRule(entityType, sector, sectorLabel = '') {
  const key = normalizeEntityKey(entityType);
  const base = key && BO_RULES[key];
  if (!base) return null;
  const heightened = key === 'SHARE_COMPANY' && HIGH_RISK_SECTORS.has(sector);
  return {
    key, ...base,
    pct: heightened ? base.heightenedPct : base.pct,
    heightened,
    tone: heightened || base.pct == null ? 'warn' : 'info',
  };
}
// Only ownership-only rules can be judged from the effective % alone. Partnerships/LLP/PPP test profit,
// dissolution and voting separately, and joint / convertible-debt / preferential cases are decided by the server.
export const OWNERSHIP_ONLY_RULES = ['SHARE_COMPANY', 'PRIVATE_LIMITED_COMPANY', 'FINANCIAL_INSTITUTION'];
export const meetsOwnershipThreshold = (rule, effective) =>
  rule?.pct != null && OWNERSHIP_ONLY_RULES.includes(rule.key) && (Number(effective) || 0) >= rule.pct - OVER_100_EPSILON;

/* Does the effective percentage reach the rule's numeric threshold? (any rule with a %) */
export const meetsPct = (rule, effective) =>
  rule?.pct != null && (Number(effective) || 0) >= rule.pct - OVER_100_EPSILON;
