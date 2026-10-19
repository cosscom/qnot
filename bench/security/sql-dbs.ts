// SQL injection differential fuzz against real databases (run with bun):
//
//   docker run -d --name qn-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16
//   docker run -d --name qn-mysql -e MYSQL_ROOT_PASSWORD=pw -e MYSQL_DATABASE=t -p 53306:3306 mysql:8.4
//   docker run -d --name qn-mssql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Str0ng!Passw0rd' -p 51433:1433 mcr.microsoft.com/mssql/server:2022-latest
//   bun bench/security/sql-dbs.ts            # every reachable database; ONLY=pg,mysql,mssql,sqlite N=2000
//
// Hostile strings are both stored and queried. For every generated query, in inline and parameterized
// mode: the rows must equal compile() on the same data, a canary table must survive, and no statement
// may run longer than 2 s (catches time-based payloads). Postgres also runs with
// standard_conforming_strings=off and MySQL with NO_BACKSLASH_ESCAPES.
import { Database } from 'bun:sqlite';
import mssql from 'mssql';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { builtinFunctions, compile, defineFields, encode, f, type Query, type QueryNode } from '../../packages/core/src/index';
import { sqlFormat, type SqlDialect } from '../../packages/core/src/formats/sql';
import { PAYLOADS } from './payloads';

const N = Number(process.env.N ?? 1500);
const ONLY = (process.env.ONLY ?? 'sqlite,pg,pg-scs-off,mysql,mysql-nobackslash,mssql').split(',');
const SAFE = PAYLOADS.filter((p) => !p.includes('\u0000'));
const TAGS = SAFE.slice(0, 40);

const fields = defineFields(
  {
    name: f.text({ caseSensitive: true }),
    n: f.number(),
    tier: f.enum(SAFE),
    tags: f.multiEnum(TAGS),
    signedUp: f.date(),
  },
  { functions: builtinFunctions },
);

let seed = 1234567;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const word = () => Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(SAFE)).join(rand() < 0.5 ? '' : 'x');

interface Row {
  id: number;
  name: string;
  n: number;
  tier: string;
  tags: string[];
}
const rows: Row[] = Array.from({ length: 300 }, (_, id) => ({
  id,
  name: id < SAFE.length ? SAFE[id]! : word(),
  n: id % 9,
  tier: pick(SAFE),
  tags: Array.from({ length: Math.floor(rand() * 4) }, () => pick(TAGS)).filter((t, i, a) => a.indexOf(t) === i),
}));

