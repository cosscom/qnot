// Vite-only: discovers every codec module in @trawlnet/core/formats at build time, so new formats
// (text, spel, elasticsearch…) show up without code changes. Other hosts can build the same list
// with static imports.
import { native, type Codec } from '@trawlnet/core';
import type { FormatEntry } from './FormatsPanel';

const modules = import.meta.glob<Record<string, unknown>>(['../../../packages/core/src/formats/*.ts', '!**/*.test.ts', '!**/_*.ts'], { eager: true });

const LABELS: Record<string, string> = {
  native: 'trawlnet',
  sql: 'SQL',
  'sql+params': 'SQL + params',
  mongo: 'MongoDB',
  jsonlogic: 'JsonLogic',
  rqb: 'react-querybuilder',
  raqb: 'RAQB',
  jqqb: 'jQuery QB',
  text: 'Text',
  spel: 'SpEL',
  elasticsearch: 'Elasticsearch',
};
const ORDER = Object.keys(LABELS);

const isCodec = (x: unknown): x is Codec<unknown> => typeof x === 'object' && x !== null && typeof (x as Codec<unknown>).encodeRule === 'function';


function discover(): FormatEntry[] {
  const out = new Map<string, FormatEntry>([['native', { id: 'native', label: LABELS.native!, codec: native }]]);
  for (const mod of Object.values(modules)) {
    for (const value of Object.values(mod)) {
      if (isCodec(value) && !out.has(value.name)) out.set(value.name, { id: value.name, label: LABELS[value.name] ?? value.name, codec: value });
    }
    if (typeof mod.sqlFormat === 'function') {
      // Postgres for both SQL tabs: the default ANSI dialect has no array operators.
      const sqlFormat = mod.sqlFormat as (o: object) => Codec<unknown>;
      out.set('sql', { id: 'sql', label: 'SQL (Postgres)', codec: sqlFormat({ dialect: 'postgres' }) });
      out.set('sql+params', { id: 'sql+params', label: LABELS['sql+params']!, codec: sqlFormat({ dialect: 'postgres', params: 'numbered', quoteIdentifiers: true }) });
    }
  }
  return [...out.values()].sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
}

export const FORMATS = discover();

