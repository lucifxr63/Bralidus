import pg from 'pg';
import { config } from 'dotenv';
config({ path: new URL('../.env.local', import.meta.url) });

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OPPORTUNITIES = [
  {
    external_code: '2422-131-L126',
    title: 'S.A 945553 SERVICIO DE PLATAFORMA DE SOLUCION DIGITAL.',
    buyer_name: 'SERVICIO DE SALUD METROPOLITANO SUR ORIENTE',
    source_type: 'tender',
    status_code: 'publicada',
    amount_estimated: 25000000.0,
    currency: 'CLP',
    published_at: '2026-07-27T10:00:00Z',
    closing_at: '2026-08-03T15:02:00Z',
    category: 'Salud / Tecnología Digital',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=2422-131-L126'
  },
  {
    external_code: 'COT-78401',
    title: 'ADQUISICION AGIL DE INSUMOS DE OFICINA Y TONER CIAN/MAGENTA PARA SECRETARIA MUNICIPAL',
    buyer_name: 'ILUSTRE MUNICIPALIDAD DE PROVIDENCIA',
    source_type: 'agile_purchase',
    status_code: 'publicada',
    amount_estimated: 1850000.0,
    currency: 'CLP',
    published_at: '2026-07-27T10:00:00Z',
    closing_at: '2026-07-29T18:00:00Z',
    category: 'Compra Ágil / Insumos',
    official_url: 'https://www.mercadopublico.cl/CompraAgil/Ficha/COT-78401'
  },
  {
    external_code: '2254-20-B124',
    title: 'LICITACION PRIVADA DE SERVICIOS AUDITORIA DE SEGURIDAD VULNERABILIDADES KUBERNETES',
    buyer_name: 'Subsecretaría de Redes Asistenciales - MINSAL',
    source_type: 'private_tender',
    status_code: 'publicada',
    amount_estimated: 35000000.0,
    currency: 'CLP',
    published_at: '2026-07-25T08:15:00Z',
    closing_at: '2026-08-15T18:00:00Z',
    category: 'Licitación Privada / Ciberseguridad',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=2254-20-B124'
  },
  {
    external_code: 'CM-22345',
    title: 'COMPRA CATALOGO CONVENIO MARCO MOBILIARIO DE OFICINA Y SILLAS ERGONOMICAS ERGO-PLUS',
    buyer_name: 'FONDO NACIONAL DE SALUD (FONASA)',
    source_type: 'convenio_marco',
    status_code: 'adjudicada',
    amount_estimated: 12400000.0,
    currency: 'CLP',
    published_at: '2026-07-20T11:00:00Z',
    closing_at: '2026-07-22T14:00:00Z',
    category: 'Convenio Marco / Catálogo',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=CM-22345'
  },
  {
    external_code: 'GC-1057469',
    title: 'GRAN COMPRA CONVENIO MARCO ADQUISICION DE VEHICULOS ELECTRICOS PARA FLOTA MUNICIPAL',
    buyer_name: 'Ilustre Municipalidad de Santiago',
    source_type: 'grandes_compras',
    status_code: 'adjudicada',
    amount_estimated: 240000000.0,
    currency: 'CLP',
    published_at: '2026-07-15T14:00:00Z',
    closing_at: '2026-07-25T17:00:00Z',
    category: 'Grandes Compras (> 1.000 UTM)',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=GC-1057469'
  },
  {
    external_code: 'TD-1266-9',
    title: 'TRATO DIRECTO POR CAUSAL DE EMERGENCIA MANTENCION REPARACION URGENTE SERVIDORES SII',
    buyer_name: 'Servicio de Impuestos Internos (SII)',
    source_type: 'trato_directo',
    status_code: 'publicada',
    amount_estimated: 45000000.0,
    currency: 'CLP',
    published_at: '2026-07-26T07:45:00Z',
    closing_at: '2026-08-05T16:00:00Z',
    category: 'Trato Directo / Emergencia',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=TD-1266-9'
  },
  {
    external_code: 'RFI-608-2024',
    title: 'CONSULTA AL MERCADO (RFI) ESTUDIO DE PRECIOS Y DISPONIBILIDAD DE RADARES AERONAUTICOS DGAC',
    buyer_name: 'Dirección General de Aeronáutica Civil (DGAC)',
    source_type: 'consulta_mercado',
    status_code: 'publicada',
    amount_estimated: 0.0,
    currency: 'CLP',
    published_at: '2026-07-24T10:00:00Z',
    closing_at: '2026-08-10T12:00:00Z',
    category: 'Consulta Mercado / RFI',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=RFI-608-2024'
  },
  {
    external_code: 'CTR-1658-01',
    title: 'CONTRATO PUBLICO Y HITOS DE PAGO AUDITORIA MACROECONOMICA Y FACTIBILIDAD MINVU',
    buyer_name: 'Ministerio de Vivienda y Urbanismo (MINVU)',
    source_type: 'contrato_publico',
    status_code: 'adjudicada',
    amount_estimated: 48000000.0,
    currency: 'CLP',
    published_at: '2026-07-01T12:00:00Z',
    closing_at: '2026-12-31T18:00:00Z',
    category: 'Gestión de Contratos',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=CTR-1658-01'
  },
  {
    external_code: 'CPI-2026-01',
    title: 'COMPRA DE INNOVACION (CPI) Y DIALOGO COMPETITIVO PARA PLATAFORMA IA PREDICTIVA DE SALUD',
    buyer_name: 'SERVICIO DE SALUD METROPOLITANO SUR ORIENTE',
    source_type: 'nuevos_mecanismos',
    status_code: 'publicada',
    amount_estimated: 180000000.0,
    currency: 'CLP',
    published_at: '2026-07-27T09:00:00Z',
    closing_at: '2026-09-15T18:00:00Z',
    category: 'Ley 21.634 / Innovación',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=CPI-2026-01'
  },
  {
    external_code: '1230848-50-LE26',
    title: 'ADQUISICIÓN DE MATERIAL GRÁFICO Y DIFUSIÓN INSTITUCIONAL 2026',
    buyer_name: 'SUBSECRETARÍA DE DESARROLLO REGIONAL Y ADMINISTRATIVO',
    source_type: 'tender',
    status_code: 'publicada',
    amount_estimated: 50000000.0,
    currency: 'CLP',
    published_at: '2026-07-27T08:15:00Z',
    closing_at: '2026-08-10T15:00:00Z',
    category: 'Gobierno / Imprenta y Diseño',
    official_url: 'https://www.mercadopublico.cl/BuscarLicitacion?q=1230848-50-LE26'
  }
];

