// Screenshot any URL: node shot.mjs <url> <out.png> [width] [height]
import { chromium } from 'playwright';
const [url, out, w = '1440', h = '900'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: out });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await b.close();
