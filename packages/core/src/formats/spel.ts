import type { CodecContext, Format } from '../codec';
import { columnOf, registryOf, type AnyFieldDef, type Fields } from '../fields';
import type { ComparableOp } from '../operators';
import { elementFields } from '../scope';
import type { Group, Quantifier, Query, QueryNode, Rule } from '../types';
import { coerceScalar, encodeCall, encodeIn, group, groupScope, infoOf, isArrayGroupIn, isCompleteRule, isFnCall, negated, ruleDef, type FnCall, type Operand } from './_util';

export interface SpelFragment {
  readonly text: string;
  readonly compound: boolean;
}

const CMP: Record<string, string> = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' };
const TEMPORAL = new Set(['date', 'time', 'datetime']);
const pad = (n: number) => String(n).padStart(2, '0');

const str = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** A literal; dates/times as java.time parses like RAQB's spelFormat (datetimes in UTC). */
function literal(def: AnyFieldDef | undefined, v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (def?.kind === 'date') return `T(java.time.LocalDate).parse(${str(s)}, T(java.time.format.DateTimeFormatter).ofPattern('yyyy-MM-dd'))`;
  if (def?.kind === 'time') return `T(java.time.LocalTime).parse(${str(/^\d\d:\d\d$/.test(s) ? `${s}:00` : s)})`;
  if (def?.kind === 'datetime') {
    const d = new Date(s);
    const text = Number.isNaN(d.getTime())
      ? s
      : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    return `T(java.time.LocalDateTime).parse(${str(text)}, T(java.time.format.DateTimeFormatter).ofPattern('yyyy-MM-dd HH:mm:ss'))`;
  }
  return str(s);
}

const list = (def: AnyFieldDef | undefined, vs: unknown) => `{${(vs as unknown[]).map((x) => literal(def, x)).join(', ')}}`;

function encodeRule(rule: Rule, { fields }: CodecContext): SpelFragment | undefined {
  if (!isCompleteRule(fields, rule)) return undefined;
  const def = ruleDef(fields, rule);
  const arg = (o: Operand, d?: AnyFieldDef): string | undefined => (isFnCall(o) ? encodeCall('spel', fields, o, arg) : 'ref' in o ? columnOf(fields, o.ref) : literal(d, o.value));
  const x = isFnCall(rule.field) ? arg(rule.field) : columnOf(fields, rule.field);
  if (x === undefined) return undefined;
  const info = infoOf(fields, rule.operator);
  const v = rule.value;
  const atom = (text: string): SpelFragment => ({ text, compound: false });
  if (info.formats?.spel) return atom(String(info.formats.spel({ field: x, value: v, raw: v })));
  const temporal = TEMPORAL.has(def?.kind ?? '');
  const cmp = (op: string, rhs: string) => (temporal ? `${x}.compareTo(${rhs}) ${CMP[op]} 0` : `${x} ${CMP[op]} ${rhs}`);

  if (rule.ref !== undefined) return atom(cmp(rule.operator, columnOf(fields, rule.ref)));
  if (rule.call !== undefined) {
    const rhs = arg(rule.call, def);
    return rhs === undefined ? undefined : atom(cmp(rule.operator, rhs));
  }
  switch (rule.operator) {
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return atom(cmp(rule.operator, literal(def, v)));
    case 'isNull':
      return atom(`${x} == null`);
    case 'isNotNull':
      return atom(`${x} != null`);
    // RAQB's convention for every kind; decode also accepts `(x == null || x.isEmpty())`.
    case 'isEmpty':
      return atom(`${x} <= ''`);
    case 'isNotEmpty':
      return atom(`${x} > ''`);
    case 'contains':
      return atom(`${x}.contains(${str(String(v))})`);
    case 'notContains':
      return atom(`!(${x}.contains(${str(String(v))}))`);
    case 'startsWith':
      return atom(`${x}.startsWith(${str(String(v))})`);
    case 'endsWith':
      return atom(`${x}.endsWith(${str(String(v))})`);
    case 'between':
    case 'notBetween': {
      const [lo, hi] = v as [unknown, unknown];
      return atom(rule.operator === 'between' ? `(${cmp('gte', literal(def, lo))} && ${cmp('lte', literal(def, hi))})` : `(${cmp('lt', literal(def, lo))} || ${cmp('gt', literal(def, hi))})`);
    }
    case 'in':
      return atom(`${list(def, v)}.?[true].contains(${x})`);
    case 'notIn':
      return atom(`!(${list(def, v)}.?[true].contains(${x}))`);
    case 'hasAny':
      return atom(`T(CollectionUtils).containsAny(${x}, ${list(def, v)})`);
    case 'hasNone':
      return atom(`!(T(CollectionUtils).containsAny(${x}, ${list(def, v)}))`);
    case 'hasAll':
      return atom(`${x}.containsAll(${list(def, v)})`);
    case 'setEq':
      return atom(`${x}.equals(${list(def, v)})`);
    case 'setNeq':
      return atom(`!(${x}.equals(${list(def, v)}))`);
  }
  return undefined;
}

