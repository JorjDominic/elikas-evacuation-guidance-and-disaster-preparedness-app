import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './views';
import LoginPage from './views/LoginPage';
import ForgotPasswordPage from './views/ForgotPasswordPage';
import SignUpPage from './views/SignUpPage';
import DashboardPage from './views/user/DashboardPage';
import AdminDashboardPage from './views/admin/AdminDashboardPage';
import CentersPage from './views/user/CentersPage';
import CenterDetailPage from './views/user/CenterDetailPage';
import AlertsPage from './views/user/AlertsPage';
import GuidesPage from './views/user/GuidesPage';
import HazardReportPage from './views/user/HazardReportPage';
import MyReportsPage from './views/user/MyReportsPage';
import AdminCentersPage from './views/admin/AdminCentersPage';
import AdminAlertsPage from './views/admin/AdminAlertsPage';
import AdminGuidesPage from './views/admin/AdminGuidesPage';
import AdminReportsPage from './views/admin/AdminReportsPage';
import AdminUsersPage from './views/admin/AdminUsersPage';
import AdminAuditLogsPage from './views/admin/AdminAuditLogsPage';
import AppTopNav from './views/AppTopNav';
import ThemeToggleButton from './views/ThemeToggleButton';
import ResetPasswordPage from './views/ResetPasswordPage';

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
    if (!adminPage && isAdmin && ['dashboard','centers','center-detail','alerts','guides','hazard-report','my-reports'].includes(page)) {
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
      <div key={page}>
        {renderPage()}
      </div>
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


