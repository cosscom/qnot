import {
  CLASS,
  countOptions,
  DEFAULT_LABELS,
  defaultCall,
  editorFor,
  fieldLabel,
  formatInput,
  formatList,
  functionOf,
  functionOptions,
  isFnCall,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type EditorSpec,
  type FieldOption,
  type Fields,
  type FnCall,
  type Format,
  type NodeId,
  type Operand,
  type Option,
  type Quantifier,
  type QueryStore,
  type StoreSettings,
} from '@qnot/core';
import { computed, defineComponent, Fragment, h, inject, onScopeDispose, provide, ref, toRaw, watch, type Component, type InjectionKey, type PropType, type VNode } from 'vue';
import {
  provideQueryStore,
  useDragHandle,
  useDropTarget,
  useGroup,
  useGroupDropZone,
  useNode,
  useQueryStore,
  useRule,
  useSettings,
  useStore,
} from './composables';
import { LazySelect, type OptionLike } from './lazy';

export { DEFAULT_LABELS, defaultCall };
export type Labels = typeof DEFAULT_LABELS;

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  disabled?: boolean;
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
  showNot: boolean;
  showLock: boolean;
}

const UI_KEY: InjectionKey<UI> = Symbol('qnot-ui');
const useUI = () => inject(UI_KEY)!;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const target = <T = HTMLInputElement>(e: Event) => e.target as T;

const anyProp = { type: null as unknown as PropType<unknown> };

/** An input that keeps in-progress text ("1.", "3, ") while committing parsed values. */
const DraftInput = defineComponent({
  props: {
    type: { type: String, required: true },
    value: anyProp,
    parse: { type: Function as PropType<(raw: string) => unknown>, required: true },
    format: { type: Function as PropType<(v: unknown) => string>, required: true },
    onChange: { type: Function as PropType<(v: unknown) => void>, required: true },
    invalid: Boolean,
    disabled: Boolean,
    min: Number,
    max: Number,
    step: Number,
    placeholder: String,
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
        min: props.min,
        max: props.max,
        step: props.step,
        placeholder: props.placeholder,
        disabled: props.disabled,
        'aria-invalid': props.invalid || undefined,
        onInput: (e: Event) => {
          draft.value = target(e).value;
          props.onChange(props.parse(draft.value));
        },
      });
  },
});

/** Text input backed by the field's async `search`, suggesting options as the user types. */
const AsyncInput = defineComponent({
  props: {
    def: { type: Object as PropType<AnyFieldDef>, default: undefined },
    value: anyProp,
    onChange: { type: Function as PropType<(v: unknown) => void>, required: true },
    invalid: Boolean,
    disabled: Boolean,
    multiple: Boolean,
  },
  setup(props) {
    const format = props.multiple ? formatList : formatInput;
    const query = ref(format(props.value));
    const found = ref<readonly OptionLike[]>([]);
    // Follow external value changes (undo, controlled updates) without clobbering the text the
    // user is typing: only reset when the new value isn't what this input last emitted.
    let emitted: unknown = props.value;
    watch(
      () => props.value,
      (v) => {
        if (format(v) !== format(emitted)) {
          query.value = format(v);
          emitted = v;
        }
      },
    );
    const listId = `qn-async-${Math.random().toString(36).slice(2)}`;
    let ctrl: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    watch(
      query,
      (q) => {
        const def = props.def;
        if (!def?.search) return;
        clearTimeout(timer);
        ctrl?.abort();
        const c = (ctrl = new AbortController());
        const term = props.multiple ? (q.split(',').pop() ?? '').trim() : q;
        timer = setTimeout(() => void def.search!(term, c.signal).then((o) => (found.value = o), () => {}), 150);
      },
      { immediate: true },
    );
    onScopeDispose(() => {
      clearTimeout(timer);
      ctrl?.abort();
    });
    return () => [
      h('input', {
        class: CLASS.value,
        list: listId,
        value: query.value,
        disabled: props.disabled,
        'aria-invalid': props.invalid || undefined,
        onInput: (e: Event) => {
          const raw = target(e).value;
          query.value = raw;
          emitted = props.multiple
            ? parseList({ ...props.def!, options: found.value as never }, raw)
            : (found.value.find((o) => String(o.value) === raw)?.value ?? (props.def?.allowCustom ? raw : null));
          props.onChange(emitted);
        },
      }),
      h('datalist', { id: listId }, found.value.map((o) => h('option', { key: String(o.value), value: String(o.value) }, o.label))),
    ];
  },
});

