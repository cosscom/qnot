import { encode, type Format } from './codec';
import { warnMissingRegistry, type Fields } from './fields';
import type { FnCall } from './functions';
import { changeField, changeOperator, coerceValue, makeRule, type ChangeOptions } from './normalize';
import { operatorInfo } from './operators';
import { sanitizeQuery, type SanitizeOptions } from './sanitize';
import { elementFields, leftDef } from './scope';
import type { AnyFieldName, ArrayScope, Combinator, Group, Quantifier, Query, QueryNode, QueryOf, Rule, RuleOf } from './types';
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
  readonly of?: ArrayScope;
  readonly locked?: boolean;
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

/** Behaviour switches, mirroring RAQB's `settings`. All optional; defaults allow everything. */
export interface StoreSettings extends ChangeOptions {
  /** Nothing can be edited (RAQB immutable*Mode all on). */
  readOnly?: boolean;
  /** Finer-grained immutability: structure, fields, operators, values. */
  immutable?: { groups?: boolean; fields?: boolean; operators?: boolean; values?: boolean };
  /** Deepest allowed group nesting below the root (RAQB maxNesting - 1). */
  maxDepth?: number;
  /** Most rules allowed in the whole query (RAQB maxNumberOfRules). */
  maxRules?: number;
  /** Allow moving nodes within their group (default true). */
  canReorder?: boolean;
  /** Allow moving nodes into another group (default true). */
  canRegroup?: boolean;
  /** Allow removing locked nodes (default false). */
  canDeleteLocked?: boolean;
  /** Removing a group's last child removes the group too when false (default true). */
  canLeaveEmptyGroup?: boolean;
  /** New groups start empty instead of with one rule (default false, like RAQB). */
  emptyNewGroups?: boolean;
  /** Field-to-field comparisons (default true). RAQB canCompareFieldWithField. */
  allowRefs?: boolean;
  /** Function values / left sides (default true when functions are registered). */
  allowFunctions?: boolean;
  /** Asked before `requestRemove` removes a node (RAQB renderConfirm). */
  confirmRemove?: (node: QueryNode) => boolean | Promise<boolean>;
}

export interface StoreOptions<F extends Fields, T> {
  fields: F;
  /** Starting query, in `format`'s shape when a format is given. Defaults to an empty AND group. */
  initial?: T;
  /** Speak another library's shape through `getValue`/`setValue` (e.g. react-querybuilder's JSON). */
  format?: Format<T>;
  /** Undo/redo (default on). */
  history?: boolean | HistoryOptions;
  settings?: StoreSettings;
  /** Clean queries passed to `initial`, `setQuery` and `setValue`. */
  sanitize?: SanitizeOptions;
}

export interface BatchOptions {
  /** Record this change for undo (default true). */
  history?: boolean;
  /** Edits sharing a merge key within the merge window become one undo step. */
  merge?: string;
}

export type Action = 'addRule' | 'addGroup' | 'remove' | 'clone' | 'move' | 'editField' | 'editOperator' | 'editValue' | 'editGroup' | 'lock';

export interface QueryStore<F extends Fields = Fields, T = QueryOf<F>> {
  readonly fields: F;
  readonly rootId: NodeId;
  /** Increments on every committed change. */
  readonly version: number;
  readonly settings: Readonly<StoreSettings>;
  /** Number of rules in the query. */
  readonly ruleCount: number;

  get(id: NodeId): StoreNode<F> | undefined;
  getRule(id: NodeId): RuleNode<F>;
  getGroup(id: NodeId): GroupNode;
  /** Child indexes from the root to `id`. */
  path(id: NodeId): number[];
  /** Group nesting depth: 0 for the root and its direct children's own level. */
  depth(id: NodeId): number;
  /** The schema that applies to a node: the array's element schema inside array groups. */
  fieldsFor(id: NodeId): Fields;
  /** True when the node or any ancestor is locked. */
  isLocked(id: NodeId): boolean;
  /** Whether an action is currently allowed (settings, locks, limits). `target` is the destination group for `move`. */
  can(action: Action, id: NodeId, target?: NodeId): boolean;

