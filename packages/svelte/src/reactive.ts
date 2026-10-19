// Rune-friendly helpers: objects whose getters are reactive in any Svelte 5 template, $derived or
// $effect. Each one depends only on what it reads (one node, its permissions, its drag state, or the
// whole query).
//
// Per-node reactivity is shared, not per reader: one hub per store keeps a keyed version signal for
// every node (a SvelteMap, whose per-key sources are created lazily and tracked correctly from any
// reaction), fed by one store subscription per node and a single permissions subscription that bumps
// only the nodes whose answers flipped. Drag and drop works the same way per controller. Readers are
// plain getters, so a rule costs a few map lookups, not a subscription object per read.
import {
  createDnd,
  dropIndexFromPointer,
  editorFor,
  elementFields,
  fieldOptions,
  functionOptions,
  leftDef,
  operatorOptions,
  refOptions,
  type Action,
  type AnyFieldDef,
  type DndController,
  type DndState,
  type EditorSpec,
  type FieldOption,
  type Fields,
  type FnCall,
  type GroupNode,
  type Issue,
  type NodeId,
  type Option,
  type Quantifier,
  type QueryOf,
  type QueryStore,
  type RuleNode,
  type StoreNode,
  type StoreSettings,
} from '@qnot/core';
import { getContext, setContext, untrack } from 'svelte';
import { createSubscriber, SvelteMap } from 'svelte/reactivity';

interface Ctx {
  store: QueryStore<any, any>;
  dnd: DndController;
}

const KEY = Symbol('qnot');

/** Make `store` available to descendant components. Call during component initialisation. */
export function setQueryStore(store: QueryStore<any, any>): void {
  hubOf(store);
  setContext<Ctx>(KEY, { store, dnd: createDnd(store) });
}

function ctx(): Ctx {
  const c = getContext<Ctx | undefined>(KEY);
  if (!c) throw new Error('qnot: call setQueryStore(store) in an ancestor (or use <QueryBuilder>)');
  return c;
}

export const getQueryStore = <F extends Fields = Fields, T = QueryOf<F>>(): QueryStore<F, T> => ctx().store;
export const getDndController = (): DndController => ctx().dnd;

// --- per-store hub -------------------------------------------------------------------------------

const RULE_ACTIONS = ['editField', 'editOperator', 'editValue', 'remove', 'clone', 'lock'] as const;
const GROUP_ACTIONS = ['addRule', 'addGroup', 'editGroup', 'remove', 'clone', 'lock'] as const;
type RuleAction = (typeof RULE_ACTIONS)[number];
type GroupAction = (typeof GROUP_ACTIONS)[number];
/** Every answer a node's UI reads, as one bitmask; the last bit is "locked (here or by an ancestor)". */
const ALL_ACTIONS: readonly Action[] = [...new Set<Action>([...RULE_ACTIONS, ...GROUP_ACTIONS])];
const LOCKED = 1 << ALL_ACTIONS.length;
const RULE_BITS = RULE_ACTIONS.map((a) => ALL_ACTIONS.indexOf(a));
const GROUP_BITS = GROUP_ACTIONS.map((a) => ALL_ACTIONS.indexOf(a));
/** Key of the settings signal in the versions map (node ids are strings). */
const SETTINGS = Symbol('settings');

interface Hub {
  /** Track node `id` in the current reaction: re-run when it changes or a permission answer flips. */
  track(id: NodeId): void;
  /** Permission bits for `id` (see ALL_ACTIONS), computed lazily and cached until they can change. */
  bits(id: NodeId): number;
  trackSettings(): void;
}

const hubs = new WeakMap<QueryStore<any, any>, Hub>();

function hubOf(store: QueryStore<any, any>): Hub {
  let hub = hubs.get(store);
  if (!hub) hubs.set(store, (hub = createHub(store)));
  return hub;
}