async function run() {
  try {
    console.log('Conectando a PostgreSQL...');
    await client.connect();

    for (const item of OPPORTUNITIES) {
      const query = `
        INSERT INTO public.licitaciones_mercado_publico (
          external_code, title, buyer_name, source_type, status_code,
          amount_estimated, currency, published_at, closing_at, category, official_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (external_code) DO UPDATE SET
          title = EXCLUDED.title,
          buyer_name = EXCLUDED.buyer_name,
          source_type = EXCLUDED.source_type,
          status_code = EXCLUDED.status_code,
          amount_estimated = EXCLUDED.amount_estimated,
          published_at = EXCLUDED.published_at,
          closing_at = EXCLUDED.closing_at,
          category = EXCLUDED.category,
          official_url = EXCLUDED.official_url,
          updated_at = NOW();
      `;

      await client.query(query, [
        item.external_code, item.title, item.buyer_name, item.source_type, item.status_code,
        item.amount_estimated, item.currency, item.published_at, item.closing_at, item.category, item.official_url
      ]);
    }

    console.log('✅ ¡Poblado inicial exitoso! Todos los 9 mecanismos están insertados en Supabase PostgreSQL.');

    const res = await client.query('SELECT source_type, COUNT(*) FROM public.licitaciones_mercado_publico GROUP BY source_type;');
    console.log('Desglose por mecanismo en BD real:', res.rows);

    await client.end();
  } catch (err) {
    console.error('❌ Error registrando licitaciones:', err);
    process.exit(1);
  }
}

run();
