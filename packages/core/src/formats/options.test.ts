// Export safety options (`unsupported`, `emptyQuery`) and schema extension.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encode, encodeCases } from '../codec';
import { builtinOperatorIds, defineFields, extendFields, f, registryOf } from '../fields';
import { builtinFunctions } from '../functions';
import { OPERATORS, defineOperator } from '../operators';
import { createQueryStore } from '../store';
import { validateQuery } from '../validate';
import { and, near, orders, pfields, rule } from './_parity.test-helpers';
import { elasticsearch, elasticsearchFormat } from './elasticsearch';
import { jqqb } from './jqqb';
import { jsonlogic, jsonlogicFormat } from './jsonlogic';
import { mongo, mongoFormat } from './mongo';
import { rqb } from './rqb';
import { spel, spelFormat } from './spel';
import { sql, sqlFormat } from './sql';
import { text, textFormat } from './text';
import type { Query, QueryNode } from '../types';

const relative = { kind: 'rule', field: 'joined', operator: 'gte', call: { fn: 'relativeDate', args: { amount: { value: 7 }, unit: { value: 'day' }, direction: { value: 'ago' } } } } as QueryNode;
const withRelative = and(rule('age', 'gt', 1), { kind: 'group', combinator: 'or', children: [rule('name', 'eq', 'x'), relative] });

describe('unsupported rules', () => {
  it('throw by default, naming the path, field, operator and reason', () => {
    expect(() => encode(mongo, withRelative, pfields)).toThrow(
      `trawlnet/mongo: can't express the rule at [1, 1] (field "joined", operator "gte"): function "relativeDate" has no mongo format. Pass \`unsupported: 'skip'\` to drop it instead (this widens the query)`,
    );
    expect(() => encode(jsonlogic, withRelative, pfields)).toThrow(/at \[1, 1\].*"relativeDate" has no jsonlogic format/);
    expect(() => encode(spel, withRelative, pfields)).toThrow(/at \[1, 1\].*"relativeDate" has no spel format/);
    expect(() => encode(sql, and(orders('some', rule('qty', 'gt', 1))), pfields)).toThrow(/array group at \[0\] \(field "orders"\): array groups need the postgres dialect/);
    expect(() => encode(sqlFormat({ dialect: 'postgres' }), and(orders('some', rule('qty', 'gt', 1), { kind: 'rule', field: 'qty', operator: 'gt', call: relative.kind === 'rule' ? relative.call : undefined } as QueryNode)), pfields)).not.toThrow();
    expect(() => encode(elasticsearch, and(orders({ count: 'gte', value: 2 }, rule('qty', 'gt', 1))), pfields)).toThrow(/array group at \[0\].*needs an aggregation or script/);
    expect(() => encode(elasticsearch, and(rule('tags', 'setEq', ['vip'])), pfields)).toThrow(/set equality/);
    expect(() => encode(elasticsearch, and({ kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'eq', value: 'a' } as QueryNode), pfields)).toThrow(/value side/);
  });

  it('reach inside array groups with their full path', () => {
    const q = and(rule('age', 'gt', 1), orders('some', rule('qty', 'gt', 1), { kind: 'rule', field: 'product', operator: 'eq', call: { fn: 'relativeDate', args: {} } } as QueryNode));
    // relativeDate returns a date but product is text: invalid, so it's skipped, not unsupported.
    expect(validateQuery(pfields, q).some((i) => i.severity === 'error')).toBe(true);
    const custom = and(rule('age', 'gt', 1), orders('some', { kind: 'rule', field: 'qty', operator: 'eq', call: { fn: 'length', args: { text: { ref: 'product' } } } } as QueryNode));
    expect(() => encode(jsonlogic, custom, pfields)).toThrow(/rule at \[1, 0\] \(field "qty", operator "eq"\): function "length" has no jsonlogic format/);
  });

  it('can be skipped, keeping the expressible rest', () => {
    expect(encode(mongoFormat({ unsupported: 'skip' }), withRelative, pfields)).toEqual({ $and: [{ age: { $gt: 1 } }, { $or: [{ name: { $eq: 'x' } }] }] });
    expect(encode(jsonlogicFormat({ unsupported: 'skip' }), withRelative, pfields)).toEqual({ and: [{ '>': [{ var: 'age' }, 1] }, { or: [{ '==': [{ var: 'name' }, 'x'] }] }] });
    expect(encode(spelFormat({ unsupported: 'skip' }), withRelative, pfields)).toBe("(age > 1 && name == 'x')");
    expect(encode(elasticsearchFormat({ unsupported: 'skip' }), and(rule('age', 'gt', 1), rule('tags', 'setEq', ['vip'])), pfields)).toEqual({ bool: { must: [{ range: { age: { gt: 1 } } }] } });
    expect(encode(sqlFormat({ unsupported: 'skip' }), and(rule('tags', 'hasAny', ['vip'])), pfields)).toBe('1 = 1');
  });

  it('still skip incomplete rules silently', () => {
    expect(encode(sql, and(rule('age', 'gt', null), rule('name', 'eq', 'x')), pfields)).toBe("name = 'x'");
    expect(encode(mongo, and(rule('age', 'gt', null)), pfields)).toEqual({});
  });

  it('make a case throw even when skipping, rather than becoming always-true', () => {
    const cases = { cases: [{ when: and(rule('tags', 'hasAny', ['vip'])), then: 'a' }], otherwise: 'b' };
    expect(() => encodeCases(sql, cases, pfields)).toThrow(/rule at \[0\]/);
    expect(() => encodeCases(sqlFormat({ unsupported: 'skip' }), cases, pfields)).toThrow(/the ansi dialect has no array operators/);
    expect(() => encodeCases(jsonlogicFormat({ unsupported: 'skip' }), { cases: [{ when: and(relative), then: 1 }] }, pfields)).toThrow(/relativeDate/);
    expect(encodeCases(sql, { cases: [{ when: and(), then: 'always' }] }, pfields)).toBe("CASE WHEN 1 = 1 THEN 'always' END");
  });

  it('throw in the UI-state codecs with the rule path', () => {
    const q = and(rule('age', 'gt', 1), { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'eq', value: 'a' } as QueryNode] });
    expect(() => encode(rqb, q, pfields)).toThrow(`trawlnet/rqb: can't express the rule at [1, 0] (field "lower()", operator "eq"): react-querybuilder has no equivalent for function calls`);
    expect(() => encode(jqqb, and(orders('some')), pfields)).toThrow(/array group at \[0\].*jQuery QueryBuilder has no equivalent for array groups/);
  });

  it('never happen in text, which can render everything', () => {
    expect(encode(textFormat({ unsupported: 'throw' }), and(relative, rule('tags', 'setEq', ['vip'])), pfields)).toBe('Joined ≥ 7 days ago AND Tags is exactly vip');
    expect(encode(text, and(), pfields)).toBe('');
  });
});

