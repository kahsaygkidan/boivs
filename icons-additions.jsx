/* =========================================================
   RECORD DETAIL ICONS
   Paste at the end of your icons file. They use the same
   <Icon> wrapper (24px grid, 1.8 rounded stroke).
   ========================================================= */

export function BackIcon({ size = 16 }) {
  return <Icon size={size}><path d="m15 18-6-6 6-6" /></Icon>;
}

export function BanIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </Icon>
  );
}

export function EditIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

export function SendIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4 18-7Z" />
    </Icon>
  );
}

export function TrashIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </Icon>
  );
}

export function EyeIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function UploadIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <path d="M12 15V3m-5 5 5-5 5 5" />
      <path d="M5 17v3h14v-3" />
    </Icon>
  );
}

export function FileIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M7 3h7l5 5v13H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" />
      <path d="M14 3v5h5" />
    </Icon>
  );
}

export function ImageIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m21 15-5-5L5 21" />
    </Icon>
  );
}

export function AlertIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </Icon>
  );
}

export function InfoIcon({ size = 14 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4.5M12 8h.01" />
    </Icon>
  );
}

export function CheckCircleIcon({ size = 16 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </Icon>
  );
}
