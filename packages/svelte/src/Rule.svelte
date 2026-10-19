<script lang="ts">
  import { CLASS, defaultCall, functionOptions, isFnCall, type FnCall, type NodeId } from '@qnot/core';
  import FieldSelect from './FieldSelect.svelte';
  import FunctionEditor from './FunctionEditor.svelte';
  import LazySelect from './LazySelect.svelte';
  import { createDragHandle, createDropTarget, createRule, createSettings, getDndController, getQueryStore } from './reactive';
  import { cx, getUI } from './ui';

  let { id }: { id: NodeId } = $props();
  const store = getQueryStore();
  const dnd = getDndController();
  const ui = getUI();
  // svelte-ignore state_referenced_locally
  const r = createRule(store, id);
  // svelte-ignore state_referenced_locally
  const drag = createDragHandle(dnd, id);
  // svelte-ignore state_referenced_locally
  const drop = createDropTarget(store, dnd, id);
  const settings = createSettings(store);

  const rule = $derived(r.rule);
  const fields = $derived(r.fields);
  // Permissions follow their own channel: value edits never recompute them.
  const can = $derived(r.can);
  const issues = $derived(r.issues);
  const invalid = $derived(issues.some((i) => i.severity === 'error'));
  const fieldIsFn = $derived(isFnCall(rule.field));
  const lhsFunctions = $derived(settings.current.allowFunctions !== false ? functionOptions(fields) : []);
  const refs = $derived(r.refOptions);
  const fns = $derived(r.functionOptions);
  const sources = $derived([
    { value: 'value', label: ui.labels.compareValue },
    ...(refs.length > 0 ? [{ value: 'field', label: ui.labels.compareField }] : []),
    ...(fns.length > 0 ? [{ value: 'function', label: ui.labels.compareFunction }] : []),
  ]);
  const ValueEditor = $derived(ui.components.ValueEditor);
</script>

<div
  class={cx(
    CLASS.rule,
    invalid && CLASS.invalid,
    r.locked && CLASS.locked,
    drag.isDragging && CLASS.dragging,
    drop.position === 'before' && CLASS.dropBefore,
    drop.position === 'after' && CLASS.dropAfter,
  )}
  title={invalid ? issues.map((i) => i.message).join('\n') : undefined}
  role="group"
  {...drop.dropProps}
>
  <span class={CLASS.handle} aria-label={ui.labels.drag} role="button" tabindex="-1" {...drag.handleProps}>⠿</span>
  {#if lhsFunctions.length > 0}
    <button
      type="button"
      class={cx(CLASS.action, 'qn-lhs-toggle')}
      disabled={!can.editField}
      title={fieldIsFn ? ui.labels.useField : ui.labels.useFunction}
      aria-pressed={fieldIsFn}
      onclick={() => r.setField(fieldIsFn ? r.fieldOptions[0]!.value : defaultCall(fields, lhsFunctions[0]!.value))}>ƒ</button
    >
  {/if}
  {#if fieldIsFn}
    <FunctionEditor call={rule.field as FnCall} {fields} onChange={r.setField} disabled={!can.editField} labels={ui.labels} />
  {:else}
    <FieldSelect value={rule.field as string} options={r.fieldOptions} disabled={!can.editField} onChange={r.setField} />
  {/if}
  <LazySelect class={CLASS.operator} value={rule.operator} options={r.operators} disabled={!can.editOperator} onChange={r.setOperator} />
  {#if refs.length > 0 || fns.length > 0}
    <LazySelect
      class="qn-source"
      value={r.source}
      options={sources}
      disabled={!can.editValue}
      aria-label={ui.labels.compareWith}
      onChange={(v) => {
        if (v === 'field') r.setRef(refs[0]!.value);
        else if (v === 'function') r.setCall(defaultCall(fields, fns[0]!.value));
        else r.setRef(null);
      }}
    />
  {/if}
  {#if rule.ref !== undefined}
    <LazySelect class={CLASS.value} value={rule.ref} options={refs} disabled={!can.editValue} onChange={r.setRef} />
  {:else if rule.call !== undefined}
    <FunctionEditor call={rule.call} {fields} kind={r.def?.kind} onChange={r.setCall} disabled={!can.editValue} labels={ui.labels} />
  {:else}
    <ValueEditor editor={r.editor} def={r.def} value={rule.value} onChange={r.setValue} {invalid} disabled={!can.editValue} labels={ui.labels} />
  {/if}
  {#if ui.showLock}
    <button
      type="button"
      class={CLASS.action}
      disabled={!can.lock}
      aria-pressed={!!rule.locked}
      title={rule.locked ? ui.labels.unlock : ui.labels.lock}
      onclick={() => r.setLocked(!rule.locked)}>{rule.locked ? '🔒' : '🔓'}</button
    >
  {/if}
  <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} disabled={!can.clone} onclick={r.clone}>⧉</button>
  <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} disabled={!can.remove} onclick={r.remove}>×</button>
</div>
