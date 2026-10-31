import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// KS_BASE lets the app be hosted under a sub-path (e.g. inside a sandbox preview
// at /app/) without changing the local development experience.
const base = process.env.KS_BASE || '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
    proxy: { '/api': process.env.KS_API_TARGET || 'http://127.0.0.1:5000' }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1800
  }
});
