import type { Fields } from './fields';
import type { Group, Query, QueryNode, Rule } from './types';

export interface CodecContext {
  readonly fields: Fields;
}

/**
 * Converts between trawlnet's native query and another representation (react-querybuilder JSON,
 * JsonLogic, SQL…). Encoding is node-wise so results can be memoized per node: native queries are
 * structurally shared, so re-encoding after an edit only redoes the edited node and its ancestors.
 */
export interface Codec<T, N = unknown> {
  readonly name: string;
  /** Encode one rule. Return `undefined` to leave it out (e.g. an incomplete rule in SQL). */
  encodeRule(rule: Rule, ctx: CodecContext): N | undefined;
  /** Encode a group from its already-encoded, non-skipped children. */
  encodeGroup(group: Group, children: N[], ctx: CodecContext): N | undefined;
  /** Turn the encoded root group into the final output (default: the root as-is). */
  finish?(root: N | undefined, ctx: CodecContext): T;
  /** Parse the representation back into a native query; present on two-way formats. */
  decode?(input: T, ctx: CodecContext): Query;
}

/** A two-way codec: usable as a store's `format` so `value`/`onChange` speak that shape. */
export type Format<T, N = unknown> = Codec<T, N> & { decode(input: T, ctx: CodecContext): Query };

const SKIPPED = Symbol('skipped');
const memo = new WeakMap<Codec<any>, WeakMap<Fields, WeakMap<QueryNode, unknown>>>();

function cacheFor(codec: Codec<any>, fields: Fields): WeakMap<QueryNode, unknown> {
  let byFields = memo.get(codec);
  if (!byFields) memo.set(codec, (byFields = new WeakMap()));
  let cache = byFields.get(fields);
  if (!cache) byFields.set(fields, (cache = new WeakMap()));
  return cache;
}

function encodeNode<N>(codec: Codec<any, N>, node: QueryNode, ctx: CodecContext, cache: WeakMap<QueryNode, unknown>): N | undefined {
  const hit = cache.get(node);
  if (hit !== undefined) return hit === SKIPPED ? undefined : (hit as N);
  let out: N | undefined;
  if (node.kind === 'rule') out = codec.encodeRule(node, ctx);
  else {
    const children: N[] = [];
    for (const c of node.children) {
      const e = encodeNode(codec, c, ctx, cache);
      if (e !== undefined) children.push(e);
    }
    out = codec.encodeGroup(node, children, ctx);
  }
  cache.set(node, out === undefined ? SKIPPED : out);
  return out;
}

/** Encode a native query with a codec. Memoized per node object, so repeated calls are cheap. */
export function encode<T, N>(codec: Codec<T, N>, query: Query, fields: Fields): T {
  const ctx: CodecContext = { fields };
  const root = encodeNode(codec, query, ctx, cacheFor(codec, fields));
  return codec.finish ? codec.finish(root, ctx) : (root as unknown as T);
}

export function decode<T>(codec: Codec<T>, input: T, fields: Fields): Query {
  if (!codec.decode) throw new Error(`trawlnet: the ${codec.name} codec is export-only`);
  return codec.decode(input, { fields });
}

/** The identity format: trawlnet's own JSON. */
export const native: Format<Query, QueryNode> = {
  name: 'native',
  encodeRule: (rule) => rule,
  encodeGroup: (group) => group,
  decode: (input) => input,
};
