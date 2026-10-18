import { fieldLabel, OPERATORS, type Fields, type Query, type QueryNode } from '@trawlnet/core';

const list = (xs: string[], joiner: string) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${joiner} ${xs.at(-1)}`);

function valueText(fields: Fields, field: string, v: unknown): string {
  const def = fields[field];
  if (v === null || v === undefined || v === '') return '…';
  const opt = def?.options?.find((o) => o.value === v);
  if (opt) return opt.label;
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return def?.kind === 'text' ? `“${v}”` : String(v);
}

type OpInfo = { label: string; arity: string };
const opInfo = (op: string): OpInfo | undefined => (OPERATORS as unknown as Record<string, OpInfo>)[op];

function ruleText(fields: Fields, r: Extract<QueryNode, { kind: 'rule' }>): string {
  const field = r.field as unknown;
  if (typeof field !== 'string') return `${(field as { name?: string }).name ?? 'f'}(…) ${opInfo(r.operator)?.label ?? r.operator} …`;
  const label = fieldLabel(field, fields[field]);
  const op = opInfo(r.operator)?.label ?? r.operator;
  if (r.ref !== undefined) return `${label} ${op} ${fieldLabel(r.ref, fields[r.ref])}`;
  if ((r as { call?: unknown }).call !== undefined) return `${label} ${op} ƒ(…)`;
  const v = r.value;
  switch (opInfo(r.operator)?.arity) {
    case 'none':
      return `${label} ${op}`;
    case 'two':
      return Array.isArray(v) ? `${label} ${op} ${valueText(fields, field, v[0])} and ${valueText(fields, field, v[1])}` : `${label} ${op} …`;
    case 'many':
      return `${label} ${op} ${Array.isArray(v) && v.length ? list(v.map((x) => valueText(fields, field, x)), 'or') : '…'}`;
    default:
      return `${label} ${op} ${valueText(fields, field, v)}`;
  }
}

/** Plain-English rendering of a query, e.g. `Stage is any of Proposal or Won and Amount is at least 10,000`. */
export function describeQuery(fields: Fields, node: QueryNode, nested = false): string {
  if (node.kind === 'rule') return ruleText(fields, node);
  const parts = node.children.map((c) => describeQuery(fields, c, true)).filter(Boolean);
  if (!parts.length) return nested ? '' : 'everything';
  const body = parts.join(node.combinator === 'and' ? ' and ' : ' or ');
  const wrapped = nested && parts.length > 1 ? `(${body})` : body;
  return node.not ? `not ${parts.length > 1 || nested ? wrapped : `(${wrapped})`}` : wrapped;
}

export const describe = (fields: Fields, q: Query) => describeQuery(fields, q);
