// Main playground parity checks: settings popover, read-only, locks, maxRules, confirm removal,
// async search, array groups, formats.
import { chromium } from 'playwright';
const S = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1100 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const errors = [];
p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5191/#/', { waitUntil: 'networkidle' });
const out = {};
out.valid = await p.locator('text=/^(Valid|Incomplete)$/').first().innerText();
out.matched = await p.locator('[data-matched]').getAttribute('data-matched');
out.rules = await p.locator('[data-rule]').count();

// Settings popover screenshot.
await p.locator('[data-settings-trigger]').click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${S}/pg-settings${process.env.DARK ? '-dark' : ''}.png` });

// Read-only disables every "Rule" button.
await p.locator('[data-setting=readOnly] [role=switch]').click();
await p.waitForTimeout(200);
out.readOnlyAddDisabled = await p.getByRole('button', { name: 'Rule', exact: true }).first().isDisabled();
await p.locator('[data-setting=readOnly] [role=switch]').click();
// maxRules = current count blocks adding.
await p.getByRole('textbox', { name: 'Max rules' }).fill(String(out.rules));
await p.keyboard.press('Tab');
await p.waitForTimeout(200);
out.maxRulesAddDisabled = await p.getByRole('button', { name: 'Rule', exact: true }).first().isDisabled();
await p.getByRole('textbox', { name: 'Max rules' }).fill('');
await p.keyboard.press('Tab');
// Confirm removal.
await p.locator('[data-setting=confirmRemove] [role=switch]').click();
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
await p.getByRole('button', { name: 'Remove rule' }).first().click();
await p.waitForTimeout(300);
out.confirmShown = await p.locator('[data-confirm-remove]').count();
await p.screenshot({ path: `${S}/pg-confirm${process.env.DARK ? '-dark' : ''}.png` });
await p.locator('[data-confirm-remove]').click();
await p.waitForTimeout(300);
out.rulesAfterRemove = await p.locator('[data-rule]').count();
// Lock the first rule: its remove button disables.
await p.locator('[data-rule] [data-lock]').first().click();
await p.waitForTimeout(200);
out.lockedRemoveDisabled = await p.locator('[data-rule]').first().getByRole('button', { name: 'Remove rule' }).isDisabled();
// Add a List condition on Orders.
const before = await p.locator('[data-group]').count();
await p.getByRole('button', { name: 'List condition' }).first().click();
await p.getByRole('menuitem', { name: 'Orders' }).click();
await p.waitForTimeout(200);
out.arrayGroupAdded = (await p.locator('[data-group]').count()) === before + 1;
// Async company search: add a rule, switch to Company, type.
await p.getByRole('button', { name: 'Rule', exact: true }).first().click();
const last = p.locator('[data-rule]').last();
await last.getByRole('combobox').first().click();
await p.getByRole('option', { name: 'Company' }).click();
await p.waitForTimeout(200);
await p.locator('[data-rule]').last().getByPlaceholder('Search…').fill('ho');
await p.waitForTimeout(700);
out.asyncOptions = await p.getByRole('option').allInnerTexts();
await p.getByRole('option', { name: 'Hooli' }).click();
await p.waitForTimeout(200);
// Formats.
await p.getByRole('tab', { name: 'Formats' }).click();
out.formats = await p.locator('[data-format]').evaluateAll((els) => els.map((e) => e.dataset.format));
out.sqlHasCompany = (await p.locator('[data-format-output]').innerText()).includes('Hooli');
const formatErrors = {};
for (const id of out.formats) {
  await p.locator(`[data-format="${id}"]`).click();
  await p.waitForTimeout(100);
  if (await p.locator('[data-format-error]').count()) formatErrors[id] = (await p.locator('[data-format-error]').innerText()).replace(/\s+/g, ' ').slice(0, 120);
}
out.formatErrors = formatErrors;
await p.locator('[data-format="sql"]').click();
await p.screenshot({ path: `${S}/pg-main${process.env.DARK ? '-dark' : ''}.png` });
console.log(out, errors.length ? errors : 'no console errors');
await b.close();
