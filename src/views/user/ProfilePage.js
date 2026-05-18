import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { fireNotification } from '../../hooks/useNotifications';

function ProfilePage() {
	const { currentUser, setCurrentUser } = useAuth();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [role, setRole] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [success, setSuccess] = useState('');
	const [error, setError] = useState('');

	// Change-password state
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [pwSaving, setPwSaving] = useState(false);
	const [pwSuccess, setPwSuccess] = useState('');
	const [pwError, setPwError] = useState('');

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
			setCurrentUser((prev) => ({ ...prev, name: name.trim() }));
			fireNotification('Profile Updated', 'Your profile has been saved.', 'info');
		}
	};

	const handleChangePassword = async (e) => {
		e.preventDefault();
		setPwError('');
		setPwSuccess('');
		if (!newPassword) { setPwError('New password is required.'); return; }
		if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
		if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }
		setPwSaving(true);
		const { error: err } = await supabase.auth.updateUser({ password: newPassword });
		setPwSaving(false);
		if (err) {
			setPwError(err.message || 'Failed to update password.');
		} else {
			setPwSuccess('Password changed successfully.');
			setNewPassword('');
			setConfirmPassword('');
			fireNotification('Password Changed', 'Your password has been updated.', 'info');
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

							{error && <p className="form-error" role="alert" aria-live="polite">{error}</p>}
							{success && <p style={{ color: 'var(--color-success, #16a34a)', fontSize: '0.9rem' }} role="status" aria-live="polite">{success}</p>}

							<button type="submit" className="btn-primary" disabled={saving}>
								{saving ? 'Saving…' : 'Save Changes'}
							</button>
						</form>

						<hr style={{ margin: '1.5rem 0', borderColor: 'var(--border-color)' }} />

						<form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
							<h3 style={{ margin: 0 }}>Change Password</h3>

							<div className="form-group">
								<label htmlFor="new-password">New Password</label>
								<input
									id="new-password"
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									minLength={8}
									autoComplete="new-password"
								/>
							</div>

							<div className="form-group">
								<label htmlFor="confirm-password">Confirm New Password</label>
								<input
									id="confirm-password"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									minLength={8}
									autoComplete="new-password"
								/>
							</div>

							{pwError && <p className="form-error" role="alert" aria-live="polite">{pwError}</p>}
							{pwSuccess && <p style={{ color: 'var(--color-success, #16a34a)', fontSize: '0.9rem' }} role="status" aria-live="polite">{pwSuccess}</p>}

							<button type="submit" className="btn-primary" disabled={pwSaving}>
								{pwSaving ? 'Updating…' : 'Change Password'}
							</button>
						</form>
					</div>
				)}
			</div>
		</section>
	);
}

export default ProfilePage;
