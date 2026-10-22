import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app lives in web/ and imports the shared protocol client from src/.
// Relative base so the same build works at aryamans.me/<repo>/, at a site root,
// or anywhere else GitHub Pages puts it.
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
