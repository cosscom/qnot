import '@trawlnet/core/styles.css';
import { createQueryStore, defineFields, f, type Fields, type Query, type QueryStore } from '@trawlnet/core';
import { sql } from '@trawlnet/core/formats/sql';
import { encode } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { FIELDS, makeTree, isGroup, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';

const fields: Fields = defineFields(
  Object.fromEntries(
    FIELDS.map((d) => [
      d.name,
      d.type === 'text' ? f.text({ label: d.label }) : d.type === 'number' ? f.number({ label: d.label }) : d.type === 'select' ? f.enum(d.options!, { label: d.label }) : f.boolean({ label: d.label }),
    ]),
  ),
);

const toNative = (g: CGroup): Query => ({
  kind: 'group',
  combinator: g.combinator,
  children: g.rules.map((r) => (isGroup(r) ? toNative(r) : { kind: 'rule', field: r.field, operator: 'eq', value: r.value })),
});

let prepared: Query;
let store: QueryStore;
let root: Root | null = null;

const adapter: Adapter = {
  name: '@trawlnet/react',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toNative(makeTree(n))));
  },
  mount(el) {
    store = createQueryStore({ fields, initial: prepared });
    root = createRoot(el);
    flushSync(() => root!.render(<QueryBuilder store={store} />));
  },
  unmount() {
    root?.unmount();
    root = null;
  },
  ruleCount: (el) => el.querySelectorAll('.tn-rule').length,
  textInputs: (el) => Array.from(el.querySelectorAll<HTMLInputElement>('.tn-rule input.tn-value[type="text"]')),
  addRule: (el) => {
    const header = el.querySelector('.tn > .tn-group > .tn-group-header')!;
    Array.from(header.querySelectorAll('button')).find((b) => b.textContent === '+ Rule')!.click();
  },
  sql: () => String(encode(sql, store.getQuery(), fields)),
};

install(adapter);
