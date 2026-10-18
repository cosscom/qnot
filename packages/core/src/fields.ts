import type { OperatorDef, OperatorId } from './operators';

export type FieldKind = 'text' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'enum' | 'multiEnum' | 'array' | (string & {});

export interface EnumOption<V> {
  readonly value: V;
  readonly label: string;
  /** Nested options make a tree select (RAQB treeselect). Parents are selectable unless `leafOnly`. */
  readonly children?: readonly EnumOption<V>[];
  readonly disabled?: boolean;
}

/** Widget hints for UIs; the core never reads them. */
export type WidgetHint = 'input' | 'textarea' | 'slider' | 'select' | 'radio' | 'switch' | 'checkbox' | 'combobox' | 'tree' | (string & {});

/**
 * A field's schema. `V` is the value type and `Op` the operators it allows; both flow into
 * `QueryOf<typeof fields>` so rules are typed per field.
 */
export interface FieldDef<K extends FieldKind = FieldKind, V = unknown, Op extends string = OperatorId> {
  readonly kind: K;
  readonly label: string | undefined;
  /** Longer help text (RAQB `tooltip`/`label2`). */
  readonly description?: string;
  /** Name used by exporters (SQL column, Mongo path, JsonLogic var). Defaults to the field key. */
  readonly column?: string;
  /** Label of the struct this field came from, for grouped field pickers. */
  readonly group?: string;
  readonly operators: readonly Op[];
  readonly defaultOperator: Op;
  readonly defaultValue: V | null;
  /** Allowed values for enum / multiEnum fields (may be a tree). */
  readonly options?: readonly EnumOption<ElementOf<V>>[];
  /** Tree options: only leaves are selectable. */
  readonly leafOnly?: boolean;
  /** Accept values outside `options` (RAQB allowCustomValues). */
  readonly allowCustom?: boolean;
  /** Async option search for large or remote lists. */
  readonly search?: (query: string, signal?: AbortSignal) => Promise<readonly EnumOption<ElementOf<V>>[]>;
  readonly required: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly integer?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  /** Text comparisons in `compile()`/`matches()` ignore case unless set. */
  readonly caseSensitive?: boolean;
  /** Not offered in field pickers (still usable as a comparison target). RAQB hideForSelect. */
  readonly hidden?: boolean;
  /** Can be the target of a field-to-field comparison (default true). RAQB hideForCompare. */
  readonly comparable?: boolean;
  /** Extra check run after the built-in ones; return a message to fail. */
  readonly validate?: (value: V) => string | undefined;
  readonly widget?: WidgetHint;
  readonly placeholder?: string;
  readonly prefix?: string;
  readonly suffix?: string;
  /** Element schema for `array` fields. */
  readonly of?: Fields;
  /** Free-form UI hints, passed through untouched. */
  readonly meta?: Readonly<Record<string, unknown>>;
  /** Type-only carrier for the value type; never set at runtime. */
  readonly '~value'?: V;
}

type ElementOf<V> = V extends readonly (infer E)[] ? E : V;

export type AnyFieldDef = FieldDef<FieldKind, any, string>;
export type Fields = Readonly<Record<string, AnyFieldDef>>;

export type ValueOf<F> = F extends FieldDef<any, infer V, any> ? V : never;
export type OperatorsOf<F> = F extends FieldDef<any, any, infer Op> ? Op : never;
export type KindOf<F> = F extends FieldDef<infer K, any, any> ? K : never;

interface CommonOptions<V, Op extends string> {
  label?: string;
  description?: string;
  column?: string;
  /** Restrict (and order) the operators offered for this field. */
  operators?: readonly Op[];
  /** Operators to drop from the defaults. */
  excludeOperators?: readonly OperatorId[];
  defaultOperator?: NoInfer<Op>;
  defaultValue?: NoInfer<V> | null;
  /** Rules on this field must have a value (default true). */
  required?: boolean;
  hidden?: boolean;
  comparable?: boolean;
  validate?: (value: NoInfer<V>) => string | undefined;
  widget?: WidgetHint;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  meta?: Record<string, unknown>;
}

