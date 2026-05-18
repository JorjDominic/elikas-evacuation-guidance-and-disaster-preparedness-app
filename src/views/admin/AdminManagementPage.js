import React, { useState } from 'react';
import AdminUsersPage from './AdminUsersPage';
import AdminAuditLogsPage from './AdminAuditLogsPage';
import AdminSimulationPage from './AdminSimulationPage';
import AdminSettingsPage from './AdminSettingsPage';
import '../../styles/shared/sentinel.css';
import '../../styles/shared/TabPageWrapper.css';

const TABS = [
  { key: 'users',      label: 'Users'      },
  { key: 'audit-logs', label: 'Audit Logs' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'settings',   label: 'Settings'   },
];

export default function AdminManagementPage({ initialTab }) {
  const [active, setActive] = useState(initialTab || 'users');

  const renderTab = () => {
    switch (active) {
      case 'users':      return <AdminUsersPage />;
      case 'audit-logs': return <AdminAuditLogsPage />;
      case 'simulation': return <AdminSimulationPage />;
      case 'settings':   return <AdminSettingsPage />;
      default:           return <AdminUsersPage />;
    }
  };

  return (
    <div className="tabbed-page-wrapper">
      <div className="tabbed-page-wrapper__bar">
        <div className="tabbed-page-wrapper__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tabbed-page-tab${active === t.key ? ' active' : ''}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="tabbed-page-wrapper__content">
        {renderTab()}
      </div>
    </div>
  );
}
