// Shared by suite.mjs: static server for dist/, CDP CPU-time sampling and summary statistics.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

export function serve(dir) {
  const server = createServer(async (req, res) => {
    try {
      const body = await readFile(join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      res.writeHead(200, { 'content-type': types[extname(req.url)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  }).listen(0);
  return new Promise((resolve) =>
    server.on('listening', () => resolve({ base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })),
  );
}

const sorted = (a) => [...a].sort((x, y) => x - y);
/** Linear-interpolated quantile of an ascending array. */
const q = (s, p) => {
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
};
const r = (x) => Math.round(x * 100) / 100;

export const median = (a) => q(sorted(a), 0.5);

/** median, p25/p75, p95, min/max and sample count, rounded to 0.01. */
export function stats(a) {
  if (!a || a.length === 0) return null;
  const s = sorted(a);
  return { median: r(q(s, 0.5)), p25: r(q(s, 0.25)), p75: r(q(s, 0.75)), p95: r(q(s, 0.95)), min: r(s[0]), max: r(s[s.length - 1]), n: s.length };
}

const taskSeconds = async (cdp) => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value;

/**
 * Main-thread busy time for one interaction, including any deferred/debounced work: TaskDuration delta
 * over a fixed quiet window, minus the same window around a no-op evaluate.
 */
export async function cpuPer(page, cdp, times, fn, windowMs = 150) {
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
