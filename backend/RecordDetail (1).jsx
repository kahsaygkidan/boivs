import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveBoRecord, ceaseBoRecord, deleteDocument, downloadDocument,
  fetchDocumentBlobUrl, getBoRecord, listAuditLogs, listDocuments, removeBoRecord,
  rejectBoRecord, submitBoRecord, updateBoRecord, uploadDocument,
  listLegalPersonDocuments, downloadLegalPersonDocument, fetchLegalPersonDocumentBlobUrl,
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
      <div style={{ fontSize: 11, color: T.textFaint, textAlign: 'right', marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
        {reason.trim().length} characters
      </div>
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
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 6 }}>{label}</div>
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
   RecordDetail
   ========================================================================== */
export default function RecordDetail({ id, roles, onBack }) {
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [legalDocuments, setLegalDocuments] = useState([]);
  const [legalDocsError, setLegalDocsError] = useState(null);
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

  const previewRef = useRef(null);
  useEffect(() => { previewRef.current = preview; }, [preview]);

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${record.boReference} from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return;
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
        if (roles.isAuditor) {
          tasks.push(listAuditLogs({ entityRef: rec.boReference }).then((logs) => setAuditLogs(logs.content || [])));
        }
        return Promise.all(tasks);
      })
      .catch((err) => setError(err.friendlyMessage || 'Failed to load record'));
  }, [id, roles.isAuditor]);

  useEffect(() => { load(); }, [load]);

  const withBusy = (fn) => async (...args) => {
    setBusy(true);
    setError(null);
    try {
      await fn(...args);
      await load();
    } catch (err) {
      setError(err.friendlyMessage || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = withBusy(() => approveBoRecord(id));
  const handleCease = withBusy(() => ceaseBoRecord(id));

  const handleSave = withBusy(async (payload) => {
    await updateBoRecord(id, payload);
    setEditing(false);
    setHasUpdated(true); // enables Resubmit
  });

  const handleResubmit = withBusy(async () => {
    if (!hasUpdated) throw { friendlyMessage: 'Update the record before resubmitting for verification.' };
    await submitBoRecord(id);
    setHasUpdated(false); // a new cycle requires another update
  });

  const handleReject = withBusy(async () => {
    if (!rejectReason.trim()) throw { friendlyMessage: 'A rejection reason is required' };
    await rejectBoRecord(id, rejectReason.trim());
    setShowReject(false);
    setRejectReason('');
  });

  const handleCancelReject = () => { setShowReject(false); setRejectReason(''); };

  const handleUpload = withBusy(async () => {
    if (!uploadFile) return;
    await uploadDocument(id, uploadFile);
    setUploadFile(null);
  });
  const handleDelete = withBusy((docId) => deleteDocument(id, docId));

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
  const docCount = documents.length + legalDocuments.length;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents', count: docCount },
    ...(roles.isAuditor ? [{ key: 'audit', label: 'Audit trail', count: auditLogs.length }] : []),
  ];

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <GlobalStyle />
      <style>{`
        .rd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
        .rd-side { position: sticky; top: 80px; }
        .rd-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 20px; }
        @media (max-width: 980px) { .rd-grid { grid-template-columns: 1fr; } .rd-side { position: static; } }
      `}</style>

      <Btn variant="ghost" size="sm" icon={I.back} onClick={onBack} style={{ marginBottom: 16 }}>Back to records</Btn>

      {/* ==================== Hero ==================== */}
      <section style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow,
        padding: 22, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar name={record.fullName} size={64} />
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 750, letterSpacing: '-.025em' }}>{record.fullName}</h1>
              <StatusBadge status={status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: T.textMuted }}>
              <span style={{ fontFamily: T.mono, color: T.textSoft, fontWeight: 600 }}>{record.boReference}</span>
              <span aria-hidden="true">·</span>
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
        </div>

        {/* key facts */}
        <div className="rd-facts" style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
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
                {controls.map((c) => <Pill key={c} tone="info">{controlBasisLabel ? (controlBasisLabel(c) || humanize(c)) : humanize(c)}</Pill>)}
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

              <Card title="UBO information">
                <UboInfoTable record={record} documents={documents} />
              </Card>
            </>
          )}

          {/* ---- Documents ---- */}
          {tab === 'documents' && (
            <>
              <Card
                title="Beneficial owner documents"
                subtitle="Identification and evidence for this person"
                action={documents.length > 0 && <Pill>{documents.length} file{documents.length === 1 ? '' : 's'}</Pill>}
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
                  <div style={{
                    marginTop: 14, padding: 12, border: `1px dashed ${T.borderStrong}`, borderRadius: T.radiusMd, background: T.surfaceAlt,
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  }}>
                    <span style={{ display: 'inline-flex', color: T.textMuted, flexShrink: 0 }}>{I.upload}</span>
                    <input
                      type="file"
                      aria-label="Choose a document to upload"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      style={{ flex: 1, minWidth: 200, fontSize: 12.5, fontFamily: 'inherit', color: T.text }}
                    />
                    <Btn size="sm" disabled={!uploadFile || busy} onClick={handleUpload}>Upload</Btn>
                  </div>
                )}
              </Card>

              <Card
                title="Legal entity documents"
                subtitle={record.legalPersonName}
                action={legalDocuments.length > 0 && <Pill>{legalDocuments.length} file{legalDocuments.length === 1 ? '' : 's'}</Pill>}
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
              <Btn variant="secondary" icon={I.cease} disabled={busy} onClick={handleCease} style={{ width: '100%' }}>Mark as ceased</Btn>
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
                  <Btn variant="dangerOutline" icon={I.trash} disabled={busy} onClick={handleRemove} style={{ width: '100%' }}>Remove from list</Btn>
                )}
              </div>
            )}

            {!hasAnyAction && (
              <div style={{ fontSize: 13, color: T.textMuted }}>No actions are available for your role at this stage.</div>
            )}
          </Card>
        </aside>
      </div>

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
