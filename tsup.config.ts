import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'next', 'axios'],
  target: 'es2022',
  platform: 'browser',
  splitting: false,
  sourcemap: true,
  treeshake: true,
  esbuildOptions(options) {
    // Force "use client" at the very top of the output
    options.banner = {
      js: '"use client";\n'
    };
  },
});