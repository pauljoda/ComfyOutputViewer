import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = [
  'localhost',
  '127.0.0.1',
  '.local',
  'comfy-viewer.pauljoda.com'
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8008,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts,
    proxy: {
      '/api': 'http://localhost:8009',
      '/images': 'http://localhost:8009'
    }
  },
  preview: {
    port: 8008,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts
  }
});
