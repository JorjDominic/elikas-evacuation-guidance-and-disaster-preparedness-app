import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../config/supabase';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminCentersPage.css';

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
	const labels = { idle: 'Use GPS', locating: 'Locatingâ€¦', found: 'Located', error: 'GPS Denied' };
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
							Location (optional) â€” tap map or enter coordinates
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
								Pinned: {Number(form.latitude).toFixed(5)}Â°N, {Number(form.longitude).toFixed(5)}Â°E
								<button
									type="button"
									className="ac-clear-pin"
									onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
								>
									âœ• Clear pin
								</button>
							</p>
						)}
					</fieldset>

					<div className="ac-modal-actions">
						<button type="button" className="btn-inline" onClick={onClose} disabled={saving}>Cancel</button>
						<button type="submit" className="btn-inline primary" disabled={saving}>
							{saving ? 'Savingâ€¦' : 'Save Alert'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function AdminAlertsPage() {
	const [alerts, setAlerts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [modal, setModal] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [deleting, setDeleting] = useState(false);
	const [flyTo, setFlyTo] = useState(null);

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
			const { error: err } = await supabase.from('alerts').insert([form]);
			if (err) return { error: err.message };
		} else {
			const { error: err } = await supabase.from('alerts').update(form).eq('id', modal.alert.id);
			if (err) return { error: err.message };
		}
		await fetchAlerts();
		return {};
	};

	const handleDelete = async () => {
		setDeleting(true);
		const { error: err } = await supabase.from('alerts').delete().eq('id', deleteTarget.id);
		if (err) setError(err.message);
		else await fetchAlerts();
		setDeleting(false);
		setDeleteTarget(null);
	};

	const mappable = alerts.filter((a) => a.latitude != null && a.longitude != null);

	return (
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>Manage Alerts</h1>
					<p>Create targeted warnings, tune severity levels, and publish verified updates to residents and responders.</p>
					<div className="hero-meta">
						<span className="hero-pill">Broadcast Console</span>
						<span className="hero-pill">Multi-Channel Delivery</span>
					</div>
				</div>

				<div className="app-page-head">
					<span className="page-chip">Advisory Management</span>
					<button type="button" className="btn-inline primary" onClick={() => setModal({ mode: 'add' })}>+ Create Alert</button>
				</div>

				{error && <p style={{ color: 'var(--color-danger, red)', marginBottom: '0.75rem' }}>{error}</p>}
				{loading && <p>Loading alertsâ€¦</p>}

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
					<div className="soft-grid">
						{alerts.length === 0 ? (
							<p>No alerts found. Create one above.</p>
						) : (
							alerts.map((alert) => (
								<div key={alert.id} className="soft-card">
									<h3>{alert.title}</h3>
									<p><strong>Severity:</strong> <span className={`status-pill ${alert.level}`}>{alert.level}</span></p>
									<p><strong>Area:</strong> {alert.area}</p>
									{alert.description && <p>{alert.description}</p>}
									{alert.latitude != null && alert.longitude != null && (
										<div style={{ marginTop: '0.5rem', borderRadius: '0.5rem', overflow: 'hidden', height: '160px' }}>
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
									<div className="action-row" style={{ marginTop: '0.6rem' }}>
										{alert.latitude != null && alert.longitude != null && (
											<button
												type="button"
												className="btn-inline"
												onClick={() => setFlyTo([alert.latitude, alert.longitude])}
											>
												Show on Map
											</button>
										)}
										<button type="button" className="btn-inline" onClick={() => setModal({ mode: 'edit', alert: { ...alert, latitude: alert.latitude ?? '', longitude: alert.longitude ?? '' } })}>Edit</button>
										<button type="button" className="btn-inline danger" onClick={() => setDeleteTarget(alert)}>Delete</button>
									</div>
								</div>
							))
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
									{deleting ? 'Deletingâ€¦' : 'Delete'}
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
