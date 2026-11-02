import { useEffect, useMemo, useState } from 'react';
import {
  Building2, Users, Search, Filter, Download, Printer, ChevronDown,
  CheckCircle2, Clock3, X, FileText, RefreshCw, Phone, UserRound,
  Network, ClipboardList,
} from 'lucide-react';
import { listLegalPersons, listAuditLogs } from '../api/bovsApi.js';
import { useBackgroundTrees } from '../components/DashboardKpis.jsx';
import '../styles/Reports.css';

const VERIFIED = ['VERIFIED', 'APPROVED'];

const ENTITY_LABELS = {
  SHARE_COMPANY: 'Share Company',
  PRIVATE_LIMITED_COMPANY: 'Private Limited Company',
  ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_LIMITED_COMPANY: 'Public Limited Company',
  GENERAL_PARTNERSHIP: 'General Partnership',
  LIMITED_PARTNERSHIP: 'Limited Partnership',
  LIMITED_LIABILITY_PARTNERSHIP: 'Limited Liability Partnership',
  FINANCIAL_INSTITUTION: 'Financial Institution',
  FOREIGN_LEGAL_PERSON: 'Foreign Legal Person',
  PPP: 'Public Private Partnership',
  CIVIL_SOCIETY_ORGANIZATION: 'Civil Society Organisation',
  GOVERNMENT_OWNED_ENTERPRISE: 'Government-Owned Enterprise',
  COOPERATIVE_ASSOCIATION: 'Cooperative Association',
  PUBLIC_ADMINISTRATION: 'Public Administration',
  RELIGIOUS_INSTITUTION: 'Religious Institution',
  INTERNATIONAL_ORGANIZATION: 'International Organisation',
  TRUST: 'Trust',
  CHARITY: 'Charity',
  INDIVIDUAL: 'Individual',
  OTHER: 'Other',
};

const SECTOR_LABELS = {
  OTHER: 'Other',
  MINING: 'Mining',
  REAL_ESTATE: 'Real Estate',
  MOTOR_DEALERSHIP: 'Motor Dealership',
  IMPORT_EXPORT: 'Import / Export',
  FINANCIAL: 'Financial',
};

const HIGH_RISK_SECTORS = new Set([
  'MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT',
]);

const TABS = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'details', label: 'Entity details', icon: UserRound },
  { key: 'ownership', label: 'Ownership breakdown', icon: Network },
  { key: 'threshold', label: 'Threshold report', icon: Filter },
  { key: 'audit', label: 'Audit trail', icon: ClipboardList },
];

function getThreshold(entityType, sector) {
  switch (entityType) {
    case 'SHARE_COMPANY':
      return HIGH_RISK_SECTORS.has(sector) ? 5 : 10;
    case 'PRIVATE_LIMITED_COMPANY':
      return 5;
    case 'FINANCIAL_INSTITUTION':
      return 2;
    case 'GENERAL_PARTNERSHIP':
    case 'LIMITED_PARTNERSHIP':
    case 'LIMITED_LIABILITY_PARTNERSHIP':
    case 'PPP':
      return 25;
    default:
      return null;
  }
}

const holdersOf = (entity) =>
  (entity?.tree?.holders || []).filter((holder) => holder.ubo);

const getPhone = (person) =>
  person?.phoneNumber ||
  person?.phone ||
  person?.mobileNumber ||
  person?.mobile ||
  person?.telephoneNumber ||
  person?.contactNumber ||
  '-';

const getEntityPhone = (entity) =>
  entity?.phoneNumber ||
  entity?.phone ||
  entity?.mobileNumber ||
  entity?.mobile ||
  entity?.telephoneNumber ||
  entity?.contactNumber ||
  '-';

const getStatusGroup = (status) => {
  if (VERIFIED.includes(status)) return 'VERIFIED';
  if (status === 'PENDING') return 'PENDING';
  if (status === 'REJECTED') return 'REJECTED';
  return 'OTHER';
};

const getStatusLabel = (status) => {
  const group = getStatusGroup(status);
  if (group === 'VERIFIED') return 'Verified';
  if (group === 'PENDING') return 'Pending';
  if (group === 'REJECTED') return 'Rejected';
  return status || 'Other';
};

