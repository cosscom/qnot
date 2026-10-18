import type { Codec, CodecContext } from '../codec';
import type { Group, Rule } from '../types';
import { columnOf, encodeCall, encodeIn, groupScope, infoOf, isArrayGroupIn, isCompleteRule, isFnCall, ruleDef, type Operand } from './_util';

/** An Elasticsearch query DSL object (the value of `query` in a search request). */
export type EsQuery = { readonly [key: string]: unknown };

interface EsContext extends CodecContext {
  /** Path prefix inside `nested` queries (`orders.`). */
  readonly prefix?: string;
}

const RANGE: Record<string, string> = { lt: 'lt', lte: 'lte', gt: 'gt', gte: 'gte' };
const PAINLESS: Record<string, string> = { eq: '==', neq: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' };

const not = (q: EsQuery): EsQuery => ({ bool: { must_not: [q] } });
const escapeWildcard = (s: string) => s.replace(/[\\*?]/g, '\\$&');

function encodeRule(rule: Rule, ctx: EsContext): EsQuery | undefined {
  const { fields } = ctx;
  // Function calls are only supported on the value side (date math like `now-7d/d`).
  if (!isCompleteRule(fields, rule) || isFnCall(rule.field)) return undefined;
  const f = `${ctx.prefix ?? ''}${columnOf(fields, rule.field)}`;
  const def = ruleDef(fields, rule);
  const info = infoOf(fields, rule.operator);
  const v = rule.value;
  if (info.formats?.elasticsearch) return info.formats.elasticsearch({ field: f, value: v, raw: v }) as EsQuery;
  const ci = def?.kind === 'text' && !def.caseSensitive;
  const term = (x: unknown): EsQuery => ({ term: { [f]: ci ? { value: x, case_insensitive: true } : x } });
  const wildcard = (pattern: string): EsQuery => ({ wildcard: { [f]: { value: pattern, case_insensitive: !def?.caseSensitive } } });

  if (rule.ref !== undefined) {
    const other = `${ctx.prefix ?? ''}${columnOf(fields, rule.ref)}`;
    const source = `doc['${f}'].size() != 0 && doc['${other}'].size() != 0 && doc['${f}'].value ${PAINLESS[rule.operator]} doc['${other}'].value`;
    return { script: { script: { source, lang: 'painless' } } };
  }
  if (rule.call !== undefined) {
    const arg = (o: Operand): unknown => (isFnCall(o) ? encodeCall('elasticsearch', fields, o, arg) : 'ref' in o ? undefined : o.value);
    const x = arg(rule.call);
    if (x === undefined) return undefined;
    if (RANGE[rule.operator]) return { range: { [f]: { [RANGE[rule.operator]!]: x } } };
    const exact = { range: { [f]: { gte: x, lte: x } } };
    return rule.operator === 'eq' ? exact : rule.operator === 'neq' ? not(exact) : undefined;
  }
  const arrayKind = def?.kind === 'multiEnum' || def?.kind === 'array';
  switch (rule.operator) {
    case 'eq':
      return term(v);
    case 'neq':
      return not(term(v));
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      return { range: { [f]: { [RANGE[rule.operator]!]: v } } };
    case 'between':
    case 'notBetween': {
      const [lo, hi] = v as [unknown, unknown];
      const q = { range: { [f]: { gte: lo, lte: hi } } };
      return rule.operator === 'between' ? q : not(q);
    }
    case 'in':
    case 'hasAny':
      return { terms: { [f]: v } };
    case 'notIn':
    case 'hasNone':
      return not({ terms: { [f]: v } });
    case 'hasAll':
      return { bool: { must: (v as unknown[]).map((x) => ({ term: { [f]: x } })) } };
    case 'contains':
      return wildcard(`*${escapeWildcard(String(v))}*`);
    case 'notContains':
      return not(wildcard(`*${escapeWildcard(String(v))}*`));
    case 'startsWith':
      return wildcard(`${escapeWildcard(String(v))}*`);
    case 'endsWith':
      return wildcard(`*${escapeWildcard(String(v))}`);
    case 'isNull':
      return not({ exists: { field: f } });
    case 'isNotNull':
      return { exists: { field: f } };
    // Empty arrays aren't indexed, so `exists` already means "has at least one value" for them.
    case 'isEmpty':
      return arrayKind ? not({ exists: { field: f } }) : { bool: { should: [not({ exists: { field: f } }), { term: { [f]: '' } }], minimum_should_match: 1 } };
    case 'isNotEmpty':
      return arrayKind ? { exists: { field: f } } : { bool: { must: [{ exists: { field: f } }], must_not: [{ term: { [f]: '' } }] } };
  }
  // setEq / setNeq need a script over the whole array; not exported.
  return undefined;
}

function join(g: Pick<Group, 'combinator'>, kids: EsQuery[]): EsQuery | undefined {
  if (!kids.length) return undefined;
  return g.combinator === 'and' ? { bool: { must: kids } } : { bool: { should: kids, minimum_should_match: 1 } };
}

function encodeGroup(g: Group, children: EsQuery[], ctx: EsContext): EsQuery | undefined {
  let q: EsQuery | undefined;
  if (g.of) {
    const m = g.of.match;
    // Counting matching nested documents needs a script or aggregation; not exported.
    if (!isArrayGroupIn(ctx.fields, g) || typeof m !== 'string') return undefined;
    const path = `${ctx.prefix ?? ''}${columnOf(ctx.fields, g.of.field)}`;
    const inner = join(g, encodeIn(elasticsearch, g.children, { fields: groupScope(ctx.fields, g), prefix: `${path}.` } satisfies EsContext)) ?? { match_all: {} };
    const nested = (query: EsQuery): EsQuery => ({ nested: { path, query } });
    q = m === 'some' ? nested(inner) : m === 'none' ? not(nested(inner)) : not(nested(not(inner)));
  } else q = join(g, children);
  if (!q) return undefined;
  return g.not ? not(q) : q;
}

/**
 * Elasticsearch query DSL (export only): `bool` must/should/must_not, term/terms/range/wildcard/
 * exists, `nested` for array groups (map array fields as `nested`), painless scripts for field
 * comparisons. Text matching is case-insensitive unless the field sets `caseSensitive`.
 */
export const elasticsearch: Codec<EsQuery, EsQuery> = {
  name: 'elasticsearch',
  encodeRule: (rule, ctx) => encodeRule(rule, ctx),
  encodeGroup: (g, children, ctx) => encodeGroup(g, children, ctx),
  finish: (root) => root ?? { match_all: {} },
};
