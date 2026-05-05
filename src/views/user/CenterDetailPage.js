import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../config/supabase';
import '../../styles/shared/sentinel.css';

import '../../utils/leafletIcons';

const userPinIcon = L.divIcon({
	className: '',
	html: `<div style="width:16px;height:16px;border-radius:50%;background:#1a3a5f;border:3px solid #fff;box-shadow:0 0 0 3px rgba(26,58,95,0.45);"></div>`,
	iconSize: [16, 16],
	iconAnchor: [8, 8],
});

const hazardIcon = L.divIcon({
	className: '',
	html: `<div style="width:22px;height:22px;border-radius:50%;background:#c41919;border:3px solid #fff;box-shadow:0 0 0 4px rgba(196,25,25,0.30);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">!</div>`,
	iconSize: [22, 22],
	iconAnchor: [11, 11],
});

// ── Geometry helpers ────────────────────────────────────────────
// Approximate minimum distance from a point to a polyline (in meters).
// Uses planar projection — accurate enough at ≤50km extents.
function distancePointToPolyline(lat, lon, points) {
	if (!points || points.length === 0) return Infinity;
	const mPerDegLat = 111320;
	const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
	const px = lon * mPerDegLon;
	const py = lat * mPerDegLat;
	let best = Infinity;
	for (let i = 0; i < points.length - 1; i++) {
		const [aLat, aLon] = points[i];
		const [bLat, bLon] = points[i + 1];
		const ax = aLon * mPerDegLon, ay = aLat * mPerDegLat;
		const bx = bLon * mPerDegLon, by = bLat * mPerDegLat;
		const dx = bx - ax, dy = by - ay;
		const len2 = dx * dx + dy * dy;
		let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
		t = Math.max(0, Math.min(1, t));
		const cx = ax + t * dx, cy = ay + t * dy;
		const d = Math.hypot(px - cx, py - cy);
		if (d < best) best = d;
	}
	return best;
}

function FitBounds({ points }) {
	const map = useMap();
	useEffect(() => {
		if (points && points.length > 1) {
			map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
		}
	}, [points, map]);
	return null;
}

