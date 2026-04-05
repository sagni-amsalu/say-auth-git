import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'next', 'axios'],
  target: 'es2020',
  platform: 'browser',
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";'
    };
  },
  treeshake: true,
  minify: false,
});