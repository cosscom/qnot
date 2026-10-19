import {
  createDnd,
  createQueryStore,
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
} from '@qnot/core';
import { createContext, createElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSync } from './sync';

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
  if (!ctx) throw new Error('qnot: wrap your components in <QueryProvider store={...}> (or use <QueryBuilder>)');
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
 * the store, reconciled node by node), `onChange` (always the latest callback) and `settings`
 * (applied when the object changes).
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
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) first.current = false;
    else if (options.settings) store.setSettings(options.settings);
  }, [store, options.settings]);

  useEffect(() => store.subscribe(() => onChange.current?.(store.getValue())), [store]);
  useEffect(() => () => store.dispose(), [store]);
  return store;
}

function useNodeSnapshot(store: QueryStore<any, any>, id: NodeId): StoreNode | undefined {
  // Keep the last snapshot after removal so a child that renders once more before its parent
  // drops it doesn't crash.
  const last = useRef<StoreNode | undefined>(undefined);
  const subscribe = useMemo(() => (fn: () => void) => store.subscribe(id, fn), [store, id]);
  return useSync(subscribe, () => {
    const n = store.get(id);
    if (n) last.current = n;
    return last.current;
  });
}

/** Subscribe to one node. Re-renders only when that node changes. */
export const useNode = <F extends Fields = Fields>(id: NodeId): StoreNode<F> | undefined => useNodeSnapshot(useCtx().store, id) as StoreNode<F> | undefined;

/**
 * What the user may do to a node right now (settings, locks, limits), as a bitmask snapshot so
 * components re-render only when an answer flips. Value edits never trigger it.
 */
function usePermissions<A extends Action>(store: QueryStore<any, any>, id: NodeId, actions: readonly A[]): Record<A, boolean> {
  const bits = useSync(store.subscribePermissions, () => {
    let b = 0;
    if (store.get(id)) actions.forEach((a, i) => store.can(a, id) && (b |= 1 << i));
    return b;
  });
  return useMemo(() => Object.fromEntries(actions.map((a, i) => [a, (bits & (1 << i)) !== 0])) as Record<A, boolean>, [bits, actions]);
}

const RULE_ACTIONS = ['editField', 'editOperator', 'editValue', 'remove', 'clone', 'lock'] as const;
const GROUP_ACTIONS = ['addRule', 'addGroup', 'editGroup', 'remove', 'clone', 'lock'] as const;

/** A rule's state plus everything needed to render its editors. */
export function useRule<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const rule = useNodeSnapshot(store, id) as RuleNode<F>;
  // The schema in scope: the array's element fields inside array groups.
  const fields = useMemo(() => (store.get(id) ? store.fieldsFor(id) : store.fields), [store, id, rule.parent]);
  const def = leftDef(fields, rule.field);
  const editor = useMemo(() => editorFor(def, rule.operator, fields), [def, rule.operator, fields]);
  const operators = useMemo(() => operatorOptions(def, fields), [def, fields]);
  const fieldChoices = useMemo<FieldOption[]>(() => fieldOptions(fields).filter((o) => !o.isArray), [fields]);
  // Settings that change which sources are offered; read through the permissions channel so they
  // update live without subscribing rows to every edit.
  const sources = useSync(store.subscribePermissions, () => (store.settings.allowRefs !== false ? 1 : 0) | (store.settings.allowFunctions !== false ? 2 : 0));
  const refs = useMemo<Option[]>(
    () => (editor.allowsRef && sources & 1 && typeof rule.field === 'string' ? refOptions(fields, rule.field, def?.kind) : []),
    [fields, editor.allowsRef, rule.field, def, sources],
  );
  const functions = useMemo<Option[]>(() => (editor.allowsRef && sources & 2 ? functionOptions(fields, def?.kind) : []), [fields, editor.allowsRef, def, sources]);
  const can = usePermissions(store, id, RULE_ACTIONS);
  const actions = useMemo(
    () => ({
      setField: (field: string | FnCall) => store.setField(id, field as never),
      setOperator: (operator: string) => store.setOperator(id, operator),
      setValue: (value: unknown) => store.setRuleValue(id, value),
      setRef: (ref: string | null) => store.setRef(id, ref),
      setCall: (call: FnCall | null) => store.setCall(id, call),
      setLocked: (locked: boolean) => store.setLocked(id, locked),
      remove: () => void store.requestRemove(id),
      clone: () => store.clone(id),
    }),
    [store, id],
  );
  /** Where the right side comes from: a literal, another field, or a function. */
  const source: 'value' | 'field' | 'function' = rule.ref !== undefined ? 'field' : rule.call !== undefined ? 'function' : 'value';
  return {
    id,
    rule,
    fields,
    def,
    editor,
    operators,
    fieldOptions: fieldChoices,
    refOptions: refs,
    functionOptions: functions,
    source,
    locked: store.isLocked(id),
    can,
    issues: store.issues(id),
    ...actions,
  };
}

export function useGroup<F extends Fields = Fields>(id: NodeId) {
  const store = useStore<F>();
  const group = useNodeSnapshot(store, id) as GroupNode;
  const can = usePermissions(store, id, GROUP_ACTIONS);
  const inner = useMemo(() => (store.get(id) ? innerFields(store, id) : store.fields), [store, id, group.of, group.parent]);
  const arrayFields = useMemo<FieldOption[]>(() => fieldOptions(inner).filter((o) => o.isArray), [inner]);
  const actions = useMemo(
    () => ({
      setCombinator: (combinator: GroupNode['combinator']) => store.setCombinator(id, combinator),
      setNot: (not: boolean) => store.setNot(id, not),
      setMatch: (match: Quantifier) => store.setMatch(id, match),
      setLocked: (locked: boolean) => store.setLocked(id, locked),
      addRule: (rule?: Parameters<QueryStore<F>['addRule']>[1]) => store.addRule(id, rule),
      addGroup: () => store.addGroup(id),
      addArrayGroup: (field: string, match?: Quantifier) => store.addArrayGroup(id, field, match),
      remove: () => void store.requestRemove(id),
      clone: () => store.clone(id),
    }),
    [store, id],
  );
  return {
    id,
    group,
    isRoot: group.parent === null,
    /** Array fields available for "+ List condition" in this group's scope. */
    arrayFields,
    locked: store.isLocked(id),
    can,
    issues: store.issues(id),
    ...actions,
  };
}

/** Fields visible to a group's children (element schema for array groups). */
function innerFields(store: QueryStore<any, any>, id: NodeId): Fields {
  const g = store.getGroup(id);
  const outer = g.parent === null ? store.fields : store.fieldsFor(id);
  return g.of && outer[g.of.field]?.of ? elementFields(outer, g.of.field) : outer;
}

const useAll = <S>(store: QueryStore<any, any>, snapshot: () => S): S => useSync(store.subscribe as (fn: () => void) => () => void, snapshot);

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

/** Current store settings, re-rendering when they change. */
export function useSettings() {
  const store = useStore();
  return useSync(store.subscribePermissions, () => store.settings);
}
