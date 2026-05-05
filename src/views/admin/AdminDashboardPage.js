import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import WeatherWidget from '../../components/WeatherWidget';

function AdminDashboardPage() {
	const { currentUser: user, handleLogout: onLogout } = useAuth();
	const [stats, setStats]           = useState({ users: '—', centers: '—', alerts: '—', pending: '—' });
	const [pendingReports, setPendingReports] = useState([]);
	const [loading, setLoading]       = useState(true);
	const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

	useEffect(() => {
		async function loadData() {
			const [usersRes, centersRes, alertsRes, pendingRes, reportsRes] = await Promise.all([
				supabase.from('profiles').select('id', { count: 'exact', head: true }),
				supabase.from('evacuation_centers').select('id', { count: 'exact', head: true }),
				supabase.from('alerts').select('id', { count: 'exact', head: true }),
				supabase.from('hazard_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
				supabase.from('hazard_reports').select('id, hazard_type, location, created_at')
					.eq('status', 'pending')
					.order('created_at', { ascending: false })
					.limit(4)
			]);

			setStats({
				users:   usersRes.count   ?? 0,
				centers: centersRes.count ?? 0,
				alerts:  alertsRes.count  ?? 0,
				pending: pendingRes.count ?? 0,
			});

			setPendingReports(reportsRes.data || []);
			setLoading(false);
		}
		loadData();
	}, []);

	const metricCards = [
		{ label: 'Total Users',     icon: '👤', value: stats.users,   tone: 'primary' },
		{ label: 'Centers Managed', icon: '🏢', value: stats.centers, tone: 'success' },
		{ label: 'Open Alerts',     icon: '⚠️',  value: stats.alerts,  tone: 'danger'  },
		{ label: 'Pending Reports', icon: '📋', value: stats.pending, tone: 'warning' },
	];

	return (
		<>
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>Operations Command Dashboard</h1>
					<p>Welcome, {user?.name || 'Admin'}. Coordinate alerts, field reports, and shelter decisions from a single operational board.</p>
					<div className="hero-meta">
						<span className="hero-pill">Command Session Active</span>
						<span className="hero-pill">System Health: Stable</span>
					</div>
				</div>

				<div className="app-page-head">
					<span className="page-chip">Admin Operations</span>
					<button className="btn-inline danger" onClick={() => setShowSignOutConfirm(true)}>Sign Out</button>
				</div>

				<div className="metrics-grid">
					{metricCards.map((item) => (
						<div key={item.label} className={`metric ${item.tone}`}>
							<span className="metric__icon">{item.icon}</span>
							<span>{item.label}</span>
							<strong>{loading ? '…' : item.value}</strong>
						</div>
					))}
				</div>

				<div className="panel-grid">
					<div className="card" style={{ gridColumn: 'span 6' }}>
						<h2>System Status</h2>
						<ul className="status-list" style={{ marginTop: '0.5rem' }}>
							<li><span className="status-dot ok" />API Services: Operational</li>
							<li><span className="status-dot ok" />Notification Queue: Healthy</li>
							<li><span className="status-dot ok" />Center Data Sync: Up to date</li>
							<li>
								<span className={`status-dot ${!loading && stats.pending > 0 ? 'warn' : 'ok'}`} />
								Report Moderation: {loading ? '…' : `${stats.pending} pending`}
							</li>
						</ul>
					</div>

					<div className="card" style={{ gridColumn: 'span 6' }}>
						<h2>Pending Hazard Reports</h2>
						{loading && <p>Loading…</p>}
						{!loading && pendingReports.length === 0 && (
							<div className="info-strip ok" style={{ marginTop: '0.5rem' }}>
								<span>✅</span>
								<span>No pending reports. Moderation queue is clear.</span>
							</div>
						)}
						<ul className="timeline-stack" style={{ marginTop: '0.5rem' }}>
							{pendingReports.map((r) => (
								<li key={r.id}>
									<strong style={{ color: 'var(--sent-primary)' }}>{r.hazard_type}</strong>
									<span style={{ color: 'var(--sent-text-muted)', fontSize: '0.85rem' }}> — {r.location}</span>
									<br />
									<small style={{ color: 'var(--sent-text-muted)' }}>{new Date(r.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
								</li>
							))}
						</ul>
					</div>
				</div>

				<hr className="section-divider" />
				<div className="sub-grid">
					<div className="subtle-card" style={{ gridColumn: 'span 8' }}>
						<h3>🎯 Operational Focus</h3>
						<p>Tonight’s highest priority is validating reports from low-lying barangays before route recommendations are pushed to residents.</p>
					</div>
					<div className="subtle-card" style={{ gridColumn: 'span 4' }}>
						<h3>📡 Next Broadcast</h3>
						<p>Preparedness bulletin scheduled for 18:00 with flood and transport updates.</p>
					</div>
				</div>

				{/* Live Weather & Risk Overview */}
				<div className="panel-grid" style={{ marginTop: '0.9rem' }}>
					<div style={{ gridColumn: 'span 12' }}>
						<WeatherWidget compact />
					</div>
				</div>
			</div>
		</section>

		{showSignOutConfirm && (
			<div className="sent-modal-overlay" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" onClick={() => setShowSignOutConfirm(false)}>
				<div className="sent-modal" onClick={(e) => e.stopPropagation()}>
					<h2 className="sent-modal__title" id="signout-title">Sign out of eLikas?</h2>
					<p className="sent-modal__body">You'll be returned to the login screen. Any unsaved changes will be lost.</p>
					<div className="sent-modal__actions">
						<button className="sent-modal__btn ghost" onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
						<button className="sent-modal__btn danger" onClick={onLogout}>Sign Out</button>
					</div>
				</div>
			</div>
		)}
		</>
	);
}

export default AdminDashboardPage;

