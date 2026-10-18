import type { Fields, KindOf, OperatorsOf, ValueOf } from './fields';
import type { ComparableOp, ListOp, NullaryOp, OperatorId, RangeOp, TextMatchOp } from './operators';

export type Combinator = 'and' | 'or';

// ---------------------------------------------------------------------------------------------
// Untyped shapes: what's on the wire, and what codecs and the store work with internally.

export interface Rule {
  readonly kind: 'rule';
  readonly field: string;
  readonly operator: OperatorId;
  /** Literal operand. Its shape follows the operator's arity: null / V / [V, V] / V[]. */
  readonly value?: unknown;
  /** Compare against another field instead of a literal. Mutually exclusive with `value`. */
  readonly ref?: string;
}

export interface Group {
  readonly kind: 'group';
  readonly combinator: Combinator;
  readonly not?: boolean;
  readonly children: readonly QueryNode[];
}

export type QueryNode = Rule | Group;
export type Query = Group;

// ---------------------------------------------------------------------------------------------
// Schema-typed shapes.

/** The value a rule holds for an operator. Draft queries allow `null` while a value is being entered. */
export type OperatorValue<Op, V, Strict extends boolean = false> = Op extends NullaryOp
  ? null | undefined
  : Op extends RangeOp
    ? Strict extends true
      ? readonly [V, V]
      : readonly [V | null, V | null]
    : Op extends ListOp
      ? readonly V[]
      : Op extends TextMatchOp
        ? Strict extends true
          ? string
          : string | null
        : Strict extends true
          ? V
          : V | null;

/** Fields (other than K) with the same kind as K: valid targets for a field-to-field comparison. */
export type RefTargets<F extends Fields, K extends keyof F> = {
  [J in keyof F & string]: J extends K ? never : KindOf<F[J]> extends KindOf<F[K]> ? J : never;
}[keyof F & string];

type ValueRule<F extends Fields, K extends keyof F & string, Op, Strict extends boolean> = Op extends NullaryOp
  ? { readonly kind: 'rule'; readonly field: K; readonly operator: Op; readonly value?: null; readonly ref?: undefined }
  : { readonly kind: 'rule'; readonly field: K; readonly operator: Op; readonly value: OperatorValue<Op, ValueOf<F[K]>, Strict>; readonly ref?: undefined };

type RefRule<F extends Fields, K extends keyof F & string, Op> = Op extends ComparableOp
  ? [RefTargets<F, K>] extends [never]
    ? never
    : { readonly kind: 'rule'; readonly field: K; readonly operator: Op; readonly ref: RefTargets<F, K>; readonly value?: undefined }
  : never;

type RuleFor<F extends Fields, K extends keyof F & string, Op, Strict extends boolean> = Op extends OperatorId
  ? ValueRule<F, K, Op, Strict> | RefRule<F, K, Op>
  : never;

/**
 * A rule typed against a schema: a discriminated union over every (field, operator) pair, so
 * narrowing on `rule.field` and `rule.operator` narrows `rule.value`.
 */
export type RuleOf<F extends Fields, Strict extends boolean = false> = string extends keyof F
  ? Rule
  : { [K in keyof F & string]: RuleFor<F, K, OperatorsOf<F[K]>, Strict> }[keyof F & string];

export interface GroupOf<F extends Fields, Strict extends boolean = false> {
  readonly kind: 'group';
  readonly combinator: Combinator;
  readonly not?: boolean;
  readonly children: readonly NodeOf<F, Strict>[];
}

export type NodeOf<F extends Fields, Strict extends boolean = false> = RuleOf<F, Strict> | GroupOf<F, Strict>;

/** A query as edited: values may still be `null` while the user is typing. */
export type QueryOf<F extends Fields> = GroupOf<F, false>;
/** A query that passed validation: no missing values. Produced by `isValidQuery`/`assertValidQuery`. */
export type StrictQueryOf<F extends Fields> = GroupOf<F, true>;

/** A record that `compile()`/`matches()` can test. */
export type RowOf<F extends Fields> = { readonly [K in keyof F]?: ValueOf<F[K]> | null };

/** Field names whose schema allows operator Op. */
export type FieldsWithOperator<F extends Fields, Op extends OperatorId> = {
  [K in keyof F & string]: Op extends OperatorsOf<F[K]> ? K : never;
}[keyof F & string];

export const isGroup = (n: QueryNode): n is Group => n.kind === 'group';
export const isRule = (n: QueryNode): n is Rule => n.kind === 'rule';
