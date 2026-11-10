import { useEffect, useRef, useState } from 'react';
import { T, Btn } from '../components/ui.jsx';
import { EXPORTERS } from './exporters.js';

import { ICONS, FORMATS } from './formats.jsx';

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: disabled ? T.textFaint : T.text, cursor: disabled ? 'default' : 'pointer', padding: '5px 0' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.primary }} />
      {label}
    </label>
  );
}

/**
 * Props
 *  - buildReport(options) -> report model (see utils/recordExport.js)
 *  - fileBase: file name without extension (e.g. the BO reference)
 *  - canIncludeAudit: show the "Audit trail" option (auditors only)
 */
export default function ExportMenu({ buildReport, fileBase, canIncludeAudit }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [opts, setOpts] = useState({ timeline: true, documents: true, audit: false });
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = async (f) => {
    setBusy(f.key); setMsg(null);
    try {
      await EXPORTERS[f.key](buildReport(opts), fileBase);
      if (f.key === 'print') setOpen(false);
      else setMsg({ ok: true, text: `${f.label} file is ready` });
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: `Could not create the ${f.label} file. Please try again.` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={wrap} style={{ position: 'relative' }} className="no-print">
      <Btn variant="secondary" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{ICONS.share} Export</span>
      </Btn>

      {open && (
        <div
          role="dialog"
          aria-label="Export record"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 360, maxWidth: 'calc(100vw - 32px)', zIndex: 50,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadowLg, padding: 16,
            animation: 'ui-pop .16s ease',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Export or print</div>
          <div style={{ fontSize: 12, color: T.textMuted, margin: '2px 0 12px' }}>Choose a format for this beneficial owner record.</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                disabled={!!busy}
                onClick={() => run(f)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px',
                  border: `1px solid ${T.border}`, borderRadius: T.radiusMd, background: '#fff', cursor: busy ? 'wait' : 'pointer',
                  fontFamily: 'inherit', opacity: busy && busy !== f.key ? 0.5 : 1, transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = `0 0 0 3px ${f.bg}`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 10, background: f.bg, color: f.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {busy === f.key ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span> : ICONS[f.key]}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: T.text }}>{f.label}</span>
                <span style={{ fontSize: 10.5, color: T.textMuted }}>{f.hint}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 4 }}>Include</div>
            <Toggle checked label="Record details" disabled onChange={() => {}} />
            <Toggle checked={opts.timeline} label="Review status timeline" onChange={(v) => setOpts((o) => ({ ...o, timeline: v }))} />
            <Toggle checked={opts.documents} label="Document list (file names only)" onChange={(v) => setOpts((o) => ({ ...o, documents: v }))} />
            {canIncludeAudit && <Toggle checked={opts.audit} label="Audit trail" onChange={(v) => setOpts((o) => ({ ...o, audit: v }))} />}
          </div>

          {msg && (
            <div role="status" style={{
              marginTop: 10, padding: '8px 10px', borderRadius: T.radiusSm, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
              background: msg.ok ? T.successBg : T.dangerBg, color: msg.ok ? T.success : T.danger,
            }}>
              {msg.ok && <span style={{ display: 'inline-flex', transform: 'scale(.75)' }}>{ICONS.check}</span>}
              {msg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
