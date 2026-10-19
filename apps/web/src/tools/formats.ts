// The formats the converter tools read and write, with how to parse pasted input and print output.
import type { Codec } from '@qnot/core';
import { elasticsearch } from '@qnot/core/formats/elasticsearch';
import { jqqb } from '@qnot/core/formats/jqqb';
import { jsonlogic } from '@qnot/core/formats/jsonlogic';
import { mongo } from '@qnot/core/formats/mongo';
import { raqb } from '@qnot/core/formats/raqb';
import { rqb } from '@qnot/core/formats/rqb';
import { spel } from '@qnot/core/formats/spel';
import { sqlFormat, type SqlDialect, type SqlParamStyle } from '@qnot/core/formats/sql';
import { text } from '@qnot/core/formats/text';
import type { HighlightLang } from '@/components/qnot/highlight';
import { parseLooseJson, stringify } from './loose-json';

export type FormatId = 'sql' | 'mongo' | 'jsonlogic' | 'rqb' | 'raqb' | 'jqqb' | 'elasticsearch' | 'spel' | 'text';

export interface FormatInfo {
  id: FormatId;
  /** Full name: "react-querybuilder JSON". */
  label: string;
  /** Tab label: "react-querybuilder". */
  short: string;
  lang: HighlightLang | undefined;
  /** What the input box holds. */
  input: 'sql' | 'json' | 'text';
  /** How the codec is imported in app code. */
  importLine: string;
  /** The codec expression in app code (SQL takes its options). */
  expr: string;
}

export const FORMATS: Record<FormatId, FormatInfo> = {
  sql: { id: 'sql', label: 'SQL', short: 'SQL', lang: 'sql', input: 'sql', importLine: "import { sqlFormat } from '@qnot/core/formats/sql';", expr: 'sqlFormat' },
  mongo: { id: 'mongo', label: 'MongoDB filter', short: 'MongoDB', lang: 'json', input: 'json', importLine: "import { mongo } from '@qnot/core/formats/mongo';", expr: 'mongo' },
  jsonlogic: { id: 'jsonlogic', label: 'JsonLogic', short: 'JsonLogic', lang: 'json', input: 'json', importLine: "import { jsonlogic } from '@qnot/core/formats/jsonlogic';", expr: 'jsonlogic' },
  rqb: { id: 'rqb', label: 'react-querybuilder JSON', short: 'react-querybuilder', lang: 'json', input: 'json', importLine: "import { rqb } from '@qnot/core/formats/rqb';", expr: 'rqb' },
  raqb: { id: 'raqb', label: 'react-awesome-query-builder tree', short: 'RAQB', lang: 'json', input: 'json', importLine: "import { raqb } from '@qnot/core/formats/raqb';", expr: 'raqb' },
  jqqb: { id: 'jqqb', label: 'jQuery QueryBuilder rules', short: 'jQuery QB', lang: 'json', input: 'json', importLine: "import { jqqb } from '@qnot/core/formats/jqqb';", expr: 'jqqb' },
  elasticsearch: {
    id: 'elasticsearch',
    label: 'Elasticsearch query DSL',
    short: 'Elasticsearch',
    lang: 'json',
    input: 'json',
    importLine: "import { elasticsearch } from '@qnot/core/formats/elasticsearch';",
    expr: 'elasticsearch',
  },
  spel: { id: 'spel', label: 'Spring Expression (SpEL)', short: 'SpEL', lang: undefined, input: 'text', importLine: "import { spel } from '@qnot/core/formats/spel';", expr: 'spel' },
  text: { id: 'text', label: 'Plain English', short: 'English', lang: undefined, input: 'text', importLine: "import { text } from '@qnot/core/formats/text';", expr: 'text' },
};

export const DIALECTS: { value: SqlDialect; label: string }[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mssql', label: 'SQL Server' },
  { value: 'ansi', label: 'ANSI SQL' },
];

export type ParamMode = 'inline' | SqlParamStyle;
export const PARAM_MODES: { value: ParamMode; label: string; hint: string }[] = [
  { value: 'inline', label: 'Inline values', hint: "status = 'active'" },
  { value: 'numbered', label: 'Numbered ($1)', hint: 'status = $1' },
  { value: 'positional', label: 'Positional (?)', hint: 'status = ?' },
  { value: 'named', label: 'Named (:p1)', hint: 'status = :p1' },
];

export interface SqlSettings {
  dialect: SqlDialect;
  params: ParamMode;
  /** Quote column names (needed when a name isn't a plain identifier). */
  quoteIdentifiers?: boolean;
}

const CODECS: Record<Exclude<FormatId, 'sql'>, Codec<any>> = {
  mongo: mongo as Codec<any>,
  jsonlogic: jsonlogic as Codec<any>,
  rqb: rqb as Codec<any>,
  raqb: raqb as Codec<any>,
  jqqb: jqqb as Codec<any>,
  elasticsearch: elasticsearch as Codec<any>,
  spel: spel as Codec<any>,
  text: text as Codec<any>,
};

