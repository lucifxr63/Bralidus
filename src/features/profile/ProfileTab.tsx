import { useState } from 'react';
import { User, Building, ShieldCheck, Bell, Save, CheckCircle2, Smartphone, FileText } from 'lucide-react';
import { toast } from 'sonner';

export function ProfileTab() {
  const [activeSubTab, setActiveSubTab] = useState<'account' | 'company' | 'security' | 'notifications'>('account');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('Luciano Alonso Larraín');
  const [email, setEmail] = useState('luciano@scouttech.lat');
  const [phone, setPhone] = useState('+56 9 8765 4321');
  const [jobTitle, setJobTitle] = useState('Chief Executive Officer & Founder');

  // Company State
  const [companyName, setCompanyName] = useState('Scouttech SpA');
  const [companyRut, setCompanyRut] = useState('78.464.421-9');
  const [industry, setIndustry] = useState('SaaS & Intelligence / B2G Technology');
  const [website, setWebsite] = useState('https://animus.scouttech.lat');
  const [siiStatus] = useState('Pendiente de Inicio de Actividades (SII)');

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Notification Preferences
  const [notifyTenders, setNotifyTenders] = useState(true);
  const [notifyMacro, setNotifyMacro] = useState(true);
  const [notifyQuota, setNotifyQuota] = useState(true);
  const [notifyWebhooks, setNotifyWebhooks] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    toast.success('Perfil y preferencias actualizadas correctamente en Animus Engine');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const cardStyle = { background: '#0E0E1A', border: '1px solid rgba(108,60,225,0.12)', borderRadius: 16, overflow: 'hidden' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Tab Sub-Header Navigation ────────────────────── */}
      <div style={cardStyle}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          {[
            { id: 'account', label: 'Mi Cuenta & Perfil', icon: User },
            { id: 'company', label: 'Organización & RUT Corporativo', icon: Building },
            { id: 'security', label: 'Seguridad & 2FA', icon: ShieldCheck },
            { id: 'notifications', label: 'Preferencias & Alertas', icon: Bell },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: isActive ? 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)' : 'rgba(255,255,255,0.03)',
                  border: isActive ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  color: isActive ? '#fff' : '#9896B8', transition: 'all 0.15s ease',
                }}
              >
                <Icon style={{ width: 15, height: 15 }} /> {item.label}
              </button>
            );
          })}
        </div>

        {/* ── Sub-Tab Contents ───────────────────────────── */}
        <form onSubmit={handleSaveProfile} style={{ padding: 24 }}>
          
          {/* Sub-Tab 1: Account Profile */}
          {activeSubTab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 100, background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 900, boxShadow: '0 4px 16px rgba(108,60,225,0.4)' }}>
                  LA
                </div>
                <div>
                  <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: '0 0 4px' }}>
                    {fullName}
                  </h4>
                  <span style={{ fontSize: 12, color: '#9896B8' }}>{jobTitle} · {companyName}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Nombre Completo:</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Correo Electrónico (Auth):</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Cargo / Rol en la Empresa:</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Teléfono de Contacto:</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Company Profile */}
          {activeSubTab === 'company' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', padding: '12px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText style={{ width: 18, height: 18, color: '#F59E0B' }} />
                <span style={{ fontSize: 12.5, color: '#FCD34D' }}>
                  Estado Legal SII: <strong>{siiStatus}</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Razón Social de la Empresa:</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>RUT Corporativo:</label>
                  <input
                    type="text"
                    value={companyRut}
                    onChange={e => setCompanyRut(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#4ADE80', fontSize: 13, fontWeight: 800, fontFamily: 'monospace', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Industria / Sector:</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Sitio Web Oficial:</label>
                  <input
                    type="text"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Security & 2FA */}
          {activeSubTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Contraseña Actual:</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Nueva Contraseña:</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ background: '#090914', padding: 18, borderRadius: 12, border: '1px solid rgba(108,60,225,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Smartphone style={{ width: 22, height: 22, color: '#8B5CF6' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#E8E7F5' }}>Autenticación de 2 Factores (2FA)</div>
                    <div style={{ fontSize: 11.5, color: '#7674A0' }}>Protege tu cuenta agregando verificación por App Autenticadora (TOTP).</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: twoFactorEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.15)',
                    border: twoFactorEnabled ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(139,92,246,0.3)',
                    color: twoFactorEnabled ? '#10B981' : '#A78BFA',
                  }}
                >
                  {twoFactorEnabled ? '2FA ACTIVADO ✓' : 'ACTIVAR 2FA'}
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Notifications */}
          {activeSubTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Alertas de Licitaciones B2G Nuevas (Publicación)', state: notifyTenders, setter: setNotifyTenders, desc: 'Recibe correo cuando se publiquen licitaciones de alto match comercial.' },
                { label: 'Resumen Macroeconómico Diario (BCCh & FRED)', state: notifyMacro, setter: setNotifyMacro, desc: 'Brief matutino con variaciones de TPM, IPC, UF y Dólar.' },
                { label: 'Alertas de Consumo de Cuota (80% y 95%)', state: notifyQuota, setter: setNotifyQuota, desc: 'Avisos de límite de créditos RaaS alcanzado.' },
                { label: 'Webhooks Events Push Delivery Logs', state: notifyWebhooks, setter: setNotifyWebhooks, desc: 'Notificación cuando falle un evento de entrega de webhook.' },
              ].map((item, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 10, border: '1px solid rgba(108,60,225,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#E8E7F5' }}>{item.label}</div>
                    <div style={{ fontSize: 11.5, color: '#7674A0', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={e => item.setter(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#8B5CF6', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="submit"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)', borderRadius: 10,
                color: '#fff', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(108,60,225,0.3)',
              }}
            >
              <Save style={{ width: 15, height: 15 }} /> Guardar Cambios
            </button>

            {savedSuccess && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} /> Guardado correctamente
              </span>
            )}
          </div>

        </form>
      </div>

    </div>
  );
}

export default ProfileTab;
