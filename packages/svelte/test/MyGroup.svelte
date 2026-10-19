<script lang="ts">
  // A custom group (root and nested) with default rules inside.
  import type { NodeId } from '@qnot/core';
  import { createGroup, DefaultRule, getQueryStore } from '../src/index';
  import MyGroup from './MyGroup.svelte';

  let { id }: { id: NodeId } = $props();
  const store = getQueryStore();
  // svelte-ignore state_referenced_locally
  const g = createGroup(store, id);
</script>

<section data-combinator={g.group.combinator}>
  {#each g.group.children as c (c)}
    {#if store.get(c)?.kind === 'group'}<MyGroup id={c} />{:else}<DefaultRule id={c} />{/if}
  {/each}
</section>
