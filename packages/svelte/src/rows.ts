// View state for the default rule rows and groups: what their templates read, as prototype getters
// over the reactive helpers. Templates pass member reads only (Svelte memoizes any computed prop or
// attribute in its own derived), and classes keep each row to a few fields: with hundreds of rows,
// every reactive object or accessor-laden literal per row adds up, while getters run only inside
// the row's own effects.
//
// A group creates its children's state itself (`Box.item`), so the default group can render each
// child's root element in its own each-block item: rows then go straight into their container,
// instead of through a fragment per item (which in Chrome also moves every row between the
// template document and the page document, twice).
import {
  CLASS,
  defaultCall,
  fieldLabel,
  formatInput,
  isFnCall,
  parseInput,
  type DndController,
  type Fields,
  type FnCall,
  type NodeId,
  type QueryStore,
} from '@qnot/core';
import { Lazy, type LazyOption } from './lazy';
import {
  Bound,
  createDragHandle,
  createDropTarget,
  createGroup,
  createGroupDropZone,
  createRule,
  createSettings,
  dragOver,
  dropHere,
  functionChoices,
  nodeKind,
  startDrag,
  type RuleState,
} from './reactive';
import { cx, hasError, sourceOptions, type UI } from './ui';

type Select = Event & { currentTarget: HTMLSelectElement };
type Input = Event & { currentTarget: HTMLInputElement };
const NO_OPTIONS: readonly LazyOption[] = [];

/** What a builder's rows share: the store, drag controller and UI options. */
export interface Scope {
  readonly store: QueryStore<any, any>;
  readonly dnd: DndController;
  readonly ui: UI;
  /** The default Rule and Group render children's root elements inline (see `Box.item`). */
  readonly inline: boolean;
  /** The default value editor is inlined into rule rows for its common single-value cases. */
  readonly inlineValues: boolean;
  /** Whether any function exists in the schema (else rows never show the ƒ toggle). */
  readonly functions: boolean;
}

/**
 * A child of a group: its root element's attributes, and what its events do. Events name the
 * element, as they're also handled for a whole group's rows at once (see `Box.listen`).
 */
interface Item {
  readonly isGroup: boolean;
  readonly className: string;
  readonly title: string | undefined;
  readonly dropId: NodeId | undefined;
  /** A drag moves over the element. */
  over(e: DragEvent, el: Element): void;
  /** A drag starts or ends inside the element (only its own handle counts). */
  start(e: DragEvent, el: Element): void;
  end(e: DragEvent, el: Element): void;
  dropOn(e: DragEvent): void;
  /** One of the element's own selects is focused or hovered. */
  reach(select: HTMLSelectElement): void;
}

/**
 * Listeners for one rule or group element rendered on its own (the default Rule and Group
 * components); children a default group renders itself share their container's (`Box.listen`).
 */
export function listenItem(x: Item) {
  return (el: HTMLElement) => {
    const over = (e: DragEvent) => x.over(e, el);
    const drop = (e: DragEvent) => x.dropOn(e);
    const start = (e: DragEvent) => x.start(e, el);
    const end = (e: DragEvent) => x.end(e, el);
    const reach = (e: Event) => {
      const t = e.target as HTMLSelectElement;
      if (t.tagName === 'SELECT' && t.parentNode === el) x.reach(t);
    };
    el.addEventListener('dragover', over);
    el.addEventListener('drop', drop);
    el.addEventListener('dragstart', start);
    el.addEventListener('dragend', end);
    el.addEventListener('focus', reach, true);
    el.addEventListener('mouseenter', reach, true);
    return () => {
      el.removeEventListener('dragover', over);
      el.removeEventListener('drop', drop);
      el.removeEventListener('dragstart', start);
      el.removeEventListener('dragend', end);
      el.removeEventListener('focus', reach, true);
      el.removeEventListener('mouseenter', reach, true);
    };
  };
}

/** Whether a drag event comes from this row's own handle (not a nested row's, nor a text selection). */
const ownHandle = (e: DragEvent, row: Element) => {
  const t = e.target as Element;
  return t.classList?.contains(CLASS.handle) && t.closest('[data-qn-id]') === row;
};

