import jsonLogic from 'json-logic-js';
import { CoreConfig, Utils, type Config } from '@react-awesome-query-builder/core';
import { describe, expect, it } from 'vitest';
import { decode, encode } from '../codec';
import { compile } from '../evaluate';
import { fields } from '../fixtures.test-helpers';
import type { Query, QueryNode } from '../types';
import { everyOperator, rows, sampleQueries, withIncomplete } from './_fixtures.test-helpers';
import { jsonlogic } from './jsonlogic';
import { raqb, type RAQBGroup, type RAQBRule } from './raqb';

const config = {
  ...CoreConfig,
  fields: {
    name: { type: 'text' },
    nickname: { type: 'text' },
    age: { type: 'number' },
    minAge: { type: 'number' },
    status: { type: 'select', fieldSettings: { listValues: ['active', 'pending', 'banned'] } },
    verified: { type: 'boolean' },
    joined: { type: 'date', valueFormat: 'YYYY-MM-DD' },
    score: { type: 'number' },
  },
} as unknown as Config;

const usesAny = (q: QueryNode, pred: (n: QueryNode) => boolean): boolean => pred(q) || (q.kind === 'group' && q.children.some((c) => usesAny(c, pred)));

describe('raqb', () => {
  it('encodes every operator with RAQB operator names and value types', () => {
    const out = encode(raqb, everyOperator, fields);
    const kids = out.children1 as (RAQBRule | RAQBGroup)[];
    expect(kids.map((k) => (k.type === 'rule' ? k.properties.operator : 'group'))).toEqual([
      'equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'like', 'not_like', 'starts_with', 'ends_with',
      'between', 'not_between', 'select_any_in', 'select_not_any_in', 'is_null', 'is_not_null', 'greater', 'equal', 'greater_or_equal', 'group',
    ]);
    expect((kids[10] as RAQBRule).properties).toEqual({ field: 'age', operator: 'between', value: [18, 65], valueSrc: ['value', 'value'], valueType: ['number', 'number'] });
    expect((kids[12] as RAQBRule).properties).toMatchObject({ value: [['active', 'pending']], valueType: ['multiselect'] });
    expect((kids[16] as RAQBRule).properties).toMatchObject({ value: ['minAge'], valueSrc: ['field'] });
    expect(new Set(JSON.stringify(out).match(/"id":"[^"]+"/g)).size).toBe(24);
    expect(encode(raqb, everyOperator, fields)).toBe(out);
  });

  it('round-trips, including incomplete rules, and reads children1 id maps', () => {
    expect(decode(raqb, encode(raqb, everyOperator, fields), fields)).toEqual(everyOperator);
    expect(decode(raqb, encode(raqb, withIncomplete, fields), fields)).toEqual(withIncomplete);
    const tree = encode(raqb, everyOperator, fields);
    const asMap = { ...tree, children1: Object.fromEntries((tree.children1 as RAQBRule[]).map((c) => [c.id, c])) };
    expect(decode(raqb, asMap, fields)).toEqual(everyOperator);
  });

  it('RAQB loads our tree as valid and formats the same SQL', () => {
    const tree = Utils.loadTree(encode(raqb, everyOperator, fields) as never);
    expect(Utils.isValidTree(tree, config)).toBe(true);
    expect(Utils.validateTree(tree, config)).toEqual([]);
    expect(Utils.sqlFormat(tree, config)).toBe(
      "(name = 'Ada' AND name <> 'O\\'Brien' AND age < 50 AND age <= 50 AND age > 18 AND age >= 18 AND name LIKE '%50\\%\\_off%' AND name NOT LIKE '%x%' AND name LIKE 'A%' AND name LIKE '%e' AND age BETWEEN 18 AND 65 AND age NOT BETWEEN 1 AND 5 AND status IN ('active', 'pending') AND status NOT IN ('banned') AND nickname IS NULL AND nickname IS NOT NULL AND age > minAge AND verified = true AND joined >= '2024-01-01' AND NOT (status = 'banned' OR score BETWEEN 1 AND 10))",
    );
  });

  it("RAQB's JsonLogic export of our tree evaluates like compile()", () => {
    // RAQB can't export starts_with/ends_with to JsonLogic and turns dates into datetimes.
    const usable = sampleQueries.filter((q) => !usesAny(q, (n) => n.kind === 'rule' && (n.operator === 'startsWith' || n.operator === 'endsWith' || n.field === 'joined')));
    expect(usable.length).toBeGreaterThanOrEqual(4);
    for (const q of usable) {
      const { logic, errors } = Utils.jsonLogicFormat(Utils.loadTree(encode(raqb, q, fields) as never), config);
      expect(errors).toEqual([]);
      const viaRaqb = rows.filter((row) => jsonLogic.apply(logic as jsonLogic.RulesLogic, row)).map((r) => r.name);
      expect(viaRaqb, JSON.stringify(q)).toEqual(rows.filter(compile(fields, q as never)).map((r) => r.name));
    }
  });

  it("decodes RAQB's own getTree output", () => {
    const q: Query = {
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: 'age', operator: 'between', value: [1, 5] },
        { kind: 'rule', field: 'status', operator: 'in', value: ['active'] },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'name', operator: 'contains', value: 'x' }] },
      ],
    };
    const tree = Utils.loadFromJsonLogic(encode(jsonlogic, q, fields) as never, config);
    expect(tree).toBeDefined();
    expect(decode(raqb, Utils.getTree(tree!) as RAQBGroup, fields)).toEqual(q);
  });

  it('decodes is_empty, multiselect and rejects function values', () => {
    const rule = (operator: string, value: unknown[], valueSrc: RAQBRule['properties']['valueSrc'] = ['value']): RAQBRule => ({
      id: operator,
      type: 'rule',
      properties: { field: 'status', operator, value, valueSrc, valueType: ['select'] },
    });
    const tree: RAQBGroup = { id: 'r', type: 'group', children1: [rule('is_empty', []), rule('multiselect_contains', [['active']])] };
    expect(decode(raqb, tree, fields)).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'status', operator: 'isNull' },
        { kind: 'rule', field: 'status', operator: 'in', value: ['active'] },
      ],
    });
    expect(() => decode(raqb, { id: 'r', type: 'group', children1: [rule('equal', ['NOW'], ['func'])] }, fields)).toThrow(/function values/);
    expect(() => decode(raqb, { id: 'r', type: 'group', children1: [rule('proximity', ['a'])] }, fields)).toThrow(/unsupported operator/);
  });
});
