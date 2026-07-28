import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
