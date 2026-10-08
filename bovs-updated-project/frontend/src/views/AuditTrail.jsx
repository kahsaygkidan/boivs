import { useEffect, useState } from 'react'
import { listAuditLogs } from '../api/bovsApi.js'

export default function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [entityRef, setEntityRef] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAuditLogs({ entityRef: entityRef || undefined, size: 50 })
      .then((res) => !cancelled && setLogs(res.content || []))
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load audit trail'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [entityRef])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Audit trail</h1>
          <div className="desc">Every create, submit, approve, reject, and cease action, with actor and timestamp.</div>
        </div>
      </div>

      <div className="toolbar">
        <input
          placeholder="Filter by BO reference (e.g. BO-2026-00142)"
          value={entityRef}
          onChange={(e) => setEntityRef(e.target.value)}
          style={{ minWidth: 300 }}
        />
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="table-card">
        <table>
          <thead>
            <tr><th>When</th><th>Entity</th><th>Action</th><th>Actor</th><th>Roles</th><th>Details</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6}>Loading…</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={6}>No audit entries found.</td></tr>}
            {!loading && logs.map((l) => (
              <tr key={l.id}>
                <td className="ref">{(l.createdAt || '').replace('T', ' ').slice(0, 19)}</td>
                <td className="ref mono">{l.entityRef}</td>
                <td>{l.action}</td>
                <td>{l.actorUsername}</td>
                <td className="ref">{l.actorRoles}</td>
                <td>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
