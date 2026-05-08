import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../config/supabase';
import { writeAuditLog } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';

import '../../utils/leafletIcons';

const PAGE_SIZE = 20;

function csvCell(value) {
	const str = value === null || value === undefined ? '' : String(value);
	// Prefix formula characters to prevent CSV injection
	const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
	if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
		return `"${safe.replace(/"/g, '""')}"`;
	}
	return safe;
}

function exportCSV(data, filename) {
	if (!data.length) return;
	const headers = ['id', 'hazard_type', 'location', 'description', 'status', 'reporter_name', 'created_at'];
	const rows = data.map((r) => headers.map((h) => csvCell(r[h])).join(','));
	const csv = [headers.join(','), ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url; a.download = filename; a.click();
	URL.revokeObjectURL(url);
}

const BULACAN_CENTER = [14.7942, 120.8793];

const STATUS_COLORS = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };

// ── Photo Lightbox ──────────────────────────────────────────────────────────
function PhotoLightbox({ url, onClose }) {
	return (
		<div
			style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label="Report photo"
		>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close photo"
				style={{ position: 'absolute', top: '1rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer', lineHeight: 1 }}
			>
				&times;
			</button>
			<img
				src={url}
				alt="Hazard report attachment"
				style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '0.5rem', objectFit: 'contain' }}
				onClick={(e) => e.stopPropagation()}
			/>
		</div>
	);
}

