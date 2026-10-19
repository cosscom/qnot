// apps/web smoke test: every route at desktop + phone widths, light or dark (DARK=1), console errors,
// horizontal overflow, and the interactive checks (category filter, islands sync, example source +
// install block, registry JSON, the playground's Code tab).
import { chromium } from 'playwright';
const S = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:5192';
const dark = !!process.env.DARK;
const SLUGS = ['linear-filters', 'workflow', 'saved-views', 'product-filters', 'segments', 'feature-flags', 'alerting', 'access-policy', 'rqb-dropin', 'server-side'];
const ROUTES = ['/', '/examples', ...SLUGS.map((s) => `/examples/${s}`), '/playground', '/docs', '/docs/guides/shadcn'];
const b = await chromium.launch();
const report = [];
for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport, colorScheme: dark ? 'dark' : 'light' });
  const errors = [];
  p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  for (const route of ROUTES) {
    const before = errors.length;
    const res = await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 120_000 });
    await p.waitForTimeout(route === '/playground' ? 1200 : 500);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '_');
    if (label === 'desktop' || ['/examples', '/playground', '/examples/linear-filters'].includes(route)) {
      await p.screenshot({ path: `${S}/web-${name}-${label}${dark ? '-dark' : ''}.png` });
    }
    report.push([label, route, res?.status(), overflow > 1 ? `OVERFLOW ${overflow}px` : 'ok', errors.slice(before).join(' | ') || 'no errors']);
  }
  if (label === 'desktop') {
    // Category filter.
    await p.goto(BASE + '/examples', { waitUntil: 'networkidle' });
    await p.locator('[data-category=Platform]').click();
    const platformCards = await p.locator('main ul > li').count();
    // Islands: all side by side, type in Vue, React follows.
    await p.goto(BASE + '/playground', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.locator('[data-renderer=all]').click();
    await p.waitForSelector('[data-panel=vue] input.tn-value[type=number]', { timeout: 30_000 });
    await p.locator('[data-panel=vue] input.tn-value[type=number]').first().fill('44');
    await p.waitForTimeout(300);
    const sync = {};
    for (const id of ['react', 'vanilla', 'vue', 'svelte', 'solid']) sync[id] = await p.locator(`[data-panel=${id}] input.tn-value[type=number]`).first().inputValue();
    sync.coss = await p.locator('[data-panel=coss] [data-slot=number-field-input]').first().inputValue();
    await p.screenshot({ path: `${S}/web-playground-all${dark ? '-dark' : ''}.png` });
    // Settings popover.
    await p.locator('[data-renderer=coss]').click();
    await p.locator('[data-settings-trigger]').click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${S}/web-playground-settings${dark ? '-dark' : ''}.png` });
    await p.keyboard.press('Escape');
    // Example page: full source tabs and the shadcn install block; the registry item it points at.
    await p.goto(BASE + '/examples/segments', { waitUntil: 'networkidle' });
    const sourceTabs = await p.locator('[role=tab]').count();
    const install = await p.locator('pre code').filter({ hasText: 'shadcn@latest add' }).first().innerText();
    const item = await (await fetch(install.split(' ').pop())).json();
    const registry = { sourceTabs, install, files: item.files.map((f) => f.target), deps: item.dependencies };
    await p.locator('text=Add it to your project').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${S}/web-example-source${dark ? '-dark' : ''}.png` });
    // Playground Code tab: follows the renderer and the settings.
    await p.goto(BASE + '/playground', { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-renderer=vue]', { timeout: 30_000 });
    await p.locator('[data-settings-trigger]').click();
    await p.getByRole('switch', { name: /read-only/i }).first().click();
    await p.keyboard.press('Escape');
    await p.locator('[data-renderer=vue]').click();
    await p.getByRole('tab', { name: 'Code' }).click();
    await p.waitForTimeout(2000);
    const code = {
      blocks: await p.locator('[data-code-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-code-block'))),
      readOnly: (await p.locator('[data-code-block="store.ts"]').innerText()).includes('readOnly: true'),
      highlighted: await p.locator('[data-code-block] .shiki').count(),
    };
    await p.locator('[data-code-panel]').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${S}/web-playground-code${dark ? '-dark' : ''}.png` });
    console.log({ platformCards, sync, registry, code });
  }
  await p.close();
}
for (const r of report) console.log(r.join('  '));
await b.close();
