import type { Format } from '../codec';
import type { Fields } from '../fields';
import type { ComparableOp } from '../operators';
import type { Group, Query, QueryNode, Rule } from '../types';
import { coerceScalar, escapeRegex, group, isCompleteRule, negated } from './_util';

/** A MongoDB query filter document. */
export type MongoFilter = { readonly [key: string]: unknown };

const CMP: Record<ComparableOp, string> = { eq: '$eq', neq: '$ne', lt: '$lt', lte: '$lte', gt: '$gt', gte: '$gte' };
const CMP_BACK = Object.fromEntries(Object.entries(CMP).map(([k, v]) => [v, k])) as Record<string, ComparableOp>;

function encodeRule(rule: Rule, fields: Fields): MongoFilter | undefined {
  if (!isCompleteRule(fields, rule)) return undefined;
  const f = rule.field;
  const op = rule.operator;
  if (rule.ref !== undefined) return { $expr: { [CMP[op as ComparableOp]]: [`$${f}`, `$${rule.ref}`] } };
  const v = rule.value;
  const regex = (pattern: string) => (fields[f]?.caseSensitive ? { $regex: pattern } : { $regex: pattern, $options: 'i' });
  switch (op) {
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return { [f]: { [CMP[op]]: v ?? null } };
    case 'isNull':
      return { [f]: { $eq: null } };
    case 'isNotNull':
      return { [f]: { $ne: null } };
    case 'in':
      return { [f]: { $in: v } };
    case 'notIn':
      return { [f]: { $nin: v } };
    case 'between': {
      const [lo, hi] = v as [unknown, unknown];
      return { [f]: { $gte: lo, $lte: hi } };
    }
    case 'notBetween': {
      const [lo, hi] = v as [unknown, unknown];
      return { [f]: { $not: { $gte: lo, $lte: hi } } };
    }
    case 'contains':
      return { [f]: regex(escapeRegex(String(v))) };
    case 'notContains':
      return { [f]: { $not: regex(escapeRegex(String(v))) } };
    case 'startsWith':
      return { [f]: regex(`^${escapeRegex(String(v))}`) };
    case 'endsWith':
      return { [f]: regex(`${escapeRegex(String(v))}$`) };
  }
}

function encodeGroup(g: Group, children: MongoFilter[]): MongoFilter | undefined {
  if (!children.length) return undefined;
  if (!g.not) return { [g.combinator === 'and' ? '$and' : '$or']: children };
  // NOT (a OR b) is $nor: [a, b]; NOT (a AND b) is $nor: [{ $and: [a, b] }].
  return g.combinator === 'or' ? { $nor: children } : { $nor: [{ $and: children }] };
}

// --- decode ------------------------------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp);

const fail = (what: unknown): never => {
  throw new Error(`trawlnet/mongo: cannot decode ${JSON.stringify(what)}`);
};

/** Turn an escaped regex back into its literal text, or null if it uses real regex syntax. */
function unescapeRegex(src: string): string | null {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === '\\') {
      const next = src[++i];
      if (next === undefined || /[a-zA-Z0-9]/.test(next)) return null;
      out += next;
    } else if (/[.*+?^${}()|[\]]/.test(c)) return null;
    else out += c;
  }
  return out;
}

function decodeRegex(field: string, spec: unknown, negate: boolean): QueryNode {
  const raw = spec instanceof RegExp || !isPlainObject(spec) ? spec : spec.$regex;
  const src = raw instanceof RegExp ? raw.source : raw;
  if (typeof src !== 'string') return fail(spec);
  const starts = src.startsWith('^');
  const ends = src.endsWith('$') && !src.endsWith('\\$');
  const body = unescapeRegex(src.slice(starts ? 1 : 0, ends ? -1 : undefined));
  if (body === null || (starts && ends)) return fail(spec);
  const operator = starts ? 'startsWith' : ends ? 'endsWith' : 'contains';
  if (!negate) return { kind: 'rule', field, operator, value: body };
  return operator === 'contains' ? { kind: 'rule', field, operator: 'notContains', value: body } : negated({ kind: 'rule', field, operator, value: body });
}

