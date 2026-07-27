import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  Activity, Zap, Database, ShieldCheck, TrendingDown, Radio,
  Brain, Play, Search, Key, Server, BookOpen, ShoppingBag,
  Plus, Menu, X, ChevronDown, ChevronRight, LogOut,
} from 'lucide-react';
import type { Tab } from '@/types/portal';

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { id: 'overview', label: 'Resumen', icon: Activity },
    ],
  },
  {
    title: 'Mercado Público (B2G)',
    items: [
      { id: 'fase2',     label: 'Fase 2 Comercial',   icon: ShoppingBag,  badge: 'v2.0', badgeColor: '#F59E0B' },
      { id: 'fase3',     label: 'Fase 3 IA Predictiva', icon: Brain,     badge: 'v3.0', badgeColor: '#C084FC' },
    ],
  },
  {
    title: 'Analítica',
    items: [
      { id: 'costs',     label: 'Costos RaaS',        icon: Zap,          badge: 'MoE',  badgeColor: '#0EB5C6' },
      { id: 'evidences', label: 'Muro Evidencias',    icon: Database,     badge: 'MoE',  badgeColor: '#8B5CF6' },
      { id: 'macro',     label: 'Intel Macro',        icon: TrendingDown, badge: 'FRED', badgeColor: '#F59E0B' },
      { id: 'forensic',  label: 'Radar Forense',      icon: Radio },
      { id: 'graph',     label: 'Knowledge Graph',    icon: Brain },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { id: 'apikeys',   label: 'API Keys & Webhooks', icon: Key },
      { id: 'quotas',    label: 'Cuotas & Tiers',      icon: ShieldCheck },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { id: 'playground', label: 'Playground API',  icon: Play },
      { id: 'audit',      label: 'RAG Audit',       icon: Search },
      { id: 'docs',       label: 'Documentación',   icon: BookOpen,  badge: 'v1', badgeColor: '#8B5CF6' },
      { id: 'services',   label: 'Servicios',       icon: Server },
    ],
  },
];

interface PortalLayoutProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onNewKey: () => void;
  children: React.ReactNode;
}

