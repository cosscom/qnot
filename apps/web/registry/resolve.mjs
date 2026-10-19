// Resolve registry/items.json into shadcn registry items: each file's target in a user's project, and
// the item's npm and registry dependencies, read from the files' own imports so they can't drift.
// Used by scripts/build-registry.mjs (to write public/r) and by the site (example source tabs).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The folder registry files live in, here (src/components/<DIR>) and in a user's project (components/<DIR>). */
const DIR = 'trawlnet';
const OWN_PREFIX = `src/components/${DIR}/`;
const OWN_IMPORT = `@/components/${DIR}/`;
const VENDORED_SHADCN = `${OWN_IMPORT}kits/shadcn-ui/`;
/** coss ui components come from coss's own registry, never copied into ours. */
const COSS = (name) => `https://coss.com/ui/r/${name}.json`;
/**
 * The site vendors shadcn/ui (new-york-v4) components for its shadcn kit preview; published files
 * import the user's own `@/components/ui/*` instead and depend on the built-in shadcn items by bare
 * name, so they resolve to the project's own style (radix or Base UI) and the CLI adapts our file
 * to match. Pinning new-york-v4 URLs breaks Base UI projects (today's `shadcn init` default).
 */
const SHADCN = (name) => name;
const IGNORED_PACKAGES = new Set(['react', 'react-dom', 'next']);

export { registryBase } from './urls.mjs';

/** Where a file lands in the user's project, relative to its root with the default aliases. */
export const installPath = (path) => `components/${DIR}/${path.slice(OWN_PREFIX.length)}`;

const packageOf = (spec) => {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/**
 * @param {{ root: string; base: string }} options root = apps/web; base = registryBase()
 * @returns {{ name: string; type: string; title: string; description: string; docs?: string; files: { path: string; target: string; install: string; content: string }[]; dependencies: string[]; registryDependencies: string[]; own: string[] }[]}
 */
export function resolveRegistry({ root, base }) {
  const manifest = JSON.parse(readFileSync(join(root, 'registry/items.json'), 'utf8'));
  const owner = new Map();
  for (const item of manifest.items) for (const file of item.files) owner.set(file, item.name);

  return manifest.items.map((item) => {
    const dependencies = new Set();
    const registryDependencies = new Set();
    const own = new Set();
    const files = item.files.map((path) => {
      if (!path.startsWith(OWN_PREFIX)) throw new Error(`registry: ${path} must live under ${OWN_PREFIX}`);
      const source = readFileSync(join(root, path), 'utf8');
      // What the user gets: vendored shadcn/ui imports point at their own components/ui.
      const content = source.replaceAll(VENDORED_SHADCN, '@/components/ui/');
      for (const [, spec] of source.matchAll(/(?:from|import)\s+'([^']+)'/g)) {
        if (spec.startsWith('.')) throw new Error(`registry: ${path} uses a relative import (${spec}); use ${OWN_IMPORT}…`);
        if (spec.startsWith(VENDORED_SHADCN)) registryDependencies.add(SHADCN(spec.slice(VENDORED_SHADCN.length)));
        else if (spec.startsWith('@/components/ui/')) registryDependencies.add(COSS(spec.slice('@/components/ui/'.length)));
        else if (spec.startsWith(OWN_IMPORT)) {
          const target = `${OWN_PREFIX}${spec.slice(OWN_IMPORT.length)}`;
          const file = [`${target}.tsx`, `${target}.ts`].find((f) => owner.has(f));
          if (!file) throw new Error(`registry: ${path} imports ${spec}, which no registry item ships`);
          const dep = owner.get(file);
          if (dep !== item.name) {
            own.add(dep);
            registryDependencies.add(`${base}/${dep}.json`);
          }
        } else if (spec.startsWith('@/')) {
          if (spec !== '@/lib/utils') throw new Error(`registry: ${path} imports ${spec}, which isn't installable`);
        } else if (!IGNORED_PACKAGES.has(packageOf(spec))) dependencies.add(packageOf(spec));
      }
      return { path, target: `@components/${DIR}/${path.slice(OWN_PREFIX.length)}`, install: installPath(path), content };
    });
    for (const dep of item.dependencies ?? []) dependencies.add(dep);
    return {
      name: item.name,
      type: item.type,
      title: item.title,
      description: item.description,
      ...(item.docs && { docs: item.docs }),
      files,
      dependencies: [...dependencies].sort(),
      registryDependencies: [...registryDependencies].sort(),
      own: [...own],
    };
  });
}
