/** @jsxImportSource solid-js */
// Behaviour the shared per-store channels must keep: drop indicators and drag state, permission
// cascades, custom components (including the public DnD primitives), and nodes changing kind.
import { createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
import { createSignal, For } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { DefaultRule, DefaultValueEditor, QueryBuilder, useDragHandle, useDropTarget, useGroup, useRule, type ValueEditorProps } from '../src/index';

const fields = defineFields({ name: f.text(), age: f.number(), status: f.enum(['active', 'banned']) });
type Q = QueryOf<typeof fields>;
const rule = (value: string) => ({ kind: 'rule' as const, field: 'name' as const, operator: 'eq' as const, value });
const initial: Q = {
  kind: 'group',
  combinator: 'and',
  children: [rule('a'), rule('b'), rule('c'), { kind: 'group', combinator: 'or', children: [] }],
};

const disposers: (() => void)[] = [];
afterEach(() => {
  disposers.splice(0).forEach((d) => d());
  document.body.innerHTML = '';
});
const mountIt = (ui: () => any) => {
  const host = document.createElement('div');
  document.body.append(host);
  disposers.push(render(ui, host));
  return host;
};
// jsdom has no DragEvent; the handlers only need bubbling, cancelation and clientY.
const drag = (el: Element, type: string, clientY = 0) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY }));
const classesOf = (host: Element, cls: string) => [...host.querySelectorAll('.qn-rule, .qn-group')].filter((el) => el.classList.contains(cls)).map((el) => el.getAttribute('data-qn-id'));

describe('Solid drag and drop', () => {
  it('marks the dragged row and exactly one drop target, then moves on drop', () => {
    const store = createQueryStore({ fields, initial });
    const host = mountIt(() => <QueryBuilder store={store} />);
    const [a, b, c, g] = store.getGroup(store.rootId).children;
    const row = (id: string) => host.querySelector(`[data-qn-id="${id}"]`)!;

    drag(row(c!).querySelector('.qn-handle')!, 'dragstart');
    expect(classesOf(host, 'qn-dragging')).toEqual([c]);

    // jsdom rects are all zero: above the midpoint drops before the row, below drops after it.
    drag(row(a!), 'dragover', -1);
    expect(classesOf(host, 'qn-drop-before')).toEqual([a]);
    drag(row(a!), 'dragover', 1);
    expect(classesOf(host, 'qn-drop-before')).toEqual([b]);
    expect(classesOf(host, 'qn-drop-after')).toEqual([]);
    // Past the last child: the last row shows the line after it.
    drag(row(g!), 'dragover', 1);
    expect(classesOf(host, 'qn-drop-before')).toEqual([]);
    expect(classesOf(host, 'qn-drop-after')).toEqual([g]);
    // An empty group's children area accepts the drop inside it.
    drag(row(g!).querySelector('.qn-children')!, 'dragover');
    expect(classesOf(host, 'qn-drop-after')).toEqual([]);
    expect(host.querySelector('.qn-drop-inside')).toBe(row(g!).querySelector('.qn-children'));

    drag(row(a!), 'dragover', -1);
    drag(row(a!), 'drop', -1);
    expect(store.getGroup(store.rootId).children).toEqual([c, a, b, g]);
    expect([...host.querySelectorAll('.qn-group > .qn-children > .qn-rule')].map((el) => el.getAttribute('data-qn-id'))).toEqual([c, a, b]);
    expect(classesOf(host, 'qn-dragging')).toEqual([]);
    expect(classesOf(host, 'qn-drop-before')).toEqual([]);
    expect(host.querySelector('.qn-drop-inside')).toBeNull();
  });

  it('keeps the public drag primitives working in custom rules', () => {
    const store = createQueryStore({ fields, initial });
    function DraggableRule(props: { id: string }) {
      const { isDragging, handleProps } = useDragHandle(props.id);
      const { position, dropProps } = useDropTarget(props.id);
      return (
        <div class="custom" classList={{ dragging: isDragging(), before: position() === 'before' }} {...dropProps}>
          <span class="grip" {...handleProps} />
        </div>
      );
    }
    const host = mountIt(() => <QueryBuilder store={store} components={{ Rule: DraggableRule }} />);
    const rows = [...host.querySelectorAll('.custom')];
    drag(rows[2]!.querySelector('.grip')!, 'dragstart');
    expect(rows.map((r) => r.classList.contains('dragging'))).toEqual([false, false, true]);
    drag(rows[1]!, 'dragover', -1);
    expect(rows.map((r) => r.classList.contains('before'))).toEqual([false, true, false]);
    drag(rows[1]!, 'drop', -1);
    const [a, b, c] = initial.children as unknown as { value: string }[];
    expect(
      store
        .getQuery()
        .children.slice(0, 3)
        .map((r) => (r as { value: string }).value),
    ).toEqual([a!.value, c!.value, b!.value]);
  });
});