const join = (g: Pick<Group, 'combinator'>, kids: SpelFragment[]): SpelFragment | undefined => {
  if (!kids.length) return undefined;
  if (kids.length === 1) return kids[0];
  return { text: kids.map((k) => (k.compound ? `(${k.text})` : k.text)).join(g.combinator === 'and' ? ' && ' : ' || '), compound: true };
};

function quantify(col: string, cond: string, m: Quantifier): string {
  const size = `${col}.?[${cond}].size()`;
  if (m === 'some') return `${size} > 0`;
  if (m === 'none') return `${size} == 0`;
  if (m === 'all') return `${size} == ${col}.size()`;
  if (m.count === 'between') return `(${size} >= ${m.value[0]} && ${size} <= ${m.value[1]})`;
  return `${size} ${CMP[m.count]} ${m.value}`;
}

function encodeGroup(g: Group, children: SpelFragment[], ctx: CodecContext): SpelFragment | undefined {
  let out: SpelFragment | undefined;
  if (g.of) {
    if (!isArrayGroupIn(ctx.fields, g)) return undefined;
    const inner = join(g, encodeIn(spel, g.children, { fields: groupScope(ctx.fields, g) }));
    out = { text: quantify(columnOf(ctx.fields, g.of.field), inner?.text ?? 'true', g.of.match), compound: false };
  } else out = join(g, children);
  if (!out) return undefined;
  return g.not ? { text: `!(${out.text})`, compound: false } : out;
}

// --- parser ------------------------------------------------------------------------------------

type Ast =
  | { k: 'lit'; v: unknown }
  | { k: 'list'; items: Ast[] }
  | { k: 'path'; parts: string[] }
  | { k: 'type'; name: string }
  | { k: 'call'; target: Ast; method: string; args: Ast[] }
  | { k: 'select'; target: Ast; cond: Ast }
  | { k: 'cmp'; op: string; l: Ast; r: Ast }
  | { k: 'not'; e: Ast }
  | { k: 'and' | 'or'; items: Ast[] };

function parse(src: string): Ast {
  let i = 0;
  const fail = (msg: string): never => {
    throw new Error(`trawlnet/spel: ${msg} at position ${i} in: ${src}`);
  };
  const ws = () => {
    while (i < src.length && /\s/.test(src[i]!)) i++;
  };
  const eat = (s: string) => {
    ws();
    if (src.startsWith(s, i)) {
      i += s.length;
      return true;
    }
    return false;
  };
  const expect = (s: string) => {
    if (!eat(s)) fail(`expected "${s}"`);
  };
  const ident = (): string | undefined => {
    ws();
    const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
    if (!m) return undefined;
    i += m[0].length;
    return m[0];
  };
  const word = (w: string) => {
    ws();
    const m = new RegExp(`^${w}\\b`, 'i').exec(src.slice(i));
    if (!m) return false;
    i += m[0].length;
    return true;
  };

  function or(): Ast {
    const items = [and()];
    while (eat('||') || word('or')) items.push(and());
    return items.length === 1 ? items[0]! : { k: 'or', items };
  }
  function and(): Ast {
    const items = [unary()];
    while (eat('&&') || word('and')) items.push(unary());
    return items.length === 1 ? items[0]! : { k: 'and', items };
  }
  function unary(): Ast {
    ws();
    if (src[i] === '!' && src[i + 1] !== '=') {
      i++;
      return { k: 'not', e: unary() };
    }
    if (word('not')) return { k: 'not', e: unary() };
    return comparison();
  }
  function comparison(): Ast {
    const l = postfix();
    for (const op of ['==', '!=', '<=', '>=', '<', '>']) {
      if (eat(op)) return { k: 'cmp', op, l, r: postfix() };
    }
    return l;
  }
  function postfix(): Ast {
    let e = primary();
    for (;;) {
      if (eat('.?[')) {
        const cond = or();
        expect(']');
        e = { k: 'select', target: e, cond };
      } else if (eat('.')) {
        const name = ident() ?? fail('expected a property or method');
        if (eat('(')) {
          const args: Ast[] = [];
          if (!eat(')')) {
            do args.push(or());
            while (eat(','));
            expect(')');
          }
          e = { k: 'call', target: e, method: name, args };
        } else if (e.k === 'path') e = { k: 'path', parts: [...e.parts, name] };
        else fail('unexpected property access');
      } else return e;
    }
  }
  function primary(): Ast {
    ws();
    const c = src[i];
    if (c === '(') {
      i++;
      const e = or();
      expect(')');
      return e;
    }
    if (c === '{') {
      i++;
      const items: Ast[] = [];
      if (!eat('}')) {
        do items.push(or());
        while (eat(','));
        expect('}');
      }
      return { k: 'list', items };
    }
    if (c === "'") {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) fail('unterminated string');
        if (src[i] === "'" && src[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (src[i] === "'") {
          i++;
          break;
        } else s += src[i++];
      }
      return { k: 'lit', v: s };
    }
    const num = /^-?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      return { k: 'lit', v: Number(num[0]) };
    }
    const id = ident() ?? fail('unexpected input');
    if (id === 'T' && eat('(')) {
      const parts = [ident() ?? fail('expected a type')];
      while (eat('.')) parts.push(ident() ?? fail('expected a type'));
      expect(')');
      return { k: 'type', name: parts.join('.') };
    }
    if (id === 'true' || id === 'false') return { k: 'lit', v: id === 'true' };
    if (id === 'null') return { k: 'lit', v: null };
    return { k: 'path', parts: [id] };
  }

  const out = or();
  ws();
  if (i < src.length) fail('unexpected trailing input');
  return out;
}

