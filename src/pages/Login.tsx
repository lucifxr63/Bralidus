import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  // ── Google OAuth ─────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Browser will redirect — no need to setGoogleLoading(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar con Google');
      setGoogleLoading(false);
    }
  };

  // ── Email + Password (Mismo método que Validus MVP) ──────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Ingresa un email válido (ej: nombre@dominio.com).');
      return;
    }
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success('Revisa tu email para confirmar tu cuenta.');
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit'))
        toast.error('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials') || msg.includes('400'))
        toast.error('Email o contraseña incorrectos.');
      else if (msg.toLowerCase().includes('email not confirmed'))
        toast.error('Confirma tu email antes de ingresar. Revisa tu bandeja.');
      else if (msg.toLowerCase().includes('user already registered')) {
        toast.error('Ya existe una cuenta con ese email. Inicia sesión.');
        setIsSignUp(false);
      } else {
        toast.error(msg || 'Error de autenticación. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100svh',
      background: '#05050D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(108,60,225,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(108,60,225,0.05) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '30%', transform: 'translate(-50%, -50%)',
        width: 400, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(108,60,225,0.15) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '30%', transform: 'translate(50%, 50%)',
        width: 300, height: 250, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(14,181,198,0.10) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>

        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 32,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: '#7674A0', fontSize: 13, fontWeight: 500,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#E8E7F5')}
          onMouseLeave={e => (e.currentTarget.style.color = '#7674A0')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver al inicio
        </button>

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 32px rgba(108,60,225,0.45)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
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
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px',
            color: '#E8E7F5', margin: '0 0 8px',
          }}>
            Animus
          </h1>
          <p style={{ fontSize: 14, color: '#7674A0', margin: 0 }}>
            Developer Portal · Macro Intelligence API
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(14,14,26,0.95)',
          border: '1px solid rgba(108,60,225,0.20)',
          borderRadius: 24,
          padding: 32,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,60,225,0.08)',
        }}>
          {sent ? (
            /* ── Sent state ─────────────────────────────────────────────── */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(108,60,225,0.12)', border: '1px solid rgba(108,60,225,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
                </svg>
              </div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#E8E7F5', margin: '0 0 10px' }}>
                Revisa tu email
              </p>
              <p style={{ fontSize: 14, color: '#7674A0', lineHeight: 1.65, margin: '0 0 24px' }}>
                Enviamos un magic link a{' '}
                <span style={{ color: '#A78BFA', fontWeight: 600 }}>{email}</span>.
                <br />Haz clic en el enlace para acceder.
              </p>
              <button
                onClick={() => setSent(false)}
                style={{
                  background: 'none', border: '1px solid rgba(108,60,225,0.25)',
                  color: '#7674A0', fontSize: 13, borderRadius: 10, padding: '8px 16px',
                  cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif",
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(108,60,225,0.5)'; e.currentTarget.style.color = '#E8E7F5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(108,60,225,0.25)'; e.currentTarget.style.color = '#7674A0'; }}
              >
                ← Volver
              </button>
            </div>
          ) : (
            /* ── Login form ─────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

              {/* ── Google OAuth — PRIMARY ──────────────────────────────── */}
              <button
                id="btn-google-login"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                style={{
                  width: '100%', padding: '13px 16px',
                  background: googleLoading ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14, cursor: googleLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  color: '#E8E7F5', fontWeight: 600, fontSize: 15,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
                  marginBottom: 20,
                }}
                onMouseEnter={e => { if (!googleLoading) { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {googleLoading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite', color: '#A78BFA' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    Redirigiendo a Google...
                  </>
                ) : (
                  <>
                    {/* Google logo SVG */}
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar con Google
                  </>
                )}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <span style={{ fontSize: 12, color: '#4A4A6A', whiteSpace: 'nowrap' }}>
                  {isSignUp ? 'o regístrate con email' : 'o inicia sesión con email'}
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {/* ── Email + Password form ──────────────────────────────── */}
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#7674A0', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Email
                  </label>
                  <input
                    id="input-email-login"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(5,5,13,0.8)', border: '1px solid rgba(108,60,225,0.20)',
                      borderRadius: 12, padding: '12px 16px',
                      fontSize: 15, color: '#E8E7F5',
                      outline: 'none', fontFamily: "'DM Sans', system-ui, sans-serif",
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(108,60,225,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,60,225,0.12)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(108,60,225,0.20)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#7674A0', display: 'block', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Contraseña
                  </label>
                  <input
                    id="input-password-login"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(5,5,13,0.8)', border: '1px solid rgba(108,60,225,0.20)',
                      borderRadius: 12, padding: '12px 16px',
                      fontSize: 15, color: '#E8E7F5',
                      outline: 'none', fontFamily: "'DM Sans', system-ui, sans-serif",
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(108,60,225,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,60,225,0.12)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(108,60,225,0.20)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading || !email.trim() || password.length < 6}
                  style={{
                    width: '100%', padding: '12px',
                    background: loading || !email.trim() || password.length < 6
                      ? 'rgba(108,60,225,0.15)'
                      : 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
                    color: loading || !email.trim() || password.length < 6 ? '#7674A0' : '#fff',
                    fontWeight: 700, fontSize: 14,
                    border: '1px solid rgba(139,92,246,0.25)',
                    borderRadius: 12, cursor: loading || !email.trim() || password.length < 6 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    boxShadow: loading || !email.trim() || password.length < 6 ? 'none' : '0 4px 16px rgba(108,60,225,0.28)',
                    transition: 'all 0.2s',
                    marginTop: 4,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                      {isSignUp ? 'Creando cuenta...' : 'Iniciando sesión...'}
                    </>
                  ) : (
                    isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'
                  )}
                </button>
              </form>

              {/* Toggle Login <-> SignUp */}
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setSent(false); }}
                  style={{
                    background: 'none', border: 'none',
                    color: '#A78BFA', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif",
                    textDecoration: 'underline',
                  }}
                >
                  {isSignUp
                    ? '¿Ya tienes una cuenta? Inicia sesión'
                    : '¿No tienes cuenta? Regístrate'}
                </button>
              </div>

              {/* Info */}
              <p style={{ fontSize: 12, color: '#4A4A6A', textAlign: 'center', marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
                Usa la <strong style={{ color: '#6C6C8A' }}>misma cuenta y contraseña de Validus</strong>.
                <br />Google OAuth es la forma más rápida.
              </p>
            </div>
          )}
        </div>

        {/* Powered by */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#4A4A6A' }}>
          Powered by{' '}
          <a href="https://validus.scouttech.lat" target="_blank" rel="noopener noreferrer"
            style={{ color: '#6C6C8A', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#A78BFA')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6C6C8A')}>
            Validus
          </a>
          {' '}· ScoutTech © 2026
        </p>
      </div>
    </div>
  );
}
