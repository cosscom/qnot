// Codec coverage for the RAQB-parity model: array groups, functions, multiEnum, custom operators,
// locking, time/datetime and switch/cases, checked against the real libraries where possible.
import jsonLogic from 'json-logic-js';
import { BasicFuncs, CoreConfig, Utils, type Config } from '@react-awesome-query-builder/core';
import { describe, expect, it } from 'vitest';
import { compileCases } from '../cases';
import { decode, encode, encodeCases } from '../codec';
import { compile } from '../evaluate';
import { withRegistry } from '../fields';
import type { Query, QueryNode } from '../types';
import { and, near, or, orders, parityQueries, pfields, prows, rule } from './_parity.test-helpers';
import { elasticsearch } from './elasticsearch';
import { jqqb } from './jqqb';
import { jsonlogic } from './jsonlogic';
import { mongo } from './mongo';
import { raqb, type RAQBGroup } from './raqb';
import { rqb } from './rqb';
import { spel } from './spel';
import { sql, sqlFormat } from './sql';
import { text, textFormat } from './text';

jsonLogic.add_operation('startsWith', (a: unknown, b: unknown) => typeof a === 'string' && a.startsWith(String(b)));
jsonLogic.add_operation('endsWith', (a: unknown, b: unknown) => typeof a === 'string' && a.endsWith(String(b)));
jsonLogic.add_operation('lower', (a: unknown) => (typeof a === 'string' ? a.toLowerCase() : a));

const pg = sqlFormat({ dialect: 'postgres' });
const names = (q: Query) => prows.filter(compile(pfields, q as never) as (r: unknown) => boolean).map((r) => r.name);
const fnLower = { kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'eq', value: 'ada' } as QueryNode;
const callNow = { kind: 'rule', field: 'lastSeen', operator: 'gt', call: { fn: 'now', args: {} } } as QueryNode;
const relative = { kind: 'rule', field: 'joined', operator: 'gte', call: { fn: 'relativeDate', args: { amount: { value: 7 }, unit: { value: 'day' }, direction: { value: 'ago' } } } } as QueryNode;

describe('json-logic-js agrees with compile()', () => {
  it('on array groups, multiEnum operators, emptiness, struct paths and refs', () => {
    for (const q of parityQueries) {
      const logic = encode(jsonlogic, q, pfields);
      const viaJsonLogic = prows.filter((row) => jsonLogic.apply(logic as jsonLogic.RulesLogic, row)).map((r) => r.name);
      expect(viaJsonLogic, JSON.stringify(logic)).toEqual(names(q));
    }
    expect(parityQueries.filter((q) => names(q).length > 0 && names(q).length < prows.length)).toHaveLength(parityQueries.length);
  });

  it('on functions and custom operators', () => {
    for (const q of [and(fnLower), and(rule('distance', 'near', 5))]) {
      const logic = encode(jsonlogic, q, pfields);
      expect(prows.filter((row) => jsonLogic.apply(logic as jsonLogic.RulesLogic, row)).map((r) => r.name)).toEqual(names(q));
    }
  });

  it('on cases', () => {
    const cases = { cases: [{ when: parityQueries[6]!, then: 'concierge' }, { when: parityQueries[0]!, then: 'mast' }], otherwise: 'self-serve' };
    const logic = encodeCases(jsonlogic, cases, pfields) as jsonLogic.RulesLogic;
    const route = compileCases(pfields, cases as never);
    expect(prows.map((row) => jsonLogic.apply(logic, row))).toEqual(prows.map((row) => route(row as never).value));
  });
});

