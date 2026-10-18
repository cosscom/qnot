import type { NodeId, QueryStore } from './store';

export interface DropTarget {
  readonly parentId: NodeId;
  /** Insertion index among the parent's children, before the move is applied. */
  readonly index: number;
}

export interface DndState {
  readonly dragging: NodeId | null;
  readonly over: DropTarget | null;
}

/**
 * Framework-agnostic drag-and-drop state machine. Bindings translate pointer or HTML5 drag events
 * into start/over/drop calls and render `getState()`; the store does the actual move.
 */
export interface DndController {
  getState(): DndState;
  subscribe(fn: () => void): () => void;
  start(id: NodeId): void;
  over(target: DropTarget | null): void;
  canDrop(target: DropTarget): boolean;
  /** Apply the move to the current target. Returns whether anything moved. */
  drop(): boolean;
  cancel(): void;
}

const IDLE: DndState = { dragging: null, over: null };

export function createDnd(store: QueryStore<any, any>): DndController {
  let state = IDLE;
  const subs = new Set<() => void>();
  const set = (next: DndState) => {
    if (next.dragging === state.dragging && next.over?.parentId === state.over?.parentId && next.over?.index === state.over?.index) return;
    state = next;
    subs.forEach((fn) => fn());
  };
  const canDrop = (t: DropTarget) => state.dragging !== null && store.canMove(state.dragging, t.parentId);
  return {
    getState: () => state,
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    start: (id) => set({ dragging: id, over: null }),
    over: (target) => set({ dragging: state.dragging, over: target && canDrop(target) ? target : null }),
    canDrop,
    drop() {
      const { dragging, over } = state;
      set(IDLE);
      return dragging !== null && over !== null && store.move(dragging, over.parentId, over.index);
    },
    cancel: () => set(IDLE),
  };
}

/** Whether a pointer at `clientY` over an element should drop before (index) or after (index + 1) it. */
export const dropIndexFromPointer = (rect: { top: number; height: number }, clientY: number, index: number): number =>
  clientY < rect.top + rect.height / 2 ? index : index + 1;
