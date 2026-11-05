


const [selectedLegalDocKey, setSelectedLegalDocKey] = useState(
  LEGAL_DOC_TYPES[0]?.key || ''
);
const [isLegalDocDragging, setIsLegalDocDragging] = useState(false);
const legalDocInputRef = useRef(null);

const addLegalDocs = (docKey, fileList) => {
  if (!docKey || !fileList?.length) return;

  const accepted = [...(legalDocs[docKey] || [])];
  const problems = [];

  Array.from(fileList).forEach((file) => {
    const problem = validateDocFile(file);

    if (problem) {
      problems.push(`${file.name}: ${problem}`);
      return;
    }

    const duplicate = accepted.some(
      (item) => item.name === file.name && item.size === file.size
    );

    if (!duplicate) accepted.push(file);
  });

  setLegalDocs((previous) => ({
    ...previous,
    [docKey]: accepted,
  }));

  setDocErrors((previous) => ({
    ...previous,
    [docKey]: problems.length ? problems.join(' · ') : null,
  }));
};

const removeLegalDoc = (docKey, index) => {
  setLegalDocs((previous) => {
    const remaining = (previous[docKey] || []).filter(
      (_, i) => i !== index
    );

    const next = { ...previous };

    if (remaining.length) next[docKey] = remaining;
    else delete next[docKey];

    return next;
  });
};

const handleLegalDocFiles = (files) => {
  addLegalDocs(selectedLegalDocKey, files);
};

const totalPendingLegalDocs = Object.values(legalDocs)
  .reduce((total, files) => total + (files?.length || 0), 0);

const allExistingLegalDocs = LEGAL_DOC_TYPES.flatMap((type) =>
  (existingDocs[type.docType] || []).map((doc) => ({
    ...doc,
    displayType: type.label,
    docType: type.docType,
  }))
);

const allPendingLegalDocs = LEGAL_DOC_TYPES.flatMap((type) =>
  (legalDocs[type.key] || []).map((file, index) => ({
    file,
    index,
    key: type.key,
    label: type.label,
  }))
);


{/* ================= UNIFIED LEGAL ENTITY DOCUMENT UPLOAD ================= */}

