<script lang="ts">
  // A custom rule built on the public drag primitives.
  import type { NodeId } from '@qnot/core';
  import { createDragHandle, createDropTarget, getDndController, getQueryStore } from '../src/index';

  let { id }: { id: NodeId } = $props();
  // svelte-ignore state_referenced_locally
  const drag = createDragHandle(getDndController(), id);
  // svelte-ignore state_referenced_locally
  const drop = createDropTarget(getQueryStore(), getDndController(), id);
</script>

<div class="custom" class:dragging={drag.isDragging} class:before={drop.position === 'before'} {...drop.dropProps}>
  <span class="grip" {...drag.handleProps}></span>
</div>
