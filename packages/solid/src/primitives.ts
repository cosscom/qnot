// Fine-grained Solid primitives. Everything per store is shared: one node signal per node (however
// many components read it), one permissions/settings channel, one drag-and-drop channel with
// selectors, and option lists cached per schema. A rule then costs a handful of computations, and
// a keystroke updates exactly the DOM bound to that rule's value.
import {
  createDnd,
  createQueryStore,
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
  type StoreOptions,
  type StoreSettings,
} from '@qnot/core';
import { batch, createContext, createMemo, createRenderEffect, createRoot, createSelector, createSignal, on, onCleanup, useContext, type Accessor } from 'solid-js';

export interface QueryContextValue {
  store: QueryStore<any, any>;
  dnd: DndController;
}

export const QueryContext = createContext<QueryContextValue>();

export const makeContextValue = (store: QueryStore<any, any>): QueryContextValue => ({ store, dnd: createDnd(store) });

export function useCtx(): QueryContextValue {
  const ctx = useContext(QueryContext);
  if (!ctx) throw new Error('qnot: wrap your components in <QueryProvider store={...}> (or use <QueryBuilder>)');
  return ctx;
}

export const useStore = <F extends Fields = Fields, T = QueryOf<F>>(): QueryStore<F, T> => useCtx().store;
export const useDndController = (): DndController => useCtx().dnd;

export interface UseQueryStoreOptions<F extends Fields, T> extends StoreOptions<F, T> {
  /** Controlled value accessor (in `format`'s shape), synced into the store node by node. */
  value?: Accessor<T | undefined>;
  /** Called after every change with the query in `format`'s shape. */
  onChange?: (value: T) => void;
}

/** Create a store owned by the current reactive owner (component or root). */
export function useQueryStore<const F extends Fields, T = QueryOf<F>>(options: UseQueryStoreOptions<F, T>): QueryStore<F, T> {
  const initialValue = options.value?.();
  const store = createQueryStore({ ...options, initial: initialValue !== undefined ? initialValue : options.initial } as StoreOptions<F, T> & { format: any }) as QueryStore<F, T>;
  if (options.value) {
    const value = options.value;
    createRenderEffect(
      on(value, (v) => {
        if (v !== undefined) store.setValue(v);
      }, { defer: true }),
    );
  }
  const unsub = store.subscribe(() => options.onChange?.(store.getValue()));
  onCleanup(() => {
    unsub();
    store.dispose();
  });
  return store;
}

/** A signal that follows a store subscription and unsubscribes with the owner. */
function track<S>(subscribe: (fn: () => void) => () => void, read: () => S): Accessor<S> {
  const [get, set] = createSignal<S>(read());
  onCleanup(subscribe(() => set(() => read())));
  return get;
}

// --- per-store shared state ----------------------------------------------------------------------

interface NodeEntry {
  get: Accessor<StoreNode>;
  /** Created on first use: only node views need it. */
  kind?: Accessor<StoreNode['kind']>;
  setKind?: (k: StoreNode['kind']) => void;
  unsub: () => void;
  users: number;
}

interface Shared {
  /** Bumps whenever `subscribePermissions` fires (settings, locks, limits). */
  perm: Accessor<number>;
  settings: Accessor<Readonly<StoreSettings>>;
  nodes: Map<NodeId, NodeEntry>;
}

const sharedByStore = new WeakMap<QueryStore<any, any>, Shared>();

/** One permissions subscription per store, however many rows read it. */
export function shared(store: QueryStore<any, any>): Shared {
  let s = sharedByStore.get(store);
  if (!s) {
    const [perm, setPerm] = createSignal(0);
    const [settings, setSettings] = createSignal<Readonly<StoreSettings>>(store.settings);
    store.subscribePermissions(() =>
      batch(() => {
        setSettings(store.settings);
        setPerm((v) => v + 1);
      }),
    );
    sharedByStore.set(store, (s = { perm, settings, nodes: new Map() }));
  }
  return s;
}

