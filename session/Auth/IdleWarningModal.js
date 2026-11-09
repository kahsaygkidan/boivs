const styles = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9999, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(5, 18, 45, 0.65)', backdropFilter: 'blur(2px)',
  },
  card: {
    width: 'min(420px, calc(100vw - 32px))', background: '#fff', borderRadius: 12,
    overflow: 'hidden', boxShadow: '0 20px 50px rgba(5, 18, 45, 0.45)',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  header: { background: '#0b2a5b', color: '#fff', padding: '16px 24px', fontSize: 18, fontWeight: 600 },
  body: { padding: '24px', color: '#1f2937', lineHeight: 1.5 },
  count: { fontSize: 40, fontWeight: 700, color: '#0b2a5b', textAlign: 'center', margin: '12px 0' },
  actions: { display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '0 24px 24px' },
  primary: {
    background: '#0b2a5b', color: '#fff', border: 0, borderRadius: 8,
    padding: '10px 18px', fontWeight: 600, cursor: 'pointer',
  },
  secondary: {
    background: 'transparent', color: '#0b2a5b', border: '1px solid #0b2a5b',
    borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer',
  },
}

export default function IdleWarningModal({ secondsLeft, onStay, onSignOut }) {
  return (
    <div style={styles.backdrop}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc" style={styles.card}>
        <div id="idle-title" style={styles.header}>Session about to expire</div>
        <div id="idle-desc" style={styles.body}>
          For your security, you will be signed out due to inactivity.
          <div style={styles.count} aria-live="polite">{secondsLeft}s</div>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.secondary} onClick={onSignOut}>Sign out</button>
          <button type="button" style={styles.primary} onClick={onStay} autoFocus>Stay signed in</button>
        </div>
      </div>
    </div>
  )
}
