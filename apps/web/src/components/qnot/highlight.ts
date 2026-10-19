// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HighlighterCore } from 'shiki/core';

export type HighlightLang = 'sql' | 'json' | 'typescript';

// Loaded the first time a highlighted block mounts: three grammars, two themes, no wasm. Until it
// arrives (or if it fails) callers render plain text.
let highlighter: Promise<HighlighterCore> | null = null;
const load = () =>
  (highlighter ??= Promise.all([import('shiki/core'), import('shiki/engine/javascript')]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
    createHighlighterCore({
      themes: [import('shiki/dist/themes/github-light.mjs'), import('shiki/dist/themes/github-dark.mjs')],
      langs: [import('shiki/dist/langs/sql.mjs'), import('shiki/dist/langs/json.mjs'), import('shiki/dist/langs/typescript.mjs')],
      engine: createJavaScriptRegexEngine(),
    }),
  ));

/** Highlighted HTML for `code` (light and dark colors as CSS variables), or null while loading. */
export function useHighlight(code: string, lang: HighlightLang | undefined): string | null {
  const [h, setH] = useState<HighlighterCore | null>(null);
  useEffect(() => {
    if (!lang) return;
    let live = true;
    load().then(
      (x) => live && setH(x),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [lang]);
  return useMemo(
    () => (h && lang ? h.codeToHtml(code, { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false }) : null),
    [h, code, lang],
  );
}
