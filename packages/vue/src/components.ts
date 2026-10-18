import {
  CLASS,
  fieldOptions,
  formatInput,
  formatList,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type EditorSpec,
  type Fields,
  type Format,
  type NodeId,
  type Option,
  type QueryStore,
} from '@trawlnet/core';
import { computed, defineComponent, Fragment, h, inject, onScopeDispose, provide, ref, watch, type Component, type InjectionKey, type PropType } from 'vue';
import {
  provideQueryStore,
  useDragHandle,
  useDropTarget,
  useGroup,
  useGroupDropZone,
  useNode,
  useQueryStore,
  useRule,
  useStore,
} from './composables';

export const DEFAULT_LABELS = {
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  addRule: '+ Rule',
  addGroup: '+ Group',
  remove: 'Remove',
  clone: 'Duplicate',
  drag: 'Drag to move',
  compareField: 'Compare with another field',
  compareValue: 'Compare with a value',
  yes: 'Yes',
  no: 'No',
  empty: '—',
  rangeSeparator: 'and',
};
export type Labels = typeof DEFAULT_LABELS;

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  labels: Labels;
}

export interface Components {
  /** Receives prop `id`. */
  Group: Component;
  /** Receives prop `id`. */
  Rule: Component;
  /** Receives `ValueEditorProps`. */
  ValueEditor: Component;
}

interface UI {
  labels: Labels;
  components: Components;
  fieldOptions: Option[];
}

const UI_KEY: InjectionKey<UI> = Symbol('trawlnet-ui');
const useUI = () => inject(UI_KEY)!;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const options = (list: readonly { value: unknown; label: string }[]) => list.map((o) => h('option', { key: String(o.value), value: String(o.value) }, o.label));

/** An input that keeps in-progress text ("1.", "3, ") while committing parsed values. */
const DraftInput = defineComponent({
  props: {
    type: { type: String, required: true },
    value: { type: null as unknown as PropType<unknown> },
    parse: { type: Function as PropType<(raw: string) => unknown>, required: true },
    format: { type: Function as PropType<(v: unknown) => string>, required: true },
    onChange: { type: Function as PropType<(v: unknown) => void>, required: true },
    invalid: Boolean,
  },
  setup(props) {
    const draft = ref(props.format(props.value));
    watch(
      () => props.value,
      (v) => {
        if (props.format(props.parse(draft.value)) !== props.format(v)) draft.value = props.format(v);
      },
    );
    return () =>
      h('input', {
        class: CLASS.value,
        type: props.type,
        value: draft.value,
        'aria-invalid': props.invalid || undefined,
        onInput: (e: Event) => {
          draft.value = (e.target as HTMLInputElement).value;
          props.onChange(props.parse(draft.value));
        },
      });
  },
});

function scalar(p: ValueEditorProps) {
  const invalid = p.invalid || undefined;
  switch (p.editor.type) {
    case 'boolean':
      return h(
        'select',
        { class: CLASS.value, value: formatInput(p.value), 'aria-invalid': invalid, onChange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; p.onChange(v === '' ? null : v === 'true'); } },
        [h('option', { value: '' }, p.labels.empty), h('option', { value: 'true' }, p.labels.yes), h('option', { value: 'false' }, p.labels.no)],
      );
    case 'select':
      return h(
        'select',
        { class: CLASS.value, value: formatInput(p.value), 'aria-invalid': invalid, onChange: (e: Event) => p.onChange(parseInput(p.def, (e.target as HTMLSelectElement).value)) },
        [h('option', { value: '' }, p.labels.empty), ...options(p.editor.options ?? [])],
      );
    case 'number':
    case 'date':
      return h(DraftInput, { type: p.editor.type, value: p.value, parse: (raw: string) => parseInput(p.def, raw), format: formatInput, onChange: p.onChange, invalid: p.invalid });
    default:
      return h('input', { class: CLASS.value, type: 'text', value: formatInput(p.value), 'aria-invalid': invalid, onInput: (e: Event) => p.onChange((e.target as HTMLInputElement).value) });
  }
}

