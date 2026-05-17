import React, { useState } from 'react';
import AdminAlertsPage from './AdminAlertsPage';
import AdminGuidesPage from './AdminGuidesPage';
import '../../styles/shared/sentinel.css';
import '../../styles/shared/TabPageWrapper.css';

const TABS = [
  { key: 'alerts', label: 'Alerts' },
  { key: 'guides', label: 'Guides' },
];

export default function AdminContentPage({ initialTab }) {
  const [active, setActive] = useState(initialTab || 'alerts');

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
        {active === 'alerts' ? <AdminAlertsPage /> : <AdminGuidesPage />}
      </div>
    </div>
  );
}
