import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, '../../validateai/supabase/migrations/20260727000000_create_licitaciones_mercado_publico.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.szzibobuwgcopewmnkkl:xuX8tjlNBTuG67gP@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Conectando a PostgreSQL para aplicar migración...');
    await client.connect();
    console.log('Aplicando migración SQL 20260727000000_create_licitaciones_mercado_publico.sql...');
    await client.query(sql);
    console.log('✅ Migración aplicada exitosamente. Tabla licitaciones_mercado_publico creada.');

    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('✅ Notificado a PostgREST para recargar esquema.');

    const res = await client.query('SELECT COUNT(*) FROM public.licitaciones_mercado_publico;');
    console.log('Conteo inicial de licitaciones:', res.rows[0].count);

    await client.end();
  } catch (err) {
    console.error('❌ Error aplicando migración:', err);
    process.exit(1);
  }
}

run();
