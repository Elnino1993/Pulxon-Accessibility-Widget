/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { LEGAL_BANNER } from './build-banner.ts';

export default defineConfig({
  plugins: [preact()],
  build: {
    target: 'es2019',
    sourcemap: true,
    emptyOutDir: true,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    // npm consumers install preact themselves; the IIFE build (vite.iife.config.ts) still bundles it.
    rolldownOptions: { external: [/^preact(\/.*)?$/], output: { postBanner: LEGAL_BANNER } },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
