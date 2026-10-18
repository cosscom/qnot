import type { CodecContext, Format } from '../codec';
import type { Fields } from '../fields';
import type { ComparableOp } from '../operators';
import { elementFields } from '../scope';
import type { Group, Quantifier, Query, QueryNode, Rule } from '../types';
import {
  coerceScalar,
  columnOf,
  decodeCallByShape,
  encodeCall,
  encodeIn,
  group,
  groupScope,
  infoOf,
  isArrayGroupIn,
  isCompleteRule,
  isFnCall,
  negated,
  type FnCall,
  type Operand,
} from './_util';

/** A JsonLogic expression. `true` is the empty query. */
export type JsonLogic = boolean | { readonly [operator: string]: unknown };
type Expr = { readonly [operator: string]: unknown };

const CMP: Record<ComparableOp, string> = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' };

const count = (arr: unknown, inner: unknown) => ({ reduce: [{ filter: [arr, inner] }, { '+': [1, { var: 'accumulator' }] }, 0] });

function encodeRule(rule: Rule, ctx: CodecContext): Expr | undefined {
  const { fields } = ctx;
  if (!isCompleteRule(fields, rule)) return undefined;
  const v = (name: string) => ({ var: columnOf(fields, name) });
  const arg = (o: Operand): unknown => (isFnCall(o) ? encodeCall('jsonlogic', fields, o, arg) : 'ref' in o ? v(o.ref) : o.value);
  const left = isFnCall(rule.field) ? arg(rule.field) : v(rule.field);
  if (left === undefined) return undefined;
  const info = infoOf(fields, rule.operator);
  const val = rule.value;
  if (info.formats?.jsonlogic) return info.formats.jsonlogic({ field: left, value: val, raw: val }) as Expr;
  if (rule.ref !== undefined) return { [CMP[rule.operator as ComparableOp]]: [left, v(rule.ref)] };
  if (rule.call !== undefined) {
    const rhs = arg(rule.call);
    return rhs === undefined ? undefined : { [CMP[rule.operator as ComparableOp]]: [left, rhs] };
  }
  const list = val as unknown[];
  const anyOf = () => ({ some: [left, { in: [{ var: '' }, list] }] });
  const allOf = () => ({ and: list.map((w) => ({ in: [w, left] })) });
  switch (rule.operator) {
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return { [CMP[rule.operator]]: [left, val ?? null] };
    case 'isNull':
      return { '==': [left, null] };
    case 'isNotNull':
      return { '!=': [left, null] };
    case 'isEmpty':
      return { '!': left };
    case 'isNotEmpty':
      return { '!!': left };
    case 'contains':
      return { in: [val, left] };
    case 'notContains':
      return { '!': { in: [val, left] } };
    // Not built into json-logic-js; react-querybuilder emits the same custom operations.
    case 'startsWith':
      return { startsWith: [left, val] };
    case 'endsWith':
      return { endsWith: [left, val] };
    case 'in':
      return { in: [left, val] };
    case 'notIn':
      return { '!': { in: [left, val] } };
    case 'between': {
      const [lo, hi] = val as [unknown, unknown];
      return { '<=': [lo, left, hi] };
    }
    case 'notBetween': {
      const [lo, hi] = val as [unknown, unknown];
      return { '!': { '<=': [lo, left, hi] } };
    }
    // RAQB multiselect_contains / multiselect_not_contains.
    case 'hasAny':
      return anyOf();
    case 'hasNone':
      return { '!': anyOf() };
    case 'hasAll':
      return allOf();
    case 'setEq':
    case 'setNeq': {
      const eq = { and: [allOf(), { all: [left, { in: [{ var: '' }, list] }] }] };
      return rule.operator === 'setEq' ? eq : { '!': eq };
    }
  }
  return undefined;
}

function quantify(arr: unknown, inner: unknown, match: Quantifier): Expr {
  if (match === 'some') return { some: [arr, inner] };
  if (match === 'none') return { none: [arr, inner] };
  // json-logic-js's `all` is false for an empty array; "none fail" is true, matching compile().
  if (match === 'all') return { none: [arr, { '!': inner }] };
  const n = count(arr, inner);
  if (match.count === 'between') return { '<=': [match.value[0], n, match.value[1]] };
  return { [CMP[match.count]]: [n, match.value] };
}

function encodeGroup(g: Group, children: Expr[], ctx: CodecContext): Expr | undefined {
  if (g.of) {
    if (!isArrayGroupIn(ctx.fields, g)) return undefined;
    const kids = encodeIn(jsonlogic, g.children, { fields: groupScope(ctx.fields, g) });
    const inner = !kids.length ? true : kids.length === 1 ? kids[0] : { [g.combinator]: kids };
    const q = quantify({ var: columnOf(ctx.fields, g.of.field) }, inner, g.of.match);
    return g.not ? { '!': q } : q;
  }
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
  if (!isObj(x) || !('var' in x) || Object.keys(x).length !== 1) return undefined;
  const name = Array.isArray(x.var) ? x.var[0] : x.var;
  return typeof name === 'string' ? name : undefined;
};
const single = (x: unknown) => (Array.isArray(x) && x.length === 1 ? x[0] : x);

