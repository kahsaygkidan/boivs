import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveBoRecord, ceaseBoRecord, deleteDocument, downloadDocument,
  fetchDocumentBlobUrl, getBoRecord, listAuditLogs, listDocuments, removeBoRecord,
  rejectBoRecord, submitBoRecord, updateBoRecord, uploadDocument,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import BoEditForm from '../components/BoEditForm.jsx';
import UboInfoTable from '../components/UboInfoTable.jsx';
import {
  CheckIcon, CloseIcon, DownloadIcon,
  BackIcon, BanIcon, EditIcon, SendIcon, TrashIcon, EyeIcon, UploadIcon,
  FileIcon, ImageIcon, AlertIcon, InfoIcon, CheckCircleIcon,
} from '../components/icons.jsx'; // adjust the path/file name to your icon system
import './RecordDetail.css';

/* ==========================================================================
   Icons — from the Dashen icon system
   ========================================================================== */
const Icons = {
  back: <BackIcon size={14} />,
  approve: <CheckIcon size={16} />,
  reject: <CloseIcon size={16} />,
  cease: <BanIcon />,
  edit: <EditIcon />,
  submit: <SendIcon />,
  trash: <TrashIcon />,
  download: <DownloadIcon size={16} />,
  eye: <EyeIcon />,
  upload: <UploadIcon size={20} />,
  file: <FileIcon size={18} />,
  fileLarge: <FileIcon size={28} />,
  image: <ImageIcon size={18} />,
  alert: <AlertIcon />,
  info: <InfoIcon />,
  close: <CloseIcon size={16} />,
  check: <CheckCircleIcon />,
};

/* ==========================================================================
   Helpers
   ========================================================================== */
const formatDateTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 19) : '');

const formatSize = (bytes = 0) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const isImage = (doc) => (doc.contentType || '').startsWith('image/');

/* ==========================================================================
   Small presentational components
   ========================================================================== */
function Btn({ variant = 'primary', size = 'md', block, icon, children, className = '', ...props }) {
  const cls = `rd-btn rd-btn--${variant} rd-btn--${size}${block ? ' rd-btn--block' : ''} ${className}`;
  return (
    <button type="button" className={cls.trim()} {...props}>
      {icon && <span className="rd-btn__icon">{icon}</span>}
      {children}
    </button>
  );
}

function Card({ title, meta, children, className = '' }) {
  return (
    <section className={`rd-card ${className}`.trim()}>
      {title && (
        <header className="rd-card__head">
          <h2 className="rd-card__title">{title}</h2>
          {meta && <span className="rd-card__meta">{meta}</span>}
        </header>
      )}
      <div className="rd-card__body">{children}</div>
    </section>
  );
}

