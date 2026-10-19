// Framework-agnostic helpers for building query UIs. Every binding's default components use these,
// so React, Vue, Svelte, Solid and vanilla DOM behave identically.
import { fieldLabel, flattenOptions, registryOf, type AnyFieldDef, type EnumOption, type Fields } from './fields';
import { functionOf, type FnCall } from './functions';
import { operatorInfo, type Arity } from './operators';

export type EditorType = 'text' | 'textarea' | 'number' | 'slider' | 'date' | 'time' | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'list' | 'none';

export interface EditorSpec {
  /** Which widget to render. `list` is free-form multiple values (comma-separated input). */
  readonly type: EditorType;
  /** How many inputs: none, one, a pair (between), or many. */
  readonly arity: Arity;
  /** Options flattened from a tree (each with its depth for indentation). */
  readonly options?: readonly { readonly value: unknown; readonly label: string; readonly depth: number; readonly disabled?: boolean }[];
  /** The raw (possibly nested) options, for tree pickers. */
  readonly tree?: readonly EnumOption<unknown>[];
  /** Comparable operators can switch between a literal, another field, or a function. */
  readonly allowsRef: boolean;
  /** Options come from `def.search` as the user types. */
  readonly async: boolean;
}

const scalarEditor = (def: AnyFieldDef | undefined): EditorType => {
  if (def?.options || def?.search) return 'select';
  switch (def?.kind) {
    case 'number':
      return def.widget === 'slider' ? 'slider' : 'number';
    case 'date':
    case 'time':
    case 'datetime':
    case 'boolean':
      return def.kind as EditorType;
    default:
      return def?.widget === 'textarea' ? 'textarea' : 'text';
  }
};

function flatOptions(options: readonly EnumOption<unknown>[], leafOnly: boolean | undefined) {
  const out: { value: unknown; label: string; depth: number; disabled?: boolean }[] = [];
  const walk = (opts: readonly EnumOption<unknown>[], depth: number) => {
    for (const o of opts) {
      const parent = !!o.children?.length;
      out.push({ value: o.value, label: o.label, depth, ...((o.disabled || (leafOnly && parent)) && { disabled: true }) });
      if (o.children) walk(o.children, depth + 1);
    }
  };
  walk(options, 0);
  return out;
}

/** The editor a rule needs for its field and operator. Pass `fields` so custom operators resolve. */
export function editorFor(def: AnyFieldDef | undefined, operator: string, fields: Fields = {}): EditorSpec {
  const info = operatorInfo(fields, operator);
  const arity = info?.arity ?? 'one';
  const base = {
    arity,
    allowsRef: !!info?.comparable,
    async: !!def?.search,
    ...(def?.options && { options: flatOptions(def.options, def.leafOnly), tree: def.options }),
  };
  if (arity === 'none') return { ...base, type: 'none' };
  if (info?.textMatch) return { ...base, type: 'text' };
  if (arity === 'many') return { ...base, type: def?.options || def?.search ? 'multiselect' : 'list' };
  return { ...base, type: scalarEditor(def) };
}

