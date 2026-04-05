import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],  // Both formats for compatibility
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'next', 'axios'],
  target: 'es2020',
  platform: 'browser',
  esbuildOptions(options) {
    // This MUST be here
    options.banner = {
      js: '"use client";\n'
    };
  },
});