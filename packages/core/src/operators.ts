/** How many values an operator takes, which decides the shape of `rule.value`. */
export type Arity = 'none' | 'one' | 'two' | 'many';

export interface OperatorInfo {
  readonly arity: Arity;
  readonly label: string;
  readonly symbol: string;
  /** Can compare against another field (`rule.ref`) instead of a literal. */
  readonly comparable: boolean;
  /** Takes a string regardless of the field's value type (substring matching). */
  readonly textMatch: boolean;
}

const op = <const A extends Arity>(arity: A, label: string, symbol: string, comparable = false, textMatch = false) => ({
  arity,
  label,
  symbol,
  comparable,
  textMatch,
});

export const OPERATORS = {
  eq: op('one', 'equals', '=', true),
  neq: op('one', 'does not equal', '≠', true),
  lt: op('one', 'less than', '<', true),
  lte: op('one', 'at most', '≤', true),
  gt: op('one', 'greater than', '>', true),
  gte: op('one', 'at least', '≥', true),
  contains: op('one', 'contains', '∋', false, true),
  notContains: op('one', 'does not contain', '∌', false, true),
  startsWith: op('one', 'starts with', '^', false, true),
  endsWith: op('one', 'ends with', '$', false, true),
  between: op('two', 'is between', '↔', false),
  notBetween: op('two', 'is not between', '!↔', false),
  in: op('many', 'is any of', '∈', false),
  notIn: op('many', 'is none of', '∉', false),
  isNull: op('none', 'is empty', '∅', false),
  isNotNull: op('none', 'is not empty', '!∅', false),
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
