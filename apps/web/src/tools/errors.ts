// Readable errors for the converter: the codec's message, plus a hint for the usual suspects.
import { FORMATS, type FormatId } from './formats';

export interface ToolError {
  title: string;
  detail: string;
  hint?: string;
}

const MONGO_HINTS: [RegExp, string][] = [
  [/\$exists/, '$exists has no equivalent in this conversion. To match a missing or null field, compare it with null: { field: null } (or { field: { $ne: null } } for present).'],
  [/\$(where|text|function|jsonSchema|geoWithin|near|geoIntersects)\b/, 'Server-side JavaScript, text search and geo operators have no SQL or JsonLogic equivalent.'],
  [/\$(type|mod|size|bitsAll\w*|bitsAny\w*)\b/, 'Type, modulo, array-size and bitwise operators are not part of what qnot reads from Mongo.'],
];

const JSONLOGIC_HINTS: [RegExp, string][] = [
  [/"(map|reduce|filter|merge|if|\?:|cat|substr|\+|-|\*|\/|%|min|max|log|missing|missing_some|method)"/, 'Only conditions convert: and, or, !, !!, comparisons, in, some, all, none, startsWith and endsWith. Arithmetic, if, map/reduce and missing have no filter equivalent.'],
];

const SQL_HINTS: [RegExp, string][] = [
  [/parameter placeholders/, 'Inline the values first: the parser reads literals, not $1, ? or :name placeholders.'],
  [/unknown function NOW\(\)/i, 'Use CURRENT_TIMESTAMP for the current time, or compare with a literal date.'],
  [/unknown function/, 'Only built-in functions qnot knows are read: LOWER, UPPER, LENGTH, CURRENT_DATE and CURRENT_TIMESTAMP. Register your own with defineFunction in an app.'],
  [/"_" wildcards|inner "%"/, 'qnot reads LIKE as starts-with, ends-with or contains. Single-character wildcards and patterns with % in the middle have no exact equivalent.'],
  [/always false/, 'A condition that can never match (like 1 = 0) has no query to convert.'],
  [/isn't a plain identifier/, 'Quote the column in your input ("Order Total") and the output quotes it too.'],
];

const OUT_HINTS: [RegExp, string][] = [
  [/array groups need the postgres dialect/, 'Switch the dialect to PostgreSQL, which can query a jsonb array with EXISTS.'],
  [/ansi dialect has no array operators/, 'Pick PostgreSQL, MySQL, SQLite or SQL Server: each has its own array syntax.'],
];

const hintFor = (hints: [RegExp, string][], message: string) => hints.find(([re]) => re.test(message))?.[1];

const clean = (message: string) => message.replace(/^qnot\/\w+: /, '').replace(/^qnot: /, '');

/** An input that couldn't be read. */
export function inputError(from: FormatId, e: unknown): ToolError {
  const message = (e as Error)?.message ?? String(e);
  const label = FORMATS[from].label;
  // Not a qnot error: usually the wrong shape (an array where a group belongs, a missing key).
  const foreign = !/^(qnot|Not valid JSON|No WHERE|Expected )/.test(message);
  return {
    title: message.startsWith('Not valid JSON') ? 'This isn\'t valid JSON' : `Couldn't read this ${label}`,
    detail: foreign ? `The input doesn't have the shape of ${label} (${message}).` : clean(message),
    hint: hintFor(from === 'mongo' ? MONGO_HINTS : from === 'sql' ? SQL_HINTS : from === 'jsonlogic' ? JSONLOGIC_HINTS : [], message),
  };
}

/** A query the target format can't express. */
export function outputError(to: FormatId, e: unknown): ToolError {
  const message = (e as Error)?.message ?? String(e);
  return { title: `${FORMATS[to].short} can't express this query`, detail: clean(message), hint: hintFor([...OUT_HINTS, ...SQL_HINTS], message) };
}
