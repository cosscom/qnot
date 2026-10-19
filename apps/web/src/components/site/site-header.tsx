// Adapted from cosscom/coss apps/site/src/components/site-header.tsx (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import { COSS_URL, HEADER_BAR_ID } from '@/lib/nav';
import { NAV_ITEMS, SEARCH_API } from '@/lib/site';
import { cn } from '@/lib/utils';
import { CommandMenu } from './command-menu';
import { HeaderLinks } from './header-links';
import { MegaMenu } from './mega-menu';
import { MobileNav } from './mobile-nav';
import { SectionLabel } from './section-label';

/** A header cell: full height, set off from the previous one by a hairline, like the page's ruling. */
const CELL = 'flex h-full items-center border-border/64 border-s';

/**
 * coss.com's header, as its sections (Shipyard, kloq) have it: the `coss.com` wordmark with the
 * section's name, coss.com's "Products" menu and qnot's own links; on the right, search and (where
 * coss.com signs you in) the theme switch and GitHub, in ruled cells.
 */
export function SiteHeader({ tree, docsSidebar = false }: { tree: PageTree.Root; docsSidebar?: boolean }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-sidebar/80 backdrop-blur-sm before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border/64">
      {/* The mega menu's anchor: the page's sheet between the shell's rails (`container` + 12px a side). */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[1440px] -translate-x-1/2" id={HEADER_BAR_ID} />
      <div className="container relative flex h-(--header-height) w-full items-center gap-2 px-4 sm:px-6">
        <MobileNav className="flex lg:hidden" items={NAV_ITEMS} tree={tree} />
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 pe-4 font-bold font-heading text-[1.375em] [font-variation-settings:'GEOM'_50,'opsz'_32] sm:text-2xl lg:pe-5",
            // The sidebar starts at the container's edge; the wordmark after the header's padding
            // (6), and the next cell's rule after the row's gap (2).
            docsSidebar && 'lg:w-[calc(var(--sidebar-width)-(--spacing(8)))]',
          )}
        >
          <a aria-label="coss.com" href={COSS_URL}>
            coss.com
          </a>
          <SectionLabel />
        </div>
        <div className={`${CELL} ps-3 max-lg:hidden`}>
          <MegaMenu links={NAV_ITEMS} />
        </div>
        <div className="ms-auto flex h-full items-center">
          <div className={`${CELL} px-3 max-md:hidden`}>
            <CommandMenu navItems={NAV_ITEMS} searchApi={SEARCH_API} tree={tree} />
          </div>
          {/* No hairline on the right: the cell ends at the page rail (24px of padding, plus 12px once
              the rails are on screen), so its left padding matches that to centre the links. */}
          <div className={`${CELL} ps-3 max-md:border-s-0 md:ps-6 min-[90rem]:ps-9`}>
            <HeaderLinks />
          </div>
        </div>
      </div>
    </header>
  );
}
