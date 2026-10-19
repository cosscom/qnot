import * as esbuild from 'esbuild';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ADAPTERS = ['qnot', 'qnot-dom', 'qnot-vue', 'qnot-svelte', 'qnot-solid', 'proto', 'proto-vanilla', 'rqb', 'raqb', 'jqqb', 'syncfusion', 'devextreme'];
const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
mkdirSync('dist', { recursive: true });

// The Vue, Svelte and Solid bindings are bench-built straight from packages/* source, like @qnot/dom.
// Their framework runtimes live in the packages' own node_modules; searching those too resolves the
// adapters' imports to the same real files, so there is a single copy of each runtime.
const nodePaths = ['vue', 'svelte', 'solid'].map((p) => root(`packages/${p}/node_modules`));
const svelteCompiler = createRequire(root('packages/svelte/package.json'))('svelte/compiler');
const solidRequire = createRequire(realpathSync(root('node_modules/vite-plugin-solid/package.json')));
const babel = solidRequire('@babel/core');
const solidPreset = solidRequire('babel-preset-solid');

const frameworks = {
  name: 'qnot-frameworks',
  setup(b) {
    b.onLoad({ filter: /\.svelte$/ }, (args) => {
      const out = svelteCompiler.compile(readFileSync(args.path, 'utf8'), { filename: args.path, generate: 'client', css: 'injected', dev: false });
      return { contents: out.js.code, loader: 'js' };
    });
    // Solid JSX: only the Solid package and its adapter (React adapters keep esbuild's JSX).
    b.onLoad({ filter: /(packages\/solid\/src\/.*|qnot-solid)\.tsx$/ }, async (args) => {
      const out = await babel.transformAsync(readFileSync(args.path, 'utf8'), {
        filename: args.path,
        babelrc: false,
        configFile: false,
        presets: [[solidPreset, { generate: 'dom' }]],
        parserOpts: { plugins: ['typescript', 'jsx'] },
      });
      return { contents: out.code, loader: 'ts' };
    });
  },
};

const shared = {
  bundle: true,
  minify: process.env.MINIFY !== '0', // MINIFY=0 for readable profiles (sizes are then meaningless)
  format: 'esm',
  splitting: false,
  target: 'es2022',
  jsx: 'automatic',
  nodePaths,
  plugins: [frameworks],
  define: {
    'process.env.NODE_ENV': '"production"',
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  logLevel: 'warning',
};

// Reference bundle: React + ReactDOM rendering one element, to subtract from React-based libraries.
writeFileSync('dist/_react-baseline.tsx', `import { createRoot } from 'react-dom/client';\ncreateRoot(document.body).render(<div>hi</div>);`);

const sizes = {};
const gzBuf = (b) => gzipSync(b, { level: 9 }).length;
const brBuf = (b) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const gz = (f) => (existsSync(f) ? gzBuf(readFileSync(f)) : 0);
const br = (f) => (existsSync(f) ? brBuf(readFileSync(f)) : 0);
const raw = (f) => (existsSync(f) ? readFileSync(f).length : 0);

for (const name of [...ADAPTERS, '_react-baseline']) {
  const entry = name.startsWith('_') ? `dist/${name}.tsx` : `src/adapters/${name}.${existsSync(`src/adapters/${name}.tsx`) ? 'tsx' : 'ts'}`;
  await esbuild.build({
    ...shared,
    entryPoints: { [name]: entry },
    outdir: 'dist',
    loader: { '.woff': 'file', '.woff2': 'file', '.ttf': 'file', '.eot': 'file', '.svg': 'file', '.png': 'file', '.gif': 'file' },
    assetNames: 'assets/[name]-[hash]',
  });
  writeFileSync(
    `dist/${name}.html`,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${name}.css"></head>` +
      `<body><div id="root"></div><script type="module" src="${name}.js"></script></body></html>`,
  );
  sizes[name] = {
    js: raw(`dist/${name}.js`),
    jsGz: gz(`dist/${name}.js`),
    jsBr: br(`dist/${name}.js`),
    css: raw(`dist/${name}.css`),
    cssGz: gz(`dist/${name}.css`),
    cssBr: br(`dist/${name}.css`),
  };
}

// Framework runtimes alone (the smallest app that mounts something), to report bindings without them.
const baselines = {
  _vue: `import { createApp, h } from 'vue'; createApp({ render: () => h('div', 'hi') }).mount(document.body);`,
  _svelte: `import { mount } from 'svelte'; import App from './_svelte-app.svelte'; mount(App, { target: document.body });`,
  _solid: `import { render } from 'solid-js/web'; import { createSignal } from 'solid-js'; const [s] = createSignal('hi'); render(() => document.createTextNode(s()), document.body);`,
};
writeFileSync('dist/_svelte-app.svelte', `<script>let s = $state('hi');</script><div>{s}</div>`);
for (const [name, contents] of Object.entries(baselines)) {
  const out = await esbuild.build({ ...shared, stdin: { contents, resolveDir: 'dist', loader: 'ts' }, write: false });
  const b = out.outputFiles[0].contents;
  sizes[name] = { js: b.length, jsGz: gzBuf(b), jsBr: brBuf(b), css: 0, cssGz: 0, cssBr: 0 };
}

writeFileSync('dist/sizes.json', JSON.stringify(sizes, null, 2));
// Committed snapshot the website reads at build time (dist/ is gitignored).
writeFileSync('results/sizes.json', JSON.stringify(sizes, null, 2));

// Per package and subpath: everything the entry exports (`export *`), minified, peer frameworks external.
// This is the ceiling a bundler starts from; tree-shaking only goes down from here.
const PEERS = ['react', 'react-dom', 'react/jsx-runtime', 'vue', 'svelte', 'solid-js'];
const ENTRIES = {
  '@qnot/core': 'packages/core/src/index.ts',
  ...Object.fromEntries(
    ['sql', 'mongo', 'jsonlogic', 'elasticsearch', 'spel', 'text', 'rqb', 'raqb', 'jqqb'].map((f) => [`@qnot/core/formats/${f}`, `packages/core/src/formats/${f}.ts`]),
  ),
  '@qnot/dom': 'packages/dom/src/index.ts',
  '@qnot/react': 'packages/react/src/index.ts',
  '@qnot/vue': 'packages/vue/src/index.ts',
  '@qnot/svelte': 'packages/svelte/src/index.ts',
  '@qnot/solid': 'packages/solid/src/index.tsx',
};
const packages = {};
for (const [spec, file] of Object.entries(ENTRIES)) {
  const out = await esbuild.build({
    ...shared,
    stdin: { contents: `export * from ${JSON.stringify(root(file))};`, resolveDir: root('.'), loader: 'ts' },
    external: PEERS.flatMap((p) => [p, `${p}/*`]),
    write: false,
  });
  const b = out.outputFiles[0].contents;
  packages[spec] = { min: b.length, gz: gzBuf(b), br: brBuf(b) };
}
const css = readFileSync(root('packages/core/styles.css'));
packages['@qnot/core/styles.css'] = { min: css.length, gz: gzBuf(css), br: brBuf(css) };
writeFileSync('dist/packages.json', JSON.stringify(packages, null, 2));

console.table(sizes);
console.table(packages);
