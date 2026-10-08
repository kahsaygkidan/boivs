import StatusBadge from './StatusBadge.jsx';
import {
  boStatusLabel,
  capacityLabel,
  controlBasisLabel,
  genderLabel,
  idDocumentTypeLabel,
  ownershipTypeLabel,
  residentialStatusLabel,
  sourceOfInformationLabel,
  verificationStatusLabel,
} from '../data/records.js';

/** 2026-10-06 -> 06/10/2026 */
export const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
};

const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${String(d).slice(11, 16)}` : '—');
const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);

/** `no` is the data-field number of the register specification (1-33). */
function Row({ no, label, children }) {
  return (
    <tr>
      <th scope="row">
        {no && <span className="info-no">{no}</span>}
        {label}
      </th>
      <td>{children}</td>
    </tr>
  );
}

function Section({ title }) {
  return (
    <tr className="info-section">
      <th colSpan={2}>{title}</th>
    </tr>
  );
}

/**
 * The complete beneficial-owner register entry (33 data fields + tracing / screening detail),
 * as a label / value table. Used by the record detail page and the checker's verification queue.
 */
export default function UboInfoTable({ record, documents = [] }) {
  const r = record;
  const extent = `${Number(r.ownershipPercentage ?? 0)}%${
    r.ownershipType === 'INDIRECT' ? ' indirect' : r.ownershipType === 'DIRECT' ? ' direct' : ''}`;
  const controlChips = (r.controlBasis || []).map((c) => (
    <span key={c} className="chip chip-control">{controlBasisLabel[c] || c}</span>
  ));
  const boStatus = r.boStatus || (r.status === 'CEASED' ? 'CEASED' : 'ACTIVE');
  const verification = r.verificationStatus || (r.status === 'VERIFIED' ? 'VERIFIED' : r.status === 'PENDING' ? 'PENDING' : 'NOT_VERIFIED');

  return (
    <div className="info-table-wrap">
      <table className="info-table">
        <tbody>
          <Section title="Record and legal person" />
          <Row no={1} label="BO reference number"><span className="mono">{dash(r.boReference)}</span></Row>
          <Row no={2} label="Legal person name">{dash(r.legalPersonName)}</Row>
          <Row no={3} label="Legal person registration number"><span className="mono">{dash(r.legalPersonRegistrationNumber)}</span></Row>
          <Row label="TIN"><span className="mono">{dash(r.legalPersonTin)}</span></Row>
          <Row label="Country of incorporation">{dash(r.legalPersonCountry)}</Row>
          <Row label="Nature of business">{dash(r.legalPersonNatureOfBusiness)}</Row>
          <Row label="Directors and senior management">{dash(r.legalPersonDirectors)}</Row>

          <Section title="Beneficial owner" />
          <Row no={4} label="Full name"><strong>{dash(r.fullName)}</strong></Row>
          <Row no={5} label="Gender">{genderLabel[r.gender] || dash(r.gender)}</Row>
          <Row no={6} label="Date of birth">{fmtDate(r.dateOfBirth)}</Row>
          <Row no={7} label="Place of birth">{dash(r.placeOfBirth)}</Row>
          <Row no={8} label="Nationality">{dash(r.nationality)}</Row>
          <Row no={9} label="Residential status">{residentialStatusLabel[r.residentialStatus] || dash(r.residentialStatus)}</Row>
          <Row no={10} label="Residential address">{dash(r.residentialAddress)}</Row>
          <Row no={11} label="Email address">{dash(r.emailAddress)}</Row>
          <Row no={12} label="Telephone number">{dash(r.phoneNumber)}</Row>
          <Row no={13} label="Occupation / profession">{dash(r.occupation)}</Row>

          <Section title="Identification document" />
          <Row no={14} label="Identification document type">{idDocumentTypeLabel[r.idDocumentType] || dash(r.idDocumentType)}</Row>
          <Row label="ID verification status">
            <span className={`chip ${r.idVerificationStatus === 'VERIFIED' ? 'chip-ubo' : r.idVerificationStatus === 'PENDING' ? 'chip-control' : 'chip-muted'}`}>
              {verificationStatusLabel[r.idVerificationStatus] || '—'}
            </span>
          </Row>
          {r.idTypeDetail && (
            <Row label={r.idDocumentType === 'KEBELE_ID' ? 'Kebele / Woreda' : 'Document name / type'}>{r.idTypeDetail}</Row>
          )}
          <Row no={15} label="Identification number"><span className="mono">{dash(r.idNumber)}</span></Row>
          <Row no={16} label="Country of issue">{dash(r.countryOfIssue)}</Row>
          <Row no={17} label="Date of issue">{fmtDate(r.dateOfIssue)}</Row>
          <Row no={18} label="Date of expiry">
            {fmtDate(r.dateOfExpiry)} <StatusBadge status={r.idExpired ? 'EXPIRED' : 'ACTIVE'} />
          </Row>
          <Row label="Verified document">
            {documents.length > 0
              ? <>{documents.length} document{documents.length > 1 ? 's' : ''} attached
                <div className="info-sub">{documents.map((d) => d.fileName).join(', ')}</div></>
              : <span className="tree-warn" style={{ margin: 0 }}>No document attached</span>}
          </Row>

          <Section title="Ownership and control" />
          <Row no={19} label="Ownership / control nature">
            {dash(r.ownershipNature)}
            <div className="info-sub">{capacityLabel[r.capacity] || ''}</div>
          </Row>
          <Row no={20} label="Ownership / control type">{ownershipTypeLabel[r.ownershipType] || dash(r.ownershipType)}</Row>
          <Row no={21} label="Ownership / control extent">{extent}</Row>
          <Row label="Ownership chain">{r.ownershipChain ? <div className="chain">{r.ownershipChain}</div> : '—'}</Row>
          <Row label="Control basis">
            {r.capacity === 'OWNERSHIP' && <span className="chip chip-ubo">Ownership</span>}
            {controlChips}
            {r.capacity !== 'OWNERSHIP' && controlChips.length === 0 && '—'}
          </Row>
          <Row no={22} label="Date became beneficial owner">{fmtDate(r.dateBecameBo)}</Row>
          <Row no={23} label="Date ceased to be beneficial owner">{fmtDate(r.dateCeased)}</Row>
          <Row no={24} label="BO status">
            <span className={`chip ${boStatus === 'ACTIVE' ? 'chip-ubo' : 'chip-muted'}`}>{boStatusLabel[boStatus]}</span>
          </Row>

          <Section title="PEP, screening and source of wealth" />
          <Row no={25} label="PEP status">{r.pep ? 'Yes — politically exposed person' : 'No (screened)'}</Row>
          <Row no={26} label="PEP details">{r.pep ? dash(r.pepDetails) : '—'}</Row>
          <Row label="Sanctions">{r.sanctionsScreened ? 'Screened' : <span className="tree-warn" style={{ margin: 0 }}>Not recorded</span>}</Row>
          <Row label="Source of wealth">{dash(r.sourceOfWealth)}</Row>
          <Row label="Source of funds">{dash(r.sourceOfFunds)}</Row>

          <Section title="Verification" />
          <Row no={27} label="Source of information">{sourceOfInformationLabel[r.sourceOfInformation] || dash(r.sourceOfInformation)}</Row>
          <Row no={28} label="Verification status">
            <span className={`chip ${verification === 'VERIFIED' ? 'chip-ubo' : verification === 'PENDING' ? 'chip-control' : 'chip-muted'}`}>
              {verificationStatusLabel[verification]}
            </span>
          </Row>
          <Row no={29} label="Verification date">{fmtDateTime(r.verificationDate)}</Row>
          <Row no={30} label="Additional information">{dash(r.additionalInformation)}</Row>
          {r.rejectionReason && <Row label="Reason / notes">{r.rejectionReason}</Row>}

          <Section title="Record audit" />
          <Row no={31} label="Record created date">{fmtDateTime(r.createdAt)}</Row>
          <Row no={32} label="Last updated date">{fmtDateTime(r.updatedAt || r.createdAt)}</Row>
          <Row no={33} label="Updated by">{dash(r.updatedBy || r.createdBy)}</Row>
          <Row label="Submitted by (maker)">{dash(r.createdBy)}</Row>
          {r.decidedBy && <Row label="Decided by (checker)">{r.decidedBy} · {fmtDateTime(r.decidedAt)}</Row>}
        </tbody>
      </table>
    </div>
  );
}
