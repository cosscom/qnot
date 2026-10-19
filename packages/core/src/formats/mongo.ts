import type { CodecContext, Format } from '../codec';
import type { AnyFieldDef, Fields } from '../fields';
import type { ComparableOp } from '../operators';
import { elementFields } from '../scope';
import type { Group, Quantifier, Query, QueryNode, Rule } from '../types';
import {
  coerceScalar,
  columnOf,
  decodeCallByShape,
  encodeCall,
  encodeIn,
  escapeRegex,
  group,
  groupScope,
  infoOf,
  isArrayGroupIn,
  isCompleteRule,
  ruleProblem,
  isFnCall,
  caseCondition,
  finishRoot,
  liftChildren,
  negated,
  ruleDef,
  Unsupported,
  unsupportedReason,
  type EmptyQueryMode,
  type FnCall,
  type Operand,
  type UnsupportedMode,
} from './_util';

export interface MongoOptions {
  /** A valid rule with no Mongo form (a function or custom operator without a mongo format): `throw` (default) or `skip`. */
  unsupported?: UnsupportedMode;
  /** Output for a query with no rules: `{}` (`all`, default), a never-matching filter (`none`), or `throw`. */
  emptyQuery?: EmptyQueryMode;
}

interface Env {
  readonly codec: Format<MongoFilter, MongoNode>;
  readonly unsupported: UnsupportedMode;
}

/** A MongoDB query filter document. */
export type MongoFilter = { readonly [key: string]: unknown };

/**
 * Per-node output: the query-filter form (`f`) and the aggregation-expression form (`x`, used by
 * `$expr`, count quantifiers and `$switch`). Either can be missing when a rule has no such form.
 */
export interface MongoNode {
  readonly f: MongoFilter | undefined;
  readonly x: unknown;
}

interface MongoContext extends CodecContext {
  /** Prefix for field paths in expressions: `$` at the top level, `$$e1.` inside array elements. */
  readonly prefix?: string;
  readonly depth?: number;
}

const CMP: Record<ComparableOp, string> = { eq: '$eq', neq: '$ne', lt: '$lt', lte: '$lte', gt: '$gt', gte: '$gte' };
const CMP_BACK = Object.fromEntries(Object.entries(CMP).map(([k, v]) => [v, k])) as Record<string, ComparableOp>;
const isArrayKind = (def: AnyFieldDef | undefined) => def?.kind === 'multiEnum' || def?.kind === 'array';

/** A literal inside an aggregation expression; strings starting with `$` would read as paths. */
const lit = (v: unknown) => ((typeof v === 'string' && v.startsWith('$')) || (typeof v === 'object' && v !== null) ? { $literal: v } : v);

function encodeExprOperand(ctx: MongoContext) {
  const prefix = ctx.prefix ?? '$';
  return function operand(o: Operand): unknown {
    if (isFnCall(o)) return encodeCall('mongo', ctx.fields, o, operand);
    return 'ref' in o ? `${prefix}${columnOf(ctx.fields, o.ref)}` : lit(o.value);
  };
}