// --- rule rows -------------------------------------------------------------------------------------

// The row's selects, inlined in its template (see lazy.ts).
class FieldPick extends Lazy {
  readonly r: RuleState<Fields>;
  constructor(r: RuleState<Fields>) {
    super();
    this.r = r;
  }
  override get options(): readonly LazyOption[] {
    return this.r.fieldOptions;
  }
  override get current() {
    return this.r.rule.field as string;
  }
  override get grouped() {
    return true;
  }
}
class OperatorPick extends FieldPick {
  override get options(): readonly LazyOption[] {
    return this.r.operators;
  }
  override get current() {
    return this.r.rule.operator;
  }
  override get grouped() {
    return false;
  }
}
class RefPick extends OperatorPick {
  override get options(): readonly LazyOption[] {
    return this.r.refOptions;
  }
  override get current() {
    return this.r.rule.ref ?? '';
  }
}
class EnumPick extends OperatorPick {
  readonly #empty: string;
  constructor(r: RuleState<Fields>, empty: string) {
    super(r);
    this.#empty = empty;
  }
  override get empty() {
    return this.#empty;
  }
  override get options(): readonly LazyOption[] {
    return this.r.editor.options ?? NO_OPTIONS;
  }
  override get current() {
    return formatInput(this.r.rule.value);
  }
}
class SourcePick extends Lazy {
  readonly row: Row;
  constructor(row: Row) {
    super();
    this.row = row;
  }
  override get options(): readonly LazyOption[] {
    return this.row.sources;
  }
  override get current() {
    return this.row.r.source;
  }
}

