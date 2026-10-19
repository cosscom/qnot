// apps/web smoke test: every route at desktop + phone widths, light or dark (DARK=1), console errors,
// horizontal overflow, and the interactive checks (category filter, islands sync, example source +
// install block, registry JSON, the playground's Code tab).
import { chromium } from 'playwright';
const S = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:5192';
const dark = !!process.env.DARK;
const SLUGS = ['linear-filters', 'workflow', 'saved-views', 'product-filters', 'segments', 'feature-flags', 'alerting', 'access-policy', 'rqb-dropin', 'server-side'];
// Search-landing pages (apps/web/src/lib/seo-routes.ts).
const SEO = [
  '/react-query-builder', '/vue-query-builder', '/svelte-query-builder', '/solid-query-builder', '/javascript-query-builder',
  '/shadcn-query-builder', '/mui-query-builder', '/coss-ui-query-builder', '/headless-query-builder',
  '/benchmarks',
  '/compare', '/compare/react-querybuilder', '/compare/react-awesome-query-builder', '/compare/jquery-querybuilder', '/compare/syncfusion-query-builder', '/compare/devextreme-filterbuilder',
];
// Free converter tools (apps/web/src/tools/catalog.ts).
const TOOL_SLUGS = ['sql-to-mongodb', 'mongodb-to-sql', 'sql-to-jsonlogic', 'jsonlogic-to-sql', 'jsonlogic-to-mongodb', 'sql-to-elasticsearch', 'react-querybuilder-to-sql', 'raqb-to-sql'];
const TOOLS = ['/tools', ...TOOL_SLUGS.map((s) => `/tools/${s}`)];
const ROUTES = ['/', '/examples', ...SLUGS.map((s) => `/examples/${s}`), '/playground', '/kits', '/docs', '/docs/guides/shadcn', ...SEO, ...TOOLS];
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
    await p.waitForSelector('[data-panel=vue] input.qn-value[type=number]', { timeout: 30_000 });
    await p.locator('[data-panel=vue] input.qn-value[type=number]').first().fill('44');
    await p.waitForTimeout(300);
    const sync = {};
    for (const id of ['react', 'vanilla', 'vue', 'svelte', 'solid']) sync[id] = await p.locator(`[data-panel=${id}] input.qn-value[type=number]`).first().inputValue();
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
    // Framework pages: each live builder (React natively, the rest as islands) edits the page's store,
    // so typing a number shows up in the "Reads as" summary next to the exports.
    const demos = {};
    for (const [route, sel] of [
      ['/react-query-builder', '[data-demo] input.qn-value[type=number]'],
      ['/vue-query-builder', '[data-island=vue] input.qn-value[type=number]'],
      ['/svelte-query-builder', '[data-island=svelte] input.qn-value[type=number]'],
      ['/solid-query-builder', '[data-island=solid] input.qn-value[type=number]'],
      ['/javascript-query-builder', '[data-island=vanilla] input.qn-value[type=number]'],
    ]) {
      await p.goto(BASE + route, { waitUntil: 'networkidle' });
      await p.waitForSelector(sel, { timeout: 30_000 });
      await p.locator(sel).first().fill('44');
      await p.waitForTimeout(300);
      demos[route] = (await p.locator('[data-demo-summary]').innerText()).includes('44') && (await p.locator('[data-faq] dt').count()) >= 5;
    }
    // Kit pages: the kit renders its rules, and the install block points at the kit's registry item.
    for (const [route, item] of [['/shadcn-query-builder', 'query-builder-shadcn'], ['/mui-query-builder', 'query-builder-mui'], ['/coss-ui-query-builder', 'query-builder'], ['/headless-query-builder', 'query-builder-headless']]) {
      await p.goto(BASE + route, { waitUntil: 'networkidle' });
      await p.waitForSelector('[data-kit-root] [data-kit]', { timeout: 30_000 }).catch(() => {});
      const kitRendered = (await p.locator('[data-kit-root]').innerText()).includes('Age');
      const cmd = await p.locator(`[data-registry-source=${item}] pre code`).first().innerText();
      demos[route] = kitRendered && cmd.endsWith(`/${item}.json`) && (await p.locator('[data-faq] dt').count()) >= 5;
    }
    // Tools: the sample converts (highlighted), and a broken input shows an error instead of output.
    const tools = {};
    for (const slug of TOOL_SLUGS) {
      await p.goto(`${BASE}/tools/${slug}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(400);
      const ok = (await p.locator('[data-tool-status]').getAttribute('data-tool-status')) === 'ok' && (await p.locator('[data-tool-output] .shiki').count()) > 0;
      await p.locator('[data-tool-input]').fill(slug.startsWith('sql') ? "status = 'active' AND" : '{ "a": ');
      await p.waitForTimeout(300);
      tools[slug] = ok && (await p.locator('[data-tool-error=input]').count()) === 1;
    }
    console.log({ platformCards, sync, registry, code, demos, tools });
  }
  await p.close();
}
for (const r of report) console.log(r.join('  '));
await b.close();
