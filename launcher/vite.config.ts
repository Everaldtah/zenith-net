import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  envDir: __dirname,
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: path.resolve(__dirname, 'dist/renderer'), emptyOutDir: true, target: 'chrome130', assetsInlineLimit: 0 },
});
