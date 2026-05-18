import React, { useState, useEffect, useRef } from 'react';
import '../styles/shared/AppTopNav.css';
import '../styles/shared/sentinel.css';

function AppTopNav({ role, page, items, onNavigate, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [openDropdown, setOpenDropdown] = useState(null);
  const notifRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const { title, body, level } = e.detail || {};
      setNotifs((n) => [{ title, body, level: level || 'info', ts: Date.now() }, ...n].slice(0, 30));
      setUnread((u) => u + 1);
    };
    window.addEventListener('elikas:notification', handler);
    return () => window.removeEventListener('elikas:notification', handler);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const toggleNotifs = () => {
    setNotifOpen((o) => !o);
    setUnread(0);
  };

  const levelIcon = (level) => {
    if (level === 'high')   return '🔴';
    if (level === 'medium') return '🟠';
    if (level === 'low')    return '🟢';
    return '🔔';
  };

  const handleNav = (key) => {
    onNavigate(key);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    setShowConfirm(false);
    onLogout();
  };

  return (
    <>
    <nav className={`app-top-nav ${role === 'admin' ? 'admin' : 'user'}`}>
      <div className="app-top-nav__inner">
        <div className="app-top-nav__brand">
          <img src="/elikas icon transparent.png" alt="eLikas logo" className="app-top-nav__logo" />
          {role === 'admin' ? 'eLikas Command Center' : 'eLikas Responder View'}
        </div>

        {/* Desktop links */}
        <div className="app-top-nav__links" ref={dropdownRef}>
          {items.map((item) => {
            const isActive = page === item.key || (item.children && item.children.some((c) => c.key === page));
            if (item.children) {
              return (
                <div key={item.key} className="app-top-nav__dropdown-wrap">
                  <button
                    type="button"
                    className={`app-top-nav__btn has-children${isActive ? ' active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === item.key ? null : item.key)}
                    aria-haspopup="true"
                    aria-expanded={openDropdown === item.key}
                  >
                    {item.label}
                    <svg className={`app-top-nav__chevron${openDropdown === item.key ? ' open' : ''}`} viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {openDropdown === item.key && (
                    <div className="app-top-nav__dropdown" role="menu">
                      {item.children.map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          role="menuitem"
                          className={`app-top-nav__dropdown-item${page === child.key ? ' active' : ''}`}
                          onClick={() => { handleNav(child.key); setOpenDropdown(null); }}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                className={`app-top-nav__btn${isActive ? ' active' : ''}`}
                onClick={() => handleNav(item.key)}
              >
                {item.label}
              </button>
            );
          })}
          <button type="button" className="app-top-nav__btn logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>

        {/* Notification bell — always visible */}
        <div className="app-top-nav__notif-wrap" ref={notifRef}>
          <button
            type="button"
            className="app-top-nav__notif-btn"
            onClick={toggleNotifs}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span className="app-top-nav__notif-badge" aria-label={`${unread} unread`}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="app-top-nav__notif-panel" role="region" aria-label="Notification panel">
              <div className="app-top-nav__notif-head">
                <span>Notifications</span>
                {notifs.length > 0 && (
                  <button type="button" onClick={() => setNotifs([])} aria-label="Clear all">Clear all</button>
                )}
              </div>
              {notifs.length === 0 ? (
                <p className="app-top-nav__notif-empty">No notifications yet</p>
              ) : (
                notifs.map((n, i) => (
                  <div key={i} className={`app-top-nav__notif-item app-top-nav__notif-item--${n.level}`}>
                    <span className="app-top-nav__notif-icon">{levelIcon(n.level)}</span>
                    <div className="app-top-nav__notif-text">
                      <strong>{n.title}</strong>
                      {n.body && <p>{n.body}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Hamburger button — visible on mobile only */}
        <button
          type="button"
          className="app-top-nav__hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span className={menuOpen ? 'open' : ''}></span>
          <span className={menuOpen ? 'open' : ''}></span>
          <span className={menuOpen ? 'open' : ''}></span>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="app-top-nav__mobile-menu">
          {items.map((item) => {
            if (item.children) {
              return (
                <React.Fragment key={item.key}>
                  <span className="app-top-nav__mobile-section">{item.label}</span>
                  {item.children.map((child) => (
                    <button
                      key={child.key}
                      type="button"
                      className={`app-top-nav__mobile-btn child${page === child.key ? ' active' : ''}`}
                      onClick={() => handleNav(child.key)}
                    >
                      {child.label}
                    </button>
                  ))}
                </React.Fragment>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                className={`app-top-nav__mobile-btn${page === item.key ? ' active' : ''}`}
                onClick={() => handleNav(item.key)}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            className="app-top-nav__mobile-btn logout"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>

    {showConfirm && (
      <div className="sent-modal-overlay" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" onClick={() => setShowConfirm(false)}>
        <div className="sent-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="sent-modal__title" id="signout-title">Sign out of eLikas?</h2>
          <p className="sent-modal__body">You'll be returned to the login screen. Any unsaved changes will be lost.</p>
          <div className="sent-modal__actions">
            <button className="sent-modal__btn ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
            <button className="sent-modal__btn danger" onClick={confirmLogout}>Sign Out</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default AppTopNav;


