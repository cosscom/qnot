import type { Query, QueryNode } from '@qnot/core';

/** The parts of Syncfusion's RuleModel (getRules() output) this reads. */
interface SfRule {
  condition?: string;
  not?: boolean;
  rules?: SfRule[];
  field?: string;
  operator?: string;
  value?: unknown;
}

const OPS: Record<string, string> = {
  equal: 'eq', notequal: 'neq', greaterthan: 'gt', greaterthanorequal: 'gte', lessthan: 'lt', lessthanorequal: 'lte',
  between: 'between', notbetween: 'notBetween', in: 'in', notin: 'notIn',
  contains: 'contains', notcontains: 'notContains', startswith: 'startsWith', endswith: 'endsWith',
  isnull: 'isNull', isnotnull: 'isNotNull', isempty: 'isEmpty', isnotempty: 'isNotEmpty',
};
const NULLARY = new Set(['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty']);

function toNode(r: SfRule): QueryNode {
  if (r.rules) {
    const children = r.rules.map(toNode);
    return { kind: 'group', combinator: r.condition?.toLowerCase() === 'or' ? 'or' : 'and', ...(r.not && { not: true }), children };
  }
  const field = r.field!;
  // notstartswith / notendswith: a NOT group around startsWith / endsWith.
  if (r.operator === 'notstartswith' || r.operator === 'notendswith') {
    const operator = r.operator === 'notstartswith' ? 'startsWith' : 'endsWith';
    return { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field, operator, value: r.value }] };
  }
  const operator = OPS[r.operator!] ?? r.operator!;
  return NULLARY.has(operator) ? { kind: 'rule', field, operator } : { kind: 'rule', field, operator, value: r.value };
}

export const fromSyncfusion = (rule: SfRule): Query => toNode({ ...rule, rules: rule.rules ?? [] }) as Query;

// Once per saved rule, or on the fly while both builders coexist:
//   const store = createQueryStore({ fields, initial: fromSyncfusion(queryBuilder.getRules()) });