describe('round-trips', () => {
  const twoWay = { mongo, jsonlogic, spel, raqb } as const;
  for (const [name, codec] of Object.entries(twoWay)) {
    it(`${name}: every parity query, functions and refs`, () => {
      for (const q of [...parityQueries, and(fnLower), and(callNow), and(rule('opensAt', 'lt', '12:00'), rule('lastSeen', 'gt', '2026-01-01T10:00:00Z'))]) {
        expect(decode(codec as never, encode(codec as never, q, pfields), pfields), JSON.stringify(q)).toEqual(q);
      }
    });
  }

  it('raqb keeps locks, NOT array groups and relative dates', () => {
    const q: Query = {
      kind: 'group',
      combinator: 'or',
      locked: true,
      children: [{ ...(rule('name', 'eq', 'x') as object), locked: true } as QueryNode, { ...(orders('none', rule('qty', 'gt', 3)) as object), not: true } as QueryNode, relative],
    };
    expect(decode(raqb, encode(raqb, q, pfields), pfields)).toEqual(q);
  });
});

describe('sql', () => {
  it('exports array groups, multiEnum and functions on Postgres', () => {
    expect(encode(pg, and(orders('some', rule('qty', 'gt', 1), rule('status', 'eq', 'paid'))), pfields)).toBe(
      "EXISTS (SELECT 1 FROM jsonb_array_elements(orders) AS e1 WHERE (e1->>'qty')::numeric > 1 AND e1->>'status' = 'paid')",
    );
    expect(encode(pg, and(orders('all', rule('status', 'eq', 'paid'))), pfields)).toBe(
      "NOT EXISTS (SELECT 1 FROM jsonb_array_elements(orders) AS e1 WHERE NOT COALESCE((e1->>'status' = 'paid'), FALSE))",
    );
    expect(encode(pg, and(orders({ count: 'between', value: [1, 2] }, rule('status', 'eq', 'paid'))), pfields)).toBe(
      "(SELECT COUNT(*) FROM jsonb_array_elements(orders) AS e1 WHERE e1->>'status' = 'paid') BETWEEN 1 AND 2",
    );
    expect(encode(pg, and(rule('tags', 'hasAny', ['vip']), rule('tags', 'setEq', ['vip', 'beta'])), pfields)).toBe(
      "tags && ARRAY['vip'] AND (tags @> ARRAY['vip', 'beta'] AND tags <@ ARRAY['vip', 'beta'])",
    );
    expect(encode(pg, and(fnLower, callNow, relative, rule('distance', 'near', 5)), pfields)).toBe(
      "LOWER(name) = 'ada' AND lastSeen > CURRENT_TIMESTAMP AND joined >= CURRENT_DATE - INTERVAL '7 day' AND ABS(distance) <= 5",
    );
    expect(encode(sqlFormat({ dialect: 'postgres', quoteIdentifiers: true }), and(rule('address.city', 'eq', 'x'), rule('address.zip', 'eq', 'n1')), pfields)).toBe(
      `"address"."city" = 'x' AND "postal_code" = 'n1'`,
    );
  });

  it('numbers parameters inside array groups and multiEnum arrays', () => {
    const out = encode(sqlFormat({ dialect: 'postgres', params: 'numbered' }), and(rule('tags', 'hasAll', ['vip', 'beta']), orders({ count: 'gte', value: 2 }, rule('qty', 'gt', 1))), pfields);
    expect(out).toEqual({
      sql: "tags @> ARRAY[$1, $2] AND (SELECT COUNT(*) FROM jsonb_array_elements(orders) AS e1 WHERE (e1->>'qty')::numeric > $3) >= $4",
      params: ['vip', 'beta', 1, 2],
    });
  });

  it('uses JSON functions for multiEnum on other dialects and refuses what a dialect cannot express', () => {
    const q = and(rule('tags', 'hasAny', ['vip']));
    expect(encode(sqlFormat({ dialect: 'mysql' }), q, pfields)).toBe(`JSON_OVERLAPS(tags, '["vip"]')`);
    expect(encode(sqlFormat({ dialect: 'sqlite' }), q, pfields)).toBe("EXISTS (SELECT 1 FROM json_each(tags) WHERE value IN ('vip'))");
    expect(encode(sqlFormat({ dialect: 'mssql' }), q, pfields)).toBe("EXISTS (SELECT 1 FROM OPENJSON(tags) WHERE value IN (N'vip'))");
    const mixed = and(rule('name', 'eq', 'a'), rule('tags', 'hasAny', ['vip']), orders('some', rule('qty', 'gt', 1)));
    expect(() => encode(sql, mixed, pfields)).toThrow(/rule at \[1\] \(field "tags", operator "hasAny"\): the ansi dialect has no array operators/);
    expect(encode(sqlFormat({ unsupported: 'skip' }), mixed, pfields)).toBe("name = 'a'");
  });

  it('exports CASE WHEN', () => {
    const out = encodeCases(pg, { cases: [{ when: and(rule('tags', 'hasAny', ['vip'])), then: "o'k" }, { when: and(rule('age', 'gt', 30)), then: 2 }], otherwise: null }, pfields);
    expect(out).toBe("CASE WHEN tags && ARRAY['vip'] THEN 'o''k' WHEN age > 30 THEN 2 ELSE NULL END");
  });

  it('decodes WHERE clauses', () => {
    const where = `("Name" = 'O''Brien' OR NOT (age BETWEEN 1 AND 5)) AND address.city LIKE 'new%' AND postal_code NOT IN ('a', 'b')
      AND name NOT LIKE '%x\\%%' AND lastSeen > CURRENT_TIMESTAMP AND LOWER(name) = 'ada' AND 30 < age AND age >= minAge
      AND (name IS NULL OR name = '') AND (tags IS NOT NULL AND cardinality(tags) > 0) AND nickname IS NOT NULL AND TRUE`;
    const fieldsWithName = withRegistry({ ...pfields, name: { ...pfields.name, column: 'Name' } }, pfields);
    expect(decode(sql, where, fieldsWithName as never)).toEqual(
      and(
        or(rule('name', 'eq', "O'Brien"), { kind: 'group', combinator: 'and', not: true, children: [rule('age', 'between', [1, 5])] }),
        rule('address.city', 'startsWith', 'new'),
        rule('address.zip', 'notIn', ['a', 'b']),
        rule('name', 'notContains', 'x%'),
        callNow,
        { kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'eq', value: 'ada' },
        rule('age', 'gt', 30),
        { kind: 'rule', field: 'age', operator: 'gte', ref: 'minAge' },
        rule('name', 'isEmpty'),
        rule('tags', 'isNotEmpty'),
        rule('nickname', 'isNotNull'),
      ),
    );
  });

  it('round-trips what it emits (outside array groups and multiEnum operators)', () => {
    const q = and(
      or(rule('name', 'eq', 'a'), rule('name', 'endsWith', '_x')),
      { kind: 'group', combinator: 'or', not: true, children: [rule('age', 'lt', 3), rule('age', 'in', [1, 2])] },
      rule('tags', 'isEmpty'),
      rule('name', 'isNotEmpty'),
      fnLower,
      callNow,
    );
    for (const codec of [sql, pg, sqlFormat({ dialect: 'mysql', quoteIdentifiers: true }), sqlFormat({ dialect: 'sqlite' })]) {
      expect(decode(codec, encode(codec, q, pfields) as string, pfields)).toEqual(q);
    }
    // MSSQL has no JSON array length function; its emptiness check is a subquery the parser doesn't read.
    const mssql = sqlFormat({ dialect: 'mssql', quoteIdentifiers: true });
    const noArrays = { ...q, children: q.children.filter((c) => !(c.kind === 'rule' && c.field === 'tags')) };
    expect(decode(mssql, encode(mssql, noArrays, pfields), pfields)).toEqual(noArrays);
  });

  it('refuses SQL it cannot represent', () => {
    expect(() => decode(sql, "name LIKE 'a_b'", pfields)).toThrow(/wildcards/);
    expect(() => decode(sql, 'name = ?', pfields)).toThrow(/placeholders/);
    expect(() => decode(sql, 'ABS(distance) <= 5', pfields)).toThrow(/unknown function/);
    expect(() => decode(sql, '1 = 0', pfields)).toThrow(/always false/);
    expect(() => decode(sqlFormat({ params: 'positional' }), 'x = 1' as never, pfields)).toThrow(/parameterized/);
  });
});

