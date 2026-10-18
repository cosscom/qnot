import 'devextreme/dist/css/dx.light.css';
import FilterBuilder from 'devextreme/ui/filter_builder';
import { FIELDS, makeTree, isGroup, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';

const fields = FIELDS.map((f) => ({
  dataField: f.name,
  caption: f.label,
  dataType: f.type === 'text' || f.type === 'select' ? 'string' : f.type,
  ...(f.type === 'select' && { lookup: { dataSource: f.options } }),
}));

// DevExtreme's filter expression: [cond, 'and', cond, 'and', ...]
const toDx = (g: CGroup): any[] =>
  g.rules.flatMap((r, i) => {
    const node = isGroup(r) ? toDx(r) : [r.field, '=', r.value];
    return i === 0 ? [node] : [g.combinator, node];
  });

let prepared: any[];
let fb: FilterBuilder | null = null;

const adapter: Adapter = {
  name: 'DevExtreme FilterBuilder',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toDx(makeTree(n))));
  },
  mount(el) {
    const host = document.createElement('div');
    el.appendChild(host);
    fb = new FilterBuilder(host, { fields: fields as any, value: prepared, maxGroupLevel: 10 });
  },
  unmount() {
    fb?.dispose();
    fb = null;
  },
  ruleCount: (el) => el.querySelectorAll('.dx-filterbuilder-item-field').length,
  // Values are shown as text and only become an editor after a click, so there is no inline typing path.
  textInputs: () => null,
  addRule: async (el) => {
    el.querySelector<HTMLElement>('.dx-filterbuilder > .dx-filterbuilder-group > .dx-filterbuilder-group-item .dx-filterbuilder-action-icon')!.click();
    const item = await waitFor(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.dx-treeview-item')).find((i) => /add condition/i.test(i.textContent ?? '')) ?? null,
    );
    // DevExtreme synthesizes its dxclick from pointer events, so a bare click() is ignored.
    for (const type of ['pointerdown', 'pointerup']) item.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true }));
    item.click();
  },
  sql: null,
};

async function waitFor<T>(f: () => T | null): Promise<T> {
  for (;;) {
    const v = f();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 0));
  }
}

install(adapter);
