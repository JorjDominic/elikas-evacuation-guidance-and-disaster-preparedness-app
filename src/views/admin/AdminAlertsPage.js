import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../config/supabase';
import { writeAuditLog } from '../../services/adminService';
import { fireNotification } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminCentersPage.css';
import '../../styles/admin/AdminAlertsPage.css';

import '../../utils/leafletIcons';

const BULACAN_CENTER = [14.7942, 120.8793];

function ClickToPin({ onPin }) {
	useMapEvents({ click: (e) => onPin(e.latlng.lat, e.latlng.lng) });
	return null;
}

function GpsLocator({ onPin }) {
	const map = useMap();
	const [status, setStatus] = useState('idle');
	const handleGps = () => {
		if (status === 'locating') return;
		setStatus('locating');
		map.locate({ setView: true, maxZoom: 16 });
		map.once('locationfound', (e) => { onPin(e.latlng.lat, e.latlng.lng); setStatus('found'); });
		map.once('locationerror', () => { setStatus('error'); setTimeout(() => setStatus('idle'), 3000); });
	};
	const labels = { idle: 'Use GPS', locating: 'Locating…', found: 'Located', error: 'GPS Denied' };
	return (
		<div className="leaflet-top leaflet-right" style={{ pointerEvents: 'none' }}>
			<div className="leaflet-control" style={{ pointerEvents: 'auto', marginTop: '0.5rem', marginRight: '0.5rem' }}>
				<button type="button" className="ac-gps-btn" onClick={handleGps}>{labels[status]}</button>
			</div>
		</div>
	);
}

function FlyTo({ position }) {
	const map = useMap();
	useEffect(() => { if (position) map.flyTo(position, 14, { duration: 0.8 }); }, [position, map]);
	return null;
}

const EMPTY_ALERT = { title: '', level: 'medium', area: '', description: '', latitude: '', longitude: '' };

