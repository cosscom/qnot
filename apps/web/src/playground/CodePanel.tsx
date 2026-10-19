'use client';
import { encode, type Query } from '@trawlnet/core';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { useQuery } from '@trawlnet/react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { HighlighterCore } from 'shiki/core';
import { ScrollBox } from '@/components/trawlnet/scroll-box';
import { Button } from '@/components/ui/button';
import { useCopy } from '@/lib/use-copy';
import { fields, type Fields } from './schema';
import { DEFAULT_SETTINGS, type PlaygroundSettings } from './Settings';

export type CodeRenderer = 'coss' | 'react' | 'vanilla' | 'vue' | 'svelte' | 'solid' | 'all';

type Lang = 'ts' | 'tsx' | 'vue' | 'svelte';

// A small highlighter, loaded the first time the Code tab opens: four grammars, two themes, no wasm.
let highlighter: Promise<HighlighterCore> | null = null;
const loadHighlighter = () =>
  (highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
    createHighlighterCore({
      themes: [import('shiki/dist/themes/github-light.mjs'), import('shiki/dist/themes/github-dark.mjs')],
      langs: [import('shiki/dist/langs/typescript.mjs'), import('shiki/dist/langs/tsx.mjs'), import('shiki/dist/langs/vue.mjs'), import('shiki/dist/langs/svelte.mjs')],
      engine: createJavaScriptRegexEngine(),
    }),
  ));

function useHighlighter() {
  const [h, setH] = useState<HighlighterCore | null>(null);
  useEffect(() => {
    let live = true;
    void loadHighlighter().then((x) => live && setH(x));
    return () => {
      live = false;
    };
  }, []);
  return h;
}

/** A titled, copyable, highlighted block; plain text until the highlighter has loaded. */
function Block({ title, code, lang, html: preHtml, highlighter, note }: { title: string; code: string; lang: Lang; html?: string; highlighter: HighlighterCore | null; note?: string }) {
  const { copied, copy } = useCopy();
  const html = useMemo(
    () =>
      preHtml ??
      (highlighter ? highlighter.codeToHtml(code, { lang: lang === 'ts' ? 'typescript' : lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }) : null),
    [preHtml, highlighter, code, lang],
  );
  return (
    <figure className="overflow-hidden rounded-xl border bg-code" data-code-block={title}>
      <figcaption className="flex items-center gap-2 border-b py-1 ps-3 pe-1">
        <span className="font-mono text-muted-foreground text-xs">{title}</span>
        {note && <span className="truncate text-muted-foreground text-xs">· {note}</span>}
        <Button aria-label={`Copy ${title}`} className="ms-auto" onClick={() => void copy(code)} size="icon-xs" variant="ghost">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </figcaption>
      <ScrollBox viewportClassName="max-h-[28rem]">
        {html ? (
          <div
            className="text-[0.75rem] leading-relaxed [&_.shiki]:bg-transparent! [&_.shiki]:p-3 [&_.shiki_span]:text-(--shiki-light) dark:[&_.shiki_span]:text-(--shiki-dark) [&_pre]:w-max [&_pre]:min-w-full"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output of code we generated
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="w-max min-w-full p-3 font-mono text-[0.75rem] leading-relaxed">{code}</pre>
        )}
      </ScrollBox>
    </figure>
  );
}

