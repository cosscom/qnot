// "All side by side": edit the age value in each renderer in turn and check every other renderer follows.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5191/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1400 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(url, { waitUntil: 'networkidle' });
await p.locator('[data-renderer=all]').click();
await p.waitForTimeout(500);
const panels = ['react', 'vanilla', 'vue', 'svelte', 'solid'];
const ageInput = (id) => p.locator(`[data-panel=${id}] input.tn-value[type=number]`).first();
const results = {};
for (const [i, editor] of panels.entries()) {
  const value = String(30 + i);
  await ageInput(editor).fill(value);
  await p.waitForTimeout(150);
  const seen = {};
  for (const other of panels) seen[other] = await ageInput(other).inputValue();
  seen.coss = await p.locator('[data-panel=coss] [data-slot=number-field-input]').first().inputValue();
  results[editor] = Object.values(seen).every((v) => v === value) ? 'all in sync' : seen;
}
console.log(results);
await p.screenshot({ path: process.argv[3] ?? 'frameworks.png' });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await b.close();
