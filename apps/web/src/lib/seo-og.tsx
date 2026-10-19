import type { Metadata } from 'next';
import { ogImage } from './og';
import { SEO_ROUTES } from './seo-routes';

const SECTION: Record<string, string | undefined> = { 'UI kits': 'kits', Compare: 'compare', Tools: 'tools' };

/**
 * The OG card of a search-landing page (lib/seo-routes.ts), from the page's own metadata:
 * "Vue Query Builder: open-source, typed, fast" → headline "Vue Query Builder", eyebrow after the colon.
 */
export function seoPageOg(path: string, metadata: Metadata) {
  const raw = typeof metadata.title === 'string' ? metadata.title : (metadata.title as { absolute?: string; default?: string } | undefined)?.absolute ?? '';
  const cut = raw.indexOf(': ');
  const title = cut > 0 ? raw.slice(0, cut) : raw;
  const eyebrow = cut > 0 ? raw.slice(cut + 2).replace(/^./, (c) => c.toUpperCase()) : undefined;
  const group = SEO_ROUTES.find((r) => r.path === path)?.group;
  return ogImage({ title, eyebrow, section: group ? SECTION[group] : undefined, description: metadata.description ?? undefined, path });
}
