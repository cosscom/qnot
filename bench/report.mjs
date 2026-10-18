// Turns results/*.json + dist/sizes.json into results/REPORT.md tables.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const LABEL = {
  proto: 'prototype · React hooks',
  'proto-vanilla': 'prototype · vanilla DOM',
  rqb: 'react-querybuilder 8.25',
  raqb: 'react-awesome-query-builder 6.6',
  jqqb: 'jQuery QueryBuilder 3.0',
  syncfusion: 'Syncfusion ej2 QueryBuilder 35',
  devextreme: 'DevExtreme FilterBuilder 26',
};
const REACT = new Set(['proto', 'rqb', 'raqb']);
const sizes = JSON.parse(readFileSync('dist/sizes.json', 'utf8'));
const kb = (b) => (b / 1024).toFixed(1);
const f = (v, unit = '') => (v == null ? '—' : `${v}${unit}`);

let md = '';
const table = (head, rows) => {
  md += `| ${head.join(' | ')} |\n| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |\n`;
  for (const r of rows) md += `| ${r.join(' | ')} |\n`;
  md += '\n';
};

md += '## Bundle size (minified + gzip)\n\n';
const reactGz = sizes['_react-baseline'].jsGz;
table(
  ['Library', 'JS gz (total)', 'JS gz excl. React', 'CSS gz'],
  Object.keys(LABEL).map((k) => [
    LABEL[k],
    `${kb(sizes[k].jsGz)} KB`,
    REACT.has(k) ? `${kb(sizes[k].jsGz - reactGz)} KB` : `${kb(sizes[k].jsGz)} KB`,
    `${kb(sizes[k].cssGz)} KB`,
  ]),
);

for (const file of ['results/results.json', 'results/results-cpu4x.json']) {
  if (!existsSync(file)) continue;
  const { results, cpuThrottle } = JSON.parse(readFileSync(file, 'utf8'));
  const keys = Object.keys(LABEL).filter((k) => results[k]);
  const ns = Object.keys(results[keys[0]]).map(Number);
  const suffix = cpuThrottle > 1 ? ` — ${cpuThrottle}× CPU throttle` : '';
  const metric = (title, key, unit = ' ms') => {
    md += `## ${title}${suffix}\n\n`;
    table(['Library', ...ns.map((n) => `${n} rules`)], keys.map((k) => [LABEL[k], ...ns.map((n) => f(results[k][n]?.[key], unit))]));
  };
  metric('Mount, cold (first render in a fresh page, median)', 'mountColdMs');
  metric('Mount, warm (second render, JIT warm)', 'mountWarmMs');
  metric('Keystroke latency (type into one value input, median)', 'keystrokeMedianMs');
  metric('Keystroke main-thread CPU incl. deferred work + frame', 'keystrokeCpuMs');
  metric('Add rule to root group (median)', 'addRuleMedianMs');
  metric('Retained JS heap after mount', 'heapKB', ' KB');
  metric('DOM elements', 'dom', '');
  metric('Export to SQL (per call)', 'sqlMs');
  const errs = keys.flatMap((k) => ns.filter((n) => results[k][n]?.error).map((n) => `- ${LABEL[k]} @ ${n}: ${results[k][n].error}`));
  if (errs.length) md += `### Errors${suffix}\n\n${errs.join('\n')}\n\n`;
}

writeFileSync('results/REPORT.md', md);
console.log(md);
