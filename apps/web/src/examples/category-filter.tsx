'use client';
import { useState, type ReactNode } from 'react';
import { CatalogGrid } from '@/components/catalog';
import { cn } from '@/lib/utils';
import { CATEGORIES, type Category } from './catalog';

/** Catalog cards with an All / Product / Data / Platform / Integration filter. */
export function CategoryFilter({ cards }: { cards: { slug: string; category: Category; node: ReactNode }[] }) {
  const [selected, setSelected] = useState<Category | 'All'>('All');
  const shown = selected === 'All' ? cards : cards.filter((c) => c.category === selected);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-1 self-start rounded-lg bg-muted p-0.5" role="tablist" aria-label="Filter examples by category">
        {(['All', ...CATEGORIES] as const).map((c) => {
          const count = c === 'All' ? cards.length : cards.filter((x) => x.category === c).length;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={selected === c}
              data-category={c}
              onClick={() => setSelected(c)}
              className={cn('flex h-7 items-center gap-1.5 rounded-md px-3 text-sm transition-colors', selected === c ? 'bg-background font-medium shadow-xs/5' : 'text-muted-foreground hover:text-foreground')}
            >
              {c}
              <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      <CatalogGrid>{shown.map((c) => c.node)}</CatalogGrid>
    </div>
  );
}
