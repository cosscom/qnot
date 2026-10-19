import type { Codec, CodecContext } from '../codec';
import { fieldDef, type Fields } from '../fields';
import type { Group, Query, Rule } from '../types';
import { parseSqlWhere } from './_sql-parse';
import {
  caseCondition,
  columnOf,
  encodeCall,
  encodeIn,
  finishRoot,
  groupProblem,
  groupScope,
  infoOf,
  isArrayGroupIn,
  isCompleteRule,
  ruleProblem,
  isFnCall,
  liftChildren,
  ruleDef,
  Unsupported,
  unsupportedReason,
  type EmptyQueryMode,
  type Operand,
  type UnsupportedMode,
} from './_util';

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'ansi';
/** `positional` → `?`, `numbered` → `$1`, `named` → `:p1` (`@p1` on mssql). */
export type SqlParamStyle = 'positional' | 'numbered' | 'named';

export interface SqlOptions {
  dialect?: SqlDialect;
  /** Emit placeholders and return values separately instead of inlining literals. */
  params?: false | SqlParamStyle;
  /** Quote column names for the dialect (`"col"`, `` `col` ``, `[col]`), each path segment separately. */
  quoteIdentifiers?: boolean;
  /** Case-insensitive text matching: ILIKE on Postgres, LOWER(…) elsewhere. */
  caseInsensitive?: boolean;
  /**
   * A valid rule this dialect can't express (array operators on ANSI, array groups outside
   * Postgres, a function with no sql format): `throw` (default) or `skip` it, widening the query.
   */
  unsupported?: UnsupportedMode;
  /** Output for a query with no rules: `1 = 1` (`all`, default), `1 = 0` (`none`), or `throw`. */
  emptyQuery?: EmptyQueryMode;
}

export interface SqlWithParams<P> {
  sql: string;
  params: P;
}

/** A parameter value and the id its placeholder token carries. */
export interface SqlParam {
  readonly id: number;
  readonly value: unknown;
}

/**
 * Intermediate per-node output. Placeholders are `\u0000<id>\u0000` tokens until `finish` numbers
 * them in text order, so a format that reorders or repeats an argument still binds the right value.
 */
export interface SqlFragment {
  readonly sql: string;
  readonly params: readonly SqlParam[];
  /** True when the fragment is an AND/OR chain that needs parentheses inside another chain. */
  readonly compound: boolean;
}

/** Where rules are being rendered: top-level columns, or the elements of a Postgres jsonb array. */
interface SqlContext extends CodecContext {
  /** Alias of the current array element (`e1`) inside an array group. */
  readonly alias?: string;
  readonly depth?: number;
}

/** Placeholder ids, unique per process so memoized fragments can be combined freely. */
let nextParamId = 0;
const TOKEN = /\u0000(\d+)\u0000/g;
/** A safe unquoted identifier segment; anything else needs `quoteIdentifiers: true`. */
const BARE_IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_$]*$/u;
/** The LIKE escape character: not a backslash, so no dialect setting can change its meaning. */
const LIKE_ESCAPE = '!';
const ARRAY_OPS = new Set(['hasAny', 'hasAll', 'hasNone', 'setEq', 'setNeq']);
const CMP: Record<string, string> = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' };
const ELEMENT_CAST: Record<string, string> = { number: 'numeric', boolean: 'boolean', date: 'date', datetime: 'timestamptz', time: 'time' };

export type SqlCodec<T> = Codec<T, SqlFragment> & {
  /** Parse a WHERE clause back into a query (inlined literals only; parameterized SQL can't be decoded). */
  decode(input: string, ctx: CodecContext): Query;
};

