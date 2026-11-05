import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveBoRecord, ceaseBoRecord, deleteDocument, downloadDocument,
  fetchDocumentBlobUrl, getBoRecord, listAuditLogs, listDocuments, removeBoRecord,
  rejectBoRecord, submitBoRecord, updateBoRecord, uploadDocument,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import BoEditForm from '../components/BoEditForm.jsx';
import UboInfoTable from '../components/UboInfoTable.jsx';
import './RecordDetail.css';

const Icon = ({ name, size = 17 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    back: <path d="M15 18l-6-6 6-6" />,
    approve: <><path d="m5 12 4 4L19 6" /></>,
    reject: <><path d="m18 6-12 12M6 6l12 12" /></>,
    cease: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    submit: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    quote: <path d="M7 7h4v4H7a2 2 0 0 1-2-2V7m10 0h4v4h-4a2 2 0 0 1-2-2V7" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  };
  return <svg {...common}>{paths[name] || paths.file}</svg>;
};

function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...props }) {
  return (
    <button type="button" className={`rd-btn rd-btn--${variant} rd-btn--${size} ${className}`.trim()} {...props}>
      {icon && <span className="rd-btn__icon"><Icon name={icon} /></span>}
      {children}
    </button>
  );
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rd-panel ${className}`}>
      {(title || subtitle || action) && (
        <header className="rd-panel__header">
          <div className="rd-panel__heading">
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action && <div className="rd-panel__action">{action}</div>}
        </header>
      )}
      <div className="rd-panel__body">{children}</div>
    </section>
  );
}

function Notice({ tone = 'error', children }) {
  return (
    <div className={`rd-notice rd-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name="alert" />
      <div>{children}</div>
    </div>
  );
}

function RejectPanel({ reason, onChange, onConfirm, onCancel, busy }) {
  const hasText = reason.trim().length > 0;
  return (
    <div className="rd-reject">
      <div className="rd-reject__title"><Icon name="reject" /> Rejection reason</div>
      <label className="rd-sr-only" htmlFor="rd-reject-reason">Rejection reason</label>
      <textarea
        id="rd-reject-reason"
        value={reason}
        onChange={onChange}
        rows={4}
        maxLength={2000}
        placeholder="Explain why this record is being rejected…"
        autoFocus
      />
      {hasText && (
        <div className="rd-reject__preview">
          <div className="rd-reject__preview-label"><Icon name="quote" /> Preview — what the maker will see</div>
          <p>{reason.trim()}</p>
          <span>{reason.trim().length} characters</span>
        </div>
      )}
      <div className="rd-reject__buttons">
        <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button variant="danger" size="sm" disabled={!hasText || busy} onClick={onConfirm}>
          {busy ? 'Rejecting…' : 'Confirm rejection'}
        </Button>
      </div>
    </div>
  );
}

function RejectionNotice({ reason, meta, banner = false }) {
  if (!reason || !String(reason).trim()) return null;
  return (
    <section className={`rd-rejection ${banner ? 'rd-rejection--banner' : ''}`}>
      <div className="rd-rejection__heading">
        <span className="rd-rejection__icon"><Icon name="reject" /></span>
        <div>
          <strong>{banner ? 'This record was rejected' : 'Rejection reason'}</strong>
          {!banner && meta?.at && <time>{meta.at}</time>}
        </div>
      </div>
      <p>{String(reason).trim()}</p>
      {meta?.by && <small>Rejected by <strong>{meta.by}</strong>{meta.at ? ` · ${meta.at}` : ''}</small>}
    </section>
  );
}

