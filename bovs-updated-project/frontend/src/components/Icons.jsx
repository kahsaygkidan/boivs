export function LogoMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <circle cx="15" cy="15" r="14" stroke="#6F8CE8" strokeWidth="1.4" />
      <circle cx="15" cy="9" r="3" fill="#6FE3A6" />
      <circle cx="9" cy="19" r="2.3" fill="#9FB0DE" />
      <circle cx="21" cy="19" r="2.3" fill="#9FB0DE" />
      <path d="M15 12v3M12 16l-2 2M18 16l2 2" stroke="#B7C2E6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}



export const NavIcons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  create: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  records: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  queue: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 14 4v4c0 4-2.7 6-6 6.5C4.7 14 2 12 2 8V4l6-2.5Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 8l1.7 1.7L10.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  audit: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13V8M6 13V4M10 13V9M14 13V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  reports: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 9l2 2 4-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
    structure: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="6" y="1.8" width="4" height="3.4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.8" y="10.8" width="4" height="3.4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.2" y="10.8" width="4" height="3.4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.2v2.6M3.8 10.8V7.8h8.4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
    manual: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 3.2c1.6-.7 3.4-.7 5 0v9.6c-1.6-.7-3.4-.7-5 0V3.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M13.5 3.2c-1.6-.7-3.4-.7-5 0v9.6c1.6-.7 3.4-.7 5 0V3.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
}

export function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.3" stroke="#8892A0" strokeWidth="1.3" />
      <path d="M9.2 9.2 12.5 12.5" stroke="#8892A0" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2.5c-2.5 0-4 1.9-4 4.4v2.4L3.5 12h11L13 9.3V6.9c0-2.5-1.5-4.4-4-4.4Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 14.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
