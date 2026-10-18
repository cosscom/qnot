// Framework-agnostic helpers for building query UIs. Every binding's default components use these,
// so React, Vue, Svelte, Solid and vanilla DOM behave identically.
import { fieldLabel, type AnyFieldDef, type Fields } from './fields';
import { OPERATORS, type Arity, type OperatorId } from './operators';

export type EditorType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'list' | 'none';

export interface EditorSpec {
  /** Which widget to render. `list` is free-form multiple values (comma-separated input). */
  readonly type: EditorType;
  /** How many inputs: none, one, a pair (between), or many. */
  readonly arity: Arity;
  readonly options?: readonly { readonly value: unknown; readonly label: string }[];
  /** Comparable operators can switch between a literal and another field. */
  readonly allowsRef: boolean;
}

const scalarEditor = (def: AnyFieldDef | undefined): EditorType => {
  if (def?.options) return 'select';
  switch (def?.kind) {
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'boolean':
      return 'boolean';
    default:
      return 'text';
  }
};

/** The editor a rule needs for its field and operator. */
export function editorFor(def: AnyFieldDef | undefined, operator: OperatorId): EditorSpec {
  const info = OPERATORS[operator];
  const base = { arity: info.arity, allowsRef: info.comparable, ...(def?.options && { options: def.options }) };
  if (info.arity === 'none') return { ...base, type: 'none' };
  if (info.textMatch) return { ...base, type: 'text' };
  if (info.arity === 'many') return { ...base, type: def?.options ? 'multiselect' : 'list' };
  return { ...base, type: scalarEditor(def) };
}

/** Parse what an `<input>` holds into a value for this field (numbers, booleans, option values). */
export function parseInput(def: AnyFieldDef | undefined, raw: string): unknown {
  if (def?.options) return def.options.find((o) => String(o.value) === raw)?.value ?? null;
  switch (def?.kind) {
    case 'number': {
      if (raw.trim() === '') return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    case 'boolean':
      return raw === 'true';
    case 'date':
      return raw === '' ? null : raw;
    default:
      return raw;
  }
}

/** Format a value for an `<input>`'s value attribute. */
export const formatInput = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/** Parse a comma-separated list for `in`/`notIn` on fields without options. */
export const parseList = (def: AnyFieldDef | undefined, raw: string): unknown[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInput(def, s))
    .filter((v) => v !== null);

export const formatList = (value: unknown): string => (Array.isArray(value) ? value.map(formatInput).join(', ') : '');

export interface Option<V = string> {
  readonly value: V;
  readonly label: string;
}

export const fieldOptions = <F extends Fields>(fields: F): Option<keyof F & string>[] =>
  Object.keys(fields).map((name) => ({ value: name, label: fieldLabel(name, fields[name]) }));

export const operatorOptions = (def: AnyFieldDef | undefined): Option<OperatorId>[] =>
  (def?.operators ?? []).map((op) => ({ value: op, label: OPERATORS[op].label }));

/** Fields a rule on `field` may compare against (same kind, not itself). */
export const refOptions = <F extends Fields>(fields: F, field: string): Option<keyof F & string>[] =>
  fieldOptions(fields).filter((o) => o.value !== field && fields[o.value]?.kind === fields[field]?.kind);

/** Stable class names shared by every binding's default UI (styled by `@trawlnet/core/styles.css`). */
export const CLASS = {
  root: 'tn',
  group: 'tn-group',
  groupHeader: 'tn-group-header',
  children: 'tn-children',
  rule: 'tn-rule',
  handle: 'tn-handle',
  field: 'tn-field',
  operator: 'tn-operator',
  value: 'tn-value',
  combinator: 'tn-combinator',
  not: 'tn-not',
  action: 'tn-action',
  issues: 'tn-issues',
  dropBefore: 'tn-drop-before',
  dropAfter: 'tn-drop-after',
  dropInside: 'tn-drop-inside',
  dragging: 'tn-dragging',
  invalid: 'tn-invalid',
} as const;
