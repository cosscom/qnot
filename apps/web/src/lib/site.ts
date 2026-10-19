import { basePath, registryBase, siteUrl } from '../../registry/urls.mjs';

// The canonical origin for metadata, OG images, the sitemap and llms.txt (see registry/urls.mjs):
// NEXT_PUBLIC_SITE_URL once a domain is chosen, the Vercel production domain until then.
// Spelled out so Next inlines them into client bundles too (it only replaces literal process.env.X).
const ENV = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
};
export const SITE_URL = siteUrl(ENV);
/** Next's basePath ("" at the root); keep next.config's basePath in sync via NEXT_PUBLIC_BASE_PATH. */
export const BASE_PATH = basePath(ENV);
/** The shadcn registry: `${REGISTRY_BASE}/<name>.json`. */
export const REGISTRY_BASE = registryBase(ENV);
/** A file under public/, for places Next doesn't prefix with basePath itself (dynamic imports, raw URLs). */
export const assetPath = (path: string) => `${BASE_PATH}${path}`;
export const SITE_NAME = 'trawlnet';
export const SITE_TITLE = 'trawlnet: a fast, fully typed query builder for every framework';
export const SITE_DESCRIPTION =
  'A query builder that stays fast at a thousand rules. Fully typed from schema to SQL, framework-agnostic, any UI kit, about 15 KB.';
export const GITHUB_URL = 'https://github.com/sean-brydon/trawlnet';
export const DOCS_ROUTE = '/docs';
export const SEARCH_API = '/docs/search.json';
export const INSTALL = 'pnpm add @trawlnet/core @trawlnet/react';

export interface NavItem {
  href: string;
  label: string;
  /** Another site: a plain link in a new tab. */
  external?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Docs', href: DOCS_ROUTE },
  { label: 'Examples', href: '/examples' },
  { label: 'Playground', href: '/playground' },
  { label: 'Benchmarks', href: '/#benchmarks' },
];

/** The docs sidebar's width (coss ui's default); the header's wordmark cell matches it on docs pages. */
export const DOCS_SIDEBAR_WIDTH = '16rem';
export const SITE_SHELL_ID = 'site-shell';