function nodeEntry(store: QueryStore<any, any>, id: NodeId): NodeEntry {
  const { nodes } = shared(store);
  let e = nodes.get(id);
  if (!e) {
    // Keep the last snapshot after removal so a child updating once more before its parent drops it doesn't crash.
    let last = store.get(id)!;
    const [get, set] = createSignal<StoreNode>(last);
    const entry: NodeEntry = {
      get,
      // Batched so a node view swapping its component (kind changed) disposes the old one before
      // that one re-runs on a snapshot of the other kind.
      unsub: store.subscribe(id, () =>
        batch(() => {
          last = store.get(id) ?? last;
          set(last);
          entry.setKind?.(last.kind);
        }),
      ),
      users: 0,
    };
    nodes.set(id, (e = entry));
  }
  const entry = e;
  entry.users++;
  onCleanup(() => {
    if (--entry.users) return;
    entry.unsub();
    if (nodes.get(id) === entry) nodes.delete(id);
  });
  return entry;
}

/** The node's snapshot as a signal, shared by every reader of the same node. */
const nodeAccessor = (store: QueryStore<any, any>, id: NodeId): Accessor<StoreNode> => nodeEntry(store, id).get;

/** Whether the node is a rule or a group (it can change when a controlled value is reconciled). */
export function nodeKind(store: QueryStore<any, any>, id: NodeId): Accessor<StoreNode['kind']> {
  const e = nodeEntry(store, id);
  if (!e.kind) [e.kind, e.setKind] = createSignal(e.get().kind);
  return e.kind;
}

export const useNode = <F extends Fields = Fields>(id: NodeId) => nodeAccessor(useCtx().store, id) as Accessor<StoreNode<F>>;

// --- option lists, cached per schema --------------------------------------------------------------
// Rules sharing a schema share these arrays (and editor specs), so a thousand rules build them once.

const byFields = <V>() => {
  const cache = new WeakMap<Fields, Map<unknown, V>>();
  return (fields: Fields, key: unknown, make: () => V): V => {
    let m = cache.get(fields);
    if (!m) cache.set(fields, (m = new Map()));
    let v = m.get(key);
    if (v === undefined) m.set(key, (v = make()));
    return v;
  };
};
const fieldCache = byFields<FieldOption[]>();
const editorCache = byFields<Map<string, EditorSpec>>();
const operatorCache = byFields<Option[]>();
const refCache = byFields<Option[]>();
const functionCache = byFields<Option[]>();

const ruleFieldOptions = (fields: Fields): FieldOption[] => fieldCache(fields, true, () => fieldOptions(fields).filter((o) => !o.isArray));
const arrayFieldOptions = (fields: Fields): FieldOption[] => fieldCache(fields, false, () => fieldOptions(fields).filter((o) => o.isArray));
export const cachedFunctionOptions = (fields: Fields, kind?: string): Option[] => functionCache(fields, kind ?? '\0any', () => functionOptions(fields, kind));
const cachedRefOptions = (fields: Fields, field: string, kind?: string): Option[] => refCache(fields, `${field}\0${kind}`, () => refOptions(fields, field, kind));
function cachedEditor(def: AnyFieldDef | undefined, operator: string, fields: Fields): EditorSpec {
  const m = editorCache(fields, def, () => new Map());
  let e = m.get(operator);
  if (!e) m.set(operator, (e = editorFor(def, operator, fields)));
  return e;
}
const NO_OPTIONS: Option[] = [];

// --- permissions ----------------------------------------------------------------------------------

const RULE_ACTIONS = ['editField', 'editOperator', 'editValue', 'remove', 'clone', 'lock'] as const;
const GROUP_ACTIONS = ['addRule', 'addGroup', 'editGroup', 'remove', 'clone', 'lock'] as const;

/** One frozen record per answer combination, so `can()` keeps its identity while nothing flips. */
const records = new WeakMap<readonly string[], Record<string, boolean>[]>();
function recordFor<A extends Action>(actions: readonly A[], bits: number): Record<A, boolean> {
  let table = records.get(actions);
  if (!table) records.set(actions, (table = []));
  return (table[bits] ??= Object.freeze(Object.fromEntries(actions.map((a, i) => [a, (bits & (1 << i)) !== 0])))) as Record<A, boolean>;
}