export const DefaultValueEditor = defineComponent({
  name: 'TrawlnetValueEditor',
  props: {
    editor: { type: Object as PropType<EditorSpec>, required: true },
    def: { type: Object as PropType<AnyFieldDef>, default: undefined },
    value: { type: null as unknown as PropType<unknown> },
    onChange: { type: Function as PropType<(v: unknown) => void>, required: true },
    invalid: Boolean,
    labels: { type: Object as PropType<Labels>, required: true },
  },
  setup(props) {
    return () => {
      const p = props as ValueEditorProps;
      switch (p.editor.arity) {
        case 'none':
          return null;
        case 'two': {
          const pair = Array.isArray(p.value) ? p.value : [null, null];
          return h('span', { class: 'tn-value-pair' }, [
            scalar({ ...p, value: pair[0], onChange: (v) => p.onChange([v, pair[1]]) }),
            h('span', p.labels.rangeSeparator),
            scalar({ ...p, value: pair[1], onChange: (v) => p.onChange([pair[0], v]) }),
          ]);
        }
        case 'many': {
          if (p.editor.type === 'multiselect') {
            const chosen = new Set(Array.isArray(p.value) ? p.value.map(String) : []);
            return h(
              'select',
              {
                class: CLASS.value,
                multiple: true,
                'aria-invalid': p.invalid || undefined,
                onChange: (e: Event) => p.onChange([...(e.target as HTMLSelectElement).selectedOptions].map((o) => parseInput(p.def, o.value))),
              },
              (p.editor.options ?? []).map((o) => h('option', { key: String(o.value), value: String(o.value), selected: chosen.has(String(o.value)) }, o.label)),
            );
          }
          return h(DraftInput, { type: 'text', value: p.value, parse: (raw: string) => parseList(p.def, raw), format: formatList, onChange: p.onChange, invalid: p.invalid });
        }
        default:
          return scalar(p);
      }
    };
  },
});

const idProp = { id: { type: String, required: true } } as const;

export const DefaultRule = defineComponent({
  name: 'TrawlnetRule',
  props: idProp,
  setup(props) {
    const store = useStore();
    const { labels, components, fieldOptions: fields } = useUI();
    const r = useRule(props.id);
    const { isDragging, handleProps } = useDragHandle(props.id);
    const { position, dropProps } = useDropTarget(props.id);
    const refs = computed(() => (r.editor.value.allowsRef ? refOptions(store.fields, r.rule.value.field) : []));
    return () => {
      const rule = r.rule.value;
      const issues = r.issues.value;
      const invalid = issues.some((i) => i.severity === 'error');
      return h(
        'div',
        {
          class: cx(CLASS.rule, invalid && CLASS.invalid, isDragging.value && CLASS.dragging, position.value === 'before' && CLASS.dropBefore, position.value === 'after' && CLASS.dropAfter),
          title: invalid ? issues.map((i) => i.message).join('\n') : undefined,
          ...dropProps,
        },
        [
          h('span', { class: CLASS.handle, 'aria-label': labels.drag, ...handleProps }, '⠿'),
          h('select', { class: CLASS.field, value: rule.field, onChange: (e: Event) => r.setField((e.target as HTMLSelectElement).value) }, options(fields)),
          h('select', { class: CLASS.operator, value: rule.operator, onChange: (e: Event) => r.setOperator((e.target as HTMLSelectElement).value as never) }, options(r.operators.value)),
          rule.ref !== undefined
            ? h('select', { class: CLASS.value, value: rule.ref, onChange: (e: Event) => r.setRef((e.target as HTMLSelectElement).value) }, options(refs.value))
            : h(components.ValueEditor, { editor: r.editor.value, def: r.def.value, value: rule.value, onChange: r.setValue, invalid, labels }),
          refs.value.length > 0
            ? h(
                'button',
                {
                  type: 'button',
                  class: CLASS.action,
                  title: rule.ref === undefined ? labels.compareField : labels.compareValue,
                  onClick: () => r.setRef(rule.ref === undefined ? refs.value[0]!.value : null),
                },
                rule.ref === undefined ? 'ƒ' : '✎',
              )
            : null,
          h('button', { type: 'button', class: CLASS.action, title: labels.clone, 'aria-label': labels.clone, onClick: r.clone }, '⧉'),
          h('button', { type: 'button', class: CLASS.action, title: labels.remove, 'aria-label': labels.remove, onClick: r.remove }, '×'),
        ],
      );
    };
  },
});

const NodeView = defineComponent({
  name: 'TrawlnetNode',
  props: idProp,
  setup(props) {
    const { components } = useUI();
    const node = useNode(props.id);
    const kind = computed(() => node.value.kind);
    return () => h(kind.value === 'group' ? components.Group : components.Rule, { id: props.id });
  },
});

