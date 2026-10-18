<script lang="ts">
  // Field picker with struct fields grouped under their struct label (lazy options).
  import { CLASS, type FieldOption } from '@trawlnet/core';
  import LazySelect from './LazySelect.svelte';

  let { value, options, onChange, disabled }: { value: string; options: readonly FieldOption[]; onChange: (v: string) => void; disabled?: boolean } = $props();
</script>

<LazySelect class={CLASS.field} {value} {options} {onChange} {disabled} grouped />
