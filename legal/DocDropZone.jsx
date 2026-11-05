import { useRef, useState } from 'react';
import { UploadIcon } from '../components/icons.jsx'; // adjust path to your icon file
import './DocDropZone.css';

/**
 * One control for picking files: click to browse (multiple), or drag and drop.
 * Hands the FileList to onFiles, so it works with your existing addLegalDocs(key, files).
 */
export default function DocDropZone({ accept, onFiles, hasFiles = false, disabled = false, label, multiple = true }) {
  const inputRef = useRef(null);
  const depth = useRef(0); // counts nested dragenter/dragleave so the highlight doesn't flicker
  const [over, setOver] = useState(false);

  const open = () => { if (!disabled) inputRef.current?.click(); };

  const handleDrop = (e) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files?.length) onFiles(multiple ? files : [files[0]]);
  };

  return (
    <div
      className={`nlr-drop${over ? ' nlr-drop--over' : ''}${hasFiles ? ' nlr-drop--compact' : ''}${disabled ? ' nlr-drop--disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label ? `Add files: ${label}` : 'Add files'}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      }}
      onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="nlr-drop__input"
        type="file"
        multiple={multiple}
        accept={accept}
        tabIndex={-1}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = ''; // lets the same file be picked again after removing it
        }}
      />
      <span className="nlr-drop__icon"><UploadIcon size={20} /></span>
      <span className="nlr-drop__text">
        {over
          ? <strong>Drop to add</strong>
          : hasFiles
            ? <><strong>{multiple ? 'Add more files' : 'Replace file'}</strong> or drop {multiple ? 'them' : 'it'} here</>
            : <><strong>{multiple ? 'Choose files' : 'Choose a file'}</strong> or drop {multiple ? 'them' : 'it'} here</>}
      </span>
    </div>
  );
}