function randomRule(dialect: SqlDialect): QueryNode {
  const r = rand();
  if (r < 0.45) {
    const op = pick(['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'in', 'notIn'] as const);
    const value = op === 'in' || op === 'notIn' ? [word(), pick(SAFE)] : rand() < 0.5 ? pick(SAFE) : word();
    return { kind: 'rule', field: 'name', operator: op, value };
  }
  if (r < 0.6) return { kind: 'rule', field: 'tier', operator: pick(['eq', 'neq', 'in', 'notIn'] as const), value: rand() < 0.5 ? pick(SAFE) : [pick(SAFE), pick(SAFE)] } as QueryNode;
  if (r < 0.8 && dialect !== 'ansi') {
    const op = pick(['hasAny', 'hasAll', 'hasNone', 'setEq', 'setNeq'] as const);
    return { kind: 'rule', field: 'tags', operator: op, value: [pick(TAGS), pick(TAGS)].filter((t, i, a) => a.indexOf(t) === i) };
  }
  return { kind: 'rule', field: 'n', operator: pick(['lt', 'gte', 'eq'] as const), value: Math.floor(rand() * 10) - 1 };
}

function randomQuery(dialect: SqlDialect): Query {
  const children: QueryNode[] = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => randomRule(dialect));
  if (rand() < 0.3) children.push({ kind: 'group', combinator: rand() < 0.5 ? 'and' : 'or', not: rand() < 0.5, children: [randomRule(dialect), randomRule(dialect)] });
  // Values must survive a JSON round trip (that's what a server receives).
  return JSON.parse(JSON.stringify({ kind: 'group', combinator: rand() < 0.5 ? 'and' : 'or', not: rand() < 0.2, children }));
}

/** Tampered queries a valid client would never send: every one must be refused (throw), never emitted. */
const TAMPERED: { name: string; query: unknown }[] = [
  { name: 'relativeDate unit injection', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'signedUp', operator: 'gt', call: { fn: 'relativeDate', args: { amount: { value: 1 }, unit: { value: "day'; DROP TABLE canary; --" }, direction: { value: 'ago' } } } }] } },
  { name: 'relativeDate amount injection', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'signedUp', operator: 'gt', call: { fn: 'relativeDate', args: { amount: { value: "1' day; DROP TABLE canary; --" }, unit: { value: 'day' }, direction: { value: 'ago' } } } }] } },
  { name: 'unknown field as column', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: '1=1; DROP TABLE canary; --', operator: 'eq', value: 'x' }] } },
  { name: '__proto__ field', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: '__proto__', operator: 'eq', value: 'x' }] } },
  { name: 'constructor field', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'constructor', operator: 'eq', value: 'x' }] } },
  { name: 'toString function', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: { fn: 'toString', args: {} }, operator: 'eq', value: 'x' }] } },
  { name: 'ref to unknown column', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'n', operator: 'eq', ref: 'n); DROP TABLE canary; --' }] } },
  { name: 'object value', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: 'eq', value: { toString: "x' OR '1'='1" } }] } },
  { name: 'unknown operator', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: "= 'x' OR 1=1 --", value: 'x' }] } },
  { name: 'bad combinator', query: { kind: 'group', combinator: "OR 1=1 OR", children: [{ kind: 'rule', field: 'n', operator: 'eq', value: 1 }, { kind: 'rule', field: 'n', operator: 'eq', value: 2 }] } },
  { name: 'enum value outside options', query: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'tier', operator: 'eq', value: 'not-an-option' }] } },
  { name: 'non-array children', query: { kind: 'group', combinator: 'and', children: "' OR 1=1 --" } },
];

interface Db {
  name: string;
  dialect: SqlDialect;
  query(sql: string, params: unknown[] | Record<string, unknown>): Promise<number[]>;
  canary(): Promise<boolean>;
  close(): Promise<void>;
  /** Whether this session's string semantics make the comparison with compile() meaningful. */
  exact: boolean;
}

const sortIds = (ids: number[]) => [...ids].sort((a, b) => a - b);
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms} ms`)), ms))]);

async function sqliteDb(): Promise<Db> {
  const db = new Database(':memory:');
  db.run('PRAGMA case_sensitive_like = ON');
  db.run('CREATE TABLE canary (x INTEGER)');
  db.run('INSERT INTO canary VALUES (1)');
  db.run('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n INTEGER, tier TEXT, tags TEXT, signedUp TEXT)');
  const ins = db.prepare('INSERT INTO t VALUES (?, ?, ?, ?, ?, NULL)');
  for (const r of rows) ins.run(r.id, r.name, r.n, r.tier, JSON.stringify(r.tags));
  return {
    name: 'sqlite (bun:sqlite ' + (db.query('select sqlite_version() v').get() as { v: string }).v + ')',
    dialect: 'sqlite',
    exact: true,
    async query(sql, params) {
      return (db.query(`SELECT id FROM t WHERE ${sql}`).all(...((params as never[]) ?? [])) as { id: number }[]).map((r) => r.id);
    },
    async canary() {
      return (db.query("SELECT count(*) c FROM sqlite_master WHERE name='canary'").get() as { c: number }).c === 1;
    },
    async close() {
      db.close();
    },
  };
}

async function pgDb(scsOff: boolean): Promise<Db> {
  const client = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'postgres', password: 'pw', database: 'postgres' });
  await client.connect();
  const schema = scsOff ? 'scsoff' : 'std';
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}; SET search_path = ${schema}`);
  await client.query('CREATE TABLE canary (x int); INSERT INTO canary VALUES (1)');
  await client.query('CREATE TABLE t (id int primary key, name text, n int, tier text, tags text[], "signedUp" date)');
  for (const r of rows) await client.query('INSERT INTO t VALUES ($1, $2, $3, $4, $5, NULL)', [r.id, r.name, r.n, r.tier, r.tags]);
  await client.query("SET statement_timeout = '2s'");
  if (scsOff) await client.query('SET standard_conforming_strings = off; SET escape_string_warning = off');
  const version = (await client.query('SHOW server_version')).rows[0].server_version;
  return {
    name: `postgres ${version}${scsOff ? ' (standard_conforming_strings=off)' : ''}`,
    dialect: 'postgres',
    exact: true,
    async query(sql, params) {
      return (await client.query(`SELECT id FROM t WHERE ${sql}`, params as unknown[])).rows.map((r) => r.id);
    },
    async canary() {
      return (await client.query(`SELECT to_regclass('${schema}.canary') IS NOT NULL AS ok`)).rows[0].ok;
    },
    async close() {
      await client.end();
    },
  };
}

