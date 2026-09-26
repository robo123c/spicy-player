import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['electron', 'express', 'axios', 'music-metadata', 'howler'],
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: true,
  },
});
