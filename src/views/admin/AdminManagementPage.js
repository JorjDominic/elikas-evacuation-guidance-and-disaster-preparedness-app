import React, { useState } from 'react';
import AdminUsersPage from './AdminUsersPage';
import AdminAuditLogsPage from './AdminAuditLogsPage';
import '../../styles/shared/sentinel.css';
import '../../styles/shared/TabPageWrapper.css';

const TABS = [
  { key: 'users',      label: 'Users'      },
  { key: 'audit-logs', label: 'Audit Logs' },
];

export default function AdminManagementPage({ initialTab }) {
  const [active, setActive] = useState(initialTab || 'users');

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
        {active === 'users' ? <AdminUsersPage /> : <AdminAuditLogsPage />}
      </div>
    </div>
  );
}
