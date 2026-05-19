import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { writeAuditLog } from '../../services/adminService';
import { fireNotification } from '../../hooks/useNotifications';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminTestPage.css';

const LEVELS = ['high', 'medium', 'low'];

// Convert base64url VAPID key → Uint8Array (needed by pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const arr = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
	return arr;
}

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

	// ── Toast Simulator ─────────────────────────────────────────────────
	const [toastLevel, setToastLevel] = useState('info');
	const [toastTitle, setToastTitle] = useState('eLikas Test');
	const [toastBody, setToastBody] = useState('This is a test notification.');

	const fireCustomToast = () => {
		if (!toastTitle.trim()) { addLog('err', 'Toast title cannot be empty.'); return; }
		fireNotification(toastTitle.trim(), toastBody.trim(), toastLevel);
		addLog('ok', `Toast fired (level: ${toastLevel}) — visible in stack + bell icon.`);
	};

	// ── Web Push subscription ─────────────────────────────────────────────
	const [pushSub, setPushSub] = useState(null);
	const [pushSubLoading, setPushSubLoading] = useState(false);
	const [edgePushLoading, setEdgePushLoading] = useState(false);

	// Check existing subscription on mount
	useEffect(() => {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
		navigator.serviceWorker.ready.then((reg) => {
			reg.pushManager.getSubscription().then((sub) => {
				if (sub) {
					setPushSub(sub);
					addLog('ok', 'Existing push subscription found.');
				}
			});
		});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const subscribeToPush = async () => {
		const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
		if (!vapidKey) {
			addLog('err', 'REACT_APP_VAPID_PUBLIC_KEY is not set. Add it in your Vercel environment variables.');
			return;
		}
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			addLog('err', 'Web Push is not supported in this browser.');
			return;
		}
		if (permission !== 'granted') {
			addLog('warn', 'Grant browser notification permission first.');
			return;
		}
		setPushSubLoading(true);
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidKey),
			});
			const subJson = sub.toJSON();
			const { error: dbErr } = await supabase.from('push_subscriptions').upsert(
				[{ endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth, user_id: currentUser?.id }],
				{ onConflict: 'endpoint' }
			);
			if (dbErr) {
				addLog('err', `Subscription saved locally but DB write failed: ${dbErr.message}`);
			} else {
				addLog('ok', 'Push subscription registered and saved to database.');
			}
			setPushSub(sub);
		} catch (err) {
			addLog('err', `Subscribe failed: ${err.message}`);
		}
		setPushSubLoading(false);
	};

	const unsubscribeFromPush = async () => {
		if (!pushSub) return;
		setPushSubLoading(true);
		try {
			const endpoint = pushSub.endpoint;
			await pushSub.unsubscribe();
			const { error: dbErr } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
			if (dbErr) addLog('warn', `Unsubscribed from browser but DB delete failed: ${dbErr.message}`);
			else addLog('warn', 'Push subscription removed from browser and database.');
			setPushSub(null);
		} catch (err) {
			addLog('err', `Unsubscribe failed: ${err.message}`);
		}
		setPushSubLoading(false);
	};

	/**
	 * Fires a local toast/bell/OS notification AND sends a Web Push via the
	 * Edge Function to every subscribed device (phone, other browsers, etc.).
	 * This is the "2-in-1" path: one press → notification on all devices.
	 *
	 * @param {{ level: string, title: string, description: string }} opts
	 */
	const sendCombinedNotif = async ({ level = 'high', title, description }) => {
		// ── Step 1: local toast + bell + OS notification ─────────────────
		fireNotification(title, description, level);
		addLog('ok', `Local toast dispatched (level: ${level})`);

		// ── Step 2: Web Push to all subscribers via Edge Function ────────
		if (!pushSub) {
			addLog('warn', 'No push subscription on this browser — subscribe first to reach other devices.');
			return;
		}
		setEdgePushLoading(true);
		addLog('warn', 'Invoking send-push-notification edge function…');
		try {
			const { data, error: fnErr } = await supabase.functions.invoke('send-push-notification', {
				body: {
					alert: {
						id: `test-${Date.now()}`,
						title,
						level: 'high', // Edge Function only pushes on high; level still controls local toast colour
						description,
					},
				},
			});
			if (fnErr) {
				addLog('err', `Push error: ${fnErr.message}`);
			} else {
				addLog('ok', `Push sent to all subscribers: ${JSON.stringify(data)}`);
			}
		} catch (err) {
			addLog('err', `Push threw: ${err.message}`);
		}
		setEdgePushLoading(false);
	};

	// Legacy single-device quick-test (kept for the Web Push section button)
	const testEdgePush = () =>
		sendCombinedNotif({
			level: 'high',
			title: '[TEST] Edge Function Push',
			description: 'This is a test push fired from AdminTestPage.',
		});

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

				{/* ── 1b. Toast Simulator ── */}
				<div className="atp-section">
					<h2 className="atp-section-title">
						<span className="atp-icon">💬</span> Toast + Push Notification Test
					</h2>
					<p className="atp-section-desc">
						<strong>Fire Toast Only</strong> — shows an in-app toast and bell entry on this device only (no DB write, no push).<br />
						<strong>Send to All Devices</strong> — fires the local toast <em>and</em> sends a Web Push via the Edge Function to every subscribed browser/phone simultaneously.
						Subscribe your phone and PC in the Web Push section below first.
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
							<label htmlFor="atp-toast-title">Title</label>
							<input
								id="atp-toast-title"
								type="text"
								value={toastTitle}
								onChange={(e) => setToastTitle(e.target.value)}
								placeholder="Notification title"
							/>
						</div>
						<div className="atp-field">
							<label htmlFor="atp-toast-body">Message</label>
							<input
								id="atp-toast-body"
								type="text"
								value={toastBody}
								onChange={(e) => setToastBody(e.target.value)}
								placeholder="Notification body text"
							/>
						</div>
					</div>

					<div className="atp-actions">
						<button className="atp-btn primary" onClick={fireCustomToast}>
						🔔 Fire Toast Only
					</button>
					<button
						className="atp-btn warn"
						disabled={edgePushLoading}
						onClick={() => sendCombinedNotif({ level: toastLevel, title: toastTitle.trim() || 'eLikas Test', description: toastBody.trim() })}
					>
						{edgePushLoading ? 'Sending…' : '📲 Send to All Devices'}
					</button>
					<button className="atp-btn ghost" onClick={() => { setToastTitle('eLikas Test'); setToastBody('This is a test notification.'); setToastLevel('info'); }}>
						Reset
					</button>
				</div>
				{!pushSub && (
					<p style={{ fontSize: '0.82rem', color: 'var(--sent-text-muted)', marginTop: '0.5rem' }}>
						⚠️ <strong>Send to All Devices</strong> requires a push subscription — subscribe this browser and your phone in the Web Push section below.
					</p>
				)}
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

				{/* ── 4. Web Push Subscription ── */}
				<div className="atp-section">
					<h2 className="atp-section-title">
						<span className="atp-icon">📲</span> Web Push (VAPID)
					</h2>
					<p className="atp-section-desc">
						Subscribe this browser to Web Push so it receives OS-level notifications even
						when the tab is in the background. On Vercel, set{' '}
						<code>REACT_APP_VAPID_PUBLIC_KEY</code> in your project’s Environment Variables
						dashboard. Subscriptions are stored in the <code>push_subscriptions</code> table
						and delivered by the <code>send-push-notification</code> Edge Function.
					</p>

					{!process.env.REACT_APP_VAPID_PUBLIC_KEY && (
						<div className="atp-warn-box">
							⚠️ <code>REACT_APP_VAPID_PUBLIC_KEY</code> is not set.
							Add it in Vercel → Project Settings → Environment Variables and redeploy.
						</div>
					)}

					<div className="atp-realtime-row" style={{ marginBottom: '1rem' }}>
						<span className={`atp-status-dot ${pushSub ? 'connected' : 'disconnected'}`} />
						<span className="atp-status-label">
							{pushSub
								? 'Subscribed — this browser will receive push notifications'
								: 'Not subscribed to Web Push'}
						</span>
					</div>

					<div className="atp-actions">
						{!pushSub ? (
							<button
								className="atp-btn primary"
								onClick={subscribeToPush}
								disabled={pushSubLoading || permission !== 'granted'}
							>
								{pushSubLoading ? 'Subscribing…' : '+ Subscribe This Browser'}
							</button>
						) : (
							<button
								className="atp-btn ghost"
								onClick={unsubscribeFromPush}
								disabled={pushSubLoading}
							>
								{pushSubLoading ? 'Removing…' : 'Unsubscribe'}
							</button>
						)}
						<button
							className="atp-btn warn"
							onClick={testEdgePush}
							disabled={!pushSub || edgePushLoading}
						>
							{edgePushLoading ? 'Sending…' : '⚡ Test Edge Function Push'}
						</button>
					</div>

					{permission !== 'granted' && !pushSub && (
						<p style={{ fontSize: '0.82rem', color: 'var(--sent-text-muted)', marginTop: '0.6rem' }}>
							Grant browser notification permission in the section above before subscribing.
						</p>
					)}
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
