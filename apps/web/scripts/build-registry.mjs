// Write the shadcn registry: registry/items.json → .registry/registry.json (absolute URLs for this
// deployment) → `shadcn build` → public/r/<name>.json, served at <site>/r/<name>.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveRegistry } from '../registry/resolve.mjs';
import { DEFAULT_PACKAGE_PREFIX, brand, packageOf, packagePrefix, registryBase, siteUrl } from '../registry/urls.mjs';

const root = process.cwd();
const base = registryBase();
const items = resolveRegistry({ root, base });

function stage(path, content) {
  const staged = join('.registry', 'files', path);
  mkdirSync(dirname(staged), { recursive: true });
  writeFileSync(staged, content);
  return staged;
}

const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'qnot',
  homepage: siteUrl(),
  items: items.map((item) => ({
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    ...(item.docs && { docs: item.docs }),
    author: 'qnot (MIT)',
    // Package names follow NEXT_PUBLIC_PACKAGE_PREFIX (`@qnot/react` → `@coss/qnot` under `@coss/qnot/`).
    dependencies: [...new Set(item.dependencies.map((d) => (d.startsWith(DEFAULT_PACKAGE_PREFIX) ? packageOf(packagePrefix() + d.slice(DEFAULT_PACKAGE_PREFIX.length)) : d)))],
    registryDependencies: item.registryDependencies,
    // Each file as published (imports rewritten), staged under .registry/files for `shadcn build`.
    files: item.files.map((f) => ({
      path: stage(f.path, brand(f.content)),
      type: f.path.endsWith('.ts') ? 'registry:lib' : 'registry:component',
      target: f.target,
    })),
  })),
};

mkdirSync('.registry', { recursive: true });
writeFileSync('.registry/registry.json', `${JSON.stringify(registry, null, 2)}\n`);
rmSync('public/r', { recursive: true, force: true }); // drop items removed from items.json
execFileSync('pnpm', ['exec', 'shadcn', 'build', '.registry/registry.json', '--output', 'public/r'], { stdio: 'inherit' });
console.log(`registry: ${items.length} items at ${base}/<name>.json`);
