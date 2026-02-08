import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8008,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8009',
      '/images': 'http://localhost:8009'
    },
    allowedHosts: ['comfy-viewer.pauljoda.com', 'localhost']
  },
  preview: {
    port: 8008,
    strictPort: true,
    host: '0.0.0.0'
  }
});