describe('emptyQuery', () => {
  const empty: Query = and(rule('age', 'gt', null));
  it('defaults to match-all', () => {
    expect([encode(sql, empty, pfields), encode(mongo, empty, pfields), encode(jsonlogic, empty, pfields), encode(spel, empty, pfields), encode(elasticsearch, empty, pfields)]).toEqual([
      '1 = 1',
      {},
      true,
      '',
      { match_all: {} },
    ]);
  });
  it("'none' matches nothing", () => {
    expect(encode(sqlFormat({ emptyQuery: 'none' }), empty, pfields)).toBe('1 = 0');
    expect(encode(sqlFormat({ emptyQuery: 'none', params: 'numbered' }), empty, pfields)).toEqual({ sql: '1 = 0', params: [] });
    expect(encode(mongoFormat({ emptyQuery: 'none' }), empty, pfields)).toEqual({ _id: { $exists: false } });
    expect(encode(jsonlogicFormat({ emptyQuery: 'none' }), empty, pfields)).toBe(false);
    expect(encode(spelFormat({ emptyQuery: 'none' }), empty, pfields)).toBe('false');
    expect(encode(elasticsearchFormat({ emptyQuery: 'none' }), empty, pfields)).toEqual({ match_none: {} });
  });
  it("'throw' refuses", () => {
    for (const codec of [sqlFormat({ emptyQuery: 'throw' }), mongoFormat({ emptyQuery: 'throw' }), jsonlogicFormat({ emptyQuery: 'throw' }), spelFormat({ emptyQuery: 'throw' }), elasticsearchFormat({ emptyQuery: 'throw' })]) {
      expect(() => encode(codec as never, empty, pfields)).toThrow(/has no rules to export/);
    }
  });
  it('applies to queries made empty by skipped unsupported rules', () => {
    expect(encode(sqlFormat({ unsupported: 'skip', emptyQuery: 'none' }), and(rule('tags', 'hasAny', ['vip'])), pfields)).toBe('1 = 0');
  });
});