/**
 * What the user may do to a node right now (settings, locks, limits), plus whether it's locked,
 * as one bitmask memo on the shared permissions channel: value edits never re-run it and
 * dependents update only when an answer flips.
 */
function permissions<A extends Action>(store: QueryStore<any, any>, id: NodeId, actions: readonly A[]) {
  const { perm } = shared(store);
  const lockBit = 1 << actions.length;
  const bits = createMemo(() => {
    perm();
    let b = store.isLocked(id) ? lockBit : 0;
    if (store.get(id)) actions.forEach((a, i) => store.can(a, id) && (b |= 1 << i));
    return b;
  });
  return {
    can: (): Record<A, boolean> => recordFor(actions, bits() & (lockBit - 1)),
    locked: (): boolean => (bits() & lockBit) !== 0,
  };
}

/** Current store settings; updates when `setSettings` is called. */
export function useSettings(): Accessor<Readonly<StoreSettings>> {
  return shared(useStore()).settings;
}

// --- rules and groups -----------------------------------------------------------------------------

type Source = 'value' | 'field' | 'function';

/** Everything about a rule that changes only with its field, operator, source, scope or settings. */
interface RuleShape {
  parent: NodeId | null;
  field: string | FnCall;
  operator: string;
  source: Source;
  settings: Readonly<StoreSettings>;
  fields: Fields;
  def: AnyFieldDef | undefined;
  editor: EditorSpec;
  operators: Option<string>[];
  fieldOptions: FieldOption[];
  refOptions: Option[];
  functionOptions: Option[];
}

/** A rule's fine-grained state plus everything needed to render its editors. */
export function useRule<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const { settings } = shared(store);
  const rule = nodeAccessor(store, id) as Accessor<RuleNode<F>>;
  // One memo for all the derived editor state: a value edit re-runs only this comparison.
  const shape = createMemo<RuleShape>((prev) => {
    const n = rule();
    const s = settings();
    const field = n.field as string | FnCall;
    const source: Source = n.ref !== undefined ? 'field' : n.call !== undefined ? 'function' : 'value';
    if (prev && prev.parent === n.parent && prev.field === field && prev.operator === n.operator && prev.source === source && prev.settings === s) return prev;
    // The schema in scope: the array's element fields inside array groups.
    const fields = prev && prev.parent === n.parent ? prev.fields : store.get(id) ? store.fieldsFor(id) : store.fields;
    const def = leftDef(fields, field);
    const editor = cachedEditor(def, n.operator, fields);
    return {
      parent: n.parent,
      field,
      operator: n.operator,
      source,
      settings: s,
      fields,
      def,
      editor,
      operators: operatorCache(fields, def, () => operatorOptions(def, fields)),
      fieldOptions: ruleFieldOptions(fields),
      refOptions: editor.allowsRef && s.allowRefs !== false && typeof field === 'string' ? cachedRefOptions(fields, field, def?.kind) : NO_OPTIONS,
      functionOptions: editor.allowsRef && s.allowFunctions !== false ? cachedFunctionOptions(fields, def?.kind) : NO_OPTIONS,
    };
  });
  const perms = permissions(store, id, RULE_ACTIONS);
  return {
    id,
    rule,
    fields: (): Fields => shape().fields,
    field: (): string | FnCall => shape().field,
    operator: (): string => shape().operator,
    value: () => rule().value as unknown,
    ref: () => rule().ref as string | undefined,
    call: () => rule().call as FnCall | undefined,
    def: (): AnyFieldDef | undefined => shape().def,
    editor: (): EditorSpec => shape().editor,
    operators: (): Option<string>[] => shape().operators,
    fieldOptions: (): FieldOption[] => shape().fieldOptions,
    refOptions: (): Option[] => shape().refOptions,
    functionOptions: (): Option[] => shape().functionOptions,
    /** Where the right side comes from: a literal, another field, or a function. */
    source: (): Source => shape().source,
    locked: perms.locked,
    can: perms.can,
    issues: (): readonly Issue[] => store.issues(rule().id),
    setField: (f: string | FnCall) => store.setField(id, f as never),
    setOperator: (op: string) => store.setOperator(id, op),
    setValue: (value: unknown) => store.setRuleValue(id, value),
    setRef: (ref: string | null) => store.setRef(id, ref),
    setCall: (call: FnCall | null) => store.setCall(id, call),
    setLocked: (locked: boolean) => store.setLocked(id, locked),
    remove: () => void store.requestRemove(id),
    clone: () => void store.clone(id),
  };
}

