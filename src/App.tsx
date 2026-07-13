import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DeveloperPortal } from '@/pages/DeveloperPortal';
import { Login } from '@/pages/Login';
import { Landing } from '@/pages/Landing';
import { AuthCallback } from '@/pages/AuthCallback';
import type { Session } from '@supabase/supabase-js';

function ProtectedRoute({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (session === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100svh', background: '#05050D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '2px solid #6C3CE1',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute session={session}>
                <DeveloperPortal />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
