// Adapted from cosscom/coss apps/site/src/components/section-label.tsx (AGPL-3.0); see NOTICE.md.
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

/**
 * Next to the `coss.com` wordmark: the section this site is (`coss.com qnot`), as coss.com names
 * Shipyard and kloq. Every page here belongs to it, so it always shows, and leads to qnot's home.
 */
export function SectionLabel() {
  return (
    <Link className="text-muted-foreground/64 transition-colors hover:text-muted-foreground" href="/">
      {SITE_NAME}
    </Link>
  );
}
