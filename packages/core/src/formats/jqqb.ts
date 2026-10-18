import type { Format } from '../codec';
import type { AnyFieldDef, Fields } from '../fields';
import type { Group, Query, QueryNode, Rule } from '../types';
import { coerceScalar, group, infoOf, isFnCall, negated, operatorInfo, toList } from './_util';

/** A rule in jQuery QueryBuilder's `getRules()` output. */
export interface JQQBRule {
  id: string;
  field: string;
  type: string;
  input: string;
  operator: string;
  value: unknown;
  /** jQuery QueryBuilder's free-form rule data; trawlnet stores field refs here as `{ trawlnetRef }`. */
  data?: Record<string, unknown>;
}

/** A group in jQuery QueryBuilder's `getRules()` output. */
export interface JQQBGroup {
  condition: string;
  not?: boolean;
  valid?: boolean;
  rules: (JQQBRule | JQQBGroup)[];
}

const TO_JQQB: Record<string, string> = {
  eq: 'equal',
  neq: 'not_equal',
  lt: 'less',
  lte: 'less_or_equal',
  gt: 'greater',
  gte: 'greater_or_equal',
  contains: 'contains',
  notContains: 'not_contains',
  startsWith: 'begins_with',
  endsWith: 'ends_with',
  between: 'between',
  notBetween: 'not_between',
  in: 'in',
  notIn: 'not_in',
  isNull: 'is_null',
  isNotNull: 'is_not_null',
  isEmpty: 'is_empty',
  isNotEmpty: 'is_not_empty',
};
const FROM_JQQB: Record<string, string> = Object.fromEntries(Object.entries(TO_JQQB).map(([k, v]) => [v, k]));

const unsupported = (what: string): never => {
  throw new Error(`trawlnet/jqqb: jQuery QueryBuilder has no equivalent for ${what}`);
};

function typeAndInput(def: AnyFieldDef | undefined): { type: string; input: string } {
  switch (def?.kind) {
    case 'number':
      return { type: def.integer ? 'integer' : 'double', input: 'number' };
    case 'boolean':
      return { type: 'boolean', input: 'radio' };
    case 'date':
    case 'time':
    case 'datetime':
      return { type: def.kind, input: 'text' };
    case 'multiEnum':
      return { type: 'string', input: 'checkbox' };
    case 'enum':
      return { type: typeof def.options?.[0]?.value === 'number' ? 'integer' : 'string', input: 'select' };
    default:
      return { type: 'string', input: 'text' };
  }
}

// Operators jQuery QueryBuilder lacks (hasAny…, custom ones) travel under their trawlnet id; register
// matching custom operators in jQuery QueryBuilder to edit them there.
function encodeRule(rule: Rule, fields: Fields): JQQBRule {
  if (isFnCall(rule.field) || rule.call !== undefined) return unsupported('function calls');
  const base = { id: rule.field, field: rule.field, ...typeAndInput(fields[rule.field]), operator: TO_JQQB[rule.operator] ?? rule.operator };
  if (rule.ref !== undefined) return { ...base, value: null, data: { trawlnetRef: rule.ref } };
  return { ...base, value: infoOf(fields, rule.operator).arity === 'none' ? null : (rule.value ?? null) };
}

function encodeGroup(g: Group, children: (JQQBRule | JQQBGroup)[]): JQQBGroup {
  if (g.of) return unsupported(`array groups (${g.of.field})`);
  return g.not ? { condition: g.combinator.toUpperCase(), not: true, rules: children } : { condition: g.combinator.toUpperCase(), rules: children };
}

// --- decode ------------------------------------------------------------------------------------

const fail = (msg: string, what: unknown): never => {
  throw new Error(`trawlnet/jqqb: ${msg}: ${JSON.stringify(what)}`);
};

function decodeRule(r: JQQBRule, fields: Fields): QueryNode {
  const field = r.field ?? r.id;
  const negate = r.operator === 'not_begins_with' || r.operator === 'not_ends_with';
  const operator = negate ? (r.operator === 'not_begins_with' ? 'startsWith' : 'endsWith') : (FROM_JQQB[r.operator] ?? r.operator);
  if (!operatorInfo(fields, operator)) return fail('unsupported operator', r.operator);
  const info = infoOf(fields, operator);
  const ref = r.data?.trawlnetRef;
  if (typeof ref === 'string') return { kind: 'rule', field, operator, ref };
  const def = fields[field];
  const c = (x: unknown) => coerceScalar(def, x);
  let rule: Rule;
  switch (info.arity) {
    case 'none':
      rule = { kind: 'rule', field, operator };
      break;
    case 'two': {
      const list = toList(r.value);
      rule = { kind: 'rule', field, operator, value: [c(list[0]), c(list[1])] };
      break;
    }
    case 'many':
      rule = { kind: 'rule', field, operator, value: toList(r.value).map(c) };
      break;
    case 'one':
      rule = { kind: 'rule', field, operator, value: info.textMatch ? (r.value ?? '') : c(r.value) };
  }
  return negate ? negated(rule) : rule;
}

function decodeGroup(g: JQQBGroup, fields: Fields): Group {
  const condition = (g.condition ?? 'AND').toLowerCase();
  if (condition !== 'and' && condition !== 'or') return fail('unsupported condition', g.condition);
  const children = g.rules.map((r) => ('rules' in r && Array.isArray(r.rules) ? decodeGroup(r, fields) : decodeRule(r as JQQBRule, fields)));
  return group(condition, children, !!g.not);
}

/**
 * jQuery QueryBuilder's rules JSON (`getRules()` / `setRules()`). Two-way and faithful. It has no
 * field-to-field comparison, so refs travel in the rule's `data.trawlnetRef`; `not_begins_with` and
 * `not_ends_with` decode to a NOT group. Function calls and array groups can't be represented.
 */
export const jqqb: Format<JQQBGroup, JQQBRule | JQQBGroup> = {
  name: 'jqqb',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx.fields),
  encodeGroup: (g, children) => encodeGroup(g, children),
  decode: (input, ctx): Query => decodeGroup(input, ctx.fields),
};
