import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// `vite build --mode html` lager én selvstendig BarFlow.html i dist-html/
export default defineConfig(({ mode }) => ({
  plugins: mode === 'html' ? [react(), viteSingleFile()] : [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: mode === 'html' ? 'dist-html' : 'dist',
    chunkSizeWarningLimit: 4000,
  },
}));
