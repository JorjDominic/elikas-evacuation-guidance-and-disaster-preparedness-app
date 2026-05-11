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
		description: 'This is a TEST alert. Simulated high-severity flood warning for testing purposes.',
	},
	medium: {
		title: '[TEST] Advisory: Heavy Rainfall',
		area: 'Malolos City, Bulacan',
		description: 'This is a TEST alert. Simulated moderate advisory for testing purposes.',
	},
	low: {
		title: '[TEST] Routine Weather Notice',
		area: 'General area, Bulacan',
		description: 'This is a TEST alert. Simulated low-severity weather notice for testing purposes.',
	},
};

function timestamp() {
	return new Date().toLocaleTimeString('en-PH', { hour12: false });
}

export default function AdminTestPage() {
	const { currentUser } = useAuth();

	// ── Notification permission ──────────────────────────────────────────
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
		const titles = { high: 'eLikas Alert 🔴', medium: 'eLikas Advisory 🟠', low: 'eLikas Notice 🟢' };
		const bodies  = {
			high:   'Test HIGH-severity alert fired.',
			medium: 'Test MEDIUM advisory fired.',
			low:    'Test LOW notice fired.',
		};
		fireNotification(titles[level] || 'eLikas Test', bodies[level], level);
		addLog('ok', `Notification dispatched (level: ${level})`);
	};

	// ── Alert DB insert ──────────────────────────────────────────────────
	const [selectedLevel, setSelectedLevel] = useState('high');
	const [alertForm, setAlertForm] = useState(PRESET_ALERTS.high);
	const [inserting, setInserting] = useState(false);

	const handleLevelSelect = (lvl) => {
		setSelectedLevel(lvl);
		setAlertForm(PRESET_ALERTS[lvl]);
	};

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
		const { error } = await supabase
			.from('alerts')
			.delete()
			.ilike('title', '[TEST]%');
		if (error) {
			addLog('err', `Cleanup failed: ${error.message}`);
		} else {
			addLog('warn', 'All [TEST] alerts deleted from DB.');
		}
	};

	// ── Realtime probe ───────────────────────────────────────────────────
	const [rtStatus, setRtStatus] = useState('connecting');
	const channelRef = useRef(null);

	useEffect(() => {
		const ch = supabase
			.channel('atp-realtime-probe')
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'alerts' },
				(payload) => {
					const incoming = payload.new;
					addLog('ok', `Realtime event received: "${incoming?.title || '?'}" (level: ${incoming?.level ?? '?'})`);
					fireNotifFromAlert(incoming);
				}
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED')                               setRtStatus('connected');
				else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRtStatus('disconnected');
				else                                                        setRtStatus('connecting');
			});

		channelRef.current = ch;
		return () => { supabase.removeChannel(ch); };
		// addLog and fireNotifFromAlert are stable via useCallback — safe to omit from dep array
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Fire a notification + in-app toast when a DB alert is received
	const fireNotifFromAlert = useCallback((alert) => {
		const lvl = alert?.level;
		const cfg = {
			high:   { title: 'eLikas Alert',    fallback: 'A new high-severity alert has been issued.'        },
			medium: { title: 'eLikas Advisory', fallback: 'A new moderate-severity advisory has been issued.' },
			low:    { title: 'eLikas Notice',   fallback: 'A new low-severity notice has been issued.'        },
		}[lvl];
		if (!cfg) return;
		fireNotification(cfg.title, alert.title || cfg.fallback, lvl);
	}, []);

	// ── Console log ──────────────────────────────────────────────────────
	const [logs, setLogs] = useState([{ type: 'warn', msg: 'Test Console ready.' }]);

	const addLog = useCallback((type, msg) => {
		setLogs((prev) => [{ type, msg: `[${timestamp()}] ${msg}` }, ...prev].slice(0, 50));
	}, []);

	const clearLog = () => setLogs([]);

	// ────────────────────────────────────────────────────────────────────
	return (
		<div className="atp-page">
			<div className="atp-wrap">

				{/* Header */}
				<div className="atp-header">
					<h1>Test &amp; Debug Console</h1>
					<p>Admin-only tools for testing notifications, alerts, and realtime events.</p>
				</div>

				{/* ── 1. Browser Notifications ── */}
				<div className="atp-section">
					<h2 className="atp-section-title">
						<span className="atp-icon">🔔</span> Browser Notifications
					</h2>
					<p className="atp-section-desc">
						Manage and test OS-level push notifications. eLikas fires these automatically
						when a high or medium alert is inserted into the database.
					</p>

					<div className={`atp-permission-badge ${permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default'}`}>
						{permission === 'granted' ? '✓ Granted' : permission === 'denied' ? '✗ Denied' : '⚠ Not Set'}
					</div>

					<div className="atp-actions">
						{permission !== 'granted' && (
							<button className="atp-btn primary" onClick={requestPermission}>
								Request Permission
							</button>
						)}
						<button className="atp-btn ok"     onClick={() => fireTestNotif('low')}>Fire Low Notif</button>
						<button className="atp-btn warn"   onClick={() => fireTestNotif('medium')}>Fire Medium Notif</button>
						<button className="atp-btn danger" onClick={() => fireTestNotif('high')}>Fire High Notif</button>
					</div>
				</div>

				{/* ── 2. Simulate Alert (DB Insert) ── */}
				<div className="atp-section">
					<h2 className="atp-section-title">
						<span className="atp-icon">⚡</span> Simulate Alert (DB Insert)
					</h2>
					<p className="atp-section-desc">
						Inserts a test alert into the <code>alerts</code> table. This triggers realtime
						notifications for subscribed users. Titles are prefixed with <code>[TEST]</code> for easy cleanup.
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
							<label htmlFor="atp-title">Title</label>
							<input
								id="atp-title"
								type="text"
								value={alertForm.title}
								onChange={(e) => setField('title', e.target.value)}
							/>
						</div>
						<div className="atp-field">
							<label htmlFor="atp-area">Area</label>
							<input
								id="atp-area"
								type="text"
								value={alertForm.area}
								onChange={(e) => setField('area', e.target.value)}
							/>
						</div>
					</div>

					<div className="atp-field" style={{ marginBottom: '1rem' }}>
						<label htmlFor="atp-desc">Description</label>
						<textarea
							id="atp-desc"
							value={alertForm.description}
							onChange={(e) => setField('description', e.target.value)}
						/>
					</div>

					<div className="atp-actions">
						<button className="atp-btn primary" onClick={insertTestAlert} disabled={inserting}>
							{inserting ? 'Inserting…' : 'Insert Test Alert'}
						</button>
						<button className="atp-btn ghost" onClick={() => handleLevelSelect(selectedLevel)}>
							Reset to Preset
						</button>
						<button className="atp-btn danger" onClick={deleteTestAlerts}>
							Delete All [TEST] Alerts
						</button>
					</div>
				</div>

				{/* ── 3. Realtime Status ── */}
				<div className="atp-section">
					<h2 className="atp-section-title">
						<span className="atp-icon">📡</span> Realtime Connection
					</h2>
					<p className="atp-section-desc">
						Live status of this page's Supabase realtime channel. When you insert a test
						alert above, an event should appear in the console log below.
					</p>

					<div className="atp-realtime-row">
						<span className={`atp-status-dot ${rtStatus}`} />
						<span className="atp-status-label">
							{rtStatus === 'connected'
								? 'Connected — listening for alerts'
								: rtStatus === 'connecting'
								? 'Connecting…'
								: 'Disconnected'}
						</span>
					</div>
				</div>

				{/* ── Console Log ── */}
				<div className="atp-section">
					<h2 className="atp-section-title">
						<span className="atp-icon">🗒</span> Console Log
					</h2>
					<div className="atp-actions" style={{ marginBottom: '0.75rem' }}>
						<button className="atp-btn ghost" onClick={clearLog}>Clear Log</button>
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