const statusClass = (status) => {
  const group = getStatusGroup(status);
  if (group === 'VERIFIED') return 'er-status er-status--verified';
  if (group === 'REJECTED') return 'er-status er-status--rejected';
  if (group === 'PENDING') return 'er-status er-status--pending';
  return 'er-status er-status--other';
};

const isDirectHolder = (holder) => {
  const paths = holder?.paths || [];
  if (!paths.length) return true;
  return paths.every((path) => String(path.chain || '').split('→').filter(Boolean).length <= 2);
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toCsv = (headers, rows) =>
  [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }) {
  return (
    <label className="er-field">
      <span className="er-field__label">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value, caption, icon: Icon, tone = 'default' }) {
  return (
    <article className={`er-kpi er-kpi--${tone}`}>
      <div className="er-kpi__top">
        <span>{label}</span>
        <span className="er-kpi__icon"><Icon size={17} /></span>
      </div>
      <strong className="er-kpi__value">{Number(value || 0).toLocaleString()}</strong>
      <span className="er-kpi__caption">{caption}</span>
    </article>
  );
}

function Section({ title, subtitle, children, actions }) {
  return (
    <section className="er-card">
      <header className="er-card__head">
        <div>
          <h2 className="er-card__title">{title}</h2>
          {subtitle && <p className="er-card__subtitle">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function EntityCell({ entity }) {
  return (
    <div className="er-entity-cell">
      <span className="er-entity-icon"><Building2 size={16} /></span>
      <span className="er-entity-copy">
        <strong>{entity.name || '-'}</strong>
        <small>{entity.registrationNumber || 'No registration number'}</small>
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={statusClass(status)}>{getStatusLabel(status)}</span>;
}

function EmptyState({ children }) {
  return <div className="er-empty-state">{children}</div>;
}

function EntityDetails({ entity, statusFilter }) {
  if (!entity) {
    return <EmptyState>Select a legal entity to view its details.</EmptyState>;
  }

  const allUbos = holdersOf(entity);
  const visibleUbos = statusFilter
    ? allUbos.filter((holder) => getStatusGroup(holder.status) === statusFilter)
    : allUbos;
  const fallback = entity.tree?.seniorManagingOfficial || entity.seniorManagingOfficial;

  return (
    <div className="er-details-layout">
      <Section
        title="Legal entity information"
        subtitle="Registered entity and contact information"
      >
        <div className="er-detail-grid">
          <Detail label="Legal entity name" value={entity.name} />
          <Detail label="Registration number" value={entity.registrationNumber} />
          <Detail label="Entity type" value={ENTITY_LABELS[entity.entityType] || entity.entityType} />
          <Detail label="Sector" value={SECTOR_LABELS[entity.sector] || entity.sector} />
          <Detail label="Phone number" value={getEntityPhone(entity)} icon={Phone} />
          <Detail label="Country of incorporation" value={entity.countryOfIncorporation} />
          <Detail label="TIN" value={entity.tin} />
          <Detail label="CIF number" value={entity.cifNumber} />
        </div>
      </Section>

      <Section
        title="Beneficial owners"
        subtitle={`${visibleUbos.length} matching beneficial owner${visibleUbos.length === 1 ? '' : 's'}`}
      >
        {entity.tree ? (
          visibleUbos.length ? (
            <div className="er-table-wrap">
              <table className="er-table">
                <thead>
                  <tr>
                    <th>Full name</th>
                    <th>Phone number</th>
                    <th>ID number</th>
                    <th>Ownership</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUbos.map((holder, index) => (
                    <tr key={holder.key || holder.id || index}>
                      <td><strong>{holder.fullName || '-'}</strong></td>
                      <td>{getPhone(holder)}</td>
                      <td>{holder.idNumber || '-'}</td>
                      <td>{holder.effectivePercentage ?? 0}%</td>
                      <td>{isDirectHolder(holder) ? 'Direct' : 'Indirect'}</td>
                      <td><StatusBadge status={holder.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>
              {allUbos.length
                ? 'No beneficial owners match the selected status.'
                : 'No beneficial owner records are available for this entity.'}
            </EmptyState>
          )
        ) : (
          <EmptyState>Ownership details are still loading.</EmptyState>
        )}
      </Section>

      {entity.tree && allUbos.length === 0 && fallback && (
        <Section
          title="Senior Managing Official"
          subtitle="Fallback person recorded because no beneficial owner is identified"
        >
          <div className="er-fallback">
            <div className="er-fallback__avatar"><UserRound size={20} /></div>
            <div className="er-fallback__content">
              <strong>{fallback.name || fallback.fullName || '-'}</strong>
              <span>{fallback.position || 'Senior Managing Official'}</span>
              <span><Phone size={13} /> {getPhone(fallback)}</span>
              {fallback.idNumber && <span>ID: {fallback.idNumber}</span>}
            </div>
            <span className="er-status er-status--fallback">Fallback</span>
          </div>
        </Section>
      )}

      {entity.tree && allUbos.length === 0 && !fallback && (
        <Section title="Ownership fallback" subtitle="No UBO or fallback record is available">
          <EmptyState>No UBO or Senior Managing Official information available.</EmptyState>
        </Section>
      )}
    </div>
  );
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="er-detail-item">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
      {Icon && <Icon className="er-detail-item__icon" size={14} />}
    </div>
  );
}

function ExportMenu({ onExport, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="er-export">
      <button
        type="button"
        className="er-btn er-btn--primary"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={15} /> Export <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <button className="er-menu-backdrop" aria-label="Close export menu" onClick={() => setOpen(false)} />
          <div className="er-export-menu">
            {[
              ['csv', 'CSV file'],
              ['excel', 'Excel file'],
              ['word', 'Word document'],
              ['pdf', 'Print / Save as PDF'],
            ].map(([format, label]) => (
              <button
                type="button"
                key={format}
                onClick={() => {
                  setOpen(false);
                  onExport(format);
                }}
              >
                {format === 'pdf' ? <Printer size={15} /> : <FileText size={15} />}
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [entityId, setEntityId] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLegalPersons({ size: 500, sort: 'name' })
      .then((response) => {
        if (!cancelled) {
          setLegalPersons(response?.content || []);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.friendlyMessage || err?.message || 'Failed to load legal entities.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const { failed = 0 } = useBackgroundTrees(legalPersons, trees, setTrees);

  useEffect(() => {
    if (activeTab !== 'audit') return undefined;
    let cancelled = false;
    setAuditLoading(true);
    listAuditLogs({ size: 100 })
      .then((response) => {
        if (!cancelled) setAuditLogs(response?.content || []);
      })
      .catch(() => {
        if (!cancelled) setAuditLogs([]);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  const entities = useMemo(() => legalPersons.map((person) => ({
    ...person,
    id: person.id,
    name: person.name,
    tree: trees[person.id] || null,
    seniorManagingOfficial: trees[person.id]?.seniorManagingOfficial || person.seniorManagingOfficial || null,
  })), [legalPersons, trees]);

  const loadedCount = entities.filter((entity) => entity.tree).length;
  const syncing = !loading && loadedCount + failed < entities.length;
  const progress = entities.length
    ? Math.min(100, Math.round(((loadedCount + failed) / entities.length) * 100))
    : 100;

  const filtered = useMemo(() => entities.filter((entity) => {
    if (entityId && String(entity.id) !== String(entityId)) return false;
    if (entityTypeFilter && entity.entityType !== entityTypeFilter) return false;
    if (sectorFilter && entity.sector !== sectorFilter) return false;

    const query = search.trim().toLowerCase();
    if (query) {
      const searchable = [
        entity.name,
        entity.registrationNumber,
        entity.tin,
        entity.cifNumber,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    if (statusFilter) {
      const matching = holdersOf(entity).some(
        (holder) => getStatusGroup(holder.status) === statusFilter,
      );
      if (!matching) return false;
    }
    return true;
  }), [entities, entityId, entityTypeFilter, sectorFilter, statusFilter, search]);

  const selected = filtered.find((entity) => String(entity.id) === String(selectedId))
    || filtered.find((entity) => String(entity.id) === String(entityId))
    || filtered[0]
    || null;

  useEffect(() => {
    if (selected && String(selectedId) !== String(selected.id)) {
      setSelectedId(selected.id);
    }
    if (!selected && selectedId) setSelectedId('');
  }, [selected, selectedId]);

  const visibleHolderRows = useMemo(() => filtered.flatMap((entity) =>
    holdersOf(entity)
      .filter((holder) => !statusFilter || getStatusGroup(holder.status) === statusFilter)
      .map((holder) => ({ entity, holder })),
  ), [filtered, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { verified: 0, pending: 0, rejected: 0, other: 0 };
    filtered.forEach((entity) => {
      holdersOf(entity)
        .filter((holder) => !statusFilter || getStatusGroup(holder.status) === statusFilter)
        .forEach((holder) => {
          const group = getStatusGroup(holder.status);
          if (group === 'VERIFIED') counts.verified += 1;
          else if (group === 'PENDING') counts.pending += 1;
          else if (group === 'REJECTED') counts.rejected += 1;
          else counts.other += 1;
        });
    });
    return counts;
  }, [filtered, statusFilter]);

  const totalUbos = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const filterSummary = [
    entityId && `Entity: ${entities.find((entity) => String(entity.id) === String(entityId))?.name || entityId}`,
    entityTypeFilter && `Type: ${ENTITY_LABELS[entityTypeFilter] || entityTypeFilter}`,
    sectorFilter && `Sector: ${SECTOR_LABELS[sectorFilter] || sectorFilter}`,
    statusFilter && `Status: ${statusFilter === 'VERIFIED' ? 'Verified' : statusFilter[0] + statusFilter.slice(1).toLowerCase()}`,
    search && `Search: ${search}`,
  ].filter(Boolean);

  const clearFilters = () => {
    setEntityId('');
    setEntityTypeFilter('');
    setSectorFilter('');
    setStatusFilter('');
    setSearch('');
  };

  const thresholdRows = useMemo(() => filtered.map((entity) => {
    const holders = holdersOf(entity).filter(
      (holder) => !statusFilter || getStatusGroup(holder.status) === statusFilter,
    );
    const threshold = getThreshold(entity.entityType, entity.sector);
    return {
      entity,
      threshold,
      above: threshold == null ? [] : holders.filter((holder) => Number(holder.effectivePercentage) >= threshold),
      below: threshold == null ? [] : holders.filter((holder) => Number(holder.effectivePercentage) < threshold),
      holders,
    };
  }), [filtered, statusFilter]);

  const exportSpec = useMemo(() => {
    if (activeTab === 'details' && selected) {
      const holders = holdersOf(selected).filter(
        (holder) => !statusFilter || getStatusGroup(holder.status) === statusFilter,
      );
      const rows = holders.length
        ? holders.map((holder) => [
          selected.name,
          holder.fullName,
          getPhone(holder),
          holder.idNumber || '',
          holder.effectivePercentage ?? '',
          isDirectHolder(holder) ? 'Direct' : 'Indirect',
          getStatusLabel(holder.status),
        ])
        : selected.tree && selected.tree.holders?.filter((holder) => holder.ubo).length === 0 && selected.seniorManagingOfficial
          ? [[selected.name, selected.seniorManagingOfficial.name || '', getPhone(selected.seniorManagingOfficial), selected.seniorManagingOfficial.idNumber || '', '', 'Fallback', 'Fallback']]
          : [];
      return {
        name: 'entity-details',
        headers: ['Legal entity', 'UBO / Fallback name', 'Phone number', 'ID number', 'Ownership %', 'Ownership type', 'Status'],
        rows,
      };
    }

    if (activeTab === 'ownership') {
      return {
        name: 'ownership-breakdown',
        headers: ['Legal entity', 'Registration number', 'Beneficial owner', 'Phone number', 'Ownership %', 'Ownership type', 'Status', 'Ownership chain'],
        rows: visibleHolderRows.map(({ entity, holder }) => [
          entity.name, entity.registrationNumber || '', holder.fullName || '', getPhone(holder),
          holder.effectivePercentage ?? '', isDirectHolder(holder) ? 'Direct' : 'Indirect',
          getStatusLabel(holder.status), (holder.paths || []).map((path) => path.chain).join('; '),
        ]),
      };
    }

    if (activeTab === 'threshold') {
      return {
        name: 'threshold-report',
        headers: ['Legal entity', 'Registration number', 'Entity type', 'Sector', 'Threshold %', 'At / above threshold', 'Below threshold', 'Total UBOs'],
        rows: thresholdRows.map((row) => [
          row.entity.name, row.entity.registrationNumber || '',
          ENTITY_LABELS[row.entity.entityType] || row.entity.entityType || '',
          SECTOR_LABELS[row.entity.sector] || row.entity.sector || '',
          row.threshold ?? 'N/A', row.above.length, row.below.length, row.holders.length,
        ]),
      };
    }

    if (activeTab === 'audit') {
      return {
        name: 'audit-trail',
        headers: ['Timestamp', 'Action', 'Actor', 'Entity'],
        rows: auditLogs.map((log) => [
          String(log.createdAt || '').replace('T', ' ').slice(0, 19),
          log.action || '', log.actorUsername || '', log.entityRef || '',
        ]),
      };
    }

    return {
      name: 'entity-overview',
      headers: ['Legal entity', 'Registration number', 'Entity type', 'Sector', 'Phone number', 'UBOs', 'Verified', 'Pending', 'Rejected', 'Fallback'],
      rows: filtered.map((entity) => {
        const holders = holdersOf(entity);
        return [
          entity.name, entity.registrationNumber || '',
          ENTITY_LABELS[entity.entityType] || entity.entityType || '',
          SECTOR_LABELS[entity.sector] || entity.sector || '',
          getEntityPhone(entity), holders.length,
          holders.filter((holder) => getStatusGroup(holder.status) === 'VERIFIED').length,
          holders.filter((holder) => holder.status === 'PENDING').length,
          holders.filter((holder) => holder.status === 'REJECTED').length,
          holders.length === 0 && !!entity.seniorManagingOfficial ? 'Yes' : 'No',
        ];
      }),
    };
  }, [activeTab, selected, statusFilter, visibleHolderRows, thresholdRows, auditLogs, filtered]);

  const handleExport = (format) => {
    const { name, headers, rows } = exportSpec;
    const filename = `${name}-${today()}`;
    if (format === 'csv') {
      downloadFile(`\uFEFF${toCsv(headers, rows)}`, `${filename}.csv`, 'text/csv;charset=utf-8;');
      return;
    }
    if (format === 'excel') {
      downloadFile(`\uFEFF${toCsv(headers, rows)}`, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }

    const title = `Beneficial Ownership Report - ${TABS.find((tab) => tab.key === activeTab)?.label || 'Overview'}`;
    const tableHead = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
    const tableBody = rows.length
      ? rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}" class="empty">No records match the selected filters.</td></tr>`;
    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        @page{size:landscape;margin:14mm}
        *{box-sizing:border-box}
        body{font:10pt/1.45 Arial,sans-serif;color:#172033;margin:22px}
        h1{font-size:20pt;margin:5px 0;color:#12315b}
        .brand{font-size:9pt;letter-spacing:1.4px;text-transform:uppercase;color:#64748b;font-weight:700}
        .meta{font-size:9pt;color:#64748b;margin:5px 0 16px}
        .filters{padding:10px 12px;background:#f3f6fb;border:1px solid #dce4ef;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        thead{display:table-header-group}
        tr{break-inside:avoid;page-break-inside:avoid}
        th{background:#12315b!important;color:#fff!important;text-align:left;padding:8px;border:1px solid #12315b;font-size:8.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        td{padding:7px;border:1px solid #dbe2ec;vertical-align:top;overflow-wrap:anywhere;font-size:8.5pt}
        tbody tr:nth-child(even){background:#f7f9fc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .empty{text-align:center;padding:20px;color:#64748b}
        .print-btn{border:0;background:#12315b;color:#fff;padding:9px 14px;border-radius:6px;margin-bottom:16px;cursor:pointer}
        @media print{body{margin:0}.print-btn{display:none}}
      </style></head><body>
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <div class="brand">Compliance reporting</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())} · ${rows.length} records</p>
        <div class="filters"><strong>Applied filters:</strong> ${escapeHtml(filterSummary.join(' · ') || 'None')}</div>
        <table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
      </body></html>`;

    if (format === 'word') {
      const wordBlob = new Blob([html], { type: 'application/msword;charset=utf-8;' });
      const url = URL.createObjectURL(wordBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filename}.doc`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('The print window was blocked. Allow pop-ups and try again.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const renderOverview = () => (
    <>
      <div className="er-kpis">
        <Kpi label="Legal entities" value={filtered.length} caption={`${entities.length} registered entities`} icon={Building2} />
        <Kpi label="Beneficial owners" value={totalUbos} caption="In the selected entity scope" icon={Users} tone="blue" />
        <Kpi label="Verified" value={statusCounts.verified} caption="Approved beneficial owners" icon={CheckCircle2} tone="green" />
        <Kpi label="Pending" value={statusCounts.pending} caption="Awaiting review" icon={Clock3} tone="amber" />
      </div>

      <Section title="Entity register" subtitle="Select an entity to inspect its beneficial owners and fallback information">
        <div className="er-table-wrap">
          <table className="er-table">
            <thead>
              <tr>
                <th>Legal entity</th>
                <th>Entity type</th>
                <th>Sector</th>
                <th>Phone number</th>
                <th className="er-number">UBOs</th>
                <th className="er-number">Verified</th>
                <th className="er-number">Pending</th>
                <th>Fallback</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="8" className="er-table-empty">Loading legal entities...</td></tr>}
              {!loading && !filtered.length && <tr><td colSpan="8" className="er-table-empty">No entities match the selected filters.</td></tr>}
              {!loading && filtered.map((entity) => {
                const holders = holdersOf(entity);
                return (
                  <tr
                    key={entity.id}
                    className={selected?.id === entity.id ? 'er-row-selected' : ''}
                    onClick={() => { setSelectedId(entity.id); setActiveTab('details'); }}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(entity.id);
                        setActiveTab('details');
                      }
                    }}
                  >
                    <td><EntityCell entity={entity} /></td>
                    <td>{ENTITY_LABELS[entity.entityType] || entity.entityType || '-'}</td>
                    <td>{SECTOR_LABELS[entity.sector] || entity.sector || '-'}</td>
                    <td>{getEntityPhone(entity)}</td>
                    <td className="er-number">{holders.length}</td>
                    <td className="er-number">{holders.filter((holder) => getStatusGroup(holder.status) === 'VERIFIED').length}</td>
                    <td className="er-number">{holders.filter((holder) => holder.status === 'PENDING').length}</td>
                    <td>
                      {holders.length === 0 && entity.seniorManagingOfficial
                        ? <span className="er-status er-status--fallback">Available</span>
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      {selected && (
        <EntityDetails entity={selected} statusFilter={statusFilter} />
      )}
    </>
  );

  const renderOwnership = () => (
    <Section title="Detailed ownership breakdown" subtitle="Beneficial owners, contact numbers, ownership percentages and status">
      <div className="er-table-wrap">
        <table className="er-table">
          <thead>
            <tr>
              <th>Legal entity</th>
              <th>Beneficial owner</th>
              <th>Phone number</th>
              <th>ID number</th>
              <th>Ownership</th>
              <th>Type</th>
              <th>Status</th>
              <th>Ownership chain</th>
            </tr>
          </thead>
          <tbody>
            {!visibleHolderRows.length && <tr><td colSpan="8" className="er-table-empty">No beneficial owner records match the selected filters.</td></tr>}
            {visibleHolderRows.map(({ entity, holder }, index) => (
              <tr key={`${entity.id}-${holder.key || holder.id || index}`}>
                <td>{entity.name}</td>
                <td><strong>{holder.fullName || '-'}</strong></td>
                <td>{getPhone(holder)}</td>
                <td>{holder.idNumber || '-'}</td>
                <td>{holder.effectivePercentage ?? 0}%</td>
                <td>{isDirectHolder(holder) ? 'Direct' : 'Indirect'}</td>
                <td><StatusBadge status={holder.status} /></td>
                <td className="er-chain">{(holder.paths || []).map((path) => path.chain).filter(Boolean).join(' / ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  const renderThreshold = () => (
    <Section title="Threshold report" subtitle="Beneficial owners compared with the applicable ownership threshold">
      <div className="er-table-wrap">
        <table className="er-table">
          <thead>
            <tr>
              <th>Legal entity</th>
              <th>Entity type</th>
              <th>Sector</th>
              <th>Threshold</th>
              <th className="er-number">At / above</th>
              <th className="er-number">Below</th>
              <th className="er-number">Total UBOs</th>
            </tr>
          </thead>
          <tbody>
            {!thresholdRows.length && <tr><td colSpan="7" className="er-table-empty">No threshold data available.</td></tr>}
            {thresholdRows.map((row) => (
              <tr key={row.entity.id}>
                <td><EntityCell entity={row.entity} /></td>
                <td>{ENTITY_LABELS[row.entity.entityType] || row.entity.entityType || '-'}</td>
                <td>{SECTOR_LABELS[row.entity.sector] || row.entity.sector || '-'}</td>
                <td>{row.threshold == null ? 'N/A' : `${row.threshold}%`}</td>
                <td className="er-number">{row.above.length}</td>
                <td className="er-number">{row.below.length}</td>
                <td className="er-number"><strong>{row.holders.length}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  const renderAudit = () => (
    <Section title="Audit trail" subtitle="Recent system actions and reviewer activity">
      <div className="er-table-wrap">
        <table className="er-table">
          <thead>
            <tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Entity reference</th></tr>
          </thead>
          <tbody>
            {auditLoading && <tr><td colSpan="4" className="er-table-empty">Loading audit entries...</td></tr>}
            {!auditLoading && !auditLogs.length && <tr><td colSpan="4" className="er-table-empty">No audit entries available.</td></tr>}
            {!auditLoading && auditLogs.map((log, index) => (
              <tr key={log.id || index}>
                <td>{String(log.createdAt || '').replace('T', ' ').slice(0, 19) || '-'}</td>
                <td>{log.action || '-'}</td>
                <td>{log.actorUsername || '-'}</td>
                <td>{log.entityRef || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  return (
    <main className="er-root">
      <header className="er-page-header">
        <div>
          <div className="er-eyebrow">COMPLIANCE REPORTING</div>
          <h1>Beneficial Ownership Reports</h1>
          <p>Review legal entities, beneficial owners, ownership percentages and verification status.</p>
          <div className="er-page-meta">
            <span>Generated {new Date().toLocaleString()}</span>
            <span>{filtered.length} of {entities.length} entities</span>
            {syncing && <span className="er-sync-label"><RefreshCw size={12} /> Loading ownership data {progress}%</span>}
          </div>
        </div>
        <ExportMenu onExport={handleExport} disabled={loading || (activeTab === 'audit' && auditLoading)} />
      </header>

      {error && <div className="er-alert er-alert--error">{error}</div>}
      {syncing && (
        <div className="er-progress-wrap">
          <div className="er-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <small>Loading ownership information for registered entities...</small>
        </div>
      )}
      {!syncing && failed > 0 && (
        <div className="er-alert er-alert--warning">
          Ownership information could not be loaded for {failed} {failed === 1 ? 'entity' : 'entities'}. Refresh the page to retry.
        </div>
      )}

      <nav className="er-tabs" aria-label="Report sections">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            className={activeTab === key ? 'er-tab er-tab--active' : 'er-tab'}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      <section className="er-filter-panel">
        <div className="er-filter-heading">
          <div><Filter size={15} /> <strong>Filters</strong></div>
          {filterSummary.length > 0 && (
            <button type="button" className="er-clear-btn" onClick={clearFilters}>
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
        <div className="er-filter-grid">
          <Field label="Search entity">
            <div className="er-search-input">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, registration, TIN..."
              />
            </div>
          </Field>
          <Field label="Legal entity">
            <select value={entityId} onChange={(event) => setEntityId(event.target.value)}>
              <option value="">All entities</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Entity type">
            <select value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)}>
              <option value="">All types</option>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Sector">
            <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              <option value="">All sectors</option>
              {Object.entries(SECTOR_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="BO status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="VERIFIED">Verified / Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <div className="er-filter-count">
            <strong>{filtered.length}</strong>
            <span>Entities found</span>
          </div>
        </div>
      </section>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'details' && (
        selected
          ? <EntityDetails entity={selected} statusFilter={statusFilter} />
          : <EmptyState>Select an entity or adjust your filters.</EmptyState>
      )}
      {activeTab === 'ownership' && renderOwnership()}
      {activeTab === 'threshold' && renderThreshold()}
      {activeTab === 'audit' && renderAudit()}
    </main>
  );
}