function fmtDist(m) {
	return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function fmtDur(s) {
	if (s < 60) return `${Math.round(s)} sec`;
	if (s < 3600) return `${Math.round(s / 60)} min`;
	const h = Math.floor(s / 3600);
	const m = Math.round((s % 3600) / 60);
	return `${h} h ${m} min`;
}

// Reports within this many metres of the route polyline are flagged
const HAZARD_PROXIMITY_METERS = 600;
// Statuses we consider "resolved" — anything else is treated as still relevant
const HAZARD_HIDDEN_STATUSES = ['resolved', 'dismissed', 'rejected', 'closed', 'archived'];

function CenterDetailPage({ centerId, onBack }) {
	const [center, setCenter] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	// routing state
	const [routeStatus, setRouteStatus] = useState('idle'); // idle | locating | routing | done | error
	const [routeError, setRouteError] = useState('');
	const [userCoords, setUserCoords] = useState(null);
	const [routePoints, setRoutePoints] = useState(null);
	const [routeInfo, setRouteInfo] = useState(null);

	// hazards along the route
	const [hazardsOnRoute, setHazardsOnRoute] = useState([]);

	useEffect(() => {
		if (!centerId) {
			setError('No center selected.');
			setLoading(false);
			return;
		}

		async function fetchCenter() {
			const { data, error: err } = await supabase
				.from('evacuation_centers')
				.select('*')
				.eq('id', centerId)
				.single();
			if (err) setError(err.message);
			else setCenter(data);
			setLoading(false);
		}

		fetchCenter();
	}, [centerId]);

	async function fetchHazardsAlongRoute(points) {
		try {
			// Pull recent hazard reports that have coordinates. We do NOT filter on status
			// server-side — admin workflows may use varying values (null, 'new', 'reported',
			// 'verified', etc.) and we'd rather show too many than miss a real hazard.
			const { data, error: err } = await supabase
				.from('hazard_reports')
				.select('id, hazard_type, location, description, latitude, longitude, status, created_at')
				.not('latitude', 'is', null)
				.not('longitude', 'is', null)
				.order('created_at', { ascending: false })
				.limit(500);
			if (err) {
				console.warn('[hazards] query error:', err.message);
				setHazardsOnRoute([]);
				return;
			}
			if (!data || data.length === 0) {
				console.info('[hazards] no rows returned from hazard_reports');
				setHazardsOnRoute([]);
				return;
			}
			const withDist = data
				.filter((h) => !HAZARD_HIDDEN_STATUSES.includes((h.status || '').toLowerCase()))
				.map((h) => ({
					...h,
					_dist: distancePointToPolyline(Number(h.latitude), Number(h.longitude), points),
				}));
			const flagged = withDist
				.filter((h) => h._dist <= HAZARD_PROXIMITY_METERS)
				.sort((a, b) => a._dist - b._dist);
			console.info(`[hazards] ${data.length} fetched, ${flagged.length} within ${HAZARD_PROXIMITY_METERS}m of route`);
			setHazardsOnRoute(flagged);
		} catch (e) {
			console.warn('[hazards] unexpected error:', e);
			setHazardsOnRoute([]);
		}
	}

	async function handleGetRoute() {
		if (!center?.latitude || !center?.longitude) return;
		setRouteStatus('locating');
		setRouteError('');
		setRoutePoints(null);
		setRouteInfo(null);
		setHazardsOnRoute([]);

		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const uLat = pos.coords.latitude;
				const uLon = pos.coords.longitude;
				setUserCoords({ lat: uLat, lon: uLon });
				setRouteStatus('routing');
				try {
					const url =
						`https://router.project-osrm.org/route/v1/driving/` +
						`${uLon},${uLat};${center.longitude},${center.latitude}` +
						`?overview=full&geometries=geojson`;
					const res = await fetch(url);
					if (!res.ok) throw new Error('Routing service unavailable.');
					const json = await res.json();
					if (!json.routes?.length) throw new Error('No route found between these points.');
					const route = json.routes[0];
					// OSRM returns [lon, lat]; Leaflet needs [lat, lon]
					const points = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
					setRoutePoints(points);
					setRouteInfo({
						distance: route.legs[0].distance,
						duration: route.legs[0].duration,
					});
					setRouteStatus('done');
					// fire-and-forget: tag hazard reports along the route
					fetchHazardsAlongRoute(points);
				} catch (e) {
					setRouteError(e.message);
					setRouteStatus('error');
				}
			},
			(geoErr) => {
				const msg =
					geoErr.code === 1 ? 'Location access denied. Allow GPS in your browser settings.' :
					geoErr.code === 2 ? 'GPS signal unavailable. Try again outdoors.' :
					'Location request timed out.';
				setRouteError(msg);
				setRouteStatus('error');
			},
			{ enableHighAccuracy: true, timeout: 14000 }
		);
	}

	if (loading) {
		return (
			<section className="app-page">
				<div className="app-shell"><p>Loading center details…</p></div>
			</section>
		);
	}

	if (error || !center) {
		return (
			<section className="app-page">
				<div className="app-shell">
					<p style={{ color: 'var(--sent-danger)', marginBottom: '1rem' }}>{error || 'Center not found.'}</p>
					<button type="button" className="btn-inline" onClick={onBack}>← Back to Centers</button>
				</div>
			</section>
		);
	}

	const hasCoords = center.latitude != null && center.longitude != null;

	const routeBtnLabel =
		routeStatus === 'locating' ? 'Getting GPS…' :
		routeStatus === 'routing'  ? 'Calculating route…' :
		routeStatus === 'done'     ? '↺ Recalculate' :
		'Get Directions →';

	return (
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>{center.name}</h1>
					<p>Facility profile for evacuation planning, family relocation, and resource coordination.</p>
					<div className="hero-meta">
						<span className="hero-pill">Status: {center.status}</span>
						<span className="hero-pill">Capacity: {center.current_occupancy ?? 0} / {center.capacity}</span>
					</div>
				</div>

				<div className="app-page-head">
					<button type="button" className="btn-inline" onClick={onBack}>← Back to Centers</button>
				</div>

				<h2 className="section-title">Center Operations</h2>
				<div className="panel-grid">
					<div className="card" style={{ gridColumn: 'span 6' }}>
						<h3>Center Information</h3>
						<div className="kv-list">
							<div className="kv-row">
								<span>Location</span>
								<strong>{center.municipality}{center.barangay ? `, ${center.barangay}` : ''}</strong>
							</div>
							{center.address && (
								<div className="kv-row">
									<span>Address</span>
									<strong>{center.address}</strong>
								</div>
							)}
							<div className="kv-row">
								<span>Current Occupancy</span>
								<strong>{center.current_occupancy ?? 0} / {center.capacity}</strong>
							</div>
							{center.contact_person && (
								<div className="kv-row">
									<span>Contact Person</span>
									<strong>{center.contact_person}</strong>
								</div>
							)}
							{center.contact_number && (
								<div className="kv-row">
									<span>Contact Number</span>
									<strong>{center.contact_number}</strong>
								</div>
							)}
							{hasCoords && (
								<div className="kv-row">
									<span>Coordinates</span>
									<strong>{Number(center.latitude).toFixed(5)}°N, {Number(center.longitude).toFixed(5)}°E</strong>
								</div>
							)}
						</div>
					</div>

					<div className="card" style={{ gridColumn: 'span 6' }}>
						<h3>Facilities</h3>
						{center.facilities?.length > 0 ? (
							<ul className="item-list">
								{center.facilities.map((facility) => (
									<li key={facility}>{facility}</li>
								))}
							</ul>
						) : (
							<p>No facilities listed.</p>
						)}
					</div>
				</div>

				{hasCoords && (
					<div className="card" style={{ marginTop: '0.9rem' }}>
						{/* ── Map header ── */}
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
							<h3 style={{ margin: 0 }}>Location &amp; Route</h3>
							<button
								type="button"
								className="btn-inline primary"
								onClick={handleGetRoute}
								disabled={routeStatus === 'locating' || routeStatus === 'routing'}
							>
								{routeBtnLabel}
							</button>
						</div>

						{/* ── Route summary strip ── */}
						{routeStatus === 'done' && routeInfo && (
							<div className="info-strip" style={{ marginBottom: '0.75rem' }}>
								<strong style={{ color: 'var(--sent-primary)' }}>Route:</strong>
								<span>
									&nbsp;{fmtDist(routeInfo.distance)} by road
									&nbsp;·&nbsp;
									approx. {fmtDur(routeInfo.duration)} driving
									&nbsp;·&nbsp;
									<span style={{ opacity: 0.7, fontSize: '0.82em' }}>blue dot = your location</span>
								</span>
							</div>
						)}

						{/* ── Hazards along route strip ── */}
						{routeStatus === 'done' && hazardsOnRoute.length > 0 && (
							<div className="info-strip danger" style={{ marginBottom: '0.75rem', flexDirection: 'column', alignItems: 'stretch' }}>
								<div style={{ marginBottom: '0.35rem' }}>
									<strong>⚠ {hazardsOnRoute.length} hazard report{hazardsOnRoute.length > 1 ? 's' : ''} along this route</strong>
									<span style={{ opacity: 0.75, marginLeft: '0.4rem' }}>(within {HAZARD_PROXIMITY_METERS}m)</span>
								</div>
								<ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', lineHeight: 1.55 }}>
									{hazardsOnRoute.slice(0, 5).map((h) => (
										<li key={h.id}>
											<strong>{h.hazard_type}</strong>
											{h.location ? ` — ${h.location}` : ''}
											{' '}
											<span style={{ opacity: 0.65 }}>({fmtDist(h._dist)} from route)</span>
										</li>
									))}
								</ul>
							</div>
						)}
						{routeStatus === 'done' && hazardsOnRoute.length === 0 && (
							<div className="info-strip ok" style={{ marginBottom: '0.75rem' }}>
								<strong>✓ Clear route:</strong>
								<span>&nbsp;No active hazard reports tagged within {HAZARD_PROXIMITY_METERS}m of this path.</span>
							</div>
						)}

						{/* ── Error strip ── */}
						{routeStatus === 'error' && (
							<div className="info-strip danger" style={{ marginBottom: '0.75rem' }}>
								<strong>Error:</strong> {routeError}
							</div>
						)}

						{/* ── Map ── */}
						<MapContainer
							center={[center.latitude, center.longitude]}
							zoom={15}
							style={{ height: '380px', width: '100%', borderRadius: '8px' }}
							scrollWheelZoom={false}
						>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							{/* Evac center pin */}
							<Marker position={[center.latitude, center.longitude]} />

							{/* User GPS pin */}
							{userCoords && (
								<Marker
									position={[userCoords.lat, userCoords.lon]}
									icon={userPinIcon}
								/>
							)}

							{/* Route polyline + auto-fit */}
							{routePoints && (
								<>
									<Polyline
										positions={routePoints}
										pathOptions={{ color: '#1a3a5f', weight: 5, opacity: 0.82, lineJoin: 'round' }}
									/>
									<FitBounds points={routePoints} />
								</>
							)}

							{/* Hazard reports tagged along the route */}
							{hazardsOnRoute.map((h) => (
								<React.Fragment key={h.id}>
									<Circle
										center={[Number(h.latitude), Number(h.longitude)]}
										radius={120}
										pathOptions={{ color: '#c41919', fillColor: '#c41919', fillOpacity: 0.18, weight: 1.5 }}
									/>
									<Marker
										position={[Number(h.latitude), Number(h.longitude)]}
										icon={hazardIcon}
									>
										<Popup>
											<strong style={{ color: '#c41919' }}>⚠ {h.hazard_type}</strong><br />
											{h.location && <>{h.location}<br /></>}
											{h.description && <span style={{ fontSize: '0.85em' }}>{h.description}</span>}
											<br />
											<small style={{ opacity: 0.7 }}>
												{fmtDist(h._dist)} from your route · status: {h.status}
											</small>
										</Popup>
									</Marker>
								</React.Fragment>
							))}
						</MapContainer>
					</div>
				)}
			</div>
		</section>
	);
}

export default CenterDetailPage;

