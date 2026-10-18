export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trawlnet.dev';
export const SITE_NAME = 'trawlnet';
export const SITE_TITLE = 'trawlnet: a fast, fully typed query builder for every framework';
export const SITE_DESCRIPTION =
  'A query builder that stays fast at a thousand rules. Fully typed from schema to SQL, framework-agnostic, any UI kit, 17 KB.';
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
