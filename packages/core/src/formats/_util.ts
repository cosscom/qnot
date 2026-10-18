// Helpers shared by the format codecs. Not part of the public API.
import type { AnyFieldDef, Fields } from '../fields';
import type { Group, QueryNode, Rule } from '../types';
import { validateRule } from '../validate';

export const isCompleteRule = (fields: Fields, rule: Rule): boolean => validateRule(fields, rule).length === 0;

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const numeric = /^\s*-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i;

/** Coerce a decoded scalar to the field's value type (string numbers, 'true'/'false', '' → null). */
export function coerceScalar(def: AnyFieldDef | undefined, v: unknown): unknown {
  if (v === undefined) return null;
  if (v === '') return def && def.kind !== 'text' ? null : '';
  if (!def) return v;
  const wantsNumber = def.kind === 'number' || (def.kind === 'enum' && typeof def.options?.[0]?.value === 'number');
  if (wantsNumber && typeof v === 'string' && numeric.test(v)) return Number(v);
  if (def.kind === 'boolean' && typeof v === 'string') return v === 'true' ? true : v === 'false' ? false : v;
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
