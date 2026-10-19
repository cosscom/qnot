// Lazy selects: a select renders only its chosen option until the user reaches for it (hover,
// focus, press), then the full list for good. Option elements are most of a rule's DOM, so large
// queries mount with a fraction of the nodes. The full list goes into the DOM inside the event,
// before the browser opens the native list or handles arrow keys.
//
// Collapsed, the select holds one static option (the chosen one, else the placeholder) that has
// never been touched, so its `selected` attribute is the selection. (No title either: option titles
// only show in the open list.) Expanding renders the full list imperatively; from then on the
// template's read of `label` re-syncs it (list and selection) whenever the value or options change.
// So an untouched select costs no effect, block or observer of its own, and hot templates (the rule
// row) inline their selects in their own cloned template:
//
//   <select onfocus={l.expand} onpointerdown={l.expand} onmouseenter={l.expand}>
//     <option value={l.value} disabled={l.disabled} selected>{l.label}</option>
//   </select>
//
// where `l` is a `Lazy` subclass saying what to show (see LazySelect.svelte for the component).
import { indent } from './ui';

export interface LazyOption {
  readonly value: unknown;
  readonly label: string;
  readonly depth?: number;
  readonly disabled?: boolean;
  readonly group?: string;
  readonly description?: string;
}

const lookups = new WeakMap<readonly LazyOption[], Map<string, LazyOption>>();
/** The option whose value is `value` (lists are shared by every rule with the same schema, so is the index). */
function findOption(options: readonly LazyOption[], value: string): LazyOption | undefined {
  let index = lookups.get(options);
  if (!index) {
    index = new Map();
    for (const o of options) if (!index.has(String(o.value))) index.set(String(o.value), o);
    lookups.set(options, index);
  }
  return index.get(value);
}

function optionEl(o: LazyOption): HTMLOptionElement {
  const el = document.createElement('option');
  el.value = String(o.value);
  el.textContent = indent(o.depth) + o.label;
  if (o.disabled) el.disabled = true;
  if (o.description) el.title = o.description;
  return el;
}

/** The full list: an optional placeholder, then the options, under `<optgroup>`s when grouped. */
function fill(select: HTMLSelectElement, options: readonly LazyOption[], grouped: boolean, empty: string | undefined) {
  const out = document.createDocumentFragment();
  if (empty !== undefined) out.append(optionEl({ value: '', label: empty }));
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const o of options) {
    if (!grouped || o.group === undefined) {
      out.append(optionEl(o));
      continue;
    }
    let g = groups.get(o.group);
    if (!g) {
      groups.set(o.group, (g = document.createElement('optgroup')));
      g.label = o.group;
      out.append(g);
    }
    g.append(optionEl(o));
  }
  select.replaceChildren(out);
}

/**
 * One lazy select's state. Subclasses say what it shows by overriding `options`, `current` (the
 * selected value) and optionally `empty` / `grouped`; all are read reactively.
 */
export class Lazy {
  /** The select, once expanded. */
  #el: HTMLSelectElement | null = null;
  /** The option list rendered into it. */
  #shown: readonly LazyOption[] | null = null;
  get options(): readonly LazyOption[] {
    return [];
  }
  get current(): string {
    return '';
  }
  /** Placeholder option with value '' (always rendered). */
  get empty(): string | undefined {
    return undefined;
  }
  /** Group options under `<optgroup>`s by their `group`. */
  get grouped(): boolean {
    return false;
  }
  #expand: ((e: Event) => void) | undefined;
  /** The handler for focus / hover / press (made on first use). */
  get expand() {
    return (this.#expand ??= (e: Event) => this.open(e.currentTarget as HTMLSelectElement));
  }
  /** Render the full list into `el` (once). */
  open(el: HTMLSelectElement) {
    if (this.#el) return;
    this.#el = el;
    this.#sync();
  }
  #sync() {
    const el = this.#el!;
    const options = this.options;
    if (options !== this.#shown) {
      fill(el, options, this.grouped, this.empty);
      this.#shown = options;
    }
    el.value = this.current;
  }
  get option() {
    return findOption(this.options, this.current);
  }
  // The collapsed select's one option: the chosen one, else the placeholder (else blank).
  get value() {
    const o = this.option;
    return o ? String(o.value) : '';
  }
  get label() {
    if (this.#el) this.#sync();
    const o = this.option;
    return o ? indent(o.depth) + o.label : (this.empty ?? '');
  }
  get disabled() {
    return this.option?.disabled;
  }
}
