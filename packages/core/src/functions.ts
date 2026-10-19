import { f, registryOf, type AnyFieldDef, type Fields } from './fields';

/** A function call, usable as a rule's value (`rule.call`) or its left side (`rule.field`). */
export interface FnCall {
  readonly fn: string;
  readonly args: Readonly<Record<string, Operand>>;
}

/** A function argument: a literal, another field, or a nested call. */
export type Operand = { readonly value: unknown } | { readonly ref: string } | FnCall;

export const isFnCall = (x: unknown): x is FnCall => typeof x === 'object' && x !== null && 'fn' in x && 'args' in x;

/** A call is well-formed JSON: a string `fn` and an `args` object. Query JSON is untrusted. */
export const isWellFormedCall = (x: unknown): x is FnCall =>
  isFnCall(x) && typeof x.fn === 'string' && typeof x.args === 'object' && x.args !== null && !Array.isArray(x.args);

export interface FunctionDef {
  readonly label?: string;
  readonly description?: string;
  /** Return type as a field schema: decides the operators and value editor around the call. */
  readonly returns: AnyFieldDef;
  /** Arguments as field schemas; `required: false` makes an argument optional. */
  readonly args: Readonly<Record<string, AnyFieldDef>>;
  /** Run the function for `compile()`/`matches()`. */
  readonly evaluate: (args: Readonly<Record<string, unknown>>) => unknown;
  /**
   * Per-codec output, keyed by codec name (`sql`, `mongo`, `jsonlogic`, `spel`, `elasticsearch`,
   * `text`). Gets the arguments already encoded by that codec, plus their raw values.
   */
  readonly formats?: Readonly<Record<string, (encoded: Readonly<Record<string, unknown>>, raw: Readonly<Record<string, unknown>>) => unknown>>;
}

export const defineFunction = (def: FunctionDef): FunctionDef => def;

export const functionOf = (fields: Fields, call: FnCall): FunctionDef | undefined => {
  const fns = registryOf(fields).functions;
  // Own keys only: an untrusted `fn` like "constructor" must not resolve to Object.prototype.
  return typeof call.fn === 'string' && Object.hasOwn(fns, call.fn) ? fns[call.fn] : undefined;
};

/** Evaluate an operand against a row. */
export function evaluateOperand(fields: Fields, operand: Operand, row: unknown, get: (row: any, field: string) => unknown): unknown {
  if (isFnCall(operand)) {
    const def = functionOf(fields, operand);
    if (!def) throw new Error(`trawlnet: unknown function "${operand.fn}"`);
    const args: Record<string, unknown> = {};
    for (const name of Object.keys(def.args)) {
      const a = operand.args[name];
      args[name] = a === undefined ? undefined : evaluateOperand(fields, a, row, get);
    }
    return def.evaluate(args);
  }
  return 'ref' in operand ? get(row, operand.ref) : operand.value;
}

const DAY = 864e5;
const UNITS = new Set(['day', 'week', 'month', 'year']);
const DIRECTIONS = new Set(['ago', 'from now']);

/**
 * relativeDate's formats interpolate its raw arguments (SQL has no placeholder inside INTERVAL '…'),
 * so they're checked here as well as by validation: callers that skip validation still can't inject.
 */
