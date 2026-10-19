import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import type { ReactNode } from 'react';
import { ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * A content-sized coss scroll area: grows with its content up to `viewportClassName`'s max-height
 * (or width), then scrolls with coss's overlay scrollbars. The stock ScrollArea needs a fixed
 * height; panes here are usually "as tall as the content, at most N".
 */
export function ScrollBox({ className, viewportClassName, children, ...rest }: { className?: string; viewportClassName?: string; children: ReactNode } & Record<`data-${string}`, unknown>) {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative min-h-0 min-w-0', className)} {...rest}>
      <ScrollAreaPrimitive.Viewport
        className={cn('rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background', viewportClassName)}
        data-slot="scroll-area-viewport"
      >
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content" style={{ minWidth: 0 }}>
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
}
