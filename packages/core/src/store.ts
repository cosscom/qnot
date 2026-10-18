import { encode, type Format } from './codec';
import type { Fields } from './fields';
import { changeField, changeOperator, coerceValue, makeRule } from './normalize';
import { OPERATORS, type OperatorId } from './operators';
import type { Combinator, Group, Query, QueryNode, QueryOf, Rule, RuleOf } from './types';
import { validateGroup, validateRule, type Issue } from './validate';

export type NodeId = string;

interface NodeMeta {
  readonly id: NodeId;
  /** `null` only for the root group. */
  readonly parent: NodeId | null;
}

/** A rule as held by the store: the typed rule plus its id and parent. */
export type RuleNode<F extends Fields = Fields> = RuleOf<F> & NodeMeta;

export interface GroupNode extends NodeMeta {
  readonly kind: 'group';
  readonly combinator: Combinator;
  readonly not: boolean;
  readonly children: readonly NodeId[];
}

export type StoreNode<F extends Fields = Fields> = RuleNode<F> | GroupNode;

type IRule = Rule & NodeMeta;
type INode = IRule | GroupNode;

export interface HistoryOptions {
  /** Max undo steps kept (default 100). */
  limit?: number;
  /** Consecutive edits to the same value within this window collapse into one step (default 1000 ms). */
  mergeWindowMs?: number;
}

export interface StoreOptions<F extends Fields, T> {
  fields: F;
  /** Starting query, in `format`'s shape when a format is given. Defaults to an empty AND group. */
  initial?: T;
  /** Speak another library's shape through `getValue`/`setValue` (e.g. react-querybuilder's JSON). */
  format?: Format<T>;
  /** Undo/redo (default on). */
  history?: boolean | HistoryOptions;
}

export interface BatchOptions {
  /** Record this change for undo (default true). */
  history?: boolean;
  /** Edits sharing a merge key within the merge window become one undo step. */
  merge?: string;
}

export interface QueryStore<F extends Fields = Fields, T = QueryOf<F>> {
  readonly fields: F;
  readonly rootId: NodeId;
  /** Increments on every committed change. */
  readonly version: number;

  get(id: NodeId): StoreNode<F> | undefined;
  getRule(id: NodeId): RuleNode<F>;
  getGroup(id: NodeId): GroupNode;
  /** Child indexes from the root to `id`. */
  path(id: NodeId): number[];

  /** Calls `fn` when node `id` changes (replaced, re-parented, or removed). */
  subscribe(id: NodeId, fn: () => void): () => void;
  /** Calls `fn` after every committed change. */
  subscribe(fn: () => void): () => void;

  /** Native query, structurally shared: unchanged subtrees keep their object identity. */
  getQuery(): QueryOf<F>;
  /** Subtree under `id` as native JSON. */
  getNodeJSON(id: NodeId): QueryNode;
  /** The query in the store's `format` (the native query when there is no format). */
  getValue(): T;
  /** Load a value in the store's `format`. Reconciles node-by-node, keeping ids of unchanged nodes. */
  setValue(value: T, options?: BatchOptions): void;
  setQuery(query: QueryOf<F>, options?: BatchOptions): void;

  addRule(parentId: NodeId, rule?: Partial<RuleOf<F>> | Partial<Rule>, index?: number): NodeId;
  addGroup(parentId: NodeId, group?: Partial<Pick<Group, 'combinator' | 'not' | 'children'>>, index?: number): NodeId;
  insert(parentId: NodeId, node: QueryNode, index?: number): NodeId;
  remove(id: NodeId): void;
  /** Remove every child of the root group. */
  clear(): void;
  /** Move a node to `index` within `parentId`. Returns false for impossible moves (into itself). */
  move(id: NodeId, parentId: NodeId, index: number): boolean;
  canMove(id: NodeId, parentId: NodeId): boolean;
  clone(id: NodeId): NodeId;

  setField(id: NodeId, field: keyof F & string): void;
  setOperator(id: NodeId, operator: OperatorId): void;
  setRuleValue(id: NodeId, value: unknown): void;
  /** Compare against another field (`ref`), or pass null to go back to a literal value. */
  setRef(id: NodeId, ref: (keyof F & string) | null): void;
  setCombinator(id: NodeId, combinator: Combinator): void;
  setNot(id: NodeId, not: boolean): void;

