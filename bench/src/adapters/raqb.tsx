import '@react-awesome-query-builder/ui/css/styles.css';
import { useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Utils as QbUtils, Query, Builder, BasicConfig, type Config, type ImmutableTree, type BuilderProps } from '@react-awesome-query-builder/ui';
import { FIELDS, makeTree, isGroup, pickNative, waitFor, markStart, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';

const config: Config = {
  ...BasicConfig,
  fields: Object.fromEntries(
    FIELDS.map((f) => [
      f.name,
      {
        label: f.label,
        type: f.type,
        valueSources: ['value'],
        ...(f.type === 'select' && { fieldSettings: { listValues: f.options!.map((o) => ({ value: o, title: o })) } }),
      },
    ]),
  ),
} as Config;

const toLogic = (g: CGroup): object => ({
  [g.combinator]: g.rules.map((r) => (isGroup(r) ? toLogic(r) : { '==': [{ var: r.field }, r.value] })),
});

let root: Root | null = null;
let prepared: object;
let current: ImmutableTree;

function App({ initial }: { initial: ImmutableTree }) {
  const [tree, setTree] = useState(initial);
  const onChange = useCallback((t: ImmutableTree) => { current = t; setTree(t); }, []);
  const renderBuilder = useCallback(
    (props: BuilderProps) => (
      <div className="query-builder-container">
        <div className="query-builder qb-lite"><Builder {...props} /></div>
      </div>
    ),
    [],
  );
  return <Query {...config} value={tree} onChange={onChange} renderBuilder={renderBuilder} />;
}

const adapter: Adapter = {
  name: 'react-awesome-query-builder',
  prepare(n) {
    const tree = QbUtils.loadFromJsonLogic(toLogic(makeTree(n)), config);
    if (!tree) throw new Error('RAQB failed to import tree');
    prepared = JSON.parse(JSON.stringify(QbUtils.getTree(tree)));
  },
  mount(el) {
    current = QbUtils.loadTree(prepared as any);
    root = createRoot(el);
    flushSync(() => root!.render(<App initial={current} />));
  },
  unmount() {
    root?.unmount();
    root = null;
  },
  ruleCount: (el) => el.querySelectorAll('.rule').length,
  textInputs: (el) =>
    Array.from(el.querySelectorAll<HTMLInputElement>('.rule .rule--value input[type="text"]')),
  addRule: (el) => {
    const header = el.querySelector('.query-builder > .group-or-rule-container > .group > .group--header')!;
    const btn = Array.from(header.querySelectorAll<HTMLButtonElement>('button')).find((b) => /add rule/i.test(b.textContent ?? ''));
    btn!.click();
  },
  sql: () => QbUtils.sqlFormat(current, config) ?? '',
  removeRule: (el, i) => rows(el)[i]!.querySelector<HTMLButtonElement>('.rule--header button')!.click(),
  async changeField(el, i, to) {
    await pickNative(rows(el)[i]!.querySelector('.rule--field select')!, to.name);
    const type = to.type === 'number' ? 'number' : 'text';
    return () => fieldOf(rows(el)[i]) === to.name && rows(el)[i]!.querySelector<HTMLInputElement>('.rule--value input')?.type === type;
  },
  async changeOperator(el, i, negate) {
    const op = negate ? 'not_equal' : 'equal';
    await pickNative(rows(el)[i]!.querySelector('.rule--operator select')!, op);
    return () => rows(el)[i]!.querySelector<HTMLSelectElement>('.rule--operator select')!.value === op;
  },
  // RAQB drags with mouse events: press on the handle, move over the top edge of the group's first rule, release.
  async reorder(el, from) {
    const row = rows(el)[from]!;
    const group = row.closest('.group')!;
    const moved = fieldOf(row);
    row.scrollIntoView({ block: 'center' }); // RAQB hit-tests with elementFromPoint, so both rows must be on screen
    const handle = row.querySelector<HTMLElement>('.qb-drag-handler')!;
    const h = handle.getBoundingClientRect();
    const fire = (t: EventTarget, type: string, x: number, y: number) =>
      t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1 }));
    fire(handle, 'mousedown', h.left + 2, h.top + 2);
    await new Promise((r) => setTimeout(r, 0)); // RAQB stores the drag start in its store, then renders the placeholder
    const first = group.querySelector<HTMLElement>('.rule')!;
    // RAQB moves the placeholder one slot per crossing, so glide up in small steps like a real pointer.
    let y = h.top + 2;
    for (let guard = 0; guard < 200 && y > first.getBoundingClientRect().top + 2; guard++) {
      y -= 6;
      fire(document.body, 'mousemove', h.left + 2, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    markStart();
    fire(document.body, 'mouseup', h.left + 2, y);
    await waitFor(() => !document.querySelector('.qb-draggable') || null, 2000).catch(() => undefined);
    return () => fieldOf(group.querySelector('.rule')!) === moved;
  },
  notes: { reorder: 'RAQB reorders live while the pointer moves; this times the release only.' },
};

const rows = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('.rule');
const fieldOf = (row: Element | undefined) => row?.querySelector<HTMLSelectElement>('.rule--field select')?.value;

install(adapter);