<section className="nlr-legal-documents">

  <div className="nlr-legal-documents__header">
    <div>
      <div className="nlr-legal-documents__title">
        <span className="nlr-legal-documents__title-icon">▤</span>
        Supporting documents
      </div>

      <p className="nlr-legal-documents__description">
        Upload all legal entity documents in one place. Select a document
        category, then browse or drag and drop your files.
      </p>
    </div>

    <span className="nlr-doc-count">
      {totalPendingLegalDocs} pending
    </span>
  </div>

  {/* Document category */}
  <div className="nlr-doc-upload-controls">

    <Field label="Document type" required>
      <select
        className="nlr-input"
        value={selectedLegalDocKey}
        onChange={(e) => setSelectedLegalDocKey(e.target.value)}
      >
        {LEGAL_DOC_TYPES.map((type) => (
          <option key={type.key} value={type.key}>
            {type.label}
            {isForeign && type.docType === 'FOREIGN_HOME_DOCUMENT'
              ? ' (Required)'
              : ''}
          </option>
        ))}
      </select>
    </Field>

    <div className="nlr-doc-required-note">
      {isForeign
        ? 'A home-jurisdiction official document is required for foreign legal persons.'
        : 'Upload the available official documents for this legal entity.'}
    </div>

  </div>

  {/* Single drag-and-drop upload area */}
  <div
    className={`nlr-doc-dropzone${isLegalDocDragging ? ' nlr-doc-dropzone--active' : ''}`}
    onDragEnter={(e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLegalDocDragging(true);
    }}
    onDragOver={(e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLegalDocDragging(true);
    }}
    onDragLeave={(e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!e.currentTarget.contains(e.relatedTarget)) {
        setIsLegalDocDragging(false);
      }
    }}
    onDrop={(e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsLegalDocDragging(false);
      handleLegalDocFiles(e.dataTransfer.files);
    }}
  >

    <input
      ref={legalDocInputRef}
      className="nlr-doc-hidden-input"
      type="file"
      multiple
      accept={DOC_ACCEPT}
      onChange={(e) => {
        handleLegalDocFiles(e.target.files);
        e.target.value = '';
      }}
    />

    <div className="nlr-doc-dropzone__icon">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>

    <div className="nlr-doc-dropzone__heading">
      {isLegalDocDragging
        ? 'Drop your documents here'
        : 'Drag and drop your documents here'}
    </div>

    <p className="nlr-doc-dropzone__text">
      Upload multiple PDF, JPG or PNG files under the selected document category.
    </p>

    <button
      type="button"
      className="nlr-doc-upload-button"
      onClick={() => legalDocInputRef.current?.click()}
      disabled={!selectedLegalDocKey}
    >
      <span>＋</span> Browse documents
    </button>

    <div className="nlr-doc-format">
      PDF, JPG or PNG <span>•</span> Maximum 15 MB per file
    </div>

  </div>

  {docErrors[selectedLegalDocKey] && (
    <FieldError msg={docErrors[selectedLegalDocKey]} />
  )}

  {/* Pending uploads */}
  {allPendingLegalDocs.length > 0 && (
    <div className="nlr-doc-list">

      <div className="nlr-doc-list__header">
        <strong>Files ready to upload</strong>
        <span>{allPendingLegalDocs.length} file(s)</span>
      </div>

      {allPendingLegalDocs.map((item) => (
        <div
          className="nlr-doc-file"
          key={`${item.key}-${item.file.name}-${item.file.size}`}
        >
          <div className="nlr-doc-file__icon">
            {item.file.name.toLowerCase().endsWith('.pdf')
              ? 'PDF'
              : 'IMG'}
          </div>

          <div className="nlr-doc-file__details">
            <div className="nlr-doc-file__name" title={item.file.name}>
              {item.file.name}
            </div>

            <div className="nlr-doc-file__meta">
              {item.label} · {fmtKb(item.file.size)}
            </div>
          </div>

          <span className="nlr-doc-file__pending">
            Pending
          </span>

          <button
            type="button"
            className="nlr-doc-file__remove"
            onClick={() => removeLegalDoc(item.key, item.index)}
            aria-label={`Remove ${item.file.name}`}
            title="Remove file"
          >
            ×
          </button>
        </div>
      ))}

    </div>
  )}

  {/* Already uploaded documents */}
  {allExistingLegalDocs.length > 0 && (
    <div className="nlr-doc-list nlr-doc-list--uploaded">

      <div className="nlr-doc-list__header">
        <strong>Previously uploaded documents</strong>
        <span>{allExistingLegalDocs.length} file(s)</span>
      </div>

      {allExistingLegalDocs.map((doc) => (
        <div className="nlr-doc-file" key={doc.id}>

          <div className="nlr-doc-file__icon nlr-doc-file__icon--uploaded">
            ✓
          </div>

          <div className="nlr-doc-file__details">
            <div className="nlr-doc-file__name" title={doc.fileName}>
              {doc.fileName}
            </div>

            <div className="nlr-doc-file__meta">
              {doc.displayType}
            </div>
          </div>

          <span className="nlr-doc-file__uploaded">
            Uploaded
          </span>

          <button
            type="button"
            className="nlr-btn nlr-btn--outline nlr-btn--sm"
            onClick={() => handleDocDownload(doc.id, doc.fileName)}
            title="Download document"
          >
            {I.download}
          </button>

          <button
            type="button"
            className="nlr-doc-file__remove"
            onClick={() => handleDocDelete(doc.docType, doc.id)}
            title="Delete document"
            aria-label={`Delete ${doc.fileName}`}
          >
            ×
          </button>

        </div>
      ))}

    </div>
  )}

  {allPendingLegalDocs.length === 0 && allExistingLegalDocs.length === 0 && (
    <div className="nlr-doc-empty">
      <strong>No supporting documents added yet</strong>
      <span>Select a document type and upload the legal entity's documents.</span>
    </div>
  )}

  <div className="nlr-doc-upload-footer">
    <span>
      <strong>{totalPendingLegalDocs}</strong> file(s) selected for upload
    </span>

    <span>
      Documents upload when you click <strong>Continue</strong>.
    </span>
  </div>

</section>
csss

/* =========================================================
   Unified legal entity supporting document uploader
   ========================================================= */

.nlr-legal-documents {
  margin-top: 24px;
  padding: 22px;
  background: #fff;
  border: 1px solid #e3e8f1;
  border-radius: 14px;
}

.nlr-legal-documents__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.nlr-legal-documents__title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #172554;
  font-size: 16px;
  font-weight: 750;
}

.nlr-legal-documents__title-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #eef2ff;
  color: #3157dc;
  font-size: 19px;
}

.nlr-legal-documents__description {
  margin: 6px 0 0 44px;
  color: #64748b;
  font-size: 12.5px;
  line-height: 1.6;
}

.nlr-doc-count {
  flex-shrink: 0;
  padding: 6px 11px;
  border-radius: 20px;
  background: #eef2ff;
  color: #3157dc;
  font-size: 11.5px;
  font-weight: 700;
}

