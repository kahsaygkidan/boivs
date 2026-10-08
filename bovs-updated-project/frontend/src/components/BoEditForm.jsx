import { useState } from 'react';
import {
  idDocumentTypeLabel,
  residentialStatusLabel,
  sourceOfInformationLabel,
  verificationStatusLabel,
} from '../data/records.js';

/**
 * Maker edit form for a BO record that is not yet verified.
 * No validation: any field can be saved as it is (the checker reviews before approval).
 * Ownership %, type, chain and control basis come from the ownership structure and are read-only.
 */
export default function BoEditForm({ record, busy, onSave, onCancel }) {
  const [f, setF] = useState({
    fullName: record.fullName || '',
    gender: record.gender || '',
    dateOfBirth: record.dateOfBirth || '',
    placeOfBirth: record.placeOfBirth || '',
    nationality: record.nationality || '',
    residentialStatus: record.residentialStatus || '',
    residentialAddress: record.residentialAddress || '',
    emailAddress: record.emailAddress || '',
    phoneNumber: record.phoneNumber || '',
    occupation: record.occupation || '',
    idDocumentType: record.idDocumentType || '',
    idVerificationStatus: record.idVerificationStatus || '',
    idTypeDetail: record.idTypeDetail || '',
    idNumber: record.idNumber || '',
    countryOfIssue: record.countryOfIssue || '',
    dateOfIssue: record.dateOfIssue || '',
    dateOfExpiry: record.dateOfExpiry || '',
    dateBecameBo: record.dateBecameBo || '',
    pep: Boolean(record.pep),
    pepDetails: record.pepDetails || '',
    sourceOfInformation: record.sourceOfInformation || '',
    additionalInformation: record.additionalInformation || '',
    sourceOfWealth: record.sourceOfWealth || '',
    sourceOfFunds: record.sourceOfFunds || '',
    sanctionsScreened: Boolean(record.sanctionsScreened),
  });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  const text = (label, key, type = 'text') => (
    <div className="form-field">
      <label>{label}</label>
      <input type={type} value={f[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </div>
  );
  const select = (label, key, options) => (
    <div className="form-field">
      <label>{label}</label>
      <select value={f[key]} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">—</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  const submit = (e) => {
    e.preventDefault();
    // empty dates are sent as null (= unchanged); empty text clears optional fields
    const payload = { ...f };
    ['dateOfBirth', 'dateOfIssue', 'dateOfExpiry', 'dateBecameBo'].forEach((k) => { if (!payload[k]) payload[k] = null; });
    ['gender', 'residentialStatus', 'idDocumentType', 'idVerificationStatus', 'sourceOfInformation']
      .forEach((k) => { if (!payload[k]) payload[k] = null; });
    onSave(payload);
  };

  return (
    <form className="form-card" onSubmit={submit}>
      <h3>Edit record</h3>
      <div className="hint">
        You can edit this record until it is verified. No validation is applied; the checker reviews it before approval.
        Ownership %, type, chain and control basis come from the ownership structure and are not edited here.
      </div>

      <div className="grid-3">
        {text('Full name', 'fullName')}
        {select('Gender', 'gender', [['MALE', 'Male'], ['FEMALE', 'Female']])}
        {text('Date of birth', 'dateOfBirth', 'date')}
      </div>
      <div className="grid-3">
        {text('Place of birth', 'placeOfBirth')}
        {text('Nationality', 'nationality')}
        {select('Residential status', 'residentialStatus', Object.entries(residentialStatusLabel))}
      </div>
      <div className="grid-3">
        {text('Email address', 'emailAddress')}
        {text('Telephone number', 'phoneNumber')}
        {text('Occupation / profession', 'occupation')}
      </div>
      {text('Residential address', 'residentialAddress')}

      <div className="grid-2">
        {select('ID document type', 'idDocumentType', Object.entries(idDocumentTypeLabel))}
        {select('ID verification status', 'idVerificationStatus', Object.entries(verificationStatusLabel))}
      </div>
      <div className="grid-3">
        {text('Identification number', 'idNumber')}
        {text('Country of issue', 'countryOfIssue')}
        {text('Kebele / Woreda or document name', 'idTypeDetail')}
      </div>
      <div className="grid-3">
        {text('Date of issue', 'dateOfIssue', 'date')}
        {text('Date of expiry', 'dateOfExpiry', 'date')}
        {text('Date became beneficial owner', 'dateBecameBo', 'date')}
      </div>

      <div className="toggle-row">
        <div><div className="t-label">Politically exposed person (PEP)</div></div>
        <button type="button" className={`switch${f.pep ? ' on' : ''}`} aria-pressed={f.pep}
          aria-label="Toggle PEP" onClick={() => set({ pep: !f.pep })} />
      </div>
      {f.pep && text('PEP details', 'pepDetails')}
      <div className="toggle-row">
        <div><div className="t-label">Sanctions screening completed</div></div>
        <button type="button" className={`switch${f.sanctionsScreened ? ' on' : ''}`} aria-pressed={f.sanctionsScreened}
          aria-label="Toggle sanctions screened" onClick={() => set({ sanctionsScreened: !f.sanctionsScreened })} />
      </div>

      <div className="grid-2">
        {text('Source of wealth', 'sourceOfWealth')}
        {text('Source of funds', 'sourceOfFunds')}
      </div>
      <div className="grid-2">
        {select('Source of information', 'sourceOfInformation', Object.entries(sourceOfInformationLabel))}
        {text('Additional information', 'additionalInformation')}
      </div>

      <div className="wizard-nav">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-blue" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}