function Banner({ tone = 'error', children }) {
  return (
    <div className={`rd-banner rd-banner--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="rd-banner__icon">{tone === 'success' ? Icons.check : Icons.alert}</span>
      <span className="rd-banner__text">{children}</span>
    </div>
  );
}

function RejectionBanner({ reason, by, at }) {
  return (
    <div className="rd-rejected" role="alert">
      <span className="rd-rejected__icon">{Icons.reject}</span>
      <div className="rd-rejected__body">
        <div className="rd-rejected__title">This record was rejected</div>
        <div className="rd-rejected__reason">{reason}</div>
        {(by || at) && (
          <div className="rd-rejected__meta">
            {by && <>Rejected by <strong>{by}</strong></>}
            {by && at && ' on '}
            {at}
          </div>
        )}
      </div>
    </div>
  );
}

function RejectPanel({ reason, onChange, onConfirm, onCancel, busy }) {
  const textareaRef = useRef(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);
  const canConfirm = reason.trim().length > 0 && !busy;

  return (
    <div className="rd-reject">
      <label className="rd-reject__label" htmlFor="rd-reject-reason">Why is this record being rejected?</label>
      <textarea
        id="rd-reject-reason"
        ref={textareaRef}
        className="rd-reject__textarea"
        placeholder="The maker will see this message. Be specific about what to fix."
        value={reason}
        onChange={onChange}
        rows={4}
      />
      <div className="rd-reject__count">{reason.trim().length} characters</div>
      <div className="rd-reject__buttons">
        <Btn variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Btn>
        <Btn variant="danger" size="sm" disabled={!canConfirm} onClick={onConfirm}>
          {busy ? 'Rejecting…' : 'Reject record'}
        </Btn>
      </div>
    </div>
  );
}

function Modal({ title, onClose, size, children, footer }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div
        className={`rd-modal${size === 'sm' ? ' rd-modal--sm' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rd-modal__head">
          <h2 className="rd-modal__title">{title}</h2>
          <button ref={closeRef} type="button" className="rd-icon-btn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </div>
        {children}
        {footer && <div className="rd-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

function DocumentRow({ doc, canDelete, busy, previewLoading, onView, onDownload, onDelete }) {
  return (
    <li className="rd-doc">
      <span className="rd-doc__icon">{isImage(doc) ? Icons.image : Icons.file}</span>
      <div className="rd-doc__info">
        <div className="rd-doc__name" title={doc.fileName}>{doc.fileName}</div>
        <div className="rd-doc__size">{formatSize(doc.sizeBytes)}</div>
      </div>
      <div className="rd-doc__actions">
        {isImage(doc) && (
          <Btn variant="secondary" size="sm" icon={Icons.eye} disabled={previewLoading} onClick={() => onView(doc)}>
            View
          </Btn>
        )}
        <Btn variant="secondary" size="sm" icon={Icons.download} onClick={() => onDownload(doc)}>
          Download
        </Btn>
        {canDelete && (
          <Btn variant="dangerOutline" size="sm" icon={Icons.trash} disabled={busy} onClick={() => onDelete(doc)}>
            Delete
          </Btn>
        )}
      </div>
    </li>
  );
}

function UploadZone({ file, onFile, onUpload, busy }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const pick = (f) => onFile(f || null);

  // Clear the native input when the parent resets the file, so the same file can be picked again.
  useEffect(() => { if (!file && inputRef.current) inputRef.current.value = ''; }, [file]);

  return (
    <>
      <label
        className={`rd-drop${dragging ? ' rd-drop--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
      >
        <input ref={inputRef} type="file" className="rd-drop__input" onChange={(e) => pick(e.target.files?.[0])} />
        <span className="rd-drop__icon">{Icons.upload}</span>
        <span className="rd-drop__text">
          {file
            ? <span className="rd-drop__file">{file.name} ({formatSize(file.size)})</span>
            : <><strong>Choose a file</strong> or drop it here</>}
        </span>
        {file && (
          <>
            <Btn variant="ghost" size="sm" disabled={busy} onClick={(e) => { e.preventDefault(); onFile(null); }}>
              Remove
            </Btn>
            <Btn variant="primary" size="sm" disabled={busy} onClick={(e) => { e.preventDefault(); onUpload(); }}>
              {busy ? 'Uploading…' : 'Upload'}
            </Btn>
          </>
        )}
      </label>
    </>
  );
}

function AuditTimeline({ logs }) {
  return (
    <ol className="rd-timeline">
      {logs.map((l) => (
        <li key={l.id} className="rd-timeline__item">
          <span className="rd-timeline__dot" />
          <div className="rd-timeline__body">
            <div className="rd-timeline__row">
              <span className="rd-timeline__action">{l.action}</span>
              <time className="rd-timeline__time">{formatDateTime(l.createdAt)}</time>
            </div>
            <div className="rd-timeline__actor">{l.actorUsername}</div>
          </div>
        </li>
      ))}
    </ol>
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
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hasUpdated, setHasUpdated] = useState(false); // enables Resubmit after a saved edit

  const [uploadFile, setUploadFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [confirm, setConfirm] = useState(null); // { title, message, label, tone, onConfirm }

  const previewRef = useRef(null);
  useEffect(() => { previewRef.current = preview; }, [preview]);

  /* ---------- Data ---------- */
  const load = useCallback(async () => {
    setError(null);
    try {
      const [rec, docs] = await Promise.all([getBoRecord(id), listDocuments(id)]);
      setRecord(rec);
      setDocuments(docs);
      if (roles.isAuditor) {
        const logs = await listAuditLogs({ entityRef: rec.boReference });
        setAuditLogs(logs.content || []);
      }
    } catch (err) {
      setError(err.friendlyMessage || 'Could not load this record. Try again.');
    }
  }, [id, roles.isAuditor]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setHasUpdated(false); }, [id]);

  /* Success messages disappear on their own */
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---------- Actions ---------- */
  const withBusy = (fn, successMessage) => async (...args) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn(...args);
      await load();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err.friendlyMessage || 'That action did not complete. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = withBusy(() => approveBoRecord(id), 'Record approved.');
  const handleCease = withBusy(() => ceaseBoRecord(id), 'Record marked as ceased.');

  const handleSave = withBusy(async (payload) => {
    await updateBoRecord(id, payload);
    setEditing(false);
    setHasUpdated(true);
  }, 'Changes saved. You can resubmit for verification.');

  const handleResubmit = withBusy(async () => {
    if (!hasUpdated) throw { friendlyMessage: 'Update the record before resubmitting for verification.' };
    await submitBoRecord(id);
    setHasUpdated(false);
  }, 'Record submitted for verification.');

  const handleReject = withBusy(async () => {
    if (!rejectReason.trim()) throw { friendlyMessage: 'Enter a rejection reason.' };
    await rejectBoRecord(id, rejectReason.trim());
    setShowReject(false);
    setRejectReason('');
  }, 'Record rejected.');

  const handleCancelReject = () => {
    setShowReject(false);
    setRejectReason('');
  };

  const handleUpload = withBusy(async () => {
    if (!uploadFile) return;
    await uploadDocument(id, uploadFile);
    setUploadFile(null);
  }, 'Document uploaded.');

  const handleDelete = withBusy((docId) => deleteDocument(id, docId), 'Document deleted.');

  const handleRemove = withBusy(async () => {
    await removeBoRecord(id);
    onBack();
  });

  /* Destructive actions go through one confirmation dialog */
  const askConfirm = (config) => setConfirm(config);
  const runConfirm = async () => {
    const action = confirm?.onConfirm;
    setConfirm(null);
    if (action) await action();
  };

  /* ---------- Preview ---------- */
  const handleView = async (doc) => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { url, contentType } = await fetchDocumentBlobUrl(id, doc.id);
      setPreview({ id: doc.id, url, fileName: doc.fileName, contentType: contentType || doc.contentType });
    } catch (err) {
      setPreviewError(err.friendlyMessage || 'Could not load the preview. Try downloading the file instead.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = useCallback(() => {
    if (previewRef.current) window.URL.revokeObjectURL(previewRef.current.url);
    setPreview(null);
  }, []);

  useEffect(() => () => {
    if (previewRef.current) window.URL.revokeObjectURL(previewRef.current.url);
  }, []);

  /* ---------- Loading / failed to load ---------- */
  if (!record) {
    return (
      <div className="rd">
        <Btn variant="ghost" size="sm" icon={Icons.back} onClick={onBack} className="rd-back">Back to records</Btn>
        {error ? (
          <Banner>{error}</Banner>
        ) : (
          <div className="rd-loading" role="status">
            <span className="rd-spinner" aria-hidden="true" />
            Loading record…
          </div>
        )}
      </div>
    );
  }

  /* ---------- Derived ---------- */
  const isPending = record.status === 'PENDING';
  const isVerified = record.status === 'VERIFIED';
  const isRejected = record.status === 'REJECTED';
  const isDraft = record.status === 'DRAFT';

  const showReviewActions = roles.isChecker && isPending;
  const showCeaseAction = roles.isChecker && isVerified;
  const showMakerActions = roles.isMaker && (isDraft || isPending || isRejected);
  const canSubmit = isDraft || isRejected;
  const canRemove = isDraft || isPending;
  const hasAnyAction = showReviewActions || showCeaseAction || showMakerActions;

  const rejectReasonStored = record.rejectionReason || record.rejectReason || record.rejectionNote || '';
  const showRejectBanner = isRejected && String(rejectReasonStored).trim();

  return (
    <div className="rd">
      {/* ==================== Header ==================== */}
      <header className="rd-header">
        <Btn variant="ghost" size="sm" icon={Icons.back} onClick={onBack} className="rd-back">
          Back to records
        </Btn>
        <div className="rd-title-row">
          <h1 className="rd-title">{record.boReference}</h1>
          <StatusBadge status={record.status} />
        </div>
        <div className="rd-subtitle">
          <strong>{record.fullName}</strong>
          <span>{record.legalPersonName}</span>
        </div>
      </header>

      {error && <Banner>{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}
      {showRejectBanner && (
        <RejectionBanner
          reason={String(rejectReasonStored).trim()}
          by={record.rejectedBy}
          at={formatDateTime(record.rejectedAt)}
        />
      )}

      <div className="rd-grid">
        {/* ----- Main column ----- */}
        <div className="rd-main">
          {editing && (
            <Card title="Update record" className="rd-card--editing">
              <BoEditForm record={record} busy={busy} onSave={handleSave} onCancel={() => setEditing(false)} />
            </Card>
          )}

          <Card title="UBO information">
            <UboInfoTable record={record} documents={documents} />
          </Card>

          <Card
            title="Documents"
            meta={documents.length > 0 && `${documents.length} file${documents.length === 1 ? '' : 's'}`}
          >
            {previewError && <Banner>{previewError}</Banner>}

            {documents.length === 0 ? (
              <div className="rd-empty">
                <span className="rd-empty__icon">{Icons.fileLarge}</span>
                <div className="rd-empty__title">No documents yet</div>
                <div>{roles.isMaker ? 'Upload evidence to support this record.' : 'Evidence uploaded by the maker will appear here.'}</div>
              </div>
            ) : (
              <ul className="rd-doc-list">
                {documents.map((d) => (
                  <DocumentRow
                    key={d.id}
                    doc={d}
                    canDelete={roles.isMaker}
                    busy={busy}
                    previewLoading={previewLoading}
                    onView={handleView}
                    onDownload={(doc) => downloadDocument(id, doc.id, doc.fileName)}
                    onDelete={(doc) => askConfirm({
                      title: 'Delete this document?',
                      message: `${doc.fileName} will be permanently removed from this record.`,
                      label: 'Delete document',
                      tone: 'danger',
                      onConfirm: () => handleDelete(doc.id),
                    })}
                  />
                ))}
              </ul>
            )}

            {roles.isMaker && (
              <UploadZone file={uploadFile} onFile={setUploadFile} onUpload={handleUpload} busy={busy} />
            )}
          </Card>

          {roles.isAuditor && (
            <Card
              title="Audit trail"
              meta={auditLogs.length > 0 && `${auditLogs.length} entr${auditLogs.length === 1 ? 'y' : 'ies'}`}
            >
              {auditLogs.length === 0
                ? <div className="rd-empty"><div className="rd-empty__title">No audit entries yet</div></div>
                : <AuditTimeline logs={auditLogs} />}
            </Card>
          )}
        </div>

        {/* ----- Side column: actions ----- */}
        <aside className="rd-side">
          <Card title="Actions" className="rd-card--flush">
            <div className="rd-actions">
              {showReviewActions && (
                <>
                  <p className="rd-actions__hint">Review the details and documents, then approve or reject.</p>
                  <Btn variant="success" icon={Icons.approve} block disabled={busy || showReject} onClick={handleApprove}>
                    Approve
                  </Btn>
                  <Btn
                    variant="dangerOutline"
                    icon={Icons.reject}
                    block
                    disabled={busy}
                    onClick={() => (showReject ? handleCancelReject() : setShowReject(true))}
                  >
                    {showReject ? 'Cancel rejection' : 'Reject'}
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
                </>
              )}

              {showCeaseAction && (
                <Btn
                  variant="secondary"
                  icon={Icons.cease}
                  block
                  disabled={busy}
                  onClick={() => askConfirm({
                    title: 'Mark this record as ceased?',
                    message: `${record.fullName} will no longer be treated as a beneficial owner of ${record.legalPersonName}.`,
                    label: 'Mark as ceased',
                    tone: 'danger',
                    onConfirm: handleCease,
                  })}
                >
                  Mark as ceased
                </Btn>
              )}

              {showMakerActions && (
                <>
                  {showReviewActions && <div className="rd-actions__divider" />}
                  <Btn variant="secondary" icon={Icons.edit} block disabled={busy} onClick={() => setEditing((v) => !v)}>
                    {editing ? 'Cancel update' : 'Update'}
                  </Btn>

                  {canSubmit && (
                    <>
                      <Btn
                        variant="primary"
                        icon={Icons.submit}
                        block
                        disabled={!hasUpdated || busy}
                        onClick={handleResubmit}
                      >
                        {busy ? 'Submitting…' : 'Resubmit for verification'}
                      </Btn>
                      {!hasUpdated && (
                        <div className="rd-note">
                          <span className="rd-note__icon">{Icons.info}</span>
                          <span>Save an update first. Resubmit unlocks once you change the record.</span>
                        </div>
                      )}
                    </>
                  )}

                  {canRemove && (
                    <Btn
                      variant="dangerOutline"
                      icon={Icons.trash}
                      block
                      disabled={busy}
                      onClick={() => askConfirm({
                        title: `Remove ${record.boReference}?`,
                        message: 'It will be withdrawn from verification. You can register the person again later.',
                        label: 'Remove record',
                        tone: 'danger',
                        onConfirm: handleRemove,
                      })}
                    >
                      Remove from list
                    </Btn>
                  )}
                </>
              )}

              {!hasAnyAction && (
                <p className="rd-actions__hint">No actions are available for your role at this stage.</p>
              )}
            </div>
          </Card>
        </aside>
      </div>

      {/* ==================== Image preview ==================== */}
      {preview && (
        <Modal
          title={preview.fileName}
          onClose={closePreview}
          footer={(
            <>
              <Btn variant="secondary" icon={Icons.download} onClick={() => downloadDocument(id, preview.id, preview.fileName)}>
                Download
              </Btn>
              <Btn variant="primary" onClick={closePreview}>Close</Btn>
            </>
          )}
        >
          <div className="rd-modal__stage">
            <img className="rd-modal__img" src={preview.url} alt={preview.fileName} />
          </div>
        </Modal>
      )}

      {/* ==================== Confirm dialog ==================== */}
      {confirm && (
        <Modal
          size="sm"
          title={confirm.title}
          onClose={() => setConfirm(null)}
          footer={(
            <>
              <Btn variant="secondary" onClick={() => setConfirm(null)}>Cancel</Btn>
              <Btn variant={confirm.tone === 'danger' ? 'danger' : 'primary'} onClick={runConfirm}>
                {confirm.label}
              </Btn>
            </>
          )}
        >
          <p className="rd-modal__body">{confirm.message}</p>
        </Modal>
      )}
    </div>
  );
}