async function mysqlDb(noBackslash: boolean): Promise<Db> {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 53306, user: 'root', password: 'pw', database: 't', multipleStatements: false });
  const table = noBackslash ? 't_nb' : 't';
  await conn.query(`DROP TABLE IF EXISTS ${table}, canary${noBackslash ? '_nb' : ''}`);
  await conn.query(`CREATE TABLE canary${noBackslash ? '_nb' : ''} (x int)`);
  await conn.query(`CREATE TABLE ${table} (id int primary key, name varchar(4000) COLLATE utf8mb4_0900_bin, n int, tier varchar(4000) COLLATE utf8mb4_0900_bin, tags json, signedUp date)`);
  for (const r of rows) await conn.execute(`INSERT INTO ${table} VALUES (?, ?, ?, ?, ?, NULL)`, [r.id, r.name, r.n, r.tier, JSON.stringify(r.tags)]);
  if (noBackslash) await conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_BACKSLASH_ESCAPES')");
  const [[{ v }]] = (await conn.query('SELECT VERSION() v')) as unknown as [[{ v: string }]];
  return {
    name: `mysql ${v}${noBackslash ? ' (NO_BACKSLASH_ESCAPES)' : ''}`,
    dialect: 'mysql',
    exact: true,
    async query(sql, params) {
      // execute(): server-side prepared statements, the safe way to send ? placeholders.
      const [res] = await conn.execute(`SELECT /*+ MAX_EXECUTION_TIME(2000) */ id FROM ${table} WHERE ${sql}`, params as unknown[]);
      return (res as { id: number }[]).map((r) => r.id);
    },
    async canary() {
      const [res] = await conn.query(`SHOW TABLES LIKE 'canary${noBackslash ? '_nb' : ''}'`);
      return (res as unknown[]).length === 1;
    },
    async close() {
      await conn.end();
    },
  };
}

