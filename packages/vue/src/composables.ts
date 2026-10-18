import {
  createDnd,
  createQueryStore,
  dropIndexFromPointer,
  editorFor,
  operatorOptions,
  type DndController,
  type Fields,
  type GroupNode,
  type NodeId,
  type QueryOf,
  type QueryStore,
  type RuleNode,
  type RuleOf,
  type StoreNode,
  type StoreOptions,
} from '@trawlnet/core';
import { computed, inject, onScopeDispose, provide, shallowRef, toValue, watch, type InjectionKey, type MaybeRefOrGetter, type ShallowRef } from 'vue';

interface Ctx {
  store: QueryStore<any, any>;
  dnd: DndController;
}

const KEY: InjectionKey<Ctx> = Symbol('trawlnet');

/** Make `store` available to descendants' composables. Call in a parent component's setup. */
export function provideQueryStore(store: QueryStore<any, any>): void {
  provide(KEY, { store, dnd: createDnd(store) });
}

function useCtx(): Ctx {
  const ctx = inject(KEY, null);
  if (!ctx) throw new Error('trawlnet: call provideQueryStore(store) in an ancestor (or use <QueryBuilder>)');
  return ctx;
}

export const useStore = <F extends Fields = Fields, T = QueryOf<F>>(): QueryStore<F, T> => useCtx().store;
export const useDndController = (): DndController => useCtx().dnd;

export interface UseQueryStoreOptions<F extends Fields, T> extends StoreOptions<F, T> {
  /** Controlled value (ref, getter or plain), synced into the store node by node. */
  value?: MaybeRefOrGetter<T | undefined>;
  /** Called after every change with the query in `format`'s shape. */
  onChange?: (value: T) => void;
}

/** Create a store owned by the current effect scope (component). */
export function useQueryStore<const F extends Fields, T = QueryOf<F>>(options: UseQueryStoreOptions<F, T>): QueryStore<F, T> {
  const initialValue = toValue(options.value);
  const store = createQueryStore({ ...options, initial: initialValue !== undefined ? initialValue : options.initial } as StoreOptions<F, T> & { format: any }) as QueryStore<F, T>;
  if (options.value !== undefined) {
    watch(
      () => toValue(options.value),
      (v) => {
        if (v !== undefined) store.setValue(v);
      },
      { flush: 'sync' },
    );
  }
  const unsub = store.subscribe(() => options.onChange?.(store.getValue()));
  onScopeDispose(() => {
    unsub();
    store.dispose();
  });
  return store;
}

/** A shallow ref that follows a store subscription and unsubscribes with the scope. */
function track<S>(subscribe: (fn: () => void) => () => void, read: () => S): Readonly<ShallowRef<S>> {
  const ref = shallowRef(read());
  onScopeDispose(subscribe(() => (ref.value = read())));
  return ref;
}

function nodeRef(store: QueryStore<any, any>, id: NodeId): Readonly<ShallowRef<StoreNode>> {
  // Keep the last snapshot after removal so a child rendering once more before its parent drops it doesn't crash.
  let last = store.get(id)!;
  return track(
    (fn) => store.subscribe(id, fn),
    () => (last = store.get(id) ?? last),
  );
}

/** Subscribe to one node; the ref changes only when that node does. */
export const useNode = <F extends Fields = Fields>(id: NodeId) => nodeRef(useCtx().store, id) as Readonly<ShallowRef<StoreNode<F>>>;

/** A rule's state plus everything needed to render its editors. */
export function useRule<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const rule = nodeRef(store, id) as Readonly<ShallowRef<RuleNode<F>>>;
  const def = computed(() => store.fields[rule.value.field]);
  return {
    id,
    rule,
    def,
    editor: computed(() => editorFor(def.value, rule.value.operator)),
    operators: computed(() => operatorOptions(def.value)),
    issues: computed(() => store.issues(rule.value.id)),
    setField: (field: keyof F & string) => store.setField(id, field),
    setOperator: (operator: RuleOf<F>['operator']) => store.setOperator(id, operator),
    setValue: (value: unknown) => store.setRuleValue(id, value),
    setRef: (ref: (keyof F & string) | null) => store.setRef(id, ref),
    remove: () => store.remove(id),
    clone: () => store.clone(id),
  };
}

export function useGroup<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const group = nodeRef(store, id) as Readonly<ShallowRef<GroupNode>>;
  return {
    id,
    group,
    isRoot: computed(() => group.value.parent === null),
    issues: computed(() => store.issues(group.value.id)),
    setCombinator: (combinator: GroupNode['combinator']) => store.setCombinator(id, combinator),
    setNot: (not: boolean) => store.setNot(id, not),
    addRule: (rule?: Partial<RuleOf<F>>) => store.addRule(id, rule),
    addGroup: () => store.addGroup(id),
    remove: () => store.remove(id),
    clone: () => store.clone(id),
  };
}

const trackAll = <S>(store: QueryStore<any, any>, read: () => S) => track((fn) => store.subscribe(fn), read);

/** The whole native query. Changes on every edit; use for previews and exports. */
export function useQuery<F extends Fields = Fields>(): Readonly<ShallowRef<QueryOf<F>>> {
  const store = useStore<F>();
  return trackAll(store, store.getQuery);
}

export function useQueryValue<T = unknown>(): Readonly<ShallowRef<T>> {
  const store = useStore<Fields, T>();
  return trackAll(store, store.getValue);
}

export function useIsValid(): Readonly<ShallowRef<boolean>> {
  const store = useStore();
  return trackAll(store, store.isValid);
}

export function useHistory() {
  const store = useStore();
  const canUndo = trackAll(store, store.canUndo);
  const canRedo = trackAll(store, store.canRedo);
  return { canUndo, canRedo, undo: store.undo, redo: store.redo };
}

// --- drag and drop -------------------------------------------------------------------------------

export type DropPosition = 'before' | 'after' | 'inside' | null;

export function useDragHandle(id: NodeId) {
  const dnd = useDndController();
  const isDragging = track(dnd.subscribe, () => dnd.getState().dragging === id);
  const handleProps = {
    draggable: true,
    onDragstart(e: DragEvent) {
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        const row = (e.currentTarget as HTMLElement).closest('[data-tn-id]');
        if (row) e.dataTransfer.setDragImage(row, 12, 12);
      }
      dnd.start(id);
    },
    onDragend: () => dnd.cancel(),
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
    onDragover(e: DragEvent) {
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
    onDragover(e: DragEvent) {
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
