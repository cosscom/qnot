import { describe, expect, it } from 'vitest';
import { decode, encode } from '../codec';
import { defineFields, f } from '../fields';
import { fields } from '../fixtures.test-helpers';
import type { Query } from '../types';
import { everyOperator, withIncomplete } from './_fixtures.test-helpers';
import { jqqb, type JQQBGroup, type JQQBRule } from './jqqb';

describe('jqqb', () => {
  it('encodes every operator with jQuery QueryBuilder names, types and inputs', () => {
    const out = encode(jqqb, everyOperator, fields);
    expect(out.condition).toBe('AND');
    expect(out.rules.map((r) => ('operator' in r ? r.operator : 'group'))).toEqual([
      'equal', 'not_equal', 'less', 'less_or_equal', 'greater', 'greater_or_equal', 'contains', 'not_contains', 'begins_with', 'ends_with',
      'between', 'not_between', 'in', 'not_in', 'is_null', 'is_not_null', 'greater', 'equal', 'greater_or_equal', 'group',
    ]);
    expect(out.rules[2]).toEqual({ id: 'age', field: 'age', type: 'integer', input: 'number', operator: 'less', value: 50 });
    expect(out.rules[12]).toMatchObject({ type: 'string', input: 'select', value: ['active', 'pending'] });
    expect(out.rules[16]).toMatchObject({ operator: 'greater', value: null, data: { qnotRef: 'minAge' } });
    expect(out.rules[17]).toMatchObject({ type: 'boolean', input: 'radio', value: true });
    expect(out.rules[18]).toMatchObject({ type: 'date', input: 'text' });
    expect(out.rules[19]).toMatchObject({ condition: 'OR', not: true });
    const doubles = defineFields({ price: f.number(), plan: f.enum([1, 2]) });
    const q: Query = {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'price', operator: 'eq', value: 1.5 },
        { kind: 'rule', field: 'plan', operator: 'eq', value: 2 },
      ],
    };
    expect(encode(jqqb, q, doubles).rules.map((r) => (r as JQQBRule).type)).toEqual(['double', 'integer']);
  });

  it('round-trips, including incomplete rules and refs', () => {
    expect(decode(jqqb, encode(jqqb, everyOperator, fields), fields)).toEqual(everyOperator);
    expect(decode(jqqb, encode(jqqb, withIncomplete, fields), fields)).toEqual(withIncomplete);
  });

  it('decodes getRules() output shapes', () => {
    const input: JQQBGroup = {
      condition: 'OR',
      valid: true,
      rules: [
        { id: 'age', field: 'age', type: 'integer', input: 'number', operator: 'between', value: ['18', '65'] },
        { id: 'name', field: 'name', type: 'string', input: 'text', operator: 'not_begins_with', value: 'x' },
        { id: 'name', field: 'name', type: 'string', input: 'text', operator: 'not_ends_with', value: 'y' },
        { id: 'verified', field: 'verified', type: 'boolean', input: 'radio', operator: 'equal', value: 'false' },
        { id: 'nickname', field: 'nickname', type: 'string', input: 'text', operator: 'is_empty', value: null },
        { condition: 'AND', not: true, rules: [{ id: 'status', field: 'status', type: 'string', input: 'select', operator: 'in', value: 'active,banned' }] },
      ],
    };
    expect(decode(jqqb, input, fields)).toEqual({
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: 'age', operator: 'between', value: [18, 65] },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'name', operator: 'startsWith', value: 'x' }] },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'name', operator: 'endsWith', value: 'y' }] },
        { kind: 'rule', field: 'verified', operator: 'eq', value: false },
        { kind: 'rule', field: 'nickname', operator: 'isEmpty' },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'status', operator: 'in', value: ['active', 'banned'] }] },
      ],
    });
    expect(() => decode(jqqb, { condition: 'XOR', rules: [] }, fields)).toThrow(/unsupported condition/);
    expect(() => decode(jqqb, { condition: 'AND', rules: [{ id: 'a', field: 'age', type: 'integer', input: 'number', operator: 'near', value: 1 }] }, fields)).toThrow(/unsupported operator/);
  });
});
