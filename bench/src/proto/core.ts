// Framework-agnostic query store. Nodes live in a flat id -> node map so an edit replaces one
// object and notifies only that node's subscribers: a keystroke is O(1) regardless of tree size.

export type Id = string;
export type Combinator = 'and' | 'or';
export interface RuleJSON { field: string; operator: string; value: unknown }
export interface GroupJSON { combinator: Combinator; not?: boolean; rules: (RuleJSON | GroupJSON)[] }
export interface RuleNode extends RuleJSON { id: Id; kind: 'rule' }
export interface GroupNode { id: Id; kind: 'group'; combinator: Combinator; not: boolean; children: readonly Id[] }
export type QNode = RuleNode | GroupNode;

const isGroupJSON = (n: RuleJSON | GroupJSON): n is GroupJSON => 'rules' in n;

export interface QueryStore {
  readonly rootId: Id;
  get<T extends QNode = QNode>(id: Id): T;
  parentOf(id: Id): Id | undefined;
  subscribe(id: Id, fn: () => void): () => void;
  subscribeAll(fn: () => void): () => void;
  updateRule(id: Id, patch: Partial<RuleJSON>): void;
  updateGroup(id: Id, patch: Partial<Pick<GroupNode, 'combinator' | 'not'>>): void;
  add(groupId: Id, node: RuleJSON | GroupJSON, index?: number): Id;
  remove(id: Id): void;
  toJSON(): GroupJSON;
}

export function createQueryStore(initial: GroupJSON): QueryStore {
  const nodes = new Map<Id, QNode>();
  const parents = new Map<Id, Id>();
  const subs = new Map<Id, Set<() => void>>();
  const allSubs = new Set<() => void>();
  let seq = 0;
  let version = 0;
  let jsonVersion = -1;
  let json: GroupJSON;

  function load(n: RuleJSON | GroupJSON, parent?: Id): Id {
    const id = (seq++).toString(36);
    if (parent !== undefined) parents.set(id, parent);
    if (isGroupJSON(n)) {
      nodes.set(id, { id, kind: 'group', combinator: n.combinator, not: !!n.not, children: [] });
      (nodes.get(id) as GroupNode).children = n.rules.map((c) => load(c, id));
    } else {
      nodes.set(id, { id, kind: 'rule', field: n.field, operator: n.operator, value: n.value });
    }
    return id;
  }

  const rootId = load(initial);

  function emit(id: Id) {
    version++;
    subs.get(id)?.forEach((f) => f());
    allSubs.forEach((f) => f());
  }

  function serialize(id: Id): RuleJSON | GroupJSON {
    const n = nodes.get(id)!;
    if (n.kind === 'rule') return { field: n.field, operator: n.operator, value: n.value };
    return { combinator: n.combinator, ...(n.not && { not: true }), rules: n.children.map(serialize) };
  }

  function drop(id: Id) {
    const n = nodes.get(id);
    if (n?.kind === 'group') n.children.forEach(drop);
    nodes.delete(id);
    parents.delete(id);
  }

  return {
    rootId,
    get: <T extends QNode>(id: Id) => nodes.get(id) as T,
    parentOf: (id) => parents.get(id),
    subscribe(id, fn) {
      let s = subs.get(id);
      if (!s) subs.set(id, (s = new Set()));
      s.add(fn);
      return () => { s!.delete(fn); if (!s!.size) subs.delete(id); };
    },
    subscribeAll(fn) {
      allSubs.add(fn);
      return () => allSubs.delete(fn);
    },
    updateRule(id, patch) {
      nodes.set(id, { ...(nodes.get(id) as RuleNode), ...patch });
      emit(id);
    },
    updateGroup(id, patch) {
      nodes.set(id, { ...(nodes.get(id) as GroupNode), ...patch });
      emit(id);
    },
    add(groupId, node, index) {
      const g = nodes.get(groupId) as GroupNode;
      const id = load(node, groupId);
      const children = g.children.slice();
      children.splice(index ?? children.length, 0, id);
      nodes.set(groupId, { ...g, children });
      emit(groupId);
      return id;
    },
    remove(id) {
      const parent = parents.get(id);
      if (parent === undefined) return;
      const g = nodes.get(parent) as GroupNode;
      nodes.set(parent, { ...g, children: g.children.filter((c) => c !== id) });
      drop(id);
      emit(parent);
    },
    toJSON() {
      if (jsonVersion !== version) {
        json = serialize(rootId) as GroupJSON;
        jsonVersion = version;
      }
      return json;
    },
  };
}

const SQL_OPS: Record<string, (f: string, v: string) => string> = {
  '=': (f, v) => `${f} = ${v}`,
  '!=': (f, v) => `${f} != ${v}`,
  '<': (f, v) => `${f} < ${v}`,
  '>': (f, v) => `${f} > ${v}`,
  '<=': (f, v) => `${f} <= ${v}`,
  '>=': (f, v) => `${f} >= ${v}`,
  contains: (f, v) => `${f} LIKE ${likeWrap(v, '%', '%')}`,
  beginsWith: (f, v) => `${f} LIKE ${likeWrap(v, '', '%')}`,
  endsWith: (f, v) => `${f} LIKE ${likeWrap(v, '%', '')}`,
  null: (f) => `${f} IS NULL`,
  notNull: (f) => `${f} IS NOT NULL`,
};

const likeWrap = (quoted: string, pre: string, post: string) => `'${pre}${quoted.slice(1, -1)}${post}'`;
const sqlValue = (v: unknown) =>
  typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

export function toSQL(g: GroupJSON): string {
  const parts: string[] = [];
  for (const r of g.rules) {
    if (isGroupJSON(r)) {
      if (r.rules.length) parts.push(`(${toSQL(r)})`);
    } else {
      const op = SQL_OPS[r.operator];
      if (op) parts.push(op(r.field, sqlValue(r.value)));
    }
  }
  const out = parts.join(` ${g.combinator} `);
  return g.not ? `NOT (${out})` : out;
}
