import { DocsLayoutFrame } from '@/components/docs/docs-frame';
import { SiteShell } from '@/components/site/site-shell';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: React.ReactNode }) {
  const tree = source.getPageTree();
  return (
    <SiteShell docsSidebar tree={tree}>
      <DocsLayoutFrame tree={tree}>{children}</DocsLayoutFrame>
    </SiteShell>
  );
}