/** Parse what an `<input>` holds into a value for this field (numbers, booleans, option values). */
export function parseInput(def: AnyFieldDef | undefined, raw: string): unknown {
  if (def?.options) return flattenOptions(def.options).find((o) => String(o.value) === raw)?.value ?? (def.allowCustom && raw !== '' ? raw : null);
  switch (def?.kind) {
    case 'number': {
      if (raw.trim() === '') return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    case 'boolean':
      return raw === 'true';
    case 'date':
    case 'time':
    case 'datetime':
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

export interface FieldOption<V = string> extends Option<V> {
  /** Struct label, for grouped pickers. */
  readonly group?: string;
  readonly description?: string;
  /** Array fields are queried with array groups, not rules. */
  readonly isArray: boolean;
}

/** Fields offered in a field picker: hidden fields left out, struct fields carry their group. */
export const fieldOptions = <F extends Fields>(fields: F): FieldOption<keyof F & string>[] =>
  Object.keys(fields)
    .filter((name) => !fields[name]!.hidden)
    .map((name) => {
      const def = fields[name]!;
      return {
        value: name,
        label: fieldLabel(name, def),
        isArray: def.kind === 'array',
        ...(def.group && { group: def.group }),
        ...(def.description && { description: def.description }),
      };
    });

export const operatorOptions = (def: AnyFieldDef | undefined, fields: Fields = {}): Option<string>[] =>
  (def?.operators ?? []).map((op) => ({ value: op, label: operatorInfo(fields, op)?.label ?? op }));

/** Fields a rule on `field` may compare against (same kind, not itself, comparable). */
export const refOptions = <F extends Fields>(fields: F, field: string, kind = fields[field]?.kind): Option<keyof F & string>[] =>
  Object.keys(fields)
    .filter((n) => n !== field && fields[n]!.kind === kind && fields[n]!.comparable !== false)
    .map((n) => ({ value: n, label: fieldLabel(n, fields[n]) }));

/** Functions returning `kind` (all functions when omitted), for function pickers. */
export const functionOptions = (fields: Fields, kind?: string): Option<string>[] =>
  Object.entries(registryOf(fields).functions)
    .filter(([, fn]) => kind === undefined || fn.returns.kind === kind)
    .map(([name, fn]) => ({ value: name, label: fn.label ?? name }));

/** Every selectable option value of a field, flattened from trees. */
export const optionValues = (def: AnyFieldDef | undefined): unknown[] => flattenOptions(def?.options, def?.leafOnly).map((o) => o.value);

/** Stable class names shared by every binding's default UI (styled by `@qnot/core/styles.css`). */
export const CLASS = {
  root: 'qn',
  group: 'qn-group',
  groupHeader: 'qn-group-header',
  children: 'qn-children',
  rule: 'qn-rule',
  handle: 'qn-handle',
  field: 'qn-field',
  operator: 'qn-operator',
  value: 'qn-value',
  combinator: 'qn-combinator',
  not: 'qn-not',
  action: 'qn-action',
  issues: 'qn-issues',
  dropBefore: 'qn-drop-before',
  dropAfter: 'qn-drop-after',
  dropInside: 'qn-drop-inside',
  dragging: 'qn-dragging',
  invalid: 'qn-invalid',
  locked: 'qn-locked',
  arrayGroup: 'qn-array-group',
} as const;

/** UI strings shared by every binding's default components. Override per builder for i18n. */
export const DEFAULT_LABELS = {
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  addRule: '+ Rule',
  addGroup: '+ Group',
  addArrayGroup: '+ List condition',
  remove: 'Remove',
  clone: 'Duplicate',
  drag: 'Drag to move',
  lock: 'Lock',
  unlock: 'Unlock',
  compareField: 'Compare with another field',
  compareFunction: 'Compare with a function',
  compareValue: 'Compare with a value',
  compareWith: 'Compare with',
  useField: 'Use a field',
  useFunction: 'Use a function',
  yes: 'Yes',
  no: 'No',
  empty: '—',
  rangeSeparator: 'and',
  some: 'some',
  all: 'all',
  none: 'none',
  count: 'count',
  matchOf: 'of',
  matchWhere: 'where',
  countGte: 'at least',
  countLte: 'at most',
  countEq: 'exactly',
  countGt: 'more than',
  countLt: 'fewer than',
};
export type Labels = typeof DEFAULT_LABELS;

/** Operators offered for "count" quantifiers on array groups ("at least 2 of Orders where …"). */
export const countOptions = (labels: Pick<Labels, 'countGte' | 'countLte' | 'countEq' | 'countGt' | 'countLt'> = DEFAULT_LABELS): Option<'gte' | 'lte' | 'eq' | 'gt' | 'lt'>[] => [
  { value: 'gte', label: labels.countGte },
  { value: 'lte', label: labels.countLte },
  { value: 'eq', label: labels.countEq },
  { value: 'gt', label: labels.countGt },
  { value: 'lt', label: labels.countLt },
];

/** A call to function `fn` with every argument at its default literal (what pickers insert). */
export const defaultCall = (fields: Fields, fn: string): FnCall => {
  const def = functionOf(fields, { fn, args: {} });
  return { fn, args: Object.fromEntries(Object.entries(def?.args ?? {}).map(([name, a]) => [name, { value: a.defaultValue ?? null }])) };
};
