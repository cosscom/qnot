// A small recursive-descent parser for SQL WHERE clauses, used by the sql codec's decode.
// Supports comparisons, LIKE/ILIKE patterns, IN, BETWEEN, IS [NOT] NULL, AND/OR/NOT, parentheses,
// quoted identifiers and string/number/boolean literals, plus registered functions whose sql format
// is `NAME(arg, …)` or a constant (`CURRENT_DATE`).
import { columnOf, registryOf, type Fields } from '../fields';
import type { FnCall, Operand } from '../functions';
import type { Group, QueryNode, Rule } from '../types';
import { coerceScalar, group, negated } from './_util';

// SQL literals are typed already; only reinterpret numbers/booleans for the field, keep ''.
const coerce = (def: Parameters<typeof coerceScalar>[0], v: unknown) => (v === '' ? '' : coerceScalar(def, v));

type Tok =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'id'; v: string; quoted: boolean }
  | { t: 'op'; v: string }
  | { t: 'end' };

function tokenize(src: string, dialect: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const fail = (msg: string): never => {
    throw new Error(`trawlnet/sql: ${msg} at position ${i} in: ${src}`);
  };
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "'") {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) fail('unterminated string');
        const ch = src[i]!;
        if (ch === "'" && src[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (ch === "'") {
          i++;
          break;
        } else if (ch === '\\' && dialect === 'mysql') {
          s += src[i + 1] ?? '';
          i += 2;
        } else {
          s += ch;
          i++;
        }
      }
      out.push({ t: 'str', v: s });
      continue;
    }
    const close = c === '"' ? '"' : c === '`' ? '`' : c === '[' ? ']' : null;
    if (close) {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) fail('unterminated identifier');
        if (src[i] === close && src[i + 1] === close) {
          s += close;
          i += 2;
        } else if (src[i] === close) {
          i++;
          break;
        } else s += src[i++];
      }
      out.push({ t: 'id', v: s, quoted: true });
      continue;
    }
    const num = /^\d+(\.\d+)?([eE][-+]?\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(src.slice(i));
    if (word) {
      out.push({ t: 'id', v: word[0], quoted: false });
      i += word[0].length;
      continue;
    }
    const sym = /^(<>|!=|<=|>=|=|<|>|\(|\)|,|\.|-)/.exec(src.slice(i));
    if (sym) {
      out.push({ t: 'op', v: sym[0] });
      i += sym[0].length;
      continue;
    }
    if (c === '?' || c === '$' || c === ':' || c === '@') fail('parameter placeholders cannot be decoded');
    fail(`unexpected "${c}"`);
  }
  out.push({ t: 'end' });
  return out;
}

type Operandish =
  | { k: 'col'; name: string }
  | { k: 'len'; name: string }
  | { k: 'lit'; v: unknown }
  | { k: 'call'; call: FnCall };

/** A parse result: a node, or a constant from `1 = 1` / `TRUE` / `1 = 0`. */
type Parsed = QueryNode | boolean;

/** Array length functions the encoder emits for multiEnum emptiness checks. */
const LENGTH_FNS = new Set(['CARDINALITY', 'JSON_LENGTH', 'JSON_ARRAY_LENGTH', 'JSONB_ARRAY_LENGTH']);