async function mssqlDb(): Promise<Db> {
  const base = { server: '127.0.0.1', port: 51433, user: 'sa', password: 'Str0ng!Passw0rd', options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 2000 };
  const admin = await mssql.connect({ ...base, database: 'master' });
  await admin.request().query("IF DB_ID('qn') IS NOT NULL BEGIN ALTER DATABASE tn SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE tn; END");
  await admin.request().query('CREATE DATABASE tn COLLATE Latin1_General_100_BIN2_UTF8');
  await admin.close();
  const pool = await new mssql.ConnectionPool({ ...base, database: 'qn' }).connect();
  await pool.request().query('CREATE TABLE canary (x int); INSERT INTO canary VALUES (1)');
  await pool.request().query('CREATE TABLE t (id int primary key, name nvarchar(4000), n int, tier nvarchar(4000), tags nvarchar(max), signedUp date)');
  for (const r of rows) {
    const req = pool.request();
    req.input('id', r.id).input('name', mssql.NVarChar, r.name).input('n', r.n).input('tier', mssql.NVarChar, r.tier).input('tags', mssql.NVarChar, JSON.stringify(r.tags));
    await req.query('INSERT INTO t VALUES (@id, @name, @n, @tier, @tags, NULL)');
  }
  const version = (await pool.request().query('SELECT SERVERPROPERTY(\'ProductVersion\') v')).recordset[0].v;
  return {
    name: `mssql ${version}`,
    dialect: 'mssql',
    exact: true,
    async query(sql, params) {
      const req = pool.request();
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (typeof v === 'string') req.input(k, mssql.NVarChar, v);
        else req.input(k, v);
      }
      return (await req.query(`SELECT id FROM t WHERE ${sql}`)).recordset.map((r: { id: number }) => r.id);
    },
    async canary() {
      return (await pool.request().query("SELECT OBJECT_ID('canary') AS id")).recordset[0].id !== null;
    },
    async close() {
      await pool.close();
    },
  };
}

const OPENERS: Record<string, () => Promise<Db>> = {
  sqlite: sqliteDb,
  pg: () => pgDb(false),
  'pg-scs-off': () => pgDb(true),
  mysql: () => mysqlDb(false),
  'mysql-nobackslash': () => mysqlDb(true),
  mssql: mssqlDb,
};

interface Stats {
  db: string;
  queries: number;
  /** Inline results differing from parameterized results on the same server: the escaping oracle. */
  modeMismatches: string[];
  quirkSkipped: number;
  refused: number;
  mismatches: string[];
  errors: string[];
  timeouts: number;
  canary: boolean;
  tamperedEmitted: string[];
}

async function run(db: Db): Promise<Stats> {
  const stats: Stats = { db: db.name, modeMismatches: [], quirkSkipped: 0, queries: 0, refused: 0, mismatches: [], errors: [], timeouts: 0, canary: true, tamperedEmitted: [] };
  const paramStyle = db.dialect === 'mssql' ? 'named' : db.dialect === 'postgres' ? 'numbered' : 'positional';
  const codecs = [
    ['inline', sqlFormat({ dialect: db.dialect })],
    ['params', sqlFormat({ dialect: db.dialect, params: paramStyle as 'numbered' })],
  ] as const;
  for (let i = 0; i < N; i++) {
    const q = randomQuery(db.dialect);
    // bun:sqlite drops a leading U+FEFF from bound strings (UTF-16 binding reads it as a byte-order
    // mark), so stored rows and parameters lose it while inline literals keep it: a driver quirk.
    if (db.dialect === 'sqlite' && JSON.stringify(q).includes('\ufeff')) {
      stats.quirkSkipped++;
      continue;
    }
    const expected = sortIds(rows.filter(compile(fields, q as never) as (r: unknown) => boolean).map((r) => r.id));
    const byMode: Record<string, { ids: number[]; sql: string }> = {};
    for (const [mode, codec] of codecs) {
      let out: string | { sql: string; params: unknown[] | Record<string, unknown> };
      try {
        out = encode(codec as never, q, fields) as typeof out;
      } catch (e) {
        stats.refused++;
        continue;
      }
      const sql = typeof out === 'string' ? out : out.sql;
      const params = typeof out === 'string' ? (db.dialect === 'mssql' ? {} : []) : out.params;
      stats.queries++;
      try {
        const got = sortIds(await withTimeout(db.query(sql, params), 4000));
        byMode[mode] = { ids: got, sql };
        if (db.exact && JSON.stringify(got) !== JSON.stringify(expected)) {
          const extra = got.filter((id) => !expected.includes(id)).map((id) => rows[id]);
          const missing = expected.filter((id) => !got.includes(id)).map((id) => rows[id]);
          stats.mismatches.push(`[${mode}] got ${got.length}, expected ${expected.length}: ${sql.slice(0, 300)}\n      extra: ${JSON.stringify(extra).slice(0, 300)}\n      missing: ${JSON.stringify(missing).slice(0, 300)}`);
        }
      } catch (e) {
        const msg = (e as Error).message;
        if (/timeout|canceling statement|maximum statement execution time|Timeout/i.test(msg)) stats.timeouts++;
        stats.errors.push(`[${mode}] ${msg.slice(0, 160)} :: ${sql.slice(0, 240)}`);
      }
    }
    if (byMode.inline && byMode.params && JSON.stringify(byMode.inline.ids) !== JSON.stringify(byMode.params.ids)) {
      const a = byMode.inline.ids;
      const b = byMode.params.ids;
      const diff = [...a.filter((x) => !b.includes(x)), ...b.filter((x) => !a.includes(x))].map((id) => rows[id]);
      stats.modeMismatches.push(`inline ${a.length} vs params ${b.length}: ${byMode.inline.sql.slice(0, 260)}\n      differing rows: ${JSON.stringify(diff).slice(0, 260)}`);
    }
    if (i % 200 === 0 && !(await db.canary())) stats.canary = false;
  }
  for (const t of TAMPERED) {
    for (const [mode, codec] of codecs) {
      try {
        const out = encode(codec as never, t.query as Query, fields);
        stats.tamperedEmitted.push(`${t.name} [${mode}]: ${JSON.stringify(out).slice(0, 200)}`);
      } catch {
        /* refused: good */
      }
    }
  }
  if (!(await db.canary())) stats.canary = false;
  return stats;
}

