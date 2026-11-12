import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveBoRecord, ceaseBoRecord, deleteDocument, downloadDocument,
  fetchDocumentBlobUrl, getBoRecord, listAuditLogs, listDocuments, removeBoRecord,
  rejectBoRecord, submitBoRecord, updateBoRecord, uploadDocument,
  listLegalPersonDocuments, downloadLegalPersonDocument, fetchLegalPersonDocumentBlobUrl,
  getOwnershipTree,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import BoEditForm from '../components/BoEditForm.jsx';
import UboInfoTable from '../components/UboInfoTable.jsx';
import { controlBasisLabel } from '../utils/records.js';
import { LEGAL_DOC_TYPES } from '../utils/uboForm.js';
import {
  T, Btn, Card, Banner, Avatar, Pill, Tabs, Bar, Skeleton, GlobalStyle, I, fmtWhen, humanize,
} from '../components/ui.jsx';

/* Backend LegalDocType -> readable label (MOA, AOA, ...) */
const DOC_TYPE_LABEL = Object.fromEntries(LEGAL_DOC_TYPES.map((d) => [d.docType, d.label]));

/* Files the preview modal can show inline */
const isViewable = (contentType) => {
  const ct = (contentType || '').toLowerCase();
  return ct.startsWith('image/') || ct === 'application/pdf';
};

