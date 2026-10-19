// Part of qnot (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
import { encode, type Fields, type Query, type QueryNode } from '@qnot/core';
import { textFormat } from '@qnot/core/formats/text';

// qnot's own human-readable codec (RAQB queryString), with lowercase words for prose.
const sentence = textFormat({ words: { and: 'and', or: 'or', not: 'not' } });

/** Plain-English rendering of a query or a single node, e.g. `Age ≥ 21 and Plan is any of Pro, Team`. */
export function describeQuery(fields: Fields, node: QueryNode): string {
  const q: Query = node.kind === 'group' ? node : { kind: 'group', combinator: 'and', children: [node] };
  try {
    return encode(sentence, q, fields) || 'everything';
  } catch (e) {
    return `(${(e as Error).message})`;
  }
}

export const describe = (fields: Fields, q: Query) => describeQuery(fields, q);
