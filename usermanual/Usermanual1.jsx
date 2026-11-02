
import { useState } from 'react'
import './UserManual.css'

const SECTIONS = [
  {
    key: 'overview',
    label: 'Getting Started',
    icon: '⌂',
    subtitle: 'System overview and essential guidance',
  },
  {
    key: 'maker',
    label: 'Maker',
    icon: '✎',
    subtitle: 'Register and manage beneficial ownership records',
  },
  {
    key: 'checker',
    label: 'Checker',
    icon: '✓',
    subtitle: 'Review and verify beneficial ownership records',
  },
  {
    key: 'auditor',
    label: 'Auditor',
    icon: '▤',
    subtitle: 'Review records and audit history',
  },
  {
    key: 'admin',
    label: 'Administrator',
    icon: '⚙',
    subtitle: 'System access and administrative responsibilities',
  },
]

/* =========================================
   REUSABLE COMPONENTS
========================================= */

function GuideCard({ title, description, icon = '▤', children }) {
  return (
    <section className="um-card">
      <div className="um-card-heading">
        <div className="um-card-icon" aria-hidden="true">
          {icon}
        </div>

        <div className="um-card-title">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>

      <div className="um-card-content">{children}</div>
    </section>
  )
}

function StepList({ items }) {
  return (
    <ol className="um-steps">
      {items.map((item, index) => (
        <li key={index}>
          <span className="um-step-number">{index + 1}</span>
          <div className="um-step-content">{item}</div>
        </li>
      ))}
    </ol>
  )
}