describe('mongo', () => {
  it('uses $elemMatch for some/none/all and $expr for counts, functions and refs', () => {
    expect(encode(mongo, and(orders('none', rule('status', 'eq', 'paid'))), pfields)).toEqual({ $and: [{ orders: { $not: { $elemMatch: { status: { $eq: 'paid' } } } } }] });
    expect(encode(mongo, and(orders({ count: 'gte', value: 2 }, rule('status', 'eq', 'paid'))), pfields)).toEqual({
      $and: [{ $expr: { $gte: [{ $size: { $filter: { input: { $ifNull: ['$orders', []] }, as: 'e1', cond: { $eq: ['$$e1.status', 'paid'] } } } }, 2] } }],
    });
    expect(encode(mongo, and(fnLower, rule('tags', 'setEq', ['vip'])), pfields)).toEqual({
      $and: [{ $expr: { $eq: [{ $toLower: '$name' }, 'ada'] } }, { $expr: { $setEquals: [{ $ifNull: ['$tags', []] }, { $literal: ['vip'] }] } }],
    });
  });

  it('exports $switch cases', () => {
    const out = encodeCases(mongo, { cases: [{ when: and(rule('age', 'gt', 30)), then: '$big' }], otherwise: 'small' }, pfields);
    expect(out).toEqual({ $switch: { branches: [{ case: { $and: [{ $gt: ['$age', 30] }] }, then: { $literal: '$big' } }], default: 'small' } });
  });
});

