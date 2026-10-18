'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/site';

/** The section links after the wordmark; the current section reads in the foreground colour. */
export function HeaderNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active = !item.href.includes('#') && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            className={cn(
              'rounded-lg px-2.5 py-1.5 font-medium text-sm transition-colors hover:text-foreground',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
