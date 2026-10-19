// Trace one mount and sum main-thread time by trace event name (style, layout, paint, script…).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const [name = 'qnot', n = '1000'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    res.writeHead(200, { 'content-type': types[extname(req.url)] ?? 'application/octet-stream' }).end(await readFile(join('dist', new URL(req.url, 'http://x').pathname)));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${server.address().port}/${name}.html`);
await page.waitForFunction(() => window.bench);
await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
const r = await page.evaluate((n) => window.bench.mount(Number(n)), n);
await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 50))));
const trace = JSON.parse((await browser.stopTracing()).toString());
const totals = new Map();
for (const e of trace.traceEvents) if (e.ph === 'X' && e.dur) totals.set(e.name, (totals.get(e.name) ?? 0) + e.dur);
console.log(name, n, r);
for (const [k, us] of [...totals].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`${(us / 1000).toFixed(1).padStart(8)} ms  ${k}`);
await browser.close();
server.close();
