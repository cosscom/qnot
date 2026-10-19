'use client';
// Adapted from cosscom/coss apps/site/src/components/mobile-nav.tsx (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerPanel, DrawerPopup, DrawerTrigger } from '@/components/ui/drawer';
import { allGroups } from '@/lib/docs-tree';
import { PRODUCT_COLUMNS } from '@/lib/nav';
import type { NavItem } from '@/lib/site';
import { cn } from '@/lib/utils';

const LINK = 'flex items-center gap-2 py-1.5 text-muted-foreground hover:text-foreground';

/** qnot's links, every coss.com product and every docs page, in a drawer (below `lg`, where the header's menus are hidden). */
export function MobileNav({ tree, items, className }: { tree: PageTree.Root; items: readonly NavItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const link = (href: string, children: ReactNode, external = false) =>
    external ? (
      <a className={LINK} href={href} key={href}>
        {children}
      </a>
    ) : (
      <Link className={LINK} href={href} key={href} onClick={() => setOpen(false)}>
        {children}
      </Link>
    );
  return (
    <Drawer onOpenChange={setOpen} open={open} position="left">
      <DrawerTrigger
        render={
          <Button className={cn('relative -ms-1.5 size-8', className)} size="icon" variant="ghost">
            <MenuIcon className="size-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        }
      />
      <DrawerPopup showCloseButton variant="straight">
        <DrawerPanel className="flex flex-col gap-12 p-6 pt-8" scrollFade={false}>
          <div className="flex flex-col gap-3">
            <div className="font-medium text-sm">Menu</div>
            <div className="flex flex-col gap-1">
              {link('/', 'Home')}
              {items.map((item) => link(item.href, item.label, item.external))}
            </div>
          </div>
          <div className="flex flex-col gap-8">
            {PRODUCT_COLUMNS.map((column) => (
              <div className="flex flex-col gap-3" key={column.title}>
                <div className="font-medium text-sm">{column.title}</div>
                <div className="flex flex-col gap-0.5">{column.links.map((product) => link(product.href, product.label, product.external))}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-8">
            {allGroups(tree).map((group) => (
              <div className="flex flex-col gap-3" key={group.key}>
                <div className="font-medium text-sm">{group.label}</div>
                <div className="flex flex-col gap-0.5">{group.pages.map((page) => link(page.url, page.name))}</div>
              </div>
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  );
}
