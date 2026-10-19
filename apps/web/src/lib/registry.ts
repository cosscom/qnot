import 'server-only';
import { resolveRegistry, type ResolvedItem } from '../../registry/resolve.mjs';
import { REGISTRY_BASE } from './site';

// The shadcn registry as the site sees it (pages read it at build time; nothing reads files at runtime).
let cache: ResolvedItem[] | undefined;
const items = () => (cache ??= resolveRegistry({ root: process.cwd(), base: REGISTRY_BASE }));

export const registryItem = (name: string): ResolvedItem | undefined => items().find((i) => i.name === name);
export const registryItems = (): ResolvedItem[] => items();

/** `<registry>/<name>.json`, what `shadcn add` takes. */
export const registryUrl = (name: string) => `${REGISTRY_BASE}/${name}.json`;

/** Every file an item installs: its own first, then the items it depends on (depth-first). */
export function installedFiles(name: string): { install: string; content: string }[] {
  const seen = new Set<string>();
  const out: { install: string; content: string }[] = [];
  const visit = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    const item = registryItem(n);
    if (!item) throw new Error(`registry: no item "${n}"`);
    for (const f of item.files) out.push({ install: f.install, content: f.content });
    item.own.forEach(visit);
  };
  visit(name);
  return out;
}
