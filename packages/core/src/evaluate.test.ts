import { describe, expect, it } from 'vitest';
import { compile, validateQuery, type QueryOf } from './index';
import { fields } from './fixtures.test-helpers';

const rows = [
  { name: 'Ada Lovelace', age: 36, minAge: 18, status: 'active', verified: true, joined: '2024-03-01' },
  { name: 'Grace Hopper', age: 85, minAge: 90, status: 'banned', verified: false, joined: '2019-11-20' },
  { name: 'lin', age: null, minAge: 1, status: 'pending', verified: true, joined: '2026-01-05' },
] as const;

const run = (query: QueryOf<typeof fields>) => rows.filter(compile(fields, query)).map((r) => r.name);
const g = (combinator: 'and' | 'or', ...children: QueryOf<typeof fields>['children'][number][]): QueryOf<typeof fields> => ({ kind: 'group', combinator, children });

describe('compile', () => {
  it('handles comparisons, text matching and case-insensitivity', () => {
    expect(run(g('and', { kind: 'rule', field: 'age', operator: 'gt', value: 40 }))).toEqual(['Grace Hopper']);
    expect(run(g('and', { kind: 'rule', field: 'name', operator: 'contains', value: 'LOVE' }))).toEqual(['Ada Lovelace']);
    expect(run(g('and', { kind: 'rule', field: 'name', operator: 'startsWith', value: 'L' }))).toEqual(['lin']);
  });

  it('handles ranges, lists, nulls and dates', () => {
    expect(run(g('and', { kind: 'rule', field: 'age', operator: 'between', value: [30, 40] }))).toEqual(['Ada Lovelace']);
    expect(run(g('and', { kind: 'rule', field: 'status', operator: 'notIn', value: ['banned'] }))).toEqual(['Ada Lovelace', 'lin']);
    expect(run(g('and', { kind: 'rule', field: 'age', operator: 'isNull' }))).toEqual(['lin']);
    expect(run(g('and', { kind: 'rule', field: 'joined', operator: 'gte', value: '2024-01-01' }))).toEqual(['Ada Lovelace', 'lin']);
  });

  it('compares fields, negates groups, and skips incomplete rules', () => {
    expect(run(g('and', { kind: 'rule', field: 'age', operator: 'lt', ref: 'minAge' }))).toEqual(['Grace Hopper']);
    expect(run({ ...g('or', { kind: 'rule', field: 'verified', operator: 'eq', value: true }), not: true })).toEqual(['Grace Hopper']);
    expect(run(g('and', { kind: 'rule', field: 'age', operator: 'eq', value: null }))).toHaveLength(3);
    expect(compile(fields, g('and', { kind: 'rule', field: 'age', operator: 'eq', value: null }), { incompleteRules: false })(rows[0])).toBe(false);
    // A present but invalid value (age must be an integer >= 0) matches nothing unless explicitly skipped.
    const invalid = g('or', { kind: 'rule', field: 'age', operator: 'eq', value: -5 });
    expect(run(invalid)).toEqual([]);
    expect(compile(fields, invalid, { invalidRules: 'skip' })(rows[0])).toBe(true);
  });
});

describe('validateQuery', () => {
  it('reports schema violations with paths', () => {
    const issues = validateQuery(fields, {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'age', operator: 'eq', value: 3.5 },
        { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'age', operator: 'between', value: [10, 2] }] },
        { kind: 'rule', field: 'status', operator: 'eq', value: 'gone' },
        { kind: 'rule', field: 'nickname', operator: 'eq', value: '' },
        { kind: 'group', combinator: 'and', children: [] },
      ],
    });
    expect(issues.map((i) => [i.path, i.code])).toEqual([
      [[0], 'integer'],
      [[1, 0], 'range'],
      [[2], 'option'],
      [[4], 'emptyGroup'],
    ]);
  });
});
