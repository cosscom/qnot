import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Tip } from '@/components/tip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CodeBlock({ code, className, label }: { code: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn('relative min-w-0 rounded-xl border bg-muted/50 dark:bg-muted/30', className)}>
      {label && <div className="border-b px-3 py-1.5 font-medium text-muted-foreground text-xs">{label}</div>}
      <Tip label={copied ? 'Copied' : 'Copy'}>
        <Button
          size="icon-xs"
          variant="ghost"
          className="absolute end-1.5 top-1.5"
          aria-label="Copy code"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </Tip>
      <pre className="max-h-[420px] overflow-auto p-3 pe-10 font-mono text-[12px] leading-relaxed">{code}</pre>
    </div>
  );
}
