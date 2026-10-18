// Visit every example, check it renders without console errors, and screenshot each.
import { chromium } from 'playwright';
const S = process.argv[2];
const only = process.argv[3];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const errors = [];
p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5191/#/examples', { waitUntil: 'networkidle' });
const ids = only ? only.split(',') : await p.locator('[data-example]').evaluateAll((els) => els.map((e) => e.dataset.example));
for (const id of ids) {
  const before = errors.length;
  await p.goto(`http://localhost:5191/#/examples/${id}`);
  await p.waitForTimeout(700);
  const h1 = await p.locator('main h1').first().innerText().catch(() => '(no h1)');
  await p.screenshot({ path: `${S}/ex-${id}${process.env.DARK ? '-dark' : ''}.png`, fullPage: false });
  console.log(id.padEnd(18), h1.padEnd(36), errors.length > before ? errors.slice(before).join(' | ') : 'ok');
}
await b.close();
