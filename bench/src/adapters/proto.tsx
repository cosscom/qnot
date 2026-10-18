import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { FIELDS, makeTree, isGroup, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';
import { createQueryStore, toSQL, type GroupJSON, type QueryStore } from '../proto/core';
import { QueryBuilder } from '../proto/ui';

const toProto = (g: CGroup): GroupJSON => ({
  combinator: g.combinator,
  rules: g.rules.map((r) => (isGroup(r) ? toProto(r) : { field: r.field, operator: '=', value: r.value })),
});

const css = document.createElement('style');
css.textContent = `.cqb-group{border:1px solid #ccc;border-radius:4px;padding:8px;margin:4px 0;background:#fafafa}
.cqb-group-header,.cqb-rule{display:flex;gap:6px;align-items:center;margin:4px 0}.cqb-children{padding-left:16px}`;
document.head.appendChild(css);

let prepared: GroupJSON;
let store: QueryStore;
let root: Root | null = null;

const adapter: Adapter = {
  name: 'prototype (core + hooks)',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toProto(makeTree(n))));
  },
  mount(el) {
    store = createQueryStore(prepared);
    root = createRoot(el);
    flushSync(() => root!.render(<QueryBuilder store={store} fields={FIELDS} />));
  },
  unmount() {
    root?.unmount();
    root = null;
  },
  ruleCount: (el) => el.querySelectorAll('.cqb-rule').length,
  textInputs: (el) => Array.from(el.querySelectorAll<HTMLInputElement>('.cqb-rule input.cqb-value[type="text"]')),
  addRule: (el) => el.querySelector<HTMLButtonElement>('.cqb > .cqb-group > .cqb-group-header > .cqb-add-rule')!.click(),
  sql: () => toSQL(store.toJSON()),
};

install(adapter);