function EmptyState({ title, description, icon = 'file' }) {
  return (
    <div className="rd-empty">
      <span><Icon name={icon} size={25} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export default function RecordDetail({ id, roles = {}, onBack }) {
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [hasUpdated, setHasUpdated] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => { previewRef.current = preview; }, [preview]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [rec, docs] = await Promise.all([getBoRecord(id), listDocuments(id)]);
      setRecord(rec);
      setDocuments(Array.isArray(docs) ? docs : []);
      if (roles.isAuditor) {
        const logs = await listAuditLogs({ entityRef: rec.boReference });
        setAuditLogs(logs?.content || []);
      } else {
        setAuditLogs([]);
      }
    } catch (err) {
      setError(err?.friendlyMessage || 'Unable to load this record. Please try again.');
    }
  }, [id, roles.isAuditor]);

  useEffect(() => { load(); }, [load]);

  const runAction = useCallback((action) => async (...args) => {
    setBusy(true);
    setError('');
    try {
      await action(...args);
      await load();
    } catch (err) {
      setError(err?.friendlyMessage || err?.message || 'The requested action could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [load]);

  const handleApprove = runAction(() => approveBoRecord(id));
  const handleCease = runAction(() => ceaseBoRecord(id));
  const handleSave = runAction(async (payload) => {
    await updateBoRecord(id, payload);
    setEditing(false);
    setHasUpdated(true);
  });
  const handleResubmit = runAction(async () => {
    if (!hasUpdated) throw new Error('Update the record before resubmitting for verification.');
    await submitBoRecord(id);
    setHasUpdated(false);
  });
  const handleReject = runAction(async () => {
    if (!rejectReason.trim()) throw new Error('A rejection reason is required.');
    await rejectBoRecord(id, rejectReason.trim());
    setShowReject(false);
    setRejectReason('');
  });
  const handleUpload = runAction(async () => {
    if (!uploadFile) return;
    await uploadDocument(id, uploadFile);
    setUploadFile(null);
  });
  const handleDelete = runAction((docId) => deleteDocument(id, docId));

  const handleRemove = async () => {
    const reference = record?.boReference || 'this record';
    if (!window.confirm(`Remove ${reference} from the list?\n\nIt will be withdrawn from verification.`)) return;
    setBusy(true);
    setError('');
    try {
      await removeBoRecord(id);
      onBack?.();
    } catch (err) {
      setError(err?.friendlyMessage || 'Failed to remove the record.');
      setBusy(false);
    }
  };

  const handleView = async (doc) => {
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const result = await fetchDocumentBlobUrl(id, doc.id);
      setPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { id: doc.id, url: result.url, fileName: doc.fileName, contentType: result.contentType || doc.contentType };
      });
    } catch (err) {
      setPreviewError(err?.friendlyMessage || 'Unable to load the document preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => () => {
    if (previewRef.current?.url) URL.revokeObjectURL(previewRef.current.url);
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  if (!record) {
    return (
      <main className="rd-page">
        <Button variant="outline" size="sm" icon="back" onClick={onBack}>Back to records</Button>
        {error ? <Notice>{error}</Notice> : (
          <div className="rd-loading"><span className="rd-spinner" /> Loading record details…</div>
        )}
      </main>
    );
  }

  const showCheckerActions = roles.isChecker && ['PENDING', 'VERIFIED'].includes(record.status);
  const showMakerActions = roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status);
  const hasAnyAction = showCheckerActions || showMakerActions;
  const rejectionReason = record.rejectionReason || record.rejectReason || record.rejectionNote || '';
  const rejectionMeta = {
    by: record.rejectedBy || null,
    at: record.rejectedAt ? String(record.rejectedAt).replace('T', ' ').slice(0, 19) : null,
  };

  return (
    <main className="rd-page">
      <header className="rd-page-header">
        <Button variant="outline" size="sm" icon="back" onClick={onBack}>Back to records</Button>
        <div className="rd-record-heading">
          <div className="rd-record-heading__main">
            <div className="rd-record-heading__eyebrow">Beneficial ownership record</div>
            <div className="rd-record-heading__title">
              <h1>{record.boReference}</h1>
              <StatusBadge status={record.status} />
            </div>
            <p><strong>{record.fullName || 'Name not provided'}</strong><span>•</span>{record.legalPersonName || 'Legal entity not provided'}</p>
          </div>
          <div className="rd-record-heading__secure"><Icon name="file" size={15} /> Record details</div>
        </div>
      </header>

      {error && <Notice>{error}</Notice>}
      {record.status === 'REJECTED' && <RejectionNotice reason={rejectionReason} banner />}

      <div className="rd-layout">
        <div className="rd-main-column">
          {editing && (
            <Panel title="Update record" subtitle="Review and save the changes before resubmitting." className="rd-edit-panel">
              <BoEditForm record={record} busy={busy} onSave={handleSave} onCancel={() => setEditing(false)} />
            </Panel>
          )}

          <Panel title="UBO information" subtitle="Beneficial ownership details associated with this legal entity.">
            <UboInfoTable record={record} documents={documents} />
          </Panel>

          <Panel
            title="Supporting documents"
            subtitle="Evidence and files attached to this beneficial ownership record."
            action={<span className="rd-count">{documents.length} {documents.length === 1 ? 'file' : 'files'}</span>}
          >
            {previewError && <Notice tone="error">{previewError}</Notice>}
            {documents.length === 0 ? (
              <EmptyState title="No documents uploaded" description="Supporting evidence uploaded for this record will appear here." />
            ) : (
              <div className="rd-document-list">
                {documents.map((doc) => (
                  <article className="rd-document" key={doc.id}>
                    <span className="rd-document__icon"><Icon name="file" size={19} /></span>
                    <div className="rd-document__meta">
                      <strong title={doc.fileName}>{doc.fileName}</strong>
                      <span>{Math.max(1, Math.round((doc.sizeBytes || 0) / 1024))} KB <i>·</i> {doc.contentType || 'File'}</span>
                    </div>
                    <div className="rd-document__actions">
                      {(doc.contentType || '').startsWith('image/') && (
                        <Button variant="outline" size="sm" icon="eye" disabled={previewLoading || busy} onClick={() => handleView(doc)}>Preview</Button>
                      )}
                      <Button variant="outline" size="sm" icon="download" disabled={busy} onClick={() => downloadDocument(id, doc.id, doc.fileName)}>Download</Button>
                      {roles.isMaker && <Button variant="danger-outline" size="sm" icon="trash" disabled={busy} onClick={() => handleDelete(doc.id)}>Delete</Button>}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {roles.isMaker && (
              <div className="rd-upload">
                <label className="rd-upload__picker">
                  <Icon name="upload" />
                  <span>{uploadFile ? uploadFile.name : 'Choose a supporting document'}</span>
                  <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
                </label>
                <Button icon="upload" size="md" disabled={!uploadFile || busy} onClick={handleUpload}>Upload document</Button>
              </div>
            )}
          </Panel>

          {roles.isAuditor && (
            <Panel title="Audit trail" subtitle="Chronological history of actions performed on this record." action={<span className="rd-count">{auditLogs.length} {auditLogs.length === 1 ? 'entry' : 'entries'}</span>}>
              {auditLogs.length === 0 ? <EmptyState title="No audit activity" description="Audit events will be listed here when available." /> : (
                <ol className="rd-audit-list">
                  {auditLogs.map((log, index) => (
                    <li className="rd-audit-item" key={log.id || `${log.action}-${index}`}>
                      <span className="rd-audit-item__marker"><span /></span>
                      <div className="rd-audit-item__content">
                        <strong>{log.action || 'Record activity'}</strong>
                        <span>{log.actorUsername || 'System'}</span>
                      </div>
                      <time>{(log.createdAt || '').replace('T', ' ').slice(0, 19)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}
        </div>

        <aside className="rd-side-column">
          {rejectionReason && record.status === 'REJECTED' && <RejectionNotice reason={rejectionReason} meta={rejectionMeta} />}
          <Panel title="Workflow actions" subtitle="Available actions depend on your role and the record status." className="rd-actions-panel">
            {record.status === 'PENDING' && roles.isChecker && (
              <div className="rd-action-stack">
                <Button variant="success" icon="approve" disabled={busy || showReject} onClick={handleApprove}>Approve record</Button>
                <Button variant="danger-outline" icon="reject" disabled={busy} onClick={() => setShowReject((value) => !value)}>{showReject ? 'Close rejection' : 'Reject record'}</Button>
                {showReject && <RejectPanel reason={rejectReason} onChange={(event) => setRejectReason(event.target.value)} onConfirm={handleReject} onCancel={() => { setShowReject(false); setRejectReason(''); }} busy={busy} />}
              </div>
            )}

            {record.status === 'VERIFIED' && roles.isChecker && (
              <div className="rd-action-stack">
                <Button variant="outline" icon="cease" disabled={busy} onClick={handleCease}>Mark as ceased</Button>
              </div>
            )}

            {roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status) && (
              <div className="rd-action-stack">
                <Button variant="outline" icon="edit" disabled={busy} onClick={() => setEditing((value) => !value)}>{editing ? 'Close editor' : 'Update record'}</Button>
                {['DRAFT', 'REJECTED'].includes(record.status) && (
                  <>
                    <Button icon="submit" disabled={!hasUpdated || busy} onClick={handleResubmit}>Resubmit for verification</Button>
                    {!hasUpdated && <div className="rd-action-hint"><Icon name="info" /> Save an update before resubmitting this record.</div>}
                  </>
                )}
                {['DRAFT', 'PENDING'].includes(record.status) && (
                  <Button variant="danger-outline" icon="trash" disabled={busy} onClick={handleRemove}>Remove from list</Button>
                )}
              </div>
            )}

            {!hasAnyAction && <p className="rd-no-actions">No actions are available for your role at this workflow stage.</p>}
          </Panel>
        </aside>
      </div>

      {preview && (
        <div className="rd-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
          <section className="rd-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${preview.fileName}`}>
            <header className="rd-preview-modal__header">
              <div><span>Document preview</span><strong title={preview.fileName}>{preview.fileName}</strong></div>
              <button type="button" className="rd-icon-button" aria-label="Close preview" onClick={closePreview}><Icon name="close" /></button>
            </header>
            <div className="rd-preview-modal__body">
              {preview.contentType?.startsWith('image/') ? (
                <img src={preview.url} alt={preview.fileName} />
              ) : (
                <div className="rd-preview-fallback"><Icon name="file" size={34} /><strong>Preview unavailable</strong><span>This file type cannot be displayed here. Download the document to view it.</span></div>
              )}
            </div>
            <footer className="rd-preview-modal__footer">
              <Button variant="outline" icon="download" onClick={() => downloadDocument(id, preview.id, preview.fileName)}>Download</Button>
              <Button onClick={closePreview}>Close preview</Button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
