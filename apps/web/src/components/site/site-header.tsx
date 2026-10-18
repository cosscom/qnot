// Adapted from cosscom/coss apps/site/src/components/site-header.tsx (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { GITHUB_URL, NAV_ITEMS, SEARCH_API } from '@/lib/site';
import { CommandMenu } from './command-menu';
import { HeaderNav } from './header-nav';
import { MobileNav } from './mobile-nav';
import { SectionLabel } from './section-label';
import { ThemeToggle } from './theme-toggle';
import { GithubIcon, Wordmark } from './wordmark';

/** A header cell: full height, set off from the previous one by a hairline, like the page's ruling. */
const CELL = 'flex h-full items-center border-border/64 border-s';

export function SiteHeader({ tree, docsSidebar = false }: { tree: PageTree.Root; docsSidebar?: boolean }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-sidebar/80 backdrop-blur-sm before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border/64">
      <div className="container relative flex h-(--header-height) w-full items-center gap-2 px-4 sm:px-6">
        <MobileNav className="flex lg:hidden" items={NAV_ITEMS} tree={tree} />
        <div
          className={cn(
            'flex shrink-0 items-center gap-1.5 pe-4 font-bold font-heading text-[1.375em] [font-variation-settings:"GEOM"_50,"opsz"_32] sm:text-2xl lg:pe-5',
            docsSidebar && 'lg:w-[calc(var(--sidebar-width)-(--spacing(8)))]',
          )}
        >
          <Link aria-label="trawlnet home" className="flex items-center gap-2" href="/">
            <Wordmark />
          </Link>
          <SectionLabel />
        </div>
        <div className={`${CELL} ps-3 max-lg:hidden`}>
          <HeaderNav items={NAV_ITEMS} />
        </div>
        <div className="ms-auto flex h-full items-center">
          <div className={`${CELL} px-3 max-md:hidden`}>
            <CommandMenu navItems={NAV_ITEMS} searchApi={SEARCH_API} tree={tree} />
          </div>
          <div className={`${CELL} gap-1 ps-3 max-md:border-s-0 md:ps-4`}>
            <a
              aria-label="GitHub"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-8"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              <GithubIcon className="size-4.5" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
