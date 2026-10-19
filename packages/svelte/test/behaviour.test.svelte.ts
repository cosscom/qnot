// Behaviour the shared per-store channels and the inlined default rows must keep: drop indicators
// and drag state, permission cascades, custom components (including the public DnD primitives),
// nodes changing kind, and lazy selects following changes after they've been expanded.
import { createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index';
import DraggableRule from './DraggableRule.svelte';
import Harness from './Harness.svelte';
import MyGroup from './MyGroup.svelte';
import WrappedValueEditor from './WrappedValueEditor.svelte';

const fields = defineFields({ name: f.text(), age: f.number(), status: f.enum(['active', 'banned']), ok: f.boolean() });
type Q = QueryOf<typeof fields>;
const rule = (value: string) => ({ kind: 'rule' as const, field: 'name' as const, operator: 'eq' as const, value });
const initial: Q = {
  kind: 'group',
  combinator: 'and',
  children: [rule('a'), rule('b'), rule('c'), { kind: 'group', combinator: 'or', children: [] }],
};

const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
  mounted.splice(0).forEach((c) => unmount(c));
  document.body.innerHTML = '';
});
const render = (component: any, props: Record<string, unknown>) => {
  const target = document.createElement('div');
  document.body.append(target);
  mounted.push(mount(component, { target, props }));
  flushSync();
  return target;
};
// jsdom has no DragEvent; the handlers only need bubbling, cancelation and clientY.
const drag = (el: Element, type: string, clientY = 0) => {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY }));
  flushSync();
};
const classesOf = (host: Element, cls: string) => [...host.querySelectorAll('.qn-rule, .qn-group')].filter((el) => el.classList.contains(cls)).map((el) => el.getAttribute('data-qn-id'));
const input = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};