/** Aggregation-expression form of a rule. */
function exprRule(rule: Rule, ctx: MongoContext): unknown {
  const operand = encodeExprOperand(ctx);
  const l = isFnCall(rule.field) ? operand(rule.field) : operand({ ref: rule.field });
  if (l === undefined) return undefined;
  const def = ruleDef(ctx.fields, rule);
  const op = rule.operator;
  const v = rule.value;
  const orNull = { $ifNull: [l, null] };
  const notNull = { $gt: [l, null] };
  const asArray = { $ifNull: [l, []] };
  const regex = (pattern: string) => ({ $regexMatch: def?.caseSensitive ? { input: { $ifNull: [l, ''] }, regex: pattern } : { input: { $ifNull: [l, ''] }, regex: pattern, options: 'i' } });
  const cmp = (o: ComparableOp, r: unknown) => (o === 'lt' || o === 'lte' ? { $and: [notNull, { [CMP[o]]: [l, r] }] } : { [CMP[o]]: [l, r] });

  if (rule.ref !== undefined || rule.call !== undefined) {
    const r = rule.ref !== undefined ? operand({ ref: rule.ref }) : operand(rule.call!);
    return r === undefined ? undefined : cmp(op as ComparableOp, r);
  }
  switch (op) {
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return cmp(op, lit(v ?? null));
    case 'isNull':
      return { $eq: [orNull, null] };
    case 'isNotNull':
      return { $ne: [orNull, null] };
    case 'isEmpty':
      return { $in: [orNull, [null, isArrayKind(def) ? { $literal: [] } : '']] };
    case 'isNotEmpty':
      return { $not: [{ $in: [orNull, [null, isArrayKind(def) ? { $literal: [] } : '']] }] };
    case 'in':
      return { $in: [l, lit(v)] };
    case 'notIn':
      return { $not: [{ $in: [l, lit(v)] }] };
    case 'between':
    case 'notBetween': {
      const [lo, hi] = v as [unknown, unknown];
      return op === 'between' ? { $and: [{ $gte: [l, lit(lo)] }, { $lte: [l, lit(hi)] }] } : { $and: [notNull, { $or: [{ $lt: [l, lit(lo)] }, { $gt: [l, lit(hi)] }] }] };
    }
    case 'contains':
      return regex(escapeRegex(String(v)));
    case 'notContains':
      return { $not: [regex(escapeRegex(String(v)))] };
    case 'startsWith':
      return regex(`^${escapeRegex(String(v))}`);
    case 'endsWith':
      return regex(`${escapeRegex(String(v))}$`);
    case 'hasAny':
      return { $gt: [{ $size: { $setIntersection: [asArray, lit(v)] } }, 0] };
    case 'hasNone':
      return { $eq: [{ $size: { $setIntersection: [asArray, lit(v)] } }, 0] };
    case 'hasAll':
      return { $setIsSubset: [lit(v), asArray] };
    case 'setEq':
      return { $setEquals: [asArray, lit(v)] };
    case 'setNeq':
      return { $not: [{ $setEquals: [asArray, lit(v)] }] };
  }
  return undefined;
}

