import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { LEGAL_BANNER } from './build-banner.ts';

export default defineConfig({
  plugins: [preact()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2019',
    sourcemap: true,
    emptyOutDir: false,
    lib: {
      entry: 'src/auto.ts',
      name: 'PulxonWidget',
      formats: ['iife'],
      fileName: () => 'pulxon.min.js',
    },
    rolldownOptions: { output: { postBanner: LEGAL_BANNER } },
  },
});