function AlertModal({ initial, onSave, onClose }) {
	const [form, setForm] = useState(initial || EMPTY_ALERT);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

	const handlePin = (lat, lng) => {
		setForm((f) => ({ ...f, latitude: String(lat.toFixed(6)), longitude: String(lng.toFixed(6)) }));
	};

	const pinPos =
		form.latitude !== '' && form.longitude !== '' &&
		!isNaN(Number(form.latitude)) && !isNaN(Number(form.longitude))
			? [Number(form.latitude), Number(form.longitude)]
			: null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		if (!form.title.trim() || !form.area.trim()) {
			setError('Title and area are required.');
			return;
		}
		setSaving(true);
		const payload = {
			...form,
			latitude:  form.latitude  !== '' ? Number(form.latitude)  : null,
			longitude: form.longitude !== '' ? Number(form.longitude) : null,
		};
		const result = await onSave(payload);
		setSaving(false);
		if (result?.error) { setError(result.error); } else { onClose(); }
	};

	return (
		<div className="ac-modal-overlay" role="dialog" aria-modal="true">
			<div className="ac-modal">
				<div className="ac-modal-head">
					<h2>{initial ? 'Edit Alert' : 'Create Alert'}</h2>
					<button type="button" className="ac-modal-close" onClick={onClose} aria-label="Close">&times;</button>
				</div>
				{error && <div className="ac-modal-error">{error}</div>}
				<form onSubmit={handleSubmit} className="ac-modal-form">
					<label>Title *
						<input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} required />
					</label>
					<label>Severity
						<select value={form.level} onChange={(e) => set('level', e.target.value)}>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>
					</label>
					<label>Affected Area *
						<input type="text" value={form.area} onChange={(e) => set('area', e.target.value)} required />
					</label>
					<label>Description
						<textarea rows="3" value={form.description} onChange={(e) => set('description', e.target.value)} />
					</label>

					<fieldset style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: '0.5rem', padding: '0.75rem 1rem 1rem', marginTop: '0.5rem' }}>
						<legend style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.4rem', color: 'var(--text-muted, #666)' }}>
							Location (optional) — tap map or enter coordinates
						</legend>
						<div className="ac-field-row">
							<label>Latitude
								<input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 14.8527" />
							</label>
							<label>Longitude
								<input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. 120.8164" />
							</label>
						</div>
						<p className="ac-map-hint">Pin the affected area on the map to help residents locate the hazard zone.</p>
						<MapContainer
							key={initial?.id || 'new-alert'}
							center={pinPos || BULACAN_CENTER}
							zoom={pinPos ? 14 : 11}
							className="ac-map"
							scrollWheelZoom
						>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							<ClickToPin onPin={handlePin} />
							<GpsLocator onPin={handlePin} />
							{pinPos && <Marker position={pinPos} />}
						</MapContainer>
						{pinPos && (
							<p className="ac-coords-hint">
								Pinned: {Number(form.latitude).toFixed(5)}°N, {Number(form.longitude).toFixed(5)}°E
								<button
									type="button"
									className="ac-clear-pin"
									onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
								>
									✕ Clear pin
								</button>
							</p>
						)}
					</fieldset>

					<div className="ac-modal-actions">
						<button type="button" className="btn-inline" onClick={onClose} disabled={saving}>Cancel</button>
						<button type="submit" className="btn-inline primary" disabled={saving}>
							{saving ? 'Saving…' : 'Save Alert'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function AdminAlertsPage() {
	const { currentUser } = useAuth();
	const [alerts, setAlerts] = useState([]);;
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [modal, setModal] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [deleting, setDeleting] = useState(false);
	const [flyTo, setFlyTo] = useState(null);
	const [search, setSearch] = useState('');
	const [levelFilter, setLevelFilter] = useState('all');

	const fetchAlerts = useCallback(async () => {
		setLoading(true);
		const { data, error: err } = await supabase
			.from('alerts')
			.select('*')
			.order('created_at', { ascending: false });
		if (err) setError(err.message);
		else setAlerts(data || []);
		setLoading(false);
	}, []);

	useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

	const handleSave = async (form) => {
		if (modal?.mode === 'add') {
			const { data, error: err } = await supabase.from('alerts').insert([form]).select().single();
			if (err) return { error: err.message };
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'alert.create', targetType: 'alert', targetId: data?.id, meta: { title: form.title } });
			fireNotification('Alert Created', `"${form.title}" has been published.`, form.level || 'info');
		} else {
			const { error: err } = await supabase.from('alerts').update(form).eq('id', modal.alert.id);
			if (err) return { error: err.message };
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'alert.update', targetType: 'alert', targetId: modal.alert.id, meta: { title: form.title } });
			fireNotification('Alert Updated', `"${form.title}" has been updated.`, 'info');
		}
		await fetchAlerts();
		return {};
	};

	const handleDelete = async () => {
		setDeleting(true);
		const { error: err } = await supabase.from('alerts').delete().eq('id', deleteTarget.id);
		if (err) setError(err.message);
		else {
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'alert.delete', targetType: 'alert', targetId: deleteTarget.id, meta: { title: deleteTarget.title } });
			fireNotification('Alert Deleted', `"${deleteTarget.title}" has been removed.`, 'info');
			await fetchAlerts();
		}
		setDeleting(false);
		setDeleteTarget(null);
	};

	const filteredAlerts = alerts.filter((a) => {
		const matchLevel = levelFilter === 'all' || a.level === levelFilter;
		const matchSearch = !search ||
			(a.title || '').toLowerCase().includes(search.toLowerCase()) ||
			(a.area  || '').toLowerCase().includes(search.toLowerCase());
		return matchLevel && matchSearch;
	});

	const mappable = filteredAlerts.filter((a) => a.latitude != null && a.longitude != null);

	// Severity icon and color
	const severityMeta = {
		high:   { icon: '🚨', color: 'var(--sent-danger)', chip: 'var(--sent-danger-bg)' },
		medium: { icon: '⚠️', color: 'var(--sent-warn)', chip: 'var(--sent-warn-bg)' },
		low:    { icon: 'ℹ️', color: 'var(--sent-ok)', chip: 'var(--sent-ok-bg)' },
		all:    { icon: '📢', color: 'var(--sent-primary)', chip: 'var(--sent-primary-soft)' },
	};

	return (
		<section className="app-page admin-alerts-page">
			<div className="app-shell admin-page-wrap">
				<div className="page-hero">
					<h1>Manage Alerts</h1>
					<p>Create targeted warnings, tune severity levels, and publish verified updates to residents and responders.</p>
					<div className="hero-meta">
						<span className="hero-pill">Broadcast Console</span>
						<span className="hero-pill">Multi-Channel Delivery</span>
					</div>
				</div>

				<div className="admin-head">
					<span className="page-chip">Advisory Management</span>
					<button type="button" className="btn-inline primary" onClick={() => setModal({ mode: 'add' })}>+ Create Alert</button>
				</div>

				{/* Search & filter bar */}
				<div className="alerts-filter-bar">
					<input
						type="search"
						placeholder="Search by title or area…"
						value={search}
						className="alerts-search-input"
						onChange={(e) => setSearch(e.target.value)}
						aria-label="Search alerts"
					/>
					{['all', 'high', 'medium', 'low'].map((lvl) => (
						<button
							key={lvl}
							type="button"
							className={`level-filter-btn ${levelFilter === lvl ? `active-${lvl}` : ''}`}
							onClick={() => setLevelFilter(lvl)}
						>
							{severityMeta[lvl].icon} {lvl === 'all' ? 'All' : lvl}
						</button>
					))}
				</div>

				{error && <p style={{ color: 'var(--color-danger, red)', marginBottom: '0.75rem' }}>{error}</p>}
				{loading && <p>Loading alerts…</p>}

				{!loading && mappable.length > 0 && (
					<div className="card" style={{ marginBottom: '1.1rem', padding: '0' }}>
						<MapContainer
							center={BULACAN_CENTER}
							zoom={11}
							style={{ height: '320px', width: '100%', borderRadius: '0.75rem' }}
							scrollWheelZoom={false}
						>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							<FlyTo position={flyTo} />
							{mappable.map((alert) => (
								<Marker key={alert.id} position={[alert.latitude, alert.longitude]}>
									<Popup>
										<strong>{alert.title}</strong><br />
										{alert.area}<br />
										<span className={`status-pill ${alert.level}`} style={{ fontSize: '0.7rem' }}>{alert.level}</span>
									</Popup>
								</Marker>
							))}
						</MapContainer>
					</div>
				)}

				{!loading && (
					<div className="admin-alert-grid">
						{filteredAlerts.length === 0 ? (
							<div style={{textAlign:'center',padding:'2.5rem 0',color:'var(--sent-text-muted)'}}>
								<span style={{fontSize:'2.5rem',display:'block',marginBottom:'0.5rem'}}>🔔</span>
								<p style={{fontSize:'1.1rem'}}>{alerts.length === 0 ? 'No alerts found. Create one above.' : 'No alerts match your filters.'}</p>
							</div>
						) : (
							filteredAlerts.map((alert) => {
								const sev = severityMeta[alert.level] || severityMeta.medium;
								const highlight = alert.level === 'high';
								return (
									<div key={alert.id} className={`admin-alert-card ${alert.level}`}>
										<div className="aac-header">
											<span className="aac-level-badge">{sev.icon} {alert.level}</span>
										</div>
										<div className="aac-body">
											<h3 className="aac-title">{alert.title}</h3>
											<div className="aac-meta">📍 {alert.area}</div>
											{alert.description && <p className="aac-desc">{alert.description}</p>}
											{alert.latitude != null && alert.longitude != null && (
												<div className="aac-map">
													<MapContainer
														center={[alert.latitude, alert.longitude]}
														zoom={13}
														style={{ height: '100%', width: '100%' }}
														scrollWheelZoom={false}
														zoomControl={false}
														dragging={false}
														attributionControl={false}
													>
														<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
														<Marker position={[alert.latitude, alert.longitude]} />
													</MapContainer>
												</div>
											)}
										</div>
										<div className="aac-footer">
											<button type="button" className="btn-inline" title="Edit" onClick={() => setModal({ mode: 'edit', alert })} style={{display:'flex',alignItems:'center',gap:4}}>
												<span style={{fontSize:'1.1rem'}}>✏️</span> Edit
											</button>
											<button type="button" className="btn-inline danger" title="Delete" onClick={() => setDeleteTarget(alert)} style={{display:'flex',alignItems:'center',gap:4}}>
												<span style={{fontSize:'1.1rem'}}>🗑️</span> Delete
											</button>
											{alert.latitude != null && alert.longitude != null && (
												<button type="button" className="btn-inline" style={{color:'var(--sent-primary)'}} onClick={()=>setFlyTo([alert.latitude,alert.longitude])}>
													<span style={{fontSize:'1.1rem'}}>🗺️</span> View on Map
												</button>
											)}
										</div>
									</div>
								);
							})
						)}
					</div>
				)}

				{modal && (
					<AlertModal
						initial={modal.mode === 'edit' ? modal.alert : null}
						onSave={handleSave}
						onClose={() => setModal(null)}
					/>
				)}

				{deleteTarget && (
					<div className="ac-modal-overlay" role="dialog" aria-modal="true">
						<div className="ac-modal">
							<div className="ac-modal-head">
								<h2>Delete Alert</h2>
								<button type="button" className="ac-modal-close" onClick={() => setDeleteTarget(null)} aria-label="Close">&times;</button>
							</div>
							<p>Are you sure you want to delete <strong>{deleteTarget.title}</strong>?</p>
							<div className="ac-modal-actions">
								<button type="button" className="btn-inline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
								<button type="button" className="btn-inline danger" onClick={handleDelete} disabled={deleting}>
									{deleting ? 'Deleting…' : 'Delete'}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

export default AdminAlertsPage;