.nlr-doc-upload-controls {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.5fr);
  align-items: end;
  gap: 16px;
  margin-bottom: 16px;
}

.nlr-doc-required-note {
  padding: 11px 13px;
  border: 1px solid #dbe5fb;
  border-radius: 8px;
  background: #f5f8ff;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
}

/* Drag and drop area */

.nlr-doc-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 205px;
  padding: 28px 18px;
  border: 1.5px dashed #b8c6df;
  border-radius: 12px;
  background: #f8faff;
  text-align: center;
  transition: border-color .2s ease, background .2s ease;
}

.nlr-doc-dropzone--active {
  border-color: #3157dc;
  border-style: solid;
  background: #edf3ff;
}

.nlr-doc-hidden-input {
  display: none;
}

.nlr-doc-dropzone__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  border-radius: 13px;
  background: #e9efff;
  color: #3157dc;
}

.nlr-doc-dropzone__icon svg {
  width: 25px;
  height: 25px;
}

.nlr-doc-dropzone__heading {
  color: #172554;
  font-size: 14px;
  font-weight: 750;
}

.nlr-doc-dropzone__text {
  max-width: 430px;
  margin: 7px 0 14px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.nlr-doc-upload-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 39px;
  padding: 0 17px;
  border: 0;
  border-radius: 8px;
  background: #3157dc;
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s ease, transform .2s ease;
}

.nlr-doc-upload-button:hover:not(:disabled) {
  background: #2445bb;
  transform: translateY(-1px);
}

.nlr-doc-upload-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.nlr-doc-upload-button span {
  font-size: 18px;
  line-height: 1;
}

.nlr-doc-format {
  margin-top: 12px;
  color: #8491a5;
  font-size: 11px;
}

.nlr-doc-format span {
  margin: 0 5px;
}

/* Document list */

.nlr-doc-list {
  margin-top: 18px;
  overflow: hidden;
  border: 1px solid #e4e9f1;
  border-radius: 10px;
}

.nlr-doc-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #f7f9fc;
  border-bottom: 1px solid #e4e9f1;
}

.nlr-doc-list__header strong {
  color: #263650;
  font-size: 12.5px;
}

.nlr-doc-list__header span {
  color: #64748b;
  font-size: 11.5px;
}

.nlr-doc-file {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 11px 14px;
  border-bottom: 1px solid #edf0f5;
}

.nlr-doc-file:last-child {
  border-bottom: 0;
}

.nlr-doc-file__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: #fff1e9;
  color: #c45b22;
  font-size: 10px;
  font-weight: 800;
}

.nlr-doc-file__icon--uploaded {
  background: #e9f8ef;
  color: #16834b;
  font-size: 16px;
}

.nlr-doc-file__details {
  flex: 1;
  min-width: 0;
}

.nlr-doc-file__name {
  overflow: hidden;
  color: #263650;
  font-size: 12.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nlr-doc-file__meta {
  margin-top: 4px;
  color: #8491a5;
  font-size: 11px;
}

.nlr-doc-file__pending,
.nlr-doc-file__uploaded {
  flex-shrink: 0;
  padding: 5px 9px;
  border-radius: 20px;
  background: #fff5e8;
  color: #a45c0b;
  font-size: 10.5px;
  font-weight: 700;
}

.nlr-doc-file__uploaded {
  background: #eaf8ef;
  color: #16834b;
}

.nlr-doc-file__remove {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid #e6eaf0;
  border-radius: 7px;
  background: #fff;
  color: #a33c48;
  font-size: 20px;
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease;
}

.nlr-doc-file__remove:hover {
  border-color: #f1c5c9;
  background: #fff1f2;
}

.nlr-doc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 20px;
  color: #64748b;
  text-align: center;
}

.nlr-doc-empty strong {
  color: #475569;
  font-size: 12.5px;
}

.nlr-doc-empty span {
  font-size: 11.5px;
}

.nlr-doc-upload-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  color: #64748b;
  font-size: 11.5px;
}

.nlr-doc-upload-footer strong {
  color: #3157dc;
}

/* Responsive */

@media (max-width: 650px) {
  .nlr-legal-documents {
    padding: 15px;
  }

  .nlr-doc-upload-controls {
    grid-template-columns: 1fr;
  }

  .nlr-legal-documents__header {
    flex-direction: column;
  }

  .nlr-doc-file {
    gap: 8px;
    padding: 10px;
  }

  .nlr-doc-file__pending,
  .nlr-doc-file__uploaded {
    display: none;
  }

  .nlr-doc-upload-footer {
    flex-direction: column;
  }
}
