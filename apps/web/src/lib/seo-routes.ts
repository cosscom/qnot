// Search-landing pages (framework, UI-kit, comparison and tool pages), listed once so the sitemap,
// footer and internal links stay in sync with the routes that exist.
export interface SeoRoute {
  path: string;
  /** Short link text, e.g. "Vue query builder". */
  label: string;
  group: 'Frameworks' | 'UI kits' | 'Compare' | 'Tools';
}

export const SEO_ROUTES: SeoRoute[] = [
  { path: '/react-query-builder', label: 'React query builder', group: 'Frameworks' },
  { path: '/vue-query-builder', label: 'Vue query builder', group: 'Frameworks' },
  { path: '/svelte-query-builder', label: 'Svelte query builder', group: 'Frameworks' },
  { path: '/solid-query-builder', label: 'Solid query builder', group: 'Frameworks' },
  { path: '/javascript-query-builder', label: 'JavaScript query builder', group: 'Frameworks' },
  { path: '/shadcn-query-builder', label: 'shadcn/ui query builder', group: 'UI kits' },
  { path: '/coss-ui-query-builder', label: 'coss ui query builder', group: 'UI kits' },
  { path: '/mui-query-builder', label: 'MUI query builder', group: 'UI kits' },
  { path: '/headless-query-builder', label: 'Headless query builder', group: 'UI kits' },
  { path: '/benchmarks', label: 'Benchmarks', group: 'Compare' },
  { path: '/compare', label: 'All comparisons', group: 'Compare' },
  { path: '/compare/react-querybuilder', label: 'vs react-querybuilder', group: 'Compare' },
  { path: '/compare/react-awesome-query-builder', label: 'vs react-awesome-query-builder', group: 'Compare' },
  { path: '/compare/jquery-querybuilder', label: 'vs jQuery QueryBuilder', group: 'Compare' },
  { path: '/compare/syncfusion-query-builder', label: 'vs Syncfusion', group: 'Compare' },
  { path: '/compare/devextreme-filterbuilder', label: 'vs DevExtreme', group: 'Compare' },
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
