'use client';
// Adapted from cosscom/coss apps/site/src/components/mega-menu.tsx (AGPL-3.0); see NOTICE.md.
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { COSS_URL, HEADER_BAR_ID, type MenuColumn, type MenuLink, PRODUCT_COLUMNS, SITE_SHELL_ID } from '@/lib/nav';
import type { NavItem } from '@/lib/site';
import { cn } from '@/lib/utils';
import { EMAIL_PART, PartDrawing } from './part-drawing';

const TRIGGER = cn(buttonVariants({ variant: 'ghost' }), 'data-popup-open:bg-accent [&_svg]:transition-transform data-popup-open:[&_svg]:rotate-180');

/**
 * The header's mega menu, as on coss.com's sections (Shipyard, kloq): "Products" (every coss.com
 * product by family, from `PRODUCT_COLUMNS`), then the section's own links.
 */
export function MegaMenu({ links }: { links: readonly NavItem[] }) {
  const pathname = usePathname();
  const [shell, setShell] = useState<HTMLElement | null>(null);
  useEffect(() => setShell(document.getElementById(SITE_SHELL_ID)), []);
  return (
    <NavigationMenu.Root className="h-full">
      <NavigationMenu.List className="flex h-full items-center gap-1">
        <NavigationMenu.Item value="products">
          <NavigationMenu.Trigger className={TRIGGER}>
            Products
            <ChevronDownIcon />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className={CONTENT}>
            <Panel columns={PRODUCT_COLUMNS} />
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        {links.map((item) => (
          <NavigationMenu.Item key={item.href}>
            <TopLink active={isActive(pathname, item.href)} item={item} />
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>

      <NavigationMenu.Portal container={shell}>
        <NavigationMenu.Positioner
          align="start"
          anchor={() => document.getElementById(HEADER_BAR_ID)}
          className="z-40 h-(--positioner-height) w-(--anchor-width) transition-[top,height] duration-(--duration) ease-(--easing) data-instant:transition-none"
          collisionAvoidance={{ side: 'none', align: 'none' }}
          sideOffset={0}
          style={{ ['--duration' as string]: '0.3s', ['--easing' as string]: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <NavigationMenu.Popup className="relative h-(--popup-height) w-full origin-top overflow-hidden border-border/64 border-x border-b bg-popover shadow-[0_24px_48px_-24px_--theme(--color-black/16%)] outline-none transition-[opacity,height,translate] duration-(--duration) ease-(--easing) data-ending-style:-translate-y-1 data-starting-style:-translate-y-1 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-150 dark:shadow-none">
            <NavigationMenu.Viewport className="relative h-full w-full" />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

const CONTENT = 'w-(--anchor-width) transition-opacity duration-(--duration) ease-(--easing) data-ending-style:opacity-0 data-starting-style:opacity-0';

function isActive(pathname: string, href: string): boolean {
  if (href.includes('#')) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TopLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <NavigationMenu.Link
      active={active}
      className={cn(buttonVariants({ variant: 'ghost' }), 'data-active:text-foreground')}
      render={item.external ? <a href={item.href} rel="noreferrer" target="_blank" /> : <Link href={item.href} />}
    >
      {item.label}
    </NavigationMenu.Link>
  );
}

/** A panel: one ruled column per group, then a featured cell. */
function Panel({ columns }: { columns: readonly MenuColumn[] }) {
  return (
    <div className="grid grid-cols-[repeat(var(--columns),minmax(0,1fr))_minmax(0,1.25fr)]" style={{ ['--columns' as string]: columns.length }}>
      {columns.map((column) => (
        <section aria-label={column.title} className="flex flex-col gap-3 border-border/64 border-e px-3 py-5" key={column.title}>
          <span className="px-2.5 font-medium text-muted-foreground text-xs">{column.title}</span>
          <ul className="flex flex-col gap-0.5">
            {column.links.map((link) => (
              <li key={link.label}>
                <MenuEntry link={link} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="drafting-grid flex flex-col p-5">
        <AgentFeature />
      </div>
    </div>
  );
}

function MenuEntry({ link }: { link: MenuLink }) {
  const Icon = link.icon;
  return (
    <NavigationMenu.Link
      className="group flex items-start gap-3 rounded-lg px-2.5 py-2 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
      closeOnClick
      render={link.external ? <a href={link.href} /> : <Link href={link.href} />}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-foreground shadow-xs/5 transition-colors group-hover:border-foreground/24">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium text-sm">
          {link.label}
          {link.badge && (
            <Badge size="sm" variant="info">
              {link.badge}
            </Badge>
          )}
        </span>
        <span className="text-muted-foreground text-xs leading-snug">{link.description}</span>
      </span>
    </NavigationMenu.Link>
  );
}

/** The products panel's feature: the catalog's email part, and coss.com's agent setup. */
function AgentFeature() {
  return (
    <NavigationMenu.Link
      className="group flex h-full flex-col justify-between gap-4 rounded-lg border bg-background p-4 outline-none transition-colors hover:border-foreground/24 focus-visible:border-foreground/24"
      closeOnClick
      render={<a href={`${COSS_URL}/#agents`} />}
    >
      <PartDrawing className="mx-auto w-28" part={EMAIL_PART} />
      <span className="flex flex-col gap-1">
        <span className="font-medium text-sm">Set up coss.com with your agent</span>
        <span className="text-muted-foreground text-xs leading-snug">
          One prompt for Claude Code, Cursor or Codex: it installs the SDK and wires up the parts you pick.
        </span>
      </span>
      <span className="flex items-center gap-1 font-medium text-xs">
        Get the prompt
        <ChevronRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
      </span>
    </NavigationMenu.Link>
  );
}
