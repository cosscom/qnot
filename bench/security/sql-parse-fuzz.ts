// Fuzz the SQL WHERE-clause parser (the sql codec's decode): every input must either parse or throw a
// clean trawlnet Error, quickly, and never overflow the stack. Also checks encode → decode → encode
// round trips. Run with `bun bench/security/sql-parse-fuzz.ts`.
import { builtinFunctions, decode, defineFields, encode, f, validateQuery, type Query } from '../../packages/core/src/index';
import { sqlFormat, type SqlDialect } from '../../packages/core/src/formats/sql';
import { PAYLOADS } from './payloads';

const fields = defineFields({ name: f.text(), age: f.number(), plan: f.enum(['free', 'pro', "o'k"]), joined: f.date() }, { functions: builtinFunctions });
const DIALECTS: SqlDialect[] = ['ansi', 'postgres', 'mysql', 'sqlite', 'mssql'];
let seed = 99;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

const TOKENS = ['name', 'age', 'plan', '"name"', '`age`', '[plan]', "'x'", "'o''k'", "E'a\\\\'b'", "N'x'", "X'41'", "_utf8mb4 X'41'", '1', '-2.5e3', 'TRUE', 'NULL', '(', ')', ',', '.', '=', '<>', '!=', '<', '>=', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'ESCAPE', "'!'", 'IS', 'LOWER(', 'CURRENT_DATE', '--', '/*', ';', '?', '$1', ':p', '@p', "'", '"', '\\', '\u0000', '😀'];

let checked = 0;
const problems: string[] = [];
let slowest = 0;
function attempt(src: string, dialect: SqlDialect, label: string) {
  checked++;
  const t0 = performance.now();
  try {
    const q = decode(sqlFormat({ dialect }), src, fields);
    // Whatever parses must be a well-formed query the validator can walk.
    validateQuery(fields, q);
  } catch (e) {
    if (!(e instanceof Error) || e instanceof RangeError || !e.message.startsWith('trawlnet/')) problems.push(`${label}: ${(e as Error)?.constructor?.name} ${String((e as Error)?.message).slice(0, 120)}`);
    else if (e.message.length > 400) problems.push(`${label}: error message too long (${e.message.length})`);
  }
  const ms = performance.now() - t0;
  slowest = Math.max(slowest, ms);
  if (ms > 250) problems.push(`${label}: took ${ms.toFixed(0)} ms (${src.length} chars)`);
}

for (let i = 0; i < 20000; i++) {
  const n = 1 + Math.floor(rand() * 30);
  const src = Array.from({ length: n }, () => (rand() < 0.15 ? `'${pick(PAYLOADS).replace(/'/g, "''")}'` : pick(TOKENS))).join(rand() < 0.8 ? ' ' : '');
  attempt(src, pick(DIALECTS), `random #${i}`);
}
for (const depth of [100, 199, 200, 201, 1000, 10000, 100000]) {
  for (const d of DIALECTS) {
    attempt(`${'('.repeat(depth)}age = 1${')'.repeat(depth)}`, d, `parens ${depth} (${d})`);
    attempt(`${'NOT '.repeat(depth)}age = 1`, d, `NOT ${depth} (${d})`);
    attempt(`LOWER(${'LOWER('.repeat(depth)}name${')'.repeat(depth)}) = 'a'`, d, `calls ${depth} (${d})`);
  }
}
const big = Array.from({ length: 20000 }, (_, i) => `age = ${i}`).join(' OR ');
attempt(big, 'postgres', `20k-term OR (${big.length} chars)`);
attempt(`name IN (${Array.from({ length: 50000 }, () => "'x'").join(', ')})`, 'postgres', '50k-item IN');
attempt(`name = '${'a'.repeat(900_000)}'`, 'postgres', '900k-char string');
attempt(`name = '${'a'.repeat(1_200_000)}'`, 'postgres', '1.2M-char input (over the limit)');
attempt(`name = '${"''".repeat(200_000)}`, 'postgres', 'unterminated 400k quotes');
attempt(`${'a'.repeat(500_000)} = 1`, 'postgres', '500k-char identifier');
attempt(' '.repeat(900_000), 'postgres', '900k spaces');

// Round trips: what the encoder writes, the decoder reads back to the same SQL.
let roundTrips = 0;
const rtFail: string[] = [];
const scalars = (k: string) => (k === 'age' ? Math.floor(rand() * 200) - 50 : k === 'plan' ? pick(['free', 'pro', "o'k"]) : pick(PAYLOADS.filter((p) => !p.includes('\u0000') && !/[%_!]/.test(p))));
for (let i = 0; i < 4000; i++) {
  const field = pick(['name', 'age', 'plan']);
  const op = field === 'age' ? pick(['eq', 'neq', 'lt', 'gte', 'between', 'in']) : field === 'plan' ? pick(['eq', 'neq', 'in', 'notIn']) : pick(['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'in', 'notIn']);
  const value = op === 'between' ? [10, 20] : op === 'in' || op === 'notIn' ? [scalars(field), scalars(field)] : scalars(field);
  const q: Query = { kind: 'group', combinator: pick(['and', 'or']), children: [{ kind: 'rule', field, operator: op, value }, { kind: 'rule', field: 'age', operator: 'gt', value: 1 }] };
  for (const dialect of DIALECTS) {
    const codec = sqlFormat({ dialect });
    let sql1: string;
    try {
      sql1 = encode(codec, q, fields) as string;
    } catch {
      continue;
    }
    roundTrips++;
    try {
      const sql2 = encode(codec, decode(codec, sql1, fields), fields) as string;
      if (sql1 !== sql2) rtFail.push(`${dialect}: ${sql1.slice(0, 160)} → ${sql2.slice(0, 160)}`);
    } catch (e) {
      rtFail.push(`${dialect}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
}
console.log(`${checked} parser inputs, slowest ${slowest.toFixed(1)} ms, problems: ${problems.length}; ${roundTrips} round trips, failures: ${rtFail.length}`);
for (const p of [...problems.slice(0, 10), ...rtFail.slice(0, 10)]) console.log(' -', p);
process.exit(problems.length || rtFail.length ? 1 : 0);