/** Keeps in-progress text ("1.") while committing parsed values (DraftInput, inlined). */
class Draft extends Bound {
  readonly r: RuleState<Fields>;
  #typed: string | undefined;
  constructor(r: RuleState<Fields>) {
    super();
    this.r = r;
  }
  get text() {
    const shown = formatInput(this.r.rule.value);
    if (this.#typed !== undefined && formatInput(parseInput(this.r.def, this.#typed)) === shown) return this.#typed;
    this.#typed = undefined;
    return shown;
  }
  get input() {
    return this.bind('input', () => (e: Input) => {
      this.#typed = e.currentTarget.value;
      this.r.setValue(parseInput(this.r.def, this.#typed));
    });
  }
}

/** The default rule row. */
export class Row extends Bound implements Item {
  readonly isGroup = false;
  readonly scope: Scope;
  readonly r: RuleState<Fields>;
  readonly drag: ReturnType<typeof createDragHandle>;
  readonly drop: ReturnType<typeof createDropTarget>;
  readonly field: FieldPick;
  readonly operator: OperatorPick;
  readonly source: SourcePick;
  #ref: RefPick | undefined;
  #enum: EnumPick | undefined;
  #draft: Draft | undefined;
  constructor(scope: Scope, id: NodeId) {
    super();
    this.scope = scope;
    this.r = createRule(scope.store, id);
    this.drag = createDragHandle(scope.dnd, id);
    this.drop = createDropTarget(scope.store, scope.dnd, id);
    this.field = new FieldPick(this.r);
    this.operator = new OperatorPick(this.r);
    this.source = new SourcePick(this);
  }
  // Rarely shown parts are created on first use.
  get ref() {
    return (this.#ref ??= new RefPick(this.r));
  }
  get enum() {
    return (this.#enum ??= new EnumPick(this.r, this.scope.ui.labels.empty));
  }
  get draft() {
    return (this.#draft ??= new Draft(this.r));
  }

  // The row element.
  get dropId() {
    return this.r.id;
  }
  get invalid() {
    return hasError(this.r.issues);
  }
  get className() {
    const position = this.drop.position;
    return cx(CLASS.rule, this.invalid && CLASS.invalid, this.r.locked && CLASS.locked, this.drag.isDragging && CLASS.dragging, position === 'before' && CLASS.dropBefore, position === 'after' && CLASS.dropAfter);
  }
  get title() {
    return this.invalid ? this.r.issues.map((i) => i.message).join('\n') : undefined;
  }
  // Element-level handling stands in for per-control listeners: drags start only from the handle,
  // and focus / hover reach the lazy select they target.
  over(e: DragEvent, el: Element) {
    dragOver(this.scope.store, this.scope.dnd, this.r.id, e, el);
  }
  start(e: DragEvent, el: Element) {
    if (ownHandle(e, el)) startDrag(this.scope.dnd, this.r.id, e, el);
  }
  end(e: DragEvent, el: Element) {
    if (ownHandle(e, el)) this.scope.dnd.cancel();
  }
  dropOn(e: DragEvent) {
    dropHere(this.scope.dnd, e);
  }
  reach(el: HTMLSelectElement) {
    const c = el.classList;
    const pick = c.contains(CLASS.field)
      ? this.field
      : c.contains(CLASS.operator)
        ? this.operator
        : c.contains('qn-source')
          ? this.source
          : c.contains(CLASS.value) && this.r.rule.ref !== undefined
            ? this.ref
            : c.contains(CLASS.value) && this.inline === 'select'
              ? this.enum
              : null;
    pick?.open(el);
  };

  // Left side.
  /** Functions offered for the left side (all of them, when functions are allowed). */
  get lhsFunctions() {
    return createSettings(this.scope.store).current.allowFunctions !== false ? functionChoices(this.r.fields) : [];
  }
  get fieldIsFn() {
    return isFnCall(this.r.rule.field);
  }
  get fnTitle() {
    return this.fieldIsFn ? this.scope.ui.labels.useField : this.scope.ui.labels.useFunction;
  }
  get toggleFn() {
    return this.bind('toggleFn', () => () => this.r.setField(this.fieldIsFn ? this.r.fieldOptions[0]!.value : defaultCall(this.r.fields, this.lhsFunctions[0]!.value)));
  }
  get setField() {
    return this.bind('setField', () => (e: Select) => this.r.setField(e.currentTarget.value));
  }
  get setOperator() {
    return this.bind('setOperator', () => (e: Select) => this.r.setOperator(e.currentTarget.value));
  }

  // Right side.
  get hasSources() {
    return this.r.refOptions.length > 0 || this.r.functionOptions.length > 0;
  }
  get sources() {
    return sourceOptions(this.scope.ui.labels, this.r.refOptions.length > 0, this.r.functionOptions.length > 0);
  }
  get setSource() {
    return this.bind('setSource', () => (e: Select) => {
      const v = e.currentTarget.value;
      if (v === 'field') this.r.setRef(this.r.refOptions[0]!.value);
      else if (v === 'function') this.r.setCall(defaultCall(this.r.fields, this.r.functionOptions[0]!.value));
      else this.r.setRef(null);
    });
  }
  get setRef() {
    return this.bind('setRef', () => (e: Select) => this.r.setRef(e.currentTarget.value));
  }
  get kind() {
    return this.r.def?.kind;
  }
  /** Which single-value editor the row renders itself (else the ValueEditor component). */
  get inline(): 'text' | 'number' | 'select' | 'boolean' | null {
    if (!this.scope.inlineValues) return null;
    const e = this.r.editor;
    if (e.arity !== 'one' || e.async) return null;
    return e.type === 'text' || e.type === 'number' || e.type === 'select' || e.type === 'boolean' ? e.type : null;
  }
  get text() {
    return formatInput(this.r.rule.value);
  }
  get ariaInvalid() {
    return this.invalid || undefined;
  }
  get placeholder() {
    return this.r.def?.placeholder;
  }
  get min() {
    return this.r.def?.min;
  }
  get max() {
    return this.r.def?.max;
  }
  get step() {
    return this.r.def?.step;
  }
  get inputText() {
    return this.bind('inputText', () => (e: Input) => this.r.setValue(e.currentTarget.value));
  }
  get setEnum() {
    return this.bind('setEnum', () => (e: Select) => this.r.setValue(parseInput(this.r.def, e.currentTarget.value)));
  }
  get setBoolean() {
    return this.bind('setBoolean', () => (e: Select) => this.r.setValue(e.currentTarget.value === '' ? null : e.currentTarget.value === 'true'));
  }

  // Lock.
  get lockTitle() {
    return this.r.rule.locked ? this.scope.ui.labels.unlock : this.scope.ui.labels.lock;
  }
  get lockIcon() {
    return this.r.rule.locked ? '🔒' : '🔓';
  }
  get lockPressed() {
    return !!this.r.rule.locked;
  }
  get toggleLock() {
    return this.bind('toggleLock', () => () => this.r.setLocked(!this.r.rule.locked));
  }

  // Disabled states, by control.
  get noField() {
    return !this.r.can.editField;
  }
  get noOperator() {
    return !this.r.can.editOperator;
  }
  get noValue() {
    return !this.r.can.editValue;
  }
  get noClone() {
    return !this.r.can.clone;
  }
  get noRemove() {
    return !this.r.can.remove;
  }
  get noLock() {
    return !this.r.can.lock;
  }
}

// --- groups ----------------------------------------------------------------------------------------

/** The default group. */
export class Box extends Bound implements Item {
  readonly isGroup = true;
  readonly scope: Scope;
  readonly g: ReturnType<typeof createGroup>;
  readonly drag: ReturnType<typeof createDragHandle>;
  readonly drop: ReturnType<typeof createDropTarget>;
  readonly zone: ReturnType<typeof createGroupDropZone>;
  /** The root is always the root: no handle, clone/remove or drop target (it has no siblings). */
  readonly isRoot: boolean;
  /** Children's state, by id (see `item`). */
  #items = new Map<NodeId, Row | Box>();
  #children: readonly NodeId[] | undefined;
  constructor(scope: Scope, id: NodeId) {
    super();
    this.scope = scope;
    this.g = createGroup(scope.store, id);
    this.drag = createDragHandle(scope.dnd, id);
    this.drop = createDropTarget(scope.store, scope.dnd, id);
    this.zone = createGroupDropZone(scope.store, scope.dnd, id);
    this.isRoot = id === scope.store.rootId;
  }

  /** The children, forgetting the state of any that left. */
  get children(): readonly NodeId[] {
    const children = this.g.group.children;
    if (children !== this.#children) {
      this.#children = children;
      if (this.#items.size > children.length) {
        const keep = new Set(children);
        for (const id of this.#items.keys()) if (!keep.has(id)) this.#items.delete(id);
      }
    }
    return children;
  }
  /** A child's state, kept while it stays a child of this kind (tracks the child's kind). */
  item(id: NodeId): Row | Box {
    const kind = nodeKind(this.scope.store, id);
    let x = this.#items.get(id);
    // A child that's gone keeps its last state until the list drops it.
    if (!x || (kind !== undefined && x.isGroup !== (kind === 'group'))) this.#items.set(id, (x = kind === 'group' ? new Box(this.scope, id) : new Row(this.scope, id)));
    return x;
  }

  // The group element.
  get dropId() {
    return this.isRoot ? undefined : this.g.id;
  }
  get className() {
    const position = this.drop.position;
    return cx(
      CLASS.group,
      !!this.g.group.of && CLASS.arrayGroup,
      this.g.locked && CLASS.locked,
      this.drag.isDragging && CLASS.dragging,
      position === 'before' && CLASS.dropBefore,
      position === 'after' && CLASS.dropAfter,
    );
  }
  readonly title = undefined;
  over(e: DragEvent, el: Element) {
    if (!this.isRoot) dragOver(this.scope.store, this.scope.dnd, this.g.id, e, el);
  }
  start(e: DragEvent, el: Element) {
    if (ownHandle(e, el)) startDrag(this.scope.dnd, this.g.id, e, el);
  }
  end(e: DragEvent, el: Element) {
    if (ownHandle(e, el)) this.scope.dnd.cancel();
  }
  reach() {}
  dropOn(e: DragEvent) {
    if (!this.isRoot) dropHere(this.scope.dnd, e);
  }

  /**
   * Attach to the children container when this group renders its children's elements itself: one
   * set of listeners for all of them, routing each event to the child row it happened in (or to
   * the container's own drop zone).
   */
  listen = (el: HTMLElement) => {
    const { dnd } = this.scope;
    const zone = this.zone.zoneProps;
    /** The child row element the event happened in, and its state. */
    const hit = (e: Event): [Element, Row | Box] | undefined => {
      let n = e.target as Element | null;
      if (n === el) return;
      while (n && n.parentNode !== el) n = n.parentNode as Element | null;
      const x = n && this.#items.get((n as HTMLElement).dataset.qnId!);
      return x ? [n!, x] : undefined;
    };
    const over = (e: DragEvent) => {
      const h = hit(e);
      if (h) h[1].over(e, h[0]);
      else zone.ondragover(e);
    };
    const drop = (e: DragEvent) => dropHere(dnd, e);
    const start = (e: DragEvent) => {
      const h = hit(e);
      if (h) h[1].start(e, h[0]);
    };
    const end = (e: DragEvent) => {
      const h = hit(e);
      if (h) h[1].end(e, h[0]);
    };
    // focus and mouseenter don't bubble: listen in the capture phase.
    const reach = (e: Event) => {
      const t = e.target as HTMLSelectElement;
      if (t.tagName !== 'SELECT') return;
      const h = hit(e);
      if (h && t.parentNode === h[0]) h[1].reach(t);
    };
    el.addEventListener('dragover', over);
    el.addEventListener('drop', drop);
    el.addEventListener('dragstart', start);
    el.addEventListener('dragend', end);
    el.addEventListener('focus', reach, true);
    el.addEventListener('mouseenter', reach, true);
    return () => {
      el.removeEventListener('dragover', over);
      el.removeEventListener('drop', drop);
      el.removeEventListener('dragstart', start);
      el.removeEventListener('dragend', end);
      el.removeEventListener('focus', reach, true);
      el.removeEventListener('mouseenter', reach, true);
    };
  };

  get arrayLabel() {
    const of = this.g.group.of;
    const store = this.scope.store;
    return of ? fieldLabel(of.field, (this.isRoot ? store.fields : store.fieldsFor(this.g.id))[of.field]) : '';
  }
  get childrenClass() {
    return cx(CLASS.children, this.zone.isOver && CLASS.dropInside);
  }
  get lockTitle() {
    return this.g.group.locked ? this.scope.ui.labels.unlock : this.scope.ui.labels.lock;
  }
  get lockIcon() {
    return this.g.group.locked ? '🔒' : '🔓';
  }
  get lockPressed() {
    return !!this.g.group.locked;
  }
  get toggleLock() {
    return this.bind('toggleLock', () => () => this.g.setLocked(!this.g.group.locked));
  }
  get setNot() {
    return this.bind('setNot', () => (e: Input) => this.g.setNot(e.currentTarget.checked));
  }
  get setCombinator() {
    return this.bind('setCombinator', () => (e: Select) => this.g.setCombinator(e.currentTarget.value as 'and' | 'or'));
  }
  get addRule() {
    return this.bind('addRule', () => () => this.g.addRule());
  }
  get addGroup() {
    return this.bind('addGroup', () => () => this.g.addGroup());
  }
  get addArrayGroup() {
    return this.bind('addArrayGroup', () => (e: Select) => {
      const el = e.currentTarget;
      if (el.value) this.g.addArrayGroup(el.value);
      el.value = '';
    });
  }

  // Disabled states, by control.
  get noEditGroup() {
    return !this.g.can.editGroup;
  }
  get noAddRule() {
    return !this.g.can.addRule;
  }
  get noAddGroup() {
    return !this.g.can.addGroup;
  }
  get noLock() {
    return !this.g.can.lock;
  }
  get noClone() {
    return !this.g.can.clone;
  }
  get noRemove() {
    return !this.g.can.remove;
  }
}
