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

export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(BUILD_VERSION),
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
