import type { Format } from '../codec';
import type { AnyFieldDef, Fields } from '../fields';
import { OPERATORS, type OperatorId } from '../operators';
import type { Group, Query, QueryNode, Rule } from '../types';
import { coerceScalar, group } from './_util';

/** A rule in react-awesome-query-builder's JSON tree (`Utils.getTree` output). */
export interface RAQBRule {
  id: string;
  type: 'rule';
  properties: {
    field: string | null;
    operator: string | null;
    value: unknown[];
    valueSrc: ('value' | 'field' | 'func' | 'const')[];
    valueType: string[];
    [extra: string]: unknown;
  };
}

/** A group in react-awesome-query-builder's JSON tree. `children1` may be an array or an id map. */
export interface RAQBGroup {
  id: string;
  type: 'group';
  children1?: (RAQBRule | RAQBGroup)[] | Record<string, RAQBRule | RAQBGroup>;
  properties?: { conjunction?: string; not?: boolean; [extra: string]: unknown };
}

type RAQBNode = RAQBRule | RAQBGroup;

const valueType = (def: AnyFieldDef | undefined): string => {
  switch (def?.kind) {
    case 'text':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'enum':
      return 'select';
    default:
      return def?.options ? 'select' : 'text';
  }
};

function toRaqbOperator(op: OperatorId, def: AnyFieldDef | undefined): string {
  const select = valueType(def) === 'select';
  switch (op) {
    case 'eq':
      return select ? 'select_equals' : 'equal';
    case 'neq':
      return select ? 'select_not_equals' : 'not_equal';
    case 'lt':
      return 'less';
    case 'lte':
      return 'less_or_equal';
    case 'gt':
      return 'greater';
    case 'gte':
      return 'greater_or_equal';
    case 'contains':
      return 'like';
    case 'notContains':
      return 'not_like';
    case 'startsWith':
      return 'starts_with';
    case 'endsWith':
      return 'ends_with';
    case 'between':
      return 'between';
    case 'notBetween':
      return 'not_between';
    // RAQB only offers list membership on select fields; non-select fields need it added to the RAQB config.
    case 'in':
      return 'select_any_in';
    case 'notIn':
      return 'select_not_any_in';
    case 'isNull':
      return 'is_null';
    case 'isNotNull':
      return 'is_not_null';
  }
}

const FROM_RAQB: Record<string, OperatorId> = {
  equal: 'eq',
  select_equals: 'eq',
  not_equal: 'neq',
  select_not_equals: 'neq',
  less: 'lt',
  less_or_equal: 'lte',
  greater: 'gt',
  greater_or_equal: 'gte',
  like: 'contains',
  not_like: 'notContains',
  starts_with: 'startsWith',
  ends_with: 'endsWith',
  between: 'between',
  not_between: 'notBetween',
  select_any_in: 'in',
  select_not_any_in: 'notIn',
  // Array-valued fields have no trawlnet equivalent; these are the closest list operators.
  multiselect_equals: 'in',
  multiselect_contains: 'in',
  multiselect_not_equals: 'notIn',
  multiselect_not_contains: 'notIn',
  is_null: 'isNull',
  is_not_null: 'isNotNull',
  is_empty: 'isNull',
  is_not_empty: 'isNotNull',
};

// RAQB requires ids. They're keyed by node identity so encoding stays pure and memoizable.
const ids = new WeakMap<object, string>();
let nextId = 0;
const idFor = (node: object) => {
  let id = ids.get(node);
  if (!id) ids.set(node, (id = `tn-${(nextId++).toString(36)}`));
  return id;
};

function encodeRule(rule: Rule, fields: Fields): RAQBRule {
  const def = fields[rule.field];
  const type = valueType(def);
  const operator = toRaqbOperator(rule.operator, def);
  const base = { id: idFor(rule), type: 'rule' as const };
  if (rule.ref !== undefined) {
    return { ...base, properties: { field: rule.field, operator, value: [rule.ref], valueSrc: ['field'], valueType: [type] } };
  }
  const v = rule.value;
  switch (OPERATORS[rule.operator].arity) {
    case 'none':
      return { ...base, properties: { field: rule.field, operator, value: [], valueSrc: [], valueType: [] } };
    case 'two': {
      const [a, b] = Array.isArray(v) ? v : [null, null];
      return { ...base, properties: { field: rule.field, operator, value: [a ?? null, b ?? null], valueSrc: ['value', 'value'], valueType: [type, type] } };
    }
    case 'many':
      return { ...base, properties: { field: rule.field, operator, value: [Array.isArray(v) ? v : []], valueSrc: ['value'], valueType: ['multiselect'] } };
    case 'one':
      return { ...base, properties: { field: rule.field, operator, value: [v ?? null], valueSrc: ['value'], valueType: [OPERATORS[rule.operator].textMatch ? 'text' : type] } };
  }
}

const encodeGroup = (g: Group, children: RAQBNode[]): RAQBGroup => ({
  id: idFor(g),
  type: 'group',
  children1: children,
  properties: { conjunction: g.combinator.toUpperCase(), not: !!g.not },
});

// --- decode ------------------------------------------------------------------------------------

const fail = (msg: string, what: unknown): never => {
  throw new Error(`trawlnet/raqb: ${msg}: ${JSON.stringify(what)}`);
};

function decodeRule(r: RAQBRule, fields: Fields): Rule {
  const { field, operator: raw, value = [], valueSrc = [] } = r.properties;
  if (typeof field !== 'string') return fail('unsupported field', field);
  const operator = raw ? FROM_RAQB[raw] : undefined;
  if (!operator) return fail('unsupported operator', raw);
  const def = fields[field];
  if (valueSrc[0] === 'field') return { kind: 'rule', field, operator, ref: String(value[0]) };
  if (valueSrc.some((s) => s === 'func')) return fail('function values are not supported', r);
  const c = (x: unknown) => coerceScalar(def, x);
  switch (OPERATORS[operator].arity) {
    case 'none':
      return { kind: 'rule', field, operator };
    case 'two':
      return { kind: 'rule', field, operator, value: [c(value[0]), c(value[1])] };
    case 'many': {
      const list = Array.isArray(value[0]) ? value[0] : value.filter((x) => x !== undefined && x !== null);
      return { kind: 'rule', field, operator, value: list.map(c) };
    }
    case 'one':
      return { kind: 'rule', field, operator, value: OPERATORS[operator].textMatch ? (value[0] ?? '') : c(value[0]) };
  }
}

function decodeNode(n: RAQBNode, fields: Fields): QueryNode {
  if (n.type === 'rule') return decodeRule(n, fields);
  if (n.type !== 'group') return fail('unsupported node type', (n as { type: unknown }).type);
  const kids = Array.isArray(n.children1) ? n.children1 : Object.values(n.children1 ?? {});
  const conj = (n.properties?.conjunction ?? 'AND').toLowerCase();
  if (conj !== 'and' && conj !== 'or') return fail('unsupported conjunction', conj);
  return group(conj, kids.map((k) => decodeNode(k, fields)), !!n.properties?.not);
}

/**
 * react-awesome-query-builder's JSON tree (load it with `Utils.loadTree`). Two-way and faithful, so
 * it works as a store `format`. Lists use `select_any_in`, which RAQB only enables for select
 * fields; multiselect operators decode to in/notIn approximately.
 */
export const raqb: Format<RAQBGroup, RAQBNode> = {
  name: 'raqb',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx.fields),
  encodeGroup: (g, children) => encodeGroup(g, children),
  decode: (tree, ctx) => {
    const node = decodeNode(tree, ctx.fields);
    return node.kind === 'group' ? node : group('and', [node]);
  },
};
