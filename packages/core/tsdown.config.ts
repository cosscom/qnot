import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/formats/*.ts', '!src/**/*.test*.ts'],
  format: 'esm',
  dts: true,
  clean: true,
});
