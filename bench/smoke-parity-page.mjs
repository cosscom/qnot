// Opens every parity demo via its URL, checks it renders without console errors, and screenshots it.
import { chromium } from 'playwright';
const S = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const errors = [];
p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5191/#/parity', { waitUntil: 'networkidle' });
const rows = await p.locator('[data-parity-row]').count();
const tries = await p.locator('[data-try]').evaluateAll((els) => [...new Set(els.map((e) => e.dataset.try))]);
console.log({ rows, tryTargets: tries.length });
const suffix = process.env.DARK ? '-dark' : '';
await p.screenshot({ path: `${S}/parity${suffix}.png`, fullPage: false });
const ids = await p.evaluate(() => null);
for (const id of [...tries, 'undo', 'compile']) {
  const before = errors.length;
  await p.goto(`http://localhost:5191/#/parity/${id}`);
  await p.waitForTimeout(600);
  const ok = await p.locator(`[data-demo="${id}"]`).count();
  const builders = await p.locator(`[data-demo="${id}"] [data-group]`).count();
  let extra = '';
  if (id === 'cases') extra = (await p.locator('[data-case-result]').allInnerTexts()).join(',');
  if (id === 'compile') extra = await p.getByRole('tab', { name: '100k rows' }).count().then(async (n) => (n ? (await p.locator('[data-compile-result]').innerText()).slice(0, 60) : ''));
  if (id === 'sql-import') {
    await p.locator('[data-sql-import]').click();
    await p.waitForTimeout(200);
    extra = `rules after import: ${await p.locator(`[data-demo="${id}"] [data-rule]`).count()}`;
  }
  if (['cases', 'functions', 'i18n', 'sanitize', 'formats', 'readonly'].includes(id)) await p.screenshot({ path: `${S}/parity-${id}${suffix}.png` });
  console.log(id.padEnd(14), ok ? 'open' : 'MISSING', `groups=${builders}`, extra, errors.length > before ? errors.slice(before).join(' | ') : 'ok');
}
await b.close();
