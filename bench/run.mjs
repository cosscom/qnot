import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ADAPTERS = (process.env.ONLY ?? 'trawlnet,trawlnet-dom,rqb,raqb,jqqb,syncfusion,devextreme').split(',');
const SIZES = (process.env.SIZES ?? '10,100,500,1000').split(',').map(Number);
const PAGES = Number(process.env.PAGES ?? 5); // fresh pages per size (cold mounts)
const KEYS = 30;
const ADDS = 10;
const CPU = Number(process.env.CPU ?? 1); // CDP CPU throttling rate

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const body = await readFile(join('dist', decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    res.writeHead(200, { 'content-type': types[extname(req.url)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
const taskSeconds = async (cdp) => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value;

// Main-thread busy time for one interaction, including any deferred/debounced work: TaskDuration delta
// over a fixed quiet window, minus the same window around a no-op evaluate.
async function cpuPer(page, cdp, times, fn, windowMs = 150) {
  const idle = [];
  for (let i = 0; i < 3; i++) {
    const a = await taskSeconds(cdp);
    await page.evaluate(() => 0);
    await page.waitForTimeout(windowMs);
    idle.push((await taskSeconds(cdp)) - a);
  }
  const floor = median(idle);
  const out = [];
  for (let i = 0; i < times; i++) {
    const a = await taskSeconds(cdp);
    await fn();
    await page.waitForTimeout(windowMs);
    out.push(Math.max(0, ((await taskSeconds(cdp)) - a - floor) * 1000));
  }
  return out;
}

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
const results = {};

for (const name of ADAPTERS) {
  results[name] = {};
  for (const n of SIZES) {
    const cold = [], warm = [], heap = [];
    let typing = null, adds = null, typingCpu = null, addCpu = null, committed = null, sql = null, dom = null, rules = null, error = null;
    try {
      for (let p = 0; p < PAGES; p++) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('pageerror', (e) => console.error(`  [${name}] pageerror:`, e.message));
        const cdp = await page.context().newCDPSession(page);
        if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
        await page.goto(`${base}/${name}.html`);
        await page.waitForFunction(() => window.bench, null, { timeout: 30_000 });
        await page.evaluate(() => window.gc());
        const h0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
        const m1 = await page.evaluate((n) => window.bench.mount(n), n);
        await page.evaluate(() => window.gc());
        heap.push((await cdp.send('Runtime.getHeapUsage')).usedSize - h0);
        cold.push(m1.ms);
        rules = m1.rules;
        await page.evaluate(() => window.bench.unmount());
        const m2 = await page.evaluate((n) => window.bench.mount(n), n);
        warm.push(m2.ms);
        if (p === PAGES - 1) {
          dom = await page.evaluate(() => window.bench.domNodes());
          sql = await page.evaluate((reps) => window.bench.sql(reps), n >= 500 ? 20 : 100);
          typing = await page.evaluate((k) => window.bench.type(k), KEYS);
          if (typing) {
            committed = await page.evaluate((t) => window.bench.committed(t), typing.typed);
            await cdp.send('Performance.enable');
            typingCpu = await cpuPer(page, cdp, 10, () => page.evaluate(() => window.bench.type(1)));
          }
          adds = await page.evaluate((k) => window.bench.addRule(k), ADDS);
          await cdp.send('Performance.enable');
          addCpu = await cpuPer(page, cdp, 5, () => page.evaluate(() => window.bench.addRule(1)));
          if (n === 100) await page.screenshot({ path: `results/${name}-100.png` });
        }
        await page.close();
      }
    } catch (e) {
      error = String(e.message ?? e).split('\n')[0];
      console.error(`  [${name} n=${n}] ${error}`);
    }
    results[name][n] = {
      rules,
      dom,
      mountColdMs: cold.length ? r1(median(cold)) : null,
      mountWarmMs: warm.length ? r1(median(warm)) : null,
      heapKB: heap.length ? Math.round(median(heap) / 1024) : null,
      keystrokeMedianMs: typing ? r1(median(typing.times)) : null,
      keystrokeP95Ms: typing ? r1(p95(typing.times)) : null,
      keystrokeCpuMs: typingCpu ? r1(median(typingCpu)) : null,
      keystrokeCommitted: committed,
      addRuleMedianMs: adds ? r1(median(adds)) : null,
      addRuleCpuMs: addCpu ? r1(median(addCpu)) : null,
      sqlMs: sql ? Math.round(sql.ms * 1000) / 1000 : null,
      sqlSample: sql?.sample ?? null,
      error,
    };
    console.log(name, n, JSON.stringify(results[name][n]));
  }
}

await browser.close();
server.close();
const out = `results/results${CPU > 1 ? `-cpu${CPU}x` : ''}.json`;
await writeFile(out, JSON.stringify({ date: new Date().toISOString(), cpuThrottle: CPU, results }, null, 2));
console.log('wrote', out);
