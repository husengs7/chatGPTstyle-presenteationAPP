import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
// PDF.js assets are served locally, including Japanese CMaps and image codecs.
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  mkdirSync('public/pdfjs', { recursive: true });
  cpSync(`node_modules/pdfjs-dist/${folder}`, `public/pdfjs/${folder}`, { recursive: true });
}
export default defineConfig({ base: './', plugins: [react()] });