function scalar(p: ValueEditorProps): VNode {
  const { editor, def } = p;
  if (editor.async) return h(AsyncInput, { def, value: p.value, onChange: p.onChange, invalid: p.invalid, disabled: p.disabled });
  const attrs = { 'aria-invalid': p.invalid || undefined, disabled: p.disabled };
  const parse = (raw: string) => parseInput(def, raw);
  switch (editor.type) {
    case 'boolean':
      return h(
        'select',
        { class: CLASS.value, value: formatInput(p.value), ...attrs, onChange: (e: Event) => { const v = target<HTMLSelectElement>(e).value; p.onChange(v === '' ? null : v === 'true'); } },
        [h('option', { value: '' }, p.labels.empty), h('option', { value: 'true' }, p.labels.yes), h('option', { value: 'false' }, p.labels.no)],
      );
    case 'select':
      return h(LazySelect, { class: CLASS.value, ...attrs, options: editor.options ?? NO_OPTIONS, value: formatInput(p.value), empty: p.labels.empty, onChange: (v: string) => p.onChange(parse(v)) });
    case 'number':
      return h(DraftInput, { type: 'number', value: p.value, min: def?.min, max: def?.max, step: def?.step, placeholder: def?.placeholder, parse, format: formatInput, onChange: p.onChange, invalid: p.invalid, disabled: p.disabled });
    case 'slider':
      return h('span', { class: 'qn-slider' }, [
        h('input', {
          class: CLASS.value,
          type: 'range',
          min: def?.min ?? 0,
          max: def?.max ?? 100,
          step: def?.step ?? 1,
          value: typeof p.value === 'number' ? p.value : (def?.min ?? 0),
          ...attrs,
          onInput: (e: Event) => p.onChange(Number(target(e).value)),
        }),
        h('output', formatInput(p.value)),
      ]);
    case 'date':
    case 'time':
      return h(DraftInput, { type: editor.type, value: p.value, parse, format: formatInput, onChange: p.onChange, invalid: p.invalid, disabled: p.disabled });
    case 'datetime':
      return h(DraftInput, { type: 'datetime-local', value: p.value, parse, format: (v: unknown) => formatInput(v).slice(0, 16), onChange: p.onChange, invalid: p.invalid, disabled: p.disabled });
    case 'textarea':
      return h('textarea', { class: CLASS.value, rows: 2, value: formatInput(p.value), placeholder: def?.placeholder, ...attrs, onInput: (e: Event) => p.onChange(target<HTMLTextAreaElement>(e).value) });
    default:
      return h('input', { class: CLASS.value, type: 'text', value: formatInput(p.value), placeholder: def?.placeholder, ...attrs, onInput: (e: Event) => p.onChange(target(e).value) });
  }
}

export const DefaultValueEditor = defineComponent({
  name: 'QnotValueEditor',
  props: {
    editor: { type: Object as PropType<EditorSpec>, required: true },
    def: { type: Object as PropType<AnyFieldDef>, default: undefined },
    value: anyProp,
    onChange: { type: Function as PropType<(v: unknown) => void>, required: true },
    invalid: Boolean,
    disabled: Boolean,
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
          return h('span', { class: 'qn-value-pair' }, [
            scalar({ ...p, value: pair[0], onChange: (v) => p.onChange([v, pair[1]]) }),
            h('span', p.labels.rangeSeparator),
            scalar({ ...p, value: pair[1], onChange: (v) => p.onChange([pair[0], v]) }),
          ]);
        }
        case 'many': {
          if (p.editor.async) return h(AsyncInput, { def: p.def, value: p.value, onChange: p.onChange, invalid: p.invalid, disabled: p.disabled, multiple: true });
          if (p.editor.type === 'multiselect') {
            const chosen = new Set(Array.isArray(p.value) ? p.value.map(String) : []);
            return h(
              'select',
              {
                class: CLASS.value,
                multiple: true,
                disabled: p.disabled,
                'aria-invalid': p.invalid || undefined,
                onChange: (e: Event) => p.onChange([...target<HTMLSelectElement>(e).selectedOptions].map((o) => parseInput(p.def, o.value))),
              },
              (p.editor.options ?? []).map((o) =>
                h('option', { key: String(o.value), value: String(o.value), disabled: o.disabled, selected: chosen.has(String(o.value)) }, '  '.repeat(o.depth) + o.label),
              ),
            );
          }
          return h(DraftInput, { type: 'text', value: p.value, parse: (raw: string) => parseList(p.def, raw), format: formatList, onChange: p.onChange, invalid: p.invalid, disabled: p.disabled });
        }
        default:
          return scalar(p);
      }
    };
  },
});

