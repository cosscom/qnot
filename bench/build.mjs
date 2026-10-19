import * as esbuild from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

export const ADAPTERS = ['qnot', 'qnot-dom', 'proto', 'proto-vanilla', 'rqb', 'raqb', 'jqqb', 'syncfusion', 'devextreme'];
mkdirSync('dist', { recursive: true });

// Reference bundle: React + ReactDOM rendering one element, to subtract from React-based libraries.
writeFileSync('dist/_react-baseline.tsx', `import { createRoot } from 'react-dom/client';\ncreateRoot(document.body).render(<div>hi</div>);`);

const sizes = {};
const gz = (f) => (existsSync(f) ? gzipSync(readFileSync(f), { level: 9 }).length : 0);
const raw = (f) => (existsSync(f) ? readFileSync(f).length : 0);

for (const name of [...ADAPTERS, '_react-baseline']) {
  const entry = name.startsWith('_') ? `dist/${name}.tsx` : `src/adapters/${name}.${existsSync(`src/adapters/${name}.tsx`) ? 'tsx' : 'ts'}`;
  await esbuild.build({
    entryPoints: { [name]: entry },
    bundle: true,
    minify: true,
    format: 'esm',
    splitting: false,
    target: 'es2022',
    outdir: 'dist',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.woff': 'file', '.woff2': 'file', '.ttf': 'file', '.eot': 'file', '.svg': 'file', '.png': 'file', '.gif': 'file' },
    assetNames: 'assets/[name]-[hash]',
    logLevel: 'warning',
  });
  writeFileSync(
    `dist/${name}.html`,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${name}.css"></head>` +
      `<body><div id="root"></div><script type="module" src="${name}.js"></script></body></html>`,
  );
  sizes[name] = { js: raw(`dist/${name}.js`), jsGz: gz(`dist/${name}.js`), css: raw(`dist/${name}.css`), cssGz: gz(`dist/${name}.css`) };
}
writeFileSync('dist/sizes.json', JSON.stringify(sizes, null, 2));
// Committed snapshot the website reads at build time (dist/ is gitignored).
writeFileSync('results/sizes.json', JSON.stringify(sizes, null, 2));
console.table(sizes);
