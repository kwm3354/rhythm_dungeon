import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true,
    allowedHosts: true,
  },
  build: {
    target: 'esnext',
    minify: 'terser',
  },
});
