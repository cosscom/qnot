import type { Fields, KindOf, OperatorsOf, ValueOf } from './fields';
import type { FnCall } from './functions';
import type { ComparableOp, ListOp, NullaryOp, OperatorId, RangeOp, TextMatchOp } from './operators';

export type Combinator = 'and' | 'or';

/** How an array group's sub-query must hold across the array's elements. RAQB !group modes. */
export type Quantifier =
  | 'some'
  | 'all'
  | 'none'
  | { readonly count: ComparableOp; readonly value: number }
  | { readonly count: 'between'; readonly value: readonly [number, number] };

/** Scopes a group to the elements of an array field. */
export interface ArrayScope<K extends string = string> {
  readonly field: K;
  readonly match: Quantifier;
}

// ---------------------------------------------------------------------------------------------
// Untyped shapes: what's on the wire, and what codecs and the store work with internally.

export interface Rule {
  readonly kind: 'rule';
  /** A field name, or a function call on the left side (RAQB fieldSources: func). */
  readonly field: string | FnCall;
  readonly operator: string;
  /** Literal operand. Its shape follows the operator's arity: null / V / [V, V] / V[]. */
  readonly value?: unknown;
  /** Compare against another field. Mutually exclusive with `value` and `call`. */
  readonly ref?: string;
  /** Compare against a function call (RAQB valueSources: func). */
  readonly call?: FnCall;
  /** Locked nodes can't be edited, moved or removed through the store. */
  readonly locked?: boolean;
}

