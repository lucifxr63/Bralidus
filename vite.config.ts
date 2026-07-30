import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const BUILD_VERSION = Date.now().toString();

// Genera un archivo public/version.json con timestamp único de compilación
const versionPlugin = () => {
  return {
    name: 'vite-plugin-version',
    buildStart() {
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(publicDir, 'version.json'),
        JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString() }, null, 2)
      );
    },
  };
};

// Vercel expone sus variables de sistema tambien con el prefijo del framework
// (VITE_VERCEL_*), y Vite inlinea TODO lo que empiece con VITE_ en el bundle
// publico. Resultado: el mensaje de commit completo, el autor, el SHA, el branch
// y los IDs de proyecto quedaban legibles en /assets/index-*.js para cualquiera
// que abriera el sitio.
//
// El commit message es lo que mas pesa: en este repo son largos y describen
// infraestructura, secrets faltantes y fallas conocidas — un mapa para quien
// quiera buscarle el lado flojo.
//
// Ninguna de las 19 se consume en el codigo, asi que se vacian en build. Si
// alguna vez se necesita una, hay que leerla explicitamente y asumir que es
// publica. El arreglo durable es apagar "Automatically expose System
// Environment Variables" en el proyecto de Vercel; esto es el cinturon.
const vercelEnvVacias = Object.fromEntries(
  Object.keys(process.env)
    .filter((k) => k.startsWith('VITE_VERCEL_'))
    .map((k) => [`import.meta.env.${k}`, '""']),
);

export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(BUILD_VERSION),
    ...vercelEnvVacias,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/supabase-api': {
        target: 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/supabase-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            if (proxyRes.statusCode && proxyRes.statusCode >= 500) {
              // Si la Edge Function remota devuelve 500, interceptar y devolver 200 OK con array vacío
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
              });
              res.end(JSON.stringify({
                data: [],
                meta: { source: 'bralidus_dev_proxy', status: 'upstream_degraded_no_fake_data' }
              }));
            }
          });
        }
      },
    },
  },
});