export const TEXT_OPERATORS = ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'in', 'notIn', 'isEmpty', 'isNotEmpty', 'isNull', 'isNotNull'] as const;
export const NUMBER_OPERATORS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'notBetween', 'in', 'notIn', 'isNull', 'isNotNull'] as const;
export const DATE_OPERATORS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'notBetween', 'isNull', 'isNotNull'] as const;
export const BOOLEAN_OPERATORS = ['eq', 'neq', 'isNull', 'isNotNull'] as const;
export const ENUM_OPERATORS = ['eq', 'neq', 'in', 'notIn', 'isNull', 'isNotNull'] as const;
export const MULTI_ENUM_OPERATORS = ['hasAny', 'hasAll', 'hasNone', 'setEq', 'setNeq', 'isEmpty', 'isNotEmpty', 'isNull', 'isNotNull'] as const;
export const ARRAY_OPERATORS = ['isEmpty', 'isNotEmpty', 'isNull', 'isNotNull'] as const;

export type TextOperator = (typeof TEXT_OPERATORS)[number];
export type NumberOperator = (typeof NUMBER_OPERATORS)[number];
export type DateOperator = (typeof DATE_OPERATORS)[number];
export type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number];
export type EnumOperator = (typeof ENUM_OPERATORS)[number];
export type MultiEnumOperator = (typeof MULTI_ENUM_OPERATORS)[number];
export type ArrayOperator = (typeof ARRAY_OPERATORS)[number];

/** ISO-8601 date (`2026-10-18`). */
export type IsoDate = string;
/** ISO-8601 time (`14:30` or `14:30:05`). */
export type IsoTime = string;
/** ISO-8601 date-time (`2026-10-18T14:30:00Z`). */
export type IsoDateTime = string;

// Builders' public signatures carry the precise types; this helper only assembles the object.
function build(kind: string, allOps: readonly string[], opts: object, defaultValue: unknown): any {
  const { label, operators, excludeOperators, extraOperators, defaultOperator, defaultValue: dv, required, ...rest } = opts as CommonOptions<any, string> & {
    /** Custom operators (registered via `defineFields(…, { operators })`) offered as well. */
    extraOperators?: readonly string[];
  };
  const ops = [...(operators ?? allOps).filter((o) => !excludeOperators?.includes(o as OperatorId)), ...(extraOperators ?? [])];
  if (!ops.length) throw new Error(`trawlnet: a ${kind} field needs at least one operator`);
  return {
    ...rest,
    kind,
    label,
    operators: ops,
    defaultOperator: defaultOperator ?? ops[0]!,
    defaultValue: dv === undefined ? defaultValue : dv,
    required: required ?? true,
  };
}

type OptionInput<V> = V | EnumOption<V>;

const toOptions = <V>(values: readonly OptionInput<V>[]): EnumOption<V>[] =>
  values.map((v) => {
    if (typeof v !== 'object' || v === null || !('value' in v)) return { value: v as V, label: String(v) };
    const o = v as EnumOption<V>;
    return o.children ? { ...o, children: toOptions(o.children) } : o;
  });

/** Every option in a (possibly nested) option list, depth-first. */
export function flattenOptions<V>(options: readonly EnumOption<V>[] | undefined, leafOnly = false): EnumOption<V>[] {
  const out: EnumOption<V>[] = [];
  const walk = (opts: readonly EnumOption<V>[]) => {
    for (const o of opts) {
      if (!leafOnly || !o.children?.length) out.push(o);
      if (o.children) walk(o.children);
    }
  };
  if (options) walk(options);
  return out;
}

interface EnumOptions<V, Op extends string> extends CommonOptions<V, Op> {
  leafOnly?: boolean;
  allowCustom?: boolean;
  search?: (query: string, signal?: AbortSignal) => Promise<readonly EnumOption<NoInfer<V>>[]>;
}

export interface StructDef<S extends FieldsInput = FieldsInput> {
  readonly kind: 'struct';
  readonly label: string | undefined;
  readonly fields: S;
}

export type FieldsInput = Readonly<Record<string, AnyFieldDef | StructDef<any>>>;

