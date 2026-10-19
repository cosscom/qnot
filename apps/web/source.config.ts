import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
import { defineConfig } from 'fumadocs-mdx/config';
import { transformerTwoslash } from 'fumadocs-twoslash';
import { createFileSystemTypesCache } from 'fumadocs-twoslash/cache-fs';
import { brand } from './registry/urls.mjs';

/** Docs say `@qnot/…` and link the default repo; re-point both for the configured brand (registry/urls.mjs). */
function rehypeBrand() {
  const walk = (node: any) => {
    if (node.type === 'text' && typeof node.value === 'string') node.value = brand(node.value);
    if (node.properties?.href && typeof node.properties.href === 'string') node.properties.href = brand(node.properties.href);
    node.children?.forEach(walk);
  };
  return (tree: unknown) => walk(tree);
}

export default defineConfig({
  mdxOptions: {
    // After the defaults (incl. Shiki/Twoslash), so code blocks and their hovers are rewritten too.
    rehypePlugins: (plugins) => [...plugins, rehypeBrand],
    rehypeCodeOptions: {
      themes: { light: 'github-light', dark: 'github-dark' },
      // Twoslash popups can't lazy-load languages, so load the ones they render up front.
      langs: ['ts', 'tsx', 'js', 'jsx', 'json', 'bash', 'sql', 'vue', 'svelte'],
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        // ```ts twoslash blocks compile against the real @qnot packages and fail the build on
        // unexpected type errors, so the docs can't drift from the types.
        // Results are cached on disk by snippet + types, so only changed snippets recompile.
        transformerTwoslash({ typesCache: createFileSystemTypesCache() }),
      ],
    },
  },
});
