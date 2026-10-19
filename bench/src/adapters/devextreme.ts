import 'devextreme/dist/css/dx.light.css';
import FilterBuilder from 'devextreme/ui/filter_builder';
import { FIELDS, makeTree, isGroup, waitFor, type Adapter, type CGroup } from '../shared';
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
    dxClick(item);
  },
  sql: null,
  removeRule: (el, i) => dxClick(rows(el)[i]!.querySelector<HTMLElement>('.dx-filterbuilder-action-icon.dx-icon-remove')!),
  async changeField(el, i, to) {
    await pickMenu(rows(el)[i]!.querySelector('.dx-filterbuilder-item-field')!, to.label);
    return () => rows(el)[i]!.querySelector('.dx-filterbuilder-item-field')!.textContent === to.label;
  },
  async changeOperator(el, i, negate) {
    const label = negate ? 'Does not equal' : 'Equals';
    await pickMenu(rows(el)[i]!.querySelector('.dx-filterbuilder-item-operation')!, label);
    return () => rows(el)[i]!.querySelector('.dx-filterbuilder-item-operation')!.textContent === label;
  },
  notes: { reorder: 'FilterBuilder has no drag and drop.', type: 'Values are shown as text and open an editor on click, so there is no inline typing path.' },
};

// Rule items: the group item that holds a field picker.
const rows = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('.dx-filterbuilder-item-field'), (f) => f.parentElement!);

// DevExtreme synthesizes its dxclick from pointer events, so a bare click() is ignored.
function dxClick(t: HTMLElement) {
  for (const type of ['pointerdown', 'pointerup']) t.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true }));
  t.click();
}

/** Open one of the filter builder's popup menus and pick the item labelled `label`. */
async function pickMenu(trigger: HTMLElement, label: string) {
  dxClick(trigger);
  const item = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.dx-overlay-wrapper .dx-treeview-item, .dx-overlay-wrapper .dx-list-item')).find(
      (i) => i.textContent?.trim() === label && i.offsetParent !== null,
    ),
  );
  dxClick(item);
}

install(adapter);
