// Helpers shared by the format codecs. Not part of the public API.
import type { Codec, CodecContext } from '../codec';
import { columnOf, fieldDef, registryOf, type AnyFieldDef, type Fields } from '../fields';
import { functionOf, isFnCall, type FnCall, type Operand } from '../functions';
import { operatorInfo } from '../operators';
import { ruleDef } from '../scope';
import type { Group, QueryNode, Rule } from '../types';
import { groupScope, validateGroup, validateRule } from '../validate';

export { columnOf, groupScope, isFnCall, operatorInfo, ruleDef };
export type { FnCall, Operand };

export const isCompleteRule = (fields: Fields, rule: Rule): boolean => validateRule(fields, rule).length === 0;

/**
 * What an export codec should do with a rule: encode it (undefined), leave it out because it's only
 * missing a value ('incomplete'), or refuse it because a value is present but wrong (an Unsupported
 * marker, so `unsupported: 'throw'` names it and a tampered query never silently widens).
 */
export function ruleProblem(fields: Fields, rule: Rule): 'incomplete' | Unsupported | undefined {
  const errors = validateRule(fields, rule).filter((i) => i.severity === 'error');
  if (!errors.length) return undefined;
  if (errors.every((i) => i.code === 'required')) return 'incomplete';
  return new Unsupported(rule, `invalid rule (${errors.map((e) => e.message).join('; ')})`);
}

/** An Unsupported marker for a group whose shape is invalid (bad combinator, NOT flag, list quantifier). */
export function groupProblem(fields: Fields, g: Group): Unsupported | undefined {
  const errors = validateGroup(fields, g).filter((i) => i.severity === 'error');
  return errors.length ? new Unsupported(g, `invalid group (${errors.map((e) => e.message).join('; ')})`) : undefined;
}

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const numeric = /^\s*-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i;

/** Coerce a decoded scalar to the field's value type (string numbers, 'true'/'false', '' → null). */
export function coerceScalar(def: AnyFieldDef | undefined, v: unknown): unknown {
  if (v === undefined) return null;
  if (v === '') return def && def.kind !== 'text' ? null : '';
  if (!def) return v;
  const first = def.options?.[0]?.value;
  const wantsNumber = def.kind === 'number' || ((def.kind === 'enum' || def.kind === 'multiEnum') && typeof first === 'number');
  if (wantsNumber && typeof v === 'string' && numeric.test(v)) return Number(v);
  if (def.kind === 'boolean') {
    if (v === 'true' || v === 1) return true;
    if (v === 'false' || v === 0) return false;
  }
  return v;
}

/** Split a list value that may arrive as an array or a comma-separated string. */
export function toList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v === '' ? [] : v.split(',').map((s) => s.trim());
  return v === null || v === undefined ? [] : [v];
}

export const group = (combinator: 'and' | 'or', children: QueryNode[], not = false): Group =>
  not ? { kind: 'group', combinator, not: true, children } : { kind: 'group', combinator, children };

/** A rule negated by wrapping it in a NOT group (for operators like "does not begin with"). */
export const negated = (rule: Rule): Group => group('and', [rule], true);

/** Operator metadata, falling back to a unary-value description for unknown ids. */
export const infoOf = (fields: Fields, op: string): NonNullable<ReturnType<typeof operatorInfo>> =>
  operatorInfo(fields, op) ?? { arity: 'one', label: op, symbol: op, comparable: false, textMatch: false };

export const isBuiltinOp = (fields: Fields, op: string): boolean => !registryOf(fields).operators.has(op);

// --- function calls ----------------------------------------------------------------------------

/** The raw value a function's format receives for an argument. */
export const rawOperand = (o: Operand): unknown => (isFnCall(o) ? o : 'ref' in o ? o.ref : o.value);

/**
 * Render a call through the function's per-codec format. Returns undefined when the function is
 * unknown, has no format for this codec, or an argument can't be encoded.
 */