// ── Confirm Dialog ──────────────────────────────────────────────────────────
function ConfirmStatusDialog({ report, action, onConfirm, onCancel }) {
	const color = action === 'approved' ? '#16a34a' : '#dc2626';
	const label = action === 'approved' ? 'Approve' : 'Reject';
	return (
		<div
			style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
			onClick={onCancel}
			role="alertdialog"
			aria-modal="true"
		>
			<div
				style={{ background: 'var(--card-bg, #fff)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '360px', width: '92vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
				onClick={(e) => e.stopPropagation()}
			>
				<h3 style={{ margin: '0 0 0.5rem' }}>{label} this report?</h3>
				<p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--sent-text-muted)' }}>
					<strong>{report.hazard_type}</strong>{report.location ? ` — ${report.location}` : ''}
				</p>
				<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
					<button type="button" className="btn-inline" onClick={onCancel}>Cancel</button>
					<button type="button" className="btn-inline" style={{ background: color, color: '#fff', border: 'none' }} onClick={onConfirm}>{label}</button>
				</div>
			</div>
		</div>
	);
}

function FlyTo({ position }) {
	const map = useMap();
	useEffect(() => { if (position) map.flyTo(position, 16, { duration: 0.8 }); }, [position, map]);
	return null;
}

function AdminReportsPage() {
	const { currentUser } = useAuth();
	const [reports, setReports] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [flyTo, setFlyTo] = useState(null);
	const [highlighted, setHighlighted] = useState(null);
	const [pageNum, setPageNum] = useState(0);
	const [confirmPending, setConfirmPending] = useState(null); // { report, action }
	const [photoUrl, setPhotoUrl] = useState(null);

	const fetchReports = useCallback(async () => {
		setLoading(true);
		const { data, error: err } = await supabase
			.from('hazard_reports')
			.select('*')
			.order('created_at', { ascending: false });
		if (err) setError(err.message);
		else setReports(data || []);
		setLoading(false);
	}, []);

	useEffect(() => { fetchReports(); }, [fetchReports]);

	// Realtime subscription
	useEffect(() => {
		const channel = supabase
			.channel('admin-reports-realtime')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'hazard_reports' }, () => fetchReports())
			.subscribe();
		return () => supabase.removeChannel(channel);
	}, [fetchReports]);

	const updateStatus = async (id, status) => {
		const report = reports.find((r) => r.id === id);
		const { error: err } = await supabase.from('hazard_reports').update({ status }).eq('id', id);
		if (err) { setError(err.message); return; }
		await writeAuditLog({
			actorId: currentUser?.id, actorName: currentUser?.name,
			action: status === 'approved' ? 'report.approve' : 'report.reject',
			targetType: 'hazard_report', targetId: id,
			meta: { hazard_type: report?.hazard_type, location: report?.location }
		});
		await fetchReports();
	};

	const handleMarkerClick = (report) => {
		setHighlighted(report.id);
		setFlyTo([report.latitude, report.longitude]);
	};

	const pendingCount = reports.filter((r) => r.status === 'pending').length;
	const mappable = reports.filter((r) => r.latitude != null && r.longitude != null);
	const totalPages = Math.ceil(reports.length / PAGE_SIZE);
	const pageReports = reports.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

	return (
		<>
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>Moderate Hazard Reports</h1>
					<p>Validate field submissions, mark response status, and route high-risk incidents to appropriate teams.</p>
					<div className="hero-meta">
						<span className="hero-pill">Incident Queue</span>
						<span className="hero-pill">Triage Priority Enabled</span>
					</div>
				</div>

				<div className="app-page-head">
					<span className="page-chip">Moderation Console</span>
					<button type="button" className="btn-inline" onClick={() => exportCSV(reports, 'hazard-reports.csv')} disabled={reports.length === 0}>
						⇓ Export CSV
					</button>
				</div>

				<div className="sub-grid" style={{ marginBottom: '0.9rem' }}>
					<div className="subtle-card" style={{ gridColumn: 'span 8' }}>
						<h3>Current Focus</h3>
						<p>Prioritize reports near schools, hospitals, and bridges before broad community incidents.</p>
					</div>
					<div className="subtle-card" style={{ gridColumn: 'span 4' }}>
						<h3>Pending Validation</h3>
						<p>{loading ? 'â€¦' : `${pendingCount} report${pendingCount !== 1 ? 's' : ''} awaiting review.`}</p>
					</div>
				</div>

				{error && <p style={{ color: 'var(--color-danger, red)', marginBottom: '0.75rem' }}>{error}</p>}
				{loading && <p>Loading reportsâ€¦</p>}

				{!loading && mappable.length > 0 && (
					<div className="card" style={{ marginBottom: '1.1rem', padding: '0' }}>
						<MapContainer
							center={BULACAN_CENTER}
							zoom={11}
							style={{ height: '360px', width: '100%', borderRadius: '0.75rem' }}
							scrollWheelZoom={false}
						>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							<FlyTo position={flyTo} />
							{mappable.map((report) => (
								<Marker
									key={report.id}
									position={[report.latitude, report.longitude]}
									eventHandlers={{ click: () => handleMarkerClick(report) }}
								>
									<Popup>
										<strong>{report.hazard_type}</strong><br />
										{report.location}<br />
										<span style={{ color: STATUS_COLORS[report.status] || '#333', fontWeight: 600, textTransform: 'capitalize' }}>
											{report.status}
										</span><br />
										<small>{new Date(report.created_at).toLocaleDateString()}</small>
									</Popup>
								</Marker>
							))}
						</MapContainer>
					</div>
				)}

				{!loading && (
					<div className="table-shell card">
						<table>
							<thead>
								<tr>
									<th>Type</th>
									<th>Location</th>
									<th>Description</th>
									<th>Photo</th>
									<th>Date</th>
									<th>Status</th>
									<th>Action</th>
								</tr>
							</thead>
							<tbody>
								{reports.length === 0 ? (
									<tr><td colSpan="7" style={{ textAlign: 'center' }}>No reports found.</td></tr>
								) : (
									pageReports.map((report) => (
										<tr
											key={report.id}
											style={highlighted === report.id ? { background: 'var(--color-primary-soft, #eff6ff)' } : {}}
										>
											<td>{report.hazard_type}</td>
											<td>{report.location}</td>
											<td>{report.description}</td>
											<td>
												{report.photo_url ? (
													<button
														type="button"
														className="btn-inline"
														onClick={() => setPhotoUrl(report.photo_url)}
													>
														📷 View
													</button>
												) : <span style={{ opacity: 0.4 }}>—</span>}
											</td>
											<td><small>{new Date(report.created_at).toLocaleDateString()}</small></td>
											<td><span className={`status-pill ${report.status}`}>{report.status}</span></td>
											<td>
												<div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
													{report.latitude != null && report.longitude != null && (
														<button
															type="button"
															className="btn-inline"
															onClick={() => handleMarkerClick(report)}
														>
															Map
														</button>
													)}
													{report.status === 'pending' ? (
														<>
															<button
																type="button"
																className="btn-inline"
																onClick={() => setConfirmPending({ report, action: 'approved' })}
															>
																Approve
															</button>
															<button
																type="button"
																className="btn-inline danger"
																onClick={() => setConfirmPending({ report, action: 'rejected' })}
															>
																Reject
															</button>
														</>
													) : (
														<span style={{ opacity: 0.5 }}>—</span>
													)}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination */}
				{totalPages > 1 && (
					<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem', alignItems: 'center' }}>
						<button type="button" className="btn-inline" disabled={pageNum === 0} onClick={() => setPageNum((p) => p - 1)}>← Prev</button>
						<span style={{ fontSize: '0.85rem' }}>Page {pageNum + 1} / {totalPages}</span>
						<button type="button" className="btn-inline" disabled={pageNum >= totalPages - 1} onClick={() => setPageNum((p) => p + 1)}>Next →</button>
					</div>
				)}
			</div>
		</section>

		{/* Photo lightbox */}
		{photoUrl && <PhotoLightbox url={photoUrl} onClose={() => setPhotoUrl(null)} />}

		{/* Approve / Reject confirm */}
		{confirmPending && (
			<ConfirmStatusDialog
				report={confirmPending.report}
				action={confirmPending.action}
				onConfirm={async () => {
					await updateStatus(confirmPending.report.id, confirmPending.action);
					setConfirmPending(null);
				}}
				onCancel={() => setConfirmPending(null)}
			/>
		)}
		</>
	);
}

export default AdminReportsPage;
