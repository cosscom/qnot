import { defineFields, f } from '../fields';
import { builtinFunctions } from '../functions';
import { defineOperator } from '../operators';
import type { Query, QueryNode } from '../types';

/** A custom operator with an output for every codec. */
export const near = defineOperator({
  id: 'near',
  arity: 'one',
  label: 'is within',
  evaluate: (fieldValue, operand) => typeof fieldValue === 'number' && typeof operand === 'number' && Math.abs(fieldValue) <= operand,
  formats: {
    sql: ({ field, value }) => `ABS(${String(field)}) <= ${String(value)}`,
    mongo: ({ field, raw }) => ({ [String(field)]: { $gte: -Number(raw), $lte: Number(raw) } }),
    jsonlogic: ({ field, raw }) => ({ '<=': [-Number(raw), field, Number(raw)] }),
    spel: ({ field, raw }) => `T(Math).abs(${String(field)}) <= ${Number(raw)}`,
    elasticsearch: ({ field, raw }) => ({ range: { [String(field)]: { gte: -Number(raw), lte: Number(raw) } } }),
    text: ({ field, raw }) => `${String(field)} is within ${Number(raw)}`,
  },
});

export const pfields = defineFields(
  {
    name: f.text(),
    distance: f.number({ operators: ['eq'], extraOperators: ['near'] }),
    age: f.number(),
    minAge: f.number(),
    tags: f.multiEnum(['vip', 'beta', 'churned']),
    opensAt: f.time(),
    lastSeen: f.datetime(),
    joined: f.date(),
    address: f.struct({ city: f.text(), zip: f.text({ column: 'postal_code' }) }, { label: 'Address' }),
    orders: f.array({ product: f.text(), qty: f.number(), status: f.enum(['paid', 'refunded']) }),
  },
  { operators: [near], functions: builtinFunctions },
);

export const prows = [
  {
    name: 'ada',
    distance: 3,
    age: 36,
    minAge: 18,
    tags: ['vip', 'beta'],
    opensAt: '09:00',
    joined: '2024-03-01',
    address: { city: 'london', postal_code: 'n1' },
    orders: [
      { product: 'mast', qty: 2, status: 'paid' },
      { product: 'sail', qty: 1, status: 'refunded' },
    ],
  },
  { name: 'grace', distance: -12, age: 85, minAge: 90, tags: [], opensAt: '18:30', joined: '2019-11-20', address: { city: 'new york', postal_code: '10001' }, orders: [] },
  {
    name: 'linus',
    distance: 8,
    age: 25,
    minAge: 30,
    tags: ['churned'],
    opensAt: '12:15',
    joined: '2026-01-05',
    address: { city: 'helsinki', postal_code: '00100' },
    orders: [
      { product: 'keel', qty: 5, status: 'paid' },
      { product: 'mast', qty: 1, status: 'paid' },
      { product: 'tide', qty: 1, status: 'paid' },
    ],
  },
];

export const rule = (field: string, operator: string, value?: unknown): QueryNode =>
  (value === undefined ? { kind: 'rule', field, operator } : { kind: 'rule', field, operator, value }) as QueryNode;
export const and = (...children: QueryNode[]): Query => ({ kind: 'group', combinator: 'and', children });
export const or = (...children: QueryNode[]): Query => ({ kind: 'group', combinator: 'or', children });
export const orders = (match: unknown, ...children: QueryNode[]): QueryNode => ({ kind: 'group', combinator: 'and', of: { field: 'orders', match }, children }) as QueryNode;

/** Queries that each pick a non-trivial subset of `prows`, using the parity features. */
export const parityQueries: Query[] = [
  and(orders('some', rule('product', 'eq', 'mast'))),
  and(orders('all', rule('status', 'eq', 'paid'))),
  and(orders('none', rule('status', 'eq', 'paid'))),
  and(orders({ count: 'gte', value: 2 }, rule('status', 'eq', 'paid'))),
  and(orders({ count: 'between', value: [1, 2] }, rule('status', 'eq', 'paid'))),
  and(orders('some', rule('qty', 'gt', 1), rule('status', 'eq', 'paid'))),
  and(rule('tags', 'hasAny', ['vip', 'churned'])),
  and(rule('tags', 'hasAll', ['vip', 'beta'])),
  and(rule('tags', 'isEmpty')),
  and(rule('tags', 'isNotEmpty')),
  and(rule('address.city', 'startsWith', 'new')),
  and({ kind: 'rule', field: 'age', operator: 'lt', ref: 'minAge' }),
];
