// Prebuilds the non-React renderers for the playground's framework switcher. Next.js can't compile
// Svelte or Solid, so each island is an ES module in public/islands exposing
// `mount(el, store) => dispose`, loaded at runtime with a bundler-ignored dynamic import. The store
// object comes from the page, so islands never bundle React.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  plugins: [svelte(), solid({ include: [/islands\/solid\.tsx$/, /packages\/solid\/src\/.*\.tsx$/] })],
  resolve: { dedupe: ['vue', 'svelte', 'solid-js'], conditions: ['svelte', 'solid', 'browser', 'module', 'import', 'default'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  logLevel: 'warn',
  build: {
    outDir: here('../public/islands'),
    emptyOutDir: true,
    target: 'es2022',
    minify: true,
    lib: {
      entry: { dom: here('dom.ts'), vue: here('vue.ts'), svelte: here('svelte.ts'), solid: here('solid.tsx') },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
});
