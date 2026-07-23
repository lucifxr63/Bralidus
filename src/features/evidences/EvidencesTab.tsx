import { BralidusEvidenceWall } from '@/components/BralidusEvidenceWall';

export function EvidencesTab() {
  return (
    <BralidusEvidenceWall
      evidences={[
        { claim: 'Tasa de Política Monetaria (TPM) fijada por el Banco Central de Chile', shape: 'financial', date: '2026-05-15', indicator: 'TPM BCCh', value: 5.75, unit: '%', source: 'Banco Central de Chile', source_url: 'https://www.bcentral.cl' },
        { claim: 'Variación acumulada del Índice de Precios al Consumidor (IPC)', shape: 'financial', date: '2026-05-01', indicator: 'IPC Anual', value: 4.2, unit: '%', source: 'Instituto Nacional de Estadísticas (INE)', source_url: 'https://www.ine.gob.cl' },
        { claim: 'Regulación de Plataformas de Financiamiento Colectivo (Ley Fintech 21.521)', shape: 'doctrine', entity_value: 'Ley Fintech N° 21.521', dimension: 'Compliance Regulatorio CMF', source: 'Comisión para el Mercado Financiero' },
        { claim: 'Umbral de ventas formales para elegibilidad en fondos Corfo Semilla Expande', shape: 'doctrine', entity_value: 'Bases Corfo SIE', dimension: 'Financiamiento Público', threshold: 100000, source: 'Corfo Chile' },
      ]}
      alerts={[{ title: 'Sensibilidad a tasa de interés en startups de crédito B2B', severity: 'warning', description: 'Variaciones en TPM afectan directamente el costo de capital de financiamiento.' }]}
      dataFreshness={{ 'BCCh': '2026-05-15', 'CMF': '2026-05-20' }}
    />
  );
}
