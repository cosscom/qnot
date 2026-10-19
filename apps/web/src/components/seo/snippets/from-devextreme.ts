import type { Query, QueryNode } from '@qnot/core';

// DevExtreme filter expression -> qnot query. Operations FilterBuilder doesn't share with qnot
// fall through unchanged, so validateQuery() reports them instead of silently dropping them.
const OPS: Record<string, string> = {
  '=': 'eq', '<>': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte',
  contains: 'contains', notcontains: 'notContains', startswith: 'startsWith', endswith: 'endsWith',
  between: 'between', anyof: 'in', noneof: 'notIn',
  isblank: 'isNull', isnotblank: 'isNotNull', // DevExtreme's "blank" also matches ''
};

function toNode(expr: readonly unknown[]): QueryNode {
  if (expr[0] === '!') return { kind: 'group', combinator: 'and', not: true, children: [toNode(expr[1] as unknown[])] };
  if (typeof expr[0] === 'string') {
    const [field, op, value] = expr as [string, string, unknown];
    const operator = OPS[op] ?? op;
    return operator === 'isNull' || operator === 'isNotNull' ? { kind: 'rule', field, operator } : { kind: 'rule', field, operator, value };
  }
  // [condition, 'and', condition, 'and', …]: one combinator per level.
  const children = expr.filter((_, i) => i % 2 === 0).map((c) => toNode(c as unknown[]));
  return { kind: 'group', combinator: expr[1] === 'or' ? 'or' : 'and', children };
}

export function fromDevExtreme(value: readonly unknown[]): Query {
  const node = toNode(value);
  return node.kind === 'group' ? node : { kind: 'group', combinator: 'and', children: [node] };
}

// Once per saved filter, or on the fly while both builders coexist:
//   const store = createQueryStore({ fields, initial: fromDevExtreme(filterBuilder.option('value')) });
