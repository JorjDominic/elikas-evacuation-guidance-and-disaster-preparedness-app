import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminTestPage.css';
import '../../styles/admin/AdminSettingsPage.css';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  const arr     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const PREF_KEY = 'elikas-notif-prefs';
const DEFAULT_PREFS = { showHigh: true, showMedium: true, showLow: true, showInfo: true };

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY));
    return saved ? { ...DEFAULT_PREFS, ...saved } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}

export default function AdminSettingsPage() {
  const { currentUser } = useAuth();

  // ── Push subscription ──────────────────────────────────────────────
  const [pushSub,        setPushSub]        = useState(null);
  const [pushLoading,    setPushLoading]    = useState(false);
  const [edgeLoading,    setEdgeLoading]    = useState(false);
  const [permission,     setPermission]     = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [pushStatus, setPushStatus] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => { if (sub) setPushSub(sub); });
    });
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    setPushStatus(result === 'granted' ? '✓ Notification permission granted.' : '✗ Permission denied by browser.');
  };

  const subscribeToPush = async () => {
    const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setPushStatus('REACT_APP_VAPID_PUBLIC_KEY is not set. Add it in Vercel → Environment Variables, then redeploy.');
      return;
    }
    if (!('serviceWorker' in navigator)) { setPushStatus('Web Push is not supported in this browser.'); return; }
    if (permission !== 'granted') { setPushStatus('Grant notification permission first.'); return; }
    setPushLoading(true);
    try {
      const reg    = await navigator.serviceWorker.ready;
      const sub    = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json   = sub.toJSON();
      const { error: dbErr } = await supabase.from('push_subscriptions').upsert(
        [{ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_id: currentUser?.id }],
        { onConflict: 'endpoint' }
      );
      if (dbErr) setPushStatus(`Subscribed locally, but DB write failed: ${dbErr.message}`);
      else       setPushStatus('✓ Push subscription registered and saved to database.');
      setPushSub(sub);
    } catch (err) {
      setPushStatus(`Subscribe failed: ${err.message}`);
    }
    setPushLoading(false);
  };

  const unsubscribeFromPush = async () => {
    if (!pushSub) return;
    setPushLoading(true);
    try {
      const endpoint = pushSub.endpoint;
      await pushSub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      setPushSub(null);
      setPushStatus('✓ Push subscription removed from browser and database.');
    } catch (err) {
      setPushStatus(`Unsubscribe failed: ${err.message}`);
    }
    setPushLoading(false);
  };

  const testEdgePush = async () => {
    if (!pushSub) { setPushStatus('Subscribe to push first.'); return; }
    setEdgeLoading(true);
    setPushStatus('Invoking edge function…');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-push-notification', {
        body: { alert: { id: `test-${Date.now()}`, title: '[TEST] Edge Function Push', level: 'high', description: 'Test push from Settings.' } },
      });
      if (fnErr) setPushStatus(`Edge function error: ${fnErr.message}`);
      else       setPushStatus(`✓ Edge function responded: ${JSON.stringify(data)}`);
    } catch (err) {
      setPushStatus(`Edge function threw: ${err.message}`);
    }
    setEdgeLoading(false);
  };

  // ── Notification preferences (localStorage) ───────────────────────
  const [prefs, setPrefs] = useState(loadPrefs);
  const togglePref = (key) => {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ── System config ──────────────────────────────────────────────────
  const vapidKeySet  = !!process.env.REACT_APP_VAPID_PUBLIC_KEY;
  const supabaseHost = (process.env.REACT_APP_SUPABASE_URL || '').replace('https://', '').split('.')[0] || '—';
  const env          = process.env.NODE_ENV || 'unknown';

  return (
    <div className="atp-page" style={{ paddingTop: '1.5rem', minHeight: 'auto' }}>
      <div className="atp-wrap">

        {/* ── Push Notifications ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">📲</span> Push Notifications (VAPID)
          </h2>
          <p className="atp-section-desc">
            Subscribe this browser to receive OS-level push notifications even when the tab is in
            the background. Subscriptions are stored in the <code>push_subscriptions</code> table
            and delivered via the <code>send-push-notification</code> Edge Function.
          </p>

          {!vapidKeySet && (
            <div className="atp-warn-box">
              ⚠️ <code>REACT_APP_VAPID_PUBLIC_KEY</code> is not set.
              Add it in Vercel → Project Settings → Environment Variables, then redeploy.
            </div>
          )}

          {/* Permission */}
          <div className="asp-row">
            <span className="asp-label">Browser Permission</span>
            <div className="asp-row-right">
              <div className={`atp-permission-badge ${permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default'}`} style={{ margin: 0 }}>
                {permission === 'granted' ? '✓ Granted' : permission === 'denied' ? '✗ Denied' : '⚠ Not Set'}
              </div>
              {permission !== 'granted' && (
                <button className="atp-btn primary" onClick={requestPermission}>Request Permission</button>
              )}
            </div>
          </div>

          {/* Subscription */}
          <div className="asp-row">
            <span className="asp-label">This Browser</span>
            <div className="asp-row-right">
              <span className={`atp-status-dot ${pushSub ? 'connected' : 'disconnected'}`} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--sent-text-muted)' }}>
                {pushSub ? 'Subscribed' : 'Not subscribed'}
              </span>
              {!pushSub ? (
                <button className="atp-btn primary" onClick={subscribeToPush} disabled={pushLoading || permission !== 'granted'}>
                  {pushLoading ? 'Subscribing…' : '+ Subscribe'}
                </button>
              ) : (
                <button className="atp-btn ghost" onClick={unsubscribeFromPush} disabled={pushLoading}>
                  {pushLoading ? 'Removing…' : 'Unsubscribe'}
                </button>
              )}
            </div>
          </div>

          <div className="atp-actions" style={{ marginTop: '0.75rem' }}>
            <button className="atp-btn warn" onClick={testEdgePush} disabled={!pushSub || edgeLoading}>
              {edgeLoading ? 'Sending…' : '⚡ Test Edge Function Push'}
            </button>
          </div>

          {pushStatus && (
            <p className="asp-status-msg">{pushStatus}</p>
          )}
        </div>

        {/* ── Notification Preferences ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">🎚</span> Notification Preferences
          </h2>
          <p className="atp-section-desc">
            Control which alert levels trigger in-app toasts and bell notifications. Preferences are
            saved in your browser's local storage.
          </p>

          {[
            { key: 'showHigh',   label: 'HIGH alerts',   badge: 'active-high'   },
            { key: 'showMedium', label: 'MEDIUM alerts', badge: 'active-medium' },
            { key: 'showLow',    label: 'LOW alerts',    badge: 'active-low'    },
            { key: 'showInfo',   label: 'INFO notices',  badge: 'active-info'   },
          ].map(({ key, label, badge }) => (
            <div key={key} className="asp-pref-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className={`atp-level-btn ${badge}`} style={{ cursor: 'default' }}>
                  {label.split(' ')[0]}
                </span>
                <span style={{ fontSize: '0.88rem', color: 'var(--sent-text)' }}>{label}</span>
              </div>
              <button
                type="button"
                className={`asp-toggle${prefs[key] ? ' on' : ''}`}
                onClick={() => togglePref(key)}
                aria-pressed={prefs[key]}
              >
                <span className="asp-toggle-knob" />
              </button>
            </div>
          ))}

          <p className="atp-section-desc" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Note: the notification hook will read these preferences in a future update. Currently these
            serve as a reference for the admin's intent.
          </p>
        </div>

        {/* ── System Configuration ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">⚙️</span> System Configuration
          </h2>
          <p className="atp-section-desc">
            Read-only status of key environment variables and service connections.
          </p>

          <div className="asp-config-grid">
            <div className="asp-config-item">
              <span className="asp-config-label">Environment</span>
              <span className={`asp-config-badge ${env === 'production' ? 'ok' : 'warn'}`}>
                {env}
              </span>
            </div>
            <div className="asp-config-item">
              <span className="asp-config-label">Supabase Project</span>
              <span className="asp-config-value">{supabaseHost}</span>
            </div>
            <div className="asp-config-item">
              <span className="asp-config-label">REACT_APP_SUPABASE_URL</span>
              <span className={`asp-config-badge ${process.env.REACT_APP_SUPABASE_URL ? 'ok' : 'err'}`}>
                {process.env.REACT_APP_SUPABASE_URL ? '✓ Set' : '✗ Missing'}
              </span>
            </div>
            <div className="asp-config-item">
              <span className="asp-config-label">REACT_APP_SUPABASE_ANON_KEY</span>
              <span className={`asp-config-badge ${process.env.REACT_APP_SUPABASE_ANON_KEY ? 'ok' : 'err'}`}>
                {process.env.REACT_APP_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}
              </span>
            </div>
            <div className="asp-config-item">
              <span className="asp-config-label">REACT_APP_VAPID_PUBLIC_KEY</span>
              <span className={`asp-config-badge ${vapidKeySet ? 'ok' : 'warn'}`}>
                {vapidKeySet ? '✓ Set' : '⚠ Not set (optional)'}
              </span>
            </div>
            <div className="asp-config-item">
              <span className="asp-config-label">Web Push API</span>
              <span className={`asp-config-badge ${'PushManager' in window ? 'ok' : 'err'}`}>
                {'PushManager' in window ? '✓ Supported' : '✗ Not supported'}
              </span>
            </div>
            <div className="asp-config-item">
              <span className="asp-config-label">Service Worker</span>
              <span className={`asp-config-badge ${'serviceWorker' in navigator ? 'ok' : 'err'}`}>
                {'serviceWorker' in navigator ? '✓ Available' : '✗ Not available'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
