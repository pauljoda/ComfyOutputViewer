import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client')
    }
  },
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
