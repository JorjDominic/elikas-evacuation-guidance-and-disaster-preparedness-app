import React, { useEffect, useState } from 'react';
import '../styles/user/index.css';
import MapSection from '../components/MapSection';
import { supabase } from '../config/supabase';

function LandingPage({ onLogin, onRegister }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState({ centers: 24, municipalities: 21, barangays: 569 });

  useEffect(() => {
    supabase.rpc('get_landing_stats').then(({ data }) => {
      if (data) setStats(data);
    });
  }, []);

  const handleNavLink = () => setMenuOpen(false);

  const heroImages = [
    'https://sa.kapamilya.com/absnews/abscbnnews/media/2023/news/08/01/20230731-calumpit-bulacan-drone-mt-2.jpg',
    'https://www.rappler.com/tachyon/2025/07/flooding-habagat-typhoon-emong-calumpit-bulacan-july-25-2025-001-scaled.jpg',
    'https://www.greenpeace.org/static/planet4-philippines-stateless/2022/09/c72fdfe0-20q5775-1024x683.jpg'
  ];

  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  useEffect(() => {
    const carouselTimer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroImages.length);
    }, 5000);

    return () => window.clearInterval(carouselTimer);
  }, [heroImages.length]);

  const showNextImage = () => {
    setActiveHeroIndex((current) => (current + 1) % heroImages.length);
  };

  const showPreviousImage = () => {
    setActiveHeroIndex((current) => (current - 1 + heroImages.length) % heroImages.length);
  };

  const activeHeroBackground = {
    backgroundImage: `linear-gradient(120deg, rgba(12, 24, 40, 0.82), rgba(26, 58, 95, 0.6)), radial-gradient(circle at 18% 30%, rgba(255, 98, 66, 0.35), transparent 35%), url('${heroImages[activeHeroIndex]}')`
  };

  return (
    <div className="view-landing sentinel-theme">
      <header className="top-nav">
        <div className="layout nav-inner">
          <a
            className="brand"
            href="#home"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <img src="/elikas icon transparent.png" alt="eLikas logo" className="nav-logo" />
            eLikas
          </a>
          <nav className="desktop-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#map">Map</a>
            <a href="#protocols">Protocols</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="nav-actions">
            <button className="btn ghost" onClick={onLogin}>Login</button>
            <button className="btn solid" onClick={onRegister}>Register</button>
          </div>
          <button
            className="nav-hamburger"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {menuOpen && (
          <div className="nav-mobile-menu">
            <a className="nav-mobile-link" href="#features" onClick={handleNavLink}>Features</a>
            <a className="nav-mobile-link" href="#map" onClick={handleNavLink}>Map</a>
            <a className="nav-mobile-link" href="#protocols" onClick={handleNavLink}>Protocols</a>
            <a className="nav-mobile-link" href="#contact" onClick={handleNavLink}>Contact</a>
            <div className="nav-mobile-actions">
              <button className="btn ghost" onClick={() => { setMenuOpen(false); onLogin(); }}>Login</button>
              <button className="btn solid" onClick={() => { setMenuOpen(false); onRegister(); }}>Register</button>
            </div>
          </div>
        )}
      </header>

      
    {/* Commenting this out: Alert Banner */}

      {/* <section id="alerts" className="live-banner">
        <div className="layout live-banner-inner">
          <span className="material-symbols-outlined" aria-hidden="true">warning</span>
          <p>
            Live advisory: high river level expected tonight in low-lying barangays. Prepare go-bags and monitor local announcements.
          </p>
        </div>
      </section> */}

      <section id="home" className="hero" style={activeHeroBackground}>
        <div className="hero-overlay" />
        <div className="hero-carousel-controls" aria-label="Landing image controls">
          <button type="button" className="hero-carousel-btn" onClick={showPreviousImage} aria-label="Show previous hero image">
            &#8249;
          </button>
          <button type="button" className="hero-carousel-btn" onClick={showNextImage} aria-label="Show next hero image">
            &#8250;
          </button>
        </div>
        <div className="layout hero-content">
          <p className="eyebrow">Community Emergency Platform</p>
          <h1>
            eLikas: <span>Preparedness that reaches every barangay.</span>
          </h1>
          <p className="hero-copy">
            A single place for flood advisories, evacuation center availability, and response guides so families can act fast and stay safe.
          </p>
          <div className="hero-ctas">
            <button className="btn danger" onClick={onRegister}>Create Account</button>
            <button className="btn ghost-light" onClick={onLogin}>Open Dashboard</button>
          </div>
        </div>
        <div className="hero-carousel-dots" role="tablist" aria-label="Choose hero image">
          {heroImages.map((imageUrl, index) => (
            <button
              key={imageUrl}
              type="button"
              role="tab"
              className={`hero-dot ${index === activeHeroIndex ? 'active' : ''}`}
              aria-label={`Show hero image ${index + 1}`}
              aria-selected={index === activeHeroIndex}
              onClick={() => setActiveHeroIndex(index)}
            />
          ))}
        </div>
        <div className="stats-strip">
          <div className="layout stats-grid">
            <div className="stat-item">
              <span className="stat-num">{stats.centers}</span>
              <span className="stat-label">Evacuation Centers</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{stats.municipalities}</span>
              <span className="stat-label">Municipalities</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{stats.barangays}</span>
              <span className="stat-label">Barangays Covered</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">24/7</span>
              <span className="stat-label">Emergency Monitoring</span>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="protocols" className="panel-section">
          <div className="layout">
            <span className="section-num">01</span>
            <div className="section-heading">
              <h2>Tactical Protocols</h2>
              <p>Built for residents, responders, and barangay operations teams.</p>
            </div>
            <div className="protocol-grid">
              <article className="protocol-card protocol-priority">
                <p className="tag">Urgent Priority</p>
                <h3>Flash Flood Response Flow</h3>
                <p>
                  Step-by-step actions for rainfall surges, including family alerts,
                  evacuation timing, and safe transport coordination.
                </p>
              </article>
              <article className="protocol-card protocol-secondary">
                <h3>Typhoon Readiness Checklist</h3>
                <p>
                  Prepare 72-hour essentials, medicine, and communication plans
                  before severe weather enters the province.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="features" className="feature-section">
          <div className="layout">
            <span className="section-num">02</span>
            <div className="section-heading">
              <h2>Platform Capabilities</h2>
              <p>Practical tools for faster, safer decisions during emergencies.</p>
            </div>
            <div className="feature-grid">
              <article className="feature-card">
                <span className="material-symbols-outlined">home_pin</span>
                <h3>Shelter Availability</h3>
                <p>See evacuation centers with occupancy updates to avoid overcrowding.</p>
              </article>
              <article className="feature-card">
                <span className="material-symbols-outlined">flood</span>
                <h3>Barangay Alerts</h3>
                <p>Receive localized flood and weather advisories from trusted sources.</p>
              </article>
              <article className="feature-card">
                <span className="material-symbols-outlined">checklist</span>
                <h3>Preparedness Guides</h3>
                <p>Follow clear before-during-after actions for families and volunteers.</p>
              </article>
            </div>
          </div>
        </section>

        <MapSection />

        <section className="steps-section">
          <div className="layout">
            <span className="section-num">04</span>
            <div className="section-heading">
              <h2>Fast Evacuation Sequence</h2>
              <p>Simple actions when an official evacuation notice is issued.</p>
            </div>
            <div className="steps-grid">
              <article className="step-card">
                <h3>1. Prepare</h3>
                <p>Secure IDs, medicine, water, and chargers in one ready-to-carry bag.</p>
              </article>
              <article className="step-card">
                <h3>2. Verify</h3>
                <p>Check live announcements, route advisories, and assigned shelter points.</p>
              </article>
              <article className="step-card">
                <h3>3. Evacuate</h3>
                <p>Move early through recommended routes and assist elderly neighbors.</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <section id="contact" className="cta-strip">
        <div className="layout cta-inner">
          <div>
            <h2>Start Prepared. Stay Connected.</h2>
            <p>Sign in to access alerts, centers, and emergency checklists.</p>
          </div>
          <div className="cta-actions">
            <button className="btn ghost" onClick={onLogin}>Login</button>
            <button className="btn solid" onClick={onRegister}>Register</button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="layout footer-inner">
          <p>eLikas</p>
          <p>Resilient communities through coordinated emergency response.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