function createHub(store: QueryStore<any, any>): Hub {
  const unsubs = new Map<NodeId, () => void>();
  const bits = new Map<NodeId, number>();
  const initial: [NodeId | symbol, number][] = [[SETTINGS, 0]];
  // Every node gets a key up front (nodes added later get theirs from their parent's change), so a
  // read never has to create one inside a reaction. Built before the map so construction is silent.
  let versions: SvelteMap<NodeId | symbol, number> | null = null;

  // Writes never read the map, so a store change made inside an effect doesn't subscribe it.
  let seq = 0;
  const bump = (id: NodeId | symbol) => versions!.set(id, ++seq);

  function watch(id: NodeId) {
    if (unsubs.has(id)) return;
    const n = store.get(id);
    if (!n) return;
    if (versions) bump(id);
    else initial.push([id, 0]);
    unsubs.set(
      id,
      store.subscribe(id, () => {
        const next = store.get(id);
        bits.delete(id);
        if (!next) {
          unsubs.get(id)?.();
          unsubs.delete(id);
          versions!.delete(id);
          return;
        }
        if (next.kind === 'group') next.children.forEach(watch);
        bump(id);
      }),
    );
    if (n.kind === 'group') n.children.forEach(watch);
  }

  watch(store.rootId);
  versions = new SvelteMap(initial);

  const compute = (id: NodeId) => {
    const n = store.get(id);
    let b = 0;
    if (n) {
      // Only the actions that apply to the node's kind (the others are always false).
      for (const i of n.kind === 'rule' ? RULE_BITS : GROUP_BITS) if (store.can(ALL_ACTIONS[i]!, id)) b |= 1 << i;
      if (store.isLocked(id)) b |= LOCKED;
    }
    return b;
  };

  let settings = store.settings;
  store.subscribePermissions(() => {
    // Only nodes whose answers were read and have flipped re-run.
    for (const [id, b] of bits) {
      const next = compute(id);
      if (next !== b) {
        bits.set(id, next);
        bump(id);
      }
    }
    if (store.settings !== settings) {
      settings = store.settings;
      bump(SETTINGS);
    }
  });

  return {
    track: (id) => void versions!.get(id),
    bits(id) {
      let b = bits.get(id);
      if (b === undefined && unsubs.has(id)) bits.set(id, (b = compute(id)));
      return b ?? compute(id);
    },
    trackSettings: () => void versions!.get(SETTINGS),
  };
}

/** One shared record per (action list, answers), so unchanged permissions keep their identity. */
const records = new WeakMap<readonly Action[], Map<number, Record<string, boolean>>>();
function record<A extends Action>(actions: readonly A[], bits: number): Record<A, boolean> {
  let byBits = records.get(actions);
  if (!byBits) records.set(actions, (byBits = new Map()));
  let r = byBits.get(bits);
  if (!r) byBits.set(bits, (r = Object.fromEntries(actions.map((a) => [a, (bits & (1 << ALL_ACTIONS.indexOf(a))) !== 0]))));
  return r as Record<A, boolean>;
}

/** The node's kind, tracked (used by the default group to pick the child component). */
export function nodeKind(store: QueryStore<any, any>, id: NodeId): 'rule' | 'group' | undefined {
  hubOf(store).track(id);
  return store.get(id)?.kind;
}

class NodeView<F extends Fields> {
  #store: QueryStore<F, any>;
  #hub: Hub;
  #id: NodeId;
  #last: StoreNode<F>;
  constructor(store: QueryStore<F, any>, id: NodeId) {
    this.#store = store;
    this.#hub = hubOf(store);
    this.#id = id;
    this.#last = store.get(id)!;
  }
  get current(): StoreNode<F> {
    this.#hub.track(this.#id);
    return (this.#last = this.#store.get(this.#id) ?? this.#last);
  }
}

/** A reactive view of one node: `node.current` re-runs dependents only when that node changes. */
export function createNode<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId): { readonly current: StoreNode<F> } {
  return new NodeView(store, id);
}

