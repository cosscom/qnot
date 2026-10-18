<script lang="ts" module>
  export interface LazyOption {
    readonly value: unknown;
    readonly label: string;
    readonly depth?: number;
    readonly disabled?: boolean;
    readonly group?: string;
    readonly description?: string;
  }
</script>

<script lang="ts">
  // Selects render only their chosen option until the user reaches for them (hover, focus, press),
  // then the full list for good. Option elements are most of a rule's DOM, so large queries mount
  // with a fraction of the nodes. flushSync puts the full list in the DOM inside the event, before
  // the browser opens the native list or handles arrow keys.
  import { flushSync } from 'svelte';
  import { indent } from './ui';

  interface Props {
    options: readonly LazyOption[];
    value: string;
    onChange: (value: string) => void;
    /** Placeholder option with value '' (always rendered). */
    empty?: string;
    /** Group options under `<optgroup>`s by their `group`. */
    grouped?: boolean;
    class?: string;
    disabled?: boolean;
    invalid?: boolean;
    'aria-label'?: string;
  }
  let { options, value, onChange, empty, grouped = false, class: className, disabled, invalid, 'aria-label': ariaLabel }: Props = $props();

  let el: HTMLSelectElement | undefined = $state();
  let expanded = $state(false);
  const shown = $derived(expanded ? options : options.filter((o) => String(o.value) === value));
  const groups = $derived.by(() => {
    const out = new Map<string | undefined, LazyOption[]>();
    for (const o of shown) {
      const g = grouped && expanded ? o.group : undefined;
      out.set(g, [...(out.get(g) ?? []), o]);
    }
    return [...out];
  });

  function expand() {
    if (expanded) return;
    expanded = true;
    flushSync();
    if (el) el.value = value;
  }

  // Re-assert the selection after the option list changes (it may be inserted after `value`).
  $effect(() => {
    void shown;
    if (el) el.value = value;
  });
</script>

{#snippet option(o: LazyOption)}
  <option value={String(o.value)} disabled={o.disabled} title={o.description}>{indent(o.depth) + o.label}</option>
{/snippet}

<select
  bind:this={el}
  class={className}
  {value}
  {disabled}
  aria-label={ariaLabel}
  aria-invalid={invalid || undefined}
  onfocus={expand}
  onpointerdown={expand}
  onmouseenter={expand}
  onchange={(e) => onChange(e.currentTarget.value)}
>
  {#if empty !== undefined}<option value="">{empty}</option>{/if}
  {#each groups as [group, opts] (group ?? '')}
    {#if group === undefined}
      {#each opts as o (o.value)}{@render option(o)}{/each}
    {:else}
      <optgroup label={group}>
        {#each opts as o (o.value)}{@render option(o)}{/each}
      </optgroup>
    {/if}
  {/each}
</select>
