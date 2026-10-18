import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
    typecheck: { enabled: true, include: ['packages/*/src/**/*.test-d.ts'], tsconfig: './tsconfig.json' },
  },
});
