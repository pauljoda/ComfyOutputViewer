import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/client/test/setup.ts'],
    include: ['src/client/**/*.test.{ts,tsx}'],
    css: true,
    clearMocks: true,
    restoreMocks: true
  }
});
