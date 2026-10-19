// apps/web header: desktop (1440) and phone (390), light and dark; the Products menu open, the
// mobile drawer open, and a docs page. node header-shots.mjs <out-dir>
import { chromium } from 'playwright';
const S = process.argv[2] ?? '.';
const BASE = process.env.BASE ?? 'http://localhost:5192';
const b = await chromium.launch();
const errors = [];
for (const scheme of ['light', 'dark']) {
  const sfx = scheme === 'dark' ? '-dark' : '';
  const desk = await b.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  desk.on('pageerror', (e) => errors.push(`[${scheme}] ${e.message}`));
  desk.on('console', (m) => m.type() === 'error' && errors.push(`[${scheme}] ${m.text().slice(0, 200)}`));
  await desk.goto(BASE + '/', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(600);
  await desk.screenshot({ path: `${S}/header-home-1440${sfx}.png`, clip: { x: 0, y: 0, width: 1440, height: 200 } });
  await desk.getByRole('button', { name: 'Products' }).click();
  await desk.waitForTimeout(700);
  await desk.screenshot({ path: `${S}/header-products-1440${sfx}.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } });
  await desk.keyboard.press('Escape');
  await desk.goto(BASE + '/docs', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(600);
  await desk.screenshot({ path: `${S}/header-docs-1440${sfx}.png`, clip: { x: 0, y: 0, width: 1440, height: 400 } });
  await desk.goto(BASE + '/examples', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(400);
  await desk.screenshot({ path: `${S}/header-examples-1440${sfx}.png`, clip: { x: 0, y: 0, width: 1440, height: 200 } });
  const phone = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  phone.on('pageerror', (e) => errors.push(`[${scheme} phone] ${e.message}`));
  await phone.goto(BASE + '/', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(600);
  await phone.screenshot({ path: `${S}/header-home-390${sfx}.png`, clip: { x: 0, y: 0, width: 390, height: 240 } });
  await phone.goto(BASE + '/docs', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(600);
  await phone.screenshot({ path: `${S}/header-docs-390${sfx}.png`, clip: { x: 0, y: 0, width: 390, height: 300 } });
  await phone.getByRole('button', { name: /toggle menu/i }).click();
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: `${S}/header-mobile-menu-390${sfx}.png` });
  await desk.close();
  await phone.close();
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await b.close();
