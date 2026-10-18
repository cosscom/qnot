import { f, registryOf, type AnyFieldDef, type Fields } from './fields';

/** A function call, usable as a rule's value (`rule.call`) or its left side (`rule.field`). */
export interface FnCall {
  readonly fn: string;
  readonly args: Readonly<Record<string, Operand>>;
}

/** A function argument: a literal, another field, or a nested call. */
export type Operand = { readonly value: unknown } | { readonly ref: string } | FnCall;

export const isFnCall = (x: unknown): x is FnCall => typeof x === 'object' && x !== null && 'fn' in x && 'args' in x;

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

export const functionOf = (fields: Fields, call: FnCall): FunctionDef | undefined => registryOf(fields).functions[call.fn];

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
      sql: (_, { amount, unit, direction }) => `CURRENT_DATE ${direction === 'ago' ? '-' : '+'} INTERVAL '${Number(amount)} ${unit}'`,
      elasticsearch: (_, { amount, unit, direction }) => `now${direction === 'ago' ? '-' : '+'}${Number(amount)}${({ day: 'd', week: 'w', month: 'M', year: 'y' } as Record<string, string>)[String(unit)]}/d`,
      text: (_, { amount, unit, direction }) => `${amount} ${unit}${Number(amount) === 1 ? '' : 's'} ${direction}`,
    },
  }),
} satisfies Record<string, FunctionDef>;