export function PortalLayout({ activeTab, setActiveTab, onNewKey, children }: PortalLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Close drawer on tab change
  useEffect(() => { setDrawerOpen(false); }, [activeTab]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '20px 20px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(108,60,225,0.12)',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 0 14px rgba(108,60,225,0.45)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="white"/>
            <circle cx="4" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
            <circle cx="20" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
            <circle cx="4" cy="18" r="2" fill="rgba(255,255,255,0.7)"/>
            <circle cx="20" cy="18" r="2" fill="rgba(255,255,255,0.7)"/>
            <line x1="6" y1="7" x2="10" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <line x1="18" y1="7" x2="14" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <line x1="6" y1="17" x2="10" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
            <line x1="18" y1="17" x2="14" y2="13" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: '#E8E7F5', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            Bralidus
          </div>
          <div style={{ fontSize: 10.5, color: '#5A5A7A', letterSpacing: '0.3px' }}>
            Developer Portal
          </div>
        </div>
      </div>

      {/* Sprint badge */}
      <div style={{ padding: '10px 16px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600,
          padding: '4px 10px', background: 'rgba(108,60,225,0.10)', border: '1px solid rgba(108,60,225,0.22)',
          borderRadius: 100, color: '#A78BFA',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', display: 'inline-block', boxShadow: '0 0 6px rgba(167,139,250,0.8)' }} />
          Sprint 8 · 2026
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsedSections.has(section.title);
          return (
            <div key={section.title || '__root'} style={{ marginBottom: 6 }}>
              {section.title && (
                <button
                  onClick={() => toggleSection(section.title)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    color: '#4A4870', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
                    userSelect: 'none',
                  }}
                >
                  {section.title}
                  {isCollapsed
                    ? <ChevronRight style={{ width: 11, height: 11 }} />
                    : <ChevronDown style={{ width: 11, height: 11 }} />
                  }
                </button>
              )}
              {!isCollapsed && section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 12px 8px 16px', margin: '1px 0',
                      background: isActive ? 'rgba(108,60,225,0.14)' : 'none',
                      border: 'none',
                      borderLeft: isActive ? '2.5px solid #6C3CE1' : '2.5px solid transparent',
                      borderRadius: '0 10px 10px 0',
                      cursor: 'pointer',
                      color: isActive ? '#C4B5FD' : '#7674A0',
                      fontSize: 13, fontWeight: isActive ? 600 : 500,
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                        (e.currentTarget as HTMLButtonElement).style.color = '#B8B6D4';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'none';
                        (e.currentTarget as HTMLButtonElement).style.color = '#7674A0';
                      }
                    }}
                  >
                    <Icon style={{ width: 15, height: 15, flexShrink: 0, opacity: isActive ? 1 : 0.8 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                        border: `1px solid ${item.badgeColor ?? '#666'}40`,
                        color: item.badgeColor ?? '#888', letterSpacing: '0.3px',
                        background: `${item.badgeColor ?? '#888'}12`,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div style={{ borderTop: '1px solid rgba(108,60,225,0.12)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={onNewKey}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            padding: '8px 12px', background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
            border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, cursor: 'pointer',
            color: '#fff', fontSize: 12.5, fontWeight: 600,
            boxShadow: '0 2px 12px rgba(108,60,225,0.25)',
            transition: 'opacity 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Nueva API Key
        </button>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: '100%',
            padding: '7px 12px', background: 'none',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'pointer',
            color: '#5A5A7A', fontSize: 12.5, fontWeight: 500,
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FCA5A5'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5A5A7A'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
        >
          <LogOut style={{ width: 13, height: 13 }} />
          Salir
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: '#05050D', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Desktop Sidebar (lg+) ─────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: '#0B0B17',
        borderRight: '1px solid rgba(108,60,225,0.13)',
        position: 'sticky', top: 0, height: '100svh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}
        className="hidden lg:flex"
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer Backdrop ─────────────────────────── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          }}
          className="lg:hidden"
        />
      )}

      {/* ── Mobile Drawer Sidebar ─────────────────────────── */}
      <aside
        className="lg:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          width: 260,
          background: '#0B0B17',
          borderRight: '1px solid rgba(108,60,225,0.16)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Close button inside drawer */}
        <button
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 1,
            background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8,
            padding: 6, cursor: 'pointer', color: '#7674A0',
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Main Content ────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Mobile Topbar */}
        <header
          className="lg:hidden"
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'rgba(5,5,13,0.92)', backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(108,60,225,0.13)',
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: 'rgba(108,60,225,0.10)', border: '1px solid rgba(108,60,225,0.20)',
              borderRadius: 9, padding: 8, cursor: 'pointer', color: '#A78BFA',
            }}
          >
            <Menu style={{ width: 18, height: 18 }} />
          </button>
          {/* Logo centered on mobile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px rgba(108,60,225,0.4)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="white"/>
                <circle cx="4" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
                <circle cx="20" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
                <circle cx="4" cy="18" r="2" fill="rgba(255,255,255,0.7)"/>
                <circle cx="20" cy="18" r="2" fill="rgba(255,255,255,0.7)"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: '#E8E7F5' }}>Bralidus</span>
          </div>
          <button
            onClick={onNewKey}
            style={{
              background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
              border: 'none', borderRadius: 9, padding: '7px 14px',
              cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Plus style={{ width: 13, height: 13 }} />
            Key
          </button>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 24px 48px' }}>
          {/* Breadcrumb header */}
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 22, fontWeight: 800, color: '#E8E7F5',
                letterSpacing: '-0.4px', margin: 0, lineHeight: 1.2,
              }}
            >
              {getTabTitle(activeTab)}
            </h1>
            <p style={{ color: '#5A5A78', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>
              {getTabSubtitle(activeTab)}
            </p>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

function getTabTitle(tab: Tab): string {
  const titles: Record<Tab, string> = {
    overview:   'Resumen del Portal',
    fase2:      'Mercado Público · Fase 2 Comercial',
    fase3:      'Mercado Público · Fase 3 IA Predictiva & Modalidades',
    costs:      'Costos RaaS · MoE',
    evidences:  'Muro de Evidencias',
    quotas:     'Cuotas & Tiers',
    macro:      'Inteligencia Macroeconómica',
    forensic:   'Radar Forense',
    graph:      'Knowledge Graph',
    playground: 'Playground API',
    audit:      'RAG Audit Dashboard',
    apikeys:    'API Keys & Webhooks',
    services:   'Estado de Microservicios',
    docs:       'Documentación API v1',
  };
  return titles[tab] ?? 'Developer Portal';
}

function getTabSubtitle(tab: Tab): string {
  const subtitles: Record<Tab, string> = {
    overview:   'Estado del sistema Bralidus, estadísticas y actividad reciente.',
    fase2:      'Analítica de precios, perfil 360° de compradores/proveedores, webhooks y exportaciones masivas.',
    fase3:      'Convenios Marco, Grandes Compras, Tratos Directos, Scoring de Oportunidades y Motor de Predicción de Adjudicación AI.',
    costs:      'Telemetría en tiempo real del motor Mixture of Experts (MoE).',
    evidences:  'Evidencias verificadas de indicadores macroeconómicos y doctrina regulatoria.',
    quotas:     'Consumo vs límites por tier. Alertas y upgrades de plan.',
    macro:      'Indicadores económicos de Chile en tiempo real: UF, IPC, TPM, USD/CLP.',
    forensic:   'Señales de alto impacto: CMF, BCCH, SEIA, Concursal y Empleo.',
    graph:      'Explorador visual del grafo de conocimiento (687 nodos).',
    playground: 'Prueba los endpoints de la API con tu API key en tiempo real.',
    audit:      'Precisión, hit rate y latencia del pipeline RAG.',
    apikeys:    'Administra llaves de acceso y webhooks de notificación.',
    services:   'Uptime y latencia de los microservicios del ecosistema Bralidus.',
    docs:       'Referencia completa de endpoints, parámetros y ejemplos de código.',
  };
  return subtitles[tab] ?? '';
}
