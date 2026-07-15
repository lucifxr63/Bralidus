import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isValidRut, formatRut } from '@/lib/rut';
import { getCompanyIdentity, saveCompanyIdentity } from '@/lib/companyIdentity';

/**
 * Envuelve las rutas protegidas: si el usuario no registró la identidad de su
 * EMPRESA (RUT de negocio + razón social) en la tabla compartida `company_identity`,
 * pide esos datos antes de dejar pasar. Es info compartida por todo el ecosistema
 * (grafo societario S-Pulse). NO es el RUT personal. Degrada si la tabla no existe.
 */
export function CompanyIdentityGate({ children }: { children: React.ReactNode }) {
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [rut, setRut] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCompanyIdentity().then((c) => { if (active) setNeeded(c === null); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRut(rut)) {
      toast.error('RUT de empresa inválido. Revisá el dígito verificador (ej: 76.123.456-K).');
      return;
    }
    if (name.trim().length < 2) {
      toast.error('Ingresá la razón social.');
      return;
    }
    setSaving(true);
    try {
      await saveCompanyIdentity({ company_rut: formatRut(rut), company_name: name.trim() });
      setNeeded(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (needed === null) {
    return (
      <div style={{ minHeight: '100svh', background: '#05050D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #6C3CE1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!needed) return <>{children}</>;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10, fontSize: '0.9rem',
    background: '#0C0C18', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDF5', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100svh', background: '#05050D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#0A0A14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.75rem' }}>
        <h2 style={{ color: '#EDEDF5', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Identificá tu empresa</h2>
        <p style={{ color: '#9A9AB0', fontSize: '0.85rem', margin: '0.4rem 0 1.25rem' }}>
          Usamos el RUT de tu <strong>empresa</strong> (no tu RUT personal) para el análisis
          societario y macro. Se guarda una vez y lo comparte todo el ecosistema Scouttech.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
          <input type="text" value={rut} onChange={(e) => setRut(e.target.value)}
            placeholder="RUT de la empresa (ej: 76.123.456-K)" autoComplete="off" required style={inputStyle} />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Razón social" autoComplete="organization" required style={inputStyle} />
          <button type="submit" disabled={saving} style={{
            padding: '0.75rem', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#6C3CE1', color: '#fff', fontWeight: 600, fontSize: '0.9rem', opacity: saving ? 0.5 : 1,
          }}>
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
