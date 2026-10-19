// Regression tests for the SQL injection audit (see SECURITY.md). Each block names the finding.
import { describe, expect, it } from 'vitest';
import { decode, encode, encodeCases } from '../codec';
import { defineFields, f } from '../fields';
import { builtinFunctions, defineFunction } from '../functions';
import type { Query, QueryNode } from '../types';
import { sqlFormat } from './sql';

const fields = defineFields(
  {
    name: f.text(),
    age: f.number(),
    plan: f.enum(['free', 'pro']),
    tags: f.multiEnum(['a\\b', "o'k", 'x']),
    joined: f.date(),
    orders: f.array({ qty: f.number() }),
  },
  {
    functions: {
      ...builtinFunctions,
      // A format that repeats and reorders its arguments.
      between2: defineFunction({ returns: f.number(), args: { lo: f.number(), hi: f.number() }, evaluate: () => 0, formats: { sql: ({ lo, hi }) => `GREATEST(${hi}, ${lo}, ${hi})` } }),
    },
  },
);
const q = (...children: unknown[]): Query => ({ kind: 'group', combinator: 'and', children: children as QueryNode[] });
const rule = (field: unknown, operator: string, value?: unknown, extra: object = {}) => ({ kind: 'rule', field, operator, value, ...extra });

describe('string literals mean the same under every server setting', () => {
  it('Postgres: backslashes use E-strings (standard_conforming_strings on or off)', () => {
    expect(encode(sqlFormat({ dialect: 'postgres' }), q(rule('name', 'eq', "a\\'b")), fields)).toBe("name = E'a\\\\''b'");
    expect(encode(sqlFormat({ dialect: 'postgres' }), q(rule('name', 'eq', "a'b")), fields)).toBe("name = 'a''b'");
  });

  it('MySQL: backslashes use hex literals (with or without NO_BACKSLASH_ESCAPES)', () => {
    expect(encode(sqlFormat({ dialect: 'mysql' }), q(rule('name', 'eq', "a\\'b")), fields)).toBe("name = _utf8mb4 X'615c2762'");
    const json = encode(sqlFormat({ dialect: 'mysql' }), q(rule('tags', 'hasAny', ['a\\b'])), fields) as string;
    expect(json).not.toContain('\\');
  });

  it('SQL Server: N-prefixed literals; ANSI and SQLite: plain', () => {
    expect(encode(sqlFormat({ dialect: 'mssql' }), q(rule('name', 'eq', "é'")), fields)).toBe("name = N'é'''");
    expect(encode(sqlFormat({ dialect: 'sqlite' }), q(rule('name', 'eq', "a\\'b")), fields)).toBe("name = 'a\\''b'");
  });

  it('refuses NUL anywhere a value is written, including function arguments', () => {
    const nul = q(rule('name', 'eq', undefined, { call: { fn: 'upper', args: { text: { value: 'a\u0000b' } } } }));
    expect(() => encode(sqlFormat({ dialect: 'postgres' }), nul, fields)).toThrow(/NUL/);
  });
});

describe('LIKE patterns', () => {
  it('escape wildcards with "!" and always name the escape character', () => {
    expect(encode(sqlFormat({ dialect: 'postgres' }), q(rule('name', 'contains', '50%_off!')), fields)).toBe("name LIKE '%50!%!_off!!%' ESCAPE '!'");
    // MySQL and Postgres default to a backslash escape: without ESCAPE a value's backslash would be special.
    expect(encode(sqlFormat({ dialect: 'mysql' }), q(rule('name', 'startsWith', 'x')), fields)).toBe("name LIKE 'x%' ESCAPE '!'");
  });

  it('SQL Server: [ and ] are escaped too (they are wildcard syntax there)', () => {
    expect(encode(sqlFormat({ dialect: 'mssql' }), q(rule('name', 'contains', '[a]^')), fields)).toBe("name LIKE N'%![a!]^%' ESCAPE '!'");
  });

  it('case-insensitive equality on Postgres matches the value literally (no wildcards)', () => {
    expect(encode(sqlFormat({ dialect: 'postgres', caseInsensitive: true }), q(rule('name', 'eq', 'adm%')), fields)).toBe("name ILIKE 'adm!%' ESCAPE '!'");
  });
});