  /** Calls `fn` when node `id` changes (replaced, re-parented, or removed). */
  subscribe(id: NodeId, fn: () => void): () => void;
  /** Calls `fn` after every committed change. */
  subscribe(fn: () => void): () => void;
  /**
   * Calls `fn` when anything that can change `can()` results changed: settings, locks, and (only
   * when limits are set) the rule count or tree shape. Value edits never fire it.
   */
  subscribePermissions(fn: () => void): () => void;
  /** Increments whenever `subscribePermissions` listeners fire. */
  readonly permissionsVersion: number;

  /** Native query, structurally shared: unchanged subtrees keep their object identity. */
  getQuery(): QueryOf<F>;
  /** Subtree under `id` as native JSON. */
  getNodeJSON(id: NodeId): QueryNode;
  /** The query in the store's `format` (the native query when there is no format). */
  getValue(): T;
  /** Load a value in the store's `format`. Reconciles node-by-node, keeping ids of unchanged nodes. */
  setValue(value: T, options?: BatchOptions): void;
  setQuery(query: QueryOf<F>, options?: BatchOptions): void;
  /** Load a query as a fresh baseline: replaces the tree and clears undo history (saved views, "discard changes"). */
  reset(query?: QueryOf<F>): void;
  setSettings(settings: StoreSettings): void;

  addRule(parentId: NodeId, rule?: Partial<RuleOf<F>> | Partial<Rule>, index?: number): NodeId | null;
  addGroup(parentId: NodeId, group?: Partial<Pick<Group, 'combinator' | 'not' | 'children' | 'of'>>, index?: number): NodeId | null;
  /** Add a group over an array field's elements ("some orders match…"). */
  addArrayGroup(parentId: NodeId, field: string, match?: Quantifier, index?: number): NodeId | null;
  insert(parentId: NodeId, node: QueryNode, index?: number): NodeId | null;
  remove(id: NodeId): void;
  /** Like `remove`, but asks `settings.confirmRemove` first. Resolves to whether it removed. */
  requestRemove(id: NodeId): Promise<boolean>;
  /** Remove every child of the root group. */
  clear(): void;
  /** Move a node to `index` within `parentId`. Returns false for impossible or disallowed moves. */
  move(id: NodeId, parentId: NodeId, index: number): boolean;
  canMove(id: NodeId, parentId: NodeId): boolean;
  clone(id: NodeId): NodeId | null;

  /** Accepts root fields and, for rules inside array groups, the array's element fields. */
  setField(id: NodeId, field: AnyFieldName<F> | FnCall): void;
  setOperator(id: NodeId, operator: string): void;
  setRuleValue(id: NodeId, value: unknown): void;
  /** Compare against another field (`ref`), or pass null to go back to a literal value. */
  setRef(id: NodeId, ref: string | null): void;
  /** Compare against a function call, or pass null to go back to a literal value. */
  setCall(id: NodeId, call: FnCall | null): void;
  setCombinator(id: NodeId, combinator: Combinator): void;
  setNot(id: NodeId, not: boolean): void;
  /** Change how an array group quantifies (some/all/none/count). */
  setMatch(id: NodeId, match: Quantifier): void;
  setLocked(id: NodeId, locked: boolean): void;

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
  all: boolean;
}

interface Entry {
  before: Map<NodeId, INode | undefined>;
  after: Map<NodeId, INode | undefined>;
  merge: string | undefined;
  time: number;
}

const NO_ISSUES: readonly Issue[] = Object.freeze([]);
const EMPTY_ROOT: Query = { kind: 'group', combinator: 'and', children: [] };

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  return false;
}

function sameNode(a: INode | undefined, b: INode): boolean {
  if (!a || a.kind !== b.kind || a.parent !== b.parent || a.locked !== b.locked) return false;
  if (a.kind === 'group') {
    const g = b as GroupNode;
    return a.combinator === g.combinator && a.not === g.not && a.of === g.of && a.children.length === g.children.length && a.children.every((c, i) => c === g.children[i]);
  }
  const r = b as IRule;
  return a.field === r.field && a.operator === r.operator && a.ref === r.ref && a.call === r.call && 'value' in a === 'value' in r && sameValue(a.value, r.value);
}