/** JSON as a TypeScript literal: bare keys and single-quoted strings. */
function tsLiteral(value: unknown, indent = 0): string {
  const json = JSON.stringify(value, null, 2);
  return json
    .replace(/"([A-Za-z_$][\w$]*)":/g, '$1:')
    .replace(/"((?:[^"\\]|\\.)*)"/g, (_, s: string) => (s.includes("'") ? `"${s}"` : `'${s.replace(/\\"/g, '"')}'`))
    .split('\n')
    .map((line, i) => (i === 0 ? line : ' '.repeat(indent) + line))
    .join('\n');
}

/** Only the settings that differ from the store's defaults, as the store's own shape. */
function changedSettings(s: PlaygroundSettings): string[] {
  const out: string[] = [];
  const d = DEFAULT_SETTINGS;
  if (s.readOnly) out.push('readOnly: true');
  const immutable = (['groups', 'fields', 'operators', 'values'] as const).filter((k) => s[`immutable${k[0]!.toUpperCase()}${k.slice(1)}` as keyof PlaygroundSettings]);
  if (immutable.length) out.push(`immutable: { ${immutable.map((k) => `${k}: true`).join(', ')} }`);
  if (s.maxRules !== null) out.push(`maxRules: ${s.maxRules}`);
  if (s.maxDepth !== null) out.push(`maxDepth: ${s.maxDepth}`);
  for (const key of ['canReorder', 'canRegroup', 'canLeaveEmptyGroup', 'emptyNewGroups', 'canDeleteLocked', 'allowRefs', 'allowFunctions'] as const) {
    if (s[key] !== d[key]) out.push(`${key}: ${s[key]}`);
  }
  if (s.confirmRemove) out.push("confirmRemove: () => window.confirm('Remove this condition?')");
  return out;
}

/** JSX props for the React builders, only where they differ from the component's defaults. */
function builderProps(s: PlaygroundSettings): string {
  return [s.showNot ? '' : ' showNot={false}', s.showLock ? ' showLock' : ''].join('');
}

function renderCode(renderer: CodeRenderer, s: PlaygroundSettings, cossUrl: string): { title: string; lang: Lang; code: string; note?: string } {
  switch (renderer) {
    case 'coss':
      return {
        title: 'filters.tsx',
        lang: 'tsx',
        note: 'coss ui builder, installed with shadcn',
        code: `// pnpm dlx shadcn@latest add ${cossUrl}
'use client';
import { CossQueryBuilder } from '@/components/trawlnet/query-builder';
import { store } from './store';

export function Filters() {
  return <CossQueryBuilder store={store}${builderProps(s)} />;
}`,
      };
    case 'vue':
      return {
        title: 'Filters.vue',
        lang: 'vue',
        code: `<script setup lang="ts">
import '@trawlnet/core/styles.css';
import { QueryBuilder } from '@trawlnet/vue';
import { store } from './store';
</script>

<template>
  <QueryBuilder :store="store" />
</template>`,
      };
    case 'svelte':
      return {
        title: 'Filters.svelte',
        lang: 'svelte',
        code: `<script lang="ts">
  import '@trawlnet/core/styles.css';
  import { QueryBuilder } from '@trawlnet/svelte';
  import { store } from './store';
</script>

<QueryBuilder {store} />`,
      };
    case 'solid':
      return {
        title: 'filters.tsx',
        lang: 'tsx',
        code: `import '@trawlnet/core/styles.css';
import { QueryBuilder } from '@trawlnet/solid';
import { store } from './store';

export const Filters = () => <QueryBuilder store={store} />;`,
      };
    case 'vanilla':
      return {
        title: 'filters.ts',
        lang: 'ts',
        code: `import '@trawlnet/core/styles.css';
import { mountQueryBuilder } from '@trawlnet/dom';
import { store } from './store';

const dispose = mountQueryBuilder(document.getElementById('filters')!, store);
store.subscribe(() => console.log(store.getQuery()));`,
      };
    default:
      return {
        title: 'filters.tsx',
        lang: 'tsx',
        note: renderer === 'all' ? 'React shown; every renderer takes the same store' : undefined,
        code: `'use client';
import '@trawlnet/core/styles.css';
import { QueryBuilder } from '@trawlnet/react';
import { store } from './store';

export function Filters() {
  return <QueryBuilder store={store}${builderProps(s)} />;
}`,
      };
  }
}

const postgres = sqlFormat({ dialect: 'postgres', params: 'numbered' });

/** The playground as code: its schema, a store holding exactly what's on screen, the renderer, and the server side. */
export function CodePanel({ renderer, settings, schema, cossUrl }: { renderer: CodeRenderer; settings: PlaygroundSettings; schema: { code: string; html: string }; cossUrl: string }) {
  const query = useQuery<Fields>();
  const highlighter = useHighlighter();

  const storeCode = useMemo(() => {
    const changed = changedSettings(settings);
    const settingsLine = changed.length ? `\n  settings: {\n${changed.map((c) => `    ${c},`).join('\n')}\n  },` : '';
    return `import { createQueryStore, type QueryOf } from '@trawlnet/core';
import { fields } from './schema';

// The query on screen right now.
const initial: QueryOf<typeof fields> = ${tsLiteral(query)};

export const store = createQueryStore({
  fields,
  initial,${settingsLine}
});`;
  }, [query, settings]);

  const serverCode = useMemo(() => {
    let result: string;
    try {
      const { sql, params } = encode(postgres, query as Query, fields) as { sql: string; params: unknown[] };
      result = `// For the query on screen:\n//   WHERE ${sql.replace(/\n/g, '\n//   ')}\n//   params: ${JSON.stringify(params)}`;
    } catch (e) {
      result = `// For the query on screen, encode() refuses:\n//   ${(e as Error).message}`;
    }
    return `import { assertValidQuery, encode, type QueryOf } from '@trawlnet/core';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { fields } from './schema';

const postgres = sqlFormat({ dialect: 'postgres', params: 'numbered' });

/** Turn an untrusted query from the browser into a parameterized WHERE clause. */
export function toWhere(input: unknown) {
  const query = input as QueryOf<typeof fields>;
  assertValidQuery(fields, query); // throws, listing every invalid rule
  return encode(postgres, query, fields); // { sql, params }
}

${result}`;
  }, [query]);

  const render = renderCode(renderer, settings, cossUrl);
  return (
    <div className="flex flex-col gap-3" data-code-panel>
      <p className="text-muted-foreground text-xs leading-relaxed">Everything on screen as code. The store and server blocks follow your edits and settings; the renderer follows the framework switch.</p>
      <Block code={schema.code} highlighter={highlighter} html={schema.html} lang="ts" note="the playground's fields" title="schema.ts" />
      <Block code={storeCode} highlighter={highlighter} lang="ts" note="live" title="store.ts" />
      <Block code={render.code} highlighter={highlighter} lang={render.lang} note={render.note} title={render.title} />
      <Block code={serverCode} highlighter={highlighter} lang="ts" note="on the server" title="where.ts" />
    </div>
  );
}
