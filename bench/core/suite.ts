// Core engine benchmarks (no DOM) for the full suite: bundled by suite.mjs with esbuild and run in
// Node. Prints one JSON document to stdout. Every benchmark runs ROUNDS timed rounds after a warm-up;
// each round runs a batch of fresh inputs prepared outside the timed region (encode results are
// memoized per node object, so "cold" needs new objects every call) and reports µs per operation.
import { compile, createQueryStore, defineFields, encode, decode, f, validateQuery, type Query, type Codec } from '../../packages/core/src/index';
import { sqlFormat } from '../../packages/core/src/formats/sql';
import { mongo } from '../../packages/core/src/formats/mongo';
import { jsonlogic } from '../../packages/core/src/formats/jsonlogic';
import { elasticsearch } from '../../packages/core/src/formats/elasticsearch';
import { spel } from '../../packages/core/src/formats/spel';
import { text } from '../../packages/core/src/formats/text';

const ROUNDS = Number(process.env.ROUNDS ?? 9);
const ROUND_MS = Number(process.env.ROUND_MS ?? 120);
const SIZES = (process.env.CORE_SIZES ?? '10,100,1000,10000').split(',').map(Number);

const fields = defineFields({
  name: f.text(),
  age: f.number({ min: 0 }),
  plan: f.enum(['free', 'pro', 'team', 'enterprise']),
  verified: f.boolean(),
  city: f.text(),
});
const keys = Object.keys(fields) as (keyof typeof fields)[];
const value = (k: string, i: number) => (k === 'age' ? i % 90 : k === 'plan' ? ['free', 'pro', 'team', 'enterprise'][i % 4] : k === 'verified' ? i % 2 === 0 : `v${i}`);
// Mixed operators so every codec exercises more than equality.
const OPS: Record<string, string[]> = { name: ['eq', 'contains', 'startsWith'], age: ['gt', 'between', 'lte'], plan: ['in', 'eq', 'neq'], verified: ['eq'], city: ['neq', 'endsWith', 'eq'] };

/** Same shape as the UI suite: root AND of OR groups of 10 rules. */
function tree(n: number): Query {
  const groups: Query[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) groups.push({ kind: 'group', combinator: 'or', children: [] });
    const k = keys[i % keys.length]!;
    const op = OPS[k]![Math.floor(i / keys.length) % OPS[k]!.length]!;
    const v = op === 'between' ? [i % 50, (i % 50) + 10] : op === 'in' ? ['pro', 'team'] : value(k, i);
    (groups[groups.length - 1]!.children as any[]).push({ kind: 'rule', field: k, operator: op, value: v });
  }
  return { kind: 'group', combinator: 'and', children: groups } as Query;
}

const quantile = (s: number[], q: number) => {
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo]! + (s[Math.min(s.length - 1, lo + 1)]! - s[lo]!) * (i - lo);
};
const round3 = (x: number) => Math.round(x * 1000) / 1000;

interface Stat {
  usPerOp: { median: number; p25: number; p75: number; min: number; max: number };
  opsPerSec: number;
  /** (p75 - p25) / median: run-to-run spread across rounds. */
  spread: number;
  rounds: number;
  batch: number;
}

/**
 * `make(i)` builds the i-th input untimed; `run(input)` is the timed operation. The batch size is
 * calibrated so one round takes about ROUND_MS.
 */
