import type { CodecContext, Format } from '../codec';
import type { AnyFieldDef, Fields } from '../fields';
import { registryOf } from '../fields';
import type { ComparableOp } from '../operators';
import { elementFields } from '../scope';
import type { Group, Quantifier, Query, QueryNode, Rule } from '../types';
import { coerceScalar, encodeIn, group, groupScope, infoOf, isFnCall, operatorInfo, ruleDef, type FnCall, type Operand } from './_util';

/** A function call in RAQB's JSON (`valueSrc: 'func'`, or `fieldSrc: 'func'` on the left). */
export interface RAQBFunc {
  func: string;
  args: Record<string, { value: unknown; valueSrc?: 'value' | 'field' | 'func'; valueType?: string }>;
}

/** A rule in react-awesome-query-builder's JSON tree (`Utils.getTree` output). */
export interface RAQBRule {
  id: string;
  type: 'rule';
  properties: {
    field: string | RAQBFunc | null;
    fieldSrc?: 'field' | 'func';
    operator: string | null;
    value: unknown[];
    valueSrc: ('value' | 'field' | 'func' | 'const')[];
    valueType: string[];
    isLocked?: boolean;
    [extra: string]: unknown;
  };
}

/** A group in react-awesome-query-builder's JSON tree. `children1` may be an array or an id map. */
export interface RAQBGroup {
  id: string;
  type: 'group';
  children1?: RAQBNode[] | Record<string, RAQBNode>;
  properties?: { conjunction?: string; not?: boolean; isLocked?: boolean; [extra: string]: unknown };
}

/** An array group (RAQB `!group` field): some / all / none / count of the elements match. */
export interface RAQBRuleGroup {
  id: string;
  type: 'rule_group';
  children1?: RAQBNode[] | Record<string, RAQBNode>;
  properties: {
    field: string;
    mode?: 'array' | 'some' | 'struct';
    conjunction?: string;
    not?: boolean;
    operator?: string | null;
    value?: unknown[];
    valueSrc?: string[];
    valueType?: string[];
    isLocked?: boolean;
    [extra: string]: unknown;
  };
}

export type RAQBNode = RAQBRule | RAQBGroup | RAQBRuleGroup;

interface RaqbContext extends CodecContext {
  /** Path prefix for fields inside array groups: RAQB names them `orders.qty`. */
  readonly prefix?: string;
}

const valueType = (def: AnyFieldDef | undefined): string => {
  switch (def?.kind) {
    case 'text':
    case 'number':
    case 'boolean':
    case 'date':
    case 'time':
    case 'datetime':
      return def.kind;
    case 'enum':
      return 'select';
    case 'multiEnum':
      return 'multiselect';
    default:
      return def?.options ? 'select' : 'text';
  }
};

const TO_RAQB: Record<string, string> = {
  lt: 'less',
  lte: 'less_or_equal',
  gt: 'greater',
  gte: 'greater_or_equal',
  contains: 'like',
  notContains: 'not_like',
  startsWith: 'starts_with',
  endsWith: 'ends_with',
  between: 'between',
  notBetween: 'not_between',
  // RAQB only offers list membership on select fields; non-select fields need it added to the RAQB config.
  in: 'select_any_in',
  notIn: 'select_not_any_in',
  isNull: 'is_null',
  isNotNull: 'is_not_null',
  isEmpty: 'is_empty',
  isNotEmpty: 'is_not_empty',
  hasAny: 'multiselect_contains',
  hasNone: 'multiselect_not_contains',
  setEq: 'multiselect_equals',
  setNeq: 'multiselect_not_equals',
};

function toRaqbOperator(op: string, def: AnyFieldDef | undefined): string {
  const select = valueType(def) === 'select';
  if (op === 'eq') return select ? 'select_equals' : 'equal';
  if (op === 'neq') return select ? 'select_not_equals' : 'not_equal';
  // hasAll and custom operators have no RAQB built-in; they travel under their qnot id.
  return TO_RAQB[op] ?? op;
}

const FROM_RAQB: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TO_RAQB).map(([k, v]) => [v, k])),
  equal: 'eq',
  select_equals: 'eq',
  not_equal: 'neq',
  select_not_equals: 'neq',
};

