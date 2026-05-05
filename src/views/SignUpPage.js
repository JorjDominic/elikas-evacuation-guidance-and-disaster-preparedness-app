import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/shared/sentinel.css';

function SignUpPage() {
	const { handleRegister, setPage } = useAuth();
	const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		const result = await handleRegister(form);
		setLoading(false);
		if (!result.success) { setError(result.message); return; }
		if (result.confirmEmail) {
			setSuccess('Account created! Check your email to confirm your address before logging in.');
		}
		// If session is immediate, SIGNED_IN event in AuthContext handles redirect
	};

	return (
		<section className="view-auth">
			<div className="auth-shell">
				<div className="auth-header">
					<h1>Create an eLikas Account</h1>
					<p>Join your barangay emergency network for faster advisories and safer evacuations.</p>
					<div className="auth-feature" style={{ margin: '0.75rem 0' }}>
						<h4>Why Register</h4>
						<p>Receive location-aware warnings, faster route recommendations, and center occupancy updates.</p>
					</div>
					<ul className="item-list">
						<li>Localized flood and weather alerts</li>
						<li>Nearby shelter availability tracking</li>
						<li>Preparedness checklists and route guides</li>
					</ul>
				</div>

				<form className="auth-card auth-form" onSubmit={handleSubmit}>
					<h2>Create Account</h2>
					{error   && <div className="sb-auth-error">{error}</div>}
					{success && <div className="sb-auth-message">{success}</div>}

					<label htmlFor="su-name">Full Name</label>
					<input id="su-name" type="text" placeholder="Juan Dela Cruz"
						value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />

					<label htmlFor="su-email">Email</label>
					<input id="su-email" type="email" placeholder="juan@email.com"
						value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />

					<label htmlFor="su-password">Password</label>
					<input id="su-password" type="password" placeholder="Min. 8 characters"
						value={form.password} onChange={(e) => handleChange('password', e.target.value)} required />

					<label htmlFor="su-confirm">Confirm Password</label>
					<input id="su-confirm" type="password" placeholder="••••••••"
						value={form.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} required />

					<button type="submit" className="auth-submit" disabled={loading || !!success}>
						{loading ? 'Creating Account…' : 'Create Account'}
					</button>
					<p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
						Already have an account?{' '}
						<button type="button" className="link" onClick={() => setPage('auth')}>Log In</button>
					</p>
				</form>
			</div>
		</section>
	);
}

export default SignUpPage;


