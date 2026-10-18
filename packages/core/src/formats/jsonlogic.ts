import type { Format } from '../codec';
import type { Fields } from '../fields';
import type { ComparableOp } from '../operators';
import type { Group, Query, QueryNode, Rule } from '../types';
import { coerceScalar, group, isCompleteRule, negated } from './_util';

/** A JsonLogic expression. `true` is the empty query. */
export type JsonLogic = boolean | { readonly [operator: string]: unknown };
type Expr = { readonly [operator: string]: unknown };

const CMP: Record<ComparableOp, string> = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' };

const v = (field: string) => ({ var: field });

function encodeRule(rule: Rule, fields: Fields): Expr | undefined {
  if (!isCompleteRule(fields, rule)) return undefined;
  const f = rule.field;
  if (rule.ref !== undefined) return { [CMP[rule.operator as ComparableOp]]: [v(f), v(rule.ref)] };
  const val = rule.value;
  switch (rule.operator) {
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return { [CMP[rule.operator]]: [v(f), val ?? null] };
    case 'isNull':
      return { '==': [v(f), null] };
    case 'isNotNull':
      return { '!=': [v(f), null] };
    case 'contains':
      return { in: [val, v(f)] };
    case 'notContains':
      return { '!': { in: [val, v(f)] } };
    // Not built into json-logic-js; react-querybuilder emits the same custom operations.
    case 'startsWith':
      return { startsWith: [v(f), val] };
    case 'endsWith':
      return { endsWith: [v(f), val] };
    case 'in':
      return { in: [v(f), val] };
    case 'notIn':
      return { '!': { in: [v(f), val] } };
    case 'between': {
      const [lo, hi] = val as [unknown, unknown];
      return { '<=': [lo, v(f), hi] };
    }
    case 'notBetween': {
      const [lo, hi] = val as [unknown, unknown];
      return { '!': { '<=': [lo, v(f), hi] } };
    }
  }
}

function encodeGroup(g: Group, children: Expr[]): Expr | undefined {
  if (!children.length) return undefined;
  const joined = { [g.combinator]: children };
  return g.not ? { '!': joined } : joined;
}

// --- decode ------------------------------------------------------------------------------------

const fail = (what: unknown): never => {
  throw new Error(`trawlnet/jsonlogic: cannot decode ${JSON.stringify(what)}`);
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const varName = (x: unknown): string | undefined => {
  if (!isObj(x) || !('var' in x)) return undefined;
  const name = Array.isArray(x.var) ? x.var[0] : x.var;
  return typeof name === 'string' ? name : undefined;
};

const BACK: Record<string, ComparableOp> = { '==': 'eq', '===': 'eq', '!=': 'neq', '!==': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' };
const FLIP: Record<ComparableOp, ComparableOp> = { eq: 'eq', neq: 'neq', lt: 'gt', lte: 'gte', gt: 'lt', gte: 'lte' };

function decodeNode(expr: unknown, fields: Fields): QueryNode {
  if (!isObj(expr)) return fail(expr);
  const entries = Object.entries(expr);
  if (entries.length !== 1) return fail(expr);
  const [op, rawArgs] = entries[0]!;
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
  const c = (field: string, x: unknown) => coerceScalar(fields[field], x);

  if (op === 'and' || op === 'or') return group(op, args.map((a) => decodeNode(a, fields)));

  if (op === '!') {
    const inner = decodeNode(args[0], fields);
    if (inner.kind === 'group') return group(inner.combinator, [...inner.children], !inner.not);
    if (inner.operator === 'contains') return { ...inner, operator: 'notContains' };
    if (inner.operator === 'in') return { ...inner, operator: 'notIn' };
    if (inner.operator === 'between') return { ...inner, operator: 'notBetween' };
    return negated(inner);
  }

  if (op in BACK) {
    if (op === '<=' || op === '<') {
      if (args.length === 3) {
        const field = varName(args[1]);
        if (!field || op === '<') return fail(expr);
        return { kind: 'rule', field, operator: 'between', value: [c(field, args[0]), c(field, args[2])] };
      }
    }
    const [a, b] = args;
    const fa = varName(a);
    const fb = varName(b);
    let operator = BACK[op]!;
    if (fa && fb) return { kind: 'rule', field: fa, operator, ref: fb };
    const field = fa ?? fb;
    if (!field) return fail(expr);
    const lit = fa ? b : a;
    if (!fa) operator = FLIP[operator];
    if (lit === null && (operator === 'eq' || operator === 'neq')) return { kind: 'rule', field, operator: operator === 'eq' ? 'isNull' : 'isNotNull' };
    return { kind: 'rule', field, operator, value: c(field, lit) };
  }

  if (op === 'in') {
    const [a, b] = args;
    const fa = varName(a);
    if (fa && Array.isArray(b)) return { kind: 'rule', field: fa, operator: 'in', value: b.map((x) => c(fa, x)) };
    const fb = varName(b);
    if (fb && typeof a === 'string') return { kind: 'rule', field: fb, operator: 'contains', value: a };
    return fail(expr);
  }

  if (op === 'startsWith' || op === 'endsWith') {
    const field = varName(args[0]);
    if (!field || typeof args[1] !== 'string') return fail(expr);
    return { kind: 'rule', field, operator: op, value: args[1] };
  }

  return fail(expr);
}

function decode(logic: JsonLogic, fields: Fields): Query {
  if (logic === true) return group('and', []);
  const node = decodeNode(logic, fields);
  return node.kind === 'group' ? node : group('and', [node]);
}

/**
 * JsonLogic, following react-querybuilder's conventions (custom `startsWith`/`endsWith`
 * operations, `{"<=": [a, {var}, b]}` for between). Incomplete rules are left out; an empty query
 * encodes as `true`. Note json-logic-js comparisons are case-sensitive and coerce null like JS.
 */
export const jsonlogic: Format<JsonLogic, Expr> = {
  name: 'jsonlogic',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx.fields),
  encodeGroup: (g, children) => encodeGroup(g, children),
  finish: (root) => root ?? true,
  decode: (logic, ctx) => decode(logic, ctx.fields),
};