const NO_OPTIONS: readonly OptionLike[] = [];

const select = (cls: string, value: string, opts: readonly OptionLike[], onChange: (v: string) => void, disabled?: boolean) =>
  h(LazySelect, { class: cls, value, options: opts, disabled, onChange });

/** Field picker with struct fields grouped under their struct label. */
const fieldSelect = (value: string, opts: readonly FieldOption[], onChange: (v: string) => void, disabled?: boolean) =>
  h(LazySelect, { class: CLASS.field, value, options: opts, grouped: true, disabled, onChange });

const countsByLabels = new WeakMap<Labels, ReturnType<typeof countOptions>>();
const counts = (labels: Labels) => {
  let c = countsByLabels.get(labels);
  if (!c) countsByLabels.set(labels, (c = countOptions(labels)));
  return c;
};

/** Editor for a function call: pick the function, then each argument (literal, field, or nested call). */
export const FunctionEditor: Component = defineComponent({
  name: 'QnotFunctionEditor',
  props: {
    call: { type: Object as PropType<FnCall>, required: true },
    fields: { type: Object as PropType<Fields>, required: true },
    kind: String,
    onChange: { type: Function as PropType<(c: FnCall) => void>, required: true },
    disabled: Boolean,
    labels: { type: Object as PropType<Labels>, required: true },
  },
  setup(props) {
    const fns = computed(() => functionOptions(props.fields, props.kind));
    return (): VNode => {
      const { call, fields } = props;
      const def = functionOf(fields, call);
      const args = Object.entries(def?.args ?? {});
      return h('span', { class: 'qn-function' }, [
        select('qn-function-name', call.fn, fns.value, (fn) => props.onChange(defaultCall(fields, fn)), props.disabled),
        args.length
          ? h('span', { class: 'qn-function-args' }, [
              '(',
              ...args.map(([name, argDef], i) =>
                h('span', { key: name, class: 'qn-function-arg' }, [
                  i > 0 ? ', ' : null,
                  h(OperandEditor, {
                    operand: call.args[name] ?? { value: null },
                    def: argDef,
                    fields,
                    label: fieldLabel(name, argDef),
                    disabled: props.disabled,
                    labels: props.labels,
                    onChange: (operand: Operand) => props.onChange({ ...call, args: { ...call.args, [name]: operand } }),
                  }),
                ]),
              ),
              ')',
            ])
          : null,
      ]);
    };
  },
});

