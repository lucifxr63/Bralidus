import { useState } from 'react';
import { 
  Brain, ShoppingCart, HelpCircle, AlertTriangle, Target, 
  Sparkles, Check, Copy, RefreshCw, Layers
} from 'lucide-react';

export function Fase3PredictiveTab() {
  const [activeSubTab, setActiveSubTab] = useState<'convenios' | 'grandes-compras' | 'consultas' | 'tratos-directos' | 'scoring' | 'prediccion' | 'recomendaciones'>('scoring');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic Interactive States for AI Simulators
  const [scoringCodeInput, setScoringCodeInput] = useState('1180703-12-L126');
  const [predictOfferInput, setPredictOfferInput] = useState('4850000');
  const [supplierRutInput, setSupplierRutInput] = useState('76.543.210-K');

  const [loadingScoring, setLoadingScoring] = useState(false);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [loadingRecom, setLoadingRecom] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Dynamic Calculation Logic for Scoring
  const getScoringResult = (code: string) => {
    const isHigh = code.includes('1180') || code.includes('L126');
    return {
      external_code: code,
      opportunity_score: isHigh ? 94 : 76,
      score_level: isHigh ? 'EXCELENTE COMPATIBILIDAD' : 'COMPATIBILIDAD MODERADA',
      breakdown: {
        technical_match: isHigh ? '98/100 (Requisitos técnicos 100% cubiertos)' : '75/100 (Brecha menor en certificación ISO)',
        budget_feasibility: isHigh ? '92/100 (Presupuesto alineado a percentiles)' : '80/100 (Margen ajustado)',
        competition_risk: isHigh ? 'BAJO (2 competidores históricos)' : 'MEDIO (5 competidores esperados)',
        payment_timeline_score: isHigh ? '90/100 (Organismo paga a 24 días)' : '70/100 (Organismo paga a 44 días)'
      },
      recommendation: isHigh 
        ? 'Licitación fuertemente recomendada para postulación prioritaria.' 
        : 'Revisar bases administrativas por posible extensión en plazo de pago.'
    };
  };

  // Dynamic Calculation Logic for Win Prediction Simulator
  const getPredictionResult = (offerStr: string) => {
    const offer = parseFloat(offerStr) || 4850000;
    let winProb = '86.4%';
    let riskLevel = 'OPTIMO';
    let subtext = 'Oferta altamente competitiva ubicada en el percentil p35 del mercado.';

    if (offer > 8500000) {
      winProb = '28.5%';
      riskLevel = 'ALTO RIESGO';
      subtext = 'Oferta por sobre el percentil p75. Alto riesgo de pérdida por evaluación económica.';
    } else if (offer > 5500000) {
      winProb = '58.2%';
      riskLevel = 'MODERADO';
      subtext = 'Oferta cercana al percentil p50 (mediana del mercado).';
    }

    return {
      proposed_offer_clp: offer,
      win_probability: winProb,
      risk_level: riskLevel,
      market_median: 7800000,
      optimal_offer_target: 4500000,
      expected_competitors: 3,
      explanation: subtext
    };
  };

  // Dynamic Recommendations for Supplier
  const getRecommendationsResult = (rut: string) => {
    return {
      rut_proveedor: rut,
      total_recommendations: 3,
      items: [
        { code: '1180703-12-L126', title: 'Equipamiento Hospitalario UHCIP', match: '96%', buyer: 'Servicio Salud Arica', amount: '$4.850.000 CLP' },
        { code: 'COT-78401', title: 'Compra Ágil Insumos Médicos Providencia', match: '92%', buyer: 'Muni Providencia', amount: '$1.850.000 CLP' },
        { code: '2254-20-B124', title: 'Pentesting & Ciberseguridad MINSAL', match: '89%', buyer: 'MINSAL', amount: '$18.500.000 CLP' }
      ]
    };
  };

  const scoringData = getScoringResult(scoringCodeInput);
  const predictionData = getPredictionResult(predictOfferInput);
  const recommendationsData = getRecommendationsResult(supplierRutInput);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
          color: '#FFF', padding: '12px 20px', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontWeight: 800, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.3s'
        }}>
          <Check style={{ width: 16, height: 16 }} /> {toastMessage}
        </div>
      )}

      {/* Tab Title Banner */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C084FC' }}>
            <Brain style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#E8E7F5', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                Mercado Público — Fase 3 IA Predictiva & Modalidades
              </h2>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100, background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', color: '#C084FC' }}>
                RELEASE v3.0
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#9896B8', margin: '4px 0 0', lineHeight: 1.5 }}>
              Catálogos de Convenios Marco, Grandes Compras, Consultas al Mercado, Tratos Directos y Motor de IA para Scoring de Oportunidades y Predicción de Adjudicación.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 24, borderBottom: '1px solid rgba(168,85,247,0.15)' }}>
        {[
          { id: 'scoring', label: '1. Scoring Oportunidad AI', icon: Target },
          { id: 'prediccion', label: '2. Predicción Adjudicación AI', icon: Sparkles },
          { id: 'recomendaciones', label: '3. Recomendaciones Proveedor', icon: Brain },
          { id: 'convenios', label: '4. Convenios Marco', icon: Layers },
          { id: 'grandes-compras', label: '5. Grandes Compras', icon: ShoppingCart },
          { id: 'consultas', label: '6. Consultas Mercado RFI', icon: HelpCircle },
          { id: 'tratos-directos', label: '7. Tratos Directos', icon: AlertTriangle },
        ].map(st => {
          const Icon = st.icon;
          const isActive = activeSubTab === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setActiveSubTab(st.id as any)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', borderRadius: 12, fontSize: 12.5, fontWeight: 800,
                border: isActive ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.06)',
                background: isActive ? 'rgba(168,85,247,0.18)' : '#070712',
                color: isActive ? '#C084FC' : '#8B89B0',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
              }}
            >
              <Icon style={{ width: 15, height: 15, color: isActive ? '#C084FC' : '#6A6888' }} />
              {st.label}
            </button>
          );
        })}
      </div>

      {/* ── SUB-TAB CONTENT ── */}

      {/* 1. Scoring de Oportunidad AI */}
      {activeSubTab === 'scoring' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target style={{ width: 20, height: 20, color: '#C084FC' }} /> 1. Scoring Inteligente de Oportunidad B2G (AI Opportunity Match)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Algoritmo multicriterio que analiza la compatibilidad técnica, factibilidad presupuestaria y riesgo de pago (0 a 100 pts).
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(168,85,247,0.15)', color: '#C084FC', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(168,85,247,0.3)' }}>
              POST /api/v1/mercado-publico/ai/scoring-oportunidad (45 cr)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(168,85,247,0.2)' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#C084FC', display: 'block', marginBottom: 8 }}>
                Código Externo de Licitación o Compra Ágil:
              </label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input
                  type="text"
                  value={scoringCodeInput}
                  onChange={(e) => setScoringCodeInput(e.target.value)}
                  style={{ flex: 1, background: '#090914', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
                />
                <button 
                  onClick={() => {
                    setLoadingScoring(true);
                    setTimeout(() => {
                      setLoadingScoring(false);
                      showToast(`✓ Match Score calculado para ${scoringCodeInput}`);
                    }, 400);
                  }}
                  disabled={loadingScoring}
                  style={{ background: '#A855F7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw style={{ width: 14, height: 14, animation: loadingScoring ? 'spin 1s linear infinite' : 'none' }} />
                  {loadingScoring ? 'Analizando...' : 'Calcular Match Score'}
                </button>
              </div>

              {/* Visual Meter */}
              <div style={{ background: '#090914', padding: 20, borderRadius: 14, border: '1px solid rgba(168,85,247,0.2)', textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#9896B8', display: 'block' }}>Score de Compatibilidad Bralidus AI:</span>
                <div style={{ fontSize: 42, fontWeight: 900, color: '#C084FC', margin: '4px 0' }}>{scoringData.opportunity_score} <span style={{ fontSize: 20, color: '#8B89B0' }}>/ 100</span></div>
                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 800 }}>
                  {scoringData.score_level}
                </span>
              </div>

              <div style={{ background: 'rgba(168,85,247,0.08)', padding: 14, borderRadius: 12, border: '1px solid rgba(168,85,247,0.2)' }}>
                <span style={{ fontSize: 11.5, color: '#D4D2F0', lineHeight: 1.5, display: 'block' }}>
                  💡 <strong>Dictamen IA:</strong> {scoringData.recommendation}
                </span>
              </div>
            </div>

            <div style={{ background: '#030309', padding: 18, borderRadius: 16, border: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#C084FC' }}>Respuesta JSON de la API (`200 OK`):</span>
                <button
                  onClick={() => handleCopy(JSON.stringify(scoringData, null, 2), 'sc_json')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedCode === 'sc_json' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode === 'sc_json' ? 'Copiado' : 'Copiar JSON'}
                </button>
              </div>
              <pre style={{ margin: 0, color: '#4ADE80', fontSize: 11.5, fontFamily: 'monospace', lineHeight: 1.5, overflowX: 'auto', background: '#070712', padding: 12, borderRadius: 10 }}>
{JSON.stringify(scoringData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 2. Predicción de Adjudicación AI */}
      {activeSubTab === 'prediccion' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles style={{ width: 20, height: 20, color: '#4ADE80' }} /> 2. Simulador de Predicción de Adjudicación AI (Win Probability Model)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Simula la probabilidad porcentual (% Prob) de ganar una licitación ingresando tu oferta en pesos (CLP).
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#4ADE80', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(34,197,94,0.3)' }}>
              POST /api/v1/mercado-publico/ai/prediccion-adjudicacion (55 cr)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#4ADE80', display: 'block', marginBottom: 8 }}>
                Monto de Oferta Propuesta (CLP):
              </label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input
                  type="number"
                  value={predictOfferInput}
                  onChange={(e) => setPredictOfferInput(e.target.value)}
                  style={{ flex: 1, background: '#090914', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
                />
                <button 
                  onClick={() => {
                    setLoadingPredict(true);
                    setTimeout(() => {
                      setLoadingPredict(false);
                      showToast(`✓ Probabilidad recalculada para $${parseInt(predictOfferInput).toLocaleString('es-CL')} CLP`);
                    }, 400);
                  }}
                  disabled={loadingPredict}
                  style={{ background: '#22C55E', color: '#000', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw style={{ width: 14, height: 14, animation: loadingPredict ? 'spin 1s linear infinite' : 'none' }} />
                  {loadingPredict ? 'Simulando...' : 'Simular Probabilidad'}
                </button>
              </div>

              <div style={{ background: '#090914', padding: 20, borderRadius: 14, border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#9896B8', display: 'block' }}>Probabilidad Estimada de Adjudicación:</span>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#4ADE80', margin: '4px 0' }}>{predictionData.win_probability}</div>
                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 800 }}>
                  Nivel: {predictionData.risk_level}
                </span>
              </div>

              <p style={{ fontSize: 11.5, color: '#D4D2F0', margin: 0, lineHeight: 1.5 }}>
                {predictionData.explanation}
              </p>
            </div>

            <div style={{ background: '#030309', padding: 18, borderRadius: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4ADE80' }}>Respuesta JSON del Modelo AI (`200 OK`):</span>
                <button
                  onClick={() => handleCopy(JSON.stringify(predictionData, null, 2), 'pr_json')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#D4D2F0', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedCode === 'pr_json' ? <Check style={{ width: 12, height: 12, color: '#4ADE80' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copiedCode === 'pr_json' ? 'Copiado' : 'Copiar JSON'}
                </button>
              </div>
              <pre style={{ margin: 0, color: '#4ADE80', fontSize: 11.5, fontFamily: 'monospace', lineHeight: 1.5, overflowX: 'auto', background: '#070712', padding: 12, borderRadius: 10 }}>
{JSON.stringify(predictionData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 3. Recomendaciones Personalizadas Proveedor AI */}
      {activeSubTab === 'recomendaciones' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain style={{ width: 20, height: 20, color: '#FCD34D' }} /> 3. Motor de Recomendación Personalizada para Proveedores
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Recomienda las oportunidades con mayor tasa de conversión basadas en el perfil e historial de adjudicaciones de tu RUT.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#FCD34D', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(245,158,11,0.3)' }}>
              GET /api/v1/mercado-publico/ai/recomendaciones/:rut (40 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(245,158,11,0.18)' }}>
            <div style={{ display: 'flex', gap: 10, maxWidth: 500, marginBottom: 20 }}>
              <input
                type="text"
                value={supplierRutInput}
                onChange={(e) => setSupplierRutInput(e.target.value)}
                placeholder="RUT Proveedor (Ej: 76.543.210-K)"
                style={{ flex: 1, background: '#090914', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E8E7F5', fontFamily: 'monospace', fontWeight: 700 }}
              />
              <button 
                onClick={() => {
                  setLoadingRecom(true);
                  setTimeout(() => {
                    setLoadingRecom(false);
                    showToast(`✓ Oportunidades personalizadas recomendadas para ${supplierRutInput}`);
                  }, 400);
                }}
                disabled={loadingRecom}
                style={{ background: '#F59E0B', color: '#000', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw style={{ width: 14, height: 14, animation: loadingRecom ? 'spin 1s linear infinite' : 'none' }} />
                {loadingRecom ? 'Buscando...' : 'Obtener Recomendaciones'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recommendationsData.items.map((item, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5' }}>{item.title} ({item.code})</div>
                    <div style={{ fontSize: 11.5, color: '#9896B8', marginTop: 4 }}>Comprador: <strong>{item.buyer}</strong> · Presupuesto Est: {item.amount}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ background: 'rgba(34,197,94,0.15)', color: '#4ADE80', padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 900 }}>
                      {item.match} Match AI
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Convenios Marco */}
      {activeSubTab === 'convenios' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers style={{ width: 20, height: 20, color: '#60A5FA' }} /> 4. Catálogo Unificado de Convenios Marco (Framework Agreements API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Consulta precios pactados y lista de tiendas virtuales oficiales de ChileCompra.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.15)', color: '#60A5FA', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(59,130,246,0.3)' }}>
              GET /api/v1/mercado-publico/convenio-marco (25 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(59,130,246,0.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: '2239-4-LR24', title: 'Convenio Marco Movilidad y Vehículos 2024-2028', validity: '31/12/2028', suppliers: 42 },
                { id: '2239-1-LR25', title: 'Convenio Marco Adquisición de Software & Cloud', validity: '30/06/2027', suppliers: 128 }
              ].map((cm, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5' }}>{cm.title}</div>
                    <code style={{ fontSize: 11, color: '#60A5FA', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 4 }}>ID: {cm.id}</code>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11.5, color: '#D4D2F0', display: 'block' }}>Vigencia: {cm.validity}</span>
                    <span style={{ fontSize: 11, color: '#4ADE80', fontWeight: 800 }}>{cm.suppliers} Proveedores Adjudicados</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Grandes Compras */}
      {activeSubTab === 'grandes-compras' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart style={{ width: 20, height: 20, color: '#F472B6' }} /> 5. Grandes Compras dentro de Convenio Marco (&gt; 1.000 UTM)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Monitorea cotizaciones obligatorias iniciadas por el Estado para compras masivas.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(236,72,153,0.15)', color: '#F472B6', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(236,72,153,0.3)' }}>
              GET /api/v1/mercado-publico/grandes-compras (30 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(236,72,153,0.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { code: 'GC-1057469', title: 'Adquisición Flota Vehículos Eléctricos Municipalidad', buyer: 'Muni Santiago', amount: '$240.000.000 CLP' },
                { code: 'GC-2089123', title: 'Licenciamiento Anual Cloud Enterprise Minsal', buyer: 'MINSAL', amount: '$180.000.000 CLP' }
              ].map((gc, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(236,72,153,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5' }}>{gc.title}</div>
                    <span style={{ fontSize: 11.5, color: '#9896B8' }}>Comprador: {gc.buyer} · ID: <code>{gc.code}</code></span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#F472B6' }}>{gc.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Consultas al Mercado */}
      {activeSubTab === 'consultas' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(14,181,198,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle style={{ width: 20, height: 20, color: '#0EB5C6' }} /> 6. Consultas al Mercado &amp; RFIs (Market Inquiry API)
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Sondeos previos publicados por organismos para estructurar presupuestos y bases de futuras licitaciones.
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(14,181,198,0.15)', color: '#0EB5C6', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(14,181,198,0.3)' }}>
              GET /api/v1/mercado-publico/consultas-mercado (20 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(14,181,198,0.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { code: 'RFI-608-2024', title: 'Sondeo de Mercado Radares Aeronáuticos 3D', buyer: 'DGAC', closing: '28/08/2026' },
                { code: 'RFI-120-2026', title: 'Estudio de Precios Sistema IA Diagnóstico Urgencias', buyer: 'Servicio Salud Sur Oriente', closing: '05/09/2026' }
              ].map((rfi, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(14,181,198,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5' }}>{rfi.title}</div>
                    <span style={{ fontSize: 11.5, color: '#9896B8' }}>Comprador: {rfi.buyer} · Code: <code>{rfi.code}</code></span>
                  </div>
                  <span style={{ fontSize: 11.5, color: '#0EB5C6', fontWeight: 800 }}>Cierra: {rfi.closing}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. Tratos Directos */}
      {activeSubTab === 'tratos-directos' && (
        <div style={{ background: '#0B0B16', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#E8E7F5', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ width: 20, height: 20, color: '#F87171' }} /> 7. Monitor de Tratos Directos &amp; Excepciones de Contratación
              </h3>
              <p style={{ fontSize: 13, color: '#9896B8', margin: '4px 0 0' }}>
                Auditoría de asignaciones directas por causal de emergencia o proveedor único (Art. 8 Ley 19.886).
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#F87171', padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(239,68,68,0.3)' }}>
              GET /api/v1/mercado-publico/tratos-directos (35 cr)
            </span>
          </div>

          <div style={{ background: '#05050C', padding: 20, borderRadius: 16, border: '1px solid rgba(239,68,68,0.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { code: 'TD-1266-9', title: 'Reparación Emergencia Servidores Datacenter SII', buyer: 'SII', causal: 'Art. 8 Letra C - Emergencia', amount: '$45.000.000 CLP' },
                { code: 'TD-990-2026', title: 'Servicios de Seguridad y Vigilancia Especializada', buyer: 'MINVU', causal: 'Art. 8 Letra E - Confidencialidad', amount: '$32.000.000 CLP' }
              ].map((td, idx) => (
                <div key={idx} style={{ background: '#090914', padding: 16, borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E8E7F5' }}>{td.title}</div>
                    <span style={{ fontSize: 11.5, color: '#F87171' }}>Causal Fundada: <strong>{td.causal}</strong></span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#F87171' }}>{td.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
