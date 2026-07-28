import { useState, useRef, useEffect } from 'react';
import { User, Building, Key, Shield, Bell, LogOut, ChevronDown, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface ProfileDropdownProps {
  userName?: string;
  userEmail?: string;
  companyName?: string;
  tierName?: string;
  onNavigateTab?: (tab: string) => void;
}

export function ProfileDropdown({
  userName = 'Luciano Alonso Larraín',
  userEmail = 'luciano@scouttech.lat',
  companyName = 'Scouttech SpA',
  tierName = 'Plan Pro',
  onNavigateTab
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const handleTabClick = (tab: string) => {
    setIsOpen(false);
    if (onNavigateTab) onNavigateTab(tab);
  };

  // Iniciales del usuario
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'US';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      
      {/* ── Header Avatar Button ────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(108,60,225,0.08)',
          border: '1px solid rgba(108,60,225,0.2)',
          padding: '4px 10px 4px 6px',
          borderRadius: 100,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 100,
            background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 12,
            boxShadow: '0 2px 8px rgba(108,60,225,0.3)',
          }}
        >
          {initials}
        </div>

        <div style={{ textAlign: 'left', display: 'none', flexDirection: 'column' }} className="sm:flex">
          <span style={{ fontSize: 12, fontWeight: 700, color: '#E8E7F5', lineHeight: 1.2, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </span>
          <span style={{ fontSize: 10, color: '#A78BFA', fontWeight: 700 }}>
            {tierName}
          </span>
        </div>

        <ChevronDown style={{ width: 14, height: 14, color: '#9896B8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
      </button>

      {/* ── Dropdown Menu Popup ────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 10px)',
            width: 260, background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.25)',
            borderRadius: 16, boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            overflow: 'hidden', zIndex: 100,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* User Profile Card Header */}
          <div style={{ padding: '16px 18px', background: 'linear-gradient(180deg, rgba(108,60,225,0.12) 0%, transparent 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 100,
                  background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 900, fontSize: 14,
                }}
              >
                {initials}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#F3F4F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userName}
                </div>
                <div style={{ fontSize: 11, color: '#9896B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 11, color: '#7674A0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building style={{ width: 12, height: 12 }} /> {companyName}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(139,92,246,0.2)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}>
                {tierName}
              </span>
            </div>
          </div>

          {/* Quick Menu Items */}
          <div style={{ padding: 6 }}>
            <button
              onClick={() => handleTabClick('profile')}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                color: '#E8E7F5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,60,225,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <User style={{ width: 15, height: 15, color: '#8B5CF6' }} /> Mi Perfil & Cuenta
            </button>

            <button
              onClick={() => handleTabClick('profile')}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                color: '#E8E7F5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,60,225,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Building style={{ width: 15, height: 15, color: '#0EB5C6' }} /> Organización & RUT
            </button>

            <button
              onClick={() => handleTabClick('keys')}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                color: '#E8E7F5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,60,225,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Key style={{ width: 15, height: 15, color: '#F59E0B' }} /> API Keys & Webhooks
            </button>

            <button
              onClick={() => handleTabClick('quotas')}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                color: '#E8E7F5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,60,225,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Sparkles style={{ width: 15, height: 15, color: '#EC4899' }} /> Cuotas & Tiers
            </button>

            <button
              onClick={() => handleTabClick('profile')}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                color: '#E8E7F5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,60,225,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Shield style={{ width: 15, height: 15, color: '#10B981' }} /> Seguridad & 2FA
            </button>

            <button
              onClick={() => handleTabClick('profile')}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                color: '#E8E7F5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,60,225,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Bell style={{ width: 15, height: 15, color: '#60A5FA' }} /> Alertas & Notificaciones
            </button>
          </div>

          {/* Logout Button */}
          <div style={{ padding: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', padding: '9px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10,
                color: '#F87171', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
            >
              <LogOut style={{ width: 15, height: 15 }} /> Cerrar Sesión
            </button>
          </div>

        </div>
      )}

    </div>
  );
}

export default ProfileDropdown;