const COUNT_TO: Record<string, string> = { eq: 'equal', neq: 'not_equal', lt: 'less', lte: 'less_or_equal', gt: 'greater', gte: 'greater_or_equal', between: 'between' };
const COUNT_FROM = Object.fromEntries(Object.entries(COUNT_TO).map(([k, v]) => [v, k])) as Record<string, ComparableOp | 'between'>;

// --- values: RAQB's default formats are `YYYY-MM-DD HH:mm:ss` (UTC here) and `HH:mm:ss` ----------

const pad = (n: number) => String(n).padStart(2, '0');
function toRaqbValue(def: AnyFieldDef | undefined, v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (def?.kind === 'datetime') {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }
  if (def?.kind === 'time' && /^\d\d:\d\d$/.test(v)) return `${v}:00`;
  return v;
}
function fromRaqbValue(def: AnyFieldDef | undefined, v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (def?.kind === 'datetime') {
    const m = /^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)(\.\d+)?$/.exec(v);
    return m ? `${m[1]}T${m[2]}Z` : v;
  }
  if (def?.kind === 'time') return v.replace(/^(\d\d:\d\d):00$/, '$1');
  return v;
}

// --- functions ----------------------------------------------------------------------------------

/** qnot builtinFunctions ↔ RAQB BasicFuncs: name and argument names. */
const FUNC_TO: Record<string, { func: string; args: Record<string, string> }> = {
  lower: { func: 'LOWER', args: { text: 'str' } },
  upper: { func: 'UPPER', args: { text: 'str' } },
  now: { func: 'NOW', args: {} },
  today: { func: 'TODAY', args: {} },
};
const FUNC_FROM = Object.fromEntries(Object.entries(FUNC_TO).map(([fn, m]) => [m.func, { fn, args: Object.fromEntries(Object.entries(m.args).map(([a, b]) => [b, a])) }]));

function encodeFunc(call: FnCall, ctx: RaqbContext): RAQBFunc {
  const def = registryOf(ctx.fields).functions[call.fn];
  const arg = (o: Operand, argDef: AnyFieldDef | undefined) =>
    isFnCall(o)
      ? { value: encodeFunc(o, ctx), valueSrc: 'func' as const, valueType: valueType(argDef) }
      : 'ref' in o
        ? { value: `${ctx.prefix ?? ''}${o.ref}`, valueSrc: 'field' as const, valueType: valueType(argDef) }
        : { value: toRaqbValue(argDef, o.value), valueSrc: 'value' as const, valueType: valueType(argDef) };
  if (call.fn === 'relativeDate') {
    const a = call.args;
    const raw = (o: Operand | undefined) => (o && !isFnCall(o) && 'value' in o ? o.value : undefined);
    return {
      func: 'RELATIVE_DATE',
      args: {
        date: { value: { func: 'TODAY', args: {} }, valueSrc: 'func', valueType: 'date' },
        op: { value: raw(a.direction) === 'from now' ? 'plus' : 'minus', valueSrc: 'value', valueType: 'select' },
        val: { value: raw(a.amount), valueSrc: 'value', valueType: 'number' },
        dim: { value: raw(a.unit), valueSrc: 'value', valueType: 'select' },
      },
    };
  }
  const mapped = FUNC_TO[call.fn];
  const args: RAQBFunc['args'] = {};
  for (const [name, o] of Object.entries(call.args)) args[mapped?.args[name] ?? name] = arg(o, def?.args[name]);
  return { func: mapped?.func ?? call.fn, args };
}

function decodeFunc(f: RAQBFunc, fields: Fields, prefix: string): FnCall {
  const a = f.args ?? {};
  if (f.func === 'RELATIVE_DATE' && (a.date?.value as RAQBFunc | undefined)?.func === 'TODAY') {
    return {
      fn: 'relativeDate',
      args: { amount: { value: a.val?.value }, unit: { value: a.dim?.value }, direction: { value: a.op?.value === 'plus' ? 'from now' : 'ago' } },
    };
  }
  const mapped = FUNC_FROM[f.func];
  const fn = mapped?.fn ?? f.func;
  const def = registryOf(fields).functions[fn];
  const args: Record<string, Operand> = {};
  for (const [name, spec] of Object.entries(a)) {
    const ours = mapped?.args[name] ?? name;
    args[ours] =
      spec.valueSrc === 'func'
        ? decodeFunc(spec.value as RAQBFunc, fields, prefix)
        : spec.valueSrc === 'field'
          ? { ref: stripPrefix(String(spec.value), prefix) }
          : { value: fromRaqbValue(def?.args[ours], spec.value) };
  }
  return { fn, args };
}