describe('extendFields', () => {
  const plus = defineOperator({ id: 'plus', arity: 'one', label: 'plus', evaluate: () => true });

  it('merges fields and registries, later ones winning', () => {
    const ext = extendFields(pfields, { nickname: f.text(), age: f.number({ min: 0 }), meta: f.struct({ score: f.number() }) }, { operators: [plus], messages: { required: 'Needed' } });
    expect(Object.keys(ext)).toEqual(expect.arrayContaining(['name', 'nickname', 'meta.score', 'orders']));
    expect(ext.age.min).toBe(0);
    const reg = registryOf(ext);
    expect([...reg.operators.keys()]).toEqual(['near', 'plus']);
    expect(Object.keys(reg.functions)).toEqual(Object.keys(builtinFunctions));
    expect(reg.messages).toEqual({ required: 'Needed' });
    expect(validateQuery(ext, and(rule('nickname', 'eq', ''))).map((i) => i.message)).toEqual(['Needed']);
    // A spread loses all of it.
    expect(registryOf({ ...pfields }).operators.size).toBe(0);
  });

  it("takes `more`'s own registry when it comes from defineFields", () => {
    const other = defineFields({ code: f.text() }, { functions: { shout: builtinFunctions.upper }, messages: { required: 'A' } });
    const ext = extendFields(pfields, other, { messages: { min: 'B' } });
    expect(Object.keys(registryOf(ext).functions)).toContain('shout');
    expect(registryOf(ext).messages).toEqual({ required: 'A', min: 'B' });
  });

  it('types the merged schema', () => {
    const ext = extendFields(defineFields({ a: f.text() }), { b: f.number(), a: f.boolean() });
    const kinds: { a: 'boolean'; b: 'number' } = { a: ext.a.kind, b: ext.b.kind };
    expect(kinds).toEqual({ a: 'boolean', b: 'number' });
  });
});

describe('missing registry warning', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once per schema when a spread schema meets functions or custom operators', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spread = { ...pfields };
    const initial = and(rule('distance', 'near', 5), { kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'eq', value: 'a' } as QueryNode);
    createQueryStore({ fields: spread, initial: initial as never });
    createQueryStore({ fields: spread, initial: initial as never });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/operator "near".*function "lower".*extendFields/);
  });

  it('stays quiet for schemas with a registry, plain queries, and production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createQueryStore({ fields: pfields, initial: and(rule('distance', 'near', 5)) as never });
    createQueryStore({ fields: { ...pfields }, initial: and(rule('age', 'gt', 1)) as never });
    const { env } = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
    const before = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      createQueryStore({ fields: { ...pfields }, initial: and(rule('distance', 'near', 5)) as never });
    } finally {
      env.NODE_ENV = before;
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('knows exactly the built-in operators', () => {
    expect([...builtinOperatorIds].sort()).toEqual(Object.keys(OPERATORS).sort());
    expect(near.id).toBe('near');
  });
});

describe('sql string safety', () => {
  it('refuses NUL characters instead of letting the database truncate them', async () => {
    const { sqlFormat } = await import('./sql');
    const { encode } = await import('../codec');
    const { defineFields, f } = await import('../fields');
    const fs = defineFields({ name: f.text() });
    const q = { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: 'eq', value: 'a\u0000b' }] } as const;
    expect(() => encode(sqlFormat({ dialect: 'postgres' }), q as never, fs)).toThrow(/NUL/);
    expect(() => encode(sqlFormat({ dialect: 'postgres', params: 'numbered' }), q as never, fs)).toThrow(/NUL/);
  });
});
