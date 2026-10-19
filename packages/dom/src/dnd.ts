import { dropIndexFromPointer, type DndController, type NodeId, type QueryStore } from '@qnot/core';

export type DropPosition = 'before' | 'after' | 'inside' | null;

/** Make `handle` start dragging node `id`. Returns a cleanup function. */
export function bindDragHandle(handle: HTMLElement, dnd: DndController, id: NodeId): () => void {
  handle.draggable = true;
  const onStart = (e: DragEvent) => {
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      const row = handle.closest('[data-qn-id]');
      if (row) e.dataTransfer.setDragImage(row, 12, 12);
    }
    dnd.start(id);
  };
  const onEnd = () => dnd.cancel();
  handle.addEventListener('dragstart', onStart);
  handle.addEventListener('dragend', onEnd);
  return () => {
    handle.removeEventListener('dragstart', onStart);
    handle.removeEventListener('dragend', onEnd);
  };
}

/** Where a drag currently targets relative to node `id` (before/after it within its parent). */
export function dropPositionOf(store: QueryStore<any, any>, dnd: DndController, id: NodeId): DropPosition {
  const over = dnd.getState().over;
  const n = over && store.get(id);
  if (!over || !n || n.parent !== over.parentId) return null;
  const siblings = store.getGroup(n.parent).children;
  const index = siblings.indexOf(id);
  if (over.index === index) return 'before';
  if (over.index === index + 1 && index === siblings.length - 1) return 'after';
  return null;
}

/**
 * Make `row` (a rule or non-root group) a drop target: pointer above its midpoint inserts before
 * it, below inserts after. `onPosition` fires when this row's indicator should change.
 */
export function bindDropTarget(
  row: HTMLElement,
  store: QueryStore<any, any>,
  dnd: DndController,
  id: NodeId,
  onPosition?: (position: DropPosition) => void,
): () => void {
  row.dataset.qnId = id;
  const onOver = (e: DragEvent) => {
    const n = store.get(id);
    if (!dnd.getState().dragging || !n || n.parent === null) return;
    e.preventDefault();
    e.stopPropagation();
    const index = store.getGroup(n.parent).children.indexOf(id);
    dnd.over({ parentId: n.parent, index: dropIndexFromPointer(row.getBoundingClientRect(), e.clientY, index) });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dnd.drop();
  };
  row.addEventListener('dragover', onOver);
  row.addEventListener('drop', onDrop);
  let last: DropPosition = null;
  const unsub = onPosition
    ? dnd.subscribe(() => {
        const p = dropPositionOf(store, dnd, id);
        if (p !== last) onPosition((last = p));
      })
    : () => {};
  return () => {
    row.removeEventListener('dragover', onOver);
    row.removeEventListener('drop', onDrop);
    unsub();
  };
}

/** Make a group's children container accept drops at its end; `onOver` reports the empty-group highlight. */
export function bindGroupDropZone(
  zone: HTMLElement,
  store: QueryStore<any, any>,
  dnd: DndController,
  groupId: NodeId,
  onOver?: (isOver: boolean) => void,
): () => void {
  const over = (e: DragEvent) => {
    if (!dnd.getState().dragging) return;
    e.preventDefault();
    e.stopPropagation();
    dnd.over({ parentId: groupId, index: store.getGroup(groupId).children.length });
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dnd.drop();
  };
  zone.addEventListener('dragover', over);
  zone.addEventListener('drop', drop);
  let last = false;
  const unsub = onOver
    ? dnd.subscribe(() => {
        const o = dnd.getState().over;
        const now = o?.parentId === groupId && store.get(groupId)?.kind === 'group' && store.getGroup(groupId).children.length === 0;
        if (now !== last) onOver((last = now));
      })
    : () => {};
  return () => {
    zone.removeEventListener('dragover', over);
    zone.removeEventListener('drop', drop);
    unsub();
  };
}
