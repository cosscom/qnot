import type { AnyFieldDef, Fields } from './fields';
import type { OperatorId } from './operators';
import type { Query, QueryNode, QueryOf, Rule, RowOf } from './types';
import { validateRule } from './validate';

export interface CompileOptions<Row> {
  /** Read a field from a row (default: `row[field]`). Use it for nested paths or getters. */
  get?: (row: Row, field: string) => unknown;
  /**
   * What an invalid or incomplete rule evaluates to. `'skip'` (default) ignores it, like the SQL
   * exporters do; `false` makes the containing group fail closed.
   */
  invalidRules?: 'skip' | false;
}

export type Predicate<Row> = (row: Row) => boolean;

const SKIP = Symbol('skip');
type Compiled<Row> = Predicate<Row> | typeof SKIP;

const isNil = (v: unknown) => v === null || v === undefined;

function comparable(def: AnyFieldDef | undefined, v: unknown): unknown {
  if (isNil(v)) return v;
  if (def?.kind === 'date') return typeof v === 'string' || v instanceof Date ? new Date(v as string).getTime() : v;
  if (typeof v === 'string' && def?.kind === 'text' && !def.caseSensitive) return v.toLowerCase();
  return v;
}

const binary: Partial<Record<OperatorId, (a: any, b: any) => boolean>> = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  contains: (a, b) => String(a).includes(b),
  notContains: (a, b) => !String(a).includes(b),
  startsWith: (a, b) => String(a).startsWith(b),
  endsWith: (a, b) => String(a).endsWith(b),
};

function compileRule<Row>(fields: Fields, rule: Rule, get: (row: Row, field: string) => unknown, invalid: 'skip' | false): Compiled<Row> {
  if (validateRule(fields, rule).length) return invalid === 'skip' ? SKIP : () => false;
  const def = fields[rule.field];
  const field = rule.field;
  const norm = (v: unknown) => comparable(def, v);
  const op = rule.operator;

  if (op === 'isNull') return (row) => isNil(get(row, field)) || get(row, field) === '';
  if (op === 'isNotNull') return (row) => !isNil(get(row, field)) && get(row, field) !== '';

  if (rule.ref !== undefined) {
    const ref = rule.ref;
    const cmp = binary[op]!;
    return (row) => {
      const a = get(row, field);
      const b = get(row, ref);
      return !isNil(a) && !isNil(b) && cmp(norm(a), norm(b));
    };
  }

  if (op === 'between' || op === 'notBetween') {
    const [lo, hi] = (rule.value as unknown[]).map(norm) as [any, any];
    const inside = (row: Row) => {
      const v = norm(get(row, field)) as any;
      return !isNil(v) && v >= lo && v <= hi;
    };
    return op === 'between' ? inside : (row) => !isNil(get(row, field)) && !inside(row);
  }

  if (op === 'in' || op === 'notIn') {
    const set = new Set((rule.value as unknown[]).map(norm));
    return op === 'in' ? (row) => set.has(norm(get(row, field))) : (row) => !isNil(get(row, field)) && !set.has(norm(get(row, field)));
  }

  const cmp = binary[op];
  if (!cmp) return invalid === 'skip' ? SKIP : () => false;
  const b = norm(rule.value);
  return (row) => {
    const a = get(row, field);
    return !isNil(a) && cmp(norm(a), b);
  };
}

function compileNode<Row>(fields: Fields, node: QueryNode, get: (row: Row, field: string) => unknown, invalid: 'skip' | false): Compiled<Row> {
  if (node.kind === 'rule') return compileRule(fields, node, get, invalid);
  const parts = node.children.map((c) => compileNode(fields, c, get, invalid)).filter((p): p is Predicate<Row> => p !== SKIP);
  if (!parts.length) return SKIP;
  const all = node.combinator === 'and' ? (row: Row) => parts.every((p) => p(row)) : (row: Row) => parts.some((p) => p(row));
  return node.not ? (row) => !all(row) : all;
}

/**
 * Compile a query once into a fast predicate. An empty query (or one whose rules are all skipped)
 * matches every row.
 */
export function compile<F extends Fields, Row = RowOf<F>>(fields: F, query: QueryOf<F>, options: CompileOptions<Row> = {}): Predicate<Row> {
  const get = options.get ?? ((row: Row, field: string) => (row as Record<string, unknown>)[field]);
  const p = compileNode<Row>(fields, query as Query, get, options.invalidRules ?? 'skip');
  return p === SKIP ? () => true : p;
}

export function matches<F extends Fields, Row = RowOf<F>>(fields: F, query: QueryOf<F>, row: Row, options?: CompileOptions<Row>): boolean {
  return compile(fields, query, options)(row);
}
