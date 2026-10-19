// Part of qnot (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { useHighlight, type HighlightLang } from '@/components/qnot/highlight';
import { ScrollBox } from '@/components/qnot/scroll-box';
import { Tip } from '@/components/qnot/tip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CodeBlock({ code, className, label, wrap, lang }: { code: string; className?: string; label?: string; wrap?: boolean; lang?: HighlightLang }) {
  const [copied, setCopied] = useState(false);
  const html = useHighlight(code, lang);
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
      <ScrollBox viewportClassName="max-h-[420px]">
        {html ? (
          <div
            className={cn(
              'font-mono text-[12px] leading-relaxed [&_.line]:px-0! [&_.shiki]:bg-transparent! [&_.shiki]:p-3 [&_.shiki]:pe-10 [&_.shiki_span]:text-(--shiki-light) dark:[&_.shiki_span]:text-(--shiki-dark)',
              wrap ? '[&_pre]:whitespace-pre-wrap [&_pre]:break-words' : '[&_pre]:w-max [&_pre]:min-w-full',
            )}
            // Shiki's output: our own code string, escaped by the highlighter.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className={cn('p-3 pe-10 font-mono text-[12px] leading-relaxed', wrap && 'whitespace-pre-wrap break-words')}>{code}</pre>
        )}
      </ScrollBox>
    </div>
  );
}
