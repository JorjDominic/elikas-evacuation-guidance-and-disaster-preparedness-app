import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../config/supabase';
import '../../styles/shared/sentinel.css';

import '../../utils/leafletIcons';

const BULACAN_CENTER = [14.7942, 120.8793];

const STATUS_COLORS = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };

function FlyTo({ position }) {
	const map = useMap();
	useEffect(() => { if (position) map.flyTo(position, 16, { duration: 0.8 }); }, [position, map]);
	return null;
}

function AdminReportsPage() {
	const [reports, setReports] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [flyTo, setFlyTo] = useState(null);
	const [highlighted, setHighlighted] = useState(null);

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

	const updateStatus = async (id, status) => {
		const { error: err } = await supabase
			.from('hazard_reports')
			.update({ status })
			.eq('id', id);
		if (err) { setError(err.message); return; }
		await fetchReports();
	};

	const handleMarkerClick = (report) => {
		setHighlighted(report.id);
		setFlyTo([report.latitude, report.longitude]);
	};

	const pendingCount = reports.filter((r) => r.status === 'pending').length;
	const mappable = reports.filter((r) => r.latitude != null && r.longitude != null);

	return (
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
									<th>Date</th>
									<th>Status</th>
									<th>Action</th>
								</tr>
							</thead>
							<tbody>
								{reports.length === 0 ? (
									<tr><td colSpan="6" style={{ textAlign: 'center' }}>No reports found.</td></tr>
								) : (
									reports.map((report) => (
										<tr
											key={report.id}
											style={highlighted === report.id ? { background: 'var(--color-primary-soft, #eff6ff)' } : {}}
										>
											<td>{report.hazard_type}</td>
											<td>{report.location}</td>
											<td>{report.description}</td>
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
																onClick={() => updateStatus(report.id, 'approved')}
															>
																Approve
															</button>
															<button
																type="button"
																className="btn-inline danger"
																onClick={() => updateStatus(report.id, 'rejected')}
															>
																Reject
															</button>
														</>
													) : (
														<span style={{ opacity: 0.5 }}>â€”</span>
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
			</div>
		</section>
	);
}

export default AdminReportsPage;
