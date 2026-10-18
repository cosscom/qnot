import type { Codec } from '../codec';
import type { Fields } from '../fields';
import { OPERATORS } from '../operators';
import type { Group, Rule } from '../types';
import { isCompleteRule } from './_util';

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'ansi';
/** `positional` → `?`, `numbered` → `$1`, `named` → `:p1` (`@p1` on mssql). */
export type SqlParamStyle = 'positional' | 'numbered' | 'named';

export interface SqlOptions {
  dialect?: SqlDialect;
  /** Emit placeholders and return values separately instead of inlining literals. */
  params?: false | SqlParamStyle;
  /** Quote column names for the dialect (`"col"`, `` `col` ``, `[col]`). */
  quoteIdentifiers?: boolean;
  /** Case-insensitive text matching: ILIKE on Postgres, LOWER(…) elsewhere. */
  caseInsensitive?: boolean;
}

export interface SqlWithParams<P> {
  sql: string;
  params: P;
}

/** Intermediate per-node output. Placeholders are `\u0000` until `finish` numbers them. */
export interface SqlFragment {
  readonly sql: string;
  readonly params: readonly unknown[];
  /** True when the fragment is an AND/OR chain that needs parentheses inside another chain. */
  readonly compound: boolean;
}

const PH = '\u0000';

export function sqlFormat(options?: SqlOptions & { params?: false }): Codec<string, SqlFragment>;
export function sqlFormat(options: SqlOptions & { params: 'named' }): Codec<SqlWithParams<Record<string, unknown>>, SqlFragment>;
export function sqlFormat(options: SqlOptions & { params: 'positional' | 'numbered' }): Codec<SqlWithParams<unknown[]>, SqlFragment>;
export function sqlFormat(options: SqlOptions = {}): Codec<string | SqlWithParams<unknown[] | Record<string, unknown>>, SqlFragment> {
  const dialect = options.dialect ?? 'ansi';
  const paramStyle = options.params || null;

  const ident = (name: string) => {
    if (!options.quoteIdentifiers) return name;
    if (dialect === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
    if (dialect === 'mssql') return `[${name.replace(/]/g, ']]')}]`;
    return `"${name.replace(/"/g, '""')}"`;
  };

  const literal = (v: unknown): string => {
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v === 'boolean') return dialect === 'mssql' || dialect === 'sqlite' ? (v ? '1' : '0') : v ? 'TRUE' : 'FALSE';
    if (v === null || v === undefined) return 'NULL';
    let s = String(v).replace(/'/g, "''");
    if (dialect === 'mysql') s = s.replace(/\\/g, '\\\\');
    return `'${s}'`;
  };

  // A value either inlined or turned into a placeholder, with its param.
  const val = (v: unknown): SqlFragment => (paramStyle ? { sql: PH, params: [v], compound: false } : { sql: literal(v), params: [], compound: false });

  const frag = (sql: string, ...parts: SqlFragment[]): SqlFragment => ({ sql, params: parts.flatMap((p) => p.params), compound: false });

  const likePattern = (s: string, pre: string, post: string) => `${pre}${s.replace(/[\\%_]/g, '\\$&')}${post}`;

  function encodeRule(rule: Rule, fields: Fields): SqlFragment | undefined {
    if (!isCompleteRule(fields, rule)) return undefined;
    const def = fields[rule.field]!;
    const textual = def.kind === 'text' || OPERATORS[rule.operator].textMatch;
    const ci = options.caseInsensitive && textual;
    const col = ci && dialect !== 'postgres' ? `LOWER(${ident(rule.field)})` : ident(rule.field);
    const cmp: Record<string, string> = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' };

    if (rule.ref !== undefined) {
      const other = ci && dialect !== 'postgres' ? `LOWER(${ident(rule.ref)})` : ident(rule.ref);
      return frag(`${col} ${cmp[rule.operator]} ${other}`);
    }

    const v = rule.value;
    const ciVal = (f: SqlFragment) => (ci && dialect !== 'postgres' ? frag(`LOWER(${f.sql})`, f) : f);
    switch (rule.operator) {
      case 'isNull':
        return frag(`${col} IS NULL`);
      case 'isNotNull':
        return frag(`${col} IS NOT NULL`);
      case 'eq':
      case 'neq':
        if (v === null || v === undefined) return frag(`${col} ${rule.operator === 'eq' ? 'IS NULL' : 'IS NOT NULL'}`);
        if (ci && dialect === 'postgres') {
          const p = val(v);
          return frag(`${col} ${rule.operator === 'eq' ? 'ILIKE' : 'NOT ILIKE'} ${p.sql}`, p);
        }
        return cmpFrag(col, cmp[rule.operator]!, ciVal(val(v)));
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte':
        return cmpFrag(col, cmp[rule.operator]!, val(v));
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
        return frag(`${col} ${negate}${like} ${p.sql}${pattern.includes('\\') ? ` ESCAPE ${literal('\\')}` : ''}`, p);
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
    }
  }

  const cmpFrag = (col: string, op: string, p: SqlFragment) => frag(`${col} ${op} ${p.sql}`, p);

  function encodeGroup(g: Group, children: SqlFragment[]): SqlFragment | undefined {
    if (!children.length) return undefined;
    const joined: SqlFragment =
      children.length === 1
        ? children[0]!
        : {
            sql: children.map((c) => (c.compound ? `(${c.sql})` : c.sql)).join(g.combinator === 'and' ? ' AND ' : ' OR '),
            params: children.flatMap((c) => c.params),
            compound: true,
          };
    return g.not ? { sql: `NOT (${joined.sql})`, params: joined.params, compound: false } : joined;
  }

  return {
    name: 'sql',
    encodeRule: (rule, ctx) => encodeRule(rule, ctx.fields),
    encodeGroup: (g, children) => encodeGroup(g, children),
    finish(root) {
      const sql = root?.sql ?? '1 = 1';
      const params = root?.params ?? [];
      if (!paramStyle) return sql;
      let n = 0;
      const text = sql.replace(/\u0000/g, () => {
        n++;
        if (paramStyle === 'positional') return '?';
        if (paramStyle === 'numbered') return `$${n}`;
        return dialect === 'mssql' ? `@p${n}` : `:p${n}`;
      });
      return paramStyle === 'named'
        ? { sql: text, params: Object.fromEntries(params.map((p, i) => [`p${i + 1}`, p])) }
        : { sql: text, params: [...params] };
    },
  };
}

/** ANSI SQL with inlined, escaped literals. */
export const sql = sqlFormat();
