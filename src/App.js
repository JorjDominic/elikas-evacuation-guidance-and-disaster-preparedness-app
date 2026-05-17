import React, { Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useNotifications } from './hooks/useNotifications';
import AppTopNav from './views/AppTopNav';
import ToastContainer from './components/ToastContainer';
import ThemeToggleButton from './views/ThemeToggleButton';
import LandingPage from './views';
import LoginPage from './views/LoginPage';
import ForgotPasswordPage from './views/ForgotPasswordPage';
import SignUpPage from './views/SignUpPage';
import ResetPasswordPage from './views/ResetPasswordPage';

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ color: 'var(--sent-text-muted, #5a5850)', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred on this page.'}
          </p>
          <button
            type="button"
            className="btn-inline primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lazy-loaded (loaded only when the user navigates there) ──────────────────
const DashboardPage      = React.lazy(() => import('./views/user/DashboardPage'));
const AdminDashboardPage = React.lazy(() => import('./views/admin/AdminDashboardPage'));
const CentersPage        = React.lazy(() => import('./views/user/CentersPage'));
const CenterDetailPage   = React.lazy(() => import('./views/user/CenterDetailPage'));
const AlertsPage         = React.lazy(() => import('./views/user/AlertsPage'));
const GuidesPage         = React.lazy(() => import('./views/user/GuidesPage'));
const ProfilePage        = React.lazy(() => import('./views/user/ProfilePage'));
const UserReportsPage    = React.lazy(() => import('./views/user/UserReportsPage'));
const AdminCentersPage   = React.lazy(() => import('./views/admin/AdminCentersPage'));
const AdminContentPage   = React.lazy(() => import('./views/admin/AdminContentPage'));
const AdminReportsPage   = React.lazy(() => import('./views/admin/AdminReportsPage'));
const AdminManagementPage = React.lazy(() => import('./views/admin/AdminManagementPage'));
const AdminTestPage       = React.lazy(() => import('./views/admin/AdminTestPage'));

// ── Fallback shown while lazy chunks load ────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--sent-text-muted, #5a5850)', fontFamily: 'Public Sans, sans-serif', fontSize: '0.9rem' }}>
        Loading…
      </span>
    </div>
  );
}

function AppContent() {
  const {
    currentUser,
    authLoading,
    page,
    setPage,
    selectedCenterId,
    setSelectedCenterId,
    handleLogin,
    handleRegister,
    handleLogout,
    handleForgotPassword,
  } = useAuth();

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page]);

  const [theme, setTheme] = React.useState(() => {
    const savedTheme = window.localStorage.getItem('elikas-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('elikas-theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  // Always-on notification listener — active on every page for logged-in users
  useNotifications();

  const userNavItems = [
    { key: 'dashboard',      label: 'Dashboard' },
    { key: 'centers',        label: 'Centers'   },
    { key: 'alerts',         label: 'Alerts'    },
    { key: 'guides',         label: 'Guides'    },
    { key: 'user-reports',   label: 'Reports'   },
    { key: 'profile',        label: 'Profile'   },
  ];

  const isDev = process.env.NODE_ENV !== 'production';

  const adminNavItems = [
    { key: 'admin-dashboard',    label: 'Dashboard'  },
    { key: 'admin-centers',      label: 'Centers'    },
    { key: 'admin-content',      label: 'Content'    },
    { key: 'admin-reports',      label: 'Reports'    },
    { key: 'admin-management',   label: 'Management' },
    ...(isDev ? [{ key: 'admin-test', label: 'Test Console' }] : []),
  ];

  const isAdmin = currentUser?.role === 'admin';

  const renderPage = () => {
    const adminPage = page.startsWith('admin-');
    if (adminPage && !isAdmin) return <DashboardPage />;
    if (!adminPage && isAdmin && ['dashboard','centers','center-detail','alerts','guides','user-reports','profile'].includes(page)) {
      return <AdminDashboardPage />;
    }

    switch (page) {
      case 'dashboard':      return <DashboardPage />;
      case 'centers':        return <CentersPage onSelectCenter={(id) => { setSelectedCenterId(id); setPage('center-detail', id); }} />;
      case 'center-detail':  return <CenterDetailPage centerId={selectedCenterId} onBack={() => setPage('centers')} />;
      case 'alerts':         return <AlertsPage />;
      case 'guides':           return <GuidesPage />;
      case 'user-reports':     return <UserReportsPage />;
      case 'profile':          return <ProfilePage />;
      case 'admin-dashboard': return <AdminDashboardPage />;
      case 'admin-centers':     return <AdminCentersPage />;
      case 'admin-content':     return <AdminContentPage />;
      case 'admin-reports':     return <AdminReportsPage />;
      case 'admin-management':  return <AdminManagementPage />;
      case 'admin-test':       return isDev ? <AdminTestPage /> : <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Not available in production.</h2></div>;
      case 'reset-password': return <ResetPasswordPage onDone={() => setPage('landing')} />;
      case 'signup':         return <SignUpPage />;
      default:               return <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Page not found.</h2></div>;
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '3px solid var(--primary, #1a3a5f)',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--text-secondary, #5a5850)', fontSize: '0.9rem' }}>Loading eLikas…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (page === 'auth') {
    return (
      <>
        <ThemeToggleButton theme={theme} onToggle={handleThemeToggle} />
        <div key="auth">
          <LoginPage
            onBack={() => setPage('landing')}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onForgotPassword={() => setPage('forgot-password')}
          />
        </div>
      </>
    );
  }

  if (page === 'forgot-password') {
    return (
      <>
        <ThemeToggleButton theme={theme} onToggle={handleThemeToggle} />
        <div key="forgot-password">
          <ForgotPasswordPage
            onBackToLogin={() => setPage('auth')}
            onSubmitReset={handleForgotPassword}
          />
        </div>
      </>
    );
  }

  if (page === 'landing') {
    return (
      <>
        <ThemeToggleButton theme={theme} onToggle={handleThemeToggle} />
        <LandingPage
          onLogin={() => setPage('auth')}
          onRegister={() => setPage('signup')}
        />
      </>
    );
  }

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <div>
      <ThemeToggleButton theme={theme} onToggle={handleThemeToggle} />
      <AppTopNav
        role={isAdmin ? 'admin' : 'user'}
        page={page}
        items={navItems}
        onNavigate={setPage}
        onLogout={handleLogout}
      />
      <ToastContainer />
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <div key={page}>
          {renderPage()}
        </div>
      </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;


