// Every codec in @trawlnet/core/formats, for the playground's Formats tab. Postgres for both SQL
// entries: the default ANSI dialect has no array operators.
import { native, type Codec } from '@trawlnet/core';
import { elasticsearch } from '@trawlnet/core/formats/elasticsearch';
import { jqqb } from '@trawlnet/core/formats/jqqb';
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';
import { mongo } from '@trawlnet/core/formats/mongo';
import { raqb } from '@trawlnet/core/formats/raqb';
import { rqb } from '@trawlnet/core/formats/rqb';
import { spel } from '@trawlnet/core/formats/spel';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { text } from '@trawlnet/core/formats/text';
import type { FormatEntry } from './FormatsPanel';

const c = (codec: unknown) => codec as Codec<unknown>;

export const FORMATS: FormatEntry[] = [
  { id: 'native', label: 'trawlnet', codec: c(native) },
  { id: 'sql', label: 'SQL (Postgres)', codec: c(sqlFormat({ dialect: 'postgres' })) },
  { id: 'sql+params', label: 'SQL + params', codec: c(sqlFormat({ dialect: 'postgres', params: 'numbered', quoteIdentifiers: true })) },
  { id: 'mongo', label: 'MongoDB', codec: c(mongo) },
  { id: 'jsonlogic', label: 'JsonLogic', codec: c(jsonlogic) },
  { id: 'rqb', label: 'react-querybuilder', codec: c(rqb) },
  { id: 'raqb', label: 'RAQB', codec: c(raqb) },
  { id: 'jqqb', label: 'jQuery QB', codec: c(jqqb) },
  { id: 'text', label: 'Text', codec: c(text) },
  { id: 'spel', label: 'SpEL', codec: c(spel) },
  { id: 'elasticsearch', label: 'Elasticsearch', codec: c(elasticsearch) },
];
