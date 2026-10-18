'use client';
// Adapted from cosscom/coss apps/site/src/lib/use-active-indicator.ts (AGPL-3.0); see NOTICE.md.
import { type RefObject, useEffect, useLayoutEffect, useState } from 'react';

export type IndicatorRect = { top: number; left: number; width: number; height: number };

/** Where the link to `href` sits inside `container`, for a highlight that slides between links. */
export function useActiveIndicator(container: RefObject<HTMLElement | null>, href: string | null) {
  const [rect, setRect] = useState<IndicatorRect | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const root = container.current;
    const link = href ? root?.querySelector<HTMLElement>(`a[href="${CSS.escape(href)}"]`) : null;
    if (!root || !link) {
      setRect(null);
      return;
    }
    const measure = () => {
      const outer = root.getBoundingClientRect();
      const inner = link.getBoundingClientRect();
      setRect({ top: inner.top - outer.top, left: inner.left - outer.left, width: inner.width, height: inner.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [container, href]);

  useEffect(() => {
    if (!rect) return setAnimate(false);
    if (animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [rect, animate]);

  return { rect, animate };
}
