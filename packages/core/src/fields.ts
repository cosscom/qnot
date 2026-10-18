import type { OperatorId } from './operators';

export type FieldKind = 'text' | 'number' | 'boolean' | 'date' | 'enum' | (string & {});

export interface EnumOption<V> {
  readonly value: V;
  readonly label: string;
}

/**
 * A field's schema. `V` is the value type and `Op` the operators it allows; both flow into
 * `QueryOf<typeof fields>` so rules are typed per field.
 */
export interface FieldDef<K extends FieldKind = FieldKind, V = unknown, Op extends OperatorId = OperatorId> {
  readonly kind: K;
  readonly label: string | undefined;
  readonly operators: readonly Op[];
  readonly defaultOperator: Op;
  readonly defaultValue: V | null;
  /** Allowed values for `enum` fields. */
  readonly options?: readonly EnumOption<V>[];
  readonly required: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  /** Text comparisons in `compile()`/`matches()` ignore case unless set. */
  readonly caseSensitive?: boolean;
  /** Extra check run after the built-in ones; return a message to fail. */
  readonly validate?: (value: V) => string | undefined;
  /** Free-form UI hints (placeholder, help text, widget name…), passed through untouched. */
  readonly meta?: Readonly<Record<string, unknown>>;
  /** Type-only carrier for the value type; never set at runtime. */
  readonly '~value'?: V;
}

export type AnyFieldDef = FieldDef<FieldKind, any, OperatorId>;
export type Fields = Readonly<Record<string, AnyFieldDef>>;

export type ValueOf<F> = F extends FieldDef<any, infer V, any> ? V : never;
export type OperatorsOf<F> = F extends FieldDef<any, any, infer Op> ? Op : never;
export type KindOf<F> = F extends FieldDef<infer K, any, any> ? K : never;

interface CommonOptions<V, Op extends OperatorId> {
  label?: string;
  /** Restrict (and order) the operators offered for this field. */
  operators?: readonly Op[];
  defaultOperator?: NoInfer<Op>;
  defaultValue?: V | null;
  /** Rules on this field must have a value (default true). */
  required?: boolean;
  validate?: (value: V) => string | undefined;
  meta?: Record<string, unknown>;
}

export const TEXT_OPERATORS = ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'in', 'notIn', 'isNull', 'isNotNull'] as const;
export const NUMBER_OPERATORS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'notBetween', 'in', 'notIn', 'isNull', 'isNotNull'] as const;
export const DATE_OPERATORS = ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'notBetween', 'isNull', 'isNotNull'] as const;
export const BOOLEAN_OPERATORS = ['eq', 'neq', 'isNull', 'isNotNull'] as const;
export const ENUM_OPERATORS = ['eq', 'neq', 'in', 'notIn', 'isNull', 'isNotNull'] as const;

export type TextOperator = (typeof TEXT_OPERATORS)[number];
export type NumberOperator = (typeof NUMBER_OPERATORS)[number];
export type DateOperator = (typeof DATE_OPERATORS)[number];
export type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number];
export type EnumOperator = (typeof ENUM_OPERATORS)[number];

/** ISO-8601 date (`2026-10-18`) or date-time string. */
export type IsoDate = string;

// Builders' public signatures carry the precise types; this helper only assembles the object.
function build(kind: string, allOps: readonly OperatorId[], opts: CommonOptions<any, OperatorId>, defaultValue: unknown): any {
  const { label, operators, defaultOperator, defaultValue: dv, required, ...rest } = opts;
  const ops = operators ?? allOps;
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

const toOptions = <V>(values: readonly (V | EnumOption<V>)[]): EnumOption<V>[] =>
  values.map((v) => (typeof v === 'object' && v !== null && 'value' in v ? (v as EnumOption<V>) : { value: v as V, label: String(v) }));

/** Field schema builders. */
export const f = {
  text<const Op extends TextOperator = TextOperator>(
    opts: CommonOptions<string, Op> & { minLength?: number; maxLength?: number; pattern?: RegExp; caseSensitive?: boolean } = {},
  ): FieldDef<'text', string, Op> {
    return build('text', TEXT_OPERATORS, opts, '');
  },

  number<const Op extends NumberOperator = NumberOperator>(
    opts: CommonOptions<number, Op> & { min?: number; max?: number; integer?: boolean } = {},
  ): FieldDef<'number', number, Op> {
    return build('number', NUMBER_OPERATORS, opts, null);
  },

  boolean<const Op extends BooleanOperator = BooleanOperator>(opts: CommonOptions<boolean, Op> = {}): FieldDef<'boolean', boolean, Op> {
    return build('boolean', BOOLEAN_OPERATORS, opts, true);
  },

  date<const Op extends DateOperator = DateOperator>(opts: CommonOptions<IsoDate, Op> = {}): FieldDef<'date', IsoDate, Op> {
    return build('date', DATE_OPERATORS, opts, null);
  },

  enum<const V extends string | number, const Op extends EnumOperator = EnumOperator>(
    values: readonly (V | EnumOption<V>)[],
    opts: CommonOptions<V, Op> = {},
  ): FieldDef<'enum', V, Op> {
    return { ...build('enum', ENUM_OPERATORS, opts, null), options: toOptions(values) };
  },

  /** A field of your own kind; you pick the value type and operators. */
  custom<V, const Op extends OperatorId, const K extends string = 'custom'>(
    opts: CommonOptions<V, Op> & { kind?: K; operators: readonly Op[]; defaultValue?: V | null; options?: readonly (V | EnumOption<V>)[] },
  ): FieldDef<K, V, Op> {
    const { kind = 'custom' as K, operators, options, ...rest } = opts;
    const def = build(kind, operators, rest, opts.defaultValue ?? null);
    return options ? { ...def, options: toOptions(options) } : def;
  },
};

/** Identity function that pins the schema's literal types. */
export const defineFields = <const F extends Fields>(fields: F): F => fields;

const humanize = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/ ([A-Z])(?=[a-z])/g, (_, c: string) => ` ${c.toLowerCase()}`);

export const fieldLabel = (name: string, def: AnyFieldDef | undefined): string => def?.label ?? humanize(name);
