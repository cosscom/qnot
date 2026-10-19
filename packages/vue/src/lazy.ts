// Selects render only their chosen option until the user reaches for them (hover, focus, press),
// then the full list for good. Option elements are most of a rule's DOM, so large queries mount
// with a fraction of the nodes. The options are owned by this helper rather than by vnodes so the
// expansion lands in the DOM inside the event, before the browser opens the native list or handles
// arrow keys (a Vue re-render would only be scheduled).
import type { FieldOption } from '@qnot/core';
import { defineComponent, h, onMounted, ref, watch, type PropType } from 'vue';

export interface OptionLike {
  readonly value: unknown;
  readonly label: string;
  readonly depth?: number;
  readonly disabled?: boolean;
  readonly group?: string;
  readonly description?: string;
}

const option = (o: OptionLike) => {
  const el = document.createElement('option');
  el.value = String(o.value);
  el.textContent = '  '.repeat(o.depth ?? 0) + o.label;
  el.disabled = !!o.disabled;
  if (o.description) el.title = o.description;
  return el;
};

function fill(sel: HTMLSelectElement, options: readonly OptionLike[], empty: string | undefined, grouped: boolean) {
  const els: HTMLElement[] = [];
  if (empty !== undefined) els.push(option({ value: '', label: empty }));
  if (!grouped) els.push(...options.map(option));
  else {
    const groups = new Map<string | undefined, FieldOption[]>();
    for (const o of options as readonly FieldOption[]) groups.set(o.group, [...(groups.get(o.group) ?? []), o]);
    for (const [group, opts] of groups) {
      if (group === undefined) els.push(...opts.map(option));
      else {
        const g = document.createElement('optgroup');
        g.label = group;
        g.append(...opts.map(option));
        els.push(g);
      }
    }
  }
  sel.replaceChildren(...els);
}

/** A `<select>` whose options are rendered lazily; other attributes (class, disabled, aria-*) fall through. */
export const LazySelect = defineComponent({
  name: 'QnotLazySelect',
  props: {
    options: { type: Array as PropType<readonly OptionLike[]>, required: true },
    value: { type: String, default: '' },
    /** Placeholder option with value '' (always rendered). */
    empty: { type: String, default: undefined },
    /** Group options under `<optgroup>`s by their `group`. */
    grouped: Boolean,
    onChange: { type: Function as PropType<(value: string) => void>, required: true },
  },
  setup(props) {
    const el = ref<HTMLSelectElement>();
    let expanded = false;
    let rendered: unknown = null;
    const sync = (optionsChanged: boolean) => {
      const sel = el.value;
      if (!sel) return;
      if (expanded) {
        if (optionsChanged || rendered !== props.options) fill(sel, props.options, props.empty, props.grouped);
        rendered = props.options;
      } else if (optionsChanged || rendered !== props.value) {
        const chosen = props.options.find((o) => String(o.value) === props.value);
        fill(sel, chosen ? [chosen] : [], props.empty, false);
        rendered = props.value;
      }
      sel.value = props.value;
    };
    const expand = () => {
      if (expanded) return;
      expanded = true;
      sync(true);
    };
    onMounted(() => sync(true));
    watch(
      () => props.options,
      () => sync(true),
      { flush: 'post' },
    );
    watch(
      () => props.value,
      () => sync(false),
      { flush: 'post' },
    );
    return () =>
      h('select', {
        ref: el,
        onFocus: expand,
        onPointerdown: expand,
        onMouseenter: expand,
        onChange: (e: Event) => props.onChange((e.target as HTMLSelectElement).value),
      });
  },
});