class SettingsView {
  #store: QueryStore<any, any>;
  #hub: Hub;
  constructor(store: QueryStore<any, any>) {
    this.#store = store;
    this.#hub = hubOf(store);
  }
  get current(): Readonly<StoreSettings> {
    this.#hub.trackSettings();
    return this.#store.settings;
  }
}

const settingsViews = new WeakMap<QueryStore<any, any>, SettingsView>();
/** Reactive store settings: `settings.current` updates when `setSettings` is called. */
export function createSettings(store: QueryStore<any, any>): { readonly current: Readonly<StoreSettings> } {
  // Stateless, so one per store serves every caller.
  let view = settingsViews.get(store);
  if (!view) settingsViews.set(store, (view = new SettingsView(store)));
  return view;
}

// --- option lists, shared by every rule with the same schema ---------------------------------------

/** `get(key)` from a WeakMap-of-Maps cache, computing on miss. */
function cached<K extends object, S, V>(cache: WeakMap<K, Map<S, V>>, key: K, sub: S, compute: () => V): V {
  let inner = cache.get(key);
  if (!inner) cache.set(key, (inner = new Map()));
  let v = inner.get(sub);
  if (v === undefined && !inner.has(sub)) inner.set(sub, (v = compute()));
  return v as V;
}

const fieldChoiceCache = new WeakMap<Fields, Map<boolean, FieldOption[]>>();
/** Field picker options for a scope: rule fields, or (`arrays`) the array fields for list conditions. */
export const fieldChoices = (fields: Fields, arrays = false): FieldOption[] =>
  cached(fieldChoiceCache, fields, arrays, () => fieldOptions(fields).filter((o) => o.isArray === arrays));

const operatorCache = new WeakMap<Fields, Map<AnyFieldDef | undefined, Option[]>>();
export const operatorChoices = (def: AnyFieldDef | undefined, fields: Fields): Option[] => cached(operatorCache, fields, def, () => operatorOptions(def, fields));

const editorCache = new WeakMap<Fields, Map<AnyFieldDef | undefined, Map<string, EditorSpec>>>();
export function editorOf(def: AnyFieldDef | undefined, operator: string, fields: Fields): EditorSpec {
  const byOp = cached(editorCache, fields, def, () => new Map<string, EditorSpec>());
  let e = byOp.get(operator);
  if (!e) byOp.set(operator, (e = editorFor(def, operator, fields)));
  return e;
}

const refCache = new WeakMap<Fields, Map<string, Option[]>>();
export const refChoices = (fields: Fields, field: string, kind: string | undefined): Option[] => cached(refCache, fields, `${kind}\u0000${field}`, () => refOptions(fields, field, kind));

const functionCache = new WeakMap<Fields, Map<string | undefined, Option[]>>();
/** Functions returning `kind` (all functions when omitted) in this scope. */
export const functionChoices = (fields: Fields, kind?: string): Option[] => cached(functionCache, fields, kind, () => functionOptions(fields, kind));

const NONE: Option[] = [];
const NO_FIELDS: FieldOption[] = [];

// --- rules and groups ----------------------------------------------------------------------------

export interface RuleState<F extends Fields> {
  readonly id: NodeId;
  readonly rule: RuleNode<F>;
  /** The schema in scope: the array's element fields inside array groups. */
  readonly fields: Fields;
  readonly def: AnyFieldDef | undefined;
  readonly editor: EditorSpec;
  readonly operators: Option[];
  readonly fieldOptions: FieldOption[];
  readonly refOptions: Option[];
  readonly functionOptions: Option[];
  /** Where the right side comes from: a literal, another field, or a function. */
  readonly source: 'value' | 'field' | 'function';
  readonly locked: boolean;
  readonly can: Record<RuleAction, boolean>;
  readonly issues: readonly Issue[];
  setField(field: string | FnCall): void;
  setOperator(operator: string): void;
  setValue(value: unknown): void;
  setRef(ref: string | null): void;
  setCall(call: FnCall | null): void;
  setLocked(locked: boolean): void;
  remove(): void;
  clone(): void;
}

