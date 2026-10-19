// The full performance suite: one command, one versioned JSON (results/suite.json).
//
//   node suite.mjs                     # everything (~20-30 min)
//   ONLY=qnot,rqb SIZES=10,100 node suite.mjs --no-core --no-throttle    # a quick slice
//
// Steps: build every bench page (build.mjs), run the UI matrix in headless Chromium, a 4x CPU-throttled
// pass for the headline metrics, the core (no DOM) benchmarks in Node, then write suite.json with
// environment metadata. It also refreshes results.json (the legacy shape the site's landing page and
// /compare pages read) from the same run, so every page shows the same numbers.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { cpus, totalmem, platform, release, arch } from 'node:os';
import { join } from 'node:path';
import { serve, cpuPer, stats } from './lib/ui.mjs';

const SCHEMA = 1;
const flags = new Set(process.argv.slice(2));
const ADAPTERS = (process.env.ONLY ?? 'qnot,qnot-dom,qnot-vue,qnot-svelte,qnot-solid,rqb,raqb,jqqb,syncfusion,devextreme').split(',');
const SIZES = (process.env.SIZES ?? '10,100,500,1000,2500,5000').split(',').map(Number);
const THROTTLE = { rate: 4, sizes: (process.env.THROTTLE_SIZES ?? '100,1000').split(',').map(Number) };
// A size is skipped (and recorded as skipped) when the previous sizes project a cold mount above this.
const MOUNT_BUDGET_MS = Number(process.env.MOUNT_BUDGET_MS ?? 45_000);
const STEP_TIMEOUT_MS = 180_000;

/** Repetitions by size: more at small sizes where single samples are noisy, fewer where one mount takes seconds. */
const plan = (n, slow) => ({
  pages: n <= 1000 ? (slow ? 5 : 9) : slow ? 2 : 4,
  warm: n <= 1000 || !slow,
  keys: n <= 1000 ? 40 : 20,
  keyCpu: n <= 1000 ? 12 : 6,
  actions: n <= 1000 ? 12 : 6,
  addCpu: 5,
});

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);

if (!flags.has('--no-build')) {
  log('building bench pages');
  execFileSync('node', ['build.mjs'], { stdio: ['ignore', 'ignore', 'inherit'] });
}

const { base, close } = await serve('dist');
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });

/** page.evaluate with a hard timeout, so one hung library can't stall the suite. */
const evalT = (page, fn, arg, ms = STEP_TIMEOUT_MS) =>
  Promise.race([page.evaluate(fn, arg), new Promise((_, rej) => setTimeout(() => rej(new Error(`step timeout after ${ms / 1000}s`)), ms))]);
const errText = (e) => String(e?.message ?? e).split('\n')[0].replace(/^page\.evaluate: /, '');

async function freshPage(name, cpu) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => log(`  [${name}] pageerror: ${e.message.split('\n')[0]}`));
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`${base}/${name}.html`);
  await page.waitForFunction(() => window.bench, null, { timeout: 30_000 });
  return { page, cdp };
}

const heapUsed = async (page, cdp) => {
  await page.evaluate(() => window.gc());
  return (await cdp.send('Runtime.getHeapUsage')).usedSize;
};

/** One adapter at one size: cold/warm mounts in fresh pages, then every interaction on the last page. */
async function measure(name, n, cpu, opts) {
  const cold = [], warm = [], heap = [];
  const out = { rules: null, dom: null, errors: {} };
  for (let p = 0; p < opts.pages; p++) {
    const { page, cdp } = await freshPage(name, cpu);
    try {
      const h0 = await heapUsed(page, cdp);
      const m = await evalT(page, (n) => window.bench.mount(n), n);
      cold.push(m.ms);
      heap.push((await heapUsed(page, cdp)) - h0);
      out.rules = m.rules;
      if (p === 0) out.dom = await page.evaluate(() => window.bench.domNodes());
      if (opts.warm) {
        await page.evaluate(() => window.bench.unmount());
        warm.push((await evalT(page, (n) => window.bench.mount(n), n)).ms);
      }
      if (p === opts.pages - 1 && !opts.mountOnly) await interact(page, cdp, n, opts, out);
    } finally {
      await page.close();
    }
  }
  out.mountCold = stats(cold);
  out.mountWarm = warm.length ? stats(warm) : null;
  out.heapKB = stats(heap.map((b) => b / 1024));
  return out;
}

