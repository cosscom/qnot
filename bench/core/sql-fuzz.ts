// SQL injection fuzz against a real database: hostile strings are stored in SQLite, then queried with
// trawlnet's inline-escaped and parameterized SQL; the rows must match compile() exactly and the
// table must survive. Run with `bun sql-fuzz.ts` (uses bun:sqlite).
import { Database } from 'bun:sqlite';
import { compile, defineFields, encode, f, type Query } from '../../packages/core/src/index';
import { sqlFormat } from '../../packages/core/src/formats/sql';

const fields = defineFields({ name: f.text({ caseSensitive: true }), n: f.number() });
const HOSTILE = [
  "'", "''", "'; DROP TABLE t; --", "\\", "\\'", "\\\\'", '"', '`', '--', '/*', '*/', ';', '%', '_', '%_%', '\\%', '[a]', '^',
  "O'Brien", '’', 'é', '🐟', ' ', '', 'NULL', "' OR '1'='1", "') OR ('1'='1", '$1', '?', ':name', '\n', '\t',
];
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const word = () => Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(HOSTILE)).join(rand() < 0.5 ? '' : 'x');

const db = new Database(':memory:');
db.run('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n INTEGER)');
const rows: { id: number; name: string; n: number }[] = [];
const insert = db.prepare('INSERT INTO t (id, name, n) VALUES (?, ?, ?)');
for (let i = 0; i < 400; i++) {
  const row = { id: i, name: i < HOSTILE.length ? HOSTILE[i]! : word(), n: i % 7 };
  rows.push(row);
  insert.run(row.id, row.name, row.n);
}

const OPS = ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'in', 'notIn'] as const;
const inline = sqlFormat({ dialect: 'sqlite' });
const params = sqlFormat({ dialect: 'sqlite', params: 'positional' });
let checked = 0;
const failures: string[] = [];
for (let i = 0; i < 3000; i++) {
  const op = pick(OPS);
  const value = op === 'in' || op === 'notIn' ? [word(), pick(HOSTILE)] : rand() < 0.5 ? pick(HOSTILE) : word();
  const q: Query = { kind: 'group', combinator: rand() < 0.5 ? 'and' : 'or', children: [{ kind: 'rule', field: 'name', operator: op, value }, { kind: 'rule', field: 'n', operator: 'lt', value: Math.floor(rand() * 8) }] };
  const expected = rows.filter(compile(fields, q as never) as (r: unknown) => boolean).map((r) => r.id).sort((a, b) => a - b);
  for (const [label, codec] of [['inline', inline], ['params', params]] as const) {
    const out = encode(codec as typeof inline, q, fields) as string | { sql: string; params: unknown[] };
    const sql = typeof out === 'string' ? out : out.sql;
    const args = typeof out === 'string' ? [] : (out.params as never[]);
    try {
      const got = (db.query(`SELECT id FROM t WHERE ${sql} ORDER BY id`).all(...args) as { id: number }[]).map((r) => r.id);
      if (JSON.stringify(got) !== JSON.stringify(expected)) failures.push(`${label} ${op} ${JSON.stringify(value)}: got ${got.length} rows, expected ${expected.length}\n  ${sql}`);
    } catch (e) {
      failures.push(`${label} ${op} ${JSON.stringify(value)}: ${(e as Error).message}\n  ${sql}`);
    }
    checked++;
  }
}
// NUL characters are refused rather than silently mangled by the database.
let refused = 0;
for (const codec of [inline, params]) {
  try {
    encode(codec as typeof inline, { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: 'eq', value: 'a\u0000b' }] }, fields);
  } catch {
    refused++;
  }
}
if (refused !== 2) failures.push('a NUL character was not refused');
const survived = (db.query("SELECT count(*) AS c FROM sqlite_master WHERE name = 't'").get() as { c: number }).c === 1;
console.log(`${checked} queries checked against SQLite, ${failures.length} mismatches, table intact: ${survived}`);
for (const f of failures.slice(0, 8)) console.log(' -', f);
if (failures.length || !survived) process.exit(1);
