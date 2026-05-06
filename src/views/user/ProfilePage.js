import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';

function ProfilePage() {
	const { currentUser } = useAuth();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [role, setRole] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [success, setSuccess] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		if (!currentUser?.id) return;
		supabase
			.from('profiles')
			.select('name, email, role')
			.eq('id', currentUser.id)
			.single()
			.then(({ data, error: err }) => {
				if (err) {
					setError('Failed to load profile.');
				} else if (data) {
					setName(data.name || '');
					setEmail(data.email || '');
					setRole(data.role || '');
				}
				setLoading(false);
			});
	}, [currentUser]);

	const handleSave = async (e) => {
		e.preventDefault();
		if (!name.trim()) { setError('Name cannot be empty.'); return; }
		setSaving(true);
		setError('');
		setSuccess('');
		const { error: err } = await supabase
			.from('profiles')
			.update({ name: name.trim(), updated_at: new Date().toISOString() })
			.eq('id', currentUser.id);
		setSaving(false);
		if (err) {
			setError('Failed to save profile.');
		} else {
			setSuccess('Profile updated successfully.');
		}
	};

	return (
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>My Profile</h1>
					<p>View and update your account information.</p>
				</div>

				{loading ? (
					<p>Loading…</p>
				) : (
					<div className="card" style={{ maxWidth: '480px' }}>
						<form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
							<div className="form-group">
								<label htmlFor="profile-name">Name</label>
								<input
									id="profile-name"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									maxLength={100}
								/>
							</div>

							<div className="form-group">
								<label htmlFor="profile-email">Email</label>
								<input
									id="profile-email"
									type="email"
									value={email}
									readOnly
									style={{ opacity: 0.7, cursor: 'not-allowed' }}
								/>
							</div>

							<div className="form-group">
								<label>Role</label>
								<span className={`status-pill ${role}`} style={{ display: 'inline-block', textTransform: 'capitalize' }}>{role || '—'}</span>
							</div>

							{error && <p className="form-error">{error}</p>}
							{success && <p style={{ color: 'var(--color-success, #16a34a)', fontSize: '0.9rem' }}>{success}</p>}

							<button type="submit" className="btn-primary" disabled={saving}>
								{saving ? 'Saving…' : 'Save Changes'}
							</button>
						</form>
					</div>
				)}
			</div>
		</section>
	);
}

export default ProfilePage;
