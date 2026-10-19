import type { Format } from '../codec';
import type { Fields } from '../fields';
import type { Group, Query, QueryNode, Rule } from '../types';
import { coerceScalar, group, infoOf, isFnCall, isUnsupported, liftChildren, negated, operatorInfo, toList, Unsupported, unsupportedError } from './_util';

/** react-querybuilder's `RuleType` (the subset qnot reads and writes). */
export interface RQBRule {
  id?: string;
  field: string;
  operator: string;
  value: unknown;
  valueSource?: 'value' | 'field';
  disabled?: boolean;
}

/** react-querybuilder's `RuleGroupType`. */
export interface RQBRuleGroup {
  id?: string;
  combinator: string;
  not?: boolean;
  disabled?: boolean;
  rules: (RQBRule | RQBRuleGroup)[];
}

/** react-querybuilder's independent-combinators `RuleGroupTypeIC` (decode only). */
export interface RQBRuleGroupIC {
  id?: string;
  not?: boolean;
  disabled?: boolean;
  rules: (RQBRule | RQBRuleGroupIC | string)[];
}

const TO_RQB: Record<string, string> = {
  eq: '=',
  neq: '!=',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  contains: 'contains',
  notContains: 'doesNotContain',
  startsWith: 'beginsWith',
  endsWith: 'endsWith',
  between: 'between',
  notBetween: 'notBetween',
  in: 'in',
  notIn: 'notIn',
  isNull: 'null',
  isNotNull: 'notNull',
};
const FROM_RQB: Record<string, string> = { ...Object.fromEntries(Object.entries(TO_RQB).map(([k, v]) => [v, k])), '==': 'eq', '<>': 'neq' };

const unsupported = (subject: Rule | Group, what: string) => new Unsupported(subject, `react-querybuilder has no equivalent for ${what}`);

// Operators react-querybuilder lacks (isEmpty, hasAny…, custom ones) travel under their qnot id,
// which react-querybuilder accepts as a custom operator.
function encodeRule(rule: Rule, fields: Fields): RQBRule | Unsupported {
  if (isFnCall(rule.field) || rule.call !== undefined) return unsupported(rule, 'function calls');
  const operator = TO_RQB[rule.operator] ?? rule.operator;
  if (rule.ref !== undefined) return { field: rule.field, operator, value: rule.ref, valueSource: 'field' };
  const value = infoOf(fields, rule.operator).arity === 'none' ? null : (rule.value ?? null);
  return { field: rule.field, operator, value };
}

function encodeGroup(g: Group, children: (RQBRule | RQBRuleGroup)[]): RQBRuleGroup | Unsupported {
  if (g.of) return unsupported(g, 'array groups');
  const lifted = liftChildren<RQBRule | RQBRuleGroup>(g, children, 'throw');
  if ('bad' in lifted) return lifted.bad;
  children = lifted.kids;
  return g.not ? { combinator: g.combinator, not: true, rules: children } : { combinator: g.combinator, rules: children };
}

// --- decode ------------------------------------------------------------------------------------

const fail = (msg: string, what: unknown): never => {
  throw new Error(`qnot/rqb: ${msg}: ${JSON.stringify(what)}`);
};

function decodeRule(r: RQBRule, fields: Fields): QueryNode {
  const negate = r.operator === 'doesNotBeginWith' || r.operator === 'doesNotEndWith';
  const operator = negate ? (r.operator === 'doesNotBeginWith' ? 'startsWith' : 'endsWith') : (FROM_RQB[r.operator] ?? r.operator);
  if (!operatorInfo(fields, operator)) return fail('unknown operator', r.operator);
  const info = infoOf(fields, operator);
  const def = fields[r.field];
  let rule: Rule;
  if (r.valueSource === 'field') rule = { kind: 'rule', field: r.field, operator, ref: String(r.value) };
  else {
    const arity = info.arity;
    if (arity === 'none') rule = { kind: 'rule', field: r.field, operator };
    else if (arity === 'one') {
      const v = info.textMatch ? (r.value ?? '') : coerceScalar(def, r.value);
      rule = { kind: 'rule', field: r.field, operator, value: v };
    } else {
      const list = toList(r.value).map((x) => coerceScalar(def, x));
      rule = { kind: 'rule', field: r.field, operator, value: arity === 'two' ? [list[0] ?? null, list[1] ?? null] : list };
    }
  }
  return negate ? negated(rule) : rule;
}

const isGroupLike = (x: unknown): x is RQBRuleGroup | RQBRuleGroupIC => typeof x === 'object' && x !== null && Array.isArray((x as RQBRuleGroup).rules);

function decodeChild(child: RQBRule | RQBRuleGroup | RQBRuleGroupIC, fields: Fields): QueryNode {
  return isGroupLike(child) ? decodeGroup(child, fields) : decodeRule(child, fields);
}

/** Independent combinators: AND binds tighter than OR, as in react-querybuilder's convertFromIC. */
function decodeIC(g: RQBRuleGroupIC, fields: Fields): Group {
  const segments: QueryNode[][] = [[]];
  let sawAnd = false;
  for (const item of g.rules) {
    if (typeof item === 'string') {
      const c = item.toLowerCase();
      if (c === 'or') segments.push([]);
      else if (c === 'and') sawAnd = true;
      else fail('unsupported combinator', item);
    } else if (!item.disabled) segments[segments.length - 1]!.push(decodeChild(item, fields));
  }
  const nonEmpty = segments.filter((s) => s.length);
  if (nonEmpty.length <= 1) return group(sawAnd || segments.length === 1 ? 'and' : 'or', nonEmpty[0] ?? [], !!g.not);
  return group(
    'or',
    nonEmpty.map((s) => (s.length === 1 ? s[0]! : group('and', s))),
    !!g.not,
  );
}

function decodeGroup(g: RQBRuleGroup | RQBRuleGroupIC, fields: Fields): Group {
  if (!('combinator' in g) || typeof g.combinator !== 'string') return decodeIC(g as RQBRuleGroupIC, fields);
  const combinator = g.combinator.toLowerCase();
  if (combinator !== 'and' && combinator !== 'or') return fail('unsupported combinator', g.combinator);
  const children = (g.rules as (RQBRule | RQBRuleGroup)[]).filter((r) => !r.disabled).map((r) => decodeChild(r, fields));
  return group(combinator, children, !!g.not);
}

/**
 * react-querybuilder's query JSON. Two-way and faithful (incomplete rules are kept), so it works as
 * a store `format` for drop-in replacement. `doesNotBeginWith`/`doesNotEndWith` decode to a NOT
 * group around startsWith/endsWith; ids and disabled rules are dropped on decode.
 */
export const rqb: Format<RQBRuleGroup, RQBRule | RQBRuleGroup> = {
  name: 'rqb',
  // Unsupported markers travel as nodes until a group or `finish` throws them with their path.
  encodeRule: (rule, ctx) => encodeRule(rule, ctx.fields) as RQBRule,
  encodeGroup: (g, children) => encodeGroup(g, children) as RQBRuleGroup,
  finish: (root) => {
    if (isUnsupported(root)) throw unsupportedError('rqb', root, false);
    return root as RQBRuleGroup;
  },
  decode: (input, ctx) => decodeGroup(input, ctx.fields),
};

/** Decode either react-querybuilder shape, including independent combinators (`RuleGroupTypeIC`). */
export const fromRQB = (input: RQBRuleGroup | RQBRuleGroupIC, fields: Fields): Query => decodeGroup(input, fields);
