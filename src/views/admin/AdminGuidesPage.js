import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../config/supabase';
import { writeAuditLog } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminCentersPage.css';

const EMPTY_GUIDE = { title: '', type: 'Guide', content: '' };

function GuideModal({ initial, onSave, onClose }) {
	const [form, setForm] = useState(initial || EMPTY_GUIDE);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		if (!form.title.trim()) {
			setError('Title is required.');
			return;
		}
		setSaving(true);
		const result = await onSave(form);
		setSaving(false);
		if (result?.error) { setError(result.error); } else { onClose(); }
	};

	return (
		<div className="ac-modal-overlay" role="dialog" aria-modal="true">
			<div className="ac-modal">
				<div className="ac-modal-head">
					<h2>{initial ? 'Edit Content' : 'Add Content'}</h2>
					<button type="button" className="ac-modal-close" onClick={onClose} aria-label="Close">&times;</button>
				</div>
				{error && <div className="ac-modal-error">{error}</div>}
				<form onSubmit={handleSubmit} className="ac-modal-form">
					<label>Title *
						<input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} required />
					</label>
					<label>Type
						<select value={form.type} onChange={(e) => set('type', e.target.value)}>
							<option value="Guide">Guide</option>
							<option value="Route">Route</option>
						</select>
					</label>
					<label>Content
						<textarea rows="4" value={form.content} onChange={(e) => set('content', e.target.value)} placeholder="Content or instructions…" />
					</label>
					<div className="ac-modal-actions">
						<button type="button" className="btn-inline" onClick={onClose} disabled={saving}>Cancel</button>
						<button type="submit" className="btn-inline primary" disabled={saving}>
							{saving ? 'Saving…' : 'Save'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function AdminGuidesPage() {
	const { currentUser } = useAuth();
	const [guides, setGuides] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [modal, setModal] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [deleting, setDeleting] = useState(false);

	const fetchGuides = useCallback(async () => {
		setLoading(true);
		const { data, error: err } = await supabase
			.from('guides')
			.select('*')
			.order('created_at', { ascending: false });
		if (err) setError(err.message);
		else setGuides(data || []);
		setLoading(false);
	}, []);

	useEffect(() => { fetchGuides(); }, [fetchGuides]);

	const handleSave = async (form) => {
		if (modal?.mode === 'add') {
			const { data, error: err } = await supabase.from('guides').insert([form]).select().single();
			if (err) return { error: err.message };
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'guide.create', targetType: 'guide', targetId: data?.id, meta: { title: form.title } });
		} else {
			const { error: err } = await supabase.from('guides').update(form).eq('id', modal.guide.id);
			if (err) return { error: err.message };
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'guide.update', targetType: 'guide', targetId: modal.guide.id, meta: { title: form.title } });
		}
		await fetchGuides();
		return {};
	};

	const handleDelete = async () => {
		setDeleting(true);
		const { error: err } = await supabase.from('guides').delete().eq('id', deleteTarget.id);
		if (err) setError(err.message);
		else {
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'guide.delete', targetType: 'guide', targetId: deleteTarget.id, meta: { title: deleteTarget.title } });
			await fetchGuides();
		}
		setDeleting(false);
		setDeleteTarget(null);
	};

	return (
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>Manage Guides and Routes</h1>
					<p>Curate preparedness modules and keep evacuation route instructions clear, current, and actionable.</p>
					<div className="hero-meta">
						<span className="hero-pill">Learning Content Desk</span>
						<span className="hero-pill">Version Controlled Updates</span>
					</div>
				</div>

				<div className="app-page-head">
					<span className="page-chip">Guide Publishing</span>
					<button type="button" className="btn-inline primary" onClick={() => setModal({ mode: 'add' })}>+ Add Content</button>
				</div>

				{error && <p style={{ color: 'var(--color-danger, red)', marginBottom: '0.75rem' }}>{error}</p>}
				{loading && <p>Loading guides…</p>}

				{!loading && (
					<div className="soft-grid">
						{guides.length === 0 ? (
							<p>No guides found. Add one above.</p>
						) : (
							guides.map((item) => (
								<div key={item.id} className="soft-card">
									<span className="page-chip">{item.type}</span>
									<h3>{item.title}</h3>
									{item.content && <p>{item.content}</p>}
									<div className="action-row">
										<button type="button" className="btn-inline" onClick={() => setModal({ mode: 'edit', guide: item })}>Edit</button>
										<button type="button" className="btn-inline danger" onClick={() => setDeleteTarget(item)}>Delete</button>
									</div>
								</div>
							))
						)}
					</div>
				)}

				{modal && (
					<GuideModal
						initial={modal.mode === 'edit' ? modal.guide : null}
						onSave={handleSave}
						onClose={() => setModal(null)}
					/>
				)}

				{deleteTarget && (
					<div className="ac-modal-overlay" role="dialog" aria-modal="true">
						<div className="ac-modal">
							<div className="ac-modal-head">
								<h2>Delete Content</h2>
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

export default AdminGuidesPage;

