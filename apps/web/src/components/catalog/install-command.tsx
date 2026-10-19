'use client';
import { CheckIcon, CopyIcon, TerminalIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';

const RUNNERS = [
  { id: 'pnpm', run: 'pnpm dlx shadcn@latest add' },
  { id: 'npm', run: 'npx shadcn@latest add' },
  { id: 'bun', run: 'bunx --bun shadcn@latest add' },
  { id: 'yarn', run: 'yarn dlx shadcn@latest add' },
] as const;

/** `shadcn add <url>` for the user's package manager, with a copy button. */
export function InstallCommand({ url, className }: { url: string; className?: string }) {
  const [runner, setRunner] = useState<(typeof RUNNERS)[number]['id']>('pnpm');
  const { copied, copy } = useCopy();
  const command = `${RUNNERS.find((r) => r.id === runner)!.run} ${url}`;
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-code', className)}>
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <TerminalIcon className="mx-1.5 size-3.5 text-muted-foreground" />
        {RUNNERS.map((r) => (
          <button
            className={cn('rounded-md px-2 py-0.5 font-mono text-xs transition-colors', r.id === runner ? 'bg-background text-foreground shadow-xs/5' : 'text-muted-foreground hover:text-foreground')}
            key={r.id}
            onClick={() => setRunner(r.id)}
            type="button"
          >
            {r.id}
          </button>
        ))}
        <Button aria-label="Copy install command" className="ms-auto" onClick={() => void copy(command)} size="icon-xs" variant="ghost">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[0.8125rem]">
        <code>{command}</code>
      </pre>
    </div>
  );
}
