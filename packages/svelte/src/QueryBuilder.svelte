<script lang="ts" module>
  import type { Fields, Format, QueryStore } from '@trawlnet/core';
  import type { Components, Labels } from './ui';

  export interface QueryBuilderProps<T> {
    store?: QueryStore<any, T>;
    fields?: Fields;
    initial?: T;
    format?: Format<T>;
    /** Controlled value in `format`'s shape; supports `bind:value`. */
    value?: T;
    onchange?: (value: T) => void;
    components?: Partial<Components>;
    labels?: Partial<Labels>;
    class?: string;
  }
</script>

<script lang="ts" generics="T = unknown">
  // Ready-made builder. Pass a `store`, or `fields` (+ `initial` / `bind:value`, `format`) and it creates one.
  import { CLASS, createQueryStore, fieldOptions } from '@trawlnet/core';
  import { onDestroy } from 'svelte';
  import Group from './Group.svelte';
  import Rule from './Rule.svelte';
  import ValueEditor from './ValueEditor.svelte';
  import { setQueryStore } from './reactive';
  import { DEFAULT_LABELS, setUI } from './ui';

  let { store: given, fields, initial, format, value = $bindable(), onchange, components, labels, class: className }: QueryBuilderProps<T> = $props();

  // Store identity and options are read once, like the other bindings.
  // svelte-ignore state_referenced_locally
  const store: QueryStore<any, T> =
    given ??
    (() => {
      if (!fields) throw new Error('trawlnet: <QueryBuilder> needs a `store` or `fields`');
      return createQueryStore({ fields, initial: value !== undefined ? value : initial, format } as never) as QueryStore<any, T>;
    })();

  // Assigning to a $bindable prop wraps the query in a deep $state proxy, so identity checks can't
  // recognise our own echo. A flag skips it instead; genuinely external values are snapshotted so the
  // store never holds proxies.
  let echo = false;
  let first = true;
  $effect.pre(() => {
    const v = value;
    if (first || echo) {
      first = echo = false;
      return;
    }
    if (v !== undefined) store.setValue($state.snapshot(v) as T);
  });

  const unsub = store.subscribe(() => {
    const v = store.getValue();
    echo = true;
    value = v;
    onchange?.(v);
  });
  onDestroy(() => {
    unsub();
    if (!given) store.dispose();
  });

  setQueryStore(store);
  // svelte-ignore state_referenced_locally
  setUI({
    labels: { ...DEFAULT_LABELS, ...labels },
    components: { Group, Rule, ValueEditor, ...components },
    fieldOptions: fieldOptions(store.fields),
  });
  // svelte-ignore state_referenced_locally
  const RootGroup = (components?.Group ?? Group);
</script>

<div class={className ? `${CLASS.root} ${className}` : CLASS.root}>
  <RootGroup id={store.rootId} />
</div>
