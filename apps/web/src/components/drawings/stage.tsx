'use client';
// Adapted from cosscom/coss apps/site/src/components/shipyard/stage.tsx (AGPL-3.0); see NOTICE.md.
import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Where a drawing sits. Once the page has hydrated it holds the drawing's parts back
 * (`data-armed`), then lets them drop in when it scrolls into view (`data-in`); drawings.css does
 * the moving. Without script, or with reduced motion, the drawing is simply there.
 */
export function Stage({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.dataset.armed = '';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(() => (el.dataset.in = '')));
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={cn('tn-stage', className)} ref={ref}>
      {children}
    </div>
  );
}