function BulletList({ items }) {
  return (
    <ul className="um-list">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

function Notice({ type = 'info', title, children }) {
  const symbols = {
    info: 'i',
    warning: '!',
    success: '✓',
  }

  return (
    <div className={`um-notice um-notice-${type}`} role="note">
      <span className="um-notice-icon" aria-hidden="true">
        {symbols[type] || 'i'}
      </span>

      <div className="um-notice-content">
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  )
}

function PageBanner({ icon, title, children }) {
  return (
    <div className="um-intro-banner">
      <div className="um-banner-icon" aria-hidden="true">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  )
}

/* =========================================
   MAIN USER MANUAL
========================================= */

export default function UserManual() {
  const [active, setActive] = useState('overview')

  const currentSection =
    SECTIONS.find(section => section.key === active) || SECTIONS[0]

  const activeIndex = SECTIONS.findIndex(
    section => section.key === active
  )

  const goToSection = direction => {
    const nextIndex = Math.max(
      0,
      Math.min(SECTIONS.length - 1, activeIndex + direction)
    )

    setActive(SECTIONS[nextIndex].key)
  }

  return (
    <main className="user-manual">

      {/* PAGE HEADER */}
      <header className="um-header">
        <div className="um-header-content">
          <div className="um-eyebrow">
            DOCUMENTATION <span>/</span> USER GUIDE
          </div>

          <h1>User Manual</h1>

          <p>
            A comprehensive guide to using the Beneficial Owner
            Identification &amp; Verification System (BOIVS).
            Follow the instructions relevant to your assigned system role.
          </p>

          <div className="um-header-meta">
            <span className="um-meta-item">
              <span className="um-meta-dot" />
              System Documentation
            </span>

            <span className="um-meta-divider" />

            <span className="um-meta-item">
              5 Documentation Sections
            </span>
          </div>
        </div>

        <div className="um-header-visual" aria-hidden="true">
          <div className="um-header-visual-inner">
            <span className="um-header-book">▤</span>
            <span className="um-header-visual-label">BOIVS</span>
            <span className="um-header-visual-caption">
              USER GUIDE
            </span>
          </div>
        </div>
      </header>

      {/* SECTION NAVIGATION */}
      <nav
        className="um-navigation"
        aria-label="User manual sections"
      >
        <div className="um-navigation-label">
          DOCUMENTATION
        </div>

        <div className="um-tabs">
          {SECTIONS.map(section => (
            <button
              key={section.key}
              type="button"
              className={`um-tab ${
                active === section.key ? 'active' : ''
              }`}
              aria-current={
                active === section.key ? 'page' : undefined
              }
              onClick={() => setActive(section.key)}
            >
              <span className="um-tab-icon" aria-hidden="true">
                {section.icon}
              </span>

              <span>{section.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* SECTION HEADING */}
      <div className="um-section-intro">
        <div className="um-section-heading">
          <div className="um-section-label">
            USER DOCUMENTATION
          </div>

          <h2>{currentSection.label}</h2>

          <p>{currentSection.subtitle}</p>
        </div>

        <div className="um-section-progress">
          <div className="um-section-count">
            <strong>
              {String(activeIndex + 1).padStart(2, '0')}
            </strong>
            <span>/ 05</span>
          </div>

          <div className="um-progress-track">
            <div
              className="um-progress-value"
              style={{
                width: `${((activeIndex + 1) / SECTIONS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* DOCUMENTATION CONTENT */}
      <div className="um-content" key={active}>
        {active === 'overview' && <Overview />}
        {active === 'maker' && <MakerGuide />}
        {active === 'checker' && <CheckerGuide />}
        {active === 'auditor' && <AuditorGuide />}
        {active === 'admin' && <AdminGuide />}
      </div>

      {/* SECTION NAVIGATION FOOTER */}
      <div className="um-page-navigation">
        <button
          type="button"
          className="um-page-nav-button"
          onClick={() => goToSection(-1)}
          disabled={activeIndex === 0}
        >
          <span>←</span>
          <span>
            <small>PREVIOUS SECTION</small>
            <strong>
              {activeIndex > 0
                ? SECTIONS[activeIndex - 1].label
                : 'Start'}
            </strong>
          </span>
        </button>

        <button
          type="button"
          className="um-page-nav-button next"
          onClick={() => goToSection(1)}
          disabled={activeIndex === SECTIONS.length - 1}
        >
          <span>
            <small>NEXT SECTION</small>
            <strong>
              {activeIndex < SECTIONS.length - 1
                ? SECTIONS[activeIndex + 1].label
                : 'Completed'}
            </strong>
          </span>
          <span>→</span>
        </button>
      </div>

      {/* FOOTER */}
      <footer className="um-footer">
        <div className="um-footer-brand">
          <strong>BOIVS</strong>
          <span>Beneficial Ownership Management System</span>
        </div>

        <span className="um-footer-label">
          USER DOCUMENTATION
        </span>
      </footer>
    </main>
  )
}

/* =========================================
   OVERVIEW
========================================= */

function Overview() {
  return (
    <>
      <PageBanner
        icon="✦"
        title="Welcome to BOIVS"
      >
        This system supports the registration, verification
        and monitoring of beneficial ownership information
        through a controlled maker-checker workflow.
      </PageBanner>

      <GuideCard
        title="System Roles & Responsibilities"
        description="Understand the responsibilities and access levels of each role."
        icon="♙"
      >
        <div className="um-role-grid">

          <RoleItem
            code="M"
            type="maker"
            title="Maker"
          >
            Registers BO records, uploads supporting documents
            and submits records for verification.
          </RoleItem>

          <RoleItem
            code="C"
            type="checker"
            title="Checker"
          >
            Reviews submitted records, approves or rejects
            them and marks verified records as ceased.
          </RoleItem>

          <RoleItem
            code="A"
            type="auditor"
            title="Auditor"
          >
            Has read-only access to BO records and the
            complete audit trail.
          </RoleItem>

          <RoleItem
            code="AD"
            type="admin"
            title="Administrator"
          >
            Combines Maker, Checker and Auditor capabilities,
            including verification of own submissions.
          </RoleItem>

        </div>
      </GuideCard>

      <GuideCard
        title="Signing In & Session Security"
        description="Access the system securely and protect your session."
        icon="⌑"
      >
        <BulletList
          items={[
            <>Sign in using your assigned domain username and password.</>,
            <>Your session refreshes automatically in the background while you are active.</>,
            <>If your screen remains idle for the configured inactivity period, you will be signed out automatically.</>,
          ]}
        />

        <Notice
          type="warning"
          title="Security reminder"
        >
          Never share your login credentials. Always sign out
          when you have finished using the system.
        </Notice>
      </GuideCard>

      <GuideCard
        title="Notifications & Alerts"
        description="Stay informed about records that require your attention."
        icon="♢"
      >
        <BulletList
          items={[
            <>The notification bell in the top navigation displays alerts requiring your attention.</>,
            <>Checkers receive notifications about records pending verification.</>,
            <>Makers receive notifications when their submitted records are approved or rejected.</>,
            <>Select a notification to navigate to the relevant record or page.</>,
          ]}
        />
      </GuideCard>

      <GuideCard
        title="Understanding Record Status"
        description="Understand workflow status and identity document status."
        icon="▤"
      >
        <h4 className="um-subheading">
          BO Workflow Status
        </h4>

        <div className="um-status-grid">
          <StatusItem
            label="Draft"
            type="draft"
          >
            Saved but not yet submitted.
          </StatusItem>

          <StatusItem
            label="Pending"
            type="pending"
          >
            Awaiting checker verification.
          </StatusItem>

          <StatusItem
            label="Verified"
            type="verified"
          >
            Successfully approved.
          </StatusItem>

          <StatusItem
            label="Rejected"
            type="rejected"
          >
            Returned for correction.
          </StatusItem>

          <StatusItem
            label="Ceased"
            type="ceased"
          >
            Beneficial ownership has ended.
          </StatusItem>
        </div>

        <h4 className="um-subheading">
          Identity Document Status
        </h4>

        <div className="um-status-grid um-status-grid-two">
          <StatusItem
            label="Active"
            type="verified"
          >
            The identity document has not passed its expiry date.
          </StatusItem>

          <StatusItem
            label="Expired"
            type="rejected"
          >
            The identity document has passed its expiry date.
          </StatusItem>
        </div>

        <Notice title="Important distinction">
          ID Status is independent of BO Workflow Status.
          A verified BO record can have an expired identity document.
        </Notice>
      </GuideCard>
    </>
  )
}

/* =========================================
   MAKER GUIDE
========================================= */

function MakerGuide() {
  return (
    <>
      <PageBanner
        icon="✎"
        title="Maker Responsibilities"
      >
        The Maker is responsible for registering accurate
        beneficial ownership information, maintaining supporting
        documents and submitting complete records for verification.
      </PageBanner>

      <GuideCard
        title="Register a Beneficial Owner"
        description="Follow these steps to create a BO record."
        icon="＋"
      >
        <StepList
          items={[
            <>Navigate to <strong>Register BO</strong> from the sidebar.</>,
            <>Select an existing legal person or register a new legal person.</>,
            <>Enter the beneficial owner's identity information, including full name, date of birth, ID document type and number, nationality, country of issue and expiry date.</>,
            <>Enter ownership information, including ownership type, ownership percentage, date of becoming a beneficial owner and PEP status.</>,
            <>Review the information for accuracy and completeness.</>,
            <>Choose <strong>Save as Draft</strong> to continue later or <strong>Submit</strong> to send the record for checker verification.</>,
          ]}
        />

        <Notice
          type="success"
          title="Recommended practice"
        >
          Review all identity and ownership information before
          submitting a record.
        </Notice>
      </GuideCard>

      <GuideCard
        title="Managing Supporting Documents"
        description="Upload and maintain evidence associated with a BO record."
        icon="▧"
      >
        <StepList
          items={[
            <>Open the relevant BO record's detail page.</>,
            <>Locate the supporting documents section.</>,
            <>Upload the required evidence, such as an identity document scan.</>,
            <>Use the <strong>View</strong> button to preview supported image documents (JPG and PNG).</>,
            <>Download documents when a local copy is required.</>,
          ]}
        />

        <Notice title="Document management">
          Makers can delete documents they uploaded, subject
          to their Maker access permissions.
        </Notice>
      </GuideCard>

      <GuideCard
        title="Handling Rejected Records"
        description="Correct rejected submissions and send them for verification again."
        icon="↻"
      >
        <StepList
          items={[
            <>Open the rejected BO record.</>,
            <>Read the checker's rejection reason on the record detail page.</>,
            <>Correct the relevant identity, ownership or document information.</>,
            <>Review the updated information.</>,
            <>Submit the corrected record again for verification.</>,
          ]}
        />
      </GuideCard>
    </>
  )
}

/* =========================================
   CHECKER GUIDE
========================================= */

function CheckerGuide() {
  return (
    <>
      <PageBanner
        icon="✓"
        title="Checker Responsibilities"
      >
        The Checker independently reviews submitted BO records
        to ensure information is complete, accurate and supported
        by appropriate documentation.
      </PageBanner>

      <GuideCard
        title="Verifying BO Records"
        description="Review submitted records and make an appropriate verification decision."
        icon="✓"
      >
        <StepList
          items={[
            <>Open the <strong>Verification Queue</strong> from the sidebar.</>,
            <>Review the records awaiting verification.</>,
            <>Open a record to inspect identity details, ownership information and supporting documents.</>,
            <>Check the submitted information for accuracy and completeness.</>,
            <>Select <strong>Approve</strong> to mark the record as Verified, or select <strong>Reject</strong> and provide a clear rejection reason.</>,
          ]}
        />

        <Notice
          type="success"
          title="Verification control"
        >
          Ensure that the record and its supporting evidence
          have been reviewed before making a decision.
        </Notice>
      </GuideCard>

      <GuideCard
        title="Segregation of Duties"
        description="Maintain independent review and approval controls."
        icon="♙"
      >
        <BulletList
          items={[
            <>A Checker cannot approve or reject a record that they personally submitted.</>,
            <>Only an Admin account can verify a record that they submitted themselves.</>,
          ]}
        />

        <Notice
          type="warning"
          title="Important control"
        >
          The maker-checker principle helps maintain accountability
          and independent verification.
        </Notice>
      </GuideCard>

      <GuideCard
        title="Ceasing a Verified Record"
        description="Update records when beneficial ownership ends."
        icon="◷"
      >
        <StepList
          items={[
            <>Locate and open the relevant Verified BO record.</>,
            <>Confirm that the individual no longer holds beneficial ownership.</>,
            <>Select <strong>Mark as ceased</strong>.</>,
            <>Confirm the action if the system requests confirmation.</>,
          ]}
        />

        <Notice title="Record status">
          A ceased record is retained as part of the historical
          BO record and audit history.
        </Notice>
      </GuideCard>
    </>
  )
}

/* =========================================
   AUDITOR GUIDE
========================================= */

function AuditorGuide() {
  return (
    <>
      <PageBanner
        icon="▤"
        title="Auditor Responsibilities"
      >
        Auditors have read-only access to BO information and
        system activity to support transparency, accountability
        and audit review.
      </PageBanner>

      <GuideCard
        title="Reviewing the Audit Trail"
        description="Access the chronological history of system activities."
        icon="▤"
      >
        <StepList
          items={[
            <>Navigate to <strong>Audit Trail</strong> from the sidebar.</>,
            <>Review the chronological list of recorded activities across BO records.</>,
            <>Inspect relevant actions, including creation, submission, approval, rejection and cessation.</>,
            <>Open an individual BO record to review its record-specific audit history.</>,
          ]}
        />
      </GuideCard>

      <GuideCard
        title="Auditor Access & Restrictions"
        description="Understand the limitations of read-only access."
        icon="⊘"
      >
        <div className="um-permission-grid">
          <PermissionItem
            type="allowed"
            icon="✓"
            title="Permitted"
          >
            View BO records, record details, documents and audit history.
          </PermissionItem>

          <PermissionItem
            type="restricted"
            icon="×"
            title="Restricted"
          >
            Create, submit, approve, reject or edit BO records and documents.
          </PermissionItem>
        </div>
      </GuideCard>
    </>
  )
}

/* =========================================
   ADMIN GUIDE
========================================= */

function AdminGuide() {
  return (
    <>
      <PageBanner
        icon="⚙"
        title="Administrator Responsibilities"
      >
        Administrators have comprehensive system access and
        are responsible for exercising their permissions carefully
        and maintaining accountability.
      </PageBanner>

      <GuideCard
        title="Administrator Access"
        description="Understand the capabilities available to an Administrator."
        icon="⚙"
      >
        <BulletList
          items={[
            <>Administrators combine Maker, Checker and Auditor capabilities.</>,
            <>They can register and manage BO records and supporting documents.</>,
            <>They can review, approve or reject submitted records.</>,
            <>They can access BO information and the audit trail.</>,
            <>Unlike a standard Checker, an Administrator may approve or reject a record they submitted themselves.</>,
          ]}
        />
      </GuideCard>

      <GuideCard
        title="Accountability & Audit Controls"
        description="Maintain responsible use of administrative permissions."
        icon="♢"
      >
        <BulletList
          items={[
            <>Every action performed by an Administrator is recorded in the audit trail under their username.</>,
            <>Administrative privileges should be used only when necessary.</>,
            <>Review record information and supporting evidence before making verification decisions.</>,
            <>Maintain appropriate accountability when exercising elevated permissions.</>,
          ]}
        />

        <Notice
          type="warning"
          title="Administrative responsibility"
        >
          Administrator access does not remove the requirement
          for accurate verification, proper documentation and
          audit accountability.
        </Notice>
      </GuideCard>
    </>
  )
}

/* =========================================
   SMALL REUSABLE DISPLAY COMPONENTS
========================================= */

function RoleItem({ code, type, title, children }) {
  return (
    <div className="um-role-item">
      <span className={`um-role-symbol ${type}`}>
        {code}
      </span>

      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}

function StatusItem({ label, type, children }) {
  return (
    <div className="um-status-item">
      <span className={`um-status-badge ${type}`}>
        {label}
      </span>
      <p>{children}</p>
    </div>
  )
}

function PermissionItem({ type, icon, title, children }) {
  return (
    <div className={`um-permission ${type}`}>
      <span className="um-permission-icon">
        {icon}
      </span>

      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}
