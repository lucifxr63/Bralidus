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
        target: 'https://szzibobuwgcopewmnkkl.supabase.co/functions/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/supabase-api/, ''),
      },
    },
  },
});