/** Query-filter form of a rule; undefined when only an `$expr` can express it. */
function filterRule(rule: Rule, ctx: MongoContext): MongoFilter | undefined {
  if (isFnCall(rule.field) || rule.call !== undefined || rule.ref !== undefined) return undefined;
  const f = columnOf(ctx.fields, rule.field);
  const def = ruleDef(ctx.fields, rule);
  const info = infoOf(ctx.fields, rule.operator);
  const v = rule.value;
  if (info.formats?.mongo) return info.formats.mongo({ field: f, value: v, raw: v }) as MongoFilter;
  const regex = (pattern: string) => (def?.caseSensitive ? { $regex: pattern } : { $regex: pattern, $options: 'i' });
  const empty = [null, isArrayKind(def) ? [] : ''];
  switch (rule.operator) {
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return { [f]: { [CMP[rule.operator]]: v ?? null } };
    case 'isNull':
      return { [f]: { $eq: null } };
    case 'isNotNull':
      return { [f]: { $ne: null } };
    case 'isEmpty':
      return { [f]: { $in: empty } };
    case 'isNotEmpty':
      return { [f]: { $nin: empty } };
    case 'in':
    case 'hasAny':
      return { [f]: { $in: v } };
    case 'notIn':
    case 'hasNone':
      return { [f]: { $nin: v } };
    case 'hasAll':
      return { [f]: { $all: v } };
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
  return undefined;
}

function encodeRule(rule: Rule, ctx: MongoContext): MongoNode | Unsupported | undefined {
  const problem = ruleProblem(ctx.fields, rule);
  if (problem === 'incomplete') return undefined;
  if (problem) return problem;
  const x = infoOf(ctx.fields, rule.operator).formats?.mongo ? undefined : exprRule(rule, ctx);
  const f = filterRule(rule, ctx) ?? (x === undefined ? undefined : { $expr: x });
  return f === undefined && x === undefined ? new Unsupported(rule, unsupportedReason('mongo', ctx.fields, rule)) : { f, x };
}

const joinFilters = (g: Pick<Group, 'combinator'>, fs: MongoFilter[]): MongoFilter => ({ [g.combinator === 'and' ? '$and' : '$or']: fs });
const joinExprs = (g: Pick<Group, 'combinator'>, xs: unknown[]): unknown => ({ [g.combinator === 'and' ? '$and' : '$or']: xs });
const usesExpr = (f: MongoFilter) => JSON.stringify(f).includes('"$expr"');

function countExpr(path: string, as: string, cond: unknown, match: Quantifier): unknown {
  const input = { $ifNull: [path, []] };
  const size = { $size: { $filter: { input, as, cond } } };
  if (match === 'some') return { $gt: [size, 0] };
  if (match === 'none') return { $eq: [size, 0] };
  if (match === 'all') return { $eq: [size, { $size: input }] };
  if (match.count === 'between') return { $and: [{ $gte: [size, match.value[0]] }, { $lte: [size, match.value[1]] }] };
  return { [CMP[match.count]]: [size, match.value] };
}

function arrayGroup(g: Group, ctx: MongoContext, env: Env): MongoNode | Unsupported | undefined {
  if (!isArrayGroupIn(ctx.fields, g)) return undefined;
  const depth = (ctx.depth ?? 0) + 1;
  const as = `e${depth}`;
  const lifted = liftChildren<MongoNode>(g, encodeIn(env.codec, g.children, { fields: groupScope(ctx.fields, g), prefix: `$$${as}.`, depth } satisfies MongoContext), env.unsupported);
  if ('bad' in lifted) return lifted.bad;
  const kids = lifted.kids;
  const col = columnOf(ctx.fields, g.of!.field);
  const match = g.of!.match;
  const xs = kids.map((k) => k.x);
  const x = xs.every((e) => e !== undefined) ? countExpr(`${ctx.prefix ?? '$'}${col}`, as, kids.length ? (kids.length === 1 ? xs[0] : joinExprs(g, xs)) : true, match) : undefined;
  const fs = kids.map((k) => k.f);
  let f: MongoFilter | undefined;
  if (kids.length && typeof match === 'string' && fs.every((e): e is MongoFilter => e !== undefined && !usesExpr(e))) {
    const inner = fs.length === 1 ? fs[0]! : joinFilters(g, fs);
    if (match === 'some') f = { [col]: { $elemMatch: inner } };
    else if (match === 'none') f = { [col]: { $not: { $elemMatch: inner } } };
    else f = { [col]: { $not: { $elemMatch: { $nor: [inner] } } } };
  } else if (x !== undefined) f = { $expr: x };
  if (f === undefined) return new Unsupported(g, 'counting needs every element condition as an aggregation expression, and a custom operator here has only a filter format');
  return g.not ? { f: { $nor: [f] }, x: x === undefined ? undefined : { $not: [x] } } : { f, x };
}

function encodeGroup(g: Group, all: MongoNode[], ctx: MongoContext, env: Env): MongoNode | Unsupported | undefined {
  if (g.of) return arrayGroup(g, ctx, env);
  const lifted = liftChildren<MongoNode>(g, all, env.unsupported);
  if ('bad' in lifted) return lifted.bad;
  const children = lifted.kids;
  if (!children.length) return undefined;
  const fs = children.map((c) => c.f).filter((f): f is MongoFilter => f !== undefined);
  const xs = children.map((c) => c.x);
  const x = xs.every((e) => e !== undefined) ? joinExprs(g, xs) : undefined;
  if (fs.length !== children.length) return x === undefined ? undefined : { f: { $expr: g.not ? { $not: [x] } : x }, x: g.not ? { $not: [x] } : x };
  // NOT (a OR b) is $nor: [a, b]; NOT (a AND b) is $nor: [{ $and: [a, b] }].
  const f = !g.not ? joinFilters(g, fs) : g.combinator === 'or' ? { $nor: fs } : { $nor: [{ $and: fs }] };
  return { f, x: x === undefined ? undefined : g.not ? { $not: [x] } : x };
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

function regexRule(field: string | FnCall, src: unknown, negate: boolean): QueryNode {
  if (typeof src !== 'string') return fail(src);
  const starts = src.startsWith('^');
  const ends = src.endsWith('$') && !src.endsWith('\\$');
  const body = unescapeRegex(src.slice(starts ? 1 : 0, ends ? -1 : undefined));
  if (body === null || (starts && ends)) return fail(src);
  const operator = starts ? 'startsWith' : ends ? 'endsWith' : 'contains';
  if (!negate) return { kind: 'rule', field, operator, value: body };
  return operator === 'contains' ? { kind: 'rule', field, operator: 'notContains', value: body } : negated({ kind: 'rule', field, operator, value: body });
}

function decodeRegex(field: string, spec: unknown, negate: boolean): QueryNode {
  const raw = spec instanceof RegExp || !isPlainObject(spec) ? spec : spec.$regex;
  return regexRule(field, raw instanceof RegExp ? raw.source : raw, negate);
}

const isEmptyList = (v: unknown) => Array.isArray(v) && v.length === 2 && v[0] === null && (v[1] === '' || (Array.isArray(v[1]) && v[1].length === 0));

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
  const multi = def?.kind === 'multiEnum';
  for (const k of keys) {
    const v = cond[k];
    if (k in CMP_BACK) {
      const operator = CMP_BACK[k]!;
      if (v === null && (operator === 'eq' || operator === 'neq')) out.push({ kind: 'rule', field, operator: operator === 'eq' ? 'isNull' : 'isNotNull' });
      else out.push({ kind: 'rule', field, operator, value: c(v) });
    } else if (k === '$in' || k === '$nin') {
      if (!Array.isArray(v)) fail(cond);
      if (isEmptyList(v)) out.push({ kind: 'rule', field, operator: k === '$in' ? 'isEmpty' : 'isNotEmpty' });
      else out.push({ kind: 'rule', field, operator: k === '$in' ? (multi ? 'hasAny' : 'in') : multi ? 'hasNone' : 'notIn', value: (v as unknown[]).map(c) });
    } else if (k === '$all') {
      if (!Array.isArray(v)) fail(cond);
      out.push({ kind: 'rule', field, operator: 'hasAll', value: (v as unknown[]).map(c) });
    } else if (k === '$elemMatch') {
      out.push(arrayGroupFromFilter(field, 'some', v, fields));
    } else if (k === '$not') {
      if (isPlainObject(v) && '$gte' in v && '$lte' in v && Object.keys(v).length === 2) {
        out.push({ kind: 'rule', field, operator: 'notBetween', value: [c(v.$gte), c(v.$lte)] });
      } else if (v instanceof RegExp || (isPlainObject(v) && '$regex' in v)) {
        out.push(decodeRegex(field, v, true));
      } else if (isPlainObject(v) && '$elemMatch' in v && Object.keys(v).length === 1) {
        const inner = v.$elemMatch;
        const nor = isPlainObject(inner) && Object.keys(inner).length === 1 && Array.isArray(inner.$nor) && inner.$nor.length === 1 ? inner.$nor[0] : undefined;
        out.push(nor === undefined ? arrayGroupFromFilter(field, 'none', inner, fields) : arrayGroupFromFilter(field, 'all', nor, fields));
      } else {
        out.push(group('and', decodeField(field, v, fields), true));
      }
    } else fail({ [field]: cond });
  }
  return out;
}

function arrayGroupFromFilter(field: string, match: 'some' | 'none' | 'all', inner: unknown, fields: Fields): Group {
  const scope = elementFields(fields, field);
  const nodes = decodeFilter(inner, scope);
  const single = nodes.length === 1 ? nodes[0]! : undefined;
  // A lone AND/OR group inside $elemMatch is the array group's own combinator.
  const g = single && single.kind === 'group' && !single.not && !single.of ? single : group('and', nodes);
  return { kind: 'group', combinator: g.combinator, of: { field, match }, children: g.children };
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
      else if (arr.length === 1) out.push(negate(one(decodeFilter(arr[0], fields))));
      else out.push(group('or', arr.map((x) => one(decodeFilter(x, fields))), true));
    } else if (k === '$expr') out.push(decodeExpr(v, fields, '$'));
    else if (k.startsWith('$')) fail(filter);
    else {
      const field = fieldForPath(fields, k);
      out.push(...decodeField(field, v, fields));
    }
  }
  return out;
}

