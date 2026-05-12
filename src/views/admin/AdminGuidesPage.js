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
								<div style={{textAlign:'center',padding:'2.5rem 0',color:'#888'}}>
									<span style={{fontSize:'2.5rem',display:'block',marginBottom:'0.5rem'}}>📚</span>
									<p style={{fontSize:'1.1rem'}}>No guides found.<br/>Click <b>+ Add Content</b> to create your first guide or route.</p>
								</div>
							) : (
								guides.map((item) => {
									const isRoute = item.type === 'Route';
									const chipColor = isRoute ? '#f59e42' : '#2563eb';
									const icon = isRoute ? '🛣️' : '📖';
									const preview = item.content && item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content;
									return (
										<div key={item.id} className="guide-admin-card" style={{boxShadow:'0 2px 12px rgba(37,99,235,0.04)',transition:'box-shadow 0.2s',position:'relative',overflow:'hidden'}}>
											<span style={{background:chipColor,color:'#fff',fontWeight:700,padding:'0.2rem 0.7rem',borderRadius:999,marginBottom:'0.5rem',display:'inline-block',fontSize:'0.8rem',letterSpacing:'0.5px'}}>{icon} {item.type}</span>
											<h3 style={{margin:'0.6rem 0 0.3rem'}}>{item.title}</h3>
											{item.content && (
												<p style={{margin:'0.5rem 0 0.7rem',color:'#374151',fontSize:'0.97rem',minHeight:'2.2em'}}>
													{preview}
													{item.content.length > 120 && <span style={{color:'#2563eb',cursor:'pointer',marginLeft:4}} title={item.content}>Show more</span>}
												</p>
											)}
											<div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
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

