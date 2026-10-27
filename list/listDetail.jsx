import { useCallback, useEffect, useRef, useState } from 'react';
import {
    approveBoRecord, ceaseBoRecord, deleteDocument, downloadDocument,
    fetchDocumentBlobUrl, getBoRecord, listAuditLogs, listDocuments, removeBoRecord,rejectBoRecord, submitBoRecord, updateBoRecord, uploadDocument,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import BoEditForm from '../components/BoEditForm.jsx';
import UboInfoTable from '../components/UboInfoTable.jsx';

export default function RecordDetail({ id, roles, onBack }) {
  const [record, setRecord] = useState(null)
  const [documents, setDocuments] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [editing, setEditing] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [preview, setPreview] = useState(null) // { id, url, fileName, contentType } | null
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const previewRef = useRef(null)
  useEffect(() => { previewRef.current = preview }, [preview])

  const handleRemove = async () => {
      if (!window.confirm(`Remove ${record.boReference} from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return
      setBusy(true)
      setError(null)
      try {
        await removeBoRecord(id)
        onBack()
      } catch (err) {
        setError(err.friendlyMessage || 'Failed to remove the record')
        setBusy(false)
      }
    }

  const load = useCallback(() => {
    setError(null)
    return Promise.all([
      getBoRecord(id),
      listDocuments(id),
      roles.isAuditor ? listAuditLogs({ entityRef: undefined }) : Promise.resolve({ content: [] }),
    ])
      .then(([rec, docs]) => {
        setRecord(rec)
        setDocuments(docs)
        // Audit log is keyed by BO reference, not id — fetch again once we know it.
        if (roles.isAuditor) {
          return listAuditLogs({ entityRef: rec.boReference }).then((logs) => setAuditLogs(logs.content || []))
        }
      })
      .catch((err) => setError(err.friendlyMessage || 'Failed to load record'))
  }, [id, roles.isAuditor])

  useEffect(() => {
    load()
  }, [load])

  const withBusy = (fn) => async (...args) => {
    setBusy(true)
    setError(null)
    try {
      await fn(...args)
      await load()
    } catch (err) {
      setError(err.friendlyMessage || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = withBusy(() => approveBoRecord(id))
  const handleCease = withBusy(() => ceaseBoRecord(id))
  const handleSave = withBusy(async (payload) => {
    await updateBoRecord(id, payload)
    setEditing(false)
  })
  const handleResubmit = withBusy(() => submitBoRecord(id))
  const handleReject = withBusy(async () => {
    if (!rejectReason.trim()) throw { friendlyMessage: 'A rejection reason is required' }
    await rejectBoRecord(id, rejectReason.trim())
    setShowReject(false)
    setRejectReason('')
  })
  const handleUpload = withBusy(async () => {
    if (!uploadFile) return
    await uploadDocument(id, uploadFile)
    setUploadFile(null)
  })
  const handleDelete = withBusy((docId) => deleteDocument(id, docId))

  const handleView = async (doc) => {
    setPreviewError(null)
    setPreviewLoading(true)
    try {
      const { url, contentType } = await fetchDocumentBlobUrl(id, doc.id)
      setPreview({ id: doc.id, url, fileName: doc.fileName, contentType: contentType || doc.contentType })
    } catch (err) {
      setPreviewError(err.friendlyMessage || 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    if (preview) window.URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  // Release the blob URL if the user navigates away while a preview is open.
  useEffect(() => () => {
    if (previewRef.current) window.URL.revokeObjectURL(previewRef.current.url)
  }, [])

  if (!record) {
    return (
      <div>
        <button className="btn btn-blue" onClick={onBack}>&larr; Back</button>
        {error ? <div className="banner-error" style={{ marginTop: 16 }}>{error}</div> : <div style={{ marginTop: 16 }}>Loading…</div>}
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-blue" style={{ marginBottom: 12 }} onClick={onBack}>&larr; Back</button>
          <h1 className="mono">{record.boReference}</h1>
          <div className="desc">{record.fullName} — {record.legalPersonName}</div>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="form-shell">
        <div>
          {editing && record && (
            <BoEditForm record={record} busy={busy} onSave={handleSave} onCancel={() => setEditing(false)} />
          )}
          <div className="form-card">
            <h3>UBO information</h3>
            <UboInfoTable record={record} documents={documents} />
          </div>

          <div className="form-card">
            <h3>Documents</h3>
            {documents.length === 0 && <div className="hint">No documents uploaded yet.</div>}
            {previewError && <div className="banner-error" style={{ marginBottom: 10 }}>{previewError}</div>}
            {documents.map((d) => (
              <div className="doc-row" key={d.id}>
                <div>{d.fileName} <span className="hint">({Math.round((d.sizeBytes || 0) / 1024)} KB)</span></div>
                <div className="doc-actions">
                  {(d.contentType || '').startsWith('image/') && (
                    <button className="btn btn-blue" disabled={previewLoading} onClick={() => handleView(d)}>
                      View
                    </button>
                  )}
                  <button className="btn btn-blue" onClick={() => downloadDocument(id, d.id, d.fileName)}>Download</button>
                  {roles.isMaker && (
                    <button className="btn btn-blue" disabled={busy} onClick={() => handleDelete(d.id)}>Delete</button>
                  )}
                </div>
              </div>
            ))}
            {roles.isMaker && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                <button className="btn btn-blue" disabled={!uploadFile || busy} onClick={handleUpload}>Upload</button>
              </div>
            )}
          </div>

          {roles.isAuditor && (
            <div className="form-card">
              <h3>Audit trail</h3>
              {auditLogs.length === 0 && <div className="hint">No audit entries yet.</div>}
              {auditLogs.map((l) => (
                <div className="doc-row" key={l.id}>
                  <div>{l.action} — {l.actorUsername}</div>
                  <div className="hint">{(l.createdAt || '').replace('T', ' ').slice(0, 19)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="side-summary">
          <div className="summary-card">
            <h4>Actions</h4>
            {record.status === 'PENDING' && roles.isChecker && (
              <>
                <button className="btn btn-blue" style={{ width: '100%', marginBottom: 8 }} disabled={busy} onClick={handleApprove}>
                  Approve
                </button>
                <button className="btn btn-blue" style={{ width: '100%' }} disabled={busy} onClick={() => setShowReject((v) => !v)}>
                  Reject
                </button>
                {showReject && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      placeholder="Reason for rejection"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <button className="btn btn-blue" style={{ width: '100%' }} disabled={busy} onClick={handleReject}>
                      Confirm reject
                    </button>
                  </div>
                )}
              </>
            )}
            {record.status === 'VERIFIED' && roles.isChecker && (
              <button className="btn btn-blue" style={{ width: '100%' }} disabled={busy} onClick={handleCease}>
                Mark as ceased
              </button>
            )}
            {roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status) && (
              <>
                <button className="btn btn-blue" style={{ width: '100%', marginBottom: 8 }} disabled={busy}
                  onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Cancel Update' : 'Update'}
                </button>
                {['DRAFT', 'PENDING'].includes(record.status) && (
                    <button className="btn btn-danger-outline" style={{ width: '100%' }} disabled={busy} onClick={handleRemove}>
                      Remove from list
                    </button>
                  )}
                {['DRAFT', 'REJECTED'].includes(record.status) && (
                  <button className="btn btn-blue" style={{ width: '100%' }} disabled={busy} onClick={handleResubmit}>
                    Submit for verification
                  </button>
                )}
              </>
            )}
            {!(roles.isChecker && (record.status === 'PENDING' || record.status === 'VERIFIED'))
              && !(roles.isMaker && ['DRAFT', 'PENDING', 'REJECTED'].includes(record.status)) && (
              <div className="hint">No actions available for your role at this stage.</div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div className="doc-preview-overlay" onClick={closePreview}>
          <div className="doc-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-preview-header">
              <span className="doc-preview-name">{preview.fileName}</span>
              <button className="icon-btn" aria-label="Close preview" onClick={closePreview}>✕</button>
            </div>
            <div className="doc-preview-body">
              <img src={preview.url} alt={preview.fileName} />
            </div>
            <div className="doc-preview-footer">
              <button className="btn btn-blue" onClick={() => downloadDocument(id, preview.id, preview.fileName)}>
                Download
              </button>
              <button className="btn btn-blue" onClick={closePreview}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
