'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Renders `children` only after hydration. The live demos create their stores in the browser and
 * @trawlnet/react's hooks don't provide server snapshots yet, so they skip SSR; the placeholder keeps
 * the layout from jumping.
 */
export function ClientOnly({ children, minHeight = 320, className }: { children: ReactNode; minHeight?: number; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (mounted) return <>{children}</>;
  return (
    <div className={cn('flex animate-pulse flex-col gap-3', className)} style={{ minHeight }} aria-busy="true" aria-label="Loading demo">
      <div className="h-9 w-2/3 rounded-lg bg-muted" />
      <div className="h-8 w-full rounded-lg bg-muted/70" />
      <div className="h-8 w-5/6 rounded-lg bg-muted/70" />
      <div className="h-8 w-3/4 rounded-lg bg-muted/50" />
    </div>
  );
}
