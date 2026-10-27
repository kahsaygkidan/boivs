import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveBoRecord, ceaseBoRecord, deleteDocument, downloadDocument,
  fetchDocumentBlobUrl, getBoRecord, listAuditLogs, listDocuments, removeBoRecord,
  rejectBoRecord, submitBoRecord, updateBoRecord, uploadDocument,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import BoEditForm from '../components/BoEditForm.jsx';
import UboInfoTable from '../components/UboInfoTable.jsx';

/* ==========================================================================
   Design tokens (shared across the app)
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
  successBorder: 'rgba(5,150,105,.25)',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: 'rgba(220,38,38,.28)',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  warnBorder: 'rgba(217,119,6,.25)',
  hoverRow: '#f8fafc',
  radius: 10,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  shadowMd: '0 4px 12px rgba(15,23,42,.06), 0 2px 4px rgba(15,23,42,.04)',
  shadowLg: '0 20px 50px rgba(15,23,42,.25)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Icons
   ========================================================================== */
const ic = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const I = {
  back: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  approve: <svg {...ic}><polyline points="20 6 9 17 4 12" /></svg>,
  reject: <svg {...ic}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  cease: <svg {...ic}><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
  edit: <svg {...ic}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  submit: <svg {...ic}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  trash: <svg {...ic}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" /></svg>,
  download: <svg {...ic}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  eye: <svg {...ic}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  upload: <svg {...ic}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  file: <svg {...ic}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
};

/* ==========================================================================
   Button
   ========================================================================== */
