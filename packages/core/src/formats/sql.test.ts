import { describe, expect, expectTypeOf, it } from 'vitest';
import { encode } from '../codec';
import { fields } from '../fixtures.test-helpers';
import type { Query } from '../types';
import { everyOperator, withIncomplete } from './_fixtures.test-helpers';
import { sql, sqlFormat } from './sql';

const q1 = (rule: object): Query => ({ kind: 'group', combinator: 'and', children: [rule as Query['children'][number]] });

describe('sql', () => {
  it('encodes every operator', () => {
    expect(encode(sql, everyOperator, fields)).toBe(
      [
        "name = 'Ada'",
        "name <> 'O''Brien'",
        'age < 50',
        'age <= 50',
        'age > 18',
        'age >= 18',
        "name LIKE '%50!%!_off%' ESCAPE '!'",
        "name NOT LIKE '%x%' ESCAPE '!'",
        "name LIKE 'A%' ESCAPE '!'",
        "name LIKE '%e' ESCAPE '!'",
        'age BETWEEN 18 AND 65',
        'age NOT BETWEEN 1 AND 5',
        "status IN ('active', 'pending')",
        "status NOT IN ('banned')",
        'nickname IS NULL',
        'nickname IS NOT NULL',
        'age > minAge',
        'verified = TRUE',
        "joined >= '2024-01-01'",
        "NOT (status = 'banned' OR score BETWEEN 1 AND 10)",
      ].join(' AND '),
    );
  });

  it('parenthesizes nested chains and collapses single-child groups', () => {
    const q: Query = {
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'gt', value: 1 }, { kind: 'rule', field: 'age', operator: 'lt', value: 9 }] },
        { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'verified', operator: 'eq', value: false }] },
      ],
    };
    expect(encode(sql, q, fields)).toBe('(age > 1 AND age < 9) OR verified = FALSE');
  });

  it('skips incomplete rules and empty groups', () => {
    expect(encode(sql, withIncomplete, fields)).toBe('age > 30');
    expect(encode(sql, { kind: 'group', combinator: 'and', children: [] }, fields)).toBe('1 = 1');
    expect(encode(sql, { kind: 'group', combinator: 'and', not: true, children: [] }, fields)).toBe('1 = 1');
  });

  it('handles optional fields with empty values', () => {
    expect(encode(sql, q1({ kind: 'rule', field: 'nickname', operator: 'eq', value: '' }), fields)).toBe("nickname = ''");
    expect(encode(sql, q1({ kind: 'rule', field: 'nickname', operator: 'eq', value: null }), fields)).toBe('nickname IS NULL');
  });

  it('quotes identifiers and literals per dialect', () => {
    const q = q1({ kind: 'rule', field: 'name', operator: 'contains', value: "a\\b'c" });
    // Backslashes: a hex literal on MySQL and an E'' string on Postgres mean the same under every
    // server setting (NO_BACKSLASH_ESCAPES, standard_conforming_strings).
    expect(encode(sqlFormat({ dialect: 'mysql', quoteIdentifiers: true }), q, fields)).toBe("`name` LIKE _utf8mb4 X'25615c62276325' ESCAPE '!'");
    expect(encode(sqlFormat({ dialect: 'postgres', quoteIdentifiers: true }), q, fields)).toBe(`"name" LIKE E'%a\\\\b''c%' ESCAPE '!'`);
    expect(encode(sqlFormat({ dialect: 'mssql', quoteIdentifiers: true }), q1({ kind: 'rule', field: 'verified', operator: 'eq', value: true }), fields)).toBe('[verified] = 1');
    expect(encode(sqlFormat({ dialect: 'sqlite' }), q1({ kind: 'rule', field: 'verified', operator: 'neq', value: false }), fields)).toBe('verified <> 0');
  });

  it('emits parameters in each style', () => {
    const q: Query = {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'name', operator: 'startsWith', value: 'A' },
        { kind: 'rule', field: 'age', operator: 'between', value: [18, 65] },
        { kind: 'rule', field: 'status', operator: 'in', value: ['active', 'pending'] },
        { kind: 'rule', field: 'age', operator: 'gt', ref: 'minAge' },
      ],
    };
    const positional = encode(sqlFormat({ params: 'positional' }), q, fields);
    expectTypeOf(positional).toEqualTypeOf<{ sql: string; params: unknown[] }>();
    expect(positional).toEqual({ sql: "name LIKE ? ESCAPE '!' AND age BETWEEN ? AND ? AND status IN (?, ?) AND age > minAge", params: ['A%', 18, 65, 'active', 'pending'] });
    expect(encode(sqlFormat({ params: 'numbered', dialect: 'postgres' }), q, fields).sql).toBe(
      "name LIKE $1 ESCAPE '!' AND age BETWEEN $2 AND $3 AND status IN ($4, $5) AND age > minAge",
    );
    const named = encode(sqlFormat({ params: 'named' }), q, fields);
    expectTypeOf(named.params).toEqualTypeOf<Record<string, unknown>>();
    expect(named).toEqual({ sql: "name LIKE :p1 ESCAPE '!' AND age BETWEEN :p2 AND :p3 AND status IN (:p4, :p5) AND age > minAge", params: { p1: 'A%', p2: 18, p3: 65, p4: 'active', p5: 'pending' } });
    expect(encode(sqlFormat({ params: 'named', dialect: 'mssql' }), q, fields).sql).toContain('@p1');
    expectTypeOf(encode(sql, q, fields)).toEqualTypeOf<string>();
  });

  it('numbers parameters correctly when subtrees come from the memo cache', () => {
    const shared = { kind: 'rule', field: 'age', operator: 'eq', value: 1 } as const;
    const codec = sqlFormat({ params: 'numbered' });
    encode(codec, q1(shared), fields);
    const out = encode(codec, { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'age', operator: 'eq', value: 0 }, shared] }, fields);
    expect(out).toEqual({ sql: 'age = $1 OR age = $2', params: [0, 1] });
  });

  it('matches case-insensitively when asked', () => {
    const q = q1({ kind: 'rule', field: 'name', operator: 'contains', value: 'Ad' });
    expect(encode(sqlFormat({ dialect: 'postgres', caseInsensitive: true }), q, fields)).toBe("name ILIKE '%Ad%' ESCAPE '!'");
    expect(encode(sqlFormat({ dialect: 'mysql', caseInsensitive: true }), q, fields)).toBe("LOWER(name) LIKE LOWER('%Ad%') ESCAPE '!'");
    expect(encode(sqlFormat({ caseInsensitive: true }), q1({ kind: 'rule', field: 'age', operator: 'eq', value: 3 }), fields)).toBe('age = 3');
  });

  it('turns empty optional lists into constant conditions', () => {
    const fieldsOpt = { ...fields, tags: { ...fields.status, required: false } };
    expect(encode(sql, q1({ kind: 'rule', field: 'tags', operator: 'in', value: [] }), fieldsOpt)).toBe('1 = 0');
    expect(encode(sql, q1({ kind: 'rule', field: 'tags', operator: 'notIn', value: [] }), fieldsOpt)).toBe('1 = 1');
  });
});
