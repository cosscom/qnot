'use client';
// Adapted from cosscom/coss apps/site/src/components/shipyard/copy-line.tsx (AGPL-3.0); see NOTICE.md.
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopy } from '@/lib/use-copy';

/** A command to run, with a button that copies it. */
export function CopyLine({ label, command }: { label: string; command: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-8">
      <span className="w-28 shrink-0 font-mono text-muted-foreground text-xs">{label}</span>
      <code className="min-w-0 flex-1 break-all font-mono text-[0.9375rem]">{command}</code>
      <Button aria-live="polite" className="shrink-0 self-start px-3 sm:self-auto" onClick={() => copy(command)} size="sm" variant="outline">
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