function Btn({ variant = 'primary', size = 'md', icon, children, style, ...props }) {
  const sizes = {
    sm: { height: 28, padding: '0 10px', fontSize: 11.5, gap: 4 },
    md: { height: 34, padding: '0 12px', fontSize: 12.5, gap: 5 },
    lg: { height: 40, padding: '0 16px', fontSize: 13.5, gap: 6 },
  };
  const variants = {
    primary: { background: T.primary, color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: T.text, border: `1px solid ${T.border}` },
    success: { background: T.success, color: '#fff', border: 'none' },
    danger: { background: T.danger, color: '#fff', border: 'none' },
    dangerOutline: { background: '#fff', color: T.danger, border: `1px solid ${T.dangerBorder}` },
    ghost: { background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}` },
  };
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
        fontWeight: 600,
        borderRadius: T.radiusSm,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease',
        opacity: props.disabled ? 0.55 : 1,
        whiteSpace: 'nowrap',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ==========================================================================
   Card
   ========================================================================== */
function Card({ title, action, children, style }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      boxShadow: T.shadow,
      marginBottom: 16,
      overflow: 'hidden',
      ...style,
    }}>
      {title && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: `1px solid ${T.border}`,
          background: T.surfaceAlt,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 650, color: T.text, margin: 0, letterSpacing: '-.005em' }}>{title}</h3>
          {action}
        </div>
      )}
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

/* ==========================================================================
   Banner
   ========================================================================== */
function Banner({ tone = 'error', children }) {
  const map = {
    error: { bg: T.dangerSoft, fg: T.danger, border: T.dangerBorder },
    warn: { bg: T.warnSoft, fg: T.warn, border: T.warnBorder },
    success: { bg: T.successSoft, fg: T.success, border: T.successBorder },
  }[tone];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '12px 14px',
      marginBottom: 14,
      background: map.bg,
      color: map.fg,
      border: `1px solid ${map.border}`,
      borderRadius: T.radiusSm,
      fontSize: 13,
      fontFamily: T.font,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
      <span>{children}</span>
    </div>
  );
}

/* ==========================================================================
   RecordDetail
   ========================================================================== */
export default function RecordDetail({ id, roles, onBack }) {
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
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
    return Promise.all([
      getBoRecord(id),
      listDocuments(id),
      roles.isAuditor ? listAuditLogs({ entityRef: undefined }) : Promise.resolve({ content: [] }),
    ])
      .then(([rec, docs]) => {
        setRecord(rec);
        setDocuments(docs);
        if (roles.isAuditor) {
          return listAuditLogs({ entityRef: rec.boReference }).then((logs) => setAuditLogs(logs.content || []));
        }
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
  const handleSave = withBusy(async (payload) => { await updateBoRecord(id, payload); setEditing(false); });
  const handleResubmit = withBusy(() => submitBoRecord(id));
  const handleReject = withBusy(async () => {
    if (!rejectReason.trim()) throw { friendlyMessage: 'A rejection reason is required' };
    await rejectBoRecord(id, rejectReason.trim());
    setShowReject(false);
    setRejectReason('');
  });
  const handleUpload = withBusy(async () => {
    if (!uploadFile) return;
    await uploadDocument(id, uploadFile);
    setUploadFile(null);
  });
  const handleDelete = withBusy((docId) => deleteDocument(id, docId));

  const handleView = async (doc) => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { url, contentType } = await fetchDocumentBlobUrl(id, doc.id);
      setPreview({ id: doc.id, url, fileName: doc.fileName, contentType: contentType || doc.contentType });
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

  /* ---------- Loading state ---------- */
  if (!record) {
    return (
      <div style={{ fontFamily: T.font, color: T.text }}>
        <Btn variant="ghost" icon={I.back} onClick={onBack}>Back to records</Btn>
        {error ? <div style={{ marginTop: 16 }}><Banner>{error}</Banner></div> : (
          <div style={{ marginTop: 16, padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: T.textMuted, fontSize: 13 }}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: T.primary, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            Loading record…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Derived flags ---------- */
  const showCheckerActions = roles.isChecker && (record.status === 'PENDING' || record.status === 'VERIFIED');
  const showMakerActions = roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status);
  const hasAnyAction = showCheckerActions || showMakerActions;

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ==================== Header ==================== */}
      <div style={{ marginBottom: 20 }}>
        <Btn variant="ghost" size="sm" icon={I.back} onClick={onBack} style={{ marginBottom: 14 }}>
          Back to records
        </Btn>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-.02em', fontFamily: T.mono, color: T.text }}>
                {record.boReference}
              </h1>
              <StatusBadge status={record.status} />
            </div>
            <div style={{ fontSize: 13.5, color: T.textMuted }}>
              <strong style={{ color: T.text, fontWeight: 600 }}>{record.fullName}</strong>
              <span style={{ margin: '0 8px', color: T.textFaint }}>·</span>
              {record.legalPersonName}
            </div>
          </div>
        </div>
      </div>

      {error && <Banner>{error}</Banner>}

      {/* ==================== Two-column layout ==================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: 16,
        alignItems: 'start',
      }}>
        {/* ----- LEFT ----- */}
        <div style={{ minWidth: 0 }}>
          {editing && (
            <Card title="Edit record" style={{ borderColor: `${T.primary}44`, background: T.primarySoft }}>
              <BoEditForm record={record} busy={busy} onSave={handleSave} onCancel={() => setEditing(false)} />
            </Card>
          )}

          <Card title="UBO information">
            <UboInfoTable record={record} documents={documents} />
          </Card>

          {/* ---------- Documents ---------- */}
          <Card
            title="Documents"
            action={documents.length > 0 && (
              <span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
                {documents.length} file{documents.length === 1 ? '' : 's'}
              </span>
            )}
          >
            {previewError && <Banner>{previewError}</Banner>}

            {documents.length === 0 ? (
              <div style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: T.textMuted,
                fontSize: 13,
                background: T.surfaceAlt,
                border: `1px dashed ${T.border}`,
                borderRadius: T.radiusSm,
              }}>
                <span style={{ display: 'inline-flex', color: T.textFaint, marginBottom: 8 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.4" />
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </span>
                <div style={{ fontWeight: 600, color: T.text, marginBottom: 2 }}>No documents yet</div>
                <div>Uploaded evidence will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map((d) => (
                  <div key={d.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radiusSm,
                    background: T.surfaceAlt,
                  }}>
                    <span aria-hidden="true" style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 6,
                      background: '#eef1f7', color: T.textMuted, flexShrink: 0,
                    }}>
                      {I.file}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.fileName}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                        {Math.round((d.sizeBytes || 0) / 1024)} KB
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {(d.contentType || '').startsWith('image/') && (
                        <Btn variant="secondary" size="sm" icon={I.eye} disabled={previewLoading} onClick={() => handleView(d)}>
                          View
                        </Btn>
                      )}
                      <Btn variant="secondary" size="sm" icon={I.download} onClick={() => downloadDocument(id, d.id, d.fileName)}>
                        Download
                      </Btn>
                      {roles.isMaker && (
                        <Btn variant="dangerOutline" size="sm" icon={I.trash} disabled={busy} onClick={() => handleDelete(d.id)}>
                          Delete
                        </Btn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {roles.isMaker && (
              <div style={{
                marginTop: 14,
                padding: 12,
                border: `1px dashed ${T.borderStrong}`,
                borderRadius: T.radiusSm,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'inline-flex', color: T.textMuted, flexShrink: 0 }}>{I.upload}</span>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{ flex: 1, minWidth: 200, fontSize: 12.5, fontFamily: 'inherit', color: T.text }}
                />
                <Btn variant="primary" size="sm" disabled={!uploadFile || busy} onClick={handleUpload}>
                  Upload
                </Btn>
              </div>
            )}
          </Card>

          {/* ---------- Audit trail ---------- */}
          {roles.isAuditor && (
            <Card title="Audit trail" action={
              auditLogs.length > 0 && (
                <span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
                  {auditLogs.length} entr{auditLogs.length === 1 ? 'y' : 'ies'}
                </span>
              )
            }>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: T.textMuted }}>
                  No audit entries yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {auditLogs.map((l, i) => (
                    <div key={l.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom: i < auditLogs.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.action}</div>
                        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{l.actorUsername}</div>
                      </div>
                      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: T.mono, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {(l.createdAt || '').replace('T', ' ').slice(0, 19)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ----- RIGHT: actions ----- */}
        <div style={{ position: 'sticky', top: 80 }}>
          <Card title="Actions" style={{ marginBottom: 0 }}>
            {record.status === 'PENDING' && roles.isChecker && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Btn variant="success" icon={I.approve} disabled={busy} onClick={handleApprove} style={{ width: '100%' }}>
                  Approve
                </Btn>
                <Btn variant="dangerOutline" icon={I.reject} disabled={busy} onClick={() => setShowReject((v) => !v)} style={{ width: '100%' }}>
                  {showReject ? 'Cancel reject' : 'Reject'}
                </Btn>
                {showReject && (
                  <div style={{ padding: 12, background: T.dangerSoft, borderRadius: T.radiusSm, border: `1px solid ${T.dangerBorder}` }}>
                    <textarea
                      placeholder="Reason for rejection"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: 12.5,
                        fontFamily: 'inherit',
                        color: T.text,
                        background: '#fff',
                        border: `1px solid ${T.dangerBorder}`,
                        borderRadius: 6,
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        marginBottom: 8,
                      }}
                    />
                    <Btn variant="danger" size="sm" disabled={busy} onClick={handleReject} style={{ width: '100%' }}>
                      Confirm reject
                    </Btn>
                  </div>
                )}
              </div>
            )}

            {record.status === 'VERIFIED' && roles.isChecker && (
              <Btn variant="ghost" icon={I.cease} disabled={busy} onClick={handleCease} style={{ width: '100%' }}>
                Mark as ceased
              </Btn>
            )}

            {roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Btn variant="secondary" icon={I.edit} disabled={busy} onClick={() => setEditing((v) => !v)} style={{ width: '100%' }}>
                  {editing ? 'Cancel update' : 'Update'}
                </Btn>
                {['DRAFT', 'REJECTED'].includes(record.status) && (
                  <Btn variant="primary" icon={I.submit} disabled={busy} onClick={handleResubmit} style={{ width: '100%' }}>
                    Submit for verification
                  </Btn>
                )}
                {['DRAFT', 'PENDING'].includes(record.status) && (
                  <Btn variant="dangerOutline" icon={I.trash} disabled={busy} onClick={handleRemove} style={{ width: '100%' }}>
                    Remove from list
                  </Btn>
                )}
              </div>
            )}

            {!hasAnyAction && (
              <div style={{ fontSize: 12.5, color: T.textMuted, padding: '4px 0' }}>
                No actions available for your role at this stage.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ==================== Preview modal ==================== */}
      {preview && (
        <div
          onClick={closePreview}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 100,
            animation: 'fadeIn .15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: T.radius,
              boxShadow: T.shadowLg,
              width: '100%',
              maxWidth: 860,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'popIn .2s ease',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: `1px solid ${T.border}`,
              gap: 12,
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preview.fileName}
              </span>
              <button
                type="button"
                aria-label="Close preview"
                onClick={closePreview}
                style={{
                  width: 32, height: 32, borderRadius: 6, border: `1px solid ${T.border}`,
                  background: '#fff', color: T.textMuted, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {I.close}
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: T.surfaceAlt,
              padding: 20,
              minHeight: 200,
            }}>
              <img src={preview.url} alt={preview.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: T.radiusSm, boxShadow: T.shadowMd }} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 16px',
              borderTop: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}>
              <Btn variant="secondary" icon={I.download} onClick={() => downloadDocument(id, preview.id, preview.fileName)}>
                Download
              </Btn>
              <Btn variant="primary" onClick={closePreview}>Close</Btn>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes popIn { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
          `}</style>
        </div>
      )}
    </div>
  );
}
