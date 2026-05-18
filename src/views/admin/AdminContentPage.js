import React from 'react';
import AdminAlertsPage from './AdminAlertsPage';
import AdminGuidesPage from './AdminGuidesPage';
import '../../styles/shared/sentinel.css';
import '../../styles/shared/TabPageWrapper.css';

export default function AdminContentPage({ initialTab }) {
  const tab = initialTab || 'alerts';

  return (
    <div className="tabbed-page-wrapper">
      <div className="tabbed-page-wrapper__content">
        {tab === 'alerts' ? <AdminAlertsPage /> : <AdminGuidesPage />}
      </div>
    </div>
  );
}