const fmtSize = (bytes) => {
  const b = Number(bytes) || 0;
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

/* ==========================================================================
   Review timeline — created -> (approved | rejected | awaiting review) -> ceased
   ========================================================================== */
function buildTimeline(r) {
  const steps = [{ key: 'created', tone: 'neutral', title: 'Record created', by: r.createdBy, at: r.createdAt }];
  const approved = { key: 'approved', tone: 'success', title: 'Approved', by: r.approvedBy, at: r.approvedAt };

  switch (r.status) {
    case 'DRAFT':
      steps.push({ key: 'draft', tone: 'pending', title: 'Draft', note: 'Not yet submitted for verification.' });
      break;
    case 'PENDING':
      steps.push({ key: 'pending', tone: 'warn', title: 'Awaiting checker review', note: 'Submitted and waiting for a decision.', live: true });
      break;
    case 'VERIFIED':
      steps.push(approved);
      break;
    case 'REJECTED':
      steps.push({
        key: 'rejected', tone: 'danger', title: 'Rejected', by: r.rejectedBy, at: r.rejectedAt,
        quote: r.rejectionReason || r.rejectReason || r.rejectionNote || null,
      });
      break;
    case 'CEASED':
      if (r.approvedBy || r.approvedAt) steps.push(approved);
      steps.push({ key: 'ceased', tone: 'neutral', title: 'Marked as ceased', by: r.decidedBy, at: r.decidedAt });
      break;
    case 'WITHDRAWN':
      steps.push({ key: 'withdrawn', tone: 'neutral', title: 'Removed from the list', by: r.decidedBy || r.updatedBy, at: r.decidedAt || r.updatedAt });
      break;
    default:
      break;
  }
  return steps;
}

function Timeline({ steps }) {
  const colors = {
    success: { dot: T.success, ring: T.successBg },
    danger: { dot: T.danger, ring: T.dangerBg },
    warn: { dot: T.warn, ring: T.warnBg },
    neutral: { dot: T.textFaint, ring: '#f1f5f9' },
    pending: { dot: T.borderStrong, ring: '#f1f5f9' },
  };
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {steps.map((s, i) => {
        const c = colors[s.tone] || colors.neutral;
        const last = i === steps.length - 1;
        return (
          <li key={s.key} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: last ? 0 : 18 }}>
            {!last && <span aria-hidden="true" style={{ position: 'absolute', left: 8, top: 18, bottom: 0, width: 2, background: T.border }} />}
            <span aria-hidden="true" style={{
              width: 18, height: 18, borderRadius: '50%', background: c.ring, flexShrink: 0, marginTop: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              animation: s.live ? 'ui-pulse 1.8s infinite' : 'none',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot }} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: s.tone === 'pending' ? T.textMuted : T.text }}>{s.title}</div>
              {(s.by || s.at) && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1, lineHeight: 1.5 }}>
                  {s.by ? <>by <strong style={{ color: T.textSoft, fontWeight: 600 }}>{s.by}</strong></> : null}
                  {s.by && s.at ? ' · ' : ''}
                  {s.at ? fmtWhen(s.at) : ''}
                </div>
              )}
              {s.note && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{s.note}</div>}
              {s.quote && String(s.quote).trim() && (
                <div style={{
                  marginTop: 8, padding: '9px 12px', borderLeft: `3px solid ${T.danger}`, background: T.dangerBg,
                  borderRadius: 6, fontSize: 12.5, lineHeight: 1.55, color: T.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500,
                }}>
                  {String(s.quote).trim()}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ==========================================================================
   Reject panel
   ========================================================================== */
function RejectPanel({ reason, onChange, onConfirm, onCancel, busy }) {
  const [focused, setFocused] = useState(false);
  const canConfirm = reason.trim().length > 0 && !busy;
  return (
    <div style={{
      marginTop: 10, padding: 14, background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
      borderRadius: T.radiusMd, animation: 'ui-slide .18s ease',
    }}>
      <label htmlFor="reject-reason" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.danger }}>
        <span style={{ display: 'inline-flex' }}>{I.reject}</span> Rejection reason
      </label>
      <textarea
        id="reject-reason"
        placeholder="Explain why this record is being rejected. The maker will see this."
        value={reason}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={4}
        style={{
          width: '100%', padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5, color: T.text,
          background: '#fff', border: `1px solid ${focused ? T.danger : T.dangerBorder}`, borderRadius: T.radiusSm,
          outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 6,
          boxShadow: focused ? `0 0 0 3px ${T.dangerBg}` : 'none', transition: 'border-color .15s ease',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="ghost" size="sm" disabled={busy} onClick={onCancel} style={{ flex: 1 }}>Cancel</Btn>
        <Btn variant="danger" size="sm" disabled={!canConfirm} onClick={onConfirm} style={{ flex: 1 }}>
          {busy ? 'Rejecting…' : 'Confirm reject'}
        </Btn>
      </div>
    </div>
  );
}

/* ==========================================================================
   Document list — shared by the BO documents and the legal entity documents
   ========================================================================== */
function DocumentList({ docs, emptyTitle, emptyHint, onView, onDownload, onDelete, canDelete, busy, previewLoading, showType }) {
  if (docs.length === 0) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13, background: T.surfaceAlt, border: `1px dashed ${T.borderStrong}`, borderRadius: T.radiusMd }}>
        <span style={{ display: 'inline-flex', color: T.textFaint, marginBottom: 6 }}>{I.file}</span>
        <div style={{ fontWeight: 650, color: T.text, marginBottom: 2 }}>{emptyTitle}</div>
        <div>{emptyHint}</div>
      </div>
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {docs.map((d) => {
        const ext = (d.fileName || '').split('.').pop().slice(0, 4).toUpperCase();
        return (
          <li key={d.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', flexWrap: 'wrap',
            border: `1px solid ${T.border}`, borderRadius: T.radiusMd, background: '#fff',
          }}>
            <span aria-hidden="true" style={{
              width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: T.primarySoft, color: T.primary,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em',
            }}>{ext || 'FILE'}</span>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.fileName}>
                {d.fileName}
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                {showType && d.docType ? `${DOC_TYPE_LABEL[d.docType] || humanize(d.docType)} · ` : ''}
                {fmtSize(d.sizeBytes)}
                {showType && d.uploadedAt ? ` · uploaded ${fmtWhen(d.uploadedAt)}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {isViewable(d.contentType) && (
                <Btn variant="secondary" size="sm" icon={I.eye} disabled={previewLoading} onClick={() => onView(d)}>View</Btn>
              )}
              <Btn variant="secondary" size="sm" icon={I.download} onClick={() => onDownload(d)}>Download</Btn>
              {canDelete && (
                <Btn variant="dangerOutline" size="sm" icon={I.trash} disabled={busy} onClick={() => onDelete(d)} aria-label={`Delete ${d.fileName}`}>Delete</Btn>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ==========================================================================
   Small layout helpers
   ========================================================================== */
function Fact({ label, children }) {
  return (
    <div className="rd-tile" style={{ minWidth: 0, padding: '14px 16px', background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radiusMd }}>
      <div style={{ fontSize: 11, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 14, color: T.text }}>{children}</div>
    </div>
  );
}

function OwnershipChain({ chain }) {
  const parts = String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
            background: i === parts.length - 1 ? T.primarySoft : '#f1f5f9',
            color: i === parts.length - 1 ? T.primary : T.textSoft,
            border: `1px solid ${i === parts.length - 1 ? T.primaryRing : T.border}`,
          }}>{p}</span>
          {i < parts.length - 1 && <span style={{ color: T.textFaint }} aria-hidden="true">→</span>}
        </span>
      ))}
    </div>
  );
}


/* ==========================================================================
   Record report exports — generated from the currently loaded record.
   PDF uses the browser print dialog; Word/Excel use portable Office-readable
   HTML formats so no additional client package is required.
   ========================================================================== */
const reportText = (value) => {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map((v) => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${humanize(k)}: ${reportText(v)}`).join('; ');
  return String(value);
};
const reportEscape = (value) => reportText(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const buildRecordReportSections = (record, documents = [], legalDocuments = [], auditLogs = []) => {
  const fields = [
    ['Full name', record.fullName], ['BO reference', record.boReference], ['Status', humanize(record.status)],
    ['Legal entity', record.legalPersonName], ['Registration number', record.legalPersonRegistrationNumber],
    ['Legal entity ID', record.legalPersonId], ['Capacity', humanize(record.capacity)],
    ['Ownership percentage', record.ownershipPercentage == null ? null : `${record.ownershipPercentage}%`],
    ['Ownership type', humanize(record.ownershipType)], ['Control basis', (record.controlBasis || []).map((x) => controlBasisLabel[x] || humanize(x)).join(', ')],
    ['Ownership chain', record.ownershipChain], ['Date became beneficial owner', record.dateBecameBo ? fmtWhen(record.dateBecameBo) : null],
    ['Date ceased', record.dateCeased ? fmtWhen(record.dateCeased) : null],
    ['ID document type', humanize(record.idDocumentType)], ['ID expiry date', record.dateOfExpiry ? fmtWhen(record.dateOfExpiry) : null],
    ['ID expired', record.idExpired ? 'Yes' : 'No'], ['PEP', record.pep ? 'Yes' : 'No'],
    ['Sanctions screened', record.sanctionsScreened ? 'Yes' : 'No'],
    ['Phone number', record.phoneNumber || record.phone || record.mobileNumber || record.mobile],
    ['Email', record.email || record.emailAddress],
    ['Created by', record.createdBy], ['Created at', record.createdAt ? fmtWhen(record.createdAt) : null],
    ['Updated by', record.updatedBy], ['Updated at', record.updatedAt ? fmtWhen(record.updatedAt) : null],
    ['Approved by', record.approvedBy], ['Approved at', record.approvedAt ? fmtWhen(record.approvedAt) : null],
    ['Rejected by', record.rejectedBy], ['Rejected at', record.rejectedAt ? fmtWhen(record.rejectedAt) : null],
    ['Rejection reason', record.rejectionReason || record.rejectReason || record.rejectionNote],
    ['Decision by', record.decidedBy], ['Decision at', record.decidedAt ? fmtWhen(record.decidedAt) : null],
  ].filter(([, value]) => value != null && value !== '');
  const docs = [
    ...documents.map((d) => ['Beneficial owner', d.fileName, d.contentType, fmtSize(d.sizeBytes), d.uploadedAt ? fmtWhen(d.uploadedAt) : '—']),
    ...legalDocuments.map((d) => ['Legal entity', d.fileName, d.contentType, fmtSize(d.sizeBytes), d.uploadedAt ? fmtWhen(d.uploadedAt) : '—']),
  ];
  const audit = auditLogs.map((l) => [humanize(l.action), l.actorUsername || '—', l.createdAt ? fmtWhen(l.createdAt) : '—']);
  const timeline = buildTimeline(record).map((x) => [x.title, x.by || '—', x.at ? fmtWhen(x.at) : '—', x.note || x.quote || '']);
  return [
    { title: 'Record details', headers: ['Field', 'Value'], rows: fields },
    { title: 'Review timeline', headers: ['Event', 'Performed by', 'Date and time', 'Notes'], rows: timeline },
    { title: 'Documents', headers: ['Category', 'File name', 'Content type', 'File size', 'Uploaded'], rows: docs },
    ...(auditLogs.length ? [{ title: 'Audit trail', headers: ['Action', 'User', 'Date and time'], rows: audit }] : []),
  ];
};
const buildReportHtml = (record, sections, mode = 'document') => {
  const title = `Beneficial Owner Record — ${record.fullName || record.boReference || 'Record'}`;
  const tables = sections.map((section) => `
    <section class="report-section">
      <h2>${reportEscape(section.title)}</h2>
      <table><thead><tr>${section.headers.map((h) => `<th>${reportEscape(h)}</th>`).join('')}</tr></thead>
      <tbody>${section.rows.length ? section.rows.map((row) => `<tr>${row.map((cell) => `<td>${reportEscape(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${section.headers.length}">No entries recorded</td></tr>`}</tbody></table>
    </section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${reportEscape(title)}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172554;margin:32px;font-size:11pt}
      .cover{padding:22px 24px;background:#14216b;color:#fff;border-radius:10px;margin-bottom:24px}
      .cover h1{font-size:22pt;margin:0 0 8px}.cover p{margin:4px 0;color:#e5eaff}
      .meta{font-size:9pt;color:#64748b;margin-top:12px}.report-section{margin:22px 0;page-break-inside:avoid}
      h2{font-size:14pt;color:#14216b;border-bottom:2px solid #dbe4ff;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:10px;table-layout:fixed}
      th{background:#eef2ff;color:#172554;text-align:left;font-weight:700}
      th,td{border:1px solid #dbe2ef;padding:8px;vertical-align:top;overflow-wrap:anywhere}
      tr:nth-child(even) td{background:#f8faff}.footer{border-top:1px solid #dbe2ef;padding-top:10px;margin-top:28px;color:#64748b;font-size:9pt}
      @media print{body{margin:14mm}.cover{print-color-adjust:exact;-webkit-print-color-adjust:exact}th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body>
    <header class="cover"><h1>Beneficial Owner Record Report</h1>
      <p><strong>${reportEscape(record.fullName)}</strong> · ${reportEscape(record.boReference)}</p>
      <p>${reportEscape(record.legalPersonName)} · Status: ${reportEscape(humanize(record.status))}</p>
      <div class="meta">Generated ${reportEscape(new Date().toLocaleString())} · Confidential — for authorised use</div>
    </header>${tables}<div class="footer">Dashen Bank · Beneficial Owner Identification &amp; Verification System</div>
    </body></html>`;
};
const downloadReportFile = (content, filename, mimeType) => {
  const blob = new Blob(['\ufeff', content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/* ==========================================================================
   Ownership tree card — read-only view of the legal entity's structure + UBO counter
   ========================================================================== */
const splitChain = (c) => String(c || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
const holderIsDirect = (h) => {
  const p = h.paths || [];
  return p.length === 0 || p.every((x) => splitChain(x.chain).length === 2);
};
const holderHasControl = (h) => Boolean(h.qualifiesByControl) || (h.controlBasis || []).length > 0;

/* entity -> intermediates -> people, merged from every holder's ownership paths */
function buildOwnershipTrie(tree, entityName) {
  const people = (tree?.holders || []).filter((h) => h.ubo || holderHasControl(h));
  const root = { key: 'root', kind: 'entity', label: entityName || 'Legal entity', children: new Map() };
  people.forEach((h) => {
    const paths = (h.paths || []).length ? h.paths : [{ chain: `${root.label} → ${h.fullName}` }];
    paths.forEach((p) => {
      const parts = splitChain(p.chain);
      let node = root;
      for (let i = 1; i < parts.length - 1; i += 1) {
        const k = `${node.key}/${parts[i]}`;
        if (!node.children.has(k)) node.children.set(k, { key: k, kind: 'intermediate', label: parts[i], children: new Map() });
        node = node.children.get(k);
      }
      const k = `${node.key}/#${h.key ?? h.fullName}`;
      if (!node.children.has(k)) node.children.set(k, { key: k, kind: 'person', label: h.fullName, holder: h, children: new Map() });
    });
  });
  return root;
}

function TreeBranch({ node, record, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const kids = [...node.children.values()];
  const h = node.holder;
  const isMe = Boolean(h) && (
    (h.boReference && h.boReference === record.boReference)
    || (h.idNumber && record.idNumber && h.idNumber === record.idNumber)
    || h.fullName === record.fullName
  );
  const pctText = h && (h.effectivePercentage ?? h.ownershipPercentage) != null
    ? `${h.effectivePercentage ?? h.ownershipPercentage}% ${holderIsDirect(h) ? 'direct' : 'indirect'}`
    : null;
  const tone = node.kind === 'entity'
    ? { bg: T.primarySoft, border: T.primaryRing, color: T.primary }
    : node.kind === 'intermediate'
      ? { bg: '#f1f5f9', border: T.border, color: T.textSoft }
      : { bg: isMe ? T.primarySoft : '#fff', border: isMe ? T.primary : T.border, color: T.text };
  return (
    <li style={{ position: 'relative', marginTop: depth === 0 ? 0 : 8 }}>
      {depth > 0 && <span aria-hidden="true" style={{ position: 'absolute', left: -18, top: 22, width: 16, height: 2, background: T.border }} />}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: '100%', padding: '8px 12px',
        background: tone.bg, border: `1.5px solid ${tone.border}`, borderRadius: T.radiusMd,
        boxShadow: isMe ? `0 0 0 3px ${T.primaryRing}` : 'none',
      }}>
        {node.kind === 'person'
          ? <Avatar name={node.label} size={30} />
          : <span style={{ display: 'inline-flex', color: tone.color }}>{I.building}</span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 650, color: node.kind === 'person' ? T.text : tone.color }}>{node.label}</span>
            {isMe && <Pill tone="primary">This record</Pill>}
            {h?.pep && <Pill tone="warn">PEP</Pill>}
          </div>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>
            {node.kind === 'entity' && 'Legal entity'}
            {node.kind === 'intermediate' && 'Intermediate entity'}
            {node.kind === 'person' && [h.ubo ? 'Beneficial owner' : 'Control only', pctText].filter(Boolean).join(' · ')}
          </div>
        </div>
        {kids.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
            style={{
              border: `1px solid ${T.border}`, background: '#fff', borderRadius: 6, height: 24, padding: '0 8px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, color: T.textMuted,
            }}
          >{open ? 'Hide' : 'Show'}</button>
        )}
      </div>
      {kids.length > 0 && open && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0 16px', padding: '0 0 0 18px', borderLeft: `2px solid ${T.border}` }}>
          {kids.map((c) => <TreeBranch key={c.key} node={c} record={record} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function OwnershipTreeCard({ tree, error, record }) {
  const [open, setOpen] = useState(false);   // collapsed by default; the title toggles it
  const root = useMemo(() => buildOwnershipTrie(tree, record.legalPersonName), [tree, record.legalPersonName]);
  const holders = tree?.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const direct = ubos.filter(holderIsDirect).length;
  const indirect = ubos.length - direct;
  const fallback = tree?.seniorManagingOfficial;

  const Stat = ({ label, value, strong }) => (
    <div className="rd-tile" style={{ padding: '10px 12px', background: strong ? T.primarySoft : T.surfaceAlt, border: `1px solid ${strong ? T.primaryRing : T.border}`, borderRadius: T.radiusMd }}>
      <div style={{ fontSize: 11, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>{label}</div>
      <div style={{ fontSize: strong ? 26 : 20, fontWeight: 750, letterSpacing: '-.02em', color: strong ? T.primary : T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, marginBottom: 16, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="rd-ownership-tree"
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent',
          fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: T.text,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: T.textMuted, transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none' }}>{I.chevronRight}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Ownership tree</span>
          <span style={{ display: 'block', fontSize: 12, color: T.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.legalPersonName || 'Ownership structure of the legal entity'}
          </span>
        </span>
        {tree && <Pill tone="primary">{ubos.length} UBO{ubos.length === 1 ? '' : 's'}</Pill>}
      </button>
      {open && (
      <div id="rd-ownership-tree" style={{ padding: '4px 16px 16px', borderTop: `1px solid ${T.border}`, paddingTop: 14, animation: 'ui-slide .18s ease' }}>
      {error ? (
        <Banner>{error}</Banner>
      ) : !tree ? (
        <div><Skeleton width="100%" height={70} /><Skeleton width="60%" height={40} style={{ marginTop: 12 }} /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
            <Stat label="Total UBOs" value={ubos.length} strong />
            <Stat label="Direct" value={direct} />
            <Stat label="Indirect" value={indirect} />
          </div>
          {root.children.size === 0 ? (
            <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: T.textMuted, background: T.surfaceAlt, border: `1px dashed ${T.borderStrong}`, borderRadius: T.radiusMd }}>
              No beneficial owners in the ownership structure yet.
              {fallback && <div style={{ marginTop: 4 }}>Senior managing official on record: <strong style={{ color: T.text }}>{fallback.name || fallback.fullName}</strong>{fallback.position ? ` (${fallback.position})` : ''}.</div>}
            </div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 360, paddingBottom: 4 }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 'max-content' }}>
                <TreeBranch node={root} record={record} />
              </ul>
            </div>
          )}
        </>
      )}
      </div>
      )}
    </section>
  );
}

/* Card whose header toggles the body (collapsed by default) */
function CollapsibleCard({ id, title, subtitle, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, marginBottom: 16, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 18px', border: 'none', background: open ? T.surfaceAlt : 'transparent',
          fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: T.text, transition: 'background .15s ease',
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: T.textMuted, transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none' }}>{I.chevronRight}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{title}</span>
          {subtitle && <span style={{ display: 'block', fontSize: 12, color: T.textMuted, marginTop: 2 }}>{subtitle}</span>}
        </span>
        {badge}
        <span style={{ fontSize: 12, fontWeight: 600, color: T.primary, flexShrink: 0 }}>{open ? 'Hide details' : 'View details'}</span>
      </button>
      {open && (
        <div id={id} style={{ padding: 18, borderTop: `1px solid ${T.border}`, animation: 'ui-slide .18s ease' }}>
          {children}
        </div>
      )}
    </section>
  );
}

/* ==========================================================================
   Modern UI pieces: copy chip, export menu, upload zone, confirm dialog, toast
   ========================================================================== */
function CopyChip({ value, onCopied }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setDone(true);
      onCopied?.();
      window.setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard unavailable — ignore */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy reference"
      aria-label={`Copy reference ${value}`}
      className="rd-tile"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', fontFamily: T.mono, fontSize: 12.5, fontWeight: 600,
        color: done ? T.success : T.textSoft, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 999, cursor: 'pointer',
      }}
    >
      {value}
      <span style={{ display: 'inline-flex', color: done ? T.success : T.textFaint }}>{done ? I.approve : (I.copy || I.file)}</span>
    </button>
  );
}

function ExportMenu({ onPrint, onWord, onExcel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const item = (label, onClick) => (
    <button
      type="button"
      role="menuitem"
      className="rd-menu-item"
      onClick={() => { setOpen(false); onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
        background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: T.text, cursor: 'pointer', borderRadius: 8,
      }}
    >
      <span style={{ display: 'inline-flex', color: T.textMuted }}>{I.download}</span>{label}
    </button>
  );
  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 'auto' }}>
      <Btn variant="secondary" size="sm" icon={I.download} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>Export report</Btn>
      {open && (
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180, padding: 6, zIndex: 20,
          background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusMd, boxShadow: T.shadowLg, animation: 'ui-pop .15s ease',
        }}>
          {item('Print / PDF', onPrint)}
          {item('Word document', onWord)}
          {item('Excel sheet', onExcel)}
        </div>
      )}
    </div>
  );
}

function UploadZone({ file, onFile, onUpload, busy }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const pick = (f) => { if (f) onFile(f); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      style={{
        marginTop: 14, padding: '18px 16px', borderRadius: T.radiusMd, textAlign: 'center', transition: 'all .15s ease',
        border: `1.5px dashed ${drag ? T.primary : T.borderStrong}`, background: drag ? T.primarySoft : T.surfaceAlt,
      }}
    >
      <input ref={inputRef} type="file" hidden aria-label="Choose a document to upload" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!file ? (
        <>
          <span style={{ display: 'inline-flex', color: drag ? T.primary : T.textFaint }}>{I.upload}</span>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
            Drag a file here or{' '}
            <button type="button" onClick={() => inputRef.current?.click()}
              style={{ border: 'none', background: 'none', padding: 0, fontFamily: 'inherit', fontSize: 13, fontWeight: 650, color: T.primary, cursor: 'pointer', textDecoration: 'underline' }}>
              browse
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', textAlign: 'left' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>{file.name}</div>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{fmtSize(file.size)} · ready to upload</div>
          </div>
          <Btn variant="ghost" size="sm" disabled={busy} onClick={() => onFile(null)}>Remove</Btn>
          <Btn size="sm" icon={I.upload} disabled={busy} onClick={onUpload}>{busy ? 'Uploading…' : 'Upload'}</Btn>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, tone = 'danger', busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      role="alertdialog" aria-modal="true" aria-label={title} onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 110, animation: 'ui-fade .15s ease' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: T.radius, boxShadow: T.shadowLg, width: '100%', maxWidth: 420, padding: 22, animation: 'ui-pop .2s ease' }}>
        <div style={{ fontSize: 16, fontWeight: 750, letterSpacing: '-.01em' }}>{title}</div>
        <div style={{ fontSize: 13.5, color: T.textMuted, lineHeight: 1.55, marginTop: 8 }}>{body}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Btn variant="ghost" autoFocus disabled={busy} onClick={onCancel}>Cancel</Btn>
          <Btn variant={tone === 'danger' ? 'danger' : undefined} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 120, display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 999, background: '#0f172a', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: T.shadowLg, animation: 'ui-pop .2s ease',
    }}>
      <span style={{ display: 'inline-flex', color: '#4ade80' }}>{I.approve}</span>{toast.msg}
    </div>
  );
}