/** Field schema builders. */
export const f = {
  text<const Op extends TextOperator = TextOperator, const X extends string = never>(
    opts: CommonOptions<string, Op> & { extraOperators?: readonly X[] } & { minLength?: number; maxLength?: number; pattern?: RegExp; caseSensitive?: boolean } = {},
  ): FieldDef<'text', string, Op | NoInfer<X>> {
    return build('text', TEXT_OPERATORS, opts, '');
  },

  number<const Op extends NumberOperator = NumberOperator, const X extends string = never>(
    opts: CommonOptions<number, Op> & { extraOperators?: readonly X[] } & { min?: number; max?: number; step?: number; integer?: boolean } = {},
  ): FieldDef<'number', number, Op | NoInfer<X>> {
    return build('number', NUMBER_OPERATORS, opts, null);
  },

  boolean<const Op extends BooleanOperator = BooleanOperator, const X extends string = never>(
    opts: CommonOptions<boolean, Op> & { extraOperators?: readonly X[] } = {},
  ): FieldDef<'boolean', boolean, Op | NoInfer<X>> {
    return build('boolean', BOOLEAN_OPERATORS, opts, true);
  },

  date<const Op extends DateOperator = DateOperator, const X extends string = never>(
    opts: CommonOptions<IsoDate, Op> & { extraOperators?: readonly X[] } = {},
  ): FieldDef<'date', IsoDate, Op | NoInfer<X>> {
    return build('date', DATE_OPERATORS, opts, null);
  },

  time<const Op extends DateOperator = DateOperator, const X extends string = never>(
    opts: CommonOptions<IsoTime, Op> & { extraOperators?: readonly X[] } = {},
  ): FieldDef<'time', IsoTime, Op | NoInfer<X>> {
    return build('time', DATE_OPERATORS, opts, null);
  },

  datetime<const Op extends DateOperator = DateOperator, const X extends string = never>(
    opts: CommonOptions<IsoDateTime, Op> & { extraOperators?: readonly X[] } = {},
  ): FieldDef<'datetime', IsoDateTime, Op | NoInfer<X>> {
    return build('datetime', DATE_OPERATORS, opts, null);
  },

  /** One value from a list (or tree, via `children`). */
  enum<const V extends string | number, const Op extends EnumOperator = EnumOperator, const X extends string = never>(
    values: readonly (V | EnumOption<V>)[],
    opts: EnumOptions<NoInfer<V>, Op> & { extraOperators?: readonly X[] } = {},
  ): FieldDef<'enum', V, Op | NoInfer<X>> {
    return { ...build('enum', ENUM_OPERATORS, opts, null), options: toOptions(values) };
  },

  /** A field holding several values from a list (tags, roles…). RAQB multiselect. */
  multiEnum<const V extends string | number, const Op extends MultiEnumOperator = MultiEnumOperator, const X extends string = never>(
    values: readonly (V | EnumOption<V>)[],
    opts: EnumOptions<NoInfer<V>[], Op> & { extraOperators?: readonly X[] } = {},
  ): FieldDef<'multiEnum', V[], Op | NoInfer<X>> {
    return { ...build('multiEnum', MULTI_ENUM_OPERATORS, opts, null), options: toOptions(values) };
  },

  /** Nested fields, flattened by `defineFields` into dotted paths (`address.city`). RAQB !struct. */
  struct<const S extends FieldsInput>(fields: S, opts: { label?: string } = {}): StructDef<S> {
    return { kind: 'struct', label: opts.label, fields };
  },

  /**
   * A list of records (orders, line items…). Query it with array groups: "some / all / none of
   * the orders match…" or "at least 3 orders match…". RAQB !group.
   */
  array<const S extends FieldsInput, const Op extends ArrayOperator = ArrayOperator>(
    fields: S,
    opts: CommonOptions<never, Op> = {},
  ): FieldDef<'array', unknown[], Op> & { readonly of: FlattenFields<S> } {
    return { ...build('array', ARRAY_OPERATORS, opts, null), of: flatten(fields) };
  },

  /** A field of your own kind; you pick the value type and operators (built-in or custom). */
  custom<V, const Op extends string, const K extends string = 'custom'>(
    opts: CommonOptions<V, Op> & { kind?: K; operators: readonly Op[]; defaultValue?: V | null; options?: readonly OptionInput<V>[] },
  ): FieldDef<K, V, Op> {
    const { kind = 'custom' as K, operators, options, ...rest } = opts;
    const def = build(kind, operators, rest, opts.defaultValue ?? null);
    return options ? { ...def, options: toOptions(options) } : def;
  },
};

