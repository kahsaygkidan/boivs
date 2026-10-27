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
   Design tokens (shared with Sidebar / Topbar / Records)
   ========================================================================== */
const T = {
  surface: '#ffffff',
  bg: '#f6f8fb',
  border: '#e5e8ef',
  borderStrong: '#d5d9e6',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#283375',
  primaryHover: '#1f2859',
  primarySoft: 'rgba(40,51,117,.08)',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: 'rgba(220,38,38,.33)',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
  shadowMd: '0 4px 12px rgba(15,23,42,.08)',
  shadowLg: '0 20px 50px rgba(15,23,42,.25)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Reusable style helpers
   ========================================================================== */
const cardStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  boxShadow: T.shadow,
  padding: 22,
  marginBottom: 18,
  fontFamily: T.font,
};

const h3Style = {
  fontSize: 15,
  fontWeight: 650,
  color: T.text,
  margin: '0 0 14px',
  letterSpacing: '-.01em',
};

function Btn({ variant = 'primary', children, style, ...props }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: T.radiusSm,
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    transition: 'background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease',
    whiteSpace: 'nowrap',
    opacity: props.disabled ? 0.55 : 1,
    border: '1px solid transparent',
  };

  const variants = {
    primary: { background: T.primary, color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: T.text, border: `1px solid ${T.borderStrong}` },
    danger: { background: T.danger, color: '#fff', border: 'none' },
    dangerOutline: { background: 'transparent', color: T.danger, border: `1px solid ${T.dangerBorder}` },
    success: { background: T.success, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}` },
  };

  return <button type="button" style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</button>;
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

  /* ------------------------------------------------------------------------
     Loading state
     ------------------------------------------------------------------------ */
  if (!record) {
    return (
      <div style={{ fontFamily: T.font, color: T.text }}>
        <Btn variant="secondary" onClick={onBack}>← Back</Btn>
        {error ? (
          <div style={bannerStyle('error', { marginTop: 16 })}>{error}</div>
        ) : (
          <div
            style={{
              marginTop: 16,
              padding: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: T.textMuted,
              fontSize: 13,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                border: `2px solid ${T.border}`,
                borderTopColor: T.primary,
                borderRadius: '50%',
                animation: 'spin .7s linear infinite',
              }}
            />
            Loading record…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ---------- Page header ---------- */}
      <div style={{ marginBottom: 22 }}>
        <Btn variant="secondary" onClick={onBack} style={{ marginBottom: 14 }}>← Back</Btn>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                margin: '0 0 6px',
                letterSpacing: '-.02em',
                fontFamily: T.mono,
                color: T.text,
              }}
            >
              {record.boReference}
            </h1>
            <div style={{ fontSize: 13.5, color: T.textMuted }}>
              <strong style={{ color: T.text, fontWeight: 600 }}>{record.fullName}</strong>
              {' '}— {record.legalPersonName}
            </div>
          </div>
          <StatusBadge status={record.status} />
        </div>
      </div>

      {error && <div style={bannerStyle('error')}>{error}</div>}

      {/* ---------- Two-column layout ---------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* ----- LEFT column ----- */}
        <div>
          {editing && (
            <div style={{ ...cardStyle, borderColor: `${T.primary}44`, background: T.primarySoft }}>
              <BoEditForm record={record} busy={busy} onSave={handleSave} onCancel={() => setEditing(false)} />
            </div>
          )}

          <div style={cardStyle}>
            <h3 style={h3Style}>UBO information</h3>
            <UboInfoTable record={record} documents={documents} />
          </div>

          {/* ---------- Documents ---------- */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ ...h3Style, margin: 0 }}>Documents</h3>
              {documents.length > 0 && (
                <span style={{ fontSize: 12, color: T.textMuted }}>
                  {documents.length} file{documents.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {previewError && <div style={bannerStyle('error', { marginBottom: 12 })}>{previewError}</div>}

            {documents.length === 0 && (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: T.textMuted,
                  fontSize: 13,
                  background: '#fafbfc',
                  border: `1px dashed ${T.border}`,
                  borderRadius: T.radiusSm,
                }}
              >
                No documents uploaded yet.
              </div>
            )}

            {documents.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusSm,
                  marginBottom: 8,
                  background: '#fafbfc',
                  transition: 'border-color .15s ease, background .15s ease',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.fileName}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                    {Math.round((d.sizeBytes || 0) / 1024)} KB
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {(d.contentType || '').startsWith('image/') && (
                    <Btn variant="secondary" disabled={previewLoading} onClick={() => handleView(d)}>View</Btn>
                  )}
                  <Btn variant="secondary" onClick={() => downloadDocument(id, d.id, d.fileName)}>Download</Btn>
                  {roles.isMaker && (
                    <Btn variant="dangerOutline" disabled={busy} onClick={() => handleDelete(d.id)}>Delete</Btn>
                  )}
                </div>
              </div>
            ))}

            {roles.isMaker && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: `1px dashed ${T.borderStrong}`,
                  borderRadius: T.radiusSm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{ flex: 1, minWidth: 200, fontSize: 13, fontFamily: 'inherit' }}
                />
                <Btn variant="primary" disabled={!uploadFile || busy} onClick={handleUpload}>Upload</Btn>
              </div>
            )}
          </div>

          {/* ---------- Audit trail ---------- */}
          {roles.isAuditor && (
            <div style={cardStyle}>
              <h3 style={h3Style}>Audit trail</h3>
              {auditLogs.length === 0 && (
                <div style={{ fontSize: 13, color: T.textMuted }}>No audit entries yet.</div>
              )}
              {auditLogs.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: `1px solid ${T.border}`,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: T.text }}>{l.action}</span>
                    <span style={{ color: T.textMuted }}> — {l.actorUsername}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.textFaint, fontFamily: T.mono }}>
                    {(l.createdAt || '').replace('T', ' ').slice(0, 19)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ----- RIGHT column: actions ----- */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div style={cardStyle}>
            <h3 style={{ ...h3Style, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMuted }}>
              Actions
            </h3>

            {record.status === 'PENDING' && roles.isChecker && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Btn variant="success" disabled={busy} onClick={handleApprove} style={{ width: '100%' }}>Approve</Btn>
                <Btn variant="dangerOutline" disabled={busy} onClick={() => setShowReject((v) => !v)} style={{ width: '100%' }}>
                  {showReject ? 'Cancel reject' : 'Reject'}
                </Btn>
                {showReject && (
                  <div style={{ marginTop: 6, padding: 12, background: T.dangerSoft, borderRadius: T.radiusSm, border: `1px solid ${T.dangerBorder}` }}>
                    <textarea
                      placeholder="Reason for rejection"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: 13,
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
                    <Btn variant="danger" disabled={busy} onClick={handleReject} style={{ width: '100%' }}>
                      Confirm reject
                    </Btn>
                  </div>
                )}
              </div>
            )}

            {record.status === 'VERIFIED' && roles.isChecker && (
              <Btn variant="ghost" disabled={busy} onClick={handleCease} style={{ width: '100%' }}>
                Mark as ceased
              </Btn>
            )}

            {roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Btn variant="secondary" disabled={busy} onClick={() => setEditing((v) => !v)} style={{ width: '100%' }}>
                  {editing ? 'Cancel update' : 'Update'}
                </Btn>
                {['DRAFT', 'REJECTED'].includes(record.status) && (
                  <Btn variant="primary" disabled={busy} onClick={handleResubmit} style={{ width: '100%' }}>
                    Submit for verification
                  </Btn>
                )}
                {['DRAFT', 'PENDING'].includes(record.status) && (
                  <Btn variant="dangerOutline" disabled={busy} onClick={handleRemove} style={{ width: '100%' }}>
                    Remove from list
                  </Btn>
                )}
              </div>
            )}

            {!(roles.isChecker && (record.status === 'PENDING' || record.status === 'VERIFIED'))
              && !(roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status)) && (
              <div style={{ fontSize: 12.5, color: T.textMuted, padding: '8px 0' }}>
                No actions available for your role at this stage.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Preview modal ---------- */}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: `1px solid ${T.border}`,
                gap: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  fontSize: 15, fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f6f8fb',
                padding: 20,
                minHeight: 200,
              }}
            >
              <img src={preview.url} alt={preview.fileName} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: T.radiusSm, boxShadow: T.shadowMd }} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '14px 18px',
                borderTop: `1px solid ${T.border}`,
                background: '#fafbfc',
              }}
            >
              <Btn variant="secondary" onClick={() => downloadDocument(id, preview.id, preview.fileName)}>Download</Btn>
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

/* ==========================================================================
   Banner helper (local to this file — move to shared if reused)
   ========================================================================== */
function bannerStyle(tone, extra = {}) {
  const map = {
    error: { bg: T.dangerSoft, fg: T.danger, border: T.dangerBorder },
    warn: { bg: T.warnSoft, fg: T.warn, border: `${T.warn}55` },
    success: { bg: T.successSoft, fg: T.success, border: `${T.success}55` },
  }[tone];
  return {
    padding: '12px 16px',
    marginBottom: 16,
    background: map.bg,
    color: map.fg,
    border: `1px solid ${map.border}`,
    borderRadius: T.radiusSm,
    fontSize: 13,
    fontFamily: T.font,
    ...extra,
  };
}
