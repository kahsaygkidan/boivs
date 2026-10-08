import { useState } from 'react'

const SECTIONS = [
  { key: 'overview', label: 'Getting Started' },
  { key: 'maker', label: 'Maker' },
  { key: 'checker', label: 'Checker' },
  { key: 'auditor', label: 'Auditor' },
  { key: 'admin', label: 'Admin' },
]

export default function UserManual() {
  const [active, setActive] = useState('overview')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>User Manual</h1>
          <div className="desc">How to use the Beneficial Owner Identification &amp; Verification System, by role.</div>
        </div>
      </div>

      <div className="manual-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`manual-tab${active === s.key ? ' active' : ''}`}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {active === 'overview' && <Overview />}
      {active === 'maker' && <MakerGuide />}
      {active === 'checker' && <CheckerGuide />}
      {active === 'auditor' && <AuditorGuide />}
      {active === 'admin' && <AdminGuide />}
    </div>
  )
}

function Overview() {
  return (
    <>
      <div className="form-card">
        <h3>Roles at a glance</h3>
        <div className="table-card" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Role</th><th>What they can do</th></tr>
            </thead>
            <tbody>
              <tr><td>Maker</td><td>Register BO records, upload supporting documents, submit records for verification</td></tr>
              <tr><td>Checker</td><td>Review the verification queue, approve or reject records, mark verified records as ceased</td></tr>
              <tr><td>Auditor</td><td>Read-only access to BO records and the full audit trail</td></tr>
              <tr><td>Admin</td><td>All of the above, and may verify records even if they submitted them</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-card">
        <h3>Signing in &amp; your session</h3>
        <ul className="manual-list">
          <li>Sign in with your domain username and password.</li>
          <li>Your session refreshes automatically in the background while you're active.</li>
          <li>If your screen is idle (no mouse, keyboard, touch, or scroll activity) for a few minutes, you'll be signed out automatically to protect your account.</li>
        </ul>
      </div>

      <div className="form-card">
        <h3>Notifications</h3>
        <ul className="manual-list">
          <li>The bell icon in the top bar badges anything that needs your attention.</li>
          <li>Checkers see a count of records pending verification.</li>
          <li>Makers see a count of their own records that were recently approved or rejected.</li>
          <li>Click a notification to go straight to the relevant page.</li>
        </ul>
      </div>

      <div className="form-card">
        <h3>BO Records &amp; ID status</h3>
        <ul className="manual-list">
          <li>The BO Records list and a record's detail page show the maker-checker workflow status (Draft, Pending, Verified, Rejected, Ceased).</li>
          <li>They also show a separate <strong>ID Status</strong> badge — Active or Expired — based on whether the beneficial owner's identity document has passed its expiry date. This is independent of the workflow status.</li>
        </ul>
      </div>
    </>
  )
}

function MakerGuide() {
  return (
    <>
      <div className="form-card">
        <h3>Register a beneficial owner</h3>
        <ol className="manual-steps">
          <li>Go to <strong>Register BO</strong> from the sidebar.</li>
          <li>Choose an existing legal person, or register a new one.</li>
          <li>Enter the beneficial owner's identity details — name, date of birth, ID document type and number, nationality, country of issue, and ID expiry date.</li>
          <li>Enter ownership details — ownership type, ownership percentage, the date they became a beneficial owner, and whether they are a politically exposed person (PEP).</li>
          <li>Save as <strong>Draft</strong> to finish later, or <strong>Submit</strong> to send it straight to a checker for verification.</li>
        </ol>
      </div>

      <div className="form-card">
        <h3>Documents</h3>
        <ul className="manual-list">
          <li>Open a record's detail page to upload supporting documents, such as an ID scan.</li>
          <li>Image documents (JPG, PNG) can be previewed inline with the <strong>View</strong> button; any document can be downloaded.</li>
          <li>You can delete a document you've uploaded, as long as you have Maker access.</li>
        </ul>
      </div>

      <div className="form-card">
        <h3>If a record is rejected</h3>
        <ul className="manual-list">
          <li>Open the record to read the checker's rejection reason on the detail page.</li>
          <li>Correct the record's details or documents, then submit it again for verification.</li>
        </ul>
      </div>
    </>
  )
}

function CheckerGuide() {
  return (
    <>
      <div className="form-card">
        <h3>Verifying records</h3>
        <ol className="manual-steps">
          <li>Open the <strong>Verification Queue</strong> from the sidebar to see records awaiting a decision.</li>
          <li>Open a record to review its identity, ownership, and uploaded documents.</li>
          <li>Choose <strong>Approve</strong> to mark it Verified, or <strong>Reject</strong> and provide a reason to send it back to the maker.</li>
        </ol>
      </div>

      <div className="form-card">
        <h3>Segregation of duties</h3>
        <ul className="manual-list">
          <li>You cannot approve or reject a record that you submitted yourself.</li>
          <li>Only an Admin account can verify a record they submitted.</li>
        </ul>
      </div>

      <div className="form-card">
        <h3>Ceasing a record</h3>
        <ul className="manual-list">
          <li>Open a <strong>Verified</strong> record and choose <strong>Mark as ceased</strong> once that person no longer holds beneficial ownership.</li>
        </ul>
      </div>
    </>
  )
}

function AuditorGuide() {
  return (
    <div className="form-card">
      <h3>Audit trail</h3>
      <ul className="manual-list">
        <li>Open <strong>Audit Trail</strong> from the sidebar for a chronological log of actions — created, submitted, approved, rejected, ceased — across all BO records.</li>
        <li>Open any BO record's detail page to see the audit history for that specific record.</li>
        <li>Auditor access is read-only: you cannot create, submit, approve, reject, or edit records or documents.</li>
      </ul>
    </div>
  )
}

function AdminGuide() {
  return (
    <div className="form-card">
      <h3>Administrator access</h3>
      <ul className="manual-list">
        <li>Admins combine every Maker, Checker, and Auditor capability.</li>
        <li>Unlike a checker, an Admin may approve or reject a record even if they submitted it themselves.</li>
        <li>Every action you take is still recorded in the audit trail under your username, so use this access carefully.</li>
      </ul>
    </div>
  )
}