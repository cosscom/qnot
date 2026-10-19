// Adapted from cosscom/coss apps/site/src/components/site-shell.tsx (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DOCS_SIDEBAR_WIDTH, SITE_SHELL_ID } from '@/lib/nav';
import { SiteHeader } from './site-header';

/**
 * The page frame of coss.com/ui: vertical rails with corner marks under the header, the sticky
 * header, then the page.
 */
export function SiteShell({
  tree,
  docsSidebar = false,
  className,
  children,
}: {
  tree: PageTree.Root;
  /** The page has the docs sidebar: the header's wordmark cell lines up with it. */
  docsSidebar?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('relative isolate flex min-h-svh flex-col overflow-clip [--header-height:4rem]', className)}
      id={SITE_SHELL_ID}
      style={docsSidebar ? ({ '--sidebar-width': DOCS_SIDEBAR_WIDTH } as CSSProperties) : undefined}
    >
      <div
        aria-hidden="true"
        className="container pointer-events-none absolute inset-0 z-45 before:absolute before:inset-y-0 before:-left-3 before:w-px before:bg-border/64 after:absolute after:inset-y-0 after:-right-3 after:w-px after:bg-border/64"
      />
      <div
        aria-hidden="true"
        className="container pointer-events-none fixed inset-x-0 top-0 z-45 h-(--header-height) before:absolute before:top-[calc(var(--header-height)-4.5px)] before:-left-[11.5px] before:z-1 before:-ml-1 before:size-2 before:rounded-[2px] before:border before:border-border before:bg-popover before:bg-clip-padding before:shadow-xs/5 after:absolute after:top-[calc(var(--header-height)-4.5px)] after:-right-[11.5px] after:z-1 after:-mr-1 after:size-2 after:rounded-[2px] after:border after:border-border after:bg-background after:bg-clip-padding after:shadow-xs/5 dark:after:bg-clip-border dark:before:bg-clip-border"
      />
      <SiteHeader docsSidebar={docsSidebar} tree={tree} />
      {children}
    </div>
  );
}