async function interact(page, cdp, n, opts, out) {
  const notes = await page.evaluate(() => window.bench.notes);
  out.notes = notes;
  const step = async (key, fn) => {
    try {
      await fn();
    } catch (e) {
      out.errors[key] = errText(e);
      log(`    ${key}: ${out.errors[key]}`);
    }
  };
  if (!opts.headlineOnly) {
    // Before any edit: some exporters refuse a tree with an incomplete rule (jQuery QueryBuilder returns null).
    await step('sql', async () => {
      const s = await evalT(page, (reps) => window.bench.sql(reps), n >= 1000 ? 10 : 50);
      if (s) out.sqlMs = Math.round(s.ms * 1000) / 1000;
    });
  }
  await step('keystroke', async () => {
    const typing = await evalT(page, (k) => window.bench.type(k), opts.keys);
    if (!typing) return;
    out.keystroke = stats(typing.times);
    out.keystrokeCommitted = await page.evaluate((t) => window.bench.committed(t), typing.typed);
    if (opts.cpuDetail) {
      await cdp.send('Performance.enable');
      out.keystrokeCpu = stats(await cpuPer(page, cdp, opts.keyCpu, () => evalT(page, () => window.bench.type(1))));
    }
  });
  if (!opts.headlineOnly) {
    for (const [key, fn] of [
      ['changeField', 'changeField'],
      ['changeOperator', 'changeOperator'],
      ['reorder', 'reorder'],
    ]) {
      await step(key, async () => {
        const t = await evalT(page, ([f, k]) => window.bench[f](k), [fn, opts.actions]);
        if (t) out[key] = stats(t);
      });
    }
  }
  await step('addRule', async () => {
    out.addRule = stats(await evalT(page, (k) => window.bench.addRule(k), opts.actions));
    if (opts.cpuDetail) {
      await cdp.send('Performance.enable');
      out.addRuleCpu = stats(await cpuPer(page, cdp, opts.addCpu, () => evalT(page, () => window.bench.addRule(1))));
    }
  });
  if (!opts.headlineOnly) {
    await step('removeRule', async () => {
      const t = await evalT(page, (k) => window.bench.removeRule(k), Math.min(opts.actions, Math.floor(n / 2)));
      if (t) out.removeRule = stats(t);
    });
  }
}

/** Projected cold mount at `n` from the two largest measured sizes (power-law fit). */
function projectMount(done, n) {
  const pts = done.filter(([, r]) => r.mountCold).slice(-2);
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0][1].mountCold.median * (n / pts[0][0]);
  const [[n1, a], [n2, b]] = pts;
  const k = Math.max(1, Math.log(b.mountCold.median / a.mountCold.median) / Math.log(n2 / n1));
  return b.mountCold.median * (n / n2) ** k;
}

async function matrix(sizes, cpu, extra) {
  const res = {};
  for (const name of ADAPTERS) {
    res[name] = {};
    const done = [];
    for (const n of sizes) {
      const projected = projectMount(done, n);
      if (projected > MOUNT_BUDGET_MS * (cpu > 1 ? 2 : 1)) {
        res[name][n] = { skipped: `projected cold mount ≈${Math.round(projected / 1000)} s from the smaller sizes; over the suite's ${MOUNT_BUDGET_MS / 1000} s budget` };
        log(`  ${name} n=${n} skipped (${res[name][n].skipped})`);
        continue;
      }
      const slow = projected > 2000;
      const opts = { ...plan(n, slow), ...extra(n, slow) };
      const s = Date.now();
      try {
        res[name][n] = await measure(name, n, cpu, opts);
        done.push([n, res[name][n]]);
      } catch (e) {
        res[name][n] = { error: errText(e) };
      }
      const r = res[name][n];
      log(`  ${name.padEnd(12)} n=${String(n).padEnd(5)} ${((Date.now() - s) / 1000).toFixed(1).padStart(5)}s  mount ${r.mountCold?.median?.toFixed(1) ?? '—'} ms  key ${r.keystroke?.median?.toFixed(2) ?? '—'}  add ${r.addRule?.median?.toFixed(1) ?? '—'}  field ${r.changeField?.median?.toFixed(1) ?? '—'}  ${r.error ?? ''}`);
    }
  }
  return res;
}

const suite = { schema: SCHEMA, date: new Date().toISOString() };

if (!flags.has('--no-ui')) {
  log(`UI matrix: ${ADAPTERS.join(', ')} × ${SIZES.join(', ')}`);
  suite.ui = { sizes: SIZES, cpuThrottle: 1, results: await matrix(SIZES, 1, () => ({ cpuDetail: true })) };
}
if (!flags.has('--no-throttle')) {
  log(`UI, ${THROTTLE.rate}× CPU throttle: ${THROTTLE.sizes.join(', ')}`);
  const results = await matrix(THROTTLE.sizes, THROTTLE.rate, (n) => ({ pages: n <= 100 ? 5 : 3, warm: false, keys: 20, actions: 6, headlineOnly: true, cpuDetail: false }));
  suite.throttled = { sizes: THROTTLE.sizes, cpuThrottle: THROTTLE.rate, results };
}
const chromiumVersion = browser.version();
await browser.close();
close();

