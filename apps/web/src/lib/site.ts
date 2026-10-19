import { basePath, brand, registryBase, repoUrl, siteUrl } from '../../registry/urls.mjs';

// The canonical origin for metadata, OG images, the sitemap and llms.txt (see registry/urls.mjs):
// NEXT_PUBLIC_SITE_URL once a domain is chosen, the Vercel production domain until then.
// Spelled out so Next inlines them into client bundles too (it only replaces literal process.env.X).
const ENV = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL,
  NEXT_PUBLIC_PACKAGE_PREFIX: process.env.NEXT_PUBLIC_PACKAGE_PREFIX,
};
export const SITE_URL = siteUrl(ENV);
/** Next's basePath ("" at the root); keep next.config's basePath in sync via NEXT_PUBLIC_BASE_PATH. */
export const BASE_PATH = basePath(ENV);
/** The shadcn registry: `${REGISTRY_BASE}/<name>.json`. */
export const REGISTRY_BASE = registryBase(ENV);
/** A file under public/, for places Next doesn't prefix with basePath itself (dynamic imports, raw URLs). */
export const assetPath = (path: string) => `${BASE_PATH}${path}`;
export const SITE_NAME = 'qnot';
export const SITE_TITLE = 'qnot: a fast, fully typed query builder for every framework';
export const SITE_DESCRIPTION =
  'A query builder that stays fast at a thousand rules. Fully typed from schema to SQL, framework-agnostic, any UI kit, about 15 KB.';
/** The repository (NEXT_PUBLIC_REPO_URL; see registry/urls.mjs). */
export const GITHUB_URL = repoUrl(ENV);
/** Any text the site shows, with package names and repo links for the configured brand (NEXT_PUBLIC_PACKAGE_PREFIX, NEXT_PUBLIC_REPO_URL). */
export const withBrand = (text: string) => brand(text, ENV);
export const DOCS_ROUTE = '/docs';
export const SEARCH_API = '/docs/search.json';
export const INSTALL = withBrand('pnpm add @qnot/core @qnot/react');

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
  { label: 'Kits', href: '/kits' },
  { label: 'Tools', href: '/tools' },
  { label: 'Benchmarks', href: '/#benchmarks' },
];