function decodeField(field: string, cond: unknown, fields: Fields): QueryNode[] {
  const def = fields[field];
  const c = (v: unknown) => coerceScalar(def, v);
  if (!isPlainObject(cond) || !Object.keys(cond).some((k) => k.startsWith('$'))) {
    if (cond instanceof RegExp) return [decodeRegex(field, cond, false)];
    return [cond === null ? { kind: 'rule', field, operator: 'isNull' } : { kind: 'rule', field, operator: 'eq', value: c(cond) }];
  }
  const out: QueryNode[] = [];
  const keys = new Set(Object.keys(cond));
  if (keys.has('$gte') && keys.has('$lte')) {
    out.push({ kind: 'rule', field, operator: 'between', value: [c(cond.$gte), c(cond.$lte)] });
    keys.delete('$gte');
    keys.delete('$lte');
  }
  if (keys.has('$regex')) {
    out.push(decodeRegex(field, cond, false));
    keys.delete('$regex');
    keys.delete('$options');
  }
  for (const k of keys) {
    const v = cond[k];
    if (k in CMP_BACK) {
      const operator = CMP_BACK[k]!;
      if (v === null && (operator === 'eq' || operator === 'neq')) out.push({ kind: 'rule', field, operator: operator === 'eq' ? 'isNull' : 'isNotNull' });
      else out.push({ kind: 'rule', field, operator, value: c(v) });
    } else if (k === '$in' || k === '$nin') {
      if (!Array.isArray(v)) fail(cond);
      out.push({ kind: 'rule', field, operator: k === '$in' ? 'in' : 'notIn', value: (v as unknown[]).map(c) });
    } else if (k === '$not') {
      if (isPlainObject(v) && '$gte' in v && '$lte' in v && Object.keys(v).length === 2) {
        out.push({ kind: 'rule', field, operator: 'notBetween', value: [c(v.$gte), c(v.$lte)] });
      } else if (v instanceof RegExp || (isPlainObject(v) && '$regex' in v)) {
        out.push(decodeRegex(field, v, true));
      } else {
        const inner = decodeField(field, v, fields);
        out.push(group('and', inner, true));
      }
    } else fail({ [field]: cond });
  }
  return out;
}

function decodeExpr(expr: unknown): QueryNode {
  if (!isPlainObject(expr)) return fail(expr);
  const [op, args] = Object.entries(expr)[0] ?? [];
  const operator = op ? CMP_BACK[op] : undefined;
  if (!operator || !Array.isArray(args) || args.length !== 2) return fail(expr);
  const [a, b] = args;
  if (typeof a !== 'string' || typeof b !== 'string' || !a.startsWith('$') || !b.startsWith('$')) return fail(expr);
  return { kind: 'rule', field: a.slice(1), operator, ref: b.slice(1) };
}

/** Conditions in one filter document; sibling keys are implicitly ANDed. */
function decodeFilter(filter: unknown, fields: Fields): QueryNode[] {
  if (!isPlainObject(filter)) return fail(filter);
  const out: QueryNode[] = [];
  for (const [k, v] of Object.entries(filter)) {
    if (k === '$and' || k === '$or') {
      if (!Array.isArray(v)) fail(filter);
      out.push(group(k === '$and' ? 'and' : 'or', (v as unknown[]).map((x) => one(decodeFilter(x, fields)))));
    } else if (k === '$nor') {
      if (!Array.isArray(v)) fail(filter);
      const arr = v as unknown[];
      const onlyAnd = arr.length === 1 && isPlainObject(arr[0]) && Object.keys(arr[0]).length === 1 && Array.isArray(arr[0].$and);
      if (onlyAnd) out.push(group('and', ((arr[0] as Record<string, unknown>).$and as unknown[]).map((x) => one(decodeFilter(x, fields))), true));
      else out.push(group('or', arr.map((x) => one(decodeFilter(x, fields))), true));
    } else if (k === '$expr') out.push(decodeExpr(v));
    else if (k.startsWith('$')) fail(filter);
    else out.push(...decodeField(k, v, fields));
  }
  return out;
}

/** A list of implicitly-ANDed conditions as a single node. */
const one = (nodes: QueryNode[]): QueryNode => (nodes.length === 1 ? nodes[0]! : group('and', nodes));

function decode(filter: MongoFilter, fields: Fields): Query {
  const nodes = decodeFilter(filter, fields);
  if (nodes.length === 1 && nodes[0]!.kind === 'group') return nodes[0] as Group;
  return group('and', nodes);
}

/**
 * MongoDB query filters. Incomplete rules are left out. Regex operators are case-insensitive unless
 * the field sets `caseSensitive`; dates stay ISO strings (convert them yourself if you store Dates).
 */
export const mongo: Format<MongoFilter, MongoFilter> = {
  name: 'mongo',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx.fields),
  encodeGroup: (g, children) => encodeGroup(g, children),
  finish: (root) => root ?? {},
  decode: (filter, ctx) => decode(filter, ctx.fields),
};
