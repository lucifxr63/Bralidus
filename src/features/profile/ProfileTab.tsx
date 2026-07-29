import { useState, useEffect } from 'react';
import { User, Building, ShieldCheck, Bell, Save, CheckCircle2, Smartphone, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Perfil del usuario.
 *
 * Antes esta pantalla no persistía NADA: los campos venían con los datos
 * personales del dueño de la cuenta hardcodeados como valores por defecto, y
 * `handleSaveProfile` solo lanzaba un toast de éxito. El usuario creía haber
 * guardado.
 *
 * Ahora se cargan y se guardan de verdad los dos campos que la tabla
 * `profiles` soporta (`full_name`, `startup_name`). El resto —teléfono, cargo,
 * RUT de empresa, industria, sitio web, 2FA— no tiene columna ni backend
 * detrás: quedan deshabilitados y anotados, en vez de fingir que se guardan.
 */
export function ProfileTab() {
  const [activeSubTab, setActiveSubTab] = useState<'account' | 'company' | 'security' | 'notifications'>('account');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos con respaldo real en `profiles`
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Sin respaldo: se muestran deshabilitados (ver docblock)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyRut, setCompanyRut] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [siiStatus] = useState('—');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.email) setEmail(auth.user.email);
      if (!auth?.user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, startup_name, startup_sector')
        .eq('id', auth.user.id)
        .maybeSingle();

      if (error) {
        toast.error(`No se pudo cargar el perfil: ${error.message}`);
        return;
      }
      setFullName(data?.full_name ?? '');
      setCompanyName(data?.startup_name ?? '');
      setIndustry(data?.startup_sector ?? '');
    })();
  }, []);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Notification Preferences
  const [notifyTenders, setNotifyTenders] = useState(true);
  const [notifyMacro, setNotifyMacro] = useState(true);
  const [notifyQuota, setNotifyQuota] = useState(true);
  const [notifyWebhooks, setNotifyWebhooks] = useState(true);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) {
        toast.error('Sesión no válida: vuelve a iniciar sesión.');
        return;
      }

      // Solo se persiste lo que la tabla soporta. Antes se anunciaba éxito sin
      // escribir nada.
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, startup_name: companyName })
        .eq('id', auth.user.id);

      if (error) {
        toast.error(`No se pudo guardar: ${error.message}`);
        return;
      }

      setSavedSuccess(true);
      toast.success('Nombre y empresa guardados.');
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
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
                    disabled
                    onChange={e => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Cargo / Rol en la Empresa:</label>
                  <input
                    type="text"
                    value={jobTitle}
                    disabled
                    onChange={e => setJobTitle(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Teléfono de Contacto:</label>
                  <input
                    type="text"
                    value={phone}
                    disabled
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
                    disabled
                    onChange={e => setCompanyRut(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#4ADE80', fontSize: 13, fontWeight: 800, fontFamily: 'monospace', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Industria / Sector:</label>
                  <input
                    type="text"
                    value={industry}
                    disabled
                    onChange={e => setIndustry(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#090914', border: '1px solid rgba(108,60,225,0.2)', borderRadius: 8, color: '#E8E7F5', fontSize: 13, outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#C4B5FD', display: 'block', marginBottom: 6 }}>Sitio Web Oficial:</label>
                  <input
                    type="text"
                    value={website}
                    disabled
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
                    disabled
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
                    disabled
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
            <div>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                  background: 'linear-gradient(135deg, #6C3CE1 0%, #8B5CF6 100%)', borderRadius: 10,
                  color: '#fff', fontSize: 13, fontWeight: 800, border: 'none',
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                  boxShadow: '0 4px 14px rgba(108,60,225,0.3)',
                }}
              >
                <Save style={{ width: 15, height: 15 }} /> {saving ? 'Guardando…' : 'Guardar Cambios'}
              </button>
              <p style={{ fontSize: 11, color: '#5A5A78', margin: '8px 0 0', maxWidth: 420 }}>
                Se guardan el nombre y la empresa. Los campos atenuados aún no
                tienen dónde almacenarse, así que están deshabilitados en vez de
                aparentar que se guardan.
              </p>
            </div>

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