export function sqlFormat(options?: SqlOptions & { params?: false }): SqlCodec<string>;
export function sqlFormat(options: SqlOptions & { params: 'named' }): SqlCodec<SqlWithParams<Record<string, unknown>>>;
export function sqlFormat(options: SqlOptions & { params: 'positional' | 'numbered' }): SqlCodec<SqlWithParams<unknown[]>>;
export function sqlFormat(options: SqlOptions = {}): SqlCodec<string | SqlWithParams<unknown[] | Record<string, unknown>>> {
  const dialect = options.dialect ?? 'ansi';
  const paramStyle = options.params || null;
  const modes = { unsupported: options.unsupported ?? 'throw', emptyQuery: options.emptyQuery ?? 'all' } as const;

  const quote = (name: string) => {
    if (!options.quoteIdentifiers) {
      if (!BARE_IDENTIFIER.test(name)) throw new Error(`trawlnet/sql: column name "${name}" isn't a plain identifier; pass \`quoteIdentifiers: true\``);
      return name;
    }
    if (name.includes('\u0000')) throw new Error('trawlnet/sql: column names cannot contain NUL characters');
    if (dialect === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
    if (dialect === 'mssql') return `[${name.replace(/]/g, ']]')}]`;
    return `"${name.replace(/"/g, '""')}"`;
  };

  // String literals that mean the same thing under every server setting: Postgres E'' strings
  // whenever a backslash is present (safe with standard_conforming_strings on or off), MySQL hex
  // literals for backslashes (safe with or without NO_BACKSLASH_ESCAPES), N'' on SQL Server.
  const encoder = new TextEncoder();
  const quoteString = (s: string): string => {
    if (s.includes('\u0000')) throw new Error("trawlnet/sql: string values can't contain NUL (\\u0000) characters");
    const q = s.replace(/'/g, "''");
    if (s.includes('\\')) {
      if (dialect === 'postgres') return `E'${q.replace(/\\/g, '\\\\')}'`;
      if (dialect === 'mysql') return `_utf8mb4 X'${Array.from(encoder.encode(s), (b) => b.toString(16).padStart(2, '0')).join('')}'`;
    }
    return dialect === 'mssql' ? `N'${q}'` : `'${q}'`;
  };

  /** Only JSON scalars are ever written into SQL; anything else is refused. */
  const scalar = (v: unknown): string | number | boolean | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    throw new Error(`trawlnet/sql: refusing to write a ${typeof v === 'object' ? 'non-scalar' : typeof v} value into SQL`);
  };

  const literal = (raw: unknown): string => {
    const v = scalar(raw);
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return dialect === 'mssql' || dialect === 'sqlite' ? (v ? '1' : '0') : v ? 'TRUE' : 'FALSE';
    if (v === null) return 'NULL';
    return quoteString(v);
  };

  // A value either inlined or turned into a placeholder token with its param.
  const val = (raw: unknown): SqlFragment => {
    const v = scalar(raw);
    if (!paramStyle) return { sql: literal(v), params: [], compound: false };
    if (typeof v === 'string' && v.includes('\u0000')) throw new Error("trawlnet/sql: string values can't contain NUL (\\u0000) characters");
    const id = nextParamId++;
    return { sql: `\u0000${id}\u0000`, params: [{ id, value: v }], compound: false };
  };
  const frag = (sql: string, ...parts: SqlFragment[]): SqlFragment => ({ sql, params: parts.flatMap((p) => p.params), compound: false });
  const withParams = (sql: string, params: readonly SqlParam[]): SqlFragment => ({ sql, params, compound: false });
  const likeChars = dialect === 'mssql' ? /[!%_[\]]/g : /[!%_]/g;
  const likePattern = (s: string, pre: string, post: string) => `${pre}${s.replace(likeChars, `${LIKE_ESCAPE}$&`)}${post}`;
  // Always explicit: MySQL and Postgres default to a backslash escape, which would give a value's
  // own backslashes a meaning.
  const escapeClause = (_pattern: string) => ` ESCAPE '${LIKE_ESCAPE}'`;

  /** A column as an expression: quoted path, or a jsonb path (cast for its kind) inside an array element. */
  function column(ctx: SqlContext, name: string, asJson = false): string {
    // Only the schema's own fields become columns, whatever the (untrusted) query says.
    const def = fieldDef(ctx.fields, name);
    if (!def) throw new Error(`trawlnet/sql: unknown field "${String(name).slice(0, 80)}"`);
    const col = columnOf(ctx.fields, name);
    if (!ctx.alias) return col.split('.').map(quote).join('.');
    const parts = col.split('.');
    const last = parts.pop()!;
    const path = [ctx.alias, ...parts.map(quoteString)].join('->');
    const kind = def.kind;
    if (asJson || kind === 'multiEnum' || kind === 'array') return `${path}->${quoteString(last)}`;
    const text = `${path}->>${quoteString(last)}`;
    const cast = kind && ELEMENT_CAST[kind];
    return cast ? `(${text})::${cast}` : text;
  }

  // Function arguments become placeholders too (collected into `params`): tokens carry ids, so a
  // format that reorders or repeats its arguments still binds the right values.
  const encodeArg = (ctx: SqlContext, params: SqlParam[]) =>
    function arg(o: Operand): string | undefined {
      if (isFnCall(o)) return encodeCall('sql', ctx.fields, o, arg);
      if ('ref' in o) return column(ctx, o.ref);
      const f = val(o.value);
      params.push(...f.params);
      return f.sql;
    };

  function emptiness(ctx: SqlContext, rule: Rule, col: string, empty: boolean): string {
    const kind = ruleDef(ctx.fields, rule)?.kind;
    const isNull = empty ? `${col} IS NULL` : `${col} IS NOT NULL`;
    const join = empty ? ' OR ' : ' AND ';
    if (kind === 'multiEnum' || kind === 'array') {
      const json = ctx.alias || kind === 'array';
      const len =
        dialect === 'postgres'
          ? json
            ? `jsonb_array_length(${col})`
            : `cardinality(${col})`
          : dialect === 'mysql'
            ? `JSON_LENGTH(${col})`
            : dialect === 'sqlite'
              ? `json_array_length(${col})`
              : dialect === 'mssql'
                ? `(SELECT COUNT(*) FROM OPENJSON(${col}))`
                : `CARDINALITY(${col})`;
      return `(${isNull}${join}${len} ${empty ? '=' : '>'} 0)`;
    }
    if (kind === 'text' || kind === 'enum' || kind === undefined) return `(${isNull}${join}${col} ${empty ? '=' : '<>'} '')`;
    return isNull;
  }

  function multi(ctx: SqlContext, op: string, col: string, list: unknown[]): SqlFragment | undefined {
    const items = list.map(val);
    const inList = `(${items.map((p) => p.sql).join(', ')})`;
    const negate = (s: string) => `NOT (${s})`;
    if (dialect === 'postgres') {
      const arr = items.length ? `ARRAY[${items.map((p) => p.sql).join(', ')}]` : 'ARRAY[]::text[]';
      const twice = [...items, ...items];
      if (ctx.alias) {
        // jsonb array inside an element: string members only.
        const json = val(JSON.stringify(list));
        if (op === 'hasAny' || op === 'hasNone') return frag(op === 'hasAny' ? `${col} ?| ${arr}` : negate(`${col} ?| ${arr}`), ...items);
        if (op === 'hasAll') return frag(`${col} ?& ${arr}`, ...items);
        const eq = `(${col} @> ${json.sql}::jsonb AND ${col} <@ ${json.sql}::jsonb)`;
        return frag(op === 'setEq' ? eq : negate(eq), json, json);
      }
      if (op === 'hasAny') return frag(`${col} && ${arr}`, ...items);
      if (op === 'hasNone') return frag(negate(`${col} && ${arr}`), ...items);
      if (op === 'hasAll') return frag(`${col} @> ${arr}`, ...items);
      const eq = `(${col} @> ${arr} AND ${col} <@ ${arr})`;
      return frag(op === 'setEq' ? eq : negate(eq), ...twice);
    }
    if (dialect === 'mysql') {
      const json = val(JSON.stringify(list));
      if (op === 'hasAny') return frag(`JSON_OVERLAPS(${col}, ${json.sql})`, json);
      if (op === 'hasNone') return frag(`NOT JSON_OVERLAPS(${col}, ${json.sql})`, json);
      if (op === 'hasAll') return frag(`JSON_CONTAINS(${col}, ${json.sql})`, json);
      const eq = `(JSON_CONTAINS(${col}, ${json.sql}) AND JSON_CONTAINS(${json.sql}, ${col}))`;
      return frag(op === 'setEq' ? eq : negate(eq), json, json);
    }
    if (dialect === 'sqlite' || dialect === 'mssql') {
      const each = `${dialect === 'mssql' ? 'OPENJSON' : 'json_each'}(${col})`;
      const any = `EXISTS (SELECT 1 FROM ${each} WHERE value IN ${inList})`;
      if (op === 'hasAny') return frag(any, ...items);
      if (op === 'hasNone') return frag(`NOT ${any}`, ...items);
      const all = `(SELECT COUNT(DISTINCT value) FROM ${each} WHERE value IN ${inList}) = ${new Set(list).size}`;
      if (op === 'hasAll') return frag(all, ...items);
      const eq = `(${all} AND NOT EXISTS (SELECT 1 FROM ${each} WHERE value NOT IN ${inList}))`;
      return frag(op === 'setEq' ? eq : negate(eq), ...items, ...items);
    }
    return undefined;
  }

  function encodeRule(input: Rule, ctx: SqlContext): SqlFragment | Unsupported | undefined {
    // Read the untrusted rule exactly once, so what's validated is what's emitted (no getters or
    // toJSON tricks between the check and the output).
    let rule: Rule;
    try {
      rule = snapshotRule(input);
    } catch {
      return new Unsupported(input, 'invalid rule (not plain JSON data)');
    }
    const problem = ruleProblem(ctx.fields, rule);
    if (problem === 'incomplete') return undefined;
    // Markers point at the caller's node (not the snapshot) so groups can report its path.
    if (problem) return new Unsupported(rule, problem.reason, [], input);
    const out = expressRule(rule, ctx);
    return out ?? new Unsupported(rule, unsupportedReason('sql', ctx.fields, rule, ARRAY_OPS.has(rule.operator) ? `the ${dialect} dialect has no array operators (use postgres, mysql, sqlite or mssql)` : undefined), [], input);
  }

  /** A complete rule as SQL, or undefined when this dialect can't express it. */
  function expressRule(rule: Rule, ctx: SqlContext): SqlFragment | undefined {
    const def = ruleDef(ctx.fields, rule);
    const info = infoOf(ctx.fields, rule.operator);
    const callParams: SqlParam[] = [];
    const arg = encodeArg(ctx, callParams);
    const left = isFnCall(rule.field) ? encodeCall('sql', ctx.fields, rule.field, arg) : column(ctx, rule.field);
    if (left === undefined) return undefined;
    // Any function-argument params ride along with whatever the rule produces.
    const out = expressValue(rule, ctx, def, info, left, arg);
    return out && (callParams.length ? { ...out, params: [...callParams, ...out.params] } : out);
  }

  function expressValue(rule: Rule, ctx: SqlContext, def: ReturnType<typeof ruleDef>, info: ReturnType<typeof infoOf>, left: string, arg: (o: Operand) => string | undefined): SqlFragment | undefined {
    const custom = info.formats?.sql;
    if (custom) {
      // Custom operators get each value as an escaped literal (or a placeholder in params mode).
      const v = rule.value;
      const one = (x: unknown) => val(typeof x === 'object' && x !== null ? JSON.stringify(x) : x);
      const parts = info.arity === 'none' ? [] : Array.isArray(v) ? v.map(one) : [one(v)];
      const value = info.arity === 'none' ? undefined : Array.isArray(v) ? parts.map((p) => p.sql) : parts[0]!.sql;
      return frag(String(custom({ field: left, value, raw: v })), ...parts);
    }

    const textual = def?.kind === 'text' || info.textMatch;
    const ci = options.caseInsensitive && textual;
    const lower = (s: string) => (ci && dialect !== 'postgres' ? `LOWER(${s})` : s);
    const col = lower(left);

    if (rule.ref !== undefined) return frag(`${col} ${CMP[rule.operator]} ${lower(column(ctx, rule.ref))}`);
    if (rule.call !== undefined) {
      const rhs = encodeCall('sql', ctx.fields, rule.call, arg);
      return rhs === undefined ? undefined : frag(`${col} ${CMP[rule.operator]} ${lower(rhs)}`);
    }

    const v = rule.value;
    const ciVal = (f: SqlFragment) => (ci && dialect !== 'postgres' ? frag(`LOWER(${f.sql})`, f) : f);
    switch (rule.operator) {
      case 'isNull':
        return frag(`${col} IS NULL`);
      case 'isNotNull':
        return frag(`${col} IS NOT NULL`);
      case 'isEmpty':
      case 'isNotEmpty':
        return frag(emptiness(ctx, rule, left, rule.operator === 'isEmpty'));
      case 'eq':
      case 'neq':
        if (v === null || v === undefined) return frag(`${col} ${rule.operator === 'eq' ? 'IS NULL' : 'IS NOT NULL'}`);
        if (ci && dialect === 'postgres' && typeof v === 'string') {
          // ILIKE with the value's own wildcards escaped: equality, not a pattern.
          const pattern = likePattern(v, '', '');
          const p = val(pattern);
          return frag(`${col} ${rule.operator === 'eq' ? 'ILIKE' : 'NOT ILIKE'} ${p.sql}${escapeClause(pattern)}`, p);
        }
        return cmp(col, CMP[rule.operator]!, ciVal(val(v)));
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte':
        return cmp(col, CMP[rule.operator]!, val(v));
      case 'contains':
      case 'notContains':
      case 'startsWith':
      case 'endsWith': {
        const s = String(v);
        const pattern =
          rule.operator === 'startsWith' ? likePattern(s, '', '%') : rule.operator === 'endsWith' ? likePattern(s, '%', '') : likePattern(s, '%', '%');
        const negate = rule.operator === 'notContains' ? 'NOT ' : '';
        const like = ci && dialect === 'postgres' ? 'ILIKE' : 'LIKE';
        const p = ciVal(val(pattern));
        return frag(`${col} ${negate}${like} ${p.sql}${escapeClause(pattern)}`, p);
      }
      case 'between':
      case 'notBetween': {
        const [lo, hi] = v as [unknown, unknown];
        const a = val(lo);
        const b = val(hi);
        return frag(`${col} ${rule.operator === 'notBetween' ? 'NOT ' : ''}BETWEEN ${a.sql} AND ${b.sql}`, a, b);
      }
      case 'in':
      case 'notIn': {
        const list = (v as unknown[]).map((x) => ciVal(val(x)));
        if (!list.length) return frag(rule.operator === 'in' ? '1 = 0' : '1 = 1');
        return frag(`${col} ${rule.operator === 'notIn' ? 'NOT ' : ''}IN (${list.map((p) => p.sql).join(', ')})`, ...list);
      }
      case 'hasAny':
      case 'hasAll':
      case 'hasNone':
      case 'setEq':
      case 'setNeq':
        return multi(ctx, rule.operator, left, v as unknown[]);
    }
    return undefined;
  }

  const cmp = (col: string, op: string, p: SqlFragment) => frag(`${col} ${op} ${p.sql}`, p);

  function join(g: Pick<Group, 'combinator'>, children: SqlFragment[]): SqlFragment | undefined {
    if (!children.length) return undefined;
    if (children.length === 1) return children[0]!;
    return {
      sql: children.map((c) => (c.compound ? `(${c.sql})` : c.sql)).join(g.combinator === 'and' ? ' AND ' : ' OR '),
      params: children.flatMap((c) => c.params),
      compound: true,
    };
  }

  function arrayGroup(g: Group, ctx: SqlContext): SqlFragment | Unsupported | undefined {
    if (!isArrayGroupIn(ctx.fields, g)) return undefined;
    // Postgres only: the array column must be jsonb (an array of objects).
    if (dialect !== 'postgres') return new Unsupported(g, `array groups need the postgres dialect (jsonb columns); ${dialect} has none`);
    const depth = (ctx.depth ?? 0) + 1;
    const alias = `e${depth}`;
    const lifted = liftChildren<SqlFragment>(g, encodeIn(codec, g.children, { fields: groupScope(ctx.fields, g), alias, depth } satisfies SqlContext), modes.unsupported);
    if ('bad' in lifted) return lifted.bad;
    const inner = join(g, lifted.kids);
    const from = `jsonb_array_elements(${column(ctx, g.of!.field, true)}) AS ${alias}`;
    const where = inner ? ` WHERE ${inner.sql}` : '';
    const m = g.of!.match;
    let sql: string;
    let params = inner?.params ?? [];
    if (m === 'some') sql = `EXISTS (SELECT 1 FROM ${from}${where})`;
    else if (m === 'none') sql = `NOT EXISTS (SELECT 1 FROM ${from}${where})`;
    else if (m === 'all') sql = inner ? `NOT EXISTS (SELECT 1 FROM ${from} WHERE NOT COALESCE((${inner.sql}), FALSE))` : '1 = 1';
    else {
      const count = `(SELECT COUNT(*) FROM ${from}${where})`;
      if (m.count === 'between') {
        const [lo, hi] = m.value;
        const a = val(lo);
        const b = val(hi);
        sql = `${count} BETWEEN ${a.sql} AND ${b.sql}`;
        params = [...params, ...a.params, ...b.params];
      } else {
        const n = val(m.value);
        sql = `${count} ${CMP[m.count]} ${n.sql}`;
        params = [...params, ...n.params];
      }
    }
    return g.not ? { sql: `NOT (${sql})`, params, compound: false } : { sql, params, compound: false };
  }

  function encodeGroup(g: Group, children: SqlFragment[], ctx: SqlContext): SqlFragment | Unsupported | undefined {
    // A malformed group (bad combinator, NOT flag or list quantifier) is tampering, not a dialect
    // gap: always refused, even with `unsupported: 'skip'`.
    const problem = groupProblem(ctx.fields, g);
    if (problem) throw new Error(`trawlnet/sql: ${problem.reason}`);
    if (g.of) return arrayGroup(g, ctx);
    const lifted = liftChildren<SqlFragment>(g, children, modes.unsupported);
    if ('bad' in lifted) return lifted.bad;
    const joined = join(g, lifted.kids);
    if (!joined) return undefined;
    return g.not ? { sql: `NOT (${joined.sql})`, params: joined.params, compound: false } : joined;
  }

  function render(root: SqlFragment): string | SqlWithParams<unknown[] | Record<string, unknown>> {
    const { sql, params } = root;
    if (!paramStyle) return sql;
    const byId = new Map(params.map((p) => [p.id, p.value]));
    const values: unknown[] = [];
    const text = sql.replace(TOKEN, (_, id: string) => {
      if (!byId.has(Number(id))) throw new Error('trawlnet/sql: internal error: a placeholder has no value');
      values.push(byId.get(Number(id)));
      const n = values.length;
      if (paramStyle === 'positional') return '?';
      if (paramStyle === 'numbered') return `$${n}`;
      return dialect === 'mssql' ? `@p${n}` : `:p${n}`;
    });
    return paramStyle === 'named' ? { sql: text, params: Object.fromEntries(values.map((v, i) => [`p${i + 1}`, v])) } : { sql: text, params: values };
  }

  const codec: SqlCodec<string | SqlWithParams<unknown[] | Record<string, unknown>>> = {
    name: 'sql',
    // Unsupported markers travel as nodes until a group or `finish` resolves them.
    encodeRule: (rule, ctx) => encodeRule(rule, ctx) as SqlFragment | undefined,
    encodeGroup: (g, children, ctx) => encodeGroup(g, children, ctx) as SqlFragment | undefined,
    finish: (root) => finishRoot('sql', root, modes, { all: () => render(frag('1 = 1')), none: () => render(frag('1 = 0')), some: render }),
    encodeCases(whens, otherwise) {
      const parts: SqlFragment[] = [];
      const branches = whens.map(({ when, then }) => {
        // A case with no rules follows `emptyQuery`, like a whole query would.
        let c = caseCondition('sql', when);
        if (!c) {
          if (modes.emptyQuery === 'throw') throw new Error('trawlnet/sql: a case has no rules to export');
          c = frag(modes.emptyQuery === 'none' ? '1 = 0' : '1 = 1');
        }
        const t = val(then);
        parts.push(c, t);
        return `WHEN ${c.sql} THEN ${t.sql}`;
      });
      const e = otherwise === undefined ? undefined : val(otherwise);
      if (e) parts.push(e);
      const sql = `CASE ${branches.join(' ')}${e ? ` ELSE ${e.sql}` : ''} END`;
      return render({ sql, params: parts.flatMap((p) => p.params), compound: false });
    },
    decode(input, ctx) {
      if (paramStyle || typeof input !== 'string') throw new Error('trawlnet/sql: parameterized SQL cannot be decoded; use a codec without `params`');
      return parseSqlWhere(input, ctx.fields as Fields, dialect);
    },
  };
  return codec;
}

/** Copy a rule, reading each property once. Throws on values JSON can't hold (functions, cycles). */
function snapshotRule(rule: Rule): Rule {
  const copy = (x: unknown): unknown => {
    if (x === null || typeof x !== 'object') return x;
    return JSON.parse(JSON.stringify(x));
  };
  const field = rule.field;
  const out: { -readonly [K in keyof Rule]: Rule[K] } = { kind: rule.kind, field: typeof field === 'string' ? field : (copy(field) as Rule['field']), operator: rule.operator };
  const value = rule.value;
  const ref = rule.ref;
  const call = rule.call;
  if (value !== undefined) out.value = Array.isArray(value) ? value.map(copy) : copy(value);
  if (ref !== undefined) out.ref = ref;
  if (call !== undefined) out.call = copy(call) as Rule['call'];
  return out;
}

/** ANSI SQL with inlined, escaped literals. Two-way: `decode` parses WHERE clauses. */
export const sql = sqlFormat();
