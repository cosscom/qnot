import '@react-awesome-query-builder/ui/css/styles.css';
import { useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Utils as QbUtils, Query, Builder, BasicConfig, type Config, type ImmutableTree, type BuilderProps } from '@react-awesome-query-builder/ui';
import { FIELDS, makeTree, isGroup, type Adapter, type CGroup } from '../shared';
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
};

install(adapter);
