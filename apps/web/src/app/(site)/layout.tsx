import { SiteFooter } from '@/components/site/site-footer';
import { SiteShell } from '@/components/site/site-shell';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell tree={source.getPageTree()}>
      {children}
      <SiteFooter />
    </SiteShell>
  );
}