describe('untrusted names never reach the SQL', () => {
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', '1=1; DROP TABLE t; --'])('refuses field %s', (name) => {
    expect(() => encode(sqlFormat(), q(rule(name, 'eq', 'x')), fields)).toThrow(/Unknown field/);
  });

  it('refuses refs and functions that are not the schema’s own', () => {
    expect(() => encode(sqlFormat(), q(rule('age', 'eq', undefined, { ref: 'constructor' })), fields)).toThrow(/Unknown field/);
    expect(() => encode(sqlFormat(), q(rule({ fn: 'constructor', args: {} }, 'eq', 'x')), fields)).toThrow(/Unknown function/);
    expect(() => encode(sqlFormat(), q(rule('age', 'eq', undefined, { call: { fn: '__proto__', args: {} } })), fields)).toThrow(/Unknown function/);
  });

  it('refuses unknown operators', () => {
    expect(() => encode(sqlFormat(), q(rule('name', "= 'x' OR 1=1 --", 'x')), fields)).toThrow(/Unknown operator/);
  });

  it('requires plain identifiers unless quoteIdentifiers is on', () => {
    const odd = defineFields({ name: f.text({ column: 'user name' }) });
    expect(() => encode(sqlFormat(), q(rule('name', 'eq', 'x')), odd)).toThrow(/quoteIdentifiers/);
    expect(encode(sqlFormat({ quoteIdentifiers: true }), q(rule('name', 'eq', 'x')), odd)).toBe(`"user name" = 'x'`);
    expect(encode(sqlFormat({ dialect: 'mssql', quoteIdentifiers: true }), q(rule('name', 'eq', 'x')), defineFields({ name: f.text({ column: 'a]b' }) }))).toBe("[a]]b] = N'x'");
  });
});

describe('values', () => {
  it('only JSON scalars reach SQL, inline or as parameters', () => {
    const sneaky = { toString: () => "x' OR '1'='1", valueOf: () => 1 };
    for (const codec of [sqlFormat(), sqlFormat({ params: 'positional' })] as Parameters<typeof encode>[0][]) {
      expect(() => encode(codec, q(rule('name', 'eq', sneaky)), fields)).toThrow(/invalid rule/);
      expect(() => encode(codec, q(rule('tags', 'hasAny', [sneaky])), fields)).toThrow(/invalid rule/);
    }
  });

  it('reads each rule once: a getter cannot swap the value after validation', () => {
    let reads = 0;
    const r = {
      kind: 'rule',
      field: 'name',
      operator: 'eq',
      get value() {
        reads++;
        return reads === 1 ? 'safe' : "x' OR '1'='1";
      },
    };
    expect(encode(sqlFormat(), q(r), fields)).toBe("name = 'safe'");
  });
});

describe('structure', () => {
  it('refuses a tampered combinator or NOT flag, even with unsupported: skip', () => {
    const bad = { kind: 'group', combinator: 'OR 1=1 OR', children: [rule('age', 'eq', 1), rule('age', 'eq', 2)] } as unknown as Query;
    expect(() => encode(sqlFormat({ unsupported: 'skip' }), bad, fields)).toThrow(/"and" or "or"/);
    expect(() => encode(sqlFormat(), { ...q(rule('age', 'eq', 1)), not: 'yes' } as unknown as Query, fields)).toThrow(/NOT flag/);
  });

  it('refuses malformed nodes with a clean error', () => {
    expect(() => encode(sqlFormat(), { kind: 'group', combinator: 'and', children: "' OR 1=1" } as unknown as Query, fields)).toThrow(/malformed query node/);
    expect(() => encode(sqlFormat(), q('rule'), fields)).toThrow(/malformed query node/);
  });

  it('refuses a malformed list quantifier', () => {
    const g = { kind: 'group', combinator: 'and', of: { field: 'orders', match: { count: '; DROP', value: 1 } }, children: [rule('qty', 'gt', 1)] };
    expect(() => encode(sqlFormat({ dialect: 'postgres' }), q(g), fields)).toThrow(/list quantifier/);
  });
});

