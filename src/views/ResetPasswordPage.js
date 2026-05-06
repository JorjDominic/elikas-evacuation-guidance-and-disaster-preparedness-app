import React, { useState } from 'react';
import { supabase } from '../config/supabase';
import '../styles/user/login.css';
import '../styles/user/index.css';

function ResetPasswordPage({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setMessage('Password updated successfully! Redirecting…');
    setTimeout(onDone, 2000);
  };

  return (
    <div className="view-landing sentinel-theme sb-auth-page sb-forgot-page">

      {/* ── Nav: identical to landing ── */}
      <header className="top-nav">
        <div className="layout nav-inner">
          <span className="brand">
            <img src="/elikas icon transparent.png" alt="eLikas logo" className="nav-logo" />
            eLikas Bulacan
          </span>
        </div>
      </header>
      <section className="sb-forgot-card">
        <div className="sb-forgot-brand" aria-hidden="true">
          <h1>eLikas Bulacan</h1>
          <small>Emergency Guidance &amp; Disaster Preparedness</small>
        </div>

        <h2>Set New Password</h2>
        <p>Enter a new password for your account.</p>

        {error && <div className="sb-auth-error">{error}</div>}
        {message && <div className="sb-auth-message">{message}</div>}

        <form className="sb-auth-form" onSubmit={handleSubmit}>
          <label htmlFor="rp-password">New Password</label>
          <input
            id="rp-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label htmlFor="rp-confirm">Confirm New Password</label>
          <input
            id="rp-confirm"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button type="submit" className="sb-auth-submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default ResetPasswordPage;