if (!flags.has('--no-core')) {
  log('core benchmarks (Node, no DOM)');
  execFileSync(join('node_modules', '.bin', 'esbuild'), ['core/suite.ts', '--bundle', '--platform=node', '--format=esm', '--outfile=dist/core-suite.mjs', '--log-level=warning'], { stdio: 'inherit' });
  const json = execFileSync('node', ['dist/core-suite.mjs'], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20 });
  suite.core = JSON.parse(json.toString());
}

// Bundle sizes from build.mjs.
const sizes = JSON.parse(readFileSync('dist/sizes.json', 'utf8'));
const packages = JSON.parse(readFileSync('dist/packages.json', 'utf8'));
suite.bundle = { adapters: sizes, packages };

// Environment.
const version = (pkg, from = '.') => {
  for (const dir of [from, '../packages/vue', '../packages/svelte', '../packages/solid']) {
    const p = join(dir, 'node_modules', pkg, 'package.json');
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')).version;
  }
  return null;
};
const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const gitSha = sh('git', ['rev-parse', '--short', 'HEAD']);
suite.env = {
  cpu: cpus()[0]?.model ?? null,
  cores: cpus().length,
  memoryGB: Math.round(totalmem() / 2 ** 30),
  os: `${platform()} ${release()} (${arch()})`,
  osName: platform() === 'darwin' ? `macOS ${sh('sw_vers', ['-productVersion'])}` : platform(),
  machine: platform() === 'darwin' ? sh('sysctl', ['-n', 'hw.model']) : null,
  node: process.version,
  chromium: chromiumVersion,
  playwright: version('playwright'),
  git: gitSha,
  dirty: !!sh('git', ['status', '--porcelain', '--', '../packages']),
  libraries: {
    react: version('react'),
    vue: version('vue'),
    svelte: version('svelte'),
    'solid-js': version('solid-js'),
    'react-querybuilder': version('react-querybuilder'),
    '@react-awesome-query-builder/ui': version('@react-awesome-query-builder/ui'),
    'jQuery-QueryBuilder': version('jQuery-QueryBuilder'),
    '@syncfusion/ej2-querybuilder': version('@syncfusion/ej2-querybuilder'),
    devextreme: version('devextreme'),
    esbuild: version('esbuild'),
  },
  method: {
    viewport: '1400×900',
    uiSizes: SIZES,
    repetitions: Object.fromEntries([10, 1000, 5000].map((n) => [n, { fast: plan(n, false), slow: plan(n, true) }])),
    coreRounds: suite.core?.rounds ?? null,
    mountBudgetMs: MOUNT_BUDGET_MS,
  },
  durationMin: Math.round((Date.now() - t0) / 6000) / 10,
};

const outFile = process.env.OUT ?? 'results/suite.json';
await writeFile(outFile, JSON.stringify(suite, null, 1) + '\n');
log(`wrote ${outFile}`);

// Legacy results.json (landing page + /compare) from the same unthrottled run.
if (suite.ui && !process.env.OUT && !process.env.ONLY && !process.env.SIZES) {
  const legacy = {};
  const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
  for (const [name, bySize] of Object.entries(suite.ui.results)) {
    legacy[name] = {};
    for (const [n, r] of Object.entries(bySize)) {
      if (r.skipped || !r.mountCold) continue;
      legacy[name][n] = {
        rules: r.rules,
        dom: r.dom,
        mountColdMs: r1(r.mountCold.median),
        mountWarmMs: r1(r.mountWarm?.median),
        heapKB: Math.round(r.heapKB.median),
        keystrokeMedianMs: r1(r.keystroke?.median),
        keystrokeP95Ms: r1(r.keystroke?.p95),
        keystrokeCpuMs: r1(r.keystrokeCpu?.median),
        keystrokeCommitted: r.keystrokeCommitted ?? null,
        addRuleMedianMs: r1(r.addRule?.median),
        addRuleCpuMs: r1(r.addRuleCpu?.median),
        sqlMs: r.sqlMs ?? null,
        error: Object.values(r.errors ?? {})[0] ?? r.error ?? null,
      };
    }
  }
  await writeFile('results/results.json', JSON.stringify({ date: suite.date, cpuThrottle: 1, source: 'suite.mjs', results: legacy }, null, 2));
  log('refreshed results/results.json from the same run');
}
process.exit(0);
