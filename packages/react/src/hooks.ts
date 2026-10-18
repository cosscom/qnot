import {
  createDnd,
  createQueryStore,
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
import { createContext, createElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

interface Ctx {
  store: QueryStore<any, any>;
  dnd: DndController;
}

const QueryContext = createContext<Ctx | null>(null);

export function QueryProvider({ store, children }: { store: QueryStore<any, any>; children?: ReactNode }) {
  const value = useMemo(() => ({ store, dnd: createDnd(store) }), [store]);
  return createElement(QueryContext.Provider, { value }, children);
}

function useCtx(): Ctx {
  const ctx = useContext(QueryContext);
  if (!ctx) throw new Error('trawlnet: wrap your components in <QueryProvider store={...}> (or use <QueryBuilder>)');
  return ctx;
}

/** The store from the nearest `<QueryProvider>`. Pass your schema type to get typed results. */
export const useStore = <F extends Fields = Fields, T = QueryOf<F>>(): QueryStore<F, T> => useCtx().store;
export const useDndController = (): DndController => useCtx().dnd;

export interface UseQueryStoreOptions<F extends Fields, T> extends StoreOptions<F, T> {
  /** Controlled value (in `format`'s shape). Passing back what `onChange` gave you costs nothing. */
  value?: T;
  /** Called after every change with the query in `format`'s shape. */
  onChange?: (value: T) => void;
}

/**
 * Create a store for the component's lifetime. Options are read once, except `value` (synced into
 * the store, reconciled node by node) and `onChange` (always the latest callback).
 */
export function useQueryStore<const F extends Fields, T = QueryOf<F>>(options: UseQueryStoreOptions<F, T>): QueryStore<F, T> {
  const [store] = useState(() =>
    createQueryStore({ ...options, initial: options.value !== undefined ? options.value : options.initial } as StoreOptions<F, T> & { format: any }),
  ) as [QueryStore<F, T>, unknown];
  const onChange = useRef(options.onChange);
  onChange.current = options.onChange;

  useLayoutEffect(() => {
    if (options.value !== undefined) store.setValue(options.value);
  }, [store, options.value]);

  useEffect(() => store.subscribe(() => onChange.current?.(store.getValue())), [store]);
  useEffect(() => () => store.dispose(), [store]);
  return store;
}

function useNodeSnapshot(store: QueryStore<any, any>, id: NodeId): StoreNode | undefined {
  // Keep the last snapshot after removal so a child that renders once more before its parent
  // drops it doesn't crash.
  const last = useRef<StoreNode | undefined>(undefined);
  const subscribe = useMemo(() => (fn: () => void) => store.subscribe(id, fn), [store, id]);
  return useSyncExternalStore(subscribe, () => {
    const n = store.get(id);
    if (n) last.current = n;
    return last.current;
  });
}

/** Subscribe to one node. Re-renders only when that node changes. */
export const useNode = <F extends Fields = Fields>(id: NodeId): StoreNode<F> | undefined => useNodeSnapshot(useCtx().store, id) as StoreNode<F> | undefined;

/** A rule's state plus everything needed to render its editors. */
export function useRule<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const rule = useNodeSnapshot(store, id) as RuleNode<F>;
  const def = store.fields[rule.field];
  const editor = useMemo(() => editorFor(def, rule.operator), [def, rule.operator]);
  const operators = useMemo(() => operatorOptions(def), [def]);
  const actions = useMemo(
    () => ({
      setField: (field: keyof F & string) => store.setField(id, field),
      setOperator: (operator: RuleOf<F>['operator']) => store.setOperator(id, operator),
      setValue: (value: unknown) => store.setRuleValue(id, value),
      setRef: (ref: (keyof F & string) | null) => store.setRef(id, ref),
      remove: () => store.remove(id),
      clone: () => store.clone(id),
    }),
    [store, id],
  );
  return { id, rule, def, editor, operators, issues: store.issues(id), ...actions };
}

export function useGroup<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const group = useNodeSnapshot(store, id) as GroupNode;
  const actions = useMemo(
    () => ({
      setCombinator: (combinator: GroupNode['combinator']) => store.setCombinator(id, combinator),
      setNot: (not: boolean) => store.setNot(id, not),
      addRule: (rule?: Partial<RuleOf<F>>) => store.addRule(id, rule),
      addGroup: () => store.addGroup(id),
      remove: () => store.remove(id),
      clone: () => store.clone(id),
    }),
    [store, id],
  );
  return { id, group, isRoot: group.parent === null, issues: store.issues(id), ...actions };
}

const useAll = <S>(store: QueryStore<any, any>, snapshot: () => S): S => useSyncExternalStore(store.subscribe as (fn: () => void) => () => void, snapshot);

/** The whole native query. Re-renders on every change; use for previews and exports. */
export function useQuery<F extends Fields = Fields>(): QueryOf<F> {
  const store = useStore<F>();
  return useAll(store, store.getQuery);
}

/** The query in the store's `format`. */
export function useQueryValue<T = unknown>(): T {
  const store = useStore<Fields, T>();
  return useAll(store, store.getValue);
}

export function useIsValid(): boolean {
  const store = useStore();
  return useAll(store, store.isValid);
}

export function useHistory() {
  const store = useStore();
  const key = useAll(store, () => (store.canUndo() ? 1 : 0) | (store.canRedo() ? 2 : 0));
  return { canUndo: (key & 1) !== 0, canRedo: (key & 2) !== 0, undo: store.undo, redo: store.redo };
}
