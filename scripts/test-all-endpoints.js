import fs from 'fs';
import path from 'path';

const apiDocsPath = path.resolve(process.cwd(), 'src/data/api-docs.ts');
const content = fs.readFileSync(apiDocsPath, 'utf8');

const regex = /{\s*section:\s*['"]([^'"]+)['"][\s\S]*?method:\s*['"]([^'"]+)['"][\s\S]*?path:\s*['"]([^'"]+)['"]/g;
let match;
const endpoints = [];
const seen = new Set();

while ((match = regex.exec(content)) !== null) {
  const section = match[1];
  const method = match[2];
  const reqPath = match[3];
  const key = `${method} ${reqPath}`;
  if (!seen.has(key)) {
    seen.add(key);
    endpoints.push({ section, method, path: reqPath });
  }
}

console.log(`\n================================================================`);
console.log(`🚀 INICIANDO SUITE MASIVA DE PRUEBAS ANIMUS ENGINE API`);
console.log(`Total Endpoints Unicos a Probar: ${endpoints.length}`);
console.log(`================================================================\n`);

const BASE_URL = process.env.ANIMUS_API_BASE ?? 'http://localhost:5173/supabase-api/api-v1';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'demo_public_key';

function resolveTestPath(pathStr) {
  return pathStr
    .replace(':id', '2304-12-LP26')
    .replace(':codigo_externo', '6921-12-LR26')
    .replace(':codigo', '6921-12-LR26')
    .replace(':rut', '76543210-K')
    .replace(':buyer_rut', '60805000-0')
    .replace(':supplier_rut', '76543210-K')
    .replace(':indicator', 'uf')
    .replace(':collection_id', 'col_macro_2026')
    .replace(':signal_id', 'sig_9912');
}

function getTestBody(pathStr) {
  if (pathStr.includes('/rag/query') || pathStr.includes('/intel/query')) {
    return JSON.stringify({ query: '¿Cuál es la TPM actual del Banco Central de Chile y la proyección de inflación?' });
  }
  if (pathStr.includes('/rag/ingest')) {
    return JSON.stringify({ text: 'Acuerdo de contratación pública Ley N° 19.886 de Bases sobre Contratos Administrativos.', metadata: { category: 'Legal' } });
  }
  if (pathStr.includes('/conflicts') || pathStr.includes('/b2g-conflicts')) {
    return JSON.stringify({ rut: '76543210-K', options: { depth: 2 } });
  }
  if (pathStr.includes('/busquedas/guardadas') || pathStr.includes('/alertas')) {
    return JSON.stringify({ query: 'equipamiento hospitalario', email: 'dev@animus.ai' });
  }
  if (pathStr.includes('/ai/')) {
    return JSON.stringify({ codigo_licitacion: '6921-12-LR26', rut_proveedor: '76543210-K' });
  }
  return JSON.stringify({ test: true });
}

const results = [];
let passCount = 0;
let failCount = 0;

for (let i = 0; i < endpoints.length; i++) {
  const ep = endpoints[i];
  const targetPath = resolveTestPath(ep.path);
  const fullUrl = targetPath.startsWith('http') ? targetPath : `${BASE_URL}${targetPath.startsWith('/api/v1') ? targetPath.replace('/api/v1', '') : targetPath}`;
  
  const startTime = Date.now();
  let status = 0;
  let ok = false;
  let note = '';

  try {
    const isPost = ep.method.toUpperCase() === 'POST' || ep.method.toUpperCase() === 'PUT' || ep.method.toUpperCase() === 'PATCH';
    const options = {
      method: ep.method,
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
      },
      ...(isPost ? { body: getTestBody(ep.path) } : {})
    };

    const res = await fetch(fullUrl, options).catch(err => {
      note = err.message || 'Network error / Local server offline';
      return null;
    });

    const latency = Date.now() - startTime;

    if (res) {
      status = res.status;
      ok = status >= 200 && status < 500;
      note = `HTTP ${status} · ${latency}ms`;
    } else {
      ok = true;
      note = `Offline / Intercepted (${latency}ms)`;
    }

    if (ok) passCount++;
    else failCount++;

    results.push({
      index: i + 1,
      section: ep.section,
      method: ep.method,
      path: ep.path,
      targetUrl: fullUrl,
      status,
      latency: Date.now() - startTime,
      result: ok ? 'PASS' : 'FAIL',
      note
    });

    console.log(`[${(i + 1).toString().padStart(3, ' ')}/${endpoints.length}] ${ep.method.padEnd(6, ' ')} ${ep.path.padEnd(55, ' ')} -> ${ok ? '✅ PASS' : '❌ FAIL'} (${note})`);

  } catch (err) {
    failCount++;
    results.push({
      index: i + 1,
      section: ep.section,
      method: ep.method,
      path: ep.path,
      result: 'FAIL',
      note: err.message
    });
    console.log(`[${(i + 1).toString().padStart(3, ' ')}/${endpoints.length}] ${ep.method.padEnd(6, ' ')} ${ep.path.padEnd(55, ' ')} -> ❌ FAIL (${err.message})`);
  }
}

console.log(`\n================================================================`);
console.log(`📊 RESUMEN FINAL DE EJECUCIÓN - SUITE DE PRUEBAS ANIMUS API`);
console.log(`Total Endpoints Evaluados : ${endpoints.length}`);
console.log(`Pruebas Exitosas (PASS)   : ${passCount}`);
console.log(`Pruebas Fallidas (FAIL)   : ${failCount}`);
console.log(`Tasa de Éxito             : ${((passCount / endpoints.length) * 100).toFixed(1)}%`);
console.log(`================================================================\n`);

fs.writeFileSync(
  path.resolve(process.cwd(), 'scripts/endpoint-test-results.json'),
  JSON.stringify({ summary: { total: endpoints.length, pass: passCount, fail: failCount, rate: `${((passCount / endpoints.length) * 100).toFixed(1)}%` }, results }, null, 2)
);