function negate(n: QueryNode): QueryNode {
  if (n.kind !== 'group') return negated(n);
  const { not, ...rest } = n;
  return not ? rest : { ...rest, not: true };
}

const fieldForPath = (fields: Fields, path: string) => Object.keys(fields).find((name) => columnOf(fields, name) === path) ?? path;

/** A list of implicitly-ANDed conditions as a single node. */
const one = (nodes: QueryNode[]): QueryNode => (nodes.length === 1 ? nodes[0]! : group('and', nodes));

// --- aggregation expressions ($expr, count quantifiers) ----------------------------------------

type Side = { k: 'field'; field: string | FnCall } | { k: 'lit'; v: unknown } | { k: 'call'; call: FnCall };

function decodeSide(x: unknown, fields: Fields, prefix: string): Side {
  if (typeof x === 'string' && x.startsWith(prefix) && !x.startsWith('$$NOW')) return { k: 'field', field: fieldForPath(fields, x.slice(prefix.length)) };
  if (isPlainObject(x) && '$ifNull' in x && Array.isArray(x.$ifNull)) return decodeSide(x.$ifNull[0], fields, prefix);
  if (isPlainObject(x) && '$literal' in x) return { k: 'lit', v: x.$literal };
  const call = decodeCallByShape('mongo', fields, x, (arg) => {
    const s = decodeSide(arg, fields, prefix);
    return s.k === 'lit' ? { value: s.v } : s.k === 'call' ? s.call : typeof s.field === 'string' ? { ref: s.field } : s.field;
  });
  if (call) return { k: 'call', call };
  if (typeof x === 'string' && x.startsWith('$')) return fail(x);
  if (isPlainObject(x)) return fail(x);
  return { k: 'lit', v: x };
}

