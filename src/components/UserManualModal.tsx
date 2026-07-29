import React, { useState } from 'react';
import {
  X, BookOpen, Key, Brain, Play, ChevronRight, ChevronLeft,
  Check, Copy, Sparkles
} from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  imagePath?: string;
  imageAlt?: string;
  description: React.ReactNode;
  codeSnippet?: {
    label: string;
    code: string;
  };
  ctaLabel?: string;
  ctaTab?: string;
}

export function UserManualModal({ isOpen, onClose, onNavigateTab }: UserManualModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const slides: Slide[] = [
    {
      id: 'welcome',
      title: '¡Bienvenido al Developer Portal de Bralidus RaaS!',
      subtitle: 'Estación de Mando y Arquitectura de Datos 100% en Vivo · Sin Mocks',
      icon: Sparkles,
      badge: 'PRODUCCIÓN v1',
      badgeColor: '#10B981',
      description: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ color: '#D1D1E0', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Este portal de desarrolladores le da acceso directo y autenticado al ecosistema canónico de{' '}
            <strong style={{ color: '#fff' }}>Bralidus / Animus</strong>. Todos los endpoints que visualizará y probará
            están conectados en tiempo real a nuestras <strong>Edge Functions en Supabase</strong> y al motor{' '}
            <strong>GraphRAG en Railway</strong>.
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            background: 'rgba(108,60,225,0.08)', border: '1px solid rgba(108,60,225,0.22)',
            borderRadius: 12, padding: 14
          }}>
            <div>
              <div style={{ color: '#8B5CF6', fontWeight: 700, fontSize: 18 }}>0 Mocks</div>
              <div style={{ color: '#8E8EA8', fontSize: 11, marginTop: 2 }}>Datos fehacientes en vivo</div>
            </div>
            <div>
              <div style={{ color: '#0EB5C6', fontWeight: 700, fontSize: 18 }}>28 Microservicios</div>
              <div style={{ color: '#8E8EA8', fontSize: 11, marginTop: 2 }}>Monitoreados en paralelo</div>
            </div>
            <div>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: 18 }}>696 Nodos</div>
              <div style={{ color: '#8E8EA8', fontSize: 11, marginTop: 2 }}>Knowledge Graph MoE</div>
            </div>
          </div>
          <p style={{ color: '#9E9EA8', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            Usa los botones <strong style={{ color: '#E8E7F5' }}>Siguiente</strong> para recorrer el manual con capturas visuales y fragmentos de código listos para su terminal.
          </p>
        </div>
      ),
      ctaLabel: 'Explorar Resumen',
      ctaTab: 'overview'
    },
    {
      id: 'apikeys',
      title: '1. Gestión de API Keys & Seguridad',
      subtitle: 'Autenticación Bearer Token con control de cuotas y webhooks',
      icon: Key,
      badge: 'SEGURIDAD RaaS',
      badgeColor: '#8B5CF6',
      imagePath: '/manual/apikeys.png',
      imageAlt: 'Ilustración del Panel de API Keys y Seguridad RaaS',
      description: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: '#D1D1E0', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Para consumir los endpoints canónicos en tu aplicación, genera una llave secreta en la pestaña{' '}
            <strong style={{ color: '#A78BFA' }}>API Keys & Webhooks</strong>. Todas las peticiones están protegidas por
            un middleware criptográfico (SHA-256) que verifica permisos, límites de ráfaga y cuotas mensuales.
          </p>
          <ul style={{ color: '#A1A1B5', fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li><strong style={{ color: '#fff' }}>Pruebas Iniciales:</strong> Puedes usar la llave pública de pruebas <code style={{ color: '#0EB5C6' }}>demo_public_key</code> (Tier Basic con 1,000 créditos).</li>
            <li><strong style={{ color: '#fff' }}>Rotación en Vivo:</strong> Puedes revocar o regenerar tus llaves al instante sin reiniciar servicios.</li>
          </ul>
        </div>
      ),
      codeSnippet: {
        label: 'Ejemplo cURL — Autenticación en la Terminal:',
        code: `curl -X GET "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/data/economy" \\
  -H "Authorization: Bearer demo_public_key" \\
  -H "Content-Type: application/json"`
      },
      ctaLabel: 'Ir a API Keys',
      ctaTab: 'apikeys'
    },
    {
      id: 'graphrag',
      title: '2. Inteligencia Económica & GraphRAG MoE',
      subtitle: 'Indicadores Macro Chile (CMF/SII) y Grafo de Oportunidades B2G',
      icon: Brain,
      badge: 'ENGINE v2.0',
      badgeColor: '#0EB5C6',
      imagePath: '/manual/graphrag.png',
      imageAlt: 'Ilustración del Grafo de Conocimiento MoE y Macro Inteligencia',
      description: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: '#D1D1E0', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Accede al catálogo macroeconómico (como la <strong style={{ color: '#fff' }}>UF de hoy de la CMF</strong> o tasas del Banco Central) y explora conexiones normativas complejas en lenguaje natural:
          </p>
          <div style={{
            background: 'rgba(14,181,198,0.08)', border: '1px solid rgba(14,181,198,0.22)',
            borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6
          }}>
            <div style={{ color: '#0EB5C6', fontWeight: 600, fontSize: 12.5 }}>Rutas Destacadas de Inteligencia:</div>
            <div style={{ color: '#D1D1E0', fontSize: 12, fontFamily: 'monospace' }}>
              • GET /api/v1/data/macro <span style={{ color: '#6A6A80' }}>(Indicadores multi-proveedor CMF/FRED)</span><br />
              • POST /api/v1/rag/query <span style={{ color: '#6A6A80' }}>(Búsqueda vectorial + síntesis con citas)</span><br />
              • POST /api/v1/intel/query <span style={{ color: '#6A6A80' }}>(Grafo de Conocimiento BralidusPY MoE)</span>
            </div>
          </div>
        </div>
      ),
      codeSnippet: {
        label: 'Consulta de Inteligencia Vectorial RAG (Ley Fintech):',
        code: `curl -X POST "https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1/rag/query" \\
  -H "Authorization: Bearer demo_public_key" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Regulación de plataformas Fintech en Chile"}'`
      },
      ctaLabel: 'Ver Knowledge Graph',
      ctaTab: 'graph'
    },
    {
      id: 'playground',
      title: '3. Playground en Vivo & Monitoreo de Salud',
      subtitle: 'Consola interactiva de pruebas en el navegador y diagnósticos RaaS',
      icon: Play,
      badge: 'HERRAMIENTAS LIVE',
      badgeColor: '#3B82F6',
      imagePath: '/manual/playground.png',
      imageAlt: 'Ilustración del Playground Interactivo y Consola JSON',
      description: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: '#D1D1E0', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            ¿Deseas inspeccionar la respuesta JSON antes de escribir código en tu app? Utiliza nuestro{' '}
            <strong style={{ color: '#60A5FA' }}>Playground API</strong> para seleccionar cualquier endpoint, ejecutar
            llamadas HTTP en vivo, medir latencias (ms) y verificar la estructura de respuesta canónica.
          </p>
          <p style={{ color: '#A1A1B5', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            Además, la pestaña <strong style={{ color: '#fff' }}>Servicios</strong> realiza un chequeo en directo de la salud del clúster de base de datos y motores analíticos.
          </p>
        </div>
      ),
      ctaLabel: 'Abrir Playground en Vivo',
      ctaTab: 'playground'
    }
  ];

  const slide = slides[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === slides.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 5, 13, 0.86)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: "'DM Sans', system-ui, sans-serif"
    }}>
      <div style={{
        background: '#0B0B17',
        border: '1px solid rgba(108,60,225,0.28)',
        borderRadius: 20,
        width: '100%',
        maxWidth: 860,
        maxHeight: '92svh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 35px rgba(108,60,225,0.22)',
        overflow: 'hidden'
      }}>
        {/* ── Modal Header ───────────────────────────────────── */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15,15,28,0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #6C3CE1, #0EB5C6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(108,60,225,0.4)'
            }}>
              <BookOpen style={{ width: 16, height: 16, color: '#fff' }} />
            </div>
            <div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#E8E7F5' }}>
                Manual de Uso — Bralidus RaaS
              </span>
              <span style={{ marginLeft: 10, fontSize: 11, background: slide.badgeColor, color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                {slide.badge}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              padding: 7,
              cursor: 'pointer',
              color: '#8E8EA8',
              transition: 'background 0.15s, color 0.15s'
            }}
            title="Cerrar Manual"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#FCA5A5'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8E8EA8'; }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* ── Tabs / Step Pagination Selector ─────────────────── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#070710',
          overflowX: 'auto'
        }}>
          {slides.map((item, index) => {
            const isActive = index === currentSlide;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentSlide(index)}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: isActive ? 'rgba(108,60,225,0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #8B5CF6' : '2px solid transparent',
                  color: isActive ? '#fff' : '#6E6E8A',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s, color 0.2s'
                }}
              >
                <Icon style={{ width: 15, height: 15, color: isActive ? item.badgeColor : '#6E6E8A' }} />
                <span>{item.title.split('.')[1] || item.title}</span>
              </button>
            );
          })}
        </div>

        {/* ── Slide Body ──────────────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          {/* Header info */}
          <div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              margin: 0,
              lineHeight: 1.25
            }}>
              {slide.title}
            </h2>
            <p style={{ color: '#8E8EA8', fontSize: 13.5, margin: '6px 0 0' }}>
              {slide.subtitle}
            </p>
          </div>

          {/* Optional Image Illustration */}
          {slide.imagePath && (
            <div style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(108,60,225,0.25)',
              background: '#05050D',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              maxHeight: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={slide.imagePath}
                alt={slide.imageAlt || slide.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 280,
                  objectFit: 'cover'
                }}
              />
            </div>
          )}

          {/* Description Content */}
          <div>
            {slide.description}
          </div>

          {/* Optional Code Snippet */}
          {slide.codeSnippet && (
            <div style={{
              background: '#06060F',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#8E8EA8', fontSize: 12, fontWeight: 600 }}>
                  {slide.codeSnippet.label}
                </span>
                <button
                  onClick={() => handleCopy(slide.codeSnippet!.code)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: copiedCode ? '#10B981' : '#D1D1E0',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  {copiedCode ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre style={{
                margin: 0,
                color: '#E8E7F5',
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                overflowX: 'auto',
                lineHeight: 1.5,
                background: 'rgba(0,0,0,0.4)',
                padding: 12,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.04)'
              }}>
                <code>{slide.codeSnippet.code}</code>
              </pre>
            </div>
          )}
        </div>

        {/* ── Modal Footer ────────────────────────────────────── */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(15,15,28,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {slides.map((_, i) => (
              <div
                key={i}
                onClick={() => setCurrentSlide(i)}
                style={{
                  width: i === currentSlide ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === currentSlide ? '#8B5CF6' : 'rgba(255,255,255,0.18)',
                  cursor: 'pointer',
                  transition: 'width 0.25s, background 0.25s'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isFirst && (
              <button
                onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '9px 16px',
                  color: '#D1D1E0',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
                Anterior
              </button>
            )}

            {!isLast ? (
              <button
                onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
                style={{
                  background: 'linear-gradient(135deg, #6C3CE1, #5B30C4)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: 10,
                  padding: '9px 20px',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 4px 14px rgba(108,60,225,0.35)'
                }}
              >
                Siguiente
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  if (slide.ctaTab && onNavigateTab) {
                    onNavigateTab(slide.ctaTab);
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: 10,
                  padding: '9px 22px',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(16,185,129,0.35)'
                }}
              >
                <Sparkles style={{ width: 16, height: 16 }} />
                {slide.ctaLabel || '¡Comenzar a Explorar!'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
