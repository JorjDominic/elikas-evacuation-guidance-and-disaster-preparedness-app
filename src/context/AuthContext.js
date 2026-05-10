import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState('landing');
  const [selectedCenterId, setSelectedCenterId] = useState(null);

  useEffect(() => {
    const redirectByRole = async (user) => {
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
      setPage(role === 'admin' ? 'admin-dashboard' : 'dashboard');
      setAuthLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) redirectByRole(session.user);
        else setAuthLoading(false);
      } else if (event === 'SIGNED_IN') {
        if (session?.user) redirectByRole(session.user);
      } else if (event === 'PASSWORD_RECOVERY') {
        setPage('reset-password');
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setPage('landing');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