const leftOf = (s: Side): string | FnCall => (s.k === 'field' ? s.field : s.k === 'call' ? s.call : fail(s));

/** `{ $size: { $filter: { input: { $ifNull: [path, []] }, as, cond } } }` → the array field, var and cond. */
function sizeOfFilter(x: unknown, prefix: string): { path: string; as: string; cond: unknown } | undefined {
  if (!isPlainObject(x) || !isPlainObject(x.$size) || !isPlainObject(x.$size.$filter)) return undefined;
  const { input, as, cond } = x.$size.$filter as Record<string, unknown>;
  const src = isPlainObject(input) && Array.isArray(input.$ifNull) ? input.$ifNull[0] : input;
  if (typeof src !== 'string' || !src.startsWith(prefix) || typeof as !== 'string') return undefined;
  return { path: src.slice(prefix.length), as, cond };
}

function decodeExpr(x: unknown, fields: Fields, prefix: string): QueryNode {
  if (!isPlainObject(x)) return fail(x);
  const entries = Object.entries(x);
  if (entries.length !== 1) return fail(x);
  const [op, args] = entries[0]!;
  const list = Array.isArray(args) ? args : [args];

  if (op === '$and' || op === '$or') {
    // Drop the `{ $gt: [x, null] }` null guards the encoder adds around lt/lte/notBetween.
    const items = list.filter((a) => !(isPlainObject(a) && Array.isArray(a.$gt) && a.$gt.length === 2 && a.$gt[1] === null));
    if (op === '$and') {
      if (items.length === 1 && items.length !== list.length) return decodeExpr(items[0], fields, prefix);
      const special = items.length === 2 ? (countBetween(items, fields, prefix) ?? asBetween(items, fields, prefix)) : undefined;
      if (special) return special;
    } else {
      const special = items.length === 2 ? asNotBetween(items, fields, prefix) : undefined;
      if (special) return special;
    }
    return group(op === '$and' ? 'and' : 'or', items.map((a) => decodeExpr(a, fields, prefix)));
  }
  if (op === '$not') {
    const inner = decodeExpr(list[0], fields, prefix);
    if (inner.kind === 'rule') {
      const flip: Record<string, string> = { in: 'notIn', contains: 'notContains', setEq: 'setNeq', isEmpty: 'isNotEmpty' };
      if (flip[inner.operator]) return { ...inner, operator: flip[inner.operator]! };
    }
    return negate(inner);
  }
  if (op === '$regexMatch' && isPlainObject(args)) {
    return regexRule(leftOf(decodeSide(args.input, fields, prefix)), args.regex, false);
  }
  if (op === '$setEquals' || op === '$setIsSubset') {
    const [a, b] = list;
    if (op === '$setEquals') return { kind: 'rule', field: leftOf(decodeSide(a, fields, prefix)), operator: 'setEq', value: (decodeSide(b, fields, prefix) as { v: unknown }).v };
    return { kind: 'rule', field: leftOf(decodeSide(b, fields, prefix)), operator: 'hasAll', value: (decodeSide(a, fields, prefix) as { v: unknown }).v };
  }
  if (op === '$in') {
    const [a, b] = list;
    const side = decodeSide(a, fields, prefix);
    const values = (decodeSide(b, fields, prefix) as { v: unknown }).v;
    if (isEmptyList(Array.isArray(b) ? b.map((e) => (isPlainObject(e) && '$literal' in e ? e.$literal : e)) : values)) return { kind: 'rule', field: leftOf(side), operator: 'isEmpty' };
    return { kind: 'rule', field: leftOf(side), operator: 'in', value: Array.isArray(b) ? b : values };
  }
  if (op in CMP_BACK) {
    const [a, b] = list;
    // Count quantifiers over an array field.
    const sized = sizeOfFilter(a, prefix);
    if (sized) return quantified(sized, op, b, fields, prefix);
    // multiEnum intersections: { $gt|$eq: [{ $size: { $setIntersection: [arr, list] } }, 0] }
    if (isPlainObject(a) && isPlainObject(a.$size) && Array.isArray(a.$size.$setIntersection) && b === 0) {
      const [arr, vals] = a.$size.$setIntersection as unknown[];
      return { kind: 'rule', field: leftOf(decodeSide(arr, fields, prefix)), operator: op === '$gt' ? 'hasAny' : 'hasNone', value: (decodeSide(vals, fields, prefix) as { v: unknown }).v };
    }
    const operator = CMP_BACK[op]!;
    const l = decodeSide(a, fields, prefix);
    const r = decodeSide(b, fields, prefix);
    const field = leftOf(l);
    if (r.k === 'field') {
      if (typeof r.field !== 'string') return fail(x);
      return { kind: 'rule', field, operator, ref: r.field };
    }
    if (r.k === 'call') return { kind: 'rule', field, operator, call: r.call };
    if (r.v === null && (operator === 'eq' || operator === 'neq')) return { kind: 'rule', field, operator: operator === 'eq' ? 'isNull' : 'isNotNull' };
    return { kind: 'rule', field, operator, value: r.v };
  }
  return fail(x);
}

