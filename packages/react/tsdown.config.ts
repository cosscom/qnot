import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  fixedExtension: false,
  external: ['react', 'react/jsx-runtime', '@trawlnet/core'],
});