export function createQueryStore<const F extends Fields>(options: StoreOptions<F, QueryOf<F>> & { format?: undefined }): QueryStore<F, QueryOf<F>>;
export function createQueryStore<const F extends Fields, T>(options: StoreOptions<F, T> & { format: Format<T> }): QueryStore<F, T>;
export function createQueryStore<F extends Fields, T>(options: StoreOptions<F, T>): QueryStore<F, T> {
  const { fields, format } = options;
  const historyOpts: Required<HistoryOptions> | null =
    options.history === false ? null : { limit: 100, mergeWindowMs: 1000, ...(typeof options.history === 'object' ? options.history : {}) };
  let settings: StoreSettings = { ...options.settings };

  const nodes = new Map<NodeId, INode>();
  const subs = new Map<NodeId, Set<() => void>>();
  const allSubs = new Set<() => void>();
  const permSubs = new Set<() => void>();
  let permVersion = 0;
  let lockOrShapeChanged = false;
  const json = new Map<NodeId, QueryNode>();
  const origin = new WeakMap<object, NodeId>();
  const issueCache = new WeakMap<INode, readonly Issue[]>();
  const scopeCache = new WeakMap<GroupNode, Fields>();
  const undoStack: Entry[] = [];
  const redoStack: Entry[] = [];
  let tx: Tx | null = null;
  let seq = 0;
  let version = 0;
  let ruleCount = 0;
  let validVersion = -1;
  let valid = true;
  let lastValue: { query: Query; value: T } | null = null;

  // --- low-level writes (recorded in the open transaction) -----------------------------------

  /** The only place `nodes` is mutated, so `ruleCount` stays exact. */
  const put = (id: NodeId, node: INode | undefined) => {
    const prev = nodes.get(id);
    if (prev?.kind === 'rule') ruleCount--;
    if (node?.kind === 'rule') ruleCount++;
    if (node) nodes.set(id, node);
    else nodes.delete(id);
  };
  const record = (id: NodeId) => {
    if (tx && !tx.before.has(id)) tx.before.set(id, nodes.get(id));
  };
  const write = (node: INode) => {
    const prev = nodes.get(node.id);
    if (sameNode(prev, node)) return;
    if (!prev || prev.locked !== node.locked || prev.parent !== node.parent || (prev.kind === 'group' && (node as GroupNode).children !== prev.children)) lockOrShapeChanged = true;
    record(node.id);
    put(node.id, node);
  };
  const erase = (id: NodeId) => {
    const n = nodes.get(id);
    if (!n) return;
    if (n.kind === 'group') n.children.forEach(erase);
    lockOrShapeChanged = true;
    record(id);
    put(id, undefined);
  };

  const ruleNode = (id: NodeId, parent: NodeId | null, r: Rule): IRule => {
    const base = { id, parent, kind: 'rule' as const, field: r.field, operator: r.operator, ...(r.locked && { locked: true }) };
    if (r.ref !== undefined) return { ...base, ref: r.ref };
    if (r.call !== undefined) return { ...base, call: r.call };
    return operatorInfo(scopeOfParent(parent), r.operator)?.arity === 'none' ? base : { ...base, value: r.value };
  };

  const groupNode = (id: NodeId, parent: NodeId | null, g: Pick<Group, 'combinator' | 'not' | 'of' | 'locked'>, children: readonly NodeId[]): GroupNode => ({
    id,
    parent,
    kind: 'group',
    combinator: g.combinator,
    not: !!g.not,
    ...(g.of && { of: g.of }),
    ...(g.locked && { locked: true }),
    children,
  });

  function create(node: QueryNode, parent: NodeId | null): NodeId {
    const id = (seq++).toString(36);
    if (node.kind === 'rule') write(ruleNode(id, parent, node));
    else {
      write(groupNode(id, parent, node, []));
      const children = node.children.map((c) => create(c, id));
      put(id, { ...(nodes.get(id) as GroupNode), children });
    }
    return id;
  }

  // --- scope ------------------------------------------------------------------------------------

  /** Fields visible to the children of group `groupId`. */
  function innerScope(groupId: NodeId): Fields {
    const g = nodes.get(groupId) as GroupNode | undefined;
    if (!g) return fields;
    let cached = scopeCache.get(g);
    if (!cached) {
      const outer = scopeOfParent(g.parent);
      cached = g.of && outer[g.of.field]?.of ? elementFields(outer, g.of.field) : outer;
      scopeCache.set(g, cached);
    }
    return cached;
  }
  const scopeOfParent = (parent: NodeId | null): Fields => (parent === null ? fields : innerScope(parent));

  const load = (input: Query) => (options.sanitize ? (sanitizeQuery(fields, input as QueryOf<F>, options.sanitize) as Query) : input);
  const initialQuery = options.initial === undefined ? EMPTY_ROOT : format ? format.decode(options.initial, { fields }) : (options.initial as Query);
  warnMissingRegistry(fields, initialQuery);
  const rootId = create(load(initialQuery), null);

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

  function batch(fn: () => void, opts: BatchOptions & { all?: boolean } = {}) {
    if (tx) {
      if (opts.all) tx.all = true;
      return fn();
    }
    tx = { before: new Map(), history: opts.history ?? true, merge: opts.merge, all: !!opts.all };
    lockOrShapeChanged = false;
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
    if (!touched.length && !done.all) return;
    for (const id of touched) {
      invalidate(id, done.before.get(id));
      invalidate(id, nodes.get(id));
    }
    if (historyOpts && done.history && touched.length) pushHistory(done, touched);
    version++;
    if (done.all) subs.forEach((set) => set.forEach((fn) => fn()));
    else for (const id of touched) subs.get(id)?.forEach((fn) => fn());
    const limits = settings.maxRules !== undefined || settings.maxDepth !== undefined;
    // Locks always matter (they cascade to descendants); shape only matters under limits.
    if (done.all || (lockOrShapeChanged && (limits || touched.some((id) => done.before.get(id)?.locked || nodes.get(id)?.locked)))) {
      permVersion++;
      permSubs.forEach((fn) => fn());
    }
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
          put(id, n);
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
    const lock = n.locked ? { locked: true } : {};
    if (n.kind === 'rule') {
      const base = { kind: 'rule' as const, field: n.field, operator: n.operator };
      out =
        n.ref !== undefined
          ? { ...base, ref: n.ref, ...lock }
          : n.call !== undefined
            ? { ...base, call: n.call, ...lock }
            : 'value' in n
              ? { ...base, value: n.value, ...lock }
              : { ...base, ...lock };
    } else {
      out = {
        kind: 'group',
        combinator: n.combinator,
        ...(n.not && { not: true }),
        ...(n.of && { of: n.of }),
        ...lock,
        children: n.children.map(toJSON),
      };
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
      if (cur.kind === 'group') cur.children.forEach((k) => orphans.add(k));
      write(ruleNode(id, parent, next));
      return;
    }
    const oldChildren = cur.kind === 'group' ? cur.children : [];
    // The group must exist with its scope before children compute theirs.
    write(groupNode(id, parent, next, oldChildren));
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
    write(groupNode(id, parent, next, ids as NodeId[]));
  }

  function setQuery(query: Query, opts?: BatchOptions) {
    if (json.get(rootId) === query) return;
    const input = load(query);
    batch(() => {
      const claimed = new Set<NodeId>();
      const orphans = new Set<NodeId>();
      reconcile(rootId, input, null, claimed, orphans);
      for (const o of orphans) if (!claimed.has(o)) eraseUnclaimed(o, claimed);
    }, opts);
  }

  function eraseUnclaimed(id: NodeId, claimed: Set<NodeId>) {
    const n = nodes.get(id);
    if (!n || claimed.has(id)) return;
    if (n.kind === 'group') n.children.forEach((c) => eraseUnclaimed(c, claimed));
    record(id);
    put(id, undefined);
  }

  // --- permissions ------------------------------------------------------------------------------

  function isLocked(id: NodeId): boolean {
    for (let p: NodeId | null = id; p !== null; p = nodes.get(p)?.parent ?? null) if (nodes.get(p)?.locked) return true;
    return false;
  }

  function depth(id: NodeId): number {
    let d = 0;
    for (let n = nodes.get(id); n && n.parent !== null; n = nodes.get(n.parent)) if (n.kind === 'group') d++;
    return d;
  }

  /** Deepest group nesting inside a subtree, counting the subtree's root group as 1. */
  function subtreeDepth(id: NodeId): number {
    const n = nodes.get(id);
    if (!n || n.kind === 'rule') return 0;
    return 1 + Math.max(0, ...n.children.map(subtreeDepth));
  }

  function can(action: Action, id: NodeId, target?: NodeId): boolean {
    const s = settings;
    const n = nodes.get(id);
    if (!n || s.readOnly) return false;
    if (action === 'lock') return true;
    const locked = isLocked(id);
    switch (action) {
      case 'addRule':
        return n.kind === 'group' && !locked && !s.immutable?.groups && (s.maxRules === undefined || ruleCount < s.maxRules);
      case 'addGroup':
        return (
          n.kind === 'group' &&
          !locked &&
          !s.immutable?.groups &&
          (s.maxDepth === undefined || depth(id) + 1 <= s.maxDepth) &&
          (s.emptyNewGroups || s.maxRules === undefined || ruleCount < s.maxRules)
        );
      case 'remove':
        return n.parent !== null && !s.immutable?.groups && (!locked || !!s.canDeleteLocked) && !isLocked(n.parent);
      case 'clone':
        return n.parent !== null && can(n.kind === 'rule' ? 'addRule' : 'addGroup', n.parent);
      case 'move': {
        if (n.parent === null || locked || s.immutable?.groups || target === undefined) return false;
        const same = target === n.parent;
        if (same ? s.canReorder === false : s.canRegroup === false) return false;
        if (isLocked(target)) return false;
        if (s.maxDepth !== undefined && depth(target) + subtreeDepth(id) > s.maxDepth) return false;
        return true;
      }
      case 'editField':
        return n.kind === 'rule' && !locked && !s.immutable?.fields;
      case 'editOperator':
        return n.kind === 'rule' && !locked && !s.immutable?.operators;
      case 'editValue':
        return n.kind === 'rule' && !locked && !s.immutable?.values;
      case 'editGroup':
        return n.kind === 'group' && !locked && !s.immutable?.groups;
    }
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

  function fieldsFor(id: NodeId): Fields {
    return scopeOfParent(getNode(id).parent);
  }

  const updateRule = (id: NodeId, next: Rule, merge?: string) => batch(() => write(ruleNode(id, getRule(id).parent, next)), { merge });

  function removeNode(id: NodeId) {
    const n = getNode(id);
    if (n.parent === null) return store.clear();
    let target = id;
    // Removing the last child of a group removes the group when empty groups aren't allowed.
    if (settings.canLeaveEmptyGroup === false) {
      for (let p = getGroup(n.parent); p.parent !== null && p.children.length === 1 && p.children[0] === target; p = getGroup(p.parent)) target = p.id;
    }
    const parent = getNode(target).parent!;
    batch(() => {
      const p = getGroup(parent);
      write({ ...p, children: p.children.filter((c) => c !== target) });
      erase(target);
    });
  }

  const store: QueryStore<F, T> = {
    fields,
    rootId,
    get version() {
      return version;
    },
    get settings() {
      return settings;
    },
    get ruleCount() {
      return ruleCount;
    },
    get permissionsVersion() {
      return permVersion;
    },
    subscribePermissions(fn) {
      permSubs.add(fn);
      return () => void permSubs.delete(fn);
    },

    get: (id) => nodes.get(id) as StoreNode<F> | undefined,
    getRule: (id) => getRule(id) as unknown as RuleNode<F>,
    getGroup,
    path(id) {
      const out: number[] = [];
      for (let n = getNode(id); n.parent !== null; n = getNode(n.parent)) out.unshift(getGroup(n.parent).children.indexOf(n.id));
      return out;
    },
    depth,
    fieldsFor,
    isLocked,
    can,

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
    reset(q) {
      setQuery((q as Query | undefined) ?? EMPTY_ROOT, { history: false });
      undoStack.length = 0;
      redoStack.length = 0;
    },
    setSettings(next) {
      settings = { ...settings, ...next };
      // Permissions can change for every node, so everyone re-reads.
      batch(() => {}, { all: true, history: false });
    },

    addRule(parentId, rule, index) {
      if (!can('addRule', parentId)) return null;
      let id = '';
      batch(() => {
        id = create(makeRule(innerScope(parentId), rule as Partial<Rule>), parentId);
        insertChild(parentId, id, index);
      });
      return id;
    },
    addGroup(parentId, group = {}, index) {
      if (!can('addGroup', parentId)) return null;
      const scope = group.of && innerScope(parentId)[group.of.field]?.of ? elementFields(innerScope(parentId), group.of.field) : innerScope(parentId);
      const children = group.children ?? (settings.emptyNewGroups ? [] : [makeRule(scope)]);
      return store.insert(parentId, { kind: 'group', combinator: group.combinator ?? 'and', not: group.not ?? false, ...(group.of && { of: group.of }), children }, index);
    },
    addArrayGroup(parentId, field, match = 'some', index) {
      return store.addGroup(parentId, { of: { field, match } }, index);
    },
    insert(parentId, node, index) {
      if (!can(node.kind === 'rule' ? 'addRule' : 'addGroup', parentId)) return null;
      let id = '';
      batch(() => {
        id = create(node, parentId);
        insertChild(parentId, id, index);
      });
      return id;
    },
    remove(id) {
      if (getNode(id).parent !== null && !can('remove', id)) return;
      removeNode(id);
    },
    async requestRemove(id) {
      const n = nodes.get(id);
      if (!n || (n.parent !== null && !can('remove', id))) return false;
      if (settings.confirmRemove && !(await settings.confirmRemove(toJSON(id)))) return false;
      if (!nodes.has(id)) return false;
      removeNode(id);
      return true;
    },
    clear() {
      if (settings.readOnly || settings.immutable?.groups || isLocked(rootId)) return;
      batch(() => {
        const root = getGroup(rootId);
        root.children.forEach(erase);
        write({ ...root, children: [] });
      });
    },
    canMove: (id, parentId) =>
      id !== rootId && nodes.has(id) && nodes.get(parentId)?.kind === 'group' && !isAncestor(id, parentId) && can('move', id, parentId),
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
      if (!can('clone', id)) return null;
      const p = getGroup(n.parent);
      return store.insert(p.id, toJSON(id), p.children.indexOf(id) + 1);
    },

    setField(id, field) {
      if (!can('editField', id)) return;
      updateRule(id, changeField(fieldsFor(id), toJSON(id) as Rule, field as unknown as string | FnCall, settings));
    },
    setOperator(id, op) {
      if (!can('editOperator', id)) return;
      updateRule(id, changeOperator(fieldsFor(id), toJSON(id) as Rule, op, settings));
    },
    setRuleValue(id, value) {
      if (!can('editValue', id)) return;
      const r = getRule(id);
      updateRule(id, { kind: 'rule', field: r.field, operator: r.operator, value, ...(r.locked && { locked: true }) }, `value:${id}`);
    },
    setRef(id, ref) {
      if (!can('editValue', id) || (ref !== null && settings.allowRefs === false)) return;
      const r = getRule(id);
      const scope = fieldsFor(id);
      const def = leftDef(scope, r.field);
      if (ref === null) {
        updateRule(id, { kind: 'rule', field: r.field, operator: r.operator, value: coerceValue(scope, def, r.operator, def?.defaultValue) });
      } else {
        const operator = operatorInfo(scope, r.operator)?.comparable ? r.operator : 'eq';
        updateRule(id, { kind: 'rule', field: r.field, operator, ref });
      }
    },
    setCall(id, call) {
      if (!can('editValue', id) || (call !== null && settings.allowFunctions === false)) return;
      const r = getRule(id);
      const scope = fieldsFor(id);
      const def = leftDef(scope, r.field);
      if (call === null) {
        updateRule(id, { kind: 'rule', field: r.field, operator: r.operator, value: coerceValue(scope, def, r.operator, def?.defaultValue) });
      } else {
        const operator = operatorInfo(scope, r.operator)?.comparable ? r.operator : 'eq';
        updateRule(id, { kind: 'rule', field: r.field, operator, call }, `call:${id}`);
      }
    },
    setCombinator: (id, combinator) => {
      if (can('editGroup', id)) batch(() => write({ ...getGroup(id), combinator }));
    },
    setNot: (id, not) => {
      if (can('editGroup', id)) batch(() => write({ ...getGroup(id), not }));
    },
    setMatch(id, match) {
      const g = getGroup(id);
      if (!g.of || !can('editGroup', id)) return;
      batch(() => write({ ...g, of: { field: g.of!.field, match } }), { merge: `match:${id}` });
    },
    setLocked(id, locked) {
      if (!can('lock', id)) return;
      const n = getNode(id);
      const { locked: _, ...rest } = n;
      batch(() => write((locked ? { ...rest, locked: true } : rest) as INode));
    },

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
        const scope = fieldsFor(id);
        const found = n.kind === 'rule' ? validateRule(scope, toJSON(id) as Rule) : validateGroup(scope, toJSON(id) as Group);
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
      permSubs.clear();
    },
  };
  return store;
}
