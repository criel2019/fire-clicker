import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/fire-clicker/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    open: true,
  },
});
