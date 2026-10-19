<script lang="ts">
  // The default group: its element, with the header and children in GroupBody (which also renders
  // nested default groups directly into elements it creates itself; see rows.ts).
  import type { NodeId } from '@qnot/core';
  import GroupBody from './GroupBody.svelte';
  import { Box, listenItem } from './rows';
  import { getScope } from './scope';

  let { id }: { id: NodeId } = $props();
  // svelte-ignore state_referenced_locally
  const box = new Box(getScope(), id);
</script>

<div class={box.className} role="group" data-qn-id={box.dropId} {@attach listenItem(box)}><GroupBody {box} /></div>
