import { svelte } from '@sveltejs/vite-plugin-svelte';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    typecheck: { enabled: true, include: ['packages/*/src/**/*.test-d.ts'], tsconfig: './tsconfig.json' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
          exclude: ['packages/svelte/**', 'packages/solid/**'],
        },
      },
      {
        plugins: [svelte()],
        resolve: { conditions: ['browser'] },
        test: { name: 'svelte', include: ['packages/svelte/test/**/*.test.svelte.ts'], environment: 'jsdom' },
      },
      {
        plugins: [solid({ hot: false })],
        resolve: { conditions: ['solid', 'browser'] },
        test: { name: 'solid', include: ['packages/solid/test/**/*.test.tsx'], environment: 'jsdom' },
      },
    ],
  },
});