function relativeArgs({ amount, unit, direction }: Readonly<Record<string, unknown>>): { amount: number; unit: string; direction: string } {
  const n = Number(amount);
  if (!Number.isInteger(n) || n < 0 || n > 1e6 || typeof unit !== 'string' || !UNITS.has(unit) || typeof direction !== 'string' || !DIRECTIONS.has(direction)) {
    throw new Error('trawlnet: relativeDate needs a whole amount, a unit (day, week, month, year) and a direction (ago, from now)');
  }
  return { amount: n, unit, direction };
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function shiftDate(amount: number, unit: string, direction: string): string {
  const d = new Date();
  const sign = direction === 'ago' ? -1 : 1;
  if (unit === 'day') d.setTime(d.getTime() + sign * amount * DAY);
  else if (unit === 'week') d.setTime(d.getTime() + sign * amount * 7 * DAY);
  else if (unit === 'month') d.setUTCMonth(d.getUTCMonth() + sign * amount);
  else d.setUTCFullYear(d.getUTCFullYear() + sign * amount);
  return isoDate(d);
}

// Declared outside defineFunction(): its contextual type sends enum inference into deep recursion.
const unitArg = f.enum(['day', 'week', 'month', 'year'], { defaultValue: 'day' });
const directionArg = f.enum(['ago', 'from now'], { defaultValue: 'ago' });

/** Ready-made functions mirroring RAQB's basic set. Add them with `defineFields(fields, { functions: builtinFunctions })`. */
export const builtinFunctions = {
  lower: defineFunction({
    label: 'Lowercase',
    returns: f.text(),
    args: { text: f.text() },
    evaluate: ({ text }) => (typeof text === 'string' ? text.toLowerCase() : text),
    formats: {
      sql: ({ text }) => `LOWER(${text})`,
      mongo: ({ text }) => ({ $toLower: text }),
      jsonlogic: ({ text }) => ({ lower: [text] }),
      spel: ({ text }) => `${text}.toLowerCase()`,
      text: ({ text }) => `lowercase(${text})`,
    },
  }),
  upper: defineFunction({
    label: 'Uppercase',
    returns: f.text(),
    args: { text: f.text() },
    evaluate: ({ text }) => (typeof text === 'string' ? text.toUpperCase() : text),
    formats: {
      sql: ({ text }) => `UPPER(${text})`,
      mongo: ({ text }) => ({ $toUpper: text }),
      jsonlogic: ({ text }) => ({ upper: [text] }),
      spel: ({ text }) => `${text}.toUpperCase()`,
      text: ({ text }) => `uppercase(${text})`,
    },
  }),
  length: defineFunction({
    label: 'Length',
    returns: f.number(),
    args: { text: f.text() },
    evaluate: ({ text }) => (typeof text === 'string' ? text.length : null),
    formats: {
      sql: ({ text }) => `LENGTH(${text})`,
      mongo: ({ text }) => ({ $strLenCP: text }),
      spel: ({ text }) => `${text}.length()`,
      text: ({ text }) => `length(${text})`,
    },
  }),
  now: defineFunction({
    label: 'Now',
    returns: f.datetime(),
    args: {},
    evaluate: () => new Date().toISOString(),
    formats: {
      sql: () => 'CURRENT_TIMESTAMP',
      mongo: () => '$$NOW',
      jsonlogic: () => ({ now: [] }),
      spel: () => 'T(java.time.LocalDateTime).now()',
      elasticsearch: () => 'now',
      text: () => 'now',
    },
  }),
  today: defineFunction({
    label: 'Today',
    returns: f.date(),
    args: {},
    evaluate: () => isoDate(new Date()),
    formats: {
      sql: () => 'CURRENT_DATE',
      jsonlogic: () => ({ today: [] }),
      spel: () => 'T(java.time.LocalDate).now()',
      elasticsearch: () => 'now/d',
      text: () => 'today',
    },
  }),
  relativeDate: defineFunction({
    label: 'Relative date',
    description: 'A date relative to today, e.g. 7 days ago',
    returns: f.date(),
    args: {
      amount: f.number({ integer: true, min: 0, defaultValue: 7 }),
      unit: unitArg,
      direction: directionArg,
    },
    evaluate: ({ amount, unit, direction }) => shiftDate(Number(amount ?? 0), String(unit), String(direction)),
    formats: {
      sql: (_, raw) => {
        const { amount, unit, direction } = relativeArgs(raw);
        return `CURRENT_DATE ${direction === 'ago' ? '-' : '+'} INTERVAL '${amount} ${unit}'`;
      },
      elasticsearch: (_, raw) => {
        const { amount, unit, direction } = relativeArgs(raw);
        return `now${direction === 'ago' ? '-' : '+'}${amount}${({ day: 'd', week: 'w', month: 'M', year: 'y' } as Record<string, string>)[unit]}/d`;
      },
      text: (_, raw) => {
        const { amount, unit, direction } = relativeArgs(raw);
        return `${amount} ${unit}${amount === 1 ? '' : 's'} ${direction}`;
      },
    },
  }),
} satisfies Record<string, FunctionDef>;
