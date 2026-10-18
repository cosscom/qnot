import type { AnyFieldDef, Fields } from './fields';
import { evaluateOperand, isFnCall } from './functions';
import { operatorInfo } from './operators';
import { leftDef } from './scope';
import type { Group, Query, QueryNode, QueryOf, Quantifier, Rule, RowOf } from './types';
import { groupScope, validateRule } from './validate';

export interface CompileOptions<Row> {
  /** Read a field from a row (default: `row[field]`, following dotted struct paths). */
  get?: (row: Row, field: string) => unknown;
  /**
   * What an invalid or incomplete rule evaluates to. `'skip'` (default) ignores it, like the SQL
   * exporters do; `false` makes the containing group fail closed.
   */
  invalidRules?: 'skip' | false;
}

export type Predicate<Row> = (row: Row) => boolean;

const SKIP = Symbol('skip');
type Compiled = Predicate<any> | typeof SKIP;
type Getter = (row: any, field: string) => unknown;

const isNil = (v: unknown) => v === null || v === undefined;
const isBlank = (v: unknown) => isNil(v) || v === '' || (Array.isArray(v) && v.length === 0);

/** Default getter: plain keys first, then dotted paths into nested objects. */
export function getPath(row: unknown, field: string): unknown {
  if (row === null || typeof row !== 'object') return undefined;
  const r = row as Record<string, unknown>;
  if (field in r || !field.includes('.')) return r[field];
  let cur: unknown = row;
  for (const part of field.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function normalizer(def: AnyFieldDef | undefined): (v: unknown) => unknown {
  switch (def?.kind) {
    case 'date':
    case 'datetime':
      return (v) => (typeof v === 'string' || v instanceof Date ? new Date(v as string).getTime() : v);
    case 'text':
      return def.caseSensitive ? (v) => v : (v) => (typeof v === 'string' ? v.toLowerCase() : v);
    default:
      return (v) => v;
  }
}

const binary: Record<string, (a: any, b: any) => boolean> = {
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

function compileRule(fields: Fields, rule: Rule, get: Getter, invalid: 'skip' | false): Compiled {
  if (validateRule(fields, rule).length) return invalid === 'skip' ? SKIP : () => false;
  const def = leftDef(fields, rule.field);
  const norm = normalizer(def);
  const op = rule.operator;
  const left = rule.field;
  const read: (row: any) => unknown = isFnCall(left) ? (row) => evaluateOperand(fields, left, row, get) : (row) => get(row, left);
  const info = operatorInfo(fields, op);

  if (info?.evaluate) {
    const evaluate = info.evaluate;
    const operand = rule.value;
    return (row) => evaluate(read(row), operand);
  }

  switch (op) {
    case 'isNull':
      return (row) => isNil(read(row));
    case 'isNotNull':
      return (row) => !isNil(read(row));
    case 'isEmpty':
      return (row) => isBlank(read(row));
    case 'isNotEmpty':
      return (row) => !isBlank(read(row));
  }

  if (rule.ref !== undefined || rule.call !== undefined) {
    const cmp = binary[op]!;
    const rhs: (row: any) => unknown = rule.ref !== undefined ? ((ref) => (row: any) => get(row, ref))(rule.ref) : ((call) => (row: any) => evaluateOperand(fields, call, row, get))(rule.call!);
    return (row) => {
      const a = read(row);
      const b = rhs(row);
      return !isNil(a) && !isNil(b) && cmp(norm(a), norm(b));
    };
  }

  const value = rule.value;
  if (op === 'between' || op === 'notBetween') {
    const [lo, hi] = (value as unknown[]).map(norm) as [any, any];
    const inside = (row: any) => {
      const v = norm(read(row)) as any;
      return !isNil(v) && v >= lo && v <= hi;
    };
    return op === 'between' ? inside : (row) => !isNil(read(row)) && !inside(row);
  }

  if (op === 'in' || op === 'notIn') {
    const set = new Set((value as unknown[]).map(norm));
    return op === 'in' ? (row) => set.has(norm(read(row))) : (row) => !isNil(read(row)) && !set.has(norm(read(row)));
  }

  if (op === 'hasAny' || op === 'hasAll' || op === 'hasNone' || op === 'setEq' || op === 'setNeq') {
    const wanted = (value as unknown[]).map(norm);
    const wantedSet = new Set(wanted);
    const asSet = (row: any) => {
      const v = read(row);
      return Array.isArray(v) ? new Set(v.map(norm)) : null;
    };
    switch (op) {
      case 'hasAny':
        return (row) => !!asSet(row) && wanted.some((w) => asSet(row)!.has(w));
      case 'hasAll':
        return (row) => {
          const s = asSet(row);
          return !!s && wanted.every((w) => s.has(w));
        };
      case 'hasNone':
        return (row) => {
          const s = asSet(row);
          return !!s && !wanted.some((w) => s.has(w));
        };
      default: {
        const eq = (row: any) => {
          const s = asSet(row);
          return !!s && s.size === wantedSet.size && [...s].every((x) => wantedSet.has(x));
        };
        return op === 'setEq' ? eq : (row) => !!asSet(row) && !eq(row);
      }
    }
  }

  const cmp = binary[op];
  if (!cmp) return invalid === 'skip' ? SKIP : () => false;
  const b = norm(value);
  return (row) => {
    const a = read(row);
    return !isNil(a) && cmp(norm(a), b);
  };
}

function quantify(match: Quantifier, test: Predicate<unknown>): (items: readonly unknown[]) => boolean {
  if (match === 'some') return (items) => items.some(test);
  if (match === 'all') return (items) => items.every(test);
  if (match === 'none') return (items) => !items.some(test);
  const count = (items: readonly unknown[]) => items.reduce<number>((n, x) => n + (test(x) ? 1 : 0), 0);
  if (match.count === 'between') {
    const [lo, hi] = match.value;
    return (items) => {
      const n = count(items);
      return n >= lo && n <= hi;
    };
  }
  const cmp = binary[match.count]!;
  const target = match.value;
  return (items) => cmp(count(items), target);
}

function compileNode(fields: Fields, node: QueryNode, get: Getter, invalid: 'skip' | false): Compiled {
  if (node.kind === 'rule') return compileRule(fields, node, get, invalid);
  return compileGroup(fields, node, get, invalid);
}

function compileGroup(fields: Fields, node: Group, get: Getter, invalid: 'skip' | false): Compiled {
  const scope = groupScope(fields, node);
  // Inside an array group, rules read the element's own fields.
  const innerGet: Getter = node.of ? getPath : get;
  const parts = node.children.map((c) => compileNode(scope, c, innerGet, invalid)).filter((p): p is Predicate<any> => p !== SKIP);
  const all: Predicate<any> = !parts.length ? () => true : node.combinator === 'and' ? (row) => parts.every((p) => p(row)) : (row) => parts.some((p) => p(row));
  let pred: Predicate<any> = all;
  if (node.of) {
    const field = node.of.field;
    const q = quantify(node.of.match, all);
    pred = (row) => {
      const items = get(row, field);
      return q(Array.isArray(items) ? items : []);
    };
  } else if (!parts.length) return SKIP;
  return node.not ? (row) => !pred(row) : pred;
}

/**
 * Compile a query once into a fast predicate. An empty query (or one whose rules are all skipped)
 * matches every row.
 */
export function compile<F extends Fields, Row = RowOf<F>>(fields: F, query: QueryOf<F>, options: CompileOptions<Row> = {}): Predicate<Row> {
  const get = (options.get ?? getPath) as Getter;
  const p = compileNode(fields, query as Query, get, options.invalidRules ?? 'skip');
  return p === SKIP ? () => true : p;
}

export function matches<F extends Fields, Row = RowOf<F>>(fields: F, query: QueryOf<F>, row: Row, options?: CompileOptions<Row>): boolean {
  return compile(fields, query, options)(row);
}