export const DefaultGroup = defineComponent({
  name: 'TrawlnetGroup',
  props: idProp,
  setup(props) {
    const { labels } = useUI();
    const g = useGroup(props.id);
    const { isDragging, handleProps } = useDragHandle(props.id);
    const { position, dropProps } = useDropTarget(props.id);
    const { isOver, zoneProps } = useGroupDropZone(props.id);
    return () => {
      const group = g.group.value;
      const isRoot = g.isRoot.value;
      const btn = (label: string, onClick: () => void, title?: string) =>
        h('button', { type: 'button', class: CLASS.action, title, 'aria-label': title, onClick }, label);
      return h(
        'div',
        {
          class: cx(CLASS.group, isDragging.value && CLASS.dragging, position.value === 'before' && CLASS.dropBefore, position.value === 'after' && CLASS.dropAfter),
          ...(isRoot ? {} : dropProps),
        },
        [
          h('div', { class: CLASS.groupHeader }, [
            isRoot ? null : h('span', { class: CLASS.handle, 'aria-label': labels.drag, ...handleProps }, '⠿'),
            h('label', { class: CLASS.not }, [
              h('input', { type: 'checkbox', checked: group.not, onChange: (e: Event) => g.setNot((e.target as HTMLInputElement).checked) }),
              labels.not,
            ]),
            h('select', { class: CLASS.combinator, value: group.combinator, onChange: (e: Event) => g.setCombinator((e.target as HTMLSelectElement).value as 'and' | 'or') }, [
              h('option', { value: 'and' }, labels.and),
              h('option', { value: 'or' }, labels.or),
            ]),
            btn(labels.addRule, () => void g.addRule()),
            btn(labels.addGroup, () => void g.addGroup()),
            isRoot ? null : h(Fragment, [btn('⧉', g.clone, labels.clone), btn('×', g.remove, labels.remove)]),
          ]),
          h(
            'div',
            { class: cx(CLASS.children, isOver.value && CLASS.dropInside), ...zoneProps },
            group.children.map((c) => h(NodeView, { key: c, id: c })),
          ),
        ],
      );
    };
  },
});

function provideUI(store: QueryStore<any, any>, props: { components?: Partial<Components>; labels?: Partial<Labels> }): UI {
  const ui: UI = {
    labels: { ...DEFAULT_LABELS, ...props.labels },
    components: { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...props.components },
    fieldOptions: fieldOptions(store.fields),
  };
  provide(UI_KEY, ui);
  return ui;
}

/**
 * Ready-made builder. Pass a `store`, or `fields` (+ `initial`/`v-model`, `format`) and it
 * creates one. Emits `update:modelValue` and `change` with the query in `format`'s shape.
 */
export const QueryBuilder = defineComponent({
  name: 'TrawlnetQueryBuilder',
  props: {
    store: { type: Object as PropType<QueryStore<any, any>>, default: undefined },
    fields: { type: Object as PropType<Fields>, default: undefined },
    initial: { type: null as unknown as PropType<unknown> },
    modelValue: { type: null as unknown as PropType<unknown> },
    format: { type: Object as PropType<Format<any>>, default: undefined },
    components: { type: Object as PropType<Partial<Components>>, default: undefined },
    labels: { type: Object as PropType<Partial<Labels>>, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const onChange = (v: unknown) => {
      emit('update:modelValue', v);
      emit('change', v);
    };
    let store = props.store;
    if (store) {
      const s = store;
      const unsub = s.subscribe(() => onChange(s.getValue()));
      watch(
        () => props.modelValue,
        (v) => {
          if (v !== undefined) s.setValue(v);
        },
        { flush: 'sync', immediate: true },
      );
      onScopeDispose(unsub);
    } else {
      if (!props.fields) throw new Error('trawlnet: <QueryBuilder> needs a `store` or `fields`');
      store = useQueryStore<Fields, unknown>({
        fields: props.fields,
        initial: props.initial,
        format: props.format as Format<unknown> | undefined,
        value: () => props.modelValue,
        onChange,
      } as never);
    }
    provideQueryStore(store);
    const ui = provideUI(store, props);
    const rootId: NodeId = store.rootId;
    return () => h('div', { class: CLASS.root }, [h(ui.components.Group, { id: rootId })]);
  },
});
