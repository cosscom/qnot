import type { MetadataRoute } from 'next';
import { EXAMPLES } from '@/examples/catalog';
import { lastModified, pageFileFor } from '@/lib/git-dates';
import { absoluteUrl } from '@/lib/seo';
import { SEO_ROUTES, type SeoRoute } from '@/lib/seo-routes';
import { source } from '@/lib/source';
import { TOOLS } from '@/tools/catalog';

type Entry = MetadataRoute.Sitemap[number];

const PRIORITY: Partial<Record<SeoRoute['group'], number>> = { Frameworks: 0.8, 'UI kits': 0.8, Compare: 0.7, Tools: 0.8 };

// Every public route with the date its source last changed in git (see lib/git-dates.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (path: string, priority: number, files: (string | undefined)[], changeFrequency: Entry['changeFrequency'] = 'monthly'): Entry => ({
    url: absoluteUrl(path),
    lastModified: lastModified(...files),
    changeFrequency,
    priority,
  });
  const site = 'src/app/(site)';
  const entries: Entry[] = [
    entry('/', 1, [`${site}/page.tsx`], 'weekly'),
    ...source.getPages().map((page) =>
      entry(page.url, page.url === '/docs' ? 0.9 : 0.8, [`content/docs/${page.path}`], 'weekly'),
    ),
    entry('/examples', 0.7, [`${site}/examples/page.tsx`, 'src/examples/catalog.tsx']),
    ...EXAMPLES.map((e) => entry(`/examples/${e.slug}`, 0.6, [`src/components/qnot/examples/${e.slug}.tsx`, `${site}/examples/[slug]/page.tsx`])),
    entry('/playground', 0.7, [`${site}/playground/page.tsx`, 'src/playground/Playground.tsx']),
    entry('/kits', 0.7, [`${site}/kits/page.tsx`]),
    entry('/tools', 0.7, [`${site}/tools/page.tsx`, 'src/tools/catalog.ts']),
    ...TOOLS.map((t) => entry(`/tools/${t.slug}`, 0.8, [`${site}/tools/[slug]/page.tsx`, 'src/tools/catalog.ts', 'src/tools/converter.tsx'])),
    ...SEO_ROUTES.map((r) => entry(r.path, PRIORITY[r.group] ?? 0.6, [pageFileFor(r.path)])),
  ];
  // One entry per URL (SEO_ROUTES lists the tools too).
  const seen = new Set<string>();
  return entries.filter((e) => !seen.has(e.url) && seen.add(e.url));
}