function bench<T>(make: (i: number) => T, run: (input: T) => unknown): Stat {
  let batch = 1;
  for (;;) {
    const inputs = Array.from({ length: batch }, (_, i) => make(i));
    const t0 = performance.now();
    for (const x of inputs) run(x);
    const ms = performance.now() - t0;
    if (ms > ROUND_MS / 4 || batch >= 1 << 16) {
      batch = Math.max(1, Math.round((batch * ROUND_MS) / Math.max(ms, 0.001)));
      break;
    }
    batch *= 4;
  }
  batch = Math.min(batch, 1 << 17);
  const per: number[] = [];
  for (let r = 0; r < ROUNDS + 1; r++) {
    const inputs = Array.from({ length: batch }, (_, i) => make(i));
    const t0 = performance.now();
    for (const x of inputs) run(x);
    const us = ((performance.now() - t0) * 1000) / batch;
    if (r > 0) per.push(us); // first round is warm-up
  }
  const s = per.sort((a, b) => a - b);
  const median = quantile(s, 0.5);
  const p25 = quantile(s, 0.25);
  const p75 = quantile(s, 0.75);
  return {
    usPerOp: { median: round3(median), p25: round3(p25), p75: round3(p75), min: round3(s[0]!), max: round3(s[s.length - 1]!) },
    opsPerSec: Math.round(1e6 / median),
    spread: round3((p75 - p25) / median),
    rounds: ROUNDS,
    batch,
  };
}

const CODECS: Record<string, Codec<any, any>> = {
  'sql (ansi)': sqlFormat(),
  'sql (postgres)': sqlFormat({ dialect: 'postgres' }),
  'sql (mysql)': sqlFormat({ dialect: 'mysql' }),
  'sql (sqlite)': sqlFormat({ dialect: 'sqlite' }),
  'sql (mssql)': sqlFormat({ dialect: 'mssql' }),
  'sql (postgres, $n params)': sqlFormat({ dialect: 'postgres', params: 'numbered' }),
  mongo,
  jsonlogic,
  elasticsearch,
  spel,
  text,
};

const out: Record<string, Record<string, Stat>> = {};
const put = (name: string, n: number, s: Stat) => {
  (out[name] ??= {})[n] = s;
  process.stderr.write(`  core ${name.padEnd(28)} n=${String(n).padEnd(6)} ${s.usPerOp.median.toFixed(2).padStart(10)} µs/op  ±${(s.spread * 100).toFixed(1)}%\n`);
};

const ROWS = Array.from({ length: 1000 }, (_, i) => Object.fromEntries(keys.map((k) => [k, value(k, i * 7)])));
const sqlAnsi = CODECS['sql (ansi)']!;

for (const n of SIZES) {
  const q = tree(n);
  const issues = validateQuery(fields, q);
  if (issues.length) throw new Error(`benchmark tree is invalid: ${JSON.stringify(issues[0])}`);
  const json = JSON.stringify(q);
  const fresh = () => JSON.parse(json) as Query;

  put('compile', n, bench(fresh, (x) => compile(fields, x as any)));
  const pred = compile(fields, q as any) as (row: unknown) => boolean;
  // One op = testing one row against the compiled predicate.
  put('matches (compiled, per row)', n, bench((i) => ROWS[i % ROWS.length], (row) => pred(row)));
  put('validate', n, bench(fresh, (x) => validateQuery(fields, x)));
  put('store: load', n, bench(fresh, (x) => createQueryStore({ fields, initial: x as any })));

  const store = createQueryStore({ fields, initial: q as any });
  const firstGroup = store.getGroup(store.rootId).children[0]!;
  const rid = store.getGroup(firstGroup).children[0]!;
  let k = 0;
  put('store: edit value', n, bench(() => `x${k++}`, (v) => store.setRuleValue(rid, v)));
  // An edit replaces only the path to the changed rule, so re-encoding reuses every other node.
  put('sql after one edit', n, bench(() => `y${k++}`, (v) => {
    store.setRuleValue(rid, v);
    encode(sqlAnsi, store.getQuery() as Query, fields);
  }));

  for (const [name, codec] of Object.entries(CODECS)) put(`encode ${name}`, n, bench(fresh, (x) => encode(codec, x, fields)));

  const sqlText = encode(sqlAnsi, q, fields) as string;
  put('decode sql (parse)', n, bench(() => sqlText, (s) => decode(sqlAnsi as any, s, fields)));
}

process.stdout.write(JSON.stringify({ sizes: SIZES, rounds: ROUNDS, roundMs: ROUND_MS, rowsForMatches: ROWS.length, results: out }));
