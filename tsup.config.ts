import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'next', 'axios'],
  target: 'es2020',
  platform: 'browser',
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";\n'
    };
  },
  splitting: false,
  sourcemap: true,
  // Ensure proper file naming
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs'
    };
  }
});