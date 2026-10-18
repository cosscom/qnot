// Fine-grained Solid primitives: each accessor is backed by a signal fed from one store
// subscription, so a keystroke updates exactly the DOM bound to that rule's value.
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
  type DndController,
  type FieldOption,
  type Fields,
  type FnCall,
  type GroupNode,
  type NodeId,
  type Option,
  type Quantifier,
  type QueryOf,
  type QueryStore,
  type RuleNode,
  type StoreNode,
  type StoreOptions,
  type StoreSettings,
} from '@trawlnet/core';
import { createContext, createMemo, createRenderEffect, createSignal, on, onCleanup, useContext, type Accessor } from 'solid-js';

export interface QueryContextValue {
  store: QueryStore<any, any>;
  dnd: DndController;
}

export const QueryContext = createContext<QueryContextValue>();

export const makeContextValue = (store: QueryStore<any, any>): QueryContextValue => ({ store, dnd: createDnd(store) });

function useCtx(): QueryContextValue {
  const ctx = useContext(QueryContext);
  if (!ctx) throw new Error('trawlnet: wrap your components in <QueryProvider store={...}> (or use <QueryBuilder>)');
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

function nodeAccessor(store: QueryStore<any, any>, id: NodeId): Accessor<StoreNode> {
  // Keep the last snapshot after removal so a child updating once more before its parent drops it doesn't crash.
  let last = store.get(id)!;
  return track(
    (fn) => store.subscribe(id, fn),
    () => (last = store.get(id) ?? last),
  );
}

export const useNode = <F extends Fields = Fields>(id: NodeId) => nodeAccessor(useCtx().store, id) as Accessor<StoreNode<F>>;

const RULE_ACTIONS = ['editField', 'editOperator', 'editValue', 'remove', 'clone', 'lock'] as const;
const GROUP_ACTIONS = ['addRule', 'addGroup', 'editGroup', 'remove', 'clone', 'lock'] as const;

/**
 * What the user may do to a node right now (settings, locks, limits). Follows the permissions
 * channel only, as a bitmask signal, so value edits never re-run it and dependents update only
 * when an answer flips.
 */
function permissions<A extends Action>(store: QueryStore<any, any>, id: NodeId, actions: readonly A[]): Accessor<Record<A, boolean>> {
  const bits = track(store.subscribePermissions, () => {
    let b = 0;
    if (store.get(id)) actions.forEach((a, i) => store.can(a, id) && (b |= 1 << i));
    return b;
  });
  return createMemo(() => Object.fromEntries(actions.map((a, i) => [a, (bits() & (1 << i)) !== 0])) as Record<A, boolean>);
}

/** Current store settings; updates when `setSettings` is called. */
export function useSettings(): Accessor<Readonly<StoreSettings>> {
  const store = useStore();
  return track(store.subscribePermissions, () => store.settings);
}

/** A rule's fine-grained state plus everything needed to render its editors. */
export function useRule<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const rule = nodeAccessor(store, id) as Accessor<RuleNode<F>>;
  const settings = track(store.subscribePermissions, () => store.settings);
  const parent = createMemo(() => rule().parent);
  // The schema in scope: the array's element fields inside array groups.
  const fields = createMemo(() => {
    parent();
    return store.get(id) ? store.fieldsFor(id) : store.fields;
  });
  const field = createMemo(() => rule().field as string | FnCall);
  const operator = createMemo(() => rule().operator);
  const def = createMemo(() => leftDef(fields(), field()));
  const editor = createMemo(() => editorFor(def(), operator(), fields()));
  return {
    id,
    rule,
    fields,
    field,
    operator,
    value: () => rule().value as unknown,
    ref: () => rule().ref as string | undefined,
    call: () => rule().call as FnCall | undefined,
    def,
    editor,
    operators: createMemo(() => operatorOptions(def(), fields())),
    fieldOptions: createMemo<FieldOption[]>(() => fieldOptions(fields()).filter((o) => !o.isArray)),
    refOptions: createMemo<Option[]>(() => {
      const f = field();
      return editor().allowsRef && settings().allowRefs !== false && typeof f === 'string' ? refOptions(fields(), f, def()?.kind) : [];
    }),
    functionOptions: createMemo<Option[]>(() => (editor().allowsRef && settings().allowFunctions !== false ? functionOptions(fields(), def()?.kind) : [])),
    /** Where the right side comes from: a literal, another field, or a function. */
    source: createMemo<'value' | 'field' | 'function'>(() => (rule().ref !== undefined ? 'field' : rule().call !== undefined ? 'function' : 'value')),
    locked: track(store.subscribePermissions, () => store.isLocked(id)),
    can: permissions(store, id, RULE_ACTIONS),
    issues: createMemo(() => store.issues(rule().id)),
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
  const scope = createMemo(() => `${group().parent}|${group().of?.field}`);
  const inner = createMemo(() => {
    scope();
    return store.get(id) ? innerFields(store, id) : store.fields;
  });
  return {
    id,
    group,
    children: createMemo(() => group().children),
    combinator: () => group().combinator,
    not: () => group().not,
    of: () => group().of,
    isRoot: () => group().parent === null,
    /** Array fields available for "+ List condition" in this group's scope. */
    arrayFields: createMemo<FieldOption[]>(() => fieldOptions(inner()).filter((o) => o.isArray)),
    locked: track(store.subscribePermissions, () => store.isLocked(id)),
    can: permissions(store, id, GROUP_ACTIONS),
    issues: createMemo(() => store.issues(group().id)),
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

export function useDragHandle(id: NodeId) {
  const dnd = useDndController();
  const isDragging = track(dnd.subscribe, () => dnd.getState().dragging === id);
  const handleProps = {
    draggable: true,
    onDragStart(e: DragEvent) {
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        const row = (e.currentTarget as HTMLElement).closest('[data-tn-id]');
        if (row) e.dataTransfer.setDragImage(row, 12, 12);
      }
      dnd.start(id);
    },
    onDragEnd: () => dnd.cancel(),
  };
  return { isDragging, handleProps };
}

export function useDropTarget(id: NodeId) {
  const store = useStore();
  const dnd = useDndController();
  const position = track(dnd.subscribe, (): DropPosition => {
    const over = dnd.getState().over;
    const n = over && store.get(id);
    if (!over || !n || n.parent !== over.parentId) return null;
    const siblings = store.getGroup(n.parent).children;
    const index = siblings.indexOf(id);
    if (over.index === index) return 'before';
    if (over.index === index + 1 && index === siblings.length - 1) return 'after';
    return null;
  });
  const dropProps = {
    'data-tn-id': id,
    onDragOver(e: DragEvent) {
      const n = store.get(id);
      if (!dnd.getState().dragging || !n || n.parent === null) return;
      e.preventDefault();
      e.stopPropagation();
      const index = store.getGroup(n.parent).children.indexOf(id);
      dnd.over({ parentId: n.parent, index: dropIndexFromPointer((e.currentTarget as HTMLElement).getBoundingClientRect(), e.clientY, index) });
    },
    onDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      dnd.drop();
    },
  };
  return { position, dropProps };
}

export function useGroupDropZone(groupId: NodeId) {
  const store = useStore();
  const dnd = useDndController();
  const isOver = track(dnd.subscribe, () => {
    const over = dnd.getState().over;
    return over?.parentId === groupId && store.get(groupId)?.kind === 'group' && store.getGroup(groupId).children.length === 0;
  });
  const zoneProps = {
    onDragOver(e: DragEvent) {
      if (!dnd.getState().dragging) return;
      e.preventDefault();
      e.stopPropagation();
      dnd.over({ parentId: groupId, index: store.getGroup(groupId).children.length });
    },
    onDrop(e: DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      dnd.drop();
    },
  };
  return { isOver, zoneProps };
}
