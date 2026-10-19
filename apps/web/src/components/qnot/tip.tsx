// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
'use client';

import type { ReactElement, ReactNode } from 'react';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';

/** Wrap any element (button, handle, toggle) in a coss tooltip. */
export function Tip({ label, children, side }: { label: ReactNode; children: ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup side={side}>{label}</TooltipPopup>
    </Tooltip>
  );
}
