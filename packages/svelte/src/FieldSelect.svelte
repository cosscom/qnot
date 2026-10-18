<script lang="ts">
  // Field picker with struct fields grouped under their struct label.
  import { CLASS, type FieldOption } from '@trawlnet/core';

  let { value, options, onChange, disabled }: { value: string; options: readonly FieldOption[]; onChange: (v: string) => void; disabled?: boolean } = $props();
  const groups = $derived.by(() => {
    const out = new Map<string | undefined, FieldOption[]>();
    for (const o of options) out.set(o.group, [...(out.get(o.group) ?? []), o]);
    return [...out];
  });
</script>

<select class={CLASS.field} {value} {disabled} onchange={(e) => onChange(e.currentTarget.value)}>
  {#each groups as [group, opts] (group ?? '')}
    {#if group === undefined}
      {#each opts as o (o.value)}
        <option value={o.value} title={o.description}>{o.label}</option>
      {/each}
    {:else}
      <optgroup label={group}>
        {#each opts as o (o.value)}
          <option value={o.value} title={o.description}>{o.label}</option>
        {/each}
      </optgroup>
    {/if}
  {/each}
</select>
