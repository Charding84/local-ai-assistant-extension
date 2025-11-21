import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'src/ui/dashboard/index.html'),
        options: resolve(__dirname, 'src/ui/options/index.html'),
        serviceWorker: resolve(__dirname, 'src/background/serviceWorker.ts'),
        contentBootstrap: resolve(__dirname, 'src/content/contentBootstrap.ts'),
        transformWorker: resolve(__dirname, 'src/workers/transformWorker.ts'),
        nlpWorker: resolve(__dirname, 'src/workers/nlpWorker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
