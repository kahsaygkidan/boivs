import Field from './Field.jsx';
import {
  ID_DOCUMENT_TYPES,
  ID_TYPE_CONFIG,
  ID_VERIFICATION_STATUSES,
  SOURCES_OF_INFORMATION,
  today,
} from '../data/uboForm.js';

/**
 * Personal, identification, screening and source-of-information fields of a beneficial owner.
 * Shared by the registration wizard (showFile) and the maker's edit form.
 */
export default function PersonFields({ f, set, idKey, showFile = false }) {
  return (
    <>
      <div className="grid-3">
        <Field label="Full name" required>
          <input value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        </Field>
        <Field label="Date of birth" required>
          <input type="date" max={today()} value={f.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
        </Field>
        <Field label="Nationality" required>
          <input value={f.nationality} onChange={(e) => set({ nationality: e.target.value })} />
        </Field>
      </div>
      <div className="grid-3">
        <Field label="Gender" required>
          <select value={f.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">Select…</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </Field>
        <Field label="Place of birth" required>
          <input value={f.placeOfBirth} onChange={(e) => set({ placeOfBirth: e.target.value })} />
        </Field>
        <Field label="Residential status" required>
          <select value={f.residentialStatus} onChange={(e) => set({ residentialStatus: e.target.value })}>
            <option value="RESIDENT">Resident</option>
            <option value="NON_RESIDENT">Non-resident</option>
          </select>
        </Field>
      </div>
      <div className="grid-3">
        <Field label="Email address" required>
          <input type="email" value={f.emailAddress} onChange={(e) => set({ emailAddress: e.target.value })} />
        </Field>
        <Field label="Telephone number" required>
          <input value={f.phoneNumber} onChange={(e) => set({ phoneNumber: e.target.value })} />
        </Field>
        <Field label="Occupation / profession" required>
          <input value={f.occupation} onChange={(e) => set({ occupation: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="ID document type" required>
          <select value={f.idDocumentType} onChange={(e) => {
            // selecting a type clears the previous number and moves straight to the matching input
            set({ idDocumentType: e.target.value, idNumber: '', idTypeDetail: '' });
            setTimeout(() => {
              const cfg = ID_TYPE_CONFIG[e.target.value];
              document.getElementById(`idnum-${idKey}`)?.focus();
            }, 0);
          }}>
            {ID_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="ID verification status" required>
          <select value={f.idVerificationStatus} onChange={(e) => set({ idVerificationStatus: e.target.value })}>
            {ID_VERIFICATION_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid-2">
        {(() => {
          const cfg = ID_TYPE_CONFIG[f.idDocumentType] || ID_TYPE_CONFIG.OTHER;
          return (
            <Field label={cfg.numberLabel} required>
              <input
                id={`idnum-${idKey}`}
                className="mono"
                inputMode={cfg.numeric ? 'numeric' : 'text'}
                placeholder={cfg.placeholder}
                value={f.idNumber}
                onChange={(e) => {
                  let v = e.target.value;
                  if (cfg.numeric) v = v.replace(/\D/g, '');
                  if (cfg.upper) v = v.toUpperCase();
                  set({ idNumber: v });
                }}
              />
            </Field>
          );
        })()}
        <Field label="Country of issue" required>
          <input value={f.countryOfIssue} onChange={(e) => set({ countryOfIssue: e.target.value })} />
        </Field>
      </div>
      {ID_TYPE_CONFIG[f.idDocumentType]?.detailLabel && (
        <Field label={ID_TYPE_CONFIG[f.idDocumentType].detailLabel} required>
          <input
            placeholder={ID_TYPE_CONFIG[f.idDocumentType].detailPlaceholder}
            value={f.idTypeDetail}
            onChange={(e) => set({ idTypeDetail: e.target.value })}
          />
        </Field>
      )}
      <div className="grid-3">
        <Field label="ID date of issue" required>
          <input type="date" max={today()} value={f.dateOfIssue} onChange={(e) => set({ dateOfIssue: e.target.value })} />
        </Field>
        <Field label="ID expiry date" required>
          <input type="date" value={f.dateOfExpiry} onChange={(e) => set({ dateOfExpiry: e.target.value })} />
        </Field>
        <Field label="Date became BO" required>
          <input type="date" max={today()} value={f.dateBecameBo} onChange={(e) => set({ dateBecameBo: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2">
        {showFile && (
          <Field label="Verified ID document" >
            <input type="file" onChange={(e) => set({ file: e.target.files?.[0] || null })} />
          </Field>
        )}
        <Field label="Source of information" required>
          <select value={f.sourceOfInformation} onChange={(e) => set({ sourceOfInformation: e.target.value })}>
            {SOURCES_OF_INFORMATION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Residential address" required>
        <input value={f.residentialAddress} onChange={(e) => set({ residentialAddress: e.target.value })} />
      </Field>

      <div className="toggle-row">
        <div>
          <div className="t-label">Politically exposed person (PEP)</div>
          <div className="t-sub">PEP screening result — source of wealth is then mandatory</div>
        </div>
        <button type="button" className={`switch${f.pep ? ' on' : ''}`} aria-pressed={f.pep}
          aria-label="Toggle PEP" onClick={() => set({ pep: !f.pep })} />
      </div>
      {f.pep && (
        <Field label="PEP details" required>
          <input value={f.pepDetails} onChange={(e) => set({ pepDetails: e.target.value })} />
        </Field>
      )}
      <div className="toggle-row">
        <div>
          <div className="t-label">Sanctions screening completed</div>
          <div className="t-sub">Confirm this person has been screened against sanctions lists</div>
        </div>
        <button type="button" className={`switch${f.sanctionsScreened ? ' on' : ''}`} aria-pressed={f.sanctionsScreened}
          aria-label="Toggle sanctions screened" onClick={() => set({ sanctionsScreened: !f.sanctionsScreened })} />
      </div>
      <div className="grid-2">
        <Field label="Source of wealth" required={f.pep}>
          <input placeholder="Obtained where required" value={f.sourceOfWealth}
            onChange={(e) => set({ sourceOfWealth: e.target.value })} />
        </Field>
        <Field label="Source of funds">
          <input placeholder="Obtained where required" value={f.sourceOfFunds}
            onChange={(e) => set({ sourceOfFunds: e.target.value })} />
        </Field>
      </div>
      <Field label="Remark">
        <input value={f.additionalInformation} onChange={(e) => set({ additionalInformation: e.target.value })} />
      </Field>
    </>
  );
}
