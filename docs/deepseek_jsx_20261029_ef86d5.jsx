{LEGAL_DOC_TYPES.map((d) => {
  const existing = existingDocs[DOC_KEY_TO_TYPE[d.key]];
  return (
    <div key={d.key}>
      <Field label={d.label}>
        {existing ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            background: 'var(--nlr-success-soft)', border: '1px solid var(--nlr-success-border)',
            borderRadius: 'var(--nlr-radius-sm)', fontSize: 12.5,
          }}>
            <span style={{ color: 'var(--nlr-success)', fontWeight: 700 }}>✓</span>
            <span style={{ flex: 1, color: 'var(--nlr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {existing.fileName}
            </span>
            <button type="button"
              className="nlr-btn nlr-btn--outline nlr-btn--sm"
              onClick={() => downloadLegalPersonDocument(legalPersonId, existing.id, existing.fileName)}>
              Download
            </button>
          </div>
        ) : (
          <>
            <input
              className="nlr-input"
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setLegalDocs({ ...legalDocs, [d.key]: file });
              }}
            />
            {legalDocs[d.key] && <FieldHint msg={`Selected: ${legalDocs[d.key].name}`} />}
          </>
        )}
      </Field>
    </div>
  );
})}