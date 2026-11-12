import { useRef } from 'react';

/**
 * Single "Import files" button. Opens the native picker (multi-select by default).
 * Files are reported through `onFiles`; validation stays in the caller.
 */
export default function FileImportButton({
  onFiles,
  accept = '.pdf,.jpg,.jpeg,.png',
  multiple = true,
  label = 'Import files',
  disabled = false,
}) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const files = e.target.files;
    if (files && files.length) onFiles(files);
    e.target.value = ''; // allow re-picking the same file
  };

  return (
    <>
      <button
        type="button"
        className="nlr-btn nlr-btn--outline nlr-btn--sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}