export function useGroup<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const group = nodeAccessor(store, id) as Accessor<GroupNode>;
  const scope = createMemo<{ parent: NodeId | null; of: string | undefined; arrayFields: FieldOption[] }>((prev) => {
    const g = group();
    if (prev && prev.parent === g.parent && prev.of === g.of?.field) return prev;
    const inner = store.get(id) ? innerFields(store, id) : store.fields;
    return { parent: g.parent, of: g.of?.field, arrayFields: arrayFieldOptions(inner) };
  });
  const perms = permissions(store, id, GROUP_ACTIONS);
  return {
    id,
    group,
    children: (): readonly NodeId[] => group().children,
    combinator: () => group().combinator,
    not: () => group().not,
    of: () => group().of,
    isRoot: () => group().parent === null,
    /** Array fields available for "+ List condition" in this group's scope. */
    arrayFields: (): FieldOption[] => scope().arrayFields,
    locked: perms.locked,
    can: perms.can,
    issues: (): readonly Issue[] => store.issues(group().id),
    setCombinator: (combinator: GroupNode['combinator']) => store.setCombinator(id, combinator),
    setNot: (not: boolean) => store.setNot(id, not),
    setMatch: (match: Quantifier) => store.setMatch(id, match),
    setLocked: (locked: boolean) => store.setLocked(id, locked),
    addRule: (rule?: Parameters<QueryStore<F>['addRule']>[1]) => store.addRule(id, rule),
    addGroup: () => store.addGroup(id),
    addArrayGroup: (field: string, match?: Quantifier) => store.addArrayGroup(id, field, match),
    remove: () => void store.requestRemove(id),
    clone: () => void store.clone(id),
  };
}

/** Fields visible to a group's children (element schema for array groups). */
function innerFields(store: QueryStore<any, any>, id: NodeId): Fields {
  const g = store.getGroup(id);
  const outer = g.parent === null ? store.fields : store.fieldsFor(id);
  return g.of && outer[g.of.field]?.of ? elementFields(outer, g.of.field) : outer;
}

const trackAll = <S>(store: QueryStore<any, any>, read: () => S) => track((fn) => store.subscribe(fn), read);

/** The whole native query. Changes on every edit; use for previews and exports. */
export function useQuery<F extends Fields = Fields>(): Accessor<QueryOf<F>> {
  const store = useStore<F>();
  return trackAll(store, store.getQuery);
}

export function useQueryValue<T = unknown>(): Accessor<T> {
  const store = useStore<Fields, T>();
  return trackAll(store, store.getValue);
}

export function useIsValid(): Accessor<boolean> {
  const store = useStore();
  return trackAll(store, store.isValid);
}

export function useHistory() {
  const store = useStore();
  return { canUndo: trackAll(store, store.canUndo), canRedo: trackAll(store, store.canRedo), undo: store.undo, redo: store.redo };
}

// --- drag and drop -------------------------------------------------------------------------------

export type DropPosition = 'before' | 'after' | 'inside' | null;

/**
 * One subscription to the drag-and-drop controller per builder, fanned out through selectors: a
 * pointer move wakes only the rows whose answer changes (the old and new drop target), not every row.
 * Row handlers are shared too and read the row's id from its `data-qn-id`.
 */
export interface DndChannel {
  dragging: (id: NodeId) => boolean;
  position: (id: NodeId) => DropPosition;
  /** Whether the pointer is over group `id`'s (empty) children area. */
  zone: (id: NodeId) => boolean;
  dragOver: (e: DragEvent, id: NodeId) => void;
  /** `dragOver` for a row carrying `data-qn-id`. */
  rowDragOver: (e: DragEvent) => void;
  drop: (e: DragEvent) => void;
  dragStart: (e: DragEvent, id: NodeId) => void;
  /** `dragStart` for a handle inside a row carrying `data-qn-id`. */
  handleDragStart: (e: DragEvent) => void;
  handleDragEnd: () => void;
  zoneDragOver: (e: DragEvent, groupId: NodeId) => void;
}

