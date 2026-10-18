// Drives the playground's coss builder through a real browser and checks the store reacted.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5191/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' });
const rows = () => p.locator('[data-tn-id]').count();
const before = await rows();
await p.getByRole('button', { name: 'Rule' }).first().click();
const after = await rows();
// New rule is last in the root group: switch its field to "Email" and type a value.
const lastRule = p.locator('[data-tn-id]').nth(after - 1);
await lastRule.getByRole('combobox').first().click();
await p.getByRole('option', { name: 'Email' }).click();
await lastRule.locator('input').last().fill('ada@harbor.dev');
await p.getByRole('tab', { name: 'JSON' }).click();
const json = await p.locator('pre').first().innerText();
console.log({ before, after, emailRule: json.includes('"field": "email"') && json.includes('ada@harbor.dev'), errors });
await p.getByRole('tab', { name: 'Formats' }).click();
console.log('SQL:', (await p.locator('pre').first().innerText()).slice(0, 220));
await b.close();
