import React, { useState, useEffect, useCallback } from 'react';
import { listProfiles, updateProfile, setUserActive, inviteUser, writeAuditLog } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminUsersPage.css';

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
  const headers = ['id', 'name', 'role', 'is_active', 'created_at'];
  const rows = data.map((r) => headers.map((h) => csvCell(r[h])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const ROLE_OPTIONS = ['user', 'admin'];

const EMPTY_INVITE = { name: '', email: '', role: 'user' };

function roleChip(role) {
  return (
    <span className={`aup-chip role-${role}`}>
      {role === 'admin' ? 'Admin' : 'User'}
    </span>
  );
}

function statusChip(isActive) {
  return (
    <span className={`aup-chip status-${isActive ? 'active' : 'inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Invite Modal ────────────────────────────────────────────────────────────
function InviteModal({ onClose, onSuccess, currentUser }) {
  const [form, setForm] = useState(EMPTY_INVITE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    const validEmail = /^\S+@\S+\.\S+$/.test(form.email.trim());
    if (!validEmail) { setError('Enter a valid email address.'); return; }

    setSaving(true);
    const { error: inviteErr } = await inviteUser({ ...form, email: form.email.trim() });
    if (inviteErr) {
      setError(inviteErr.message || 'Failed to send invite. Ensure the admin-invite-user edge function is deployed.');
      setSaving(false);
      return;
    }
    await writeAuditLog({
      actorId: currentUser?.id,
      actorName: currentUser?.name || currentUser?.email,
      action: 'user.invite',
      targetType: 'user',
      targetId: form.email.trim(),
      meta: { name: form.name.trim(), role: form.role }
    });
    setSaving(false);
    setSent(true);
    onSuccess();
  };

  return (
    <div className="aup-overlay" role="dialog" aria-modal="true" aria-label="Invite user">
      <div className="aup-modal">
        <div className="aup-modal-head">
          <h2>Invite New User</h2>
          <button type="button" className="aup-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {sent ? (
          <div className="aup-success">
            <span className="material-symbols-outlined">mark_email_read</span>
            <p>Invitation sent to <strong>{form.email}</strong>. The user will receive an email to set their password.</p>
            <button type="button" className="aup-btn primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <p className="aup-modal-hint">
              An email invite will be sent via the <code>admin-invite-user</code> Edge Function. The recipient sets their own password.
            </p>
            {error && <div className="aup-error">{error}</div>}
            <form className="aup-form" onSubmit={handleSubmit}>
              <label htmlFor="inv-name">Full Name *</label>
              <input id="inv-name" type="text" placeholder="Juan Dela Cruz"
                value={form.name} onChange={(e) => set('name', e.target.value)} />

              <label htmlFor="inv-email">Email Address *</label>
              <input id="inv-email" type="email" placeholder="user@example.com"
                value={form.email} onChange={(e) => set('email', e.target.value)} />

              <label htmlFor="inv-role">Role</label>
              <select id="inv-role" value={form.role} onChange={(e) => set('role', e.target.value)}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r === 'admin' ? 'Admin' : 'Regular User'}</option>)}
              </select>

              <div className="aup-form-actions">
                <button type="button" className="aup-btn ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="aup-btn primary" disabled={saving}>
                  {saving ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    name: user.name || '',
    role: user.role || 'user',
    is_active: user.is_active !== false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    const result = await onSave(user.id, form);
    setSaving(false);
    if (result?.error) { setError(result.error); return; }
    onClose();
  };

  return (
    <div className="aup-overlay" role="dialog" aria-modal="true" aria-label="Edit user">
      <div className="aup-modal">
        <div className="aup-modal-head">
          <h2>Edit User</h2>
          <button type="button" className="aup-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <p className="aup-modal-hint">{user.name || '—'}</p>
        {error && <div className="aup-error">{error}</div>}
        <form className="aup-form" onSubmit={handleSubmit}>
          <label htmlFor="edit-name">Full Name *</label>
          <input id="edit-name" type="text"
            value={form.name} onChange={(e) => set('name', e.target.value)} />

          <label htmlFor="edit-role">Role</label>
          <select id="edit-role" value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r === 'admin' ? 'Admin' : 'Regular User'}</option>)}
          </select>

          <div className="aup-toggle-row">
            <label htmlFor="edit-active">Account Active</label>
            <input id="edit-active" type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)} />
          </div>

          <div className="aup-form-actions">
            <button type="button" className="aup-btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="aup-btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm Dialog ──────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="aup-overlay" role="alertdialog" aria-modal="true">
      <div className="aup-confirm">
        <p>{message}</p>
        <div className="aup-form-actions">
          <button type="button" className="aup-btn ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="aup-btn danger" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
function AdminUsersPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showInvite, setShowInvite] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { user, action }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await listProfiles();
    if (err) setError(err.message);
    else setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSaveEdit = async (id, updates) => {
    const { data, error: err } = await updateProfile(id, updates);
    if (err) return { error: err.message };
    await writeAuditLog({
      actorId: currentUser?.id,
      actorName: currentUser?.name || currentUser?.email,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      meta: updates
    });
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...data } : u));
    return {};
  };

  const handleToggleActive = async (user) => {
    const newState = !user.is_active;
    const { error: err } = await setUserActive(user.id, newState);
    if (err) { setError(err.message); return; }
    await writeAuditLog({
      actorId: currentUser?.id,
      actorName: currentUser?.name || currentUser?.email,
      action: newState ? 'user.activate' : 'user.deactivate',
      targetType: 'user',
      targetId: user.id,
      meta: { name: user.name }
    });
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: newState } : u));
  };

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      (u.name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalActive = users.filter((u) => u.is_active !== false).length;

  return (
    <section className="app-page">
      <div className="app-shell">
        <div className="page-hero">
          <h1>User Management</h1>
          <p>View, invite, and manage platform accounts. Control roles and account status from one place.</p>
          <div className="hero-meta">
            <span className="hero-pill">Access Control</span>
            <span className="hero-pill">Role Assignment</span>
          </div>
        </div>

        <div className="app-page-head">
          <span className="page-chip">Accounts</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="aup-btn" onClick={() => exportCSV(filtered, 'users.csv')} disabled={filtered.length === 0}>
              ⇓ Export CSV
            </button>
            <button type="button" className="aup-btn primary" onClick={() => setShowInvite(true)}>
              + Invite User
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="metrics-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="metric"><span>Total Users</span><strong>{users.length}</strong></div>
          <div className="metric"><span>Admins</span><strong>{totalAdmins}</strong></div>
          <div className="metric"><span>Active</span><strong>{totalActive}</strong></div>
          <div className="metric"><span>Inactive</span><strong>{users.length - totalActive}</strong></div>
        </div>

        {/* Filters */}
        <div className="aup-filters">
          <input
            type="search"
            className="aup-search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          <div className="aup-filter-tabs" role="group" aria-label="Filter by role">
            {['all', 'user', 'admin'].map((r) => (
              <button
                key={r}
                type="button"
                className={`aup-filter-tab ${roleFilter === r ? 'active' : ''}`}
                onClick={() => setRoleFilter(r)}
              >
                {r === 'all' ? 'All Roles' : r === 'admin' ? 'Admins' : 'Regular Users'}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="aup-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {loading && <p className="aup-loading">Loading users…</p>}

        {!loading && (
          <div className="table-shell card">
            <table className="aup-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="aup-empty">No users found.</td></tr>
                ) : filtered.map((u) => (
                  <tr key={u.id} className={u.is_active === false ? 'aup-row-inactive' : ''}>
                    <td className="aup-name-cell">
                      <div className="aup-avatar" aria-hidden="true">
                        {(u.name || '?')[0].toUpperCase()}
                      </div>
                      <span>{u.name || <em>—</em>}</span>
                    </td>
                    <td>{roleChip(u.role || 'user')}</td>
                    <td>{statusChip(u.is_active !== false)}</td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>
                      <div className="aup-row-actions">
                        <button
                          type="button"
                          className="aup-action-btn edit"
                          onClick={() => setEditTarget(u)}
                          aria-label={`Edit ${u.name || 'user'}`}
                        >Edit</button>
                        <button
                          type="button"
                          className={`aup-action-btn ${u.is_active !== false ? 'deactivate' : 'activate'}`}
                          onClick={() => setConfirmTarget({ user: u, action: u.is_active !== false ? 'deactivate' : 'activate' })}
                          aria-label={`${u.is_active !== false ? 'Deactivate' : 'Activate'} ${u.name || 'user'}`}
                        >
                          {u.is_active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          currentUser={currentUser}
          onClose={() => setShowInvite(false)}
          onSuccess={fetchUsers}
        />
      )}

      {editTarget && (
        <EditModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          message={`Are you sure you want to ${confirmTarget.action} ${confirmTarget.user.name || 'this user'}?`}
          onConfirm={async () => {
            await handleToggleActive(confirmTarget.user);
            setConfirmTarget(null);
          }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </section>
  );
}

export default AdminUsersPage;
