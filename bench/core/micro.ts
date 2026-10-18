// Core engine microbenchmarks (no DOM): run with `bun micro.ts`.
import { compile, createQueryStore, defineFields, encode, f, validateQuery, type Query } from '../../packages/core/src/index';
import { jsonlogic } from '../../packages/core/src/formats/jsonlogic';
import { mongo } from '../../packages/core/src/formats/mongo';
import { sqlFormat } from '../../packages/core/src/formats/sql';

const fields = defineFields({
  name: f.text(),
  age: f.number({ min: 0 }),
  plan: f.enum(['free', 'pro', 'team', 'enterprise']),
  verified: f.boolean(),
  city: f.text(),
});
const keys = Object.keys(fields) as (keyof typeof fields)[];
const value = (k: string, i: number) => (k === 'age' ? i % 90 : k === 'plan' ? ['free', 'pro', 'team', 'enterprise'][i % 4] : k === 'verified' ? i % 2 === 0 : `v${i}`);

function tree(n: number): Query {
  const groups: Query[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) groups.push({ kind: 'group', combinator: 'or', children: [] });
    const k = keys[i % keys.length]!;
    (groups[groups.length - 1]!.children as any[]).push({ kind: 'rule', field: k, operator: 'eq', value: value(k, i) });
  }
  return { kind: 'group', combinator: 'and', children: groups };
}

function time(label: string, reps: number, fn: () => void) {
  for (let i = 0; i < Math.min(reps, 3); i++) fn();
  const t0 = performance.now();
  for (let i = 0; i < reps; i++) fn();
  const ms = (performance.now() - t0) / reps;
  console.log(`${label.padEnd(46)} ${ms < 0.1 ? (ms * 1000).toFixed(1) + ' µs' : ms.toFixed(2) + ' ms'}`);
  return ms;
}

const sql = sqlFormat({ dialect: 'postgres', params: 'numbered' });
const rows = Array.from({ length: 10_000 }, (_, i) => Object.fromEntries(keys.map((k) => [k, value(k, i * 7)])));

for (const n of [1000, 10_000]) {
  const q = tree(n);
  console.log(`--- ${n} rules`);
  time('createQueryStore', n >= 10_000 ? 5 : 30, () => createQueryStore({ fields, initial: q as any }));
  const store = createQueryStore({ fields, initial: q as any });
  const ids = store.getGroup(store.getGroup(store.rootId).children[0]!).children;
  time('getQuery (cold, after an edit)', 50, () => {
    store.setRuleValue(ids[0]!, `x${Math.random()}`);
    store.getQuery();
  });
  time('setRuleValue (keystroke)', 2000, () => store.setRuleValue(ids[0]!, `y${Math.random()}`));
  time('encode sql (cold: new query object)', n >= 10_000 ? 5 : 20, () => encode(sql, structuredClone(q), fields));
  time('encode sql (after one edit, memoized)', 200, () => {
    store.setRuleValue(ids[0]!, `z${Math.random()}`);
    encode(sql, store.getQuery() as Query, fields);
  });
  time('encode mongo (cold)', n >= 10_000 ? 5 : 20, () => encode(mongo, structuredClone(q), fields));
  time('encode jsonlogic (cold)', n >= 10_000 ? 5 : 20, () => encode(jsonlogic, structuredClone(q), fields));
  time('validateQuery', n >= 10_000 ? 5 : 20, () => validateQuery(fields, q));
  time('store.isValid (after one edit)', 50, () => {
    store.setRuleValue(ids[0]!, `w${Math.random()}`);
    store.isValid();
  });
  time('compile', n >= 10_000 ? 5 : 20, () => compile(fields, q as any));
  const pred = compile(fields, q as any);
  time('filter 10k rows with compiled predicate', 5, () => rows.filter(pred as any));
}
