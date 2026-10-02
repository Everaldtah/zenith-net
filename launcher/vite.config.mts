import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'src/renderer'),
  envDir: import.meta.dirname,
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: path.resolve(import.meta.dirname, 'dist/renderer'), emptyOutDir: true, target: 'chrome130', assetsInlineLimit: 0 },
});
