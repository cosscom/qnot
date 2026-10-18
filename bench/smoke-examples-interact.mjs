// Interaction checks for the smaller examples.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const go = async (id) => { await p.goto(`http://localhost:5191/#/examples/${id}`); await p.waitForTimeout(500); };
const out = {};

await go('linear-filters');
out.linearBefore = await p.locator('text=/^Issues/').locator('..').innerText();
await p.getByRole('button', { name: 'Filter', exact: true }).click();
await p.getByRole('menuitem', { name: 'Priority' }).click();
out.chips = await p.locator('[data-chip]').count();
await p.locator('[data-chip]').nth(1).getByText('any value').click();
await p.getByRole('menuitemcheckbox', { name: 'Urgent' }).click();
await p.keyboard.press('Escape');
out.linearAfter = await p.locator('text=/^Issues/').locator('..').innerText();

await go('saved-views');
await p.locator('[data-view=stalled]').click();
out.sentence = await p.locator('[data-sentence]').innerText();
await p.locator('[data-view=all]').click();
out.sentenceAll = await p.locator('[data-sentence]').innerText();
await p.getByRole('button', { name: 'Remove rule' }).first().click();
out.edited = await p.getByText('Edited').count();
await p.getByRole('button', { name: 'Undo' }).click();
out.afterUndo = await p.locator('[data-sentence]').innerText();

await go('segments');
out.audience = await p.locator('[data-audience]').innerText();

await go('access-policy');
out.decision = await p.locator('[data-decision]').getAttribute('data-decision');

await go('rqb-dropin');
await p.locator('input').filter({ hasNot: p.locator('[type=hidden]') }).first().fill('Ste');
await p.waitForTimeout(200);
out.rqbChanges = await p.locator('[data-changes]').innerText();
out.rqbState = (await p.locator('pre').first().innerText()).replace(/\s+/g, ' ').slice(0, 140);

await go('alerting');
await p.waitForTimeout(2500);
out.alerting = await p.locator('[data-firing]').innerText();

console.log(out, errors.length ? errors : 'no console errors');
await b.close();