export function encodeCall<T>(codec: string, fields: Fields, call: FnCall, encodeArg: (operand: Operand, def: AnyFieldDef) => T | undefined): T | undefined {
  const def = functionOf(fields, call);
  const format = def?.formats?.[codec];
  if (!def || !format) return undefined;
  const encoded: Record<string, unknown> = {};
  const raw: Record<string, unknown> = {};
  for (const [name, argDef] of Object.entries(def.args)) {
    const a = call.args[name];
    if (a === undefined) continue;
    const e = encodeArg(a, argDef);
    if (e === undefined) return undefined;
    encoded[name] = e;
    raw[name] = rawOperand(a);
  }
  return format(encoded, raw) as T;
}

/** encodeCall for two-way codecs: an unencodable call is an error, not a skipped rule. */
export function encodeCallOrThrow<T>(codec: string, fields: Fields, call: FnCall, encodeArg: (operand: Operand, def: AnyFieldDef) => T | undefined): T {
  const out = encodeCall(codec, fields, call, encodeArg);
  if (out === undefined) {
    const def = functionOf(fields, call);
    throw new Error(
      `qnot/${codec}: ${def ? `function "${call.fn}" has no ${codec} format` : `unknown function "${call.fn}"`} (add formats.${codec} to its defineFunction)`,
    );
  }
  return out;
}

const ARG = Symbol('arg');
type Sentinel = { readonly [ARG]: string };
const isSentinel = (x: unknown): x is Sentinel => typeof x === 'object' && x !== null && ARG in x;

function unify(template: unknown, input: unknown, out: Map<string, unknown>): boolean {
  if (isSentinel(template)) {
    const name = template[ARG];
    if (out.has(name)) return JSON.stringify(out.get(name)) === JSON.stringify(input);
    out.set(name, input);
    return true;
  }
  if (Array.isArray(template)) return Array.isArray(input) && input.length === template.length && template.every((t, i) => unify(t, input[i], out));
  if (typeof template === 'object' && template !== null) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
    const tk = Object.keys(template);
    const ik = Object.keys(input);
    return tk.length === ik.length && tk.every((k) => k in input && unify((template as Record<string, unknown>)[k], (input as Record<string, unknown>)[k], out));
  }
  return template === input;
}

/**
 * Recognize a registered function in a JSON-shaped format (JsonLogic, Mongo) by rendering each
 * function's format with placeholder arguments and matching the result's shape against `input`.
 */
export function decodeCallByShape(codec: string, fields: Fields, input: unknown, decodeArg: (x: unknown, def: AnyFieldDef) => Operand | undefined): FnCall | undefined {
  for (const [fn, def] of Object.entries(registryOf(fields).functions)) {
    const format = def.formats?.[codec];
    if (!format) continue;
    const sentinels = Object.fromEntries(Object.keys(def.args).map((name) => [name, { [ARG]: name } as Sentinel]));
    let template: unknown;
    try {
      template = format(sentinels, sentinels);
    } catch {
      continue;
    }
    if (typeof template === 'string' && Object.keys(def.args).length) continue;
    const bound = new Map<string, unknown>();
    if (!unify(template, input, bound)) continue;
    const args: Record<string, Operand> = {};
    let ok = true;
    for (const [name, value] of bound) {
      const o = decodeArg(value, def.args[name]!);
      if (!o) ok = false;
      else args[name] = o;
    }
    if (ok) return { fn, args };
  }
  return undefined;
}

// --- array groups ------------------------------------------------------------------------------

/**
 * Encode nodes in an explicit scope. Array groups encode their own subtree (the generic encoder
 * only knows the top-level schema), so nested array groups get an empty `children` here.
 */
export function encodeIn<N, C extends CodecContext>(codec: Codec<any, N>, nodes: readonly QueryNode[], ctx: C): N[] {
  const out: N[] = [];
  for (const n of nodes) {
    const e = n.kind === 'rule' ? codec.encodeRule(n, ctx) : codec.encodeGroup(n, n.of ? [] : encodeIn(codec, n.children, ctx), ctx);
    if (e !== undefined) out.push(e);
  }
  return out;
}

/** True when `g` is an array group over a real array field of this scope. */
export const isArrayGroupIn = (fields: Fields, g: Group): boolean => !!g.of && !!fieldDef(fields, g.of.field)?.of;

