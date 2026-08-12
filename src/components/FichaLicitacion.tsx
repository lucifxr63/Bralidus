import { useEffect, useState } from 'react';
import { ExternalLink, Copy, Check, FileText, CalendarDays, Building2, AlertTriangle } from 'lucide-react';
import { BASE } from '@/data/api-docs';
import { supabase } from '@/lib/supabase';

/**
 * Ficha de una oportunidad de Mercado Público, servida por el gateway Animus.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * Reemplaza al modal que vivía dentro de `MercadoPublicoLiveTable`, alimentado
 * por `MAP_TENDER_DETAILS`: siete licitaciones escritas a mano con adjuntos,
 * preguntas, historial, actas y adjudicaciones inventadas. Cualquier código que
 * no estuviera en ese mapa caía a un fallback y mostraba los documentos de OTRA
 * licitación, con el código ajeno impreso en el nombre del archivo.
 *
 * Incluía además proveedores, RUTs y montos fabricados atribuidos a organismos
 * públicos reales, un CAPTCHA que se validaba contra sí mismo con
 * `Math.random()`, descargas que devolvían un `.txt` diciendo "SHA-256
 * VERIFICADA", y un bloque rotulado "Respuesta JSON Canónica del Endpoint" que
 * un integrador copiaría creyendo que era el contrato de la API.
 *
 * Acá NO hay datos de relleno. Lo que la fuente no entrega se dice.
 */

export interface FichaItem {
  external_code: string;
  title: string;
  buyer_name: string;
  source_type: string;
  official_url?: string;
}

/** Adjunto tal como lo publica el gateway. Ver la columna `attachments`. */
interface Adjunto {
  id: string | null;
  nombre: string | null;
  url: string | null;
  tipo?: 'archivo' | 'pagina';
  origen?: 'compra_agil' | 'ocds_award';
  descargable?: boolean;
}

interface Ficha {
  external_code: string;
  title: string;
  buyer_name: string;
  buyer_rut: string | null;
  buyer_region: string | null;
  buyer_commune: string | null;
  buyer_unit_name: string | null;
  buyer_contact_name: string | null;
  buyer_contact_role: string | null;
  contract_responsible_name: string | null;
  contract_responsible_email: string | null;
  amount_estimated: number | null;
  amount_is_public: boolean | null;
  amount_estimation_type: number | null;
  currency: string | null;
  status_code: string | null;
  official_url: string | null;
  published_at: string | null;
  closing_at: string | null;
  forum_start_at: string | null;
  forum_end_at: string | null;
  answers_published_at: string | null;
  technical_opening_at: string | null;
  economic_opening_at: string | null;
  estimated_award_at: string | null;
  award_at: string | null;
  attachments: Adjunto[] | null;
  items: Array<Record<string, unknown>> | null;
}

const fmtFecha = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const fmtCLP = (n: number | null, moneda: string | null): string =>
  n == null ? '—' : `${(moneda ?? 'CLP') === 'CLP' ? '$' : `${moneda} `}${n.toLocaleString('es-CL')}`;

/**
 * `amount_estimated = 0` no significa "no hay presupuesto". MP distingue tres
 * cosas que la columna sola colapsa, y por eso el gateway expone los dos flags.
 */
function leerMonto(f: Ficha): { valor: string; nota: string | null } {
  if (f.amount_is_public === false) {
    return { valor: 'No publicado', nota: 'El organismo optó por no publicar el monto.' };
  }
  if (f.amount_estimation_type === 3) {
    return { valor: 'No estimable', nota: 'El organismo lo declaró no estimable.' };
  }
  if (!f.amount_estimated) {
    return { valor: '—', nota: 'Sin monto informado en la fuente.' };
  }
  return { valor: fmtCLP(f.amount_estimated, f.currency), nota: null };
}

const CRONOGRAMA: Array<[keyof Ficha, string]> = [
  ['published_at', 'Publicación'],
  ['forum_start_at', 'Inicio de preguntas'],
  ['forum_end_at', 'Cierre de preguntas'],
  ['answers_published_at', 'Publicación de respuestas'],
  ['closing_at', 'Cierre de ofertas'],
  ['technical_opening_at', 'Apertura técnica'],
  ['economic_opening_at', 'Apertura económica'],
  ['estimated_award_at', 'Adjudicación estimada'],
  ['award_at', 'Adjudicación'],
];

