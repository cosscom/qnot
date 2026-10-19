// Search-landing pages (framework, UI-kit, comparison pages, articles), listed once so the sitemap,
// footer and internal links stay in sync with the routes that exist.
export interface SeoRoute {
  path: string;
  /** Short link text, e.g. "Vue query builder". */
  label: string;
  group: 'Frameworks' | 'UI kits' | 'Compare' | 'Tools' | 'Articles';
}

export const SEO_ROUTES: SeoRoute[] = [];
