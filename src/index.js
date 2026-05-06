import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for offline support & faster repeat loads.
// In development this is a no-op; only active in production builds.
serviceWorkerRegistration.register({
  onSuccess: () => console.info('[eLikas] App is ready for offline use.'),
  onUpdate: () => console.info('[eLikas] New version available – reloading shortly.'),
});

// Report Core Web Vitals to console (swap console.log for an analytics
// endpoint in production, e.g. sendToAnalytics(metric)).
function reportWebVitals(metric) {
  if (process.env.NODE_ENV === 'development') {
    console.info(`[Web Vitals] ${metric.name}:`, Math.round(metric.value), metric.rating);
  }
}

getCLS(reportWebVitals);
getFID(reportWebVitals);
getFCP(reportWebVitals);
getLCP(reportWebVitals);
getTTFB(reportWebVitals);
