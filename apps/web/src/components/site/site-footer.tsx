// Adapted from cosscom/coss apps/site/src/components/site-footer.tsx (AGPL-3.0); see NOTICE.md.
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { GITHUB_URL } from '@/lib/site';
import { Wordmark } from './wordmark';

const LINKS = [
  { text: 'Docs', url: '/docs' },
  { text: 'Examples', url: '/examples' },
  { text: 'Playground', url: '/playground' },
  { text: 'llms.txt', url: '/llms.txt' },
  { text: 'GitHub', url: GITHUB_URL },
] as const;

function FooterLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Footer" className={className}>
      {LINKS.map((link) => (
        <Link className="hover:text-foreground" href={link.url} key={link.url}>
          {link.text}
        </Link>
      ))}
    </nav>
  );
}

function Colophon({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <Link className='flex items-center gap-2 font-bold font-heading text-foreground text-lg [font-variation-settings:"GEOM"_50,"opsz"_32]' href="/">
        <Wordmark />
      </Link>
      <p className="text-muted-foreground text-sm">MIT licensed · built with care for big queries</p>
    </div>
  );
}

/** Footer of the landing and catalog pages (full width, below the rails). */
export function SiteFooter() {
  return (
    <footer className="relative mt-8 py-8 text-muted-foreground before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border/64">
      <div className="container flex w-full flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <Colophon />
        <FooterLinks className="flex flex-wrap gap-x-6 gap-y-2 text-sm" />
      </div>
    </footer>
  );
}

/** Footer of a docs page: inside its card. */
export function DocsFooter() {
  return (
    <footer className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <Colophon />
      <FooterLinks className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm" />
    </footer>
  );
}
