<script lang="ts">
  // Keeps in-progress text ("1.", "3, ") while committing parsed values.
  import { CLASS } from '@trawlnet/core';

  interface Props {
    type: string;
    value: unknown;
    parse: (raw: string) => unknown;
    format: (v: unknown) => string;
    onChange: (v: unknown) => void;
    invalid: boolean;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
  }
  let { type, value, parse, format, onChange, invalid, disabled, min, max, step, placeholder }: Props = $props();

  // svelte-ignore state_referenced_locally
  let draft = $state(format(value));
  $effect.pre(() => {
    const v = value;
    if (format(parse(draft)) !== format(v)) draft = format(v);
  });
</script>

<input
  class={CLASS.value}
  {type}
  {min}
  {max}
  {step}
  {placeholder}
  {disabled}
  value={draft}
  aria-invalid={invalid || undefined}
  oninput={(e) => {
    draft = e.currentTarget.value;
    onChange(parse(draft));
  }}
/>
