// Helpers shared by the format codecs. Not part of the public API.
import type { Codec, CodecContext } from '../codec';
import { columnOf, registryOf, type AnyFieldDef, type Fields } from '../fields';
import { functionOf, isFnCall, type FnCall, type Operand } from '../functions';
import { operatorInfo } from '../operators';
import { ruleDef } from '../scope';
import type { Group, QueryNode, Rule } from '../types';
import { groupScope, validateRule } from '../validate';

export { columnOf, groupScope, isFnCall, operatorInfo, ruleDef };
export type { FnCall, Operand };

export const isCompleteRule = (fields: Fields, rule: Rule): boolean => validateRule(fields, rule).length === 0;

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
      `trawlnet/${codec}: ${def ? `function "${call.fn}" has no ${codec} format` : `unknown function "${call.fn}"`} (add formats.${codec} to its defineFunction)`,
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
export const isArrayGroupIn = (fields: Fields, g: Group): boolean => !!g.of && !!fields[g.of.field]?.of;

/** Human/RAQB-style comparison words for count quantifiers. */
export const COUNT_OPS = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;
