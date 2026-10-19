// Drives /kits in every UI kit (light + dark): type a value, change an operator, add a group,
// switch a value to a function; checks the shared store reacted and the console stayed clean.
// node smoke-kits.mjs <screenshot dir> [base]
import { chromium } from 'playwright';

const S = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:5192';
const KITS = ['coss', 'shadcn', 'mui', 'headless'];
const browser = await chromium.launch();
let failed = 0;

for (const dark of [false, true]) {
  for (const kit of KITS) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: dark ? 'dark' : 'light' });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await p.goto(`${BASE}/kits?kit=${kit}`, { waitUntil: 'networkidle' });
    if (dark) await p.evaluate(() => document.documentElement.classList.add('dark'));
    const root = p.locator(`[data-kit-root="${kit}"]`);
    await root.locator('[data-rule]').first().waitFor({ timeout: 30000 });
    const summary = () => p.locator('[data-summary]').innerText();
    const steps = {};

    // 1. Type into the first free-text value.
    const before = await summary();
    // The schema's one free-text value: lower(Name) contains "a".
    const inputs = root.locator('[data-rule] input');
    const at = await inputs.evaluateAll((els) => els.findIndex((el) => el.value === 'a' && !el.readOnly && el.getAttribute('role') !== 'combobox'));
    const text = inputs.nth(at);
    steps.typed = 'skip';
    if (at >= 0) {
      await text.fill('Ada');
      await p.waitForTimeout(150);
      steps.typed = (await summary()).includes('Ada') ? 'ok' : 'NO CHANGE';
    }

    // 2. Change the first rule's operator through the kit's own picker.
    const firstRule = root.locator('[data-rule]').first();
    // Kits label their operator picker; the coss builder's is the rule's second combobox.
    const op = (await firstRule.locator('[aria-label="Operator"]').count()) ? firstRule.locator('[aria-label="Operator"]').first() : firstRule.locator('[role="combobox"]').nth(1);
    const s1 = await summary();
    if ((await op.evaluate((el) => el.tagName)) === 'SELECT') {
      const values = await op.locator('option').evaluateAll((os) => os.map((o) => o.value));
      await op.selectOption(values[1]);
    } else {
      await op.click();
      const options = p.locator('[role="option"]:visible');
      await options.first().waitFor({ timeout: 5000 });
      await options.nth(1).click();
    }
    await p.waitForTimeout(200);
    steps.operator = (await summary()) !== s1 ? 'ok' : 'NO CHANGE';

    // 3. Add a group at the root.
    const groups = await root.locator('[data-group]').count();
    await root.locator('[data-group]').first().getByRole('button', { name: /^Group$/ }).first().click();
    await p.waitForTimeout(200);
    steps.group = (await root.locator('[data-group]').count()) > groups ? 'ok' : 'NO GROUP';

    // 4. Switch a value to a function.
    const fns = await root.locator('[data-function]').count();
    await root.locator('[data-source="function"]').first().click();
    await p.waitForTimeout(250);
    steps.function = (await root.locator('[data-function]').count()) > fns ? 'ok' : 'NO FUNCTION';

    const ok = Object.values(steps).every((v) => v === 'ok' || v === 'skip') && !errors.length && before.length > 0;
    if (!ok) failed++;
    console.log(`${dark ? 'dark ' : 'light'} ${kit.padEnd(9)} ${JSON.stringify(steps)} ${errors.length ? 'ERRORS: ' + errors.slice(0, 3).join(' | ') : 'no errors'}`);
    // Fresh page for the screenshot so it shows the kit's initial look.
    await p.goto(`${BASE}/kits?kit=${kit}`, { waitUntil: 'networkidle' });
    if (dark) await p.evaluate(() => document.documentElement.classList.add('dark'));
    await p.locator(`[data-kit-root="${kit}"] [data-rule]`).first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(400);
    await p.locator(`[data-kit-root="${kit}"]`).screenshot({ path: `${S}/kit-${kit}${dark ? '-dark' : ''}.png` });
    await p.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
