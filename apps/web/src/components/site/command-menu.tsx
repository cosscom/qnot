'use client';
// Adapted from cosscom/coss apps/site/src/components/command-menu.tsx (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { BookOpenIcon, CornerDownLeftIcon, SearchIcon, TextIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from '@/components/ui/command';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { allGroups } from '@/lib/docs-tree';
import type { NavItem } from '@/lib/site';
import { useIsMac } from '@/lib/use-is-mac';

interface MenuItem {
  value: string;
  label: ReactNode;
  url: string;
  kind: 'page' | 'section';
}

interface MenuGroup {
  value: string;
  label?: string;
  items: MenuItem[];
}

/** The ⌘K menu: an empty query lists the site's sections and every docs page; a query searches the docs. */
export function CommandMenu({ tree, navItems, searchApi }: { tree: PageTree.Root; navItems: readonly NavItem[]; searchApi: string }) {
  const isMac = useIsMac();
  const [open, setOpen] = useState(false);
  const { search, setSearch, query } = useDocsSearch({ type: 'fetch', api: searchApi }, [searchApi]);

  const pageGroups = useMemo<MenuGroup[]>(() => {
    const groups: MenuGroup[] = [
      {
        value: 'Pages',
        items: [{ href: '/', label: 'Home' }, ...navItems].map((item) => ({ value: `nav ${item.href}`, label: item.label, url: item.href, kind: 'page' as const })),
      },
    ];
    for (const group of allGroups(tree)) {
      const label = typeof group.label === 'string' ? group.label : String(group.label);
      groups.push({
        value: `${label} ${group.key}`,
        label,
        items: group.pages.map((page) => ({ value: `${label} ${page.url}`, label: page.name, url: page.url, kind: 'page' })),
      });
    }
    return groups;
  }, [tree, navItems]);

  const resultGroups = useMemo<MenuGroup[]>(() => {
    if (query.data === 'empty' || !query.data) return pageGroups;
    const groups: MenuGroup[] = [];
    let current: MenuGroup | undefined;
    for (const hit of query.data) {
      if (hit.type === 'page' || !current) {
        current = { value: hit.type === 'page' ? `${hit.content} ${hit.id}` : `Results ${hit.id}`, label: hit.type === 'page' ? hit.content : 'Results', items: [] };
        groups.push(current);
        if (hit.type === 'page') {
          current.items.push({ value: hit.id, label: hit.content, url: hit.url, kind: 'page' });
          continue;
        }
      }
      current.items.push({ value: hit.id, label: hit.content, url: hit.url, kind: 'section' });
    }
    return groups;
  }, [query.data, pageGroups]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || event.key === '/') {
        const t = event.target;
        if ((t instanceof HTMLElement && t.isContentEditable) || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandDialogTrigger className="text-muted-foreground" render={<Button variant="ghost" />}>
        <SearchIcon />
        Search
        <KbdGroup className="gap-1">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd className="aspect-square">K</Kbd>
        </KbdGroup>
      </CommandDialogTrigger>
      <CommandDialogPopup>
        <Command
          filter={null}
          items={resultGroups}
          itemToStringValue={(item) => {
            const { label, url } = item as MenuItem;
            return typeof label === 'string' ? label : url;
          }}
          onValueChange={setSearch}
          value={search}
        >
          <CommandInput placeholder="Search documentation…" />
          <CommandPanel>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandList>
              {(group: MenuGroup) => (
                <CommandGroup items={group.items} key={group.value}>
                  <CommandGroupLabel>{group.label ?? group.value}</CommandGroupLabel>
                  <CommandCollection>
                    {(item: MenuItem) => (
                      <CommandItem className="flex w-full items-center" key={item.value} render={<Link href={item.url} onNavigate={() => setOpen(false)} />}>
                        {item.kind === 'page' ? <BookOpenIcon className="mr-2 size-4 shrink-0 opacity-80" /> : <TextIcon className="mr-2 size-4 shrink-0 opacity-80" />}
                        <span className="flex-1 truncate">{item.label}</span>
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap">Go to page</span>
              <Kbd>
                <CornerDownLeftIcon />
              </Kbd>
            </div>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
