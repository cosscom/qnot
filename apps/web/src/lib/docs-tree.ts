// Adapted from cosscom/coss apps/site/src/lib/docs-tree.ts (AGPL-3.0); see NOTICE.md.
import type * as PageTree from 'fumadocs-core/page-tree';
import type { ReactNode } from 'react';

export interface NavPage {
  name: ReactNode;
  url: string;
}

export interface NavGroup {
  key: string;
  label: ReactNode;
  pages: NavPage[];
}

/** Top-level folders marked `"root": true`; a tree without any is one root itself. */
export function rootFolders(tree: PageTree.Root): PageTree.Folder[] {
  const roots = tree.children.filter((node): node is PageTree.Folder => node.type === 'folder' && !!node.root);
  if (roots.length > 0) return roots;
  return [{ type: 'folder', name: tree.name, children: tree.children }];
}

export function activeRoot(tree: PageTree.Root, pathname: string): PageTree.Folder | undefined {
  const roots = rootFolders(tree);
  return (
    roots.find((root) => pagesOf(root).some((page) => page.url === pathname)) ??
    roots.find((root) => pagesOf(root).some((page) => pathname.startsWith(`${page.url}/`))) ??
    roots[0]
  );
}

export function navGroups(tree: PageTree.Root, pathname: string): NavGroup[] {
  const root = activeRoot(tree, pathname);
  return root ? groupsOf(root) : [];
}

export function allGroups(tree: PageTree.Root): NavGroup[] {
  return rootFolders(tree).flatMap(groupsOf);
}

/** A folder as sidebar groups: leading pages, then one group per separator or nested folder. */
export function groupsOf(folder: PageTree.Folder): NavGroup[] {
  const groups: NavGroup[] = [];
  let current: Omit<NavGroup, 'key'> = { label: folder.name, pages: [] };
  const flush = () => {
    if (current.pages.length > 0) groups.push({ key: current.pages[0]?.url ?? '', ...current });
  };
  if (folder.index) current.pages.push(folder.index);
  for (const node of folder.children) {
    if (node.type === 'page') {
      if (!current.pages.some((page) => page.url === node.url)) current.pages.push(node);
    } else if (node.type === 'separator') {
      flush();
      current = { label: node.name ?? '', pages: [] };
    } else {
      flush();
      const pages = pagesOf(node);
      if (pages.length > 0) groups.push({ key: pages[0]?.url ?? '', label: node.name, pages });
      current = { label: '', pages: [] };
    }
  }
  flush();
  return groups;
}

export function pagesOf(folder: PageTree.Folder): NavPage[] {
  const pages: NavPage[] = [];
  const seen = new Set<string>();
  const add = (page: NavPage) => {
    if (seen.has(page.url)) return;
    seen.add(page.url);
    pages.push(page);
  };
  if (folder.index) add(folder.index);
  for (const node of folder.children) {
    if (node.type === 'page') add(node);
    else if (node.type === 'folder') for (const page of pagesOf(node)) add(page);
  }
  return pages;
}
