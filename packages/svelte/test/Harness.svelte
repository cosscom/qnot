<script lang="ts">
  import type { Fields, QueryOf } from '@trawlnet/core';
  import { QueryBuilder } from '../src/index';

  let { fields, value = $bindable() }: { fields: Fields; value: QueryOf<Fields> } = $props();
</script>

<QueryBuilder {fields} bind:value />
<pre>{JSON.stringify(value)}</pre>