const OperandEditor: Component = defineComponent({
  props: {
    operand: { type: Object as PropType<Operand>, required: true },
    def: { type: Object as PropType<AnyFieldDef>, required: true },
    fields: { type: Object as PropType<Fields>, required: true },
    label: { type: String, required: true },
    onChange: { type: Function as PropType<(o: Operand) => void>, required: true },
    disabled: Boolean,
    labels: { type: Object as PropType<Labels>, required: true },
  },
  setup(props) {
    const refs = computed(() => refOptions(props.fields, '', props.def.kind));
    const nested = computed(() => functionOptions(props.fields, props.def.kind));
    const sources = computed(() => [
      { value: 'value', label: props.label },
      ...(refs.value.length ? [{ value: 'field', label: `${props.label}: field` }] : []),
      ...(nested.value.length ? [{ value: 'function', label: `${props.label}: ƒ` }] : []),
    ]);
    return (): VNode => {
      const { operand, def, fields } = props;
      const label = props.label;
      const source = isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value';
      const sourceSelect =
        refs.value.length || nested.value.length
          ? select('qn-source', source, sources.value, (v) =>
              props.onChange(v === 'field' ? { ref: refs.value[0]!.value } : v === 'function' ? defaultCall(fields, nested.value[0]!.value) : { value: def.defaultValue ?? null }),
            props.disabled)
          : null;
      const body: VNode = isFnCall(operand)
        ? h(FunctionEditor, { call: operand, fields, kind: def.kind, onChange: props.onChange, disabled: props.disabled, labels: props.labels })
        : 'ref' in operand
          ? select(CLASS.value, operand.ref, refs.value, (ref) => props.onChange({ ref }), props.disabled)
          : scalar({ editor: editorFor(def, 'eq', fields), def, value: operand.value, invalid: false, disabled: props.disabled, labels: props.labels, onChange: (value) => props.onChange({ value }) });
      return h('span', { class: 'qn-operand', title: label }, [sourceSelect, body]);
    };
  },
});

const idProp = { id: { type: String, required: true } } as const;

const btn = (label: string, onClick: () => void, opts: { title?: string; disabled?: boolean; pressed?: boolean; class?: string } = {}) =>
  h(
    'button',
    {
      type: 'button',
      class: opts.class ?? CLASS.action,
      title: opts.title,
      'aria-label': opts.title,
      'aria-pressed': opts.pressed === undefined ? undefined : String(opts.pressed),
      disabled: opts.disabled,
      onClick,
    },
    label,
  );

export const DefaultRule = defineComponent({
  name: 'QnotRule',
  props: idProp,
  setup(props) {
    const store = useStore();
    const { labels, components, showLock } = useUI();
    const r = useRule(props.id);
    const { isDragging, handleProps } = useDragHandle(props.id);
    const { position, dropProps } = useDropTarget(props.id);
    const settings = useSettings();
    const lhsFunctions = computed(() => (settings.value.allowFunctions !== false ? functionOptions(r.fields.value) : []));
    const sources = computed(() => [
      { value: 'value', label: labels.compareValue },
      ...(r.refOptions.value.length ? [{ value: 'field', label: labels.compareField }] : []),
      ...(r.functionOptions.value.length ? [{ value: 'function', label: labels.compareFunction }] : []),
    ]);
    return () => {
      const rule = r.rule.value;
      const fields = r.fields.value;
      const can = r.can.value;
      const issues = r.issues.value;
      const invalid = issues.some((i) => i.severity === 'error');
      const fieldIsFn = isFnCall(rule.field);
      const refs = r.refOptions.value;
      const fns = r.functionOptions.value;
      return h(
        'div',
        {
          class: cx(CLASS.rule, invalid && CLASS.invalid, r.locked.value && CLASS.locked, isDragging.value && CLASS.dragging, position.value === 'before' && CLASS.dropBefore, position.value === 'after' && CLASS.dropAfter),
          title: invalid ? issues.map((i) => i.message).join('\n') : undefined,
          ...dropProps,
        },
        [
          h('span', { class: CLASS.handle, 'aria-label': labels.drag, ...handleProps }, '⠿'),
          lhsFunctions.value.length
            ? btn('ƒ', () => r.setField(fieldIsFn ? r.fieldOptions.value[0]!.value : defaultCall(fields, lhsFunctions.value[0]!.value)), {
                class: cx(CLASS.action, 'qn-lhs-toggle'),
                title: fieldIsFn ? labels.useField : labels.useFunction,
                disabled: !can.editField,
                pressed: fieldIsFn,
              })
            : null,
          fieldIsFn
            ? h(FunctionEditor, { call: rule.field as FnCall, fields, onChange: r.setField, disabled: !can.editField, labels })
            : fieldSelect(rule.field as string, r.fieldOptions.value, r.setField, !can.editField),
          select(CLASS.operator, rule.operator, r.operators.value, r.setOperator, !can.editOperator),
          refs.length || fns.length
            ? h(LazySelect, {
                class: 'qn-source',
                value: r.source.value,
                options: sources.value,
                disabled: !can.editValue,
                'aria-label': labels.compareWith,
                onChange: (v: string) => (v === 'field' ? r.setRef(refs[0]!.value) : v === 'function' ? r.setCall(defaultCall(fields, fns[0]!.value)) : r.setRef(null)),
              })
            : null,
          rule.ref !== undefined
            ? select(CLASS.value, rule.ref, refs, r.setRef, !can.editValue)
            : rule.call !== undefined
              ? h(FunctionEditor, { call: rule.call, fields, kind: r.def.value?.kind, onChange: r.setCall, disabled: !can.editValue, labels })
              : h(components.ValueEditor, { editor: r.editor.value, def: r.def.value, value: rule.value, onChange: r.setValue, invalid, disabled: !can.editValue, labels }),
          showLock
            ? btn(rule.locked ? '🔒' : '🔓', () => r.setLocked(!rule.locked), { disabled: !can.lock, pressed: !!rule.locked, title: rule.locked ? labels.unlock : labels.lock })
            : null,
          btn('⧉', r.clone, { title: labels.clone, disabled: !can.clone }),
          btn('×', r.remove, { title: labels.remove, disabled: !can.remove }),
        ],
      );
    };
  },
});

