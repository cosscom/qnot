<script lang="ts">
  import type { NodeId } from '@qnot/core';
  import { createNode, getQueryStore } from './reactive';
  import { getUI } from './ui';

  let { id }: { id: NodeId } = $props();
  // svelte-ignore state_referenced_locally
  const node = createNode(getQueryStore(), id);
  const ui = getUI();
  const kind = $derived(node.current.kind);
  const Group = $derived(ui.components.Group);
  const Rule = $derived(ui.components.Rule);
</script>

{#if kind === 'group'}
  <Group {id} />
{:else}
  <Rule {id} />
{/if}
