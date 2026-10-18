import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
import { defineConfig } from 'fumadocs-mdx/config';
import { transformerTwoslash } from 'fumadocs-twoslash';
import { createFileSystemTypesCache } from 'fumadocs-twoslash/cache-fs';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: { light: 'github-light', dark: 'github-dark' },
      // Twoslash popups can't lazy-load languages, so load the ones they render up front.
      langs: ['ts', 'tsx', 'js', 'jsx', 'json', 'bash', 'sql', 'vue', 'svelte'],
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        // ```ts twoslash blocks compile against the real @trawlnet packages and fail the build on
        // unexpected type errors, so the docs can't drift from the types.
        // Results are cached on disk by snippet + types, so only changed snippets recompile.
        transformerTwoslash({ typesCache: createFileSystemTypesCache() }),
      ],
    },
  },
});