/** The codec for a format; SQL with the chosen dialect and parameter style. */
export function codecFor(id: FormatId, sql: SqlSettings = { dialect: 'postgres', params: 'inline' }): Codec<any> {
  if (id !== 'sql') return CODECS[id];
  const quote = sql.quoteIdentifiers ? { quoteIdentifiers: true } : {};
  return sqlFormat(sql.params === 'inline' ? { dialect: sql.dialect, ...quote } : ({ dialect: sql.dialect, params: sql.params, ...quote } as never)) as Codec<any>;
}

/** The codec expression in app code: `sqlFormat({ dialect: 'postgres', params: 'numbered' })`, `mongo`. */
export function codecExpr(id: FormatId, sql: SqlSettings, forDecode = false): string {
  if (id !== 'sql') return FORMATS[id].expr;
  const params = !forDecode && sql.params !== 'inline' ? `, params: '${sql.params}'` : '';
  const quote = !forDecode && sql.quoteIdentifiers ? ', quoteIdentifiers: true' : '';
  return `sqlFormat({ dialect: '${sql.dialect}'${params}${quote} })`;
}

// Clauses that end a WHERE: everything from them on is dropped.
const TAIL = /\b(GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|FETCH\s+FIRST|FOR\s+UPDATE|UNION|WINDOW)\b/i;

/** Mask string literals and quoted identifiers so keyword searches don't look inside them. */
const mask = (s: string) => s.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]/g, (m) => ' '.repeat(m.length));

/** The WHERE clause of a pasted statement (or the text itself when it's only a condition). */
export function whereClause(src: string): string {
  let s = src.replace(/--[^\n]*/g, (m) => ' '.repeat(m.length));
  const masked = mask(s);
  const where = /\bWHERE\b/i.exec(masked);
  if (where) {
    s = s.slice(where.index + where[0].length);
    const tail = TAIL.exec(mask(s));
    if (tail) s = s.slice(0, tail.index);
  } else if (/^\s*SELECT\b/i.test(masked)) {
    return '';
  }
  return s.trim().replace(/;\s*$/, '').trim();
}

/** Turn the input box's text into what the codec decodes. Throws a readable error. */
export function parseInput(id: FormatId, src: string): unknown {
  const info = FORMATS[id];
  if (info.input === 'sql') {
    const where = whereClause(src);
    if (!where) throw new Error('No WHERE clause found: paste a condition such as status = \'active\' AND age > 21, or a SELECT with a WHERE.');
    return where;
  }
  if (info.input === 'text') return src.trim();
  let value: unknown;
  try {
    value = parseLooseJson(src);
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`);
  }
  const shape = SHAPES[id];
  if (shape && !shape.test(value)) throw new Error(`Expected ${shape.expected}.`);
  return value;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof RegExp);

/** What each JSON format's top level must look like, so a wrong paste gets a plain-English error. */
const SHAPES: Partial<Record<FormatId, { test: (v: unknown) => boolean; expected: string }>> = {
  mongo: { test: isObject, expected: 'a MongoDB filter document: an object such as { "status": "active" }' },
  jsonlogic: { test: (v) => isObject(v) || typeof v === 'boolean', expected: 'a JsonLogic rule: an object such as { "==": [{ "var": "status" }, "active"] }' },
  rqb: { test: (v) => isObject(v) && Array.isArray(v.rules), expected: 'a react-querybuilder group: an object with "combinator" and a "rules" array' },
  raqb: { test: (v) => isObject(v) && v.type === 'group', expected: 'a react-awesome-query-builder tree: an object with "type": "group" and "children1"' },
  jqqb: { test: (v) => isObject(v) && Array.isArray(v.rules), expected: 'a jQuery QueryBuilder rule set: an object with "condition" and a "rules" array' },
};

export interface Rendered {
  code: string;
  lang: HighlightLang | undefined;
  /** Bound parameters, for SQL with placeholders. */
  params?: string;
}

/**
 * Break a long WHERE clause before its top-level AND/OR (not the AND of a BETWEEN), so it reads
 * one condition per line. Literals and quoted names are skipped; the text is otherwise unchanged.
 */
export function formatSql(sql: string, width = 80): string {
  if (sql.length <= width) return sql;
  let out = '';
  let depth = 0;
  let between = false;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i]!;
    const close = c === "'" ? "'" : c === '"' ? '"' : c === '`' ? '`' : c === '[' ? ']' : null;
    if (close) {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === close && sql[j + 1] !== close)) j += sql[j] === close ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    const word = /^ (AND|OR|BETWEEN) /.exec(sql.slice(i, i + 9));
    if (word && depth === 0) {
      if (word[1] === 'BETWEEN') between = true;
      else if (word[1] === 'AND' && between) between = false;
      else {
        out += `\n  ${word[1]} `;
        i += word[0].length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** Print a codec's output. */
export function renderOutput(id: FormatId, out: unknown): Rendered {
  if (typeof out === 'string') return { code: id === 'sql' ? formatSql(out) : out, lang: FORMATS[id].lang };
  if (id === 'sql' && out && typeof out === 'object' && 'sql' in out && 'params' in out) {
    const { sql, params } = out as { sql: string; params: unknown };
    return { code: formatSql(sql), lang: 'sql', params: stringify(params) };
  }
  return { code: stringify(out), lang: 'json' };
}
