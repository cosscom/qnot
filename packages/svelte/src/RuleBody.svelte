<script lang="ts">
  // A rule row's content (the row element itself is rendered by the default Rule or, for its own
  // children, the default group). Reads everything through `row` (rows.ts); its selects are lazy
  // (lazy.ts) and inlined, and so are the default value editor's single-value cases.
  import type { FnCall } from '@qnot/core';
  import FunctionEditor from './FunctionEditor.svelte';
  import type { Row } from './rows';

  let props: { row: Row } = $props();
  // svelte-ignore state_referenced_locally
  const { row } = props;
  const { r, field, operator, source, scope } = row;
  const { labels, components, showLock } = scope.ui;
  const ValueEditor = components.ValueEditor;
  // Parts fixed for the row's life are picked once, not wrapped in blocks: the lock button (a
  // builder option) and the ƒ toggle (only when the schema has functions).
  const lockButton = showLock ? lock : undefined;
  const fnToggle = scope.functions ? lhsToggle : undefined;
</script>

{#snippet lhsToggle()}
  {#if row.lhsFunctions.length > 0}
    <button type="button" class="qn-action qn-lhs-toggle" disabled={row.noField} title={row.fnTitle} aria-pressed={row.fieldIsFn} onclick={row.toggleFn}>ƒ</button>
  {/if}
{/snippet}

{#snippet lock()}
  <button type="button" class="qn-action" disabled={row.noLock} aria-pressed={row.lockPressed} title={row.lockTitle} onclick={row.toggleLock}>{row.lockIcon}</button>
{/snippet}

<!-- No whitespace between the row's children: it's a flex row, so it would only add text nodes. -->
<span class="qn-handle" aria-label={labels.drag} role="button" tabindex="-1" draggable="true">⠿</span
>{@render fnToggle?.()}{#if row.fieldIsFn}
  <FunctionEditor call={r.rule.field as FnCall} fields={r.fields} onChange={r.setField} disabled={row.noField} {labels} />
{:else}
  <select class="qn-field" disabled={row.noField} onchange={row.setField} onpointerdown={field.expand}
    ><option value={field.value} disabled={field.disabled} selected>{field.label}</option></select
  >
{/if}<select class="qn-operator" disabled={row.noOperator} onchange={row.setOperator} onpointerdown={operator.expand}
  ><option value={operator.value} disabled={operator.disabled} selected>{operator.label}</option></select
>{#if row.hasSources}
  <select
    class="qn-source"
    disabled={row.noValue}
    aria-label={labels.compareWith}
    onchange={row.setSource}
    onpointerdown={source.expand}
   ><option value={source.value} disabled={source.disabled} selected>{source.label}</option></select
  >
{/if}{#if r.rule.ref !== undefined}
  <select class="qn-value" disabled={row.noValue} onchange={row.setRef} onpointerdown={row.ref.expand}
    ><option value={row.ref.value} disabled={row.ref.disabled} selected>{row.ref.label}</option></select
  >
{:else if r.rule.call !== undefined}
  <FunctionEditor call={r.rule.call} fields={r.fields} kind={row.kind} onChange={r.setCall} disabled={row.noValue} {labels} />
{:else if row.inline === 'text'}
  <input class="qn-value" type="text" value={row.text} placeholder={row.placeholder} disabled={row.noValue} aria-invalid={row.ariaInvalid} oninput={row.inputText} />
{:else if row.inline === 'number'}
  <input
    class="qn-value"
    type="number"
    min={row.min}
    max={row.max}
    step={row.step}
    placeholder={row.placeholder}
    disabled={row.noValue}
    value={row.draft.text}
    aria-invalid={row.ariaInvalid}
    oninput={row.draft.input}
  />
{:else if row.inline === 'select'}
  <select
    class="qn-value"
    disabled={row.noValue}
    aria-invalid={row.ariaInvalid}
    onchange={row.setEnum}
    onpointerdown={row.enum.expand}
   ><option value={row.enum.value} disabled={row.enum.disabled} selected>{row.enum.label}</option></select
  >
{:else if row.inline === 'boolean'}
  <select class="qn-value" value={row.text} disabled={row.noValue} aria-invalid={row.ariaInvalid} onchange={row.setBoolean}
    ><option value="">{labels.empty}</option><option value="true">{labels.yes}</option><option value="false">{labels.no}</option></select
  >
{:else}
  <ValueEditor editor={r.editor} def={r.def} value={r.rule.value} onChange={r.setValue} invalid={row.invalid} disabled={row.noValue} {labels} />
{/if}{@render lockButton?.()}<button type="button" class="qn-action" title={labels.clone} aria-label={labels.clone} disabled={row.noClone} onclick={r.clone}
  >⧉</button
><button type="button" class="qn-action" title={labels.remove} aria-label={labels.remove} disabled={row.noRemove} onclick={r.remove}>×</button>
