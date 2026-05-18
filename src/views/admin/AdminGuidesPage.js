import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../config/supabase';
import { writeAuditLog } from '../../services/adminService';
import { fireNotification } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminCentersPage.css';
import '../../styles/admin/AdminGuidesPage.css';

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
		else { setGuides(data || []); setError(''); }
		setLoading(false);
	}, []);

	useEffect(() => { fetchGuides(); }, [fetchGuides]);

	const handleSave = async (form) => {
		if (modal?.mode === 'add') {
			const { data, error: err } = await supabase.from('guides').insert([form]).select().single();
			if (err) return { error: err.message };
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'guide.create', targetType: 'guide', targetId: data?.id, meta: { title: form.title } });
			fireNotification('Content Added', `"${form.title}" has been published.`, 'info');
		} else {
			const { error: err } = await supabase.from('guides').update(form).eq('id', modal.guide.id);
			if (err) return { error: err.message };
			await writeAuditLog({ actorId: currentUser?.id, actorName: currentUser?.name, action: 'guide.update', targetType: 'guide', targetId: modal.guide.id, meta: { title: form.title } });
			fireNotification('Content Updated', `"${form.title}" has been updated.`, 'info');
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
			fireNotification('Content Deleted', `"${deleteTarget.title}" has been removed.`, 'info');
			await fetchGuides();
		}
		setDeleting(false);
		setDeleteTarget(null);
	};

	return (
		<section className="app-page admin-guides-page">
				<div className="app-shell admin-page-wrap">
					<div className="page-hero">
						<h1>Manage Guides and Routes</h1>
						<p>Curate preparedness modules and keep evacuation route instructions clear, current, and actionable.</p>
						<div className="hero-meta">
							<span className="hero-pill">Learning Content Desk</span>
							<span className="hero-pill">Version Controlled Updates</span>
						</div>
					</div>

					<div className="admin-head">
						<span className="page-chip">Guide Publishing</span>
						<button type="button" className="btn-inline primary" onClick={() => setModal({ mode: 'add' })}>+ Add Content</button>
					</div>

					{error && <p style={{ color: 'var(--color-danger, red)', marginBottom: '0.75rem' }}>{error}</p>}
					{loading && <p>Loading guides…</p>}

					{!loading && (
						<div className="guide-admin-grid">
							{guides.length === 0 ? (
								<div style={{textAlign:'center',padding:'2.5rem 0',color:'var(--sent-text-muted)'}}>
									<span style={{fontSize:'2.5rem',display:'block',marginBottom:'0.5rem'}}>📚</span>
									<p style={{fontSize:'1.1rem'}}>No guides found.<br/>Click <b>+ Add Content</b> to create your first guide or route.</p>
								</div>
							) : (
								guides.map((item) => {
									const isRoute = item.type === 'Route';

									const icon = isRoute ? '🛣️' : '📖';
									const preview = item.content && item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content;
									return (
										<div key={item.id} className={`guide-admin-card type-${item.type.toLowerCase()}`}>
											<div className="gac-header">
												<span className="gac-type-badge">{icon} {item.type}</span>
											</div>
											<div className="gac-body">
												<h3 className="gac-title">{item.title}</h3>
												{item.content && <p className="gac-preview">{preview}</p>}
											</div>
											<div className="gac-footer">
												<button type="button" className="btn-inline" title="Edit" onClick={() => setModal({ mode: 'edit', guide: item })} style={{display:'flex',alignItems:'center',gap:4}}>
													<span style={{fontSize:'1.1rem'}}>✏️</span> Edit
												</button>
												<button type="button" className="btn-inline danger" title="Delete" onClick={() => setDeleteTarget(item)} style={{display:'flex',alignItems:'center',gap:4}}>
													<span style={{fontSize:'1.1rem'}}>🗑️</span> Delete
												</button>
											</div>
										</div>
									);
								})
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

