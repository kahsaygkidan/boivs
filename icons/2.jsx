
/* =========================================================
   DASHEN BANK — MODERN ENTERPRISE ICON SYSTEM
   SVG | 24px | Rounded stroke | Consistent geometry
   ========================================================= */

const Icon = ({ children, size = 22, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

/* =========================================================
   BRAND MARK
   ========================================================= */

export function LogoMark({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke="#7896ED"
        strokeWidth="1.5"
      />

      <path
        d="M16 9v5M9.8 21l4.2-4M22.2 21 18 17"
        stroke="#B8C8F2"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <circle cx="16" cy="8.5" r="3" fill="#65DCA0" />
      <circle cx="8.5" cy="22" r="2.7" fill="#AFC0EA" />
      <circle cx="23.5" cy="22" r="2.7" fill="#AFC0EA" />
      <circle cx="16" cy="16" r="2" fill="#FFFFFF" />
    </svg>
  );
}

/* =========================================================
   NAVIGATION ICONS
   ========================================================= */

export const NavIcons = {

  /* Dashboard */
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="1.7" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </Icon>
  ),

  /* Create Legal Person */
  create: (
    <Icon>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 20v-1.5a6 6 0 0 1 12 0V20" />
      <path d="M19 8v8M15 12h8" />
    </Icon>
  ),

  /* Beneficial Owners */
  records: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2.5" />
      <path d="M5.5 17a3.5 3.5 0 0 1 7 0" />
      <path d="M15 8h3M15 12h3M15 16h3" />
    </Icon>
  ),

  /* Approval Queue */
  queue: (
    <Icon>
      <path d="M12 3 20 6v5.5c0 4.8-3.4 8-8 9.5-4.6-1.5-8-4.7-8-9.5V6l8-3Z" />
      <path d="m8.5 12 2.3 2.3 4.8-5" />
    </Icon>
  ),

  /* Audit Trail */
  audit: (
    <Icon>
      <path d="M4 19V12" />
      <path d="M9 19V5" />
      <path d="M14 19V9" />
      <path d="M19 19V3" />
      <path d="M3 21h18" />
    </Icon>
  ),

  /* Reports */
  reports: (
    <Icon>
      <path d="M7 3h7l5 5v13H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" />
      <path d="M14 3v5h5" />
      <path d="M8 16v-3M12 16v-5M16 16v-2" />
    </Icon>
  ),

  /* Ownership Structure */
  structure: (
    <Icon>
      <rect x="9" y="3" width="6" height="5" rx="1.5" />
      <rect x="2.5" y="17" width="6" height="5" rx="1.5" />
      <rect x="15.5" y="17" width="6" height="5" rx="1.5" />
      <path d="M12 8v4M5.5 17v-5h13v5M18.5 17v-5" />
    </Icon>
  ),

  /* User Manual */
  manual: (
    <Icon>
      <path d="M12 7c-2-2-5-2.5-9-1v13c4-1.5 7-1 9 1 2-2 5-2.5 9-1V6c-4-1.5-7-1-9 1Z" />
      <path d="M12 7v13" />
      <path d="M6.5 10h2.5M6.5 13h2.5M15 10h2.5M15 13h2.5" />
    </Icon>
  ),
};

/* =========================================================
   COMMON APPLICATION ICONS
   ========================================================= */

export function SearchIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function BellIcon({ size = 20 }) {
  return (
    <Icon size={size}>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </Icon>
  );
}

export function FilterIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M4 6h16M7 12h10M10 18h4" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function SettingsIcon({ size = 20 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7a8 8 0 0 1-2 .9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-2-.9l-1.7.7-1.5-2.6 1.4-1.1a8 8 0 0 1 0-2.2l-1.4-1.1 1.5-2.6 1.7.7a8 8 0 0 1 2-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 2 .9l1.7-.7 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2.1Z" />
    </Icon>
  );
}

export function UserIcon({ size = 20 }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" />
    </Icon>
  );
}

export function LogoutIcon({ size = 19 }) {
  return (
    <Icon size={size}>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </Icon>
  );
}

export function DownloadIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M12 3v12m-5-5 5 5 5-5" />
      <path d="M5 17v3h14v-3" />
    </Icon>
  );
}

export function PrintIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="M7 8V3h10v5" />
      <path d="M6 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
      <path d="M18 11h.01" />
    </Icon>
  ),
};

export function CheckIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="m5 12 4 4L19 6" />
    </Icon>
  );
}

export function CloseIcon({ size = 18 }) {
  return (
    <Icon size={size}>
      <path d="m18 6-12 12M6 6l12 12" />
    </Icon>
  );
}