describe('Svelte drag and drop', () => {
  it('marks the dragged row and exactly one drop target, then moves on drop', () => {
    const store = createQueryStore({ fields, initial });
    const host = render(QueryBuilder, { store });
    const [a, b, c, g] = store.getGroup(store.rootId).children;
    const row = (id: string) => host.querySelector(`[data-qn-id="${id}"]`)!;

    drag(row(c!).querySelector('.qn-handle')!, 'dragstart');
    expect(classesOf(host, 'qn-dragging')).toEqual([c]);

    // jsdom rects are all zero: above the midpoint drops before the row, below drops after it.
    drag(row(a!), 'dragover', -1);
    expect(classesOf(host, 'qn-drop-before')).toEqual([a]);
    drag(row(a!).querySelector('select.qn-operator')!, 'dragover', 1);
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

  it('drags groups by their own handle only, into empty groups', () => {
    const store = createQueryStore({ fields, initial });
    const host = render(QueryBuilder, { store });
    const [a, , , g] = store.getGroup(store.rootId).children;
    const row = (id: string) => host.querySelector(`[data-qn-id="${id}"]`)!;
    // Dragging selected text out of an input is not a node drag.
    drag(row(a!).querySelector('input')!, 'dragstart');
    expect(classesOf(host, 'qn-dragging')).toEqual([]);
    drag(row(a!).querySelector('.qn-handle')!, 'dragstart');
    drag(row(g!).querySelector('.qn-children')!, 'dragover');
    drag(row(g!).querySelector('.qn-children')!, 'drop');
    expect(store.getGroup(g!).children).toEqual([a]);
    expect(row(g!).querySelector('.qn-children > .qn-rule')!.getAttribute('data-qn-id')).toBe(a);

    drag(row(g!).querySelector('.qn-group-header .qn-handle')!, 'dragstart');
    expect(classesOf(host, 'qn-dragging')).toEqual([g]);
    drag(row(g!).querySelector('.qn-handle')!, 'dragend');
    expect(classesOf(host, 'qn-dragging')).toEqual([]);
  });

  it('keeps the public drag primitives working in custom rules', () => {
    const store = createQueryStore({ fields, initial });
    const host = render(QueryBuilder, { store, components: { Rule: DraggableRule } });
    const rows = [...host.querySelectorAll('.custom')];
    drag(rows[2]!.querySelector('.grip')!, 'dragstart');
    expect(rows.map((r) => r.classList.contains('dragging'))).toEqual([false, false, true]);
    drag(rows[1]!, 'dragover', -1);
    expect(rows.map((r) => r.classList.contains('before'))).toEqual([false, true, false]);
    drag(rows[1]!, 'drop', -1);
    expect(store.getQuery().children.slice(0, 3).map((r) => (r as { value: string }).value)).toEqual(['a', 'c', 'b']);
  });
});

describe('Svelte permissions', () => {
  it('cascades group locks to descendants live, and follows settings and limits', () => {
    const store = createQueryStore({ fields, initial: { ...initial, children: [rule('a'), { kind: 'group', combinator: 'or', children: [rule('b')] }] } as Q });
    const host = render(QueryBuilder, { store, showLock: true });
    const group = store.getGroup(store.rootId).children[1]!;
    const inner = store.getGroup(group).children[0]!;
    const innerRow = () => host.querySelector(`.qn-rule[data-qn-id="${inner}"]`)!;
    const outerRow = () => host.querySelector('.qn-group > .qn-children > .qn-rule')!;
    const step = (fn: () => void) => {
      fn();
      flushSync();
    };

    step(() => store.setLocked(group, true));
    expect(innerRow().classList.contains('qn-locked')).toBe(true);
    expect(innerRow().querySelector<HTMLSelectElement>('select.qn-field')!.disabled).toBe(true);
    expect(innerRow().querySelector<HTMLInputElement>('input.qn-value')!.disabled).toBe(true);
    expect(outerRow().classList.contains('qn-locked')).toBe(false);
    expect(outerRow().querySelector<HTMLSelectElement>('select.qn-operator')!.disabled).toBe(false);
    step(() => store.setLocked(group, false));
    expect(innerRow().classList.contains('qn-locked')).toBe(false);
    expect(innerRow().querySelector<HTMLSelectElement>('select.qn-field')!.disabled).toBe(false);

    step(() => store.setSettings({ immutable: { values: true } }));
    expect(outerRow().querySelector<HTMLInputElement>('input.qn-value')!.disabled).toBe(true);
    expect(outerRow().querySelector<HTMLSelectElement>('select.qn-field')!.disabled).toBe(false);
    step(() => store.setSettings({ immutable: {}, maxRules: 2 }));
    expect([...host.querySelectorAll<HTMLButtonElement>('button[title="Duplicate"]')].every((b) => b.disabled)).toBe(true);
    step(() => store.remove(inner));
    expect(outerRow().querySelector<HTMLButtonElement>('button[title="Duplicate"]')!.disabled).toBe(false);
    // Restored by undo: the row comes back, live again.
    step(() => store.undo());
    step(() => store.setRuleValue(inner, 'b2'));
    expect(innerRow().querySelector<HTMLInputElement>('input.qn-value')!.value).toBe('b2');
  });
});

describe('Svelte custom components and kind changes', () => {
  it('passes live props to a custom value editor that wraps the default one', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [rule('a')] } as Q });
    const host = render(QueryBuilder, { store, components: { ValueEditor: WrappedValueEditor } });
    const id = store.getGroup(store.rootId).children[0]!;
    const step = (fn: () => void) => {
      fn();
      flushSync();
    };
    expect(host.querySelector('.wrap input.qn-value')!.getAttribute('type')).toBe('text');
    step(() => store.setField(id, 'age'));
    expect(host.querySelector('.wrap')!.getAttribute('data-type')).toBe('number');
    expect(host.querySelector('.wrap input.qn-value')!.getAttribute('type')).toBe('number');
    step(() => store.setOperator(id, 'between'));
    expect(host.querySelectorAll('.wrap .qn-value-pair input')).toHaveLength(2);
    input(host.querySelectorAll<HTMLInputElement>('.wrap .qn-value-pair input')[1]!, '9');
    expect(store.getRule(id).value).toEqual([null, 9]);
    step(() => store.setField(id, 'status'));
    expect(host.querySelector('.wrap select.qn-value')).not.toBeNull();
    step(() => store.setOperator(id, 'isNull'));
    expect(host.querySelector('.wrap')!.children).toHaveLength(0);
  });

  it('renders custom groups at the root and for nested groups, with default rules inside', () => {
    const store = createQueryStore({ fields, initial });
    const host = render(QueryBuilder, { store, components: { Group: MyGroup } });
    expect([...host.querySelectorAll('section')].map((s) => s.getAttribute('data-combinator'))).toEqual(['and', 'or']);
    expect(host.querySelectorAll('section > .qn-rule')).toHaveLength(3);
    store.setCombinator(store.rootId, 'or');
    flushSync();
    expect(host.querySelector('section')!.getAttribute('data-combinator')).toBe('or');
    // Default rules rendered on their own still drag.
    const [a, , c] = store.getGroup(store.rootId).children;
    drag(host.querySelector(`[data-qn-id="${c}"] .qn-handle`)!, 'dragstart');
    expect(classesOf(host, 'qn-dragging')).toEqual([c]);
    drag(host.querySelector(`[data-qn-id="${a}"]`)!, 'dragover', -1);
    expect(classesOf(host, 'qn-drop-before')).toEqual([a]);
  });

  it('re-renders a node whose kind changes under a controlled value', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const props = $state({ fields, value: { kind: 'group', combinator: 'and', children: [rule('a'), rule('b')] } as Q });
    mounted.push(mount(Harness, { target, props }));
    flushSync();
    expect(target.querySelectorAll('.qn-rule')).toHaveLength(2);
    props.value = { kind: 'group', combinator: 'and', children: [rule('a'), { kind: 'group', combinator: 'or', children: [rule('x'), rule('y')] }] } as Q;
    flushSync();
    expect(target.querySelectorAll('.qn-group')).toHaveLength(2);
    expect([...target.querySelectorAll<HTMLInputElement>('input.qn-value')].map((i) => i.value)).toEqual(['a', 'x', 'y']);
    props.value = { kind: 'group', combinator: 'and', children: [rule('a'), rule('z')] } as Q;
    flushSync();
    expect(target.querySelectorAll('.qn-group')).toHaveLength(1);
    expect([...target.querySelectorAll<HTMLInputElement>('input.qn-value')].map((i) => i.value)).toEqual(['a', 'z']);
  });
});

