import { statusLabel } from '../data/records.js'

export default function StatusBadge({ status }) {
  const key = (status || '').toUpperCase()
  return (
    <span className={`badge ${key.toLowerCase()}`}>
      <span className="dot"></span>
      {statusLabel[key] || status}
    </span>
  )
}
