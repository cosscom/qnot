// Schema inference for the converter tools: codecs need a schema, a pasted query has none. We decode
// with a schema built from what we've learnt so far, look at the fields, operators and values in
// the result, and decode again with the tighter schema (so "21" becomes 21 and $in on a list field
// becomes hasAny). Everything here is pure and runs in the browser and at build time alike.
import {
  ARRAY_OPERATORS,
  BOOLEAN_OPERATORS,
  DATE_OPERATORS,
  MULTI_ENUM_OPERATORS,
  NUMBER_OPERATORS,
  TEXT_OPERATORS,
  builtinFunctions,
  decode,
  defineFields,
  f,
  isFnCall,
  type Codec,
  type Fields,
  type FieldsInput,
  type FnCall,
  type Operand,
  type Query,
  type QueryNode,
} from '@qnot/core';

export type InferredKind = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'multiEnum' | 'array';

export interface InferredField {
  name: string;
  kind: InferredKind;
  /** Operators the input used on this field. */
  operators: string[];
  /** Distinct values seen (first few), for multiEnum options and the schema panel. */
  values: unknown[];
  /** Element fields of an array field. */
  of?: InferredField[];
}

export interface InferredSchema {
  fields: InferredField[];
  /** The input calls built-in functions (lower(), now()…), so the schema registers them. */
  usesFunctions: boolean;
  /** Text fields match case-sensitively (only Mongo and Elasticsearch output differ). */
  caseSensitive?: boolean;
}

const MULTI_OPS = new Set(['hasAny', 'hasAll', 'hasNone', 'setEq', 'setNeq']);
const TEXT_MATCH_OPS = new Set(['contains', 'notContains', 'startsWith', 'endsWith']);
const RANGE_OPS = new Set(['lt', 'lte', 'gt', 'gte', 'between', 'notBetween']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?$/;
const MAX_VALUES = 12;

const DEFAULT_OPERATORS: Record<InferredKind, readonly string[]> = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  datetime: DATE_OPERATORS,
  time: DATE_OPERATORS,
  multiEnum: MULTI_ENUM_OPERATORS,
  array: ARRAY_OPERATORS,
};

