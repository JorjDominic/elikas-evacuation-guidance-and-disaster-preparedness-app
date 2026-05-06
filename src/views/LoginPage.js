import React, { useState } from 'react';
import '../styles/user/login.css';
import '../styles/user/index.css';

function LoginPage({ onBack, onLogin, onRegister, onForgotPassword }) {
  const [activeTab, setActiveTab] = useState('login');
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const submitLogin = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!loginForm.email.trim() || !loginForm.password) {
      setError('Please enter your email and password.');
      return;
    }

    const validEmail = /^\S+@\S+\.\S+$/.test(loginForm.email.trim());
    if (!validEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    const result = await onLogin(loginForm);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!registerForm.name.trim() || !registerForm.email.trim() || !registerForm.password || !registerForm.confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (registerForm.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const result = await onRegister(registerForm);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    if (result.confirmEmail) {
      setMessage('Account created! Please check your email to confirm your account.');
      return;
    }
  };

  return (
    <div className="view-landing sentinel-theme sb-auth-page">

      {/* ── Nav: identical to landing ── */}
      <header className="top-nav">
        <div className="layout nav-inner">
          <button type="button" className="brand" onClick={onBack}>
            <img src="/elikas icon transparent.png" alt="eLikas logo" className="nav-logo" />
            eLikas Bulacan
          </button>
          <nav className="desktop-links" aria-label="Primary">
            <a href="#features" onClick={(e) => { e.preventDefault(); onBack(); }}>Features</a>
            <a href="#map" onClick={(e) => { e.preventDefault(); onBack(); }}>Map</a>
            <a href="#protocols" onClick={(e) => { e.preventDefault(); onBack(); }}>Protocols</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); onBack(); }}>Contact</a>
          </nav>
          <div className="nav-actions">
            <button
              className={`btn ghost${activeTab === 'login' ? ' sb-nav-active' : ''}`}
              onClick={() => setActiveTab('login')}
            >Login</button>
            <button
              className={`btn solid${activeTab === 'register' ? ' sb-nav-active' : ''}`}
              onClick={() => setActiveTab('register')}
            >Register</button>
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
            <a className="nav-mobile-link" href="#features" onClick={(e) => { e.preventDefault(); onBack(); setMenuOpen(false); }}>Features</a>
            <a className="nav-mobile-link" href="#map" onClick={(e) => { e.preventDefault(); onBack(); setMenuOpen(false); }}>Map</a>
            <a className="nav-mobile-link" href="#protocols" onClick={(e) => { e.preventDefault(); onBack(); setMenuOpen(false); }}>Protocols</a>
            <a className="nav-mobile-link" href="#contact" onClick={(e) => { e.preventDefault(); onBack(); setMenuOpen(false); }}>Contact</a>
            <button className="nav-mobile-link" onClick={() => { setActiveTab('login'); setMenuOpen(false); }}>Login</button>
            <button className="nav-mobile-link" onClick={() => { setActiveTab('register'); setMenuOpen(false); }}>Register</button>
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
              Preparedness<br />that reaches<br /><em>every barangay.</em>
            </h2>
            <p className="sb-aside-sub">
              Access live evacuation centers, flood advisories, and emergency guides — all in one place.
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

          {/* Form welcome header */}
          <div className="sb-form-header">
            <img src="/elikas icon transparent.png" alt="" className="sb-form-logo" aria-hidden="true" />
            <div>
              <h3 className="sb-form-title">eLikas Bulacan</h3>
              <p className="sb-form-subtitle">Emergency Guidance &amp; Disaster Preparedness System</p>
            </div>
          </div>

          <div className="sb-tab-switch" role="tablist" aria-label="Authentication mode">
            <button
              type="button" role="tab"
              className={activeTab === 'login' ? 'sb-tab-btn active' : 'sb-tab-btn'}
              onClick={() => setActiveTab('login')}
              aria-selected={activeTab === 'login'}
            >Log-in</button>
            <button
              type="button" role="tab"
              className={activeTab === 'register' ? 'sb-tab-btn active' : 'sb-tab-btn'}
              onClick={() => setActiveTab('register')}
              aria-selected={activeTab === 'register'}
            >Sign-up</button>
          </div>

          {error && <div className="sb-auth-error">{error}</div>}
          {message && <div className="sb-auth-message">{message}</div>}

          {activeTab === 'login' ? (
            <form className="sb-auth-form" onSubmit={submitLogin}>
              <label htmlFor="sb-login-email">Email / Username</label>
              <input
                id="sb-login-email" type="email"
                placeholder="JuanDelaCruz@bulacan.gov.ph"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
              <div className="sb-auth-label-row">
                <label htmlFor="sb-login-password">Password</label>
                <button type="button" className="sb-forgot-link" onClick={onForgotPassword}>Forgot Password?</button>
              </div>
              <input
                id="sb-login-password" type="password"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
              <button type="submit" className="sb-auth-submit" disabled={loading}>
                {loading ? 'Logging in…' : 'Log-in'}
              </button>
            </form>
          ) : (
            <form className="sb-auth-form" onSubmit={submitRegister}>
              <label htmlFor="sb-register-name">Full Name</label>
              <input
                id="sb-register-name" type="text"
                placeholder="Juan Dela Cruz"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              />
              <label htmlFor="sb-register-email">Email</label>
              <input
                id="sb-register-email" type="email"
                placeholder="you@example.com"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              />
              <label htmlFor="sb-register-password">Password</label>
              <input
                id="sb-register-password" type="password"
                placeholder="••••••••"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              />
              <label htmlFor="sb-register-confirm">Confirm Password</label>
              <input
                id="sb-register-confirm" type="password"
                placeholder="••••••••"
                value={registerForm.confirmPassword}
                onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
              />
              <button type="submit" className="sb-auth-submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </section>

        </div>
      </div>

      <footer className="sb-auth-footer">
        Emergency Guidance and Disaster Preparedness System that covers Bulacan area.
      </footer>
    </div>
  );
}

export default LoginPage;