describe('text', () => {
  it('summarizes with labels, option labels and quantifiers', () => {
    const q = and(
      rule('age', 'gte', 21),
      or(rule('tags', 'hasAny', ['vip', 'beta']), rule('address.city', 'contains', 'on')),
      orders({ count: 'gte', value: 2 }, rule('status', 'eq', 'paid')),
      { kind: 'group', combinator: 'and', not: true, children: [rule('age', 'between', [1, 5])] },
      { kind: 'rule', field: 'age', operator: 'lt', ref: 'minAge' },
      fnLower,
      relative,
      rule('distance', 'near', 5),
    );
    expect(encode(text, q, pfields)).toBe(
      'Age ≥ 21 AND (Tags has any of vip, beta OR City contains "on") AND at least 2 Orders match (Status = paid) AND NOT (Age is between 1 and 5) AND Age < Min age AND lowercase(Name) = "ada" AND Joined ≥ 7 days ago AND Distance is within 5',
    );
    expect(encode(textFormat({ labels: false, words: { and: '&&' } }), and(rule('age', 'gte', 21), rule('name', 'eq', 'x')), pfields)).toBe('age gte 21 && name eq "x"');
    expect(encodeCases(text, { cases: [{ when: and(rule('age', 'gt', 1)), then: 'a' }], otherwise: 'b' }, pfields)).toBe('If Age > 1 then a; otherwise b');
  });
});

describe('spel', () => {
  it('decodes hand-written expressions', () => {
    const src = "not (age > 3 and name.startsWith('a')) or {1, 2}.contains(age) or (tags == null || tags.isEmpty()) or opensAt.compareTo(T(java.time.LocalTime).parse('09:30:00')) >= 0";
    expect(decode(spel, src, pfields)).toEqual(
      or(
        { kind: 'group', combinator: 'and', not: true, children: [rule('age', 'gt', 3), rule('name', 'startsWith', 'a')] },
        rule('age', 'in', [1, 2]),
        rule('tags', 'isEmpty'),
        rule('opensAt', 'gte', '09:30'),
      ),
    );
    expect(decode(spel, '', pfields)).toEqual(and());
    expect(() => decode(spel, 'age.foo(1)', pfields)).toThrow(/cannot decode/);
    expect(encodeCases(spel, { cases: [{ when: and(rule('age', 'gt', 1)), then: 'a' }, { when: and(rule('age', 'gt', 2)), then: 'b' }], otherwise: 'c' }, pfields)).toBe(
      "age > 1 ? 'a' : (age > 2 ? 'b' : 'c')",
    );
  });
});

