'use client';
import { CheckIcon, CopyIcon, FileCodeIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';

export interface SourceFile {
  /** Where the file lands in the user's project. */
  path: string;
  code: string;
  /** Shiki output for `code`. */
  html: string;
}

/** Every file of an example, as tabs named by where they land, each with a copy button. */
export function SourceTabs({ files }: { files: SourceFile[] }) {
  const [active, setActive] = useState(0);
  const { copied, copy } = useCopy();
  const file = files[active]!;
  return (
    <figure className="overflow-hidden rounded-xl border bg-code">
      <div className="flex items-center gap-2 border-b pe-2">
        <ScrollArea className="min-w-0 flex-1" clampContentMinWidth={false}>
          <div className="flex w-max gap-0.5 p-1.5" role="tablist">
            {files.map((f, i) => (
              <button
                aria-selected={i === active}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-xs transition-colors',
                  i === active ? 'bg-background text-foreground shadow-xs/5' : 'text-muted-foreground hover:text-foreground',
                )}
                key={f.path}
                onClick={() => setActive(i)}
                role="tab"
                type="button"
              >
                <FileCodeIcon className="size-3.5 opacity-70" />
                {f.path}
              </button>
            ))}
          </div>
        </ScrollArea>
        <span className="hidden font-mono text-muted-foreground text-xs sm:inline">{file.code.split('\n').length} lines</span>
        <Button aria-label={`Copy ${file.path}`} onClick={() => void copy(file.code)} size="icon-xs" variant="ghost">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <ScrollArea className="max-h-[36rem]" clampContentMinWidth={false} scrollbarGutter>
        <div
          className="text-[0.8125rem] leading-relaxed [&_.shiki]:bg-transparent! [&_.shiki]:p-4 [&_.shiki_span]:text-(--shiki-light) dark:[&_.shiki_span]:text-(--shiki-dark) [&_pre]:w-max [&_pre]:min-w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output of our own source
          dangerouslySetInnerHTML={{ __html: file.html }}
        />
      </ScrollArea>
    </figure>
  );
}