// --- schema-level registry (custom operators, functions, messages) ------------------------------

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Struct fields flattened to dotted keys: `{ address: f.struct({ city }) }` → `{ 'address.city': … }`. */
export type FlattenFields<F, P extends string = ''> = Simplify<
  UnionToIntersection<
    { [K in keyof F & string]: F[K] extends StructDef<infer S> ? FlattenFields<S, `${P}${K}.`> : { readonly [Q in `${P}${K}`]: F[K] } }[keyof F & string]
  >
>;

export interface SchemaOptions {
  /** Custom operators (e.g. proximity), usable in fields' `operators`. */
  operators?: readonly OperatorDef[];
  /** Functions usable as values (`call`) or on the left side (`field: { fn }`). */
  functions?: Readonly<Record<string, import('./functions').FunctionDef>>;
  /** Override validation messages (i18n). */
  messages?: Partial<Record<import('./validate').IssueCode, string | ((issue: { code: string; message: string }) => string)>>;
}

export interface SchemaRegistry {
  readonly operators: ReadonlyMap<string, OperatorDef>;
  readonly functions: Readonly<Record<string, import('./functions').FunctionDef>>;
  readonly messages: SchemaOptions['messages'];
}

const REGISTRY = Symbol.for('trawlnet.registry');

function flatten(input: FieldsInput, prefix = '', group?: string, out: Record<string, AnyFieldDef> = {}): any {
  for (const [key, def] of Object.entries(input)) {
    if (def.kind === 'struct') {
      const s = def as StructDef;
      flatten(s.fields, `${prefix}${key}.`, s.label ?? humanize(key), out);
    } else {
      const d = def as AnyFieldDef;
      out[`${prefix}${key}`] = group && !d.group ? { ...d, group } : d;
    }
  }
  return out;
}

/**
 * Pin the schema's literal types, flatten `f.struct` fields into dotted paths, and attach custom
 * operators / functions / messages so every consumer of these fields sees them.
 */
export function defineFields<const F extends FieldsInput>(fields: F, options?: SchemaOptions): FlattenFields<F> {
  const flat = flatten(fields);
  if (options) {
    Object.defineProperty(flat, REGISTRY, {
      value: {
        operators: new Map((options.operators ?? []).map((o) => [o.id, o])),
        functions: options.functions ?? {},
        messages: options.messages,
      } satisfies SchemaRegistry,
      enumerable: false,
    });
  }
  return flat;
}

const EMPTY_REGISTRY: SchemaRegistry = { operators: new Map(), functions: {}, messages: undefined };

/** Custom operators, functions and messages attached to a field set by `defineFields`. */
export const registryOf = (fields: Fields): SchemaRegistry => (fields as Record<symbol, SchemaRegistry>)[REGISTRY] ?? EMPTY_REGISTRY;

/** Share a parent schema's registry with a derived field set (array element schemas). */
export const withRegistry = <F extends Fields>(fields: F, from: Fields): F => {
  const reg = (from as Record<symbol, SchemaRegistry>)[REGISTRY];
  if (!reg || (fields as Record<symbol, unknown>)[REGISTRY]) return fields;
  Object.defineProperty(fields, REGISTRY, { value: reg, enumerable: false });
  return fields;
};

const humanize = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/ ([A-Z])(?=[a-z])/g, (_, c: string) => ` ${c.toLowerCase()}`);

export const fieldLabel = (name: string, def: AnyFieldDef | undefined): string => def?.label ?? humanize(name.slice(name.lastIndexOf('.') + 1));

/** The name exporters should use for a field (its `column`, or the key). */
export const columnOf = (fields: Fields, name: string): string => fields[name]?.column ?? name;