describe('elasticsearch', () => {
  it('builds bool queries with nested array groups', () => {
    expect(
      encode(
        elasticsearch,
        or(
          rule('age', 'between', [18, 65]),
          rule('name', 'startsWith', 'a*'),
          rule('tags', 'hasAll', ['vip', 'beta']),
          orders('none', rule('qty', 'gt', 3)),
          { kind: 'group', combinator: 'and', not: true, children: [rule('name', 'isEmpty')] },
          { kind: 'rule', field: 'joined', operator: 'gte', call: relative.kind === 'rule' ? relative.call : undefined } as QueryNode,
        ),
        pfields,
      ),
    ).toEqual({
      bool: {
        should: [
          { range: { age: { gte: 18, lte: 65 } } },
          { wildcard: { name: { value: 'a\\**', case_insensitive: true } } },
          { bool: { must: [{ term: { tags: 'vip' } }, { term: { tags: 'beta' } }] } },
          { bool: { must_not: [{ nested: { path: 'orders', query: { bool: { must: [{ range: { 'orders.qty': { gt: 3 } } }] } } } }] } },
          { bool: { must_not: [{ bool: { must: [{ bool: { should: [{ bool: { must_not: [{ exists: { field: 'name' } }] } }, { term: { name: '' } }], minimum_should_match: 1 } }] } }] } },
          { range: { joined: { gte: 'now-7d/d' } } },
        ],
        minimum_should_match: 1,
      },
    });
    expect(encode(elasticsearch, and(), pfields)).toEqual({ match_all: {} });
  });
});

describe('react-querybuilder / jQuery QueryBuilder', () => {
  it('pass operators they lack through by id', () => {
    const q = and(rule('name', 'isEmpty'), rule('tags', 'hasAny', ['vip']), rule('distance', 'near', 5));
    expect(encode(rqb, q, pfields).rules.map((r) => ('operator' in r ? r.operator : ''))).toEqual(['isEmpty', 'hasAny', 'near']);
    expect(decode(rqb, encode(rqb, q, pfields), pfields)).toEqual(q);
    expect(encode(jqqb, q, pfields).rules.map((r) => ('operator' in r ? r.operator : ''))).toEqual(['is_empty', 'hasAny', 'near']);
    expect(decode(jqqb, encode(jqqb, q, pfields), pfields)).toEqual(q);
  });

  it('throw on functions and array groups', () => {
    for (const codec of [rqb, jqqb]) {
      expect(() => encode(codec as never, and(fnLower), pfields)).toThrow(/function calls/);
      expect(() => encode(codec as never, and(orders('some', rule('qty', 'gt', 1))), pfields)).toThrow(/array groups/);
    }
  });
});