const stripPrefix = (name: string, prefix: string) => (prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name);

// RAQB requires ids. They're keyed by node identity so encoding stays pure and memoizable.
const ids = new WeakMap<object, string>();
let nextId = 0;
const idFor = (node: object) => {
  let id = ids.get(node);
  if (!id) ids.set(node, (id = `tn-${(nextId++).toString(36)}`));
  return id;
};

function encodeRule(rule: Rule, ctx: RaqbContext): RAQBRule {
  const { fields } = ctx;
  const prefix = ctx.prefix ?? '';
  const def = ruleDef(fields, rule);
  const type = valueType(def);
  const operator = toRaqbOperator(rule.operator, def);
  const field = isFnCall(rule.field) ? encodeFunc(rule.field, ctx) : `${prefix}${rule.field}`;
  const lock = rule.locked ? { isLocked: true } : {};
  const props = (value: unknown[], valueSrc: RAQBRule['properties']['valueSrc'], valueType: string[]) => ({
    id: idFor(rule),
    type: 'rule' as const,
    properties: { field, ...(isFnCall(rule.field) && { fieldSrc: 'func' as const }), operator, value, valueSrc, valueType, ...lock },
  });
  if (rule.ref !== undefined) return props([`${prefix}${rule.ref}`], ['field'], [type]);
  if (rule.call !== undefined) return props([encodeFunc(rule.call, ctx)], ['func'], [type]);
  const v = rule.value;
  const info = infoOf(fields, rule.operator);
  switch (info.arity) {
    case 'none':
      return props([], [], []);
    case 'two': {
      const [a, b] = Array.isArray(v) ? v : [null, null];
      return props([toRaqbValue(def, a ?? null), toRaqbValue(def, b ?? null)], ['value', 'value'], [type, type]);
    }
    case 'many':
      return props([Array.isArray(v) ? v : []], ['value'], ['multiselect']);
    case 'one':
      return props([toRaqbValue(def, v ?? null)], ['value'], [info.textMatch ? 'text' : type]);
  }
}

function encodeGroup(g: Group, children: RAQBNode[], ctx: RaqbContext): RAQBGroup | RAQBRuleGroup {
  const lock = g.locked ? { isLocked: true } : {};
  if (!g.of) return { id: idFor(g), type: 'group', children1: children, properties: { conjunction: g.combinator.toUpperCase(), not: !!g.not, ...lock } };
  const prefix = ctx.prefix ?? '';
  const field = `${prefix}${g.of.field}`;
  const kids = encodeIn(raqb, g.children, { fields: groupScope(ctx.fields, g), prefix: `${field}.` } satisfies RaqbContext);
  const m = g.of.match;
  const count =
    typeof m === 'string'
      ? { operator: m, value: [], valueSrc: [], valueType: [] }
      : m.count === 'between'
        ? { operator: 'between', value: [...m.value], valueSrc: ['value', 'value'], valueType: ['number', 'number'] }
        : { operator: COUNT_TO[m.count]!, value: [m.value], valueSrc: ['value'], valueType: ['number'] };
  return {
    id: idFor(g),
    type: 'rule_group',
    children1: kids,
    properties: { conjunction: g.combinator.toUpperCase(), not: !!g.not, field, mode: 'array', ...count, ...lock },
  };
}

// --- decode ------------------------------------------------------------------------------------

const fail = (msg: string, what: unknown): never => {
  throw new Error(`qnot/raqb: ${msg}: ${JSON.stringify(what)}`);
};

