import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, '../../validateai/supabase/migrations/20260727000001_create_company_ownership_tables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.szzibobuwgcopewmnkkl:xuX8tjlNBTuG67gP@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const SAMPLE_PROFILES = [
  {
    rut: '76.543.210-K',
    legal_name: 'Electromedicina Chile SpA',
    fantasy_name: 'Electromedicina CL',
    company_type: 'SpA',
    constitution_date: '2018-04-12',
    social_capital_clp: 150000000.0,
    sii_status: 'activo',
    diario_oficial_cve: 'CVE-2018-45129',
    cbr_inscription: 'Fojas 124 N° 89 Registro Comercio Santiago 2018'
  },
  {
    rut: '77.888.999-1',
    legal_name: 'Sistemas e Informática Chile SpA',
    fantasy_name: 'SysInfo Chile',
    company_type: 'SpA',
    constitution_date: '2020-09-01',
    social_capital_clp: 80000000.0,
    sii_status: 'activo',
    diario_oficial_cve: 'CVE-2020-99812',
    cbr_inscription: 'Fojas 450 N° 312 Registro Comercio Santiago 2020'
  },
  {
    rut: '96.111.444-5',
    legal_name: 'Mobiliario Corporativo Chile S.A.',
    fantasy_name: 'Mobileria Corporativa',
    company_type: 'SA',
    constitution_date: '2012-01-15',
    social_capital_clp: 500000000.0,
    sii_status: 'activo',
    diario_oficial_cve: 'CVE-2012-00123',
    cbr_inscription: 'Fojas 890 N° 612 Registro Comercio Valparaíso 2012'
  },
  {
    rut: '76.888.111-K',
    legal_name: 'SecOps Experts SpA',
    fantasy_name: 'SecOps Cyber',
    company_type: 'SpA',
    constitution_date: '2021-06-20',
    social_capital_clp: 45000000.0,
    sii_status: 'activo',
    diario_oficial_cve: 'CVE-2021-66712',
    cbr_inscription: 'Fojas 210 N° 155 Registro Comercio Concepción 2021'
  }
];

const SAMPLE_MESHES = [
  // Electromedicina Chile SpA
  { target_rut: '76.543.210-K', partner_rut: '14.567.890-2', partner_name: 'Luciano Alonso Larraín', partner_type: 'person', ownership_percentage: 60.0, role: 'shareholder', entry_date: '2018-04-12' },
  { target_rut: '76.543.210-K', partner_rut: '14.567.890-2', partner_name: 'Luciano Alonso Larraín', partner_type: 'person', ownership_percentage: 0.0, role: 'legal_representative', entry_date: '2018-04-12' },
  { target_rut: '76.543.210-K', partner_rut: '76.999.000-8', partner_name: 'Inversiones Médicas del Sur SpA', partner_type: 'company', ownership_percentage: 40.0, role: 'shareholder', entry_date: '2019-11-15' },

  // SysInfo Chile
  { target_rut: '77.888.999-1', partner_rut: '15.678.901-3', partner_name: 'Camila Valenzuela Soto', partner_type: 'person', ownership_percentage: 50.0, role: 'shareholder', entry_date: '2020-09-01' },
  { target_rut: '77.888.999-1', partner_rut: '15.678.901-3', partner_name: 'Camila Valenzuela Soto', partner_type: 'person', ownership_percentage: 0.0, role: 'legal_representative', entry_date: '2020-09-01' },
  { target_rut: '77.888.999-1', partner_rut: '16.789.012-4', partner_name: 'Rodrigo Morales Peña', partner_type: 'person', ownership_percentage: 50.0, role: 'shareholder', entry_date: '2020-09-01' }
];

async function run() {
  try {
    console.log('Conectando a PostgreSQL...');
    await client.connect();

    console.log('Aplicando migración SQL 20260727000001_create_company_ownership_tables.sql...');
    await client.query(sql);
    console.log('✅ Tablas company_profiles y company_ownership_meshes creadas.');

    console.log('Poblando perfiles de prueba en company_profiles...');
    for (const p of SAMPLE_PROFILES) {
      await client.query(`
        INSERT INTO public.company_profiles (rut, legal_name, fantasy_name, company_type, constitution_date, social_capital_clp, sii_status, diario_oficial_cve, cbr_inscription)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (rut) DO UPDATE SET
          legal_name = EXCLUDED.legal_name,
          social_capital_clp = EXCLUDED.social_capital_clp,
          updated_at = NOW();
      `, [p.rut, p.legal_name, p.fantasy_name, p.company_type, p.constitution_date, p.social_capital_clp, p.sii_status, p.diario_oficial_cve, p.cbr_inscription]);
    }

    console.log('Poblando mallas societarias en company_ownership_meshes...');
    for (const m of SAMPLE_MESHES) {
      await client.query(`
        INSERT INTO public.company_ownership_meshes (target_rut, partner_rut, partner_name, partner_type, ownership_percentage, role, entry_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [m.target_rut, m.partner_rut, m.partner_name, m.partner_type, m.ownership_percentage, m.role, m.entry_date]);
    }

    console.log('✅ S-Pulse DB poblado exitosamente.');
    await client.query("NOTIFY pgrst, 'reload schema';");

    const res = await client.query('SELECT count(*) FROM public.company_profiles;');
    console.log('Total perfiles societarios en DB:', res.rows[0].count);

    await client.end();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
