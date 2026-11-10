import { useEffect, useRef, useState } from 'react';
import { FORMATS, ICONS } from './formats.jsx';

const NAVY = '#0b2a5b';

/**
 * Modern export dropdown for table-style reports. Self-contained styling (no app CSS needed).
 * onExport(formatKey) may be async; errors are shown inside the panel.
 */
export default function TableExportMenu({ onExport, disabled, count }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = async (f) => {
    setBusy(f.key); setMsg(null);
    try {
      await onExport(f.key);
      if (f.key === 'print') setOpen(false);
      else setMsg({ ok: true, text: `${f.label} file is ready` });
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: `Could not create the ${f.label} file. Please try again.` });
    } finally { setBusy(null); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px', border: 0, borderRadius: 10,
          background: NAVY, color: '#fff', fontSize: 13, fontWeight: 650, fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, boxShadow: '0 1px 2px rgba(11,42,91,.3)',
        }}
      >
        {ICONS.share} Export / Print
      </button>

      {open && (
        <div role="dialog" aria-label="Export report" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxWidth: 'calc(100vw - 32px)', zIndex: 60,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, boxShadow: '0 18px 40px rgba(15,23,42,.18)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Export this report</div>
          <div style={{ fontSize: 12, color: '#64748b', margin: '2px 0 12px' }}>
            {count != null ? `${count} row${count === 1 ? '' : 's'} with the current filters applied.` : 'Current filters are applied.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {FORMATS.map((f) => (
              <button
                key={f.key} type="button" disabled={!!busy} onClick={() => run(f)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', background: '#fff',
                  border: '1px solid #e5e7eb', borderRadius: 12, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer',
                  opacity: busy && busy !== f.key ? 0.5 : 1, transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = `0 0 0 3px ${f.bg}`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 10, background: f.bg, color: f.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {busy === f.key ? '…' : ICONS[f.key]}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: '#0f172a' }}>{f.label}</span>
                <span style={{ fontSize: 10.5, color: '#64748b' }}>{f.hint}</span>
              </button>
            ))}
          </div>
          {msg && (
            <div role="status" style={{
              marginTop: 12, padding: '8px 10px', borderRadius: 8, fontSize: 12.5,
              background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#15803d' : '#b91c1c',
            }}>{msg.text}</div>
          )}
        </div>
      )}
    </div>
  );
}
