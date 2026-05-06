import React, { useState, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCenters } from '../../hooks/useCenters';
import '../../utils/leafletIcons';
import '../../styles/shared/sentinel.css';

const BULACAN_CENTER = [14.7942, 120.8793];

// Haversine distance in meters between two lat/lon pairs
function haversineMeters(lat1, lon1, lat2, lon2) {
	const toRad = (d) => (d * Math.PI) / 180;
	const R = 6371000;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}
function fmtKm(m) {
	return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

const userPinIcon = L.divIcon({
	className: '',
	html: `<div style="width:16px;height:16px;border-radius:50%;background:#1a3a5f;border:3px solid #fff;box-shadow:0 0 0 3px rgba(26,58,95,0.45);"></div>`,
	iconSize: [16, 16],
	iconAnchor: [8, 8],
});

function FlyTo({ position }) {
	const map = useMap();
	useEffect(() => { if (position) map.flyTo(position, 15, { duration: 0.8 }); }, [position, map]);
	return null;
}

function CentersPage({ onSelectCenter }) {
	const { centers, loading, error } = useCenters();
	const [highlighted, setHighlighted] = useState(null);
	const [flyTo, setFlyTo] = useState(null);
	const cardRefs = useRef({});
	const [statusFilter, setStatusFilter] = useState('all');

	// "Near me" filter state
	const [nearMode, setNearMode] = useState(false);
	const [userCoords, setUserCoords] = useState(null);
	const [gpsStatus, setGpsStatus] = useState('idle'); // idle | locating | error
	const [gpsError, setGpsError] = useState('');

	const occupancyPercent = (center) => {
		if (!center.capacity) return 0;
		return Math.min(100, Math.round(((center.current_occupancy || 0) / center.capacity) * 100));
	};

	const handleMarkerClick = (center) => {
		setHighlighted(center.id);
		if (center.latitude && center.longitude) setFlyTo([center.latitude, center.longitude]);
		setTimeout(() => {
			cardRefs.current[center.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}, 400);
	};

	const handleNearMe = () => {
		if (nearMode) {
			// toggle off
			setNearMode(false);
			return;
		}
		if (userCoords) {
			setNearMode(true);
			return;
		}
		setGpsStatus('locating');
		setGpsError('');
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
				setNearMode(true);
				setGpsStatus('idle');
				setFlyTo([pos.coords.latitude, pos.coords.longitude]);
			},
			(err) => {
				const msg =
					err.code === 1 ? 'Location access denied. Allow GPS in your browser.' :
					err.code === 2 ? 'GPS signal unavailable.' :
					'Location request timed out.';
				setGpsError(msg);
				setGpsStatus('error');
				setTimeout(() => setGpsStatus('idle'), 4000);
			},
			{ enableHighAccuracy: true, timeout: 14000 }
		);
	};

	// "Near me" tunables
	const NEAR_RADIUS_M = 10000;   // 10 km — anything within this counts as "nearby"
	const NEAR_MIN_RESULTS = 5;    // ensure at least this many even if all are >10km

	// Centers list — annotated with distance; filtered by status and nearMode
	const displayedCenters = useMemo(() => {
		let list = statusFilter === 'all'
			? centers
			: centers.filter((c) => (c.status || '').toLowerCase() === statusFilter);

		if (!userCoords) return list;
		const annotated = list.map((c) => {
			if (c.latitude == null || c.longitude == null) return { ...c, _distance: null };
			return { ...c, _distance: haversineMeters(userCoords.lat, userCoords.lon, c.latitude, c.longitude) };
		});
		if (!nearMode) return annotated;

		const sorted = [...annotated]
			.filter((c) => c._distance != null)
			.sort((a, b) => a._distance - b._distance);

		const withinRadius = sorted.filter((c) => c._distance <= NEAR_RADIUS_M);
		return withinRadius.length >= NEAR_MIN_RESULTS
			? withinRadius
			: sorted.slice(0, NEAR_MIN_RESULTS);
	}, [centers, userCoords, nearMode, statusFilter]);

	const mappable = displayedCenters.filter((c) => c.latitude != null && c.longitude != null);

	const nearBtnLabel =
		gpsStatus === 'locating' ? 'Getting GPS…' :
		nearMode ? '✕ Show All Centers' : '📍 Near Me';

	const nearbySummary = nearMode && userCoords
		? (() => {
			const within = displayedCenters.filter((c) => c._distance != null && c._distance <= NEAR_RADIUS_M).length;
			if (within > 0) return `Showing ${displayedCenters.length} center(s) within ${NEAR_RADIUS_M / 1000} km of you`;
			return `No centers within ${NEAR_RADIUS_M / 1000} km — showing the ${displayedCenters.length} nearest instead`;
		})()
		: `${centers.length} center(s) listed`;

	return (
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>Evacuation Centers</h1>
					<p>Compare shelter readiness, occupancy pressure, and essential services before you travel.</p>
					<div className="hero-meta">
						<span className="hero-pill">Live Capacity Feed</span>
						<span className="hero-pill">Map-Verified Locations</span>
					</div>
				</div>

				{loading && <p>Loading centers…</p>}
				{error && <p style={{ color: 'var(--sent-danger)' }}>{error}</p>}

				{!loading && !error && centers.length === 0 && (
					<p>No evacuation centers found.</p>
				)}

				{!loading && centers.length > 0 && (
					<>
						{/* ── Filter bar ── */}
						<div className="app-page-head" style={{ marginBottom: '0.85rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
							<div style={{ fontSize: '0.88rem', color: 'var(--sent-text-muted)' }}>
								{nearbySummary}
							</div>
							<div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
								{['all', 'open', 'full', 'closed'].map((s) => (
									<button
										key={s}
										type="button"
										className={`btn-inline ${statusFilter === s ? 'primary' : ''}`}
										onClick={() => setStatusFilter(s)}
										style={{ textTransform: 'capitalize' }}
									>
										{s === 'all' ? 'All' : s}
									</button>
								))}
							</div>
							<button
								type="button"
								className={`btn-inline ${nearMode ? '' : 'primary'}`}
								onClick={handleNearMe}
								disabled={gpsStatus === 'locating'}
							>
								{nearBtnLabel}
							</button>
						</div>

						{gpsStatus === 'error' && (
							<div className="info-strip danger" style={{ marginBottom: '0.85rem' }}>
								<strong>GPS error:</strong> {gpsError}
							</div>
						)}

						{mappable.length > 0 && (
							<div className="card" style={{ marginBottom: '1.1rem', padding: '0' }}>
								<MapContainer
									center={BULACAN_CENTER}
									zoom={11}
									style={{ height: '340px', width: '100%', borderRadius: '8px' }}
									scrollWheelZoom={false}
								>
									<TileLayer
										attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
										url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
									/>
									<FlyTo position={flyTo} />
									{userCoords && (
										<Marker position={[userCoords.lat, userCoords.lon]} icon={userPinIcon}>
											<Popup><strong>Your location</strong></Popup>
										</Marker>
									)}
									{mappable.map((center) => (
										<Marker
											key={center.id}
											position={[center.latitude, center.longitude]}
											eventHandlers={{ click: () => handleMarkerClick(center) }}
										>
											<Popup>
												<strong>{center.name}</strong><br />
												{center.municipality}{center.barangay ? `, ${center.barangay}` : ''}<br />
												<span style={{ textTransform: 'capitalize' }}>{center.status}</span>
												{' · '}{center.current_occupancy ?? 0} / {center.capacity}
												{center._distance != null && (
													<><br /><strong>{fmtKm(center._distance)}</strong> from you</>
												)}
											</Popup>
										</Marker>
									))}
								</MapContainer>
							</div>
						)}

						<h2 className="section-title">
							{nearMode ? 'Nearest Shelters' : 'Available Shelters'}
						</h2>
						{nearMode && displayedCenters.length === 0 ? (
							<p style={{ color: 'var(--sent-text-muted)' }}>
								No evacuation centers have map coordinates yet — unable to compute proximity.
							</p>
						) : (
							<div className="soft-grid">
								{displayedCenters.map((center) => {
									const pct = occupancyPercent(center);
									return (
										<div
											key={center.id}
											className="soft-card"
											ref={(el) => { cardRefs.current[center.id] = el; }}
											style={highlighted === center.id ? { outline: '2px solid var(--sent-primary)', outlineOffset: '2px' } : {}}
										>
											<div className="app-page-head" style={{ marginBottom: '0.4rem', alignItems: 'center' }}>
												<h3>{center.name}</h3>
												<span className={`status-pill ${center.status}`}>{center.status}</span>
											</div>
											<p>{center.municipality}{center.barangay ? `, ${center.barangay}` : ''}</p>
											{center._distance != null && (
												<p style={{ color: 'var(--sent-primary)', fontWeight: 600, margin: '0.15rem 0 0.35rem' }}>
													📍 {fmtKm(center._distance)} away
												</p>
											)}
											<p><strong>Capacity:</strong> {center.current_occupancy ?? 0} / {center.capacity}</p>
											<div className="progress-wrap">
												<div style={{ width: `${pct}%` }}></div>
											</div>
											<small>{pct}% occupied now</small>
											{center.facilities?.length > 0 && (
												<div className="tag-cluster">
													{center.facilities.slice(0, 3).map((f) => (
														<span key={f} className="ghost-tag">{f}</span>
													))}
												</div>
											)}
											<div className="action-row" style={{ marginTop: '0.6rem' }}>
												{center.latitude && center.longitude && (
													<button
														type="button"
														className="btn-inline"
														onClick={() => handleMarkerClick(center)}
													>
														Show on Map
													</button>
												)}
												<button
													type="button"
													className="btn-inline primary"
													onClick={() => onSelectCenter(center.id)}
												>
													Open Details
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>
		</section>
	);
}

export default CentersPage;