describe('functions', () => {
  it('built-in relativeDate refuses tampered arguments even when called directly', () => {
    const sql = builtinFunctions.relativeDate.formats!.sql!;
    expect(() => sql({}, { amount: 1, unit: "day'; DROP TABLE t; --", direction: 'ago' })).toThrow(/relativeDate/);
    expect(() => sql({}, { amount: "1' day", unit: 'day', direction: 'ago' })).toThrow(/relativeDate/);
    expect(sql({}, { amount: 7, unit: 'day', direction: 'ago' })).toBe("CURRENT_DATE - INTERVAL '7 day'");
  });

  it('a tampered relativeDate unit is refused at encode', () => {
    const r = rule('joined', 'gt', undefined, { call: { fn: 'relativeDate', args: { amount: { value: 1 }, unit: { value: "day'--" }, direction: { value: 'ago' } } } });
    expect(() => encode(sqlFormat({ dialect: 'postgres' }), q(r), fields)).toThrow(/invalid rule/);
  });

  it('in params mode, function arguments are parameters too, bound in text order', () => {
    const out = encode(sqlFormat({ dialect: 'postgres', params: 'numbered' }), q(rule('name', 'eq', undefined, { call: { fn: 'upper', args: { text: { value: "o'k" } } } })), fields);
    expect(out).toEqual({ sql: 'name = UPPER($1)', params: ["o'k"] });
    const reordered = encode(sqlFormat({ params: 'positional' }), q(rule('age', 'eq', undefined, { call: { fn: 'between2', args: { lo: { value: 1 }, hi: { value: 9 } } } })), fields);
    expect(reordered).toEqual({ sql: 'age = GREATEST(?, ?, ?)', params: [9, 1, 9] });
  });
});

describe('switch cases', () => {
  it('a case with no rules follows emptyQuery instead of always matching', () => {
    const cases = { cases: [{ when: q(rule('age', 'eq', null)), then: 'a' }], otherwise: 'b' };
    expect(encodeCases(sqlFormat({ emptyQuery: 'none' }), cases, fields)).toBe("CASE WHEN 1 = 0 THEN 'a' ELSE 'b' END");
    expect(() => encodeCases(sqlFormat({ emptyQuery: 'throw' }), cases, fields)).toThrow(/no rules/);
  });

  it('case results are parameters in params mode', () => {
    const out = encodeCases(sqlFormat({ params: 'positional' }), { cases: [{ when: q(rule('age', 'gt', 1)), then: "x'" }], otherwise: 'y' }, fields);
    expect(out).toEqual({ sql: 'CASE WHEN age > ? THEN ? ELSE ? END', params: [1, "x'", 'y'] });
  });
});

describe('the SQL parser (decode)', () => {
  const codec = sqlFormat({ dialect: 'postgres' });
  it('refuses deep nesting with a clean error instead of overflowing the stack', () => {
    expect(() => decode(codec, `${'('.repeat(100_000)}age = 1${')'.repeat(100_000)}`, fields)).toThrow(/nesting deeper than/);
    expect(() => decode(codec, `${'NOT '.repeat(10_000)}age = 1`, fields)).toThrow(/nesting deeper than/);
  });

  it('keeps error messages short whatever the input size', () => {
    try {
      decode(codec, `age = ${'x'.repeat(50_000)} ?`, fields);
    } catch (e) {
      expect((e as Error).message.length).toBeLessThan(300);
    }
  });

  it('reads back the literal forms the encoder writes', () => {
    for (const dialect of ['postgres', 'mysql', 'mssql', 'sqlite', 'ansi'] as const) {
      const c = sqlFormat({ dialect });
      const original = q(rule('name', 'eq', "a\\'b[%]"));
      expect(decode(c, encode(c, original, fields) as string, fields)).toEqual(original);
    }
  });
});
