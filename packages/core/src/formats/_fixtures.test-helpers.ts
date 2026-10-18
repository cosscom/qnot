import type { Query, QueryNode } from '../types';

const r = (field: string, operator: string, value?: unknown): QueryNode =>
  (value === undefined ? { kind: 'rule', field, operator } : { kind: 'rule', field, operator, value }) as QueryNode;

/** Every operator once, a field ref, a NOT group and nesting. All rules are complete and valid. */
export const everyOperator: Query = {
  kind: 'group',
  combinator: 'and',
  children: [
    r('name', 'eq', 'Ada'),
    r('name', 'neq', "O'Brien"),
    r('age', 'lt', 50),
    r('age', 'lte', 50),
    r('age', 'gt', 18),
    r('age', 'gte', 18),
    r('name', 'contains', '50%_off'),
    r('name', 'notContains', 'x'),
    r('name', 'startsWith', 'A'),
    r('name', 'endsWith', 'e'),
    r('age', 'between', [18, 65]),
    r('age', 'notBetween', [1, 5]),
    r('status', 'in', ['active', 'pending']),
    r('status', 'notIn', ['banned']),
    r('nickname', 'isNull'),
    r('nickname', 'isNotNull'),
    { kind: 'rule', field: 'age', operator: 'gt', ref: 'minAge' },
    r('verified', 'eq', true),
    r('joined', 'gte', '2024-01-01'),
    {
      kind: 'group',
      combinator: 'or',
      not: true,
      children: [r('status', 'eq', 'banned'), { kind: 'group', combinator: 'and', children: [r('score', 'between', [1, 10])] }],
    },
  ],
};

/** The same query minus the rules a given library can't represent. */
export const without = (q: Query, drop: (n: QueryNode) => boolean): Query => ({
  ...q,
  children: q.children.filter((c) => !drop(c)).map((c) => (c.kind === 'group' ? without(c, drop) : c)),
});

/** An AND group with one rule of each kind that validation rejects, plus one valid rule. */
export const withIncomplete: Query = {
  kind: 'group',
  combinator: 'and',
  children: [
    r('age', 'eq', null),
    r('name', 'contains', ''),
    r('age', 'between', [1, null]),
    r('status', 'in', []),
    r('age', 'gt', 30),
    { kind: 'group', combinator: 'or', children: [r('age', 'lt', null)] },
  ],
};

/** Rows with no nulls in compared fields, so JsonLogic's JS coercions agree with compile(). */
export const rows = [
  { name: 'Ada', nickname: null, age: 36, minAge: 18, status: 'active', verified: true, joined: '2024-03-01', score: 4 },
  { name: 'Alice', nickname: 'Al', age: 61, minAge: 70, status: 'pending', verified: false, joined: '2023-11-20', score: 12 },
  { name: 'Eve', nickname: 'E', age: 3, minAge: 1, status: 'banned', verified: true, joined: '2026-01-05', score: 1 },
  { name: 'Anne', nickname: null, age: 40, minAge: 2, status: 'active', verified: true, joined: '2025-06-30', score: 7 },
  { name: 'Bob', nickname: 'B', age: 25, minAge: 30, status: 'pending', verified: false, joined: '2024-01-01', score: 10 },
  { name: 'Annie', nickname: 'Ann', age: 18, minAge: 10, status: 'active', verified: true, joined: '2024-01-02', score: 3 },
];

/** Smaller queries that each select a non-trivial subset of `rows`. */
export const sampleQueries: Query[] = [
  { kind: 'group', combinator: 'and', children: [r('age', 'between', [18, 40]), r('status', 'in', ['active'])] },
  { kind: 'group', combinator: 'or', children: [r('name', 'startsWith', 'A'), r('verified', 'eq', false)] },
  { kind: 'group', combinator: 'and', not: true, children: [r('name', 'contains', 'n')] },
  { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'lt', ref: 'minAge' }] },
  { kind: 'group', combinator: 'and', children: [r('nickname', 'isNull'), r('joined', 'gt', '2024-06-01')] },
  { kind: 'group', combinator: 'or', children: [r('age', 'notBetween', [10, 50]), r('status', 'notIn', ['active', 'pending'])] },
  { kind: 'group', combinator: 'and', children: [r('name', 'endsWith', 'e'), r('age', 'neq', 3), r('score', 'gt', 4)] },
];
