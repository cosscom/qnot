// Tests for the UI kits: `npx vitest run -c src/kits/vitest.config.ts` from apps/web.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('..', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['src/kits/**/*.test.tsx'] },
});
