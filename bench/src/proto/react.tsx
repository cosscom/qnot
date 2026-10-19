// Headless React bindings: hooks only, no markup. Any UI kit (MUI, shadcn, plain HTML) renders on top.
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { createQueryStore, type GroupJSON, type GroupNode, type Id, type QNode, type QueryStore, type RuleJSON, type RuleNode } from './core';

export function useQueryStore(initial: GroupJSON | (() => GroupJSON)): QueryStore {
  const [store] = useState(() => createQueryStore(typeof initial === 'function' ? initial() : initial));
  return store;
}

export function useNode<T extends QNode>(store: QueryStore, id: Id): T {
  const subscribe = useCallback((fn: () => void) => store.subscribe(id, fn), [store, id]);
  return useSyncExternalStore(subscribe, () => store.get<T>(id));
}

export function useRule(store: QueryStore, id: Id) {
  const rule = useNode<RuleNode>(store, id);
  const actions = useMemo(
    () => ({
      setField: (field: string) => store.updateRule(id, { field }),
      setOperator: (operator: string) => store.updateRule(id, { operator }),
      setValue: (value: unknown) => store.updateRule(id, { value }),
      remove: () => store.remove(id),
    }),
    [store, id],
  );
  return { rule, ...actions };
}

export function useGroup(store: QueryStore, id: Id) {
  const group = useNode<GroupNode>(store, id);
  const actions = useMemo(
    () => ({
      setCombinator: (combinator: GroupNode['combinator']) => store.updateGroup(id, { combinator }),
      toggleNot: () => store.updateGroup(id, { not: !store.get<GroupNode>(id).not }),
      addRule: (rule: RuleJSON) => store.add(id, rule),
      addGroup: (group: GroupJSON = { combinator: 'and', rules: [] }) => store.add(id, group),
      remove: () => store.remove(id),
    }),
    [store, id],
  );
  return { group, isRoot: id === store.rootId, ...actions };
}

/** Subscribes to every change; use for previews/exports, not inside the tree. */
export function useQueryJSON(store: QueryStore): GroupJSON {
  return useSyncExternalStore(store.subscribeAll, store.toJSON);
}
