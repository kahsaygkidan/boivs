/* ==========================================================================
   reportBuilders.js — pure functions for building report rows/HTML
   No React, no side effects — safe to call from anywhere.
   ========================================================================== */

import { controlBasisLabel } from './records.js';
import { LEGAL_DOC_TYPES } from './uboForm.js';

const DOC_TYPE_LABEL = Object.fromEntries(LEGAL_DOC_TYPES.map((d) => [d.docType, d.label]));

export const fmtWhen = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(iso); }
};

export const fmtSize = (bytes) => {
  const b = Number(bytes) || 0;
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

export const humanize = (v) => {
  if (!v) return '';
  return String(v).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/* ---------- Legal entity report section ---------- */
export function buildEntitySection(entity, owners = []) {
  const entityFields = [
    ['Legal entity', entity.name],
    ['Registration number', entity.registrationNumber],
    ['Entity type', humanize(entity.entityType)],
    ['TIN', entity.tin],
    ['CIF number', entity.cifNumber],
    ['Country of incorporation', entity.countryOfIncorporation],
    ['Sector', entity.sector],
    ['Directors and senior management', entity.directorsAndManagement],
  ].filter(([, v]) => v != null && v !== '');

  const ownerRows = owners.map((o) => [
    o.fullName || '—',
    humanize(o.status) || '—',
    o.ownershipPercentage != null ? `${o.ownershipPercentage}%` : '—',
    humanize(o.ownershipType) || '—',
    o.pep ? 'Yes' : 'No',
    o.sanctionsScreened ? 'Yes' : 'No',
    o.idExpired ? 'Yes' : 'No',
    o.boReference || '—',
  ]);

  return { entityFields, ownerRows };
}

/* ---------- Record-level report section (for a single BO) ---------- */
export function buildRecordSection(record) {
  return [
    ['Full name', record.fullName],
    ['BO reference', record.boReference],
    ['Status', humanize(record.status)],
    ['Legal entity', record.legalPersonName],
    ['Registration number', record.legalPersonRegistrationNumber],
    ['Capacity', humanize(record.capacity)],
    ['Ownership percentage', record.ownershipPercentage == null ? null : `${record.ownershipPercentage}%`],
    ['Ownership type', humanize(record.ownershipType)],
    ['Control basis', (record.controlBasis || []).map((x) => controlBasisLabel[x] || humanize(x)).join(', ')],
    ['Ownership chain', record.ownershipChain],
    ['Date became BO', record.dateBecameBo ? fmtWhen(record.dateBecameBo) : null],
    ['Date ceased', record.dateCeased ? fmtWhen(record.dateCeased) : null],
    ['ID document type', humanize(record.idDocumentType)],
    ['ID expiry date', record.dateOfExpiry ? fmtWhen(record.dateOfExpiry) : null],
    ['ID expired', record.idExpired ? 'Yes' : 'No'],
    ['PEP', record.pep ? 'Yes' : 'No'],
    ['Sanctions screened', record.sanctionsScreened ? 'Yes' : 'No'],
    ['Phone number', record.phoneNumber || record.phone],
    ['Email', record.email || record.emailAddress],
    ['Created by', record.createdBy],
    ['Created at', record.createdAt ? fmtWhen(record.createdAt) : null],
    ['Approved by', record.approvedBy],
    ['Approved at', record.approvedAt ? fmtWhen(record.approvedAt) : null],
    ['Rejected by', record.rejectedBy],
    ['Rejected at', record.rejectedAt ? fmtWhen(record.rejectedAt) : null],
    ['Rejection reason', record.rejectionReason || record.rejectReason],
  ].filter(([, v]) => v != null && v !== '');
}

/* ---------- HTML: single-entity report ---------- */
export function buildEntityReportHtml(entity, owners, generatedAt = new Date()) {
  const { entityFields, ownerRows } = buildEntitySection(entity, owners);

  const entityTable = `
    <table class="rp-print-table">
      <thead><tr><th style="width:36%">Field</th><th>Value</th></tr></thead>
      <tbody>${entityFields.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</tbody>
    </table>`;

  const ownerTable = ownerRows.length
    ? `<table class="rp-print-table">
        <thead><tr>
          <th>Beneficial owner</th><th>Status</th><th>Ownership %</th><th>Type</th>
          <th>PEP</th><th>Sanctions</th><th>ID expired</th><th>Reference</th>
        </tr></thead>
        <tbody>${ownerRows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`
    : `<p style="color:#64748b;font-style:italic;">No beneficial owners on record.</p>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(entity.name)} — BO Report</title></head>
    <body>
      <div class="rp-print-root">
        <div class="rp-print-cover">
          <h1>Beneficial Ownership Report</h1>
          <p><strong>${escapeHtml(entity.name)}</strong></p>
          <p>${escapeHtml(entity.registrationNumber || '—')} · ${escapeHtml(entity.countryOfIncorporation || '—')}</p>
          <div class="rp-print-meta">Generated ${escapeHtml(generatedAt.toLocaleString())} · Confidential</div>
        </div>

        <div class="rp-print-entity">
          <h2>Legal entity</h2>
          ${entityTable}
        </div>

        <div class="rp-print-entity">
          <h2>Beneficial owners (${ownerRows.length})</h2>
          ${ownerTable}
        </div>

        <div class="rp-print-footer">
          Dashen Bank · Beneficial Owner Identification &amp; Verification System · Regulation 592/2026
        </div>
      </div>
    </body></html>`;
}

/* ---------- HTML: multi-entity filtered report ---------- */
export function buildMultiEntityReportHtml(entitiesWithOwners, filtersSummary = '', generatedAt = new Date()) {
  const blocks = entitiesWithOwners.map(({ entity, owners }) => {
    const { entityFields, ownerRows } = buildEntitySection(entity, owners);

    const entityTable = `
      <table class="rp-print-table">
        <thead><tr><th style="width:36%">Field</th><th>Value</th></tr></thead>
        <tbody>${entityFields.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</tbody>
      </table>`;

    const ownerTable = ownerRows.length
      ? `<table class="rp-print-table">
          <thead><tr>
            <th>Beneficial owner</th><th>Status</th><th>Ownership %</th><th>Type</th>
            <th>PEP</th><th>Sanctions</th><th>ID expired</th><th>Reference</th>
          </tr></thead>
          <tbody>${ownerRows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`
      : `<p style="color:#64748b;font-style:italic;">No beneficial owners match the filters.</p>`;

    return `
      <div class="rp-print-entity">
        <h2>${escapeHtml(entity.name)}</h2>
        ${entityTable}
        <h3>Beneficial owners (${ownerRows.length})</h3>
        ${ownerTable}
      </div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Beneficial Ownership Report</title></head>
    <body>
      <div class="rp-print-root">
        <div class="rp-print-cover">
          <h1>Beneficial Ownership Report</h1>
          <p>${escapeHtml(entitiesWithOwners.length)} legal entit${entitiesWithOwners.length === 1 ? 'y' : 'ies'}</p>
          ${filtersSummary ? `<p>${escapeHtml(filtersSummary)}</p>` : ''}
          <div class="rp-print-meta">Generated ${escapeHtml(generatedAt.toLocaleString())} · Confidential</div>
        </div>
        ${blocks}
        <div class="rp-print-footer">
          Dashen Bank · Beneficial Owner Identification &amp; Verification System · Regulation 592/2026
        </div>
      </div>
    </body></html>`;
}

/* ---------- Print helper ---------- */
export function printHtml(html) {
  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.addEventListener('load', () => setTimeout(() => win.print(), 250));
  return true;
}