const CMP: Record<string, string> = { '=': 'eq', '<>': 'neq', '!=': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' };
const FLIP: Record<string, string> = { eq: 'eq', neq: 'neq', lt: 'gt', lte: 'gte', gt: 'lt', gte: 'lte' };

/** Registered functions whose sql output is `NAME(${a}, ${b})` (arg order) or a constant. */
function sqlFunctions(fields: Fields) {
  const calls = new Map<string, { fn: string; args: string[] }>();
  const constants = new Map<string, string>();
  for (const [fn, def] of Object.entries(registryOf(fields).functions)) {
    const format = def.formats?.sql;
    if (!format) continue;
    const names = Object.keys(def.args);
    const marks = Object.fromEntries(names.map((n) => [n, `\u0001${n}\u0001`]));
    let out: unknown;
    try {
      out = format(marks, marks);
    } catch {
      continue;
    }
    if (typeof out !== 'string') continue;
    if (!names.length) {
      constants.set(out.toUpperCase(), fn);
      continue;
    }
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/.exec(out);
    if (!m) continue;
    const args = m[2]!.split(',').map((s) => s.trim());
    const order = args.map((a) => /^\u0001(.+)\u0001$/.exec(a)?.[1]);
    if (order.some((o) => !o) || order.length !== names.length) continue;
    calls.set(m[1]!.toUpperCase(), { fn, args: order as string[] });
  }
  return { calls, constants };
}

export function parseSqlWhere(src: string, fields: Fields, dialect: string): Group {
  const toks = tokenize(src, dialect);
  let p = 0;
  const peek = () => toks[p]!;
  const next = () => toks[p++]!;
  const isKw = (t: Tok, kw: string) => t.t === 'id' && !t.quoted && t.v.toUpperCase() === kw;
  const acceptKw = (kw: string) => (isKw(peek(), kw) ? (p++, true) : false);
  const acceptOp = (op: string) => {
    const t = peek();
    return t.t === 'op' && t.v === op ? (p++, true) : false;
  };
  const fail = (msg: string): never => {
    throw new Error(`trawlnet/sql: ${msg} in: ${src}`);
  };
  const expectOp = (op: string) => {
    if (!acceptOp(op)) fail(`expected "${op}"`);
  };

  const byColumn = new Map(Object.keys(fields).map((name) => [columnOf(fields, name), name]));
  const fieldFor = (path: string) => byColumn.get(path) ?? path;
  const { calls, constants } = sqlFunctions(fields);

  const toOperand = (o: Operandish): Operand => (o.k === 'col' || o.k === 'len' ? { ref: o.name } : o.k === 'call' ? o.call : { value: o.v });

  function operand(): Operandish {
    const t = next();
    if (t.t === 'str') return { k: 'lit', v: t.v };
    if (t.t === 'num') return { k: 'lit', v: t.v };
    if (t.t === 'op' && t.v === '-') {
      const n = next();
      if (n.t !== 'num') fail('expected a number after "-"');
      return { k: 'lit', v: -(n as { v: number }).v };
    }
    if (t.t !== 'id') return fail('expected a column or value');
    if (!t.quoted) {
      const up = t.v.toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') return { k: 'lit', v: up === 'TRUE' };
      if (up === 'NULL') return { k: 'lit', v: null };
      const constant = constants.get(up);
      if (constant && !(peek().t === 'op' && (peek() as { v: string }).v === '(')) return { k: 'call', call: { fn: constant, args: {} } };
      if (peek().t === 'op' && (peek() as { v: string }).v === '(') {
        p++;
        const args: Operandish[] = [];
        if (!acceptOp(')')) {
          do args.push(operand());
          while (acceptOp(','));
          expectOp(')');
        }
        if (LENGTH_FNS.has(up) && args.length === 1 && args[0]!.k === 'col') return { k: 'len', name: (args[0] as { name: string }).name };
        const known = calls.get(up);
        if (!known || known.args.length !== args.length) return fail(`unknown function ${t.v}()`);
        return { k: 'call', call: { fn: known.fn, args: Object.fromEntries(known.args.map((name, i) => [name, toOperand(args[i]!)])) } };
      }
    }
    const parts = [t.v];
    while (peek().t === 'op' && (peek() as { v: string }).v === '.') {
      p++;
      const seg = next();
      if (seg.t !== 'id') fail('expected an identifier after "."');
      parts.push((seg as { v: string }).v);
    }
    return { k: 'col', name: fieldFor(parts.join('.')) };
  }

  const lit = (o: Operandish): unknown => {
    if (o.k !== 'lit') fail('expected a literal');
    return (o as { v: unknown }).v;
  };

  /** LIKE pattern → operator and plain text. */
  function likeRule(field: string | FnCall, pattern: string, escape: string, negate: boolean): QueryNode {
    let text = '';
    let lead = false;
    let trail = false;
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i]!;
      if (c === escape && i + 1 < pattern.length) text += pattern[++i];
      else if (c === '%') {
        if (i === 0) lead = true;
        else if (i === pattern.length - 1) trail = true;
        else fail('LIKE patterns with inner "%" cannot be decoded');
      } else if (c === '_') fail('LIKE patterns with "_" wildcards cannot be decoded');
      else text += c;
    }
    const operator = lead && trail ? 'contains' : lead ? 'endsWith' : trail ? 'startsWith' : 'eq';
    if (!negate) return { kind: 'rule', field, operator, value: text };
    if (operator === 'contains') return { kind: 'rule', field, operator: 'notContains', value: text };
    if (operator === 'eq') return { kind: 'rule', field, operator: 'neq', value: text };
    return negated({ kind: 'rule', field, operator, value: text });
  }

  const defOf = (o: Operandish) => (o.k === 'col' ? fields[o.name] : undefined);

  function predicate(): Parsed {
    const left = operand();
    const t = peek();
    if (t.t === 'op' && CMP[t.v]) {
      p++;
      const right = operand();
      let op = CMP[t.v]!;
      if (left.k === 'len' && right.k === 'lit' && right.v === 0 && (op === 'eq' || op === 'gt')) {
        return { kind: 'rule', field: left.name, operator: op === 'eq' ? 'isEmpty' : 'isNotEmpty' };
      }
      if (left.k === 'len' || right.k === 'len') return fail('array length comparisons other than = 0 / > 0 cannot be decoded');
      if (left.k === 'lit' && right.k === 'lit') {
        const r = { eq: left.v === right.v, neq: left.v !== right.v } as Record<string, boolean>;
        if (op in r) return r[op]!;
        return fail('cannot decode a comparison between two literals');
      }
      let l = left;
      let r = right;
      if (l.k === 'lit') {
        [l, r] = [r, l];
        op = FLIP[op]!;
      }
      const field = l.k === 'col' ? l.name : (l as { call: FnCall }).call;
      if (r.k === 'col') return { kind: 'rule', field, operator: op, ref: r.name };
      if (r.k === 'call') return { kind: 'rule', field, operator: op, call: r.call };
      if (r.v === null && (op === 'eq' || op === 'neq')) return { kind: 'rule', field, operator: op === 'eq' ? 'isNull' : 'isNotNull' };
      return { kind: 'rule', field, operator: op, value: coerce(defOf(l), r.v) };
    }
    if (left.k === 'lit') {
      if (typeof left.v === 'boolean') return left.v;
      return fail('expected a predicate');
    }
    if (left.k === 'len') return fail('expected a comparison after an array length');
    const field = left.k === 'col' ? left.name : (left as { call: FnCall }).call;
    const def = defOf(left);
    if (acceptKw('IS')) {
      const not = acceptKw('NOT');
      if (!acceptKw('NULL')) fail('expected NULL');
      return { kind: 'rule', field, operator: not ? 'isNotNull' : 'isNull' };
    }
    const not = acceptKw('NOT');
    if (acceptKw('IN')) {
      expectOp('(');
      const values: unknown[] = [];
      if (!acceptOp(')')) {
        do values.push(coerce(def, lit(operand())));
        while (acceptOp(','));
        expectOp(')');
      }
      return { kind: 'rule', field, operator: not ? 'notIn' : 'in', value: values };
    }
    if (acceptKw('BETWEEN')) {
      const lo = coerce(def, lit(operand()));
      if (!acceptKw('AND')) fail('expected AND in BETWEEN');
      const hi = coerce(def, lit(operand()));
      return { kind: 'rule', field, operator: not ? 'notBetween' : 'between', value: [lo, hi] };
    }
    if (acceptKw('LIKE') || acceptKw('ILIKE')) {
      const pattern = lit(operand());
      if (typeof pattern !== 'string') fail('expected a LIKE pattern string');
      let escape = '\\';
      if (acceptKw('ESCAPE')) {
        const e = lit(operand());
        if (typeof e !== 'string' || e.length !== 1) fail('ESCAPE must be one character');
        escape = e as string;
      }
      return likeRule(field, pattern as string, escape, not);
    }
    return fail('expected a comparison');
  }

  function primary(): Parsed {
    if (acceptOp('(')) {
      const inner = or();
      expectOp(')');
      return inner;
    }
    return predicate();
  }

  function not(): Parsed {
    if (acceptKw('NOT')) {
      const inner = not();
      if (typeof inner === 'boolean') return !inner;
      return inner.kind === 'group' ? group(inner.combinator, [...inner.children], !inner.not) : negated(inner);
    }
    return primary();
  }

  function chain(combinator: 'and' | 'or', item: () => Parsed): Parsed {
    const items = [item()];
    while (acceptKw(combinator.toUpperCase())) items.push(item());
    if (items.length === 1) return items[0]!;
    // Constants: TRUE in AND / FALSE in OR drop out; the others decide the whole chain.
    const neutral = combinator === 'and';
    if (items.some((x) => x === !neutral)) return !neutral;
    const nodes = items.filter((x): x is QueryNode => typeof x !== 'boolean');
    if (!nodes.length) return neutral;
    return simplify(group(combinator, nodes));
  }

  const and = () => chain('and', not);
  function or(): Parsed {
    return chain('or', and);
  }

  const result = or();
  if (peek().t !== 'end') fail('unexpected trailing input');
  if (result === true) return group('and', []);
  if (result === false) return fail('a query that is always false cannot be represented');
  return result.kind === 'group' && !result.not ? result : group('and', [result]);
}

/** Recognize the isEmpty/isNotEmpty shapes the encoder emits: `(c IS NULL OR c = '')`. */
function simplify(g: Group): QueryNode {
  if (g.not || g.children.length !== 2) return g;
  const [a, b] = g.children as [QueryNode, QueryNode];
  if (a.kind !== 'rule' || b.kind !== 'rule' || typeof a.field !== 'string' || a.field !== b.field) return g;
  const rule = (operator: string): Rule => ({ kind: 'rule', field: a.field, operator });
  if (g.combinator === 'or' && a.operator === 'isNull' && ((b.operator === 'eq' && b.value === '') || b.operator === 'isEmpty')) return rule('isEmpty');
  if (g.combinator === 'and' && a.operator === 'isNotNull' && ((b.operator === 'neq' && b.value === '') || b.operator === 'isNotEmpty')) return rule('isNotEmpty');
  return g;
}

