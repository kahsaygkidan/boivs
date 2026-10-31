import { Fragment, useEffect, useState } from 'react'
import { approveBoRecord, downloadDocument, getQueue, listDocuments, rejectBoRecord } from '../api/bovsApi.js'
import UboInfoTable from '../components/UboInfoTable.jsx'

export default function Queue({ onOpen }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [docs, setDocs] = useState({}) // boId -> documents

  const load = () => {
    setLoading(true)
    return getQueue({ size: 50 })
      .then((res) => setRecords(res.content || []))
      .catch((err) => setError(err.friendlyMessage || 'Failed to load queue'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const toggleReview = (id) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!docs[id]) {
      listDocuments(id)
        .then((list) => setDocs((d) => ({ ...d, [id]: list })))
        .catch(() => setDocs((d) => ({ ...d, [id]: [] })))
    }
  }

  const handleApprove = async (id) => {
    setBusyId(id)
    setError(null)
    try {
      await approveBoRecord(id)
      await load()
    } catch (err) {
      setError(err.friendlyMessage || 'Approval failed')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (id) => {
    if (!reason.trim()) {
      setError('A rejection reason is required')
      return
    }
    setBusyId(id)
    setError(null)
    try {
      await rejectBoRecord(id, reason.trim())
      setRejectingId(null)
      setReason('')
      await load()
    } catch (err) {
      setError(err.friendlyMessage || 'Rejection failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Verification queue</h1>
          <div className="desc">Records awaiting checker review, sorted by submission date.</div>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="table-card">
        <table>
          <thead>
            <tr><th>BO Reference</th><th>Full name</th><th>Customer</th><th>Ownership</th><th>Submitted by</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}>Loading…</td></tr>}
            {!loading && records.length === 0 && <tr><td colSpan={7}>Queue is empty.</td></tr>}
            {!loading && records.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="ref mono" onClick={() => onOpen?.(r.id)} style={{ cursor: onOpen ? 'pointer' : 'default' }}>{r.boReference}</td>
                  <td>{r.fullName}</td>
                  <td>{r.legalPersonName}</td>
                  <td>{Number(r.ownershipPercentage)}% {r.ownershipType === 'INDIRECT' ? 'indirect' : r.ownershipType === 'DIRECT' ? 'direct' : ''}</td>
                  <td>{r.createdBy}</td>
                  <td className="ref">{(r.createdAt || '').replace('T', ' ').slice(0, 16)}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => toggleReview(r.id)}
                    >
                      {expandedId === r.id ? 'Hide details' : 'Review details'}
                    </button>
                    <button
                      className="btn btn-blue"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={busyId === r.id}
                      onClick={() => handleApprove(r.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={busyId === r.id}
                      onClick={() => { setRejectingId(r.id); setReason('') }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr>
                    <td colSpan={7}>
                      <UboInfoTable record={r} documents={docs[r.id] || []} />
                      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
                        {(docs[r.id] || []).map((d) => (
                          <button key={d.id} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => downloadDocument(r.id, d.id, d.fileName)}>
                            Download {d.fileName}
                          </button>
                        ))}
                        <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12, marginLeft: 'auto' }}
                          onClick={() => onOpen?.(r.id)}>Open full record</button>
                      </div>
                    </td>
                  </tr>
                )}
                {rejectingId === r.id && (
                  <tr>
                    <td colSpan={7}>
                      <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
                        <input
                          placeholder="Reason for rejection"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button className="btn btn-blue" onClick={() => handleReject(r.id)} disabled={busyId === r.id}>
                          Confirm reject
                        </button>
                        <button className="btn btn-outline" onClick={() => setRejectingId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