/** Databases in containers take a while to accept connections: retry for up to WAIT seconds. */
async function open(name: string): Promise<Db> {
  const deadline = Date.now() + Number(process.env.WAIT ?? 5) * 1000;
  for (;;) {
    try {
      return await OPENERS[name]!();
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const REQUIRED = process.env.REQUIRED?.split(',') ?? [];
const results: Stats[] = [];
let missing = false;
for (const name of ONLY) {
  let db: Db;
  try {
    db = await open(name);
  } catch (e) {
    console.log(`skip ${name}: ${(e as Error).message.split('\n')[0]}`);
    if (REQUIRED.includes(name)) missing = true;
    continue;
  }
  const s = await run(db);
  await db.close();
  results.push(s);
  console.log(`\n== ${s.db}\n   ${s.queries} queries run, ${s.refused} refused at encode, inline≠params: ${s.modeMismatches.length}, rows≠compile(): ${s.mismatches.length}, errors: ${s.errors.length} (${s.timeouts} timeouts), canary intact: ${s.canary}, tampered queries emitted: ${s.tamperedEmitted.length}`);
  for (const m of [...s.tamperedEmitted, ...s.modeMismatches.slice(0, 4), ...s.mismatches.slice(0, 4), ...s.errors.slice(0, 4)]) console.log('   -', m);
}
await Bun.write(`${import.meta.dir}/last-run.json`, JSON.stringify(results.map((r) => ({ ...r, modeMismatches: r.modeMismatches.length, mismatches: r.mismatches.length, errors: r.errors.length, samples: [...r.modeMismatches.slice(0, 10), ...r.mismatches.slice(0, 20), ...r.errors.slice(0, 20)] })), null, 2));
// Fail on anything that could be injection: a dropped canary, an emitted tampered query, a SQL error
// (structure broke), a timeout, or inline output that the server reads differently from bound
// parameters. Row differences against compile() are reported but can be collation semantics.
const STRICT = process.env.STRICT === '1';
const bad = results.some((r) => !r.canary || r.tamperedEmitted.length || r.errors.length || r.modeMismatches.length || (STRICT && r.mismatches.length));
process.exit(bad || missing ? 1 : 0);
