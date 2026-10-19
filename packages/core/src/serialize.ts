// Turn a field schema into JSON and back, so a server can send the schema to the client
// (RAQB compressConfig/decompressConfig). Functions can't travel as JSON, so validators and
// option searches are referenced by name and resolved from `ctx` on the way back.
import { defineFields, registryOf, type AnyFieldDef, type FieldsInput, type Fields, type SchemaOptions } from './fields';

export interface FieldJSON {
  readonly [key: string]: unknown;
  readonly kind: string;
}

export interface FieldsJSON {
  readonly version: 1;
  readonly fields: Readonly<Record<string, FieldJSON>>;
  /** Names of the custom operators and functions the schema used (they must be supplied again). */
  readonly operators?: readonly string[];
  readonly functions?: readonly string[];
}

export interface SerializeContext {
  /** Named functions the schema may reference: validators (`validate`) and option searches (`search`). */
  readonly fns?: Readonly<Record<string, (...args: any[]) => unknown>>;
}

function defToJSON(def: AnyFieldDef, names: Map<unknown, string>): FieldJSON {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(def)) {
    if (v === undefined) continue;
    if (typeof v === 'function') {
      const name = names.get(v);
      if (!name) throw new Error(`qnot: can't serialize "${k}": pass the function in ctx.fns so it can be referenced by name`);
      out[k] = { $fn: name };
    } else if (v instanceof RegExp) out[k] = { $regexp: v.source, flags: v.flags };
    else if (k === 'of') out[k] = Object.fromEntries(Object.entries(v as Fields).map(([n, d]) => [n, defToJSON(d, names)]));
    else out[k] = v;
  }
  return out as FieldJSON;
}

function defFromJSON(json: FieldJSON, fns: SerializeContext['fns']): AnyFieldDef {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) {
    if (v && typeof v === 'object' && '$fn' in v) {
      const fn = fns?.[(v as { $fn: string }).$fn];
      if (!fn) throw new Error(`qnot: missing function "${(v as { $fn: string }).$fn}" in ctx.fns`);
      out[k] = fn;
    } else if (v && typeof v === 'object' && '$regexp' in v) out[k] = new RegExp((v as { $regexp: string }).$regexp, (v as { flags?: string }).flags);
    else if (k === 'of') out[k] = Object.fromEntries(Object.entries(v as Record<string, FieldJSON>).map(([n, d]) => [n, defFromJSON(d, fns)]));
    else out[k] = v;
  }
  return out as unknown as AnyFieldDef;
}

export function fieldsToJSON(fields: Fields, ctx: SerializeContext = {}): FieldsJSON {
  const names = new Map(Object.entries(ctx.fns ?? {}).map(([n, f]) => [f as unknown, n]));
  const reg = registryOf(fields);
  return {
    version: 1,
    fields: Object.fromEntries(Object.entries(fields).map(([n, d]) => [n, defToJSON(d, names)])),
    ...(reg.operators.size && { operators: [...reg.operators.keys()] }),
    ...(Object.keys(reg.functions).length && { functions: Object.keys(reg.functions) }),
  };
}

/** Rebuild fields from `fieldsToJSON` output. Pass the same custom operators/functions in `schema`. */
export function fieldsFromJSON(json: FieldsJSON, ctx: SerializeContext & { schema?: SchemaOptions } = {}): Fields {
  if (json.version !== 1) throw new Error(`qnot: unsupported schema version ${String(json.version)}`);
  const missing = [
    ...(json.operators ?? []).filter((o) => !ctx.schema?.operators?.some((d) => d.id === o)),
    ...(json.functions ?? []).filter((n) => !ctx.schema?.functions?.[n]),
  ];
  if (missing.length) throw new Error(`qnot: schema needs ${missing.join(', ')}; pass them in ctx.schema`);
  const defs = Object.fromEntries(Object.entries(json.fields).map(([n, d]) => [n, defFromJSON(d, ctx.fns)]));
  return defineFields(defs as FieldsInput, ctx.schema) as Fields;
}
