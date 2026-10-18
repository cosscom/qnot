// @vitest-environment jsdom
import { createQueryStore, defineFields, f, type QueryOf } from '@trawlnet/core';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { QueryBuilder, provideQueryStore, useQuery, useRule } from './index';

const fields = defineFields({ name: f.text(), age: f.number(), status: f.enum(['active', 'banned']) });
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

// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
async function change(w: { trigger(e: string): Promise<void>; setValue(v: unknown): Promise<void> }, value: unknown) {
  await w.trigger('focus');
  await w.setValue(value);
}

const wrappers: { unmount(): void }[] = [];
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
const mountIt = (...args: Parameters<typeof mount>) => {
  const w = mount(...args);
  wrappers.push(w);
  return w;
};

describe('Vue <QueryBuilder>', () => {
  it('renders, edits, and emits change', async () => {
    const w = mountIt(QueryBuilder, { props: { fields, initial }, attachTo: document.body });
    expect(w.findAll('.tn-rule')).toHaveLength(3);
    await change(w.find('input.tn-value[type="text"]'), 'Grace');
    const changes = w.emitted('change')!;
    expect((changes.at(-1)![0] as Q).children[0]).toEqual({ kind: 'rule', field: 'name', operator: 'eq', value: 'Grace' });
  });

  it('re-renders only the edited rule', async () => {
    const store = createQueryStore({ fields, initial });
    const renders = new Map<string, number>();
    const CountingRule = defineComponent({
      props: { id: { type: String, required: true } },
      setup(props) {
        const { rule, setValue } = useRule(props.id);
        return () => {
          renders.set(props.id, (renders.get(props.id) ?? 0) + 1);
          return h('input', { class: 'counting', value: String(rule.value.value ?? ''), onInput: (e: Event) => setValue((e.target as HTMLInputElement).value) });
        };
      },
    });
    const w = mountIt(QueryBuilder, { props: { store, components: { Rule: CountingRule } } });
    const [a, b, c] = store.getGroup(store.rootId).children;
    renders.clear();
    await change(w.find('input.counting'), 'Grace');
    await nextTick();
    expect(renders.get(a!)).toBe(1);
    expect(renders.get(b!)).toBeUndefined();
    expect(renders.get(c!)).toBeUndefined();
  });

  it('supports v-model and external changes', async () => {
    const model = ref<Q>(initial);
    const App = defineComponent(() => () => h(QueryBuilder, { fields, modelValue: model.value, 'onUpdate:modelValue': (v: unknown) => (model.value = v as Q) }));
    const w = mountIt(App);
    await change(w.find('input.tn-value[type="number"]'), '41');
    expect(model.value.children[1]).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 41 });
    model.value = { ...model.value, children: model.value.children.slice(1) };
    await nextTick();
    expect(w.findAll('.tn-rule')).toHaveLength(2);
  });

  it('adds groups/rules, switches operators, toggles NOT', async () => {
    const store = createQueryStore({ fields, initial });
    const w = mountIt(QueryBuilder, { props: { store } });
    await w.findAll('button').find((b) => b.text() === '+ Group')!.trigger('click');
    expect(w.findAll('.tn-group')).toHaveLength(2);
    await w.findAll('.tn-group')[1]!.findAll('button').find((b) => b.text() === '+ Rule')!.trigger('click');
    // New groups start with one rule (RAQB default), so this is the second.
    expect(store.getQuery().children[3]).toMatchObject({ kind: 'group', children: [{ kind: 'rule', field: 'name' }, { kind: 'rule', field: 'name' }] });
    await change(w.findAll('select.tn-operator')[1]!, 'between');
    expect(w.findAll('.tn-value-pair input')).toHaveLength(2);
    await change(w.find('.tn-not input'), true);
    expect(store.getQuery().not).toBe(true);
    store.undo();
    await nextTick();
    expect(store.getQuery().not).toBeUndefined();
  });

  it('exposes headless composables', async () => {
    const store = createQueryStore({ fields, initial });
    const Child = defineComponent(() => {
      const q = useQuery<typeof fields>();
      return () => h('pre', JSON.stringify(q.value.children[1]));
    });
    const Parent = defineComponent(() => {
      provideQueryStore(store);
      return () => h(Child);
    });
    const w = mountIt(Parent);
    store.setRuleValue(store.getGroup(store.rootId).children[1]!, 7);
    await nextTick();
    expect(JSON.parse(w.find('pre').text())).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 7 });
  });
});