/** The permissive operator list for a kind: everything a pasted query could reasonably use on it. */
const PERMISSIVE: Record<InferredKind, readonly string[]> = {
  text: [...TEXT_OPERATORS, 'lt', 'lte', 'gt', 'gte', 'between', 'notBetween'],
  number: [...NUMBER_OPERATORS, 'isEmpty', 'isNotEmpty'],
  boolean: [...BOOLEAN_OPERATORS, 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  date: [...DATE_OPERATORS, 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  datetime: [...DATE_OPERATORS, 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  time: [...DATE_OPERATORS, 'in', 'notIn', 'isEmpty', 'isNotEmpty'],
  multiEnum: MULTI_ENUM_OPERATORS,
  array: ARRAY_OPERATORS,
};

const FUNCTIONS = builtinFunctions as unknown as Record<string, { returns: { kind: string }; args: Record<string, { kind: string }> }>;

interface Obs {
  ops: Set<string>;
  values: unknown[];
  /** Kind required by context: a function's return type or argument type. */
  forced?: string;
  isArray: boolean;
  of: Map<string, Obs>;
}

const newObs = (): Obs => ({ ops: new Set(), values: [], isArray: false, of: new Map() });

function obsIn(scope: Map<string, Obs>, name: string): Obs {
  let o = scope.get(name);
  if (!o) scope.set(name, (o = newObs()));
  return o;
}

/** Fields, operators and values a decoded query uses, scope by scope (array groups nest). */
function observe(query: Query) {
  const root = new Map<string, Obs>();
  const links: [Map<string, Obs>, string, string][] = [];
  let usesFunctions = false;

  const visitCall = (call: FnCall, scope: Map<string, Obs>) => {
    usesFunctions = true;
    const def = FUNCTIONS[call.fn];
    for (const [name, arg] of Object.entries(call.args ?? {})) visitOperand(arg, scope, def?.args[name]?.kind);
  };
  const visitOperand = (o: Operand, scope: Map<string, Obs>, kind: string | undefined) => {
    if (!o || typeof o !== 'object') return;
    if (isFnCall(o)) visitCall(o, scope);
    else if ('ref' in o && typeof o.ref === 'string') {
      const obs = obsIn(scope, o.ref);
      if (kind) obs.forced ??= kind;
    }
  };
  const visit = (node: QueryNode, scope: Map<string, Obs>) => {
    if (node.kind === 'group') {
      if (node.of) {
        const obs = obsIn(scope, node.of.field);
        obs.isArray = true;
        for (const c of node.children) visit(c, obs.of);
      } else for (const c of node.children) visit(c, scope);
      return;
    }
    if (isFnCall(node.field)) {
      visitCall(node.field, scope);
      if (node.call) visitCall(node.call, scope);
      return;
    }
    const obs = obsIn(scope, node.field);
    obs.ops.add(node.operator);
    if (node.ref !== undefined) links.push([scope, node.field, node.ref]), obsIn(scope, node.ref);
    if (node.call) {
      visitCall(node.call, scope);
      const returns = FUNCTIONS[node.call.fn]?.returns.kind;
      if (returns) obs.forced ??= returns;
    }
    const vals = Array.isArray(node.value) ? node.value : [node.value];
    for (const v of vals) {
      if (v === null || v === undefined || v === '') continue;
      if (obs.values.length < 200 && !obs.values.some((x) => x === v)) obs.values.push(v);
    }
  };
  visit(query, root);
  return { root, links, usesFunctions };
}

function kindOf(o: Obs, name: string, hints: ReadonlyMap<string, Hint>): InferredKind {
  const hint = hints.get(name);
  if (o.isArray || hint === 'array') return 'array';
  if (hint === 'multiEnum' || [...o.ops].some((op) => MULTI_OPS.has(op))) return 'multiEnum';
  if (o.forced && o.forced in DEFAULT_OPERATORS) return o.forced as InferredKind;
  const vals = o.values;
  if (!vals.length) return 'text';
  if (vals.every((v) => typeof v === 'boolean')) return 'boolean';
  if (vals.every((v) => typeof v === 'number')) return 'number';
  if (vals.every((v) => typeof v === 'string')) {
    const strs = vals as string[];
    if ([...o.ops].some((op) => TEXT_MATCH_OPS.has(op))) return 'text';
    if (strs.every((s) => DATE.test(s))) return 'date';
    if (strs.every((s) => DATE.test(s) || DATETIME.test(s))) return 'datetime';
    if (strs.every((s) => TIME.test(s))) return 'time';
    // Loosely typed sources (react-querybuilder keeps "28") only become numbers when compared as numbers.
    if (strs.every((s) => NUMERIC.test(s)) && [...o.ops].every((op) => RANGE_OPS.has(op) || op === 'in' || op === 'notIn') && [...o.ops].some((op) => RANGE_OPS.has(op))) return 'number';
    return 'text';
  }
  if (vals.every((v) => typeof v === 'number' || (typeof v === 'string' && NUMERIC.test(v)))) return 'number';
  return 'text';
}

export type Hint = 'array' | 'multiEnum';

function build(scope: Map<string, Obs>, hints: ReadonlyMap<string, Hint>, links: [Map<string, Obs>, string, string][]): InferredField[] {
  const kinds = new Map<string, InferredKind>();
  for (const [name, o] of scope) kinds.set(name, kindOf(o, name, hints));
  // Field-to-field comparisons need both sides of one kind: a side with no values of its own follows the other.
  for (let pass = 0; pass < 3; pass++) {
    for (const [s, a, b] of links) {
      if (s !== scope) continue;
      const ka = kinds.get(a)!;
      const kb = kinds.get(b)!;
      if (ka === kb) continue;
      if (!scope.get(b)!.values.length) kinds.set(b, ka);
      else if (!scope.get(a)!.values.length) kinds.set(a, kb);
      else kinds.set(a, 'text'), kinds.set(b, 'text');
    }
  }
  const out: InferredField[] = [];
  for (const [name, o] of scope) {
    if (name === '') continue;
    const kind = kinds.get(name)!;
    const field: InferredField = { name, kind, operators: [...o.ops], values: o.values.slice(0, kind === 'multiEnum' ? 200 : MAX_VALUES) };
    if (kind === 'array') field.of = build(o.of, hints, links);
    out.push(field);
  }
  return out.sort((x, y) => (x.kind === 'array' ? 1 : 0) - (y.kind === 'array' ? 1 : 0));
}

/** A permissive schema for a decoded query: kinds from the values seen, every operator the query used allowed. */
export function inferSchema(query: Query, hints: ReadonlyMap<string, Hint> = new Map()): InferredSchema {
  const { root, links, usesFunctions } = observe(query);
  return { fields: build(root, hints, links), usesFunctions };
}

const operatorsFor = (fd: InferredField) => {
  const base = PERMISSIVE[fd.kind];
  return [...base, ...fd.operators.filter((op) => !base.includes(op))];
};

function toInput(list: readonly InferredField[], caseSensitive: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const fd of list) {
    const operators = operatorsFor(fd) as never;
    const common = { operators, required: true, ...(caseSensitive && fd.kind === 'text' && { caseSensitive: true }) };
    switch (fd.kind) {
      case 'array':
        out[fd.name] = f.array(toInput(fd.of ?? [], caseSensitive) as FieldsInput);
        break;
      case 'multiEnum':
        out[fd.name] = f.multiEnum(fd.values.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number'), { ...common, allowCustom: true });
        break;
      default:
        out[fd.name] = (f[fd.kind] as (o: object) => unknown)(common);
    }
  }
  return out;
}

/** The schema as qnot fields (with the built-in functions registered). */
export function toFields(schema: InferredSchema): Fields {
  return defineFields(toInput(schema.fields, !!schema.caseSensitive) as FieldsInput, { functions: builtinFunctions }) as Fields;
}

/** The first schema we try: nothing known except the fields an earlier attempt showed are lists. */
function hintedFields(hints: ReadonlyMap<string, Hint>): Fields {
  const list: InferredField[] = [...hints].map(([name, hint]) => ({ name, kind: hint, operators: [], values: [], of: hint === 'array' ? [] : undefined }));
  // Nested list fields: we don't know their scope yet, so every array's elements get them too.
  for (const fd of list) if (fd.of) fd.of = list.filter((x) => x !== fd).map((x) => ({ ...x, of: x.of ? [] : undefined }));
  return toFields({ fields: list, usesFunctions: true });
}

const NOT_ARRAY = /"([^"]+)" is not an array field/;

/** An array group whose children test the element itself (JsonLogic `{var: ''}`): really a multi-value field. */
function scalarListGroup(node: QueryNode): string | undefined {
  if (node.kind !== 'group') return undefined;
  if (node.of && node.children.some((c) => c.kind === 'rule' && c.field === '')) return node.of.field;
  for (const c of node.children) {
    const hit = scalarListGroup(c);
    if (hit) return hit;
  }
  return undefined;
}

const sameKinds = (a: readonly InferredField[], b: readonly InferredField[]): boolean =>
  a.length === b.length && a.every((x, i) => x.name === b[i]!.name && x.kind === b[i]!.kind && sameKinds(x.of ?? [], b[i]!.of ?? []));

export interface Inferred {
  query: Query;
  schema: InferredSchema;
  fields: Fields;
}

/**
 * Decode `input` without a schema: decode with what we know, learn the fields from the result, and
 * decode again until the schema stops changing. Throws the codec's own error when the input can't be read.
 */
export function decodeInferred(codec: Codec<any>, input: unknown): Inferred {
  const hints = new Map<string, Hint>();
  let fields = hintedFields(hints);
  let previous: InferredSchema | undefined;
  for (let attempt = 0; attempt < 16; attempt++) {
    let query: Query;
    try {
      query = decode(codec, input, fields);
    } catch (e) {
      const m = NOT_ARRAY.exec((e as Error).message);
      const name = m?.[1];
      if (name !== undefined && hints.get(name) !== 'array') {
        hints.set(name, 'array');
        fields = hintedFields(hints);
        previous = undefined;
        continue;
      }
      throw e;
    }
    const listField = scalarListGroup(query);
    if (listField !== undefined && hints.get(listField) !== 'multiEnum') {
      hints.set(listField, 'multiEnum');
      fields = hintedFields(hints);
      previous = undefined;
      continue;
    }
    const schema = inferSchema(query, hints);
    if (previous && sameKinds(previous.fields, schema.fields)) return { query, schema, fields };
    previous = schema;
    fields = toFields(schema);
  }
  throw new Error('Could not infer a schema for this input');
}

// --- the schema as code ------------------------------------------------------------------------

const key = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
const lit = (v: unknown) => (typeof v === 'string' ? `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : String(v));

function fieldCode(fd: InferredField, indent: string, caseSensitive: boolean): string {
  const extra = fd.operators.filter((op) => !DEFAULT_OPERATORS[fd.kind].includes(op));
  const parts = [
    ...(extra.length ? [`operators: [${[...DEFAULT_OPERATORS[fd.kind], ...extra].map(lit).join(', ')}]`] : []),
    ...(caseSensitive && fd.kind === 'text' ? ['caseSensitive: true'] : []),
  ];
  const opts = parts.length ? `{ ${parts.join(', ')} }` : '';
  switch (fd.kind) {
    case 'array':
      return `f.array({\n${(fd.of ?? []).map((c) => `${indent}  ${key(c.name)}: ${fieldCode(c, `${indent}  `, caseSensitive)},\n`).join('')}${indent}})`;
    case 'multiEnum':
      return `f.multiEnum([${fd.values.map(lit).join(', ')}]${opts ? `, ${opts}` : ''})`;
    default:
      return `f.${fd.kind}(${opts})`;
  }
}

/** `defineFields({ … })` for the inferred schema, as a reader would write it. */
export function schemaCode(schema: InferredSchema): string {
  const body = schema.fields.map((fd) => `  ${key(fd.name)}: ${fieldCode(fd, '  ', !!schema.caseSensitive)},\n`).join('');
  return `const fields = defineFields({\n${body}}${schema.usesFunctions ? ', { functions: builtinFunctions }' : ''});`;
}

/** Every field, flattened with dotted element paths, for the schema table. */
export function flatFields(list: readonly InferredField[], prefix = ''): (InferredField & { path: string })[] {
  return list.flatMap((fd) => [{ ...fd, path: `${prefix}${fd.name}` }, ...(fd.of ? flatFields(fd.of, `${prefix}${fd.name}[].`) : [])]);
}
