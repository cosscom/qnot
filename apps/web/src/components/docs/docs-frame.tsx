// Adapted from cosscom/coss apps/site/src/components/docs-frame.tsx (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import type { TOCItemType } from 'fumadocs-core/toc';
import type { CSSProperties, ReactNode } from 'react';
import { Card, CardFrame, CardPanel } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DocsFooter } from '@/components/site/site-footer';
import { DOCS_SIDEBAR_WIDTH } from '@/lib/nav';
import { DocsCopyPage } from './docs-copy-page';
import { DocsSidebar } from './docs-sidebar';
import { DocsTableOfContents } from './docs-toc';

/** The docs layout of coss.com/ui: the sidebar beside the page. */
export function DocsLayoutFrame({ tree, children }: { tree: PageTree.Root; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col">
      <SidebarProvider
        className="container min-h-min flex-1 items-start px-0 [--top-spacing:0] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:[--top-spacing:calc(var(--spacing)*4)]"
        style={{ '--sidebar-width': DOCS_SIDEBAR_WIDTH } as CSSProperties}
      >
        <DocsSidebar tree={tree} />
        <div className="h-full w-full min-w-0">{children}</div>
      </SidebarProvider>
    </main>
  );
}

/** The card-framed docs page with its title, description, "Copy Markdown", and the TOC beside it. */
export function DocsPageFrame({
  title,
  description,
  markdown,
  markdownUrl,
  toc,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  markdown: string;
  /** Where the page is served as Markdown (for "Open in …" links). */
  markdownUrl: string;
  toc: TOCItemType[];
  children: ReactNode;
}) {
  return (
    <div className="flex items-stretch xl:w-full" data-slot="docs">
      <div className="relative flex w-full min-w-0 flex-1 flex-col lg:mt-8 lg:mr-4 lg:mb-8">
        <CardFrame className="border-sidebar-border shadow-lg/5 max-lg:border-none dark:bg-background">
          <Card className="max-lg:rounded-none! dark:bg-background max-lg:[clip-path:none]!">
            <CardPanel className="px-4 py-6 sm:px-6 lg:p-8">
              <div className="mx-auto w-full max-w-3xl">
                <div className="flex min-w-0 flex-col gap-8">
                  <div className="flex flex-col gap-2">
                    <h1 className="scroll-m-20 font-bold font-heading text-3xl tracking-[-0.02em] xl:text-4xl">{title}</h1>
                    {description && <p className="text-muted-foreground sm:text-lg">{description}</p>}
                    <div className="flex flex-wrap items-center gap-2 pt-4">
                      <DocsCopyPage markdownUrl={markdownUrl} page={markdown} />
                    </div>
                  </div>
                  <div className="w-full flex-1 *:data-[slot=alert]:first:mt-0">{children}</div>
                </div>
              </div>
            </CardPanel>
          </Card>
          <div className="px-4 py-6 lg:rounded-b-2xl lg:px-8">
            <DocsFooter />
          </div>
        </CardFrame>
      </div>
      <div className="sticky top-(--header-height) z-30 ms-auto hidden h-[calc(100svh-var(--header-height))] w-72 flex-col overflow-hidden overscroll-none xl:flex">
        <ScrollArea className="**:data-[slot=scroll-area-scrollbar]:hidden" overscrollContain scrollFade>
          <div className="flex min-h-0 flex-col gap-2 py-2">
            <div className="h-(--top-spacing) shrink-0" />
            {toc.length > 0 && <DocsTableOfContents toc={toc} />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
