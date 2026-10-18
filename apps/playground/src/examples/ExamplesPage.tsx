import { ScrollBox } from '@/components/scroll-box';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EXAMPLES } from './registry';

const CATEGORIES = ['Product', 'Data', 'Platform', 'Integration'] as const;

export function ExamplesPage({ exampleId }: { exampleId?: string }) {
  const current = EXAMPLES.find((e) => e.meta.id === exampleId) ?? EXAMPLES[0]!;
  return (
    <div className="grid min-h-[calc(100vh-53px)] lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b lg:border-e lg:border-b-0">
        <ScrollBox className="lg:sticky lg:top-[53px]" viewportClassName="lg:max-h-[calc(100vh-53px)]">
          <nav className="flex flex-col gap-5 p-4">
            <div className="flex items-center gap-2 px-2">
              <span className="font-semibold text-sm">Examples</span>
              <Badge variant="outline">{EXAMPLES.length}</Badge>
            </div>
            {CATEGORIES.map((cat) => {
              const items = EXAMPLES.filter((e) => e.meta.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat} className="flex flex-col gap-0.5">
                  <div className="px-2 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">{cat}</div>
                  {items.map(({ meta }) => {
                    const Icon = meta.icon;
                    const active = meta.id === current.meta.id;
                    return (
                      <a
                        key={meta.id}
                        href={`#/examples/${meta.id}`}
                        data-example={meta.id}
                        className={cn('flex gap-2.5 rounded-lg px-2 py-2 transition-colors', active ? 'bg-muted' : 'hover:bg-muted/60')}
                      >
                        <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground')} />
                        <span className="flex flex-col">
                          <span className={cn('text-sm', active && 'font-medium')}>{meta.title}</span>
                          <span className="text-muted-foreground text-xs leading-snug">{meta.blurb}</span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </ScrollBox>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">
        <current.Demo key={current.meta.id} />
      </main>
    </div>
  );
}