export function FichaLicitacion({ item, onClose }: { item: FichaItem; onClose: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    setFicha(null);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Inicia sesión para ver la ficha completa.');

        const res = await fetch(
          `${BASE}/mercado-publico/licitaciones/${encodeURIComponent(item.external_code)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(`El gateway respondió HTTP ${res.status}.`);
        const json = await res.json();
        if (!json?.data) throw new Error('La respuesta no trae ficha.');
        if (vivo) setFicha(json.data as Ficha);
      } catch (e) {
        // Se muestra el motivo. Antes, cualquier hueco se rellenaba con datos
        // inventados y el usuario no podía distinguir un fallo de un dato real.
        if (vivo) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [item.external_code]);

  const adjuntos = ficha?.attachments ?? [];
  const monto = ficha ? leerMonto(ficha) : null;
  const urlOficial = ficha?.official_url ?? item.official_url;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0E0E1B', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 24, width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', padding: 28, boxShadow: '0 25px 60px rgba(0,0,0,0.9)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(108,60,225,0.15)' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Ficha canónica Mercado Público — Animus RaaS API</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <h4 style={{ fontSize: 20, fontWeight: 800, color: '#E8E7F5', margin: 0, fontFamily: 'monospace' }}>{item.external_code}</h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(item.external_code);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                style={{ background: copiado ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.15)', border: `1px solid ${copiado ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.3)'}`, color: copiado ? '#4ADE80' : '#FCD34D', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                {copiado ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                {copiado ? 'Copiado' : 'Copiar código'}
              </button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7674A0', fontSize: 26, cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ fontSize: 14.5, color: '#D4D2F0', fontWeight: 700, lineHeight: 1.5, margin: '0 0 16px' }}>{ficha?.title ?? item.title}</p>

        {cargando && <div style={{ color: '#7674A0', fontSize: 13, padding: 24, textAlign: 'center' }}>Consultando la ficha…</div>}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#F87171', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: '#FCA5A5', lineHeight: 1.5 }}>
              No se pudo cargar la ficha: {error}
              <div style={{ color: '#7674A0', marginTop: 6 }}>No se muestran datos de ejemplo en su lugar.</div>
            </div>
          </div>
        )}

        {ficha && (
          <>
            {/* Comprador y monto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#05050C', padding: 16, borderRadius: 14, border: '1px solid rgba(108,60,225,0.14)', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 11, color: '#6A6888', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Building2 style={{ width: 12, height: 12 }} /> Organismo comprador</span>
                <div style={{ fontSize: 12.5, color: '#C4B5FD', fontWeight: 700, marginTop: 3 }}>{ficha.buyer_name}</div>
                <div style={{ fontSize: 11.5, color: '#7674A0', marginTop: 3, lineHeight: 1.5 }}>
                  {[ficha.buyer_unit_name, ficha.buyer_rut, [ficha.buyer_commune, ficha.buyer_region].filter(Boolean).join(', ')]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                  {ficha.buyer_contact_name && (
                    <div>Contacto: {ficha.buyer_contact_name}{ficha.buyer_contact_role ? ` (${ficha.buyer_contact_role})` : ''}</div>
                  )}
                  {ficha.contract_responsible_email && <div>{ficha.contract_responsible_email}</div>}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#6A6888' }}>Monto estimado</span>
                <div style={{ fontSize: 15, color: monto?.nota ? '#FCD34D' : '#4ADE80', fontWeight: 900, marginTop: 3 }}>{monto?.valor}</div>
                {monto?.nota && <div style={{ fontSize: 11, color: '#7674A0', marginTop: 3, lineHeight: 1.45 }}>{monto.nota}</div>}
                <div style={{ fontSize: 11, color: '#6A6888', marginTop: 8 }}>Estado: <strong style={{ color: '#D4D2F0' }}>{ficha.status_code ?? '—'}</strong></div>
              </div>
            </div>

            {/* Cronograma */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#E8E7F5', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CalendarDays style={{ width: 14, height: 14, color: '#F59E0B' }} /> Etapas y plazos
              </div>
              <div style={{ background: '#05050C', borderRadius: 14, border: '1px solid rgba(108,60,225,0.14)', padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px' }}>
                {CRONOGRAMA.map(([campo, etiqueta]) => (
                  <div key={String(campo)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5 }}>
                    <span style={{ color: '#6A6888' }}>{etiqueta}</span>
                    <span style={{ color: ficha[campo] ? '#D4D2F0' : '#4A4866', fontFamily: 'monospace' }}>{fmtFecha(ficha[campo] as string | null)}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: '#6A6888', marginTop: 6 }}>
                Visita a terreno y entrega de antecedentes no se muestran: Mercado Público devuelve esas claves vacías en todas las fichas.
              </div>
            </div>

            {/* Documentos */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#E8E7F5', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileText style={{ width: 14, height: 14, color: '#0EB5C6' }} /> Documentos ({adjuntos.length})
              </div>
              {adjuntos.length === 0 ? (
                <div style={{ background: '#05050C', borderRadius: 14, border: '1px solid rgba(108,60,225,0.14)', padding: 14, fontSize: 12, color: '#7674A0', lineHeight: 1.55 }}>
                  La API de Mercado Público <strong style={{ color: '#D4D2F0' }}>no expone adjuntos de licitación</strong>. Sólo Compra Ágil los publica, y en licitaciones adjudicadas se enlaza la página de anexos del proceso. Para esta oportunidad no hay ninguno disponible.
                </div>
              ) : (
                <div style={{ background: '#05050C', borderRadius: 14, border: '1px solid rgba(108,60,225,0.14)', overflow: 'hidden' }}>
                  {adjuntos.map((a, i) => (
                    <div key={a.id ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid rgba(108,60,225,0.10)' }}>
                      <div style={{ fontSize: 12, color: '#D4D2F0', fontFamily: 'monospace', wordBreak: 'break-word' }}>{a.nombre ?? '—'}</div>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: '#0EB5C6', textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <ExternalLink style={{ width: 12, height: 12 }} />
                          {a.tipo === 'pagina' ? 'Ver en Mercado Público' : 'Abrir'}
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: '#7674A0', whiteSpace: 'nowrap' }}>sin enlace de descarga</span>
                      )}
                    </div>
                  ))}
                  <div style={{ padding: '8px 14px', fontSize: 10.5, color: '#6A6888', borderTop: '1px solid rgba(108,60,225,0.10)' }}>
                    Mercado Público entrega el nombre del anexo pero no un enlace directo al archivo; la descarga exige resolver su propio CAPTCHA en el sitio oficial.
                  </div>
                </div>
              )}
            </div>

            {/* Ítems */}
            {Array.isArray(ficha.items) && ficha.items.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#E8E7F5', marginBottom: 8 }}>Productos o servicios solicitados ({ficha.items.length})</div>
                <div style={{ background: '#05050C', borderRadius: 14, border: '1px solid rgba(108,60,225,0.14)', overflow: 'hidden' }}>
                  {ficha.items.slice(0, 12).map((it, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid rgba(108,60,225,0.10)' }}>
                      <div style={{ fontSize: 12.5, color: '#D4D2F0', fontWeight: 700 }}>
                        {String(it['productName'] ?? it['nombre'] ?? 'Ítem')} <span style={{ color: '#7674A0', fontWeight: 400 }}>× {String(it['quantity'] ?? it['cantidad'] ?? '—')} {String(it['unitMeasure'] ?? '')}</span>
                      </div>
                      {Boolean(it['productCode'] || it['description']) && (
                        <div style={{ fontSize: 11, color: '#6A6888', marginTop: 3, fontFamily: 'monospace' }}>
                          {it['productCode'] ? `UNSPSC ${String(it['productCode'])}` : ''} {it['description'] ? `· ${String(it['description'])}` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lo que la fuente no entrega. Va explícito para que nadie lo lea
                como un hueco del producto ni lo espere en la API. */}
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: 14, fontSize: 11.5, color: '#D4D2F0', lineHeight: 1.55, marginBottom: 18 }}>
              <strong style={{ color: '#FCD34D' }}>No disponible por API de Mercado Público:</strong> criterios de evaluación con ponderación, garantías exigidas, requisitos de habilidad de los oferentes, preguntas y respuestas del foro, y cuadro de ofertas. Están en la ficha oficial y hay que consultarlos ahí.
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {urlOficial && (
            <a href={urlOficial} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F59E0B', color: '#000', padding: '10px 18px', borderRadius: 11, fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              <ExternalLink style={{ width: 15, height: 15 }} /> Abrir ficha en MercadoPublico.cl
            </a>
          )}
          <button onClick={onClose} style={{ background: '#6C3CE1', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