const NodeView = defineComponent({
  name: 'QnotNode',
  props: idProp,
  setup(props) {
    const { components } = useUI();
    const node = useNode(props.id);
    const kind = computed(() => node.value.kind);
    return () => h(kind.value === 'group' ? components.Group : components.Rule, { id: props.id });
  },
});

/** "some / all / none / at least N of Orders where …" for array groups. */
function matchEditor(match: Quantifier, label: string, onChange: (m: Quantifier) => void, disabled: boolean, labels: Labels) {
  const mode = typeof match === 'string' ? match : 'count';
  return h('span', { class: 'qn-match' }, [
    h(
      'select',
      {
        class: 'qn-match-mode',
        value: mode,
        disabled,
        onChange: (e: Event) => {
          const v = target<HTMLSelectElement>(e).value;
          onChange(v === 'count' ? { count: 'gte', value: 1 } : (v as 'some' | 'all' | 'none'));
        },
      },
      [h('option', { value: 'some' }, labels.some), h('option', { value: 'all' }, labels.all), h('option', { value: 'none' }, labels.none), h('option', { value: 'count' }, labels.count)],
    ),
    ...(typeof match === 'object' && match.count !== 'between'
      ? [
          select('qn-match-op', match.count, counts(labels), (count) => onChange({ count: count as 'gte', value: match.value }), disabled),
          h('input', { class: 'qn-match-count', type: 'number', min: 0, value: match.value, disabled, onInput: (e: Event) => onChange({ count: match.count, value: Number(target(e).value) }) }),
        ]
      : []),
    h('span', [`${labels.matchOf} `, h('strong', label), ` ${labels.matchWhere}`]),
  ]);
}

