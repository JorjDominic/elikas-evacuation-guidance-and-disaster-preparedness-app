import React from 'react';
import AdminUsersPage from './AdminUsersPage';
import AdminAuditLogsPage from './AdminAuditLogsPage';
import AdminSimulationPage from './AdminSimulationPage';
import AdminSettingsPage from './AdminSettingsPage';
import '../../styles/shared/sentinel.css';
import '../../styles/shared/TabPageWrapper.css';

export default function AdminManagementPage({ initialTab }) {
  const tab = initialTab || 'users';

  const renderTab = () => {
    switch (tab) {
      case 'users':      return <AdminUsersPage />;
      case 'audit-logs': return <AdminAuditLogsPage />;
      case 'simulation': return <AdminSimulationPage />;
      case 'settings':   return <AdminSettingsPage />;
      default:           return <AdminUsersPage />;
    }
  };

  return (
    <div className="tabbed-page-wrapper">
      <div className="tabbed-page-wrapper__content">
        {renderTab()}
      </div>
    </div>
  );
}
