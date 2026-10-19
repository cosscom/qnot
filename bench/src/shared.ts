// Canonical dataset every adapter translates into its own format, so all libraries render the same tree.

export type FieldType = 'text' | 'number' | 'select' | 'boolean';
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export const FIELDS: FieldDef[] = [
  { name: 'firstName', label: 'First name', type: 'text' },
  { name: 'age', label: 'Age', type: 'number' },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'pending', 'closed', 'banned', 'trial'] },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'score', label: 'Score', type: 'number' },
  { name: 'tier', label: 'Tier', type: 'select', options: ['free', 'pro', 'team', 'enterprise'] },
  { name: 'verified', label: 'Verified', type: 'boolean' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'visits', label: 'Visits', type: 'number' },
  { name: 'country', label: 'Country', type: 'select', options: ['US', 'UK', 'DE', 'FR', 'JP'] },
];

export interface CRule {
  field: string;
  type: FieldType;
  value: string | number | boolean;
}
export interface CGroup {
  combinator: 'and' | 'or';
  rules: (CRule | CGroup)[];
}
export const isGroup = (n: CRule | CGroup): n is CGroup => 'rules' in n;

// Root AND group holding ceil(n/10) OR sub-groups of up to 10 rules each (depth 2).
export function makeTree(n: number): CGroup {
  const groups: CGroup[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) groups.push({ combinator: 'or', rules: [] });
    const f = FIELDS[i % FIELDS.length];
    const value =
      f.type === 'text' ? `v${i}` : f.type === 'number' ? i : f.type === 'select' ? f.options![i % f.options!.length] : i % 2 === 0;
    groups[groups.length - 1].rules.push({ field: f.name, type: f.type, value });
  }
  return { combinator: 'and', rules: groups };
}

export interface Adapter {
  name: string;
  /** Untimed: build the library's own serialized format for an n-rule tree (what an app would have stored). */
  prepare(n: number): void;
  /** Timed: load the prepared data and render it. */
  mount(el: HTMLElement): void | Promise<void>;
  unmount(el: HTMLElement): void;
  /** Number of rendered rule rows, used to verify the render finished. */
  ruleCount(el: HTMLElement): number;
  /** Inline text inputs bound to text-field rule values (null = no inline editing). */
  textInputs(el: HTMLElement): HTMLInputElement[] | null;
  /** Perform the UI action that appends a rule to the root group. */
  addRule(el: HTMLElement): void | Promise<void>;
  /** Serialize current state to SQL using the library's own exporter (null = unsupported). */
  sql: (() => string) | null;
  /** UI action that removes the rule at `index` (in ruleCount order). Omitted = no such control. */
  removeRule?(el: HTMLElement, index: number): void | Promise<void>;
  /**
   * UI action that switches the rule at `index` to field `to` (via the field picker, opening it first
   * where it is a popup). Resolves to a predicate that is true once the rule shows the new field.
   */
  changeField?(el: HTMLElement, index: number, to: FieldDef): Done;
  /** Same for the operator: toggles between "equals" and "not equals". */
  changeOperator?(el: HTMLElement, index: number, negate: boolean): Done;
  /**
   * Drag the rule at `from` above its group's first rule using the library's own drag and drop. Timed
   * from the drop (release) until the tree shows the new order; drag start and pointer travel are not.
   */
  reorder?(el: HTMLElement, from: number): Done;
  /** Why an optional action is missing (shown instead of a number), or a caveat about how it was timed. */
  notes?: Partial<Record<'removeRule' | 'changeField' | 'changeOperator' | 'reorder' | 'type', string>>;
}

/** Resolves once the action has been dispatched; the predicate tells the runner the UI caught up. */
export type Done = (() => boolean) | Promise<() => boolean>;

/** Polls `f` on macrotasks until it returns something (for popups that open asynchronously). */
export async function waitFor<T>(f: () => T | null | undefined, ms = 10_000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const v = f();
    if (v) return v;
    if (performance.now() - start > ms) throw new Error('waitFor timeout');
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Pick an option in a native <select> the way a user does: focus/press it first (lazy option lists fill on that), then change. */
export async function pickNative(sel: HTMLSelectElement, value: string) {
  sel.focus();
  sel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await waitFor(() => Array.from(sel.options).some((o) => o.value === value) || null);
  sel.value = value;
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Restart the action's clock: what came before (drag start, pointer travel) is not timed. */
export const markStart = () => (window as any).__benchMark?.();

/** HTML5 drag of `handle` onto the top half of `target`. */
export function html5Drag(handle: Element, target: Element) {
  const dt = new DataTransfer();
  const r = target.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 2 };
  handle.dispatchEvent(new DragEvent('dragstart', at));
  target.dispatchEvent(new DragEvent('dragenter', at));
  target.dispatchEvent(new DragEvent('dragover', at));
  markStart();
  target.dispatchEvent(new DragEvent('drop', at));
  handle.dispatchEvent(new DragEvent('dragend', at));
}