describe('Svelte value editors', () => {
  it('keeps the selection of an expanded lazy select in sync with outside changes', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [rule('a')] } as Q });
    const host = render(QueryBuilder, { store });
    const id = store.getGroup(store.rootId).children[0]!;
    const op = () => host.querySelector<HTMLSelectElement>('select.qn-operator')!;
    op().dispatchEvent(new FocusEvent('focus'));
    expect(op().options.length).toBeGreaterThan(1);
    op().value = 'neq';
    op().dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(store.getRule(id).operator).toBe('neq');
    store.undo();
    flushSync();
    expect(op().value).toBe('eq');
    // A new field brings a new operator list, re-rendered in place.
    store.setField(id, 'status');
    flushSync();
    expect([...op().options].map((o) => o.value)).toEqual(['eq', 'neq', 'in', 'notIn', 'isNull', 'isNotNull']);
    expect(op().value).toBe('eq');
    // The enum value select: placeholder first, selection follows the value.
    const value = () => host.querySelector<HTMLSelectElement>('select.qn-value')!;
    expect([...value().options].map((o) => o.value)).toEqual(['']);
    value().dispatchEvent(new MouseEvent('mouseenter'));
    expect([...value().options].map((o) => o.value)).toEqual(['', 'active', 'banned']);
    store.setRuleValue(id, 'banned');
    flushSync();
    expect(value().value).toBe('banned');
  });

  it('keeps in-progress number text and follows outside value changes', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'eq', value: 1 }] } as Q });
    const host = render(QueryBuilder, { store });
    const id = store.getGroup(store.rootId).children[0]!;
    const num = () => host.querySelector<HTMLInputElement>('input.qn-value')!;
    expect(num().value).toBe('1');
    input(num(), '1.0');
    expect(store.getRule(id).value).toBe(1);
    expect(num().value).toBe('1.0');
    input(num(), '1.5');
    expect(store.getRule(id).value).toBe(1.5);
    store.setRuleValue(id, 7);
    flushSync();
    expect(num().value).toBe('7');
  });

  it('renders boolean values with a plain select that follows changes', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'ok', operator: 'eq', value: true }] } as Q });
    const host = render(QueryBuilder, { store });
    const id = store.getGroup(store.rootId).children[0]!;
    const sel = () => host.querySelector<HTMLSelectElement>('select.qn-value')!;
    expect([...sel().options].map((o) => o.value)).toEqual(['', 'true', 'false']);
    expect(sel().value).toBe('true');
    sel().value = 'false';
    sel().dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(store.getRule(id).value).toBe(false);
    store.undo();
    flushSync();
    expect(sel().value).toBe('true');
  });
});
