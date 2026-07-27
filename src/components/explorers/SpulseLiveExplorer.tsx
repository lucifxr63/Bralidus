import { useState } from 'react';
import { Network, Search, Building, Users, RefreshCw } from 'lucide-react';
import { BASE } from '@/data/api-docs';

const DEMO_COMPANY_PROFILE = {
  rut: '76123456K',
  business_name: 'Scouttech SpA',
  legal_name: 'Scouttech Tecnología e Inteligencia SpA',
  incorporation_date: '2022-04-14',
  capital_clp: 50000000,
  members: [
    { name: 'Luciano D.', role: 'Socio Fundador / CEO', share_percentage: 55, rut: '18.123.456-7' },
    { name: 'Inversiones Tech SpA', role: 'Socio Institucional', share_percentage: 35, rut: '77.987.654-3' },
    { name: 'Advisor Capital', role: 'Socio Minoritario', share_percentage: 10, rut: '76.543.210-9' }
  ],
  triggers: [
    { type: 'clean', message: 'Sin antecedentes de liquidación ni reorganización judicial en CMF.' },
    { type: 'compliance', message: 'Constitución verificada en Diario Oficial Registro de Comercio.' }
  ],
  network_summary: {
    direct_relationships: 4,
    holding_connections: 2,
    legal_source: 'Diario Oficial Edición 42.890'
  }
};

export function SpulseLiveExplorer() {
  const [rutQuery, setRutQuery] = useState('76123456K');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(DEMO_COMPANY_PROFILE);

  const handleSearch = async () => {
    if (!rutQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/data/spulse/companies/${rutQuery}/profile`, {
        headers: { 'Authorization': 'Bearer demo_public_key' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setProfile(json.data);
      }
    } catch {
      // keep demo
    } finally {
      setLoading(false);
    }
  };

  const formatCLP = (val: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ background: '#0B0B16', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 36px rgba(0,0,0,0.4)' }}>
      {/* Banner */}
      <div style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.04) 100%)', borderBottom: '1px solid rgba(59,130,246,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
            <Network style={{ width: 18, height: 18 }} />
          </span>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            Explorador en Vivo — Grafo Societario & Mallas (S-Pulse)
          </h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA' }}>
            Grafo Neo4j / 360° Profile
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: '#9896B8', maxWidth: 720, margin: 0, lineHeight: 1.6 }}>
          Explora la estructura societaria, malla de propiedad, porcentaje de socios y antecedentes de riesgo legal de cualquier empresa o RUT en Chile.
        </p>

        {/* Search */}
        <div style={{ display: 'flex', gap: 12, marginTop: 18, maxWidth: 500 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#6A6888' }} />
            <input
              type="text"
              value={rutQuery}
              onChange={(e) => setRutQuery(e.target.value)}
              placeholder="Ingresa RUT de la empresa (ej: 76123456K) o nombre..."
              style={{ width: '100%', background: '#05050C', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 11, padding: '10px 14px 10px 36px', color: '#E8E7F5', fontSize: 13, outline: 'none' }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{ background: '#3B82F6', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {loading ? <RefreshCw style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Search style={{ width: 14, height: 14 }} />}
            Consultar Malla
          </button>
        </div>
      </div>

      {/* Profile Data Display */}
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Company Identity Card */}
        <div style={{ background: '#070712', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Building style={{ width: 16, height: 16, color: '#60A5FA' }} />
            <h4 style={{ fontSize: 15, fontWeight: 800, color: '#E8E7F5', margin: 0 }}>{profile.business_name}</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: '#9896B8' }}>
            <div>RUT Empresa: <strong style={{ color: '#FCD34D', fontFamily: 'monospace' }}>{profile.rut}</strong></div>
            <div>Razón Social: <strong style={{ color: '#E8E7F5' }}>{profile.legal_name}</strong></div>
            <div>Capital Suscrito: <strong style={{ color: '#4ADE80' }}>{formatCLP(profile.capital_clp)}</strong></div>
            <div>Fecha Constitución: <strong style={{ color: '#E8E7F5' }}>{profile.incorporation_date}</strong></div>
          </div>
        </div>

        {/* Members & Ownership */}
        <div style={{ background: '#070712', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 16, padding: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users style={{ width: 14, height: 14 }} /> Composición de Socios & Malla
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.members.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#05050C', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.08)' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#E8E7F5' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#6A6888' }}>{m.role} ({m.rut})</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#60A5FA', fontFamily: 'monospace' }}>
                  {m.share_percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