/* ==========================================================================
   RecordDetail
   ========================================================================== */
export default function RecordDetail({ id, roles, onBack }) {
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [legalDocuments, setLegalDocuments] = useState([]);
  const [legalDocsError, setLegalDocsError] = useState(null);
  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  /* Track whether the maker saved changes — enables Resubmit */
  const [hasUpdated, setHasUpdated] = useState(false);

  const [confirm, setConfirm] = useState(null);   // 'remove' | 'cease'
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg) => setToast({ msg, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const previewRef = useRef(null);
  useEffect(() => { previewRef.current = preview; }, [preview]);

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeBoRecord(id);
      onBack();
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to remove the record');
      setBusy(false);
    }
  };

  const load = useCallback(() => {
    setError(null);
    return Promise.all([getBoRecord(id), listDocuments(id)])
      .then(([rec, docs]) => {
        setRecord(rec);
        setDocuments(docs || []);
        const tasks = [];
        // The customer's own documents (MOA, AOA, registration, ...). A failure here must not hide the record.
        if (rec.legalPersonId) {
          tasks.push(
            listLegalPersonDocuments(rec.legalPersonId)
              .then((d) => { setLegalDocuments(d || []); setLegalDocsError(null); })
              .catch((err) => {
                setLegalDocuments([]);
                setLegalDocsError(err.friendlyMessage || 'Failed to load legal entity documents');
              }),
          );
        }
        // The legal entity's ownership structure (read-only). A failure here must not hide the record.
        if (rec.legalPersonId) {
          tasks.push(
            getOwnershipTree(rec.legalPersonId)
              .then((t) => { setTree(t); setTreeError(null); })
              .catch((err) => { setTree(null); setTreeError(err.friendlyMessage || 'Failed to load the ownership tree'); }),
          );
        }
        if (roles.isAuditor) {
          tasks.push(listAuditLogs({ entityRef: rec.boReference }).then((logs) => setAuditLogs(logs.content || [])));
        }
        return Promise.all(tasks);
      })
      .catch((err) => setError(err.friendlyMessage || 'Failed to load record'));
  }, [id, roles.isAuditor]);

  useEffect(() => { load(); }, [load]);

  const withBusy = (fn, okMsg) => async (...args) => {
    setBusy(true);
    setError(null);
    try {
      await fn(...args);
      await load();
      if (okMsg) showToast(okMsg);
    } catch (err) {
      setError(err.friendlyMessage || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = withBusy(() => approveBoRecord(id), 'Record approved');
  const handleCease = withBusy(() => ceaseBoRecord(id), 'Record marked as ceased');

  const handleSave = withBusy(async (payload) => {
    await updateBoRecord(id, payload);
    setEditing(false);
    setHasUpdated(true); // enables Resubmit
  }, 'Changes saved');

  const handleResubmit = withBusy(async () => {
    if (!hasUpdated) throw { friendlyMessage: 'Update the record before resubmitting for verification.' };
    await submitBoRecord(id);
    setHasUpdated(false); // a new cycle requires another update
  }, 'Submitted for verification');

  const handleReject = withBusy(async () => {
    if (!rejectReason.trim()) throw { friendlyMessage: 'A rejection reason is required' };
    await rejectBoRecord(id, rejectReason.trim());
    setShowReject(false);
    setRejectReason('');
  }, 'Record rejected');

  const handleCancelReject = () => { setShowReject(false); setRejectReason(''); };

  const handleUpload = withBusy(async () => {
    if (!uploadFile) return;
    await uploadDocument(id, uploadFile);
    setUploadFile(null);
  }, 'Document uploaded');
  const handleDelete = withBusy((docId) => deleteDocument(id, docId), 'Document deleted');

  /* scope: 'bo' = this beneficial owner's documents, 'lp' = the legal entity's documents */
  const handleView = async (doc, scope = 'bo') => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { url, contentType } = scope === 'lp'
        ? await fetchLegalPersonDocumentBlobUrl(record.legalPersonId, doc.id)
        : await fetchDocumentBlobUrl(id, doc.id);
      setPreview({ id: doc.id, scope, url, fileName: doc.fileName, contentType: contentType || doc.contentType });
    } catch (err) {
      setPreviewError(err.friendlyMessage || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (preview) window.URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  useEffect(() => () => {
    if (previewRef.current) window.URL.revokeObjectURL(previewRef.current.url);
  }, []);

  /* Close the preview with Escape */
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  /* ---------- Loading ---------- */
  if (!record) {
    return (
      <div style={{ fontFamily: T.font, color: T.text }}>
        <GlobalStyle />
        <Btn variant="ghost" size="sm" icon={I.back} onClick={onBack}>Back to records</Btn>
        {error ? (
          <div style={{ marginTop: 16 }}><Banner action={<Btn size="sm" variant="secondary" icon={I.refresh} onClick={load}>Retry</Btn>}>{error}</Banner></div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <Card><div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Skeleton width={64} height={64} style={{ borderRadius: 20 }} />
              <div style={{ flex: 1 }}><Skeleton width="40%" height={20} /><Skeleton width="25%" style={{ marginTop: 10 }} /></div>
            </div></Card>
            <Card><Skeleton width="100%" height={120} /></Card>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Derived ---------- */
  const status = record.status;
  const showCheckerActions = roles.isChecker && (status === 'PENDING' || status === 'VERIFIED');
  const showMakerActions = roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(status);
  const hasAnyAction = showCheckerActions || showMakerActions;
  const canResubmit = hasUpdated && !busy;

  const storedRejectReason = record.rejectionReason || record.rejectReason || record.rejectionNote || '';
  const showRejectBanner = status === 'REJECTED' && storedRejectReason;
  const controls = record.controlBasis || [];
  const timeline = buildTimeline(record);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    ...(roles.isAuditor ? [{ key: 'audit', label: 'Audit trail' }] : []),
  ];

  const reportSections = buildRecordReportSections(record, documents, legalDocuments, auditLogs);
  const reportHtml = buildReportHtml(record, reportSections);
  const reportBaseName = `BO-Record-${String(record.boReference || id).replace(/[^a-z0-9-_]/gi, '-')}`;
  const handlePrintReport = () => {
    const win = window.open('', '_blank');
    if (!win) { setError('The report window was blocked. Allow pop-ups for this site, then try again.'); return; }
    win.document.open();
    win.document.write(reportHtml.replace('</body>', '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\\/script></body>'));
    win.document.close();
  };
  const handleWordExport = () => downloadReportFile(reportHtml, `${reportBaseName}.doc`, 'application/msword');
  const handleExcelExport = () => {
    const excelHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>
      <h1>Beneficial Owner Record Report</h1><p>${reportEscape(record.fullName)} | ${reportEscape(record.boReference)} | ${reportEscape(humanize(record.status))}</p>
      ${reportSections.map((section) => `<h2>${reportEscape(section.title)}</h2><table border="1"><thead><tr>${section.headers.map((h) => `<th>${reportEscape(h)}</th>`).join('')}</tr></thead><tbody>${section.rows.map((row) => `<tr>${row.map((cell) => `<td>${reportEscape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('<br/>')}
      </body></html>`;
    downloadReportFile(excelHtml, `${reportBaseName}.xls`, 'application/vnd.ms-excel');
  };

  const statusAccent = { PENDING: T.warn, VERIFIED: T.success, REJECTED: T.danger }[status] || T.borderStrong;

  return (
    <div className="rd-root" style={{ fontFamily: T.font, color: T.text }}>
      <GlobalStyle />
      <style>{`
        .rd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
        .rd-side { position: sticky; top: 80px; max-height: calc(100vh - 96px); overflow-y: auto; padding: 2px; margin: -2px; }
        .rd-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
        .rd-tile { transition: border-color .15s ease, box-shadow .15s ease; }
        .rd-tile:hover { border-color: ${T.borderStrong}; box-shadow: 0 2px 8px rgba(15,23,42,.06); }
        .rd-menu-item:hover { background: ${T.surfaceAlt} !important; }
        .rd-root :focus-visible { outline: 3px solid ${T.primaryRing}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .rd-root *, .rd-root *::before, .rd-root *::after { animation: none !important; transition: none !important; } }
        @media (max-width: 980px) { .rd-grid { grid-template-columns: 1fr; } .rd-side { position: static; max-height: none; overflow: visible; } }
      `}</style>

      <Btn variant="ghost" size="sm" icon={I.back} onClick={onBack} style={{ marginBottom: 16 }}>Back to records</Btn>

      {/* ==================== Hero ==================== */}
      <section style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow,
        padding: '26px 24px 22px', marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: statusAccent }} />
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar name={record.fullName} size={72} />
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 750, letterSpacing: '-.025em' }}>{record.fullName}</h1>
              <StatusBadge status={status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: T.textMuted }}>
              <CopyChip value={record.boReference} onCopied={() => showToast('Reference copied')} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ display: 'inline-flex', color: T.textFaint }}>{I.building}</span>
                {record.legalPersonName}
                {record.legalPersonRegistrationNumber ? <span style={{ color: T.textFaint }}> ({record.legalPersonRegistrationNumber})</span> : null}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {record.capacity && <Pill tone="primary">{humanize(record.capacity)}</Pill>}
              {record.pep && <Pill tone="warn" icon={I.shield}>Politically exposed person</Pill>}
              {record.sanctionsScreened
                ? <Pill tone="success" icon={I.approve}>Sanctions screened</Pill>
                : <Pill tone="neutral">Sanctions not screened</Pill>}
              {record.idExpired && <Pill tone="danger">ID expired</Pill>}
            </div>
          </div>
          <ExportMenu onPrint={handlePrintReport} onWord={handleWordExport} onExcel={handleExcelExport} />
        </div>

        {/* key facts */}
        <div className="rd-facts" style={{ marginTop: 22 }}>
          <Fact label="Ownership">
            {record.ownershipPercentage != null ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{record.ownershipPercentage}%</span>
                  <Bar value={record.ownershipPercentage} width={80} />
                </div>
                {record.ownershipType && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{humanize(record.ownershipType)} holding</div>}
              </div>
            ) : <span style={{ color: T.textFaint }}>Not applicable</span>}
          </Fact>
          <Fact label="Control basis">
            {controls.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {controls.map((c) => <Pill key={c} tone="info">{controlBasisLabel[c] || humanize(c)}</Pill>)}
              </div>
            ) : <span style={{ color: T.textFaint }}>None recorded</span>}
          </Fact>
          <Fact label="Identification">
            <div style={{ fontWeight: 600 }}>{humanize(record.idDocumentType) || '—'}</div>
            {record.dateOfExpiry && (
              <div style={{ fontSize: 12, color: record.idExpired ? T.danger : T.textMuted, marginTop: 4 }}>
                {record.idExpired ? 'Expired' : 'Expires'} {fmtWhen(record.dateOfExpiry)}
              </div>
            )}
          </Fact>
          <Fact label="Beneficial owner since">
            <div style={{ fontWeight: 600 }}>{fmtWhen(record.dateBecameBo) || '—'}</div>
            {record.dateCeased && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Ceased {fmtWhen(record.dateCeased)}</div>}
          </Fact>
        </div>
      </section>

      {error && <Banner>{error}</Banner>}

      {showRejectBanner && (
        <Banner tone="error">
          <strong>This record was rejected{record.rejectedBy ? ` by ${record.rejectedBy}` : ''}{record.rejectedAt ? ` on ${fmtWhen(record.rejectedAt)}` : ''}.</strong>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: T.text, fontWeight: 500 }}>{String(storedRejectReason).trim()}</div>
          {roles.isMaker && <div style={{ marginTop: 6, color: T.textMuted }}>Update the record to address this, then resubmit it for verification.</div>}
        </Banner>
      )}

      {/* ==================== Main + side ==================== */}
      <div className="rd-grid">
        {/* ----- LEFT ----- */}
        <div style={{ minWidth: 0 }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {/* ---- Overview ---- */}
          {tab === 'overview' && (
            <>
              {editing && (
                <Card title="Edit record" subtitle="Save your changes, then resubmit for verification." style={{ borderColor: T.primaryRing, background: '#fbfcff' }}>
                  <BoEditForm record={record} busy={busy} onSave={handleSave} onCancel={() => setEditing(false)} />
                </Card>
              )}

              {record.ownershipChain && (
                <Card title="Ownership chain" subtitle="How this person holds the customer, layer by layer">
                  <OwnershipChain chain={record.ownershipChain} />
                </Card>
              )}

              <CollapsibleCard id="rd-ubo-info" title="UBO information" subtitle={`Identity, ownership and verification details for ${record.fullName}`}>
                <UboInfoTable record={record} documents={documents} />
              </CollapsibleCard>
            </>
          )}

          {/* ---- Documents ---- */}
          {tab === 'documents' && (
            <>
              <Card
                title="Beneficial owner documents"
                subtitle="Identification and evidence for this person"
              >
                {previewError && <Banner>{previewError}</Banner>}
                <DocumentList
                  docs={documents}
                  emptyTitle="No documents yet"
                  emptyHint="Uploaded evidence will appear here."
                  onView={(d) => handleView(d, 'bo')}
                  onDownload={(d) => downloadDocument(id, d.id, d.fileName)}
                  onDelete={(d) => handleDelete(d.id)}
                  canDelete={roles.isMaker}
                  busy={busy}
                  previewLoading={previewLoading}
                />
                {roles.isMaker && (
                  <UploadZone file={uploadFile} onFile={setUploadFile} onUpload={handleUpload} busy={busy} />
                )}
              </Card>

              <Card
                title="Legal entity documents"
                subtitle={record.legalPersonName}
              >
                {legalDocsError && <Banner>{legalDocsError}</Banner>}
                <DocumentList
                  docs={legalDocuments}
                  showType
                  emptyTitle="No legal entity documents"
                  emptyHint="Documents uploaded for the customer (MOA, AOA, registration…) appear here."
                  onView={(d) => handleView(d, 'lp')}
                  onDownload={(d) => downloadLegalPersonDocument(record.legalPersonId, d.id, d.fileName)}
                  canDelete={false}
                  busy={busy}
                  previewLoading={previewLoading}
                />
              </Card>
            </>
          )}

          {/* ---- Audit ---- */}
          {tab === 'audit' && roles.isAuditor && (
            <Card title="Audit trail" subtitle="Every action taken on this record">
              {auditLogs.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: T.textMuted }}>No audit entries yet.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {auditLogs.map((l, i) => (
                    <li key={l.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                      borderBottom: i < auditLogs.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 650 }}>{humanize(l.action)}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{l.actorUsername}</div>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textMuted, fontFamily: T.mono, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {fmtWhen(l.createdAt) || ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* ----- RIGHT: review + actions ----- */}
        <aside className="rd-side">
          <Card title="Review status" subtitle="Maker–checker progress">
            <Timeline steps={timeline} />
          </Card>

          <Card title="Actions" bodyStyle={{ padding: 16 }} style={{ marginBottom: 0 }}>
            {status === 'PENDING' && roles.isChecker && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Btn variant="success" icon={I.approve} disabled={busy || showReject} onClick={handleApprove} style={{ width: '100%' }}>Approve</Btn>
                <Btn variant="dangerOutline" icon={I.reject} disabled={busy} onClick={() => setShowReject((v) => !v)} style={{ width: '100%' }}>
                  {showReject ? 'Cancel reject' : 'Reject'}
                </Btn>
                {showReject && (
                  <RejectPanel
                    reason={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    onConfirm={handleReject}
                    onCancel={handleCancelReject}
                    busy={busy}
                  />
                )}
              </div>
            )}

            {status === 'VERIFIED' && roles.isChecker && (
              <Btn variant="secondary" icon={I.cease} disabled={busy} onClick={() => setConfirm('cease')} style={{ width: '100%' }}>Mark as ceased</Btn>
            )}

            {showMakerActions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: status === 'PENDING' && roles.isChecker ? 12 : 0 }}>
                <Btn variant="secondary" icon={I.edit} disabled={busy} onClick={() => { setTab('overview'); setEditing((v) => !v); }} style={{ width: '100%' }}>
                  {editing ? 'Cancel update' : 'Update record'}
                </Btn>

                {['DRAFT', 'REJECTED'].includes(status) && (
                  <>
                    <Btn icon={I.send} disabled={!canResubmit} onClick={handleResubmit} style={{ width: '100%' }} title={!hasUpdated ? 'Update the record first' : undefined}>
                      {status === 'DRAFT' ? 'Submit for verification' : 'Resubmit'}
                    </Btn>
                    {!hasUpdated && (
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', background: T.warnBg,
                        border: `1px solid ${T.warnBorder}`, borderRadius: T.radiusSm, fontSize: 12, color: T.warn, lineHeight: 1.45,
                      }}>
                        <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: 2 }}>{I.info}</span>
                        <span>Update the record before {status === 'DRAFT' ? 'submitting' : 'resubmitting'}.</span>
                      </div>
                    )}
                  </>
                )}

                {['DRAFT', 'PENDING'].includes(status) && (
                  <Btn variant="dangerOutline" icon={I.trash} disabled={busy} onClick={() => setConfirm('remove')} style={{ width: '100%' }}>Remove from list</Btn>
                )}
              </div>
            )}

            {!hasAnyAction && (
              <div style={{ fontSize: 13, color: T.textMuted }}>No actions are available for your role at this stage.</div>
            )}
          </Card>

          {record.legalPersonId && <OwnershipTreeCard tree={tree} error={treeError} record={record} />}



        </aside>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm === 'remove' ? 'Remove this record?' : 'Mark as ceased?'}
          body={confirm === 'remove'
            ? `${record.boReference} will be withdrawn from verification. You can register the person again later.`
            : `${record.fullName} will no longer be treated as a beneficial owner of ${record.legalPersonName || 'this entity'}. This is recorded in the audit trail.`}
          confirmLabel={confirm === 'remove' ? 'Remove record' : 'Mark as ceased'}
          tone={confirm === 'remove' ? 'danger' : 'primary'}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const kind = confirm;
            setConfirm(null);
            if (kind === 'remove') await handleRemove(); else await handleCease();
          }}
        />
      )}

      <Toast toast={toast} />

      {/* ==================== Preview modal ==================== */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${preview.fileName}`}
          onClick={closePreview}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100, animation: 'ui-fade .15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: T.radius, boxShadow: T.shadowLg, width: '100%', maxWidth: 900, maxHeight: '92vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'ui-pop .2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.fileName}</span>
              <button
                type="button"
                aria-label="Close preview"
                onClick={closePreview}
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {I.close}
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.surfaceAlt, padding: 20, minHeight: 220 }}>
              {(preview.contentType || '').toLowerCase() === 'application/pdf' ? (
                <iframe src={preview.url} title={preview.fileName} style={{ width: '100%', height: '70vh', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, background: '#fff' }} />
              ) : (
                <img src={preview.url} alt={preview.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: T.radiusSm, boxShadow: T.shadowMd }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: `1px solid ${T.border}` }}>
              <Btn
                variant="secondary"
                icon={I.download}
                onClick={() => (preview.scope === 'lp'
                  ? downloadLegalPersonDocument(record.legalPersonId, preview.id, preview.fileName)
                  : downloadDocument(id, preview.id, preview.fileName))}
              >
                Download
              </Btn>
              <Btn onClick={closePreview}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
