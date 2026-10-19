import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBrand } from '@/lib/site';
import { libInfo, type LibId } from '@/lib/bench-series';
import { metricValue } from './bench-tables';
import { LinkGrid } from './blocks';

/** The demo's schema file exactly as it runs on these pages, for the code samples. */
export const demoFieldsSource = () => withBrand(readFileSync(join(process.cwd(), 'src', 'components', 'seo', 'demo-fields.ts'), 'utf8'));

/** Where each comparison lives, and the one line that sums it up. */
export const COMPARES: Record<Exclude<LibId, 'qnot' | 'qnot-dom'>, { href: string; summary: string }> = {
  rqb: { href: '/compare/react-querybuilder', summary: 'The most used React query builder. Huge ecosystem, React Native, many export formats.' },
  raqb: { href: '/compare/react-awesome-query-builder', summary: 'The feature-rich React option: functions, list groups, many widgets. qnot matches it feature for feature.' },
  jqqb: { href: '/compare/jquery-querybuilder', summary: 'The classic jQuery plugin with Bootstrap styling and SQL/Mongo plugins.' },
  syncfusion: { href: '/compare/syncfusion-query-builder', summary: 'A commercial component in the Syncfusion suite, with wrappers for most frameworks.' },
  devextreme: { href: '/compare/devextreme-filterbuilder', summary: 'A commercial filter builder in DevExtreme, made to feed its DataGrid.' },
};

/** Comparison links with a measured line each: qnot's number next to theirs, at 1,000 rules. */
export function CompareLinks({ ids, against = 'qnot' }: { ids: (keyof typeof COMPARES)[]; against?: 'qnot' | 'qnot-dom' }) {
  return (
    <LinkGrid
      columns={ids.length >= 4 ? 4 : ids.length === 3 ? 3 : 2}
      items={ids.map((id) => {
        const ours = Math.round(metricValue(against, 'mount') ?? 0);
        const theirs = Math.round(metricValue(id, 'mount') ?? 0);
        return {
          name: `qnot vs ${libInfo(id).name}`,
          tag: `render ${ours} vs ${theirs.toLocaleString('en-US')} ms`,
          summary: COMPARES[id].summary,
          href: COMPARES[id].href,
        };
      })}
    />
  );
}
