import { ChevronDownIcon, CodeIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CodeBlock } from '@/components/code-block';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface ExampleMeta {
  id: string;
  title: string;
  /** One line for the sidebar: what it's for. */
  blurb: string;
  icon: LucideIcon;
  category: 'Product' | 'Data' | 'Platform' | 'Integration';
}

/** Standard layout for an example: description, live demo, collapsible code. */
export function ExampleFrame({ meta, description, code, children, bleed }: { meta: ExampleMeta; description: ReactNode; code: string; children: ReactNode; bleed?: boolean }) {
  const Icon = meta.icon;
  return (
    <article className="flex min-w-0 flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
          <Icon className="size-4.5" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-xl tracking-tight">{meta.title}</h1>
          <div className="max-w-3xl text-muted-foreground text-sm leading-relaxed">{description}</div>
        </div>
      </header>
      <div className={bleed ? '' : 'rounded-2xl border bg-card p-4 shadow-xs/5 sm:p-5'}>{children}</div>
      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-2 font-medium text-muted-foreground text-sm hover:text-foreground">
          <CodeIcon className="size-4" />
          Code
          <ChevronDownIcon className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <CodeBlock className="mt-3" code={code.trim()} />
        </CollapsiblePanel>
      </Collapsible>
    </article>
  );
}
