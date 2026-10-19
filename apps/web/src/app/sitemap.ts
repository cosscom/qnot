import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { source } from '@/lib/source';
import { EXAMPLES } from '@/examples/catalog';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/examples', ...EXAMPLES.map((e) => `/examples/${e.slug}`), '/playground', '/kits'].map((p) => ({ url: `${SITE_URL}${p}` }));
  return [...pages, ...source.getPages().map((page) => ({ url: `${SITE_URL}${page.url}` }))];
}
