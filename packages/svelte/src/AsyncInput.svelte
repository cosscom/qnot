<script lang="ts">
  // Text input backed by the field's async `search`, suggesting options as the user types.
  import { CLASS, formatInput, formatList, parseList, type AnyFieldDef } from '@trawlnet/core';

  interface Props {
    def: AnyFieldDef | undefined;
    value: unknown;
    onChange: (v: unknown) => void;
    invalid: boolean;
    disabled?: boolean;
    multiple?: boolean;
  }
  let { def, value, onChange, invalid, disabled, multiple = false }: Props = $props();

  // svelte-ignore state_referenced_locally
  const format = multiple ? formatList : formatInput;
  // svelte-ignore state_referenced_locally
  let query = $state(format(value));
  // Follow external value changes (undo, controlled updates) without clobbering the text the user
  // is typing: only reset when the new value isn't what this input last emitted.
  // svelte-ignore state_referenced_locally
  let emitted: unknown = value;
  $effect.pre(() => {
    const v = value;
    if (format(v) !== format(emitted)) {
      query = format(v);
      emitted = v;
    }
  });
  let found = $state.raw<readonly { value: unknown; label: string }[]>([]);
  const listId = `tn-async-${Math.random().toString(36).slice(2)}`;

  $effect(() => {
    if (!def?.search) return;
    const search = def.search;
    const ctrl = new AbortController();
    const term = multiple ? (query.split(',').pop() ?? '').trim() : query;
    const t = setTimeout(() => void search(term, ctrl.signal).then((o) => (found = o), () => {}), 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  });
</script>

<input
  class={CLASS.value}
  list={listId}
  value={query}
  {disabled}
  aria-invalid={invalid || undefined}
  oninput={(e) => {
    const raw = e.currentTarget.value;
    query = raw;
    emitted = multiple ? parseList({ ...def!, options: found as never }, raw) : (found.find((o) => String(o.value) === raw)?.value ?? (def?.allowCustom ? raw : null));
    onChange(emitted);
  }}
/>
<datalist id={listId}>
  {#each found as o (o.value)}
    <option value={String(o.value)}>{o.label}</option>
  {/each}
</datalist>
