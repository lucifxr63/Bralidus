import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // ── Estrategia dual ──────────────────────────────────────────────────────
    // 1. Verifica si ya hay sesión activa (OAuth puede haber procesado el token
    //    antes de que el componente se monte — el evento SIGNED_IN se pierde).
    // 2. También escucha el evento SIGNED_IN por si llega después.

    let redirected = false;

    const redirect = (to: string) => {
      if (!redirected) {
        redirected = true;
        navigate(to, { replace: true });
      }
    };

    // Check inmediato de sesión existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirect('/dashboard');
      }
    });

    // Listener para cuando el token aún está siendo procesado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        redirect('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        redirect('/login');
      }
    });

    // Timeout de seguridad: si en 8s no hay sesión, vuelve al login
    const timeout = setTimeout(() => {
      if (!redirected) {
        redirect('/login');
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100svh', background: '#05050D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {/* Bralidus animated logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 32px rgba(108,60,225,0.5)',
          animation: 'pulse-scale 1.5s ease-in-out infinite',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="white"/>
            <circle cx="4" cy="6" r="2" fill="rgba(255,255,255,0.8)"/>
            <circle cx="20" cy="6" r="2" fill="rgba(255,255,255,0.8)"/>
            <circle cx="4" cy="18" r="2" fill="rgba(255,255,255,0.8)"/>
            <circle cx="20" cy="18" r="2" fill="rgba(255,255,255,0.8)"/>
            <line x1="6" y1="7" x2="10" y2="11" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
            <line x1="18" y1="7" x2="14" y2="11" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
            <line x1="6" y1="17" x2="10" y2="13" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
            <line x1="18" y1="17" x2="14" y2="13" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#E8E7F5', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>
            Iniciando sesión...
          </p>
          <p style={{ color: '#7674A0', fontSize: 13, margin: 0 }}>Bralidus Developer Portal</p>
        </div>

        {/* Spinner */}
        <div style={{
          width: 24, height: 24, border: '2px solid rgba(108,60,225,0.25)',
          borderTopColor: '#6C3CE1', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes pulse-scale {
          0%, 100% { transform: scale(1); box-shadow: 0 0 32px rgba(108,60,225,0.5); }
          50%       { transform: scale(1.06); box-shadow: 0 0 48px rgba(108,60,225,0.75); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
