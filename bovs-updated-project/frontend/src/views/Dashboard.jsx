import { useEffect, useState } from 'react'
import { getDashboardStats, searchBoRecords } from '../api/bovsApi.js'
import StatusBadge from '../components/StatusBadge.jsx'

export default function Dashboard({ onRegister, canRegister, onOpen }) {
  const [stats, setStats] = useState(null)
  const [records, setRecords] = useState([])
  const [status, setStatus] = useState('')
  const [pep, setPep] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getDashboardStats(),
      searchBoRecords({ status: status || undefined, pep: pep === '' ? undefined : pep === 'true', size: 20 }),
    ])
      .then(([statsRes, recordsRes]) => {
        if (cancelled) return
        setStats(statsRes)
        setRecords(recordsRes.content || [])
        setError(null)
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load dashboard'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [status, pep])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <div className="desc">Beneficial ownership records across all registered legal persons.</div>
        </div>
        {canRegister && (
          <button className="btn btn-blue" onClick={onRegister}>+ Register beneficial owner</button>
        )}
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className="stat-row">
        <div className="stat-card"><div className="label">Total BO records</div><div className="value">{stats?.total ?? '—'}</div></div>
        <div className="stat-card"><div className="label">Verified</div><div className="value green">{stats?.verified ?? '—'}</div></div>
        <div className="stat-card"><div className="label">Pending verification</div><div className="value amber">{stats?.pending ?? '—'}</div></div>
        <div className="stat-card"><div className="label">Rejected</div><div className="value red">{stats?.rejected ?? '—'}</div></div>
      </div>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="VERIFIED">Verified</option>
          <option value="PENDING">Pending Verification</option>
          <option value="REJECTED">Rejected</option>
          <option value="CEASED">Ceased</option>
        </select>
        <select value={pep} onChange={(e) => setPep(e.target.value)}>
          <option value="">PEP: All</option>
          <option value="true">PEP: Yes</option>
          <option value="false">PEP: No</option>
        </select>
        <div className="spacer"></div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>BO Reference</th><th>Full name</th><th>Legal person</th>
              <th>Ownership</th><th>PEP</th><th>Status</th><th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7}>Loading…</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={7}>No records found.</td></tr>
            )}
            {!loading && records.map((r) => (
              <tr key={r.id} onClick={() => onOpen?.(r.id)} style={{ cursor: onOpen ? 'pointer' : 'default' }}>
                <td className="ref mono">{r.boReference}</td>
                <td>{r.fullName}</td>
                <td>{r.legalPersonName}</td>
                <td>{r.ownershipPercentage}%</td>
                <td>{r.pep ? <span className="pep-yes">Yes</span> : <span className="pep-no">No</span>}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="ref">{(r.updatedAt || r.createdAt || '').slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
