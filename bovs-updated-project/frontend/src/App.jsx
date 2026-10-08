import { useMemo, useState } from 'react';
import { hasAnyRole, useAuth } from './auth/AuthContext.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import AuditTrail from './views/AuditTrail.jsx';
import UboRegistration from './views/UboRegistration.jsx';
import Dashboard from './views/Dashboard.jsx';
import Queue from './views/Queue.jsx';
import RecordDetail from './views/RecordDetail.jsx';
import Records from './views/Records.jsx';
import Reports from './views/Reports.jsx';
import UserManual from './views/UserManual.jsx';

const TITLES = {
  dashboard: 'Dashboard',
  create: 'UBO Registration',
  records: 'BO Records',
  queue: 'Verification Queue',
  reports: 'Reports',
  audit: 'Audit Trail',
  detail: 'Record detail',
}

export default function App() {
  const { isAuthenticated, roles } = useAuth()
  const [view, setView] = useState('dashboard')
  const [selectedId, setSelectedId] = useState(null)

  const roleFlags = useMemo(() => ({
    isMaker: hasAnyRole(roles, 'MAKER', 'ADMIN'),
    isChecker: hasAnyRole(roles, 'CHECKER', 'ADMIN'),
    isAuditor: hasAnyRole(roles, 'AUDITOR', 'ADMIN'),
    isAdmin: hasAnyRole(roles, 'ADMIN'),
  }), [roles])

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  const openRecord = (id) => {
    setSelectedId(id)
    setView('detail')
  }

  const navigate = (key) => {
    setSelectedId(null)
    setView(key)
  }


  const canSeeAudit = roleFlags.isAdmin || roleFlags.isChecker || roleFlags.isAuditor

  const renderView = () => {
    switch (view) {
      case 'create':
        return roleFlags.isMaker ? <UboRegistration /> : <NotAuthorized />
      case 'records':
        return (
          <Records onRegister={() => navigate('create')} canRegister={roleFlags.isMaker} onOpen={openRecord} />
        )
      case 'queue':
        return roleFlags.isChecker ? <Queue onOpen={openRecord} /> : <NotAuthorized />
      case 'reports':
        return <Reports />
      case 'audit':
        return canSeeAudit ? <AuditTrail /> : <NotAuthorized />
      case 'detail':
        return selectedId
          ? <RecordDetail id={selectedId} roles={roleFlags} onBack={() => navigate('records')} />
          : <NotAuthorized />
      case 'manual':
        return <UserManual />
      case 'dashboard':
      default:
        return (
          <Dashboard onRegister={() => navigate('create')} canRegister={roleFlags.isMaker} onOpen={openRecord} />
        )
    }
  }

  return (
    <div className="dashboard">
      <Sidebar activeView={view} onNavigate={navigate} roles={roleFlags} />
      <div className="main">
                <Topbar title={TITLES[view]} roleFlags={roleFlags} onNavigate={navigate} />
        <div className="content">{renderView()}</div>
      </div>
    </div>
  )
}

function NotAuthorized() {
  return (
    <div className="page-head">
      <div>
        <h1>Not authorized</h1>
        <div className="desc">Your account does not have the role required to view this page.</div>
      </div>
    </div>
  )
}