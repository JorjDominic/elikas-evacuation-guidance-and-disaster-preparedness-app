import React, { useState } from 'react';
import '../styles/user/login.css';
import '../styles/user/index.css';

function ForgotPasswordPage({ onBackToLogin, onSubmitReset }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const submitReset = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const result = await onSubmitReset(email);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(result.message);
  };

  return (
    <div className="view-landing sentinel-theme sb-auth-page sb-forgot-page">

      {/* ── Nav: identical to landing ── */}
      <header className="top-nav">
        <div className="layout nav-inner">
          <button type="button" className="brand" onClick={onBackToLogin}>
            <img src="/elikas icon transparent.png" alt="eLikas logo" className="nav-logo" />
            eLikas Bulacan
          </button>
          <nav className="desktop-links" aria-label="Primary">
            <a href="#features" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>Features</a>
            <a href="#map" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>Map</a>
            <a href="#protocols" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>Protocols</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>Contact</a>
          </nav>
          <div className="nav-actions">
            <button type="button" className="btn solid" onClick={onBackToLogin}>Login</button>
          </div>
          <button
            className="nav-hamburger"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
        {menuOpen && (
          <div className="nav-mobile-menu">
            <a className="nav-mobile-link" href="#features" onClick={(e) => { e.preventDefault(); onBackToLogin(); setMenuOpen(false); }}>Features</a>
            <a className="nav-mobile-link" href="#map" onClick={(e) => { e.preventDefault(); onBackToLogin(); setMenuOpen(false); }}>Map</a>
            <a className="nav-mobile-link" href="#protocols" onClick={(e) => { e.preventDefault(); onBackToLogin(); setMenuOpen(false); }}>Protocols</a>
            <a className="nav-mobile-link" href="#contact" onClick={(e) => { e.preventDefault(); onBackToLogin(); setMenuOpen(false); }}>Contact</a>
            <button className="nav-mobile-link" onClick={() => { onBackToLogin(); setMenuOpen(false); }}>Login</button>
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <div className="sb-auth-wrap">
        <div className="sb-auth-card">

          {/* Left decorative column */}
          <aside className="sb-auth-aside">
            <div className="sb-aside-inner">
              <div className="sb-aside-badge">
                <span className="sb-live-dot" />
                System Active
              </div>
              <h2 className="sb-aside-headline">
                Reset your<br />password<br /><em>securely.</em>
              </h2>
              <p className="sb-aside-sub">
                Enter your email and we'll send you a link to get back into your account.
              </p>
              <div className="sb-aside-stats">
                <div className="sb-stat-chip">
                  <span className="sb-stat-num">24</span>
                  <span className="sb-stat-lbl">Evacuation Centers</span>
                </div>
                <div className="sb-stat-chip">
                  <span className="sb-stat-num">21</span>
                  <span className="sb-stat-lbl">Municipalities</span>
                </div>
                <div className="sb-stat-chip">
                  <span className="sb-stat-num">569</span>
                  <span className="sb-stat-lbl">Barangays</span>
                </div>
                <div className="sb-stat-chip">
                  <span className="sb-stat-num">24/7</span>
                  <span className="sb-stat-lbl">Monitoring</span>
                </div>
              </div>
              <div className="sb-aside-image" aria-hidden="true" />
            </div>
          </aside>

          {/* Right form column */}
          <section className="sb-auth-form-shell">
            <div className="sb-form-header">
              <img src="/elikas icon transparent.png" alt="" className="sb-form-logo" aria-hidden="true" />
              <div>
                <h3 className="sb-form-title">eLikas Bulacan</h3>
                <p className="sb-form-subtitle">Emergency Guidance &amp; Disaster Preparedness System</p>
              </div>
            </div>

            <hr className="sb-form-divider" />

            <h2 className="sb-forgot-heading">Forgot Password</h2>
            <p className="sb-forgot-desc">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {error && <div className="sb-auth-error" role="alert" aria-live="polite">{error}</div>}
            {message && <div className="sb-auth-message" role="status" aria-live="polite">{message}</div>}

            <form className="sb-auth-form" onSubmit={submitReset}>
              <label htmlFor="sb-forgot-email">Email Address</label>
              <input
                id="sb-forgot-email"
                type="email"
                placeholder="JuanDelaCruz@bulacan.gov.ph"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <button type="submit" className="sb-auth-submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <button type="button" className="sb-forgot-return" onClick={onBackToLogin}>
              ← Back to Login
            </button>
          </section>

        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
