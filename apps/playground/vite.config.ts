import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// React and Solid both compile .tsx, so each owns a disjoint set of files.
const solidFiles = [/packages\/solid\/src\/.*\.tsx$/, /src\/islands\/solid\/.*\.tsx$/];

export default defineConfig({
  plugins: [react({ exclude: solidFiles }), solid({ include: solidFiles }), svelte(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom', 'vue', 'svelte', 'solid-js'],
  },
});
