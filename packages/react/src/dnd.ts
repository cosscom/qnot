import { dropIndexFromPointer, type NodeId } from '@trawlnet/core';
import { useMemo, useSyncExternalStore, type DragEvent } from 'react';
import { useDndController, useStore } from './hooks';

export type DropPosition = 'before' | 'after' | 'inside' | null;

/** Props for the element the user grabs, and whether this node is being dragged. */
export function useDragHandle(id: NodeId) {
  const dnd = useDndController();
  const isDragging = useSyncExternalStore(dnd.subscribe, () => dnd.getState().dragging === id);
  const handleProps = useMemo(
    () => ({
      draggable: true,
      onDragStart(e: DragEvent<HTMLElement>) {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        const row = e.currentTarget.closest('[data-tn-id]');
        if (row) e.dataTransfer.setDragImage(row, 12, 12);
        dnd.start(id);
      },
      onDragEnd: () => dnd.cancel(),
    }),
    [dnd, id],
  );
  return { isDragging, handleProps };
}

/** Make a rule/group row a drop target: dropping above its midpoint inserts before it, below inserts after. */
export function useDropTarget(id: NodeId) {
  const store = useStore();
  const dnd = useDndController();
  const position = useSyncExternalStore(dnd.subscribe, (): DropPosition => {
    const over = dnd.getState().over;
    const n = over && store.get(id);
    if (!over || !n || n.parent !== over.parentId) return null;
    const index = store.getGroup(n.parent).children.indexOf(id);
    if (over.index === index) return 'before';
    if (over.index === index + 1 && index === store.getGroup(n.parent).children.length - 1) return 'after';
    return null;
  });
  const dropProps = useMemo(
    () => ({
      'data-tn-id': id,
      onDragOver(e: DragEvent<HTMLElement>) {
        const n = store.get(id);
        if (!dnd.getState().dragging || !n || n.parent === null) return;
        e.preventDefault();
        e.stopPropagation();
        const index = store.getGroup(n.parent).children.indexOf(id);
        dnd.over({ parentId: n.parent, index: dropIndexFromPointer(e.currentTarget.getBoundingClientRect(), e.clientY, index) });
      },
      onDrop(e: DragEvent<HTMLElement>) {
        e.preventDefault();
        e.stopPropagation();
        dnd.drop();
      },
    }),
    [store, dnd, id],
  );
  return { position, dropProps };
}

/** Make a group's (possibly empty) children area accept drops at its end. */
export function useGroupDropZone(groupId: NodeId) {
  const store = useStore();
  const dnd = useDndController();
  const isOver = useSyncExternalStore(dnd.subscribe, () => {
    const over = dnd.getState().over;
    return over?.parentId === groupId && store.getGroup(groupId).children.length === 0;
  });
  const zoneProps = useMemo(
    () => ({
      onDragOver(e: DragEvent<HTMLElement>) {
        if (!dnd.getState().dragging) return;
        e.preventDefault();
        e.stopPropagation();
        dnd.over({ parentId: groupId, index: store.getGroup(groupId).children.length });
      },
      onDrop(e: DragEvent<HTMLElement>) {
        e.preventDefault();
        e.stopPropagation();
        dnd.drop();
      },
    }),
    [store, dnd, groupId],
  );
  return { isOver, zoneProps };
}
