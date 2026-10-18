// Rune-friendly helpers: objects whose getters are reactive in any Svelte 5 template, $derived or
// $effect. Each one subscribes only to what it reads (one node, the dnd state, or the whole query).
import {
  createDnd,
  dropIndexFromPointer,
  editorFor,
  operatorOptions,
  type DndController,
  type EditorSpec,
  type Fields,
  type GroupNode,
  type Issue,
  type NodeId,
  type Option,
  type OperatorId,
  type QueryOf,
  type QueryStore,
  type RuleNode,
  type RuleOf,
  type StoreNode,
} from '@trawlnet/core';
import { getContext, setContext } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';

interface Ctx {
  store: QueryStore<any, any>;
  dnd: DndController;
}

const KEY = Symbol('trawlnet');

/** Make `store` available to descendant components. Call during component initialisation. */
export function setQueryStore(store: QueryStore<any, any>): void {
  setContext<Ctx>(KEY, { store, dnd: createDnd(store) });
}

function ctx(): Ctx {
  const c = getContext<Ctx | undefined>(KEY);
  if (!c) throw new Error('trawlnet: call setQueryStore(store) in an ancestor (or use <QueryBuilder>)');
  return c;
}

export const getQueryStore = <F extends Fields = Fields, T = QueryOf<F>>(): QueryStore<F, T> => ctx().store;
export const getDndController = (): DndController => ctx().dnd;

/** A reactive view of one node: `node.current` re-runs dependents only when that node changes. */
export function createNode<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId): { readonly current: StoreNode<F> } {
  let last = store.get(id)!;
  const subscribe = createSubscriber((update) => store.subscribe(id, update));
  return {
    get current() {
      subscribe();
      return (last = store.get(id) ?? last);
    },
  };
}

export interface RuleState<F extends Fields> {
  readonly id: NodeId;
  readonly rule: RuleNode<F>;
  readonly def: F[keyof F] | undefined;
  readonly editor: EditorSpec;
  readonly operators: Option<OperatorId>[];
  readonly issues: readonly Issue[];
  setField(field: keyof F & string): void;
  setOperator(operator: RuleOf<F>['operator']): void;
  setValue(value: unknown): void;
  setRef(ref: (keyof F & string) | null): void;
  remove(): void;
  clone(): void;
}

/** A rule's reactive state plus everything needed to render its editors. */
export function createRule<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId): RuleState<F> {
  const node = createNode(store, id);
  let editorKey: unknown;
  let editor: EditorSpec;
  let opsDef: unknown = null;
  let ops: Option<OperatorId>[] = [];
  return {
    id,
    get rule() {
      return node.current as RuleNode<F>;
    },
    get def() {
      return store.fields[(node.current as RuleNode<F>).field] as F[keyof F] | undefined;
    },
    get editor() {
      const r = node.current as RuleNode<F>;
      const def = store.fields[r.field];
      // Same spec object while field and operator are unchanged, so {#key}/$derived stay stable.
      if (editorKey !== `${r.field}|${r.operator}`) {
        editorKey = `${r.field}|${r.operator}`;
        editor = editorFor(def, r.operator);
      }
      return editor;
    },
    get operators() {
      const def = store.fields[(node.current as RuleNode<F>).field];
      if (def !== opsDef) {
        opsDef = def;
        ops = operatorOptions(def);
      }
      return ops;
    },
    get issues() {
      node.current;
      return store.issues(id);
    },
    setField: (field) => store.setField(id, field),
    setOperator: (operator) => store.setOperator(id, operator),
    setValue: (value) => store.setRuleValue(id, value),
    setRef: (ref) => store.setRef(id, ref),
    remove: () => store.remove(id),
    clone: () => void store.clone(id),
  };
}

export function createGroup<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId) {
  const node = createNode(store, id);
  return {
    id,
    get group() {
      return node.current as GroupNode;
    },
    get isRoot() {
      return (node.current as GroupNode).parent === null;
    },
    get issues() {
      node.current;
      return store.issues(id);
    },
    setCombinator: (combinator: GroupNode['combinator']) => store.setCombinator(id, combinator),
    setNot: (not: boolean) => store.setNot(id, not),
    addRule: (rule?: Partial<RuleOf<F>>) => store.addRule(id, rule),
    addGroup: () => store.addGroup(id),
    remove: () => store.remove(id),
    clone: () => store.clone(id),
  };
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

const dndValue = <S>(dnd: DndController, read: () => S) => {
  const subscribe = createSubscriber((update) => dnd.subscribe(update));
  return () => {
    subscribe();
    return read();
  };
};

/** `handleProps` spreads onto the grab handle: `<span {...drag.handleProps}>`. */
export function createDragHandle(dnd: DndController, id: NodeId) {
  const dragging = dndValue(dnd, () => dnd.getState().dragging === id);
  return {
    get isDragging() {
      return dragging();
    },
    handleProps: {
      draggable: true,
      ondragstart(e: DragEvent) {
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', id);
          const row = (e.currentTarget as HTMLElement).closest('[data-tn-id]');
          if (row) e.dataTransfer.setDragImage(row, 12, 12);
        }
        dnd.start(id);
      },
      ondragend: () => dnd.cancel(),
    },
  };
}

export function createDropTarget(store: QueryStore<any, any>, dnd: DndController, id: NodeId) {
  const position = dndValue(dnd, (): DropPosition => {
    const over = dnd.getState().over;
    const n = over && store.get(id);
    if (!over || !n || n.parent !== over.parentId) return null;
    const siblings = store.getGroup(n.parent).children;
    const index = siblings.indexOf(id);
    if (over.index === index) return 'before';
    if (over.index === index + 1 && index === siblings.length - 1) return 'after';
    return null;
  });
  return {
    get position() {
      return position();
    },
    dropProps: {
      'data-tn-id': id,
      ondragover(e: DragEvent) {
        const n = store.get(id);
        if (!dnd.getState().dragging || !n || n.parent === null) return;
        e.preventDefault();
        e.stopPropagation();
        const index = store.getGroup(n.parent).children.indexOf(id);
        dnd.over({ parentId: n.parent, index: dropIndexFromPointer((e.currentTarget as HTMLElement).getBoundingClientRect(), e.clientY, index) });
      },
      ondrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dnd.drop();
      },
    },
  };
}

export function createGroupDropZone(store: QueryStore<any, any>, dnd: DndController, groupId: NodeId) {
  const isOver = dndValue(dnd, () => {
    const over = dnd.getState().over;
    return over?.parentId === groupId && store.get(groupId)?.kind === 'group' && store.getGroup(groupId).children.length === 0;
  });
  return {
    get isOver() {
      return isOver();
    },
    zoneProps: {
      ondragover(e: DragEvent) {
        if (!dnd.getState().dragging) return;
        e.preventDefault();
        e.stopPropagation();
        dnd.over({ parentId: groupId, index: store.getGroup(groupId).children.length });
      },
      ondrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dnd.drop();
      },
    },
  };
}