const print = (a: Ast): string => {
  switch (a.k) {
    case 'lit':
      return typeof a.v === 'string' ? str(a.v) : String(a.v);
    case 'list':
      return `{${a.items.map(print).join(', ')}}`;
    case 'path':
      return a.parts.join('.');
    case 'type':
      return `T(${a.name})`;
    case 'call':
      return `${print(a.target)}.${a.method}(${a.args.map(print).join(', ')})`;
    default:
      return '';
  }
};

/** Registered functions whose spel format is a constant or `${arg}.method()`. */
function spelFunctions(fields: Fields) {
  const constants = new Map<string, string>();
  const methods = new Map<string, { fn: string; arg: string }>();
  for (const [fn, def] of Object.entries(registryOf(fields).functions)) {
    const format = def.formats?.spel;
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
    if (!names.length) constants.set(out, fn);
    const m = /^\u0001(\w+)\u0001\.(\w+)\(\)$/.exec(out);
    if (m && names.length === 1) methods.set(m[2]!, { fn, arg: m[1]! });
  }
  return { constants, methods };
}

function toQuery(ast: Ast, fields: Fields): QueryNode {
  const fns = spelFunctions(fields);
  const fail = (what: Ast): never => {
    throw new Error(`trawlnet/spel: cannot decode ${print(what) || what.k}`);
  };
  const fieldFor = (scope: Fields, path: string) => Object.keys(scope).find((k) => columnOf(scope, k) === path) ?? path;

  /** An operand: a field path, a literal (incl. java.time parses), or a function call. */
  type Side = { k: 'field'; field: string } | { k: 'lit'; v: unknown } | { k: 'call'; call: FnCall };
  function side(a: Ast, scope: Fields): Side {
    if (a.k === 'path') return { k: 'field', field: fieldFor(scope, a.parts.join('.')) };
    if (a.k === 'lit') return { k: 'lit', v: a.v };
    if (a.k === 'list') return { k: 'lit', v: a.items.map((x) => (side(x, scope) as { v: unknown }).v) };
    if (a.k === 'call' && a.method === 'parse' && a.target.k === 'type' && a.args[0]?.k === 'lit') {
      const s = String(a.args[0].v);
      if (a.target.name.endsWith('LocalDateTime')) return { k: 'lit', v: s.replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)$/, '$1T$2Z') };
      if (a.target.name.endsWith('LocalTime')) return { k: 'lit', v: s.replace(/^(\d\d:\d\d):00$/, '$1') };
      return { k: 'lit', v: s };
    }
    const constant = fns.constants.get(print(a));
    if (constant) return { k: 'call', call: { fn: constant, args: {} } };
    if (a.k === 'call' && !a.args.length && fns.methods.has(a.method)) {
      const { fn, arg } = fns.methods.get(a.method)!;
      const inner = side(a.target, scope);
      const operand: Operand = inner.k === 'field' ? { ref: inner.field } : inner.k === 'call' ? inner.call : { value: inner.v };
      return { k: 'call', call: { fn, args: { [arg]: operand } } };
    }
    return fail(a);
  }
  const left = (s: Side, a: Ast): string | FnCall => (s.k === 'field' ? s.field : s.k === 'call' ? s.call : fail(a));
  const coerce = (scope: Fields, field: string | FnCall, v: unknown) => (typeof field === 'string' ? coerceScalar(scope[field], v) : v);

  const OPS: Record<string, ComparableOp> = { '==': 'eq', '!=': 'neq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' };
  const FLIP: Record<ComparableOp, ComparableOp> = { eq: 'eq', neq: 'neq', lt: 'gt', lte: 'gte', gt: 'lt', gte: 'lte' };

  /** `a.?[cond].size()` → the array field and its element condition. */
  const sizeOf = (a: Ast, scope: Fields) =>
    a.k === 'call' && a.method === 'size' && !a.args.length && a.target.k === 'select' && a.target.target.k === 'path'
      ? { field: fieldFor(scope, a.target.target.parts.join('.')), cond: a.target.cond }
      : undefined;

  function arrayGroup(field: string, match: Quantifier, cond: Ast, scope: Fields): Group {
    const inner = elementFields(scope, field);
    if (cond.k === 'lit' && cond.v === true) return { kind: 'group', combinator: 'and', of: { field, match }, children: [] };
    const node = convert(cond, inner);
    const g = node.kind === 'group' && !node.not && !node.of ? node : group('and', [node]);
    return { kind: 'group', combinator: g.combinator, of: { field, match }, children: g.children };
  }

  function cmp(a: Extract<Ast, { k: 'cmp' }>, scope: Fields): QueryNode {
    let op = OPS[a.op]!;
    // Count quantifiers.
    const sized = sizeOf(a.l, scope);
    if (sized) {
      if (a.r.k === 'lit' && typeof a.r.v === 'number') {
        const n = a.r.v;
        const match: Quantifier = op === 'gt' && n === 0 ? 'some' : op === 'eq' && n === 0 ? 'none' : { count: op, value: n };
        return arrayGroup(sized.field, match, sized.cond, scope);
      }
      if (op === 'eq' && a.r.k === 'call' && a.r.method === 'size') return arrayGroup(sized.field, 'all', sized.cond, scope);
      return fail(a);
    }
    // `x.compareTo(y) op 0` for dates and times.
    let l = a.l;
    let r = a.r;
    if (l.k === 'call' && l.method === 'compareTo' && l.args.length === 1 && r.k === 'lit' && r.v === 0) {
      r = l.args[0]!;
      l = l.target;
    }
    let ls = side(l, scope);
    let rs = side(r, scope);
    if (ls.k === 'lit') {
      [ls, rs] = [rs, ls];
      op = FLIP[op];
    }
    const field = left(ls, l);
    if (rs.k === 'field') return { kind: 'rule', field, operator: op, ref: rs.field };
    if (rs.k === 'call') return { kind: 'rule', field, operator: op, call: rs.call };
    if (rs.v === null && (op === 'eq' || op === 'neq')) return { kind: 'rule', field, operator: op === 'eq' ? 'isNull' : 'isNotNull' };
    if (rs.v === '' && (op === 'lte' || op === 'gt')) return { kind: 'rule', field, operator: op === 'lte' ? 'isEmpty' : 'isNotEmpty' };
    return { kind: 'rule', field, operator: op, value: coerce(scope, field, rs.v) };
  }

  function call(a: Extract<Ast, { k: 'call' }>, scope: Fields): QueryNode {
    const arg0 = a.args[0];
    if ((a.method === 'contains' || a.method === 'startsWith' || a.method === 'endsWith') && arg0?.k === 'lit' && typeof arg0.v === 'string' && a.target.k !== 'list' && a.target.k !== 'select') {
      return { kind: 'rule', field: left(side(a.target, scope), a), operator: a.method, value: arg0.v };
    }
    // {…}.?[true].contains(x) or {…}.contains(x)
    if (a.method === 'contains' && arg0) {
      const target = a.target.k === 'select' ? a.target.target : a.target;
      if (target.k === 'list') {
        const field = left(side(arg0, scope), a);
        return { kind: 'rule', field, operator: 'in', value: (side(target, scope) as { v: unknown[] }).v.map((x) => coerce(scope, field, x)) };
      }
    }
    if (a.method === 'containsAny' && a.target.k === 'type' && a.args.length === 2) {
      const field = left(side(a.args[0]!, scope), a);
      return { kind: 'rule', field, operator: 'hasAny', value: (side(a.args[1]!, scope) as { v: unknown[] }).v };
    }
    if ((a.method === 'equals' || a.method === 'containsAll') && arg0?.k === 'list') {
      const field = left(side(a.target, scope), a);
      return { kind: 'rule', field, operator: a.method === 'equals' ? 'setEq' : 'hasAll', value: (side(arg0, scope) as { v: unknown[] }).v };
    }
    return fail(a);
  }

  function convert(a: Ast, scope: Fields): QueryNode {
    switch (a.k) {
      case 'and':
      case 'or': {
        const special = a.k === 'and' ? range(a.items, scope, 'gte', 'lte', 'between') : range(a.items, scope, 'lt', 'gt', 'notBetween');
        if (special) return special;
        const empties = emptiness(a, scope);
        if (empties) return empties;
        return group(a.k, a.items.map((x) => convert(x, scope)));
      }
      case 'not': {
        const inner = convert(a.e, scope);
        if (inner.kind === 'group') return group(inner.combinator, [...inner.children], !inner.not);
        const flip: Record<string, string> = { contains: 'notContains', in: 'notIn', hasAny: 'hasNone', setEq: 'setNeq' };
        if (flip[inner.operator]) return { ...inner, operator: flip[inner.operator]! };
        return negated(inner);
      }
      case 'cmp':
        return cmp(a, scope);
      case 'call':
        return call(a, scope);
      default:
        return fail(a);
    }
  }

  /** `(x >= a && x <= b)` → between; `(x < a || x > b)` → notBetween; count between. */
  function range(items: Ast[], scope: Fields, lo: string, hi: string, operator: 'between' | 'notBetween'): QueryNode | undefined {
    if (items.length !== 2) return undefined;
    const [a, b] = items as [Ast, Ast];
    if (a.k !== 'cmp' || b.k !== 'cmp' || OPS[a.op] !== lo || OPS[b.op] !== hi) return undefined;
    const sized = sizeOf(a.l, scope);
    if (sized && operator === 'between' && print(a.l) === print(b.l) && a.r.k === 'lit' && b.r.k === 'lit') {
      return arrayGroup(sized.field, { count: 'between', value: [a.r.v as number, b.r.v as number] }, sized.cond, scope);
    }
    const x = cmp(a, scope);
    const y = cmp(b, scope);
    if (x.kind !== 'rule' || y.kind !== 'rule' || JSON.stringify(x.field) !== JSON.stringify(y.field) || x.ref || y.ref || x.call || y.call) return undefined;
    return { kind: 'rule', field: x.field, operator, value: [x.value, y.value] };
  }

  /** `(x == null || x.isEmpty())` and its negation, the array emptiness shapes. */
  function emptiness(a: Extract<Ast, { k: 'and' | 'or' }>, scope: Fields): QueryNode | undefined {
    if (a.items.length !== 2) return undefined;
    const [n, e] = a.items as [Ast, Ast];
    const isEmptyCall = (x: Ast) => x.k === 'call' && x.method === 'isEmpty' && !x.args.length;
    if (a.k === 'or' && n.k === 'cmp' && n.op === '==' && n.r.k === 'lit' && n.r.v === null && isEmptyCall(e)) {
      return { kind: 'rule', field: left(side(n.l, scope), n), operator: 'isEmpty' };
    }
    if (a.k === 'and' && n.k === 'cmp' && n.op === '!=' && n.r.k === 'lit' && n.r.v === null && e.k === 'not' && isEmptyCall(e.e)) {
      return { kind: 'rule', field: left(side(n.l, scope), n), operator: 'isNotEmpty' };
    }
    return undefined;
  }

  return convert(ast, fields);
}

function decode(input: string, fields: Fields): Query {
  if (!input.trim()) return group('and', []);
  const node = toQuery(parse(input), fields);
  return node.kind === 'group' && !node.of ? node : group('and', [node]);
}

/**
 * Spring Expression Language, compatible with react-awesome-query-builder's spelFormat /
 * loadFromSpel. Two-way for what it emits. Incomplete rules are left out; the empty query is ''.
 */
export const spel: Format<string, SpelFragment> = {
  name: 'spel',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx),
  encodeGroup: (g, children, ctx) => encodeGroup(g, children, ctx),
  finish: (root) => (!root ? '' : root.compound ? `(${root.text})` : root.text),
  decode: (input, ctx) => decode(input, ctx.fields),
  encodeCases: (whens, otherwise) =>
    whens.reduceRight<string>(
      (rest, { when, then }, i) => `${when ? (when.compound ? `(${when.text})` : when.text) : 'true'} ? ${literal(undefined, then)} : ${i < whens.length - 1 ? `(${rest})` : rest}`,
      literal(undefined, otherwise ?? null),
    ),
};