describe('Solid permissions', () => {
  it('cascades group locks to descendants live, and follows settings and limits', () => {
    const store = createQueryStore({ fields, initial: { ...initial, children: [rule('a'), { kind: 'group', combinator: 'or', children: [rule('b')] }] } as Q });
    const host = mountIt(() => <QueryBuilder store={store} showLock />);
    const group = store.getGroup(store.rootId).children[1]!;
    const inner = store.getGroup(group).children[0]!;
    const innerRow = () => host.querySelector(`.qn-rule[data-qn-id="${inner}"]`)!;
    const outerRow = () => host.querySelector('.qn-group > .qn-children > .qn-rule')!;

    store.setLocked(group, true);
    expect(innerRow().classList.contains('qn-locked')).toBe(true);
    expect(innerRow().querySelector<HTMLSelectElement>('select.qn-field')!.disabled).toBe(true);
    expect(innerRow().querySelector<HTMLInputElement>('input.qn-value')!.disabled).toBe(true);
    expect(outerRow().classList.contains('qn-locked')).toBe(false);
    expect(outerRow().querySelector<HTMLSelectElement>('select.qn-operator')!.disabled).toBe(false);
    store.setLocked(group, false);
    expect(innerRow().classList.contains('qn-locked')).toBe(false);
    expect(innerRow().querySelector<HTMLSelectElement>('select.qn-field')!.disabled).toBe(false);

    store.setSettings({ immutable: { values: true } });
    expect(outerRow().querySelector<HTMLInputElement>('input.qn-value')!.disabled).toBe(true);
    expect(outerRow().querySelector<HTMLSelectElement>('select.qn-field')!.disabled).toBe(false);
    store.setSettings({ immutable: {}, maxRules: 2 });
    expect([...host.querySelectorAll<HTMLButtonElement>('button[title="Duplicate"]')].every((b) => b.disabled)).toBe(true);
    store.remove(inner);
    expect(outerRow().querySelector<HTMLButtonElement>('button[title="Duplicate"]')!.disabled).toBe(false);
  });
});

describe('Solid custom components and kind changes', () => {
  it('passes live props to a custom value editor and can wrap the default one', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [rule('a')] } as Q });
    const seen: string[] = [];
    function Wrapped(props: ValueEditorProps) {
      return (
        <span class="wrap" data-type={(seen.push(props.editor.type), props.editor.type)}>
          <DefaultValueEditor {...props} />
        </span>
      );
    }
    const host = mountIt(() => <QueryBuilder store={store} components={{ ValueEditor: Wrapped }} />);
    const id = store.getGroup(store.rootId).children[0]!;
    expect(host.querySelector('.wrap input.qn-value')!.getAttribute('type')).toBe('text');
    store.setField(id, 'age');
    expect(host.querySelector('.wrap')!.getAttribute('data-type')).toBe('number');
    expect(host.querySelector('.wrap input.qn-value')!.getAttribute('type')).toBe('number');
    store.setOperator(id, 'between');
    expect(host.querySelectorAll('.wrap .qn-value-pair input')).toHaveLength(2);
    const second = host.querySelectorAll<HTMLInputElement>('.wrap .qn-value-pair input')[1]!;
    second.value = '9';
    second.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.getRule(id).value).toEqual([null, 9]);
    store.setField(id, 'status');
    expect(host.querySelector('.wrap select.qn-value')).not.toBeNull();
    store.setOperator(id, 'isNull');
    expect(host.querySelector('.wrap')!.children).toHaveLength(0);
  });

  it('renders custom groups at the root and for nested groups, with default rules inside', () => {
    const store = createQueryStore({ fields, initial });
    function MyGroup(props: { id: string }) {
      const g = useGroup(props.id);
      return (
        <section data-combinator={g.combinator()}>
          <For each={g.children()}>{(c) => (store.get(c)?.kind === 'group' ? <MyGroup id={c} /> : <DefaultRule id={c} />)}</For>
        </section>
      );
    }
    const host = mountIt(() => <QueryBuilder store={store} components={{ Group: MyGroup }} />);
    expect([...host.querySelectorAll('section')].map((s) => s.getAttribute('data-combinator'))).toEqual(['and', 'or']);
    expect(host.querySelectorAll('section > .qn-rule')).toHaveLength(3);
    store.setCombinator(store.rootId, 'or');
    expect(host.querySelector('section')!.getAttribute('data-combinator')).toBe('or');
  });

  it('re-renders a node whose kind changes under a controlled value', () => {
    const [q, setQ] = createSignal<Q>({ kind: 'group', combinator: 'and', children: [rule('a'), rule('b')] } as Q);
    const host = mountIt(() => <QueryBuilder<Q> fields={fields} value={q()} onChange={setQ} />);
    expect(host.querySelectorAll('.qn-rule')).toHaveLength(2);
    setQ({ kind: 'group', combinator: 'and', children: [rule('a'), { kind: 'group', combinator: 'or', children: [rule('x'), rule('y')] }] } as Q);
    expect(host.querySelectorAll('.qn-group')).toHaveLength(2);
    expect([...host.querySelectorAll<HTMLInputElement>('input.qn-value')].map((i) => i.value)).toEqual(['a', 'x', 'y']);
    setQ({ kind: 'group', combinator: 'and', children: [rule('a'), rule('z')] } as Q);
    expect(host.querySelectorAll('.qn-group')).toHaveLength(1);
    expect([...host.querySelectorAll<HTMLInputElement>('input.qn-value')].map((i) => i.value)).toEqual(['a', 'z']);
  });

  it('shares one node subscription between readers and drops it on unmount', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [rule('a')] } as Q });
    const id = store.getGroup(store.rootId).children[0]!;
    let reads = 0;
    function TwoReaders(props: { id: string }) {
      const a = useRule(props.id);
      const b = useRule(props.id);
      return <i>{(reads++, `${a.value()}${b.value()}`)}</i>;
    }
    const host = mountIt(() => <QueryBuilder store={store} components={{ Rule: TwoReaders }} />);
    expect(host.querySelector('i')!.textContent).toBe('aa');
    store.setRuleValue(id, 'q');
    expect(host.querySelector('i')!.textContent).toBe('qq');
    disposers.splice(0).forEach((d) => d());
    const before = reads;
    store.setRuleValue(id, 'r');
    expect(reads).toBe(before);
  });
});