function asBetween(items: unknown[], fields: Fields, prefix: string): QueryNode | undefined {
  const [a, b] = items.map((i) => (isPlainObject(i) ? i : {}));
  if (!a || !b || !Array.isArray(a.$gte) || !Array.isArray(b.$lte) || JSON.stringify(a.$gte[0]) !== JSON.stringify(b.$lte[0])) return undefined;
  const side = decodeSide(a.$gte[0], fields, prefix);
  return { kind: 'rule', field: leftOf(side), operator: 'between', value: [(decodeSide(a.$gte[1], fields, prefix) as { v: unknown }).v, (decodeSide(b.$lte[1], fields, prefix) as { v: unknown }).v] };
}

function asNotBetween(items: unknown[], fields: Fields, prefix: string): QueryNode | undefined {
  const [a, b] = items.map((i) => (isPlainObject(i) ? i : {}));
  if (!a || !b || !Array.isArray(a.$lt) || !Array.isArray(b.$gt) || JSON.stringify(a.$lt[0]) !== JSON.stringify(b.$gt[0])) return undefined;
  const side = decodeSide(a.$lt[0], fields, prefix);
  return { kind: 'rule', field: leftOf(side), operator: 'notBetween', value: [(decodeSide(a.$lt[1], fields, prefix) as { v: unknown }).v, (decodeSide(b.$gt[1], fields, prefix) as { v: unknown }).v] };
}

