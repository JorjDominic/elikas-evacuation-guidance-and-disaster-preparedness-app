import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';

// ── Page key ↔ URL path mapping ────────────────────────────────────────────────
const PAGE_TO_PATH = {
  landing:            '/',
  auth:               '/login',
  signup:             '/signup',
  'forgot-password':  '/forgot-password',
  'reset-password':   '/reset-password',
  dashboard:          '/dashboard',
  centers:            '/centers',
  'center-detail':    '/centers',    // actual nav uses /centers/:id
  alerts:             '/alerts',
  guides:             '/guides',
  'hazard-report':    '/report',
  'my-reports':       '/my-reports',
  'user-reports':     '/reports',
  profile:            '/profile',
  'admin-dashboard':  '/admin',
  'admin-centers':    '/admin/centers',
  'admin-content':              '/admin/content',
  'admin-content.alerts':        '/admin/content/alerts',
  'admin-content.guides':        '/admin/content/guides',
  'admin-alerts':                '/admin/alerts',
  'admin-guides':                '/admin/guides',
  'admin-reports':               '/admin/reports',
  'admin-management':            '/admin/management',
  'admin-management.users':      '/admin/management/users',
  'admin-management.audit-logs': '/admin/management/audit-logs',
  'admin-management.simulation': '/admin/management/simulation',
  'admin-management.settings':   '/admin/management/settings',
  'admin-users':                 '/admin/users',
  'admin-audit-logs':            '/admin/audit-logs',
  'admin-test':                  '/admin/test',
};

const PATH_TO_PAGE = {
  '/':                'landing',
  '/login':           'auth',
  '/signup':          'signup',
  '/forgot-password': 'forgot-password',
  '/reset-password':  'reset-password',
  '/dashboard':       'dashboard',
  '/centers':         'centers',
  '/alerts':          'alerts',
  '/guides':          'guides',
  '/report':          'hazard-report',
  '/my-reports':      'my-reports',
  '/reports':         'user-reports',
  '/profile':         'profile',
  '/admin':              'admin-dashboard',
  '/admin/centers':      'admin-centers',
  '/admin/content':                  'admin-content',
  '/admin/content/alerts':           'admin-content.alerts',
  '/admin/content/guides':           'admin-content.guides',
  '/admin/alerts':                   'admin-alerts',
  '/admin/guides':                   'admin-guides',
  '/admin/reports':                  'admin-reports',
  '/admin/management':               'admin-management',
  '/admin/management/users':         'admin-management.users',
  '/admin/management/audit-logs':    'admin-management.audit-logs',
  '/admin/management/simulation':    'admin-management.simulation',
  '/admin/management/settings':      'admin-management.settings',
  '/admin/users':                    'admin-users',
  '/admin/audit-logs':               'admin-audit-logs',
  '/admin/test':                     'admin-test',
};

function pathToPageKey(pathname) {
  if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname];
  if (/^\/centers\/.+/.test(pathname)) return 'center-detail';
  return 'landing';
}

function pathToCenterId(pathname) {
  const m = pathname.match(/^\/centers\/([^/]+)$/);
  return m ? m[1] : null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedCenterId, setSelectedCenterId] = useState(
    () => pathToCenterId(window.location.pathname)
  );

  // Derive current page key from URL — components can still read ctx.page
  const page = pathToPageKey(location.pathname);

  // Keep selectedCenterId in sync when navigating directly to /centers/:id
  useEffect(() => {
    const id = pathToCenterId(location.pathname);
    if (id) setSelectedCenterId(id);
  }, [location.pathname]);

  // setPage compat wrapper: converts legacy page-key calls to URL navigation
  const setPage = useCallback((key, centerId) => {
    if (key === 'center-detail') {
      const id = centerId || selectedCenterId;
      navigate(`/centers/${id}`);
    } else {
      navigate(PAGE_TO_PATH[key] || '/');
    }
  }, [navigate, selectedCenterId]);

  const UNAUTH_PATHS = ['/', '/login', '/signup', '/forgot-password'];

  useEffect(() => {
    const redirectByRole = async (user, isInitial = false) => {
      let profile = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
        const { data } = await supabase
          .from('profiles')
          .select('name, role')
          .eq('id', user.id)
          .single();
        if (data) { profile = data; break; }
      }

      const appRole  = user.app_metadata?.role;
      const profRole = profile?.role;
      const role = appRole === 'admin' || profRole === 'admin'
        ? 'admin'
        : (appRole || profRole || user.user_metadata?.role || 'user');
      const name =
        profile?.name ||
        user.user_metadata?.name ||
        user.email;

      setCurrentUser({ id: user.id, name, email: user.email, role });

      // On initial session restore, only redirect from unauthenticated pages
      // so that refreshing /dashboard or /admin stays on the same page.
      const currentPath = window.location.pathname;
      if (!isInitial || UNAUTH_PATHS.includes(currentPath)) {
        navigate(role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      }
      setAuthLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) redirectByRole(session.user, true);
        else setAuthLoading(false);
      } else if (event === 'SIGNED_IN') {
        if (session?.user) redirectByRole(session.user, false);
      } else if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        navigate('/');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleLogin = async (loginForm) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  };

  const handleRegister = async (registerForm) => {
    const { name, email, password, confirmPassword } = registerForm;

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      return { success: false, message: 'Please fill in all fields.' };
    }
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }
    if (password !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim(), role: 'user' } },
    });
    if (error) return { success: false, message: error.message };

    if (data.user) {
      await supabase.from('profiles').upsert(
        { id: data.user.id, name: name.trim(), role: 'user' },
        { onConflict: 'id' }
      );
    }

    if (!data.session) {
      return { success: true, confirmEmail: true };
    }
    return { success: true };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleForgotPassword = async (email) => {
    const cleanedEmail = email.trim();
    if (!cleanedEmail) return { success: false, message: 'Please enter your email address.' };
    const validEmail = /^\S+@\S+\.\S+$/.test(cleanedEmail);
    if (!validEmail) return { success: false, message: 'Please enter a valid email address.' };

    const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: window.location.origin,
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Reset instructions were sent. Please check your inbox and spam folder.' };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        authLoading,
        page,
        setPage,
        selectedCenterId,
        setSelectedCenterId,
        handleLogin,
        handleRegister,
        handleLogout,
        handleForgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
