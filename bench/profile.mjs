// CPU-profile one interaction on a bench page and print the hottest functions by self time.
// node profile.mjs <adapter> <n> [mount|type|add]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const [name = 'qnot', n = '1000', what = 'mount'] = process.argv.slice(2);
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
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
if (what !== 'mount') await page.evaluate((n) => window.bench.mount(n), Number(n));
await cdp.send('Profiler.start');
const result =
  what === 'mount'
    ? await page.evaluate((n) => window.bench.mount(n), Number(n))
    : what === 'type'
      ? await page.evaluate(() => window.bench.type(30))
      : await page.evaluate(() => window.bench.addRule(10));
const { profile } = await cdp.send('Profiler.stop');

const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
const self = new Map();
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0)));
const agg = new Map();
let total = 0;
for (const [id, us] of self) {
  const f = byId.get(id).callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
  agg.set(key, (agg.get(key) ?? 0) + us);
  total += us;
}
console.log(name, what, n, JSON.stringify(result).slice(0, 120));
console.log(`total sampled ${(total / 1000).toFixed(1)} ms`);
for (const [k, us] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 25))) console.log(`${(us / 1000).toFixed(2).padStart(8)} ms  ${k}`);
await browser.close();
server.close();