function countBetween(items: unknown[], fields: Fields, prefix: string): QueryNode | undefined {
  const [a, b] = items.map((i) => (isPlainObject(i) ? i : {}));
  if (!a || !b || !Array.isArray(a.$gte) || !Array.isArray(b.$lte)) return undefined;
  const sized = sizeOfFilter(a.$gte[0], prefix);
  if (!sized || JSON.stringify(a.$gte[0]) !== JSON.stringify(b.$lte[0])) return undefined;
  return arrayFromCond(sized, { count: 'between', value: [a.$gte[1] as number, b.$lte[1] as number] }, fields);
}

function quantified(sized: { path: string; as: string; cond: unknown }, op: string, n: unknown, fields: Fields, prefix: string): QueryNode {
  let match: Quantifier;
  if (op === '$gt' && n === 0) match = 'some';
  else if (op === '$eq' && n === 0) match = 'none';
  else if (op === '$eq' && isPlainObject(n) && '$size' in n) match = 'all';
  else if (typeof n === 'number') match = { count: CMP_BACK[op]!, value: n };
  else return fail(n);
  return arrayFromCond(sized, match, fields);
}

function arrayFromCond(sized: { path: string; as: string; cond: unknown }, match: Quantifier, fields: Fields): QueryNode {
  const field = fieldForPath(fields, sized.path);
  const scope = elementFields(fields, field);
  if (sized.cond === true) return { kind: 'group', combinator: 'and', of: { field, match }, children: [] };
  const inner = decodeExpr(sized.cond, scope, `$$${sized.as}.`);
  const g = inner.kind === 'group' && !inner.not && !inner.of ? inner : group('and', [inner]);
  return { kind: 'group', combinator: g.combinator, of: { field, match }, children: g.children };
}

function decode(filter: MongoFilter, fields: Fields): Query {
  const nodes = decodeFilter(filter, fields);
  if (nodes.length === 1 && nodes[0]!.kind === 'group' && !nodes[0]!.of) return nodes[0] as Group;
  return group('and', nodes);
}

/**
 * MongoDB query filters. Incomplete rules are left out; a valid rule with no Mongo form throws
 * unless `unsupported: 'skip'`. Regex operators are case-insensitive unless the field sets
 * `caseSensitive`; dates/times stay ISO strings (convert them yourself if you store BSON Dates).
 * Function calls, field refs and count quantifiers use `$expr`.
 */
export function mongoFormat(options: MongoOptions = {}): Format<MongoFilter, MongoNode> {
  const modes = { unsupported: options.unsupported ?? 'throw', emptyQuery: options.emptyQuery ?? 'all' } as const;
  const codec: Format<MongoFilter, MongoNode> = {
    name: 'mongo',
    // Unsupported markers travel as nodes until a group or `finish` resolves them.
    encodeRule: (rule, ctx) => encodeRule(rule, ctx) as MongoNode | undefined,
    encodeGroup: (g, children, ctx) => encodeGroup(g, children, ctx, env) as MongoNode | undefined,
    finish: (root) => finishRoot('mongo', root, modes, { all: () => ({}), none: () => ({ _id: { $exists: false } }), some: (r) => r.f ?? { $expr: r.x } }),
    decode: (filter, ctx) => decode(filter, ctx.fields),
    encodeCases(whens, otherwise) {
      const branches = whens.map(({ when, then }) => {
        const c = caseCondition('mongo', when);
        if (c && c.x === undefined) throw new Error('trawlnet/mongo: a case uses an operator with no aggregation-expression form');
        return { case: c?.x ?? true, then: lit(then) };
      });
      return { $switch: otherwise === undefined ? { branches } : { branches, default: lit(otherwise) } };
    },
  };
  const env: Env = { codec, unsupported: modes.unsupported };
  return codec;
}

/** MongoDB filters with the default options (throws on unsupported rules). */
export const mongo = mongoFormat();