  /** Run several mutations as one change: one notification and one undo step. */
  batch(fn: () => void, options?: BatchOptions): void;

  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  clearHistory(): void;

  /** Validation issues for one node; stable array identity until that node changes. */
  issues(id: NodeId): readonly Issue[];
  /** True when no node has an error-severity issue. */
  isValid(): boolean;

  dispose(): void;
}

interface Tx {
  before: Map<NodeId, INode | undefined>;
  history: boolean;
  merge: string | undefined;
}

interface Entry {
  before: Map<NodeId, INode | undefined>;
  after: Map<NodeId, INode | undefined>;
  merge: string | undefined;
  time: number;
}

const NO_ISSUES: readonly Issue[] = Object.freeze([]);
const EMPTY_ROOT: Query = { kind: 'group', combinator: 'and', children: [] };

export function createQueryStore<const F extends Fields>(options: StoreOptions<F, QueryOf<F>> & { format?: undefined }): QueryStore<F, QueryOf<F>>;
export function createQueryStore<const F extends Fields, T>(options: StoreOptions<F, T> & { format: Format<T> }): QueryStore<F, T>;
export function createQueryStore<F extends Fields, T>(options: StoreOptions<F, T>): QueryStore<F, T> {
  const { fields, format } = options;
  const historyOpts: Required<HistoryOptions> | null =
    options.history === false ? null : { limit: 100, mergeWindowMs: 1000, ...(typeof options.history === 'object' ? options.history : {}) };

  const nodes = new Map<NodeId, INode>();
  const subs = new Map<NodeId, Set<() => void>>();
  const allSubs = new Set<() => void>();
  const json = new Map<NodeId, QueryNode>();
  const origin = new WeakMap<object, NodeId>();
  const issueCache = new WeakMap<INode, readonly Issue[]>();
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  let tx: Tx | null = null;
  let seq = 0;
  let version = 0;
  let validVersion = -1;
  let valid = true;
  let lastValue: { query: Query; value: T } | null = null;

  // --- low-level writes (recorded in the open transaction) -----------------------------------

  const record = (id: NodeId) => {
    if (tx && !tx.before.has(id)) tx.before.set(id, nodes.get(id));
  };
  const write = (node: INode) => {
    record(node.id);
    nodes.set(node.id, node);
  };
  const erase = (id: NodeId) => {
    const n = nodes.get(id);
    if (!n) return;
    if (n.kind === 'group') n.children.forEach(erase);
    record(id);
    nodes.delete(id);
  };

  const ruleNode = (id: NodeId, parent: NodeId | null, r: Rule): IRule =>
    r.ref !== undefined
      ? { id, parent, kind: 'rule', field: r.field, operator: r.operator, ref: r.ref }
      : OPERATORS[r.operator]?.arity === 'none'
        ? { id, parent, kind: 'rule', field: r.field, operator: r.operator }
        : { id, parent, kind: 'rule', field: r.field, operator: r.operator, value: r.value };

  function create(node: QueryNode, parent: NodeId | null): NodeId {
    const id = (seq++).toString(36);
    if (node.kind === 'rule') write(ruleNode(id, parent, node));
    else {
      write({ id, parent, kind: 'group', combinator: node.combinator, not: !!node.not, children: [] });
      const children = node.children.map((c) => create(c, id));
      nodes.set(id, { ...(nodes.get(id) as GroupNode), children });
    }
    return id;
  }

  const rootId = create(options.initial === undefined ? EMPTY_ROOT : format ? format.decode(options.initial, { fields }) : (options.initial as Query), null);

  const getNode = (id: NodeId) => {
    const n = nodes.get(id);
    if (!n) throw new Error(`trawlnet: no node "${id}"`);
    return n;
  };
  const getGroup = (id: NodeId) => {
    const n = getNode(id);
    if (n.kind !== 'group') throw new Error(`trawlnet: node "${id}" is not a group`);
    return n;
  };
  const getRule = (id: NodeId) => {
    const n = getNode(id);
    if (n.kind !== 'rule') throw new Error(`trawlnet: node "${id}" is not a rule`);
    return n;
  };

  // --- transactions ---------------------------------------------------------------------------

  function batch(fn: () => void, opts: BatchOptions = {}) {
    if (tx) return fn();
    tx = { before: new Map(), history: opts.history ?? true, merge: opts.merge };
    try {
      fn();
    } finally {
      const done = tx;
      tx = null;
      commit(done);
    }
  }

  function invalidate(id: NodeId, n: INode | undefined) {
    let p: NodeId | null | undefined = id;
    let node = n;
    while (p !== null && p !== undefined) {
      json.delete(p);
      p = node ? node.parent : null;
      node = p === null ? undefined : nodes.get(p);
    }
  }

  function commit(done: Tx) {
    const touched = [...done.before.keys()].filter((id) => done.before.get(id) !== nodes.get(id));
    if (!touched.length) return;
    for (const id of touched) {
      invalidate(id, done.before.get(id));
      invalidate(id, nodes.get(id));
    }
    if (historyOpts && done.history) pushHistory(done, touched);
    version++;
    for (const id of touched) subs.get(id)?.forEach((fn) => fn());
    allSubs.forEach((fn) => fn());
  }

  function pushHistory(done: Tx, touched: NodeId[]) {
    const now = Date.now();
    const last = undoStack[undoStack.length - 1];
    redoStack.length = 0;
    if (last && done.merge && last.merge === done.merge && now - last.time < historyOpts!.mergeWindowMs) {
      for (const id of touched) {
        if (!last.before.has(id)) last.before.set(id, done.before.get(id));
        last.after.set(id, nodes.get(id));
      }
      last.time = now;
      return;
    }
    const before = new Map<NodeId, INode | undefined>();
    const after = new Map<NodeId, INode | undefined>();
    for (const id of touched) {
      before.set(id, done.before.get(id));
      after.set(id, nodes.get(id));
    }
    undoStack.push({ before, after, merge: done.merge, time: now });
    if (undoStack.length > historyOpts!.limit) undoStack.shift();
  }

  function applyStates(states: Map<NodeId, INode | undefined>) {
    batch(
      () => {
        for (const [id, n] of states) {
          record(id);
          if (n) nodes.set(id, n);
          else nodes.delete(id);
        }
      },
      { history: false },
    );
  }

  // --- JSON views -----------------------------------------------------------------------------

  function toJSON(id: NodeId): QueryNode {
    const cached = json.get(id);
    if (cached) return cached;
    const n = getNode(id);
    let out: QueryNode;
    if (n.kind === 'rule') {
      out =
        n.ref !== undefined
          ? { kind: 'rule', field: n.field, operator: n.operator, ref: n.ref }
          : 'value' in n
            ? { kind: 'rule', field: n.field, operator: n.operator, value: n.value }
            : { kind: 'rule', field: n.field, operator: n.operator };
    } else {
      out = n.not
        ? { kind: 'group', combinator: n.combinator, not: true, children: n.children.map(toJSON) }
        : { kind: 'group', combinator: n.combinator, children: n.children.map(toJSON) };
    }
    json.set(id, out);
    origin.set(out, id);
    return out;
  }

  // --- reconciliation (controlled mode / setQuery) ----------------------------------------------

  function reconcile(id: NodeId, next: QueryNode, parent: NodeId | null, claimed: Set<NodeId>, orphans: Set<NodeId>) {
    const cur = getNode(id);
    claimed.add(id);
    if (next.kind === 'rule') {
      const r = ruleNode(id, parent, next);
      const c = cur as IRule;
      if (c.kind !== 'rule' || c.parent !== parent || c.field !== r.field || c.operator !== r.operator || c.ref !== r.ref || c.value !== r.value) {
        if (cur.kind === 'group') cur.children.forEach((k) => orphans.add(k));
        write(r);
      }
      return;
    }
    const g = cur as GroupNode;
    const oldChildren = cur.kind === 'group' ? g.children : [];
    const ids: (NodeId | undefined)[] = next.children.map((child) => {
      const known = origin.get(child);
      if (known !== undefined && json.get(known) === child && nodes.has(known) && !claimed.has(known) && known !== rootId) {
        claimed.add(known);
        const k = nodes.get(known)!;
        if (k.parent !== id) write({ ...k, parent: id });
        return known;
      }
      return undefined;
    });
    next.children.forEach((child, i) => {
      if (ids[i] !== undefined) return;
      const candidate = oldChildren[i];
      if (candidate !== undefined && !claimed.has(candidate) && nodes.has(candidate)) {
        reconcile(candidate, child, id, claimed, orphans);
        ids[i] = candidate;
      } else {
        const created = create(child, id);
        claimed.add(created);
        ids[i] = created;
      }
    });
    for (const c of oldChildren) if (!ids.includes(c)) orphans.add(c);
    const children = ids as NodeId[];
    const same =
      cur.kind === 'group' &&
      g.parent === parent &&
      g.combinator === next.combinator &&
      g.not === !!next.not &&
      g.children.length === children.length &&
      g.children.every((c, i) => c === children[i]);
    if (!same) write({ id, parent, kind: 'group', combinator: next.combinator, not: !!next.not, children });
  }

  function setQuery(query: Query, opts?: BatchOptions) {
    if (json.get(rootId) === query) return;
    batch(() => {
      const claimed = new Set<NodeId>();
      const orphans = new Set<NodeId>();
      reconcile(rootId, query, null, claimed, orphans);
      for (const o of orphans) if (!claimed.has(o)) eraseUnclaimed(o, claimed);
    }, opts);
  }

  function eraseUnclaimed(id: NodeId, claimed: Set<NodeId>) {
    const n = nodes.get(id);
    if (!n || claimed.has(id)) return;
    if (n.kind === 'group') n.children.forEach((c) => eraseUnclaimed(c, claimed));
    record(id);
    nodes.delete(id);
  }

  // --- structural edits -----------------------------------------------------------------------

  function insertChild(parentId: NodeId, childId: NodeId, index?: number) {
    const p = getGroup(parentId);
    const children = p.children.slice();
    children.splice(index === undefined ? children.length : Math.max(0, Math.min(index, children.length)), 0, childId);
    write({ ...p, children });
  }

  function isAncestor(maybeAncestor: NodeId, id: NodeId): boolean {
    for (let p: NodeId | null = id; p !== null; p = nodes.get(p)?.parent ?? null) if (p === maybeAncestor) return true;
    return false;
  }

  const updateRule = (id: NodeId, next: Rule, merge?: string) => batch(() => write(ruleNode(id, getRule(id).parent, next)), { merge });

  const store: QueryStore<F, T> = {
    fields,
    rootId,
    get version() {
      return version;
    },

    get: (id) => nodes.get(id) as StoreNode<F> | undefined,
    getRule: (id) => getRule(id) as unknown as RuleNode<F>,
    getGroup,
    path(id) {
      const out: number[] = [];
      for (let n = getNode(id); n.parent !== null; n = getNode(n.parent)) out.unshift(getGroup(n.parent).children.indexOf(n.id));
      return out;
    },

    subscribe(idOrFn: NodeId | (() => void), fn?: () => void) {
      if (typeof idOrFn === 'function') {
        allSubs.add(idOrFn);
        return () => void allSubs.delete(idOrFn);
      }
      let set = subs.get(idOrFn);
      if (!set) subs.set(idOrFn, (set = new Set()));
      set.add(fn!);
      return () => {
        set!.delete(fn!);
        if (!set!.size) subs.delete(idOrFn);
      };
    },

    getQuery: () => toJSON(rootId) as QueryOf<F>,
    getNodeJSON: toJSON,
    getValue() {
      const query = toJSON(rootId) as Query;
      if (!format) return query as T;
      if (lastValue?.query !== query) lastValue = { query, value: encode(format, query, fields) };
      return lastValue.value;
    },
    setValue(value, opts) {
      if (!format) return setQuery(value as Query, opts);
      if (lastValue && lastValue.value === value) return;
      setQuery(format.decode(value, { fields }), opts);
    },
    setQuery: (q, opts) => setQuery(q as Query, opts),

    addRule(parentId, rule, index) {
      let id = '';
      batch(() => {
        id = create(makeRule(fields, rule as Partial<Rule>), parentId);
        insertChild(parentId, id, index);
      });
      return id;
    },
    addGroup(parentId, group = {}, index) {
      return store.insert(parentId, { kind: 'group', combinator: group.combinator ?? 'and', not: group.not ?? false, children: group.children ?? [] }, index);
    },
    insert(parentId, node, index) {
      let id = '';
      batch(() => {
        id = create(node, parentId);
        insertChild(parentId, id, index);
      });
      return id;
    },
    remove(id) {
      const n = getNode(id);
      if (n.parent === null) return store.clear();
      const parent = n.parent;
      batch(() => {
        const p = getGroup(parent);
        write({ ...p, children: p.children.filter((c) => c !== id) });
        erase(id);
      });
    },
    clear() {
      batch(() => {
        const root = getGroup(rootId);
        root.children.forEach(erase);
        write({ ...root, children: [] });
      });
    },
    canMove: (id, parentId) => id !== rootId && nodes.has(id) && nodes.get(parentId)?.kind === 'group' && !isAncestor(id, parentId),
    move(id, parentId, index) {
      if (!store.canMove(id, parentId)) return false;
      const n = getNode(id);
      const from = getGroup(n.parent!);
      const fromIndex = from.children.indexOf(id);
      const target = from.id === parentId && index > fromIndex ? index - 1 : index;
      if (from.id === parentId && target === fromIndex) return true;
      batch(() => {
        write({ ...from, children: from.children.filter((c) => c !== id) });
        write({ ...n, parent: parentId });
        insertChild(parentId, id, target);
      });
      return true;
    },
    clone(id) {
      const n = getNode(id);
      if (n.parent === null) throw new Error('trawlnet: cannot clone the root group');
      const p = getGroup(n.parent);
      return store.insert(p.id, toJSON(id), p.children.indexOf(id) + 1);
    },

    setField: (id, field) => updateRule(id, changeField(fields, toJSON(id) as Rule, field)),
    setOperator: (id, op) => updateRule(id, changeOperator(fields, toJSON(id) as Rule, op)),
    setRuleValue(id, value) {
      const r = getRule(id);
      updateRule(id, { kind: 'rule', field: r.field, operator: r.operator, value }, `value:${id}`);
    },
    setRef(id, ref) {
      const r = getRule(id);
      if (ref === null) {
        updateRule(id, { kind: 'rule', field: r.field, operator: r.operator, value: coerceValue(fields[r.field], r.operator, fields[r.field]?.defaultValue) });
      } else {
        const operator = OPERATORS[r.operator].comparable ? r.operator : 'eq';
        updateRule(id, { kind: 'rule', field: r.field, operator, ref });
      }
    },
    setCombinator: (id, combinator) => batch(() => write({ ...getGroup(id), combinator })),
    setNot: (id, not) => batch(() => write({ ...getGroup(id), not })),

    batch,

    undo() {
      const e = undoStack.pop();
      if (!e) return false;
      applyStates(e.before);
      redoStack.push(e);
      return true;
    },
    redo() {
      const e = redoStack.pop();
      if (!e) return false;
      applyStates(e.after);
      undoStack.push(e);
      return true;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clearHistory() {
      undoStack.length = 0;
      redoStack.length = 0;
    },

    issues(id) {
      const n = nodes.get(id);
      if (!n) return NO_ISSUES;
      let cached = issueCache.get(n);
      if (!cached) {
        const found = n.kind === 'rule' ? validateRule(fields, toJSON(id) as Rule) : validateGroup(toJSON(id) as Group);
        cached = found.length ? Object.freeze(found) : NO_ISSUES;
        issueCache.set(n, cached);
      }
      return cached;
    },
    isValid() {
      if (validVersion !== version) {
        valid = true;
        for (const id of nodes.keys()) if (store.issues(id).some((i) => i.severity === 'error')) valid = false;
        validVersion = version;
      }
      return valid;
    },

    dispose() {
      subs.clear();
      allSubs.clear();
    },
  };
  return store;
}
