import jsonLogic from 'json-logic-js';
import { parseJsonLogic } from '@react-querybuilder/core/parseJsonLogic';
import { describe, expect, it } from 'vitest';
import { decode, encode } from '../codec';
import { compile } from '../evaluate';
import { fields } from '../fixtures.test-helpers';
import type { Query } from '../types';
import { everyOperator, rows, sampleQueries, withIncomplete } from './_fixtures.test-helpers';
import { jsonlogic } from './jsonlogic';
import { rqb, type RQBRuleGroup } from './rqb';

// json-logic-js has no startsWith/endsWith; react-querybuilder documents adding them like this.
jsonLogic.add_operation('startsWith', (a: unknown, b: unknown) => typeof a === 'string' && a.startsWith(String(b)));
jsonLogic.add_operation('endsWith', (a: unknown, b: unknown) => typeof a === 'string' && a.endsWith(String(b)));

describe('jsonlogic', () => {
  it('encodes every operator using react-querybuilder conventions', () => {
    expect(encode(jsonlogic, everyOperator, fields)).toEqual({
      and: [
        { '==': [{ var: 'name' }, 'Ada'] },
        { '!=': [{ var: 'name' }, "O'Brien"] },
        { '<': [{ var: 'age' }, 50] },
        { '<=': [{ var: 'age' }, 50] },
        { '>': [{ var: 'age' }, 18] },
        { '>=': [{ var: 'age' }, 18] },
        { in: ['50%_off', { var: 'name' }] },
        { '!': { in: ['x', { var: 'name' }] } },
        { startsWith: [{ var: 'name' }, 'A'] },
        { endsWith: [{ var: 'name' }, 'e'] },
        { '<=': [18, { var: 'age' }, 65] },
        { '!': { '<=': [1, { var: 'age' }, 5] } },
        { in: [{ var: 'status' }, ['active', 'pending']] },
        { '!': { in: [{ var: 'status' }, ['banned']] } },
        { '==': [{ var: 'nickname' }, null] },
        { '!=': [{ var: 'nickname' }, null] },
        { '>': [{ var: 'age' }, { var: 'minAge' }] },
        { '==': [{ var: 'verified' }, true] },
        { '>=': [{ var: 'joined' }, '2024-01-01'] },
        { '!': { or: [{ '==': [{ var: 'status' }, 'banned'] }, { and: [{ '<=': [1, { var: 'score' }, 10] }] }] } },
      ],
    });
  });

  it('round-trips', () => {
    expect(decode(jsonlogic, encode(jsonlogic, everyOperator, fields), fields)).toEqual(everyOperator);
  });

  it('skips incomplete rules; empty query is true', () => {
    expect(encode(jsonlogic, withIncomplete, fields)).toEqual({ and: [{ '>': [{ var: 'age' }, 30] }] });
    expect(encode(jsonlogic, { kind: 'group', combinator: 'and', children: [] }, fields)).toBe(true);
    expect(decode(jsonlogic, true, fields)).toEqual({ kind: 'group', combinator: 'and', children: [] });
  });

  it('decodes literal-first comparisons, === and negated rules', () => {
    expect(decode(jsonlogic, { or: [{ '<': [5, { var: 'age' }] }, { '===': [{ var: 'name' }, 'x'] }, { '!': { '==': [{ var: 'age' }, 3] } }] }, fields)).toEqual({
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: 'age', operator: 'gt', value: 5 },
        { kind: 'rule', field: 'name', operator: 'eq', value: 'x' },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'age', operator: 'eq', value: 3 }] },
      ],
    });
    expect(() => decode(jsonlogic, { merge: [1, 2] }, fields)).toThrow(/cannot decode/);
  });

  it('json-logic-js agrees with compile() on every sample query', () => {
    for (const q of sampleQueries) {
      const logic = encode(jsonlogic, q, fields);
      const expected = rows.filter(compile(fields, q as never)).map((r) => r.name);
      expect(rows.filter((row) => jsonLogic.apply(logic as jsonLogic.RulesLogic, row)).map((r) => r.name), JSON.stringify(logic)).toEqual(expected);
      expect(expected.length, JSON.stringify(q)).toBeGreaterThan(0);
      expect(expected.length, JSON.stringify(q)).toBeLessThan(rows.length);
    }
  });

  it("react-querybuilder's parseJsonLogic reads our output back to the same query", () => {
    const parsed = parseJsonLogic(encode(jsonlogic, everyOperator, fields) as never) as unknown as RQBRuleGroup;
    expect(decode(rqb, parsed, fields)).toEqual(everyOperator);
  });

  it('decodes a single top-level rule into an AND group', () => {
    const q: Query = { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'eq', value: 1 }] };
    expect(decode(jsonlogic, { '==': [{ var: 'age' }, 1] }, fields)).toEqual(q);
  });
});
