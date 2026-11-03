
import { useEffect, useMemo, useState, useCallback } from 'react';
import { listAuditLogs } from '../api/bovsApi.js';
import './AuditTrail.css';

const PAGE_SIZE = 50;

const ACTIONS = [
  'CREATE', 'SUBMIT', 'APPROVE', 'REJECT',
  'CEASE', 'UPDATE', 'DELETE'
];

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

const getAction = (value) =>
  String(value || 'UNKNOWN')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const getRoles = (roles) => {
  if (Array.isArray(roles)) return roles.join(', ');
  return roles || '—';
};

const getInitials = (name) =>
  String(name || 'U')
    .split(/[._\s@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');

const escapeHTML = (value) =>
  String(value ?? '—').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

function Icon({ name, size = 18 }) {
  const paths = {
    activity: <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </>,
    search: <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>,
    refresh: <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M5.6 9a7 7 0 0 1 12-2L20 12" />
      <path d="M4 12l2.4 5a7 7 0 0 0 12-2" />
    </>,
    download: <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5M12 15V3" />
    </>,
    printer: <>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>,
    filter: <>
      <path d="M4 6h16M7 12h10m-7 6h4" />
    </>,
    user: <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </>,
    check: <>
      <path d="m5 12 4 4L19 6" />
    </>,
    close: <>
      <path d="m18 6-12 12M6 6l12 12" />
    </>,
    eye: <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    chevron: <>
      <path d="m9 18 6-6-6-6" />
    </>,
    shield: <>
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
    </>,
    file: <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </>,
    alert: <>
      <path d="M12 9v4m0 4h.01" />
      <circle cx="12" cy="12" r="10" />
    </>
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.file}
    </svg>
  );
}

function ActionBadge({ action }) {
  const normalized = getAction(action);

  const colors = {
    CREATE: 'blue',
    SUBMIT: 'info',
    APPROVE: 'success',
    REJECT: 'danger',
    CEASE: 'warning',
    UPDATE: 'purple',
    DELETE: 'danger'
  };

  return (
    <span className={`audit-badge audit-badge--${colors[normalized] || 'neutral'}`}>
      <span className="audit-badge__dot" />
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

function StatCard({ title, value, icon, color, description }) {
  return (
    <div className="audit-stat">
      <div className={`audit-stat__icon audit-stat__icon--${color}`}>
        <Icon name={icon} size={21} />
      </div>

      <div className="audit-stat__content">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);

  const [entityRef, setEntityRef] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [expandedId, setExpandedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // =====================================================
  // LOAD AUDIT RECORDS
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);

      listAuditLogs({
        entityRef: entityRef.trim() || undefined,
        size: PAGE_SIZE
      })
        .then((res) => {
          if (cancelled) return;

          setLogs(
            Array.isArray(res?.content) ? res.content : []
          );
        })
        .catch((err) => {
          if (cancelled) return;

          setError(
            err?.friendlyMessage ||
            err?.message ||
            'Unable to load audit records. Please try again.'
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [entityRef, refreshKey]);

  // =====================================================
  // FILTER AUDIT RECORDS
  // =====================================================

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const action = getAction(log.action);
      const roles = getRoles(log.actorRoles);

      const searchValue = search.trim().toLowerCase();

      const matchesSearch = !searchValue ||
        [
          log.entityRef,
          log.actorUsername,
          log.action,
          roles,
          log.details
        ].some(value =>
          String(value || '')
            .toLowerCase()
            .includes(searchValue)
        );

      const matchesAction =
        actionFilter === 'ALL' ||
        action === actionFilter;

      const matchesRole =
        roleFilter === 'ALL' ||
        roles.toLowerCase().includes(roleFilter.toLowerCase());

      const date = log.createdAt
        ? new Date(log.createdAt)
        : null;

      const validDate =
        date && !Number.isNaN(date.getTime());

      const matchesFrom =
        !fromDate ||
        (validDate &&
          date >= new Date(`${fromDate}T00:00:00`));

      const matchesTo =
        !toDate ||
        (validDate &&
          date <= new Date(`${toDate}T23:59:59.999`));

      return (
        matchesSearch &&
        matchesAction &&
        matchesRole &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    logs,
    search,
    actionFilter,
    roleFilter,
    fromDate,
    toDate
  ]);

  // =====================================================
  // SUMMARY STATISTICS
  // =====================================================

  const stats = useMemo(() => ({
    total: logs.length,

    approvals: logs.filter(
      l => getAction(l.action) === 'APPROVE'
    ).length,

    rejections: logs.filter(
      l => getAction(l.action) === 'REJECT'
    ).length,

    users: new Set(
      logs.map(l => l.actorUsername).filter(Boolean)
    ).size
  }), [logs]);

  // =====================================================
  // AVAILABLE USER ROLES
  // =====================================================

  const uniqueRoles = useMemo(() => {
    const values = logs.flatMap(log =>
      Array.isArray(log.actorRoles)
        ? log.actorRoles
        : String(log.actorRoles || '').split(',')
    );

    return [
      ...new Set(
        values.map(v => String(v).trim()).filter(Boolean)
      )
    ];
  }, [logs]);

  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  const clearFilters = () => {
    setEntityRef('');
    setSearch('');
    setActionFilter('ALL');
    setRoleFilter('ALL');
    setFromDate('');
    setToDate('');
    setExpandedId(null);
  };

  // =====================================================
  // EXPORT FILTERED RECORDS TO CSV
  // =====================================================

  const exportCSV = useCallback(() => {
    if (!filteredLogs.length) return;

    const headers = [
      'Timestamp',
      'Entity Reference',
      'Action',
      'Actor',
      'Roles',
      'Details'
    ];

    const escapeCSV = (value) => {
      const safeValue = String(value ?? '')
        .replace(/[\r\n]+/g, ' ');

      return `"${safeValue.replace(/"/g, '""')}"`;
    };

    const rows = filteredLogs.map(log => [
      formatDate(log.createdAt),
      log.entityRef,
      log.action,
      log.actorUsername,
      getRoles(log.actorRoles),
      log.details
    ]);

    const csv = [
      headers,
      ...rows
    ]
      .map(row => row.map(escapeCSV).join(','))
      .join('\r\n');

    const blob = new Blob(
      ['\uFEFF' + csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `UBO-Audit-Trail-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [filteredLogs]);

  // =====================================================
  // PRINT CURRENT FILTERED AUDIT REPORT
  // =====================================================

  const handlePrint = useCallback(() => {
    if (loading) return;

    if (error) {
      alert('Unable to print. Please resolve the loading error first.');
      return;
    }

    if (!filteredLogs.length) {
      alert('No matching audit records available to print.');
      return;
    }

    const printWindow = window.open(
      '',
      '_blank',
      'width=1200,height=850'
    );

    if (!printWindow) {
      alert('Please allow pop-ups to print the audit report.');
      return;
    }

    // Capture the currently selected filters and records.
    const selectedRecords = [...filteredLogs];

    const filters = [
      ['Entity Reference', entityRef.trim() || 'All'],
      ['Search', search.trim() || 'All'],
      ['Action', actionFilter],
      ['User Role', roleFilter],
      ['From Date', fromDate || 'All'],
      ['To Date', toDate || 'All']
    ];

    const approvals = selectedRecords.filter(
      l => getAction(l.action) === 'APPROVE'
    ).length;

    const rejections = selectedRecords.filter(
      l => getAction(l.action) === 'REJECT'
    ).length;

    const rows = selectedRecords.map((log, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(formatDate(log.createdAt))}</td>
        <td class="reference">${escapeHTML(log.entityRef)}</td>
        <td>
          <span class="action action-${escapeHTML(
            getAction(log.action).toLowerCase()
          )}">
            ${escapeHTML(getAction(log.action).replace(/_/g, ' '))}
          </span>
        </td>
        <td>${escapeHTML(log.actorUsername || 'System')}</td>
        <td>${escapeHTML(getRoles(log.actorRoles))}</td>
        <td class="details">
          ${escapeHTML(log.details || 'No additional details available.')}
        </td>
      </tr>
    `).join('');

    const filterHTML = filters.map(([label, value]) => `
      <div class="filter-item">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>
    `).join('');

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Dashen Bank - Audit Trail Report</title>

        <style>
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #243252;
            font-size: 10px;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 15px;
            border-bottom: 3px solid #263878;
          }

          .brand {
            color: #263878;
            font-size: 23px;
            font-weight: 800;
            letter-spacing: 1px;
          }

          .brand-subtitle {
            margin-top: 5px;
            color: #74819a;
            font-size: 10px;
          }

          .report-meta {
            text-align: right;
            line-height: 1.8;
            color: #586782;
          }

          .report-meta strong {
            color: #263878;
            font-size: 12px;
          }

          h1 {
            margin: 22px 0 5px;
            color: #17274e;
            font-size: 20px;
          }

          .description {
            margin-bottom: 18px;
            color: #77839a;
            line-height: 1.5;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 18px;
          }

          .summary-item {
            padding: 12px;
            border: 1px solid #e3e8f1;
            border-radius: 5px;
            background: #f5f7fc;
          }

          .summary-item strong {
            display: block;
            margin-bottom: 5px;
            color: #263878;
            font-size: 19px;
          }

          .summary-item span {
            color: #75819a;
            font-size: 9px;
          }

          .section-title {
            margin: 18px 0 10px;
            color: #25375f;
            font-size: 12px;
            font-weight: bold;
          }

          .filters {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            padding: 12px;
            border: 1px solid #e2e7f0;
            border-radius: 5px;
          }

          .filter-item span {
            display: block;
            margin-bottom: 5px;
            color: #8490a5;
            font-size: 9px;
          }

          .filter-item strong {
            color: #293958;
            font-size: 10px;
            overflow-wrap: anywhere;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          thead {
            display: table-header-group;
          }

          th {
            padding: 10px 7px;
            background: #263878;
            color: white;
            text-align: left;
            font-size: 9px;
            font-weight: bold;
          }

          td {
            padding: 9px 7px;
            border-bottom: 1px solid #e4e9f1;
            vertical-align: top;
            font-size: 9px;
            line-height: 1.55;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          tbody tr:nth-child(even) {
            background: #f6f8fc;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          th:nth-child(1) { width: 4%; }
          th:nth-child(2) { width: 17%; }
          th:nth-child(3) { width: 14%; }
          th:nth-child(4) { width: 11%; }
          th:nth-child(5) { width: 14%; }
          th:nth-child(6) { width: 13%; }
          th:nth-child(7) { width: 27%; }

          .reference {
            font-family: Consolas, monospace;
            font-weight: bold;
            color: #334e87;
          }

          .action {
            display: inline-block;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: bold;
          }

          .action-approve {
            background: #e8f6ef;
            color: #18865b;
          }

          .action-reject,
          .action-delete {
            background: #fff0ef;
            color: #cf4d4d;
          }

          .action-submit {
            background: #eaf5ff;
            color: #2876b7;
          }

          .action-cease {
            background: #fff5e5;
            color: #b77a21;
          }

          .action-create {
            background: #edf2ff;
            color: #355fc3;
          }

          .action-update {
            background: #f1edff;
            color: #7755c1;
          }

          .footer {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 22px;
            padding-top: 10px;
            border-top: 1px solid #dfe5ee;
            color: #8994a8;
            font-size: 9px;
          }

          .no-records {
            padding: 20px;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <header class="report-header">
          <div>
            <div class="brand">DASHEN BANK</div>
            <div class="brand-subtitle">
              Banking for a Brighter Future | UBO Registry
            </div>
          </div>

          <div class="report-meta">
            <strong>OFFICIAL AUDIT REPORT</strong><br/>
            Generated: ${escapeHTML(formatDate(new Date().toISOString()))}<br/>
            Total records: ${selectedRecords.length}
          </div>
        </header>

        <h1>Audit Trail Report</h1>

        <div class="description">
          Activity history of the UBO Registry based on the currently
          selected search and filter criteria.
        </div>

        <section class="summary">
          <div class="summary-item">
            <strong>${selectedRecords.length}</strong>
            <span>Matching activities</span>
          </div>

          <div class="summary-item">
            <strong>${approvals}</strong>
            <span>Approvals</span>
          </div>

          <div class="summary-item">
            <strong>${rejections}</strong>
            <span>Rejections</span>
          </div>
        </section>

        <div class="section-title">Applied Filters</div>

        <section class="filters">
          ${filterHTML}
        </section>

        <div class="section-title">Audit Activity Records</div>

        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Date & Time</th>
              <th>Entity Reference</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Role</th>
              <th>Activity Details</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>

        <footer class="footer">
          <span>Dashen Bank | UBO Registry | Audit & Compliance</span>
          <span>Confidential - Authorized Access Only</span>
        </footer>

        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          });

          window.addEventListener('afterprint', function() {
            window.close();
          });
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHTML);
    printWindow.document.close();

  }, [
    loading,
    error,
    filteredLogs,
    entityRef,
    search,
    actionFilter,
    roleFilter,
    fromDate,
    toDate
  ]);

  // =====================================================
  // REFRESH
  // =====================================================

  const handleRefresh = () => {
    setRefreshKey(value => value + 1);
  };

  return (
    <main className="audit-page">

      {/* HEADER */}

      <header className="audit-header">
        <div>
          <div className="audit-eyebrow">
            <span className="audit-eyebrow__dot" />
            COMPLIANCE & GOVERNANCE
          </div>

          <h1>Audit Trail</h1>

          <p>
            Monitor, investigate and trace every activity
            performed across the UBO Registry.
          </p>
        </div>

        <div className="audit-header__actions">

          <button
            className="audit-btn audit-btn--secondary"
            onClick={handlePrint}
            disabled={loading || !!error || !filteredLogs.length}
            type="button"
          >
            <Icon name="printer" />
            Print Report
          </button>

          <button
            className="audit-btn audit-btn--primary"
            onClick={exportCSV}
            disabled={loading || !filteredLogs.length}
            type="button"
          >
            <Icon name="download" />
            Export CSV
          </button>

        </div>
      </header>

      {/* SUMMARY */}

      <section className="audit-stats">

        <StatCard
          title="Total activities"
          value={stats.total}
          icon="activity"
          color="blue"
          description="Loaded audit records"
        />

        <StatCard
          title="Approvals"
          value={stats.approvals}
          icon="check"
          color="green"
          description="Approval activities"
        />

        <StatCard
          title="Rejections"
          value={stats.rejections}
          icon="close"
          color="red"
          description="Rejection activities"
        />

        <StatCard
          title="Unique users"
          value={stats.users}
          icon="user"
          color="purple"
          description="Users in loaded records"
        />

      </section>

      {/* FILTER PANEL */}

      <section className="audit-filter-card">

        <div className="audit-filter-heading">

          <div>
            <h2>
              <Icon name="filter" />
              Activity filters
            </h2>

            <p>
              Find and investigate specific audit records.
            </p>
          </div>

          <button
            type="button"
            className="audit-clear-btn"
            onClick={clearFilters}
          >
            Clear all filters
          </button>

        </div>

        <div className="audit-filter-grid">

          <label className="audit-field audit-field--wide">
            <span>Entity reference</span>

            <div className="audit-input-wrap">
              <Icon name="search" />

              <input
                value={entityRef}
                onChange={e => setEntityRef(e.target.value)}
                placeholder="Search BO-2026-00142"
              />
            </div>
          </label>

          <label className="audit-field audit-field--wide">
            <span>Search activities</span>

            <div className="audit-input-wrap">
              <Icon name="user" />

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Username, action, role or details..."
              />
            </div>
          </label>

          <label className="audit-field">
            <span>Action type</span>

            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="ALL">All actions</option>

              {ACTIONS.map(action => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className="audit-field">
            <span>User role</span>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All roles</option>

              {uniqueRoles.map(role => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="audit-field">
            <span>From date</span>

            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={e => setFromDate(e.target.value)}
            />
          </label>

          <label className="audit-field">
            <span>To date</span>

            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
            />
          </label>

        </div>
      </section>

      {/* AUDIT TABLE */}

      <section className="audit-table-card">

        <div className="audit-table-heading">

          <div>
            <h2>Activity records</h2>

            <p>
              Showing <strong>{filteredLogs.length}</strong> of{' '}
              <strong>{logs.length}</strong> loaded records
            </p>
          </div>

          <button
            type="button"
            className="audit-refresh"
            onClick={handleRefresh}
            disabled={loading}
          >
            <Icon name="refresh" />
            Refresh
          </button>

        </div>

        {error && (
          <div className="audit-error">
            <Icon name="alert" />

            <span>{error}</span>

            <button
              type="button"
              onClick={handleRefresh}
            >
              Retry
            </button>
          </div>
        )}

        <div className="audit-table-scroll">

          <table className="audit-table">

            <thead>
              <tr>
                <th>DATE & TIME</th>
                <th>ENTITY REFERENCE</th>
                <th>ACTION</th>
                <th>PERFORMED BY</th>
                <th>ROLE</th>
                <th>DETAILS</th>
              </tr>
            </thead>

            <tbody>

              {loading && (
                <tr>
                  <td colSpan="6" className="audit-state">
                    <span className="audit-spinner" />
                    Loading audit activities...
                  </td>
                </tr>
              )}

              {!loading && !error && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="6" className="audit-state">

                    <div className="audit-empty">
                      <Icon name="file" size={30} />

                      <strong>No audit records found</strong>

                      <span>
                        Try changing your search criteria or clearing filters.
                      </span>

                      <button
                        type="button"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </button>
                    </div>

                  </td>
                </tr>
              )}

              {!loading && filteredLogs.map((log, index) => {

                const rowId = log.id ?? `${log.createdAt}-${index}`;
                const expanded = expandedId === rowId;

                return (
                  <tr
                    key={rowId}
                    className={expanded ? 'audit-row--expanded' : ''}
                  >

                    <td>
                      <div className="audit-date">
                        <strong>
                          {formatDate(log.createdAt)}
                        </strong>
                      </div>
                    </td>

                    <td>
                      <span className="audit-reference">
                        {log.entityRef || '—'}
                      </span>
                    </td>

                    <td>
                      <ActionBadge action={log.action} />
                    </td>

                    <td>
                      <div className="audit-user">

                        <span className="audit-avatar">
                          {getInitials(log.actorUsername)}
                        </span>

                        <span>
                          {log.actorUsername || 'System'}
                        </span>

                      </div>
                    </td>

                    <td>
                      <span className="audit-role">
                        {getRoles(log.actorRoles)}
                      </span>
                    </td>

                    <td>

                      <button
                        type="button"
                        className="audit-details-btn"
                        onClick={() =>
                          setExpandedId(expanded ? null : rowId)
                        }
                        aria-expanded={expanded}
                      >
                        <Icon name="eye" size={15} />

                        {expanded ? 'Hide details' : 'View details'}

                        <Icon name="chevron" size={14} />
                      </button>

                      {expanded && (
                        <div className="audit-detail-panel">

                          <div className="audit-detail-title">
                            <Icon name="file" />
                            Activity information
                          </div>

                          <dl>

                            <div>
                              <dt>Record ID</dt>
                              <dd>{log.id ?? '—'}</dd>
                            </div>

                            <div>
                              <dt>Entity reference</dt>
                              <dd>{log.entityRef || '—'}</dd>
                            </div>

                            <div>
                              <dt>Action performed</dt>
                              <dd>{log.action || '—'}</dd>
                            </div>

                            <div>
                              <dt>Performed by</dt>
                              <dd>{log.actorUsername || 'System'}</dd>
                            </div>

                            <div>
                              <dt>User roles</dt>
                              <dd>{getRoles(log.actorRoles)}</dd>
                            </div>

                            <div>
                              <dt>Timestamp</dt>
                              <dd>{formatDate(log.createdAt)}</dd>
                            </div>

                          </dl>

                          <div className="audit-detail-description">
                            <strong>Activity description</strong>

                            <p>
                              {log.details ||
                                'No additional details available.'}
                            </p>
                          </div>

                        </div>
                      )}

                    </td>

                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>

        <div className="audit-table-footer">

          <span>
            <Icon name="shield" size={15} />
            Audit records are displayed as returned by the registry.
          </span>

          <span>
            {filteredLogs.length} matching records
          </span>

        </div>

      </section>

      {/* FOOTER */}

      <footer className="audit-page-footer">
        <Icon name="shield" size={15} />
        <span>
          UBO Registry · Audit & Compliance Monitoring
        </span>
      </footer>

    </main>
  );
}
