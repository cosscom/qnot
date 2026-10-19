// Write the shadcn registry: registry/items.json → .registry/registry.json (absolute URLs for this
// deployment) → `shadcn build` → public/r/<name>.json, served at <site>/r/<name>.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveRegistry } from '../registry/resolve.mjs';
import { registryBase, siteUrl } from '../registry/urls.mjs';

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
  name: 'trawlnet',
  homepage: siteUrl(),
  items: items.map((item) => ({
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    ...(item.docs && { docs: item.docs }),
    author: 'trawlnet (MIT)',
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
    // Each file as published (imports rewritten), staged under .registry/files for `shadcn build`.
    files: item.files.map((f) => ({
      path: stage(f.path, f.content),
      type: f.path.endsWith('.ts') ? 'registry:lib' : 'registry:component',
      target: f.target,
    })),
  })),
};

mkdirSync('.registry', { recursive: true });
writeFileSync('.registry/registry.json', `${JSON.stringify(registry, null, 2)}\n`);
execFileSync('pnpm', ['exec', 'shadcn', 'build', '.registry/registry.json', '--output', 'public/r'], { stdio: 'inherit' });
console.log(`registry: ${items.length} items at ${base}/<name>.json`);