describe('react-awesome-query-builder interop', () => {
  const config = {
    ...CoreConfig,
    funcs: BasicFuncs,
    fields: {
      name: { type: 'text', valueSources: ['value', 'field', 'func'] },
      distance: { type: 'number' },
      age: { type: 'number', valueSources: ['value', 'field'] },
      minAge: { type: 'number' },
      tags: { type: 'multiselect', fieldSettings: { listValues: ['vip', 'beta', 'churned'] } },
      opensAt: { type: 'time' },
      lastSeen: { type: 'datetime', valueSources: ['value', 'func'] },
      joined: { type: 'date', valueSources: ['value', 'func'] },
      address: { type: '!struct', subfields: { city: { type: 'text' }, zip: { type: 'text' } } },
      orders: {
        type: '!group',
        mode: 'array',
        subfields: { product: { type: 'text' }, qty: { type: 'number' }, status: { type: 'select', fieldSettings: { listValues: ['paid', 'refunded'] } } },
      },
    },
    settings: { ...CoreConfig.settings, fieldSources: ['field', 'func'] },
  } as unknown as Config;

  // RAQB has no hasAll and no `near` built in.
  const raqbQueries = [...parityQueries.filter((q) => !JSON.stringify(q).includes('hasAll')), and(fnLower), and(callNow), and(relative)];

  it('loads our trees as valid', () => {
    for (const q of raqbQueries) {
      const tree = Utils.loadTree(encode(raqb, q, pfields) as never);
      expect(Utils.validateTree(tree, config), JSON.stringify(q)).toEqual([]);
    }
  });

  it("evaluates our array groups and multiselect rules like compile() through RAQB's JsonLogic", () => {
    for (const q of parityQueries.slice(0, 10).filter((q) => !JSON.stringify(q).includes('hasAll'))) {
      const { logic, errors } = Utils.jsonLogicFormat(Utils.loadTree(encode(raqb, q, pfields) as never), config);
      expect(errors).toEqual([]);
      const viaRaqb = prows.filter((row) => jsonLogic.apply(logic as jsonLogic.RulesLogic, row)).map((r) => r.name);
      // RAQB's `all` uses json-logic's `all`, which is false for empty arrays; ours is true.
      const expected = JSON.stringify(q).includes('"all"') ? names(q).filter((n) => n !== 'grace') : names(q);
      expect(viaRaqb, JSON.stringify(q)).toEqual(expected);
    }
  });

  it("formats functions with RAQB's own SQL export", () => {
    const tree = Utils.loadTree(encode(raqb, and(fnLower, callNow), pfields) as never);
    expect(Utils.sqlFormat(tree, config)).toBe("(LOWER(name) = 'ada' AND lastSeen > NOW())");
  });

  it("decodes RAQB's spelFormat output into the original query", () => {
    for (const q of raqbQueries.filter((q) => q !== raqbQueries[raqbQueries.length - 1])) {
      const out = Utils.spelFormat(Utils.loadTree(encode(raqb, q, pfields) as never), config);
      expect(decode(spel, out!, pfields), out).toEqual(q);
    }
  });

  it('RAQB loads our SpEL back into the same tree', () => {
    for (const q of raqbQueries.slice(0, -1)) {
      const [tree, errors] = Utils.loadFromSpel(encode(spel, q, pfields), config);
      expect(errors, encode(spel, q, pfields)).toEqual([]);
      expect(decode(raqb, Utils.getTree(tree!) as RAQBGroup, pfields)).toEqual(q);
    }
  });

  it('writes datetimes and times in RAQB value formats', () => {
    const tree = encode(raqb, and(rule('opensAt', 'lt', '12:00'), rule('lastSeen', 'gt', '2026-01-01T10:00:00.000Z')), pfields);
    expect((tree.children1 as { properties: { value: unknown[]; valueType: string[] } }[]).map((c) => [c.properties.value[0], c.properties.valueType[0]])).toEqual([
      ['12:00:00', 'time'],
      ['2026-01-01 10:00:00', 'datetime'],
    ]);
    expect(Utils.sqlFormat(Utils.loadTree(tree as never), config)).toBe("(opensAt < '12:00:00' AND lastSeen > '2026-01-01 10:00:00.000')");
  });

  it('encodes the custom operator with its own formats everywhere', () => {
    const q = and(rule('distance', 'near', 5));
    expect([encode(sql, q, pfields), encode(spel, q, pfields), encode(text, q, pfields)]).toEqual(['ABS(distance) <= 5', 'T(Math).abs(distance) <= 5', 'Distance is within 5']);
    expect(near.id).toBe('near');
  });
});
