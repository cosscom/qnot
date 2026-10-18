import '@trawlnet/core/styles.css';
import { AnchorIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ExamplesPage } from '@/examples/ExamplesPage';
import { PlaygroundPage } from '@/pages/Playground';

/** `#/examples/routing-forms` -> ['examples', 'routing-forms']. */
function useHashRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  const page = route[0] === 'examples' ? 'examples' : 'playground';
  return (
    <TooltipProvider delay={300}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 flex items-center gap-4 border-b bg-background/80 px-6 py-2.5 backdrop-blur">
          <a href="#/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <AnchorIcon className="size-4" />
            </span>
            trawlnet
          </a>
          <Tabs value={page} onValueChange={(v) => (window.location.hash = v === 'examples' ? '#/examples' : '#/')}>
            <TabsList>
              <TabsTab value="playground">Playground</TabsTab>
              <TabsTab value="examples">Examples</TabsTab>
            </TabsList>
          </Tabs>
          <span className="ms-auto hidden text-muted-foreground text-xs sm:block">Fast, typed, framework-agnostic query builder</span>
        </header>
        {page === 'examples' ? <ExamplesPage exampleId={route[1]} /> : <PlaygroundPage />}
      </div>
    </TooltipProvider>
  );
}
