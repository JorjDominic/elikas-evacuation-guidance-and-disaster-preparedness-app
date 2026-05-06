import React, { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import WeatherWidget from '../../components/WeatherWidget';

// ── Pure-SVG 7-day bar chart (no external deps) ──────────────────────────────
function AlertsTrendChart({ data }) {
	const W = 320, H = 90, PAD = { top: 8, bottom: 22, left: 6, right: 6 };
	const innerW = W - PAD.left - PAD.right;
	const innerH = H - PAD.top - PAD.bottom;
	const max = Math.max(...data.map((d) => d.count), 1);
	const barW = Math.floor(innerW / data.length) - 4;

	return (
		<svg
			viewBox={`0 0 ${W} ${H}`}
			style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
			aria-label="Alerts issued over the last 7 days"
			role="img"
		>
			{data.map((d, i) => {
				const barH = max > 0 ? Math.max(3, Math.round((d.count / max) * innerH)) : 3;
				const x = PAD.left + i * (innerW / data.length) + 2;
				const y = PAD.top + innerH - barH;
				const isHighest = d.count === max && max > 0;
				return (
					<g key={d.label}>
						<rect
							x={x}
							y={y}
							width={barW}
							height={barH}
							rx={3}
							fill={isHighest ? 'var(--sent-danger, #c41919)' : 'var(--sent-primary, #1a3a5f)'}
							opacity={0.82}
						/>
						{d.count > 0 && (
							<text
								x={x + barW / 2}
								y={y - 3}
								textAnchor="middle"
								fontSize="9"
								fill="var(--sent-text-muted, #5a5850)"
							>
								{d.count}
							</text>
						)}
						<text
							x={x + barW / 2}
							y={H - 4}
							textAnchor="middle"
							fontSize="8"
							fill="var(--sent-text-muted, #5a5850)"
						>
							{d.label}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

function AdminDashboardPage() {
	const { currentUser: user, handleLogout: onLogout } = useAuth();
	const [stats, setStats]           = useState({ users: '—', centers: '—', alerts: '—', pending: '—' });
	const [pendingReports, setPendingReports] = useState([]);
	const [loading, setLoading]       = useState(true);
	const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
	const [hazardTypeCounts, setHazardTypeCounts] = useState({});
	const [occupancyByMuni, setOccupancyByMuni] = useState([]);
	const [alertsTrend, setAlertsTrend] = useState([]);

	useEffect(() => {
		async function loadData() {
			// Build 7-day window
			const days = Array.from({ length: 7 }, (_, i) => {
				const d = new Date();
				d.setDate(d.getDate() - (6 - i));
				return d;
			});
			const since = days[0].toISOString().slice(0, 10) + 'T00:00:00.000Z';

			const [usersRes, centersRes, alertsRes, pendingRes, reportsRes, hazardTypesRes, occupancyRes, trendRes] = await Promise.all([
				supabase.from('profiles').select('id', { count: 'exact', head: true }),
				supabase.from('evacuation_centers').select('id', { count: 'exact', head: true }),
				supabase.from('alerts').select('id', { count: 'exact', head: true }),
				supabase.from('hazard_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
				supabase.from('hazard_reports').select('id, hazard_type, location, created_at')
					.eq('status', 'pending')
					.order('created_at', { ascending: false })
					.limit(4),
				supabase.from('hazard_reports').select('hazard_type').neq('status', 'pending'),
				supabase.from('evacuation_centers').select('municipality, current_occupancy, capacity'),
				supabase.from('alerts').select('created_at').gte('created_at', since),
			]);

			setStats({
				users:   usersRes.count   ?? 0,
				centers: centersRes.count ?? 0,
				alerts:  alertsRes.count  ?? 0,
				pending: pendingRes.count ?? 0,
			});

			setPendingReports(reportsRes.data || []);

			// Hazard type breakdown
			const typeCounts = {};
			(hazardTypesRes.data || []).forEach(({ hazard_type }) => {
				if (hazard_type) typeCounts[hazard_type] = (typeCounts[hazard_type] || 0) + 1;
			});
			setHazardTypeCounts(typeCounts);

			// Occupancy by municipality
			const muniMap = {};
			(occupancyRes.data || []).forEach(({ municipality, current_occupancy, capacity }) => {
				if (!municipality) return;
				if (!muniMap[municipality]) muniMap[municipality] = { occ: 0, cap: 0 };
				muniMap[municipality].occ += current_occupancy || 0;
				muniMap[municipality].cap += capacity || 0;
			});
			setOccupancyByMuni(
				Object.entries(muniMap).map(([muni, { occ, cap }]) => ({ muni, occ, cap })).sort((a, b) => b.occ - a.occ)
			);

			// 7-day alerts trend
			const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
			const trendMap = {};
			days.forEach((d) => {
				const key = d.toISOString().slice(0, 10);
				trendMap[key] = { label: dayLabels[d.getDay()], count: 0 };
			});
			(trendRes.data || []).forEach(({ created_at }) => {
				const key = created_at.slice(0, 10);
				if (trendMap[key]) trendMap[key].count++;
			});
			setAlertsTrend(Object.values(trendMap));

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

				{/* Analytics */}
				{!loading && (Object.keys(hazardTypeCounts).length > 0 || occupancyByMuni.length > 0 || alertsTrend.length > 0) && (
					<>
					<hr className="section-divider" />
					<div className="panel-grid" style={{ marginTop: '0.9rem' }}>
						{/* 7-day alerts trend */}
						{alertsTrend.length > 0 && (
							<div className="card" style={{ gridColumn: 'span 4' }}>
								<h2>Alerts — Last 7 Days</h2>
								<p style={{ fontSize: '0.8rem', color: 'var(--sent-text-muted)', marginBottom: '0.6rem', marginTop: 0 }}>
									Total: {alertsTrend.reduce((s, d) => s + d.count, 0)} issued this week
								</p>
								<AlertsTrendChart data={alertsTrend} />
							</div>
						)}

						{Object.keys(hazardTypeCounts).length > 0 && (
							<div className="card" style={{ gridColumn: 'span 4' }}>
								<h2>Hazard Type Breakdown</h2>
								{(() => {
									const total = Object.values(hazardTypeCounts).reduce((a, b) => a + b, 0);
									return Object.entries(hazardTypeCounts)
										.sort((a, b) => b[1] - a[1])
										.map(([type, count]) => (
											<div key={type} style={{ marginTop: '0.6rem' }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '2px' }}>
													<span>{type}</span><span>{count} ({Math.round(count / total * 100)}%)</span>
												</div>
												<div style={{ background: 'var(--color-border, #e5e7eb)', borderRadius: '4px', height: '8px' }}>
													<div style={{ width: `${(count / total) * 100}%`, background: 'var(--color-primary, #2563eb)', borderRadius: '4px', height: '8px', transition: 'width 0.3s' }} />
												</div>
											</div>
										));
								})()}
							</div>
						)}

						{occupancyByMuni.length > 0 && (
							<div className="card" style={{ gridColumn: 'span 4' }}>
								<h2>Center Occupancy by Municipality</h2>
								{occupancyByMuni.map(({ muni, occ, cap }) => {
									const pct = cap > 0 ? Math.min(100, Math.round((occ / cap) * 100)) : 0;
									const color = pct >= 90 ? 'var(--color-danger, #dc2626)' : pct >= 70 ? 'var(--color-warning, #d97706)' : 'var(--color-success, #16a34a)';
									return (
										<div key={muni} style={{ marginTop: '0.6rem' }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '2px' }}>
												<span>{muni}</span><span>{occ}/{cap} ({pct}%)</span>
											</div>
											<div style={{ background: 'var(--color-border, #e5e7eb)', borderRadius: '4px', height: '8px' }}>
												<div style={{ width: `${pct}%`, background: color, borderRadius: '4px', height: '8px', transition: 'width 0.3s' }} />
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
					</>
				)}
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