const BACK: Record<string, ComparableOp> = { '==': 'eq', '===': 'eq', '!=': 'neq', '!==': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' };
const FLIP: Record<ComparableOp, ComparableOp> = { eq: 'eq', neq: 'neq', lt: 'gt', lte: 'gte', gt: 'lt', gte: 'lte' };

function decodeNode(expr: unknown, fields: Fields): QueryNode {
  if (!isObj(expr)) return fail(expr);
  const entries = Object.entries(expr);
  if (entries.length !== 1) return fail(expr);
  const [op, rawArgs] = entries[0]!;
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
  const fieldOf = (x: unknown) => {
    const name = varName(x);
    return name === undefined ? undefined : (Object.keys(fields).find((k) => columnOf(fields, k) === name) ?? name);
  };
  const c = (field: string | FnCall, x: unknown) => (typeof field === 'string' ? coerceScalar(fields[field], x) : x);
  const operand = (x: unknown): Operand | undefined => {
    const f = fieldOf(x);
    if (f !== undefined) return { ref: f };
    if (isObj(x)) return decodeCallByShape('jsonlogic', fields, x, (a) => operand(a));
    return { value: x };
  };
  /** A left side: a field or a registered function call. */
  const leftOf = (x: unknown): string | FnCall | undefined => {
    const f = fieldOf(x);
    if (f !== undefined) return f;
    const o = isObj(x) ? operand(x) : undefined;
    return o && isFnCall(o) ? o : undefined;
  };

  if (op === 'and' || op === 'or') {
    if (op === 'and') {
      const special = hasAllOrSetEq(args, fields, fieldOf);
      if (special) return special;
    }
    return group(op, args.map((a) => decodeNode(a, fields)));
  }

  if (op === '!' || op === '!!') {
    const inner = single(rawArgs);
    const f = leftOf(inner);
    if (f !== undefined) return { kind: 'rule', field: f, operator: op === '!' ? 'isEmpty' : 'isNotEmpty' };
    if (op === '!!') return decodeNode(inner, fields);
    const node = decodeNode(inner, fields);
    if (node.kind === 'group') return group(node.combinator, [...node.children], !node.not);
    const flip: Record<string, string> = { contains: 'notContains', in: 'notIn', between: 'notBetween', hasAny: 'hasNone', setEq: 'setNeq' };
    if (flip[node.operator]) return { ...node, operator: flip[node.operator]! };
    return negated(node);
  }

  if (op === 'some' || op === 'all' || op === 'none') {
    const [arr, inner] = args;
    const field = fieldOf(arr);
    if (field === undefined) return fail(expr);
    const def = fields[field];
    if (def?.kind === 'multiEnum' && isObj(inner) && Array.isArray(inner.in) && varName(inner.in[0]) === '' && Array.isArray(inner.in[1])) {
      // RAQB multiselect_contains (some) / multiselect_equals (all, a subset test).
      const values = (inner.in[1] as unknown[]).map((x) => c(field, x));
      if (op === 'some') return { kind: 'rule', field, operator: 'hasAny', value: values };
      if (op === 'all') return { kind: 'rule', field, operator: 'setEq', value: values };
      return { kind: 'rule', field, operator: 'hasNone', value: values };
    }
    if (op === 'none' && isObj(inner) && '!' in inner && Object.keys(inner).length === 1) return arrayGroup(field, 'all', inner['!'], fields);
    return arrayGroup(field, op, inner, fields);
  }

  if (op in BACK) {
    // Count quantifiers: { op: [{ reduce: [{ filter: [arr, inner] }, …] }, n] } and between.
    if (op === '<=' && args.length === 3 && isReduce(args[1])) {
      const { arr, inner } = isReduce(args[1])!;
      return arrayGroup(fieldOf(arr) ?? fail(arr), { count: 'between', value: [args[0] as number, args[2] as number] }, inner, fields);
    }
    if (args.length === 2 && isReduce(args[0])) {
      const { arr, inner } = isReduce(args[0])!;
      return arrayGroup(fieldOf(arr) ?? fail(arr), { count: BACK[op]!, value: args[1] as number }, inner, fields);
    }
    if ((op === '<=' || op === '<') && args.length === 3) {
      const field = leftOf(args[1]);
      if (field === undefined || op === '<') return fail(expr);
      return { kind: 'rule', field, operator: 'between', value: [c(field, args[0]), c(field, args[2])] };
    }
    const [a, b] = args;
    let operator = BACK[op]!;
    let la = leftOf(a);
    let rb: unknown = b;
    if (la === undefined) {
      la = leftOf(b);
      rb = a;
      operator = FLIP[operator];
    }
    if (la === undefined) return fail(expr);
    const rf = fieldOf(rb);
    if (rf !== undefined) return { kind: 'rule', field: la, operator, ref: rf };
    if (isObj(rb)) {
      const call = operand(rb);
      if (call && isFnCall(call)) return { kind: 'rule', field: la, operator, call };
      return fail(expr);
    }
    if (rb === null && (operator === 'eq' || operator === 'neq')) return { kind: 'rule', field: la, operator: operator === 'eq' ? 'isNull' : 'isNotNull' };
    return { kind: 'rule', field: la, operator, value: c(la, rb) };
  }

  if (op === 'in') {
    const [a, b] = args;
    const fa = leftOf(a);
    if (fa !== undefined && Array.isArray(b)) return { kind: 'rule', field: fa, operator: 'in', value: b.map((x) => c(fa, x)) };
    const fb = leftOf(b);
    if (fb !== undefined && typeof a === 'string') return { kind: 'rule', field: fb, operator: 'contains', value: a };
    return fail(expr);
  }

  if (op === 'startsWith' || op === 'endsWith') {
    const field = leftOf(args[0]);
    if (field === undefined || typeof args[1] !== 'string') return fail(expr);
    return { kind: 'rule', field, operator: op, value: args[1] };
  }

  return fail(expr);
}

function isReduce(x: unknown): { arr: unknown; inner: unknown } | undefined {
  if (!isObj(x) || !Array.isArray(x.reduce)) return undefined;
  const filter = x.reduce[0];
  if (!isObj(filter) || !Array.isArray(filter.filter) || filter.filter.length !== 2) return undefined;
  return { arr: filter.filter[0], inner: filter.filter[1] };
}

function arrayGroup(field: string, match: Quantifier, inner: unknown, fields: Fields): Group {
  const scope = elementFields(fields, field);
  if (inner === true) return { kind: 'group', combinator: 'and', of: { field, match }, children: [] };
  const node = decodeNode(inner, scope);
  const g = node.kind === 'group' && !node.not && !node.of ? node : group('and', [node]);
  return { kind: 'group', combinator: g.combinator, of: { field, match }, children: g.children };
}

/** `{ and: [{ in: [w, var] }, …] }` on a multiEnum field is hasAll; plus an `all … in list` check, setEq. */
function hasAllOrSetEq(args: unknown[], fields: Fields, fieldOf: (x: unknown) => string | undefined): Rule | undefined {
  const members = (xs: unknown[]) => {
    let field: string | undefined;
    const values: unknown[] = [];
    for (const x of xs) {
      if (!isObj(x) || !Array.isArray(x.in) || Object.keys(x).length !== 1) return undefined;
      const f = fieldOf(x.in[1]);
      if (f === undefined || (field !== undefined && f !== field) || fields[f]?.kind !== 'multiEnum' || isObj(x.in[0])) return undefined;
      field = f;
      values.push(x.in[0]);
    }
    return field === undefined ? undefined : { field, values };
  };
  const direct = members(args);
  if (direct) return { kind: 'rule', field: direct.field, operator: 'hasAll', value: direct.values };
  if (args.length === 2 && isObj(args[0]) && Array.isArray(args[0].and) && isObj(args[1]) && Array.isArray(args[1].all)) {
    const m = members(args[0].and as unknown[]);
    if (m && fieldOf(args[1].all[0]) === m.field) return { kind: 'rule', field: m.field, operator: 'setEq', value: m.values };
  }
  return undefined;
}

function decode(logic: JsonLogic, fields: Fields): Query {
  if (logic === true) return group('and', []);
  const node = decodeNode(logic, fields);
  return node.kind === 'group' && !node.of ? node : group('and', [node]);
}

/**
 * JsonLogic, following react-querybuilder / RAQB conventions (custom `startsWith`/`endsWith`
 * operations, `{"<=": [a, {var}, b]}` for between, `some`/`none` + `reduce`/`filter` counts for
 * array groups). Incomplete rules are left out; an empty query encodes as `true`.
 * Note json-logic-js comparisons are case-sensitive and coerce null like JS.
 */
export const jsonlogic: Format<JsonLogic, Expr> = {
  name: 'jsonlogic',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx),
  encodeGroup: (g, children, ctx) => encodeGroup(g, children, ctx),
  finish: (root) => root ?? true,
  decode: (logic, ctx) => decode(logic, ctx.fields),
  encodeCases: (whens, otherwise) => ({ if: [...whens.flatMap(({ when, then }) => [when ?? true, then]), otherwise ?? null] }),
};
