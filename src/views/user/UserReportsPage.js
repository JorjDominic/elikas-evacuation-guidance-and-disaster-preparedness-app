import React, { useState } from 'react';
import HazardReportPage from './HazardReportPage';
import MyReportsPage from './MyReportsPage';
import '../../styles/shared/sentinel.css';
import '../../styles/shared/TabPageWrapper.css';

const TABS = [
  { key: 'report',     label: 'Report Hazard' },
  { key: 'my-reports', label: 'My Reports'    },
];

export default function UserReportsPage({ initialTab }) {
  const [active, setActive] = useState(initialTab || 'report');

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
        {active === 'report' ? <HazardReportPage /> : <MyReportsPage />}
      </div>
    </div>
  );
}
