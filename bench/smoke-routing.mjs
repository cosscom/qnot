// Drives the routing-forms example: preview a response, duplicate/move a route, reports, collapse.
import { chromium } from 'playwright';
const S = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: process.env.DARK ? 'dark' : 'light' });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5191/#/examples/routing-forms', { waitUntil: 'networkidle' });
const out = {};
out.routes = await p.locator('[data-route]').count();
// Preview: first sample (Ana, O-1, asap) should hit "Extraordinary talent" with eligible hosts.
await p.getByRole('button', { name: 'Preview' }).click();
await p.waitForTimeout(400);
out.anaRoute = await p.locator('[data-winner]').innerText();
out.hosts = await p.getByText('Eligible hosts').count();
await p.screenshot({ path: `${S}/rf-preview.png` });
await p.getByRole('button', { name: 'Rahul Mehta' }).click();
out.rahulRoute = await p.locator('[data-winner]').innerText();
await p.getByRole('button', { name: 'Chidi Okeke' }).click();
out.chidiRoute = await p.locator('[data-winner]').innerText();
await p.getByRole('button', { name: 'Miguel Torres' }).click();
out.miguelRoute = await p.locator('[data-winner]').innerText();
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
// Duplicate the first route through its ••• menu, then move it down.
await p.getByRole('button', { name: 'Route actions' }).first().click();
await p.getByRole('menuitem', { name: 'Duplicate' }).click();
out.afterDuplicate = await p.locator('[data-route]').count();
out.secondTitle = await p.locator('[data-route]').nth(1).locator('button.group\\/title').innerText();
await p.getByRole('button', { name: 'Toggle route' }).first().click();
out.collapsedSummary = await p.locator('[data-route]').first().innerText();
// Reports tab.
await p.locator('[data-tab=reports]').click();
out.reportRows = await p.locator('tbody tr').count();
await p.screenshot({ path: `${S}/rf-reports.png` });
console.log(out, errors.length ? errors : 'no console errors');
await b.close();
