import { registryOf, type Fields } from './fields';

/** How many values an operator takes, which decides the shape of `rule.value`. */
export type Arity = 'none' | 'one' | 'two' | 'many';

export interface OperatorInfo {
  readonly arity: Arity;
  readonly label: string;
  readonly symbol: string;
  /** Can compare against another field (`rule.ref`) or a function (`rule.call`) instead of a literal. */
  readonly comparable: boolean;
  /** Takes a string regardless of the field's value type (substring matching). */
  readonly textMatch: boolean;
  /** The operator meaning NOT(this), so exporters can push negation down. RAQB reversedOp. */
  readonly inverse?: string;
}

/**
 * A custom operator. `evaluate` powers `compile()`/`matches()`; `formats` maps a codec name
 * (`sql`, `mongo`, `jsonlogic`, `spel`, `elasticsearch`, `text`) to an encoder for that output.
 */
export interface OperatorDef<Id extends string = string> extends Partial<Omit<OperatorInfo, 'arity' | 'label'>> {
  readonly id: Id;
  readonly arity: Arity;
  readonly label: string;
  readonly evaluate?: (fieldValue: unknown, operand: unknown) => boolean;
  readonly formats?: Readonly<Record<string, (args: OperatorFormatArgs) => unknown>>;
}

export interface OperatorFormatArgs {
  /** The field as the codec renders it (quoted column, Mongo path, `{ var }`…). */
  readonly field: unknown;
  /** The operand as the codec renders it (escaped literal, list, pair…). */
  readonly value: unknown;
  /** The raw operand. */
  readonly raw: unknown;
}

const op = <const A extends Arity>(arity: A, label: string, symbol: string, comparable = false, textMatch = false, inverse?: string) => ({
  arity,
  label,
  symbol,
  comparable,
  textMatch,
  ...(inverse && { inverse }),
});

export const OPERATORS = {
  eq: op('one', 'equals', '=', true, false, 'neq'),
  neq: op('one', 'does not equal', '≠', true, false, 'eq'),
  lt: op('one', 'less than', '<', true, false, 'gte'),
  lte: op('one', 'at most', '≤', true, false, 'gt'),
  gt: op('one', 'greater than', '>', true, false, 'lte'),
  gte: op('one', 'at least', '≥', true, false, 'lt'),
  contains: op('one', 'contains', '∋', false, true, 'notContains'),
  notContains: op('one', 'does not contain', '∌', false, true, 'contains'),
  startsWith: op('one', 'starts with', '^', false, true),
  endsWith: op('one', 'ends with', '$', false, true),
  between: op('two', 'is between', '↔', false, false, 'notBetween'),
  notBetween: op('two', 'is not between', '!↔', false, false, 'between'),
  in: op('many', 'is any of', '∈', false, false, 'notIn'),
  notIn: op('many', 'is none of', '∉', false, false, 'in'),
  hasAny: op('many', 'has any of', '∩', false, false, 'hasNone'),
  hasAll: op('many', 'has all of', '⊇', false, false),
  hasNone: op('many', 'has none of', '∅∩', false, false, 'hasAny'),
  setEq: op('many', 'is exactly', '≡', false, false, 'setNeq'),
  setNeq: op('many', 'is not exactly', '≢', false, false, 'setEq'),
  isEmpty: op('none', 'is empty', '∅', false, false, 'isNotEmpty'),
  isNotEmpty: op('none', 'is not empty', '!∅', false, false, 'isEmpty'),
  isNull: op('none', 'is null', '⊥', false, false, 'isNotNull'),
  isNotNull: op('none', 'is not null', '!⊥', false, false, 'isNull'),
} as const satisfies Record<string, OperatorInfo>;

export type OperatorId = keyof typeof OPERATORS;

type OpsWhere<A extends Arity> = { [K in OperatorId]: (typeof OPERATORS)[K]['arity'] extends A ? K : never }[OperatorId];
export type NullaryOp = OpsWhere<'none'>;
export type RangeOp = OpsWhere<'two'>;
export type ListOp = OpsWhere<'many'>;
export type TextMatchOp = 'contains' | 'notContains' | 'startsWith' | 'endsWith';
export type ComparableOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';

export const isOperator = (x: unknown): x is OperatorId => typeof x === 'string' && Object.hasOwn(OPERATORS, x);
export const arityOf = (op: OperatorId): Arity => OPERATORS[op].arity;

/** Define a custom operator; pass it to `defineFields(fields, { operators: [...] })`. */
export const defineOperator = <const Id extends string>(def: OperatorDef<Id>): OperatorDef<Id> => def;

/** Built-in or custom operator metadata for a field set; undefined when unknown. */
export function operatorInfo(fields: Fields, op: string): (OperatorInfo & Partial<OperatorDef>) | undefined {
  if (isOperator(op)) return OPERATORS[op];
  const custom = registryOf(fields).operators.get(op);
  return custom && { comparable: false, textMatch: false, symbol: custom.id, ...custom };
}
