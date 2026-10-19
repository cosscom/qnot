// @vitest-environment jsdom
import { createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Profiler, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultRule, QueryBuilder, QueryProvider, useHistory, useQuery, useRule } from './index';

const fields = defineFields({
  name: f.text(),
  age: f.number(),
  status: f.enum(['active', 'banned']),
});
type Q = QueryOf<typeof fields>;

const initial: Q = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
    { kind: 'rule', field: 'age', operator: 'gt', value: 30 },
    { kind: 'rule', field: 'status', operator: 'eq', value: 'active' },
  ],
};

afterEach(cleanup);

// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
function change(el: Element, init: { target: { value: string } }) {
  fireEvent.focus(el);
  fireEvent.change(el, init);
}

describe('<QueryBuilder>', () => {
  it('renders and edits an uncontrolled query', () => {
    const onChange = vi.fn();
    const { container } = render(<QueryBuilder fields={fields} initial={initial} onChange={onChange} />);
    expect(container.querySelectorAll('.qn-rule')).toHaveLength(3);
    change(container.querySelector('input.qn-value[type="text"]')!, { target: { value: 'Grace' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].children[0]).toEqual({ kind: 'rule', field: 'name', operator: 'eq', value: 'Grace' });
  });

  it('re-renders only the edited rule', () => {
    const store = createQueryStore({ fields, initial });
    const renders = new Map<string, number>();
    const CountingRule = ({ id }: { id: string }) => (
      <Profiler id={id} onRender={() => renders.set(id, (renders.get(id) ?? 0) + 1)}>
        <DefaultRule id={id} />
      </Profiler>
    );
    const { container } = render(<QueryBuilder store={store} components={{ Rule: CountingRule }} />);
    const [a, b, c] = store.getGroup(store.rootId).children;
    renders.clear();
    change(container.querySelector('input.qn-value[type="text"]')!, { target: { value: 'Grace' } });
    expect(renders.get(a!)).toBe(1);
    expect(renders.get(b!)).toBeUndefined();
    expect(renders.get(c!)).toBeUndefined();
  });

  it('works controlled, and echoing the value back is a no-op', () => {
    let latest: Q = initial;
    function App() {
      const [q, setQ] = useState(initial);
      latest = q;
      return <QueryBuilder fields={fields} value={q} onChange={setQ} />;
    }
    const { container } = render(<App />);
    change(container.querySelector('input.qn-value[type="number"]')!, { target: { value: '41' } });
    expect(latest.children[1]).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 41 });
    expect(container.querySelector<HTMLInputElement>('input.qn-value[type="number"]')!.value).toBe('41');
  });

  it('applies external controlled changes', () => {
    function App() {
      const [q, setQ] = useState(initial);
      return (
        <>
          <button onClick={() => setQ({ ...q, children: q.children.slice(1) })}>drop first</button>
          <QueryBuilder fields={fields} value={q} onChange={setQ} />
        </>
      );
    }
    const { container, getByText } = render(<App />);
    fireEvent.click(getByText('drop first'));
    expect(container.querySelectorAll('.qn-rule')).toHaveLength(2);
  });

  it('adds rules and groups, changes operators, undoes', () => {
    const store = createQueryStore({ fields, initial });
    function History() {
      const h = useHistory();
      return <button disabled={!h.canUndo} onClick={h.undo}>undo</button>;
    }
    const { container, getAllByText, getByText } = render(
      <QueryProvider store={store}>
        <History />
      </QueryProvider>,
    );
    render(<QueryBuilder store={store} />, { container: container.appendChild(document.createElement('div')) });
    fireEvent.click(getAllByText('+ Group')[0]!);
    expect(container.querySelectorAll('.qn-group')).toHaveLength(2);
    const op = container.querySelectorAll<HTMLSelectElement>('select.qn-operator')[1]!;
    change(op, { target: { value: 'between' } });
    expect(container.querySelectorAll('.qn-value-pair')).toHaveLength(1);
    expect(getByText('undo')).not.toHaveProperty('disabled', true);
    act(() => void store.undo());
    act(() => void store.undo());
    expect(store.getQuery()).toEqual(initial);
  });
});

describe('headless hooks', () => {
  it('exposes typed rule state for custom UIs', () => {
    const store = createQueryStore({ fields, initial });
    const id = store.getGroup(store.rootId).children[1]!;
    function Custom() {
      const { rule, editor, operators, setValue } = useRule<typeof fields>(id);
      const query = useQuery<typeof fields>();
      return (
        <div>
          <span data-testid="op">{rule.operator}</span>
          <span data-testid="editor">{editor.type}</span>
          <span data-testid="ops">{operators.length}</span>
          <span data-testid="json">{JSON.stringify(query.children[1])}</span>
          <button onClick={() => setValue(99)}>set</button>
        </div>
      );
    }
    const { getByTestId, getByText } = render(
      <QueryProvider store={store}>
        <Custom />
      </QueryProvider>,
    );
    expect(getByTestId('editor').textContent).toBe('number');
    expect(getByTestId('ops').textContent).toBe('12');
    fireEvent.click(getByText('set'));
    expect(JSON.parse(getByTestId('json').textContent!)).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 99 });
  });
});
