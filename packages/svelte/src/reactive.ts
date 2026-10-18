// Rune-friendly helpers: objects whose getters are reactive in any Svelte 5 template, $derived or
// $effect. Each one subscribes only to what it reads (one node, the dnd state, or the whole query).
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

const RULE_ACTIONS = ['editField', 'editOperator', 'editValue', 'remove', 'clone', 'lock'] as const;
const GROUP_ACTIONS = ['addRule', 'addGroup', 'editGroup', 'remove', 'clone', 'lock'] as const;
type RuleAction = (typeof RULE_ACTIONS)[number];
type GroupAction = (typeof GROUP_ACTIONS)[number];

/**
 * What the user may do to a node right now (settings, locks, limits). Follows the permissions
 * channel only, so value edits never re-run it; the record is rebuilt only when an answer flips.
 */
function permissions<A extends Action>(store: QueryStore<any, any>, id: NodeId, actions: readonly A[]) {
  const subscribe = createSubscriber((update) => store.subscribePermissions(update));
  let bits = -1;
  let seen = -1;
  let record = {} as Record<A, boolean>;
  return () => {
    subscribe();
    // Answers only change when the permissions channel fires, which bumps permissionsVersion.
    if (seen === store.permissionsVersion && bits !== -1) return record;
    seen = store.permissionsVersion;
    let b = 0;
    if (store.get(id)) actions.forEach((a, i) => store.can(a, id) && (b |= 1 << i));
    if (b !== bits) {
      bits = b;
      record = Object.fromEntries(actions.map((a, i) => [a, (b & (1 << i)) !== 0])) as Record<A, boolean>;
    }
    return record;
  };
}

/** Reactive store settings: `settings.current` updates when `setSettings` is called. */
export function createSettings(store: QueryStore<any, any>): { readonly current: Readonly<StoreSettings> } {
  const subscribe = createSubscriber((update) => store.subscribePermissions(update));
  return {
    get current() {
      subscribe();
      return store.settings;
    },
  };
}

/** Memoize `compute` on the identity of its inputs. */
function memo<K extends readonly unknown[], V>(compute: (...k: K) => V) {
  let keys: K | undefined;
  let value: V;
  return (...k: K): V => {
    if (!keys || k.length !== keys.length || k.some((x, i) => x !== keys![i])) {
      keys = k;
      value = compute(...k);
    }
    return value;
  };
}

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

/** A rule's reactive state plus everything needed to render its editors. */
export function createRule<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId): RuleState<F> {
  const node = createNode(store, id);
  const settings = createSettings(store);
  const can = permissions(store, id, RULE_ACTIONS);
  const scope = memo((_parent: NodeId | null) => (store.get(id) ? store.fieldsFor(id) : (store.fields as Fields)));
  const editorOf = memo((def: AnyFieldDef | undefined, op: string, fields: Fields) => editorFor(def, op, fields));
  const opsOf = memo((def: AnyFieldDef | undefined, fields: Fields) => operatorOptions(def, fields));
  const fieldsOf = memo((fields: Fields) => fieldOptions(fields).filter((o) => !o.isArray));
  const refsOf = memo((fields: Fields, field: string | FnCall, def: AnyFieldDef | undefined, allowsRef: boolean, allow: boolean | undefined) =>
    allowsRef && allow !== false && typeof field === 'string' ? refOptions(fields, field, def?.kind) : [],
  );
  const fnsOf = memo((fields: Fields, def: AnyFieldDef | undefined, allowsRef: boolean, allow: boolean | undefined) =>
    allowsRef && allow !== false ? functionOptions(fields, def?.kind) : [],
  );
  const lockedSub = createSubscriber((update) => store.subscribePermissions(update));
  const rule = () => node.current as RuleNode<F>;
  const fields = () => scope(rule().parent);
  const def = () => leftDef(fields(), rule().field as string | FnCall);
  const editor = () => editorOf(def(), rule().operator, fields());
  return {
    id,
    get rule() {
      return rule();
    },
    get fields() {
      return fields();
    },
    get def() {
      return def();
    },
    get editor() {
      return editor();
    },
    get operators() {
      return opsOf(def(), fields());
    },
    get fieldOptions() {
      return fieldsOf(fields());
    },
    get refOptions() {
      return refsOf(fields(), rule().field as string | FnCall, def(), editor().allowsRef, settings.current.allowRefs);
    },
    get functionOptions() {
      return fnsOf(fields(), def(), editor().allowsRef, settings.current.allowFunctions);
    },
    get source() {
      const r = rule();
      return r.ref !== undefined ? 'field' : r.call !== undefined ? 'function' : 'value';
    },
    get locked() {
      lockedSub();
      return store.isLocked(id);
    },
    get can() {
      return can();
    },
    get issues() {
      node.current;
      return store.issues(id);
    },
    setField: (field) => store.setField(id, field as never),
    setOperator: (operator) => store.setOperator(id, operator),
    setValue: (value) => store.setRuleValue(id, value),
    setRef: (ref) => store.setRef(id, ref),
    setCall: (call) => store.setCall(id, call),
    setLocked: (locked) => store.setLocked(id, locked),
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

export function createGroup<F extends Fields = Fields>(store: QueryStore<F, any>, id: NodeId) {
  const node = createNode(store, id);
  const can = permissions(store, id, GROUP_ACTIONS);
  const lockedSub = createSubscriber((update) => store.subscribePermissions(update));
  const arrays = memo((_parent: NodeId | null, _of: string | undefined) => (store.get(id) ? fieldOptions(innerFields(store, id)).filter((o) => o.isArray) : []));
  const group = () => node.current as GroupNode;
  return {
    id,
    get group() {
      return group();
    },
    get isRoot() {
      return group().parent === null;
    },
    /** Array fields available for "+ List condition" in this group's scope. */
    get arrayFields(): FieldOption[] {
      return arrays(group().parent, group().of?.field);
    },
    get locked() {
      lockedSub();
      return store.isLocked(id);
    },
    get can(): Record<GroupAction, boolean> {
      return can();
    },
    get issues() {
      node.current;
      return store.issues(id);
    },
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