export const DefaultGroup = defineComponent({
  name: 'QnotGroup',
  props: idProp,
  setup(props) {
    const store = useStore();
    const { labels, showNot, showLock } = useUI();
    const g = useGroup(props.id);
    const { isDragging, handleProps } = useDragHandle(props.id);
    const { position, dropProps } = useDropTarget(props.id);
    const { isOver, zoneProps } = useGroupDropZone(props.id);
    return () => {
      const group = g.group.value;
      const isRoot = g.isRoot.value;
      const can = g.can.value;
      const arrayFields = g.arrayFields.value;
      const arrayLabel = group.of ? fieldLabel(group.of.field, (isRoot ? store.fields : store.fieldsFor(props.id))[group.of.field]) : '';
      return h(
        'div',
        {
          class: cx(CLASS.group, group.of && CLASS.arrayGroup, g.locked.value && CLASS.locked, isDragging.value && CLASS.dragging, position.value === 'before' && CLASS.dropBefore, position.value === 'after' && CLASS.dropAfter),
          ...(isRoot ? {} : dropProps),
        },
        [
          h('div', { class: CLASS.groupHeader }, [
            isRoot ? null : h('span', { class: CLASS.handle, 'aria-label': labels.drag, ...handleProps }, '⠿'),
            group.of ? matchEditor(group.of.match, arrayLabel, g.setMatch, !can.editGroup, labels) : null,
            showNot
              ? h('label', { class: CLASS.not }, [
                  h('input', { type: 'checkbox', checked: group.not, disabled: !can.editGroup, onChange: (e: Event) => g.setNot(target(e).checked) }),
                  labels.not,
                ])
              : null,
            h(
              'select',
              { class: CLASS.combinator, value: group.combinator, disabled: !can.editGroup, onChange: (e: Event) => g.setCombinator(target<HTMLSelectElement>(e).value as 'and' | 'or') },
              [h('option', { value: 'and' }, labels.and), h('option', { value: 'or' }, labels.or)],
            ),
            btn(labels.addRule, () => void g.addRule(), { disabled: !can.addRule }),
            btn(labels.addGroup, () => void g.addGroup(), { disabled: !can.addGroup }),
            arrayFields.length
              ? h(
                  'select',
                  {
                    class: 'qn-add-array',
                    value: '',
                    disabled: !can.addGroup,
                    onChange: (e: Event) => {
                      const el = target<HTMLSelectElement>(e);
                      if (el.value) g.addArrayGroup(el.value);
                      el.value = '';
                    },
                  },
                  [h('option', { value: '' }, labels.addArrayGroup), ...arrayFields.map((o) => h('option', { key: o.value, value: o.value }, o.label))],
                )
              : null,
            showLock
              ? btn(group.locked ? '🔒' : '🔓', () => g.setLocked(!group.locked), { disabled: !can.lock, pressed: !!group.locked, title: group.locked ? labels.unlock : labels.lock })
              : null,
            isRoot ? null : h(Fragment, [btn('⧉', g.clone, { title: labels.clone, disabled: !can.clone }), btn('×', g.remove, { title: labels.remove, disabled: !can.remove })]),
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

/**
 * Ready-made builder. Pass a `store`, or `fields` (+ `initial`/`v-model`, `format`, `settings`) and
 * it creates one. Emits `update:modelValue` and `change` with the query in `format`'s shape.
 */
export const QueryBuilder = defineComponent({
  name: 'QnotQueryBuilder',
  props: {
    store: { type: Object as PropType<QueryStore<any, any>>, default: undefined },
    fields: { type: Object as PropType<Fields>, default: undefined },
    initial: anyProp,
    modelValue: anyProp,
    format: { type: Object as PropType<Format<any>>, default: undefined },
    settings: { type: Object as PropType<StoreSettings>, default: undefined },
    components: { type: Object as PropType<Partial<Components>>, default: undefined },
    labels: { type: Object as PropType<Partial<Labels>>, default: undefined },
    /** Show the NOT toggle on groups (default true). */
    showNot: { type: Boolean, default: true },
    /** Show lock toggles on rules and groups (default false). */
    showLock: { type: Boolean, default: false },
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
      onScopeDispose(s.subscribe(() => onChange(s.getValue())));
      watch(
        () => props.modelValue,
        (v) => {
          if (v !== undefined) s.setValue(toRaw(v));
        },
        { flush: 'sync', immediate: true },
      );
    } else {
      if (!props.fields) throw new Error('qnot: <QueryBuilder> needs a `store` or `fields`');
      // Props may arrive as reactive proxies; the store needs the plain schema and values.
      store = useQueryStore<Fields, unknown>({
        fields: toRaw(props.fields),
        initial: toRaw(props.initial),
        format: toRaw(props.format) as Format<unknown> | undefined,
        value: () => toRaw(props.modelValue),
        onChange,
        ...(props.settings && { settings: toRaw(props.settings) }),
      } as never);
    }
    provideQueryStore(store);
    const ui: UI = {
      labels: { ...DEFAULT_LABELS, ...props.labels },
      components: { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...props.components },
      showNot: props.showNot,
      showLock: props.showLock,
    };
    provide(UI_KEY, ui);
    const rootId: NodeId = store.rootId;
    return () => h('div', { class: CLASS.root }, [h(ui.components.Group, { id: rootId })]);
  },
});