/** Human/RAQB-style comparison words for count quantifiers. */
export const COUNT_OPS = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;

// --- unsupported rules -------------------------------------------------------------------------

/** What an export codec does with a valid rule it can't express. */
export type UnsupportedMode = 'throw' | 'skip';
/** What an export codec emits for a query with no (expressible) rules. */
export type EmptyQueryMode = 'all' | 'none' | 'throw';

/**
 * Stand-in for a node the codec can't express. Groups lift it to their own level (prepending the
 * child index), so by the time it reaches `finish` it knows its full path.
 */
export class Unsupported {
  constructor(
    readonly subject: Rule | Group,
    readonly reason: string,
    readonly path: readonly number[] = [],
    readonly node: QueryNode = subject,
  ) {}
}

export const isUnsupported = (x: unknown): x is Unsupported => x instanceof Unsupported;

/** Why a rule can't be expressed by `codec`: a function without a format, else the operator. */
export function unsupportedReason(codec: string, fields: Fields, rule: Rule, fallback?: string): string {
  const missing = (call: FnCall): string | undefined => {
    const def = functionOf(fields, call);
    if (!def) return `unknown function "${call.fn}"`;
    if (!def.formats?.[codec]) return `function "${call.fn}" has no ${codec} format`;
    for (const a of Object.values(call.args)) {
      const inner = isFnCall(a) ? missing(a) : undefined;
      if (inner) return inner;
    }
    return undefined;
  };
  const fn = (isFnCall(rule.field) ? missing(rule.field) : undefined) ?? (rule.call ? missing(rule.call) : undefined);
  return fn ?? fallback ?? `operator "${rule.operator}" has no ${codec} format`;
}

/**
 * Split encoded children into usable ones and unsupported markers. In `throw` mode any marker
 * becomes the group's result; in `skip` mode markers are dropped unless nothing else is left.
 */
export function liftChildren<N>(g: Group, children: readonly unknown[], mode: UnsupportedMode): { kids: N[] } | { bad: Unsupported } {
  const bad = children.filter(isUnsupported);
  if (!bad.length) return { kids: children as N[] };
  const first = bad[0]!;
  const lifted = new Unsupported(first.subject, first.reason, [g.children.indexOf(first.node), ...first.path], g);
  if (mode === 'throw') return { bad: lifted };
  const kids = children.filter((c) => !isUnsupported(c)) as N[];
  return kids.length ? { kids } : { bad: lifted };
}

export function unsupportedError(codec: string, u: Unsupported, skippable = true): Error {
  const s = u.subject;
  const what =
    s.kind === 'rule'
      ? `the rule at [${u.path.join(', ')}] (field "${typeof s.field === 'string' ? s.field : `${s.field.fn}()`}", operator "${s.operator}")`
      : `the array group at [${u.path.join(', ')}] (field "${s.of?.field ?? ''}")`;
  const hint = skippable ? ". Pass `unsupported: 'skip'` to drop it instead (this widens the query)" : '';
  return new Error(`qnot/${codec}: can't express ${what}: ${u.reason}${hint}`);
}

/** Resolve the root of an export: an unsupported marker throws, an empty query follows `emptyQuery`. */
export function finishRoot<N, T>(
  codec: string,
  root: N | Unsupported | undefined,
  modes: { unsupported: UnsupportedMode; emptyQuery: EmptyQueryMode },
  outputs: { all: () => T; none: () => T; some: (root: N) => T },
): T {
  if (isUnsupported(root) && modes.unsupported === 'throw') throw unsupportedError(codec, root);
  if (root === undefined || isUnsupported(root)) {
    if (modes.emptyQuery === 'throw') throw new Error(`qnot/${codec}: the query has no rules to export (pass \`emptyQuery: 'all' | 'none'\` to allow it)`);
    return modes.emptyQuery === 'none' ? outputs.none() : outputs.all();
  }
  return outputs.some(root);
}

/** A case condition must be expressible: never let an unsupported condition become "always". */
export function caseCondition<N>(codec: string, when: N | Unsupported | undefined): N | undefined {
  if (isUnsupported(when)) throw unsupportedError(codec, when);
  return when;
}
