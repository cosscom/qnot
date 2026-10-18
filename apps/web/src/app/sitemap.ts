import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { source } from '@/lib/source';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/examples', '/playground'].map((p) => ({ url: `${SITE_URL}${p}` }));
  return [...pages, ...source.getPages().map((page) => ({ url: `${SITE_URL}${page.url}` }))];
}
