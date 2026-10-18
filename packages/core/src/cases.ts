// Ternary / switch mode (RAQB "case values"): an ordered list of conditions, each with a result.
// The first matching case wins, like a CASE WHEN … THEN … ELSE … END.
import type { Fields } from './fields';
import { compile, type CompileOptions } from './evaluate';
import type { QueryOf, RowOf } from './types';

export interface Case<F extends Fields, V> {
  readonly when: QueryOf<F>;
  readonly then: V;
  /** A display name, e.g. "Route 1". */
  readonly label?: string;
}

export interface CasesOf<F extends Fields, V> {
  readonly cases: readonly Case<F, V>[];
  /** Result when no case matches. */
  readonly otherwise?: V;
}

export interface CaseMatch<V> {
  readonly value: V | undefined;
  /** Index of the matching case, or -1 when `otherwise` was used. */
  readonly index: number;
}

/** Compile every case once; the returned function finds the first match for a row. */
export function compileCases<F extends Fields, V, Row = RowOf<F>>(fields: F, cases: CasesOf<F, V>, options?: CompileOptions<Row>): (row: Row) => CaseMatch<V> {
  const tests = cases.cases.map((c) => compile(fields, c.when, options));
  return (row) => {
    const index = tests.findIndex((t) => t(row));
    return index === -1 ? { value: cases.otherwise, index } : { value: cases.cases[index]!.then, index };
  };
}

export const matchCase = <F extends Fields, V, Row = RowOf<F>>(fields: F, cases: CasesOf<F, V>, row: Row, options?: CompileOptions<Row>): CaseMatch<V> =>
  compileCases(fields, cases, options)(row);