export interface Group {
  readonly kind: 'group';
  readonly combinator: Combinator;
  readonly not?: boolean;
  /** Present on array groups: children are evaluated against each element of `of.field`. */
  readonly of?: ArrayScope;
  readonly locked?: boolean;
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
      ? readonly ElementOf<V>[]
      : Op extends TextMatchOp
        ? Strict extends true
          ? string
          : string | null
        : Op extends OperatorId
          ? Strict extends true
            ? V
            : V | null
          : unknown;

type ElementOf<V> = V extends readonly (infer E)[] ? E : V;

/** Fields (other than K) with the same kind as K: valid targets for a field-to-field comparison. */
export type RefTargets<F extends Fields, K extends keyof F> = {
  [J in keyof F & string]: J extends K ? never : F[J] extends { readonly comparable: false } ? never : KindOf<F[J]> extends KindOf<F[K]> ? J : never;
}[keyof F & string];

interface RuleMeta {
  readonly locked?: boolean;
}

type ValueRule<F extends Fields, K extends keyof F & string, Op, Strict extends boolean> = Op extends NullaryOp
  ? RuleMeta & { readonly kind: 'rule'; readonly field: K; readonly operator: Op; readonly value?: null; readonly ref?: undefined; readonly call?: undefined }
  : RuleMeta & {
      readonly kind: 'rule';
      readonly field: K;
      readonly operator: Op;
      readonly value: OperatorValue<Op, ValueOf<F[K]>, Strict>;
      readonly ref?: undefined;
      readonly call?: undefined;
    };

type RefRule<F extends Fields, K extends keyof F & string, Op> = Op extends ComparableOp
  ? [RefTargets<F, K>] extends [never]
    ? never
    : RuleMeta & { readonly kind: 'rule'; readonly field: K; readonly operator: Op; readonly ref: RefTargets<F, K>; readonly value?: undefined; readonly call?: undefined }
  : never;

type CallRule<K extends string, Op> = Op extends ComparableOp
  ? RuleMeta & { readonly kind: 'rule'; readonly field: K; readonly operator: Op; readonly call: FnCall; readonly value?: undefined; readonly ref?: undefined }
  : never;

type RuleFor<F extends Fields, K extends keyof F & string, Op, Strict extends boolean> = Op extends string
  ? ValueRule<F, K, Op, Strict> | RefRule<F, K, Op> | CallRule<K, Op>
  : never;

/** A rule whose left side is a function call. Typed loosely: the function decides the operand type. */
export interface FnRule extends RuleMeta {
  readonly kind: 'rule';
  readonly field: FnCall;
  readonly operator: string;
  readonly value?: unknown;
  readonly ref?: string;
  readonly call?: FnCall;
}

/** Every field name a rule can use: root fields plus the element fields of array fields (up to 4 levels deep). */
export type AnyFieldName<F extends Fields, Depth extends unknown[] = []> = Depth['length'] extends 4
  ? never
  : (keyof F & string) | { [K in ArrayKeys<F>]: AnyFieldName<ElementFields<F[K]>, [...Depth, 0]> }[ArrayKeys<F>];

type ArrayKeys<F extends Fields> = { [K in keyof F & string]: F[K] extends { readonly of: Fields } ? K : never }[keyof F & string];
type ElementFields<D> = D extends { readonly of: infer S extends Fields } ? S : never;

/**
 * A rule typed against a schema: a discriminated union over every (field, operator) pair, so
 * narrowing on `rule.field` and `rule.operator` narrows `rule.value`.
 */
export type RuleOf<F extends Fields, Strict extends boolean = false> = string extends keyof F
  ? Rule
  : { [K in keyof F & string]: RuleFor<F, K, OperatorsOf<F[K]>, Strict> }[keyof F & string] | FnRule;

export interface GroupOf<F extends Fields, Strict extends boolean = false> {
  readonly kind: 'group';
  readonly combinator: Combinator;
  readonly not?: boolean;
  readonly of?: undefined;
  readonly locked?: boolean;
  readonly children: readonly NodeOf<F, Strict>[];
}

/** A group over an array field's elements; its children are typed against the element schema. */
export type ArrayGroupOf<F extends Fields, Strict extends boolean = false> = {
  [K in ArrayKeys<F>]: {
    readonly kind: 'group';
    readonly combinator: Combinator;
    readonly not?: boolean;
    readonly of: ArrayScope<K>;
    readonly locked?: boolean;
    readonly children: readonly NodeOf<ElementFields<F[K]>, Strict>[];
  };
}[ArrayKeys<F>];

export type NodeOf<F extends Fields, Strict extends boolean = false> = RuleOf<F, Strict> | GroupOf<F, Strict> | ArrayGroupOf<F, Strict>;

/** A query as edited: values may still be `null` while the user is typing. */
export type QueryOf<F extends Fields> = GroupOf<F, false>;
/** A query that passed validation: no missing values. Produced by `isValidQuery`/`assertValidQuery`. */
export type StrictQueryOf<F extends Fields> = GroupOf<F, true>;

/** A record that `compile()`/`matches()` can test. Dotted struct paths become nested objects. */
export type RowOf<F extends Fields> = Simplify<UnionToIntersection<{ [K in keyof F & string]: PathRow<K, RowValue<F[K]>> }[keyof F & string]>>;

type RowValue<D> = D extends { readonly of: infer S extends Fields } ? readonly RowOf<S>[] | null | undefined : ValueOf<D> | null | undefined;
type PathRow<P extends string, V> = P extends `${infer Head}.${infer Rest}` ? { readonly [K in Head]?: PathRow<Rest, V> } : { readonly [K in P]?: V };
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type Simplify<T> = { [K in keyof T]: T[K] extends object ? (T[K] extends readonly unknown[] ? T[K] : Simplify<T[K]>) : T[K] } & {};

/** Field names whose schema allows operator Op. */
export type FieldsWithOperator<F extends Fields, Op extends string> = {
  [K in keyof F & string]: Op extends OperatorsOf<F[K]> ? K : never;
}[keyof F & string];

export const isGroup = (n: QueryNode): n is Group => n.kind === 'group';
export const isRule = (n: QueryNode): n is Rule => n.kind === 'rule';
/**
 * Narrows a rule to a plain field compared with a literal `value` (not a field `ref`, a function
 * `call`, or a function on the left side), so
 * `rule.value` gets the precise type for its field and operator.
 */
export const isLiteralRule = <R extends Rule | RuleOf<any>>(rule: R): rule is Exclude<R, { readonly ref: string } | { readonly call: FnCall } | FnRule> =>
  typeof rule.field === 'string' && rule.ref === undefined && rule.call === undefined;

/** The field name of a rule, or undefined when its left side is a function call. */
export const fieldName = (rule: Rule): string | undefined => (typeof rule.field === 'string' ? rule.field : undefined);
