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
import '../styles/RecordDetail.css';

/* ---------- constants & helpers ---------- */
const DOC_TYPE_LABEL = Object.fromEntries(LEGAL_DOC_TYPES.map((d) => [d.docType, d.label]));

const isViewable = (ct) => {
  const t = (ct || '').toLowerCase();
  return t.startsWith('image/') || t === 'application/pdf';
};

const fmtSize = (bytes) => {
  const b = Number(bytes) || 0;
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

const splitChain = (c) => String(c || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
const holderIsDirect = (h) => {
  const p = h.paths || [];
  return p.length === 0 || p.every((x) => splitChain(x.chain).length === 2);
};
const holderHasControl = (h) => Boolean(h.qualifiesByControl) || (h.controlBasis || []).length > 0;

/* ==========================================================================
   Timeline
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
    default: break;
  }
  return steps;
}

function Timeline({ steps }) {
  return (
    <ol className="rd-timeline">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="rd-timeline__step">
            {!last && <span className="rd-timeline__rail" aria-hidden="true" />}
            <span
              className={`rd-timeline__dot rd-timeline__dot--${s.tone}${s.live ? ' rd-timeline__dot--live' : ''}`}
              aria-hidden="true"
            >
              <span className={`rd-timeline__dot-inner rd-timeline__dot-inner--${s.tone}`} />
            </span>
            <div className="rd-timeline__body">
              <div className={`rd-timeline__title${s.tone === 'pending' ? ' rd-timeline__title--pending' : ''}`}>{s.title}</div>
              {(s.by || s.at) && (
                <div className="rd-timeline__meta">
                  {s.by ? <>by <strong>{s.by}</strong></> : null}
                  {s.by && s.at ? ' · ' : ''}
                  {s.at ? fmtWhen(s.at) : ''}
                </div>
              )}
              {s.note && <div className="rd-timeline__note">{s.note}</div>}
              {s.quote && String(s.quote).trim() && (
                <div className="rd-timeline__quote">{String(s.quote).trim()}</div>
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
  const canConfirm = reason.trim().length > 0 && !busy;
  return (
    <div className="rd-reject">
      <label htmlFor="reject-reason" className="rd-reject__label">
        <span style={{ display: 'inline-flex' }}>{I.reject}</span> Rejection reason
      </label>
      <textarea
        id="reject-reason"
        className="rd-reject__textarea"
        placeholder="Explain why this record is being rejected. The maker will see this."
        value={reason}
        onChange={onChange}
        rows={4}
      />
      <div className="rd-reject__actions">
        <Btn variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" size="sm" disabled={!canConfirm} onClick={onConfirm}>
          {busy ? 'Rejecting…' : 'Confirm reject'}
        </Btn>
      </div>
    </div>
  );
}

/* ==========================================================================
   Document list
   ========================================================================== */
function DocumentList({ docs, emptyTitle, emptyHint, onView, onDownload, onDelete, canDelete, busy, previewLoading, showType }) {
  if (docs.length === 0) {
    return (
      <div className="rd-docs-empty">
        <span className="rd-docs-empty__icon">{I.file}</span>
        <div className="rd-docs-empty__title">{emptyTitle}</div>
        <div>{emptyHint}</div>
      </div>
    );
  }
  return (
    <ul className="rd-docs">
      {docs.map((d) => {
        const ext = (d.fileName || '').split('.').pop().slice(0, 4).toUpperCase();
        return (
          <li key={d.id} className="rd-doc">
            <span className="rd-doc__ext" aria-hidden="true">{ext || 'FILE'}</span>
            <div className="rd-doc__main">
              <div className="rd-doc__name" title={d.fileName}>{d.fileName}</div>
              <div className="rd-doc__meta">
                {showType && d.docType ? `${DOC_TYPE_LABEL[d.docType] || humanize(d.docType)} · ` : ''}
                {fmtSize(d.sizeBytes)}
                {showType && d.uploadedAt ? ` · uploaded ${fmtWhen(d.uploadedAt)}` : ''}
              </div>
            </div>
            <div className="rd-doc__actions">
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
   Small layout pieces
   ========================================================================== */
function Fact({ label, children }) {
  return (
    <div className="rd-fact">
      <div className="rd-fact__label">{label}</div>
      <div className="rd-fact__value">{children}</div>
    </div>
  );
}

function OwnershipChain({ chain }) {
  const parts = splitChain(chain);
  if (parts.length === 0) return null;
  return (
    <div className="rd-chain">
      {parts.map((p, i) => {
        const last = i === parts.length - 1;
        return (
          <span key={`${p}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className={`rd-chain__chip${last ? ' rd-chain__chip--last' : ''}`}>{p}</span>
            {!last && <span className="rd-chain__arrow" aria-hidden="true">→</span>}
          </span>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Report generation (unchanged logic, no inline styles)
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
const buildReportHtml = (record, sections) => {
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
   Ownership tree card
   ========================================================================== */
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

  return (
    <li style={{ position: 'relative', marginTop: depth === 0 ? 0 : 8 }}>
      {depth > 0 && <span aria-hidden="true" style={{ position: 'absolute', left: -18, top: 22, width: 16, height: 2, background: 'var(--rd-border)' }} />}
      <div className={`rd-tree-node rd-tree-node--${node.kind}${isMe ? ' rd-tree-node--me' : ''}`}>
        {node.kind === 'person'
          ? <Avatar name={node.label} size={30} />
          : <span className="rd-tree-node__icon">{I.building}</span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="rd-tree-node__label">{node.label}</span>
            {isMe && <Pill tone="primary">This record</Pill>}
            {h?.pep && <Pill tone="warn">PEP</Pill>}
          </div>
          <div className="rd-tree-node__sub">
            {node.kind === 'entity' && 'Legal entity'}
            {node.kind === 'intermediate' && 'Intermediate entity'}
            {node.kind === 'person' && [h.ubo ? 'Beneficial owner' : 'Control only', pctText].filter(Boolean).join(' · ')}
          </div>
        </div>
        {kids.length > 0 && (
          <button
            type="button"
            className="rd-tree-node__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
          >{open ? 'Hide' : 'Show'}</button>
        )}
      </div>
      {kids.length > 0 && open && (
        <ul className="rd-tree__children">
          {kids.map((c) => <TreeBranch key={c.key} node={c} record={record} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function OwnershipTreeCard({ tree, error, record }) {
  const [open, setOpen] = useState(false);
  const root = useMemo(() => buildOwnershipTrie(tree, record.legalPersonName), [tree, record.legalPersonName]);
  const holders = tree?.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const direct = ubos.filter(holderIsDirect).length;
  const indirect = ubos.length - direct;
  const fallback = tree?.seniorManagingOfficial;

  const Stat = ({ label, value, strong }) => (
    <div className={`rd-tree__stat${strong ? ' rd-tree__stat--strong' : ''}`}>
      <div className="rd-tree__stat-label">{label}</div>
      <div className="rd-tree__stat-value">{value}</div>
    </div>
  );

  return (
    <section className="rd-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="rd-ownership-tree"
        className={`rd-collapser${open ? ' rd-collapser--open' : ''}`}
      >
        <span className="rd-collapser__chevron" aria-hidden="true">{I.chevronRight}</span>
        <span className="rd-collapser__body">
          <span className="rd-collapser__title">Ownership structure</span>
          <span className="rd-collapser__sub">
            {record.legalPersonName || 'Ownership structure of the legal entity'}
          </span>
        </span>
        {tree && <Pill tone="primary">{ubos.length} UBO{ubos.length === 1 ? '' : 's'}</Pill>}
      </button>

      {open && (
        <div id="rd-ownership-tree" className="rd-collapser__content">
          {error ? (
            <Banner>{error}</Banner>
          ) : !tree ? (
            <div><Skeleton width="100%" height={70} /><Skeleton width="60%" height={40} style={{ marginTop: 12 }} /></div>
          ) : (
            <>
              <div className="rd-tree__stats">
                <Stat label="Direct" value={direct} />
                <Stat label="Indirect" value={indirect} />
              </div>
              {root.children.size === 0 ? (
                <div className="rd-tree__empty">
                  No beneficial owners in the ownership structure yet.
                  {fallback && (
                    <div style={{ marginTop: 4 }}>
                      Senior managing official on record: <strong style={{ color: 'var(--rd-text)' }}>{fallback.name || fallback.fullName}</strong>
                      {fallback.position ? ` (${fallback.position})` : ''}.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rd-tree">
                  <ul>
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

/* Card that toggles its body via its header */
function CollapsibleCard({ id, title, subtitle, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rd-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={`rd-collapser${open ? ' rd-collapser--open' : ''}`}
      >
        <span className="rd-collapser__chevron" aria-hidden="true">{I.chevronRight}</span>
        <span className="rd-collapser__body">
          <span className="rd-collapser__title">{title}</span>
          {subtitle && <span className="rd-collapser__sub">{subtitle}</span>}
        </span>
        {badge}
        <span className="rd-collapser__hint">{open ? 'Hide details' : 'View details'}</span>
      </button>
      {open && (
        <div id={id} className="rd-collapser__content">{children}</div>
      )}
    </section>
  );
}

/* ==========================================================================
   Copy chip, export menu, upload zone, confirm dialog, toast
   ========================================================================== */
function CopyChip({ value, onCopied }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setDone(true);
      onCopied?.();
      window.setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy reference"
      aria-label={`Copy reference ${value}`}
      className={`rd-copy${done ? ' rd-copy--done' : ''}`}
    >
      {value}
      <span className="rd-copy__icon">{done ? I.approve : (I.copy || I.file)}</span>
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
    <button type="button" role="menuitem" className="rd-export__item" onClick={() => { setOpen(false); onClick(); }}>
      <span className="rd-export__item-icon">{I.download}</span>{label}
    </button>
  );
  return (
    <div ref={ref} className="rd-export">
      <Btn variant="secondary" size="sm" icon={I.download} onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>Export report</Btn>
      {open && (
        <div role="menu" className="rd-export__menu">
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
      className={`rd-upload${drag ? ' rd-upload--drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
    >
      <input ref={inputRef} type="file" hidden aria-label="Choose a document to upload" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!file ? (
        <>
          <span className="rd-upload__icon">{I.upload}</span>
          <div className="rd-upload__hint">
            Drag a file here or{' '}
            <button type="button" className="rd-upload__browse" onClick={() => inputRef.current?.click()}>browse</button>
          </div>
        </>
      ) : (
        <div className="rd-upload__file">
          <div className="rd-upload__file-main">
            <div className="rd-upload__file-name" title={file.name}>{file.name}</div>
            <div className="rd-upload__file-size">{fmtSize(file.size)} · ready to upload</div>
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
    <div className="rd-confirm" role="alertdialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="rd-confirm__panel" onClick={(e) => e.stopPropagation()}>
        <div className="rd-confirm__title">{title}</div>
        <div className="rd-confirm__body">{body}</div>
        <div className="rd-confirm__actions">
          <Btn variant="ghost" autoFocus disabled={busy} onClick={onCancel}>Cancel</Btn>
          <Btn variant={tone === 'danger' ? 'danger' : undefined} disabled={busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" className="rd-toast">
      <span className="rd-toast__icon">{I.approve}</span>{toast.msg}
    </div>
  );
}

/* ==========================================================================
   Main
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
  const [hasUpdated, setHasUpdated] = useState(false);
  const [confirm, setConfirm] = useState(null);
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
    setBusy(true); setError(null);
    try { await removeBoRecord(id); onBack(); }
    catch (err) { setError(err.friendlyMessage || 'Failed to remove the record'); setBusy(false); }
  };

  const load = useCallback(() => {
    setError(null);
    return Promise.all([getBoRecord(id), listDocuments(id)])
      .then(([rec, docs]) => {
        setRecord(rec);
        setDocuments(docs || []);
        const tasks = [];
        if (rec.legalPersonId) {
          tasks.push(
            listLegalPersonDocuments(rec.legalPersonId)
              .then((d) => { setLegalDocuments(d || []); setLegalDocsError(null); })
              .catch((err) => {
                setLegalDocuments([]);
                setLegalDocsError(err.friendlyMessage || 'Failed to load legal entity documents');
              }),
          );
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
    setBusy(true); setError(null);
    try { await fn(...args); await load(); if (okMsg) showToast(okMsg); }
    catch (err) { setError(err.friendlyMessage || 'Action failed'); }
    finally { setBusy(false); }
  };

  const handleApprove = withBusy(() => approveBoRecord(id), 'Record approved');
  const handleCease = withBusy(() => ceaseBoRecord(id), 'Record marked as ceased');

  const handleSave = withBusy(async (payload) => {
    await updateBoRecord(id, payload);
    setEditing(false);
    setHasUpdated(true);
  }, 'Changes saved');

  const handleResubmit = withBusy(async () => {
    if (!hasUpdated) throw { friendlyMessage: 'Update the record before resubmitting for verification.' };
    await submitBoRecord(id);
    setHasUpdated(false);
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

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  if (!record) {
    return (
      <div className="rd-root">
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

  /* derived */
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

  const statusAccentClass = { PENDING: 'warn', VERIFIED: 'success', REJECTED: 'danger' }[status] || 'neutral';

  return (
    <div className="rd-root">
      <GlobalStyle />

      <Btn variant="ghost" size="sm" icon={I.back} onClick={onBack} style={{ marginBottom: 16 }}>Back to records</Btn>

      {/* Hero */}
      <section className="rd-hero">
        <span className={`rd-hero__accent rd-hero__accent--${statusAccentClass}`} aria-hidden="true" />
        <div className="rd-hero__top">
          <Avatar name={record.fullName} size={72} />
          <div className="rd-hero__body">
            <div className="rd-hero__name-row">
              <h1 className="rd-hero__name">{record.fullName}</h1>
              <StatusBadge status={status} />
            </div>
            <div className="rd-hero__meta">
              <CopyChip value={record.boReference} onCopied={() => showToast('Reference copied')} />
              <span className="rd-hero__entity">
                <span style={{ display: 'inline-flex', color: 'var(--rd-faint)' }}>{I.building}</span>
                {record.legalPersonName}
                {record.legalPersonRegistrationNumber ? <span className="rd-hero__entity-reg"> ({record.legalPersonRegistrationNumber})</span> : null}
              </span>
            </div>
            <div className="rd-hero__pills">
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

        <div className="rd-hero__facts">
          <Fact label="Ownership">
            {record.ownershipPercentage != null ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="rd-fact__pct">{record.ownershipPercentage}%</span>
                  <Bar value={record.ownershipPercentage} width={80} />
                </div>
                {record.ownershipType && <div className="rd-fact__sub">{humanize(record.ownershipType)} holding</div>}
              </div>
            ) : <span className="rd-fact__value--faint">Not applicable</span>}
          </Fact>
          <Fact label="Control basis">
            {controls.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {controls.map((c) => <Pill key={c} tone="info">{controlBasisLabel[c] || humanize(c)}</Pill>)}
              </div>
            ) : <span className="rd-fact__value--faint">None recorded</span>}
          </Fact>
          <Fact label="Identification">
            <div style={{ fontWeight: 600 }}>{humanize(record.idDocumentType) || '—'}</div>
            {record.dateOfExpiry && (
              <div className="rd-fact__sub" style={{ color: record.idExpired ? 'var(--rd-danger)' : undefined }}>
                {record.idExpired ? 'Expired' : 'Expires'} {fmtWhen(record.dateOfExpiry)}
              </div>
            )}
          </Fact>
          <Fact label="Beneficial owner since">
            <div style={{ fontWeight: 600 }}>{fmtWhen(record.dateBecameBo) || '—'}</div>
            {record.dateCeased && <div className="rd-fact__sub">Ceased {fmtWhen(record.dateCeased)}</div>}
          </Fact>
        </div>
      </section>

      {error && <Banner>{error}</Banner>}

      {showRejectBanner && (
        <Banner tone="error">
          <strong>This record was rejected{record.rejectedBy ? ` by ${record.rejectedBy}` : ''}{record.rejectedAt ? ` on ${fmtWhen(record.rejectedAt)}` : ''}.</strong>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 500 }}>{String(storedRejectReason).trim()}</div>
          {roles.isMaker && <div style={{ marginTop: 6, color: 'var(--rd-muted)' }}>Update the record to address this, then resubmit it for verification.</div>}
        </Banner>
      )}

      <div className="rd-grid">
        {/* Left */}
        <div className="rd-col">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'overview' && (
            <>
              {editing && (
                <Card title="Edit record" subtitle="Save your changes, then resubmit for verification.">
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
              {record.legalPersonId && <OwnershipTreeCard tree={tree} error={treeError} record={record} />}
            </>
          )}

          {tab === 'documents' && (
            <>
              <Card title="Beneficial owner documents" subtitle="Identification and evidence for this person">
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

              <Card title="Legal entity documents" subtitle={record.legalPersonName}>
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

          {tab === 'audit' && roles.isAuditor && (
            <Card title="Audit trail" subtitle="Every action taken on this record">
              {auditLogs.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: 'var(--rd-muted)' }}>No audit entries yet.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {auditLogs.map((l, i) => (
                    <li key={l.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                      borderBottom: i < auditLogs.length - 1 ? '1px solid var(--rd-border)' : 'none',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 650 }}>{humanize(l.action)}</div>
                        <div style={{ fontSize: 12, color: 'var(--rd-muted)', marginTop: 2 }}>{l.actorUsername}</div>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--rd-muted)', fontFamily: 'var(--rd-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {fmtWhen(l.createdAt) || ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* Right rail */}
        <aside className="rd-side">
          <Card title="Review status" subtitle="Maker–checker progress">
            <Timeline steps={timeline} />
          </Card>

          <Card title="Actions">
            {status === 'PENDING' && roles.isChecker && (
              <div className="rd-actions">
                <Btn variant="success" icon={I.approve} disabled={busy || showReject} onClick={handleApprove}>Approve</Btn>
                <Btn variant="dangerOutline" icon={I.reject} disabled={busy} onClick={() => setShowReject((v) => !v)}>
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
              <Btn variant="secondary" icon={I.cease} disabled={busy} onClick={() => setConfirm('cease')}>Mark as ceased</Btn>
            )}

            {showMakerActions && (
              <div className="rd-actions" style={{ marginTop: status === 'PENDING' && roles.isChecker ? 12 : 0 }}>
                <Btn variant="secondary" icon={I.edit} disabled={busy} onClick={() => { setTab('overview'); setEditing((v) => !v); }}>
                  {editing ? 'Cancel update' : 'Update record'}
                </Btn>
                {['DRAFT', 'REJECTED'].includes(status) && (
                  <>
                    <Btn icon={I.send} disabled={!canResubmit} onClick={handleResubmit} title={!hasUpdated ? 'Update the record first' : undefined}>
                      {status === 'DRAFT' ? 'Submit for verification' : 'Resubmit'}
                    </Btn>
                    {!hasUpdated && (
                      <div className="rd-actions__warning">
                        <span className="rd-actions__warning-icon">{I.info}</span>
                        <span>Update the record before {status === 'DRAFT' ? 'submitting' : 'resubmitting'}.</span>
                      </div>
                    )}
                  </>
                )}
                {['DRAFT', 'PENDING'].includes(status) && (
                  <Btn variant="dangerOutline" icon={I.trash} disabled={busy} onClick={() => setConfirm('remove')}>Remove from list</Btn>
                )}
              </div>
            )}

            {!hasAnyAction && (
              <div className="rd-actions__empty">No actions are available for your role at this stage.</div>
            )}
          </Card>
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

      {preview && (
        <div className="rd-preview" role="dialog" aria-modal="true" aria-label={`Preview of ${preview.fileName}`} onClick={closePreview}>
          <div className="rd-preview__panel" onClick={(e) => e.stopPropagation()}>
            <div className="rd-preview__head">
              <span className="rd-preview__title">{preview.fileName}</span>
              <button type="button" aria-label="Close preview" className="rd-preview__close" onClick={closePreview}>{I.close}</button>
            </div>
            <div className="rd-preview__stage">
              {(preview.contentType || '').toLowerCase() === 'application/pdf' ? (
                <iframe src={preview.url} title={preview.fileName} className="rd-preview__pdf" />
              ) : (
                <img src={preview.url} alt={preview.fileName} className="rd-preview__img" />
              )}
            </div>
            <div className="rd-preview__actions">
              <Btn variant="secondary" icon={I.download} onClick={() => (preview.scope === 'lp'
                ? downloadLegalPersonDocument(record.legalPersonId, preview.id, preview.fileName)
                : downloadDocument(id, preview.id, preview.fileName))}>
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