/** Fields in scope for node `id` (stable identity; cached by the store). */
const scopeOf = (store: QueryStore<any, any>, id: NodeId): Fields => (store.get(id) ? store.fieldsFor(id) : (store.fields as Fields));

// Rule and group state are class instances: getters live on the prototype, so a row costs a few
// fields instead of an object literal full of accessors (which V8 keeps in slow dictionary mode).
// Actions are bound on first use (they're stable from then on), as most rows never run most of them.

/** Lazily bound, then stable, functions per instance. */
export class Bound {
  #fns: Record<string, (...args: any[]) => unknown> | undefined;
  protected bind<T extends (...args: any[]) => unknown>(key: string, make: () => T): T {
    const fns = (this.#fns ??= {});
    return (fns[key] ??= make()) as T;
  }
}
class RuleView<F extends Fields> extends Bound implements RuleState<F> {
  readonly id: NodeId;
  #store: QueryStore<F, any>;
  #hub: Hub;
  #last: RuleNode<F>;
  constructor(store: QueryStore<F, any>, id: NodeId) {
    super();
    this.id = id;
    this.#store = store;
    this.#hub = hubOf(store);
    this.#last = store.get(id) as RuleNode<F>;
  }
  get rule(): RuleNode<F> {
    this.#hub.track(this.id);
    return (this.#last = (this.#store.get(this.id) as RuleNode<F> | undefined) ?? this.#last);
  }
  get fields(): Fields {
    this.#hub.track(this.id);
    return scopeOf(this.#store, this.id);
  }
  // A row reads these many times per update; keep them for as long as the node and its scope.
  #for: RuleNode<F> | undefined;
  #scope: Fields | undefined;
  #def: AnyFieldDef | undefined;
  #editor: EditorSpec | undefined;
  #resolve() {
    const r = this.rule;
    const fields = scopeOf(this.#store, this.id);
    if (r !== this.#for || fields !== this.#scope) {
      this.#for = r;
      this.#scope = fields;
      this.#def = leftDef(fields, r.field as string | FnCall);
      this.#editor = editorOf(this.#def, r.operator, fields);
    }
  }
  get def(): AnyFieldDef | undefined {
    this.#resolve();
    return this.#def;
  }
  get editor(): EditorSpec {
    this.#resolve();
    return this.#editor!;
  }
  get operators(): Option[] {
    return operatorChoices(this.def, this.fields);
  }
  get fieldOptions(): FieldOption[] {
    return fieldChoices(this.fields);
  }
  get refOptions(): Option[] {
    this.#hub.trackSettings();
    const field = this.rule.field;
    return this.#store.settings.allowRefs !== false && typeof field === 'string' && this.editor.allowsRef ? refChoices(this.fields, field, this.def?.kind) : NONE;
  }
  get functionOptions(): Option[] {
    this.#hub.trackSettings();
    return this.#store.settings.allowFunctions !== false && this.editor.allowsRef ? functionChoices(this.fields, this.def?.kind) : NONE;
  }
  get source(): 'value' | 'field' | 'function' {
    const r = this.rule;
    return r.ref !== undefined ? 'field' : r.call !== undefined ? 'function' : 'value';
  }
  get locked(): boolean {
    this.#hub.track(this.id);
    return (this.#hub.bits(this.id) & LOCKED) !== 0;
  }
  get can(): Record<RuleAction, boolean> {
    this.#hub.track(this.id);
    return record(RULE_ACTIONS, this.#hub.bits(this.id));
  }
  get issues(): readonly Issue[] {
    this.#hub.track(this.id);
    return this.#store.issues(this.id);
  }
  get setField() {
    return this.bind('setField', () => (field: string | FnCall) => this.#store.setField(this.id, field as never));
  }
  get setOperator() {
    return this.bind('setOperator', () => (operator: string) => this.#store.setOperator(this.id, operator));
  }
  get setValue() {
    return this.bind('setValue', () => (value: unknown) => this.#store.setRuleValue(this.id, value));
  }
  get setRef() {
    return this.bind('setRef', () => (ref: string | null) => this.#store.setRef(this.id, ref));
  }
  get setCall() {
    return this.bind('setCall', () => (call: FnCall | null) => this.#store.setCall(this.id, call));
  }
  get setLocked() {
    return this.bind('setLocked', () => (locked: boolean) => this.#store.setLocked(this.id, locked));
  }
  get remove() {
    return this.bind('remove', () => () => void this.#store.requestRemove(this.id));
  }
  get clone() {
    return this.bind('clone', () => () => void this.#store.clone(this.id));
  }
}

/** A rule's reactive state plus everything needed to render its editors. */
export function createRule<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId): RuleState<F> {
  return new RuleView(store, id);
}

/** Fields visible to a group's children (element schema for array groups). */
function innerFields(store: QueryStore<any, any>, id: NodeId): Fields {
  const g = store.getGroup(id);
  const outer = g.parent === null ? store.fields : store.fieldsFor(id);
  return g.of && outer[g.of.field]?.of ? elementFields(outer, g.of.field) : outer;
}

class GroupView<F extends Fields> extends Bound {
  readonly id: NodeId;
  #store: QueryStore<F, any>;
  #hub: Hub;
  #last: GroupNode;
  constructor(store: QueryStore<F, any>, id: NodeId) {
    super();
    this.id = id;
    this.#store = store;
    this.#hub = hubOf(store);
    this.#last = store.get(id) as GroupNode;
  }
  get group(): GroupNode {
    this.#hub.track(this.id);
    return (this.#last = (this.#store.get(this.id) as GroupNode | undefined) ?? this.#last);
  }
  get isRoot(): boolean {
    return this.group.parent === null;
  }
  /** Array fields available for "+ List condition" in this group's scope. */
  get arrayFields(): FieldOption[] {
    this.group;
    return this.#store.get(this.id) ? fieldChoices(innerFields(this.#store, this.id), true) : NO_FIELDS;
  }
  get locked(): boolean {
    this.#hub.track(this.id);
    return (this.#hub.bits(this.id) & LOCKED) !== 0;
  }
  get can(): Record<GroupAction, boolean> {
    this.#hub.track(this.id);
    return record(GROUP_ACTIONS, this.#hub.bits(this.id));
  }
  get issues(): readonly Issue[] {
    this.#hub.track(this.id);
    return this.#store.issues(this.id);
  }
  get setCombinator() {
    return this.bind('setCombinator', () => (combinator: GroupNode['combinator']) => this.#store.setCombinator(this.id, combinator));
  }
  get setNot() {
    return this.bind('setNot', () => (not: boolean) => this.#store.setNot(this.id, not));
  }
  get setMatch() {
    return this.bind('setMatch', () => (match: Quantifier) => this.#store.setMatch(this.id, match));
  }
  get setLocked() {
    return this.bind('setLocked', () => (locked: boolean) => this.#store.setLocked(this.id, locked));
  }
  get addRule() {
    return this.bind('addRule', () => (rule?: Parameters<QueryStore<F>['addRule']>[1]) => this.#store.addRule(this.id, rule));
  }
  get addGroup() {
    return this.bind('addGroup', () => () => this.#store.addGroup(this.id));
  }
  get addArrayGroup() {
    return this.bind('addArrayGroup', () => (field: string, match?: Quantifier) => this.#store.addArrayGroup(this.id, field, match));
  }
  get remove() {
    return this.bind('remove', () => () => void this.#store.requestRemove(this.id));
  }
  get clone() {
    return this.bind('clone', () => () => void this.#store.clone(this.id));
  }
}

export function createGroup<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId) {
  return new GroupView(store, id) as Omit<GroupView<F>, never>;
}

function all<S>(store: QueryStore<any, any>, read: () => S): { readonly current: S } {
  const subscribe = createSubscriber((update) => store.subscribe(update));
  return {
    get current() {
      subscribe();
      return read();
    },
  };
}

/** The whole native query; changes on every edit. Use for previews and exports. */
export const createQuery = <F extends Fields>(store: QueryStore<F, any>) => all(store, store.getQuery);
export const createQueryValue = <T>(store: QueryStore<any, T>) => all(store, store.getValue);
export const createIsValid = (store: QueryStore<any, any>) => all(store, store.isValid);

export function createHistory(store: QueryStore<any, any>) {
  const subscribe = createSubscriber((update) => store.subscribe(update));
  return {
    get canUndo() {
      subscribe();
      return store.canUndo();
    },
    get canRedo() {
      subscribe();
      return store.canRedo();
    },
    undo: store.undo,
    redo: store.redo,
  };
}

// --- drag and drop -------------------------------------------------------------------------------

export type DropPosition = 'before' | 'after' | 'inside' | null;

interface DndHub {
  /** Bumped for a node when its dragging, drop position or drop-zone answer may have changed. */
  track(id: NodeId): void;
  /** Register a node that renders drag state (before it is read), and the store drop targets need. */
  add(id: NodeId, store?: QueryStore<any, any>): void;
}

const dndHubs = new WeakMap<DndController, DndHub>();

/**
 * One subscription per controller. A drag step touches at most a few nodes (the dragged one, the
 * old and new drop targets and their groups), so only those re-run instead of every row.
 */
function dndHubOf(dnd: DndController): DndHub {
  let hub = dndHubs.get(dnd);
  if (hub) return hub;
  const versions = new SvelteMap<NodeId, number>();
  const known = new Set<NodeId>();
  let seq = 0;
  let store: QueryStore<any, any> | undefined;
  let touched: NodeId[] = [];
  const affected = (s: DndState): NodeId[] => {
    const out: NodeId[] = [];
    if (s.dragging) out.push(s.dragging);
    if (s.over) {
      out.push(s.over.parentId);
      const siblings = store?.get(s.over.parentId)?.kind === 'group' ? store.getGroup(s.over.parentId).children : [];
      const target = siblings[s.over.index] ?? siblings[siblings.length - 1];
      if (target) out.push(target);
    }
    return out;
  };
  dnd.subscribe(() => {
    const state = dnd.getState();
    const next = affected(state);
    for (const id of new Set([...touched, ...next])) if (known.has(id)) versions.set(id, ++seq);
    touched = next;
    // Once a drag is over, forget nodes that no longer exist (they re-register if they come back).
    if (!state.dragging && store)
      for (const id of known)
        if (!store.get(id)) {
          known.delete(id);
          versions.delete(id);
        }
  });
  hub = {
    track: (id) => void versions.get(id),
    add(id, s) {
      store ??= s;
      if (known.has(id)) return;
      known.add(id);
      // Usually runs during component init; untrack keeps it legal anywhere (even in a $derived).
      untrack(() => versions.set(id, 0));
    },
  };
  dndHubs.set(dnd, hub);
  return hub;
}

/** Start dragging node `id` from its handle; `row` is the dragged row element (the drag image). */
export function startDrag(dnd: DndController, id: NodeId, e: DragEvent, row: Element | null) {
  e.stopPropagation();
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    if (row) e.dataTransfer.setDragImage(row, 12, 12);
  }
  dnd.start(id);
}

/** A drag moving over node `id`'s element `el`: drop before or after it, by pointer position. */
export function dragOver(store: QueryStore<any, any>, dnd: DndController, id: NodeId, e: DragEvent, el: Element) {
  const n = store.get(id);
  if (!dnd.getState().dragging || !n || n.parent === null) return;
  e.preventDefault();
  e.stopPropagation();
  const index = store.getGroup(n.parent).children.indexOf(id);
  dnd.over({ parentId: n.parent, index: dropIndexFromPointer(el.getBoundingClientRect(), e.clientY, index) });
}

/** Drop the dragged node at the current target. */
export function dropHere(dnd: DndController, e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dnd.drop();
}

class DragHandle {
  #dnd: DndController;
  #hub: DndHub;
  #id: NodeId;
  readonly handleProps;
  constructor(dnd: DndController, id: NodeId) {
    this.#dnd = dnd;
    this.#hub = dndHubOf(dnd);
    this.#id = id;
    this.#hub.add(id);
    this.handleProps = {
      draggable: true,
      ondragstart(e: DragEvent) {
        startDrag(dnd, id, e, (e.currentTarget as HTMLElement).closest('[data-qn-id]'));
      },
      ondragend: () => dnd.cancel(),
    };
  }
  get isDragging(): boolean {
    this.#hub.track(this.#id);
    return this.#dnd.getState().dragging === this.#id;
  }
}

/** `handleProps` spreads onto the grab handle: `<span {...drag.handleProps}>`. */
export function createDragHandle(dnd: DndController, id: NodeId) {
  return new DragHandle(dnd, id) as Omit<DragHandle, never>;
}

class DropTarget {
  #store: QueryStore<any, any>;
  #dnd: DndController;
  #hub: DndHub;
  #id: NodeId;
  readonly dropProps;
  constructor(store: QueryStore<any, any>, dnd: DndController, id: NodeId) {
    this.#store = store;
    this.#dnd = dnd;
    this.#hub = dndHubOf(dnd);
    this.#id = id;
    this.#hub.add(id, store);
    this.dropProps = {
      'data-qn-id': id,
      ondragover(e: DragEvent) {
        dragOver(store, dnd, id, e, e.currentTarget as Element);
      },
      ondrop(e: DragEvent) {
        dropHere(dnd, e);
      },
    };
  }
  get position(): DropPosition {
    this.#hub.track(this.#id);
    const store = this.#store;
    const id = this.#id;
    const over = this.#dnd.getState().over;
    const n = over && store.get(id);
    if (!over || !n || n.parent !== over.parentId) return null;
    const siblings = store.getGroup(n.parent).children;
    const index = siblings.indexOf(id);
    if (over.index === index) return 'before';
    if (over.index === index + 1 && index === siblings.length - 1) return 'after';
    return null;
  }
}

export function createDropTarget(store: QueryStore<any, any>, dnd: DndController, id: NodeId) {
  return new DropTarget(store, dnd, id) as Omit<DropTarget, never>;
}

class GroupDropZone {
  #store: QueryStore<any, any>;
  #dnd: DndController;
  #hub: DndHub;
  #id: NodeId;
  readonly zoneProps;
  constructor(store: QueryStore<any, any>, dnd: DndController, groupId: NodeId) {
    this.#store = store;
    this.#dnd = dnd;
    this.#hub = dndHubOf(dnd);
    this.#id = groupId;
    this.#hub.add(groupId, store);
    this.zoneProps = {
      ondragover(e: DragEvent) {
        if (!dnd.getState().dragging) return;
        e.preventDefault();
        e.stopPropagation();
        dnd.over({ parentId: groupId, index: store.getGroup(groupId).children.length });
      },
      ondrop(e: DragEvent) {
        dropHere(dnd, e);
      },
    };
  }
  get isOver(): boolean {
    this.#hub.track(this.#id);
    const over = this.#dnd.getState().over;
    const store = this.#store;
    return over?.parentId === this.#id && store.get(this.#id)?.kind === 'group' && store.getGroup(this.#id).children.length === 0;
  }
}

export function createGroupDropZone(store: QueryStore<any, any>, dnd: DndController, groupId: NodeId) {
  return new GroupDropZone(store, dnd, groupId) as Omit<GroupDropZone, never>;
}
