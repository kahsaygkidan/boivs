{LEGAL_DOC_TYPES.map((d) => (
  <div key={d.key}>
    <Field label={d.label}>
      <input
        className="nlr-input"
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          setLegalDocs({ ...legalDocs, [d.key]: file });
        }}
      />
      {legalDocs[d.key] && <FieldHint msg={`Selected: ${legalDocs[d.key].name}`} />}
    </Field>
  </div>
))}