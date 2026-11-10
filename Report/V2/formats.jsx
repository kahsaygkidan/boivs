/* Small inline icons so this component has no dependency on the I set */
const svg = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const ICONS = {
  share: svg(<><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>),
  print: svg(<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>),
  pdf: svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 15h6M9 18h4" /></>),
  docx: svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m8.5 12 1.2 5 1.3-4 1.3 4 1.2-5" /></>),
  xlsx: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 10v10" /></>),
  csv: svg(<><path d="M4 6h16M4 12h16M4 18h10" /></>),
  json: svg(<><path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.500 2 3v2c0 2 1 3 3 3" /><path d="M16 4c2 0 3 1 3 3v2c0 1.500 1 3 2 3-1 0-2 1.500-2 3v2c0 2-1 3-3 3" /></>),
  check: svg(<path d="m5 12 5 5 9-10" />),
};

export const FORMATS = [
  { key: 'print', label: 'Print', hint: 'Clean A4 layout', color: '#12307a', bg: '#e8eefc' },
  { key: 'pdf', label: 'PDF', hint: '.pdf', color: '#b91c1c', bg: '#fee2e2' },
  { key: 'docx', label: 'Word', hint: '.docx', color: '#1d4ed8', bg: '#dbeafe' },
  { key: 'xlsx', label: 'Excel', hint: '.xlsx', color: '#15803d', bg: '#dcfce7' },
  { key: 'csv', label: 'CSV', hint: '.csv', color: '#a16207', bg: '#fef3c7' },
  { key: 'json', label: 'JSON', hint: '.json', color: '#6d28d9', bg: '#ede9fe' },
];
