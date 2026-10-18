import jsonLogic from 'json-logic-js';
import { formatQuery } from '@react-querybuilder/core';
import { describe, expect, it } from 'vitest';
import { decode, encode } from '../codec';
import { compile } from '../evaluate';
import { fields } from '../fixtures.test-helpers';
import { createQueryStore } from '../store';
import type { Query } from '../types';
import { everyOperator, rows, sampleQueries, withIncomplete } from './_fixtures.test-helpers';
import { fromRQB, rqb, type RQBRuleGroup } from './rqb';

jsonLogic.add_operation('startsWith', (a: unknown, b: unknown) => typeof a === 'string' && a.startsWith(String(b)));
jsonLogic.add_operation('endsWith', (a: unknown, b: unknown) => typeof a === 'string' && a.endsWith(String(b)));

describe('rqb', () => {
  it('encodes every operator', () => {
    const out = encode(rqb, everyOperator, fields);
    expect(out.combinator).toBe('and');
    expect(out.rules.map((r) => ('operator' in r ? r.operator : 'group'))).toEqual([
      '=', '!=', '<', '<=', '>', '>=', 'contains', 'doesNotContain', 'beginsWith', 'endsWith', 'between', 'notBetween', 'in', 'notIn', 'null', 'notNull', '>', '=', '>=', 'group',
    ]);
    expect(out.rules[16]).toEqual({ field: 'age', operator: '>', value: 'minAge', valueSource: 'field' });
    expect(out.rules[14]).toEqual({ field: 'nickname', operator: 'null', value: null });
    expect(out.rules[19]).toEqual({
      combinator: 'or',
      not: true,
      rules: [{ field: 'status', operator: '=', value: 'banned' }, { combinator: 'and', rules: [{ field: 'score', operator: 'between', value: [1, 10] }] }],
    });
  });

  it('round-trips, including incomplete rules (it is a UI-state format)', () => {
    expect(decode(rqb, encode(rqb, everyOperator, fields), fields)).toEqual(everyOperator);
    expect(decode(rqb, encode(rqb, withIncomplete, fields), fields)).toEqual(withIncomplete);
  });

  it('decodes string values, comma lists, negated text operators, ids and disabled rules', () => {
    const input: RQBRuleGroup = {
      id: 'root',
      combinator: 'AND',
      rules: [
        { id: 'a', field: 'age', operator: 'between', value: '18, 65' },
        { field: 'status', operator: 'in', value: 'active,pending' },
        { field: 'age', operator: '=', value: '42' },
        { field: 'verified', operator: '=', value: 'false' },
        { field: 'name', operator: 'doesNotBeginWith', value: 'x' },
        { field: 'name', operator: 'doesNotEndWith', value: 'y' },
        { field: 'age', operator: '=', value: '' },
        { field: 'name', operator: '=', value: 'gone', disabled: true },
      ],
    };
    expect(decode(rqb, input, fields)).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'age', operator: 'between', value: [18, 65] },
        { kind: 'rule', field: 'status', operator: 'in', value: ['active', 'pending'] },
        { kind: 'rule', field: 'age', operator: 'eq', value: 42 },
        { kind: 'rule', field: 'verified', operator: 'eq', value: false },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'name', operator: 'startsWith', value: 'x' }] },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'name', operator: 'endsWith', value: 'y' }] },
        { kind: 'rule', field: 'age', operator: 'eq', value: null },
      ],
    });
  });

  it('decodes independent combinators with AND binding tighter than OR', () => {
    const a = { field: 'age', operator: '=', value: 1 };
    const b = { field: 'age', operator: '=', value: 2 };
    const c = { field: 'age', operator: '=', value: 3 };
    const rule = (value: number) => ({ kind: 'rule', field: 'age', operator: 'eq', value });
    expect(fromRQB({ rules: [a, 'and', b, 'or', c] }, fields)).toEqual({
      kind: 'group',
      combinator: 'or',
      children: [{ kind: 'group', combinator: 'and', children: [rule(1), rule(2)] }, rule(3)],
    });
    expect(fromRQB({ rules: [a, 'or', b] }, fields)).toEqual({ kind: 'group', combinator: 'or', children: [rule(1), rule(2)] });
    expect(() => decode(rqb, { combinator: 'xor', rules: [] }, fields)).toThrow(/unsupported combinator/);
  });

  it("react-querybuilder's own formatQuery evaluates our output like compile()", () => {
    for (const q of sampleQueries) {
      const logic = formatQuery(encode(rqb, q, fields) as never, 'jsonlogic');
      const viaRqb = rows.filter((row) => jsonLogic.apply(logic as jsonLogic.RulesLogic, row)).map((r) => r.name);
      expect(viaRqb, JSON.stringify(q)).toEqual(rows.filter(compile(fields, q as never)).map((r) => r.name));
    }
  });

  it("react-querybuilder's formatQuery produces the expected SQL", () => {
    const q: Query = {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'age', operator: 'between', value: [18, 65] },
        { kind: 'group', combinator: 'or', not: true, children: [{ kind: 'rule', field: 'name', operator: 'startsWith', value: 'A' }] },
      ],
    };
    expect(formatQuery(encode(rqb, q, fields) as never, { format: 'sql', parseNumbers: true })).toBe("(age between 18 and 65 and NOT (name like 'A%'))");
  });

  it('works as a drop-in store format', () => {
    const initial: RQBRuleGroup = { combinator: 'and', rules: [{ field: 'age', operator: '>', value: '30' }] };
    const store = createQueryStore({ fields, format: rqb, initial });
    expect(store.getQuery()).toEqual({ kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'gt', value: 30 }] });
    const id = store.getGroup(store.rootId).children[0]!;
    store.setRuleValue(id, 31);
    const value = store.getValue();
    expect(value).toEqual({ combinator: 'and', rules: [{ field: 'age', operator: '>', value: 31 }] });
    expect(store.getValue()).toBe(value);
    store.setValue({ combinator: 'or', rules: [{ field: 'age', operator: '<', value: 5 }] });
    expect(store.getGroup(store.rootId).children[0]).toBe(id);
    expect(store.getRule(id)).toMatchObject({ operator: 'lt', value: 5 });
  });
});
