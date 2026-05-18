import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { writeAuditLog } from '../../services/adminService';
import { fireNotification } from '../../hooks/useNotifications';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminTestPage.css';

const LEVELS = ['high', 'medium', 'low'];

const PRESET_ALERTS = {
  high: {
    title: '[TEST] Critical Flooding Alert',
    area: 'Barangay San Jose, Bulacan',
    description: 'Simulated high-severity flood warning for testing purposes.',
  },
  medium: {
    title: '[TEST] Advisory: Heavy Rainfall',
    area: 'Malolos City, Bulacan',
    description: 'Simulated moderate advisory for testing purposes.',
  },
  low: {
    title: '[TEST] Routine Weather Notice',
    area: 'General area, Bulacan',
    description: 'Simulated low-severity weather notice for testing purposes.',
  },
};

function timestamp() {
  return new Date().toLocaleTimeString('en-PH', { hour12: false });
}

export default function AdminSimulationPage() {
  const { currentUser } = useAuth();

  // ── Console log ────────────────────────────────────────────────────
  const [logs, setLogs] = useState([{ type: 'warn', msg: 'Simulation console ready.' }]);
  const addLog = useCallback((type, msg) => {
    setLogs((prev) => [{ type, msg: `[${timestamp()}] ${msg}` }, ...prev].slice(0, 50));
  }, []);
  const clearLog = () => setLogs([]);

  // ── Browser notification permission ───────────────────────────────
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    addLog(result === 'granted' ? 'ok' : 'warn', `Notification permission: ${result}`);
  };
  const fireTestNotif = (level) => {
    const titles  = { high: 'eLikas Alert 🔴', medium: 'eLikas Advisory 🟠', low: 'eLikas Notice 🟢' };
    const bodies  = { high: 'Test HIGH-severity alert fired.', medium: 'Test MEDIUM advisory fired.', low: 'Test LOW notice fired.' };
    fireNotification(titles[level], bodies[level], level);
    addLog('ok', `Notification dispatched (level: ${level})`);
  };

  // ── Toast + Bell Simulator ─────────────────────────────────────────
  const [toastLevel, setToastLevel] = useState('info');
  const [toastTitle, setToastTitle] = useState('eLikas Test');
  const [toastBody,  setToastBody]  = useState('This is a test notification.');
  const fireCustomToast = () => {
    if (!toastTitle.trim()) { addLog('err', 'Toast title cannot be empty.'); return; }
    fireNotification(toastTitle.trim(), toastBody.trim(), toastLevel);
    addLog('ok', `Toast fired (level: ${toastLevel}) — visible in stack + bell icon.`);
  };

  // ── Alert DB insert ────────────────────────────────────────────────
  const [selectedLevel, setSelectedLevel] = useState('high');
  const [alertForm, setAlertForm]         = useState(PRESET_ALERTS.high);
  const [inserting, setInserting]         = useState(false);
  const handleLevelSelect = (lvl) => { setSelectedLevel(lvl); setAlertForm(PRESET_ALERTS[lvl]); };
  const setField = (field, val) => setAlertForm((f) => ({ ...f, [field]: val }));

  const insertTestAlert = async () => {
    if (!alertForm.title.trim() || !alertForm.area.trim()) {
      addLog('err', 'Title and area are required.');
      return;
    }
    setInserting(true);
    const { data, error } = await supabase
      .from('alerts')
      .insert([{
        title:       alertForm.title.trim(),
        level:       selectedLevel,
        area:        alertForm.area.trim(),
        description: alertForm.description.trim(),
        created_at:  new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      addLog('err', `DB insert failed: ${error.message}`);
    } else {
      addLog('ok', `Test alert inserted (id: ${data?.id ?? '?'}, level: ${selectedLevel})`);
      await writeAuditLog({
        actorId:    currentUser?.id,
        actorName:  currentUser?.name || currentUser?.email,
        action:     'test.alert.insert',
        targetType: 'alert',
        targetId:   data?.id,
        meta:       { level: selectedLevel, title: alertForm.title.trim() },
      });
    }
    setInserting(false);
  };

  const deleteTestAlerts = async () => {
    const { error } = await supabase.from('alerts').delete().ilike('title', '[TEST]%');
    if (error) addLog('err', `Cleanup failed: ${error.message}`);
    else        addLog('warn', 'All [TEST] alerts deleted from database.');
  };

  // ── Realtime probe ─────────────────────────────────────────────────
  const [rtStatus, setRtStatus] = useState('connecting');
  const channelRef = useRef(null);

  const fireNotifFromAlert = useCallback((alert) => {
    const cfg = {
      high:   { title: 'eLikas Alert',    fallback: 'A new high-severity alert has been issued.'   },
      medium: { title: 'eLikas Advisory', fallback: 'A new moderate advisory has been issued.'     },
      low:    { title: 'eLikas Notice',   fallback: 'A new low-severity notice has been issued.'   },
    }[alert?.level];
    if (!cfg) return;
    fireNotification(cfg.title, alert.title || cfg.fallback, alert.level);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel('sim-realtime-probe')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const a = payload.new;
        addLog('ok', `Realtime event: "${a?.title || '?'}" (level: ${a?.level ?? '?'})`);
        fireNotifFromAlert(a);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')                                setRtStatus('connected');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRtStatus('disconnected');
        else                                                        setRtStatus('connecting');
      });
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="atp-page" style={{ paddingTop: '1.5rem', minHeight: 'auto' }}>
      <div className="atp-wrap">

        {/* ── Toast + Bell Simulator ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">💬</span> Toast + Bell Simulator
          </h2>
          <p className="atp-section-desc">
            Fire an in-app toast and add an entry to the bell icon — no DB write or OS permission
            required. Works on every deployment.
          </p>
          <div className="atp-level-group">
            {['info', 'low', 'medium', 'high'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`atp-level-btn ${toastLevel === lvl ? `active-${lvl}` : ''}`}
                onClick={() => setToastLevel(lvl)}
              >
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="atp-field-row">
            <div className="atp-field">
              <label htmlFor="sim-toast-title">Title</label>
              <input
                id="sim-toast-title"
                type="text"
                value={toastTitle}
                onChange={(e) => setToastTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>
            <div className="atp-field">
              <label htmlFor="sim-toast-body">Message</label>
              <input
                id="sim-toast-body"
                type="text"
                value={toastBody}
                onChange={(e) => setToastBody(e.target.value)}
                placeholder="Notification body text"
              />
            </div>
          </div>
          <div className="atp-actions">
            <button className="atp-btn primary" onClick={fireCustomToast}>
              🔔 Fire Toast + Bell
            </button>
            <button
              className="atp-btn ghost"
              onClick={() => { setToastTitle('eLikas Test'); setToastBody('This is a test notification.'); setToastLevel('info'); }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Browser Notifications ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">🔔</span> Browser Notifications
          </h2>
          <p className="atp-section-desc">
            Fire OS-level notifications. Requires browser notification permission.
          </p>
          <div className={`atp-permission-badge ${permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default'}`}>
            {permission === 'granted' ? '✓ Granted' : permission === 'denied' ? '✗ Denied' : '⚠ Not Set'}
          </div>
          <div className="atp-actions">
            {permission !== 'granted' && (
              <button className="atp-btn primary" onClick={requestPermission}>Request Permission</button>
            )}
            <button className="atp-btn ok"     onClick={() => fireTestNotif('low')}>Fire Low</button>
            <button className="atp-btn warn"   onClick={() => fireTestNotif('medium')}>Fire Medium</button>
            <button className="atp-btn danger" onClick={() => fireTestNotif('high')}>Fire High</button>
          </div>
        </div>

        {/* ── Simulate Alert (DB Insert) ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">⚡</span> Simulate Alert (DB Insert)
          </h2>
          <p className="atp-section-desc">
            Inserts a <code>[TEST]</code> alert into the database — triggers realtime notifications
            for all subscribed users.
          </p>
          <div className="atp-level-group">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`atp-level-btn ${selectedLevel === lvl ? `active-${lvl}` : ''}`}
                onClick={() => handleLevelSelect(lvl)}
              >
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="atp-field-row">
            <div className="atp-field">
              <label htmlFor="sim-title">Title</label>
              <input id="sim-title" type="text" value={alertForm.title} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div className="atp-field">
              <label htmlFor="sim-area">Area</label>
              <input id="sim-area" type="text" value={alertForm.area} onChange={(e) => setField('area', e.target.value)} />
            </div>
          </div>
          <div className="atp-field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="sim-desc">Description</label>
            <textarea id="sim-desc" value={alertForm.description} onChange={(e) => setField('description', e.target.value)} />
          </div>
          <div className="atp-actions">
            <button className="atp-btn primary" onClick={insertTestAlert} disabled={inserting}>
              {inserting ? 'Inserting…' : 'Insert Test Alert'}
            </button>
            <button className="atp-btn ghost" onClick={() => handleLevelSelect(selectedLevel)}>Reset to Preset</button>
            <button className="atp-btn danger" onClick={deleteTestAlerts}>🗑 Delete All [TEST] Alerts</button>
          </div>
        </div>

        {/* ── Realtime Status ── */}
        <div className="atp-section">
          <h2 className="atp-section-title">
            <span className="atp-icon">📡</span> Realtime Connection
          </h2>
          <p className="atp-section-desc">
            Live status of the Supabase realtime channel. Alert DB inserts above will appear here.
          </p>
          <div className="atp-realtime-row">
            <span className={`atp-status-dot ${rtStatus}`} />
            <span className="atp-status-label">
              {rtStatus === 'connected'    ? 'Connected — listening for alerts'
               : rtStatus === 'connecting' ? 'Connecting…'
               : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* ── Console Log ── */}
        <div className="atp-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h2 className="atp-section-title" style={{ margin: 0 }}>
              <span className="atp-icon">🗒</span> Console
            </h2>
            <button className="atp-btn ghost" onClick={clearLog}>Clear</button>
          </div>
          <div className="atp-log">
            {logs.length === 0
              ? <div className="atp-log-entry">— empty —</div>
              : logs.map((l, i) => (
                  <div key={i} className={`atp-log-entry ${l.type}`}>{l.msg}</div>
                ))
            }
          </div>
        </div>

      </div>
    </div>
  );
}
