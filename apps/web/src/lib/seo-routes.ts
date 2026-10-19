// Search-landing pages (framework, UI-kit, comparison pages, articles), listed once so the sitemap,
// footer and internal links stay in sync with the routes that exist.
export interface SeoRoute {
  path: string;
  /** Short link text, e.g. "Vue query builder". */
  label: string;
  group: 'Frameworks' | 'UI kits' | 'Compare' | 'Tools' | 'Articles';
}

export const SEO_ROUTES: SeoRoute[] = [
  { path: '/tools', label: 'All converters', group: 'Tools' },
  { path: '/tools/sql-to-mongodb', label: 'SQL to MongoDB', group: 'Tools' },
  { path: '/tools/mongodb-to-sql', label: 'MongoDB to SQL', group: 'Tools' },
  { path: '/tools/sql-to-jsonlogic', label: 'SQL to JsonLogic', group: 'Tools' },
  { path: '/tools/jsonlogic-to-sql', label: 'JsonLogic to SQL', group: 'Tools' },
  { path: '/tools/jsonlogic-to-mongodb', label: 'JsonLogic to MongoDB', group: 'Tools' },
  { path: '/tools/sql-to-elasticsearch', label: 'SQL to Elasticsearch', group: 'Tools' },
  { path: '/tools/react-querybuilder-to-sql', label: 'react-querybuilder to SQL', group: 'Tools' },
  { path: '/tools/raqb-to-sql', label: 'RAQB to SQL', group: 'Tools' },
];