function decodeRule(r: RAQBRule, fields: Fields, prefix: string): Rule {
  const { field: rawField, operator: raw, value = [], valueSrc = [], isLocked } = r.properties;
  let field: string | FnCall;
  if (typeof rawField === 'string') field = stripPrefix(rawField, prefix);
  else if (rawField && typeof rawField === 'object' && 'func' in rawField) field = decodeFunc(rawField, fields, prefix);
  else return fail('unsupported field', rawField);
  const operator = raw ? (FROM_RAQB[raw] ?? (raw.startsWith('multiselect_') ? undefined : raw)) : undefined;
  if (!operator || !operatorInfo(fields, operator)) return fail('unsupported operator', raw);
  const lock = isLocked ? { locked: true } : {};
  const def = ruleDef(fields, { field });
  if (valueSrc[0] === 'field') return { kind: 'rule', field, operator, ref: stripPrefix(String(value[0]), prefix), ...lock };
  if (valueSrc[0] === 'func') return { kind: 'rule', field, operator, call: decodeFunc(value[0] as RAQBFunc, fields, prefix), ...lock };
  const c = (x: unknown) => coerceScalar(def, fromRaqbValue(def, x));
  const info = infoOf(fields, operator);
  switch (info.arity) {
    case 'none':
      return { kind: 'rule', field, operator, ...lock };
    case 'two':
      return { kind: 'rule', field, operator, value: [c(value[0]), c(value[1])], ...lock };
    case 'many': {
      const list = Array.isArray(value[0]) ? value[0] : value.filter((x) => x !== undefined && x !== null);
      return { kind: 'rule', field, operator, value: list.map(c), ...lock };
    }
    case 'one':
      return { kind: 'rule', field, operator, value: info.textMatch ? (value[0] ?? '') : c(value[0]), ...lock };
  }
}

const kidsOf = (n: RAQBGroup | RAQBRuleGroup) => (Array.isArray(n.children1) ? n.children1 : Object.values(n.children1 ?? {}));

function decodeNode(n: RAQBNode, fields: Fields, prefix: string): QueryNode {
  if (n.type === 'rule') return decodeRule(n, fields, prefix);
  const conj = String(n.properties?.conjunction ?? 'AND').toLowerCase();
  if (conj !== 'and' && conj !== 'or') return fail('unsupported conjunction', conj);
  const lock = n.properties?.isLocked ? { locked: true } : {};
  const not = n.properties?.not ? { not: true } : {};
  if (n.type === 'rule_group') {
    const p = n.properties;
    const field = stripPrefix(p.field, prefix);
    if (p.mode === 'struct') return fail('struct groups are not supported', p.field);
    const op = p.operator ?? 'some';
    let match: Quantifier;
    if (op === 'some' || op === 'all' || op === 'none') match = op;
    else if (op === 'between') match = { count: 'between', value: [Number(p.value?.[0]), Number(p.value?.[1])] };
    else if (COUNT_FROM[op]) match = { count: COUNT_FROM[op] as ComparableOp, value: Number(p.value?.[0]) };
    else return fail('unsupported group operator', op);
    const scope = elementFields(fields, field);
    const children = kidsOf(n).map((k) => decodeNode(k, scope, `${p.field}.`));
    return { kind: 'group', combinator: conj, ...not, of: { field, match }, ...lock, children };
  }
  if (n.type !== 'group') return fail('unsupported node type', (n as { type: unknown }).type);
  return { kind: 'group', combinator: conj, ...not, ...lock, children: kidsOf(n).map((k) => decodeNode(k, fields, prefix)) };
}

/**
 * react-awesome-query-builder's JSON tree (load it with `Utils.loadTree`). Two-way and faithful, so
 * it works as a store `format`. Array groups become `rule_group`s (mode `array`), functions map to
 * RAQB's BasicFuncs where one exists (LOWER, UPPER, NOW, TODAY, RELATIVE_DATE), locks to
 * `isLocked`. Datetimes are written in RAQB's `YYYY-MM-DD HH:mm:ss` format, in UTC.
 */
export const raqb: Format<RAQBGroup, RAQBNode> = {
  name: 'raqb',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx),
  encodeGroup: (g, children, ctx) => encodeGroup(g, children, ctx),
  finish: (root) => root as RAQBGroup,
  decode: (tree, ctx) => {
    const node = decodeNode(tree, ctx.fields, '');
    return node.kind === 'group' && !node.of ? node : group('and', [node]);
  },
};
