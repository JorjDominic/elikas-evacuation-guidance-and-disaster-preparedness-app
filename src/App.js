import React, { Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppTopNav from './views/AppTopNav';
import ThemeToggleButton from './views/ThemeToggleButton';

// ── Eagerly loaded (tiny, needed on first paint) ─────────────────────────────
import LandingPage from './views';
import LoginPage from './views/LoginPage';
import ForgotPasswordPage from './views/ForgotPasswordPage';
import SignUpPage from './views/SignUpPage';
import ResetPasswordPage from './views/ResetPasswordPage';

// ── Lazy-loaded (loaded only when the user navigates there) ──────────────────
const DashboardPage      = React.lazy(() => import('./views/user/DashboardPage'));
const AdminDashboardPage = React.lazy(() => import('./views/admin/AdminDashboardPage'));
const CentersPage        = React.lazy(() => import('./views/user/CentersPage'));
const CenterDetailPage   = React.lazy(() => import('./views/user/CenterDetailPage'));
const AlertsPage         = React.lazy(() => import('./views/user/AlertsPage'));
const GuidesPage         = React.lazy(() => import('./views/user/GuidesPage'));
const HazardReportPage   = React.lazy(() => import('./views/user/HazardReportPage'));
const MyReportsPage      = React.lazy(() => import('./views/user/MyReportsPage'));
const ProfilePage        = React.lazy(() => import('./views/user/ProfilePage'));
const AdminCentersPage   = React.lazy(() => import('./views/admin/AdminCentersPage'));
const AdminAlertsPage    = React.lazy(() => import('./views/admin/AdminAlertsPage'));
const AdminGuidesPage    = React.lazy(() => import('./views/admin/AdminGuidesPage'));
const AdminReportsPage   = React.lazy(() => import('./views/admin/AdminReportsPage'));
const AdminUsersPage     = React.lazy(() => import('./views/admin/AdminUsersPage'));
const AdminAuditLogsPage = React.lazy(() => import('./views/admin/AdminAuditLogsPage'));

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

  const userNavItems = [
    { key: 'dashboard',     label: 'Dashboard'     },
    { key: 'centers',       label: 'Centers'        },
    { key: 'alerts',        label: 'Alerts'         },
    { key: 'guides',        label: 'Guides'         },
    { key: 'hazard-report', label: 'Report Hazard'  },
    { key: 'my-reports',    label: 'My Reports'     },
    { key: 'profile',       label: 'Profile'        },
  ];

  const adminNavItems = [
    { key: 'admin-dashboard',  label: 'Dashboard'  },
    { key: 'admin-centers',    label: 'Centers'    },
    { key: 'admin-alerts',     label: 'Alerts'     },
    { key: 'admin-guides',     label: 'Guides'     },
    { key: 'admin-reports',    label: 'Reports'    },
    { key: 'admin-users',      label: 'Users'      },
    { key: 'admin-audit-logs', label: 'Audit Logs' },
  ];

  const isAdmin = currentUser?.role === 'admin';

  const renderPage = () => {
    const adminPage = page.startsWith('admin-');
    if (adminPage && !isAdmin) return <DashboardPage />;
    if (!adminPage && isAdmin && ['dashboard','centers','center-detail','alerts','guides','hazard-report','my-reports','profile'].includes(page)) {
      return <AdminDashboardPage />;
    }

    switch (page) {
      case 'dashboard':      return <DashboardPage />;
      case 'centers':        return <CentersPage onSelectCenter={(id) => { setSelectedCenterId(id); setPage('center-detail'); }} />;
      case 'center-detail':  return <CenterDetailPage centerId={selectedCenterId} onBack={() => setPage('centers')} />;
      case 'alerts':         return <AlertsPage />;
      case 'guides':         return <GuidesPage />;
      case 'hazard-report':  return <HazardReportPage />;
      case 'my-reports':     return <MyReportsPage />;
      case 'profile':        return <ProfilePage />;
      case 'admin-dashboard': return <AdminDashboardPage />;
      case 'admin-centers':  return <AdminCentersPage />;
      case 'admin-alerts':   return <AdminAlertsPage />;
      case 'admin-guides':   return <AdminGuidesPage />;
      case 'admin-reports':  return <AdminReportsPage />;
      case 'admin-users':    return <AdminUsersPage />;
      case 'admin-audit-logs': return <AdminAuditLogsPage />;
      case 'reset-password': return <ResetPasswordPage onDone={() => setPage('landing')} />;
      case 'signup':         return <SignUpPage />;
      default:               return <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Page not found.</h2></div>;
    }
  };

  if (authLoading) return null;

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
      <Suspense fallback={<PageLoader />}>
        <div key={page}>
          {renderPage()}
        </div>
      </Suspense>
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