const channels = new WeakMap<DndController, DndChannel>();

export function dndChannel({ store, dnd }: QueryContextValue): DndChannel {
  let ch = channels.get(dnd);
  if (ch) return ch;
  // Its own detached root for the controller's lifetime (it holds no DOM, and no component owns it).
  ch = createRoot((_dispose) => {
    const [state, setState] = createSignal<DndState>(dnd.getState());
    dnd.subscribe(() => setState(dnd.getState()));
    const dragging = createSelector(() => state().dragging);
    // The one row that shows an insertion line: the child at the drop index, or the last child
    // when dropping at the end.
    const target = (): { id: NodeId; at: 'before' | 'after' } | null => {
      const over = state().over;
      const g = over && store.get(over.parentId);
      if (!over || g?.kind !== 'group') return null;
      const { children } = g;
      if (over.index < children.length) return { id: children[over.index]!, at: 'before' };
      return over.index === children.length && children.length ? { id: children[children.length - 1]!, at: 'after' } : null;
    };
    const position = createSelector(target, ((id: NodeId, t: ReturnType<typeof target>) => (t && t.id === id ? t.at : null)) as never) as unknown as (id: NodeId) => DropPosition;
    const zone = createSelector(() => state().over?.parentId ?? null);
    const stop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    return {
      dragging,
      position,
      zone: (id) => zone(id) && store.get(id)?.kind === 'group' && store.getGroup(id).children.length === 0,
      dragOver(e, id) {
        const n = store.get(id);
        if (!dnd.getState().dragging || !n || n.parent === null) return;
        stop(e);
        const index = store.getGroup(n.parent).children.indexOf(id);
        dnd.over({ parentId: n.parent, index: dropIndexFromPointer((e.currentTarget as HTMLElement).getBoundingClientRect(), e.clientY, index) });
      },
      rowDragOver: (e) => ch!.dragOver(e, (e.currentTarget as HTMLElement).getAttribute('data-qn-id')!),
      drop(e) {
        stop(e);
        dnd.drop();
      },
      dragStart(e, id) {
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', id);
          const row = (e.currentTarget as HTMLElement).closest('[data-qn-id]');
          if (row) e.dataTransfer.setDragImage(row, 12, 12);
        }
        dnd.start(id);
      },
      handleDragStart: (e) => ch!.dragStart(e, (e.currentTarget as HTMLElement).closest('[data-qn-id]')!.getAttribute('data-qn-id')!),
      handleDragEnd: () => dnd.cancel(),
      zoneDragOver(e, groupId) {
        if (!dnd.getState().dragging) return;
        stop(e);
        dnd.over({ parentId: groupId, index: store.getGroup(groupId).children.length });
      },
    };
  }, null);
  channels.set(dnd, ch);
  return ch;
}

export function useDragHandle(id: NodeId) {
  const ch = dndChannel(useCtx());
  const handleProps = {
    draggable: true,
    onDragStart: (e: DragEvent) => ch.dragStart(e, id),
    onDragEnd: ch.handleDragEnd,
  };
  return { isDragging: (): boolean => ch.dragging(id), handleProps };
}

export function useDropTarget(id: NodeId) {
  const ch = dndChannel(useCtx());
  const dropProps = {
    'data-qn-id': id,
    onDragOver: (e: DragEvent) => ch.dragOver(e, id),
    onDrop: ch.drop,
  };
  return { position: (): DropPosition => ch.position(id), dropProps };
}

export function useGroupDropZone(groupId: NodeId) {
  const ch = dndChannel(useCtx());
  const zoneProps = {
    onDragOver: (e: DragEvent) => ch.zoneDragOver(e, groupId),
    onDrop: ch.drop,
  };
  return { isOver: (): boolean => ch.zone(groupId), zoneProps };
}
