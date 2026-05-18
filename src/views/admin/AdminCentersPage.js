import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../config/supabase';
import { writeAuditLog } from '../../services/adminService';
import { fireNotification } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminCentersPage.css';

import '../../utils/leafletIcons';

const PAGE_SIZE = 20;

const BULACAN_CENTER = [14.7942, 120.8793];

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 15, { duration: 0.8 }); }, [position, map]);
  return null;
}

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

const FACILITY_OPTIONS = [
  'Restrooms', 'Generator', 'Medical Bay', 'Kitchen', 'Potable Water',
  'Cots / Sleeping Areas', 'Wi-Fi', 'Wheelchair Access', 'Storage', 'Security'
];

const EMPTY_FORM = {
  name: '',
  municipality: '',
  barangay: '',
  address: '',
  latitude: '',
  longitude: '',
  capacity: '',
  current_occupancy: '',
  status: 'open',
  facilities: [],
  contact_person: '',
  contact_number: ''
};

function CenterModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
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

  const toggleFacility = (facility) => {
    setForm((f) => ({
      ...f,
      facilities: f.facilities.includes(facility)
        ? f.facilities.filter((x) => x !== facility)
        : [...f.facilities, facility]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.municipality.trim() || !form.capacity) {
      setError('Name, municipality and capacity are required.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      capacity: Number(form.capacity),
      current_occupancy: Number(form.current_occupancy) || 0,
      latitude: form.latitude !== '' ? Number(form.latitude) : null,
      longitude: form.longitude !== '' ? Number(form.longitude) : null
    };
    const result = await onSave(payload);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onClose();
    }
  };

  return (
    <div className="ac-modal-overlay" role="dialog" aria-modal="true">
      <div className="ac-modal">
        <div className="ac-modal-head">
          <h2>{initial ? 'Edit Center' : 'Add Center'}</h2>
          <button type="button" className="ac-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {error && <div className="ac-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="ac-modal-form">
          <fieldset>
            <legend>Basic Info</legend>
            <div className="ac-field-row">
              <label>Name *<input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
              <label>Status<select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="open">Open</option>
                <option value="full">Full</option>
                <option value="closed">Closed</option>
              </select></label>
            </div>
            <div className="ac-field-row">
              <label>Municipality *<input type="text" value={form.municipality} onChange={(e) => set('municipality', e.target.value)} required /></label>
              <label>Barangay<input type="text" value={form.barangay} onChange={(e) => set('barangay', e.target.value)} /></label>
            </div>
            <label>Address<input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
          </fieldset>

          <fieldset>
            <legend>Capacity</legend>
            <div className="ac-field-row">
              <label>Total Capacity *<input type="number" min="0" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required /></label>
              <label>Current Occupancy<input type="number" min="0" value={form.current_occupancy} onChange={(e) => set('current_occupancy', e.target.value)} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Location — tap map or enter coordinates</legend>
            <div className="ac-field-row">
              <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 14.8527" /></label>
              <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. 120.8164" /></label>
            </div>
            <p className="ac-map-hint">Tap anywhere on the map to pin the center's exact location.</p>
            <MapContainer
              key={initial?.id || 'new'}
              center={pinPos || BULACAN_CENTER}
              zoom={pinPos ? 15 : 11}
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

          <fieldset>
            <legend>Facilities</legend>
            <div className="ac-facilities-grid">
              {FACILITY_OPTIONS.map((f) => (
                <label key={f} className="ac-facility-check">
                  <input
                    type="checkbox"
                    checked={form.facilities.includes(f)}
                    onChange={() => toggleFacility(f)}
                  />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Contact</legend>
            <div className="ac-field-row">
              <label>Contact Person<input type="text" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></label>
              <label>Contact Number<input type="text" value={form.contact_number} onChange={(e) => set('contact_number', e.target.value)} /></label>
            </div>
          </fieldset>

          <div className="ac-modal-actions">
            <button type="button" className="btn-inline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-inline primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Center'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminCentersPage() {
  const { currentUser } = useAuth();
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [highlighted, setHighlighted] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [pageNum, setPageNum] = useState(0);
  const [search, setSearch] = useState('');
  const rowRefs = useRef({});

  const fetchCenters = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('evacuation_centers')
      .select('*')
      .order('municipality', { ascending: true });
    if (err) setError(err.message);
    else setCenters(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCenters(); }, [fetchCenters]);

  const handleSave = async (payload) => {
    if (modal.mode === 'add') {
      const { data, error: err } = await supabase.from('evacuation_centers').insert([payload]).select().single();
      if (err) return { error: err.message };
      await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'center.create', targetType: 'center', targetId: data?.id, meta: { name: payload.name } });
      fireNotification('Center Added', `"${payload.name}" has been added.`, 'info');
    } else {
      const { error: err } = await supabase.from('evacuation_centers').update(payload).eq('id', modal.center.id);
      if (err) return { error: err.message };
      await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'center.update', targetType: 'center', targetId: modal.center.id, meta: { name: payload.name } });
      fireNotification('Center Updated', `"${payload.name}" has been updated.`, 'info');
    }
    await fetchCenters();
    return {};
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error: err } = await supabase.from('evacuation_centers').delete().eq('id', deleteTarget.id);
    if (err) setError(err.message);
    else {
      await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'center.delete', targetType: 'center', targetId: deleteTarget.id, meta: { name: deleteTarget.name } });
      fireNotification('Center Deleted', `"${deleteTarget.name}" has been removed.`, 'info');
      await fetchCenters();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleOccupancy = async (center, delta) => {
    const next = Math.max(0, (center.current_occupancy || 0) + delta);
    const { error: err } = await supabase
      .from('evacuation_centers')
      .update({ current_occupancy: next })
      .eq('id', center.id);
    if (err) { setError(err.message); return; }
    setCenters((prev) => prev.map((c) => c.id === center.id ? { ...c, current_occupancy: next } : c));
  };

  const statusClass = (s) => ({ open: 'open', full: 'warning', closed: 'closed' }[s] || 'open');

  const handleMarkerClick = (center) => {
    setHighlighted(center.id);
    if (center.latitude && center.longitude) setFlyTo([center.latitude, center.longitude]);
    setTimeout(() => {
      rowRefs.current[center.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  };

  const mappable = centers.filter((c) => c.latitude != null && c.longitude != null);
  const filteredCenters = search
    ? centers.filter((c) =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.municipality || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.barangay || '').toLowerCase().includes(search.toLowerCase())
      )
    : centers;
  const totalPages = Math.ceil(filteredCenters.length / PAGE_SIZE);
  const pageCenters = filteredCenters.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

  return (
    <section className="app-page">
      <div className="app-shell">
        <div className="page-hero">
          <h1>Manage Centers</h1>
          <p>Keep shelter profiles accurate, publish occupancy changes, and mark operational constraints in real time.</p>
          <div className="hero-meta">
            <span className="hero-pill">Shelter Operations Desk</span>
          </div>
        </div>

        <div className="app-page-head">
          <span className="page-chip">Center Administration</span>
          <button type="button" className="btn-inline primary" onClick={() => setModal({ mode: 'add' })}>
            + Add Center
          </button>
        </div>

        {error && <div className="ac-page-error">{error}</div>}

        {!loading && mappable.length > 0 && (
          <div className="card" style={{ marginBottom: '1.1rem', padding: '0' }}>
            <MapContainer
              center={BULACAN_CENTER}
              zoom={11}
              style={{ height: '340px', width: '100%', borderRadius: '0.75rem' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo position={flyTo} />
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
                    <br />
                    <button
                      type="button"
                      style={{ marginTop: '0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}
                      onClick={() => setModal({ mode: 'edit', center })}
                    >
                      Edit Center
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        <div className="table-shell card">
          {/* Search bar */}
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="search"
              placeholder="Search by name, municipality, or barangay…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPageNum(0); }}
              style={{ padding: '0.45rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border-color, #ddd)', fontSize: '0.9rem', width: '100%', maxWidth: '380px' }}
              aria-label="Search centers"
            />
          </div>
          {loading ? (
            <p className="ac-loading">Loading centers…</p>
          ) : centers.length === 0 ? (
            <p className="ac-loading">No centers yet. Add one to get started.</p>
          ) : filteredCenters.length === 0 ? (
            <p className="ac-loading">No centers match your search.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Municipality</th>
                  <th>Occupancy</th>
                  <th>Facilities</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageCenters.map((center) => (
                  <tr
                    key={center.id}
                    ref={(el) => { rowRefs.current[center.id] = el; }}
                    style={highlighted === center.id ? { background: 'var(--color-primary-soft, #eff6ff)' } : {}}
                  >
                    <td>{center.name}</td>
                    <td>{center.barangay ? `${center.barangay}, ${center.municipality}` : center.municipality}</td>
                    <td>{center.current_occupancy} / {center.capacity}
                      <span style={{ marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn-inline" style={{ padding: '0 0.4rem', minWidth: 'unset' }} onClick={() => handleOccupancy(center, -1)} aria-label="Decrease occupancy">−</button>
                        <button type="button" className="btn-inline" style={{ padding: '0 0.4rem', minWidth: 'unset', marginLeft: '0.2rem' }} onClick={() => handleOccupancy(center, 1)} aria-label="Increase occupancy">+</button>
                      </span>
                    </td>
                    <td className="ac-facilities-cell">
                      {center.facilities?.length
                        ? center.facilities.slice(0, 3).join(', ') + (center.facilities.length > 3 ? ` +${center.facilities.length - 3}` : '')
                        : <span className="ac-none">—</span>}
                    </td>
                    <td><span className={`status-pill ${statusClass(center.status)}`}>{center.status}</span></td>
                    <td className="ac-action-cell">
                      {center.latitude && center.longitude && (
                        <button type="button" className="btn-inline" onClick={() => handleMarkerClick(center)}>Map</button>
                      )}
                      <button type="button" className="btn-inline" onClick={() => setModal({ mode: 'edit', center })}>Edit</button>
                      <button type="button" className="btn-inline danger" onClick={() => setDeleteTarget(center)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      </div>

      {modal && (
        <CenterModal
          initial={modal.mode === 'edit' ? { ...modal.center, latitude: modal.center.latitude ?? '', longitude: modal.center.longitude ?? '' } : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteTarget && (
        <div className="ac-modal-overlay" role="dialog" aria-modal="true">
          <div className="ac-modal ac-confirm">
            <h2>Delete Center?</h2>
            <p>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div className="ac-modal-actions">
              <button type="button" className="btn-inline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="btn-inline danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminCentersPage;

