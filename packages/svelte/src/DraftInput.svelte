<script lang="ts">
  // Keeps in-progress text ("1.", "3, ") while committing parsed values.
  import { CLASS } from '@qnot/core';

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

  // What the user last typed. The shown text follows `value`, except while the typed text still
  // means the same value (so "1." isn't rewritten to "1" mid-edit).
  let typed: string | undefined;
  const draft = $derived.by(() => {
    const shown = format(value);
    if (typed !== undefined && format(parse(typed)) === shown) return typed;
    typed = undefined;
    return shown;
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
    typed = e.currentTarget.value;
    onChange(parse(typed));
  }}
/>
